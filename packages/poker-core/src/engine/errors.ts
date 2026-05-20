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

export class InvalidActionError extends PokerCoreError {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidActionError';
  }
}

export class OutOfTurnError extends PokerCoreError {
  constructor(message: string) {
    super(message);
    this.name = 'OutOfTurnError';
  }
}

export class CannotCheckError extends PokerCoreError {
  constructor(message: string) {
    super(message);
    this.name = 'CannotCheckError';
  }
}

export class CannotCallError extends PokerCoreError {
  constructor(message: string) {
    super(message);
    this.name = 'CannotCallError';
  }
}

export class CannotRaiseError extends PokerCoreError {
  constructor(message: string) {
    super(message);
    this.name = 'CannotRaiseError';
  }
}

export class InsufficientChipsError extends PokerCoreError {
  constructor(message: string) {
    super(message);
    this.name = 'InsufficientChipsError';
  }
}
