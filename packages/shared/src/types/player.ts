/** Seat index within the ring layout `0 .. maxSeats-1` (server-authoritative). */

export type SeatIndex = number;

/** Stable player identity issued by the server (opaque string). */

export type PlayerId = string;

/** Neon avatar ring accent — mirrors sidebar/seat styling tokens. */

export type RingColor =
  | 'cyan'
  | 'pink'
  | 'magenta'
  | 'violet'
  | 'green'
  | 'amber';

export type Player = {
  readonly id: PlayerId;
  readonly name: string;
  readonly stack: number;
  readonly ring: RingColor;
  /** 1–2 character initials fallback inside avatar */
  readonly init: string;
  /** Avatar URL or preset key — transport stays string | null */
  readonly avatar: string | null;
};
