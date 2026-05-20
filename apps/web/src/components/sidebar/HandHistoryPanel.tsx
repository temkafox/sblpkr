import './Sidebar.css';

import { memo, useEffect, useMemo, useRef } from 'react';

import type { HandHistoryRow, HandHistoryStreet } from '../../mocks/tableMock';

export interface HandHistoryPanelProps {
  streets: HandHistoryStreet[];
}

function nameColorClass(cls: HandHistoryRow['cls']) {
  return `np-namecolor-${cls}`;
}

function historyEntryCount(streets: HandHistoryStreet[]): number {
  return streets.reduce((count, street) => count + street.rows.length, 0);
}

export const HandHistoryPanel = memo(function HandHistoryPanel({
  streets,
}: HandHistoryPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const entryCount = useMemo(() => historyEntryCount(streets), [streets]);
  const isEmpty = streets.length === 0;

  useEffect(() => {
    const el = scrollRef.current;
    if (el == null || entryCount === 0) {
      return;
    }
    el.scrollTop = el.scrollHeight;
  }, [entryCount, streets]);

  return (
    <div className="np-panel np-hand-history">
      <div className="np-panel-head">
        <h3>HAND HISTORY</h3>
        <span className="np-panel-chev">▾</span>
      </div>
      <div className="np-hh-body">
        <div className="np-hh-scroll" ref={scrollRef}>
          {isEmpty ? (
            <p className="np-hh-empty">No hand history yet.</p>
          ) : null}
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
});
