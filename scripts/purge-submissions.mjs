// scripts/purge-submissions.mjs — one-off maintenance: remove stored open-submissions that no longer
// pass validation (e.g. legacy rows with an empty payTo). These are already hidden from every read
// surface (getListings filters them), but this physically removes them from Redis.
//
// Run it with the Upstash REST creds in the environment. Easiest:
//   vercel env pull .env.local
//   node --env-file=.env.local scripts/purge-submissions.mjs            # dry-run: shows what WOULD go
//   node --env-file=.env.local scripts/purge-submissions.mjs --apply    # actually writes
//
// You can also drop specific ids regardless of validity:
//   node --env-file=.env.local scripts/purge-submissions.mjs --apply --id sub_mrt9055q --id sub_mrt9oawk
import { validateListing } from '../lib/x402catalog.js';

const KEY = 'x402:submissions';
const apply = process.argv.includes('--apply');
const ids = process.argv.reduce((a, v, i, arr) => (v === '--id' && arr[i + 1] ? [...a, arr[i + 1]] : a), []);

// same generic credential discovery as lib/registry.js (plain or prefixed, e.g. STORAGE2_)
function findRestCreds() {
  const keys = Object.keys(process.env);
  const urlKey =
    keys.find((k) => k === 'KV_REST_API_URL') ||
    keys.find((k) => k === 'UPSTASH_REDIS_REST_URL') ||
    keys.find((k) => k.endsWith('KV_REST_API_URL')) ||
    keys.find((k) => k.endsWith('UPSTASH_REDIS_REST_URL'));
  if (!urlKey) return null;
  const prefix = urlKey.replace(/(KV_REST_API_URL|UPSTASH_REDIS_REST_URL)$/, '');
  const url = process.env[urlKey];
  const token = process.env[prefix + 'KV_REST_API_TOKEN'] || process.env[prefix + 'UPSTASH_REDIS_REST_TOKEN'];
  return url && token ? { url, token } : null;
}

const creds = findRestCreds();
if (!creds) {
  console.error('No Upstash REST creds in env. Run `vercel env pull .env.local` and pass --env-file=.env.local.');
  process.exit(1);
}

const { Redis } = await import('@upstash/redis');
const redis = new Redis(creds);

const subs = (await redis.get(KEY)) || [];
const isBad = (l) => (ids.length ? ids.includes(l.id) : false) || !validateListing(l).ok;
const keep = subs.filter((l) => !isBad(l));
const drop = subs.filter((l) => isBad(l));

console.log(`submissions: ${subs.length}  keep: ${keep.length}  drop: ${drop.length}`);
for (const d of drop) console.log(`  DROP ${d.id}  ${d.serviceName || d.capability || '?'}  payTo=${JSON.stringify(d.payTo)}`);

if (!drop.length) { console.log('nothing to purge.'); process.exit(0); }
if (!apply) { console.log('\ndry-run — re-run with --apply to write the change.'); process.exit(0); }

await redis.set(KEY, keep);
console.log(`\npurged ${drop.length}. remaining submissions: ${keep.length}`);
