/** Typed failures for poker-core transitions — Phase 4A subset. */

export class PokerCoreError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PokerCoreError';
  }
}

export class InvalidTableStateError extends PokerCoreError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidTableStateError';
  }
}

export class NotEnoughPlayersError extends PokerCoreError {
  constructor(message: string) {
    super(message);
    this.name = 'NotEnoughPlayersError';
  }
}

export class SeatNotFoundError extends PokerCoreError {
  constructor(message: string) {
    super(message);
    this.name = 'SeatNotFoundError';
  }
}
