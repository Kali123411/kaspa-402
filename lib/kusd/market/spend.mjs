// Operator spending controls for the browser agent — the same bounds, refusal codes and ordering as k402's
// SpendPolicy / SpendLedger (k402 DESIGN-kusd-spend-controls.md), kept in a storage of the caller's choice
// (localStorage in the page, keyed per wallet). Reserve before any box is built; settle with the txid and the
// provider's HTTP status; void when nothing was signed. One tab at a time: browser storage is not transactional.
export const CODES = new Set(['frozen', 'failures', 'per_call', 'total', 'window_cents', 'window_calls', 'capability']);

export class SpendRefused extends Error {
  constructor(code, reason, status) {
    if (!CODES.has(code)) throw new Error(`unknown refusal code ${code}`);
    super(`spend refused (${code}): ${reason}`);
    this.name = 'SpendRefused';
    this.code = code;
    this.reason = reason;
    this.status = status;
  }
}

const INT_FIELDS = ['maxPerCallCents', 'maxTotalCents', 'maxWindowCents', 'maxWindowCalls', 'maxWindowFailures'];
const FIELDS = new Set([...INT_FIELDS, 'windowSeconds', 'allowCapabilities']);

/** What k402-mcp applies when the operator wrote no policy; the page starts here too. */
export const DEFAULT_POLICY = { maxPerCallCents: 25, maxWindowCents: 200, maxWindowCalls: 20, maxWindowFailures: 2, windowSeconds: 3600 };

const isCount = (v) => Number.isInteger(v) && v >= 0;

export class SpendPolicy {
  constructor(f) {
    for (const k of INT_FIELDS) this[k] = f[k] ?? null;
    this.windowSeconds = f.windowSeconds ?? 3600;
    this.allowCapabilities = f.allowCapabilities ?? null;
  }

  /** Validate a plain object (the operator's JSON). Every limit is optional; null = unbounded on that axis. */
  static from(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) throw new Error('a spend policy is a JSON object');
    const unknown = Object.keys(obj).filter((k) => !FIELDS.has(k));
    if (unknown.length) throw new Error(`unknown spend policy field(s): ${unknown.join(', ')}`);
    for (const k of INT_FIELDS) {
      if (obj[k] != null && !isCount(obj[k])) throw new Error(`${k} must be a non-negative integer or null`);
    }
    if (obj.windowSeconds != null && !(Number.isInteger(obj.windowSeconds) && obj.windowSeconds > 0)) throw new Error('windowSeconds must be a positive integer');
    if (obj.allowCapabilities != null && !(Array.isArray(obj.allowCapabilities) && obj.allowCapabilities.every((c) => typeof c === 'string'))) {
      throw new Error('allowCapabilities must be a list of capability names or null');
    }
    return new SpendPolicy({ ...obj, allowCapabilities: obj.allowCapabilities == null ? null : [...obj.allowCapabilities] });
  }

  toJSON() {
    const o = {};
    for (const k of INT_FIELDS) o[k] = this[k];
    o.windowSeconds = this.windowSeconds;
    o.allowCapabilities = this.allowCapabilities ? [...this.allowCapabilities] : null;
    return o;
  }

  /** The price ceiling for one call: the tighter of the agent's and the operator's. */
  cap(agentCap) {
    const caps = [agentCap, this.maxPerCallCents].filter((c) => c != null);
    return caps.length ? Math.min(...caps) : null;
  }
}

const EMPTY = () => ({ rows: [], frozen: false, next: 1 });

export class SpendLedger {
  constructor(storage, key) {
    this.storage = storage;
    this.key = key;
  }

  _load() {
    try {
      const raw = this.storage.getItem(this.key);
      const d = raw ? JSON.parse(raw) : null;
      if (!d || !Array.isArray(d.rows)) return EMPTY();
      return { rows: d.rows, frozen: Boolean(d.frozen), next: Number.isInteger(d.next) ? d.next : d.rows.length + 1 };
    } catch {
      return EMPTY();
    }
  }

  _save(d) {
    this.storage.setItem(this.key, JSON.stringify(d));
  }

  get frozen() { return this._load().frozen; }
  freeze() { const d = this._load(); d.frozen = true; this._save(d); }
  unfreeze() { const d = this._load(); d.frozen = false; this._save(d); }

  static _sums(d, policy, now) {
    const since = now - policy.windowSeconds * 1000;
    const live = d.rows.filter((r) => r.state !== 'void');
    const win = live.filter((r) => r.ts > since);
    const failed = (r) => r.state === 'sent' && r.http != null && (r.http < 200 || r.http >= 400);
    return {
      frozen: d.frozen,
      totalCents: live.reduce((s, r) => s + r.cents, 0),
      window: { seconds: policy.windowSeconds, cents: win.reduce((s, r) => s + r.cents, 0), calls: win.length, failures: win.filter(failed).length },
    };
  }

  static _status(d, policy, now) {
    const s = SpendLedger._sums(d, policy, now);
    const left = (max, used) => (max == null ? null : Math.max(0, max - used));
    s.remaining = {
      totalCents: left(policy.maxTotalCents, s.totalCents),
      windowCents: left(policy.maxWindowCents, s.window.cents),
      windowCalls: left(policy.maxWindowCalls, s.window.calls),
      windowFailures: left(policy.maxWindowFailures, s.window.failures),
    };
    s.policy = policy.toJSON();
    return s;
  }

  /** frozen, lifetime total, the window's sums, what is left on each bounded axis, the policy. */
  status(policy, now = Date.now()) {
    return SpendLedger._status(this._load(), policy, now);
  }

  /** Check every bound and record the spend as `reserved`. Throws SpendRefused (no row) when a bound would be crossed. */
  reserve(policy, { cents, provider = '', capability = '', now = Date.now() }) {
    if (!Number.isInteger(cents) || cents < 0) throw new Error('cents must be a non-negative integer');
    const d = this._load();
    const s = SpendLedger._status(d, policy, now);
    const w = s.window;
    if (s.frozen) throw new SpendRefused('frozen', 'the operator froze this agent\'s spending', s);
    if (policy.maxWindowFailures != null && w.failures >= policy.maxWindowFailures) {
      throw new SpendRefused('failures', `${w.failures} paid call(s) in the last ${policy.windowSeconds}s were not served (limit ${policy.maxWindowFailures}); not paying anyone until the window clears`, s);
    }
    if (policy.maxTotalCents != null && s.totalCents + cents > policy.maxTotalCents) {
      throw new SpendRefused('total', `${cents}¢ would take the lifetime total to ${s.totalCents + cents}¢, over the budget of ${policy.maxTotalCents}¢`, s);
    }
    if (policy.maxWindowCents != null && w.cents + cents > policy.maxWindowCents) {
      throw new SpendRefused('window_cents', `${cents}¢ would take the last ${policy.windowSeconds}s to ${w.cents + cents}¢, over the limit of ${policy.maxWindowCents}¢`, s);
    }
    if (policy.maxWindowCalls != null && w.calls + 1 > policy.maxWindowCalls) {
      throw new SpendRefused('window_calls', `${w.calls} paid call(s) in the last ${policy.windowSeconds}s already (limit ${policy.maxWindowCalls})`, s);
    }
    const id = d.next;
    d.rows.push({ id, ts: now, provider: String(provider).toLowerCase(), capability: String(capability), cents, txid: '', http: null, state: 'reserved' });
    d.next = id + 1;
    this._save(d);
    return id;
  }

  /** The money moved: record the txid, later the HTTP status the provider answered with (0 = no answer). */
  settle(id, { txid, http } = {}) {
    const d = this._load();
    const r = d.rows.find((x) => x.id === id);
    if (!r) return;
    r.state = 'sent';
    if (txid) r.txid = String(txid).toLowerCase();
    if (http != null) r.http = http;
    this._save(d);
  }

  /** Nothing was signed: the reservation no longer counts. */
  void(id) {
    const d = this._load();
    const r = d.rows.find((x) => x.id === id);
    if (!r) return;
    r.state = 'void';
    this._save(d);
  }

  /** Newest first. */
  history(limit = 20) {
    return this._load().rows.slice(-limit).reverse().map((r) => ({ ...r }));
  }
}
