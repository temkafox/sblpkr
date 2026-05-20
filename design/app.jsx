/* global React, ReactDOM, window */
/* global PLAYERS, DEFAULT_STATES, BOARD_DEFAULT, HERO_HOLES, LAYOUTS,
   holeOffset, betOffset, badgeOffset,
   PlayerSeat, HeroSeat, OppHoles, SeatBadge, BetChip,
   Pot, BoardCards, HoleCards,
   RightSidebar, ActionBar,
   TweaksPanel, useTweaks, TweakSection, TweakRadio, TweakSlider, TweakToggle, TweakSelect */

// =====================================================
// NEONPOKER — Main App
// =====================================================

const { useState, useEffect, useMemo, useRef } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "seats": 9,
  "reveal": 5,
  "potAmount": 34.5,
  "heroStatus": "turn",
  "showBets": true,
  "showBadges": true,
  "showOppHoles": true,
  "showHeroHoles": true
}/*EDITMODE-END*/;

// Read URL params for clean exports (?seats=2|4|6|9)
function urlOverrides() {
  const u = new URLSearchParams(window.location.search);
  const o = {};
  const s = parseInt(u.get('seats'), 10);
  if ([2, 4, 6, 9].includes(s)) o.seats = s;
  return o;
}

// Seat states demonstrated across the table.
// We build a status map by seat-position index in the active layout,
// so a 2-player table still shows hero idle + 1 active opponent, etc.
function buildStates(seats, heroStatus) {
  const palette = ['fold', 'call', 'raise', 'check', 'fold', 'allin', 'check', 'fold'];
  const states = { hero: { status: heroStatus, bet: 0, amount: '' } };
  const layout = LAYOUTS[seats];
  let i = 0;
  for (const pos of layout) {
    if (pos.id === 'hero') continue;
    let s = palette[i % palette.length];
    let bet = 0;
    if (s === 'call')   bet = 10;
    if (s === 'raise')  bet = 10;
    if (s === 'allin')  bet = 154.8;
    if (seats === 2) { s = 'raise'; bet = 10; }
    states[pos.id] = { status: s, bet, amount: '' };
    i++;
  }
  return states;
}

// Pick chip color for a bet amount
function chipFor(amount) {
  if (amount >= 100) return 'pink-chip';
  if (amount >= 25)  return 'purple-chip';
  if (amount >= 10)  return 'green-chip';
  if (amount >= 5)   return 'blue-chip';
  return 'bw-chip';
}

// Resolve a player record by id
const playerById = id => PLAYERS.find(p => p.id === id);

function App() {
  const [t, setTweak] = useTweaks({ ...TWEAK_DEFAULTS, ...urlOverrides() });

  const seats = parseInt(t.seats, 10);
  const layout = LAYOUTS[seats] || LAYOUTS[9];
  const states = useMemo(() => buildStates(seats, t.heroStatus), [seats, t.heroStatus]);

  // Determine dealer/SB/BB across the layout — anchored to hero at 0
  // For 2-player: hero=SB+D, opponent=BB
  // For others: hero=D (button), next clockwise=SB, then BB
  const buttonIdx = 0;
  const sbIdx = seats === 2 ? 0 : (1 % layout.length);
  const bbIdx = seats === 2 ? 1 : (2 % layout.length);
  const dIdx  = buttonIdx;

  return (
    <div className="stage" data-screen-label="01 Table">
      <div className="app-bg" />

      {/* Logo */}
      <div className="logo">
        <div className="mark">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M12 2 L20 9 L17 22 L7 22 L4 9 Z" fill="#1a0028" stroke="white" strokeWidth="1.2"/>
            <circle cx="12" cy="13" r="3" fill="white" opacity=".9"/>
          </svg>
        </div>
        <div className="word">
          <div className="l1">NEON<span style={{ color: '#22d3ff' }}>POKER</span></div>
          <div className="l2">DESKTOP · NL HOLD'EM</div>
        </div>
      </div>

      {/* Kit link */}
      <a className="kit-link" href="NEONPOKER UI Kit.html">UI KIT →</a>

      {/* Table */}
      <div className="table-wrap">
        <div className="table-img" />
        <div className="felt-mark">NEONPOKER</div>
      </div>

      {/* Pot */}
      <Pot amount={parseFloat(t.potAmount)} showChips={t.reveal >= 3} />

      {/* Board */}
      <BoardCards cards={BOARD_DEFAULT} reveal={parseInt(t.reveal, 10)} />

      {/* Hero hole cards (above hero seat) */}
      {t.showHeroHoles && <HoleCards cards={HERO_HOLES} />}

      {/* Seats */}
      {layout.map((pos, i) => {
        const p = playerById(pos.id);
        const st = states[pos.id] || { status: 'idle', bet: 0 };
        const w = pos.w || 244, h = pos.h || 84;

        // Opp holes (only for non-hero, non-folded, non-sitout)
        const showOpp = !pos.hero && t.showOppHoles && st.status !== 'sitout';
        // Bet chips
        const showBet = t.showBets && st.bet > 0;
        const bo = betOffset(pos.dir, w, h);
        // Badges
        let badge = null;
        if (t.showBadges) {
          if (i === dIdx)  badge = 'd';
          if (i === sbIdx && seats !== 2) badge = 'sb';
          if (i === bbIdx) badge = 'bb';
          if (seats === 2 && i === 0) badge = 'd';
        }
        const bo2 = badgeOffset(pos.dir, w, h);

        return (
          <React.Fragment key={pos.id}>
            {pos.hero
              ? <HeroSeat p={p} st={st} pos={pos} />
              : <PlayerSeat
                  p={p} st={st} pos={pos}
                  showHoles={showOpp}
                  holesSide={holesSide(pos.dir)}
                />}

            {badge && (
              <SeatBadge kind={badge} x={pos.x + bo2.dx} y={pos.y + bo2.dy} />
            )}
            {showBet && (
              <BetChip x={pos.x + bo.dx} y={pos.y + bo.dy} amount={st.bet} chip={chipFor(st.bet)} />
            )}
          </React.Fragment>
        );
      })}

      {/* Right sidebar */}
      <RightSidebar playerCount={seats} maxSeats={9} />

      {/* Action bar */}
      <ActionBar
        potAmount={parseFloat(t.potAmount)}
        toCall={10}
        minRaise={20}
        maxRaise={412.75}
        canCheck={false}
      />

      {/* Tweaks */}
      <TweaksPanel title="Tweaks">
        <TweakSection label="Table">
          <TweakRadio
            label="Players"
            value={String(seats)}
            options={[
              { value: '2', label: '2' },
              { value: '4', label: '4' },
              { value: '6', label: '6' },
              { value: '9', label: '9' },
            ]}
            onChange={v => setTweak('seats', parseInt(v, 10))}
          />
          <TweakSelect
            label="Board reveal"
            value={String(t.reveal)}
            options={[
              { value: '0', label: 'Pre-flop (0)' },
              { value: '3', label: 'Flop (3)' },
              { value: '4', label: 'Turn (4)' },
              { value: '5', label: 'River (5)' },
            ]}
            onChange={v => setTweak('reveal', parseInt(v, 10))}
          />
          <TweakSlider
            label="Pot"
            value={parseFloat(t.potAmount)}
            min={0} max={1000} step={0.5}
            onChange={v => setTweak('potAmount', v)}
          />
        </TweakSection>
        <TweakSection label="Hero state">
          <TweakSelect
            label="Hero status"
            value={t.heroStatus}
            options={[
              { value: 'turn',   label: 'Your turn (active)' },
              { value: 'check',  label: 'Check' },
              { value: 'call',   label: 'Call' },
              { value: 'raise',  label: 'Raise' },
              { value: 'fold',   label: 'Fold' },
              { value: 'allin',  label: 'All-in' },
              { value: 'winner', label: 'Winner' },
              { value: 'idle',   label: 'Idle' },
            ]}
            onChange={v => setTweak('heroStatus', v)}
          />
        </TweakSection>
        <TweakSection label="Overlays">
          <TweakToggle label="Show bet chips"  value={!!t.showBets}     onChange={v => setTweak('showBets', v)} />
          <TweakToggle label="Show SB/BB/D"     value={!!t.showBadges}   onChange={v => setTweak('showBadges', v)} />
          <TweakToggle label="Show opp hole cards" value={!!t.showOppHoles} onChange={v => setTweak('showOppHoles', v)} />
          <TweakToggle label="Show hero hole cards" value={!!t.showHeroHoles} onChange={v => setTweak('showHeroHoles', v)} />
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// =====================================================
// Stage scaling — 1920x1080 letterboxed into viewport
// =====================================================
function useStageScale() {
  const ref = useRef(null);
  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth, h = window.innerHeight;
      const s = Math.min(w / 1920, h / 1080);
      if (ref.current) ref.current.style.transform = `translate(-50%, -50%) scale(${s})`;
    };
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return ref;
}

function Root() {
  const stageRef = useStageScale();
  return (
    <div className="stage-wrap">
      <div ref={stageRef} className="stage-scaler">
        <App />
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<Root />);
