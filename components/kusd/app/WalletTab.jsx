// Create, import, unlock and export the TN10 wallet. The key is stored only as a passphrase-sealed blob
// in this browser; the open key lives in page memory until the wallet locks.
import { useState } from 'react';
import { Copy, Check, Download, Eye, Lock, Droplets, KeyRound } from 'lucide-react';
import { newSecret, sealSecret, openSecret } from '../../../lib/kusd/app/keystore.mjs';
import { parseUsd } from '../../../lib/kusd/app/amounts.mjs';
import { recipientKey } from '../../../lib/kusd/app/recipient.mjs';
import { readStored, writeStored, NODE_KEY } from './useKusd';
import { input, primary, secondary, kasText, usdText, Panel, AmountForm } from './ui';

export const WALLET_KEY = 'kusd.wallet.v1';
const FAUCET = 'https://faucet-tn10.kaspanet.io/';

export function storedWallet() {
  try { return JSON.parse(readStored(WALLET_KEY) || 'null'); } catch { return null; }
}

function CopyButton({ value, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); setDone(true); setTimeout(() => setDone(false), 1500); } catch { /* clipboard blocked */ }
  };
  return (
    <button type="button" onClick={copy} className={secondary}>
      {done ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />} {done ? 'Copied' : label}
    </button>
  );
}

function NewWallet({ k, onOpen }) {
  const [mode, setMode] = useState('create');
  const [hex, setHex] = useState('');
  const [pass, setPass] = useState('');
  const [again, setAgain] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const ready = !!k.kc();

  const submit = async (e) => {
    e.preventDefault();
    setErr(null);
    if (pass !== again) return setErr('the two passphrases differ');
    setBusy(true);
    try {
      let secret;
      if (mode === 'create') secret = newSecret(k.kc().wallet);
      else {
        secret = hex.trim().toLowerCase();
        if (!/^[0-9a-f]{64}$/.test(secret)) throw new Error('a wallet key is 64 hex characters');
        k.walletOf(secret);
      }
      const blob = await sealSecret(secret, pass);
      writeStored(WALLET_KEY, JSON.stringify(blob));
      onOpen(secret);
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };

  const importFile = async (file) => {
    setErr(null);
    try {
      const blob = JSON.parse(await file.text());
      if (blob?.v !== 1 || !blob.ct) throw new Error();
      writeStored(WALLET_KEY, JSON.stringify(blob));
      onOpen(null);
    } catch {
      setErr('that file is not a kUSD wallet file');
    }
  };

  return (
    <Panel title="Set up a TN10 wallet">
      <div className="flex flex-wrap gap-2">
        {[['create', 'Create new'], ['import', 'Import key'], ['file', 'Open wallet file']].map(([m, label]) => (
          <button key={m} type="button" onClick={() => setMode(m)} className={`rounded-full px-3 py-1 text-xs ${mode === m ? 'bg-neon-purple text-black' : 'border border-gray-700 text-gray-300'}`}>{label}</button>
        ))}
      </div>
      {mode === 'file' ? (
        <label className="block text-sm text-gray-400">
          A <span className="font-mono">kusd-wallet-tn10.json</span> exported from this app:
          <input type="file" accept="application/json,.json" className="mt-2 block w-full min-w-0 text-sm text-gray-300" onChange={(e) => e.target.files?.[0] && importFile(e.target.files[0])} />
        </label>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          {mode === 'import' && (
            <input className={input} value={hex} onChange={(e) => setHex(e.target.value)} placeholder="64-hex wallet key" autoComplete="off" spellCheck={false} />
          )}
          <input className={input} type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="passphrase (8+ characters)" autoComplete="new-password" />
          <input className={input} type="password" value={again} onChange={(e) => setAgain(e.target.value)} placeholder="passphrase again" autoComplete="new-password" />
          <button type="submit" className={primary} disabled={!ready || busy || pass.length < 8}>
            <KeyRound className="h-4 w-4" aria-hidden /> {busy ? 'Sealing…' : mode === 'create' ? 'Create wallet' : 'Import wallet'}
          </button>
        </form>
      )}
      {err && <p className="text-sm text-red-400">{err}</p>}
      <p className="text-xs text-gray-500">
        The key is made in this browser and stored here only, sealed with your passphrase. There is no recovery: export the wallet
        file and keep the passphrase.
      </p>
    </Panel>
  );
}

/** Unlock the stored wallet with its passphrase; shared with /kusd/market. */
export function UnlockForm({ k, onOpen, onForget }) {
  const [pass, setPass] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      onOpen(await openSecret(storedWallet(), pass));
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  const forget = () => {
    if (window.confirm('Remove the wallet from this browser? Without an exported wallet file its kUSD and KAS are lost.')) onForget();
  };
  return (
    <Panel title="Unlock your wallet">
      <form onSubmit={submit} className="space-y-3">
        <input className={input} type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="passphrase" autoComplete="current-password" autoFocus />
        <div className="flex flex-wrap gap-2">
          <button type="submit" className={primary} disabled={busy || !pass || !k.kc()}>{busy ? 'Unlocking…' : k.kc() ? 'Unlock' : 'Loading the wallet code…'}</button>
          <button type="button" className={secondary} onClick={forget}>Remove from this browser</button>
        </div>
      </form>
      {err && <p className="text-sm text-red-400">{err}</p>}
    </Panel>
  );
}

function NodeSetting({ k }) {
  const [url, setUrl] = useState(() => readStored(NODE_KEY) || '');
  const save = (value) => {
    writeStored(NODE_KEY, value || null);
    setUrl(value);
    k.connect();
  };
  return (
    <Panel title="Node">
      <p className="text-xs text-gray-500">By default the page picks a public TN10 node through the Kaspa resolver. Use your own node&apos;s wRPC (Borsh) address instead:</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input className={input} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="wss://your-node:17210" spellCheck={false} />
        <div className="flex gap-2">
          <button type="button" className={secondary} onClick={() => save(url.trim())} disabled={!/^wss?:\/\/\S+$/.test(url.trim())}>Use</button>
          <button type="button" className={secondary} onClick={() => save('')}>Resolver</button>
        </div>
      </div>
    </Panel>
  );
}

function SendPanel({ k, wallet, review }) {
  const [to, setTo] = useState('');
  const [err, setErr] = useState(null);
  const holders = k.chain?.holders || [];
  const total = holders.reduce((s, h) => s + h.state.amount, 0);
  const send = (text) => {
    setErr(null);
    try {
      const key = to.trim() === 'me' ? wallet.xonly : recipientKey(to, k.scriptOf);
      const cents = parseUsd(text);
      if (cents > total) throw new Error(`you hold ${usdText(total)}`);
      const who = key === wallet.xonly ? 'yourself (a new box)' : `${key.slice(0, 8)}…`;
      review.start('send', { holders, to: key, cents }, `Send ${usdText(cents)} to ${who}`);
    } catch (e) {
      setErr(e.message);
    }
  };
  return (
    <Panel title="Send kUSD">
      <input className={input} value={to} onChange={(e) => setTo(e.target.value)} placeholder="kaspatest: address, or me" spellCheck={false} autoComplete="off" />
      <AmountForm placeholder="kUSD to send" disabled={!k.canAct.ok || holders.length === 0} onReview={send} />
      <p className="text-xs text-gray-500">Sending to <span className="font-mono">me</span> splits your kUSD into a box of exactly that amount — for a partial redeem or an exact repay.</p>
      {err && <p className="text-sm text-red-400">{err}</p>}
    </Panel>
  );
}

export default function WalletTab({ k, secret, wallet, onOpen, onLock, review }) {
  const [stored, setStored] = useState(() => storedWallet());
  const [shown, setShown] = useState(false);
  const open = (s) => {
    setStored(storedWallet());
    if (s) onOpen(s);
  };
  const forget = () => {
    writeStored(WALLET_KEY, null);
    setStored(null);
    onLock();
  };

  if (!stored) return <div className="space-y-4"><NewWallet k={k} onOpen={open} /><NodeSetting k={k} /></div>;
  if (!secret || !wallet) return <div className="space-y-4"><UnlockForm k={k} onOpen={open} onForget={forget} /><NodeSetting k={k} /></div>;

  const kasBalance = k.coins.reduce((s, c) => s + c.entry.amount, 0);
  const kusdBalance = (k.chain?.holders || []).reduce((s, h) => s + h.state.amount, 0);
  const exportFile = () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(stored, null, 2)], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'kusd-wallet-tn10.json' });
    a.click();
    URL.revokeObjectURL(url);
  };
  const faucet = async () => {
    try { await navigator.clipboard.writeText(wallet.address); } catch { /* clipboard blocked */ }
    window.open(FAUCET, '_blank', 'noopener,noreferrer');
  };
  const reveal = () => {
    if (shown) return setShown(false);
    if (window.confirm('Show the wallet key? Anyone who sees it controls this wallet.')) setShown(true);
  };

  return (
    <div className="space-y-4">
      <Panel title="Your wallet">
        <p className="break-all font-mono text-sm text-gray-200">{wallet.address}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-black/30 p-3">
            <div className="text-xs uppercase tracking-wider text-gray-500">KAS</div>
            <div className="mt-1 font-mono text-lg text-white">{kasText(kasBalance)}</div>
          </div>
          <div className="rounded-lg bg-black/30 p-3">
            <div className="text-xs uppercase tracking-wider text-gray-500">kUSD</div>
            <div className="mt-1 font-mono text-lg text-white">{usdText(kusdBalance)}</div>
            <div className="text-xs text-gray-500">{(k.chain?.holders || []).length} box{(k.chain?.holders || []).length === 1 ? '' : 'es'}</div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <CopyButton value={wallet.address} label="Copy address" />
          <button type="button" className={secondary} onClick={faucet}><Droplets className="h-4 w-4" aria-hidden /> Get test KAS</button>
          <button type="button" className={secondary} onClick={exportFile}><Download className="h-4 w-4" aria-hidden /> Export wallet file</button>
          <button type="button" className={secondary} onClick={reveal}><Eye className="h-4 w-4" aria-hidden /> {shown ? 'Hide key' : 'Show key'}</button>
          <button type="button" className={secondary} onClick={onLock}><Lock className="h-4 w-4" aria-hidden /> Lock</button>
        </div>
        {shown && <p className="break-all rounded-lg border border-red-500/40 bg-red-950/30 p-3 font-mono text-xs text-red-200">{secret}</p>}
        <p className="text-xs text-gray-500">&ldquo;Get test KAS&rdquo; copies your address and opens the official TN10 faucet. Paste it there.</p>
      </Panel>
      <SendPanel k={k} wallet={wallet} review={review} />
      <NodeSetting k={k} />
    </div>
  );
}
