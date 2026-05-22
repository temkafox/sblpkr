import {
  DEFAULT_ROOM_SETTINGS,
  mergeRoomSettings,
  type RoomSettings,
  type RoomSettingsPartial,
} from '@neonpoker/shared';

export type CreateRoomSettingsFormState = {
  roomName: string;
  maxSeats: RoomSettings['maxSeats'];
  startingStack: string;
  smallBlind: string;
  bigBlind: string;
  rebuyAmount: string;
  maxRebuysUnlimited: boolean;
  maxRebuys: string;
  actionTimeoutSeconds: string;
  disconnectGraceSeconds: string;
  chatEnabled: boolean;
};

export const CREATE_ROOM_SETTINGS_DEFAULTS: CreateRoomSettingsFormState =
  Object.freeze({
    roomName: '',
    maxSeats: DEFAULT_ROOM_SETTINGS.maxSeats,
    startingStack: String(DEFAULT_ROOM_SETTINGS.startingStack),
    smallBlind: String(DEFAULT_ROOM_SETTINGS.smallBlind),
    bigBlind: String(DEFAULT_ROOM_SETTINGS.bigBlind),
    rebuyAmount: String(DEFAULT_ROOM_SETTINGS.rebuyAmount),
    maxRebuysUnlimited: DEFAULT_ROOM_SETTINGS.maxRebuysPerPlayer == null,
    maxRebuys: '0',
    actionTimeoutSeconds: String(DEFAULT_ROOM_SETTINGS.actionTimeoutSeconds),
    disconnectGraceSeconds: String(
      DEFAULT_ROOM_SETTINGS.disconnectGraceSeconds,
    ),
    chatEnabled: DEFAULT_ROOM_SETTINGS.chatEnabled,
  });

function parsePositiveInt(raw: string, label: string): number | string {
  const trimmed = raw.trim();
  if (trimmed === '') return `${label} is required`;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n <= 0) return `${label} must be a positive integer`;
  return n;
}

function parseNonNegativeInt(raw: string, label: string): number | string {
  const trimmed = raw.trim();
  if (trimmed === '') return `${label} is required`;
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 0) return `${label} must be 0 or greater`;
  return n;
}

/** Client-side field errors before POST /rooms. */
export function validateCreateRoomSettingsForm(
  form: CreateRoomSettingsFormState,
): Record<string, string> {
  const errors: Record<string, string> = {};

  const startingStack = parsePositiveInt(form.startingStack, 'Starting stack');
  if (typeof startingStack === 'string') errors.startingStack = startingStack;

  const smallBlind = parsePositiveInt(form.smallBlind, 'Small blind');
  if (typeof smallBlind === 'string') errors.smallBlind = smallBlind;

  const bigBlindRaw = form.bigBlind.trim();
  const bigBlind =
    bigBlindRaw === ''
      ? typeof smallBlind === 'number'
        ? smallBlind * 2
        : null
      : parsePositiveInt(form.bigBlind, 'Big blind');
  if (typeof bigBlind === 'string') errors.bigBlind = bigBlind;

  const rebuyAmount = parsePositiveInt(form.rebuyAmount, 'Rebuy amount');
  if (typeof rebuyAmount === 'string') errors.rebuyAmount = rebuyAmount;

  const actionTimeout = parsePositiveInt(
    form.actionTimeoutSeconds,
    'Turn time',
  );
  if (typeof actionTimeout === 'string') {
    errors.actionTimeoutSeconds = actionTimeout;
  } else if (actionTimeout < 5 || actionTimeout > 120) {
    errors.actionTimeoutSeconds = 'Turn time must be between 5 and 120 seconds';
  }

  const disconnectGrace = parsePositiveInt(
    form.disconnectGraceSeconds,
    'Disconnect grace',
  );
  if (typeof disconnectGrace === 'string') {
    errors.disconnectGraceSeconds = disconnectGrace;
  } else if (disconnectGrace < 5 || disconnectGrace > 120) {
    errors.disconnectGraceSeconds =
      'Disconnect grace must be between 5 and 120 seconds';
  }

  if (!form.maxRebuysUnlimited) {
    const maxRebuys = parseNonNegativeInt(form.maxRebuys, 'Max rebuys');
    if (typeof maxRebuys === 'string') errors.maxRebuys = maxRebuys;
  }

  if (form.roomName.trim().length > 32) {
    errors.roomName = 'Room name must be at most 32 characters';
  }

  if (Object.keys(errors).length > 0) {
    return errors;
  }

  try {
    mergeRoomSettings(formToPartial(form));
  } catch (err) {
    errors._form =
      err instanceof Error ? err.message : 'Invalid room settings';
  }

  return errors;
}

export function formToPartial(
  form: CreateRoomSettingsFormState,
): RoomSettingsPartial {
  const smallBlind = Number(form.smallBlind.trim());
  const bigBlindRaw = form.bigBlind.trim();
  const bigBlind =
    bigBlindRaw === '' ? smallBlind * 2 : Number(bigBlindRaw);

  return {
    roomName: form.roomName.trim() || undefined,
    maxSeats: form.maxSeats,
    startingStack: Number(form.startingStack.trim()),
    smallBlind,
    bigBlind,
    rebuyAmount: Number(form.rebuyAmount.trim()),
    maxRebuysPerPlayer: form.maxRebuysUnlimited
      ? null
      : Number(form.maxRebuys.trim()),
    actionTimeoutSeconds: Number(form.actionTimeoutSeconds.trim()),
    disconnectGraceSeconds: Number(form.disconnectGraceSeconds.trim()),
    chatEnabled: form.chatEnabled,
  };
}

export function formatRebuyLimit(
  maxRebuysPerPlayer: number | null | undefined,
): string {
  if (maxRebuysPerPlayer == null) return 'Unlimited';
  if (maxRebuysPerPlayer === 0) return 'Disabled';
  return String(maxRebuysPerPlayer);
}

export function gameInfoFromRoomSettings(
  settings: RoomSettings,
  playerCount: number,
): {
  gameType: string;
  stakes: string;
  buyIn: string;
  rebuyLine: string;
  turnTimer: string;
  playerCount: number;
  maxSeats: number;
  nextBreak: string;
} {
  const name =
    settings.roomName.trim().length > 0
      ? settings.roomName.trim()
      : 'Neon Table';
  return {
    gameType: name,
    stakes: `$${settings.smallBlind} / $${settings.bigBlind}`,
    buyIn: `$${settings.startingStack}`,
    rebuyLine: `$${settings.rebuyAmount} (${formatRebuyLimit(settings.maxRebuysPerPlayer)})`,
    turnTimer: `${settings.actionTimeoutSeconds}s`,
    playerCount,
    maxSeats: settings.maxSeats,
    nextBreak: '—',
  };
}
