import type { Bid, CardId, Move, PlayerView, Trump } from '@napoleon/engine';

const SUIT_SYMBOL: Record<string, string> = { C: '♣', D: '♦', H: '♥', S: '♠' };
const RANK_DISPLAY: Record<string, string> = { T: '10' };

export function formatCard(card: CardId): string {
  if (card === 'JOKER') return 'JOKER';
  const rank = card.slice(0, -1);
  const suit = card.slice(-1);
  return `${RANK_DISPLAY[rank] ?? rank}${SUIT_SYMBOL[suit] ?? suit}`;
}

const SUIT_ORDER: Record<string, number> = { C: 0, D: 1, H: 2, S: 3 };
const RANK_ORDER: Record<string, number> = Object.fromEntries(
  ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'].map((r, i) => [r, i]),
);

export function sortForDisplay(cards: CardId[]): CardId[] {
  return [...cards].sort((a, b) => {
    if (a === 'JOKER') return 1;
    if (b === 'JOKER') return -1;
    const suitCmp = SUIT_ORDER[a.slice(-1)]! - SUIT_ORDER[b.slice(-1)]!;
    if (suitCmp !== 0) return suitCmp;
    return RANK_ORDER[a.slice(0, -1)]! - RANK_ORDER[b.slice(0, -1)]!;
  });
}

export function formatHand(cards: CardId[]): string {
  return sortForDisplay(cards).map(formatCard).join('  ');
}

export function formatTrump(trump: Trump | null): string {
  if (trump === null) return '(none yet)';
  if (trump === 'NT') return 'No Trump';
  return SUIT_SYMBOL[trump] ?? trump;
}

export function formatBid(bid: Bid): string {
  return `${bid.count} ${bid.trump === 'NT' ? 'No Trump' : SUIT_SYMBOL[bid.trump]}`;
}

export function formatMove(move: Move): string {
  switch (move.type) {
    case 'bid':
      return `Bid ${formatBid(move.bid)}`;
    case 'pass':
      return 'Pass';
    case 'nameAngel':
      return `Name angel: ${formatCard(move.card)}`;
    case 'discard':
      return `Discard ${sortForDisplay(move.cards).map(formatCard).join(' ')}`;
    case 'play':
      return move.calledSuit
        ? `Play ${formatCard(move.card)}, calling ${SUIT_SYMBOL[move.calledSuit] ?? move.calledSuit}`
        : `Play ${formatCard(move.card)}`;
    case 'nextHand':
      return 'Continue to next hand';
  }
}

export function printTable(view: PlayerView): void {
  const lines: string[] = [];
  lines.push('');
  lines.push('='.repeat(60));
  lines.push(`Seat ${view.seat}  |  Phase: ${view.phase}  |  Dealer: ${view.dealer}`);
  lines.push(
    `Bid: ${view.currentBid ? formatBid(view.currentBid) : '(none)'}  ` +
      `Napoleon: ${view.napoleon ?? '(tbd)'}  Trump: ${formatTrump(view.trump)}`,
  );
  if (view.angelCard) {
    const angelInfo =
      view.angelSeat !== null ? ` (held by seat ${view.angelSeat})` : ' (holder secret)';
    lines.push(`Angel card: ${formatCard(view.angelCard)}${angelInfo}`);
  }
  lines.push(`Hand counts: ${view.handCounts.map((c, i) => `seat${i}:${c}`).join('  ')}`);
  if (view.widowCount > 0) lines.push(`Widow: ${view.widowCount} card(s) face down`);
  if (view.trick.length > 0) {
    lines.push(
      `Trick ${view.trickNumber}: ` +
        view.trick
          .map(
            (p) =>
              `seat${p.seat}=${formatCard(p.card)}${
                p.calledSuit ? ` (calls ${SUIT_SYMBOL[p.calledSuit] ?? p.calledSuit})` : ''
              }`,
          )
          .join('  '),
    );
  }
  lines.push(`Scores: ${view.scores.map((s, i) => `seat${i}:${s}`).join('  ')}`);
  lines.push(`Your hand: ${formatHand(view.hand)}`);
  if (view.handResult) {
    const r = view.handResult;
    lines.push(
      `Hand result: napoleon ${r.napoleonWon ? 'WON' : 'LOST'}  points=${r.points}  ` +
        `base=${r.base}  multiplier=${r.multiplier}  deltas=[${r.deltas.join(', ')}]`,
    );
  }
  lines.push('='.repeat(60));
  console.log(lines.join('\n'));
}
