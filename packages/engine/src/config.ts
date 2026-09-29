import type { Config } from './types.js';

export function defaultConfig(players: 4 | 5): Config {
  return {
    players,
    minBid: 12,
    maxBid: 20,
    trumpRankLowToHigh: ['C', 'D', 'H', 'S', 'NT'],
    noTrumpAllowed: true,
    handSize: players === 4 ? 12 : 10,
    widowSize: players === 4 ? 5 : 3,
    baseScoreOffset: 10,
    baseScoreMultiplier: 10,
    angelIsNapoleonMultiplier: 2,
    allTwentyMultiplier: 2,
    discardedPointsCount: false,
    jokerFirstTrickAllowed: false,
    threeOfSpadesForcesJoker: true,
  };
}

export function computeBaseScore(config: Config, count: number): number {
  return (count - config.baseScoreOffset) * config.baseScoreMultiplier;
}
