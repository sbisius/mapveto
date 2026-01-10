import { State, LS_LOGO_A, LS_LOGO_B, CURRENT_COMP_POOL } from "./state.js";
import { currentStep, openMaps, getPendingSideFromStep, resultSummary } from "./veto.js";

export const els = {
  teamA: document.getElementById("teamA"),
  teamB: document.getElementById("teamB"),
  format: document.getElementById("format"),

  logoA: document.getElementById("logoA"),
  logoB: document.getElementById("logoB"),
  teamAText: document.getElementById("teamAText"),
  teamBText: document.getElementById("teamBText"),

  btnUploadA: document.getElementById("btnUploadA"),
  btnUploadB: document.getElementById("btnUploadB"),
  btnClearLogos: document.getElementById("btnClearLogos"),
  fileA: document.getElementById("fileA"),
  fileB: document.getElementById("fileB"),

  mapLoadText: document.getElementById("mapLoadText"),
  checkGrid: document.getElementById("checkGrid"),
  mapSearch: document.getElementById("mapSearch"),
  btnAll: document.getElementById("btnAll"),
  btnNone: document.getElementById("btnNone"),
  btnApplyPool: document.getElementById("btnApplyPool"),
  btnAutoStart: document.getElementById("btnAutoStart"),

  maps: document.getElementById("maps"),
  log: document.getElementById("log"),
  stepPill: document.getElementById("stepPill"),
  turnText: document.getElementById("turnText"),
  btnUndo: document.getElementById("btnUndo"),
  btnCoin: document.getElementById("btnCoin"),
  btnCopy: document.getElementById("btnCopy"),
  btnCopyLink: document.getElementById("btnCopyLink"),
  btnReset: document.getElementById("btnReset"),
  resultText: document.getElementById("resultText"),

  coinModal: document.getElementById("coinModal"),
  coinClose: document.getElementById("coinClose"),
  coinRoll: document.getElementById("coinRoll"),
  coinWinnerPill: document.getElementById("coinWinnerPill"),
  coinWinnerName: document.getElementById("coinWinnerName"),
  coinChoices: document.getElementById("coinChoices"),
  coinWinnerStarts: document.getElementById("coinWinnerStarts"),
  coinLoserStarts: document.getElementById("coinLoserStarts"),

  sideModal: document.getElementById("sideModal"),
  sideClose: document.getElementById("sideClose"),
  sideText: document.getElementById("sideText"),
  btnAtk: document.getElementById("btnAtk"),
  btnDef: document.getElementById("btnDef"),
};

export const teamName = (t) => (t === "A" ? State.teams.A : State.teams.B);

export function setTeamsUI(){
  els.teamAText.textContent = State.teams.A;
  els.teamBText.textContent = State.teams.B;
}

function placeholderLogo(){
  const svg = encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88">
      <rect width="100%" height="100%" rx="16" ry="16" fill="#0b1220" stroke="#1f2937" />
      <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="18">LOGO</text>
    </svg>`
  );
  return `data:image/svg+xml,${svg}`;
}

export function loadLogos(){
  els.logoA.src = localStorage.getItem(LS_LOGO_A) || placeholderLogo();
  els.logoB.src = localStorage.getItem(LS_LOGO_B) || placeholderLogo();
}

export function clearLogos(){
  localStorage.removeItem(LS_LOGO_A);
  localStorage.removeItem(LS_LOGO_B);
  loadLogos();
}

export async function handleLogoFile(which, file){
  if (!file) return;
  if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
  if (file.size > 1.8 * 1024 * 1024) { alert("Logo too large. Keep it under 1.8MB."); return; }

  const dataUrl = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

  if (which === "A") localStorage.setItem(LS_LOGO_A, dataUrl);
  else localStorage.setItem(LS_LOGO_B, dataUrl);
  loadLogos();
}

export function ensurePresetUI(onPresetChange){
  if (document.getElementById("presetWrap")) return;

  const tools = els.btnApplyPool?.parentElement;
  if (!tools) return;

  const wrap = document.createElement("div");
  wrap.id = "presetWrap";
  wrap.style.display = "flex";
  wrap.style.gap = "10px";
  wrap.style.flexWrap = "wrap";
  wrap.style.alignItems = "center";
  wrap.style.border = "1px solid #1f2937";
  wrap.style.borderRadius = "14px";
  wrap.style.padding = "8px 10px";
  wrap.style.background = "rgba(11,18,32,.25)";

  const title = document.createElement("div");
  title.textContent = "Preset:";
  title.style.fontSize = "12px";
  title.style.color = "#94a3b8";
  title.style.fontWeight = "700";

  const mk = (value, label) => {
    const lab = document.createElement("label");
    lab.style.display = "flex";
    lab.style.gap = "8px";
    lab.style.alignItems = "center";
    lab.style.cursor = "pointer";
    lab.style.fontSize = "12px";
    lab.style.color = "#94a3b8";
    lab.style.margin = "0";

    const r = document.createElement("input");
    r.type = "radio";
    r.name = "mapPreset";
    r.value = value;
    r.checked = (State.preset === value);
    r.addEventListener("change", () => onPresetChange(value));

    const span = document.createElement("span");
    span.textContent = label;

    lab.appendChild(r);
    lab.appendChild(span);
    return lab;
  };

  wrap.appendChild(title);
  wrap.appendChild(mk("current", "Current Competitive Rotation"));
  wrap.appendChild(mk("all", "All Standard (Unrated + Ranked)"));

  tools.insertBefore(wrap, els.btnApplyPool);
}

export function renderSelector(){
  const q = (els.mapSearch.value || "").trim().toLowerCase();
  els.checkGrid.innerHTML = "";

  const items = State.allMaps
    .filter(m => !q || m.displayName.toLowerCase().includes(q) || m.keyUpper.toLowerCase().includes(q))
    .sort((a,b)=>a.keyUpper.localeCompare(b.keyUpper));

  for (const m of items){
    const row = document.createElement("label");
    row.className = "checkItem";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = State.selectedKeys.includes(m.keyUpper);
    cb.addEventListener("change", () => {
      State.preset = "custom";
      if (cb.checked) State.selectedKeys = [...new Set([...State.selectedKeys, m.keyUpper])].sort((a,b)=>a.localeCompare(b));
      else State.selectedKeys = State.selectedKeys.filter(x => x !== m.keyUpper).sort((a,b)=>a.localeCompare(b));
      // uncheck radios
      document.querySelectorAll('input[name="mapPreset"]').forEach(r => r.checked = false);
      location.hash = ""; // keep simple: main handles persistence
    });

    const img = document.createElement("img");
    img.src = m.thumbUrl || "";
    img.alt = m.displayName;
    img.onerror = () => { img.onerror = null; img.style.display = "none"; };

    const box = document.createElement("div");
    box.style.display = "flex";
    box.style.flexDirection = "column";
    box.style.gap = "2px";

    const top = document.createElement("div");
    top.style.display = "flex";
    top.style.gap = "8px";
    top.style.alignItems = "center";
    top.style.flexWrap = "wrap";

    const name = document.createElement("div");
    name.className = "checkName";
    name.textContent = m.displayName;

    const pill = document.createElement("span");
    pill.className = CURRENT_COMP_POOL.includes(m.keyUpper) ? "pillMini std" : "pillMini";
    pill.textContent = CURRENT_COMP_POOL.includes(m.keyUpper) ? "CURRENT" : "STANDARD";

    const note = document.createElement("div");
    note.className = "checkNote";
    note.textContent = m.keyUpper;

    top.appendChild(name);
    top.appendChild(pill);
    box.appendChild(top);
    box.appendChild(note);

    row.appendChild(cb);
    row.appendChild(img);
    row.appendChild(box);

    els.checkGrid.appendChild(row);
  }

  els.mapLoadText.textContent = `Maps loaded: ${State.allMaps.length} · Selected: ${State.selectedKeys.length}`;
}

export function openSideModal(){
  const p = getPendingSideFromStep();
  if (!p) return;

  State.pendingSide = p;
  const msg =
    p.forType === "picked"
      ? `${teamName(p.chooserTeam)} chooses side for PICKED map: ${p.mapKey}`
      : `${teamName(p.chooserTeam)} chooses side for DECIDER: ${p.mapKey}`;
  els.sideText.textContent = msg;
  els.sideModal.style.display = "flex";
}

export function closeSideModal(){
  els.sideModal.style.display = "none";
  State.pendingSide = null;
}

export function renderStatusText(){
  const step = currentStep();
  const remaining = openMaps().length;

  if (!State.pool.length){
    els.stepPill.textContent = "Step: —";
    els.turnText.textContent = "Select maps and click “Apply pool”.";
    return;
  }

  if (!step){
    els.stepPill.textContent = "Step: DONE";
    els.turnText.textContent = "Veto finished.";
    return;
  }

  els.stepPill.textContent = `Step: ${State.stepIndex+1}/${State.steps.length} · ${step.label}`;

  if (step.type === "decider"){
    els.turnText.textContent = (remaining === 1)
      ? `Decider assigned automatically. Next: ${teamName(State.banStarterTeam)} chooses side.`
      : `Decider: ${remaining} maps still open. Keep banning/picking.`;
    return;
  }

  if (step.type === "side"){
    els.turnText.textContent = `Side pick: ${teamName(step.team)} chooses.`;
    return;
  }

  els.turnText.textContent = `Turn: ${teamName(step.team)} → ${step.type.toUpperCase()} (choose a map).`;
}

export function sideText(mapKey){
  const sp = State.sidePicks[mapKey];
  if (!sp) return null;
  const sideLabel = sp.side === "ATTACKER" ? "Attacker Side" : "Defender Side";
  return `${sideLabel} (chosen by ${teamName(sp.by)})`;
}

export function renderLogAndResult(){
  const lines = [];
  lines.push(`BAN STARTER: ${teamName(State.banStarterTeam)}`);
  lines.push("");

  if (!State.actions.length) lines.push("— No actions yet —");
  else {
    State.actions.forEach((a,i) => {
      lines.push(`${String(i+1).padStart(2,"0")}. ${a.type.toUpperCase()} · ${teamName(a.team)} · ${a.map}`);
      if (a.type === "pick"){
        const s = sideText(a.map);
        if (s) lines.push(`    ↳ SIDE: ${s}`);
      }
    });
  }

  const r = resultSummary();
  const pickedOrder = r.picked.sort((a,b)=>a.order-b.order).map(x=>x.map);
  const dm = (r.decider.length === 1) ? r.decider[0] : null;
  els.resultText.textContent = pickedOrder.length
    ? `MAP ORDER: ${pickedOrder.join(" → ")}${dm ? " → " + dm : ""}`
    : (dm ? `DECIDER: ${dm}` : "—");

  els.log.textContent = lines.join("\n");
}

export async function copyToClipboard(text){
  try{
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  }
}
