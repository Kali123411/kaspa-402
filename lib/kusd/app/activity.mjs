// This browser's record of what each wallet broadcast (localStorage; per device, best effort).
export const ACTIVITY_KEY = 'kusd.activity.v2';
const CAP = 200;
const wellFormed = (e) => e && typeof e === 'object' && /^[0-9a-f]{64}$/.test(e.txid) && typeof e.flow === 'string'
  && Number.isFinite(e.at) && !Number.isNaN(new Date(e.at).getTime()) && typeof e.summary === 'string';

function readAll(storage) {
  try {
    const v = JSON.parse(storage.getItem(ACTIVITY_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** `owner`'s entries, newest first; a missing, corrupted or blocked store reads as empty. */
export function list(storage, owner) {
  const v = readAll(storage)[owner];
  return Array.isArray(v) ? v.filter(wellFormed) : [];
}

export function record(storage, owner, { txid, flow, at, summary }) {
  try {
    const all = readAll(storage);
    storage.setItem(ACTIVITY_KEY, JSON.stringify({ ...all, [owner]: [{ txid, flow, at, summary }, ...list(storage, owner)].slice(0, CAP) }));
  } catch {
    // storage blocked: the activity list lasts this visit only
  }
}
