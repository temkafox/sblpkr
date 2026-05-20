/* global React, window */
// =====================================================
// NEONPOKER — Core visual components
// =====================================================

const { useState, useEffect, useRef } = React;

// -------- Avatar (portrait or neon placeholder) --------
function Avatar({ p, ring, size }) {
  const sz = size; // optional override
  const ringCls = `ring-${ring || p.ring || 'violet'}`;
  const style = sz ? { width: sz, height: sz } : null;
  return (
    <div className={`avatar ${ringCls}`} style={style}>
      {p.avatar
        ? <img src={p.avatar} alt={p.name} />
        : <div className="placeholder">{p.init}</div>}
    </div>
  );
}

// -------- Playing card (face-up) --------
const SUIT_CHAR = { h: '♥', d: '♦', s: '♠', c: '♣' };
const SUIT_RED  = { h: true, d: true, s: false, c: false };

function CardFace({ rank, suit, big }) {
  return (
    <div className={`card-face ${SUIT_RED[suit] ? 'red' : ''}`}>
      <div className="rank">{rank}</div>
      <div className="suit">{SUIT_CHAR[suit]}</div>
      <div className="big">{SUIT_CHAR[suit]}</div>
    </div>
  );
}

function CardBack() {
  return <div className="card-back" />;
}

// -------- Mini opponent hole cards (rendered as a child of the seat) --------
function OppHoles({ side = 'top', folded }) {
  // 'top' = cards stick out above seat. 'bottom' = below seat.
  // 'right' = stick out right side. 'left' = stick out left side.
  return (
    <div className={`opp-holes side-${side}${folded ? ' folded' : ''}`}>
      <div className="mini-back" />
      <div className="mini-back" />
    </div>
  );
}

// -------- Seat badge --------
function SeatBadge({ kind, x, y }) {
  // kind: 'sb' | 'bb' | 'd'
  const label = kind === 'd' ? 'D' : kind.toUpperCase();
  return (
    <div className={`seat-badge ${kind}`} style={{ left: x, top: y }}>{label}</div>
  );
}

// -------- Bet chip indicator near seat --------
function BetChip({ x, y, amount, chip = 'blue-chip' }) {
  return (
    <div className="bet-chip" style={{ left: x, top: y }}>
      <img src={`assets/${chip}.png`} alt="" />
      <span className="v">${amount}</span>
    </div>
  );
}

// -------- Player seat (normal) --------
function PlayerSeat({ p, st, pos, showHoles, holesSide }) {
  const w = pos.w || 244;
  const h = pos.h || 84;
  const states = st.status === 'turn' ? 'state-active'
    : st.status === 'fold' ? 'state-folded'
    : st.status === 'allin' ? 'state-allin'
    : st.status === 'winner' ? 'state-winner'
    : st.status === 'sitout' ? 'state-sitout'
    : '';
  const statusText = ({
    turn: 'YOUR TURN', fold: 'FOLD', check: 'CHECK', call: `CALL${st.bet?` $${st.bet}`:''}`,
    raise: `RAISE TO $${st.bet||0}`, allin: 'ALL-IN', winner: 'WINNER', sitout: 'SITTING OUT', idle: '',
  })[st.status] || '';
  const statusCls = ({
    turn: 't-turn', fold: 't-fold', check: 't-check', call: 't-call', raise: 't-raise',
    allin: 't-allin', winner: 't-winner', sitout: 't-sitout', idle: 't-idle',
  })[st.status] || '';

  return (
    <div className={`seat ${states}`} style={{ left: pos.x, top: pos.y, width: w, height: h }}>
      {showHoles && <OppHoles side={holesSide || 'top'} folded={st.status === 'fold'} />}
      <div className="body">
        <div className="body-inner">
          <div className="name">{p.name}</div>
          <div className="stack">${p.stack.toFixed(2)}</div>
          <div className={`status ${statusCls}`}>{statusText}</div>
        </div>
        <div className="timer"><div className="bar" key={st.status + p.id} /></div>
      </div>
      <Avatar p={p} />
      {st.status === 'winner' && <div className="winner-tag">WINNER</div>}
    </div>
  );
}

// -------- Hero seat --------
function HeroSeat({ p, st, pos }) {
  const w = pos.w || 320;
  const h = pos.h || 110;
  const states = st.status === 'turn' ? 'state-active'
    : st.status === 'fold' ? 'state-folded'
    : st.status === 'allin' ? 'state-allin'
    : st.status === 'winner' ? 'state-winner'
    : '';
  const statusText = ({
    turn: 'YOUR TURN', fold: 'FOLD', check: 'CHECK', call: `CALL${st.bet?` $${st.bet}`:''}`,
    raise: `RAISE TO $${st.bet||0}`, allin: 'ALL-IN', winner: 'WINNER', idle: '',
  })[st.status] || '';
  const statusCls = ({
    turn: 't-turn', fold: 't-fold', check: 't-check', call: 't-call', raise: 't-raise',
    allin: 't-allin', winner: 't-winner', idle: 't-idle',
  })[st.status] || '';

  return (
    <div className={`seat hero ${states}`} style={{ left: pos.x, top: pos.y, width: w, height: h }}>
      <div className="body">
        <div className="body-inner">
          <div className="name">{p.name}</div>
          <div className="stack">${p.stack.toFixed(2)}</div>
          <div className={`status ${statusCls}`}>{statusText}</div>
        </div>
        <div className="timer"><div className="bar" key={st.status} /></div>
      </div>
      <Avatar p={p} ring="cyan" />
      {st.status === 'winner' && <div className="winner-tag">HAND WINNER</div>}
    </div>
  );
}

// -------- Pot display --------
function Pot({ amount, showChips = true }) {
  return (
    <div className="pot">
      <div className="lbl">Total Pot</div>
      <div className="amt">${amount.toFixed(2)}</div>
      {showChips && (
        <div className="chip-row">
          <img src="assets/green-chip.png" alt="" />
          <img src="assets/purple-chip.png" alt="" />
          <img src="assets/blue-chip.png" alt="" />
        </div>
      )}
    </div>
  );
}

// -------- Board cards (community) --------
// 5 fixed slots. Face-down backs for unrevealed.
function BoardCards({ cards, reveal }) {
  const slots = [0, 1, 2, 3, 4];
  return (
    <div className="board">
      {slots.map(i => {
        const c = cards[i];
        const open = i < reveal && c;
        return (
          <div className="board-slot" key={i}>
            {open
              ? <CardFace rank={c.r} suit={c.s} />
              : <div className="card-back board-back" />}
          </div>
        );
      })}
    </div>
  );
}

// -------- Hero hole cards --------
function HoleCards({ cards }) {
  return (
    <div className="hero-holes">
      {cards.map((c, i) => <CardFace key={i} rank={c.r} suit={c.s} />)}
    </div>
  );
}

Object.assign(window, {
  Avatar, CardFace, CardBack, OppHoles, SeatBadge, BetChip,
  PlayerSeat, HeroSeat, Pot, BoardCards, HoleCards,
});
