import { existsSync } from 'node:fs';
import { createServer, type Server as HttpServer } from 'node:http';
import { resolve } from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { legalMoves, viewFor } from '@napoleon/engine';
import type { Seat } from '@napoleon/engine';
import { chooseBotMove, DEFAULT_BOT_STRATEGY } from '@napoleon/bot';
import { parseClientMessage } from '@napoleon/protocol';
import type { ServerMessage } from '@napoleon/protocol';
import { RoomManager } from './rooms.js';
import { createStaticHandler } from './static.js';

// A short, randomized pause before a bot acts — purely for feel (so a
// bot's turn doesn't feel instant/jarring), not for correctness. Tests
// that play whole bot-driven hands set NAPOLEON_FAST_BOTS to skip the
// pacing (a 4-player hand is ~50 bot moves; at the real delay that's
// 25-45 real seconds, fine once but slow for routine `pnpm test`). Read
// fresh on every call, not hoisted into a module-level constant — ES
// imports are evaluated before a test file's own top-level statements,
// so a constant frozen at import time would miss an env var a test sets
// after importing this module.
function botMoveDelayRange(): [number, number] {
  return process.env.NAPOLEON_FAST_BOTS ? [0, 1] : [500, 900];
}

interface Session {
  code: string;
  seat: Seat;
}

export interface NapoleonServer {
  httpServer: HttpServer;
  wss: WebSocketServer;
  manager: RoomManager;
  close: () => Promise<void>;
}

function send(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

function resolveClientDist(): string | null {
  const override = process.env.CLIENT_DIST_PATH;
  if (override) return override;
  // Works whether this file is running as TS from src/ (dev, via tsx) or
  // as the esbuild-bundled dist/index.js (production) — both sit two
  // directories above packages/, so packages/client/dist is always "up
  // two, over to client/dist" from here.
  const candidate = resolve(import.meta.dirname, '../../client/dist');
  return existsSync(candidate) ? candidate : null;
}

export function startServer(port: number): NapoleonServer {
  const manager = new RoomManager();
  const clientDist = resolveClientDist();
  const httpServer = createServer(clientDist ? createStaticHandler(clientDist) : undefined);
  if (clientDist) {
    console.log(`Serving client build from ${clientDist}`);
  }
  const wss = new WebSocketServer({ server: httpServer });

  const sessionOf = new WeakMap<WebSocket, Session>();
  // code -> seat -> the live socket currently attached to that seat.
  const socketsByRoom = new Map<string, Map<Seat, WebSocket>>();

  function attach(ws: WebSocket, code: string, seat: Seat): void {
    sessionOf.set(ws, { code, seat });
    let seatMap = socketsByRoom.get(code);
    if (!seatMap) {
      seatMap = new Map();
      socketsByRoom.set(code, seatMap);
    }
    seatMap.set(seat, ws);
  }

  function sendState(ws: WebSocket, code: string, seat: Seat): void {
    const room = manager.getRoom(code);
    if (!room || !room.state) return;
    // legalMoves() during the 'discard' phase enumerates every valid card
    // combination (C(handSize+widowSize, widowSize) — thousands of them);
    // that's correct for the engine's API but not something to ship over
    // the wire. A discard UI is built from `view.hand` and
    // `view.config.widowSize` directly, and the server still validates the
    // actual discard move authoritatively when it arrives.
    const moves = room.state.phase === 'discard' ? [] : legalMoves(room.state, seat);
    const names = room.seats.map((s) => s.name);
    send(ws, { type: 'state', view: viewFor(room.state, seat), legalMoves: moves, names });
  }

  function broadcastState(code: string): void {
    const seatMap = socketsByRoom.get(code);
    if (!seatMap) return;
    for (const [seat, ws] of seatMap) sendState(ws, code, seat);
  }

  function sendRoster(ws: WebSocket, code: string): void {
    const room = manager.getRoom(code);
    if (!room) return;
    send(ws, { type: 'roster', code, players: room.players, names: room.seats.map((s) => s.name) });
  }

  function broadcastRoster(code: string): void {
    const seatMap = socketsByRoom.get(code);
    if (!seatMap) return;
    for (const ws of seatMap.values()) sendRoster(ws, code);
  }

  /** If it's now a bot's turn, plays its move after a short delay, then
   * checks again — cascading through any further consecutive bot turns
   * until a human's turn comes up or the hand ends. Bots never trigger
   * `nextHand` themselves; only a connected human advances past
   * handOver (see DECISIONS.md). Safe to call unconditionally after any
   * state-changing operation — it's a no-op when it isn't a bot's turn. */
  function scheduleBotTurnIfAny(code: string): void {
    const [minDelay, maxDelay] = botMoveDelayRange();
    setTimeout(
      () => {
        const room = manager.getRoom(code);
        if (!room || !room.state || room.state.phase === 'handOver') return;
        const actingSeat = room.state.turn;
        if (!room.seats[actingSeat]?.isBot) return;

        const view = viewFor(room.state, actingSeat);
        // Bots run in-process, not over the wire, so they get the
        // engine's true legalMoves (including the full discard-
        // combination list a real client never receives — see
        // DECISIONS.md #21 and packages/bot/test/property.test.ts).
        const moves = legalMoves(room.state, actingSeat);
        const move = chooseBotMove(DEFAULT_BOT_STRATEGY, view, moves, Math.random);
        const res = manager.applyMove(code, actingSeat, move);
        if (!res.ok) {
          console.error(`bot move rejected in room ${code}, seat ${actingSeat}: ${res.error}`);
          return;
        }
        broadcastState(code);
        scheduleBotTurnIfAny(code);
      },
      minDelay + Math.random() * (maxDelay - minDelay),
    );
  }

  wss.on('connection', (ws) => {
    ws.on('message', (raw) => {
      const msg = parseClientMessage(String(raw));
      if (!msg) {
        send(ws, { type: 'error', message: 'malformed message' });
        return;
      }

      switch (msg.type) {
        case 'createRoom': {
          const { room, seat, token } = manager.createRoom(msg.players, msg.name);
          attach(ws, room.code, seat);
          send(ws, { type: 'joined', code: room.code, seat, token, players: room.players });
          sendRoster(ws, room.code);
          break;
        }
        case 'joinRoom': {
          const res = manager.joinRoom(msg.code, msg.name);
          if (!res.ok) {
            send(ws, { type: 'error', message: res.error });
            break;
          }
          attach(ws, res.room.code, res.seat);
          send(ws, { type: 'joined', code: res.room.code, seat: res.seat, token: res.token, players: res.room.players });
          broadcastRoster(res.room.code);
          broadcastState(res.room.code); // no-ops until the room is full and the hand exists
          scheduleBotTurnIfAny(res.room.code);
          break;
        }
        case 'addBot': {
          const session = sessionOf.get(ws);
          if (!session) {
            send(ws, { type: 'error', message: 'not joined to a room' });
            break;
          }
          const res = manager.addBot(session.code);
          if (!res.ok) {
            send(ws, { type: 'error', message: res.error });
            break;
          }
          broadcastRoster(session.code);
          broadcastState(session.code); // no-ops until the room is full and the hand exists
          scheduleBotTurnIfAny(session.code);
          break;
        }
        case 'reconnect': {
          const res = manager.reconnect(msg.code, msg.seat, msg.token);
          if (!res.ok) {
            send(ws, { type: 'error', message: res.error });
            break;
          }
          attach(ws, msg.code, msg.seat);
          send(ws, { type: 'joined', code: msg.code, seat: msg.seat, token: msg.token, players: res.room.players });
          sendRoster(ws, msg.code);
          sendState(ws, msg.code, msg.seat);
          break;
        }
        case 'move': {
          const session = sessionOf.get(ws);
          if (!session) {
            send(ws, { type: 'error', message: 'not joined to a room' });
            break;
          }
          const res = manager.applyMove(session.code, session.seat, msg.move);
          if (!res.ok) {
            send(ws, { type: 'error', message: res.error });
            break;
          }
          broadcastState(session.code);
          scheduleBotTurnIfAny(session.code);
          break;
        }
      }
    });

    ws.on('close', () => {
      const session = sessionOf.get(ws);
      if (!session) return;
      const seatMap = socketsByRoom.get(session.code);
      if (seatMap && seatMap.get(session.seat) === ws) seatMap.delete(session.seat);
    });
  });

  httpServer.listen(port);

  const close = () =>
    new Promise<void>((resolve, reject) => {
      wss.close((err) => {
        if (err) {
          reject(err);
          return;
        }
        httpServer.close((err2) => (err2 ? reject(err2) : resolve()));
      });
      for (const client of wss.clients) client.terminate();
    });

  return { httpServer, wss, manager, close };
}
