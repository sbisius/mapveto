import { State } from "./state.js";

export const otherTeam = (t) => (t === "A" ? "B" : "A");

export function buildSteps(format){
  const S = State.banStarterTeam;
  const O = otherTeam(S);

  if (format === "bo3"){
    // EXACT flow requested:
    // S BAN, O BAN, S PICK -> O SIDE, O PICK -> S SIDE, S BAN, O BAN, DECIDER -> S SIDE
    return [
      {type:"ban",  team:S, label:"BAN"},
      {type:"ban",  team:O, label:"BAN"},
      {type:"pick", team:S, label:"PICK"},
      {type:"side", team:O, label:"SIDE", forType:"picked"},
      {type:"pick", team:O, label:"PICK"},
      {type:"side", team:S, label:"SIDE", forType:"picked"},
      {type:"ban",  team:S, label:"BAN"},
      {type:"ban",  team:O, label:"BAN"},
      {type:"decider", team:null, label:"DECIDER"},
      {type:"side", team:S, label:"SIDE", forType:"decider"},
    ];
  }

  // Simple fallback
  if (format === "bo1"){
    return [
      {type:"ban", team:S, label:"BAN"},
      {type:"ban", team:O, label:"BAN"},
      {type:"ban", team:S, label:"BAN"},
      {type:"ban", team:O, label:"BAN"},
      {type:"ban", team:S, label:"BAN"},
      {type:"decider", team:null, label:"DECIDER"},
      {type:"side", team:S, label:"SIDE", forType:"decider"},
    ];
  }

  // bo5
  const steps = [
    {type:"ban", team:S, label:"BAN"},
    {type:"ban", team:O, label:"BAN"},
  ];
  for (let i=0;i<4;i++){
    const picker = (i%2===0) ? S : O;
    steps.push({type:"pick", team:picker, label:"PICK"});
    steps.push({type:"side", team:otherTeam(picker), label:"SIDE", forType:"picked"});
  }
  steps.push({type:"decider", team:null, label:"DECIDER"});
  steps.push({type:"side", team:S, label:"SIDE", forType:"decider"});
  return steps;
}

export function resetMapStatus(){
  State.mapStatus = {};
  for (const m of State.pool){
    State.mapStatus[m] = {status:"open", by:null, order:null};
  }
}

export function currentStep(){
  return State.steps[State.stepIndex] || null;
}

export function openMaps(){
  return State.pool.filter(m => State.mapStatus[m]?.status === "open");
}

function pickedMapsInOrder(){
  return State.pool
    .filter(m => State.mapStatus[m]?.status === "picked")
    .sort((a,b)=> (State.mapStatus[a].order||0) - (State.mapStatus[b].order||0));
}

function lastPickedMapKey(){
  const picks = pickedMapsInOrder();
  return picks.length ? picks[picks.length - 1] : null;
}

function getDeciderMap(){
  return State.pool.find(m => State.mapStatus[m]?.status === "decider") || null;
}

// Core: compute stepIndex by simulating steps, considering BOTH actions AND sidePicks.
export function recomputeProgress(){
  resetMapStatus();

  // Apply bans/picks from actions to status (in order)
  for (let i=0;i<State.actions.length;i++){
    const a = State.actions[i];
    const st = State.mapStatus[a.map];
    if (!st || st.status !== "open") continue;

    st.status = (a.type === "ban") ? "banned" : "picked";
    st.by = a.team;
    st.order = i+1;
  }

  // Now simulate steps from beginning:
  let ai = 0;
  let si = 0;

  while (si < State.steps.length){
    const step = State.steps[si];

    if (step.type === "ban" || step.type === "pick"){
      const a = State.actions[ai];
      if (a && a.type === step.type && a.team === step.team){
        ai++;
        si++;
        continue;
      }
      break;
    }

    if (step.type === "decider"){
      const remaining = openMaps();
      if (remaining.length === 1){
        const m = remaining[0];
        State.mapStatus[m].status = "decider";
        si++;
        continue;
      }
      break;
    }

    if (step.type === "side"){
      if (step.forType === "picked"){
        const m = lastPickedMapKey();
        if (!m) break;
        if (State.sidePicks[m]?.for === "picked"){
          si++;
          continue;
        }
        break;
      }

      if (step.forType === "decider"){
        const dm = getDeciderMap();
        if (!dm) break;
        if (State.sidePicks[dm]?.for === "decider"){
          si++;
          continue;
        }
        break;
      }

      break;
    }

    break;
  }

  State.stepIndex = si;
}

export function canActOnMap(mapKey){
  const step = currentStep();
  if (!step) return false;
  if (step.type !== "ban" && step.type !== "pick") return false;
  if (State.mapStatus[mapKey]?.status !== "open") return false;
  return true;
}

export function doAction(type, team, mapKey){
  const step = currentStep();
  if (!step || step.type !== type || step.team !== team) return false;
  if (!canActOnMap(mapKey)) return false;

  State.actions.push({type, team, map: mapKey});
  recomputeProgress();
  return true;
}

export function undo(){
  if (!State.actions.length) return;
  State.actions.pop();
  recomputeProgress();
}

export function sideChooserForPicked(pickedBy){
  return otherTeam(pickedBy);
}

export function getPendingSideFromStep(){
  const step = currentStep();
  if (!step || step.type !== "side") return null;

  if (step.forType === "picked"){
    const last = State.actions.slice().reverse().find(a => a.type === "pick");
    if (!last) return null;
    const mapKey = last.map;
    if (State.sidePicks[mapKey]?.for === "picked") return null;
    return {mapKey, chooserTeam: step.team, forType:"picked"};
  }

  if (step.forType === "decider"){
    const dm = State.pool.find(m => State.mapStatus[m]?.status === "decider") || null;
    if (!dm) return null;
    if (State.sidePicks[dm]?.for === "decider") return null;
    return {mapKey: dm, chooserTeam: step.team, forType:"decider"};
  }

  return null;
}

export function applySide(side){
  const p = State.pendingSide;
  if (!p) return;
  State.sidePicks[p.mapKey] = {by:p.chooserTeam, side, for:p.forType};
  State.pendingSide = null;
  recomputeProgress();
}

export function resultSummary(){
  const picked = State.pool.filter(m => State.mapStatus[m]?.status === "picked")
    .sort((a,b)=> (State.mapStatus[a].order||0)-(State.mapStatus[b].order||0))
    .map(m => ({map:m, by:State.mapStatus[m].by, order:State.mapStatus[m].order}));

  const banned = State.pool.filter(m => State.mapStatus[m]?.status === "banned")
    .sort((a,b)=> (State.mapStatus[a].order||0)-(State.mapStatus[b].order||0))
    .map(m => ({map:m, by:State.mapStatus[m].by, order:State.mapStatus[m].order}));

  const decider = State.pool.filter(m => State.mapStatus[m]?.status === "decider");

  return {picked, banned, decider};
}
