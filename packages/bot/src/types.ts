import type { Move, PlayerView } from '@napoleon/engine';

/**
 * A bot never sees more than a real player would — only the same
 * `PlayerView`/`legalMoves` the server would send over the wire. This is
 * what keeps a bot seat fair to play against/with: it can't peek at
 * hidden hands or the true GameState.
 */
export interface BotStrategy {
  name: string;
  chooseMove(view: PlayerView, legalMoves: Move[], rng: () => number): Move;
}
