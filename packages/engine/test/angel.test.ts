import { describe, expect, it } from 'vitest';
import { defaultConfig } from '../src/config.js';
import { createHand } from '../src/deal.js';
import { applyMove } from '../src/moves.js';
import { scoreHand } from '../src/score.js';
import type { ApplyResult, GameState } from '../src/types.js';

const config = defaultConfig(4);

function toAngelPhase(seed: number, napoleon: number): GameState {
  const dealt = createHand(config, seed, 0);
  return {
    ...dealt,
    phase: 'angel',
    napoleon,
    turn: napoleon,
    currentBid: { count: 12, trump: 'H' },
    bidder: napoleon,
    trump: 'H',
  };
}

function unwrap(res: ApplyResult): GameState {
  if (!res.ok) throw new Error(res.error);
  return res.state;
}

describe('angel resolution (spec section 8, 21-23)', () => {
  it('21. angel card dealt to another player: that player is the angel', () => {
    const napoleon = 0;
    const state = toAngelPhase(1, napoleon);
    const otherSeat = state.hands.findIndex((h, i) => i !== napoleon && h.length > 0);
    const card = state.hands[otherSeat]![0]!;
    const result = unwrap(applyMove(state, napoleon, { type: 'nameAngel', card }));
    expect(result.angelSeat).toBe(otherSeat);
    expect(result.angelSeat).not.toBe(napoleon);
  });

  it('22. angel card in napoleons own hand: napoleon is their own angel', () => {
    const napoleon = 0;
    const state = toAngelPhase(1, napoleon);
    const card = state.hands[napoleon]![0]!;
    const result = unwrap(applyMove(state, napoleon, { type: 'nameAngel', card }));
    expect(result.angelSeat).toBe(napoleon);
  });

  it('23. angel card in the widow (slurp): napoleon is their own angel, even after discarding it', () => {
    const napoleon = 0;
    const state = toAngelPhase(1, napoleon);
    const card = state.widow[0]!;
    const namedResult = unwrap(applyMove(state, napoleon, { type: 'nameAngel', card }));
    expect(namedResult.angelSeat).toBe(napoleon);
    expect(namedResult.phase).toBe('discard');
    // Napoleon may discard the slurped angel card; it changes nothing.
    const napoleonHand = namedResult.hands[napoleon]!;
    expect(napoleonHand).toContain(card);
    const discardChoice = [card, ...napoleonHand.filter((c) => c !== card).slice(0, config.widowSize - 1)];
    const discardResult = unwrap(applyMove(namedResult, napoleon, { type: 'discard', cards: discardChoice }));
    expect(discardResult.angelSeat).toBe(napoleon);
  });
});

function baseState(players: 4 | 5, overrides: Partial<GameState>): GameState {
  const cfg = defaultConfig(players);
  const empty = Array.from({ length: players }, () => [] as string[]);
  return {
    config: cfg,
    phase: 'play',
    players,
    dealer: 0,
    turn: 0,
    hands: empty.map((h) => [...h]),
    widow: [],
    passed: Array.from({ length: players }, () => false),
    bidHistory: [],
    currentBid: null,
    bidder: null,
    napoleon: null,
    trump: 'H',
    angelCard: null,
    angelSeat: null,
    angelRevealed: false,
    discards: [],
    trick: [],
    trickNumber: cfg.handSize,
    captured: empty.map((h) => [...h]),
    scores: Array.from({ length: players }, () => 0),
    handResult: null,
    tricks: [],
    seed: 1,
    ...overrides,
  };
}

describe('scoreHand (spec section 8, 24-27)', () => {
  it('24. bid 13, napoleon wins, angel separate, 5 players', () => {
    const state = baseState(5, {
      napoleon: 0,
      angelSeat: 1,
      currentBid: { count: 13, trump: 'H' },
      captured: [
        ['AH', 'KH', 'QH', 'JH', 'TH', 'AC', 'KC', 'QC', 'JC', 'TC', 'AD', 'KD', 'QD'], // 13 points
        [],
        [],
        [],
        [],
      ],
    });
    const result = scoreHand(state);
    expect(result.napoleonWon).toBe(true);
    expect(result.base).toBe(30);
    expect(result.multiplier).toBe(1);
    expect(result.deltas).toEqual([30, 15, -15, -15, -15]);
  });

  it('25. bid 15, napoleon loses as own angel', () => {
    const state = baseState(4, {
      napoleon: 0,
      angelSeat: 0,
      currentBid: { count: 15, trump: 'S' },
      captured: [
        ['AS', 'KS', 'QS', 'JS'], // 4 points < 15
        [],
        [],
        [],
      ],
    });
    const result = scoreHand(state);
    expect(result.napoleonWon).toBe(false);
    expect(result.base).toBe(50);
    expect(result.multiplier).toBe(2);
    expect(result.deltas).toEqual([-100, 50, 50, 50]);
  });

  it('26. bid 20, napoleon wins alone taking all 20 points', () => {
    const allPointCards = ['C', 'D', 'H', 'S'].flatMap((s) => ['A', 'K', 'Q', 'J', 'T'].map((r) => `${r}${s}`));
    expect(allPointCards.length).toBe(20);
    const state = baseState(4, {
      napoleon: 0,
      angelSeat: 0,
      currentBid: { count: 20, trump: 'NT' },
      captured: [allPointCards, [], [], []],
    });
    const result = scoreHand(state);
    expect(result.napoleonWon).toBe(true);
    expect(result.points).toBe(20);
    expect(result.base).toBe(100);
    expect(result.multiplier).toBe(4);
    expect(result.deltas).toEqual([400, -200, -200, -200]);
  });

  it('27. discarded point cards do not count for napoleons side', () => {
    const napoleon = 0;
    const state = toAngelPhase(1, napoleon);
    const namedResult = unwrap(applyMove(state, napoleon, { type: 'nameAngel', card: 'JOKER' }));
    const napoleonHand = namedResult.hands[napoleon]!;
    const pointCardInHand = napoleonHand.find((c) => /^[AKQJT][CDHS]$/.test(c));
    expect(pointCardInHand).toBeDefined();
    const rest = napoleonHand.filter((c) => c !== pointCardInHand).slice(0, config.widowSize - 1);
    const discardResult = unwrap(
      applyMove(namedResult, napoleon, { type: 'discard', cards: [pointCardInHand!, ...rest] }),
    );
    // The discarded point card leaves play entirely: it sits in `discards`,
    // never in `hands` or `captured`, so scoreHand (which only reads
    // `captured`) can never count it for either side.
    expect(discardResult.discards).toContain(pointCardInHand);
    expect(discardResult.hands[napoleon]).not.toContain(pointCardInHand);
    expect(discardResult.captured.flat()).not.toContain(pointCardInHand);

    const result = scoreHand({ ...discardResult, angelSeat: napoleon, currentBid: { count: 12, trump: 'H' } });
    expect(result.points).toBe(0);
  });
});
