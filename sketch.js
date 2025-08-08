// === Space Defenders Game ===
// A multiplayer space combat game with gravitational physics

// === GAME CONSTANTS ===
const GAME_CONFIG = {
  // Canvas settings
  CANVAS_WIDTH: 800,
  CANVAS_HEIGHT: 600,
  BACKGROUND_COLOR: 10,
  
  // Physics constants
  GRAVITY_STRENGTH: 200,
  MIN_GRAVITY_DISTANCE: 50,
  PLANET_SURFACE_BUFFER: 5,
  MAX_VELOCITY: 3,
  GRAVITY_FALLOFF_FACTOR: 0.01, // New: Controls gravity strength at distance
  
  // Player settings
  PLAYER_ROTATION_SPEED: 0.05,
  PLAYER_THRUST_FORCE: 0.05,
  PLAYER_SHOT_COOLDOWN: 600, // milliseconds
  PLAYER_MAX_HEALTH: 100,
  PLAYER_SIZE: 10,
  COLLISION_DAMAGE_TO_PLAYER: 10,
  
  // Projectile settings
  PROJECTILE_SPEED: 6,
  PROJECTILE_SIZE: 6,
  PROJECTILE_HIT_RADIUS: 15,
  PROJECTILE_LIFETIME: 300, // New: Frames before projectile expires
  
  // Planet settings
  PLANET_COUNT: 3,
  PLANET_SIZE: 40,
  PLANET_MAX_HEALTH: 10,
  PLANET_HIT_RADIUS: 30,
  PLANET_MARGIN: 200, // Margin from screen edges where planets can be placed
  
  // Alien settings
  ALIEN_SPAWN_INTERVAL: 100, // frames
  ALIEN_BASE_SPEED: 0.5,
  ALIEN_TARGET_SPEED: 0.3,
  ALIEN_SIZE: 15,
  ALIEN_PLAYER_HIT_RADIUS: 20,
  ALIEN_SPEED_VARIANCE: 0.3, // New: Random speed variation factor
  LARGE_ALIEN_CHANCE: 0.06, // chance per spawn attempt (applied after cap)
  LARGE_ALIEN_SIZE: 32,
  LARGE_ALIEN_BASE_SPEED: 0.35,
  LARGE_ALIEN_HEALTH: 5,
  LARGE_ALIEN_CONTACT_DAMAGE: 25,
  
  // Level progression settings
  ALIENS_PER_LEVEL: 10, // New: Aliens to kill to advance level
  LEVEL_SPEED_MULTIPLIER: 0.2, // New: Speed increase per level
  LEVEL_SPAWN_REDUCTION: 10, // New: Frames reduced from spawn interval per level
  
  // Particle settings
  THRUST_PARTICLE_LIFESPAN: 255,
  THRUST_PARTICLE_DECAY: 5,
  EXPLOSION_PARTICLE_COUNT: 20,
  
  // Performance settings
  MAX_PARTICLES: 500, // New: Limit total particles for performance
  MAX_PROJECTILES: 50, // New: Limit total projectiles
  MAX_ALIENS: 20, // New: Base limit for aliens
  MAX_ALIENS_PER_LEVEL: 3, // New: Additional aliens allowed per level
  
  // Powerup settings
  POWERUP_SPAWN_CHANCE: 0.2, // Chance for alien to drop powerup when killed
  POWERUP_SIZE: 20,
  POWERUP_LIFETIME: 1800, // Frames before powerup disappears (30 seconds at 60fps)
  POWERUP_COLLECTION_RADIUS: 25,
  POWERUP_PULSE_SPEED: 0.1 // Speed of size pulsing animation
};
// Per-type soft caps to avoid runaway counts
const ALIEN_TYPE_MAX = { vortex:2, splitter:4, blink:5, large:2, mini:8, boss:1 };
// Boss spawn tuning
const BOSS_CONFIG = {
  CHANCE_PER_SPAWN: 0.005, // 0.5% per spawn attempt (after caps) when level high enough
  MIN_LEVEL: 5,
  HEALTH: 50,
  SIZE: 60,
  CONTACT_DAMAGE: 60,
  SPLIT_SPAWN_INTERVAL: 240, // frames between automatic splitter spawns (~4s at 60fps)
  SPLITTER_BURST_ON_HIT: 0.15, // chance to emit a splitter on each damaging hit
  DEATH_SPLITTERS: 6 // burst of splitters on death (capped by room)
};

// Ensure consistent base rendering state each frame (avoid stroke leakage)
function resetDrawState(){
  stroke(255);
  strokeWeight(1);
}

// === ALIEN TYPE REGISTRY (modular behaviors) ===
const AlienTypeRegistry = {
  types: {},
  register(name, cfg) { this.types[name] = cfg; },
  get(name) { return this.types[name]; },
  list() { return Object.keys(this.types); },
  pick(level) {
    // Cycle emphasis every 3 levels: 0 random heavy, 1 planet heavy, 2 player heavy
    const cycle = (level - 1) % 3;
    const weights = [];
    let total = 0;
    for (const [name, cfg] of Object.entries(this.types)) {
      if (name === 'large') continue; // large handled separately
      const w = (cfg.spawnWeight ? cfg.spawnWeight(level, cycle) : 1);
      if (w > 0) { weights.push({ name, w }); total += w; }
    }
    if (weights.length === 0) return 'dumb';
    let r = random(total);
    for (const entry of weights) { r -= entry.w; if (r <= 0) return entry.name; }
    return weights[weights.length-1].name;
  }
};

// Base behaviors
function behaviorDumb(/*alien, gameState*/) { /* no-op random drift */ }
function behaviorSeekPlanets(alien, gameState) {
  if (gameState.planets.length === 0) return;
  const target = findClosestTarget(alien.pos, gameState.planets);
  if (target) {
    const direction = p5.Vector.sub(target.pos, alien.pos).setMag(alien.targetSpeed);
    alien.vel = direction;
  }
}
function behaviorSeekPlayers(alien, gameState) {
  if (gameState.players.length === 0) return;
  const target = findClosestTarget(alien.pos, gameState.players);
  if (target) {
    const direction = p5.Vector.sub(target.pos, alien.pos).setMag(alien.targetSpeed);
    alien.vel = direction;
  }
}
function behaviorLarge(alien, gameState) { // hybrid: prefers players else planets
  if (gameState.players.length > 0) behaviorSeekPlayers(alien, gameState);
  else if (gameState.planets.length > 0) behaviorSeekPlanets(alien, gameState);
  // slight inertia drift retained
}

// Register default types
AlienTypeRegistry.register('dumb', {
  sides: 6,
  color: [150,0,255],
  baseSpeed: GAME_CONFIG.ALIEN_BASE_SPEED,
  targetSpeed: GAME_CONFIG.ALIEN_TARGET_SPEED,
  health: 1,
  size: GAME_CONFIG.ALIEN_SIZE,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER,
  behavior: behaviorDumb,
  spawnWeight: (level, cycle) => cycle === 0 ? 0.55 : 0.30,
  spawnSound: 'alien'
});
AlienTypeRegistry.register('planet', {
  sides: 5,
  color: [0,255,100],
  baseSpeed: GAME_CONFIG.ALIEN_BASE_SPEED,
  targetSpeed: GAME_CONFIG.ALIEN_TARGET_SPEED,
  health: 1,
  size: GAME_CONFIG.ALIEN_SIZE,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER,
  behavior: behaviorSeekPlanets,
  spawnWeight: (level, cycle) => cycle === 1 ? 0.50 : 0.25,
  spawnSound: 'alien'
});
AlienTypeRegistry.register('player', {
  sides: 4,
  color: [255,50,50],
  baseSpeed: GAME_CONFIG.ALIEN_BASE_SPEED,
  targetSpeed: GAME_CONFIG.ALIEN_TARGET_SPEED,
  health: 1,
  size: GAME_CONFIG.ALIEN_SIZE,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER,
  behavior: behaviorSeekPlayers,
  spawnWeight: (level, cycle) => cycle === 2 ? 0.50 : 0.20,
  spawnSound: 'alien'
});
AlienTypeRegistry.register('large', {
  sides: 8,
  color: [255,180,0],
  baseSpeed: GAME_CONFIG.LARGE_ALIEN_BASE_SPEED,
  targetSpeed: GAME_CONFIG.LARGE_ALIEN_BASE_SPEED * 0.9,
  health: GAME_CONFIG.LARGE_ALIEN_HEALTH,
  size: GAME_CONFIG.LARGE_ALIEN_SIZE,
  contactDamage: GAME_CONFIG.LARGE_ALIEN_CONTACT_DAMAGE,
  behavior: behaviorLarge,
  spawnWeight: () => 0, // selected via special chance
  spawnSound: 'large'
});

// === Additional Creative Alien Types ===
function behaviorZigZag(alien) {
  alien.zzTimer = (alien.zzTimer || 0) + 1;
  if (alien.zzTimer % 30 === 0) {
    const dir = random([1,-1]);
    alien.vel.rotate(radians(60 * dir));
    alien.vel.setMag(alien.targetSpeed);
  }
}
function behaviorSplitter(alien, gameState) {
  behaviorSeekPlayers(alien, gameState);
}
function behaviorMini(alien, gameState) { behaviorSeekPlayers(alien, gameState); }
function behaviorBomber(alien, gameState) {
  behaviorSeekPlayers(alien, gameState);
  // Slight gradual speed up
  alien.vel.setMag(min(alien.vel.mag()*1.005, alien.targetSpeed*1.4));
}
function behaviorOrbiter(alien, gameState) {
  if (!alien.orbitTarget || !gameState.planets.includes(alien.orbitTarget)) {
    alien.orbitTarget = random(gameState.planets);
  }
  if (!alien.orbitTarget) return;
  const toCenter = p5.Vector.sub(alien.orbitTarget.pos, alien.pos);
  const distC = toCenter.mag() + 0.001;
  // Desired tangential direction
  const tangent = createVector(-toCenter.y, toCenter.x).setMag(alien.targetSpeed);
  // Add mild centering force
  const centerPull = toCenter.copy().setMag(alien.targetSpeed * 0.2);
  alien.vel = p5.Vector.add(tangent, centerPull).limit(alien.targetSpeed*1.2);
}
function behaviorLeech(alien, gameState) {
  behaviorSeekPlanets(alien, gameState);
  if (gameState.planets.length===0) return;
  // Drain only every 5 frames for balance; small amount per tick (~0.0033/sec * 12 = 0.04/sec at 60fps)
  if (frameCount % 5 !== 0) return;
  for (const p of gameState.planets) {
  const dx = alien.pos.x - p.pos.x;
  const dy = alien.pos.y - p.pos.y;
  const r = GAME_CONFIG.PLANET_SIZE * 1.15;
  if (dx*dx + dy*dy < r*r) {
      p.health -= 0.04; // tuned leech rate (was continuous 0.6/sec); now 0.48/sec when in contact
    }
  }
}
function behaviorEvasive(alien, gameState) {
  behaviorSeekPlayers(alien, gameState);
  // Jink
  const perp = createVector(-alien.vel.y, alien.vel.x).setMag(alien.targetSpeed*0.2);
  alien.vel.add(perp.mult(random([-1,1]))).limit(alien.targetSpeed*1.3);
}
function behaviorBlink(alien, gameState) {
  behaviorSeekPlayers(alien, gameState);
  alien.blinkTimer = (alien.blinkTimer || 0) + 1;
  if (alien.blinkTimer > 90 && gameState.players.length>0) {
    const target = findClosestTarget(alien.pos, gameState.players);
    if (target) {
      const offset = p5.Vector.random2D().mult(80);
      alien.pos = p5.Vector.add(target.pos, offset);
    }
    alien.blinkTimer = 0;
  }
}
function behaviorShielded(alien, gameState) {
  behaviorSeekPlayers(alien, gameState);
  if (alien.invulnFrames && alien.invulnFrames>0) alien.invulnFrames--;
}
function behaviorVortex(alien, gameState) {
  if (frameCount % 3 !== 0) return; // throttle
  const r = alien.size*4, r2=r*r;
  for (const proj of gameState.projectiles) {
    const dx = proj.pos.x - alien.pos.x;
    const dy = proj.pos.y - alien.pos.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < r2) {
      const inv = 1/(Math.sqrt(d2)||1);
      proj.vel.x += -dx*inv*0.05;
      proj.vel.y += -dy*inv*0.05;
      proj.vel.limit(GAME_CONFIG.PROJECTILE_SPEED*1.2);
    }
  }
}
function behaviorBoss(alien, gameState) {
  // Aggressively seek players else planets
  if (gameState.players.length > 0) behaviorSeekPlayers(alien, gameState); else behaviorSeekPlanets(alien, gameState);
  // Periodic splitter spawn
  alien._splitTimer = (alien._splitTimer||0)+1;
  if (alien._splitTimer >= BOSS_CONFIG.SPLIT_SPAWN_INTERVAL) {
    alien._splitTimer = 0;
    spawnBossSplitters(alien, 3); // periodic small wave
  }
}

function spawnBossSplitters(bossAlien, count) {
  const room = getCurrentMaxAliens() - gameState.aliens.length;
  if (room <= 0) return;
  const currentSplitters = gameState.aliens.reduce((c,a)=> c + (a.type==='splitter'),0);
  const splitterCapRoom = (ALIEN_TYPE_MAX.splitter||Infinity) - currentSplitters;
  if (splitterCapRoom <= 0) return;
  const spawnCount = min(count, room, splitterCapRoom);
  for (let i=0;i<spawnCount;i++) {
    const offset = p5.Vector.random2D().mult(random(20, bossAlien.size*0.9));
    const a = new Alien(bossAlien.pos.x + offset.x, bossAlien.pos.y + offset.y, 'splitter');
    gameState.aliens.push(a);
    soundManager && soundManager.spawnAlien('splitter');
  }
}

// Register new types (10)
AlienTypeRegistry.register('zigzag', {
  sides: 7, color:[200,60,255], baseSpeed:0.55, targetSpeed:0.35, health:1, size: GAME_CONFIG.ALIEN_SIZE,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER, behavior: behaviorZigZag,
  spawnWeight:(lvl,cycle)=> 0.15, spawnSound:'alien'
});
AlienTypeRegistry.register('splitter', {
  sides: 6, color:[255,120,0], baseSpeed:0.5, targetSpeed:0.4, health:2, size: GAME_CONFIG.ALIEN_SIZE+4,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER, behavior: behaviorSplitter,
  onDeath:(alien)=>{ // spawn minis bounded
  const room = getCurrentMaxAliens() - gameState.aliens.length;
  if (room <= 0) return;
  // Respect mini type cap as well
  const currentMinis = gameState.aliens.reduce((c,a)=> c + (a.type==='mini'), 0);
  const miniCapRoom = (ALIEN_TYPE_MAX.mini||Infinity) - currentMinis;
  if (miniCapRoom <= 0) return;
  const spawnCount = min(2, room, miniCapRoom);
    for (let k=0;k<spawnCount;k++) {
      const a = new Alien(alien.pos.x + random(-10,10), alien.pos.y + random(-10,10), 'mini');
      gameState.aliens.push(a);
      soundManager && soundManager.spawnAlien('mini');
    }
  },
  spawnWeight:(lvl,cycle)=> lvl>2?0.08:0.0, spawnSound:'alien'
});
AlienTypeRegistry.register('mini', {
  sides: 5, color:[255,200,120], baseSpeed:0.9, targetSpeed:0.8, health:1, size: GAME_CONFIG.ALIEN_SIZE*0.55,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER*0.5, behavior: behaviorMini,
  spawnWeight:()=>0, spawnSound:'alien'
});
AlienTypeRegistry.register('bomber', {
  sides: 4, color:[255,80,160], baseSpeed:0.45, targetSpeed:0.5, health:2, size: GAME_CONFIG.ALIEN_SIZE+2,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER*1.2, behavior: behaviorBomber,
  spawnWeight:(lvl,cycle)=> lvl>3?0.1:0.0, spawnSound:'alien'
});
AlienTypeRegistry.register('orbiter', {
  sides: 8, color:[80,200,255], baseSpeed:0.4, targetSpeed:0.45, health:1, size: GAME_CONFIG.ALIEN_SIZE,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER, behavior: behaviorOrbiter,
  spawnWeight:(lvl,cycle)=> 0.12, spawnSound:'alien'
});
AlienTypeRegistry.register('leech', {
  sides: 5, color:[120,255,120], baseSpeed:0.42, targetSpeed:0.42, health:1, size: GAME_CONFIG.ALIEN_SIZE,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER, behavior: behaviorLeech,
  spawnWeight:(lvl,cycle)=> lvl>1?0.1:0.05, spawnSound:'alien'
});
AlienTypeRegistry.register('evasive', {
  sides: 6, color:[255,255,120], baseSpeed:0.6, targetSpeed:0.55, health:1, size: GAME_CONFIG.ALIEN_SIZE,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER, behavior: behaviorEvasive,
  spawnWeight:(lvl,cycle)=> 0.1, spawnSound:'alien'
});
AlienTypeRegistry.register('blink', {
  sides: 3, color:[160,120,255], baseSpeed:0.5, targetSpeed:0.5, health:1, size: GAME_CONFIG.ALIEN_SIZE,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER, behavior: behaviorBlink,
  spawnWeight:(lvl,cycle)=> lvl>2?0.08:0.0, spawnSound:'alien'
});
AlienTypeRegistry.register('shielded', {
  sides: 6, color:[120,200,255], baseSpeed:0.45, targetSpeed:0.45, health:3, size: GAME_CONFIG.ALIEN_SIZE+2,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER, behavior: behaviorShielded,
  spawnWeight:(lvl,cycle)=> lvl>3?0.07:0.0, spawnSound:'alien'
});
AlienTypeRegistry.register('vortex', {
  sides: 9, color:[180,0,255], baseSpeed:0.35, targetSpeed:0.35, health:2, size: GAME_CONFIG.ALIEN_SIZE+6,
  contactDamage: GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER, behavior: behaviorVortex,
  spawnWeight:(lvl,cycle)=> lvl>4?0.06:0.0, spawnSound:'alien'
});
AlienTypeRegistry.register('boss', {
  sides: 12, color:[255,40,40], baseSpeed:0.30, targetSpeed:0.32, health:BOSS_CONFIG.HEALTH, size:BOSS_CONFIG.SIZE,
  contactDamage: BOSS_CONFIG.CONTACT_DAMAGE, behavior: behaviorBoss,
  spawnWeight:()=>0, spawnSound:'boss',
  onDeath:(alien)=>{ // large burst of splitters
    spawnBossSplitters(alien, BOSS_CONFIG.DEATH_SPLITTERS);
  }
});
// === SOUND CONFIG ===
const SOUND_CONFIG = {
  masterGain: 0.4,
  shot: { baseFreq: 520, decay: 0.18 },
  multiShotSpread: 0.06, // pitch variation factor per extra shot
  explosion: { baseFreq: 90, decay: 0.6 },
  planetExplosion: { baseFreq: 48, decay: 1.1 },
  shipExplosion: { baseFreq: 140, decay: 0.7 },
  alienSpawn: { baseFreq: 660, decay: 0.25 },
  powerup: { decay: 0.25 },
  levelUp: { freqs: [523, 659, 784], step: 0.12 },
  gameOver: { freqs: [392, 233, 130], step: 0.25 },
  waveforms: ['sine','triangle','sawtooth','square']
};

// === POWERUP TYPES ===
const POWERUP_TYPES = {
  FIRE_RATE: { name: "Rapid Fire", color: [255, 100, 100], symbol: "R", effect: "Increases fire rate" },
  BULLET_SPEED: { name: "Velocity Boost", color: [100, 255, 100], symbol: "V", effect: "Increases bullet speed" },
  MULTI_SHOT_2: { name: "Double Shot", color: [100, 100, 255], symbol: "2", effect: "Fires 2 bullets" },
  MULTI_SHOT_3: { name: "Triple Shot", color: [255, 255, 100], symbol: "3", effect: "Fires 3 bullets" },
  MULTI_SHOT_4: { name: "Quad Shot", color: [255, 100, 255], symbol: "4", effect: "Fires 4 bullets" },
  BULLET_SIZE: { name: "Big Bullets", color: [255, 150, 0], symbol: "B", effect: "Increases bullet size" },
  HEALTH_BOOST: { name: "Health Pack", color: [0, 255, 0], symbol: "+", effect: "Restores health" },
  SHIELD: { name: "Energy Shield", color: [0, 255, 255], symbol: "S", effect: "Temporary invincibility" },
  THRUST_POWER: { name: "Turbo Thrust", color: [255, 200, 0], symbol: "T", effect: "Increases thrust power" },
  PENETRATING_SHOTS: { name: "Piercing Bullets", color: [255, 0, 0], symbol: "P", effect: "Bullets pierce through aliens" },
  EXPLOSIVE_SHOTS: { name: "Explosive Rounds", color: [255, 100, 0], symbol: "E", effect: "Bullets explode on impact" },
  HOMING_MISSILES: { name: "Seeking Missiles", color: [150, 255, 150], symbol: "H", effect: "Bullets track enemies" },
  TIME_SLOW: { name: "Chronos Field", color: [100, 200, 255], symbol: "C", effect: "Slows down enemies" },
  DAMAGE_MULTIPLIER: { name: "Power Amplifier", color: [255, 50, 150], symbol: "D", effect: "Increases damage" }
};

// === GAME STATE ===
let gameState = {
  players: [],
  projectiles: [],
  planets: [],
  aliens: [],
  thrustParticles: [],
  powerups: [], // New: Array to store active powerups
  isFullscreen: false,
  gameOver: false, // New: Game over state
  // Level progression
  level: 1,
  aliensKilled: 0,
  totalAliensKilled: 0,
  // Spawn timing
  lastAlienSpawnFrame: 0
};
let soundManager; // global reference

// === MAIN GAME FUNCTIONS ===

/**
 * Draw a generic health bar (red background, green foreground)
 * @param {number} x - left x of bar
 * @param {number} y - top y of bar
 * @param {number} widthPx - total width
 * @param {number} heightPx - total height
 * @param {number} current - current value
 * @param {number} max - max value
 */
function drawStandardHealthBar(x, y, widthPx, heightPx, current, max) {
  push();
  noStroke();
  fill(255,0,0);
  rect(x, y, widthPx, heightPx);
  fill(0,255,0);
  const w = max <= 0 ? 0 : map(constrain(current,0,max), 0, max, 0, widthPx);
  rect(x, y, w, heightPx);
  pop();
}

/**
 * Initialize the game canvas and create initial game objects
 */
function setup() {
  createCanvas(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
  angleMode(RADIANS);
  // Initialize sound manager (lazy starts on first gesture)
  soundManager = new SoundManager();
  
  // Initialize players with different positions and control schemes
  initializePlayers();
  
  // Create initial planets at random positions
  initializePlanets();
}

/**
 * Initialize player objects with their control schemes
 */
function initializePlayers() {
  // Player 1: Arrow keys
  gameState.players.push(new Player(
    width * 0.25, 
    height / 2, 
    LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW
  ));
  
  // Player 2: WASD + Space
  gameState.players.push(new Player(
    width * 0.75, 
    height / 2, 
    65, 68, 87, 32 // A, D, W, SPACE
  ));
}

/**
 * Create initial planets at random positions
 */
function initializePlanets() {
  for (let i = 0; i < GAME_CONFIG.PLANET_COUNT; i++) {
    gameState.planets.push(new Planet(getRandomPlanetPosition().x, getRandomPlanetPosition().y));
  }
}

/**
 * Get a random position for planet placement with margins from screen edges
 * @returns {p5.Vector} - Random position within screen bounds with margins
 */
function getRandomPlanetPosition() {
  const margin = GAME_CONFIG.PLANET_MARGIN;
  const x = random(margin, width - margin);
  const y = random(margin, height - margin);
  return createVector(x, y);
}

/**
 * Reposition all existing planets after window resize
 */
function repositionPlanets() {
  for (let planet of gameState.planets) {
    const newPos = getRandomPlanetPosition();
    planet.pos.x = newPos.x;
    planet.pos.y = newPos.y;
  }
}

/**
 * Main game loop - updates and renders all game objects
 */
function draw() {
  background(GAME_CONFIG.BACKGROUND_COLOR);
  resetDrawState();
  
  if (gameState.gameOver) {
    displayGameOver();
    return;
  }
  
  // Process all game entities in order
  updateAndDrawPlanets();
  updateAndDrawPlayers();
  // Check for all players destroyed (new loss condition)
  if (!gameState.gameOver && gameState.players.length === 0) {
    gameState.gameOver = true;
    soundManager && soundManager.gameOver();
    displayGameOver();
    return;
  }
  updateAndDrawProjectiles();
  updateAndDrawAliens();
  updateAndDrawPowerups();
  spawnAliens();
  updateAndDrawParticles();
  
  // Check for level progression
  checkLevelProgression();
  
  // Display game UI
  displayGameUI();
  soundManager && soundManager.update();
}

/**
 * Handle planet updates, rendering, and destruction
 */
function updateAndDrawPlanets() {
  for (let i = gameState.planets.length - 1; i >= 0; i--) {
    const planet = gameState.planets[i];
    planet.display();
    
    // Remove destroyed planets
    if (planet.health <= 0) {
      createExplosion(planet.pos, color(100, 150, 255)); // Blue explosion for planets
      gameState.planets.splice(i, 1);
    }
  }
  
  // Check for game over condition
  if (gameState.planets.length === 0 && !gameState.gameOver) {
    gameState.gameOver = true;
  soundManager && soundManager.gameOver();
  }
}

/**
 * Handle player updates, rendering, and collision detection
 */
function updateAndDrawPlayers() {
  for (let i = gameState.players.length - 1; i >= 0; i--) {
    const player = gameState.players[i];
    player.update();
    player.display();
    
    // Check collisions with aliens
    checkPlayerAlienCollisions(player, i);
  }
}

/**
 * Check collisions between a player and all aliens
 */
function checkPlayerAlienCollisions(player, playerIndex) {
  for (let j = gameState.aliens.length - 1; j >= 0; j--) {
    const alien = gameState.aliens[j];
    const dx = player.pos.x - alien.pos.x;
    const dy = player.pos.y - alien.pos.y;
    const rad = (alien.size||GAME_CONFIG.ALIEN_SIZE) + GAME_CONFIG.ALIEN_PLAYER_HIT_RADIUS;
    if (dx*dx + dy*dy < rad*rad) {
      if (player.powerups.shield <= 0) {
        player.health -= (alien.contactDamage || GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER);
      }
      const cfg = AlienTypeRegistry.get(alien.type);
      if (alien.type === 'shielded') {
        alien.invulnFrames = alien.invulnFrames||0;
        if (alien.invulnFrames>0) {
          // Ignore hit entirely (shield active) – no FX
          continue;
        } else {
          alien.invulnFrames = 15; // begin invulnerability window AFTER this registered hit
        }
      }
      // Apply damage & FX
      alien.health -= 1;
      if (alien.health <= 0) {
        if (cfg && cfg.onDeath) cfg.onDeath(alien);
        gameState.aliens.splice(j,1);
        gameState.aliensKilled++;
        gameState.totalAliensKilled++;
        if (random() < GAME_CONFIG.POWERUP_SPAWN_CHANCE) spawnPowerup(alien.pos.x, alien.pos.y);
        soundManager && soundManager.explosion(alien.isLarge?'planet':'alien');
        createExplosion(player.pos, player.color);
        soundManager && soundManager.explosion('ship');
      } else {
        createExplosion(player.pos, player.color);
        soundManager && soundManager.explosion('ship');
      }
      if (player.health <= 0) { gameState.players.splice(playerIndex,1); break; }
    }
  }
}

/**
 * Handle projectile updates, rendering, and collision detection with performance limits
 */
function updateAndDrawProjectiles() {
  // Limit projectile count for performance
  if (gameState.projectiles.length > GAME_CONFIG.MAX_PROJECTILES) {
    gameState.projectiles = gameState.projectiles.slice(-GAME_CONFIG.MAX_PROJECTILES);
  }
  
  for (let i = gameState.projectiles.length - 1; i >= 0; i--) {
    const projectile = gameState.projectiles[i];
    
    // Check alien collisions
    if (checkProjectileAlienCollisions(projectile, i)) {
      continue; // Projectile was destroyed
    }
    
    // Remove projectiles that leave the screen or expire
    if (isOffScreen(projectile.pos) || projectile.isExpired()) {
      gameState.projectiles.splice(i, 1);
    } else {
      projectile.update();
      projectile.display();
    }
  }
}

/**
 * Check collisions between a projectile and all aliens
 * @param {Projectile} projectile - The projectile to check
 * @param {number} projectileIndex - Index of the projectile
 * @returns {boolean} - True if projectile was destroyed
 */
function checkProjectileAlienCollisions(projectile, projectileIndex) {
  function removeAlienAndCount(idx) {
    gameState.aliens.splice(idx, 1);
    gameState.aliensKilled++;
    gameState.totalAliensKilled++;
  }
  for (let j = gameState.aliens.length - 1; j >= 0; j--) {
    const alien = gameState.aliens[j];
    const dx = projectile.pos.x - alien.pos.x;
    const dy = projectile.pos.y - alien.pos.y;
    const alienRadius = alien.size || GAME_CONFIG.ALIEN_SIZE;
    const projectileRadius = (projectile.size || GAME_CONFIG.PROJECTILE_SIZE)*0.5;
    const hitR = alienRadius + projectileRadius;
    if (dx*dx + dy*dy < hitR*hitR) {
      if (alien.type === 'shielded') { // shield gating
        alien.invulnFrames = alien.invulnFrames||0;
        if (alien.invulnFrames>0) {
          // Shield active – ignore totally
          if (!projectile.penetrating) {
            gameState.projectiles.splice(projectileIndex,1);
            return true;
          }
          continue;
        } else {
          alien.invulnFrames = 15; // start invuln AFTER this hit processes
        }
      }
      // FX only if not shield-blocked
      createExplosion(alien.pos, alien.color); // Use alien's color for explosion
      soundManager && soundManager.explosion(alien.isLarge?'planet':'alien');
      
      // Chance to spawn powerup before removing alien
      if (random() < GAME_CONFIG.POWERUP_SPAWN_CHANCE) {
        spawnPowerup(alien.pos.x, alien.pos.y);
      }
      
      // Apply damage / special logic
      const cfg = AlienTypeRegistry.get(alien.type);
  // shield already handled
      const preHealth = alien.health;
      alien.health -= (projectile.damage || 1);
      if (alien.type==='boss' && alien.health>0 && alien.health < preHealth) {
        // chance to spawn a reactive splitter on hit
        if (random() < BOSS_CONFIG.SPLITTER_BURST_ON_HIT) spawnBossSplitters(alien,1);
      }
      if (alien.health <= 0) {
        // Death effects
        if (cfg && typeof cfg.onDeath === 'function') cfg.onDeath(alien);
        removeAlienAndCount(j);
      }
      
      // Handle explosive bullets
      if (projectile.explosive) {
        createExplosiveDamage(alien.pos, 60); // 60 pixel explosion radius
      }
      
      // Only destroy projectile if it's not penetrating
      if (!projectile.penetrating) {
        gameState.projectiles.splice(projectileIndex, 1);
      }
      
  // Kill counters handled inside removeAlienAndCount
      return !projectile.penetrating; // Return true if projectile was destroyed
    }
  }
  return false; // Projectile still exists
}

/**
 * Handle alien updates, rendering, and collision with planets
 */
function updateAndDrawAliens() {
  // Check if any player has time slow active
  const timeSlowActive = gameState.players.some(player => player.powerups.timeSlowField > 0);
  
  for (let i = gameState.aliens.length - 1; i >= 0; i--) {
    const alien = gameState.aliens[i];
    alien.update(timeSlowActive);
    alien.display();
    
    // Remove aliens that go off-screen (with some buffer)
    if (isOffScreenWithBuffer(alien.pos)) {
      gameState.aliens.splice(i, 1);
      // Debug log (temporary)
  // debug log removed for performance
      continue;
    }
    
    // Check collisions with planets
    checkAlienPlanetCollisions(alien, i);
  }
}

/**
 * Check collisions between an alien and all planets
 */
function checkAlienPlanetCollisions(alien, alienIndex) {
  for (let j = gameState.planets.length - 1; j >= 0; j--) {
    const planet = gameState.planets[j];
  const dx = alien.pos.x - planet.pos.x;
  const dy = alien.pos.y - planet.pos.y;
  const r = GAME_CONFIG.PLANET_HIT_RADIUS;
  if (dx*dx + dy*dy < r*r) {
      planet.health -= 1;
      createExplosion(alien.pos, alien.color); // Use alien's color for explosion
      
      // Chance to spawn powerup before removing alien
      if (random() < GAME_CONFIG.POWERUP_SPAWN_CHANCE) {
        spawnPowerup(alien.pos.x, alien.pos.y);
      }
      
      gameState.aliens.splice(alienIndex, 1);
      
      // Increment kill counters for level progression
      gameState.aliensKilled++;
      gameState.totalAliensKilled++;
      
  // debug log removed
      break;
    }
  }
}

/**
 * Get current maximum aliens allowed based on level
 * @returns {number} - Maximum aliens for current level
 */
function getCurrentMaxAliens() {
  return GAME_CONFIG.MAX_ALIENS + (gameState.level - 1) * GAME_CONFIG.MAX_ALIENS_PER_LEVEL;
}

/**
 * Spawn new aliens at regular intervals from screen edges with population limit and level scaling
 */
function spawnAliens() {
  const currentSpawnInterval = getCurrentSpawnInterval();
  const maxAliens = getCurrentMaxAliens();
  
  // Use frame-based timing instead of modulo to handle level changes properly
  if (frameCount - gameState.lastAlienSpawnFrame >= currentSpawnInterval && 
      gameState.aliens.length < maxAliens) {
    const spawnPosition = getRandomEdgePosition();
    // Determine alien type via registry weighting
  let alienType = AlienTypeRegistry.pick(gameState.level);
  // Boss roll (only if conditions and none exists yet)
  const bossExists = gameState.aliens.some(a=>a.type==='boss');
  if (!bossExists && gameState.level >= BOSS_CONFIG.MIN_LEVEL && random() < BOSS_CONFIG.CHANCE_PER_SPAWN) {
    alienType = 'boss';
  } else if (random() < GAME_CONFIG.LARGE_ALIEN_CHANCE) {
    alienType = 'large';
  }
  const countOfType = gameState.aliens.reduce((c,a)=>c+(a.type===alienType),0);
  if (ALIEN_TYPE_MAX[alienType] && countOfType >= ALIEN_TYPE_MAX[alienType]) alienType = 'dumb';
  const alien = new Alien(spawnPosition.x, spawnPosition.y, alienType);
  gameState.aliens.push(alien);
    if (soundManager) {
      soundManager.spawnAlien(alienType);
    }
    gameState.lastAlienSpawnFrame = frameCount;
  }
}

/**
 * Get a random position at the edge of the screen
 * @returns {p5.Vector} - Random edge position
 */
function getRandomEdgePosition() {
  const edge = floor(random(4));
  switch (edge) {
    case 0: return createVector(random(width), 0); // Top
    case 1: return createVector(width, random(height)); // Right
    case 2: return createVector(random(width), height); // Bottom
    case 3: return createVector(0, random(height)); // Left
  }
}

/**
 * Check if level should be advanced based on aliens killed
 */
function checkLevelProgression() {
  if (gameState.aliensKilled >= GAME_CONFIG.ALIENS_PER_LEVEL) {
    gameState.level++;
    gameState.aliensKilled = 0;
    
    // Reset spawn timer to immediately benefit from faster spawn rate
    gameState.lastAlienSpawnFrame = frameCount - getCurrentSpawnInterval();
    
    // Visual feedback for level up
    createLevelUpEffect();
  soundManager && soundManager.levelUp();
  }
}

/**
 * Create visual effect when level increases
 */
function createLevelUpEffect() {
  // Create burst of particles at screen center
  const centerPos = createVector(width / 2, height / 2);
  for (let i = 0; i < 50; i++) {
    const velocity = p5.Vector.random2D().mult(random(2, 5));
    const levelColor = color(255, 255, 0); // Yellow for level up
    gameState.thrustParticles.push(new ThrustParticle(centerPos, velocity, levelColor));
  }
}

/**
 * Display game UI including level, score, and aliens killed
 */
function displayGameUI() {
  push();
  noStroke();
  fill(255);
  textSize(16);
  textAlign(LEFT);
  
  // Display level
  text(`Level: ${gameState.level}`, 10, 25);
  
  // Display aliens killed this level
  text(`Aliens Killed: ${gameState.aliensKilled}/${GAME_CONFIG.ALIENS_PER_LEVEL}`, 10, 45);
  
  // Display total aliens killed
  text(`Total Killed: ${gameState.totalAliensKilled}`, 10, 65);
  
  // Display current alien spawn rate with clearer formatting
  const currentSpawnInterval = getCurrentSpawnInterval();
  const spawnRate = (60 / currentSpawnInterval).toFixed(1);
  text(`Spawn Rate: ${spawnRate}/sec (${currentSpawnInterval} frames)`, 10, 85);
  
  // Display speed multiplier
  const speedMultiplier = getCurrentSpeedMultiplier().toFixed(1);
  text(`Speed Multiplier: ${speedMultiplier}x`, 10, 105);
  
  // Display alien population info with debug details
  const maxAliens = getCurrentMaxAliens();
  text(`Aliens: ${gameState.aliens.length}/${maxAliens}`, 10, 125);
  // Removed debug spawn notification for cleaner HUD
  
  pop();
}

/**
 * Display game over screen with restart option
 */
function displayGameOver() {
  push();
  noStroke();
  
  // Semi-transparent overlay
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  
  // Game Over text
  fill(255, 100, 100);
  textAlign(CENTER, CENTER);
  textSize(64);
  text("GAME OVER", width / 2, height / 2 - 60);
  
  // Final stats
  textSize(18);
  text(`Final Level: ${gameState.level}`, width / 2, height / 2 + 30);
  text(`Total Aliens Killed: ${gameState.totalAliensKilled}`, width / 2, height / 2 + 55);
  
  // Restart instruction
  fill(255, 255, 100);
  textSize(20);
  text("Press R to Restart", width / 2, height / 2 + 100);
  
  pop();
}

/**
 * Reset the game to initial state
 */
function restartGame() {
  // Reset game state
  gameState = {
    players: [],
    projectiles: [],
    planets: [],
    aliens: [],
    thrustParticles: [],
    powerups: [],
    isFullscreen: false,
    gameOver: false,
    level: 1,
    aliensKilled: 0,
    totalAliensKilled: 0,
    lastAlienSpawnFrame: 0
  };
  
  // Reinitialize game elements
  initializePlayers();
  initializePlanets();
}

/**
 * Get current spawn interval based on level
 * @returns {number} - Current spawn interval in frames
 */
function getCurrentSpawnInterval() {
  const reduction = (gameState.level - 1) * GAME_CONFIG.LEVEL_SPAWN_REDUCTION;
  const interval = Math.max(30, GAME_CONFIG.ALIEN_SPAWN_INTERVAL - reduction); // Minimum 30 frames (0.5 sec)
  return interval;
}

/**
 * Get current alien speed multiplier based on level
 * @returns {number} - Speed multiplier for current level
 */
function getCurrentSpeedMultiplier() {
  return 1 + (gameState.level - 1) * GAME_CONFIG.LEVEL_SPEED_MULTIPLIER;
}

/**
 * Handle particle updates and rendering with performance limits
 */
function updateAndDrawParticles() {
  if (gameState.thrustParticles.length > GAME_CONFIG.MAX_PARTICLES) {
    gameState.thrustParticles = gameState.thrustParticles.slice(-GAME_CONFIG.MAX_PARTICLES);
  }
  push();
  noStroke();
  for (let i = gameState.thrustParticles.length - 1; i >= 0; i--) {
    const particle = gameState.thrustParticles[i];
    particle.update();
    particle.display();
    if (particle.lifespan <= 0) gameState.thrustParticles.splice(i, 1);
  }
  pop();
}

// === UTILITY FUNCTIONS ===

/**
 * Check if a position is outside the screen boundaries
 * @param {p5.Vector} pos - Position to check
 * @returns {boolean} - True if position is off screen
 */
function isOffScreen(pos) {
  return pos.x < 0 || pos.x > width || pos.y < 0 || pos.y > height;
}

/**
 * Check if a position is outside the screen boundaries with buffer for larger entities
 * @param {p5.Vector} pos - Position to check
 * @returns {boolean} - True if position is off screen beyond buffer
 */
function isOffScreenWithBuffer(pos) {
  const buffer = 50; // Give aliens some buffer before removing them
  return pos.x < -buffer || pos.x > width + buffer || pos.y < -buffer || pos.y > height + buffer;
}

/**
 * Create an explosion effect at the given position
 * @param {p5.Vector} pos - Position to create explosion
 * @param {p5.Color} explosionColor - Color of explosion particles
 */
function createExplosion(pos, explosionColor = color(255, 100, 0)) {
  for (let i = 0; i < GAME_CONFIG.EXPLOSION_PARTICLE_COUNT; i++) {
    const velocity = p5.Vector.random2D().mult(random(1, 3));
    gameState.thrustParticles.push(new ThrustParticle(pos.copy(), velocity, explosionColor));
  }
}

/**
 * Apply gravitational force from planets to an object with improved performance
 * @param {p5.Vector} pos - Position of the object
 * @param {p5.Vector} vel - Velocity vector to modify
 */
function applyPlanetaryGravity(pos, vel) {
  const planetRadius = GAME_CONFIG.PLANET_SIZE * 0.5;
  const safeDistance = planetRadius + GAME_CONFIG.PLANET_SURFACE_BUFFER;
  
  for (let planet of gameState.planets) {
    const force = p5.Vector.sub(planet.pos, pos);
    const distanceSquared = force.magSq(); // More efficient than mag()
    const distance = Math.sqrt(distanceSquared);
    
    // Skip if too close (within minimum gravity range)
    if (distance <= GAME_CONFIG.MIN_GRAVITY_DISTANCE) continue;
    
    if (distance < safeDistance) {
      // Repulsive force when too close to planet surface
      const repulsiveStrength = GAME_CONFIG.GRAVITY_STRENGTH / (distanceSquared * 2);
      force.setMag(-repulsiveStrength);
      vel.add(force);
    } else {
      // Normal gravitational attraction with optimized calculation
      const strength = GAME_CONFIG.GRAVITY_STRENGTH / (distanceSquared * distance * GAME_CONFIG.GRAVITY_FALLOFF_FACTOR);
      force.setMag(strength);
      vel.add(force);
    }
  }
}

/**
 * Find the closest target from an array of objects
 * @param {p5.Vector} pos - Position to measure from
 * @param {Array} targets - Array of objects with pos property
 * @returns {Object|null} - Closest target or null if array is empty
 */
function findClosestTarget(pos, targets) {
  if (targets.length === 0) return null;
  let best = targets[0];
  let bestD2 = (pos.x - best.pos.x)*(pos.x - best.pos.x) + (pos.y - best.pos.y)*(pos.y - best.pos.y);
  for (let i=1;i<targets.length;i++) {
    const t = targets[i];
    const dx = pos.x - t.pos.x;
    const dy = pos.y - t.pos.y;
    const d2 = dx*dx + dy*dy;
    if (d2 < bestD2) { best = t; bestD2 = d2; }
  }
  return best;
}

// === INPUT HANDLERS ===

/**
 * Handle mouse click to toggle fullscreen mode
 */
function mousePressed() {
  soundManager && soundManager.init();
  if (!gameState.isFullscreen) {
    fullscreen(true);
    gameState.isFullscreen = true;
  }
  return false; // Prevent default behavior
}

/**
 * Handle keyboard input for game controls
 */
function keyPressed() {
  soundManager && soundManager.init();
  // Restart game on 'R' key when game is over
  if (gameState.gameOver && (key === 'r' || key === 'R')) {
    restartGame();
    return false;
  }
  
  // Toggle fullscreen on F11
  if (keyCode === 122) { // F11 key code
    if (!gameState.isFullscreen) {
      fullscreen(true);
      gameState.isFullscreen = true;
    } else {
      fullscreen(false);
      gameState.isFullscreen = false;
    }
    return false;
  }
  
  return true;
}

/**
 * Handle canvas resizing when entering/exiting fullscreen
 */
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  repositionPlanets();
}

// === POWERUP SYSTEM ===

/**
 * Handle powerup updates, rendering, and collection
 */
function updateAndDrawPowerups() {
  for (let i = gameState.powerups.length - 1; i >= 0; i--) {
    const powerup = gameState.powerups[i];
    powerup.update();
    powerup.display();
    
    let collected = false;
    
    // Check for collection by players
    for (let player of gameState.players) {
      const dx = player.pos.x - powerup.pos.x;
      const dy = player.pos.y - powerup.pos.y;
      const r = GAME_CONFIG.POWERUP_COLLECTION_RADIUS;
      if (dx*dx + dy*dy < r*r) {
        applyPowerupToPlayer(player, powerup.type);
  soundManager && soundManager.powerup(powerup.type);
        gameState.powerups.splice(i, 1);
        collected = true;
        break;
      }
    }
    
    // Remove expired powerups (only if not collected)
    if (!collected && powerup.age > GAME_CONFIG.POWERUP_LIFETIME) {
      gameState.powerups.splice(i, 1);
    }
  }
}

/**
 * Spawn a random powerup at specified position
 * @param {number} x - X position
 * @param {number} y - Y position
 */
function spawnPowerup(x, y) {
  const types = Object.keys(POWERUP_TYPES);
  const randomType = types[floor(random(types.length))];
  gameState.powerups.push(new Powerup(x, y, randomType));
}

/**
 * Apply powerup effects to a player
 * @param {Player} player - Player to apply effects to
 * @param {string} type - Type of powerup
 */
function applyPowerupToPlayer(player, type) {
  switch (type) {
    case 'FIRE_RATE':
      player.powerups.fireRate = min(3.0, player.powerups.fireRate + 0.3);
      break;
    case 'BULLET_SPEED':
      player.powerups.bulletSpeed = min(3.0, player.powerups.bulletSpeed + 0.4);
      break;
    case 'MULTI_SHOT_2':
      player.powerups.multiShot = max(2, player.powerups.multiShot);
      break;
    case 'MULTI_SHOT_3':
      player.powerups.multiShot = max(3, player.powerups.multiShot);
      break;
    case 'MULTI_SHOT_4':
      player.powerups.multiShot = max(4, player.powerups.multiShot);
      break;
    case 'BULLET_SIZE':
      player.powerups.bulletSize = min(2.5, player.powerups.bulletSize + 0.3);
      break;
    case 'HEALTH_BOOST':
      player.health = min(GAME_CONFIG.PLAYER_MAX_HEALTH, player.health + 30);
      break;
    case 'SHIELD':
      player.powerups.shield = 600; // 10 seconds at 60fps
      break;
    case 'THRUST_POWER':
      player.powerups.thrustPower = min(2.0, player.powerups.thrustPower + 0.3);
      break;
    case 'PENETRATING_SHOTS':
      player.powerups.penetratingShots = 1200; // 20 seconds
      break;
    case 'EXPLOSIVE_SHOTS':
      player.powerups.explosiveShots = 1200; // 20 seconds
      break;
    case 'HOMING_MISSILES':
      player.powerups.homingMissiles = 1800; // 30 seconds
      break;
    case 'TIME_SLOW':
      player.powerups.timeSlowField = 600; // 10 seconds
      break;
    case 'DAMAGE_MULTIPLIER':
      player.powerups.damageMultiplier = min(3.0, player.powerups.damageMultiplier + 0.5);
      break;
  }
}

/**
 * Create explosive damage in an area
 * @param {p5.Vector} center - Center of explosion
 * @param {number} radius - Explosion radius
 */
function createExplosiveDamage(center, radius) {
  for (let i = gameState.aliens.length - 1; i >= 0; i--) {
    const alien = gameState.aliens[i];
  const dx = center.x - alien.pos.x;
  const dy = center.y - alien.pos.y;
  if (dx*dx + dy*dy < radius*radius) {
      createExplosion(alien.pos, alien.color);
      
      // Chance to spawn powerup
      if (random() < GAME_CONFIG.POWERUP_SPAWN_CHANCE) {
        spawnPowerup(alien.pos.x, alien.pos.y);
      }
  // Invoke type onDeath hook so splitter / others behave correctly
  const cfg = AlienTypeRegistry.get(alien.type);
  if (cfg && typeof cfg.onDeath === 'function') cfg.onDeath(alien);
  gameState.aliens.splice(i, 1);
  gameState.aliensKilled++;
  gameState.totalAliensKilled++;
    }
  }
}

// === GAME CLASSES ===

/**
 * Player class representing a controllable spaceship
 */
class Player {
  /**
   * Create a new player
   * @param {number} x - Initial x position
   * @param {number} y - Initial y position
   * @param {number} lKey - Left rotation key code
   * @param {number} rKey - Right rotation key code
   * @param {number} tKey - Thrust key code
   * @param {number} sKey - Shoot key code
   */
  constructor(x, y, lKey, rKey, tKey, sKey) {
    this.pos = createVector(x, y);
    this.vel = createVector();
    this.acc = createVector();
    this.angle = -HALF_PI; // Point upward initially
    
    // Control scheme
    this.controls = { left: lKey, right: rKey, thrust: tKey, shoot: sKey };
    
    // Game properties
    this.health = GAME_CONFIG.PLAYER_MAX_HEALTH;
    this.color = color(random(100, 255), random(100, 255), random(100, 255));
    this.lastShotTime = 0;
    
    // Powerup effects
    this.powerups = {
      fireRate: 1.0,           // Multiplier for fire rate
      bulletSpeed: 1.0,        // Multiplier for bullet speed  
      multiShot: 1,            // Number of bullets to fire
      bulletSize: 1.0,         // Multiplier for bullet size
      thrustPower: 1.0,        // Multiplier for thrust power
      shield: 0,               // Duration of invincibility
      penetratingShots: 0,     // Duration of piercing bullets
      explosiveShots: 0,       // Duration of explosive bullets
      homingMissiles: 0,       // Duration of seeking missiles
      timeSlowField: 0,        // Duration of enemy slowdown
      damageMultiplier: 1.0    // Damage multiplier
    };
  }

  /**
   * Update player physics and handle input
   */
  update() {
    this.handleInput();
    this.applyPhysics();
    this.constrainToScreen();
    this.updatePowerups();
  }

  /**
   * Update powerup timers and effects
   */
  updatePowerups() {
    // Decrement timed powerups
    if (this.powerups.shield > 0) this.powerups.shield--;
    if (this.powerups.penetratingShots > 0) this.powerups.penetratingShots--;
    if (this.powerups.explosiveShots > 0) this.powerups.explosiveShots--;
    if (this.powerups.homingMissiles > 0) this.powerups.homingMissiles--;
    if (this.powerups.timeSlowField > 0) this.powerups.timeSlowField--;
  }

  /**
   * Handle player input for movement and shooting
   */
  handleInput() {
    // Rotation
    if (keyIsDown(this.controls.left)) {
      this.angle -= GAME_CONFIG.PLAYER_ROTATION_SPEED;
    }
    if (keyIsDown(this.controls.right)) {
      this.angle += GAME_CONFIG.PLAYER_ROTATION_SPEED;
    }

    // Thrust
    if (keyIsDown(this.controls.thrust)) {
      this.applyThrust();
      this.createThrustParticles();
    }

    // Shooting
    if (keyIsDown(this.controls.shoot)) {
      this.tryToShoot();
    }
  }

  /**
   * Apply thrust force in the direction the ship is facing with powerup multiplier
   */
  applyThrust() {
    const thrustForce = GAME_CONFIG.PLAYER_THRUST_FORCE * this.powerups.thrustPower;
    const thrustVector = p5.Vector.fromAngle(this.angle).mult(thrustForce);
    this.acc.add(thrustVector);
  }

  /**
   * Create visual thrust particles behind the ship
   */
  createThrustParticles() {
    const backPosition = this.getBackPosition();
    const particleVelocity = p5.Vector.fromAngle(this.angle + PI).mult(random(1, 2));
    // Use white color for thrust particles
    gameState.thrustParticles.push(new ThrustParticle(backPosition, particleVelocity, color(255, 255, 255)));
  }

  /**
   * Attempt to shoot a projectile (with cooldown)
   */
  tryToShoot() {
    const currentTime = millis();
    const adjustedCooldown = GAME_CONFIG.PLAYER_SHOT_COOLDOWN / this.powerups.fireRate;
    if (currentTime - this.lastShotTime > adjustedCooldown) {
      this.shoot();
      this.lastShotTime = currentTime;
    }
  }

  /**
   * Create and fire projectile(s) from the ship's tip with powerup effects
   */
  shoot() {
    // Limit total projectiles for performance
    if (gameState.projectiles.length >= GAME_CONFIG.MAX_PROJECTILES) {
      return; // Don't create new projectile if at limit
    }
    
    const tipPosition = this.getTipPosition();
    const baseSpeed = GAME_CONFIG.PROJECTILE_SPEED * this.powerups.bulletSpeed;
    
    // Handle multi-shot powerups
    const shots = this.powerups.multiShot;
    const spreadAngle = shots > 1 ? PI / 12 : 0; // 15 degree spread for multi-shot (tighter)
    
    for (let i = 0; i < shots; i++) {
      let shootAngle = this.angle;
      
      if (shots > 1) {
        // Spread bullets evenly
        const angleOffset = map(i, 0, shots - 1, -spreadAngle, spreadAngle);
        shootAngle += angleOffset;
      }
      
      const projectileVelocity = p5.Vector.fromAngle(shootAngle).mult(baseSpeed);
      const projectile = new Projectile(tipPosition, projectileVelocity);
      
      // Apply powerup effects to projectile
      projectile.size *= this.powerups.bulletSize;
      projectile.penetrating = this.powerups.penetratingShots > 0;
      projectile.explosive = this.powerups.explosiveShots > 0;
      projectile.homing = this.powerups.homingMissiles > 0;
      projectile.damage = this.powerups.damageMultiplier;
      
      gameState.projectiles.push(projectile);
    }
  soundManager && soundManager.shot(shots);
  }

  /**
   * Apply physics including gravity and movement
   */
  applyPhysics() {
  // Apply planetary gravity
  applyPlanetaryGravity(this.pos, this.acc);
    
    // Update velocity and position
    this.vel.add(this.acc);
    this.vel.limit(GAME_CONFIG.MAX_VELOCITY);
    this.pos.add(this.vel);
    
    // Reset acceleration for next frame
    this.acc.mult(0);
  }

  /**
   * Keep player within screen boundaries
   */
  constrainToScreen() {
    this.pos.x = constrain(this.pos.x, 0, width);
    this.pos.y = constrain(this.pos.y, 0, height);
  }

  /**
   * Get the position at the tip of the ship
   * @returns {p5.Vector} - Tip position
   */
  getTipPosition() {
    const tipOffset = p5.Vector.fromAngle(this.angle).mult(GAME_CONFIG.PLAYER_SIZE);
    return p5.Vector.add(this.pos, tipOffset);
  }

  /**
   * Get the position at the back of the ship
   * @returns {p5.Vector} - Back position
   */
  getBackPosition() {
    const backOffset = p5.Vector.fromAngle(this.angle + PI).mult(10);
    return p5.Vector.add(this.pos, backOffset);
  }

  /**
   * Render the player ship, health bar, and powerup effects
   */
  display() {
    this.drawShip();
    this.drawHealthBar();
    this.drawPowerupEffects();
  }

  /**
   * Draw visual indicators for active powerup effects
   */
  drawPowerupEffects() {
    push();
    translate(this.pos.x, this.pos.y);
    
    // Shield effect
    if (this.powerups.shield > 0) {
      noFill();
      stroke(0, 255, 255, 150);
      strokeWeight(3);
      const shieldRadius = GAME_CONFIG.PLAYER_SIZE * 2;
      ellipse(0, 0, shieldRadius);
    }
    
    pop();
  }

  /**
   * Draw the triangular ship
   */
  drawShip() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    fill(this.color);
    stroke(255);
    strokeWeight(1);
    
    // Draw triangular ship
    beginShape();
    vertex(GAME_CONFIG.PLAYER_SIZE, 0);
    vertex(-10, 7);
    vertex(-10, -7);
    endShape(CLOSE);
    pop();
  }

  /**
   * Draw the health bar above the ship
   */
  drawHealthBar() {
  const barWidth = 40, barHeight = 5;
  drawStandardHealthBar(this.pos.x - barWidth/2, this.pos.y - 30, barWidth, barHeight, this.health, GAME_CONFIG.PLAYER_MAX_HEALTH);
  }
}

/**
 * Projectile class representing bullets fired by players
 */
class Projectile {
  /**
   * Create a new projectile
   * @param {p5.Vector} pos - Initial position
   * @param {p5.Vector} vel - Initial velocity
   */
  constructor(pos, vel) {
    this.pos = pos.copy();
    this.vel = vel.copy();
    this.age = 0; // Track projectile age for lifetime management
    
    // Powerup properties
    this.size = GAME_CONFIG.PROJECTILE_SIZE;
    this.penetrating = false;
    this.explosive = false;
    this.homing = false;
  this.damage = 1.0;
  }

  /**
   * Update projectile physics with powerup effects
   */
  update() {
    // Homing behavior - seek nearest alien
    if (this.homing && gameState.aliens.length > 0) {
      let closestAlien = gameState.aliens[0];
      let bestD2 = (this.pos.x - closestAlien.pos.x)*(this.pos.x - closestAlien.pos.x) + (this.pos.y - closestAlien.pos.y)*(this.pos.y - closestAlien.pos.y);
      for (let k=1;k<gameState.aliens.length;k++) {
        const a = gameState.aliens[k];
        const dx = this.pos.x - a.pos.x;
        const dy = this.pos.y - a.pos.y;
        const d2 = dx*dx + dy*dy;
        if (d2 < bestD2) { bestD2 = d2; closestAlien = a; }
      }
      if (closestAlien) {
        const steer = p5.Vector.sub(closestAlien.pos, this.pos);
        steer.normalize();
        steer.mult(0.1); // Homing strength
        this.vel.add(steer);
        this.vel.normalize();
        this.vel.mult(GAME_CONFIG.PROJECTILE_SPEED);
      }
    }
    
    // Apply planetary gravity to projectiles
    applyPlanetaryGravity(this.pos, this.vel);
    
    // Update position
    this.pos.add(this.vel);
    this.age++;
  }

  /**
   * Check if projectile has expired
   * @returns {boolean} - True if projectile should be removed
   */
  isExpired() {
    return this.age > GAME_CONFIG.PROJECTILE_LIFETIME;
  }

  /**
   * Render the projectile with powerup effects
   */
  display() {
  push();
    // Different colors based on powerup effects
    if (this.explosive) {
      fill(255, 100, 0); // Orange for explosive
    } else if (this.penetrating) {
      fill(255, 0, 100); // Pink for penetrating
    } else if (this.homing) {
      fill(0, 255, 100); // Green for homing
    } else {
      fill(255, 200, 0); // Default yellow
    }
    
  noStroke();
    ellipse(this.pos.x, this.pos.y, this.size);
    
    // Add glow effect for special bullets
    if (this.explosive || this.penetrating || this.homing) {
      fill(255, 255, 255, 50);
      ellipse(this.pos.x, this.pos.y, this.size * 1.5);
    }
    
    pop();
  }
}

/**
 * Planet class representing gravitational bodies
 */
class Planet {
  /**
   * Create a new planet
   * @param {number} x - X position
   * @param {number} y - Y position
   */
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.health = GAME_CONFIG.PLANET_MAX_HEALTH;
  }

  /**
   * Render the planet and its health bar
   */
  display() {
    this.drawPlanet();
    this.drawHealthBar();
  }

  /**
   * Draw the planet as a blue circle
   */
  drawPlanet() {
  push();
  stroke(255);
  strokeWeight(1);
  fill(100, 150, 255);
  ellipse(this.pos.x, this.pos.y, GAME_CONFIG.PLANET_SIZE);
  pop();
  }

  /**
   * Draw the planet's health bar
   */
  drawHealthBar() {
  const barWidth = 40, barHeight = 5;
  drawStandardHealthBar(this.pos.x - barWidth/2, this.pos.y - 30, barWidth, barHeight, this.health, GAME_CONFIG.PLANET_MAX_HEALTH);
  }
}

/**
 * Alien class representing enemy entities with different behaviors
 */
class Alien {
  /**
   * Create a new alien
   * @param {number} x - X position
   * @param {number} y - Y position  
   * @param {string} type - Alien type: "dumb", "planet", or "player"
   */
  constructor(x, y, type) {
    this.pos = createVector(x, y);
    this.type = type;
    const cfg = AlienTypeRegistry.get(type) || AlienTypeRegistry.get('dumb');
    const speedMultiplier = getCurrentSpeedMultiplier();
    const variance = random(1 - GAME_CONFIG.ALIEN_SPEED_VARIANCE, 1 + GAME_CONFIG.ALIEN_SPEED_VARIANCE);
    const baseSpeed = cfg.baseSpeed ?? GAME_CONFIG.ALIEN_BASE_SPEED;
    const finalSpeed = baseSpeed * speedMultiplier * variance;
    this.vel = p5.Vector.random2D().mult(finalSpeed);
    this.sides = cfg.sides || 6;
    this.color = color(...cfg.color);
    this.size = cfg.size || GAME_CONFIG.ALIEN_SIZE;
    this.health = cfg.health || 1;
    this.contactDamage = cfg.contactDamage || GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER;
    this.behavior = cfg.behavior || behaviorDumb;
    this.targetSpeed = (cfg.targetSpeed || GAME_CONFIG.ALIEN_TARGET_SPEED) * speedMultiplier * variance;
    this.isLarge = (type === 'large'); // legacy flag
    // Rotation
    this.rotation = random(TWO_PI);
    this.rotationSpeed = random(-0.02, 0.02) * speedMultiplier;
  }

  /**
   * Get the number of sides for the alien shape based on type
   * @param {string} type - Alien type
   * @returns {number} - Number of sides
   */
  // Legacy helpers removed (sides/color handled by registry)

  /**
   * Update alien movement and physics
   * @param {boolean} timeSlowed - Whether time slow effect is active
   */
  update(timeSlowed = false) {
    const speedMultiplier = timeSlowed ? 0.3 : 1.0; // Slow to 30% speed
    
    this.updateMovement();
    this.applyGravity();
    this.updatePosition(speedMultiplier);
    this.updateRotation(speedMultiplier);
  }

  /**
   * Update movement based on alien type
   */
  updateMovement() {
  this.behavior(this, gameState);
  }

  /**
   * Seek the closest target from an array
   * @param {Array} targets - Array of target objects
   */
  seekTarget(targets) {
    const target = findClosestTarget(this.pos, targets);
    if (target) {
      const direction = p5.Vector.sub(target.pos, this.pos);
      direction.setMag(this.targetSpeed); // Use individual target speed
      this.vel = direction;
    }
  }

  /**
   * Apply gravitational forces from planets
   */
  applyGravity() {
    applyPlanetaryGravity(this.pos, this.vel);
  }

  /**
   * Update position based on velocity with optional speed multiplier
   * @param {number} speedMultiplier - Speed multiplier for time effects
   */
  updatePosition(speedMultiplier = 1.0) {
    const adjustedVel = p5.Vector.mult(this.vel, speedMultiplier);
    this.pos.add(adjustedVel);
  }

  /**
   * Update rotation animation with optional speed multiplier
   * @param {number} speedMultiplier - Speed multiplier for time effects
   */
  updateRotation(speedMultiplier = 1.0) {
    this.rotation += this.rotationSpeed * speedMultiplier;
  }

  /**
   * Render the alien as a colored polygon
   */
  display() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.rotation);
    fill(this.color);
    stroke(255);
    strokeWeight(1);
    
    // Draw polygon based on number of sides
    beginShape();
    for (let i = 0; i < this.sides; i++) {
      const angle = map(i, 0, this.sides, 0, TWO_PI);
  const radius = this.size;
      vertex(cos(angle) * radius, sin(angle) * radius);
    }
    endShape(CLOSE);
    if (this.health > 1) { // Generic multi-hit indicator
      push();
      noStroke();
      fill(255,255,255,200);
      textAlign(CENTER, CENTER);
      textSize(12);
      text(this.health, 0, 0);
      pop();
    }
    // Shield visual (blink effect) when invulnerable
    if (this.type === 'shielded' && this.invulnFrames && this.invulnFrames>0) {
      push();
      noFill();
      const alpha = map(this.invulnFrames, 0, 15, 30, 180);
      stroke(120,200,255, alpha);
      strokeWeight(2);
      ellipse(0,0,this.size*2.4, this.size*2.4);
      pop();
    }
    pop();
  }
}

/**
 * ThrustParticle class for visual effects
 */
class ThrustParticle {
  /**
   * Create a new thrust particle
   * @param {p5.Vector} pos - Initial position
   * @param {p5.Vector} vel - Initial velocity
   * @param {p5.Color} particleColor - Color of the particle (optional)
   */
  constructor(pos, vel, particleColor = color(255, 255, 255)) {
    this.pos = pos.copy();
    this.vel = vel.copy();
    this.lifespan = GAME_CONFIG.THRUST_PARTICLE_LIFESPAN;
    this.color = particleColor;
  }

  /**
   * Update particle physics
   */
  update() {
    this.pos.add(this.vel);
    this.lifespan -= GAME_CONFIG.THRUST_PARTICLE_DECAY;
  }

  /**
   * Render the particle with fading alpha and custom color
   */
  display() {
  // Extract RGB values and apply alpha based on lifespan (stroke disabled in batch caller)
    const r = red(this.color);
    const g = green(this.color);
    const b = blue(this.color);
    fill(r, g, b, this.lifespan);
    ellipse(this.pos.x, this.pos.y, 4);
  }
}

/**
 * Powerup class representing collectible items that enhance player abilities
 */
class Powerup {
  /**
   * Create a new powerup
   * @param {number} x - X position
   * @param {number} y - Y position
   * @param {string} type - Type of powerup from POWERUP_TYPES
   */
  constructor(x, y, type) {
    this.pos = createVector(x, y);
    this.type = type;
    this.age = 0;
    this.pulseOffset = random(TWO_PI);
  }

  /**
   * Update powerup age and physics
   */
  update() {
    this.age++;
  }

  /**
   * Render the powerup with pulsing animation
   */
  display() {
    const config = POWERUP_TYPES[this.type];
    if (!config) return;

    push();
    translate(this.pos.x, this.pos.y);
    
    // Pulsing size animation
    const pulseScale = 1 + 0.2 * sin(this.age * GAME_CONFIG.POWERUP_PULSE_SPEED + this.pulseOffset);
    const currentSize = GAME_CONFIG.POWERUP_SIZE * pulseScale;
    
    // Fade out as it expires
    const timeLeft = GAME_CONFIG.POWERUP_LIFETIME - this.age;
    const alpha = timeLeft < 300 ? map(timeLeft, 0, 300, 0, 255) : 255;
    
    // Draw powerup background
    fill(config.color[0], config.color[1], config.color[2], alpha);
    stroke(255, alpha);
    strokeWeight(2);
    ellipse(0, 0, currentSize);
    
    // Draw powerup symbol
    fill(255, alpha);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(currentSize * 0.6);
    text(config.symbol, 0, 0);
    
    pop();
  }
}

// === SOUND MANAGER ===
class SoundManager {
  constructor() {
    this.initialized = false;
    this.muted = false;
    this.oscPool = [];
    this.envPool = [];
    this.noise = null;
    this.poolIndex = 0;
    this.warned = false;
    this.poolSize = 8; // polyphony for overlapping bleeps
  this.masterGain = SOUND_CONFIG.masterGain; // internal scaling (avoid masterVolume global)
  this.activeSweeps = [];
  this.lastExplosionTimes = []; // for rate limiting
  }

  init() {
    if (this.initialized) return true;
    if (typeof userStartAudio === 'function') userStartAudio(); // p5 helper (safe if already running)
    if (typeof getAudioContext !== 'function') {
      if (!this.warned) { console.warn('p5.sound not loaded; audio disabled'); this.warned = true; }
      return false;
    }
    const ctx = getAudioContext();
    if (!ctx) return false;
    // Build oscillator + envelope pools
    for (let i=0;i<this.poolSize;i++) {
      const osc = new p5.Oscillator('sine');
      const env = new p5.Envelope();
      env.setADSR(0.001, 0.05, 0.0, 0.05); // fast attack/decay; sustain 0; short release
      env.setRange(0.5, 0.0001);
      osc.start();
      osc.amp(0); // silence until envelope
      this.oscPool.push(osc);
      this.envPool.push(env);
    }
  this.noise = new p5.Noise('white');
  this.noise.start();
  this.noise.amp(0);
  // Do not call masterVolume; some builds may not expose it. Scale per envelope instead.
    this.initialized = true;
    return true;
  }

  tone(freq, decay=0.15, type='sine', amp=0.5) {
    if (!this.init() || this.muted) return;
    const voiceIndex = this.poolIndex++ % this.oscPool.length;
    const osc = this.oscPool[voiceIndex];
    const env = this.envPool[voiceIndex];
    osc.setType(type);
    osc.freq(freq);
    // shape envelope per call (reuse object)
    env.setADSR(0.001, decay*0.6, 0.0, decay*0.4);
  env.setRange(amp * this.masterGain, 0.0001);
    env.play(osc, 0, 0);
  }

  shot(shots=1) {
    if (!this.init() || this.muted) return;
    const spread = SOUND_CONFIG.multiShotSpread;
    for (let i=0;i<shots;i++) {
      const ratio = shots>1 ? (i/(shots-1)-0.5) : 0;
      const base = SOUND_CONFIG.shot.baseFreq * (1 + ratio*spread);
  // Quick click (very short high freq sweep)
  this.pitchSweep(base*1.8, base*1.2, SOUND_CONFIG.shot.decay*0.25, 'sine', 0.20);
  // Core crack (square)
  this.tone(base*0.95, SOUND_CONFIG.shot.decay*0.55, 'square', 0.38);
  // Low tail
  this.tone(base*0.5, SOUND_CONFIG.shot.decay*0.9, 'triangle', 0.18);
  // Optional very subtle upward whisper
  this.pitchSweep(base*0.9, base*1.02, SOUND_CONFIG.shot.decay*0.4, 'triangle', 0.10);
    }
  }

  explosion(kind='alien') {
    if (!this.init() || this.muted) return;
  // Rate limit explosion layering: keep timestamps (ms) and trim
  const now = millis();
  this.lastExplosionTimes.push(now);
  while (this.lastExplosionTimes.length && now - this.lastExplosionTimes[0] > 300) this.lastExplosionTimes.shift();
  const density = this.lastExplosionTimes.length; // explosions in last 300ms
    const isPlanet = kind==='planet';
    const isShip = kind==='ship';
    const cfg = isPlanet ? SOUND_CONFIG.planetExplosion : (isShip? SOUND_CONFIG.shipExplosion : SOUND_CONFIG.explosion);
    const base = cfg.baseFreq;
    const decay = cfg.decay;
  const impactAmp = density>6 ? 0.3 : 0.55;
  const bodyAmp = density>6 ? 0.3 : 0.5;
  this.pitchSweep(base*3, base*0.85, decay*0.55, 'sawtooth', impactAmp); // bright impact
  this.tone(base, decay*0.7, 'triangle', bodyAmp); // low body
    if (this.noise) { // crackle tail
      const nAmp = isPlanet?0.85:(isShip?0.65:0.6);
      this.noise.amp(nAmp * this.masterGain, 0.002);
      this.noise.amp(0.0001, decay);
    }
  }

  pitchSweep(startFreq, endFreq, duration=0.2, type='sawtooth', amp=0.4) {
    if (!this.init() || this.muted) return;
    const idx = this.poolIndex++ % this.oscPool.length;
    const osc = this.oscPool[idx];
    const env = this.envPool[idx];
    osc.setType(type);
    osc.freq(startFreq);
    env.setADSR(0.001, duration*0.7, 0.0, duration*0.3);
    env.setRange(amp * this.masterGain, 0.0001);
    env.play(osc, 0, 0);
    this.activeSweeps.push({ osc, startFreq, endFreq, startTime: millis(), duration: duration*1000 });
  }

  spawnAlien(type='alien') {
    if (!this.init() || this.muted) return;
    const cfg = SOUND_CONFIG.alienSpawn;
    // Differentiate by type: adjust waveform, direction, layering
    switch (type) {
      case 'boss':
        this.pitchSweep(cfg.baseFreq*0.4, cfg.baseFreq*0.75, cfg.decay*1.6, 'sawtooth', 0.6);
        setTimeout(()=> this.tone(cfg.baseFreq*0.5, cfg.decay*1.2, 'triangle', 0.4), cfg.decay*500);
        break;
      case 'large':
        this.pitchSweep(cfg.baseFreq*0.55, cfg.baseFreq*0.8, cfg.decay*0.9, 'sawtooth', 0.45);
        this.tone(cfg.baseFreq*0.5, cfg.decay*0.8, 'triangle', 0.25);
        break;
      case 'mini':
        this.pitchSweep(cfg.baseFreq*1.2, cfg.baseFreq*1.45, cfg.decay*0.35, 'square', 0.25);
        this.tone(cfg.baseFreq*1.6, cfg.decay*0.3, 'sine', 0.15);
        break;
      case 'vortex':
        this.pitchSweep(cfg.baseFreq*0.9, cfg.baseFreq*0.6, cfg.decay*1.2, 'triangle', 0.4);
        setTimeout(()=> this.pitchSweep(cfg.baseFreq*0.6, cfg.baseFreq*0.4, cfg.decay*0.8, 'sine', 0.25), cfg.decay*300);
        break;
      case 'shielded':
        this.pitchSweep(cfg.baseFreq*0.8, cfg.baseFreq, cfg.decay*0.5, 'square', 0.3);
        this.tone(cfg.baseFreq*1.05, cfg.decay*0.5, 'sine', 0.18);
        break;
      case 'splitter':
        this.pitchSweep(cfg.baseFreq*0.95, cfg.baseFreq*1.15, cfg.decay*0.4, 'square', 0.3);
        break;
      case 'bomber':
        this.pitchSweep(cfg.baseFreq*0.7, cfg.baseFreq*0.95, cfg.decay*0.65, 'sawtooth', 0.35);
        break;
      case 'orbiter':
        this.pitchSweep(cfg.baseFreq*1.0, cfg.baseFreq*1.2, cfg.decay*0.5, 'triangle', 0.3);
        break;
      case 'leech':
        this.pitchSweep(cfg.baseFreq*0.85, cfg.baseFreq*1.05, cfg.decay*0.55, 'sine', 0.28);
        break;
      case 'evasive':
        this.pitchSweep(cfg.baseFreq*1.05, cfg.baseFreq*1.25, cfg.decay*0.35, 'square', 0.3);
        break;
      case 'blink':
        this.pitchSweep(cfg.baseFreq*1.15, cfg.baseFreq*0.95, cfg.decay*0.45, 'triangle', 0.32);
        setTimeout(()=> this.tone(cfg.baseFreq*1.4, cfg.decay*0.4, 'sine', 0.2), cfg.decay*350);
        break;
      default:
        this.pitchSweep(cfg.baseFreq*0.75, cfg.baseFreq, cfg.decay*0.5, 'square', 0.35);
        setTimeout(()=> this.tone(cfg.baseFreq*1.15, cfg.decay*0.6, 'sine', 0.25), cfg.decay*400);
    }
  }

  powerup(type) {
    if (!this.init() || this.muted) return;
    const idx = Object.keys(POWERUP_TYPES).indexOf(type);
    const base = 600 + (idx % 6)*40;
    this.tone(base, SOUND_CONFIG.powerup.decay, 'sine', 0.35);
    this.tone(base*1.25, SOUND_CONFIG.powerup.decay*0.8, 'triangle', 0.25);
  }

  levelUp() {
    if (!this.init() || this.muted) return;
    SOUND_CONFIG.levelUp.freqs.forEach((f,i)=> {
      setTimeout(()=> this.tone(f, 0.25, 'sine', 0.5), i * SOUND_CONFIG.levelUp.step*1000);
    });
  }

  gameOver() {
    if (!this.init() || this.muted) return;
    SOUND_CONFIG.gameOver.freqs.forEach((f,i)=> {
      setTimeout(()=> this.tone(f, 0.5, 'sawtooth', 0.4), i * SOUND_CONFIG.gameOver.step*1000);
    });
  }

  toggleMute() { this.muted = !this.muted; }
  update() {
    if (!this.initialized || this.activeSweeps.length===0) return;
    const now = millis();
    for (let i=this.activeSweeps.length-1;i>=0;i--) {
      const s = this.activeSweeps[i];
      const t = (now - s.startTime)/s.duration;
      if (t >= 1) { s.osc.freq(s.endFreq); this.activeSweeps.splice(i,1); continue; }
      const f = lerp(s.startFreq, s.endFreq, t);
      s.osc.freq(f);
    }
  }

  setMasterGain(g) { this.masterGain = g; }

  // Backward compatibility wrappers (old API names)
  playShot(shots=1){ this.shot(shots); }
  playExplosion(kind='alien'){ this.explosion(kind); }
  playPowerup(type){ this.powerup(type); }
  playLevelUp(){ this.levelUp(); }
  playGameOver(){ this.gameOver(); }
  playTone(freq, decay=0.2, type='sine', gain=0.5){ this.tone(freq, decay, type, gain); }
}

