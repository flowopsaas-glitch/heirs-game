// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  HEIRS — You Don't Play One Criminal. You Play A Family.                    ║
// ║  Complete Playable Vertical Slice                                            ║
// ║                                                                              ║
// ║  Core loop: Roam → Plan → Commit → Execute → Permadeath → Succession        ║
// ║  The city remembers. The family endures.                                     ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: ENGINE CORE — Game Loop, Input, Camera, State Machine
// ═══════════════════════════════════════════════════════════════════════════════

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap-canvas');
const minimapCtx = minimapCanvas.getContext('2d');

// ─── Constants ───────────────────────────────────────────────────────────────
const TILE = 32;
const WORLD_W = 128; // tiles
const WORLD_H = 96;
const WORLD_PX_W = WORLD_W * TILE;
const WORLD_PX_H = WORLD_H * TILE;

// ─── Game Phases ─────────────────────────────────────────────────────────────
const PHASE = {
  TITLE: 'TITLE',
  ROAMING: 'ROAMING',
  DIALOGUE: 'DIALOGUE',
  PLANNING: 'PLANNING',
  COMBAT: 'COMBAT',
  AFTERMATH: 'AFTERMATH',
  SUCCESSION: 'SUCCESSION',
  GAME_OVER: 'GAME_OVER'
};

// ─── Game State ──────────────────────────────────────────────────────────────
const Game = {
  phase: PHASE.TITLE,
  tick: 0,
  worldTime: 21.75, // 24h clock (start at 21:45 — night)
  timeSpeed: 0.0003, // hours per tick
  day: 1,
  paused: false,
  camera: { x: 0, y: 0 },
  screenW: 0,
  screenH: 0,
  shake: { intensity: 0, decay: 0.9 },
  notifications: [],
  dialogueQueue: [],
  currentDialogue: null,
  missionAvailable: null,
  missionActive: false,
  combatTimer: 0,
  combatLog: [],
  aftermathTimer: 0,
  successionTimer: 0,
  fallenMember: null,
  tutorialShown: false
};

// ─── Input ───────────────────────────────────────────────────────────────────
const Keys = {};
const Mouse = { x: 0, y: 0, clicked: false, worldX: 0, worldY: 0 };

document.addEventListener('keydown', e => { Keys[e.code] = true; });
document.addEventListener('keyup', e => { Keys[e.code] = false; });
canvas.addEventListener('mousemove', e => {
  Mouse.x = e.clientX; Mouse.y = e.clientY;
  Mouse.worldX = e.clientX + Game.camera.x;
  Mouse.worldY = e.clientY + Game.camera.y;
});
canvas.addEventListener('click', () => { Mouse.clicked = true; });

// ─── Resize ──────────────────────────────────────────────────────────────────
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  Game.screenW = canvas.width;
  Game.screenH = canvas.height;
}
window.addEventListener('resize', resize);
resize();

// ─── Audio (Web Audio API — procedural) ──────────────────────────────────────
let audioCtx = null;
function initAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, duration, type = 'sine', volume = 0.1) {
  if (!audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function sfxShoot() { playTone(80 + Math.random() * 40, 0.15, 'sawtooth', 0.15); }
function sfxHit() { playTone(200, 0.08, 'square', 0.12); }
function sfxDeath() { 
  playTone(150, 0.5, 'sawtooth', 0.2);
  setTimeout(() => playTone(100, 0.8, 'sine', 0.15), 200);
}
function sfxClick() { playTone(800, 0.05, 'sine', 0.08); }
function sfxLock() { 
  playTone(400, 0.1, 'square', 0.1);
  setTimeout(() => playTone(600, 0.1, 'square', 0.1), 100);
}
function sfxAmbient() { playTone(60 + Math.random() * 20, 2, 'sine', 0.02); }



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: WORLD MAP — Districts, Buildings, Roads, Ambient Life
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Districts ───────────────────────────────────────────────────────────────
const Districts = [
  {
    id: 'narrows',
    name: 'THE NARROWS',
    description: 'Tight streets, old tenements. Your family started here.',
    color: '#2a2520',
    accentColor: '#5a4a35',
    bounds: { x: 0, y: 0, w: 64, h: 48 }, // in tiles
    dangerLevel: 60,
    lawEnforcement: 30,
    wealth: 25,
    controlledBy: 'player', // starts as player territory
    buildings: [],
    npcs: []
  },
  {
    id: 'docks',
    name: 'PORTO DOCKS',
    description: 'Shipping containers, smuggling routes, the Voss family\'s stronghold.',
    color: '#1a2025',
    accentColor: '#3a5060',
    bounds: { x: 64, y: 0, w: 64, h: 48 },
    dangerLevel: 75,
    lawEnforcement: 20,
    wealth: 50,
    controlledBy: 'voss',
    buildings: [],
    npcs: []
  },
  {
    id: 'midtown',
    name: 'MIDTOWN',
    description: 'Business district. Money flows here. The Corsini family runs it quietly.',
    color: '#1f1f25',
    accentColor: '#4a4a60',
    bounds: { x: 0, y: 48, w: 64, h: 48 },
    dangerLevel: 30,
    lawEnforcement: 70,
    wealth: 80,
    controlledBy: 'corsini',
    buildings: [],
    npcs: []
  },
  {
    id: 'furnace',
    name: 'THE FURNACE',
    description: 'Industrial wasteland. Neutral ground. Deals get made here because nobody watches.',
    color: '#201a1a',
    accentColor: '#604030',
    bounds: { x: 64, y: 48, w: 64, h: 48 },
    dangerLevel: 85,
    lawEnforcement: 10,
    wealth: 15,
    controlledBy: null,
    buildings: [],
    npcs: []
  }
];

// ─── Building Types ──────────────────────────────────────────────────────────
const BLDG = {
  HOUSE: { w: 2, h: 2, color: '#3a3530', roofColor: '#4a4035' },
  WAREHOUSE: { w: 4, h: 3, color: '#2a2a30', roofColor: '#3a3a40' },
  SHOP: { w: 2, h: 2, color: '#35302a', roofColor: '#454035' },
  BAR: { w: 3, h: 2, color: '#302520', roofColor: '#453530', interact: true },
  SAFEHOUSE: { w: 3, h: 3, color: '#252520', roofColor: '#3a3530', interact: true },
  OFFICE: { w: 3, h: 4, color: '#2a2a35', roofColor: '#3a3a45' },
  FACTORY: { w: 5, h: 4, color: '#252025', roofColor: '#353035' },
  CONTAINER: { w: 2, h: 1, color: '#2a3540', roofColor: '#3a4550' },
};

// ─── Generate World ──────────────────────────────────────────────────────────
function generateBuildings() {
  for (const dist of Districts) {
    dist.buildings = [];
    const b = dist.bounds;
    const numBuildings = 15 + Math.floor(Math.random() * 20);
    
    for (let i = 0; i < numBuildings; i++) {
      const types = Object.keys(BLDG);
      const typeKey = types[Math.floor(Math.random() * types.length)];
      const type = BLDG[typeKey];
      
      const bx = b.x + 2 + Math.floor(Math.random() * (b.w - type.w - 4));
      const by = b.y + 2 + Math.floor(Math.random() * (b.h - type.h - 4));
      
      // Check overlap
      let overlap = false;
      for (const existing of dist.buildings) {
        if (bx < existing.x + existing.w + 1 && bx + type.w + 1 > existing.x &&
            by < existing.y + existing.h + 1 && by + type.h + 1 > existing.y) {
          overlap = true;
          break;
        }
      }
      if (overlap) continue;
      
      dist.buildings.push({
        x: bx, y: by,
        w: type.w, h: type.h,
        color: type.color,
        roofColor: type.roofColor,
        type: typeKey,
        interact: type.interact || false,
        districtId: dist.id
      });
    }
  }
}

// ─── Road Network (simplified grid roads) ────────────────────────────────────
const Roads = [];
function generateRoads() {
  // Horizontal roads every ~12 tiles
  for (let y = 10; y < WORLD_H; y += 10 + Math.floor(Math.random() * 4)) {
    Roads.push({ x1: 0, y1: y, x2: WORLD_W, y2: y, width: 2 });
  }
  // Vertical roads every ~10 tiles
  for (let x = 8; x < WORLD_W; x += 8 + Math.floor(Math.random() * 4)) {
    Roads.push({ x1: x, y1: 0, x2: x, y2: WORLD_H, width: 2 });
  }
  // District borders are major roads
  Roads.push({ x1: 64, y1: 0, x2: 64, y2: WORLD_H, width: 3 }); // vertical split
  Roads.push({ x1: 0, y1: 48, x2: WORLD_W, y2: 48, width: 3 }); // horizontal split
}

// ─── NPCs (ambient + interactable) ──────────────────────────────────────────
const NPCs = [];
const NPC_TYPES = {
  CIVILIAN: { color: '#6a6a6a', speed: 0.3, interactable: false },
  DEALER: { color: '#5a7a5a', speed: 0.2, interactable: true },
  INFORMANT: { color: '#7a7a5a', speed: 0.4, interactable: true },
  GANG_MEMBER: { color: '#7a4a4a', speed: 0.5, interactable: false },
  MERCHANT: { color: '#5a5a7a', speed: 0.2, interactable: true },
  MISSION_GIVER: { color: '#d4a843', speed: 0, interactable: true },
};

function spawnNPCs() {
  // Ambient civilians
  for (const dist of Districts) {
    const b = dist.bounds;
    const count = 8 + Math.floor(Math.random() * 12);
    for (let i = 0; i < count; i++) {
      NPCs.push(createNPC(
        'CIVILIAN',
        (b.x + 2 + Math.random() * (b.w - 4)) * TILE,
        (b.y + 2 + Math.random() * (b.h - 4)) * TILE,
        dist.id,
        null
      ));
    }
    
    // District-specific NPCs
    if (dist.id === 'narrows') {
      NPCs.push(createNPC('MISSION_GIVER', (b.x + b.w/2) * TILE, (b.y + b.h/2) * TILE, dist.id, 
        { name: 'OLD SANTO', dialogue: getMissionDialogue, isMissionGiver: true }));
      NPCs.push(createNPC('INFORMANT', (b.x + 10) * TILE, (b.y + 8) * TILE, dist.id,
        { name: 'WHISPER', dialogue: getInformantDialogue }));
    }
    if (dist.id === 'docks') {
      NPCs.push(createNPC('GANG_MEMBER', (b.x + 10) * TILE, (b.y + 10) * TILE, dist.id,
        { name: 'VOSS GUARD', faction: 'voss' }));
      NPCs.push(createNPC('DEALER', (b.x + 20) * TILE, (b.y + 15) * TILE, dist.id,
        { name: 'PIKE', dialogue: getDealerDialogue }));
    }
    if (dist.id === 'midtown') {
      NPCs.push(createNPC('MERCHANT', (b.x + 15) * TILE, (b.y + 12) * TILE, dist.id,
        { name: 'ACQUISITIONS', dialogue: getMerchantDialogue }));
    }
    if (dist.id === 'furnace') {
      NPCs.push(createNPC('INFORMANT', (b.x + 20) * TILE, (b.y + 20) * TILE, dist.id,
        { name: 'GHOST', dialogue: getGhostDialogue }));
    }
  }
}

function createNPC(type, x, y, districtId, extra) {
  const typeData = NPC_TYPES[type];
  return {
    type, x, y, districtId,
    color: typeData.color,
    speed: typeData.speed,
    interactable: typeData.interactable || (extra && extra.dialogue),
    name: extra?.name || generateCivilianName(),
    faction: extra?.faction || null,
    dialogue: extra?.dialogue || null,
    isMissionGiver: extra?.isMissionGiver || false,
    // Movement
    targetX: x, targetY: y,
    moveTimer: Math.random() * 200,
    // Memory
    witnessed: [], // events this NPC has seen
    opinionOfPlayer: 0, // -100 to 100
    knowsPlayerBy: null, // which crew member they associate with player faction
    alive: true
  };
}

function generateCivilianName() {
  const names = ['RESIDENT', 'PASSERBY', 'LOCAL', 'WORKER', 'STRANGER'];
  return names[Math.floor(Math.random() * names.length)];
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: CREW SYSTEM — Stats, Roles, Heir Designation, Permadeath
// ═══════════════════════════════════════════════════════════════════════════════

const Crew = {
  members: [],
  leaderId: null,
  heirId: null,
  familyName: 'MORTARA',
  standing: 30, // 0-100, family's overall power/rep in city
  wealth: 5000,
  territory: ['narrows']
};

function initCrew() {
  Crew.members = [
    {
      id: 'elena',
      name: 'ELENA MORTARA',
      shortName: 'ELENA',
      role: 'LEADER',
      age: 34,
      portrait: { hair: '#1a1a1a', skin: '#c4a882', scar: true },
      hp: 100, maxHp: 100,
      skills: { combat: 72, stealth: 55, charisma: 80, driving: 60, tech: 40 },
      traits: { loyalty: 95, ambition: 85, courage: 78, composure: 70 },
      alive: true,
      state: 'ACTIVE',
      killCount: 0,
      missionsCompleted: 0,
      backstory: 'Founded the family operation after her father was killed by the Voss crew. Cold, calculating, never forgets a slight.',
      epitaph: null
    },
    {
      id: 'rico',
      name: 'RICO MORTARA',
      shortName: 'RICO',
      role: 'HEIR',
      age: 28,
      portrait: { hair: '#2a1a0a', skin: '#b89870', scar: false },
      hp: 100, maxHp: 100,
      skills: { combat: 85, stealth: 40, charisma: 55, driving: 78, tech: 30 },
      traits: { loyalty: 88, ambition: 70, courage: 90, composure: 55 },
      alive: true,
      state: 'ACTIVE',
      killCount: 0,
      missionsCompleted: 0,
      backstory: 'Elena\'s younger brother. Hot-headed but fiercely loyal. The muscle of the operation.',
      epitaph: null
    },
    {
      id: 'nadia',
      name: 'NADIA SOREL',
      shortName: 'NADIA',
      role: 'LIEUTENANT',
      age: 31,
      portrait: { hair: '#4a2a1a', skin: '#d4b090', scar: false },
      hp: 100, maxHp: 100,
      skills: { combat: 50, stealth: 82, charisma: 68, driving: 45, tech: 88 },
      traits: { loyalty: 72, ambition: 60, courage: 65, composure: 85 },
      alive: true,
      state: 'ACTIVE',
      killCount: 0,
      missionsCompleted: 0,
      backstory: 'Not blood — chose the family. Former security consultant. Handles intel and tech.',
      epitaph: null
    },
    {
      id: 'tomás',
      name: 'TOMÁS VEGA',
      shortName: 'TOMÁS',
      role: 'SOLDIER',
      age: 22,
      portrait: { hair: '#0a0a0a', skin: '#a08060', scar: false },
      hp: 100, maxHp: 100,
      skills: { combat: 60, stealth: 70, charisma: 45, driving: 90, tech: 55 },
      traits: { loyalty: 65, ambition: 80, courage: 72, composure: 60 },
      alive: true,
      state: 'ACTIVE',
      killCount: 0,
      missionsCompleted: 0,
      backstory: 'Newest recruit. Proving himself. Best wheelman in Santo Porto but green in a firefight.',
      epitaph: null
    }
  ];
  
  Crew.leaderId = 'elena';
  Crew.heirId = 'rico';
}

function getLeader() { return Crew.members.find(m => m.id === Crew.leaderId); }
function getHeir() { return Crew.members.find(m => m.id === Crew.heirId); }
function getAliveMembers() { return Crew.members.filter(m => m.alive); }
function getMember(id) { return Crew.members.find(m => m.id === id); }

function getSuccessor() {
  // Heir first, then highest loyalty+ambition alive member
  if (Crew.heirId) {
    const heir = getMember(Crew.heirId);
    if (heir && heir.alive) return heir;
  }
  const alive = getAliveMembers().filter(m => m.id !== Crew.leaderId);
  if (alive.length === 0) return null;
  alive.sort((a, b) => (b.traits.loyalty + b.traits.ambition) - (a.traits.loyalty + a.traits.ambition));
  return alive[0];
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: CITY MEMORY — NPCs Remember, World Reacts, Reputation Tracks
// ═══════════════════════════════════════════════════════════════════════════════

const CityMemory = {
  events: [],         // every notable thing that happened
  reputation: {       // per-faction reputation for each crew member
    voss: {},
    corsini: {},
    police: {},
    civilians: {}
  },
  grudges: [],        // active grudges between entities
  rumors: [],         // spreading information
  witnessedKills: [], // who saw who kill whom — CORE MECHANIC
  familyLegacy: []    // permanent record of the family's deeds
};

function recordMemoryEvent(event) {
  CityMemory.events.push({
    ...event,
    tick: Game.tick,
    day: Game.day,
    time: Game.worldTime
  });
  
  // Add to family legacy if significant
  if (event.severity >= 7) {
    CityMemory.familyLegacy.push({
      description: event.description,
      day: Game.day,
      actor: event.actor,
      type: event.type
    });
  }
}

function recordWitnessedKill(killer, victim, witnesses, districtId) {
  const killRecord = {
    killer: killer.id || killer.name,
    killerName: killer.shortName || killer.name,
    victim: victim.name,
    victimFaction: victim.faction,
    districtId,
    witnesses: witnesses.map(w => w.name || w.id),
    day: Game.day,
    tick: Game.tick,
    consequences: []
  };
  
  CityMemory.witnessedKills.push(killRecord);
  
  // Witnesses remember — they now associate this crew member with violence
  for (const witness of witnesses) {
    witness.knowsPlayerBy = killer.shortName || killer.name;
    witness.opinionOfPlayer -= 30;
    witness.witnessed.push({
      type: 'KILL',
      actor: killRecord.killerName,
      victim: killRecord.victim,
      tick: Game.tick
    });
  }
  
  // Faction reaction — the killed person's faction remembers WHO did it
  if (victim.faction) {
    const factionRep = CityMemory.reputation[victim.faction];
    if (factionRep) {
      const killerId = killer.id || killer.name;
      factionRep[killerId] = (factionRep[killerId] || 0) - 40;
      
      // Grudge formation
      CityMemory.grudges.push({
        holder: victim.faction,
        target: killerId,
        targetName: killer.shortName || killer.name,
        reason: `killed ${victim.name}`,
        intensity: 80,
        formed: Game.day,
        resolved: false
      });
    }
  }
  
  // District heat
  const dist = Districts.find(d => d.id === districtId);
  if (dist) dist.dangerLevel = Math.min(100, dist.dangerLevel + 15);
  
  notify(`The city remembers: ${killRecord.killerName} killed ${killRecord.victim}`, 'critical');
}

function spreadRumor(content, originDistrict, aboutMember) {
  CityMemory.rumors.push({
    content,
    origin: originDistrict,
    about: aboutMember,
    spread: 1, // will increase over time
    day: Game.day
  });
  
  // Rumors affect NPC opinions in nearby districts
  for (const npc of NPCs) {
    if (npc.districtId === originDistrict && npc.alive) {
      npc.opinionOfPlayer += (content.includes('helped') ? 5 : -5);
    }
  }
}

function getReputationWith(faction) {
  const factionRep = CityMemory.reputation[faction];
  if (!factionRep) return 0;
  let total = 0;
  let count = 0;
  for (const val of Object.values(factionRep)) {
    total += val;
    count++;
  }
  return count > 0 ? total / count : 0;
}

function getGrudgesAgainst(memberId) {
  return CityMemory.grudges.filter(g => g.target === memberId && !g.resolved);
}

// When succession happens, the city reacts to the NEW leader based on
// what the old leader did — but also what THEY personally did
function cityReactsToSuccession(fallen, successor) {
  const grudgesTransferred = CityMemory.grudges.filter(g => g.target === fallen.id && !g.resolved);
  
  for (const grudge of grudgesTransferred) {
    // Grudge partially transfers to the family, but intensity drops
    // because the actual killer is dead
    CityMemory.grudges.push({
      holder: grudge.holder,
      target: successor.id,
      targetName: successor.shortName,
      reason: `inherited blood debt from ${fallen.shortName} (${grudge.reason})`,
      intensity: Math.floor(grudge.intensity * 0.5), // reduced
      formed: Game.day,
      resolved: false
    });
    grudge.resolved = true; // original grudge dies with the person
  }
  
  // NPCs who knew the fallen react
  for (const npc of NPCs) {
    if (npc.knowsPlayerBy === fallen.shortName) {
      npc.knowsPlayerBy = successor.shortName;
      // Some respect for the successor, some wariness
      npc.opinionOfPlayer = Math.floor(npc.opinionOfPlayer * 0.6);
    }
  }
  
  spreadRumor(
    `${fallen.shortName} is dead. ${successor.shortName} leads the ${Crew.familyName} now.`,
    Districts[0].id,
    successor.id
  );
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: COMMIT-BASED COMBAT — Plan, Lock, Execute, No Mid-Fight Changes
// ═══════════════════════════════════════════════════════════════════════════════

const Combat = {
  mission: null,
  participants: [],
  enemies: [],
  orders: {},     // memberId -> { stance, weapon, priority, retreatAt }
  locked: false,
  executing: false,
  executionTick: 0,
  events: [],
  outcome: null
};

const WEAPONS = {
  PISTOL: { name: 'Pistol', accuracy: 70, damage: 25, range: 150, rateOfFire: 1.5, noise: 60 },
  SMG: { name: 'SMG', accuracy: 50, damage: 18, range: 120, rateOfFire: 4, noise: 80 },
  SHOTGUN: { name: 'Shotgun', accuracy: 85, damage: 45, range: 80, rateOfFire: 0.8, noise: 90 },
  RIFLE: { name: 'Rifle', accuracy: 75, damage: 35, range: 250, rateOfFire: 2, noise: 85 },
  KNIFE: { name: 'Knife', accuracy: 90, damage: 40, range: 30, rateOfFire: 2, noise: 5 },
};

const STANCES = {
  AGGRESSIVE: { name: 'Aggressive', hitMod: 1.2, dodgeMod: 0.7, description: 'Push forward. Kill first.' },
  DEFENSIVE: { name: 'Defensive', hitMod: 0.8, dodgeMod: 1.4, description: 'Hold position. Stay alive.' },
  FLANKING: { name: 'Flanking', hitMod: 1.0, dodgeMod: 1.0, description: 'Move to the side. Surprise them.' },
  OVERWATCH: { name: 'Overwatch', hitMod: 1.1, dodgeMod: 1.2, description: 'Cover the team. React to threats.' },
  STEALTH: { name: 'Stealth', hitMod: 1.5, dodgeMod: 1.5, description: 'Silent approach. One chance.' },
};

const Missions = [
  {
    id: 'docks_raid',
    name: 'DOCK WAREHOUSE RAID',
    description: 'Hit the Voss supply cache at Porto Docks. High risk, high reward.',
    district: 'docks',
    enemyCount: 5,
    enemyStrength: 65,
    reward: { wealth: 3000, standing: 15, territory: null },
    risk: 'HIGH',
    intelRequired: false,
    enemies: [
      { name: 'VOSS ENFORCER', hp: 80, accuracy: 60, damage: 20, faction: 'voss' },
      { name: 'VOSS GUARD', hp: 60, accuracy: 50, damage: 15, faction: 'voss' },
      { name: 'VOSS GUARD', hp: 60, accuracy: 50, damage: 15, faction: 'voss' },
      { name: 'VOSS LOOKOUT', hp: 40, accuracy: 45, damage: 12, faction: 'voss' },
      { name: 'VOSS LIEUTENANT', hp: 100, accuracy: 70, damage: 28, faction: 'voss' },
    ]
  },
  {
    id: 'midtown_heist',
    name: 'CORSINI MONEY HOUSE',
    description: 'The Corsini launder through a midtown office. Clean them out.',
    district: 'midtown',
    enemyCount: 4,
    enemyStrength: 70,
    reward: { wealth: 5000, standing: 20, territory: 'midtown' },
    risk: 'EXTREME',
    intelRequired: true,
    enemies: [
      { name: 'CORSINI SOLDIER', hp: 70, accuracy: 65, damage: 22, faction: 'corsini' },
      { name: 'CORSINI SOLDIER', hp: 70, accuracy: 65, damage: 22, faction: 'corsini' },
      { name: 'CORSINI BODYGUARD', hp: 120, accuracy: 55, damage: 30, faction: 'corsini' },
      { name: 'CORSINI CAPTAIN', hp: 90, accuracy: 75, damage: 35, faction: 'corsini' },
    ]
  }
];

function startPlanningPhase(mission) {
  Combat.mission = mission;
  Combat.participants = getAliveMembers().map(m => m.id);
  Combat.enemies = mission.enemies.map(e => ({ ...e, alive: true, currentHp: e.hp }));
  Combat.orders = {};
  Combat.locked = false;
  Combat.executing = false;
  Combat.events = [];
  Combat.outcome = null;
  
  // Default orders for each participant
  for (const id of Combat.participants) {
    Combat.orders[id] = {
      stance: 'DEFENSIVE',
      weapon: 'PISTOL',
      priority: 'SURVIVAL',
      retreatAt: 30
    };
  }
  
  Game.phase = PHASE.PLANNING;
  showPlanningUI();
}

function lockOrders() {
  Combat.locked = true;
  sfxLock();
  notify('ORDERS LOCKED. No turning back.', 'critical');
  
  // Brief pause then execute
  setTimeout(() => {
    beginExecution();
  }, 1500);
}

function beginExecution() {
  Combat.executing = true;
  Combat.executionTick = 0;
  Game.phase = PHASE.COMBAT;
  hidePlanningUI();
  notify('EXECUTING...', 'critical');
}

// ─── Combat Resolution (tick-based simulation) ───────────────────────────────
function tickCombat() {
  if (!Combat.executing) return;
  Combat.executionTick++;
  
  // Combat resolves over ~180 ticks (3 seconds real-time)
  if (Combat.executionTick % 20 === 0) {
    resolveCombatRound();
  }
  
  // Check end conditions
  const aliveEnemies = Combat.enemies.filter(e => e.alive);
  const aliveParticipants = Combat.participants.filter(id => {
    const m = getMember(id);
    return m && m.alive && m.hp > 0;
  });
  
  if (aliveEnemies.length === 0) {
    endCombat('VICTORY');
  } else if (aliveParticipants.length === 0) {
    endCombat('DEFEAT');
  } else if (Combat.executionTick > 300) {
    endCombat('RETREAT');
  }
}

function resolveCombatRound() {
  // Each alive participant acts based on their LOCKED orders
  for (const memberId of Combat.participants) {
    const member = getMember(memberId);
    if (!member || !member.alive || member.hp <= 0) continue;
    
    const orders = Combat.orders[memberId];
    const stance = STANCES[orders.stance];
    const weapon = WEAPONS[orders.weapon];
    
    // Check retreat threshold
    if (member.hp / member.maxHp * 100 <= orders.retreatAt) {
      Combat.events.push({ type: 'RETREAT', actor: member.shortName, tick: Combat.executionTick });
      continue; // This member is trying to retreat — they don't shoot
    }
    
    // Pick target (alive enemies)
    const targets = Combat.enemies.filter(e => e.alive);
    if (targets.length === 0) continue;
    
    // Priority targeting
    let target;
    if (orders.priority === 'BIGGEST_THREAT') {
      target = targets.reduce((a, b) => b.damage > a.damage ? b : a);
    } else {
      target = targets[Math.floor(Math.random() * targets.length)];
    }
    
    // Hit calculation
    const baseAccuracy = weapon.accuracy;
    const skillMod = member.skills.combat / 100;
    const stanceMod = stance.hitMod;
    const hitChance = Math.min(95, baseAccuracy * skillMod * stanceMod);
    
    const hit = Math.random() * 100 < hitChance;
    sfxShoot();
    Game.shake.intensity = 3;
    
    if (hit) {
      const damage = weapon.damage * (0.8 + Math.random() * 0.4);
      target.currentHp -= damage;
      sfxHit();
      
      Combat.events.push({
        type: 'HIT', actor: member.shortName, target: target.name,
        damage: Math.floor(damage), tick: Combat.executionTick
      });
      
      if (target.currentHp <= 0) {
        target.alive = false;
        member.killCount++;
        Combat.events.push({
          type: 'KILL', actor: member.shortName, target: target.name,
          tick: Combat.executionTick
        });
        
        // Witnesses — any NPCs in the mission district
        const missionDist = Combat.mission.district;
        const witnesses = NPCs.filter(n => n.districtId === missionDist && n.alive);
        recordWitnessedKill(member, target, witnesses.slice(0, 3), missionDist);
      }
    } else {
      Combat.events.push({
        type: 'MISS', actor: member.shortName, target: target.name,
        tick: Combat.executionTick
      });
    }
  }
  
  // Enemies shoot back
  const aliveEnemies = Combat.enemies.filter(e => e.alive);
  for (const enemy of aliveEnemies) {
    const validTargets = Combat.participants.filter(id => {
      const m = getMember(id);
      return m && m.alive && m.hp > 0;
    });
    if (validTargets.length === 0) continue;
    
    const targetId = validTargets[Math.floor(Math.random() * validTargets.length)];
    const target = getMember(targetId);
    const orders = Combat.orders[targetId];
    const stance = STANCES[orders.stance];
    
    // Enemy hit calculation (affected by target's dodge from stance)
    const hitChance = Math.min(85, enemy.accuracy / stance.dodgeMod);
    const hit = Math.random() * 100 < hitChance;
    
    if (hit) {
      const damage = enemy.damage * (0.7 + Math.random() * 0.5);
      target.hp -= damage;
      Game.shake.intensity = 5;
      
      Combat.events.push({
        type: 'MEMBER_HIT', actor: enemy.name, target: target.shortName,
        damage: Math.floor(damage), tick: Combat.executionTick
      });
      
      if (target.hp <= 0) {
        target.hp = 0;
        target.alive = false;
        target.state = 'DEAD';
        target.epitaph = `Killed by ${enemy.name} during ${Combat.mission.name}. Day ${Game.day}.`;
        sfxDeath();
        Game.shake.intensity = 15;
        
        Combat.events.push({
          type: 'MEMBER_KILLED', actor: enemy.name, target: target.shortName,
          tick: Combat.executionTick
        });
        
        recordMemoryEvent({
          type: 'CREW_DEATH',
          actor: enemy.name,
          target: target.shortName,
          description: `${target.name} was killed by ${enemy.name}`,
          district: Combat.mission.district,
          severity: 9
        });
      }
    }
  }
}

function endCombat(outcome) {
  Combat.executing = false;
  Combat.outcome = outcome;
  Game.phase = PHASE.AFTERMATH;
  Game.aftermathTimer = 0;
  
  if (outcome === 'VICTORY') {
    Crew.wealth += Combat.mission.reward.wealth;
    Crew.standing = Math.min(100, Crew.standing + Combat.mission.reward.standing);
    if (Combat.mission.reward.territory) {
      const dist = Districts.find(d => d.id === Combat.mission.reward.territory);
      if (dist) dist.controlledBy = 'player';
      Crew.territory.push(Combat.mission.reward.territory);
    }
    notify(`MISSION COMPLETE: ${Combat.mission.name}`, 'success');
    // Mark surviving participants
    for (const id of Combat.participants) {
      const m = getMember(id);
      if (m && m.alive) m.missionsCompleted++;
    }
  } else if (outcome === 'DEFEAT') {
    notify('MISSION FAILED. Heavy losses.', 'critical');
    Crew.standing = Math.max(0, Crew.standing - 10);
  } else {
    notify('Forced retreat. Partial failure.', 'critical');
  }
  
  // Check if leader died — trigger succession
  const leader = getLeader();
  if (!leader || !leader.alive) {
    Game.fallenMember = leader;
    setTimeout(() => triggerSuccession(), 2000);
  }
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: SUCCESSION — Death Triggers Control Transfer With Narrative Weight
// ═══════════════════════════════════════════════════════════════════════════════

function triggerSuccession() {
  const fallen = Game.fallenMember;
  const successor = getSuccessor();
  
  if (!successor) {
    // GAME OVER — entire line wiped
    Game.phase = PHASE.GAME_OVER;
    showGameOver();
    return;
  }
  
  Game.phase = PHASE.SUCCESSION;
  Game.successionTimer = 0;
  
  // Show succession overlay
  const overlay = document.getElementById('succession-overlay');
  overlay.querySelector('.fallen-name').textContent = fallen.name;
  overlay.querySelector('.fallen-epitaph').textContent = fallen.epitaph || `Lost on Day ${Game.day}. The city will not forget.`;
  overlay.querySelector('.successor-name').textContent = successor.name;
  overlay.classList.add('active');
  
  sfxDeath();
  
  // Set up the continue button
  const btn = overlay.querySelector('.continue-btn');
  btn.onclick = () => {
    completeSuccession(fallen, successor);
    overlay.classList.remove('active');
  };
}

function completeSuccession(fallen, successor) {
  // Transfer leadership
  Crew.leaderId = successor.id;
  successor.role = 'LEADER';
  
  // Find new heir
  const remaining = getAliveMembers().filter(m => m.id !== successor.id);
  if (remaining.length > 0) {
    // Highest loyalty becomes heir
    remaining.sort((a, b) => b.traits.loyalty - a.traits.loyalty);
    Crew.heirId = remaining[0].id;
    remaining[0].role = 'HEIR';
  } else {
    Crew.heirId = null;
  }
  
  // City reacts to the change of power
  cityReactsToSuccession(fallen, successor);
  
  // Family standing takes a hit but recovers with new leadership
  Crew.standing = Math.max(0, Crew.standing - 15);
  
  // Record in legacy
  recordMemoryEvent({
    type: 'SUCCESSION',
    actor: successor.shortName,
    target: fallen.shortName,
    description: `${successor.name} took control of the ${Crew.familyName} family after ${fallen.shortName}'s death`,
    district: 'narrows',
    severity: 10
  });
  
  notify(`${successor.shortName} now leads the ${Crew.familyName} family.`, 'critical');
  
  // Return to roaming
  Game.phase = PHASE.ROAMING;
  updateCrewPanel();
}

function showGameOver() {
  // Replace title screen content with game over
  const screen = document.getElementById('title-screen');
  screen.querySelector('h1').textContent = 'LINEAGE ENDED';
  screen.querySelector('.subtitle').innerHTML = `
    The ${Crew.familyName} family lasted ${Game.day} days.<br><br>
    ${CityMemory.familyLegacy.length} deeds remembered by the city.<br>
    ${CityMemory.witnessedKills.length} kills witnessed.<br>
    ${Crew.members.filter(m => !m.alive).length} members lost.<br><br>
    The city moves on. New families will rise.
  `;
  screen.querySelector('.start-btn').textContent = 'START NEW LINEAGE';
  screen.querySelector('.start-btn').onclick = () => {
    location.reload();
  };
  screen.style.display = 'flex';
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: DIALOGUE & INTERACTION SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function getMissionDialogue() {
  if (Game.missionAvailable) {
    return [
      { speaker: 'OLD SANTO', text: `The job's still on the table. ${Game.missionAvailable.name}. You ready to plan?`, action: 'OFFER_MISSION' }
    ];
  }
  // Pick a random available mission
  const availMission = Missions[Math.floor(Math.random() * Missions.length)];
  Game.missionAvailable = availMission;
  return [
    { speaker: 'OLD SANTO', text: `I got something for the ${Crew.familyName} family.` },
    { speaker: 'OLD SANTO', text: `${availMission.name}. ${availMission.description}` },
    { speaker: 'OLD SANTO', text: `Risk level: ${availMission.risk}. You interested?`, action: 'OFFER_MISSION' }
  ];
}

function getInformantDialogue() {
  const grudges = CityMemory.grudges.filter(g => !g.resolved);
  if (grudges.length > 0) {
    const g = grudges[grudges.length - 1];
    return [
      { speaker: 'WHISPER', text: `Word on the street... the ${g.holder} haven't forgotten what ${g.targetName} did.` },
      { speaker: 'WHISPER', text: `They're looking for payback. Watch your back in their territory.` }
    ];
  }
  return [
    { speaker: 'WHISPER', text: `Nothing big moving right now. But the Voss are restless at the docks.` },
    { speaker: 'WHISPER', text: `Might be worth scouting. You never know what falls off a truck.` }
  ];
}

function getDealerDialogue() {
  return [
    { speaker: 'PIKE', text: `You're on Voss turf, friend. Buying or just looking to get hurt?` },
    { speaker: 'PIKE', text: `The Voss don't play. But money talks. Come back with a deal and maybe we can do business.` }
  ];
}

function getMerchantDialogue() {
  return [
    { speaker: 'ACQUISITIONS', text: `Clean money, dirty money — I don't discriminate.` },
    { speaker: 'ACQUISITIONS', text: `You want better gear for your crew? I can arrange things. For a price.` }
  ];
}

function getGhostDialogue() {
  const leader = getLeader();
  return [
    { speaker: 'GHOST', text: `${leader ? leader.shortName : 'You'}... I see what you're building. Be careful.` },
    { speaker: 'GHOST', text: `This city eats families. The Voss know that. The Corsini know that.` },
    { speaker: 'GHOST', text: `Only difference between them and a corpse is how many people they had left when the bullets stopped.` }
  ];
}

function startDialogue(lines) {
  Game.dialogueQueue = [...lines];
  advanceDialogue();
}

function advanceDialogue() {
  if (Game.dialogueQueue.length === 0) {
    endDialogue();
    return;
  }
  
  const line = Game.dialogueQueue.shift();
  Game.currentDialogue = line;
  Game.phase = PHASE.DIALOGUE;
  
  const box = document.getElementById('dialogue-box');
  document.getElementById('dialogue-speaker').textContent = line.speaker;
  document.getElementById('dialogue-text').textContent = line.text;
  box.classList.add('active');
  
  // If this line has an action
  if (line.action === 'OFFER_MISSION' && Game.dialogueQueue.length === 0) {
    document.getElementById('dialogue-continue').textContent = '[ SPACE: Accept Job ] [ ESC: Decline ]';
  } else {
    document.getElementById('dialogue-continue').textContent = '[ SPACE to continue ]';
  }
}

function endDialogue() {
  Game.currentDialogue = null;
  Game.phase = PHASE.ROAMING;
  document.getElementById('dialogue-box').classList.remove('active');
}

function handleDialogueInput() {
  if (Keys['Space']) {
    Keys['Space'] = false;
    
    if (Game.currentDialogue?.action === 'OFFER_MISSION' && Game.dialogueQueue.length === 0) {
      // Accept mission
      endDialogue();
      if (Game.missionAvailable) {
        startPlanningPhase(Game.missionAvailable);
        Game.missionAvailable = null;
      }
    } else {
      advanceDialogue();
    }
  }
  if (Keys['Escape']) {
    Keys['Escape'] = false;
    endDialogue();
  }
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: RENDERING — GTA6-Level Visual Polish (Canvas 2D Cinematic Style)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Lighting & Atmosphere System ────────────────────────────────────────────
function getAmbientLight() {
  const t = Game.worldTime;
  if (t >= 5 && t < 7) return { r: 60, g: 50, b: 70, a: 0.4 };    // Dawn - purple haze
  if (t >= 7 && t < 12) return { r: 255, g: 240, b: 220, a: 0.05 }; // Morning - warm
  if (t >= 12 && t < 17) return { r: 255, g: 255, b: 250, a: 0.0 }; // Afternoon - clear
  if (t >= 17 && t < 21) return { r: 180, g: 100, b: 50, a: 0.2 };  // Evening - golden
  if (t >= 21 || t < 1) return { r: 20, g: 25, b: 50, a: 0.55 };    // Night - deep blue
  return { r: 10, g: 12, b: 30, a: 0.65 };                           // Late night - near black
}

function getTimeColor() {
  const t = Game.worldTime;
  if (t >= 21 || t < 5) return '#0a0c1a';
  if (t >= 5 && t < 7) return '#1a1520';
  if (t >= 7 && t < 12) return '#2a2520';
  if (t >= 12 && t < 17) return '#252520';
  return '#1a1515';
}

// ─── Particle System ─────────────────────────────────────────────────────────
const Particles = [];

function spawnParticle(x, y, type) {
  const p = { x, y, type, life: 1, maxLife: 1 };
  switch (type) {
    case 'muzzle':
      p.vx = (Math.random() - 0.5) * 4;
      p.vy = (Math.random() - 0.5) * 4;
      p.maxLife = 0.15;
      p.life = p.maxLife;
      p.size = 3 + Math.random() * 5;
      p.color = `rgba(255, ${150 + Math.random() * 100}, 50, `;
      break;
    case 'blood':
      p.vx = (Math.random() - 0.5) * 3;
      p.vy = (Math.random() - 0.5) * 3;
      p.maxLife = 0.8;
      p.life = p.maxLife;
      p.size = 2 + Math.random() * 3;
      p.color = `rgba(${130 + Math.random() * 50}, 20, 20, `;
      break;
    case 'spark':
      p.vx = (Math.random() - 0.5) * 6;
      p.vy = (Math.random() - 0.5) * 6;
      p.maxLife = 0.3;
      p.life = p.maxLife;
      p.size = 1 + Math.random() * 2;
      p.color = `rgba(255, 255, ${150 + Math.random() * 100}, `;
      break;
    case 'smoke':
      p.vx = (Math.random() - 0.5) * 0.5;
      p.vy = -0.5 - Math.random() * 0.5;
      p.maxLife = 2;
      p.life = p.maxLife;
      p.size = 5 + Math.random() * 10;
      p.color = `rgba(80, 80, 90, `;
      break;
  }
  Particles.push(p);
}

function updateParticles(dt) {
  for (let i = Particles.length - 1; i >= 0; i--) {
    const p = Particles[i];
    p.life -= dt;
    if (p.life <= 0) { Particles.splice(i, 1); continue; }
    p.x += p.vx;
    p.y += p.vy;
    if (p.type === 'smoke') { p.size += 0.3; p.vy *= 0.98; }
  }
}

function renderParticles() {
  for (const p of Particles) {
    const alpha = (p.life / p.maxLife);
    const sx = p.x - Game.camera.x;
    const sy = p.y - Game.camera.y;
    ctx.fillStyle = p.color + alpha + ')';
    ctx.beginPath();
    ctx.arc(sx, sy, p.size * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Volumetric Light Cones (streetlamps, car headlights) ────────────────────
const Lights = [];

function generateStreetLights() {
  // Place lights along roads
  for (const road of Roads) {
    const dx = road.x2 - road.x1;
    const dy = road.y2 - road.y1;
    const len = Math.sqrt(dx * dx + dy * dy);
    const steps = Math.floor(len / 12);
    for (let i = 0; i < steps; i++) {
      const t = i / steps;
      Lights.push({
        x: (road.x1 + dx * t) * TILE,
        y: (road.y1 + dy * t) * TILE,
        radius: 80 + Math.random() * 40,
        color: `rgba(255, 220, 150, `,
        intensity: 0.12 + Math.random() * 0.05,
        flicker: Math.random() * Math.PI * 2
      });
    }
  }
}

function renderLights() {
  // Only render at night
  const t = Game.worldTime;
  if (t >= 7 && t < 19) return;
  
  ctx.globalCompositeOperation = 'lighter';
  for (const light of Lights) {
    const sx = light.x - Game.camera.x;
    const sy = light.y - Game.camera.y;
    
    // Frustum cull
    if (sx < -light.radius || sx > Game.screenW + light.radius) continue;
    if (sy < -light.radius || sy > Game.screenH + light.radius) continue;
    
    const flicker = 1 + Math.sin(Game.tick * 0.05 + light.flicker) * 0.05;
    const grad = ctx.createRadialGradient(sx, sy, 0, sx, sy, light.radius * flicker);
    grad.addColorStop(0, light.color + (light.intensity * flicker) + ')');
    grad.addColorStop(1, light.color + '0)');
    ctx.fillStyle = grad;
    ctx.fillRect(sx - light.radius, sy - light.radius, light.radius * 2, light.radius * 2);
  }
  ctx.globalCompositeOperation = 'source-over';
}

// ─── Water/Reflection Effect ─────────────────────────────────────────────────
function renderWater() {
  // Docks district has water on the right edge
  const waterX = 120 * TILE - Game.camera.x;
  const waterY = 0 - Game.camera.y;
  const waterW = 8 * TILE;
  const waterH = 48 * TILE;
  
  if (waterX > Game.screenW || waterX + waterW < 0) return;
  
  // Animated water
  ctx.fillStyle = '#0a1520';
  ctx.fillRect(waterX, waterY, waterW, waterH);
  
  // Ripple effect
  for (let y = 0; y < waterH; y += 8) {
    const offset = Math.sin((Game.tick * 0.02) + y * 0.01) * 3;
    ctx.fillStyle = `rgba(30, 60, 90, ${0.1 + Math.sin(Game.tick * 0.01 + y * 0.02) * 0.05})`;
    ctx.fillRect(waterX + offset, waterY + y, waterW, 4);
  }
  
  // Moonlight reflection at night
  if (Game.worldTime >= 21 || Game.worldTime < 5) {
    const moonX = waterX + waterW / 2;
    const grad = ctx.createRadialGradient(moonX, waterY + 100, 0, moonX, waterY + 100, 60);
    grad.addColorStop(0, 'rgba(180, 200, 220, 0.08)');
    grad.addColorStop(1, 'rgba(180, 200, 220, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(moonX - 60, waterY + 40, 120, 120);
  }
}

// ─── Rain Effect ─────────────────────────────────────────────────────────────
let raindrops = [];
let isRaining = false;
let rainIntensity = 0;

function updateRain() {
  // Random chance to start/stop rain
  if (Game.tick % 3600 === 0) { // check every minute of game time
    isRaining = Math.random() < 0.3;
    rainIntensity = isRaining ? 0.3 + Math.random() * 0.7 : 0;
  }
  
  if (!isRaining) { raindrops = []; return; }
  
  // Spawn new drops
  const spawnCount = Math.floor(rainIntensity * 15);
  for (let i = 0; i < spawnCount; i++) {
    raindrops.push({
      x: Math.random() * Game.screenW,
      y: -10,
      speed: 8 + Math.random() * 6,
      length: 10 + Math.random() * 15
    });
  }
  
  // Update drops
  for (let i = raindrops.length - 1; i >= 0; i--) {
    raindrops[i].y += raindrops[i].speed;
    if (raindrops[i].y > Game.screenH) {
      raindrops.splice(i, 1);
    }
  }
}

function renderRain() {
  if (!isRaining) return;
  ctx.strokeStyle = `rgba(150, 170, 200, ${0.2 * rainIntensity})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const drop of raindrops) {
    ctx.moveTo(drop.x, drop.y);
    ctx.lineTo(drop.x + 1, drop.y + drop.length);
  }
  ctx.stroke();
}

// ─── Main Render Function ────────────────────────────────────────────────────
function render() {
  // Screen shake
  let shakeX = 0, shakeY = 0;
  if (Game.shake.intensity > 0.1) {
    shakeX = (Math.random() - 0.5) * Game.shake.intensity;
    shakeY = (Math.random() - 0.5) * Game.shake.intensity;
    Game.shake.intensity *= Game.shake.decay;
  }
  
  ctx.save();
  ctx.translate(shakeX, shakeY);
  
  // Clear with time-appropriate background
  ctx.fillStyle = getTimeColor();
  ctx.fillRect(0, 0, Game.screenW, Game.screenH);
  
  // Render world layers
  renderDistricts();
  renderRoads();
  renderWater();
  renderBuildings();
  renderLights();
  renderNPCs();
  renderPlayer();
  renderParticles();
  
  // Ambient overlay (time-of-day tinting)
  const ambient = getAmbientLight();
  if (ambient.a > 0) {
    ctx.fillStyle = `rgba(${ambient.r}, ${ambient.g}, ${ambient.b}, ${ambient.a})`;
    ctx.fillRect(0, 0, Game.screenW, Game.screenH);
  }
  
  renderRain();
  
  // Vignette
  renderVignette();
  
  // Combat overlay
  if (Game.phase === PHASE.COMBAT) {
    renderCombatOverlay();
  }
  
  ctx.restore();
  
  // Minimap (separate canvas, not affected by shake)
  renderMinimap();
}

function renderDistricts() {
  for (const dist of Districts) {
    const sx = dist.bounds.x * TILE - Game.camera.x;
    const sy = dist.bounds.y * TILE - Game.camera.y;
    const sw = dist.bounds.w * TILE;
    const sh = dist.bounds.h * TILE;
    
    // Frustum cull
    if (sx + sw < 0 || sx > Game.screenW || sy + sh < 0 || sy > Game.screenH) continue;
    
    // District ground
    ctx.fillStyle = dist.color;
    ctx.fillRect(sx, sy, sw, sh);
    
    // Subtle texture (noise pattern)
    ctx.fillStyle = `rgba(255, 255, 255, 0.01)`;
    for (let i = 0; i < 50; i++) {
      const nx = sx + Math.random() * sw;
      const ny = sy + Math.random() * sh;
      ctx.fillRect(nx, ny, 2 + Math.random() * 4, 2 + Math.random() * 4);
    }
    
    // District border glow (controlled territory)
    if (dist.controlledBy === 'player') {
      ctx.strokeStyle = 'rgba(212, 168, 67, 0.15)';
      ctx.lineWidth = 3;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
    } else if (dist.controlledBy === 'voss') {
      ctx.strokeStyle = 'rgba(180, 60, 60, 0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
    } else if (dist.controlledBy === 'corsini') {
      ctx.strokeStyle = 'rgba(80, 80, 180, 0.12)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sx + 1, sy + 1, sw - 2, sh - 2);
    }
  }
}

function renderRoads() {
  ctx.fillStyle = '#1a1815';
  for (const road of Roads) {
    const sx = road.x1 * TILE - Game.camera.x;
    const sy = road.y1 * TILE - Game.camera.y;
    
    if (road.x1 === road.x2) {
      // Vertical road
      const h = (road.y2 - road.y1) * TILE;
      ctx.fillRect(sx - road.width * TILE / 2, sy, road.width * TILE, h);
      // Center line
      ctx.strokeStyle = 'rgba(180, 150, 50, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx, sy + h);
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      // Horizontal road
      const w = (road.x2 - road.x1) * TILE;
      ctx.fillRect(sx, sy - road.width * TILE / 2, w, road.width * TILE);
      ctx.strokeStyle = 'rgba(180, 150, 50, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([8, 12]);
      ctx.beginPath();
      ctx.moveTo(sx, sy);
      ctx.lineTo(sx + w, sy);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }
}

function renderBuildings() {
  for (const dist of Districts) {
    for (const b of dist.buildings) {
      const sx = b.x * TILE - Game.camera.x;
      const sy = b.y * TILE - Game.camera.y;
      const sw = b.w * TILE;
      const sh = b.h * TILE;
      
      // Frustum cull
      if (sx + sw < 0 || sx > Game.screenW || sy + sh < 0 || sy > Game.screenH) continue;
      
      // Building shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.fillRect(sx + 4, sy + 4, sw, sh);
      
      // Building body
      ctx.fillStyle = b.color;
      ctx.fillRect(sx, sy, sw, sh);
      
      // Roof/top accent
      ctx.fillStyle = b.roofColor;
      ctx.fillRect(sx, sy, sw, 4);
      
      // Windows (lit at night)
      if (Game.worldTime >= 19 || Game.worldTime < 6) {
        const windowChance = 0.6;
        for (let wx = 0; wx < b.w; wx++) {
          for (let wy = 0; wy < b.h; wy++) {
            if (Math.random() < windowChance) {
              const windowColor = Math.random() < 0.7 
                ? `rgba(255, 220, 130, ${0.15 + Math.random() * 0.15})`
                : `rgba(100, 150, 255, ${0.08 + Math.random() * 0.08})`;
              ctx.fillStyle = windowColor;
              ctx.fillRect(sx + wx * TILE + 8, sy + wy * TILE + 8, 6, 6);
            }
          }
        }
      }
      
      // Interactive building indicator
      if (b.interact) {
        ctx.fillStyle = 'rgba(212, 168, 67, 0.3)';
        ctx.fillRect(sx, sy + sh - 3, sw, 3);
      }
    }
  }
}

function renderNPCs() {
  for (const npc of NPCs) {
    if (!npc.alive) continue;
    
    const sx = npc.x - Game.camera.x;
    const sy = npc.y - Game.camera.y;
    
    // Frustum cull
    if (sx < -20 || sx > Game.screenW + 20 || sy < -20 || sy > Game.screenH + 20) continue;
    
    // NPC shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.ellipse(sx, sy + 8, 5, 3, 0, 0, Math.PI * 2);
    ctx.fill();
    
    // NPC body (higher quality character rendering)
    ctx.fillStyle = npc.color;
    ctx.beginPath();
    ctx.arc(sx, sy, 6, 0, Math.PI * 2);
    ctx.fill();
    
    // Head
    ctx.fillStyle = '#c4a882';
    ctx.beginPath();
    ctx.arc(sx, sy - 7, 4, 0, Math.PI * 2);
    ctx.fill();
    
    // Interactable glow
    if (npc.interactable) {
      const dist = Math.sqrt(Math.pow(Player.x - npc.x, 2) + Math.pow(Player.y - npc.y, 2));
      if (dist < 80) {
        ctx.strokeStyle = 'rgba(212, 168, 67, 0.4)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(sx, sy, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    
    // Mission giver special indicator
    if (npc.isMissionGiver) {
      ctx.fillStyle = `rgba(212, 168, 67, ${0.5 + Math.sin(Game.tick * 0.05) * 0.3})`;
      ctx.beginPath();
      ctx.arc(sx, sy - 16, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    
    // Faction color band
    if (npc.faction === 'voss') {
      ctx.fillStyle = 'rgba(180, 50, 50, 0.7)';
      ctx.fillRect(sx - 3, sy + 3, 6, 2);
    } else if (npc.faction === 'corsini') {
      ctx.fillStyle = 'rgba(50, 50, 180, 0.7)';
      ctx.fillRect(sx - 3, sy + 3, 6, 2);
    }
  }
}



// ─── Player Rendering ────────────────────────────────────────────────────────
const Player = {
  x: 32 * TILE, // Start in middle of Narrows
  y: 24 * TILE,
  speed: 3,
  inVehicle: false,
  vehicleSpeed: 6,
  facing: 0, // radians
  moving: false,
  nearNPC: null,
  nearBuilding: null
};

function renderPlayer() {
  const leader = getLeader();
  if (!leader) return;
  
  const sx = Player.x - Game.camera.x;
  const sy = Player.y - Game.camera.y;
  
  // Shadow
  ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
  ctx.beginPath();
  ctx.ellipse(sx, sy + 10, Player.inVehicle ? 14 : 7, Player.inVehicle ? 6 : 4, 0, 0, Math.PI * 2);
  ctx.fill();
  
  if (Player.inVehicle) {
    // Car rendering
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Player.facing);
    
    // Car body
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(-16, -8, 32, 16);
    
    // Car details
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(-14, -6, 10, 12); // hood
    ctx.fillRect(4, -6, 10, 12);   // trunk
    
    // Windshield
    ctx.fillStyle = 'rgba(100, 150, 200, 0.3)';
    ctx.fillRect(-4, -5, 8, 10);
    
    // Headlights
    ctx.fillStyle = 'rgba(255, 240, 200, 0.8)';
    ctx.fillRect(-17, -3, 2, 2);
    ctx.fillRect(-17, 1, 2, 2);
    
    // Taillights
    ctx.fillStyle = 'rgba(200, 30, 30, 0.7)';
    ctx.fillRect(15, -3, 2, 2);
    ctx.fillRect(15, 1, 2, 2);
    
    ctx.restore();
    
    // Headlight cone at night
    if (Game.worldTime >= 19 || Game.worldTime < 6) {
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Player.facing);
      const hlGrad = ctx.createRadialGradient(-20, 0, 0, -80, 0, 80);
      hlGrad.addColorStop(0, 'rgba(255, 240, 200, 0.15)');
      hlGrad.addColorStop(1, 'rgba(255, 240, 200, 0)');
      ctx.fillStyle = hlGrad;
      ctx.beginPath();
      ctx.moveTo(-17, 0);
      ctx.lineTo(-100, -40);
      ctx.lineTo(-100, 40);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  } else {
    // Character rendering
    const portrait = leader.portrait;
    
    // Body
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(sx, sy, 8, 0, Math.PI * 2);
    ctx.fill();
    
    // Character jacket/shirt detail
    ctx.fillStyle = '#2a2520';
    ctx.beginPath();
    ctx.arc(sx, sy + 2, 7, 0, Math.PI);
    ctx.fill();
    
    // Head
    ctx.fillStyle = portrait.skin;
    ctx.beginPath();
    ctx.arc(sx, sy - 8, 5, 0, Math.PI * 2);
    ctx.fill();
    
    // Hair
    ctx.fillStyle = portrait.hair;
    ctx.beginPath();
    ctx.arc(sx, sy - 10, 5, Math.PI, 0);
    ctx.fill();
    
    // Scar
    if (portrait.scar) {
      ctx.strokeStyle = 'rgba(160, 100, 80, 0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(sx + 2, sy - 10);
      ctx.lineTo(sx + 4, sy - 6);
      ctx.stroke();
    }
    
    // Leader indicator
    ctx.strokeStyle = `rgba(212, 168, 67, ${0.4 + Math.sin(Game.tick * 0.03) * 0.2})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(sx, sy, 13, 0, Math.PI * 2);
    ctx.stroke();
    
    // Direction indicator
    const dirX = sx + Math.cos(Player.facing) * 15;
    const dirY = sy + Math.sin(Player.facing) * 15;
    ctx.fillStyle = 'rgba(212, 168, 67, 0.3)';
    ctx.beginPath();
    ctx.arc(dirX, dirY, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderVignette() {
  const cx = Game.screenW / 2;
  const cy = Game.screenH / 2;
  const radius = Math.max(Game.screenW, Game.screenH) * 0.7;
  
  const grad = ctx.createRadialGradient(cx, cy, radius * 0.5, cx, cy, radius);
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.5)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, Game.screenW, Game.screenH);
}

function renderCombatOverlay() {
  // Red tinted edges during combat
  const grad = ctx.createRadialGradient(
    Game.screenW / 2, Game.screenH / 2, Game.screenW * 0.3,
    Game.screenW / 2, Game.screenH / 2, Game.screenW * 0.7
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
  grad.addColorStop(1, `rgba(80, 10, 10, ${0.2 + Math.sin(Game.tick * 0.05) * 0.1})`);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, Game.screenW, Game.screenH);
  
  // Combat event feed
  const recentEvents = Combat.events.slice(-5);
  ctx.font = '11px Courier New';
  ctx.textAlign = 'right';
  for (let i = 0; i < recentEvents.length; i++) {
    const evt = recentEvents[i];
    const alpha = 1 - (i * 0.15);
    let text = '';
    let color = '#c0baa8';
    
    switch (evt.type) {
      case 'HIT': text = `${evt.actor} → ${evt.target} (${evt.damage} dmg)`; color = '#6ab06a'; break;
      case 'MISS': text = `${evt.actor} → ${evt.target} (MISS)`; color = '#6a6560'; break;
      case 'KILL': text = `${evt.actor} KILLED ${evt.target}`; color = '#d4a843'; break;
      case 'MEMBER_HIT': text = `${evt.target} hit by ${evt.actor} (${evt.damage} dmg)`; color = '#c05040'; break;
      case 'MEMBER_KILLED': text = `★ ${evt.target} KILLED by ${evt.actor} ★`; color = '#ff3030'; break;
      case 'RETREAT': text = `${evt.actor} retreating...`; color = '#8a8575'; break;
    }
    
    ctx.fillStyle = `rgba(0,0,0,0.5)`;
    ctx.fillRect(Game.screenW - 320, 80 + i * 22, 310, 20);
    ctx.fillStyle = color;
    ctx.globalAlpha = alpha;
    ctx.fillText(text, Game.screenW - 20, 95 + i * 22);
  }
  ctx.globalAlpha = 1;
  ctx.textAlign = 'left';
}

function renderMinimap() {
  minimapCtx.fillStyle = '#0a0a0f';
  minimapCtx.fillRect(0, 0, 150, 150);
  
  const scale = 150 / (WORLD_W * TILE);
  
  // Districts
  for (const dist of Districts) {
    let color = '#1a1a1a';
    if (dist.controlledBy === 'player') color = '#2a2515';
    else if (dist.controlledBy === 'voss') color = '#251515';
    else if (dist.controlledBy === 'corsini') color = '#151525';
    minimapCtx.fillStyle = color;
    minimapCtx.fillRect(
      dist.bounds.x * TILE * scale,
      dist.bounds.y * TILE * scale,
      dist.bounds.w * TILE * scale,
      dist.bounds.h * TILE * scale
    );
  }
  
  // Player dot
  minimapCtx.fillStyle = '#d4a843';
  minimapCtx.beginPath();
  minimapCtx.arc(Player.x * scale, Player.y * scale, 3, 0, Math.PI * 2);
  minimapCtx.fill();
  
  // Camera viewport
  minimapCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  minimapCtx.lineWidth = 1;
  minimapCtx.strokeRect(
    Game.camera.x * scale,
    Game.camera.y * scale,
    Game.screenW * scale,
    Game.screenH * scale
  );
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: GAME LOOP — Update, Input, Phase Management, World Simulation
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Player Update ───────────────────────────────────────────────────────────
function updatePlayer() {
  if (Game.phase !== PHASE.ROAMING) return;
  
  const speed = Player.inVehicle ? Player.vehicleSpeed : Player.speed;
  let dx = 0, dy = 0;
  
  if (Keys['KeyW'] || Keys['ArrowUp']) dy = -1;
  if (Keys['KeyS'] || Keys['ArrowDown']) dy = 1;
  if (Keys['KeyA'] || Keys['ArrowLeft']) dx = -1;
  if (Keys['KeyD'] || Keys['ArrowRight']) dx = 1;
  
  // Normalize diagonal
  if (dx !== 0 && dy !== 0) {
    dx *= 0.707;
    dy *= 0.707;
  }
  
  Player.moving = dx !== 0 || dy !== 0;
  
  if (Player.moving) {
    Player.facing = Math.atan2(dy, dx);
    
    // Vehicle has momentum
    if (Player.inVehicle) {
      Player.x += dx * speed;
      Player.y += dy * speed;
    } else {
      Player.x += dx * speed;
      Player.y += dy * speed;
    }
    
    // World bounds
    Player.x = Math.max(TILE, Math.min(WORLD_PX_W - TILE, Player.x));
    Player.y = Math.max(TILE, Math.min(WORLD_PX_H - TILE, Player.y));
  }
  
  // Toggle vehicle
  if (Keys['KeyF']) {
    Keys['KeyF'] = false;
    Player.inVehicle = !Player.inVehicle;
    sfxClick();
    notify(Player.inVehicle ? 'Entered vehicle' : 'On foot');
  }
  
  // Interaction check
  checkNearbyInteractions();
  
  // Interact
  if (Keys['KeyE']) {
    Keys['KeyE'] = false;
    if (Player.nearNPC && Player.nearNPC.interactable) {
      interactWithNPC(Player.nearNPC);
    }
  }
}

function checkNearbyInteractions() {
  Player.nearNPC = null;
  Player.nearBuilding = null;
  
  let closestDist = 80;
  for (const npc of NPCs) {
    if (!npc.alive || !npc.interactable) continue;
    const dist = Math.sqrt(Math.pow(Player.x - npc.x, 2) + Math.pow(Player.y - npc.y, 2));
    if (dist < closestDist) {
      closestDist = dist;
      Player.nearNPC = npc;
    }
  }
  
  // Show/hide prompt
  const prompt = document.getElementById('interact-prompt');
  if (Player.nearNPC) {
    prompt.textContent = `[E] Talk to ${Player.nearNPC.name}`;
    prompt.style.display = 'block';
  } else {
    prompt.style.display = 'none';
  }
}

function interactWithNPC(npc) {
  if (npc.dialogue) {
    const lines = npc.dialogue();
    startDialogue(lines);
  } else if (npc.isMissionGiver) {
    const lines = getMissionDialogue();
    startDialogue(lines);
  }
}

// ─── NPC AI ──────────────────────────────────────────────────────────────────
function updateNPCs() {
  for (const npc of NPCs) {
    if (!npc.alive) continue;
    if (npc.speed === 0) continue;
    
    npc.moveTimer--;
    if (npc.moveTimer <= 0) {
      // Pick new target within district bounds
      const dist = Districts.find(d => d.id === npc.districtId);
      if (dist) {
        npc.targetX = (dist.bounds.x + 2 + Math.random() * (dist.bounds.w - 4)) * TILE;
        npc.targetY = (dist.bounds.y + 2 + Math.random() * (dist.bounds.h - 4)) * TILE;
      }
      npc.moveTimer = 100 + Math.random() * 300;
    }
    
    // Move toward target
    const tdx = npc.targetX - npc.x;
    const tdy = npc.targetY - npc.y;
    const tdist = Math.sqrt(tdx * tdx + tdy * tdy);
    if (tdist > 5) {
      npc.x += (tdx / tdist) * npc.speed;
      npc.y += (tdy / tdist) * npc.speed;
    }
  }
}

// ─── Camera ──────────────────────────────────────────────────────────────────
function updateCamera() {
  // Smooth follow
  const targetX = Player.x - Game.screenW / 2;
  const targetY = Player.y - Game.screenH / 2;
  
  Game.camera.x += (targetX - Game.camera.x) * 0.08;
  Game.camera.y += (targetY - Game.camera.y) * 0.08;
  
  // Clamp to world
  Game.camera.x = Math.max(0, Math.min(WORLD_PX_W - Game.screenW, Game.camera.x));
  Game.camera.y = Math.max(0, Math.min(WORLD_PX_H - Game.screenH, Game.camera.y));
}

// ─── World Time ──────────────────────────────────────────────────────────────
function updateWorldTime() {
  Game.worldTime += Game.timeSpeed;
  if (Game.worldTime >= 24) {
    Game.worldTime -= 24;
    Game.day++;
  }
  
  // Update HUD
  const hours = Math.floor(Game.worldTime);
  const minutes = Math.floor((Game.worldTime % 1) * 60);
  const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  
  let period = 'MORNING';
  if (Game.worldTime >= 21 || Game.worldTime < 5) period = 'NIGHT';
  else if (Game.worldTime >= 5 && Game.worldTime < 7) period = 'DAWN';
  else if (Game.worldTime >= 12 && Game.worldTime < 17) period = 'AFTERNOON';
  else if (Game.worldTime >= 17 && Game.worldTime < 21) period = 'EVENING';
  
  document.getElementById('world-time').textContent = `Day ${Game.day} — ${timeStr} — ${period}`;
}

// ─── District Detection ──────────────────────────────────────────────────────
function updateCurrentDistrict() {
  const px = Player.x / TILE;
  const py = Player.y / TILE;
  
  for (const dist of Districts) {
    if (px >= dist.bounds.x && px < dist.bounds.x + dist.bounds.w &&
        py >= dist.bounds.y && py < dist.bounds.y + dist.bounds.h) {
      document.getElementById('district-name').textContent = dist.name;
      return;
    }
  }
}

// ─── HUD Updates ─────────────────────────────────────────────────────────────
function updateCrewPanel() {
  const panel = document.getElementById('crew-panel');
  panel.innerHTML = '';
  
  for (const member of Crew.members) {
    const card = document.createElement('div');
    card.className = `crew-member-card${member.id === Crew.leaderId ? ' active' : ''}${!member.alive ? ' dead' : ''}`;
    
    const hpPercent = member.alive ? (member.hp / member.maxHp * 100) : 0;
    const hpClass = hpPercent < 30 ? 'critical' : '';
    
    card.innerHTML = `
      <div class="name">${member.shortName}${member.id === Crew.leaderId ? ' ★' : ''}${member.id === Crew.heirId ? ' →' : ''}</div>
      <div class="role">${member.role}${!member.alive ? ' — DEAD' : ''}</div>
      <div class="health-bar"><div class="health-fill ${hpClass}" style="width:${hpPercent}%"></div></div>
    `;
    panel.appendChild(card);
  }
}

function updateRepPanel() {
  const panel = document.getElementById('rep-panel');
  const factions = ['voss', 'corsini', 'police', 'civilians'];
  const names = { voss: 'VOSS FAMILY', corsini: 'CORSINI', police: 'POLICE', civilians: 'CIVILIANS' };
  
  panel.innerHTML = '';
  for (const faction of factions) {
    const rep = Math.floor(getReputationWith(faction));
    const cls = rep > 10 ? 'positive' : rep < -10 ? 'negative' : 'neutral';
    const entry = document.createElement('div');
    entry.className = 'rep-entry';
    entry.innerHTML = `<span class="faction-name">${names[faction]}</span><span class="rep-value ${cls}">${rep > 0 ? '+' : ''}${rep}</span>`;
    panel.appendChild(entry);
  }
}

// ─── Notifications ───────────────────────────────────────────────────────────
function notify(text, type = '') {
  const area = document.getElementById('notification-area');
  const notif = document.createElement('div');
  notif.className = `notification ${type}`;
  notif.textContent = text;
  area.appendChild(notif);
  
  Game.notifications.push({ el: notif, created: Game.tick });
  
  // Auto-remove after 4 seconds
  setTimeout(() => {
    notif.style.opacity = '0';
    notif.style.transition = 'opacity 0.5s ease';
    setTimeout(() => notif.remove(), 500);
  }, 4000);
}

// ─── Planning UI ─────────────────────────────────────────────────────────────
function showPlanningUI() {
  const overlay = document.getElementById('planning-overlay');
  overlay.classList.add('active');
  document.getElementById('game-phase').textContent = 'PLANNING';
  
  const grid = document.getElementById('planning-grid');
  grid.innerHTML = '';
  
  for (const memberId of Combat.participants) {
    const member = getMember(memberId);
    if (!member || !member.alive) continue;
    
    const card = document.createElement('div');
    card.className = 'loadout-card';
    
    const weaponOptions = Object.keys(WEAPONS).map(w => 
      `<option value="${w}" ${Combat.orders[memberId].weapon === w ? 'selected' : ''}>${WEAPONS[w].name}</option>`
    ).join('');
    
    const stanceOptions = Object.keys(STANCES).map(s =>
      `<option value="${s}" ${Combat.orders[memberId].stance === s ? 'selected' : ''}>${STANCES[s].name} — ${STANCES[s].description}</option>`
    ).join('');
    
    card.innerHTML = `
      <div class="member-name">${member.shortName} (${member.role})</div>
      <div style="font-size:10px;color:#6a6560;margin-bottom:8px">Combat: ${member.skills.combat} | Stealth: ${member.skills.stealth}</div>
      <label style="font-size:9px;color:#8a7a55">WEAPON</label>
      <select data-member="${memberId}" data-field="weapon">${weaponOptions}</select>
      <label style="font-size:9px;color:#8a7a55">STANCE</label>
      <select data-member="${memberId}" data-field="stance">${stanceOptions}</select>
      <label style="font-size:9px;color:#8a7a55">PRIORITY</label>
      <select data-member="${memberId}" data-field="priority">
        <option value="SURVIVAL">Survival — stay alive</option>
        <option value="BIGGEST_THREAT">Biggest Threat — target strongest</option>
        <option value="CLOSEST">Closest — nearest target</option>
      </select>
      <label style="font-size:9px;color:#8a7a55">RETREAT AT HP %</label>
      <input type="range" min="0" max="80" value="${Combat.orders[memberId].retreatAt}" data-member="${memberId}" data-field="retreatAt">
    `;
    
    grid.appendChild(card);
  }
  
  // Event listeners for order changes
  grid.querySelectorAll('select, input').forEach(el => {
    el.addEventListener('change', (e) => {
      const memberId = e.target.dataset.member;
      const field = e.target.dataset.field;
      Combat.orders[memberId][field] = e.target.value;
      if (field === 'retreatAt') Combat.orders[memberId][field] = parseInt(e.target.value);
    });
  });
  
  // Lock button
  document.getElementById('lock-orders-btn').onclick = () => {
    lockOrders();
    overlay.classList.remove('active');
  };
}

function hidePlanningUI() {
  document.getElementById('planning-overlay').classList.remove('active');
  document.getElementById('game-phase').textContent = 'COMBAT';
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: MAIN GAME LOOP — Tie Everything Together
// ═══════════════════════════════════════════════════════════════════════════════

let lastTime = 0;
let ambientTimer = 0;

function gameLoop(timestamp) {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05); // cap at 50ms
  lastTime = timestamp;
  
  Game.tick++;
  
  if (Game.phase === PHASE.TITLE) {
    renderTitleScreen();
    requestAnimationFrame(gameLoop);
    return;
  }
  
  if (Game.phase === PHASE.GAME_OVER) {
    requestAnimationFrame(gameLoop);
    return;
  }
  
  // ─── Update ────────────────────────────────────────────
  if (Game.phase === PHASE.ROAMING) {
    updatePlayer();
    updateNPCs();
    updateWorldTime();
    updateCurrentDistrict();
    updateRain();
    updateParticles(dt);
    
    // Periodic HUD updates
    if (Game.tick % 30 === 0) {
      updateCrewPanel();
      updateRepPanel();
    }
    
    // Ambient sounds
    ambientTimer--;
    if (ambientTimer <= 0) {
      sfxAmbient();
      ambientTimer = 120 + Math.random() * 300;
    }
    
    // Phase indicator
    document.getElementById('game-phase').textContent = 'ROAMING';
  }
  
  if (Game.phase === PHASE.DIALOGUE) {
    handleDialogueInput();
    updateParticles(dt);
    updateRain();
  }
  
  if (Game.phase === PHASE.COMBAT) {
    tickCombat();
    updateParticles(dt);
    updateRain();
    
    // Spawn combat particles
    if (Game.tick % 5 === 0 && Combat.executing) {
      spawnParticle(
        Player.x + (Math.random() - 0.5) * 200,
        Player.y + (Math.random() - 0.5) * 200,
        Math.random() < 0.3 ? 'muzzle' : 'smoke'
      );
    }
  }
  
  if (Game.phase === PHASE.AFTERMATH) {
    Game.aftermathTimer++;
    updateParticles(dt);
    
    if (Game.aftermathTimer > 120 && !Game.fallenMember) {
      // Return to roaming if no succession needed
      Game.phase = PHASE.ROAMING;
      Game.missionActive = false;
      document.getElementById('game-phase').textContent = 'ROAMING';
      notify('Back on the streets. The city keeps moving.');
    }
  }
  
  // Camera always follows
  updateCamera();
  
  // ─── Render ────────────────────────────────────────────
  render();
  
  // Reset single-frame inputs
  Mouse.clicked = false;
  
  requestAnimationFrame(gameLoop);
}

function renderTitleScreen() {
  // Subtle background animation on title
  ctx.fillStyle = '#0a0a0f';
  ctx.fillRect(0, 0, Game.screenW, Game.screenH);
  
  // Animated grain
  ctx.fillStyle = 'rgba(255, 255, 255, 0.005)';
  for (let i = 0; i < 100; i++) {
    ctx.fillRect(
      Math.random() * Game.screenW,
      Math.random() * Game.screenH,
      1 + Math.random() * 2,
      1 + Math.random() * 2
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: INITIALIZATION — Start the Game
// ═══════════════════════════════════════════════════════════════════════════════

function initGame() {
  // Generate world
  generateRoads();
  generateBuildings();
  generateStreetLights();
  spawnNPCs();
  
  // Init crew
  initCrew();
  
  // Set player position
  Player.x = 32 * TILE;
  Player.y = 24 * TILE;
  
  // Update HUD
  updateCrewPanel();
  updateRepPanel();
  
  // Title screen handler
  document.querySelector('#title-screen .start-btn').addEventListener('click', () => {
    initAudio();
    document.getElementById('title-screen').style.display = 'none';
    Game.phase = PHASE.ROAMING;
    sfxClick();
    
    // Tutorial notification sequence
    setTimeout(() => notify('WASD to move. F to enter/exit vehicle.'), 500);
    setTimeout(() => notify('E to interact with highlighted NPCs.'), 2000);
    setTimeout(() => notify('Find OLD SANTO in The Narrows for your first job.'), 4000);
    setTimeout(() => notify('The city is watching. The city remembers.', 'critical'), 6500);
  });
  
  // Start loop
  requestAnimationFrame(gameLoop);
}

// ─── Boot ────────────────────────────────────────────────────────────────────
initGame();

