import { BOT_STRATEGIES, createMcStrategy, formatArenaResult, runArena } from '@napoleon/bot';
import type { BotStrategy, McOptions } from '@napoleon/bot';

/** `heuristic`, `mc`, or `mc:passValue=5,playSamples=60,auctionInference=false` (an MC bot with options). */
function resolveStrategy(spec: string): BotStrategy | undefined {
  const [base, optionText] = spec.split(':');
  if (optionText === undefined) return BOT_STRATEGIES[spec];
  if (base !== 'mc') return undefined;
  const options: Record<string, number | boolean> = {};
  for (const pair of optionText.split(',')) {
    const [key, value] = pair.split('=');
    options[key!] = value === 'true' ? true : value === 'false' ? false : Number(value);
  }
  return createMcStrategy({ ...(options as McOptions), name: spec });
}

// Usage: pnpm --filter @napoleon/cli arena <challenger> <baseline> (either may be mc:key=value,...) [--players 4|5] [--deals N] [--challengers K] [--seed S]
function main(): void {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    if (args[i]!.startsWith('--')) flags.set(args[i]!.slice(2), args[++i] ?? '');
    else positional.push(args[i]!);
  }
  const [aName = 'heuristic', bName = 'random'] = positional;
  const a = resolveStrategy(aName);
  const b = resolveStrategy(bName);
  if (!a || !b) {
    console.error(`unknown strategy. available: ${Object.keys(BOT_STRATEGIES).join(', ')}`);
    process.exit(2);
  }
  const players = Number(flags.get('players') ?? 4) === 5 ? 5 : 4;
  const deals = Number(flags.get('deals') ?? 500);
  const k = Math.min(players - 1, Math.max(1, Number(flags.get('challengers') ?? 1)));
  const pattern = Array.from({ length: players }, (_, i) => (i < k ? a : b));

  const start = Date.now();
  const result = runArena({ players, deals, pattern, seedBase: Number(flags.get('seed') ?? 0) }, (done) => {
    if (done % 100 === 0) console.error(`  ...${done}/${deals} deals`);
  });
  console.log(`${k}x ${aName} vs ${players - k}x ${bName}`);
  console.log(formatArenaResult(result));
  console.log(`\n${((Date.now() - start) / 1000).toFixed(1)}s`);
}

main();
