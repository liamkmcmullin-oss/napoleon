import { makeDeck } from './cards.js';
import { allValidBids, isMaximalBid, isValidBid, outranks } from './bidding.js';
import { createHand } from './deal.js';
import { legalPlays } from './legalPlays.js';
import { deriveSeed } from './rng.js';
import { resolveTrick } from './resolveTrick.js';
import { scoreHand } from './score.js';
import type { ApplyResult, Bid, CardId, GameState, Move, Seat } from './types.js';

function err(error: string): ApplyResult {
  return { ok: false, error };
}

function ok(state: GameState): ApplyResult {
  return { ok: true, state };
}

function activeSeats(passed: boolean[]): Seat[] {
  const seats: Seat[] = [];
  passed.forEach((p, seat) => {
    if (!p) seats.push(seat);
  });
  return seats;
}

function nextActiveSeat(passed: boolean[], from: Seat, players: number): Seat {
  let seat = (from + 1) % players;
  let guard = 0;
  while (passed[seat]) {
    seat = (seat + 1) % players;
    guard++;
    if (guard > players) throw new Error('no active seats remain');
  }
  return seat;
}

function combinations<T>(items: T[], k: number): T[][] {
  if (k === 0) return [[]];
  if (items.length < k) return [];
  const [head, ...rest] = items as [T, ...T[]];
  const withHead = combinations(rest, k - 1).map((c) => [head, ...c]);
  const withoutHead = combinations(rest, k);
  return [...withHead, ...withoutHead];
}

export function legalMoves(state: GameState, seat: Seat): Move[] {
  if (seat < 0 || seat >= state.players) return [];

  switch (state.phase) {
    case 'bidding': {
      if (state.turn !== seat) return [];
      const active = activeSeats(state.passed);
      const forced = state.currentBid === null && active.length === 1 && active[0] === seat;
      const bidMoves: Move[] = allValidBids(state.config)
        .filter((bid) => outranks(bid, state.currentBid, state.config))
        .map((bid) => ({ type: 'bid', bid }));
      return forced ? bidMoves : [{ type: 'pass' }, ...bidMoves];
    }
    case 'angel': {
      if (state.turn !== seat || state.napoleon !== seat) return [];
      return makeDeck().map((card) => ({ type: 'nameAngel', card }));
    }
    case 'discard': {
      if (state.napoleon !== seat) return [];
      const hand = state.hands[seat] ?? [];
      return combinations(hand, state.config.widowSize).map((cards) => ({ type: 'discard', cards }));
    }
    case 'play': {
      if (state.turn !== seat) return [];
      const hand = state.hands[seat] ?? [];
      const firstTrick = state.trickNumber === 1;
      const cards = legalPlays(hand, state.trick, { trump: state.trump!, firstTrick, config: state.config });
      return cards.map((card) => ({ type: 'play', card }));
    }
    case 'handOver':
      return [{ type: 'nextHand' }];
  }
}

export function applyMove(state: GameState, seat: Seat, move: Move): ApplyResult {
  switch (move.type) {
    case 'bid':
      return applyBid(state, seat, move.bid);
    case 'pass':
      return applyPass(state, seat);
    case 'nameAngel':
      return applyNameAngel(state, seat, move.card);
    case 'discard':
      return applyDiscard(state, seat, move.cards);
    case 'play':
      return applyPlay(state, seat, move.card);
    case 'nextHand':
      return applyNextHand(state, seat);
  }
}

function finalizeBidding(state: GameState, napoleon: Seat): GameState {
  return {
    ...state,
    phase: 'angel',
    napoleon,
    trump: state.currentBid!.trump,
    turn: napoleon,
  };
}

function applyBid(state: GameState, seat: Seat, bid: Bid): ApplyResult {
  if (state.phase !== 'bidding') return err(`cannot bid during phase ${state.phase}`);
  if (state.turn !== seat) return err('not your turn');
  if (state.passed[seat]) return err('you have already passed');
  if (!isValidBid(bid, state.config)) return err('invalid bid');
  if (!outranks(bid, state.currentBid, state.config)) return err('bid does not outrank the current bid');

  let next: GameState = {
    ...state,
    currentBid: bid,
    bidder: seat,
    bidHistory: [...state.bidHistory, { seat, bid }],
  };

  const active = activeSeats(next.passed);
  if (isMaximalBid(bid, state.config) || active.length === 1) {
    return ok(finalizeBidding(next, seat));
  }
  next = { ...next, turn: nextActiveSeat(next.passed, seat, state.players) };
  return ok(next);
}

function applyPass(state: GameState, seat: Seat): ApplyResult {
  if (state.phase !== 'bidding') return err(`cannot pass during phase ${state.phase}`);
  if (state.turn !== seat) return err('not your turn');
  if (state.passed[seat]) return err('you have already passed');

  const active = activeSeats(state.passed);
  const forced = state.currentBid === null && active.length === 1 && active[0] === seat;
  if (forced) return err('no all-pass: you must bid at least the minimum');

  const newPassed = [...state.passed];
  newPassed[seat] = true;
  const remaining = activeSeats(newPassed);

  let next: GameState = {
    ...state,
    passed: newPassed,
    bidHistory: [...state.bidHistory, { seat, bid: null }],
  };

  if (remaining.length === 1 && state.currentBid !== null) {
    return ok(finalizeBidding(next, remaining[0]!));
  }
  next = { ...next, turn: nextActiveSeat(newPassed, seat, state.players) };
  return ok(next);
}

function applyNameAngel(state: GameState, seat: Seat, card: CardId): ApplyResult {
  if (state.phase !== 'angel') return err(`cannot name the angel during phase ${state.phase}`);
  if (state.napoleon !== seat || state.turn !== seat) return err('only napoleon names the angel');
  if (!makeDeck().includes(card)) return err(`${card} is not a valid card`);

  const holderSeat = state.hands.findIndex((h) => h.includes(card));
  const angelSeat = holderSeat !== -1 && holderSeat !== state.napoleon ? holderSeat : state.napoleon;

  const newHands = state.hands.map((h, i) => (i === seat ? [...h, ...state.widow] : h));

  return ok({
    ...state,
    angelCard: card,
    angelSeat,
    hands: newHands,
    widow: [],
    phase: 'discard',
    turn: seat,
  });
}

function applyDiscard(state: GameState, seat: Seat, cards: CardId[]): ApplyResult {
  if (state.phase !== 'discard') return err(`cannot discard during phase ${state.phase}`);
  if (state.napoleon !== seat) return err('only napoleon discards');
  if (cards.length !== state.config.widowSize) {
    return err(`must discard exactly ${state.config.widowSize} cards`);
  }
  if (new Set(cards).size !== cards.length) return err('duplicate cards in discard');

  const hand = state.hands[seat] ?? [];
  for (const c of cards) {
    if (!hand.includes(c)) return err(`${c} is not in your hand`);
  }

  const discardSet = new Set(cards);
  const newHand = hand.filter((c) => !discardSet.has(c));
  const newHands = state.hands.map((h, i) => (i === seat ? newHand : h));

  return ok({
    ...state,
    hands: newHands,
    discards: cards,
    phase: 'play',
    trick: [],
    trickNumber: 1,
    turn: seat,
  });
}

function applyPlay(state: GameState, seat: Seat, card: CardId): ApplyResult {
  if (state.phase !== 'play') return err(`cannot play during phase ${state.phase}`);
  if (state.turn !== seat) return err('not your turn');

  const hand = state.hands[seat] ?? [];
  if (!hand.includes(card)) return err(`${card} is not in your hand`);

  const firstTrick = state.trickNumber === 1;
  const legal = legalPlays(hand, state.trick, { trump: state.trump!, firstTrick, config: state.config });
  if (!legal.includes(card)) return err(`${card} is not a legal play`);

  const newHand = hand.filter((c) => c !== card);
  const newHands = state.hands.map((h, i) => (i === seat ? newHand : h));
  const newTrick = [...state.trick, { seat, card }];
  const angelRevealed = state.angelRevealed || card === state.angelCard;

  if (newTrick.length < state.players) {
    return ok({
      ...state,
      hands: newHands,
      trick: newTrick,
      angelRevealed,
      turn: (seat + 1) % state.players,
    });
  }

  const winner = resolveTrick(newTrick, { trump: state.trump!, firstTrick });
  const newCaptured = state.captured.map((pile, i) =>
    i === winner ? [...pile, ...newTrick.map((p) => p.card)] : pile,
  );

  const totalTricks = state.config.handSize;
  if (state.trickNumber >= totalTricks) {
    const preScoreState: GameState = {
      ...state,
      hands: newHands,
      captured: newCaptured,
      angelRevealed,
    };
    const result = scoreHand(preScoreState);
    const newScores = state.scores.map((s, i) => s + (result.deltas[i] ?? 0));
    return ok({
      ...preScoreState,
      trick: [],
      phase: 'handOver',
      handResult: result,
      scores: newScores,
      turn: winner,
    });
  }

  return ok({
    ...state,
    hands: newHands,
    trick: [],
    trickNumber: state.trickNumber + 1,
    captured: newCaptured,
    angelRevealed,
    turn: winner,
  });
}

function applyNextHand(state: GameState, _seat: Seat): ApplyResult {
  if (state.phase !== 'handOver') return err(`cannot start next hand during phase ${state.phase}`);
  const newDealer = (state.dealer + 1) % state.players;
  const dealt = createHand(state.config, state.seed, newDealer, state.scores);
  return ok({ ...dealt, seed: deriveSeed(state.seed) });
}
