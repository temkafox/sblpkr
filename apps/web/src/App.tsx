import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';

import { Background } from './components/layout/Background';
import { Logo } from './components/layout/Logo';
import { Stage } from './components/layout/Stage';
import { StageScaler } from './components/layout/StageScaler';
import { JoinRoomPage } from './pages/JoinRoomPage/JoinRoomPage';
import { TableRoute } from './routes/TableRoute';

export function AppRoutes() {
  return (
    <StageScaler>
      <Stage>
        <Background />
        <Logo />
        <Routes>
          <Route path="/" element={<Navigate to="/join" replace />} />
          <Route path="/join" element={<JoinRoomPage />} />
          <Route path="/room/:roomId" element={<JoinRoomPage />} />
          <Route path="/table/:roomId" element={<TableRoute />} />
          <Route path="*" element={<Navigate to="/join" replace />} />
        </Routes>
      </Stage>
    </StageScaler>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
