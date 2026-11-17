# kUSD state relay

A public, **untrusted** cache of where the kUSD protocol's covenant boxes are right now (oracle, PSM,
budget, token authority, surplus) and of each user's own kUSD and vault boxes. It exists because a
covenant box's state is hidden inside its script hash until it is spent, and nothing on chain indexes
"the box this covenant became".

An entry is stored only after the public TN10 API confirms that its address is the P2SH of its claimed
state (recomputed with the pinned kusd-client WASM), that the creating output carries the pinned
covenant ID and the claimed value, and that it is unspent. Browsers re-verify what they read, so the
relay can be slow or down but cannot make the app sign against a false state.

The TN10 API lags the node by up to a minute, so an entry it cannot confirm yet (transaction not
indexed, or output not in the address index) is answered `queued: true` and re-checked here: after
5 s, then at doubling intervals up to 30 s, for 5 minutes. The queue holds at most 64 entries, 8 per
posting client, keyed by the whole claimed entry (a forged copy can't take an honest one's slot); when
it is full, the creators' own retries (page and driver) still apply. The queue lives in memory, so a
restart drops it.

- `GET /health` (`{ok, entries, queued}`), `GET /state[?owner=<64-hex x-only key>]`, `POST /state {"entries": [...]}` (≤ 16).
- Runs on murr7800: `systemctl --user status kusd-relay`, logs `journalctl --user -u kusd-relay`,
  LAN `http://192.168.4.25:8735`.
- Install or update: `services/kusd-relay/install.sh` (copies everything into
  `~/.local/share/kusd-relay`, keeps `store.json`, refuses if anything still points into a checkout),
  then `systemctl --user restart kusd-relay`.
- Public URL (owner step, once): Cloudflare dashboard → Zero Trust → Networks → Tunnels → the tunnel
  already running on murr7800 → Public Hostname → `kusd.kaspa-402.org` → `http://localhost:8735`.
- New covenant family: rebuild `public/kusd/snapshot.json` (its covids are the pins), re-run the
  installer, and clear `store.json`.
