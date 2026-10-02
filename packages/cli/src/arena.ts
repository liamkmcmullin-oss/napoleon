import { BOT_STRATEGIES, formatArenaResult, runArena } from '@napoleon/bot';

// Usage: pnpm --filter @napoleon/cli arena <challenger> <baseline> [--players 4|5] [--deals N] [--challengers K] [--seed S]
function main(): void {
  const args = process.argv.slice(2);
  const positional: string[] = [];
  const flags = new Map<string, string>();
  for (let i = 0; i < args.length; i++) {
    if (args[i]!.startsWith('--')) flags.set(args[i]!.slice(2), args[++i] ?? '');
    else positional.push(args[i]!);
  }
  const [aName = 'heuristic', bName = 'random'] = positional;
  const a = BOT_STRATEGIES[aName];
  const b = BOT_STRATEGIES[bName];
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
