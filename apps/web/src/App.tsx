import { Background } from './components/layout/Background';
import { Logo } from './components/layout/Logo';
import { Stage } from './components/layout/Stage';
import { StageScaler } from './components/layout/StageScaler';
import { TablePage } from './pages/TablePage/TablePage';

export function App() {
  return (
    <StageScaler>
      <Stage>
        <Background />
        <Logo />
        <TablePage />
      </Stage>
    </StageScaler>
  );
}
