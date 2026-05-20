/* global window */
// =====================================================
// NEONPOKER — Mock data
// =====================================================

// Avatar = neon gradient + initial. Distinct per player.
const PLAYERS = [
  { id: 'hero',     name: 'NeonRider',   stack: 412.75, ring: 'cyan',    init: 'N',  avatar: 'assets/avatar-1.png' },
  { id: 'p2',       name: 'SynthWave',   stack: 175.60, ring: 'pink',    init: 'S',  avatar: null },
  { id: 'p3',       name: 'BluffZilla',  stack: 305.75, ring: 'magenta', init: 'B',  avatar: 'assets/avatar-2.png' },
  { id: 'p4',       name: 'StackMaster', stack: 412.00, ring: 'magenta', init: 'M',  avatar: null },
  { id: 'p5',       name: 'CyberKing',   stack: 238.50, ring: 'green',   init: 'C',  avatar: 'assets/avatar-3.png' },
  { id: 'p6',       name: 'LunaLove',    stack: 199.50, ring: 'pink',    init: 'L',  avatar: 'assets/avatar-2.png' },
  { id: 'p7',       name: 'NightShade',  stack: 187.00, ring: 'violet',  init: 'NS', avatar: 'assets/avatar-3.png' },
  { id: 'p8',       name: 'QuickSilver', stack: 154.80, ring: 'cyan',    init: 'Q',  avatar: null },
  { id: 'p9',       name: 'DataWraith',  stack: 221.30, ring: 'violet',  init: 'D',  avatar: 'assets/avatar-1.png' },
];

// Player states keyed by id. status: 'turn' | 'fold' | 'check' | 'call' | 'raise' | 'allin' | 'winner' | 'sitout' | 'idle'
const DEFAULT_STATES = {
  hero: { status: 'turn',  bet: 0,  amount: '' },
  p2:   { status: 'fold',  bet: 0,  amount: '' },
  p3:   { status: 'call',  bet: 10, amount: 10 },
  p4:   { status: 'raise', bet: 10, amount: 10 },
  p5:   { status: 'check', bet: 0,  amount: '' },
  p6:   { status: 'fold',  bet: 0,  amount: '' },
  p7:   { status: 'fold',  bet: 0,  amount: '' },
  p8:   { status: 'fold',  bet: 0,  amount: '' },
  p9:   { status: 'check', bet: 0,  amount: '' },
};

// Hand history sample
const HAND_HISTORY = [
  { street: 'PRE-FLOP', rows: [
    { name: 'StackMaster', cls: 'n-m', act: 'Raise to $6' },
    { name: 'BluffZilla',  cls: 'n-c', act: 'Call $6' },
    { name: 'NeonRider',   cls: 'n-c', act: 'Call $6' },
    { name: 'CyberKing',   cls: 'n-h', act: 'Call $6' },
    { name: 'LunaLove',    cls: 'n-p', act: 'Fold' },
    { name: 'NightShade',  cls: 'n-p', act: 'Fold' },
    { name: 'QuickSilver', cls: 'n-p', act: 'Fold' },
    { name: 'DataWraith',  cls: 'n-p', act: 'Fold' },
    { name: 'SynthWave',   cls: 'n-p', act: 'Fold' },
  ]},
  { street: 'FLOP', rows: [
    { name: 'StackMaster', cls: 'n-m', act: 'Bet $10' },
    { name: 'BluffZilla',  cls: 'n-c', act: 'Call $10' },
    { name: 'NeonRider',   cls: 'n-c', act: 'Call $10' },
    { name: 'CyberKing',   cls: 'n-h', act: 'Check' },
  ]},
  { street: 'TURN', rows: [
    { name: 'StackMaster', cls: 'n-m', act: 'Check' },
    { name: 'BluffZilla',  cls: 'n-c', act: 'Check' },
    { name: 'NeonRider',   cls: 'n-c', act: 'Check' },
    { name: 'CyberKing',   cls: 'n-h', act: 'Check' },
  ]},
];

const CHAT_MESSAGES = [
  { who: 'StackMaster', cls: 'n-m', msg: 'Nice hand!' },
  { who: 'BluffZilla',  cls: 'n-c', msg: 'Thanks! GL all' },
  { who: 'CyberKing',   cls: 'n-c', msg: "Let's goooo 🔥" },
  { who: 'NeonRider',   cls: 'n-c', msg: '😎 😎' },
  { who: 'LunaLove',    cls: 'n-p', msg: 'Good luck everyone!' },
];

// Board cards
const BOARD_DEFAULT = [
  { r: '10', s: 'h' },
  { r: 'J',  s: 'c' },
  { r: 'Q',  s: 'd' },
  { r: '2',  s: 's' },
  { r: '7',  s: 'h' },
];

// Hero hole cards
const HERO_HOLES = [
  { r: 'A', s: 's' },
  { r: 'K', s: 'h' },
];

// Seat positions for each layout (from the brief)
// Each entry: { id from PLAYERS, x, y, hero?, w?, h? }
// ---- Mathematically structured seat placement on the oval contour ----
// Table runs from (170, 115) to (1550, 805) — center (860, 460), radii (~620, 305)
// Seats are distributed evenly along an outer ellipse whose center matches the table.
// Hero is always at the bottom anchor (angle = 90deg in CSS-y terms).
// For each player count, we choose angles that are symmetric across the y-axis
// and give visually-balanced spacing along the perimeter.
const TABLE_CX = 860;
const TABLE_CY = 460;
// Placement ellipse — just inside the visible table rail so seats look
// like chairs around the table, not stranded on the felt or the bg.
const SEAT_RX  = 560;
const SEAT_RY  = 305;

// Standard seat & hero box sizes
const SEAT_W   = 244;
const SEAT_H   = 84;
const HERO_W   = 320;
const HERO_H   = 110;

// Polar angle (degrees, CSS-y: 0=right, 90=bottom, 180=left, 270=top)
// → x/y top-left for a seat box of given (w,h)
function seatAt(angle, w, h, hero = false) {
  const a = (angle * Math.PI) / 180;
  const cx = TABLE_CX + Math.cos(a) * SEAT_RX;
  const cy = TABLE_CY + Math.sin(a) * SEAT_RY;
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h, hero };
}

// Pick the direction tag from the angle (for hole-card side resolution)
function angleDir(angle) {
  // normalize to 0..360
  const a = ((angle % 360) + 360) % 360;
  if (a >= 60  && a < 120) return 'down';
  if (a >= 120 && a < 165) return 'down-left';
  if (a >= 165 && a < 195) return 'left';
  if (a >= 195 && a < 240) return 'up-left';
  if (a >= 240 && a < 300) return 'up';
  if (a >= 300 && a < 345) return 'up-right';
  if (a >= 345 || a < 15)  return 'right';
  return 'down-right';
}

// Each layout: ids in order + the angle slot they occupy.
// Hero is always at angle 90 (bottom-center).
function makeLayout(idsByAngle) {
  return idsByAngle.map(({ id, angle, hero }) => {
    const s = seatAt(angle, hero ? HERO_W : SEAT_W, hero ? HERO_H : SEAT_H, hero);
    return { id, ...s, dir: hero ? 'down' : angleDir(angle) };
  });
}

// Each player count uses perfectly even angular spacing (360/n) starting
// at the hero anchor (90° = bottom-center). This guarantees symmetric,
// mathematically structured distribution along the oval contour.
function evenAngles(n, heroAngle = 90) {
  const step = 360 / n;
  return Array.from({ length: n }, (_, i) => (heroAngle + i * step + 360) % 360);
}

const LAYOUTS = {
  9: makeLayout(
    evenAngles(9).map((angle, i) => ({
      id: i === 0 ? 'hero' : `p${i + 1}`, angle, hero: i === 0,
    }))
  ),
  6: makeLayout(
    evenAngles(6).map((angle, i) => ({
      id: i === 0 ? 'hero' : `p${i + 1}`, angle, hero: i === 0,
    }))
  ),
  4: makeLayout(
    evenAngles(4).map((angle, i) => ({
      id: i === 0 ? 'hero' : `p${i + 1}`, angle, hero: i === 0,
    }))
  ),
  2: makeLayout(
    evenAngles(2).map((angle, i) => ({
      id: i === 0 ? 'hero' : `p${i + 1}`, angle, hero: i === 0,
    }))
  ),
};

// Hidden cards always sit ABOVE the seat container, regardless of where
// the seat is on the table. Kept as a helper for forward compatibility.
function holesSide() { return 'top'; }

// Bet chip indicator offsets — toward the table center
function betOffset(dir, w=244, h=84) {
  switch (dir) {
    case 'down':
    case 'down-left':
    case 'down-right': return { dx: w/2 - 22, dy: -34 };
    case 'up':
    case 'up-left':
    case 'up-right':   return { dx: w/2 - 22, dy: h + 4 };
    case 'left':       return { dx: w + 4,    dy: (h - 28)/2 };
    case 'right':      return { dx: -76,      dy: (h - 28)/2 };
    default:           return { dx: w/2-22, dy: -34 };
  }
}

// Badge offsets (SB / BB / D) — hover near the avatar end of the seat
function badgeOffset(dir, w=244, h=84) {
  // Place badges between seat and felt center; near the avatar for left-side seats,
  // opposite end for right-side seats so they don't overlap the portrait.
  switch (dir) {
    case 'down':
    case 'down-left':  return { dx: w - 22, dy: -14 };          // upper-right of seat
    case 'down-right': return { dx: w - 22, dy: -14 };
    case 'up':
    case 'up-left':    return { dx: w - 22, dy: h - 18 };       // lower-right of seat
    case 'up-right':   return { dx: w - 22, dy: h - 18 };
    case 'left':       return { dx: w - 22, dy: h - 22 };       // bottom-right of seat (toward felt)
    case 'right':      return { dx: -10,    dy: h - 22 };       // bottom-left of seat
    default:           return { dx: w/2-16, dy: -16 };
  }
}

Object.assign(window, {
  PLAYERS, DEFAULT_STATES, HAND_HISTORY, CHAT_MESSAGES,
  BOARD_DEFAULT, HERO_HOLES, LAYOUTS, holesSide, betOffset, badgeOffset,
});
