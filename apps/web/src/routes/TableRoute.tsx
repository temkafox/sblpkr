import { useEffect } from 'react';
import { Navigate, useParams } from 'react-router-dom';

import { TablePage } from '../pages/TablePage/TablePage';
import { establishRoomSession } from '../net/roomSession';
import { useRoomStore } from '../state/roomStore';
import { useSessionStore } from '../state/sessionStore';

const reconnectKeys = new Set<string>();

/** Clears reconnect dedupe state between tests. */
export function clearTableRouteReconnectKeysForTests(): void {
  reconnectKeys.clear();
}

/** Requires nickname in session; reconnects socket room membership once per visit. */
export function TableRoute() {
  const { roomId } = useParams<{ roomId: string }>();
  const nickname = useSessionStore((s) => s.nickname);

  useEffect(() => {
    const nick = nickname?.trim();
    if (!roomId || !nick) return;

    const reconnectKey = `${roomId}:${nick}`;
    if (reconnectKeys.has(reconnectKey)) return;

    const session = useSessionStore.getState();
    const room = useRoomStore.getState().roomState;
    if (
      session.connectionStatus === 'connected' &&
      room?.roomId === roomId
    ) {
      return;
    }

    reconnectKeys.add(reconnectKey);

    void establishRoomSession(nick, roomId).catch(() => {
      /* errors surface via roomStore; table keeps static mock UI */
    });
  }, [roomId, nickname]);

  if (!roomId) {
    return <Navigate to="/join" replace />;
  }

  const nickOk = nickname != null && nickname.trim().length > 0;
  if (!nickOk) {
    return <Navigate to={`/room/${encodeURIComponent(roomId)}`} replace />;
  }

  return <TablePage />;
}
