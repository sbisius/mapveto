(() => {
  const MAPS_API = "https://valorant-api.com/v1/maps";

  // Only standard Unrated/Ranked-style maps (whitelist) — alphabetical
  const ALL_STANDARD = [
    "ABYSS",
    "ASCENT",
    "BIND",
    "BREEZE",
    "CORRODE",
    "FRACTURE",
    "HAVEN",
    "ICEBOX",
    "LOTUS",
    "PEARL",
    "SPLIT",
    "SUNSET",
  ].sort((a,b)=>a.localeCompare(b));

  // Current Competitive rotation (Season 26 Act 1 / Patch 12.00 era)
  // Sources: Riot patch notes confirm Breeze IN / Sunset OUT; multiple reputable sources list the 7-map pool. :contentReference[oaicite:1]{index=1}
  const CURRENT_COMP_POOL = [
    "ABYSS",
    "BIND",
    "BREEZE",
    "CORRODE",
    "HAVEN",
    "PEARL",
    "SPLIT",
  ].sort((a,b)=>a.localeCompare(b));

  // Logos are LOCAL (saved in browser) tied to Team A / Team B (NOT turns)
  const LS_LOGO_A = "mapveto_logoA";
  const LS_LOGO_B = "mapveto_logoB";

  const els = {
    teamA: document.getElementById('teamA'),
    teamB: document.getElementById('teamB'),
    format: document.getElementById('format'),

    logoA: document.getElementById('logoA'),
    logoB: document.getElementById('logoB'),
    teamAText: document.getElementById('teamAText'),
    teamBText: document.getElementById('teamBText'),

    btnUploadA: document.getElementById('btnUploadA'),
    btnUploadB: document.getElementById('btnUploadB'),
    btnClearLogos: document.getElementById('btnClearLogos'),
    fileA: document.getElementById('fileA'),
    fileB: document.getElementById('fileB'),

    mapLoadText: document.getElementById('mapLoadText'),
    checkGrid: document.getElementById('checkGrid'),
    mapSearch: document.getElementById('mapSearch'),
    btnAll: document.getElementById('btnAll'),
    btnNone: document.getElementById('btnNone'),
    btnApplyPool: document.getElementById('btnApplyPool'),
    btnAutoStart: document.getElementById('btnAutoStart'),

    maps: document.getElementById('maps'),
    log: document.getElementById('log'),
    stepPill: document.getElementById('stepPill'),
    turnText: document.getElementById('turnText'),
    btnUndo: document.getElementById('btnUndo'),
    btnCoin: document.getElementById('btnCoin'),
    btnCopy: document.getElementById('btnCopy'),
    btnCopyLink: document.getElementById('btnCopyLink'),
    btnReset: document.getElementById('btnReset'),
    resultText: document.getElementById('resultText'),

    coinModal: document.getElementById('coinModal'),
    coinClose: document.getElementById('coinClose'),
    coinRoll: document.getElementById('coinRoll'),
    coinWinnerPill: document.getElementById('coinWinnerPill'),
    coinWinnerName: document.getElementById('coinWinnerName'),
    coinChoices: document.getElementById('coinChoices'),
    coinWinnerStarts: document.getElementById('coinWinnerStarts'),
    coinLoserStarts: document.getElementById('coinLoserStarts'),

    sideModal: document.getElementById('sideModal'),
    sideClose: document.getElementById('sideClose'),
    sideText: document.getElementById('sideText'),
    btnAtk: document.getElementById('btnAtk'),
    btnDef: document.getElementById('btnDef'),
  };

  const State = {
    version: 2,
    teams: { A: 'Team A', B: 'Team B' },
    format: 'bo3',

    // who starts bans (turns), without swapping teams
    banStarterTeam: 'A',

    // map selector
    allMaps: [],       // from API, but filtered to ALL_STANDARD
    selectedKeys: [],  // checkbox selection (pool candidates)
    preset: "current", // "current" | "all" | "custom"

    // veto
    pool: [],
    actions: [],       // {type:'ban'|'pick', team:'A'|'B', map}
    sidePicks: {},     // mapKey -> {by:'A'|'B', side:'ATTACKER'|'DEFENDER', for:'picked'|'decider'}
    mapStatus: {},     // mapKey -> {status:'open'|'banned'|'picked'|'decider', by:'A'|'B'|null, order:int}
    steps: [],
    stepIndex: 0,

    coinHistory: [],
    pendingCoin: null,
    pendingSide: null, // {mapKey, chooserTeam, forType}
  };

  // ---------- Utils ----------
  const upper = (s) => (s || "").trim().toUpperCase();
  const otherTeam = (t) => (t === 'A' ? 'B' : 'A');
  const teamName = (t) => (t === 'A' ? State.teams.A : State.teams.B);

  function setTeamsUI(){
    els.teamAText.textContent = State.teams.A;
    els.teamBText.textContent = State.teams.B;
  }

  function uniq(arr){
    const seen = new Set();
    const out = [];
    for (const x of arr){ if (!seen.has(x)) { seen.add(x); out.push(x); } }
    return out;
  }

  function sortAlpha(arr){
    return [...arr].sort((a,b)=>a.localeCompare(b));
  }

  // ---------- Preset UI (created dynamically; no index.html changes) ----------
  function ensurePresetUI(){
    if (document.getElementById("presetWrap")) return;

    const tools = els.btnApplyPool?.parentElement; // selectorTools
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

    const makeRadio = (value, label) => {
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
      r.style.cursor = "pointer";

      r.addEventListener("change", () => {
        State.preset = value;
        if (value === "current") {
          State.selectedKeys = sortAlpha(CURRENT_COMP_POOL);
        } else if (value === "all") {
          State.selectedKeys = sortAlpha(ALL_STANDARD.filter(k => State.allMaps.some(m => m.keyUpper === k)));
        }
        persistToHash();
        renderSelector();
      });

      const span = document.createElement("span");
      span.textContent = label;

      lab.appendChild(r);
      lab.appendChild(span);
      return lab;
    };

    const title = document.createElement("div");
    title.textContent = "Preset:";
    title.style.fontSize = "12px";
    title.style.color = "#94a3b8";
    title.style.fontWeight = "700";

    wrap.appendChild(title);
    wrap.appendChild(makeRadio("current", "Current Competitive Rotation"));
    wrap.appendChild(makeRadio("all", "All Standard (Unrated + Ranked)"));

    // Put it before Apply pool button
    tools.insertBefore(wrap, els.btnApplyPool);
  }

  // ---------- Logos (localStorage; tied to Team A / Team B) ----------
  function placeholderLogo(){
    const svg = encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88">
        <rect width="100%" height="100%" rx="16" ry="16" fill="#0b1220" stroke="#1f2937" />
        <text x="50%" y="52%" dominant-baseline="middle" text-anchor="middle" fill="#94a3b8" font-family="Arial" font-size="18">LOGO</text>
      </svg>`
    );
    return `data:image/svg+xml,${svg}`;
  }

  function loadLogos(){
    const a = localStorage.getItem(LS_LOGO_A);
    const b = localStorage.getItem(LS_LOGO_B);
    els.logoA.src = a || placeholderLogo();
    els.logoB.src = b || placeholderLogo();
  }

  function clearLogos(){
    localStorage.removeItem(LS_LOGO_A);
    localStorage.removeItem(LS_LOGO_B);
    loadLogos();
  }

  function readFileAsDataURL(file){
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(file);
    });
  }

  async function handleLogoFile(which, file){
    if (!file) return;
    if (!file.type.startsWith("image/")){
      alert("Please select an image file (png/jpg/webp).");
      return;
    }
    if (file.size > 1.8 * 1024 * 1024){
      alert("Image too large. Use a logo under 1.8MB (suggestion: 256x256 PNG).");
      return;
    }
    const dataUrl = await readFileAsDataURL(file);
    if (which === 'A') localStorage.setItem(LS_LOGO_A, dataUrl);
    else localStorage.setItem(LS_LOGO_B, dataUrl);
    loadLogos();
  }

  // ---------- Steps (FIXED FLOW) ----------
  function buildSteps(format){
    const S = State.banStarterTeam;      // starter
    const O = otherTeam(S);              // other
    const steps = [];

    if (format === 'bo1'){
      // Alternate bans until 1 remains => decider, then starter chooses side
      steps.push({type:'ban', team:S, label:'BAN'});
      steps.push({type:'ban', team:O, label:'BAN'});
      steps.push({type:'ban', team:S, label:'BAN'});
      steps.push({type:'ban', team:O, label:'BAN'});
      steps.push({type:'ban', team:S, label:'BAN'});
      steps.push({type:'decider', team:null, label:'DECIDER'});
      steps.push({type:'side', team:S, label:'SIDE', forType:'decider'});
      return steps;
    }

    if (format === 'bo3'){
      // EXACT FLOW requested:
      // S BAN, O BAN, S PICK -> O SIDE, O PICK -> S SIDE, S BAN, O BAN, DECIDER -> S SIDE
      steps.push({type:'ban',  team:S, label:'BAN'});
      steps.push({type:'ban',  team:O, label:'BAN'});
      steps.push({type:'pick', team:S, label:'PICK'});
      steps.push({type:'side', team:O, label:'SIDE', forType:'picked'});
      steps.push({type:'pick', team:O, label:'PICK'});
      steps.push({type:'side', team:S, label:'SIDE', forType:'picked'});
      steps.push({type:'ban',  team:S, label:'BAN'});
      steps.push({type:'ban',  team:O, label:'BAN'});
      steps.push({type:'decider', team:null, label:'DECIDER'});
      steps.push({type:'side', team:S, label:'SIDE', forType:'decider'});
      return steps;
    }

    // BO5 (common pattern): S BAN, O BAN, then alternating picks with opponent side after each pick, then decider side by starter
    steps.push({type:'ban',  team:S, label:'BAN'});
    steps.push({type:'ban',  team:O, label:'BAN'});

    steps.push({type:'pick', team:S, label:'PICK'});
    steps.push({type:'side', team:O, label:'SIDE', forType:'picked'});
    steps.push({type:'pick', team:O, label:'PICK'});
    steps.push({type:'side', team:S, label:'SIDE', forType:'picked'});

    steps.push({type:'pick', team:S, label:'PICK'});
    steps.push({type:'side', team:O, label:'SIDE', forType:'picked'});
    steps.push({type:'pick', team:O, label:'PICK'});
    steps.push({type:'side', team:S, label:'SIDE', forType:'picked'});

    steps.push({type:'decider', team:null, label:'DECIDER'});
    steps.push({type:'side', team:S, label:'SIDE', forType:'decider'});
    return steps;
  }

  // ---------- Veto state ----------
  function resetMapStatus(){
    State.mapStatus = {};
    for (const m of State.pool) State.mapStatus[m] = {status:'open', by:null, order:null};
  }

  function currentStep(){ return State.steps[State.stepIndex] || null; }
  function openMaps(){ return State.pool.filter(m => State.mapStatus[m]?.status === 'open'); }

  function assignDeciderIfReady(){
    const step = currentStep();
    if (!step || step.type !== 'decider') return;
    const remaining = openMaps();
    if (remaining.length === 1){
      const m = remaining[0];
      State.mapStatus[m].status = 'decider';
      State.stepIndex++;
    }
  }

  function pickedMapsInOrder(){
    return State.pool
      .filter(m => State.mapStatus[m]?.status === 'picked')
      .sort((a,b)=> (State.mapStatus[a].order||0)-(State.mapStatus[b].order||0));
  }

  function getLastPickedNeedingSide(){
    const picks = pickedMapsInOrder();
    if (!picks.length) return null;
    const last = picks[picks.length - 1];
    if (State.sidePicks[last]?.for === 'picked') return null;
    return last;
  }

  function getDeciderMap(){
    return State.pool.find(m => State.mapStatus[m]?.status === 'decider') || null;
  }

  function recomputeFromActions(){
    resetMapStatus();
    State.stepIndex = 0;

    for (let i=0;i<State.actions.length;i++){
      const a = State.actions[i];
      const st = State.mapStatus[a.map];
      if (!st || st.status !== 'open') continue;

      st.status = (a.type === 'ban') ? 'banned' : 'picked';
      st.by = a.team;
      st.order = i+1;
      State.stepIndex++;
    }

    // If we are at decider step and only 1 open remains, assign it.
    assignDeciderIfReady();
  }

  function canActOnMap(mapKey){
    const step = currentStep();
    if (!step) return false;
    if (step.type !== 'ban' && step.type !== 'pick') return false;
    if (State.mapStatus[mapKey]?.status !== 'open') return false;
    return true;
  }

  function doAction(type, team, mapKey){
    const step = currentStep();
    if (!step || step.type !== type || step.team !== team) return;
    if (!canActOnMap(mapKey)) return;

    State.actions.push({type, team, map: mapKey});
    recomputeFromActions();
    persistToHash();
    render();
    maybeOpenSideModal();
  }

  function undo(){
    if (!State.actions.length) return;
    State.actions.pop();
    recomputeFromActions();
    persistToHash();
    render();
  }

  // ---------- Side modal ----------
  function openSideModal(mapKey, chooserTeam, forType){
    State.pendingSide = {mapKey, chooserTeam, forType};
    const chooserName = teamName(chooserTeam);
    const msg = (forType === 'picked')
      ? `${chooserName} chooses side for PICKED map: ${mapKey}`
      : `${chooserName} chooses side for DECIDER: ${mapKey}`;
    els.sideText.textContent = msg;
    els.sideModal.style.display = 'flex';
  }

  function closeSideModal(){
    els.sideModal.style.display = 'none';
    State.pendingSide = null;
  }

  function maybeOpenSideModal(){
    const step = currentStep();
    if (!step || step.type !== 'side') return;

    if (step.forType === 'picked'){
      const mapKey = getLastPickedNeedingSide();
      if (!mapKey) return;
      openSideModal(mapKey, step.team, 'picked');
      return;
    }

    if (step.forType === 'decider'){
      const dec = getDeciderMap();
      if (!dec) return; // wait until decider assigned
      if (State.sidePicks[dec]?.for === 'decider') return;
      openSideModal(dec, step.team, 'decider');
    }
  }

  function applySide(side){
    if (!State.pendingSide) return;
    const {mapKey, chooserTeam, forType} = State.pendingSide;

    State.sidePicks[mapKey] = {by: chooserTeam, side, for: forType};
    State.stepIndex++;

    persistToHash();
    render();
    closeSideModal();
  }

  function sideText(mapKey){
    const sp = State.sidePicks[mapKey];
    if (!sp) return null;
    const chooser = teamName(sp.by);
    const sideLabel = (sp.side === 'ATTACKER') ? 'Attacker Side' : 'Defender Side';
    return `${sideLabel} (chosen by ${chooser})`;
  }

  // ---------- Results / log ----------
  function resultSummary(){
    const picked = State.pool.filter(m => State.mapStatus[m]?.status === 'picked')
      .sort((a,b)=> (State.mapStatus[a].order||0)-(State.mapStatus[b].order||0))
      .map(m => ({map:m, by:State.mapStatus[m].by, order:State.mapStatus[m].order}));

    const banned = State.pool.filter(m => State.mapStatus[m]?.status === 'banned')
      .sort((a,b)=> (State.mapStatus[a].order||0)-(State.mapStatus[b].order||0))
      .map(m => ({map:m, by:State.mapStatus[m].by, order:State.mapStatus[m].order}));

    const decider = State.pool.filter(m => State.mapStatus[m]?.status === 'decider');
    return {picked, banned, decider};
  }

  function prettyResults(){
    const r = resultSummary();
    const lines = [];
    lines.push(`FORMAT: ${State.format.toUpperCase()}`);
    lines.push(`TEAM A: ${State.teams.A}`);
    lines.push(`TEAM B: ${State.teams.B}`);
    lines.push(`BAN STARTER: ${teamName(State.banStarterTeam)}`);
    lines.push('');

    if (State.coinHistory.length){
      const last = State.coinHistory[State.coinHistory.length - 1];
      lines.push(`COIN: winner ${last.winnerName} · starter ${last.starterName}`);
      lines.push('');
    }

    if (r.banned.length){
      lines.push('BANS:');
      for (const x of r.banned) lines.push(`  - (${x.order}) ${x.map} — by ${teamName(x.by)}`);
      lines.push('');
    }

    let idx = 1;
    lines.push('MAP ORDER + SIDES:');
    for (const x of r.picked){
      const st = sideText(x.map);
      lines.push(`  MAP ${idx++}: ${x.map} (picked by ${teamName(x.by)})${st ? ' · ' + st : ''}`);
    }
    if (r.decider.length === 1){
      const dm = r.decider[0];
      const st = sideText(dm);
      lines.push(`  MAP ${idx++}: ${dm} (DECIDER)${st ? ' · ' + st : ''}`);
    }
    return lines.join('\n');
  }

  // ---------- Selector UI ----------
  function renderSelector(){
    ensurePresetUI();

    const q = (els.mapSearch.value || '').trim().toLowerCase();
    els.checkGrid.innerHTML = '';

    const items = State.allMaps
      .filter(m => !q || m.displayName.toLowerCase().includes(q) || m.keyUpper.toLowerCase().includes(q))
      .sort((a,b) => a.keyUpper.localeCompare(b.keyUpper)); // alphabetical

    for (const m of items){
      const row = document.createElement('label');
      row.className = 'checkItem';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = State.selectedKeys.includes(m.keyUpper);

      cb.addEventListener('change', () => {
        // If user manually changes checkboxes, mark preset as custom
        State.preset = "custom";
        const wrap = document.getElementById("presetWrap");
        if (wrap){
          const radios = wrap.querySelectorAll('input[type="radio"][name="mapPreset"]');
          radios.forEach(r => r.checked = false);
        }

        if (cb.checked) State.selectedKeys = uniq([...State.selectedKeys, m.keyUpper]).sort((a,b)=>a.localeCompare(b));
        else State.selectedKeys = State.selectedKeys.filter(x => x !== m.keyUpper).sort((a,b)=>a.localeCompare(b));
        persistToHash();
        renderSelector();
      });

      const img = document.createElement('img');
      img.src = m.thumbUrl || '';
      img.alt = m.displayName;
      img.onerror = () => { img.onerror = null; img.style.display='none'; };

      const box = document.createElement('div');
      box.style.display='flex';
      box.style.flexDirection='column';
      box.style.gap='2px';

      const top = document.createElement('div');
      top.style.display='flex';
      top.style.gap='8px';
      top.style.alignItems='center';
      top.style.flexWrap='wrap';

      const name = document.createElement('div');
      name.className='checkName';
      name.textContent=m.displayName;

      const pill = document.createElement('span');
      pill.className = (CURRENT_COMP_POOL.includes(m.keyUpper)) ? 'pillMini std' : 'pillMini';
      pill.textContent = (CURRENT_COMP_POOL.includes(m.keyUpper)) ? 'CURRENT' : 'STANDARD';

      const note = document.createElement('div');
      note.className='checkNote';
      note.textContent=m.keyUpper;

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

  function applyPool(){
    const available = new Set(State.allMaps.map(m => m.keyUpper));
    const filtered = State.selectedKeys.filter(k => available.has(k));

    if (filtered.length < 3){
      alert("Select at least 3 maps.");
      return;
    }

    State.pool = sortAlpha(filtered);
    State.actions = [];
    State.sidePicks = {};
    State.stepIndex = 0;

    State.steps = buildSteps(State.format);
    resetMapStatus();

    persistToHash();
    render();
  }

  // ---------- Coin flip (NO team swap; only sets banStarterTeam) ----------
  function openCoin(){
    State.teams.A = els.teamA.value.trim() || 'Team A';
    State.teams.B = els.teamB.value.trim() || 'Team B';
    setTeamsUI();

    State.pendingCoin = null;
    els.coinWinnerPill.style.display = 'none';
    els.coinChoices.style.display = 'none';
    els.coinWinnerName.textContent = '';
    els.coinModal.style.display = 'flex';
  }

  function closeCoin(){ els.coinModal.style.display='none'; }

  function flipCoin(){
    const winnerKey = (Math.random() < 0.5) ? 'A' : 'B';
    const loserKey = (winnerKey === 'A') ? 'B' : 'A';
    State.pendingCoin = {
      ts: new Date().toISOString(),
      winnerKey,
      loserKey,
      winnerName: teamName(winnerKey),
      loserName: teamName(loserKey)
    };

    els.coinWinnerName.textContent = State.pendingCoin.winnerName;
    els.coinWinnerPill.style.display = 'inline-flex';
    els.coinChoices.style.display = 'block';

    persistToHash();
    render();
  }

  function applyCoin(choice){
    if (!State.pendingCoin) return;

    // Winner chooses who starts bans (banStarterTeam)
    const starter = (choice === 'winner_starts') ? State.pendingCoin.winnerKey : State.pendingCoin.loserKey;
    State.banStarterTeam = starter;

    State.coinHistory.push({
      ts: State.pendingCoin.ts,
      winnerName: State.pendingCoin.winnerName,
      loserName: State.pendingCoin.loserName,
      choice,
      starterName: teamName(starter),
    });

    State.pendingCoin = null;

    // Rebuild steps if veto already started
    if (State.pool.length){
      State.steps = buildSteps(State.format);
      recomputeFromActions();
    }

    persistToHash();
    render();
    closeCoin();
  }

  // ---------- Render ----------
  function render(){
    State.teams.A = els.teamA.value.trim() || 'Team A';
    State.teams.B = els.teamB.value.trim() || 'Team B';
    State.format = els.format.value;
    setTeamsUI();

    if (State.pool.length){
      State.steps = buildSteps(State.format);
      recomputeFromActions();
    }

    const step = currentStep();
    const remaining = openMaps().length;

    if (!State.pool.length){
      els.stepPill.textContent = 'Step: —';
      els.turnText.textContent = 'Select maps and click “Apply pool”.';
    } else if (!step){
      els.stepPill.textContent = 'Step: DONE';
      els.turnText.textContent = 'Veto finished.';
    } else {
      els.stepPill.textContent = `Step: ${State.stepIndex+1}/${State.steps.length} · ${step.label}`;

      if (step.type === 'decider'){
        if (remaining === 1){
          els.turnText.textContent = `Decider assigned automatically. Next: ${teamName(State.banStarterTeam)} chooses side.`;
        } else {
          els.turnText.textContent = `Decider: ${remaining} maps still open. Keep banning/picking.`;
        }
      } else if (step.type === 'side'){
        if (step.forType === 'picked'){
          const m = getLastPickedNeedingSide();
          els.turnText.textContent = m ? `Side pick: ${teamName(step.team)} chooses for ${m}.` : 'Side already chosen.';
        } else {
          const dm = getDeciderMap();
          els.turnText.textContent = dm ? `Decider side: ${teamName(step.team)} chooses for ${dm}.` : 'Waiting for decider map.';
        }
      } else {
        els.turnText.textContent = `Turn: ${teamName(step.team)} → ${step.type.toUpperCase()} (choose a map).`;
      }
    }

    // map cards
    els.maps.innerHTML = '';
    if (State.pool.length){
      for (const mapKey of State.pool){
        const st = State.mapStatus[mapKey];
        const meta = State.allMaps.find(x => x.keyUpper === mapKey);

        const card = document.createElement('div');
        card.className = 'mapCard';

        const thumb = document.createElement('div');
        thumb.className = 'mapThumb';

        const img = document.createElement('img');
        img.src = meta?.thumbUrl || '';
        img.alt = mapKey;
        img.onerror = () => { img.onerror = null; img.style.display='none'; };
        thumb.appendChild(img);

        const overlay = document.createElement('div');
        overlay.className = 'mapThumbOverlay';
        thumb.appendChild(overlay);

        const info = document.createElement('div');
        info.className = 'mapInfo';

        const top = document.createElement('div');
        top.className = 'mapTop';

        const name = document.createElement('div');
        name.className = 'mapName';
        name.textContent = mapKey;

        const tag = document.createElement('div');
        tag.className = 'tag';
        if (!st) tag.textContent = '—';
        else if (st.status === 'open') tag.textContent = 'OPEN';
        else if (st.status === 'banned') tag.textContent = `BANNED · ${teamName(st.by)}`;
        else if (st.status === 'picked') tag.textContent = `PICKED · ${teamName(st.by)}`;
        else if (st.status === 'decider') tag.textContent = 'DECIDER';

        top.appendChild(name);
        top.appendChild(tag);

        const metaLine = document.createElement('div');
        metaLine.className = 'statusLine';

        if (st?.status === 'banned') {
          metaLine.innerHTML = `<span class="pill ban">BAN</span><span class="muted">(${st.order}) by ${teamName(st.by)}</span>`;
        } else if (st?.status === 'picked') {
          const s = sideText(mapKey);
          metaLine.innerHTML = `<span class="pill pick">PICK</span><span class="muted">(${st.order}) by ${teamName(st.by)}${s ? ' · ' + s : ''}</span>`;
        } else if (st?.status === 'decider') {
          const s = sideText(mapKey);
          metaLine.innerHTML = `<span class="pill dec">DECIDER</span><span class="muted">${s ? s : ('Side chooser: ' + teamName(State.banStarterTeam))}</span>`;
        } else {
          metaLine.innerHTML = `<span class="muted">Available</span>`;
        }

        const btns = document.createElement('div');
        btns.className = 'btns';

        const stepNow = currentStep();

        const banBtn = document.createElement('button');
        banBtn.textContent = 'BAN';
        banBtn.disabled = !(stepNow && stepNow.type === 'ban' && canActOnMap(mapKey));
        banBtn.onclick = () => doAction('ban', stepNow.team, mapKey);

        const pickBtn = document.createElement('button');
        pickBtn.textContent = 'PICK';
        pickBtn.disabled = !(stepNow && stepNow.type === 'pick' && canActOnMap(mapKey));
        pickBtn.onclick = () => doAction('pick', stepNow.team, mapKey);

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

    // log
    const lines = [];
    lines.push(`BAN STARTER: ${teamName(State.banStarterTeam)}`);
    lines.push('');

    if (State.coinHistory.length){
      const last = State.coinHistory[State.coinHistory.length - 1];
      lines.push(`[COIN] winner ${last.winnerName} · starter ${last.starterName}`);
      lines.push('');
    }

    if (!State.actions.length) {
      lines.push('— No actions yet —');
    } else {
      State.actions.forEach((a,i) => {
        lines.push(`${String(i+1).padStart(2,'0')}. ${a.type.toUpperCase()} · ${teamName(a.team)} · ${a.map}`);
        if (a.type === 'pick'){
          const s = sideText(a.map);
          if (s) lines.push(`    ↳ SIDE: ${s}`);
        }
      });
    }

    const dec = getDeciderMap();
    if (dec){
      const s = sideText(dec);
      lines.push('');
      lines.push(s ? `DECIDER SIDE: ${s}` : `DECIDER SIDE: (pending) chooser ${teamName(State.banStarterTeam)}`);
    }

    els.log.textContent = lines.join('\n');

    // result
    if (!State.pool.length) els.resultText.textContent = '—';
    else {
      const r = resultSummary();
      const pickedOrder = r.picked.sort((a,b)=>a.order-b.order).map(x=>x.map);
      const dm = (r.decider.length===1) ? r.decider[0] : null;
      els.resultText.textContent = pickedOrder.length
        ? `MAP ORDER: ${pickedOrder.join(' → ')}${dm ? ' → ' + dm : ''}`
        : (dm ? `DECIDER: ${dm}` : '—');
    }

    els.btnUndo.disabled = !State.actions.length;

    renderSelector();
    maybeOpenSideModal();
  }

  // ---------- URL hash persistence (no logos) ----------
  function persistToHash(){
    const payload = {
      v: State.version,
      teams: {A: State.teams.A, B: State.teams.B},
      format: State.format,
      banStarterTeam: State.banStarterTeam,
      preset: State.preset,

      selectedKeys: State.selectedKeys,
      pool: State.pool,
      actions: State.actions,
      sidePicks: State.sidePicks,
      coinHistory: State.coinHistory
    };
    const json = JSON.stringify(payload);
    const b64 = btoa(unescape(encodeURIComponent(json)));
    location.hash = b64;
  }

  function loadFromHash(){
    const h = (location.hash || '').slice(1).trim();
    if (!h) return false;
    try{
      const json = decodeURIComponent(escape(atob(h)));
      const p = JSON.parse(json);
      if (!p) return false;

      State.teams.A = p.teams?.A || 'Team A';
      State.teams.B = p.teams?.B || 'Team B';
      State.format = p.format || 'bo3';
      State.banStarterTeam = (p.banStarterTeam === 'B') ? 'B' : 'A';
      State.preset = p.preset || "current";

      State.selectedKeys = Array.isArray(p.selectedKeys) ? p.selectedKeys : [];
      State.pool = Array.isArray(p.pool) ? p.pool : [];
      State.actions = Array.isArray(p.actions) ? p.actions : [];
      State.sidePicks = (p.sidePicks && typeof p.sidePicks === 'object') ? p.sidePicks : {};
      State.coinHistory = Array.isArray(p.coinHistory) ? p.coinHistory : [];

      els.teamA.value = State.teams.A;
      els.teamB.value = State.teams.B;
      els.format.value = State.format;

      return true;
    } catch {
      return false;
    }
  }

  // ---------- Clipboard ----------
  async function copyToClipboard(text){
    try { await navigator.clipboard.writeText(text); return true; }
    catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(ta);
      return ok;
    }
  }

  // ---------- Map loading (filter to standard only) ----------
  async function loadMaps(){
    els.mapLoadText.textContent = "Loading maps…";
    try{
      const res = await fetch(MAPS_API, {cache:"no-store"});
      const j = await res.json();
      const data = Array.isArray(j.data) ? j.data : [];

      // Build map metadata, then filter to whitelist
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

      // Initialize selection based on preset unless hash already has something
      const available = new Set(State.allMaps.map(x=>x.keyUpper));

      if (!State.selectedKeys.length){
        State.preset = State.preset || "current";
        if (State.preset === "all"){
          State.selectedKeys = sortAlpha(ALL_STANDARD.filter(k => available.has(k)));
        } else {
          // default current
          State.preset = "current";
          State.selectedKeys = sortAlpha(CURRENT_COMP_POOL.filter(k => available.has(k)));
        }
      } else {
        // Keep only available, and keep alphabetical
        State.selectedKeys = sortAlpha(State.selectedKeys.filter(k => available.has(k)));
      }

      renderSelector();
    } catch {
      els.mapLoadText.textContent = "Failed to load maps. Refresh the page.";
      State.allMaps = [];
      renderSelector();
    }
  }

  // ---------- Events ----------
  els.btnApplyPool.addEventListener('click', () => applyPool());

  els.btnAutoStart.addEventListener('click', () => {
    if (!State.pool.length){ alert('Select maps and click “Apply pool” first.'); return; }
    recomputeFromActions();
    persistToHash();
    render();
  });

  els.btnUndo.addEventListener('click', () => undo());

  els.btnCopy.addEventListener('click', async () => {
    const ok = await copyToClipboard(prettyResults());
    els.btnCopy.textContent = ok ? 'Copied ✓' : 'Copy results';
    setTimeout(() => els.btnCopy.textContent = 'Copy results', 900);
  });

  els.btnCopyLink.addEventListener('click', async () => {
    persistToHash();
    const ok = await copyToClipboard(location.href);
    els.btnCopyLink.textContent = ok ? 'Link copied ✓' : 'Copy link';
    setTimeout(() => els.btnCopyLink.textContent = 'Copy link', 900);
  });

  els.btnReset.addEventListener('click', () => {
    location.hash = '';
    State.pool = [];
    State.actions = [];
    State.sidePicks = {};
    State.steps = [];
    State.stepIndex = 0;
    State.coinHistory = [];
    State.pendingCoin = null;
    State.pendingSide = null;
    State.banStarterTeam = 'A';
    State.preset = "current";
    State.selectedKeys = [];

    persistToHash();
    render();
  });

  ['input','change'].forEach(evt => {
    els.teamA.addEventListener(evt, () => { State.teams.A = els.teamA.value.trim() || 'Team A'; persistToHash(); render(); });
    els.teamB.addEventListener(evt, () => { State.teams.B = els.teamB.value.trim() || 'Team B'; persistToHash(); render(); });
    els.format.addEventListener(evt, () => {
      State.format = els.format.value;
      // reset veto on format change
      State.pool = [];
      State.actions = [];
      State.sidePicks = {};
      State.steps = [];
      State.stepIndex = 0;
      persistToHash();
      render();
    });
  });

  els.mapSearch.addEventListener('input', () => renderSelector());

  // Keep these buttons but make them respect whitelist + alphabetical
  els.btnAll.addEventListener('click', () => {
    State.preset = "custom";
    State.selectedKeys = sortAlpha(State.allMaps.map(m=>m.keyUpper));
    persistToHash();
    renderSelector();
  });

  els.btnNone.addEventListener('click', () => {
    State.preset = "custom";
    State.selectedKeys = [];
    persistToHash();
    renderSelector();
  });

  // coin modal
  els.btnCoin.addEventListener('click', () => openCoin());
  els.coinClose.addEventListener('click', () => closeCoin());
  els.coinModal.addEventListener('click', (e) => { if (e.target === els.coinModal) closeCoin(); });
  els.coinRoll.addEventListener('click', () => flipCoin());
  els.coinWinnerStarts.addEventListener('click', () => applyCoin('winner_starts'));
  els.coinLoserStarts.addEventListener('click', () => applyCoin('loser_starts'));

  // side modal
  els.sideClose.addEventListener('click', () => closeSideModal());
  els.sideModal.addEventListener('click', (e) => { if (e.target === els.sideModal) closeSideModal(); });
  els.btnAtk.addEventListener('click', () => applySide('ATTACKER'));
  els.btnDef.addEventListener('click', () => applySide('DEFENDER'));

  // logo upload
  els.btnUploadA.addEventListener('click', () => els.fileA.click());
  els.btnUploadB.addEventListener('click', () => els.fileB.click());
  els.btnClearLogos.addEventListener('click', () => clearLogos());

  els.fileA.addEventListener('change', async () => { await handleLogoFile('A', els.fileA.files[0]); els.fileA.value = ''; });
  els.fileB.addEventListener('change', async () => { await handleLogoFile('B', els.fileB.files[0]); els.fileB.value = ''; });

  // ---------- Init ----------
  loadLogos();
  const loaded = loadFromHash();
  if (loaded) setTeamsUI();

  loadMaps().then(() => {
    ensurePresetUI();

    if (State.pool.length){
      State.steps = buildSteps(State.format);
      resetMapStatus();
      recomputeFromActions();
    }

    persistToHash();
    render();
  });
})();
