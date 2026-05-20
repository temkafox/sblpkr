/* global React, ReactDOM, window */
/* global PLAYERS, PlayerSeat, HeroSeat, OppHoles, SeatBadge, BetChip,
   CardFace, CardBack, Pot, BoardCards, HoleCards, BOARD_DEFAULT, HERO_HOLES */
// =====================================================
// NEONPOKER — UI Kit
// =====================================================

const { useState: useStateK } = React;

const playerById = id => PLAYERS.find(p => p.id === id);

function KitSection({ title, subtitle, children, height = 200 }) {
  return (
    <section className="kit-sec" style={{ minHeight: height }}>
      <header>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      <div className="kit-grid">{children}</div>
    </section>
  );
}

function KitCell({ label, w = 280, h = 130, children }) {
  return (
    <div className="kit-cell" style={{ width: w, height: h }}>
      <div className="kit-stage" style={{ width: w, height: h - 30 }}>
        {children}
      </div>
      <div className="kit-label">{label}</div>
    </div>
  );
}

// Wrapper to place an absolutely-positioned seat at (0,0) of its cell
function Stage({ width, height, children }) {
  return (
    <div className="kit-relstage" style={{ width, height, position: 'relative' }}>
      {children}
    </div>
  );
}

function SeatDemo({ id = 'p3', status = 'idle', bet = 0, label, w = 244, holes = false }) {
  const p = playerById(id);
  return (
    <KitCell label={label} w={w + 30} h={holes ? 200 : 120}>
      <Stage width={w + 30} height={holes ? 170 : 90}>
        <PlayerSeat
          p={p}
          st={{ status, bet, amount: '' }}
          pos={{ x: 0, y: holes ? 80 : 4, dir: 'down' }}
          showHoles={holes}
          holesSide="top"
        />
      </Stage>
    </KitCell>
  );
}

function HeroDemo({ status = 'turn', bet = 0, label }) {
  const p = playerById('hero');
  return (
    <KitCell label={label} w={340} h={140}>
      <Stage width={340} height={110}>
        <HeroSeat p={p} st={{ status, bet, amount: '' }} pos={{ x: 0, y: 0, dir: 'down' }} />
      </Stage>
    </KitCell>
  );
}

function BadgeDemo() {
  return (
    <KitCell label="Seat badges (SB / BB / Dealer)" w={260} h={120}>
      <Stage width={260} height={90}>
        <SeatBadge kind="sb" x={30}  y={28} />
        <SeatBadge kind="bb" x={100} y={28} />
        <SeatBadge kind="d"  x={170} y={28} />
      </Stage>
    </KitCell>
  );
}

function OppHolesDemo() {
  const p = playerById('p3');
  return (
    <KitCell label="Opponent + hidden cards (anchored)" w={300} h={200}>
      <Stage width={300} height={170}>
        <PlayerSeat
          p={p}
          st={{ status: 'idle', bet: 0, amount: '' }}
          pos={{ x: 28, y: 80, dir: 'down' }}
          showHoles={true}
          holesSide="top"
        />
      </Stage>
    </KitCell>
  );
}

function HeroHolesDemo() {
  const p = playerById('hero');
  return (
    <KitCell label="Hero seat with face-up cards" w={360} h={260}>
      <Stage width={360} height={230}>
        {/* face-up cards above the hero container */}
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
          st={{ status: 'turn', bet: 0, amount: '' }}
          pos={{ x: 18, y: 110, dir: 'down' }}
        />
      </Stage>
    </KitCell>
  );
}

function ChipDemo() {
  const chips = ['blue-chip', 'green-chip', 'purple-chip', 'pink-chip', 'bw-chip'];
  return (
    <KitCell label="Chip palette" w={340} h={120}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center', height: 90 }}>
        {chips.map(c => (
          <img key={c} src={`assets/${c}.png`} style={{ width: 44, height: 44, filter: 'drop-shadow(0 4px 8px rgba(0,0,0,.55))' }} />
        ))}
      </div>
    </KitCell>
  );
}

function CardKitDemo() {
  return (
    <KitCell label="Cards — face-up + back" w={420} h={170}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', justifyContent: 'center', height: 140 }}>
        <CardFace rank="A" suit="s" />
        <CardFace rank="K" suit="h" />
        <CardFace rank="Q" suit="d" />
        <CardFace rank="J" suit="c" />
        <div className="card-back" />
      </div>
    </KitCell>
  );
}

function BoardStateDemo({ label, reveal }) {
  return (
    <KitCell label={label} w={540} h={180}>
      <div style={{ position: 'relative', width: 500, height: 150 }}>
        <BoardCards cards={BOARD_DEFAULT} reveal={reveal} />
      </div>
    </KitCell>
  );
}

function BetChipDemo() {
  return (
    <KitCell label="Bet chip indicator" w={260} h={120}>
      <Stage width={260} height={90}>
        <BetChip x={50}  y={32} amount={5}   chip="blue-chip" />
        <BetChip x={140} y={32} amount={25}  chip="purple-chip" />
      </Stage>
    </KitCell>
  );
}

function ButtonKit() {
  return (
    <KitCell label="Action buttons" w={760} h={140}>
      <div style={{ display: 'flex', gap: 12, padding: 12, alignItems: 'stretch', height: 110 }}>
        <button className="btn fold">FOLD</button>
        <button className="btn check">CHECK</button>
        <button className="btn call">CALL <span className="sub">$10</span></button>
        <button className="btn raise">RAISE TO <span className="sub">$20</span></button>
      </div>
    </KitCell>
  );
}

function TokenSwatch({ name, hex, varName }) {
  return (
    <div className="token">
      <div className="swatch" style={{ background: hex, boxShadow: `0 0 14px ${hex}66, 0 0 30px ${hex}33` }} />
      <div className="token-meta">
        <div className="token-name">{name}</div>
        <div className="token-hex">{hex}</div>
        <div className="token-var">{varName}</div>
      </div>
    </div>
  );
}

function ColorTokens() {
  const tokens = [
    { name: 'Neon Cyan',    hex: '#22d3ff', varName: '--neon-cyan' },
    { name: 'Neon Blue',    hex: '#2a6fff', varName: '--neon-blue' },
    { name: 'Neon Violet',  hex: '#8b5cff', varName: '--neon-violet' },
    { name: 'Neon Magenta', hex: '#ff3df0', varName: '--neon-magenta' },
    { name: 'Neon Pink',    hex: '#ff4d8a', varName: '--neon-pink' },
    { name: 'Neon Green',   hex: '#2bff9b', varName: '--neon-green' },
    { name: 'Neon Amber',   hex: '#ffb43d', varName: '--neon-amber' },
    { name: 'BG 0',         hex: '#05030d', varName: '--bg-0' },
    { name: 'BG 2',         hex: '#110a22', varName: '--bg-2' },
  ];
  return (
    <div className="kit-grid">
      {tokens.map(t => <TokenSwatch key={t.name} {...t} />)}
    </div>
  );
}

function TypeTokens() {
  return (
    <div className="type-tokens">
      <div className="type-row">
        <div className="type-sample" style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 800, letterSpacing: '.18em' }}>NEONPOKER</div>
        <div className="type-meta"><b>Display</b> · Orbitron · 800 · uppercase</div>
      </div>
      <div className="type-row">
        <div className="type-sample" style={{ fontFamily: 'var(--font-ui)', fontSize: 22, fontWeight: 600 }}>NeonRider</div>
        <div className="type-meta"><b>UI</b> · Rajdhani · 600 · names</div>
      </div>
      <div className="type-row">
        <div className="type-sample" style={{ fontFamily: 'var(--font-num)', fontSize: 24, fontWeight: 700 }}>$412.75</div>
        <div className="type-meta"><b>Numeric</b> · JetBrains Mono · 700 · stacks & amounts</div>
      </div>
      <div className="type-row">
        <div className="type-sample" style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '.26em', color: 'var(--neon-cyan)' }}>YOUR TURN</div>
        <div className="type-meta"><b>Status</b> · Orbitron · 600 · 0.26em tracking</div>
      </div>
    </div>
  );
}

function Kit() {
  return (
    <div className="kit-root">
      <header className="kit-hero">
        <div className="kit-logo">
          <div className="mark">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2 L20 9 L17 22 L7 22 L4 9 Z" fill="#1a0028" stroke="white" strokeWidth="1.2"/>
              <circle cx="12" cy="13" r="3" fill="white" opacity=".9"/>
            </svg>
          </div>
          <div className="word">
            <div className="l1">NEON<span style={{ color: '#22d3ff' }}>POKER</span></div>
            <div className="l2">UI KIT · v1.0</div>
          </div>
        </div>
        <div className="kit-meta">
          <span>Desktop 1920×1080</span>
          <span className="dot">●</span>
          <span>React + TypeScript</span>
          <span className="dot">●</span>
          <span>NL Hold'em</span>
        </div>
      </header>

      <KitSection title="Player Seat — Opponent" subtitle="Glass pill with overlapping circular avatar. Cyan/magenta accents. Active opponents show 2 face-down hole cards above the seat.">
        <SeatDemo id="p3" status="idle"   holes label="Default + hidden cards" />
        <SeatDemo id="p4" status="turn"   holes label="Active turn (animated)" />
        <SeatDemo id="p5" status="check"  holes label="Check" />
        <SeatDemo id="p7" status="call"   bet={10} holes label="Call $10" />
        <SeatDemo id="p4" status="raise"  bet={40} holes label="Raise to $40" />
        <SeatDemo id="p2" status="fold"   label="Fold (muted, readable)" />
        <SeatDemo id="p9" status="allin"  bet={154.8} holes label="All-in" />
        <SeatDemo id="p6" status="winner" holes label="Winner" />
        <SeatDemo id="p8" status="sitout" label="Sitting out" />
      </KitSection>

      <KitSection title="Hero Seat — Current Player" subtitle="Larger variant. Cyan glow. Bottom-center anchor.">
        <HeroDemo status="turn"   label="Active — YOUR TURN" />
        <HeroDemo status="call"   bet={10} label="Call $10" />
        <HeroDemo status="raise"  bet={40} label="Raise to $40" />
        <HeroDemo status="allin"  bet={412.75} label="All-in" />
        <HeroDemo status="winner" label="Hand winner" />
        <HeroDemo status="fold"   label="Fold" />
      </KitSection>

      <KitSection title="Board Cards — Street Reveal" subtitle="5 fixed slots always present. Unrevealed cards remain face-down. Pre-flop → Flop → Turn → River.">
        <BoardStateDemo label="PRE-FLOP · 0 revealed"  reveal={0} />
        <BoardStateDemo label="FLOP · 3 revealed"      reveal={3} />
        <BoardStateDemo label="TURN · 4 revealed"      reveal={4} />
        <BoardStateDemo label="RIVER · 5 revealed"     reveal={5} />
      </KitSection>

      <KitSection title="Cards & Backs">
        <CardKitDemo />
        <OppHolesDemo />
        <HeroHolesDemo />
      </KitSection>

      <KitSection title="Badges & Bets">
        <BadgeDemo />
        <BetChipDemo />
        <ChipDemo />
      </KitSection>

      <KitSection title="Action Buttons" subtitle="Fold (danger pink), Check (green), Call (cyan), Raise (violet/magenta).">
        <ButtonKit />
      </KitSection>

      <KitSection title="Color Tokens" subtitle="Neon accents share chroma; surfaces near-black with subtle violet warmth.">
        <ColorTokens />
      </KitSection>

      <KitSection title="Type System" subtitle="Three families: Orbitron display, Rajdhani UI, JetBrains Mono numerics.">
        <TypeTokens />
      </KitSection>

      <footer className="kit-foot">
        <span>NEONPOKER · Texas Hold'em UI Kit</span>
        <span>All dynamic text is editable UI text · No baked-in numbers</span>
      </footer>
    </div>
  );
}

const rootEl = document.getElementById('root');
ReactDOM.createRoot(rootEl).render(<Kit />);
