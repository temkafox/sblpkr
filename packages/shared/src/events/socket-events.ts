/** Socket.IO event names — stable string constants only (no runtime registry). */

export const CLIENT_REGISTER_NICKNAME = 'CLIENT_REGISTER_NICKNAME' as const;
export const CLIENT_JOIN_ROOM = 'CLIENT_JOIN_ROOM' as const;
export const CLIENT_LEAVE_ROOM = 'CLIENT_LEAVE_ROOM' as const;
export const CLIENT_START_HAND = 'CLIENT_START_HAND' as const;
export const CLIENT_PLAYER_ACTION = 'CLIENT_PLAYER_ACTION' as const;
export const CLIENT_CHAT_MESSAGE = 'CLIENT_CHAT_MESSAGE' as const;
export const CLIENT_REQUEST_GAME_STATE = 'CLIENT_REQUEST_GAME_STATE' as const;
export const CLIENT_REBUY = 'CLIENT_REBUY' as const;

export const SERVER_ROOM_STATE = 'SERVER_ROOM_STATE' as const;
export const SERVER_GAME_STATE = 'SERVER_GAME_STATE' as const;
export const SERVER_AVAILABLE_ACTIONS = 'SERVER_AVAILABLE_ACTIONS' as const;
export const SERVER_HAND_HISTORY = 'SERVER_HAND_HISTORY' as const;
export const SERVER_CHAT_MESSAGE = 'SERVER_CHAT_MESSAGE' as const;
export const SERVER_HAND_RESULT = 'SERVER_HAND_RESULT' as const;
export const SERVER_ERROR = 'SERVER_ERROR' as const;
export const SERVER_REBUY_CONFIRMED = 'SERVER_REBUY_CONFIRMED' as const;

/** Convenience map for diagnostics/tests — values mirror the exported constants. */

export const SOCKET_EVENTS = {
  CLIENT_REGISTER_NICKNAME,
  CLIENT_JOIN_ROOM,
  CLIENT_LEAVE_ROOM,
  CLIENT_START_HAND,
  CLIENT_PLAYER_ACTION,
  CLIENT_CHAT_MESSAGE,
  CLIENT_REQUEST_GAME_STATE,
  CLIENT_REBUY,
  SERVER_ROOM_STATE,
  SERVER_GAME_STATE,
  SERVER_AVAILABLE_ACTIONS,
  SERVER_HAND_HISTORY,
  SERVER_CHAT_MESSAGE,
  SERVER_HAND_RESULT,
  SERVER_ERROR,
  SERVER_REBUY_CONFIRMED,
} as const;

export type SocketEventName = (typeof SOCKET_EVENTS)[keyof typeof SOCKET_EVENTS];
