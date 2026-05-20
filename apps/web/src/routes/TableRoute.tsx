import { Navigate, useParams } from 'react-router-dom';

import { TablePage } from '../pages/TablePage/TablePage';
import { useSessionStore } from '../state/sessionStore';

/** Requires a trimmed nickname in local session for Phase 1D guard (no backend). */
export function TableRoute() {
  const { roomId } = useParams<{ roomId: string }>();
  const nickname = useSessionStore((s) => s.nickname);

  if (!roomId) {
    return <Navigate to="/join" replace />;
  }

  const nickOk = nickname != null && nickname.trim().length > 0;
  if (!nickOk) {
    return <Navigate to={`/room/${encodeURIComponent(roomId)}`} replace />;
  }

  return <TablePage />;
}
