import type { AllowedRoomMaxSeats } from '@neonpoker/shared';

import {
  CREATE_ROOM_SETTINGS_DEFAULTS,
  type CreateRoomSettingsFormState,
} from '../../lib/roomSettingsForm';

const MAX_SEAT_OPTIONS: readonly AllowedRoomMaxSeats[] = [2, 4, 6, 9];

export interface CreateRoomSettingsPanelProps {
  expanded: boolean;
  onToggle: () => void;
  form: CreateRoomSettingsFormState;
  onChange: (next: CreateRoomSettingsFormState) => void;
  errors: Record<string, string>;
  disabled?: boolean;
}

export function CreateRoomSettingsPanel({
  expanded,
  onToggle,
  form,
  onChange,
  errors,
  disabled = false,
}: CreateRoomSettingsPanelProps) {
  const patch = (partial: Partial<CreateRoomSettingsFormState>) => {
    onChange({ ...form, ...partial });
  };

  const resetDefaults = () => {
    onChange({ ...CREATE_ROOM_SETTINGS_DEFAULTS });
  };

  return (
    <div className="jr-settings">
      <button
        type="button"
        className="jr-settings__toggle"
        onClick={onToggle}
        aria-expanded={expanded}
        disabled={disabled}
      >
        {expanded ? 'Hide create room settings' : 'Create room settings'}
      </button>

      {expanded ? (
        <div className="jr-settings__body">
          {errors._form ? (
            <p className="jr-field__error" role="alert">
              {errors._form}
            </p>
          ) : null}

          <label className="jr-field jr-field--compact">
            <span className="jr-field__label">Room name</span>
            <input
              className={`jr-field__input${errors.roomName ? ' jr-field__input--error' : ''}`}
              type="text"
              maxLength={32}
              value={form.roomName}
              placeholder="Neon Table"
              onChange={(ev) => patch({ roomName: ev.target.value })}
              disabled={disabled}
            />
            {errors.roomName ? (
              <span className="jr-field__error">{errors.roomName}</span>
            ) : null}
          </label>

          <label className="jr-field jr-field--compact">
            <span className="jr-field__label">Max players</span>
            <select
              className="jr-field__input"
              value={form.maxSeats}
              onChange={(ev) =>
                patch({
                  maxSeats: Number(ev.target.value) as AllowedRoomMaxSeats,
                })
              }
              disabled={disabled}
            >
              {MAX_SEAT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>

          <div className="jr-settings__grid">
            <label className="jr-field jr-field--compact">
              <span className="jr-field__label">Starting stack</span>
              <input
                className={`jr-field__input${errors.startingStack ? ' jr-field__input--error' : ''}`}
                type="number"
                min={1}
                value={form.startingStack}
                onChange={(ev) => patch({ startingStack: ev.target.value })}
                disabled={disabled}
              />
              {errors.startingStack ? (
                <span className="jr-field__error">{errors.startingStack}</span>
              ) : null}
            </label>

            <label className="jr-field jr-field--compact">
              <span className="jr-field__label">Small blind</span>
              <input
                className={`jr-field__input${errors.smallBlind ? ' jr-field__input--error' : ''}`}
                type="number"
                min={1}
                value={form.smallBlind}
                onChange={(ev) => patch({ smallBlind: ev.target.value })}
                disabled={disabled}
              />
              {errors.smallBlind ? (
                <span className="jr-field__error">{errors.smallBlind}</span>
              ) : null}
            </label>

            <label className="jr-field jr-field--compact">
              <span className="jr-field__label">Big blind</span>
              <input
                className={`jr-field__input${errors.bigBlind ? ' jr-field__input--error' : ''}`}
                type="number"
                min={1}
                placeholder="2× small blind"
                value={form.bigBlind}
                onChange={(ev) => patch({ bigBlind: ev.target.value })}
                disabled={disabled}
              />
              {errors.bigBlind ? (
                <span className="jr-field__error">{errors.bigBlind}</span>
              ) : null}
            </label>

            <label className="jr-field jr-field--compact">
              <span className="jr-field__label">Rebuy amount</span>
              <input
                className={`jr-field__input${errors.rebuyAmount ? ' jr-field__input--error' : ''}`}
                type="number"
                min={1}
                value={form.rebuyAmount}
                onChange={(ev) => patch({ rebuyAmount: ev.target.value })}
                disabled={disabled}
              />
              {errors.rebuyAmount ? (
                <span className="jr-field__error">{errors.rebuyAmount}</span>
              ) : null}
            </label>
          </div>

          <div className="jr-settings__rebuys">
            <label className="jr-field jr-field--inline">
              <input
                type="checkbox"
                checked={form.maxRebuysUnlimited}
                onChange={(ev) =>
                  patch({ maxRebuysUnlimited: ev.target.checked })
                }
                disabled={disabled}
              />
              <span>Unlimited rebuys</span>
            </label>
            {!form.maxRebuysUnlimited ? (
              <label className="jr-field jr-field--compact">
                <span className="jr-field__label">Max rebuys per player</span>
                <input
                  className={`jr-field__input${errors.maxRebuys ? ' jr-field__input--error' : ''}`}
                  type="number"
                  min={0}
                  value={form.maxRebuys}
                  onChange={(ev) => patch({ maxRebuys: ev.target.value })}
                  disabled={disabled}
                />
                {errors.maxRebuys ? (
                  <span className="jr-field__error">{errors.maxRebuys}</span>
                ) : null}
              </label>
            ) : null}
          </div>

          <div className="jr-settings__grid">
            <label className="jr-field jr-field--compact">
              <span className="jr-field__label">Turn time (sec)</span>
              <input
                className={`jr-field__input${errors.actionTimeoutSeconds ? ' jr-field__input--error' : ''}`}
                type="number"
                min={5}
                max={120}
                value={form.actionTimeoutSeconds}
                onChange={(ev) =>
                  patch({ actionTimeoutSeconds: ev.target.value })
                }
                disabled={disabled}
              />
              {errors.actionTimeoutSeconds ? (
                <span className="jr-field__error">
                  {errors.actionTimeoutSeconds}
                </span>
              ) : null}
            </label>

            <label className="jr-field jr-field--compact">
              <span className="jr-field__label">Disconnect grace (sec)</span>
              <input
                className={`jr-field__input${errors.disconnectGraceSeconds ? ' jr-field__input--error' : ''}`}
                type="number"
                min={5}
                max={120}
                value={form.disconnectGraceSeconds}
                onChange={(ev) =>
                  patch({ disconnectGraceSeconds: ev.target.value })
                }
                disabled={disabled}
              />
              {errors.disconnectGraceSeconds ? (
                <span className="jr-field__error">
                  {errors.disconnectGraceSeconds}
                </span>
              ) : null}
            </label>
          </div>

          <label className="jr-field jr-field--inline">
            <input
              type="checkbox"
              checked={form.chatEnabled}
              onChange={(ev) => patch({ chatEnabled: ev.target.checked })}
              disabled={disabled}
            />
            <span>Chat enabled</span>
          </label>

          <button
            type="button"
            className="jr-btn jr-btn--ghost jr-settings__reset"
            onClick={resetDefaults}
            disabled={disabled}
          >
            Reset to defaults
          </button>
        </div>
      ) : null}
    </div>
  );
}
