import './ActionBar.css';

import type { ActionBarMock } from '../../mocks/tableMock';

export interface ActionBarProps {
  mock: ActionBarMock;
}

const QUICK_BUTTONS = [
  { id: 'min' as const, label: 'MIN' },
  { id: 'half' as const, label: '1/2 POT' },
  { id: 'pot' as const, label: 'POT' },
  { id: '2x' as const, label: '2X POT' },
  { id: 'all' as const, label: 'ALL-IN' },
];

export function ActionBar({ mock }: ActionBarProps) {
  const {
    toCall,
    canCheck,
    raiseDisplayAmount,
    sliderPct,
    activeQuickId,
  } = mock;

  const pct = Math.min(100, Math.max(0, sliderPct));

  return (
    <div className="np-action-bar">
      <div className="np-ab-btn-group">
        <button type="button" className="np-ab-btn np-ab-fold">
          FOLD
        </button>
        <button type="button" className="np-ab-btn np-ab-check" disabled={!canCheck}>
          CHECK
        </button>
        <button type="button" className="np-ab-btn np-ab-call" disabled={canCheck}>
          CALL <span className="np-ab-sub">${toCall}</span>
        </button>
        <button type="button" className="np-ab-btn np-ab-raise">
          RAISE TO <span className="np-ab-sub">${raiseDisplayAmount.toFixed(2)}</span>
        </button>
      </div>

      <div className="np-ab-raise-ctrls">
        <div className="np-ab-raise-top">
          <div className="np-ab-amt-input">
            <span className="np-ab-pre">$</span>
            <span className="np-ab-amt-val">{raiseDisplayAmount.toFixed(2)}</span>
          </div>
        </div>
        <div className="np-ab-raise-mid">
          <button type="button" className="np-ab-iconbtn" aria-label="Decrease">
            −
          </button>
          <div className="np-ab-slider">
            <div className="np-ab-fill" style={{ width: `${pct}%` }} />
            <div className="np-ab-thumb" style={{ left: `${pct}%` }} />
          </div>
          <button type="button" className="np-ab-iconbtn" aria-label="Increase">
            +
          </button>
        </div>
        <div className="np-ab-raise-bot">
          {QUICK_BUTTONS.map((q) => (
            <button
              key={q.id}
              type="button"
              className={`np-ab-qbtn ${activeQuickId === q.id ? 'np-ab-qbtn-active' : ''}`}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
