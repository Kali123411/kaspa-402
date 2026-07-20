// pages/api/registry/health.js — reports the registry storage backend + connectivity (read-only).
import { storageInfo } from '../../../lib/registry';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.status(200).json(await storageInfo());
}
