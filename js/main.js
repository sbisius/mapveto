import { State, MAPS_API, ALL_STANDARD, CURRENT_COMP_POOL } from "./state.js";
import {
  buildSteps, resetMapStatus, recomputeProgress, currentStep,
  doAction, undo, applySide, canActOnMap, resultSummary
} from "./veto.js";
import {
  els, teamName, setTeamsUI, loadLogos, clearLogos, handleLogoFile,
  ensurePresetUI, renderSelector, renderStatusText, openSideModal, closeSideModal,
  renderLogAndResult, sideText, copyToClipboard
} from "./ui.js";

function upper(s){ return (s||"").trim().toUpperCase(); }
function sortAlpha(arr){ return [...arr].sort((a,b)=>a.localeCompare(b)); }

// ---- Hash persistence (keeps coin/actions/sides/pool) ----
function persistToHash(){
  const payload = {
    v: State.version,
    teams: State.teams,
    format: State.format,
    banStarterTeam: State.banStarterTeam,
    preset: State.preset,
    selectedKeys: State.selectedKeys,
    pool: State.pool,
    actions: State.actions,
    sidePicks: State.sidePicks,
  };
  const json = JSON.stringify(payload);
  const b64 = btoa(unescape(encodeURIComponent(json)));
  location.hash = b64;
}

function loadFromHash(){
  const h = (location.hash || "").slice(1).trim();
  if (!h) return false;
  try{
    const json = decodeURIComponent(escape(atob(h)));
    const p = JSON.parse(json);
    if (!p) return false;

    State.teams = p.teams || State.teams;
    State.format = p.format || "bo3";
    State.banStarterTeam = (p.banStarterTeam === "B") ? "B" : "A";
    State.preset = p.preset || "current";
    State.selectedKeys = Array.isArray(p.selectedKeys) ? p.selectedKeys : [];
    State.pool = Array.isArray(p.pool) ? p.pool : [];
    State.actions = Array.isArray(p.actions) ? p.actions : [];
    State.sidePicks = (p.sidePicks && typeof p.sidePicks === "object") ? p.sidePicks : {};

    els.teamA.value = State.teams.A;
    els.teamB.value = State.teams.B;
    els.format.value = State.format;
    return true;
  } catch {
    return false;
  }
}

// ---- Maps loading (filtered) ----
async function loadMaps(){
  els.mapLoadText.textContent = "Loading maps…";
  const res = await fetch(MAPS_API, { cache: "no-store" });
  const j = await res.json();
  const data = Array.isArray(j.data) ? j.data : [];

  const temp = data
    .filter(m => m && m.displayName)
    .map(m => ({
      keyUpper: upper(m.displayName),
      displayName: m.displayName,
      thumbUrl: m.listViewIcon || m.splash || m.stylizedBackgroundImage || ""
    }));

  State.allMaps = temp
    .filter(m => ALL_STANDARD.includes(m.keyUpper))
    .sort((a,b)=>a.keyUpper.localeCompare(b.keyUpper));

  const available = new Set(State.allMaps.map(x=>x.keyUpper));
  if (!State.selectedKeys.length){
    State.preset = State.preset || "current";
    if (State.preset === "all") State.selectedKeys = sortAlpha(ALL_STANDARD.filter(k => available.has(k)));
    else State.selectedKeys = sortAlpha(CURRENT_COMP_POOL.filter(k => available.has(k)));
  } else {
    State.selectedKeys = sortAlpha(State.selectedKeys.filter(k => available.has(k)));
  }
}

// ---- Rendering maps panel ----
function renderMaps(){
  els.maps.innerHTML = "";
  if (!State.pool.length) return;

  const stepNow = currentStep();

  for (const mapKey of State.pool){
    const st = State.mapStatus[mapKey];
    const meta = State.allMaps.find(x => x.keyUpper === mapKey);

    const card = document.createElement("div");
    card.className = "mapCard";

    const thumb = document.createElement("div");
    thumb.className = "mapThumb";

    const img = document.createElement("img");
    img.src = meta?.thumbUrl || "";
    img.alt = mapKey;
    img.onerror = () => { img.onerror = null; img.style.display = "none"; };
    thumb.appendChild(img);

    const overlay = document.createElement("div");
    overlay.className = "mapThumbOverlay";
    thumb.appendChild(overlay);

    const info = document.createElement("div");
    info.className = "mapInfo";

    const top = document.createElement("div");
    top.className = "mapTop";

    const name = document.createElement("div");
    name.className = "mapName";
    name.textContent = mapKey;

    const tag = document.createElement("div");
    tag.className = "tag";
    if (!st) tag.textContent = "—";
    else if (st.status === "open") tag.textContent = "OPEN";
    else if (st.status === "banned") tag.textContent = `BANNED · ${teamName(st.by)}`;
    else if (st.status === "picked") tag.textContent = `PICKED · ${teamName(st.by)}`;
    else if (st.status === "decider") tag.textContent = "DECIDER";

    top.appendChild(name);
    top.appendChild(tag);

    const metaLine = document.createElement("div");
    metaLine.className = "statusLine";
    if (st?.status === "picked"){
      const s = sideText(mapKey);
      metaLine.innerHTML = `<span class="pill pick">PICK</span><span class="muted">(${st.order}) by ${teamName(st.by)}${s ? " · " + s : ""}</span>`;
    } else if (st?.status === "banned"){
      metaLine.innerHTML = `<span class="pill ban">BAN</span><span class="muted">(${st.order}) by ${teamName(st.by)}</span>`;
    } else if (st?.status === "decider"){
      const s = sideText(mapKey);
      metaLine.innerHTML = `<span class="pill dec">DECIDER</span><span class="muted">${s ? s : "Side chooser: " + teamName(State.banStarterTeam)}</span>`;
    } else {
      metaLine.innerHTML = `<span class="muted">Available</span>`;
    }

    const btns = document.createElement("div");
    btns.className = "btns";

    const banBtn = document.createElement("button");
    banBtn.textContent = "BAN";
    banBtn.disabled = !(stepNow && stepNow.type === "ban" && canActOnMap(mapKey));
    banBtn.onclick = () => {
      if (doAction("ban", stepNow.team, mapKey)){
        persistToHash();
        rerender();
      }
    };

    const pickBtn = document.createElement("button");
    pickBtn.textContent = "PICK";
    pickBtn.disabled = !(stepNow && stepNow.type === "pick" && canActOnMap(mapKey));
    pickBtn.onclick = () => {
      if (doAction("pick", stepNow.team, mapKey)){
        persistToHash();
        rerender();
      }
    };

    btns.appendChild(banBtn);
    btns.appendChild(pickBtn);

    info.appendChild(top);
    info.appendChild(metaLine);
    info.appendChild(btns);

    card.appendChild(thumb);
    card.appendChild(info);
    els.maps.appendChild(card);
  }
}

function rerender(){
  State.teams.A = els.teamA.value.trim() || "Team A";
  State.teams.B = els.teamB.value.trim() || "Team B";
  State.format = els.format.value;

  setTeamsUI();

  if (State.pool.length){
    State.steps = buildSteps(State.format);
    recomputeProgress();
  }

  renderStatusText();
  renderMaps();
  renderLogAndResult();

  els.btnUndo.disabled = !State.actions.length;

  // open side modal if needed
  openSideModal();
}

// ---- Apply pool ----
function applyPool(){
  const available = new Set(State.allMaps.map(m => m.keyUpper));
  const filtered = State.selectedKeys.filter(k => available.has(k));
  if (filtered.length < 3){ alert("Select at least 3 maps."); return; }

  State.pool = sortAlpha(filtered);
  State.actions = [];
  State.sidePicks = {};
  State.pendingSide = null;

  State.steps = buildSteps(State.format);
  resetMapStatus();
  recomputeProgress();

  persistToHash();
  rerender();
}

// ---- Coin ----
function openCoin(){
  State.pendingCoin = null;
  els.coinWinnerPill.style.display = "none";
  els.coinChoices.style.display = "none";
  els.coinWinnerName.textContent = "";
  els.coinModal.style.display = "flex";
}
function closeCoin(){ els.coinModal.style.display = "none"; }

function flipCoin(){
  const winnerKey = (Math.random() < 0.5) ? "A" : "B";
  State.pendingCoin = { winnerKey };
  els.coinWinnerName.textContent = teamName(winnerKey);
  els.coinWinnerPill.style.display = "inline-flex";
  els.coinChoices.style.display = "block";
}

function applyCoin(choice){
  if (!State.pendingCoin) return;
  const winner = State.pendingCoin.winnerKey;
  const loser = (winner === "A") ? "B" : "A";
  const starter = (choice === "winner_starts") ? winner : loser;
  State.banStarterTeam = starter;

  State.pendingCoin = null;

  // rebuild steps if already running
  if (State.pool.length){
    State.steps = buildSteps(State.format);
    recomputeProgress();
  }
  persistToHash();
  rerender();
  closeCoin();
}

// ---- Copy helpers ----
function buildPrettyResults(){
  const r = resultSummary();
  const lines = [];
  lines.push(`FORMAT: ${State.format.toUpperCase()}`);
  lines.push(`TEAM A: ${State.teams.A}`);
  lines.push(`TEAM B: ${State.teams.B}`);
  lines.push(`BAN STARTER: ${teamName(State.banStarterTeam)}`);
  lines.push("");

  if (r.banned.length){
    lines.push("BANS:");
    for (const x of r.banned) lines.push(`  - (${x.order}) ${x.map} — by ${teamName(x.by)}`);
    lines.push("");
  }

  let idx = 1;
  lines.push("MAP ORDER + SIDES:");
  for (const x of r.picked){
    const s = sideText(x.map);
    lines.push(`  MAP ${idx++}: ${x.map} (picked by ${teamName(x.by)})${s ? " · " + s : ""}`);
  }
  if (r.decider.length === 1){
    const dm = r.decider[0];
    const s = sideText(dm);
    lines.push(`  MAP ${idx++}: ${dm} (DECIDER)${s ? " · " + s : ""}`);
  }
  return lines.join("\n");
}

// ---- Init + Events ----
async function init(){
  loadLogos();
  loadFromHash();
  setTeamsUI();

  ensurePresetUI((value) => {
    State.preset = value;
    const available = new Set(State.allMaps.map(m => m.keyUpper));
    if (value === "current") State.selectedKeys = sortAlpha(CURRENT_COMP_POOL.filter(k => available.has(k)));
    if (value === "all") State.selectedKeys = sortAlpha(ALL_STANDARD.filter(k => available.has(k)));
    persistToHash();
    renderSelector();
  });

  await loadMaps();
  renderSelector();

  // If pool exists from hash:
  if (State.pool.length){
    State.steps = buildSteps(State.format);
    resetMapStatus();
    recomputeProgress();
  }

  persistToHash();
  rerender();

  // --- Selector events ---
  els.mapSearch.addEventListener("input", () => renderSelector());

  els.btnAll.addEventListener("click", () => {
    State.preset = "custom";
    State.selectedKeys = State.allMaps.map(m => m.keyUpper).sort((a,b)=>a.localeCompare(b));
    persistToHash();
    renderSelector();
  });

  els.btnNone.addEventListener("click", () => {
    State.preset = "custom";
    State.selectedKeys = [];
    persistToHash();
    renderSelector();
  });

  els.btnApplyPool.addEventListener("click", () => applyPool());

  els.btnAutoStart.addEventListener("click", () => {
    if (!State.pool.length){ alert("Select maps and click “Apply pool” first."); return; }
    State.steps = buildSteps(State.format);
    recomputeProgress();
    persistToHash();
    rerender();
  });

  // --- Veto tools ---
  els.btnUndo.addEventListener("click", () => {
    undo();
    persistToHash();
    rerender();
  });

  els.btnReset.addEventListener("click", () => {
    location.hash = "";
    State.pool = [];
    State.actions = [];
    State.sidePicks = {};
    State.pendingSide = null;
    State.banStarterTeam = "A";
    State.preset = "current";
    State.selectedKeys = [];
    persistToHash();
    rerender();
  });

  els.btnCopy.addEventListener("click", async () => {
    const ok = await copyToClipboard(buildPrettyResults());
    els.btnCopy.textContent = ok ? "Copied ✓" : "Copy results";
    setTimeout(()=>els.btnCopy.textContent="Copy results", 900);
  });

  els.btnCopyLink.addEventListener("click", async () => {
    persistToHash();
    const ok = await copyToClipboard(location.href);
    els.btnCopyLink.textContent = ok ? "Link copied ✓" : "Copy link";
    setTimeout(()=>els.btnCopyLink.textContent="Copy link", 900);
  });

  // --- Team inputs ---
  ["input","change"].forEach(evt => {
    els.teamA.addEventListener(evt, () => { State.teams.A = els.teamA.value.trim() || "Team A"; persistToHash(); rerender(); });
    els.teamB.addEventListener(evt, () => { State.teams.B = els.teamB.value.trim() || "Team B"; persistToHash(); rerender(); });
    els.format.addEventListener(evt, () => {
      State.format = els.format.value;
      // Reset veto when format changes
      State.pool = [];
      State.actions = [];
      State.sidePicks = {};
      State.pendingSide = null;
      persistToHash();
      rerender();
    });
  });

  // --- Side modal ---
  els.sideClose.addEventListener("click", closeSideModal);
  els.sideModal.addEventListener("click", (e) => { if (e.target === els.sideModal) closeSideModal(); });

  els.btnAtk.addEventListener("click", () => {
    applySide("ATTACKER");
    persistToHash();
    rerender();
    closeSideModal();
  });

  els.btnDef.addEventListener("click", () => {
    applySide("DEFENDER");
    persistToHash();
    rerender();
    closeSideModal();
  });

  // --- Coin modal ---
  els.btnCoin.addEventListener("click", openCoin);
  els.coinClose.addEventListener("click", closeCoin);
  els.coinModal.addEventListener("click", (e) => { if (e.target === els.coinModal) closeCoin(); });
  els.coinRoll.addEventListener("click", flipCoin);
  els.coinWinnerStarts.addEventListener("click", () => applyCoin("winner_starts"));
  els.coinLoserStarts.addEventListener("click", () => applyCoin("loser_starts"));

  // --- Logos ---
  els.btnUploadA.addEventListener("click", () => els.fileA.click());
  els.btnUploadB.addEventListener("click", () => els.fileB.click());
  els.btnClearLogos.addEventListener("click", () => clearLogos());

  els.fileA.addEventListener("change", async () => { await handleLogoFile("A", els.fileA.files[0]); els.fileA.value=""; });
  els.fileB.addEventListener("change", async () => { await handleLogoFile("B", els.fileB.files[0]); els.fileB.value=""; });
}

init();
