import './JoinRoomPage.css';

import { type ClipboardEvent, type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { formatJoinError } from '../../net/errors';
import { establishRoomSession } from '../../net/roomSession';
import { createRoom } from '../../net/roomsApi';
import {
  normalizeNickname,
  validateNickname,
} from '../../lib/joinValidation';
import {
  CREATE_ROOM_SETTINGS_DEFAULTS,
  formToPartial,
  type CreateRoomSettingsFormState,
  validateCreateRoomSettingsForm,
} from '../../lib/roomSettingsForm';
import { CreateRoomSettingsPanel } from './CreateRoomSettingsPanel';
import { extractRoomCodeFromPaste } from '../../lib/roomCode';
import {
  isValidRoomLookup,
  resolveRoomLookupParam,
} from '../../lib/roomLookup';
import { useSessionStore } from '../../state/sessionStore';

export function JoinRoomPage() {
  const navigate = useNavigate();
  const params = useParams<{ roomId?: string }>();
  const inviteLocked = params.roomId != null && params.roomId !== '';

  const lockedRaw = inviteLocked ? params.roomId! : '';
  const lockedLookup = inviteLocked ? resolveRoomLookupParam(lockedRaw) : '';

  const savedNickname = useSessionStore((s) => s.nickname);

  const [nickname, setNickname] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [roomTouched, setRoomTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [panelError, setPanelError] = useState<string | null>(null);
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [createSettings, setCreateSettings] =
    useState<CreateRoomSettingsFormState>(CREATE_ROOM_SETTINGS_DEFAULTS);
  const [settingsTouched, setSettingsTouched] = useState(false);
  const [settingsErrors, setSettingsErrors] = useState<Record<string, string>>(
    {},
  );

  useEffect(() => {
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, [savedNickname]);

  useEffect(() => {
    if (inviteLocked) {
      setRoomInput(lockedLookup);
      setRoomTouched(false);
    }
  }, [inviteLocked, lockedLookup]);

  const nickNorm = normalizeNickname(nickname);
  const nickValidation = validateNickname(nickNorm);

  const rawRoomInput = inviteLocked ? lockedRaw : roomInput;
  const effectiveLookup = inviteLocked
    ? lockedLookup
    : resolveRoomLookupParam(extractRoomCodeFromPaste(roomInput));

  const roomValid = isValidRoomLookup(rawRoomInput);
  const inviteLinkInvalid =
    inviteLocked && lockedRaw !== '' && !isValidRoomLookup(lockedRaw);

  const nicknameError =
    nicknameTouched && !nickValidation.ok ? nickValidation.message : null;

  const roomError =
    roomTouched && !inviteLocked && !roomValid
      ? 'Enter a 6-character room code or room id.'
      : null;

  const canSubmit =
    nickValidation.ok && roomValid && !inviteLinkInvalid && !busy;

  const heading = inviteLocked ? 'JOIN ROOM' : 'ENTER ROOM';

  const hintRoom = inviteLocked
    ? 'You opened an invite link — enter your nickname to continue.'
    : 'Paste a code or full invite URL containing /room/ or /table/.';

  const handleRoomBlur = () => {
    setRoomTouched(true);
    if (!inviteLocked) {
      setRoomInput(extractRoomCodeFromPaste(roomInput));
    }
  };

  const handleRoomPaste = (ev: ClipboardEvent<HTMLInputElement>) => {
    const text = ev.clipboardData.getData('text');
    const extracted = extractRoomCodeFromPaste(text);
    ev.preventDefault();
    setRoomInput(extracted);
    setRoomTouched(true);
  };

  const performJoin = async (lookup: string) => {
    setPanelError(null);
    setBusy(true);
    try {
      console.info('[neonpoker] join start', lookup);
      const { roomId } = await establishRoomSession(nickNorm, lookup);
      navigate(`/table/${encodeURIComponent(roomId)}`);
    } catch (err) {
      console.error('[neonpoker] join flow failed', err);
      setPanelError(formatJoinError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setNicknameTouched(true);
    setRoomTouched(true);

    if (!nickValidation.ok || !roomValid || inviteLinkInvalid || busy) return;

    await performJoin(effectiveLookup);
  };

  const handleCreateRoom = async () => {
    setNicknameTouched(true);
    setSettingsTouched(true);
    setPanelError(null);

    if (!nickValidation.ok) return;

    const fieldErrors = validateCreateRoomSettingsForm(createSettings);
    setSettingsErrors(fieldErrors);
    if (Object.keys(fieldErrors).length > 0) {
      setSettingsExpanded(true);
      return;
    }

    setBusy(true);
    try {
      const created = await createRoom(formToPartial(createSettings));
      const lookup = created?.roomId?.trim();
      if (!lookup) {
        console.error('[neonpoker] createRoom missing roomId', created);
        throw new Error('Server did not return a room id');
      }
      console.info('[neonpoker] createRoom ok', lookup);
      const { roomId } = await establishRoomSession(nickNorm, lookup);
      navigate(`/table/${encodeURIComponent(roomId)}`);
    } catch (err) {
      console.error('[neonpoker] createRoom flow failed', err);
      setPanelError(formatJoinError(err));
    } finally {
      setBusy(false);
    }
  };

  const displayRoomValue = inviteLocked
    ? lockedLookup
    : roomInput;

  return (
    <div className="join-room-page">
      <div className="jr-panel">
        <header className="jr-panel__head">
          <h1 className="jr-panel__title">{heading}</h1>
          <p className="jr-panel__subtitle">{hintRoom}</p>
        </header>

        <form className="jr-form" onSubmit={handleSubmit} noValidate>
          <div className="jr-form__scroll">
          {panelError ? (
            <p className="jr-panel__error" role="alert">
              {panelError}
            </p>
          ) : null}

          <label className="jr-field">
            <span className="jr-field__label">Nickname</span>
            <input
              className={`jr-field__input${nicknameError ? ' jr-field__input--error' : ''}`}
              type="text"
              autoComplete="nickname"
              maxLength={32}
              value={nickname}
              onChange={(ev) => setNickname(ev.target.value)}
              onBlur={() => setNicknameTouched(true)}
              spellCheck={false}
              disabled={busy}
            />
            {nicknameError ? (
              <span className="jr-field__error" role="alert">
                {nicknameError}
              </span>
            ) : null}
          </label>

          <label className="jr-field">
            <span className="jr-field__label">Room code</span>
            <input
              className={`jr-field__input${roomError ? ' jr-field__input--error' : ''}${inviteLocked ? ' jr-field__input--locked' : ''}`}
              type="text"
              autoComplete="off"
              maxLength={128}
              readOnly={inviteLocked}
              aria-readonly={inviteLocked}
              value={displayRoomValue}
              onChange={(ev) =>
                inviteLocked ? undefined : setRoomInput(ev.target.value)
              }
              onBlur={handleRoomBlur}
              onPaste={inviteLocked ? undefined : handleRoomPaste}
              spellCheck={false}
              disabled={busy}
            />
            {inviteLinkInvalid ? (
              <span className="jr-field__error" role="alert">
                This invite link has an invalid room code.
              </span>
            ) : roomError ? (
              <span className="jr-field__error" role="alert">
                {roomError}
              </span>
            ) : null}
          </label>

          {!inviteLocked ? (
            <CreateRoomSettingsPanel
              expanded={settingsExpanded}
              onToggle={() => setSettingsExpanded((v) => !v)}
              form={createSettings}
              onChange={(next) => {
                setCreateSettings(next);
                if (settingsTouched) {
                  setSettingsErrors(validateCreateRoomSettingsForm(next));
                }
              }}
              errors={settingsTouched ? settingsErrors : {}}
              disabled={busy}
            />
          ) : null}
          </div>

          <div className="jr-actions">
            <button
              type="submit"
              className="jr-btn jr-btn--primary"
              disabled={!canSubmit}
            >
              {busy ? 'Joining…' : 'Join Room'}
            </button>
            {!inviteLocked ? (
              <button
                type="button"
                className="jr-btn jr-btn--ghost"
                onClick={() => void handleCreateRoom()}
                disabled={busy || !nickValidation.ok}
              >
                {busy ? 'Please wait…' : 'Create Room'}
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
