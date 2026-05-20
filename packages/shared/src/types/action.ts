/** Intent kinds the client may emit — server validates against available actions. */

export type ActionKind = 'fold' | 'check' | 'call' | 'raise' | 'allin';

export type FoldAction = {
  readonly kind: 'fold';
};

export type CheckAction = {
  readonly kind: 'check';
};

export type CallAction = {
  readonly kind: 'call';
};

export type RaiseAction = {
  readonly kind: 'raise';
  readonly amount: number;
};

export type AllInAction = {
  readonly kind: 'allin';
};

export type PlayerAction =
  | FoldAction
  | CheckAction
  | CallAction
  | RaiseAction
  | AllInAction;
