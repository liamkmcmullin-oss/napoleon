import type { GameState, PlayerView, Seat } from './types.js';

export function viewFor(state: GameState, seat: Seat): PlayerView {
  const knowsAngelSeat =
    state.angelRevealed || seat === state.napoleon || seat === state.angelSeat;

  return {
    seat,
    config: state.config,
    phase: state.phase,
    players: state.players,
    dealer: state.dealer,
    turn: state.turn,
    hand: [...(state.hands[seat] ?? [])],
    handCounts: state.hands.map((h) => h.length),
    widowCount: state.widow.length,
    passed: [...state.passed],
    bidHistory: state.bidHistory.map((b) => ({ ...b })),
    currentBid: state.currentBid,
    bidder: state.bidder,
    napoleon: state.napoleon,
    trump: state.trump,
    angelCard: state.angelCard,
    angelSeat: knowsAngelSeat ? state.angelSeat : null,
    angelRevealed: state.angelRevealed,
    discardCount: state.discards.length,
    discards: state.phase === 'handOver' ? [...state.discards] : null,
    trick: state.trick.map((p) => ({ ...p })),
    trickNumber: state.trickNumber,
    captured: state.captured.map((pile) => [...pile]),
    scores: [...state.scores],
    handResult: state.handResult,
  };
}
