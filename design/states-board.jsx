/* global React, ReactDOM, window, BoardCards, BOARD_DEFAULT */

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
            <div className="l2">BOARD CARD STATES</div>
          </div>
        </div>
        <a className="back" href="NEONPOKER Table.html">← BACK TO TABLE</a>
      </header>

      <section>
        <h2>BOARD · STREET PROGRESSION</h2>
        <p className="sub">5 fixed slots, always present. Unrevealed cards remain face-down.</p>

        <div className="board-states">
          {[
            { name: 'PRE-FLOP', n: 0, sub: '0 of 5 revealed · all hidden' },
            { name: 'FLOP',     n: 3, sub: '3 of 5 revealed · 2 remain face-down' },
            { name: 'TURN',     n: 4, sub: '4 of 5 revealed · 1 remains face-down' },
            { name: 'RIVER',    n: 5, sub: '5 of 5 revealed · all face-up' },
          ].map(s => (
            <div className="board-row" key={s.name}>
              <div className="board-row-meta">
                <div className="board-row-name">{s.name}</div>
                <div className="board-row-sub">{s.sub}</div>
              </div>
              <div className="board-stage">
                <BoardCards cards={BOARD_DEFAULT} reveal={s.n} />
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
