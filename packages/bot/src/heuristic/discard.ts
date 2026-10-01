import type { Move, PlayerView } from '@napoleon/engine';
import { cardStrength } from './strength.js';

/** Discards the weakest cards in hand (low, non-point, non-trump first —
 * falls naturally out of cardStrength's ordering). legalMoves is always
 * empty during the discard phase (see DECISIONS.md #21), so this is
 * built directly from view.hand/view.config.widowSize, same as the
 * client's DiscardPicker. */
export function chooseDiscard(view: PlayerView): Move {
  const n = view.config.widowSize;
  const trump = view.trump!;
  const sorted = [...view.hand].sort((a, b) => cardStrength(a, trump) - cardStrength(b, trump));
  return { type: 'discard', cards: sorted.slice(0, n) };
}
