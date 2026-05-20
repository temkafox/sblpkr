/* global React, ReactDOM, window, PLAYERS, PlayerSeat, HeroSeat, CardFace, BoardCards, BOARD_DEFAULT */

// Dedicated showcase: player seat states (opponent + hero)
const playerById = id => PLAYERS.find(p => p.id === id);

function StateCell({ label, children }) {
  return (
    <div className="state-cell">
      <div className="state-stage">{children}</div>
      <div className="state-label">{label}</div>
    </div>
  );
}

function OppCell({ id, status, bet = 0, holes = true, label }) {
  const p = playerById(id);
  return (
    <StateCell label={label}>
      <PlayerSeat
        p={p}
        st={{ status, bet, amount: '' }}
        pos={{ x: 18, y: 90, dir: 'down' }}
        showHoles={holes}
        holesSide="top"
      />
    </StateCell>
  );
}

function HeroCell({ status, label }) {
  const p = playerById('hero');
  return (
    <StateCell label={label}>
      <div style={{
        position: 'absolute', left: '50%', top: 8,
        transform: 'translateX(-50%)',
        display: 'flex', gap: 6, zIndex: 3,
        pointerEvents: 'none',
      }}>
        <div style={{ transform: 'rotate(-6deg) translateY(2px)' }}>
          <CardFace rank="A" suit="s" />
        </div>
        <div style={{ transform: 'rotate(6deg) translateY(2px)' }}>
          <CardFace rank="K" suit="h" />
        </div>
      </div>
      <HeroSeat
        p={p}
        st={{ status, bet: 0, amount: '' }}
        pos={{ x: 22, y: 120, dir: 'down' }}
      />
    </StateCell>
  );
}

function App() {
  return (
    <div className="states-root">
      <header className="states-head">
        <div className="state-logo">
          <div className="mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L20 9 L17 22 L7 22 L4 9 Z" fill="#1a0028" stroke="white" strokeWidth="1.2"/>
              <circle cx="12" cy="13" r="3" fill="white" opacity=".9"/>
            </svg>
          </div>
          <div className="word">
            <div className="l1">NEON<span style={{ color: '#22d3ff' }}>POKER</span></div>
            <div className="l2">PLAYER SEAT STATES</div>
          </div>
        </div>
        <a className="back" href="NEONPOKER Table.html">← BACK TO TABLE</a>
      </header>

      <section>
        <h2>OPPONENT SEAT · STATES</h2>
        <p className="sub">All states show 2 hidden cards centered above the player container.</p>
        <div className="grid">
          <OppCell id="p4" status="idle"   label="Default · Idle" />
          <OppCell id="p3" status="turn"   label="Active turn (animated)" />
          <OppCell id="p5" status="check"  label="Check" />
          <OppCell id="p7" status="call"   bet={10} label="Call $10" />
          <OppCell id="p4" status="raise"  bet={40} label="Raise to $40" />
          <OppCell id="p2" status="fold"   holes={true} label="Fold (muted, readable)" />
          <OppCell id="p9" status="allin"  bet={154.8} label="All-in" />
          <OppCell id="p6" status="winner" label="Winner" />
          <OppCell id="p8" status="sitout" holes={false} label="Sitting out" />
        </div>
      </section>

      <section>
        <h2>HERO SEAT · STATES</h2>
        <p className="sub">Hero shows 2 face-up cards centered above the seat container.</p>
        <div className="grid">
          <HeroCell status="turn"   label="Active · YOUR TURN" />
          <HeroCell status="call"   label="Call $10" />
          <HeroCell status="raise"  label="Raise to $40" />
          <HeroCell status="allin"  label="All-in" />
          <HeroCell status="winner" label="Hand winner" />
          <HeroCell status="fold"   label="Fold" />
        </div>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
