(() => {
  const MAPS_API = "https://valorant-api.com/v1/maps";
  const STANDARD_BADGE = new Set(["ASCENT","BIND","HAVEN","ICEBOX","LOTUS","SPLIT","SUNSET","BREEZE","FRACTURE","PEARL"]);

  // Logos are LOCAL (saved in browser)
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
    version: 1,
    teams: { A: 'Team A', B: 'Team B' },
    format: 'bo3',

    allMaps: [],
    selectedKeys: [],

    pool: [],
    actions: [],
    sidePicks: {},        // mapKey -> {by:'A'|'B', side:'ATTACKER'|'DEFENDER', for:'picked'|'decider'}
    mapStatus: {},        // mapKey -> {status:'open'|'banned'|'picked'|'decider', by:'A'|'B'|null, order:int}
    steps: [],
    stepIndex: 0,

    banStarterTeam: 'A',  // decider side chooser = ban starter

    coinHistory: [],
    pendingCoin: null,
    pendingSide: null,    // {mapKey, chooserTeam, forType}
  };

  // ---------- Utils ----------
  const upper = (s) => (s || "").trim().toUpperCase();
  const teamName = (t) => t === 'A' ? State.teams.A : State.teams.B;

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

  // ---------- Logos (localStorage) ----------
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

  // ---------- Steps ----------
  function buildSteps(format, nMaps){
    const steps = [];
    const pushSideAfterPick = (pickedBy) => {
      const chooser = pickedBy === 'A' ? 'B' : 'A';
      steps.push({type:'side', team: chooser, label:'SIDE', forType:'picked'});
    };

    if (format === 'bo1'){
      const bans = Math.max(0, nMaps - 1);
      for (let i=0;i<bans;i++) steps.push({type:'ban', team:(i%2===0?'A':'B'), label:'BAN'});
      steps.push({type:'decider', team:null, label:'DECIDER'});
      steps.push({type:'side', team:null, label:'SIDE', forType:'decider'});
      return steps;
    }

    if (format === 'bo3'){
      steps.push({type:'ban', team:'A', label:'BAN'});
      steps.push({type:'ban', team:'B', label:'BAN'});
      steps.push({type:'pick', team:'A', label:'PICK'}); pushSideAfterPick('A');
      steps.push({type:'pick', team:'B', label:'PICK'}); pushSideAfterPick('B');
      steps.push({type:'ban', team:'A', label:'BAN'});
      steps.push({type:'ban', team:'B', label:'BAN'});
      steps.push({type:'decider', team:null, label:'DECIDER'});
      steps.push({type:'side', team:null, label:'SIDE', forType:'decider'});
      return steps;
    }

    // BO5
    steps.push({type:'ban', team:'A', label:'BAN'});
    steps.push({type:'ban', team:'B', label:'BAN'});
    steps.push({type:'pick', team:'A', label:'PICK'}); pushSideAfterPick('A');
    steps.push({type:'pick', team:'B', label:'PICK'}); pushSideAfterPick('B');
    steps.push({type:'pick', team:'A', label:'PICK'}); pushSideAfterPick('A');
    steps.push({type:'pick', team:'B', label:'PICK'}); pushSideAfterPick('B');
    steps.push({type:'decider', team:null, label:'DECIDER'});
    steps.push({type:'side', team:null, label:'SIDE', forType:'decider'});
    return steps;
  }

  // ---------- Veto state ----------
  function resetMapStatus(){
    State.mapStatus = {};
    for (const m of State.pool) State.mapStatus[m] = {status:'open', by:null, order:null};
  }

  function currentStep(){ return State.steps[State.stepIndex] || null; }
  function openMaps(){ return State.pool.filter(m => State.mapStatus[m]?.status === 'open'); }

  function finalizeDeciderIfReady(){
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

  function skipCompletedSideSteps(){
    while (true){
      const step = currentStep();
      if (!step || step.type !== 'side') break;

      if (step.forType === 'picked'){
        const mapKey = getLastPickedNeedingSide();
        if (mapKey === null){ State.stepIndex++; continue; }
        break;
      }

      if (step.forType === 'decider'){
        const dec = getDeciderMap();
        if (!dec) break;
        if (State.sidePicks[dec]?.for === 'decider'){ State.stepIndex++; continue; }
        break;
      }
      break;
    }
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

    finalizeDeciderIfReady();
    skipCompletedSideSteps();
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
      if (!dec) return;
      if (State.sidePicks[dec]?.for === 'decider') return;
      openSideModal(dec, State.banStarterTeam, 'decider');
    }
  }

  function applySide(side){
    if (!State.pendingSide) return;
    const {mapKey, chooserTeam, forType} = State.pendingSide;

    State.sidePicks[mapKey] = {by: chooserTeam, side, for: forType};
    State.stepIndex++;
    skipCompletedSideSteps();

    persistToHash();
    render();
    closeSideModal();
  }

  function sideText(mapKey){
    const sp = State.sidePicks[mapKey];
    if (!sp) return null;
    const chooser = teamName(sp.by);
    const side = (sp.side === 'ATTACKER') ? 'Attacker Side' : 'Defender Side';
    return `${side} (chosen by ${chooser})`;
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
      lines.push(`COIN: winner ${last.winnerName} · ${last.choice === 'winner_starts' ? 'WINNER STARTS' : 'LOSER STARTS'} · starter ${last.starterName}${last.didSwap ? ' · swap A/B' : ''}`);
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
    const q = (els.mapSearch.value || '').trim().toLowerCase();
    els.checkGrid.innerHTML = '';

    const items = State.allMaps
      .filter(m => !q || m.displayName.toLowerCase().includes(q) || m.keyUpper.toLowerCase().includes(q))
      .sort((a,b) => a.displayName.localeCompare(b.displayName));

    for (const m of items){
      const row = document.createElement('label');
      row.className = 'checkItem';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = State.selectedKeys.includes(m.keyUpper);
      cb.addEventListener('change', () => {
        if (cb.checked) State.selectedKeys = uniq([...State.selectedKeys, m.keyUpper]);
        else State.selectedKeys = State.selectedKeys.filter(x => x !== m.keyUpper);
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
      pill.className = STANDARD_BADGE.has(m.keyUpper) ? 'pillMini std' : 'pillMini';
      pill.textContent = STANDARD_BADGE.has(m.keyUpper) ? 'STANDARD' : 'ALT';

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

    State.pool = [...filtered];
    State.actions = [];
    State.sidePicks = {};
    State.stepIndex = 0;
    State.steps = buildSteps(State.format, State.pool.length);

    State.banStarterTeam = 'A';
    resetMapStatus();

    persistToHash();
    render();
  }

  // ---------- Coin flip ----------
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

    const desiredStarterKey = (choice === 'winner_starts') ? State.pendingCoin.winnerKey : State.pendingCoin.loserKey;
    const starterNameBefore = teamName(desiredStarterKey);

    let didSwap = false;
    if (desiredStarterKey === 'B'){
      didSwap = true;
      // swap labels so Team A is the starter (turn A)
      const tmp = State.teams.A;
      State.teams.A = State.teams.B;
      State.teams.B = tmp;

      els.teamA.value = State.teams.A;
      els.teamB.value = State.teams.B;
      setTeamsUI();
    }

    State.banStarterTeam = 'A';

    State.coinHistory.push({
      ts: State.pendingCoin.ts,
      winnerName: State.pendingCoin.winnerName,
      loserName: State.pendingCoin.loserName,
      choice,
      starterName: starterNameBefore,
      didSwap
    });

    State.pendingCoin = null;
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
      State.steps = buildSteps(State.format, State.pool.length);
      recomputeFromActions();
    }

    const step = currentStep();
    const remaining = openMaps().length;

    if (!State.pool.length){
      els.stepPill.textContent = 'Step: —';
      els.turnText.textContent = 'Select maps and click “Apply pool”.';
    } else if (!step){
      els.stepPill.textContent = 'Step: DONE';
      els.turnText.textContent = `Veto finished. Remaining open maps: ${remaining}.`;
    } else {
      els.stepPill.textContent = `Step: ${State.stepIndex+1}/${State.steps.length} · ${step.label}`;
      if (step.type === 'decider'){
        els.turnText.textContent = (remaining === 1)
          ? `Decider assigned automatically. (Side chooser: ${teamName(State.banStarterTeam)})`
          : `Decider: ${remaining} maps still open. Keep banning/picking or adjust pool.`;
      } else if (step.type === 'side'){
        if (step.forType === 'picked'){
          const m = getLastPickedNeedingSide();
          els.turnText.textContent = m ? `Side pick: ${teamName(step.team)} chooses for ${m}.` : 'Side already chosen.';
        } else {
          const dm = getDeciderMap();
          els.turnText.textContent = dm ? `Decider side pick: ${teamName(State.banStarterTeam)} chooses for ${dm}.` : 'Decider side pick: waiting for decider map.';
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
    if (State.coinHistory.length){
      const hist = [...State.coinHistory].reverse();
      for (const e of hist){
        const when = new Date(e.ts).toLocaleString();
        const choiceTxt = (e.choice === 'winner_starts') ? 'WINNER STARTS' : 'LOSER STARTS';
        const swapTxt = e.didSwap ? ' · swap A/B' : '';
        lines.push(`[COIN ${when}] winner ${e.winnerName} · ${choiceTxt} · starter ${e.starterName}${swapTxt}`);
      }
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

  // ---------- URL hash persistence ----------
  function persistToHash(){
    const payload = {
      v: State.version,
      teams: {A: State.teams.A, B: State.teams.B},
      format: State.format,
      selectedKeys: State.selectedKeys,
      pool: State.pool,
      actions: State.actions,
      sidePicks: State.sidePicks,
      banStarterTeam: State.banStarterTeam,
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
      State.selectedKeys = Array.isArray(p.selectedKeys) ? p.selectedKeys : [];

      State.pool = Array.isArray(p.pool) ? p.pool : [];
      State.actions = Array.isArray(p.actions) ? p.actions : [];
      State.sidePicks = (p.sidePicks && typeof p.sidePicks === 'object') ? p.sidePicks : {};
      State.banStarterTeam = (p.banStarterTeam === 'B') ? 'B' : 'A';
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

  // ---------- Map loading ----------
  async function loadMaps(){
    els.mapLoadText.textContent = "Loading maps…";
    try{
      const res = await fetch(MAPS_API, {cache:"no-store"});
      const j = await res.json();
      const data = Array.isArray(j.data) ? j.data : [];

      State.allMaps = data
        .filter(m => m && m.displayName)
        .filter(m => (m.displayName || "").toLowerCase() !== "the range")
        .map(m => ({
          keyUpper: upper(m.displayName),
          displayName: m.displayName,
          thumbUrl: m.listViewIcon || m.splash || m.stylizedBackgroundImage || ""
        }))
        .reduce((acc, cur) => {
          if (!acc.some(x => x.keyUpper === cur.keyUpper)) acc.push(cur);
          return acc;
        }, []);

      if (!State.selectedKeys.length){
        const available = new Set(State.allMaps.map(x=>x.keyUpper));
        const defaults = Array.from(STANDARD_BADGE).filter(k => available.has(k));
        State.selectedKeys = defaults.length ? defaults : State.allMaps.slice(0,7).map(x=>x.keyUpper);
      } else {
        const available = new Set(State.allMaps.map(x=>x.keyUpper));
        State.selectedKeys = State.selectedKeys.filter(k => available.has(k));
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
      State.banStarterTeam = 'A';
      persistToHash();
      render();
    });
  });

  els.mapSearch.addEventListener('input', () => renderSelector());
  els.btnAll.addEventListener('click', () => { State.selectedKeys = State.allMaps.map(m=>m.keyUpper); persistToHash(); renderSelector(); });
  els.btnNone.addEventListener('click', () => { State.selectedKeys = []; persistToHash(); renderSelector(); });

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
    if (State.pool.length){
      State.steps = buildSteps(State.format, State.pool.length);
      resetMapStatus();
      recomputeFromActions();
    }
    persistToHash();
    render();
  });
})();
