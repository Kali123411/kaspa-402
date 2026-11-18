#!/usr/bin/env node
// Regenerate public/kusd/market-snapshot.json from a running k402 registry: what /kusd/market shows when the
// registry cannot be reached from the visitor's browser (marked "snapshot from <time>", nothing payable).
//
//   node scripts/kusd-market-snapshot.mjs https://market.kaspa-402.org > public/kusd/market-snapshot.json
import { fetchActivity, fetchListings } from '../lib/kusd/market/registry.mjs';

const base = (process.argv[2] || 'https://market.kaspa-402.org').replace(/\/$/, '');
const [listed, activity] = await Promise.all([fetchListings(base), fetchActivity(base)]);
// the snapshot ships in the public bundle: only listings reachable from anywhere (https) belong in it
const providers = listed.filter((p) => /^https:\/\//i.test(p.endpoint));
if (providers.length !== listed.length) console.error(`dropped ${listed.length - providers.length} listing(s) with non-https endpoints from the snapshot`);
const out = { generatedAt: new Date().toISOString(), providers, activity };   // no registry URL: the page names its own
process.stdout.write(`${JSON.stringify(out, null, 1)}\n`);
