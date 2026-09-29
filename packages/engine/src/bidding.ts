import type { Bid, Config, Trump } from './types.js';

function trumpRankIndex(trump: Trump, config: Config): number {
  const idx = config.trumpRankLowToHigh.indexOf(trump);
  if (idx === -1) {
    throw new Error(`trump ${trump} is not in trumpRankLowToHigh`);
  }
  return idx;
}

export function isValidBid(bid: Bid, config: Config): boolean {
  if (bid.count < config.minBid || bid.count > config.maxBid) return false;
  if (bid.trump === 'NT' && !config.noTrumpAllowed) return false;
  return config.trumpRankLowToHigh.includes(bid.trump);
}

/** True if `newBid` beats `currentBid` (null current means anything valid beats it). */
export function outranks(newBid: Bid, currentBid: Bid | null, config: Config): boolean {
  if (!isValidBid(newBid, config)) return false;
  if (!currentBid) return true;
  if (newBid.count !== currentBid.count) return newBid.count > currentBid.count;
  return trumpRankIndex(newBid.trump, config) > trumpRankIndex(currentBid.trump, config);
}

/** True if no valid bid could ever outrank this one — bidding must end. */
export function isMaximalBid(bid: Bid, config: Config): boolean {
  if (bid.count !== config.maxBid) return false;
  return trumpRankIndex(bid.trump, config) === config.trumpRankLowToHigh.length - 1;
}

export function allValidBids(config: Config): Bid[] {
  const bids: Bid[] = [];
  for (let count = config.minBid; count <= config.maxBid; count++) {
    for (const trump of config.trumpRankLowToHigh) {
      if (trump === 'NT' && !config.noTrumpAllowed) continue;
      bids.push({ count, trump });
    }
  }
  return bids;
}
