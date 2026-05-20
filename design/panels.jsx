/* global React, window, HAND_HISTORY, CHAT_MESSAGES */
// =====================================================
// NEONPOKER — Sidebar panels & Action bar
// =====================================================

const { useState: useStateP } = React;

// -------- Hand History --------
function HandHistoryPanel() {
  return (
    <div className="panel hand-history">
      <div className="panel-head">
        <h3>HAND HISTORY</h3>
        <span className="chev">▾</span>
      </div>
      <div className="hh-body">
        <div className="hh-scroll">
          {HAND_HISTORY.map((s, i) => (
            <React.Fragment key={i}>
              <div className="hh-street">{s.street}</div>
              {s.rows.map((r, j) => (
                <div className="hh-row" key={j}>
                  <span className={`name ${r.cls}`}>{r.name}</span>
                  <span className="act">{r.act}</span>
                </div>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>
  );
}

// -------- Table Chat --------
function ChatPanel() {
  const [msg, setMsg] = useStateP('');
  const [list, setList] = useStateP(CHAT_MESSAGES);
  const send = () => {
    if (!msg.trim()) return;
    setList([...list, { who: 'NeonRider', cls: 'n-c', msg: msg.trim() }]);
    setMsg('');
  };
  return (
    <div className="panel chat">
      <div className="panel-head">
        <h3>TABLE CHAT</h3>
        <span className="chev">▾</span>
      </div>
      <div className="chat-body">
        <div className="chat-scroll">
          {list.map((c, i) => (
            <div className="chat-row" key={i}>
              <span className={`who ${c.cls}`}>{c.who}:</span>
              <span className="msg">{c.msg}</span>
            </div>
          ))}
        </div>
        <div className="chat-input">
          <input
            placeholder="Type your message…"
            value={msg}
            onChange={e => setMsg(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') send(); }}
          />
          <button className="send" onClick={send} aria-label="Send">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// -------- Game Info --------
function GameInfoPanel({ playerCount = 9, maxSeats = 9 }) {
  return (
    <div className="panel game-info">
      <div className="panel-head" style={{ padding: '8px 14px' }}>
        <h3>GAME INFO</h3>
      </div>
      <div className="gi-body">
        <div className="gi-row"><span>Game Type</span><span className="val">No Limit Hold'em</span></div>
        <div className="gi-row"><span>Stakes</span><span className="val">$1 / $2</span></div>
        <div className="gi-row"><span>Buy-in</span><span className="val">$200 (100 BB)</span></div>
        <div className="gi-row"><span>Players</span><span className="val">{playerCount} / {maxSeats}</span></div>
        <div className="gi-row"><span>Next Break</span><span className="val">00:45:21</span></div>
      </div>
    </div>
  );
}

// -------- Sidebar shell --------
function RightSidebar({ playerCount, maxSeats }) {
  return (
    <div className="sidebar">
      <HandHistoryPanel />
      <ChatPanel />
      <GameInfoPanel playerCount={playerCount} maxSeats={maxSeats} />
    </div>
  );
}

// =====================================================
// Action bar with raise controls + quick bets
// =====================================================
function ActionBar({
  potAmount = 34.5, toCall = 10, minRaise = 20, maxRaise = 412.75,
  canCheck = false,
  onAction,
}) {
  const [amount, setAmount] = useStateP(minRaise);
  const [quick, setQuick] = useStateP('min');

  // clamp helper
  const clamp = v => Math.max(minRaise, Math.min(maxRaise, Math.round(v * 100) / 100));
  const setAmt = (v, q) => { setAmount(clamp(v)); if (q) setQuick(q); else setQuick(null); };

  const quicks = [
    { id: 'min',  label: 'MIN',     val: minRaise },
    { id: 'half', label: '1/2 POT', val: minRaise + potAmount * 0.5 },
    { id: 'pot',  label: 'POT',     val: minRaise + potAmount },
    { id: '2x',   label: '2X POT',  val: minRaise + potAmount * 2 },
    { id: 'all',  label: 'ALL-IN',  val: maxRaise },
  ];

  // slider geometry
  const trackRef = React.useRef(null);
  const pct = ((amount - minRaise) / (maxRaise - minRaise)) * 100;

  const onTrack = (e) => {
    const r = trackRef.current.getBoundingClientRect();
    const p = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    setAmt(minRaise + p * (maxRaise - minRaise));
  };
  const dragging = React.useRef(false);
  const handleDown = (e) => {
    dragging.current = true; onTrack(e);
    const move = ev => dragging.current && onTrack(ev);
    const up = () => { dragging.current = false; window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
  };

  return (
    <div className="action-bar">
      <div className="btn-group">
        <button className="btn fold" onClick={() => onAction && onAction('fold')}>
          FOLD
        </button>
        <button
          className="btn check"
          disabled={!canCheck}
          onClick={() => onAction && onAction('check')}>
          CHECK
        </button>
        <button
          className="btn call"
          disabled={canCheck}
          onClick={() => onAction && onAction('call', toCall)}>
          CALL <span className="sub">${toCall}</span>
        </button>
        <button className="btn raise" onClick={() => onAction && onAction('raise', amount)}>
          RAISE TO <span className="sub">${amount}</span>
        </button>
      </div>

      <div className="raise-ctrls">
        <div className="raise-top">
          <div className="amt-input">
            <span className="pre">$</span>
            <input
              type="number" min={minRaise} max={maxRaise}
              value={amount}
              onChange={e => setAmt(parseFloat(e.target.value || 0))}
            />
          </div>
        </div>
        <div className="raise-mid">
          <button className="iconbtn" onClick={() => setAmt(amount - 1)} aria-label="decrease">−</button>
          <div className="slider" ref={trackRef} onMouseDown={handleDown}>
            <div className="fill" style={{ width: `${pct}%` }} />
            <div className="thumb" style={{ left: `${pct}%` }} />
          </div>
          <button className="iconbtn" onClick={() => setAmt(amount + 1)} aria-label="increase">+</button>
        </div>
        <div className="raise-bot">
          {quicks.map(q => (
            <button
              key={q.id}
              className={`qbtn ${quick === q.id ? 'active' : ''}`}
              onClick={() => setAmt(q.val, q.id)}
            >{q.label}</button>
          ))}
        </div>
      </div>
    </div>
  );
}

Object.assign(window, { HandHistoryPanel, ChatPanel, GameInfoPanel, RightSidebar, ActionBar });
