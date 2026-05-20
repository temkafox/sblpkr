import './Sidebar.css';

import type { HandHistoryRow, HandHistoryStreet } from '../../mocks/tableMock';

export interface HandHistoryPanelProps {
  streets: HandHistoryStreet[];
}

function nameColorClass(cls: HandHistoryRow['cls']) {
  return `np-namecolor-${cls}`;
}

export function HandHistoryPanel({ streets }: HandHistoryPanelProps) {
  return (
    <div className="np-panel np-hand-history">
      <div className="np-panel-head">
        <h3>HAND HISTORY</h3>
        <span className="np-panel-chev">▾</span>
      </div>
      <div className="np-hh-body">
        <div className="np-hh-scroll">
          {streets.map((street, si) => (
            <section key={si}>
              <div className="np-hh-street">{street.street}</div>
              {street.rows.map((row, ri) => (
                <div className="np-hh-row" key={ri}>
                  <span className={`np-hh-name ${nameColorClass(row.cls)}`}>{row.name}</span>
                  <span className="np-hh-act">{row.act}</span>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
