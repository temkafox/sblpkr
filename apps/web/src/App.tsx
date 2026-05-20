import type { HealthStatus } from '@neonpoker/shared';

const health: HealthStatus = 'ok';

export function App() {
  return (
    <main
      style={{
        margin: 0,
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        fontFamily: 'system-ui, sans-serif',
        background: '#0a061a',
        color: '#22d3ff',
      }}
    >
      <h1>NEONPOKER Web</h1>
      <p style={{ color: '#7a6fa3', fontSize: '0.875rem' }}>shared stub: {health}</p>
    </main>
  );
}
