# Decisions log

Running log of judgment calls made while implementing `napoleon-build-spec.md`.
Items 1–8 are the assumptions the spec itself pre-populated (section 11);
they're copied here for a single source of truth. Items 9+ are calls made
during implementation, where the spec was silent or (in one case) internally
inconsistent.

## From the spec (section 11)

1. When Spades is not trump, the Ace of Spades is a normal Spade for following suit.
2. A forced final bid may be any trump suit or NT at the minimum count of 12.
3. A follower may play the Joker on the first trick as an ineffective discard. It just cannot be led then.
4. On the first trick, jacks (including the sister jack) are normal cards of their natural suit for following.
5. A Joker led in an NT hand loses to every other card.
6. A forced Joker (from a led `3S`) must be played even if the holder could follow suit.
7. Napoleon may name any of the 53 cards as the angel, including one in their own hand.
8. Bidding ends immediately after `20NT` since nothing can outrank it.

## Implementation-time decisions

9. **`Config.baseScore` is not a function.** Section 7 specifies `baseScore: (count: number) => number`,
   but section 4 requires `GameState` (which embeds `Config`) to be plain, serializable data — a function
   field can't survive `JSON.stringify`/persistence/the wire. Replaced with two numbers,
   `baseScoreOffset` (10) and `baseScoreMultiplier` (10), plus a pure helper `computeBaseScore(config, count)`
   living outside the state (`S = (count - baseScoreOffset) * baseScoreMultiplier`). Same math, serializable state.
   Likewise, section 7's implied per-player-count `handSize`/`widowSize` function is stored as plain numbers
   set once by `defaultConfig(players)`, not a function.

10. **Defender share when Napoleon is their own angel.** Section 3.9's bullets ("Napoleon gets ±S·m, the
    angel if different gets ±S·m/2, each defender gets ∓S·m/2") are written for the angel-is-a-different-seat
    case and don't explicitly restate the own-angel case. Test cases #25 and #26 in section 8 pin it down:
    each defender still gets a flat `∓S·m/2`, independent of player count — *not* Napoleon's total divided
    among however many defenders there are. Implemented uniformly: every seat that is neither Napoleon nor
    a distinct angel gets `-sign*S*m/2`, whether or not Napoleon is their own angel. This is why the game is
    "generally not zero-sum" even outside the doubling cases.

11. **Widow merge timing.** The `Move` union has no separate "take widow" move — only `nameAngel` and
    `discard`. So `applyMove('nameAngel', ...)` both resolves the angel's seat *and* immediately merges the
    widow into Napoleon's hand (`widow` becomes `[]`), transitioning straight to phase `'discard'`. The
    `discard` move then just removes exactly `widowSize` cards from that already-combined hand. This means
    `viewFor(napoleon)` shows the true widow-augmented hand the instant angel-naming completes, satisfying
    section 6's "the seat's own hand, and (for Napoleon) the widow after it is taken."

12. **Forced bid also ends bidding immediately.** The "no all-pass" rule (section 3.4) forces the last
    active player to bid when no bid exists yet. At the moment they do, they are — by construction — also
    the sole remaining active player, which independently satisfies "every player but one has passed after
    a bid exists." So a forced bid ends the auction on the same move (that player becomes Napoleon
    immediately), rather than looping back around a table with no one left to act.

13. **`GameState.seed` chaining across hands.** The spec calls it "RNG seed for the next deal" without
    specifying how it advances. `createHand(config, seed, dealer, scores)` always uses `seed` to shuffle
    *that* deal. `applyMove('nextHand')` derives the following hand's seed via a small splitmix-style hash
    of the current seed (`deriveSeed`, in `rng.ts`), independent of how many draws the Fisher–Yates shuffle
    itself consumed. This keeps `createHand` a pure function of its seed (needed for the "deterministic
    per-seed deal" acceptance test) while still producing a fresh, reproducible seed for every subsequent hand.

14. **`legalMoves` for `discard` enumerates full card combinations**, i.e. all
    `C(handSize + widowSize, widowSize)` subsets, not individual cards — because a `discard` move bundles
    several cards atomically and there's no per-card legality restriction on what Napoleon may discard.
    This is the "correct" reading of the `legalMoves(state, seat): Move[]` contract, even though a real
    client will build its own multi-select UI rather than iterating this list (worst case, 4-player
    `C(17,5) = 6188` entries — cheap to generate, just not meant for direct UI enumeration).

15. **`angelRevealed` flips as soon as the named `angelCard` is actually played**, by whoever holds it,
    regardless of hand phase/trick number. This directly implements "secret until that player plays the
    card" (section 3.5) without a separate end-of-hand revelation step.

16. **Dealing order**: cards are dealt clockwise starting from the seat left of the dealer, with the dealer
    receiving their hand last, then the widow is drawn from what remains. This has no rules effect (the
    widow's contents are opaque either way) but is recorded here since it affects exactly which cards land
    where for a given seed — relevant if anyone later writes a test asserting specific per-seed hands.

17. **Server framework: undecided pending Phase 3.** Per section 2, boardgame.io is the default choice
    with a documented fallback to a plain Node + WebSockets server if boardgame.io fights the engine's
    hidden-information model. Not yet evaluated — engine (Phases 0–1) and CLI/bots (Phase 2) don't depend
    on this choice, so it's deferred until Phase 3 starts.

18. **Added `packages/cli`, not listed in section 2's layout.** Phase 2 asks for "a text-mode hot-seat
    game and a bot that plays a random legal move," which needs I/O (readline, process.stdout) the engine
    package deliberately excludes ("zero runtime dependencies, no I/O"). Rather than bolt scripts onto the
    engine, added a small `@napoleon/cli` workspace package depending on `@napoleon/engine`, with
    `play.ts` (interactive hot-seat) and `simulate.ts` (bulk bot-vs-bot runner for the 10,000-hand
    acceptance check). `packages/server` and `packages/client` from the spec's layout are still to come
    in Phases 3–4.

19. **`node:readline/promises`'s `question()` can hang on non-TTY stdin.** While building `play.ts`,
    found that a second sequential `rl.question()` call can hang indefinitely when stdin is a redirected
    file/pipe that has already reached EOF — a real Node behavior, not specific to this codebase, but one
    that would also bite anyone scripting/testing the CLI non-interactively. Worked around it with a
    manual `readline` (callback-mode) line queue in `play.ts` instead of the promises API. Verified with a
    full scripted 4-player hand piped through stdin (bidding → forced bid → angel → widow/discard →
    all 12 tricks → correct scoring), in addition to normal interactive use.
