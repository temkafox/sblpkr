/** Phase 0 health probe — kept for existing apps until a dedicated health DTO ships. */

export type HealthStatus = 'ok';

export * from './protocol';

export * from './types/card';
export * from './types/player';
export * from './types/pot';
export * from './types/action';
export * from './types/chat';
export * from './types/game-state';
export * from './types/hand-history';
export * from './types/room';

export * from './events/socket-events';

export * from './dto/room.dto';
export * from './dto/action.dto';
export * from './dto/chat.dto';
export * from './dto/error.dto';
