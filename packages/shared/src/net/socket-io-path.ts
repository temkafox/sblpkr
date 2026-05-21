/**
 * Socket.IO HTTP path (not blocked by most /socket.io/ adblock rules).
 * Must match @WebSocketGateway({ path }), client `io({ path })`, and nginx `location`.
 */
export const SOCKET_IO_PATH = '/np-io';
