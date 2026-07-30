/* Kaspa-402 Bridge — functional frontend logic.
   ETH side: MetaMask + ethers, real EthKaspaEscrow.lock().
   KAS side: KasWare (window.kasware) — connect, x-only pubkey (used as the ETH lock recipient), balance.
   The KAS->ETH covenant burn is PERMISSIONLESS (keyless): only the note owner signs their own wETH note, and the
   minter burn leg needs NO governance key — it's gated by a structural anti-mint check (the sole minter-authority
   output carries zero value and >=1 note is destroyed, so a burn can only reduce supply). KasWare's public API can
   prove note ownership (signMessage) but does not yet sign covenant transactions, so the burn is prepared here and
   submitted out-of-band; a ~1-3h sparse-anchor finality proof (inherent to trustless finality, not a permission)
   then lets the escrow release the ETH.
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
async function doBurn() {
  if (!state.kasAddr) { toast("Connect KasWare first"); return; }
  let ethRecipient = $("recip").value.trim();
  if (!ethRecipient && state.eth) ethRecipient = state.eth.addr;
  if (!/^0x[0-9a-fA-F]{40}$/.test(ethRecipient)) { toast("Enter an Ethereum recipient (0x…40 hex) or connect MetaMask"); return; }
  const amtStr = $("amount").value.trim();
  // construct the burn record the registry will append + the ETH-side unlock will read
  const nonce = "0x" + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, "0")).join("");
  const record = { ethRecipient, amount: amtStr + " wETH", nonce, registry: CFG.kaspa.burnRegistryCovid, wethTemplate: CFG.kaspa.wethTemplateHash };
  // KasWare has no covenant-tx API; prove ownership via signMessage, then hand off the burn to the covenant signer.
  let sig = null;
  try { sig = await window.kasware.signMessage(`kaspa-402 bridge burn ${amtStr} wETH -> ${ethRecipient} nonce ${nonce}`); } catch {}
  showResult("Burn prepared" + (sig ? " · ownership signed ✓" : ""),
    `The burn record is constructed below. The wETH burn is <b>permissionless</b> — only your note signature is `
    + `needed (the minter burn leg is keyless, gated by a structural anti-mint check). Browser wallets can't yet `
    + `sign covenant transactions, so it's submitted out-of-band. After the burn confirms on Kaspa, a sparse-anchor `
    + `light-client proof binds its <b>acceptance</b> (~1-3h) and the escrow unlocks ETH to ${shorten(ethRecipient, 6)}, once per nonce.`
    + `<pre class="rec">${JSON.stringify(record, null, 2)}</pre>`);
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
    ["01", "Burn wETH", "You burn wETH into the registry covenant, which appends {recipient, amount, nonce} to an accumulator."],
    ["02", "Prove Kaspa", "The sparse-anchor light client PoW-verifies k=49 anchors and binds the burn's acceptance (accepted_id_merkle_root)."],
    ["03", "Verify on Ethereum", "SP1's stock verifier checks the Groth16 proof in the escrow; it enforces its own depth + work thresholds."],
    ["04", "Unlock ETH", "The escrow releases ETH to your recipient (autofilled from MetaMask), once per burn nonce (replay-proof)."]
  ]
};
function renderSteps() { const el = $("steps"); el.innerHTML = ""; FLOW[state.dir].forEach(s => { const d = document.createElement("div"); d.className = "step"; d.innerHTML = `<div class="n">${s[0]}</div><h4>${s[1]}</h4><p>${s[2]}</p>`; el.appendChild(d); }); }

window.addEventListener("DOMContentLoaded", init);
