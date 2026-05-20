import { Background } from './components/layout/Background';
import { Logo } from './components/layout/Logo';
import { Stage } from './components/layout/Stage';
import { StageScaler } from './components/layout/StageScaler';

export function App() {
  return (
    <StageScaler>
      <Stage>
        <Background />
        <Logo />
        <div className="phase1a-placeholder">
          <div>Phase 1A UI foundation ready</div>
        </div>
      </Stage>
    </StageScaler>
  );
}
