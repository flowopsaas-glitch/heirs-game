// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  HEIRS — 3D Open-World Crime Game (Three.js WebGL)                          ║
// ║  Cinematic third-person. Persistent world. Permadeath succession.           ║
// ╚══════════════════════════════════════════════════════════════════════════════╝

'use strict';

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: ENGINE — Three.js Setup, Renderer, Scene, Camera
// ═══════════════════════════════════════════════════════════════════════════════

let scene, camera, renderer, clock;
let playerMesh, playerGroup;
let sun, ambientLight, hemiLight;
let mixer; // animation mixer

const PHASE = { TITLE:'TITLE', ROAMING:'ROAMING', DIALOGUE:'DIALOGUE', PLANNING:'PLANNING', COMBAT:'COMBAT', AFTERMATH:'AFTERMATH', SUCCESSION:'SUCCESSION', GAME_OVER:'GAME_OVER' };

const Game = {
  phase: PHASE.TITLE, tick: 0,
  worldTime: 21.75, timeSpeed: 0.0004, day: 1,
  camera: { distance: 25, height: 18, angle: 0, targetAngle: 0 },
  notifications: [], dialogueQueue: [], currentDialogue: null,
  missionAvailable: null, missionActive: false,
  aftermathTimer: 0, fallenMember: null
};

const Keys = {};
const Mouse = { x: 0, y: 0, dx: 0, dy: 0 };

// Input
document.addEventListener('keydown', e => { Keys[e.code] = true; });
document.addEventListener('keyup', e => { Keys[e.code] = false; });
document.addEventListener('mousemove', e => {
  Mouse.dx += e.movementX || 0;
  Mouse.dy += e.movementY || 0;
});

function initEngine() {
  clock = new THREE.Clock();
  
  // Scene
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0c14);
  scene.fog = new THREE.FogExp2(0x0a0c14, 0.008);
  
  // Renderer
  renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.8;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById('game-container').prepend(renderer.domElement);
  
  // Camera — third person
  camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 500);
  camera.position.set(0, Game.camera.height, Game.camera.distance);
  camera.lookAt(0, 0, 0);
  
  // Lighting
  setupLighting();
  
  // Resize
  window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
}

function setupLighting() {
  // Hemisphere light (sky/ground)
  hemiLight = new THREE.HemisphereLight(0x4466aa, 0x222211, 0.4);
  scene.add(hemiLight);
  
  // Ambient
  ambientLight = new THREE.AmbientLight(0x111122, 0.3);
  scene.add(ambientLight);
  
  // Main directional (moon/sun)
  sun = new THREE.DirectionalLight(0xffeedd, 0.5);
  sun.position.set(50, 80, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 200;
  sun.shadow.camera.left = -80;
  sun.shadow.camera.right = 80;
  sun.shadow.camera.top = 80;
  sun.shadow.camera.bottom = -80;
  sun.shadow.bias = -0.0005;
  scene.add(sun);
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: WORLD GENERATION — 3D City with Buildings, Roads, Details
// ═══════════════════════════════════════════════════════════════════════════════

const CITY_SIZE = 200;
const Buildings = [];
const StreetLights = [];
const Vehicles = [];
const NPCMeshes = [];

// ─── Materials Library ───────────────────────────────────────────────────────
const Materials = {};

function createMaterials() {
  Materials.road = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.1 });
  Materials.sidewalk = new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 0.85 });
  Materials.concrete = new THREE.MeshStandardMaterial({ color: 0x3a3535, roughness: 0.7 });
  Materials.glass = new THREE.MeshPhysicalMaterial({ color: 0x112244, roughness: 0.1, metalness: 0.9, transmission: 0.3, thickness: 0.5 });
  Materials.metal = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.3, metalness: 0.8 });
  Materials.brick = new THREE.MeshStandardMaterial({ color: 0x4a2a1a, roughness: 0.85 });
  Materials.neon = new THREE.MeshBasicMaterial({ color: 0xff4400 });
  Materials.neonBlue = new THREE.MeshBasicMaterial({ color: 0x0066ff });
  Materials.neonGold = new THREE.MeshBasicMaterial({ color: 0xd4a843 });
  Materials.car = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.2, metalness: 0.7 });
  Materials.ground = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.95 });
  Materials.water = new THREE.MeshPhysicalMaterial({ color: 0x0a2030, roughness: 0.1, metalness: 0.5, transmission: 0.6 });
}

// ─── District Definitions ────────────────────────────────────────────────────
const Districts = [
  { id:'narrows', name:'THE NARROWS', cx:0, cz:0, radius:50, buildingColor:0x3a3025, style:'old', controlledBy:'player' },
  { id:'docks', name:'PORTO DOCKS', cx:80, cz:0, radius:50, buildingColor:0x252a30, style:'industrial', controlledBy:'voss' },
  { id:'midtown', name:'MIDTOWN', cx:0, cz:-80, radius:50, buildingColor:0x2a2a35, style:'modern', controlledBy:'corsini' },
  { id:'furnace', name:'THE FURNACE', cx:80, cz:-80, radius:50, buildingColor:0x2a1a1a, style:'ruined', controlledBy:null }
];

function generateCity() {
  // Ground plane
  const groundGeo = new THREE.PlaneGeometry(CITY_SIZE * 2.5, CITY_SIZE * 2.5);
  const ground = new THREE.Mesh(groundGeo, Materials.ground);
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);
  
  // Water (east side - docks)
  const waterGeo = new THREE.PlaneGeometry(60, CITY_SIZE * 2);
  const water = new THREE.Mesh(waterGeo, Materials.water);
  water.rotation.x = -Math.PI / 2;
  water.position.set(140, -0.3, -40);
  scene.add(water);
  
  // Generate roads
  generateRoads();
  
  // Generate buildings per district
  for (const dist of Districts) {
    generateDistrictBuildings(dist);
  }
  
  // Street lights
  generateStreetLights();
  
  // Parked vehicles
  generateParkedCars();
  
  // Environmental details
  generateDetails();
}

function generateRoads() {
  const roadWidth = 8;
  const roadMat = Materials.road;
  
  // Main grid roads
  for (let x = -80; x <= 120; x += 40) {
    const geo = new THREE.BoxGeometry(roadWidth, 0.05, CITY_SIZE * 2);
    const road = new THREE.Mesh(geo, roadMat);
    road.position.set(x, 0.01, -40);
    road.receiveShadow = true;
    scene.add(road);
    
    // Road markings
    addRoadMarkings(x, 'vertical');
  }
  
  for (let z = -120; z <= 40; z += 40) {
    const geo = new THREE.BoxGeometry(CITY_SIZE * 2, 0.05, roadWidth);
    const road = new THREE.Mesh(geo, roadMat);
    road.position.set(40, 0.01, z);
    road.receiveShadow = true;
    scene.add(road);
    
    addRoadMarkings(z, 'horizontal');
  }
}

function addRoadMarkings(pos, direction) {
  const markMat = new THREE.MeshBasicMaterial({ color: 0x3a3a20 });
  const count = 20;
  for (let i = 0; i < count; i++) {
    const geo = new THREE.BoxGeometry(
      direction === 'vertical' ? 0.3 : 3,
      0.02,
      direction === 'vertical' ? 3 : 0.3
    );
    const mark = new THREE.Mesh(geo, markMat);
    if (direction === 'vertical') {
      mark.position.set(pos, 0.03, -100 + i * 12);
    } else {
      mark.position.set(-60 + i * 12, 0.03, pos);
    }
    scene.add(mark);
  }
}

function generateDistrictBuildings(dist) {
  const count = 25 + Math.floor(Math.random() * 15);
  
  for (let i = 0; i < count; i++) {
    const x = dist.cx + (Math.random() - 0.5) * dist.radius * 1.6;
    const z = dist.cz + (Math.random() - 0.5) * dist.radius * 1.6;
    
    // Don't place on roads
    if (isOnRoad(x, z)) continue;
    
    let building;
    switch (dist.style) {
      case 'old': building = createOldBuilding(x, z, dist.buildingColor); break;
      case 'industrial': building = createIndustrialBuilding(x, z, dist.buildingColor); break;
      case 'modern': building = createModernBuilding(x, z, dist.buildingColor); break;
      case 'ruined': building = createRuinedBuilding(x, z, dist.buildingColor); break;
      default: building = createOldBuilding(x, z, dist.buildingColor);
    }
    
    if (building) {
      Buildings.push({ mesh: building, district: dist.id, x, z });
    }
  }
}

function isOnRoad(x, z) {
  for (let rx = -80; rx <= 120; rx += 40) {
    if (Math.abs(x - rx) < 6) return true;
  }
  for (let rz = -120; rz <= 40; rz += 40) {
    if (Math.abs(z - rz) < 6) return true;
  }
  return false;
}

function createOldBuilding(x, z, baseColor) {
  const w = 4 + Math.random() * 6;
  const d = 4 + Math.random() * 6;
  const h = 6 + Math.random() * 12;
  
  const group = new THREE.Group();
  
  // Main body
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.85 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  
  // Windows (emissive at night)
  const windowRows = Math.floor(h / 3);
  const windowCols = Math.floor(w / 2.5);
  for (let row = 0; row < windowRows; row++) {
    for (let col = 0; col < windowCols; col++) {
      if (Math.random() > 0.7) continue;
      const lit = Math.random() > 0.4;
      const wMat = new THREE.MeshBasicMaterial({ 
        color: lit ? (Math.random() > 0.5 ? 0xffdd88 : 0x88bbff) : 0x111122 
      });
      const wGeo = new THREE.BoxGeometry(1, 1.2, 0.1);
      const win = new THREE.Mesh(wGeo, wMat);
      win.position.set(
        -w/2 + 1.5 + col * 2.5,
        2 + row * 3,
        d/2 + 0.05
      );
      group.add(win);
      
      // Back windows too
      const winBack = win.clone();
      winBack.position.z = -d/2 - 0.05;
      group.add(winBack);
    }
  }
  
  // Rooftop detail
  if (Math.random() > 0.5) {
    const acGeo = new THREE.BoxGeometry(1.5, 1, 1.5);
    const ac = new THREE.Mesh(acGeo, Materials.metal);
    ac.position.set(Math.random() * 2 - 1, h + 0.5, Math.random() * 2 - 1);
    ac.castShadow = true;
    group.add(ac);
  }
  
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

function createModernBuilding(x, z, baseColor) {
  const w = 6 + Math.random() * 8;
  const d = 6 + Math.random() * 8;
  const h = 15 + Math.random() * 25;
  
  const group = new THREE.Group();
  
  // Glass tower
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const body = new THREE.Mesh(bodyGeo, Materials.glass);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  
  // Floor lines
  for (let y = 3; y < h; y += 3) {
    const lineGeo = new THREE.BoxGeometry(w + 0.1, 0.1, d + 0.1);
    const line = new THREE.Mesh(lineGeo, Materials.metal);
    line.position.y = y;
    group.add(line);
  }
  
  // Lit lobby at ground level
  const lobbyGeo = new THREE.BoxGeometry(w - 1, 3, d - 1);
  const lobbyMat = new THREE.MeshBasicMaterial({ color: 0xffeedd, transparent: true, opacity: 0.3 });
  const lobby = new THREE.Mesh(lobbyGeo, lobbyMat);
  lobby.position.y = 1.5;
  group.add(lobby);
  
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

function createIndustrialBuilding(x, z, baseColor) {
  const w = 8 + Math.random() * 12;
  const d = 6 + Math.random() * 10;
  const h = 4 + Math.random() * 6;
  
  const group = new THREE.Group();
  
  // Warehouse body
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.9, metalness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  
  // Corrugated roof
  const roofGeo = new THREE.BoxGeometry(w + 1, 0.3, d + 1);
  const roof = new THREE.Mesh(roofGeo, Materials.metal);
  roof.position.y = h;
  roof.castShadow = true;
  group.add(roof);
  
  // Loading door
  const doorGeo = new THREE.BoxGeometry(3, 3.5, 0.2);
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x4a4a3a, roughness: 0.6, metalness: 0.5 });
  const door = new THREE.Mesh(doorGeo, doorMat);
  door.position.set(0, 1.75, d/2 + 0.1);
  group.add(door);
  
  // Containers nearby
  if (Math.random() > 0.5) {
    const contColor = [0x2a4a2a, 0x4a2a2a, 0x2a2a4a, 0x4a4a2a][Math.floor(Math.random() * 4)];
    const contGeo = new THREE.BoxGeometry(6, 2.5, 2.5);
    const contMat = new THREE.MeshStandardMaterial({ color: contColor, roughness: 0.7, metalness: 0.4 });
    const cont = new THREE.Mesh(contGeo, contMat);
    cont.position.set(w/2 + 4, 1.25, Math.random() * 4 - 2);
    cont.castShadow = true;
    group.add(cont);
  }
  
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

function createRuinedBuilding(x, z, baseColor) {
  const w = 5 + Math.random() * 8;
  const d = 5 + Math.random() * 8;
  const h = 4 + Math.random() * 8;
  
  const group = new THREE.Group();
  
  // Damaged body (slightly rotated/leaning)
  const bodyGeo = new THREE.BoxGeometry(w, h, d);
  const bodyMat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.95 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = h / 2;
  body.rotation.z = (Math.random() - 0.5) * 0.03;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);
  
  // Fire barrel (orange point light)
  if (Math.random() > 0.7) {
    const barrelGeo = new THREE.CylinderGeometry(0.4, 0.5, 1, 8);
    const barrel = new THREE.Mesh(barrelGeo, Materials.metal);
    barrel.position.set(w/2 + 2, 0.5, 0);
    group.add(barrel);
    
    const fireLight = new THREE.PointLight(0xff6600, 0.8, 8);
    fireLight.position.set(w/2 + 2, 1.5, 0);
    group.add(fireLight);
  }
  
  group.position.set(x, 0, z);
  scene.add(group);
  return group;
}

function generateStreetLights() {
  // Place along roads
  for (let x = -80; x <= 120; x += 40) {
    for (let z = -120; z <= 40; z += 15) {
      const side = Math.random() > 0.5 ? 5 : -5;
      createStreetLight(x + side, z);
    }
  }
  for (let z = -120; z <= 40; z += 40) {
    for (let x = -60; x <= 120; x += 15) {
      const side = Math.random() > 0.5 ? 5 : -5;
      createStreetLight(x, z + side);
    }
  }
}

function createStreetLight(x, z) {
  const group = new THREE.Group();
  
  // Pole
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.1, 6, 6);
  const pole = new THREE.Mesh(poleGeo, Materials.metal);
  pole.position.y = 3;
  pole.castShadow = true;
  group.add(pole);
  
  // Arm
  const armGeo = new THREE.BoxGeometry(1.5, 0.08, 0.08);
  const arm = new THREE.Mesh(armGeo, Materials.metal);
  arm.position.set(0.75, 6, 0);
  group.add(arm);
  
  // Light fixture
  const fixGeo = new THREE.BoxGeometry(0.6, 0.15, 0.4);
  const fix = new THREE.Mesh(fixGeo, new THREE.MeshBasicMaterial({ color: 0xffeecc }));
  fix.position.set(1.5, 5.9, 0);
  group.add(fix);
  
  // Point light
  const light = new THREE.PointLight(0xffddaa, 0.6, 15, 2);
  light.position.set(1.5, 5.8, 0);
  light.castShadow = false; // Too many for shadow casting
  group.add(light);
  
  group.position.set(x, 0, z);
  scene.add(group);
  StreetLights.push({ mesh: group, light, x, z });
}

function generateParkedCars() {
  const carColors = [0x1a1a2a, 0x2a1a1a, 0x1a2a1a, 0x2a2a2a, 0x3a2010, 0x102030];
  
  for (let i = 0; i < 40; i++) {
    const x = -60 + Math.random() * 160;
    const z = -100 + Math.random() * 120;
    if (isOnRoad(x, z)) {
      // Cars park along roads
      const car = createCar(carColors[Math.floor(Math.random() * carColors.length)]);
      car.position.set(x, 0, z);
      car.rotation.y = Math.random() * Math.PI * 2;
      scene.add(car);
      Vehicles.push(car);
    }
  }
}

function createCar(color) {
  const group = new THREE.Group();
  
  // Body
  const bodyGeo = new THREE.BoxGeometry(2, 0.8, 4.5);
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.2, metalness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.6;
  body.castShadow = true;
  group.add(body);
  
  // Cabin
  const cabinGeo = new THREE.BoxGeometry(1.7, 0.7, 2.2);
  const cabinMat = new THREE.MeshPhysicalMaterial({ color: 0x112233, roughness: 0.1, metalness: 0.5, transmission: 0.4 });
  const cabin = new THREE.Mesh(cabinGeo, cabinMat);
  cabin.position.set(0, 1.2, -0.3);
  group.add(cabin);
  
  // Wheels
  const wheelGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.2, 12);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
  const positions = [[-0.9, 0.3, 1.3], [0.9, 0.3, 1.3], [-0.9, 0.3, -1.3], [0.9, 0.3, -1.3]];
  for (const [wx, wy, wz] of positions) {
    const wheel = new THREE.Mesh(wheelGeo, wheelMat);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(wx, wy, wz);
    group.add(wheel);
  }
  
  // Headlights
  const hlGeo = new THREE.BoxGeometry(0.3, 0.2, 0.05);
  const hlMat = new THREE.MeshBasicMaterial({ color: 0xffeedd });
  const hl1 = new THREE.Mesh(hlGeo, hlMat);
  hl1.position.set(-0.6, 0.6, 2.28);
  group.add(hl1);
  const hl2 = hl1.clone();
  hl2.position.x = 0.6;
  group.add(hl2);
  
  // Taillights
  const tlMat = new THREE.MeshBasicMaterial({ color: 0x880000 });
  const tl1 = new THREE.Mesh(hlGeo, tlMat);
  tl1.position.set(-0.6, 0.6, -2.28);
  group.add(tl1);
  const tl2 = tl1.clone();
  tl2.position.x = 0.6;
  group.add(tl2);
  
  return group;
}

function generateDetails() {
  // Dumpsters
  for (let i = 0; i < 20; i++) {
    const x = -50 + Math.random() * 150;
    const z = -100 + Math.random() * 120;
    const dumpGeo = new THREE.BoxGeometry(1.5, 1.2, 1);
    const dumpMat = new THREE.MeshStandardMaterial({ color: 0x2a3a2a, roughness: 0.8 });
    const dump = new THREE.Mesh(dumpGeo, dumpMat);
    dump.position.set(x, 0.6, z);
    dump.castShadow = true;
    scene.add(dump);
  }
  
  // Neon signs on some buildings
  for (let i = 0; i < 10; i++) {
    const bldg = Buildings[Math.floor(Math.random() * Buildings.length)];
    if (!bldg) continue;
    const neonGeo = new THREE.BoxGeometry(3, 0.8, 0.1);
    const neonColors = [0xff4400, 0x0066ff, 0xff00aa, 0x00ff66, 0xd4a843];
    const neonMat = new THREE.MeshBasicMaterial({ color: neonColors[Math.floor(Math.random() * neonColors.length)] });
    const neon = new THREE.Mesh(neonGeo, neonMat);
    neon.position.set(bldg.x, 4 + Math.random() * 3, bldg.z + 5);
    scene.add(neon);
    
    // Neon glow light
    const neonLight = new THREE.PointLight(neonMat.color.getHex(), 0.4, 8);
    neonLight.position.copy(neon.position);
    scene.add(neonLight);
  }
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: PLAYER — Third-Person Character with Movement
// ═══════════════════════════════════════════════════════════════════════════════

const Player = {
  x: 0, y: 0, z: 0,
  speed: 0.15, runSpeed: 0.28,
  inVehicle: false, vehicleSpeed: 0.5,
  facing: 0, moving: false,
  mesh: null, nearNPC: null
};

function createPlayer() {
  playerGroup = new THREE.Group();
  
  // Body
  const bodyGeo = new THREE.CapsuleGeometry(0.35, 1.0, 8, 12);
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a, roughness: 0.6, metalness: 0.2
  });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 1.0;
  body.castShadow = true;
  playerGroup.add(body);
  
  // Head
  const headGeo = new THREE.SphereGeometry(0.25, 12, 12);
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xc4a882, roughness: 0.7
  });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.85;
  head.castShadow = true;
  playerGroup.add(head);
  
  // Hair
  const hairGeo = new THREE.SphereGeometry(0.27, 12, 8, 0, Math.PI*2, 0, Math.PI/2);
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9 });
  const hair = new THREE.Mesh(hairGeo, hairMat);
  hair.position.y = 1.9;
  playerGroup.add(hair);
  
  // Leader ring
  const ringGeo = new THREE.TorusGeometry(0.6, 0.03, 8, 24);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0xd4a843 });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.05;
  playerGroup.add(ring);
  
  playerGroup.position.set(0, 0, 0);
  scene.add(playerGroup);
  Player.mesh = playerGroup;
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: CREW SYSTEM — Same as before but with 3D models
// ═══════════════════════════════════════════════════════════════════════════════

const Crew = {
  members: [], leaderId: null, heirId: null,
  familyName: 'MORTARA', standing: 30, wealth: 5000, territory: ['narrows']
};

function initCrew() {
  Crew.members = [
    { id:'elena', name:'ELENA MORTARA', shortName:'ELENA', role:'LEADER', hp:100, maxHp:100,
      skills:{combat:72,stealth:55,charisma:80,driving:60,tech:40},
      traits:{loyalty:95,ambition:85,courage:78,composure:70},
      alive:true, state:'ACTIVE', killCount:0, missionsCompleted:0,
      backstory:'Founded the family after her father was killed by the Voss.', epitaph:null },
    { id:'rico', name:'RICO MORTARA', shortName:'RICO', role:'HEIR', hp:100, maxHp:100,
      skills:{combat:85,stealth:40,charisma:55,driving:78,tech:30},
      traits:{loyalty:88,ambition:70,courage:90,composure:55},
      alive:true, state:'ACTIVE', killCount:0, missionsCompleted:0,
      backstory:'Elena\'s brother. Hot-headed but fiercely loyal.', epitaph:null },
    { id:'nadia', name:'NADIA SOREL', shortName:'NADIA', role:'LIEUTENANT', hp:100, maxHp:100,
      skills:{combat:50,stealth:82,charisma:68,driving:45,tech:88},
      traits:{loyalty:72,ambition:60,courage:65,composure:85},
      alive:true, state:'ACTIVE', killCount:0, missionsCompleted:0,
      backstory:'Not blood — chose the family. Former security consultant.', epitaph:null },
    { id:'tomás', name:'TOMÁS VEGA', shortName:'TOMÁS', role:'SOLDIER', hp:100, maxHp:100,
      skills:{combat:60,stealth:70,charisma:45,driving:90,tech:55},
      traits:{loyalty:65,ambition:80,courage:72,composure:60},
      alive:true, state:'ACTIVE', killCount:0, missionsCompleted:0,
      backstory:'Newest recruit. Best wheelman in Santo Porto.', epitaph:null }
  ];
  Crew.leaderId = 'elena'; Crew.heirId = 'rico';
}

function getLeader() { return Crew.members.find(m => m.id === Crew.leaderId); }
function getHeir() { return Crew.members.find(m => m.id === Crew.heirId); }
function getAliveMembers() { return Crew.members.filter(m => m.alive); }
function getMember(id) { return Crew.members.find(m => m.id === id); }
function getSuccessor() {
  if (Crew.heirId) { const h = getMember(Crew.heirId); if (h && h.alive) return h; }
  const alive = getAliveMembers().filter(m => m.id !== Crew.leaderId);
  if (!alive.length) return null;
  alive.sort((a,b) => (b.traits.loyalty+b.traits.ambition)-(a.traits.loyalty+a.traits.ambition));
  return alive[0];
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: NPCs — 3D Characters in the World
// ═══════════════════════════════════════════════════════════════════════════════

const NPCs = [];

function spawnNPCs() {
  for (const dist of Districts) {
    // Ambient civilians
    for (let i = 0; i < 15; i++) {
      const x = dist.cx + (Math.random()-0.5) * dist.radius;
      const z = dist.cz + (Math.random()-0.5) * dist.radius;
      createNPC3D(x, z, 'CIVILIAN', dist.id, null);
    }
    // Special NPCs
    if (dist.id === 'narrows') {
      createNPC3D(dist.cx+5, dist.cz+5, 'MISSION_GIVER', dist.id, {
        name:'OLD SANTO', dialogue: getMissionDialogue, isMissionGiver: true
      });
      createNPC3D(dist.cx-10, dist.cz+8, 'INFORMANT', dist.id, {
        name:'WHISPER', dialogue: getInformantDialogue
      });
    }
    if (dist.id === 'docks') {
      createNPC3D(dist.cx+10, dist.cz, 'GANG_MEMBER', dist.id, { name:'VOSS GUARD', faction:'voss' });
    }
    if (dist.id === 'midtown') {
      createNPC3D(dist.cx-5, dist.cz+10, 'MERCHANT', dist.id, { name:'ACQUISITIONS', dialogue: getMerchantDialogue });
    }
    if (dist.id === 'furnace') {
      createNPC3D(dist.cx+5, dist.cz-5, 'INFORMANT', dist.id, { name:'GHOST', dialogue: getGhostDialogue });
    }
  }
}

function createNPC3D(x, z, type, districtId, extra) {
  const group = new THREE.Group();
  
  // Color by type
  const colors = {
    CIVILIAN: 0x555555, GANG_MEMBER: 0x6a2222, INFORMANT: 0x556644,
    MERCHANT: 0x444466, MISSION_GIVER: 0x8a6a20
  };
  const color = colors[type] || 0x555555;
  
  // Body
  const bodyGeo = new THREE.CapsuleGeometry(0.3, 0.9, 6, 10);
  const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.7 });
  const body = new THREE.Mesh(bodyGeo, bodyMat);
  body.position.y = 0.9;
  body.castShadow = true;
  group.add(body);
  
  // Head
  const headGeo = new THREE.SphereGeometry(0.2, 10, 10);
  const headMat = new THREE.MeshStandardMaterial({ color: 0xb89870, roughness: 0.7 });
  const head = new THREE.Mesh(headGeo, headMat);
  head.position.y = 1.7;
  group.add(head);
  
  // Mission giver marker
  if (extra?.isMissionGiver) {
    const markerGeo = new THREE.OctahedronGeometry(0.2, 0);
    const markerMat = new THREE.MeshBasicMaterial({ color: 0xd4a843 });
    const marker = new THREE.Mesh(markerGeo, markerMat);
    marker.position.y = 2.3;
    group.add(marker);
    group.userData.marker = marker;
  }
  
  group.position.set(x, 0, z);
  scene.add(group);
  
  NPCs.push({
    mesh: group, x, z, type, districtId,
    name: extra?.name || 'CIVILIAN',
    dialogue: extra?.dialogue || null,
    isMissionGiver: extra?.isMissionGiver || false,
    interactable: !!(extra?.dialogue || extra?.isMissionGiver),
    faction: extra?.faction || null,
    alive: true, speed: type === 'MISSION_GIVER' ? 0 : 0.01 + Math.random()*0.02,
    targetX: x, targetZ: z, moveTimer: Math.random()*200,
    witnessed: [], opinionOfPlayer: 0, knowsPlayerBy: null
  });
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: COMBAT, CITY MEMORY, SUCCESSION — Core Mechanics (Same Logic)
// ═══════════════════════════════════════════════════════════════════════════════

const CityMemory = { events:[], reputation:{voss:{},corsini:{},police:{},civilians:{}}, grudges:[], rumors:[], witnessedKills:[], familyLegacy:[] };

function recordMemoryEvent(e) { CityMemory.events.push({...e, tick:Game.tick, day:Game.day}); if(e.severity>=7) CityMemory.familyLegacy.push({description:e.description,day:Game.day,actor:e.actor,type:e.type}); }

function recordWitnessedKill(killer,victim,witnesses,districtId) {
  const rec = { killer:killer.id||killer.name, killerName:killer.shortName||killer.name, victim:victim.name, victimFaction:victim.faction, districtId, witnesses:witnesses.map(w=>w.name), day:Game.day, tick:Game.tick };
  CityMemory.witnessedKills.push(rec);
  for(const w of witnesses){w.knowsPlayerBy=rec.killerName; w.opinionOfPlayer-=30;}
  if(victim.faction&&CityMemory.reputation[victim.faction]){CityMemory.reputation[victim.faction][rec.killer]=(CityMemory.reputation[victim.faction][rec.killer]||0)-40; CityMemory.grudges.push({holder:victim.faction,target:rec.killer,targetName:rec.killerName,reason:`killed ${victim.name}`,intensity:80,formed:Game.day,resolved:false});}
  notify(`The city remembers: ${rec.killerName} killed ${rec.victim}`,'critical');
}

function getReputationWith(f){const r=CityMemory.reputation[f];if(!r)return 0;let t=0,c=0;for(const v of Object.values(r)){t+=v;c++;}return c?t/c:0;}

const Combat = { mission:null,participants:[],enemies:[],orders:{},locked:false,executing:false,executionTick:0,events:[],outcome:null };
const WEAPONS = { PISTOL:{name:'Pistol',accuracy:70,damage:25,rateOfFire:1.5,noise:60}, SMG:{name:'SMG',accuracy:50,damage:18,rateOfFire:4,noise:80}, SHOTGUN:{name:'Shotgun',accuracy:85,damage:45,rateOfFire:0.8,noise:90}, RIFLE:{name:'Rifle',accuracy:75,damage:35,rateOfFire:2,noise:85}, KNIFE:{name:'Knife',accuracy:90,damage:40,rateOfFire:2,noise:5} };
const STANCES = { AGGRESSIVE:{name:'Aggressive',hitMod:1.2,dodgeMod:0.7,description:'Push forward.'}, DEFENSIVE:{name:'Defensive',hitMod:0.8,dodgeMod:1.4,description:'Hold position.'}, FLANKING:{name:'Flanking',hitMod:1.0,dodgeMod:1.0,description:'Flank them.'}, OVERWATCH:{name:'Overwatch',hitMod:1.1,dodgeMod:1.2,description:'Cover team.'}, STEALTH:{name:'Stealth',hitMod:1.5,dodgeMod:1.5,description:'Silent approach.'} };

const Missions = [
  { id:'docks_raid',name:'DOCK WAREHOUSE RAID',description:'Hit the Voss supply cache at Porto Docks.',district:'docks',risk:'HIGH',reward:{wealth:3000,standing:15},
    enemies:[{name:'VOSS ENFORCER',hp:80,accuracy:60,damage:20,faction:'voss'},{name:'VOSS GUARD',hp:60,accuracy:50,damage:15,faction:'voss'},{name:'VOSS GUARD',hp:60,accuracy:50,damage:15,faction:'voss'},{name:'VOSS LOOKOUT',hp:40,accuracy:45,damage:12,faction:'voss'},{name:'VOSS LIEUTENANT',hp:100,accuracy:70,damage:28,faction:'voss'}] },
  { id:'midtown_heist',name:'CORSINI MONEY HOUSE',description:'The Corsini launder through a midtown office.',district:'midtown',risk:'EXTREME',reward:{wealth:5000,standing:20,territory:'midtown'},
    enemies:[{name:'CORSINI SOLDIER',hp:70,accuracy:65,damage:22,faction:'corsini'},{name:'CORSINI SOLDIER',hp:70,accuracy:65,damage:22,faction:'corsini'},{name:'CORSINI BODYGUARD',hp:120,accuracy:55,damage:30,faction:'corsini'},{name:'CORSINI CAPTAIN',hp:90,accuracy:75,damage:35,faction:'corsini'}] }
];

function startPlanningPhase(mission) {
  Combat.mission=mission; Combat.participants=getAliveMembers().map(m=>m.id); Combat.enemies=mission.enemies.map(e=>({...e,alive:true,currentHp:e.hp})); Combat.orders={}; Combat.locked=false; Combat.executing=false; Combat.events=[]; Combat.outcome=null;
  for(const id of Combat.participants) Combat.orders[id]={stance:'DEFENSIVE',weapon:'PISTOL',priority:'SURVIVAL',retreatAt:30};
  Game.phase=PHASE.PLANNING; showPlanningUI();
}

function lockOrders(){Combat.locked=true;sfxLock();notify('ORDERS LOCKED. No turning back.','critical');setTimeout(()=>{beginExecution();},1500);}
function beginExecution(){Combat.executing=true;Combat.executionTick=0;Game.phase=PHASE.COMBAT;hidePlanningUI();notify('EXECUTING...','critical');}

function tickCombat(){
  if(!Combat.executing)return;Combat.executionTick++;
  if(Combat.executionTick%20===0)resolveCombatRound();
  const aliveE=Combat.enemies.filter(e=>e.alive);
  const aliveP=Combat.participants.filter(id=>{const m=getMember(id);return m&&m.alive&&m.hp>0;});
  if(!aliveE.length)endCombat('VICTORY');else if(!aliveP.length)endCombat('DEFEAT');else if(Combat.executionTick>300)endCombat('RETREAT');
}

function resolveCombatRound(){
  for(const mid of Combat.participants){
    const m=getMember(mid);if(!m||!m.alive||m.hp<=0)continue;
    const o=Combat.orders[mid],st=STANCES[o.stance],wp=WEAPONS[o.weapon];
    if(m.hp/m.maxHp*100<=o.retreatAt){Combat.events.push({type:'RETREAT',actor:m.shortName});continue;}
    const targets=Combat.enemies.filter(e=>e.alive);if(!targets.length)continue;
    const target=o.priority==='BIGGEST_THREAT'?targets.reduce((a,b)=>b.damage>a.damage?b:a):targets[Math.floor(Math.random()*targets.length)];
    const hitChance=Math.min(95,wp.accuracy*(m.skills.combat/100)*st.hitMod);
    sfxShoot();
    if(Math.random()*100<hitChance){const dmg=wp.damage*(0.8+Math.random()*0.4);target.currentHp-=dmg;sfxHit();Combat.events.push({type:'HIT',actor:m.shortName,target:target.name,damage:Math.floor(dmg)});if(target.currentHp<=0){target.alive=false;m.killCount++;Combat.events.push({type:'KILL',actor:m.shortName,target:target.name});const witnesses=NPCs.filter(n=>n.districtId===Combat.mission.district&&n.alive).slice(0,3);recordWitnessedKill(m,target,witnesses,Combat.mission.district);}}
    else{Combat.events.push({type:'MISS',actor:m.shortName,target:target.name});}
  }
  // Enemies fire back
  for(const e of Combat.enemies.filter(e=>e.alive)){
    const valids=Combat.participants.filter(id=>{const m=getMember(id);return m&&m.alive&&m.hp>0;});if(!valids.length)continue;
    const tid=valids[Math.floor(Math.random()*valids.length)];const t=getMember(tid);const st=STANCES[Combat.orders[tid].stance];
    if(Math.random()*100<Math.min(85,e.accuracy/st.dodgeMod)){const dmg=e.damage*(0.7+Math.random()*0.5);t.hp-=dmg;Combat.events.push({type:'MEMBER_HIT',actor:e.name,target:t.shortName,damage:Math.floor(dmg)});if(t.hp<=0){t.hp=0;t.alive=false;t.state='DEAD';t.epitaph=`Killed by ${e.name} during ${Combat.mission.name}. Day ${Game.day}.`;sfxDeath();Combat.events.push({type:'MEMBER_KILLED',actor:e.name,target:t.shortName});recordMemoryEvent({type:'CREW_DEATH',actor:e.name,target:t.shortName,description:`${t.name} was killed by ${e.name}`,district:Combat.mission.district,severity:9});}}
  }
}

function endCombat(outcome){
  Combat.executing=false;Combat.outcome=outcome;Game.phase=PHASE.AFTERMATH;Game.aftermathTimer=0;
  if(outcome==='VICTORY'){Crew.wealth+=Combat.mission.reward.wealth;Crew.standing=Math.min(100,Crew.standing+Combat.mission.reward.standing);if(Combat.mission.reward.territory){const d=Districts.find(d=>d.id===Combat.mission.reward.territory);if(d)d.controlledBy='player';Crew.territory.push(Combat.mission.reward.territory);}notify(`MISSION COMPLETE: ${Combat.mission.name}`,'success');for(const id of Combat.participants){const m=getMember(id);if(m&&m.alive)m.missionsCompleted++;}}
  else if(outcome==='DEFEAT'){notify('MISSION FAILED. Heavy losses.','critical');Crew.standing=Math.max(0,Crew.standing-10);}
  else{notify('Forced retreat.','critical');}
  const leader=getLeader();if(!leader||!leader.alive){Game.fallenMember=leader;setTimeout(()=>triggerSuccession(),2000);}
}

function triggerSuccession(){
  const fallen=Game.fallenMember,successor=getSuccessor();
  if(!successor){Game.phase=PHASE.GAME_OVER;showGameOver();return;}
  Game.phase=PHASE.SUCCESSION;
  const ov=document.getElementById('succession-overlay');
  ov.querySelector('.fallen-name').textContent=fallen.name;
  ov.querySelector('.fallen-epitaph').textContent=fallen.epitaph||`Lost on Day ${Game.day}.`;
  ov.querySelector('.successor-name').textContent=successor.name;
  ov.classList.add('active');sfxDeath();
  ov.querySelector('.continue-btn').onclick=()=>{completeSuccession(fallen,successor);ov.classList.remove('active');};
}

function completeSuccession(fallen,successor){
  Crew.leaderId=successor.id;successor.role='LEADER';
  const remaining=getAliveMembers().filter(m=>m.id!==successor.id);
  if(remaining.length){remaining.sort((a,b)=>b.traits.loyalty-a.traits.loyalty);Crew.heirId=remaining[0].id;remaining[0].role='HEIR';}else{Crew.heirId=null;}
  Crew.standing=Math.max(0,Crew.standing-15);
  // City reacts
  for(const g of CityMemory.grudges.filter(g=>g.target===fallen.id&&!g.resolved)){CityMemory.grudges.push({holder:g.holder,target:successor.id,targetName:successor.shortName,reason:`inherited from ${fallen.shortName}`,intensity:Math.floor(g.intensity*0.5),formed:Game.day,resolved:false});g.resolved=true;}
  for(const npc of NPCs){if(npc.knowsPlayerBy===fallen.shortName){npc.knowsPlayerBy=successor.shortName;npc.opinionOfPlayer=Math.floor(npc.opinionOfPlayer*0.6);}}
  notify(`${successor.shortName} now leads the ${Crew.familyName} family.`,'critical');
  Game.phase=PHASE.ROAMING;updateCrewPanel();
}

function showGameOver(){
  const s=document.getElementById('title-screen');
  s.querySelector('h1').textContent='LINEAGE ENDED';
  s.querySelector('.subtitle').innerHTML=`The ${Crew.familyName} family lasted ${Game.day} days.<br>${CityMemory.familyLegacy.length} deeds remembered.<br>${Crew.members.filter(m=>!m.alive).length} members lost.`;
  s.querySelector('.start-btn').textContent='START NEW LINEAGE';
  s.querySelector('.start-btn').onclick=()=>location.reload();
  s.style.display='flex';
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: DIALOGUE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

function getMissionDialogue() {
  if (Game.missionAvailable) return [{ speaker:'OLD SANTO', text:`The job's still on. ${Game.missionAvailable.name}. Ready?`, action:'OFFER_MISSION' }];
  const m = Missions[Math.floor(Math.random()*Missions.length)];
  Game.missionAvailable = m;
  return [{ speaker:'OLD SANTO', text:`I got something for the ${Crew.familyName} family.` },{ speaker:'OLD SANTO', text:`${m.name}. ${m.description}` },{ speaker:'OLD SANTO', text:`Risk: ${m.risk}. Interested?`, action:'OFFER_MISSION' }];
}
function getInformantDialogue() { return [{ speaker:'WHISPER', text:`The Voss are restless at the docks. Might be worth scouting.` }]; }
function getMerchantDialogue() { return [{ speaker:'ACQUISITIONS', text:`Clean money, dirty money — I don't discriminate. Come back with a deal.` }]; }
function getGhostDialogue() { const l=getLeader(); return [{ speaker:'GHOST', text:`${l?l.shortName:'You'}... this city eats families. Be careful what you build.` }]; }

function startDialogue(lines) { Game.dialogueQueue=[...lines]; advanceDialogue(); }
function advanceDialogue() {
  if (!Game.dialogueQueue.length) { endDialogue(); return; }
  const line = Game.dialogueQueue.shift();
  Game.currentDialogue = line; Game.phase = PHASE.DIALOGUE;
  const box = document.getElementById('dialogue-box');
  document.getElementById('dialogue-speaker').textContent = line.speaker;
  document.getElementById('dialogue-text').textContent = line.text;
  box.classList.add('active');
  document.getElementById('dialogue-continue').textContent = (line.action==='OFFER_MISSION'&&!Game.dialogueQueue.length) ? '[ SPACE: Accept ] [ ESC: Decline ]' : '[ SPACE to continue ]';
}
function endDialogue() { Game.currentDialogue=null; Game.phase=PHASE.ROAMING; document.getElementById('dialogue-box').classList.remove('active'); }



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: UI SYSTEMS — HUD, Planning, Notifications
// ═══════════════════════════════════════════════════════════════════════════════

function updateCrewPanel() {
  const panel = document.getElementById('crew-panel');
  panel.innerHTML = '';
  for (const m of Crew.members) {
    const card = document.createElement('div');
    card.className = `crew-card${m.id===Crew.leaderId?' active':''}${!m.alive?' dead':''}`;
    const hp = m.alive ? (m.hp/m.maxHp*100) : 0;
    card.innerHTML = `<div class="name">${m.shortName}${m.id===Crew.leaderId?' ★':''}${m.id===Crew.heirId?' →':''}</div><div class="role">${m.role}${!m.alive?' — DEAD':''}</div><div class="hp-bar"><div class="hp-fill" style="width:${hp}%"></div></div>`;
    panel.appendChild(card);
  }
}

function updateRepPanel() {
  const panel = document.getElementById('rep-panel');
  panel.innerHTML = '';
  const factions = [{id:'voss',name:'VOSS'},{id:'corsini',name:'CORSINI'},{id:'police',name:'POLICE'},{id:'civilians',name:'CIVILIANS'}];
  for (const f of factions) {
    const rep = Math.floor(getReputationWith(f.id));
    const cls = rep>10?'pos':rep<-10?'neg':'';
    const el = document.createElement('div');
    el.className = 'rep-entry';
    el.innerHTML = `<span>${f.name}</span><span class="rep-value ${cls}">${rep>0?'+':''}${rep}</span>`;
    panel.appendChild(el);
  }
}

function notify(text, type='') {
  const area = document.getElementById('notification-area');
  const n = document.createElement('div');
  n.className = `notification ${type}`;
  n.textContent = text;
  area.appendChild(n);
  setTimeout(() => { n.style.opacity='0'; n.style.transition='opacity 0.5s'; setTimeout(()=>n.remove(),500); }, 4000);
}

function showPlanningUI() {
  const ov = document.getElementById('planning-overlay');
  ov.classList.add('active');
  document.getElementById('game-phase').textContent = 'PLANNING';
  const grid = document.getElementById('planning-grid');
  grid.innerHTML = '';
  for (const mid of Combat.participants) {
    const m = getMember(mid); if (!m||!m.alive) continue;
    const card = document.createElement('div');
    card.className = 'loadout-card';
    card.innerHTML = `<div class="member-name">${m.shortName} (${m.role})</div><div style="font-size:10px;color:rgba(255,255,255,0.3);margin-bottom:12px">Combat: ${m.skills.combat} | Stealth: ${m.skills.stealth}</div>
      <label>WEAPON</label><select data-m="${mid}" data-f="weapon">${Object.keys(WEAPONS).map(w=>`<option value="${w}">${WEAPONS[w].name}</option>`).join('')}</select>
      <label>STANCE</label><select data-m="${mid}" data-f="stance">${Object.keys(STANCES).map(s=>`<option value="${s}">${STANCES[s].name} — ${STANCES[s].description}</option>`).join('')}</select>
      <label>PRIORITY</label><select data-m="${mid}" data-f="priority"><option value="SURVIVAL">Survival</option><option value="BIGGEST_THREAT">Biggest Threat</option><option value="CLOSEST">Closest</option></select>
      <label>RETREAT AT HP %</label><input type="range" min="0" max="80" value="30" data-m="${mid}" data-f="retreatAt">`;
    grid.appendChild(card);
  }
  grid.querySelectorAll('select,input').forEach(el => el.addEventListener('change', e => { Combat.orders[e.target.dataset.m][e.target.dataset.f] = e.target.type==='range'?parseInt(e.target.value):e.target.value; }));
  document.getElementById('lock-orders-btn').onclick = () => { lockOrders(); ov.classList.remove('active'); };
}

function hidePlanningUI() { document.getElementById('planning-overlay').classList.remove('active'); document.getElementById('game-phase').textContent='COMBAT'; }



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: AUDIO (Procedural Web Audio)
// ═══════════════════════════════════════════════════════════════════════════════

let audioCtx = null;
function initAudio() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function playTone(f,d,t='sine',v=0.1) { if(!audioCtx)return; const o=audioCtx.createOscillator(),g=audioCtx.createGain(); o.type=t; o.frequency.value=f; g.gain.setValueAtTime(v,audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001,audioCtx.currentTime+d); o.connect(g); g.connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime+d); }
function sfxShoot(){playTone(80+Math.random()*40,0.15,'sawtooth',0.12);}
function sfxHit(){playTone(200,0.08,'square',0.1);}
function sfxDeath(){playTone(150,0.5,'sawtooth',0.15);setTimeout(()=>playTone(100,0.8,'sine',0.1),200);}
function sfxClick(){playTone(800,0.05,'sine',0.06);}
function sfxLock(){playTone(400,0.1,'square',0.08);setTimeout(()=>playTone(600,0.1,'square',0.08),100);}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: GAME LOOP — Update + Render
// ═══════════════════════════════════════════════════════════════════════════════

function updatePlayer() {
  if (Game.phase !== PHASE.ROAMING) return;
  const speed = Keys['ShiftLeft'] ? Player.runSpeed : Player.speed;
  let dx=0, dz=0;
  if (Keys['KeyW']||Keys['ArrowUp']) dz = -1;
  if (Keys['KeyS']||Keys['ArrowDown']) dz = 1;
  if (Keys['KeyA']||Keys['ArrowLeft']) dx = -1;
  if (Keys['KeyD']||Keys['ArrowRight']) dx = 1;
  if (dx!==0&&dz!==0){dx*=0.707;dz*=0.707;}
  Player.moving = dx!==0||dz!==0;
  if (Player.moving) {
    Player.facing = Math.atan2(dx, dz);
    Player.x += dx * speed;
    Player.z += dz * speed;
    Player.x = Math.max(-100, Math.min(160, Player.x));
    Player.z = Math.max(-140, Math.min(60, Player.z));
    if (playerGroup) {
      playerGroup.position.set(Player.x, 0, Player.z);
      playerGroup.rotation.y = Player.facing;
    }
  }
  // Interaction
  checkInteractions();
  if (Keys['KeyE']) { Keys['KeyE']=false; if(Player.nearNPC&&Player.nearNPC.interactable) interactNPC(Player.nearNPC); }
}

function checkInteractions() {
  Player.nearNPC = null;
  let closest = 5;
  for (const npc of NPCs) {
    if (!npc.alive||!npc.interactable) continue;
    const d = Math.sqrt((Player.x-npc.x)**2 + (Player.z-npc.z)**2);
    if (d < closest) { closest=d; Player.nearNPC=npc; }
  }
  const prompt = document.getElementById('interact-prompt');
  if (Player.nearNPC) { prompt.textContent=`[E] Talk to ${Player.nearNPC.name}`; prompt.style.display='block'; }
  else { prompt.style.display='none'; }
}

function interactNPC(npc) {
  if (npc.dialogue) startDialogue(npc.dialogue());
  else if (npc.isMissionGiver) startDialogue(getMissionDialogue());
}

function updateNPCs() {
  for (const npc of NPCs) {
    if (!npc.alive||npc.speed===0) continue;
    npc.moveTimer--;
    if (npc.moveTimer<=0) {
      const d=Districts.find(d=>d.id===npc.districtId);
      if(d){npc.targetX=d.cx+(Math.random()-0.5)*d.radius*0.8; npc.targetZ=d.cz+(Math.random()-0.5)*d.radius*0.8;}
      npc.moveTimer=200+Math.random()*400;
    }
    const tdx=npc.targetX-npc.x,tdz=npc.targetZ-npc.z;
    const dist=Math.sqrt(tdx*tdx+tdz*tdz);
    if(dist>1){npc.x+=tdx/dist*npc.speed;npc.z+=tdz/dist*npc.speed;npc.mesh.position.set(npc.x,0,npc.z);}
  }
  // Animate markers
  for (const npc of NPCs) {
    if (npc.mesh.userData.marker) {
      npc.mesh.userData.marker.rotation.y += 0.03;
      npc.mesh.userData.marker.position.y = 2.3 + Math.sin(Game.tick*0.05)*0.15;
    }
  }
}

function updateCamera3D() {
  const target = new THREE.Vector3(Player.x, 2, Player.z);
  const offset = new THREE.Vector3(
    Math.sin(Game.camera.angle) * Game.camera.distance,
    Game.camera.height,
    Math.cos(Game.camera.angle) * Game.camera.distance
  );
  camera.position.lerp(target.clone().add(offset), 0.05);
  camera.lookAt(target);
  
  // Rotate camera with Q/E
  if (Keys['KeyQ']) Game.camera.angle -= 0.02;
  if (Keys['KeyE'] && !Player.nearNPC) Game.camera.angle += 0.02;
}

function updateWorldTime() {
  Game.worldTime += Game.timeSpeed;
  if (Game.worldTime >= 24) { Game.worldTime -= 24; Game.day++; }
  const h=Math.floor(Game.worldTime),m=Math.floor((Game.worldTime%1)*60);
  let period='MORNING';
  if(Game.worldTime>=21||Game.worldTime<5)period='NIGHT';
  else if(Game.worldTime>=5&&Game.worldTime<7)period='DAWN';
  else if(Game.worldTime>=12&&Game.worldTime<17)period='AFTERNOON';
  else if(Game.worldTime>=17&&Game.worldTime<21)period='EVENING';
  document.getElementById('world-time').textContent=`Day ${Game.day} — ${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')} — ${period}`;
  
  // Lighting based on time
  updateLighting();
}

function updateLighting() {
  const t = Game.worldTime;
  if (t>=7&&t<17) { // Day
    sun.intensity=0.8; sun.color.setHex(0xffeedd);
    ambientLight.intensity=0.4; hemiLight.intensity=0.5;
    scene.fog.density=0.004; scene.background.setHex(0x8899aa);
    renderer.toneMappingExposure=1.0;
  } else if (t>=17&&t<21) { // Evening golden hour
    const prog=(t-17)/4;
    sun.intensity=0.6-prog*0.4; sun.color.setHex(0xff8844);
    ambientLight.intensity=0.3-prog*0.15; hemiLight.intensity=0.4-prog*0.2;
    scene.fog.density=0.006; scene.background.setHex(0x1a1520);
    renderer.toneMappingExposure=0.8-prog*0.3;
  } else { // Night
    sun.intensity=0.1; sun.color.setHex(0x4466aa);
    ambientLight.intensity=0.12; hemiLight.intensity=0.15;
    scene.fog.density=0.01; scene.background.setHex(0x060810);
    renderer.toneMappingExposure=0.5;
  }
}

function updateDistrict() {
  for (const d of Districts) {
    const dx=Player.x-d.cx, dz=Player.z-d.cz;
    if (Math.sqrt(dx*dx+dz*dz) < d.radius) {
      document.getElementById('district-name').textContent=d.name;
      return;
    }
  }
}

function handleDialogueInput() {
  if (Keys['Space']) { Keys['Space']=false;
    if(Game.currentDialogue?.action==='OFFER_MISSION'&&!Game.dialogueQueue.length){endDialogue();if(Game.missionAvailable){startPlanningPhase(Game.missionAvailable);Game.missionAvailable=null;}}
    else advanceDialogue();
  }
  if (Keys['Escape']) { Keys['Escape']=false; endDialogue(); }
}



// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: MAIN LOOP + INIT
// ═══════════════════════════════════════════════════════════════════════════════

function gameLoop() {
  requestAnimationFrame(gameLoop);
  Game.tick++;
  
  if (Game.phase === PHASE.TITLE) return;
  
  if (Game.phase === PHASE.ROAMING) {
    updatePlayer(); updateNPCs(); updateWorldTime(); updateDistrict();
    if (Game.tick%60===0) { updateCrewPanel(); updateRepPanel(); }
    document.getElementById('game-phase').textContent='ROAMING';
  }
  if (Game.phase === PHASE.DIALOGUE) handleDialogueInput();
  if (Game.phase === PHASE.COMBAT) { tickCombat(); document.getElementById('game-phase').textContent='COMBAT'; }
  if (Game.phase === PHASE.AFTERMATH) {
    Game.aftermathTimer++;
    if (Game.aftermathTimer>120 && !Game.fallenMember) { Game.phase=PHASE.ROAMING; Game.missionActive=false; notify('Back on the streets.'); }
  }
  
  updateCamera3D();
  renderer.render(scene, camera);
}

function init() {
  initEngine();
  createMaterials();
  generateCity();
  createPlayer();
  initCrew();
  spawnNPCs();
  updateCrewPanel();
  updateRepPanel();
  
  // Remove loading
  document.getElementById('loading').style.display = 'none';
  
  // Title screen
  document.querySelector('.start-btn').addEventListener('click', () => {
    initAudio();
    document.getElementById('title-screen').style.display = 'none';
    Game.phase = PHASE.ROAMING;
    sfxClick();
    setTimeout(()=>notify('WASD to move. SHIFT to run.'),500);
    setTimeout(()=>notify('E to interact with NPCs.'),2000);
    setTimeout(()=>notify('Find OLD SANTO in The Narrows for your first job.'),4000);
    setTimeout(()=>notify('The city is watching. The city remembers.','critical'),6500);
  });
  
  // Start render loop
  gameLoop();
}

// Boot
init();

