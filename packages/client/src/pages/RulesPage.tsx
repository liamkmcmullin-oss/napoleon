export function RulesPage(): React.JSX.Element {
  return (
    <div className="stack">
      <p style={{ margin: 0, opacity: 0.85 }}>
        Quick reference for Napoleon. Look up what you need mid-hand — see the build spec for full detail.
      </p>

      <div className="panel">
        <h3 style={{ margin: 0 }}>Deck &amp; points</h3>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>52 cards plus 1 Joker (53 cards total).</li>
          <li>Rank high to low: A, K, Q, J, 10, 9, 8, 7, 6, 5, 4, 3, 2.</li>
          <li>A, K, Q, J, 10 of each suit are point cards worth 1 point each — 20 point cards total.</li>
          <li>The Joker and 2–9 are worth nothing.</li>
        </ul>
      </div>

      <div className="panel">
        <h3 style={{ margin: 0 }}>Setup</h3>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>4 players: 12 cards each, 5-card widow, 12 tricks.</li>
          <li>5 players: 10 cards each, 3-card widow, 10 tricks.</li>
          <li>Dealer rotates one seat each hand. The player to the dealer's left bids first.</li>
        </ul>
      </div>

      <div className="panel">
        <h3 style={{ margin: 0 }}>Bidding</h3>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>A bid is a count (12–20) plus a trump: C, D, H, S, or NT.</li>
          <li>Higher count always wins. Same count: trump rank breaks the tie, low to high C &lt; D &lt; H &lt; S &lt; NT.</li>
          <li>Passing is final — once you pass, you're out for the rest of bidding.</li>
          <li>If everyone passes with no bid on the table, the last player must bid at least 12 (any trump).</li>
          <li>Trump can never change once bidding ends.</li>
        </ul>
      </div>

      <div className="panel">
        <h3 style={{ margin: 0 }}>The angel</h3>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>Before seeing the widow, Napoleon names any one of the 53 cards as "the angel."</li>
          <li>The named card is public knowledge, but who holds it stays secret until it's played.</li>
          <li>
            If the angel ends up in Napoleon's own hand or the widow ("slurping"), Napoleon plays alone and
            scoring doubles.
          </li>
          <li>Otherwise, whoever holds the angel is Napoleon's secret partner.</li>
        </ul>
      </div>

      <div className="panel">
        <h3 style={{ margin: 0 }}>Widow &amp; discards</h3>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>Napoleon takes the widow into hand, then discards the same number of cards face-down.</li>
          <li>Discarded point cards don't count for anyone.</li>
        </ul>
      </div>

      <div className="panel">
        <h3 style={{ margin: 0 }}>Trump &amp; special cards</h3>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>
            In a trump hand, the Jack of trump and the same-color suit's Jack (the "sister jack") are the two
            highest trump cards.
          </li>
          <li>
            The Ace of Spades always wins the trick it's played in — it's only a trump card if Spades is trump,
            otherwise it's a normal Spade for following suit.
          </li>
          <li>
            The Joker can be played any time except led on the first trick. If not led, it has no effect and
            can't win the trick. If led, it wins the trick unless the Ace of Spades is played.
          </li>
          <li>
            Leading the Joker in a No Trump hand: the leader also calls a suit at that moment, and everyone
            else must follow that called suit if able, exactly as if it had been led normally.
          </li>
          <li>If a 2 is played by anyone and every player follows suit (the suit stays unbroken), the 2 wins the trick — even if it wasn't led.</li>
        </ul>
      </div>

      <div className="panel">
        <h3 style={{ margin: 0 }}>Scoring</h3>
        <ul style={{ margin: 0, paddingLeft: '1.2em' }}>
          <li>Base score S = (bid count − 10) × 10.</li>
          <li>Doubled if Napoleon is their own angel.</li>
          <li>Doubled again if Napoleon's side captures all 20 points (up to ×4 total).</li>
          <li>Napoleon wins the hand if their side's captured points ≥ the bid count.</li>
        </ul>
      </div>
    </div>
  );
}
