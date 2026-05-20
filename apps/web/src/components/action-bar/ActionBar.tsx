import './ActionBar.css';

import type { AvailableActions } from '@neonpoker/shared';
import { useEffect, useState } from 'react';

import {
  clampRaiseAmount,
  isValidRaiseAmount,
  quickRaiseAmount,
  raiseAmountFromSliderPct,
  sliderPctFromRaiseAmount,
  type QuickRaiseKind,
} from '../../lib/actionBarRaise';

export interface ActionBarProps {
  availableActions: AvailableActions | undefined;
  potAmount: number;
  callAmount: number;
  minRaise: number;
  maxRaise: number;
  isMyTurn: boolean;
  isSubmittingAction: boolean;
  onFold: () => void;
  onCheck: () => void;
  onCall: () => void;
  onRaise: (amount: number) => void;
  onAllIn: () => void;
}

const QUICK_BUTTONS: ReadonlyArray<{ id: QuickRaiseKind | 'all'; label: string }> = [
  { id: 'min', label: 'MIN' },
  { id: 'half', label: '1/2 POT' },
  { id: 'pot', label: 'POT' },
  { id: '2x', label: '2X POT' },
  { id: 'all', label: 'ALL-IN' },
];

export function ActionBar({
  availableActions,
  potAmount,
  callAmount,
  minRaise,
  maxRaise,
  isMyTurn,
  isSubmittingAction,
  onFold,
  onCheck,
  onCall,
  onRaise,
  onAllIn,
}: ActionBarProps) {
  const [raiseAmount, setRaiseAmount] = useState(minRaise);
  const [activeQuickId, setActiveQuickId] = useState<
    QuickRaiseKind | 'all' | null
  >(null);

  useEffect(() => {
    setRaiseAmount(minRaise);
    setActiveQuickId(null);
  }, [minRaise, maxRaise, availableActions]);

  const barDisabled = !isMyTurn || isSubmittingAction;
  const canFold = availableActions?.canFold ?? false;
  const canCheck = availableActions?.canCheck ?? false;
  const canCall = availableActions?.canCall ?? false;
  const canRaise = availableActions?.canRaise ?? false;
  const canAllIn = availableActions?.canAllIn ?? false;
  const raiseValid = canRaise && isValidRaiseAmount(raiseAmount, minRaise, maxRaise);
  const sliderPct = sliderPctFromRaiseAmount(raiseAmount, minRaise, maxRaise);
  const raiseControlsDisabled = barDisabled || !canRaise;

  const updateRaiseAmount = (next: number, quickId: QuickRaiseKind | 'all' | null = null) => {
    setRaiseAmount(clampRaiseAmount(next, minRaise, maxRaise));
    setActiveQuickId(quickId);
  };

  const handleQuickClick = (id: QuickRaiseKind | 'all') => {
    if (barDisabled) return;
    if (id === 'all') {
      if (!canAllIn) return;
      onAllIn();
      return;
    }
    if (!canRaise) return;
    updateRaiseAmount(quickRaiseAmount(id, minRaise, maxRaise, potAmount), id);
  };

  return (
    <div
      className={`np-action-bar${barDisabled ? ' np-action-bar--disabled' : ''}`}
      aria-disabled={barDisabled}
    >
      <div className="np-ab-btn-group">
        <button
          type="button"
          className="np-ab-btn np-ab-fold"
          disabled={barDisabled || !canFold}
          onClick={() => {
            if (barDisabled || !canFold) return;
            onFold();
          }}
        >
          FOLD
        </button>
        <button
          type="button"
          className="np-ab-btn np-ab-check"
          disabled={barDisabled || !canCheck}
          onClick={() => {
            if (barDisabled || !canCheck) return;
            onCheck();
          }}
        >
          CHECK
        </button>
        <button
          type="button"
          className="np-ab-btn np-ab-call"
          disabled={barDisabled || !canCall}
          onClick={() => {
            if (barDisabled || !canCall) return;
            onCall();
          }}
        >
          CALL <span className="np-ab-sub">${callAmount}</span>
        </button>
        <button
          type="button"
          className="np-ab-btn np-ab-raise"
          disabled={barDisabled || !raiseValid}
          onClick={() => {
            if (barDisabled || !raiseValid) return;
            onRaise(raiseAmount);
          }}
        >
          RAISE TO{' '}
          <span className="np-ab-sub">${raiseAmount.toFixed(2)}</span>
        </button>
      </div>

      <div className="np-ab-raise-ctrls">
        <div className="np-ab-raise-top">
          <div className="np-ab-amt-input">
            <span className="np-ab-pre">$</span>
            <input
              type="number"
              className="np-ab-amt-val"
              value={Number.isFinite(raiseAmount) ? raiseAmount : minRaise}
              min={minRaise}
              max={maxRaise}
              step={1}
              disabled={raiseControlsDisabled}
              aria-label="Raise amount"
              onChange={(event) => {
                const parsed = Number.parseFloat(event.target.value);
                updateRaiseAmount(Number.isFinite(parsed) ? parsed : minRaise);
              }}
              onBlur={() => {
                updateRaiseAmount(raiseAmount);
              }}
            />
          </div>
        </div>
        <div className="np-ab-raise-mid">
          <button
            type="button"
            className="np-ab-iconbtn"
            aria-label="Decrease"
            disabled={raiseControlsDisabled}
            onClick={() => {
              updateRaiseAmount(raiseAmount - 1);
            }}
          >
            −
          </button>
          <div className="np-ab-slider">
            <input
              type="range"
              className="np-ab-slider-input"
              min={0}
              max={100}
              step={1}
              value={sliderPct}
              disabled={raiseControlsDisabled}
              aria-label="Raise amount slider"
              onChange={(event) => {
                updateRaiseAmount(
                  raiseAmountFromSliderPct(
                    Number(event.target.value),
                    minRaise,
                    maxRaise,
                  ),
                );
              }}
            />
            <div className="np-ab-fill" style={{ width: `${sliderPct}%` }} />
            <div className="np-ab-thumb" style={{ left: `${sliderPct}%` }} />
          </div>
          <button
            type="button"
            className="np-ab-iconbtn"
            aria-label="Increase"
            disabled={raiseControlsDisabled}
            onClick={() => {
              updateRaiseAmount(raiseAmount + 1);
            }}
          >
            +
          </button>
        </div>
        <div className="np-ab-raise-bot">
          {QUICK_BUTTONS.map((q) => (
            <button
              key={q.id}
              type="button"
              className={`np-ab-qbtn ${activeQuickId === q.id ? 'np-ab-qbtn-active' : ''}`}
              disabled={
                barDisabled ||
                (q.id === 'all' ? !canAllIn : !canRaise)
              }
              onClick={() => handleQuickClick(q.id)}
            >
              {q.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
