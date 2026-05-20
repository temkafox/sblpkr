import './JoinRoomPage.css';

import { type ClipboardEvent, type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import {
  normalizeNickname,
  validateNickname,
} from '../../lib/joinValidation';
import {
  createLocalRoomCode,
  extractRoomCodeFromPaste,
  isValidRoomCode,
  normalizeRoomCode,
} from '../../lib/roomCode';
import { useSessionStore } from '../../state/sessionStore';

export function JoinRoomPage() {
  const navigate = useNavigate();
  const params = useParams<{ roomId?: string }>();
  const inviteLocked = params.roomId != null && params.roomId !== '';

  const lockedRaw = inviteLocked ? params.roomId! : '';
  const lockedCode = inviteLocked ? normalizeRoomCode(lockedRaw) : '';

  const savedNickname = useSessionStore((s) => s.nickname);
  const setSession = useSessionStore((s) => s.setSession);

  const [nickname, setNickname] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [nicknameTouched, setNicknameTouched] = useState(false);
  const [roomTouched, setRoomTouched] = useState(false);

  useEffect(() => {
    if (savedNickname) {
      setNickname(savedNickname);
    }
  }, [savedNickname]);

  useEffect(() => {
    if (inviteLocked) {
      setRoomInput(lockedCode);
      setRoomTouched(false);
    }
  }, [inviteLocked, lockedCode]);

  const nickNorm = normalizeNickname(nickname);
  const nickValidation = validateNickname(nickNorm);

  const effectiveRoomCode = inviteLocked
    ? lockedCode
    : extractRoomCodeFromPaste(roomInput);

  const roomValid = isValidRoomCode(effectiveRoomCode);
  const inviteLinkInvalid =
    inviteLocked && lockedRaw !== '' && !isValidRoomCode(lockedCode);

  const nicknameError =
    nicknameTouched && !nickValidation.ok ? nickValidation.message : null;

  const roomError =
    roomTouched && !inviteLocked && !roomValid
      ? 'Room code must be 4–12 letters or numbers.'
      : null;

  const canSubmit = nickValidation.ok && roomValid && !inviteLinkInvalid;

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

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    setNicknameTouched(true);
    setRoomTouched(true);

    if (!nickValidation.ok || !roomValid || inviteLinkInvalid) return;

    const roomId = effectiveRoomCode;
    setSession({ nickname: nickNorm, roomId });
    navigate(`/table/${encodeURIComponent(roomId)}`);
  };

  const handleCreateRoom = () => {
    const code = createLocalRoomCode();
    navigate(`/room/${encodeURIComponent(code)}`);
  };

  return (
    <div className="join-room-page">
      <div className="jr-panel">
        <header className="jr-panel__head">
          <h1 className="jr-panel__title">{heading}</h1>
          <p className="jr-panel__subtitle">{hintRoom}</p>
        </header>

        <form className="jr-form" onSubmit={handleSubmit} noValidate>
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
              value={inviteLocked ? lockedCode : roomInput}
              onChange={(ev) =>
                inviteLocked ? undefined : setRoomInput(ev.target.value)
              }
              onBlur={handleRoomBlur}
              onPaste={inviteLocked ? undefined : handleRoomPaste}
              spellCheck={false}
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

          <div className="jr-actions">
            <button
              type="submit"
              className="jr-btn jr-btn--primary"
              disabled={!canSubmit}
            >
              Join Room
            </button>
            {!inviteLocked ? (
              <button
                type="button"
                className="jr-btn jr-btn--ghost"
                onClick={handleCreateRoom}
              >
                Create Room
              </button>
            ) : null}
          </div>
        </form>
      </div>
    </div>
  );
}
