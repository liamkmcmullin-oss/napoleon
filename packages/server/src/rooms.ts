import { randomBytes } from 'node:crypto';
import { applyMove as engineApplyMove, createHand, defaultConfig } from '@napoleon/engine';
import type { ApplyResult, GameState, Move, Seat } from '@napoleon/engine';

// Excludes visually ambiguous characters (I, O, 0, 1, L).
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function randomCode(length = 4): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) out += CODE_ALPHABET[bytes[i]! % CODE_ALPHABET.length];
  return out;
}

function randomToken(): string {
  return randomBytes(24).toString('hex');
}

function randomSeed(): number {
  return randomBytes(4).readUInt32BE(0);
}

export interface RoomSeat {
  name: string | null;
  /** Always null for a bot seat — there's no real connection to reconnect. */
  token: string | null;
  isBot: boolean;
}

export interface Room {
  code: string;
  players: 4 | 5;
  seats: RoomSeat[];
  state: GameState | null;
}

export type RoomResult<T> = { ok: true } & T | { ok: false; error: string };

export class RoomManager {
  private rooms = new Map<string, Room>();

  private uniqueCode(): string {
    let code: string;
    do {
      code = randomCode();
    } while (this.rooms.has(code));
    return code;
  }

  private startIfFull(room: Room): void {
    if (room.seats.every((s) => s.name !== null)) {
      room.state = createHand(defaultConfig(room.players), randomSeed(), 0);
    }
  }

  createRoom(players: 4 | 5, hostName: string): { room: Room; seat: Seat; token: string } {
    const code = this.uniqueCode();
    const token = randomToken();
    const seats: RoomSeat[] = Array.from({ length: players }, () => ({ name: null, token: null, isBot: false }));
    seats[0] = { name: hostName, token, isBot: false };
    const room: Room = { code, players, seats, state: null };
    this.rooms.set(code, room);
    return { room, seat: 0, token };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  joinRoom(code: string, name: string): RoomResult<{ room: Room; seat: Seat; token: string }> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'room not found' };
    const seat = room.seats.findIndex((s) => s.name === null);
    if (seat === -1) return { ok: false, error: 'room is full' };

    const token = randomToken();
    room.seats[seat] = { name, token, isBot: false };
    this.startIfFull(room);

    return { ok: true, room, seat, token };
  }

  /** Fills the next open seat with a bot — only while the room is still
   * waiting for players (Phase 4 scope: lobby-only, see DECISIONS.md). */
  addBot(code: string): RoomResult<{ room: Room; seat: Seat }> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'room not found' };
    if (room.state) return { ok: false, error: 'the game has already started' };
    const seat = room.seats.findIndex((s) => s.name === null);
    if (seat === -1) return { ok: false, error: 'room is full' };

    const botNumber = room.seats.filter((s) => s.isBot).length + 1;
    room.seats[seat] = { name: `Bot ${botNumber}`, token: null, isBot: true };
    this.startIfFull(room);

    return { ok: true, room, seat };
  }

  reconnect(code: string, seat: Seat, token: string): RoomResult<{ room: Room }> {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'room not found' };
    const slot = room.seats[seat];
    if (!slot || slot.token === null || slot.token !== token) {
      return { ok: false, error: 'invalid reconnect token' };
    }
    return { ok: true, room };
  }

  applyMove(code: string, seat: Seat, move: Move): ApplyResult {
    const room = this.rooms.get(code);
    if (!room) return { ok: false, error: 'room not found' };
    if (!room.state) return { ok: false, error: 'the game has not started yet' };
    const res = engineApplyMove(room.state, seat, move);
    if (res.ok) room.state = res.state;
    return res;
  }
}
