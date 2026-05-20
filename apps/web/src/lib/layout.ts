/**
 * Seat geometry — ported from /design/data.jsx (pure math, stage coords).
 */

export type SeatDir =
  | 'down'
  | 'down-left'
  | 'down-right'
  | 'left'
  | 'right'
  | 'up'
  | 'up-left'
  | 'up-right';

export interface SeatPosition {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  hero: boolean;
  dir: SeatDir;
}

export type SeatCount = 2 | 4 | 6 | 9;

export const TABLE_CX = 860;
export const TABLE_CY = 460;
export const SEAT_RX = 560;
export const SEAT_RY = 305;

export const SEAT_W = 244;
export const SEAT_H = 84;
export const HERO_W = 320;
export const HERO_H = 110;

/** Polar angle (degrees): 0 = right, 90 = bottom, 180 = left, 270 = top → top-left seat box */
export function seatAt(angle: number, w: number, h: number, hero = false) {
  const a = (angle * Math.PI) / 180;
  const cx = TABLE_CX + Math.cos(a) * SEAT_RX;
  const cy = TABLE_CY + Math.sin(a) * SEAT_RY;
  return { x: Math.round(cx - w / 2), y: Math.round(cy - h / 2), w, h, hero };
}

export function angleDir(angle: number): SeatDir {
  const a = ((angle % 360) + 360) % 360;
  if (a >= 60 && a < 120) return 'down';
  if (a >= 120 && a < 165) return 'down-left';
  if (a >= 165 && a < 195) return 'left';
  if (a >= 195 && a < 240) return 'up-left';
  if (a >= 240 && a < 300) return 'up';
  if (a >= 300 && a < 345) return 'up-right';
  if (a >= 345 || a < 15) return 'right';
  return 'down-right';
}

export function evenAngles(n: number, heroAngle = 90) {
  const step = 360 / n;
  return Array.from({ length: n }, (_, i) => (heroAngle + i * step + 360) % 360);
}

export function makeLayout(idsByAngle: { id: string; angle: number; hero: boolean }[]): SeatPosition[] {
  return idsByAngle.map(({ id, angle, hero }) => {
    const s = seatAt(angle, hero ? HERO_W : SEAT_W, hero ? HERO_H : SEAT_H, hero);
    return { id, ...s, dir: hero ? 'down' : angleDir(angle) };
  });
}

export const LAYOUTS: Record<SeatCount, SeatPosition[]> = {
  9: makeLayout(
    evenAngles(9).map((angle, i) => ({
      id: i === 0 ? 'hero' : `p${i + 1}`,
      angle,
      hero: i === 0,
    })),
  ),
  6: makeLayout(
    evenAngles(6).map((angle, i) => ({
      id: i === 0 ? 'hero' : `p${i + 1}`,
      angle,
      hero: i === 0,
    })),
  ),
  4: makeLayout(
    evenAngles(4).map((angle, i) => ({
      id: i === 0 ? 'hero' : `p${i + 1}`,
      angle,
      hero: i === 0,
    })),
  ),
  2: makeLayout(
    evenAngles(2).map((angle, i) => ({
      id: i === 0 ? 'hero' : `p${i + 1}`,
      angle,
      hero: i === 0,
    })),
  ),
};

/** Hole cards always above seat — placeholder kept for parity with design/data.jsx */
export function holesSide(): 'top' {
  return 'top';
}

export function betOffset(dir: SeatDir, w = SEAT_W, h = SEAT_H): { dx: number; dy: number } {
  switch (dir) {
    case 'down':
    case 'down-left':
    case 'down-right':
      return { dx: w / 2 - 22, dy: -34 };
    case 'up':
    case 'up-left':
    case 'up-right':
      return { dx: w / 2 - 22, dy: h + 4 };
    case 'left':
      return { dx: w + 4, dy: (h - 28) / 2 };
    case 'right':
      return { dx: -76, dy: (h - 28) / 2 };
    default:
      return { dx: w / 2 - 22, dy: -34 };
  }
}

export function badgeOffset(dir: SeatDir, w = SEAT_W, h = SEAT_H): { dx: number; dy: number } {
  switch (dir) {
    case 'down':
    case 'down-left':
      return { dx: w - 22, dy: -14 };
    case 'down-right':
      return { dx: w - 22, dy: -14 };
    case 'up':
    case 'up-left':
      return { dx: w - 22, dy: h - 18 };
    case 'up-right':
      return { dx: w - 22, dy: h - 18 };
    case 'left':
      return { dx: w - 22, dy: h - 22 };
    case 'right':
      return { dx: -10, dy: h - 22 };
    default:
      return { dx: w / 2 - 16, dy: -16 };
  }
}
