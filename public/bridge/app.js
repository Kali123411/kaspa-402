/* Kaspa-402 Bridge — functional frontend logic.
   ETH side: MetaMask + ethers, real EthKaspaEscrow.lock().
   KAS side: KasWare (window.kasware) — connect, x-only pubkey (used as the ETH lock recipient), balance.
   The KAS->ETH covenant burn is PERMISSIONLESS (keyless) AND self-serve: the minter burn leg needs NO governance
   key (structural anti-mint check — a burn can only reduce supply), and the note owner signs their own note IN THE
   BROWSER via kasware.signPskt, which signs P2SH covenant inputs with a covenant-aware Toccata sighash (measured
   2026-07-31). The burn-service builds the co-spend but holds NO KEYS and engine-verifies before broadcasting.
   Afterwards a ~1-3h sparse-anchor finality proof (inherent to trustless finality, not a permission) lets the
   escrow release the ETH — self-verifying, so anyone can produce and submit it.
*/
const CFG = window.BRIDGE_CONFIG;
const $ = (id) => document.getElementById(id);
const state = { dir: "e2k", eth: null, escrow: null, kasAddr: null, kasPk: null };

function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(t._t); t._t = setTimeout(() => t.classList.remove("show"), 2200);
}
function shorten(s, n = 8) { return s.length > 2 * n + 3 ? s.slice(0, n) + "…" + s.slice(-n) : s; }
function xonly32(pkHex) { // KasWare may return 33-byte compressed or 32-byte x-only; keep the last 32 bytes
  const h = pkHex.replace(/^0x/, ""); return "0x" + (h.length >= 64 ? h.slice(-64) : h.padStart(64, "0"));
}

/* ---------------- MetaMask (ETH) ---------------- */
// Ensure MetaMask is on the escrow's chain. Called at lock-time, NOT at connect, so connecting never
// fails on a chain mismatch. Adds the chain if MetaMask doesn't know it (error 4902).
async function ensureChain() {
  const want = CFG.eth.chainId.toLowerCase();
  const have = (await window.ethereum.request({ method: "eth_chainId" })).toLowerCase();
  if (have === want) return true;
  try {
    await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: CFG.eth.chainId }] });
    return true;
  } catch (e) {
    // chainId 0x1 (Ethereum mainnet) is always known to MetaMask, so 4902 shouldn't fire; handle it generically.
    if (e && e.code === 4902) { toast("Add the " + CFG.eth.chainName + " network in MetaMask to deposit"); return false; }
    toast("Switch MetaMask to " + CFG.eth.chainName + " to deposit (that's where the escrow lives)");
    return false;
  }
}
async function connectMetaMask() {
  if (!window.ethereum) { toast("MetaMask not found — install the extension"); return; }
  if (typeof window.ethers === "undefined") { toast("ethers.js didn't load (network/CSP) — vendor it locally, see README"); return; }
  try {
    const accts = await window.ethereum.request({ method: "eth_requestAccounts" });
    if (!accts || !accts.length) { toast("No account returned by MetaMask"); return; }
    const provider = new ethers.BrowserProvider(window.ethereum);
    const signer = await provider.getSigner();
    state.eth = { addr: accts[0], signer, provider };
    state.escrow = new ethers.Contract(CFG.eth.escrow, CFG.eth.escrowAbi, signer);
    setPill("ethPill", "Ξ " + shorten(accts[0], 5), true);
    $("ethConnect").title = "Connected " + accts[0] + " — click to disconnect";
    // the user's actual ETH balance (this is what the ETH leg shows — not the KAS balance)
    try { state.eth.balance = await provider.getBalance(accts[0]); } catch {}
    // read escrow state on whatever chain we're on; if the escrow isn't there it just shows a hint
    const net = await provider.getNetwork();
    if ("0x" + net.chainId.toString(16) !== CFG.eth.chainId.toLowerCase())
      $("escrowTvl").textContent = "on " + net.name + " — switch to " + CFG.eth.chainName + " to deposit";
    else { try { const tl = await state.escrow.totalLocked(); $("escrowTvl").textContent = ethers.formatEther(tl) + " ETH locked"; } catch {} }
    if (state.dir === "k2e" && !$("recip").value) $("recip").value = accts[0];
    refreshBalances(); updateCTA();
  } catch (e) {
    toast(e && e.code === 4001 ? "Connection rejected in MetaMask" : ("MetaMask error: " + (e && (e.message || e.code) || "unknown")));
  }
}
async function disconnectMetaMask() {
  try { await window.ethereum.request({ method: "wallet_revokePermissions", params: [{ eth_accounts: {} }] }); } catch {}
  state.eth = null; state.escrow = null;
  setPill("ethPill", "Connect MetaMask", false);
  $("ethConnect").title = "";
  $("escrowTvl").textContent = "—";
  refreshBalances(); updateCTA();
  toast("MetaMask disconnected");
}

/* ---------------- KasWare (KAS) ---------------- */
async function connectKasWare() {
  if (!window.kasware) { toast("KasWare not found — install the extension"); return; }
  try {
    const accts = await window.kasware.requestAccounts();
    let net = null; try { net = await window.kasware.getNetwork(); } catch {}
    if (net && net !== CFG.kaspa.network) {
      try { await window.kasware.switchNetwork(CFG.kaspa.network); } catch { toast(`Switch KasWare to ${CFG.kaspa.network}`); }
    }
    state.kasAddr = accts[0];
    try { state.kasPk = await window.kasware.getPublicKey(); } catch {}
    setPill("kasPill", `K ${shorten(accts[0], 6)}`, true);
    try {
      const bal = await window.kasware.getBalance();   // {confirmed, unconfirmed, total} in sompi
      const kas = (Number((bal && (bal.total ?? bal.confirmed)) || 0) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 4 });
      state.kasBalance = kas + " KAS";   // KAS is the gas asset, shown on the KasWare button (hover); not a leg balance
      $("kasConnect").title = `${accts[0]} · ${state.kasBalance} · click to disconnect`;
    } catch { $("kasConnect").title = accts[0] + " — click to disconnect"; }
    // KasWare gives us the Kaspa recipient pubkey for the ETH->Kaspa lock
    if (state.dir === "e2k" && state.kasPk) { $("recip").value = xonly32(state.kasPk); }
    refreshWethBalance();
    refreshBalances(); updateCTA();
  } catch (e) { toast("KasWare connection rejected"); }
}
async function disconnectKasWare() {
  try { if (window.kasware && window.kasware.disconnect) await window.kasware.disconnect(window.location.origin); } catch {}
  state.kasAddr = null; state.kasPk = null; state.kasBalance = null; state.wethBalance = null;
  setPill("kasPill", "Connect KasWare", false);
  $("kasConnect").title = "";
  refreshBalances(); refreshWethBalance(); updateCTA();
  toast("KasWare disconnected");
}
// Show each leg's OWN asset balance: e2k -> From=ETH, To=wETH ; k2e -> From=wETH, To=ETH.
function fmtEth(wei) { try { return Number(ethers.formatEther(wei)).toLocaleString(undefined, { maximumFractionDigits: 5 }) + " ETH"; } catch { return ""; } }
function refreshBalances() {
  const ethB = state.eth && state.eth.balance != null ? "Balance " + fmtEth(state.eth.balance) : "";
  const wethB = state.kasAddr ? "Balance " + (state.wethBalance || "— wETH") : "";
  const fb = $("fromBal"), tb = $("toBal");
  if (!fb || !tb) return;
  if (state.dir === "e2k") { fb.textContent = ethB; tb.textContent = wethB; }
  else { fb.textContent = wethB; tb.textContent = ethB; }
}

// wETH balance — canonical KCC20 covenant notes minted by proof. No wallet indexes silverscript-KCC20 yet,
// so we scope the bridge's own mints to the connected owner pubkey and verify each note UTXO is still held.
// Bridge status strip: relayer health, checkpoint age (the v1.1 permissionless-refresh heartbeat),
// pending claims. Renders into #bridgeStatus if the element exists (added by index.html v1.1).
async function refreshBridgeStatus() {
  const el = $("bridgeStatus"); if (!el || !CFG.relayer) return;
  const base = CFG.relayer.replace(/\/$/, "");
  try {
    const [h, ck, claims] = await Promise.all([
      fetch(`${base}/health`).then((r) => r.json()),
      fetch(`${base}/checkpoint`).then((r) => r.json()),
      fetch(`${base}/claims`).then((r) => r.json()),
    ]);
    const ageH = ck.lastRefreshAt ? ((Date.now() - Date.parse(ck.lastRefreshAt)) / 3600e3) : null;
    const fresh = ageH != null && ageH < 12;
    const pend = Object.values(claims || {}).filter((c) => c.state === "queued").length;
    const provers = (ck.provers || []).map((p) => `${p.name}(${p.mode}${p.busy ? "·busy" : ""})`).join(", ");
    el.innerHTML =
      `<span class="chip ${h.healthy ? "ok" : "no"}">relayer ${h.healthy ? "healthy" : "degraded"} · ${h.role}</span> `
      + `<span class="chip ${fresh ? "ok" : "warn"}" title="trusted ${ck.trusted?.slice(0, 12)}… — refreshed by PROOF, no owner">`
      + `checkpoint ${ageH != null ? ageH.toFixed(1) + "h" : "?"} old</span> `
      + `<span class="chip">${pend} claim${pend === 1 ? "" : "s"} queued</span> `
      + `<span class="chip" title="prover pool">${provers}</span>`;
  } catch { el.innerHTML = `<span class="chip warn">relayer unreachable — read-only on-chain view</span>`; }
}
setInterval(refreshBridgeStatus, 30_000);

// Live source: the relayer's /notes endpoint if configured, else the baked config list. Set once at load.
async function loadWethNotes() {
  const base = CFG.relayer;
  if (!base) { state.wethMints = (CFG.weth && CFG.weth.mints) || []; return; }
  try {
    const r = await fetch(base.replace(/\/$/, "") + "/notes");
    if (r.ok) { const d = await r.json(); if (Array.isArray(d.notes)) { state.wethMints = d.notes; renderWethPanel(); refreshWethBalance(); return; } }
  } catch {}
  state.wethMints = (CFG.weth && CFG.weth.mints) || [];   // fallback if the relayer is unreachable
}
function wethScope() {
  const mints = state.wethMints || (CFG.weth && CFG.weth.mints) || [];
  const pk = state.kasPk ? xonly32(state.kasPk).slice(2).toLowerCase() : null;
  const mine = mints.filter(m => (pk && (m.recipient || "").toLowerCase() === pk) || (state.kasAddr && m.recipientAddr === state.kasAddr));
  return { mints, mine, pk };
}
function refreshWethBalance() {
  if (!state.kasAddr) { state.wethBalance = null; refreshBalances(); renderWethPanel(); return; }
  const { mine } = wethScope();
  const sum = mine.reduce((a, m) => a + parseFloat(m.amountEth || "0"), 0);
  state.wethBalance = mine.length ? sum.toLocaleString(undefined, { maximumFractionDigits: 6 }) + " wETH" : "0 wETH";
  refreshBalances(); renderWethPanel();
}
// Live proof-of-holding: is the note's exact outpoint still an unspent UTXO at its covenant address?
async function noteHeld(m) {
  try {
    const r = await fetch(`${CFG.kaspa.apiBase}/addresses/${m.noteAddr}/utxos`);
    if (!r.ok) return null;
    const u = await r.json();
    return Array.isArray(u) && u.some(x => x.outpoint && x.outpoint.transactionId === m.noteTxid && Number(x.outpoint.index) === m.noteIdx);
  } catch { return null; }
}
function renderWethPanel() {
  const panel = $("wethPanel"), list = $("wethList"); if (!panel || !list) return;
  const { mints, mine, pk } = wethScope();
  const connected = !!state.kasAddr;
  const show = connected && mine.length ? mine : mints;   // once connected with mints, focus on yours
  if (!show.length) { panel.style.display = "none"; return; }
  panel.style.display = "";
  $("wethScope").textContent = connected
    ? (mine.length ? `· ${state.wethBalance} held by ${shorten(state.kasAddr, 7)}` : `· none for ${shorten(state.kasAddr, 7)} — showing all mints`)
    : "";
  const kx = (t) => `${CFG.kaspa.explorer}/txs/${t}`;
  list.innerHTML = show.map((m, i) => {
    const isMine = (pk && (m.recipient || "").toLowerCase() === pk) || (state.kasAddr && m.recipientAddr === state.kasAddr);
    return `<div class="wnote" data-i="${i}">
      <div class="top"><div class="bal">${m.amountEth}<small>wETH</small></div><span class="live loading" data-live>checking…</span></div>
      <dl>
        <dt>owner</dt><dd class="${isMine ? "mine" : ""}" title="${m.recipientAddr}">${isMine ? "you · " : ""}${shorten(m.recipientAddr, 8)}</dd>
        <dt>note</dt><dd><a href="${kx(m.noteTxid)}" target="_blank" rel="noopener" title="${m.noteTxid}:${m.noteIdx}">${shorten(m.noteTxid)}:${m.noteIdx} ↗</a></dd>
        <dt>mint tx</dt><dd><a href="${kx(m.mintTxid)}" target="_blank" rel="noopener" title="${m.mintTxid}">${shorten(m.mintTxid)} ↗</a></dd>
        ${m.ethTxid
          ? `<dt>backing</dt><dd><a href="${CFG.eth.explorer}/tx/${m.ethTxid}" target="_blank" rel="noopener" title="ETH deposit #${m.ethDepositId} — ${m.ethTxid}">ETH deposit #${m.ethDepositId} ↗</a></dd>`
          : `<dt>template</dt><dd><a href="${kx(m.mintTxid)}" target="_blank" rel="noopener" title="DEX-canonical KCC20 (silverscript 2a3961c) — genesis ${m.mintTxid}">DEX-canonical · genesis ${shorten(m.mintTxid)} ↗</a></dd>`}
        ${m.burnTxid
          ? `<dt>burn tx</dt><dd><a href="${kx(m.burnTxid)}" target="_blank" rel="noopener" title="value-absorption burn — the note is destroyed, the registry absorbs the exact amount — ${m.burnTxid}">${shorten(m.burnTxid)} ↗</a></dd>` : ""}
        ${m.unlockEthTxid
          ? `<dt>unlock</dt><dd><a href="${CFG.eth.explorer}/tx/${m.unlockEthTxid}" target="_blank" rel="noopener" title="ETH released on mainnet against the burn's finality proof — ${m.unlockEthTxid}">ETH released ↗</a></dd>` : ""}
      </dl></div>`;
  }).join("");
  show.forEach(async (m, i) => {
    const el = list.querySelector(`[data-i="${i}"] [data-live]`); if (!el) return;
    const held = await noteHeld(m);
    // a spent note with a recorded burn is the SUCCESS path (destroyed via the value-absorption registry)
    const burned = held === false && m.burnTxid;
    el.className = "live " + (held === true ? "ok" : burned ? "ok" : held === false ? "spent" : "loading");
    el.textContent = held === true ? "held on-chain ✓"
      : burned ? (m.unlockEthTxid ? "burned → ETH unlocked ✓" : "burned ✓")
      : held === false ? "spent" : "unverified";
  });
}

/* ---------------- ETH -> Kaspa: lock ---------------- */
async function doLock() {
  if (!state.escrow) { toast("Connect MetaMask first"); return; }
  const amtStr = $("amount").value.trim();
  let recipient = $("recip").value.trim();
  if (!recipient && state.kasPk) recipient = xonly32(state.kasPk);
  if (!recipient) { toast("Enter a Kaspa recipient (or connect KasWare)"); return; }
  // accept a raw 32-byte hex pubkey; a full kaspa: address would need bech32 decode to the x-only payload
  if (!/^0x[0-9a-fA-F]{64}$/.test(recipient)) { toast("Recipient must be a 32-byte x-only pubkey (0x…64 hex). Use KasWare to autofill."); return; }
  let value; try { value = ethers.parseEther(amtStr); } catch { toast("Invalid amount"); return; }
  if (value <= 0n) { toast("Amount must be > 0"); return; }
  if (!(await ensureChain())) return;
  // refresh signer/contract after a possible chain switch
  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  state.eth.signer = signer; state.escrow = new ethers.Contract(CFG.eth.escrow, CFG.eth.escrowAbi, signer);
  try {
    setBusy(true, "Confirm in MetaMask…");
    const tx = await state.escrow.lock(recipient, { value });
    setBusy(true, "Locking ETH…");
    const rc = await tx.wait();
    setBusy(false);
    showResult("ETH locked ✓", `Deposit tx <a href="${CFG.eth.explorer}/tx/${rc.hash}" target="_blank" rel="noopener">${shorten(rc.hash)}</a> confirmed. `
      + `A relayer will prove the deposit (SP1 Helios) and mint wETH to your Kaspa address — ~${CFG.finality.seconds}s finality after the proof lands.`);
    try { const tl = await state.escrow.totalLocked(); $("escrowTvl").textContent = ethers.formatEther(tl) + " ETH locked"; } catch {}
  } catch (e) {
    setBusy(false); toast(e && e.shortMessage ? e.shortMessage : "Lock reverted / rejected");
  }
}

/* ---------------- Kaspa -> ETH: burn ---------------- */
// Pull the 64-byte schnorr signature out of a signed input's sig-script (canonical push: 0x41 ‖ sig ‖ type).
function sigFromSignedTx(signedJson, idx) {
  const t = typeof signedJson === "string" ? JSON.parse(signedJson) : signedJson;
  const inp = (t.inputs || t.transaction?.inputs || [])[idx];
  const ss = (inp && inp.signatureScript || "").replace(/^0x/, "");
  if (!ss) return null;
  if (ss.length >= 132 && ss.slice(0, 2) === "41") return ss.slice(2, 130);
  if (ss.length === 130) return ss.slice(0, 128);
  return null;
}
// A note is keyless-burnable only if the connected wallet owns it AND it was minted by the
// permissionless stack (the older stack's minter still requires a governance signature).
function burnableNote() {
  const pk = state.kasPk ? xonly32(state.kasPk).slice(2).toLowerCase() : null;
  if (!pk) return null;
  const mints = state.wethMints || (CFG.weth && CFG.weth.mints) || [];
  return mints.find(m =>
    (m.recipient || "").toLowerCase() === pk && m.permissionless && !m.burnTxid) || null;
}

async function doBurn() {
  if (!state.kasAddr) { toast("Connect KasWare first"); return; }
  const svc = CFG.fee.burnService;
  let ethRecipient = $("recip").value.trim();
  if (!ethRecipient && state.eth) ethRecipient = state.eth.addr;
  if (!/^0x[0-9a-fA-F]{40}$/.test(ethRecipient)) { toast("Enter an Ethereum recipient (0x…40 hex) or connect MetaMask"); return; }

  if (!svc) return showResult("Burn service not configured",
    `The return leg is <b>keyless</b> — your wallet signs the burn directly and no operator key is involved — but this `
    + `page needs a burn-service endpoint to build the covenant transaction. Set <code>fee.burnService</code> in `
    + `<code>config.js</code>. The service holds no keys (see <code>frontend/burn-service/</code>).`);

  const note = burnableNote();
  if (!note) return showResult("No keyless-burnable note for this wallet",
    `Burning is keyless only for notes minted by the <b>permissionless</b> stack (minter `
    + `<code>${shorten(CFG.kaspa.permMinterCovid, 6)}</code>), whose burn leg needs no governance signature. `
    + `Notes from the earlier stack can't be burned this way. Lock ETH to mint a permissionless note first.`);

  const step = (n, msg) => showResult(`Burning — step ${n}/4`, msg);
  try {
    // 1. the user funds their own fee from their own UTXO, and gets their own change
    step(1, "Finding a funding UTXO at your Kaspa address…");
    const us = await (await fetch(`${CFG.kaspa.apiBase}/addresses/${state.kasAddr}/utxos`)).json();
    if (!us.length) throw new Error("no KAS UTXOs at your address to pay the network fee");
    const fund = us.map(u => ({ txid: u.outpoint.transactionId, idx: Number(u.outpoint.index), amount: Number(u.utxoEntry.amount) }))
                   .sort((a, b) => b.amount - a.amount)[0];

    // 2. the service builds the co-spend — it holds no key and cannot move anything on its own.
    //    NOTE: a burn destroys the WHOLE note (value absorption reads the amount from the note itself),
    //    so the amount burned is the note's amount, not whatever is typed in the amount box.
    step(2, `Building the burn co-spend — this burns your whole note of <b>${note.amountEth} wETH</b> `
      + `(a burn destroys the note; the registry absorbs exactly its amount). The service holds no keys.`);
    const pr = await fetch(`${svc.replace(/\/$/, "")}/prepare`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        noteTxid: note.noteTxid, noteIdx: note.noteIdx, noteValue: note.noteValueSompi || 40000000,
        noteOwner: note.recipient, noteAmount: note.units,
        ethRecipient: ethRecipient.replace(/^0x/, ""),
        fundTxid: fund.txid, fundIdx: fund.idx, fundAmount: fund.amount,
        fundOwner: xonly32(state.kasPk).slice(2),
      }),
    });
    const p = await pr.json();
    if (!pr.ok) throw new Error(p.error + (p.details ? ": " + p.details.join(", ") : ""));

    // 3. your wallet signs. Index 0 is the LEADER input — it carries the note-owner signature (kcc20's
    //    checkSigs runs in the leader script), index 4 is the funding input.
    step(3, `Approve in KasWare — signing input ${p.signIndices.join(" and ")} `
      + `(index 0 is the leader input that carries your note-owner signature).`);
    const signed = await window.kasware.signPskt({
      txJsonString: JSON.stringify(p.walletTx),
      options: { signInputs: p.signIndices.map(index => ({ index, sighashType: 1 })) },
    });
    const sigUser = sigFromSignedTx(signed, 0), sigFund = sigFromSignedTx(signed, 4);
    if (!sigUser || !sigFund) throw new Error("the wallet did not return signatures for both required inputs");

    // 4. submit — the service engine-verifies every input before it will broadcast
    step(4, "Verifying against the covenant engine and broadcasting…");
    const sr = await fetch(`${svc.replace(/\/$/, "")}/submit`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ spec: p.spec, sigUser, sigFund }),
    });
    const r = await sr.json();
    if (!sr.ok) throw new Error((r.error || "submit failed") + (r.detail ? " — " + r.detail.slice(-200) : ""));

    const kx = `${CFG.kaspa.explorer}/txs/${r.txid}`;
    showResult("Burn accepted ✓" + (r.dryRun ? " (dry run — not broadcast)" : ""),
      `Your wETH note is destroyed and the registry absorbed the exact amount. <b>No operator key was involved</b> — `
      + `you signed the burn yourself and the minter's burn leg is keyless.`
      + `<div style="margin:10px 0"><a href="${kx}" target="_blank" rel="noopener">${shorten(r.txid)} ↗</a></div>`
      + (r.job ? `<div id="proofBox"></div>` :
         `Next: the burn buries, then a sparse-anchor finality proof authorizes <code>unlock</code> on Ethereum, `
         + `releasing ETH to ${shorten(ethRecipient, 6)} once per nonce.`)
      + `<pre class="rec">${JSON.stringify(r.burnRecord, null, 2)}</pre>`);
    if (r.job) trackProof(svc, r.job.nonce, ethRecipient);
    // v1.1: also queue the burial-gated claim with the relayer (permissionless refresh + unlock)
    if (!r.dryRun && r.txid && r.burnRecord) {
      const q = await queueClaim({
        burnTxid: r.txid,
        acceptingBlock: r.acceptingBlock || r.burnRecord.acceptingBlock || "",
        recip: (r.burnRecord.ethRecipient || ethRecipient).replace(/^0x/, "").toLowerCase(),
        amount: String(r.burnRecord.amount || note.units),
        nonce: (r.burnRecord.nonce || "").replace(/^0x/, ""),
        prevAccRoot: r.burnRecord.prevAccRoot || undefined,
      });
      if (q && !q.error) toast("Claim queued — the relayer unlocks your ETH automatically once buried (~16h)");
    }
  } catch (e) {
    showResult("Burn failed", `${String(e.message || e)}`
      + `<p class="d" style="margin:8px 0 0">Nothing was broadcast unless a transaction id is shown above. The service `
      + `refuses to broadcast any transaction that fails local covenant-engine verification.</p>`);
  }
}


/* ---------------- finality-proof progress ----------------
   The burn is only half the story: a sparse-anchor proof of its ACCEPTANCE has to be produced before the
   escrow will release ETH. That takes tens of minutes, so show what is happening rather than a blank wait.
   The estimate is a budget, not a promise — it is recomputed from the server's real stage timings. */
const STAGE_LABEL = {
  burial:  "Waiting for the burn to bury under enough Kaspa blocks",
  extract: "Extracting the acceptance witness from a Kaspa node",
  window:  "Building the selected-chain window (120 headers)",
  prove:   "Generating the zero-knowledge finality proof",
  verify:  "Verifying the proof against the on-chain SP1 verifier",
};
function fmtLeft(sec) {
  if (sec <= 0) return "any moment";
  const m = Math.floor(sec / 60), s = sec % 60;
  return m >= 60 ? `~${Math.floor(m / 60)}h ${m % 60}m` : m ? `~${m}m ${String(s).padStart(2, "0")}s` : `~${s}s`;
}
async function queueClaim(burn) {
  // Register the burn with the relayer: it gates on real burial (chain blocks + blue work), builds the
  // witness-minimal finality proof, refreshes the checkpoint if needed, and submits the unlock.
  if (!CFG.relayer) return null;
  try {
    const r = await fetch(`${CFG.relayer.replace(/\/$/, "")}/claim`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify(burn) });
    return await r.json();
  } catch (e) { return { error: e.message }; }
}
async function trackProof(svc, nonce, ethRecipient) {
  const box = $("proofBox"); if (!box) return;
  let left = null, tick = null;
  const render = (j) => {
    const steps = (j.steps || []).map((st) => {
      const mark = st.state === "done" ? "✓" : st.state === "running" ? "◌" : st.state === "failed" ? "✗" : "·";
      const cls = st.state === "done" ? "ok" : st.state === "failed" ? "no" : "";
      const secs = st.seconds != null ? ` <span style="color:var(--faint)">${st.seconds}s</span>` : "";
      return `<div class="prow" style="padding:4px 2px"><span class="k" style="width:22px" class="${cls}">${mark}</span>`
           + `<span class="v" style="font-family:inherit">${STAGE_LABEL[st.name] || st.name}${secs}</span></div>`;
    }).join("");
    const head = j.state === "ready"
      ? `<b class="ok">Proof ready ✓</b> — your ETH release is authorized.`
      : j.state === "failed"
      ? `<b class="no">Proving failed.</b> Your burn is safely on-chain; the proof can be re-run — nothing is lost.`
      : `<b>Proving your release…</b> <span style="float:right;font-variant-numeric:tabular-nums">${fmtLeft(left ?? j.remainingSeconds)} remaining</span>`;
    box.innerHTML = `<div style="margin:12px 0 6px">${head}</div>${steps}`
      + (j.state === "ready"
          ? `<p class="d" style="margin:8px 0 0">The proof is verified on-chain. Releasing the ETH to `
            + `${shorten(ethRecipient, 6)} is fully <b>permissionless</b> in v1.1 — the relayer keeps the escrow `
            + `checkpoint fresh by proof (no owner involved) and submits the unlock once the burn is buried `
            + `(~16h). Track it in the claim queue below.</p>`
          : j.state === "failed"
          ? `<p class="d" style="margin:8px 0 0">${(j.error || "").slice(0, 200)}</p>`
          : `<p class="d" style="margin:8px 0 0">You can close this page — the proof continues on the server, and `
            + `your burn record (nonce above) is what authorizes the release.</p>`);
  };
  const poll = async () => {
    try {
      const j = await (await fetch(`${svc.replace(/\/$/, "")}/status?nonce=${nonce}`)).json();
      if (j.error) return;
      left = j.remainingSeconds; render(j);
      if (j.state === "ready" || j.state === "failed") { clearInterval(tick); return true; }
    } catch {}
    return false;
  };
  await poll();
  tick = setInterval(() => { if (left != null && left > 0) left--; const b = $("proofBox"); if (b && left != null) {
    const span = b.querySelector("span[style*='tabular-nums']"); if (span) span.textContent = `${fmtLeft(left)} remaining`; } }, 1000);
  const loop = setInterval(async () => { if (await poll()) clearInterval(loop); }, 15000);
}

/* ---------------- UI wiring ---------------- */
function setPill(id, txt, on) { const p = $(id); p.textContent = txt; p.classList.toggle("on", !!on); }
function setBusy(b, msg) { const c = $("cta"); c.disabled = b; if (b) { c.dataset.label = c.dataset.label || c.textContent; c.textContent = msg; } else if (c.dataset.label) { c.textContent = c.dataset.label; delete c.dataset.label; } }
function showResult(title, html) { const r = $("result"); r.style.display = "block"; r.innerHTML = `<div class="rt">${title}</div><div class="rb">${html}</div>`; }
function updateCTA() {
  const c = $("cta");
  if (state.dir === "e2k") { c.textContent = state.eth ? "Lock ETH → mint wETH" : "Connect MetaMask"; c.classList.toggle("armed", !!state.eth); }
  else { c.textContent = state.kasAddr ? "Burn wETH → unlock ETH" : "Connect KasWare"; c.classList.toggle("armed", !!state.kasAddr); }
}

const A = { eth: { name: "Ethereum · " + CFG.eth.chainName, tok: "ETH", chip: "eth", sym: "Ξ" }, kas: { name: "Kaspa Mainnet", tok: "wETH", chip: "kas", sym: "K" } };
function render() {
  const from = state.dir === "e2k" ? A.eth : A.kas, to = state.dir === "e2k" ? A.kas : A.eth;
  $("dirtag").textContent = state.dir === "e2k" ? "ETH → Kaspa" : "Kaspa → ETH";
  $("fromTok").textContent = from.tok; $("toTok").textContent = to.tok;
  $("fromChain").textContent = from.name;
  $("toChain").textContent = state.dir === "e2k" ? "Kaspa · covenant-native token (KCC20)" : "Ethereum · native ETH from escrow";
  const fc = $("fromChip"), tc = $("toChip"); fc.className = "chip " + from.chip; tc.className = "chip " + to.chip; // ETH-diamond SVG stays put; class sets purple (eth) / teal (wETH)
  $("rate").textContent = state.dir === "e2k" ? "1 ETH → 1 wETH" : "1 wETH → 1 ETH";
  $("recipLabel").textContent = state.dir === "e2k" ? "Kaspa recipient (x-only pubkey — autofilled from KasWare)" : "Ethereum recipient (0x — autofilled from MetaMask)";
  $("recip").placeholder = state.dir === "e2k" ? "0x… 32-byte pubkey" : "0x…";
  if (state.dir === "e2k") { $("recip").value = state.kasPk ? xonly32(state.kasPk) : $("recip").value; }
  else { $("recip").value = state.eth ? state.eth.addr : $("recip").value; }
  $("route").textContent = state.dir === "e2k" ? "Lock ETH → SP1 Helios proof → mint wETH" : "Burn wETH → sparse-anchor proof → unlock ETH";
  calc(); refreshBalances(); updateCTA();
}
function calc() { const v = parseFloat($("amount").value || "0"); $("recv").value = (isNaN(v) ? 0 : v).toLocaleString(undefined, { maximumFractionDigits: 6 }); }

function init() {
  $("finText").textContent = `~${CFG.finality.seconds}s · ${CFG.finality.k}-block burial (λ=${CFG.finality.lambda}, β=${CFG.finality.beta})`;
  if ($("feeText")) $("feeText").textContent = `${CFG.fee.flatKas} KAS flat`;
  $("amount").addEventListener("input", calc);
  $("swap").onclick = () => { state.dir = state.dir === "e2k" ? "k2e" : "e2k"; render(); renderSteps(); };
  $("ethConnect").onclick = () => (state.eth ? disconnectMetaMask() : connectMetaMask());
  $("kasConnect").onclick = () => (state.kasAddr ? disconnectKasWare() : connectKasWare());
  $("cta").onclick = () => { if (state.dir === "e2k") doLock(); else doBurn(); };
  $("theme").onclick = () => { const r = document.documentElement; const cur = r.getAttribute("data-theme") || (matchMedia("(prefers-color-scheme:dark)").matches ? "dark" : "light"); r.setAttribute("data-theme", cur === "dark" ? "light" : "dark"); };
  $("proof").addEventListener("click", (e) => { const b = e.target.closest(".cp"); if (!b) return; const v = b.parentElement.querySelector(".v").getAttribute("data-full"); navigator.clipboard && navigator.clipboard.writeText(v); toast("Copied " + shorten(v)); });
  $("flowToggle").addEventListener("click", function (e) { const b = e.target.closest("button"); if (!b) return; [...this.children].forEach(c => c.classList.remove("on")); b.classList.add("on"); state.dir = b.dataset.flow; render(); renderSteps(); });
  if (window.ethereum) window.ethereum.on && window.ethereum.on("accountsChanged", () => location.reload());
  if (window.kasware) window.kasware.on && window.kasware.on("accountsChanged", () => location.reload());
  render(); renderSteps(); renderWethPanel(); loadWethNotes();
}

const FLOW = {
  e2k: [
    ["01", "Lock ETH", "You lock ETH in the bridge escrow, naming your Kaspa pubkey (autofilled from KasWare). MetaMask signs the deposit."],
    ["02", "Prove Ethereum", "A relayer runs SP1 Helios: it proves the sync-committee signature and a storage proof of your exact deposit."],
    ["03", "Verify on Kaspa", "Kaspa's 0x20 precompile checks the Groth16 proof inside the mint-authority covenant — no operator trust."],
    ["04", "Receive wETH", "The wETH covenant mints your amount 1:1 to your Kaspa address. Supply equals locked ETH by construction."]
  ],
  k2e: [
    ["01", "Burn wETH", "You sign the burn in your own wallet — no operator key. The note is destroyed and the registry absorbs the exact amount, recording {recipient, amount, nonce}."],
    ["02", "Prove Kaspa", "The sparse-anchor light client PoW-verifies k=49 anchors and binds the burn's acceptance (accepted_id_merkle_root)."],
    ["03", "Verify on Ethereum", "SP1's stock verifier checks the Groth16 proof in the escrow; it enforces its own depth + work thresholds."],
    ["04", "Unlock ETH", "The escrow releases ETH to your recipient (autofilled from MetaMask), once per burn nonce (replay-proof)."]
  ]
};
function renderSteps() { const el = $("steps"); el.innerHTML = ""; FLOW[state.dir].forEach(s => { const d = document.createElement("div"); d.className = "step"; d.innerHTML = `<div class="n">${s[0]}</div><h4>${s[1]}</h4><p>${s[2]}</p>`; el.appendChild(d); }); }

window.addEventListener("DOMContentLoaded", () => { init(); refreshBridgeStatus(); });
