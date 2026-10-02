import { describe, expect, it } from 'vitest';
import { defaultConfig, legalMoves, mulberry32, viewFor } from '@napoleon/engine';
import type { GameState, Move } from '@napoleon/engine';
import { heuristicStrategy } from '../src/index.js';
import { estimateHandStrength } from '../src/heuristic/index.js';

const config = defaultConfig(4);
const rng = mulberry32(1);

function baseState(overrides: Partial<GameState>): GameState {
  const players = 4;
  const empty = Array.from({ length: players }, () => [] as string[]);
  return {
    config,
    phase: 'bidding',
    players,
    dealer: 0,
    turn: 1,
    hands: empty.map((h) => [...h]),
    widow: [],
    passed: Array.from({ length: players }, () => false),
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
    captured: empty.map((h) => [...h]),
    scores: Array.from({ length: players }, () => 0),
    handResult: null,
    tricks: [],
    seed: 1,
    ...overrides,
  };
}

describe('estimateHandStrength', () => {
  it('ranks a hand stronger under its own long trump suit than under NT', () => {
    const strongInSpades = ['JS', 'JC', 'AS', 'KS', 'QS', '9S', '2C', '3D', '4H', '5C', '6D', '7H'];
    expect(estimateHandStrength(strongInSpades, 'S')).toBeGreaterThan(estimateHandStrength(strongInSpades, 'NT'));
  });

  it('ranks a hand full of aces and face cards stronger than one full of low cards', () => {
    const strong = ['AS', 'AC', 'AD', 'AH', 'KS', 'KC', 'KD', 'KH', 'QS', 'QC', 'QD', 'QH'];
    const weak = ['2C', '3C', '4C', '5C', '6D', '7D', '8D', '9D', '2H', '3H', '4H', '5H'];
    expect(estimateHandStrength(strong, 'NT')).toBeGreaterThan(estimateHandStrength(weak, 'NT'));
  });
});

describe('heuristic bidding', () => {
  it('passes on a weak, scattered hand when passing is legal', () => {
    const weakHand = ['2C', '3C', '4D', '5D', '6H', '7H', '2S', '3S', '4C', '5H', '6D', '7S'];
    const state = baseState({ hands: [[], weakHand, [], []], turn: 1 });
    const moves = legalMoves(state, 1);
    const view = viewFor(state, 1);
    const move = heuristicStrategy.chooseMove(view, moves, rng);
    expect(move).toEqual({ type: 'pass' });
  });

  it('bids (not passes) on a very strong hand when passing is legal', () => {
    const strongHand = ['JS', 'JC', 'AS', 'KS', 'QS', 'AC', 'KC', 'QC', 'AD', 'KD', 'QD', 'AH'];
    const state = baseState({ hands: [[], strongHand, [], []], turn: 1 });
    const moves = legalMoves(state, 1);
    const view = viewFor(state, 1);
    const move = heuristicStrategy.chooseMove(view, moves, rng);
    expect(move.type).toBe('bid');
  });

  it('bids the cheapest legal bid when forced (no-all-pass rule)', () => {
    const anyHand = ['2C', '3C', '4D', '5D', '6H', '7H', '2S', '3S', '4C', '5H', '6D', '7S'];
    const state = baseState({
      hands: [anyHand, anyHand, anyHand, anyHand],
      passed: [false, true, true, true],
      turn: 0,
    });
    const moves = legalMoves(state, 0);
    expect(moves.every((m) => m.type === 'bid')).toBe(true);
    const view = viewFor(state, 0);
    const move = heuristicStrategy.chooseMove(view, moves, rng) as Extract<Move, { type: 'bid' }>;
    expect(move.type).toBe('bid');
    expect(move.bid.count).toBe(config.minBid);
  });
});

describe('heuristic angel-naming', () => {
  it('names the Ace of Spades when it is not already in hand', () => {
    const hand = ['2C', '3C', '4D', '5D', '6H', '7H', '2S', '3S', '4C', '5H', '6D', '7S'];
    const state = baseState({ phase: 'angel', napoleon: 1, trump: 'H', hands: [[], hand, [], []], turn: 1 });
    const moves = legalMoves(state, 1);
    const view = viewFor(state, 1);
    const move = heuristicStrategy.chooseMove(view, moves, rng) as Extract<Move, { type: 'nameAngel' }>;
    expect(move.card).toBe('AS');
  });

  it('falls back to the next most powerful card (jack of trump) when it already holds the Ace of Spades', () => {
    const hand = ['AS', '2C', '3C', '4D', '5D', '6H', '7H', '2S', '3S', '4C', '5H', '6D'];
    const state = baseState({ phase: 'angel', napoleon: 1, trump: 'H', hands: [[], hand, [], []], turn: 1 });
    const moves = legalMoves(state, 1);
    const view = viewFor(state, 1);
    const move = heuristicStrategy.chooseMove(view, moves, rng) as Extract<Move, { type: 'nameAngel' }>;
    expect(move.card).toBe('JH');
  });
});

describe('heuristic discard', () => {
  it('discards the weakest cards, keeping point cards and trump over low junk', () => {
    // 12 + widowSize(5) = 17 cards, discard exactly 5.
    const hand = [
      'AS', 'KS', 'QS', 'JS', 'TS', // strong spades (trump)
      'AH', 'KH', // point cards off-suit
      '2C', '3C', '4D', '5D', '6H', '7H', // junk
      '2D', '3H', '4C', '5H', // more junk (pads to 17)
    ];
    expect(hand.length).toBe(17);
    const state = baseState({
      phase: 'discard',
      napoleon: 1,
      trump: 'S',
      hands: [[], hand, [], []],
      turn: 1,
    });
    const view = viewFor(state, 1);
    const move = heuristicStrategy.chooseMove(view, [], rng) as Extract<Move, { type: 'discard' }>;
    expect(move.type).toBe('discard');
    expect(move.cards.length).toBe(config.widowSize);
    // None of the discarded cards should be the strong spades or the
    // off-suit point cards — junk should go first.
    for (const strong of ['AS', 'KS', 'QS', 'JS', 'TS', 'AH', 'KH']) {
      expect(move.cards).not.toContain(strong);
    }
  });
});

describe('heuristic play', () => {
  it('as the last player, wins the trick as cheaply as possible rather than overpaying', () => {
    // Hearts trump. Led 2D, followed by 3D then 4D (current best: 4D).
    // As the last player we hold 9D and KD — both follow suit and both
    // beat 4D, but 9D is the cheaper way to win (KD is a valuable point
    // card, not needed just to take this trick).
    const state = baseState({
      phase: 'play',
      trump: 'H',
      trickNumber: 2,
      hands: [[], [], [], ['9D', 'KD', '9H']],
      trick: [
        { seat: 0, card: '2D' },
        { seat: 1, card: '3D' },
        { seat: 2, card: '4D' },
      ],
      turn: 3,
    });
    const moves = legalMoves(state, 3);
    const view = viewFor(state, 3);
    const move = heuristicStrategy.chooseMove(view, moves, rng) as Extract<Move, { type: 'play' }>;
    expect(move.card).toBe('9D');
  });

  it('holds back an expensive winning card when not last to act, playing a losing low card instead', () => {
    // Hearts trump (not NT), trick 2. Led 5D. We're the very next to act
    // (not last — trick has 1 of 4 cards so far) and hold AD (would win,
    // but an Ace is expensive) and 2D (follows suit but loses to the 5D
    // already down). Should hold the Ace back rather than spend it this
    // early just to lead by a little.
    const state = baseState({
      phase: 'play',
      trump: 'H',
      trickNumber: 2,
      hands: [[], ['AD', '2D'], [], []],
      trick: [{ seat: 0, card: '5D' }],
      turn: 1,
      players: 4,
    });
    const moves = legalMoves(state, 1);
    const view = viewFor(state, 1);
    const move = heuristicStrategy.chooseMove(view, moves, rng) as Extract<Move, { type: 'play' }>;
    expect(move.card).toBe('2D');
  });
});
