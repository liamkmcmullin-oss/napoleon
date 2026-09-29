export type Suit = 'C' | 'D' | 'H' | 'S';
export type Rank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';
/** Rank char + suit char, e.g. "AS", "TD", "2C" — or the literal "JOKER". */
export type CardId = string;
export type Trump = Suit | 'NT';
export type Seat = number;

export interface Bid {
  count: number;
  trump: Trump;
}

export type Move =
  | { type: 'bid'; bid: Bid }
  | { type: 'pass' }
  | { type: 'nameAngel'; card: CardId }
  | { type: 'discard'; cards: CardId[] }
  | { type: 'play'; card: CardId; calledSuit?: Suit }
  | { type: 'nextHand' };

export type Phase = 'bidding' | 'angel' | 'discard' | 'play' | 'handOver';

/**
 * Config is kept plain data (no function fields) so GameState stays
 * JSON-serializable end to end — see DECISIONS.md #9.
 */
export interface Config {
  players: 4 | 5;
  minBid: number;
  maxBid: number;
  /** Low to high, e.g. ['C','D','H','S','NT']. */
  trumpRankLowToHigh: Trump[];
  noTrumpAllowed: boolean;
  handSize: number;
  widowSize: number;
  /** S = (count - baseScoreOffset) * baseScoreMultiplier */
  baseScoreOffset: number;
  baseScoreMultiplier: number;
  angelIsNapoleonMultiplier: number;
  allTwentyMultiplier: number;
  discardedPointsCount: boolean;
  jokerFirstTrickAllowed: boolean;
  threeOfSpadesForcesJoker: boolean;
}

export interface TrickPlay {
  seat: Seat;
  card: CardId;
  /** Set only on the leading play when the Joker is led in a No Trump hand — see requiredSuit(). */
  calledSuit?: Suit;
}

export interface BidRecord {
  seat: Seat;
  bid: Bid | null;
}

export interface HandResult {
  napoleonWon: boolean;
  points: number;
  base: number;
  multiplier: number;
  deltas: number[];
}

export interface GameState {
  config: Config;
  phase: Phase;
  players: number;
  dealer: Seat;
  turn: Seat;
  hands: CardId[][];
  widow: CardId[];
  passed: boolean[];
  bidHistory: BidRecord[];
  currentBid: Bid | null;
  bidder: Seat | null;
  napoleon: Seat | null;
  trump: Trump | null;
  angelCard: CardId | null;
  angelSeat: Seat | null;
  angelRevealed: boolean;
  discards: CardId[];
  trick: TrickPlay[];
  trickNumber: number;
  captured: CardId[][];
  scores: number[];
  handResult: HandResult | null;
  seed: number;
}

export interface PlayerView {
  seat: Seat;
  config: Config;
  phase: Phase;
  players: number;
  dealer: Seat;
  turn: Seat;
  hand: CardId[];
  handCounts: number[];
  widowCount: number;
  passed: boolean[];
  bidHistory: BidRecord[];
  currentBid: Bid | null;
  bidder: Seat | null;
  napoleon: Seat | null;
  trump: Trump | null;
  angelCard: CardId | null;
  angelSeat: Seat | null;
  angelRevealed: boolean;
  discardCount: number;
  discards: CardId[] | null;
  trick: TrickPlay[];
  trickNumber: number;
  captured: CardId[][];
  scores: number[];
  handResult: HandResult | null;
}

export type ApplyResult =
  | { ok: true; state: GameState }
  | { ok: false; error: string };
