import type { ReactNode } from 'react';

export function Stage({ children }: { children: ReactNode }) {
  return <div className="stage">{children}</div>;
}
