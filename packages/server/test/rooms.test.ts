import { describe, expect, it } from 'vitest';
import { RoomManager } from '../src/rooms.js';

describe('RoomManager', () => {
  it('createRoom seats the host in seat 0 and issues a token', () => {
    const manager = new RoomManager();
    const { room, seat, token } = manager.createRoom(4, 'Alice');
    expect(seat).toBe(0);
    expect(token).toMatch(/^[0-9a-f]{48}$/);
    expect(room.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(room.seats[0]).toEqual({ name: 'Alice', token });
    expect(room.state).toBeNull(); // not full yet
  });

  it('joinRoom fills the next open seat and starts the game once full', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom(4, 'Alice');

    const b = manager.joinRoom(room.code, 'Bob');
    expect(b.ok).toBe(true);
    if (!b.ok) throw new Error('unreachable');
    expect(b.seat).toBe(1);
    expect(room.state).toBeNull();

    manager.joinRoom(room.code, 'Cara');
    const d = manager.joinRoom(room.code, 'Dee');
    expect(d.ok).toBe(true);

    expect(room.state).not.toBeNull();
    expect(room.state!.players).toBe(4);
    expect(room.seats.map((s) => s.name)).toEqual(['Alice', 'Bob', 'Cara', 'Dee']);
  });

  it('rejects joining a full room', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom(4, 'Alice');
    manager.joinRoom(room.code, 'Bob');
    manager.joinRoom(room.code, 'Cara');
    manager.joinRoom(room.code, 'Dee');
    const res = manager.joinRoom(room.code, 'Eve');
    expect(res.ok).toBe(false);
  });

  it('rejects joining an unknown room code', () => {
    const manager = new RoomManager();
    const res = manager.joinRoom('ZZZZ', 'Bob');
    expect(res.ok).toBe(false);
  });

  it('reconnect requires a matching token for the seat', () => {
    const manager = new RoomManager();
    const { room, token } = manager.createRoom(4, 'Alice');
    const good = manager.reconnect(room.code, 0, token);
    expect(good.ok).toBe(true);
    const bad = manager.reconnect(room.code, 0, 'wrong-token');
    expect(bad.ok).toBe(false);
    const emptySeat = manager.reconnect(room.code, 1, 'anything');
    expect(emptySeat.ok).toBe(false);
  });

  it('applyMove rejects moves before the room is full', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom(4, 'Alice');
    const res = manager.applyMove(room.code, 0, { type: 'pass' });
    expect(res.ok).toBe(false);
  });

  it('applyMove delegates to the engine and updates room state', () => {
    const manager = new RoomManager();
    const { room } = manager.createRoom(4, 'Alice');
    manager.joinRoom(room.code, 'Bob');
    manager.joinRoom(room.code, 'Cara');
    manager.joinRoom(room.code, 'Dee');

    const turnSeat = room.state!.turn;
    const res = manager.applyMove(room.code, turnSeat, { type: 'pass' });
    expect(res.ok).toBe(true);

    // Turn has now moved on; the seat that just acted can't act again.
    const rejected = manager.applyMove(room.code, turnSeat, { type: 'pass' });
    expect(rejected.ok).toBe(false);
  });

  it('generates distinct room codes for distinct rooms', () => {
    const manager = new RoomManager();
    const codes = new Set<string>();
    for (let i = 0; i < 25; i++) {
      codes.add(manager.createRoom(4, `p${i}`).room.code);
    }
    expect(codes.size).toBe(25);
  });
});
