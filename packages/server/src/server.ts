import { createServer, type Server as HttpServer } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import { legalMoves, viewFor } from '@napoleon/engine';
import type { Seat } from '@napoleon/engine';
import { parseClientMessage } from '@napoleon/protocol';
import type { ServerMessage } from '@napoleon/protocol';
import { RoomManager } from './rooms.js';

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

export function startServer(port: number): NapoleonServer {
  const manager = new RoomManager();
  const httpServer = createServer();
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
    send(ws, { type: 'state', view: viewFor(room.state, seat), legalMoves: moves });
  }

  function broadcastState(code: string): void {
    const seatMap = socketsByRoom.get(code);
    if (!seatMap) return;
    for (const [seat, ws] of seatMap) sendState(ws, code, seat);
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
          broadcastState(res.room.code);
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
