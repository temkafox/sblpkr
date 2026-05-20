import type { HandHistoryPayload } from '@neonpoker/shared';

import type { HandHistoryRow, HandHistoryStreet } from '../mocks/tableMock';

const DEFAULT_NAME_COLORS = [
  'n-c',
  'n-m',
  'n-p',
  'n-v',
  'n-g',
  'n-a',
  'n-h',
] as const;

function entryToRow(entry: HandHistoryPayload['streets'][number]['entries'][number]): HandHistoryRow {
  const name = entry.nickname ?? '';
  const cls = (entry.nameColor ?? DEFAULT_NAME_COLORS[entry.seq % DEFAULT_NAME_COLORS.length]!) as HandHistoryRow['cls'];
  let act = entry.text;
  if (name.length > 0 && act.startsWith(name)) {
    act = act.slice(name.length).trimStart();
  }
  return { name, cls, act };
}

/** Maps server hand history payload to sidebar panel rows. */
export function handHistoryStreetsFromPayload(
  payload: HandHistoryPayload | null | undefined,
): HandHistoryStreet[] {
  if (payload == null || payload.streets.length === 0) {
    return [];
  }

  return payload.streets.map((section) => ({
    street: section.street as HandHistoryStreet['street'],
    rows: section.entries.map(entryToRow),
  }));
}
