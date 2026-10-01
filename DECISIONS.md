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
5. ~~A Joker led in an NT hand loses to every other card.~~ Superseded by decision #24: a rule change now has it win outright, same as in a trump hand.
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

20. **Server: plain Node + `ws`, not boardgame.io** (the fallback section 2 explicitly allows). The engine
    already owns every bit of turn/phase logic — whose turn it is, the skip-passed-players bidding order,
    the forced-bid rule, trick-leader-leads-next — and boardgame.io wants to own that itself via its own
    turn-order and move-reducer model. Wrapping our already-complete, already-tested engine inside it would
    mean either fighting its opinions or reimplementing our turn logic a second time in its terms, for a
    project whose whole framing is "scale is tiny... favor simplicity over infrastructure" (section 1).
    `packages/server` is a thin, mostly mechanical layer: a `RoomManager` (join codes, seat assignment,
    delegates every move to the engine's own `applyMove`) plus a `ws` WebSocket adapter that only ever
    sends each seat its own `viewFor` — the server never serializes a full `GameState` to any client.

21. **Wire protocol adds `legalMoves` to every state broadcast** (`packages/protocol`), on
    top of what the engine's `PlayerView` provides. The client has no way to compute this itself — it only
    ever holds a redacted view, never the true `GameState` `legalMoves()` needs — so the server computes it
    server-side per seat and ships it alongside `view`. One exception: during the `discard` phase this is
    always sent as `[]`, since `legalMoves()` there enumerates every valid card combination (thousands of
    them, per decision #14) — fine as a pure-engine API, but not something to put on the wire. A discard UI
    is built from `view.hand` and `view.config.widowSize` directly; the server still authoritatively
    validates whatever discard move actually arrives.

22. **Phase 3's reconnect is in-memory only, scoped to decision #20's "thin layer" framing.** A `token`
    issued on join lets a dropped/refreshed connection re-attach to its seat without losing it or consuming
    a new one, which is enough for "two clients can complete a full hand" through ordinary network blips.
    Surviving an actual *server restart* (rooms and their `GameState` are process-memory only right now)
    is explicitly Phase 5's job ("Persist state so a server restart... can reconnect mid-hand") — building
    it now would be scope creep ahead of the client that's supposed to exercise it.

23. **Extracted the wire protocol into `packages/protocol`,** ahead of Phase 4. It was originally inline
    in `packages/server`, which is fine as long as nothing outside the server imports it — but the client
    needs the same `ClientMessage`/`ServerMessage` types, and `@napoleon/server`'s package entry point
    (`src/index.ts`) pulls in `ws` and `node:http`, neither of which belongs in a browser bundle. Moved
    the (isomorphic — just `JSON.parse`, no Node/DOM APIs) protocol module to its own workspace package so
    both `@napoleon/server` and `@napoleon/client` can depend on it without either pulling in the other's
    runtime. Also added `parseServerMessage`, mirroring `parseClientMessage`, so the client never has to
    trust an unvalidated `as ServerMessage` cast on incoming socket data.

24. **Rule change: a led Joker now wins in an NT hand too, and the leader calls the suit.**
    Previously (spec section 3.7, and decision #5 above) a Joker led in NT was powerless — it
    couldn't win, and the suit to follow was whatever the *second* player happened to play. Per
    an explicit rule change, a led Joker now wins an NT trick outright (still losing only to the
    Ace of Spades, same as in a trump hand), and the suit everyone else must follow is chosen by
    the leader at the moment they lead it, not inferred from the next card played. This needed a
    new field on the leading `TrickPlay`/`play` `Move` — `calledSuit?: Suit` — since the suit is
    now a choice baked into that specific play rather than something derivable from `trump` or
    the rest of the trick. `legalMoves` expands a leadable Joker in an NT hand into one `play`
    move per suit so a client can present the choice; `applyMove` requires `calledSuit` exactly
    when leading the Joker in NT and rejects it everywhere else, so it can't be forged onto an
    unrelated play.

25. **Client: no router, no CSS framework, no state library.** `packages/client` switches between
    Lobby / in-game / rules purely on values already in `GameContext` (`code`, `view`) plus one local
    `showRules` flag in `App.tsx` — a real router is overkill for three screens with no deep-linking
    need. Styling is hand-rolled CSS custom properties in `index.css` (design tokens + a handful of
    reusable classes: `.panel`, `.btn`, `.card`, `.pill`, ...) rather than a component library, kept
    deliberately small so every screen reads as one consistent system. All server state lives in a
    single `GameContext` (a `useReducer` fed by parsed `ServerMessage`s); there's no separate state
    library, since the whole client only ever needs to mirror one `PlayerView` at a time.

26. **Client session persistence and reconnect.** The `{code, seat, token}` triple from a `joined`
    message is saved to `localStorage`; on socket connect (including automatic reconnects after a
    drop, with a capped exponential backoff), the client immediately sends a `reconnect` message if a
    saved session exists. This is the browser-side half of decision #22's server-side reconnect
    tokens — together they mean a refreshed tab or a brief network drop re-attaches to the same seat
    instead of losing the player's place, satisfying Phase 5's "refreshing a browser mid-hand restores
    the player's exact view" ahead of schedule (full persistence *across a server restart* is still
    Phase 5's job — see #22).

27. **Client UI for calling a suit (decision #24).** `legalMoves` can contain several `{type:'play',
    card:'JOKER', calledSuit}` entries at once — one per suit — only when leading the Joker in an NT
    hand. `Hand.tsx` detects this (more than one legal move sharing a card id) and opens a small
    inline suit-picker before actually sending the move, rather than trying to guess or hardcode when
    that case applies; every other card always maps to exactly one legal move and plays immediately
    on click.

28. **Client build: shared contract first, then parallelized.** `Card.tsx` (shared card rendering),
    `GameContext.tsx` (the socket/state layer), `App.tsx` (screen routing), and `Lobby.tsx` (session
    lifecycle: create/join/reconnect) were built first, single-threaded, since every other component
    depends on their exact shape and inconsistency there would ripple everywhere. Once that contract
    was fixed, the remaining seven components split cleanly into three independent groups with no
    shared files (bidding; angel/discard/hand-result; scoreboard/rules) and were built in parallel by
    subagents against that fixed contract, then reviewed and integrated by hand.

29. **Rule change: Napoleon no longer learns the angel's seat just by naming it.** Originally (per the
    spec's own section 6, quoting: "Napoleon and the angel holder each know their own role"), `viewFor`
    revealed `angelSeat` to Napoleon from the moment `nameAngel` resolved it, even though the angel's
    *holder* wouldn't play the card — or find out they'd been named — for many tricks. Per an explicit
    rule change, Napoleon is now kept in the dark exactly like every other defender: `angelSeat` is
    hidden until `angelRevealed` (the card is actually played), with the one unavoidable exception of
    the angel holder themselves, who can always tell from their own hand (`viewFor`'s
    `knowsAngelSeat = angelRevealed || seat === angelSeat`). This still correctly covers the own-angel
    case: when Napoleon slurps or holds the angel, `seat === angelSeat` is true for Napoleon's own view
    regardless, since Napoleon *is* the angel holder there. Updated section 3.5/6 of the spec and the
    now-stale `view.test.ts` assertion this superseded.

30. **Deployment: one service, not two.** `packages/server` now serves `packages/client`'s built static
    files itself (`static.ts`, wired into the same `http.Server` the WebSocket upgrade already uses),
    rather than deploying the client and server as separate hosted things. For "one host, a handful of
    tables" (section 1), running and paying for two services — plus wiring CORS/cross-origin WebSocket
    config between them — is pure overhead with no benefit. One consequence: the client can no longer
    assume the server is at a fixed `localhost:8080`; `GameContext.tsx`'s `WS_URL` now defaults to
    same-origin (swap the page's own protocol for `ws`/`wss`, keep its host) and only falls back to an
    explicit port for local dev, via `packages/client/.env.development` (loaded automatically by Vite in
    dev, absent from production builds).

31. **Server build: esbuild-bundled, not `tsc`-compiled.** `@napoleon/engine` and `@napoleon/protocol`
    are consumed as raw TypeScript source everywhere (their `package.json` `main` points at `src/index.ts`
    directly — fine for `tsx`, Vite, and Vitest, all of which transform TS on the fly, but plain `node`
    can't execute `.ts` files). Rather than give every workspace package its own proper `dist` build with
    correct `exports`, `packages/server`'s `build` script uses `esbuild --bundle` to inline those
    packages' source directly into one `dist/index.js`, with only `ws` and Node builtins left as real
    runtime dependencies (`--external:ws`). Simpler than a multi-package build graph for a monorepo this
    size, and the output runs with plain `node dist/index.js` — no `tsx` needed in production.

32. **Docker image is single-stage and copies the whole built repo.** `Dockerfile` doesn't bother with a
    multi-stage build to trim the final image (copying only `dist/` + production `node_modules` out of a
    build stage) — again, "tiny scale... favor simplicity" (section 1). The image is larger than it needs
    to be; that's an acceptable trade for a Dockerfile anyone can read in ten seconds.

33. **Bots: new `packages/bot`, server-driven, lobby-only, heuristic strategy.** Added to let a game
    start short-handed, per explicit request (not in the original spec, which listed "AI opponents beyond
    the random test bot" as a non-goal). Design choices, each picked over a real alternative:
    - **Server-driven, not fake WebSocket clients.** The server already has `legalMoves`/`applyMove`/
      `viewFor` in-process; when `GameState.turn` belongs to a bot seat, `scheduleBotTurnIfAny` in
      `server.ts` just computes and applies a move directly, after a short randomized delay purely for
      feel. No subprocess, no extra connection, nothing for the client to know about beyond seeing a
      bot's name in the roster. A bot never sees more than `viewFor`/`legalMoves` would give a real
      player at that seat — it cannot peek at the true `GameState`, so it can't cheat even by accident.
    - **`BotStrategy` is a one-method interface** (`chooseMove(view, legalMoves, rng) => Move`) in a
      `BOT_STRATEGIES` registry keyed by name. This is specifically so a future stronger strategy (search/
      Monte Carlo, discussed but explicitly deferred) is a new entry in that registry, not a rewrite of
      how bots plug into rooms/server/client.
    - **`heuristicStrategy`** (the default): hand-strength-based bidding (passes on weak hands unless
      forced by the no-all-pass rule; strength maps onto a bid count via `packages/bot/src/heuristic/
      bidding.ts`'s calibration), discards the weakest cards first, and plays via a no-lookahead "take it
      cheaply if you can, hold back an expensive card unless you're last to act" rule
      (`heuristic/play.ts`), and names the most powerful card not already in hand as the angel
      (`heuristic/angel.ts` — see #34, this was originally a random pick and got upgraded).
      `randomStrategy` (uniform random legal move, relocated from `packages/cli`) is kept in the registry
      mainly as the stress-test baseline it always was.
    - **Bots get the engine's true `legalMoves`, not the wire-trimmed version a real client receives** —
      the `[]`-during-discard restriction (#21) exists specifically to avoid shipping thousands of card
      combinations over a network connection, which doesn't apply to an in-process function call. Getting
      this wrong was a real bug caught by `packages/bot/test/property.test.ts` while building this (see
      that file's comment) — `randomStrategy` isn't defensive against an empty discard list, deliberately,
      since a non-empty one is the actual contract between the server and a `BotStrategy`.
    - **Lobby-only for now**, matching the explicit scoping decision: `RoomManager.addBot()` only fills
      seats while `room.state` is still null, and is rejected once a hand has started. Auto-replacing a
      disconnected human mid-game was discussed and deliberately deferred — bigger scope (a timer, a
      hand-off) than "fill empty seats before the game starts."
    - **Bots never trigger `nextHand`.** `scheduleBotTurnIfAny` explicitly stops at `phase === 'handOver'`
      — only a connected human advances past a finished hand, so nobody's hand-result screen gets yanked
      away before they've read it.

34. **Bot bidding recalibration, and a real angel-naming heuristic.** Playtesting surfaced two problems
    with #33's first cut: bots bid the maximum (20) almost every hand, and named the angel uniformly at
    random (sometimes an obviously bad card).
    - **Bidding was miscalibrated, not just "too aggressive."** `estimateHandStrength` takes the *best*
      of 5 candidate trumps for a hand — an order statistic that runs well above per-card intuition.
      A script sampling 20,000 random 12-card hands found the *median* hand already scores ~14 under its
      best trump, with the 99th percentile around 24. The old constants (`WORTH_BIDDING_THRESHOLD = 4`,
      `STRENGTH_TO_COUNT_SCALE = 0.5`) treated 4 as "barely worth bidding," so nearly every hand cleared
      the bar and climbed toward the max count. Recalibrated against that same distribution:
      `WORTH_BIDDING_THRESHOLD = 13` (~median — roughly half of random hands now pass outright) and
      `STRENGTH_TO_COUNT_SCALE = 0.7` (the 99th-percentile hand now reaches the max bid of 20, not the
      typical one). Re-running the same sampling script against the new constants gives a believable
      spread: ~41% pass, and the rest spread across 12–20 with sharply decreasing frequency toward 20.
    - **Angel-naming now picks the most powerful card not already in hand** (`heuristic/angel.ts`),
      using a dedicated power ranking that mirrors `resolveTrick.ts`'s actual precedence (Ace of Spades
      always wins > jack of trump > sister jack > Joker, situational since it only wins if led > rest of
      trump by rank > plain naturals by rank) — deliberately a different scale from `strength.ts`'s
      bidding-tuned `cardStrength`, which exists to rank cards for hand-strength purposes, not to mirror
      true trick-winning precedence. "Not already in hand" is the only information a bot (or a human)
      actually has — nobody can see who holds what, by design (#2's hidden information rule).
