export const MAPS_API = "https://valorant-api.com/v1/maps";

// Standard Unrated/Ranked maps only (alphabetical)
export const ALL_STANDARD = [
  "ABYSS","ASCENT","BIND","BREEZE","CORRODE","FRACTURE",
  "HAVEN","ICEBOX","LOTUS","PEARL","SPLIT","SUNSET",
].sort((a,b)=>a.localeCompare(b));

// Current rotation (you can update anytime)
export const CURRENT_COMP_POOL = [
  "ABYSS","BIND","BREEZE","CORRODE","HAVEN","PEARL","SPLIT",
].sort((a,b)=>a.localeCompare(b));

export const LS_LOGO_A = "mapveto_logoA";
export const LS_LOGO_B = "mapveto_logoB";

export const State = {
  version: 5,
  teams: { A: "Team A", B: "Team B" },
  format: "bo3",
  banStarterTeam: "A", // who starts the ban/pick flow (TEAM, not turn label)

  allMaps: [],       // filtered metadata from API
  selectedKeys: [],  // checkbox selection
  preset: "current", // current | all | custom

  pool: [],          // applied pool
  actions: [],       // ordered: {type:'ban'|'pick', team:'A'|'B', map:'ASCENT'}
  sidePicks: {},     // map -> {by:'A'|'B', side:'ATTACKER'|'DEFENDER', for:'picked'|'decider'}

  steps: [],
  stepIndex: 0,

  coinHistory: [],
  pendingCoin: null,
  pendingSide: null, // {mapKey, chooserTeam, forType}
};
