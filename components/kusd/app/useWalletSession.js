// The open wallet, in page memory only: the 64-hex secret and the derived {address, xonly}. Shared by
// /kusd/app and /kusd/market. The secret leaves memory after IDLE_LOCK_MS without input (including while the
// page is hidden), or when the page locks it.
import { useCallback, useEffect, useRef, useState } from 'react';

export const IDLE_LOCK_MS = 15 * 60 * 1000;

export default function useWalletSession(k) {
  const [secret, setSecret] = useState(null);
  const [wallet, setWallet] = useState(null);
  const lastActive = useRef(Date.now());

  const lock = useCallback(() => {
    setSecret(null);
    setWallet(null);
  }, []);
  const open = useCallback((s) => {
    setWallet(k.walletOf(s));
    setSecret(s);
    lastActive.current = Date.now();
  }, [k.walletOf]);

  useEffect(() => {
    if (!secret) return undefined;
    const touch = () => { lastActive.current = Date.now(); };
    const check = () => { if (Date.now() - lastActive.current > IDLE_LOCK_MS) lock(); };
    const events = ['pointerdown', 'keydown'];
    events.forEach((e) => window.addEventListener(e, touch));
    document.addEventListener('visibilitychange', check);
    const id = setInterval(check, 30_000);
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener('visibilitychange', check);
      clearInterval(id);
    };
  }, [secret, lock]);

  return { secret, wallet, open, lock };
}
