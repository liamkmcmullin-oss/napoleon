import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { CardId, Move, PlayerView } from '@napoleon/engine';
import { startServer } from '../src/server.js';
import type { NapoleonServer } from '../src/server.js';
import type { ServerMessage } from '@napoleon/protocol';

let server: NapoleonServer | null = null;

afterEach(async () => {
  if (server) {
    await server.close();
    server = null;
  }
});

async function boot(): Promise<{ url: string; server: NapoleonServer }> {
  const s = startServer(0);
  await new Promise<void>((resolve) => s.httpServer.once('listening', () => resolve()));
  const address = s.httpServer.address();
  if (!address || typeof address === 'string') throw new Error('expected a bound TCP address');
  return { url: `ws://127.0.0.1:${address.port}`, server: s };
}

/** A minimal client that mirrors what a real browser client would do: it
 * only ever knows what arrived in `ServerMessage`s over the wire. */
class TestClient {
  ws: WebSocket;
  code: string | null = null;
  seat: number | null = null;
  token: string | null = null;
  latestView: PlayerView | null = null;
  latestLegalMoves: Move[] = [];
  /** Bumped on every 'state' message — used to detect a fresh broadcast,
   * as distinct from an 'error' reply that leaves state untouched. */
  stateSeq = 0;
  seenOwnCards = new Set<CardId>();
  messages: ServerMessage[] = [];
  private waiters: (() => void)[] = [];

  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.on('message', (raw) => {
      const msg = JSON.parse(String(raw)) as ServerMessage;
      this.messages.push(msg);
      if (msg.type === 'joined') {
        this.code = msg.code;
        this.seat = msg.seat;
        this.token = msg.token;
      } else if (msg.type === 'state') {
        this.latestView = msg.view;
        this.latestLegalMoves = msg.legalMoves;
        this.stateSeq++;
        for (const card of msg.view.hand) this.seenOwnCards.add(card);
      }
      const waiters = this.waiters;
      this.waiters = [];
      waiters.forEach((w) => w());
    });
  }

  async waitOpen(): Promise<void> {
    if (this.ws.readyState === WebSocket.OPEN) return;
    await new Promise<void>((resolve) => this.ws.once('open', () => resolve()));
  }

  send(msg: unknown): void {
    this.ws.send(JSON.stringify(msg));
  }

  /** Waits until the given predicate is true of the messages received so far. */
  async waitFor(predicate: () => boolean, timeoutMs = 5000): Promise<void> {
    if (predicate()) return;
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timed out waiting for a condition')), timeoutMs);
      const check = () => {
        if (predicate()) {
          clearTimeout(timer);
          resolve();
        } else {
          this.waiters.push(check);
        }
      };
      this.waiters.push(check);
    });
  }

  close(): void {
    this.ws.close();
  }
}

describe('server integration', () => {
  it('two (of four) clients can join, and neither ever receives the others cards', async () => {
    const { url, server: s } = await boot();
    server = s;

    const clients = [new TestClient(url), new TestClient(url), new TestClient(url), new TestClient(url)];
    await Promise.all(clients.map((c) => c.waitOpen()));

    clients[0]!.send({ type: 'createRoom', players: 4, name: 'Alice' });
    await clients[0]!.waitFor(() => clients[0]!.code !== null);
    const code = clients[0]!.code!;

    clients[1]!.send({ type: 'joinRoom', code, name: 'Bob' });
    clients[2]!.send({ type: 'joinRoom', code, name: 'Cara' });
    clients[3]!.send({ type: 'joinRoom', code, name: 'Dee' });
    await Promise.all(clients.map((c) => c.waitFor(() => c.seat !== null)));
    await Promise.all(clients.map((c) => c.waitFor(() => c.latestView !== null)));

    // Names aren't part of PlayerView (the engine has no concept of a
    // display name) — the server attaches them separately on `state`.
    for (const client of clients) {
      const stateMsg = [...client.messages].reverse().find((m) => m.type === 'state');
      expect(stateMsg && stateMsg.type === 'state' ? stateMsg.names : null).toEqual(['Alice', 'Bob', 'Cara', 'Dee']);
    }
    const rosterMsg = clients[0]!.messages.find((m) => m.type === 'roster');
    expect(rosterMsg).toBeDefined();

    // Play randomly-selected legal moves, driven entirely by what each
    // client received over the wire, until the hand is over.
    let guard = 0;
    for (;;) {
      guard++;
      if (guard > 3000) throw new Error('hand did not complete within the step budget');

      const anyHandOver = clients.some((c) => c.latestView?.phase === 'handOver');
      if (anyHandOver) break;

      // The discard phase never carries a `legalMoves` list (see
      // server.ts) — a real client builds that UI from `view.hand` and
      // `view.config.widowSize` directly, so the test bot does too.
      const discarding = clients.find((c) => c.latestView?.phase === 'discard' && c.latestView.seat === c.latestView.napoleon);
      const acting = discarding ?? clients.find((c) => c.latestLegalMoves.length > 0 && c.latestView?.phase !== 'handOver');
      if (!acting) {
        await new Promise((r) => setTimeout(r, 5));
        continue;
      }

      let move: Move;
      if (discarding) {
        const view = discarding.latestView!;
        const shuffled = [...view.hand].sort(() => Math.random() - 0.5);
        move = { type: 'discard', cards: shuffled.slice(0, view.config.widowSize) };
      } else {
        const moves = acting.latestLegalMoves;
        move = moves[Math.floor(Math.random() * moves.length)]!;
      }
      const beforeSeq = acting.stateSeq;
      acting.send({ type: 'move', move });
      // Wait for a genuine new broadcast, not just any reply — a rejected
      // (stale) move gets only an 'error', which must not be mistaken for
      // progress or `acting`'s (unchanged) legalMoves would be retried
      // forever. The real broadcast triggered by whoever actually holds
      // the turn is already in flight and will still arrive.
      await acting.waitFor(() => acting.stateSeq > beforeSeq);
    }

    // The break above fires as soon as *any* client's broadcast shows
    // handOver; the others' broadcasts may still be in flight.
    await Promise.all(clients.map((c) => c.waitFor(() => c.latestView?.phase === 'handOver')));

    // The core hidden-information guarantee, checked against real network
    // payloads: no two seats' hands (accumulated over the whole game) share
    // a card id.
    for (let a = 0; a < clients.length; a++) {
      for (let b = a + 1; b < clients.length; b++) {
        const intersection = [...clients[a]!.seenOwnCards].filter((c) => clients[b]!.seenOwnCards.has(c));
        expect(intersection).toEqual([]);
      }
    }

    // No message to any client ever carries raw widow contents or another
    // seat's angel-holder secret ahead of time.
    for (const client of clients) {
      for (const msg of client.messages) {
        if (msg.type === 'state') {
          expect((msg.view as unknown as { widow?: unknown }).widow).toBeUndefined();
        }
      }
    }

    const finalPhases = clients.map((c) => c.latestView?.phase);
    expect(finalPhases.every((p) => p === 'handOver')).toBe(true);

    clients.forEach((c) => c.close());
  });

  it('rejects a move from a client that has not joined any room', async () => {
    const { url, server: s } = await boot();
    server = s;
    const client = new TestClient(url);
    await client.waitOpen();
    client.send({ type: 'move', move: { type: 'pass' } });
    await client.waitFor(() => client.messages.some((m) => m.type === 'error'));
    const errorMsg = client.messages.find((m) => m.type === 'error');
    expect(errorMsg).toBeDefined();
    client.close();
  });

  it('reconnect re-attaches a dropped seat using its token', async () => {
    const { url, server: s } = await boot();
    server = s;

    const host = new TestClient(url);
    await host.waitOpen();
    host.send({ type: 'createRoom', players: 4, name: 'Alice' });
    await host.waitFor(() => host.code !== null);
    const { code, token } = host;
    host.close();

    const rejoined = new TestClient(url);
    await rejoined.waitOpen();
    rejoined.send({ type: 'reconnect', code, seat: 0, token });
    await rejoined.waitFor(() => rejoined.messages.some((m) => m.type === 'joined'));
    const joinedMsg = rejoined.messages.find((m) => m.type === 'joined');
    expect(joinedMsg).toMatchObject({ type: 'joined', code, seat: 0 });
    rejoined.close();
  });
});
