# Napoleon: Build Specification

A self-contained spec for building a remote multiplayer version of our group's house-rules Napoleon (ナポレオン), a trick-taking card game for 4 or 5 players.

---

## 0. Instructions for the coding agent

- This document is authoritative. Implement the rules exactly as written.
- Build the **pure rules engine first**, with tests, before any networking or UI. Do not start Phase 3 until Phase 1 and 2 pass their acceptance criteria.
- Where the rules are ambiguous, use the defaults in section 11 and record the decision in `DECISIONS.md`. Do not silently guess, and do not invent new rules.
- Write tests alongside the code, not after. The trick-resolution and legal-play logic is where the bugs are.
- Stop at the end of each phase and give a short summary of what was built, what was tested, and any decisions made.

---

## 1. Goal

A web app where friends play Napoleon remotely from their phones or laptops. The server holds the full game state and sends each player only what they are allowed to see. Scale is tiny (one host, a handful of tables), so favor simplicity over infrastructure.

---

## 2. Tech stack and layout

- **Language:** TypeScript (strict mode) everywhere.
- **Package manager:** pnpm workspace.
- **Tests:** Vitest.
- **Engine:** zero runtime dependencies, no I/O, no framework imports.
- **Server:** boardgame.io wrapping the engine (`G` is the engine state, each move calls `applyMove`, `playerView` calls `viewFor`). If boardgame.io fights the engine's hidden information or turn model, fall back to a small Node server with WebSockets and record the reason in `DECISIONS.md`.
- **Client:** Vite + React, mobile friendly.

```
napoleon/
  SPEC.md              (this file)
  DECISIONS.md         (running log of judgment calls)
  packages/
    engine/            pure rules, config, types, tests
    server/            multiplayer server, rooms, persistence
    client/            web UI
```

---

## 3. Rules (authoritative)

### 3.1 Cards and points

- Deck: 52 standard cards plus 1 Joker (53 cards).
- Rank within a suit, high to low: A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2. The Ace is high.
- **Point cards:** A, K, Q, J, 10 of every suit, worth 1 point each. There are **20 point cards** in total. The Joker and 2 through 9 are worth nothing.
- Card ids: rank char + suit char, for example `AS`, `KH`, `TD` (ten), `2C`, `JOKER`. Ranks: `2-9 T J Q K A`. Suits: `C D H S`.

### 3.2 Setup

| | 4 players | 5 players |
|---|---|---|
| Cards per hand | 12 | 10 |
| Widow (face down) | 5 | 3 |
| Tricks per hand | 12 | 10 |
| Napoleon discards | 5 | 3 |

- Play and dealing go clockwise. The dealer rotates one seat each hand. The player to the dealer's left bids first.

### 3.3 Hand flow

1. Deal.
2. Bidding.
3. Napoleon names the **angel** (a card), **before** seeing the widow.
4. Napoleon takes the widow and discards.
5. Play all tricks. **Napoleon leads the first trick.**
6. Score the hand, update cumulative scores, rotate the dealer.

### 3.4 Bidding

- A bid is `(count, trump)`. `count` is the number of point cards Napoleon's side promises to capture, from 12 to 20. `trump` is `C`, `D`, `H`, `S`, or `NT` (No Trump).
- A higher count always beats a lower count. For the same count, the trump rank decides, low to high: **C < D < H < S < NT**.
- Players act in turn, starting left of the dealer. On their turn a player either makes a higher bid or passes.
- **Passing is final.** A player who has passed cannot bid again.
- Bidding ends when every player but one has passed after a bid exists. That player is **Napoleon** and the bid is final.
- **There is no all-pass.** If every player passes and the last player to act has not bid, that player must bid at least 12 (any trump or NT).
- If a bid of 20 NT is made, no higher bid exists, so bidding ends immediately.
- **Trump can never be changed after bidding.**

### 3.5 Angel, slurping, and the widow

1. Napoleon names the angel: **any one of the 53 cards** (including the Joker, the Ace of Spades, or a card in Napoleon's own hand). This happens before Napoleon touches the widow.
2. The named card is **public**. Who holds it is **secret** until that player plays the card.
3. Napoleon then takes the widow into their hand and discards the same number of cards (5 or 3). Discards are face down.
4. **Discarded point cards do not count for Napoleon's side.** They count for nobody.

The angel's seat is resolved as follows:
- If the named card was dealt to another player, that player is the angel.
- If the named card is in Napoleon's hand, or is in the widow (this is called **slurping**), or is discarded by Napoleon, **Napoleon is their own angel**. Napoleon may discard a slurped angel card if they wish, but it changes nothing.

Napoleon's side is Napoleon plus the angel. If Napoleon is their own angel, Napoleon plays alone against everyone else, and scoring is doubled (section 3.9).

### 3.6 Trump, the jacks, and the Ace of Spades

- If the bid is a suit, that suit is **trump**. If the bid is NT, there is **no trump and no special jacks**.
- The **Jack of trump** and the **sister jack** (the jack of the other suit of the same color) are the two **highest trump cards**, in that order. The sister jack **counts as trump** and does not belong to its natural suit.
- Trump order, high to low: Jack of trump, sister jack, A, K, Q, 10, 9, 8, 7, 6, 5, 4, 3, 2 of trump.
- Example: Hearts trump. Trump cards are `JH`, `JD`, `AH`, `KH`, `QH`, `TH`, ... `2H`. Diamonds have no jack.
- The **Ace of Spades always wins the trick it is played in.** It is a trump card **only if Spades is trump**. Otherwise it is a normal Spade for following suit.
- If Spades is trump, the top trump cards are `JS`, `JC`, then `AS` (in the Ace position), `KS`, and so on. A player whose only trump card is the Ace of Spades must play it whenever trump is required.

### 3.7 The Joker and the 3 of Spades

**Joker:**
- Can be played at any time by any player, including as a discard when a player could follow suit. **It cannot be led on the first trick.**
- If **not led**, it has no effect and cannot win the trick.
- If **led in a trump hand**, all other players must play a trump card if able, and a player with no trump may play any card. The Joker wins the trick unless the Ace of Spades is played.
- If **led in a No Trump hand**, the Joker is useless. It cannot win the trick. The **suit of the next card played becomes the effective led suit** for everyone who follows. The player after the Joker is free to play any card.
- It is not a point card.

**3 of Spades:**
- If **led** (on any trick except the first), it forces the Joker to be played by whoever holds it. That player must play the Joker even if they could follow suit.
- This does **not** make the 3 of Spades win. The forced Joker is not led, so it has no effect, and the trick is decided by normal rules.
- On the first trick the 3 of Spades has no forcing effect.

### 3.8 Legal plays and trick resolution

Define these terms:
- `firstTrick`: true for trick number 1.
- `isTrump(card)`: false if `firstTrick` or the hand is NT. Otherwise true for any card of the trump suit, and for the sister jack. (The Jack of trump is already a trump-suit card.)
- `effectiveSuit(card)`: the Joker has none. On the first trick, or in an NT hand, a card's effective suit is its natural suit. Otherwise a trump card's effective suit is `TRUMP` and any other card's effective suit is its natural suit.

**Leading:**
- Any card, except that Napoleon may not lead the Joker on the first trick.

**Following.** Given the led card and the cards played so far:
1. If it is not the first trick, the led card is `3S`, and the player holds the Joker: the **only** legal play is the Joker.
2. The player may **always** play the Joker (unless rule 1 already forced it).
3. Otherwise the required suit `R` is:
   - Led card is the Joker, trump hand: `R = TRUMP`.
   - Led card is the Joker, NT hand: if no other card has been played yet, `R` is none (any card is legal). Otherwise `R = effectiveSuit` of the first card played after the Joker.
   - Any other led card: `R = effectiveSuit(led card)`.
4. If `R` exists and the player holds cards with that effective suit, they must play one of them (or the Joker per rule 2). If they hold none, any card is legal.

**Resolving a trick.** Evaluate in this order and stop at the first match:

*First trick (nothing special):*
1. If the Ace of Spades was played, it wins.
2. Otherwise the highest card of the led suit wins (natural suits, natural rank). Trump, the Joker, and twos have no special power.

*Every other trick:*
1. **Ace of Spades** was played: it wins.
2. **Joker was led** and the hand is not NT: the Joker wins.
3. **Two rule:** the led card is a two, and **every** card played has the same effective suit as the led two (a played Joker counts as outside the suit): the led two wins.
4. **Highest trump** wins (trump order in section 3.6). Only applies to non-NT hands.
5. **Highest card of the led suit** wins (natural rank, Ace high). In an NT hand where the Joker was led, the led suit is `R` from the "Following" rules.

The winner collects the trick and leads the next one. There are **no restrictions on the last trick**.

### 3.9 Winning a hand and scoring

- **Napoleon's side's score** = the number of point cards in tricks won by Napoleon or the angel. Discards count for no one.
- **Napoleon wins** if that score is at least the bid `count`. Otherwise Napoleon loses.
- **Base score** depends only on the bid: `S = (count - 10) * 10`.

| Bid | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|---|---|---|
| S | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100 |

- **Multiplier** `m` starts at 1 and stacks:
  - x2 if Napoleon is their own angel (named a card in their own hand, or slurped it).
  - x2 if Napoleon's side captured **all 20** point cards.
  - Multipliers apply on wins **and** losses.
- **Napoleon wins:** Napoleon gets `+S*m`. The angel (if a different player) gets `+S*m/2`. Each defender gets `-S*m/2`.
- **Napoleon loses:** Napoleon gets `-S*m`. The angel (if a different player) gets `-S*m/2`. Each defender gets `+S*m/2`.
- Scores accumulate across hands. The result is generally not zero-sum.

---

## 4. Data model

Use plain serializable objects (no classes) so state can be persisted and sent over the wire.

```ts
type Suit = 'C' | 'D' | 'H' | 'S';
type CardId = string;            // "AS", "TD", "2C", "JOKER"
type Trump = Suit | 'NT';
type Seat = number;              // 0..players-1

interface Bid { count: number; trump: Trump }

type Move =
  | { type: 'bid'; bid: Bid }
  | { type: 'pass' }
  | { type: 'nameAngel'; card: CardId }
  | { type: 'discard'; cards: CardId[] }   // Napoleon, after widow is added to hand
  | { type: 'play'; card: CardId }
  | { type: 'nextHand' };

interface GameState {
  config: Config;
  phase: 'bidding' | 'angel' | 'discard' | 'play' | 'handOver';
  players: number;
  dealer: Seat;
  turn: Seat;
  hands: CardId[][];
  widow: CardId[];                 // empty once taken
  passed: boolean[];
  currentBid: Bid | null;
  bidder: Seat | null;             // holder of currentBid
  napoleon: Seat | null;
  trump: Trump | null;
  angelCard: CardId | null;        // public once named
  angelSeat: Seat | null;          // secret; equals napoleon if own angel
  angelRevealed: boolean;          // true once the angel card is played
  discards: CardId[];
  trick: { seat: Seat; card: CardId }[];
  trickNumber: number;             // 1-based
  captured: CardId[][];            // by seat, cards from tricks that seat won
  scores: number[];                // cumulative across hands
  handResult: HandResult | null;
  seed: number;                    // RNG seed for the next deal
}

interface HandResult {
  napoleonWon: boolean;
  points: number;                  // Napoleon's side captured points
  base: number;                    // S
  multiplier: number;
  deltas: number[];                // per seat
}
```

Use a small seeded PRNG (for example mulberry32) and Fisher-Yates so deals are deterministic and reproducible in tests.

---

## 5. Engine API

All functions are pure and never mutate their input.

```ts
createHand(config, seed, dealer, scores?): GameState
legalMoves(state, seat): Move[]
applyMove(state, seat, move): { ok: true; state: GameState } | { ok: false; error: string }
viewFor(state, seat): PlayerView            // redacted state for one player
```

Exported helpers, each with their own tests:

```ts
isTrump(card, trump, firstTrick): boolean
effectiveSuit(card, trump, firstTrick): Suit | 'TRUMP' | null
trumpRank(card, trump): number
legalPlays(hand, trick, ctx): CardId[]
resolveTrick(trick, ctx): Seat                // winning seat
scoreHand(state): HandResult
outranks(newBid, currentBid): boolean
```

`applyMove` must reject anything illegal (wrong phase, wrong seat, illegal card, illegal bid) with a clear error string.

---

## 6. Hidden information (`viewFor`)

For each seat, the view **must not reveal**:
- Other players' hands (show only their card counts).
- The widow contents before Napoleon takes it.
- Napoleon's discards (show only the count) until the hand is over.
- `angelSeat`, until `angelRevealed` is true. Napoleon and the angel holder each know their own role.

The view **must show**:
- All bids and passes, the current bid, Napoleon, and trump once known.
- The named `angelCard`.
- The current trick, all previously played cards, and each seat's captured pile.
- The seat's own hand, and (for Napoleon) the widow after it is taken.
- Cumulative scores and the hand result once the hand is over.

Add tests that a redacted view for seat A contains no card ids belonging to seat B's hand.

---

## 7. Config defaults

Rules that might change later must live here, not be hardcoded.

```ts
export interface Config {
  players: 4 | 5;
  minBid: number;                    // 12
  maxBid: number;                    // 20
  trumpRankLowToHigh: string[];      // ['C','D','H','S','NT']
  noTrumpAllowed: boolean;           // true
  baseScore: (count: number) => number;  // (count - 10) * 10
  angelIsNapoleonMultiplier: number; // 2
  allTwentyMultiplier: number;       // 2
  discardedPointsCount: boolean;     // false
  jokerFirstTrickAllowed: boolean;   // false
  threeOfSpadesForcesJoker: boolean; // true
}
```

---

## 8. Test plan

Write these as named tests. All non-first-trick examples assume it is not trick 1.

**Trick resolution**
1. Hearts trump. Led `7C`; plays `9C`, `KC`, `JH`, `AC`. Winner: `JH` (highest trump).
2. Hearts trump. Trump order: `JH` beats `JD` beats `AH` beats `KH`. The sister jack `JD` beats `AH`.
3. Spades not trump. Joker led. Everyone plays trump; one player has no trump and plays `AS`. `AS` wins.
4. Diamonds not trump. Led `2D`, followers play `KD`, `AD`, `5D`. The `2D` wins.
5. Same as 4, but a follower plays the Joker instead of a diamond. The two rule fails and the highest diamond wins (or trump, if trump was played).
6. Hearts trump. Led `2H`, all play trump including `JH`. The `2H` wins.
7. `3S` led (Spades not trump, Hearts trump). Joker holder must play the Joker even with Spades in hand. Another player with no Spades plays `5H`. Winner: `5H` (highest trump), not the Joker and not the `3S`.
8. First trick, Hearts trump. Led `5C`; plays `9C`, `AC`, and a player with no clubs plays `JH`. Winner: `AC` (trump is ineffective).
9. First trick: `AS` played on any suit wins.
10. NT hand. Joker led, then `6D` (sets effective suit), then `KD`, then a player with no diamonds plays `AH`. Winner: `KD`. The Joker and `AH` do not win.
11. Spades trump. `AS` is a trump card. If trump is led and a player's only trump is `AS`, they must play it.

**Legal plays**
12. Napoleon may not lead the Joker on trick 1. Anyone may lead it later.
13. A follower holding the led suit may still play the Joker.
14. Trump hand, Joker led: a player with trump must play trump. A player with none may play anything.
15. Hearts trump, `8D` led: a player whose only diamond-ish card is `JD` is not required to follow (the sister jack is trump).
16. NT hand, Joker led: the second player may play any card. The third and later players follow the suit of the second player's card.

**Bidding**
17. Ordering: `12C < 12D < 12H < 12S < 12NT < 13C`.
18. A passed player cannot act again.
19. If everyone else passes and no bid exists, the last player is forced to bid at least 12.
20. Bidding ends immediately after `20NT`.

**Angel and scoring**
21. Angel card dealt to another player: that player is the angel, and multiplier is 1.
22. Angel card in Napoleon's hand: Napoleon is their own angel, multiplier 2.
23. Angel card in the widow (slurp): Napoleon is their own angel, multiplier 2, even if Napoleon then discards it.
24. Bid 13, Napoleon wins, angel separate, 5 players: Napoleon `+30`, angel `+15`, each of 3 defenders `-15`.
25. Bid 15, Napoleon loses as own angel: `S=50`, `m=2`. Napoleon `-100`, each defender `+50`.
26. Bid 20, Napoleon wins alone taking all 20 points: `S=100`, `m=4`. Napoleon `+400`, each defender `-200`.
27. Discarded point cards do not add to Napoleon's total.

**Invariants (property tests over thousands of random legal games)**
- The engine never reaches a state where the acting player has no legal move.
- Every hand ends with all 53 cards accounted for (in tricks or discards).
- Point cards captured plus point cards discarded equals exactly 20.
- Each trick has exactly `players` cards, and each seat leads or follows in the right order.
- The hidden-information view for any seat never contains another seat's hand.

---

## 9. Build phases

**Phase 0: scaffolding.** pnpm workspace, TypeScript strict, Vitest, lint. Card ids, deck, seeded shuffle, deal for 4 and 5 players. *Accept:* deck has 53 unique cards with 20 point cards, deals are deterministic per seed.

**Phase 1: rules engine.** Everything in sections 3, 4, 5. *Accept:* all tests in section 8 pass, including the property tests.

**Phase 2: CLI and bots.** A text-mode hot-seat game and a bot that plays a random legal move. *Accept:* 10,000 bot-vs-bot hands complete with no engine errors and no invariant violations.

**Phase 3: multiplayer server.** Rooms with short join codes, seat assignment, `viewFor` as the per-player view, move validation via the engine. *Accept:* two clients can complete a full hand and neither can see the other's cards in network payloads.

**Phase 4: web client.** Lobby, bidding panel (with legal bids only), angel picker, widow discard picker, table with current trick, own hand with illegal cards disabled, scoreboard, and a rules reference page. Mobile layout first. *Accept:* a full 5-player game can be played from five browser tabs.

**Phase 5: robustness.** Persist state so a server restart or dropped player can reconnect mid-hand. Cumulative scores across hands. Deployment notes (for example Fly.io or Render, or a Cloudflare Tunnel for a first playtest). *Accept:* refreshing a browser mid-hand restores the player's exact view.

**Phase 6: polish.** Angel reveal when the card is played, "slurp" callout, config toggles for house rules, spectator view.

---

## 10. Non-goals

- Accounts, matchmaking, or public lobbies.
- AI opponents beyond the random test bot.
- Monetization or analytics.

---

## 11. Assumptions to record in DECISIONS.md

These were not explicitly stated and were defaulted:

1. When Spades is not trump, the Ace of Spades is a normal Spade for following suit.
2. A forced final bid may be any trump suit or NT at the minimum count of 12.
3. A follower may play the Joker on the first trick as an ineffective discard. It just cannot be led then.
4. On the first trick, jacks (including the sister jack) are normal cards of their natural suit for following.
5. A Joker led in an NT hand loses to every other card.
6. A forced Joker (from a led `3S`) must be played even if the holder could follow suit.
7. Napoleon may name any of the 53 cards as the angel, including one in their own hand.
8. Bidding ends immediately after `20NT` since nothing can outrank it.
