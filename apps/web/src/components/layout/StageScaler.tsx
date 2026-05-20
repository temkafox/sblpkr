import { useEffect, useRef, type ReactNode } from 'react';

const STAGE_WIDTH = 1920;
const STAGE_HEIGHT = 1080;

export function StageScaler({ children }: { children: ReactNode }) {
  const scalerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fit = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const scale = Math.min(w / STAGE_WIDTH, h / STAGE_HEIGHT);
      const el = scalerRef.current;
      if (el) {
        el.style.transform = `translate(-50%, -50%) scale(${scale})`;
      }
    };

    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  return (
    <div className="stage-wrap">
      <div ref={scalerRef} className="stage-scaler">
        {children}
      </div>
    </div>
  );
}
