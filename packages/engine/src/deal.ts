import { makeDeck } from './cards.js';
import { mulberry32, shuffle } from './rng.js';
import type { Config, GameState, Seat } from './types.js';

export function createHand(config: Config, seed: number, dealer: Seat, scores?: number[]): GameState {
  const rng = mulberry32(seed);
  const deck = shuffle(makeDeck(), rng);

  const hands: string[][] = Array.from({ length: config.players }, () => []);
  let cursor = 0;
  for (let i = 0; i < config.players; i++) {
    const seat = (dealer + 1 + i) % config.players;
    hands[seat] = deck.slice(cursor, cursor + config.handSize);
    cursor += config.handSize;
  }
  const widow = deck.slice(cursor, cursor + config.widowSize);
  cursor += config.widowSize;

  return {
    config,
    phase: 'bidding',
    players: config.players,
    dealer,
    turn: (dealer + 1) % config.players,
    hands,
    widow,
    passed: Array.from({ length: config.players }, () => false),
    bidHistory: [],
    currentBid: null,
    bidder: null,
    napoleon: null,
    trump: null,
    angelCard: null,
    angelSeat: null,
    angelRevealed: false,
    discards: [],
    trick: [],
    trickNumber: 1,
    captured: Array.from({ length: config.players }, () => []),
    scores: scores ? [...scores] : Array.from({ length: config.players }, () => 0),
    handResult: null,
    seed,
  };
}
