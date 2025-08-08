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
  ALIEN_SPAWN_INTERVAL: 120, // frames
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
  
  if (gameState.gameOver) {
    displayGameOver();
    return;
  }
  
  // Process all game entities in order
  updateAndDrawPlanets();
  updateAndDrawPlayers();
  updateAndDrawProjectiles();
  updateAndDrawAliens();
  updateAndDrawPowerups();
  spawnAliens();
  updateAndDrawParticles();
  
  // Check for level progression
  checkLevelProgression();
  
  // Display game UI
  displayGameUI();
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
    const distance = dist(player.pos.x, player.pos.y, alien.pos.x, alien.pos.y);
    
    if (distance < GAME_CONFIG.ALIEN_PLAYER_HIT_RADIUS) {
      // Apply damage to player (unless shielded)
      if (player.powerups.shield <= 0) {
        player.health -= GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER;
      }
  createExplosion(player.pos, player.color); // Use player's color for explosion
  soundManager && soundManager.explosion(player.isLarge ? 'ship' : 'ship');
      
      // Chance to spawn powerup before removing alien
      if (random() < GAME_CONFIG.POWERUP_SPAWN_CHANCE) {
        spawnPowerup(alien.pos.x, alien.pos.y);
      }
      
      if (alien.isLarge) {
        alien.health -= 1;
        if (alien.health <= 0) {
          gameState.aliens.splice(j, 1);
          gameState.aliensKilled++;
          gameState.totalAliensKilled++;
        }
      } else {
        gameState.aliens.splice(j, 1);
        gameState.aliensKilled++;
        gameState.totalAliensKilled++;
      }
      
  // For large alien, kills counted only when removed
      
      // Debug log (temporary)
      console.log(`Alien hit player. Remaining aliens: ${gameState.aliens.length}`);
      
      // Remove player if health depleted
      if (player.health <= 0) {
        gameState.players.splice(playerIndex, 1);
        break;
      }
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
  const distance = dist(projectile.pos.x, projectile.pos.y, alien.pos.x, alien.pos.y);
  const alienRadius = alien.isLarge ? GAME_CONFIG.LARGE_ALIEN_SIZE : GAME_CONFIG.ALIEN_SIZE;
  const projectileRadius = projectile.size ? projectile.size * 0.5 : GAME_CONFIG.PROJECTILE_SIZE * 0.5;
  const hitRadius = alienRadius + projectileRadius; // treat as circle vs point
  if (distance < hitRadius) {
      createExplosion(alien.pos, alien.color); // Use alien's color for explosion
      if (alien.isLarge) {
        soundManager && soundManager.explosion('planet'); // deeper boom for large
      } else {
        soundManager && soundManager.explosion('alien');
      }
      
      // Chance to spawn powerup before removing alien
      if (random() < GAME_CONFIG.POWERUP_SPAWN_CHANCE) {
        spawnPowerup(alien.pos.x, alien.pos.y);
      }
      
      if (alien.isLarge) {
        alien.health -= projectile.damage || 1;
        if (alien.health <= 0) {
          removeAlienAndCount(j);
        }
      } else {
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
      
  // Kill counters handled inside removeAlienAndCount for large alien
      // Debug log (temporary)
      console.log(`Projectile killed alien. Remaining aliens: ${gameState.aliens.length}`);
      
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
      if (frameCount % 60 === 0) console.log(`Removed off-screen alien. Remaining: ${gameState.aliens.length}`);
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
    const distance = dist(alien.pos.x, alien.pos.y, planet.pos.x, planet.pos.y);
    
    if (distance < GAME_CONFIG.PLANET_HIT_RADIUS) {
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
      
      // Debug log (temporary)
      console.log(`Alien hit planet. Remaining aliens: ${gameState.aliens.length}`);
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
    // Level-based weighting: cycle emphasis every 3 levels
    const cycle = (gameState.level - 1) % 3; // 0,1,2
    let weights;
    if (cycle === 0) { // random emphasis
      weights = { dumb: 0.55, planet: 0.25, player: 0.20 };
    } else if (cycle === 1) { // planet seekers surge
      weights = { dumb: 0.30, planet: 0.50, player: 0.20 };
    } else { // player hunters surge
      weights = { dumb: 0.30, planet: 0.20, player: 0.50 };
    }
    const r = random();
    let alienType;
    if (r < weights.dumb) alienType = 'dumb';
    else if (r < weights.dumb + weights.planet) alienType = 'planet';
    else alienType = 'player';
    // Large alien rare spawn (independent roll, but only if population not too large)
    if (random() < GAME_CONFIG.LARGE_ALIEN_CHANCE) {
      alienType = 'large';
    }
    const alien = new Alien(spawnPosition.x, spawnPosition.y, alienType);
    gameState.aliens.push(alien);
    if (soundManager) {
      if (alienType === 'large') soundManager.spawnAlien('large');
      else soundManager.spawnAlien(alienType);
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
  
  // Semi-transparent overlay
  fill(0, 0, 0, 150);
  rect(0, 0, width, height);
  
  // Game Over text
  fill(255, 100, 100);
  textAlign(CENTER, CENTER);
  textSize(64);
  text("GAME OVER", width / 2, height / 2 - 60);
  
  // Subtitle
  fill(255);
  textSize(24);
  text("All planets have been destroyed!", width / 2, height / 2 - 10);
  
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
  // Limit particle count for performance
  if (gameState.thrustParticles.length > GAME_CONFIG.MAX_PARTICLES) {
    gameState.thrustParticles = gameState.thrustParticles.slice(-GAME_CONFIG.MAX_PARTICLES);
  }
  
  for (let i = gameState.thrustParticles.length - 1; i >= 0; i--) {
    const particle = gameState.thrustParticles[i];
    particle.update();
    particle.display();
    
    // Remove expired particles
    if (particle.lifespan <= 0) {
      gameState.thrustParticles.splice(i, 1);
    }
  }
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
  
  return targets.reduce((closest, current) => {
    const closestDist = p5.Vector.dist(pos, closest.pos);
    const currentDist = p5.Vector.dist(pos, current.pos);
    return currentDist < closestDist ? current : closest;
  });
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
      const distance = dist(player.pos.x, player.pos.y, powerup.pos.x, powerup.pos.y);
      if (distance < GAME_CONFIG.POWERUP_COLLECTION_RADIUS) {
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
    const distance = p5.Vector.dist(center, alien.pos);
    
    if (distance < radius) {
      createExplosion(alien.pos, alien.color);
      
      // Chance to spawn powerup
      if (random() < GAME_CONFIG.POWERUP_SPAWN_CHANCE) {
        spawnPowerup(alien.pos.x, alien.pos.y);
      }
      
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
      let closestAlien = null;
      let closestDistance = Infinity;
      
      for (let alien of gameState.aliens) {
  const distance = p5.Vector.dist(this.pos, alien.pos);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestAlien = alien;
        }
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
    fill(100, 150, 255);
    stroke(255);
    ellipse(this.pos.x, this.pos.y, GAME_CONFIG.PLANET_SIZE);
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
    
    // Calculate speed with random variance and level scaling
  const isLarge = type === 'large';
  const baseSpeed = isLarge ? GAME_CONFIG.LARGE_ALIEN_BASE_SPEED : GAME_CONFIG.ALIEN_BASE_SPEED;
    const speedMultiplier = getCurrentSpeedMultiplier();
    const randomVariance = random(1 - GAME_CONFIG.ALIEN_SPEED_VARIANCE, 1 + GAME_CONFIG.ALIEN_SPEED_VARIANCE);
    const finalSpeed = baseSpeed * speedMultiplier * randomVariance;
    
    this.vel = p5.Vector.random2D().mult(finalSpeed);
    this.type = type;
  this.sides = this.getSidesForType(type);
  this.color = this.getColorForType(type);
  this.isLarge = isLarge;
  this.health = isLarge ? GAME_CONFIG.LARGE_ALIEN_HEALTH : 1;
    
    // Store individual speed for target seeking
    this.targetSpeed = GAME_CONFIG.ALIEN_TARGET_SPEED * speedMultiplier * randomVariance;
    
    // Rotation properties
    this.rotation = random(TWO_PI); // Random starting rotation
    this.rotationSpeed = random(-0.02, 0.02) * speedMultiplier; // Random rotation direction and speed scaled by level
  }

  /**
   * Get the number of sides for the alien shape based on type
   * @param {string} type - Alien type
   * @returns {number} - Number of sides
   */
  getSidesForType(type) {
    switch (type) {
      case "planet": return 5;
      case "player": return 4;
  case 'large': return 8;
      default: return 6; // "dumb" type
    }
  }

  /**
   * Get the color for the alien based on type
   * @param {string} type - Alien type
   * @returns {p5.Color} - Alien color
   */
  getColorForType(type) {
    switch (type) {
      case "planet": return color(0, 255, 100); // Green - seeks planets
      case "player": return color(255, 50, 50);  // Red - seeks players
  case 'large': return color(255, 180, 0);    // Orange - large tank
      default: return color(150, 0, 255);        // Purple - random movement
    }
  }

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
    if (this.type === "planet" && gameState.planets.length > 0) {
      this.seekTarget(gameState.planets);
    } else if (this.type === "player" && gameState.players.length > 0) {
      this.seekTarget(gameState.players);
    }
    // "dumb" aliens maintain random movement (no change needed)
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
      const radius = this.isLarge ? GAME_CONFIG.LARGE_ALIEN_SIZE : GAME_CONFIG.ALIEN_SIZE;
      vertex(cos(angle) * radius, sin(angle) * radius);
    }
    endShape(CLOSE);
    if (this.isLarge && this.health > 0) {
      // simple small radial health pips
      push();
      noStroke();
      fill(255,255,255,180);
      textAlign(CENTER, CENTER);
      textSize(12);
      text(this.health, 0, 0);
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
    noStroke();
    // Extract RGB values and apply alpha based on lifespan
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
    const isPlanet = kind==='planet';
    const isShip = kind==='ship';
    const cfg = isPlanet ? SOUND_CONFIG.planetExplosion : (isShip? SOUND_CONFIG.shipExplosion : SOUND_CONFIG.explosion);
    const base = cfg.baseFreq;
    const decay = cfg.decay;
    this.pitchSweep(base*3, base*0.85, decay*0.55, 'sawtooth', 0.55); // bright impact
    this.tone(base, decay*0.7, 'triangle', 0.5); // low body
    if (this.noise) { // crackle tail
      const nAmp = isPlanet?0.85:(isShip?0.65:0.6);
      this.noise.amp(nAmp * this.masterGain, 0.002);
      this.noise.amp(0.0001, decay);
    }
  }

  pitchSweep(startFreq, endFreq, duration=0.2, type='sawtooth', amp=0.4) {
    if (!this.init() || this.muted) return;
    const voiceIndex = this.poolIndex++ % this.oscPool.length;
    const osc = this.oscPool[voiceIndex];
    const env = this.envPool[voiceIndex];
    osc.setType(type);
    osc.freq(startFreq);
    env.setADSR(0.001, duration*0.7, 0.0, duration*0.3);
    env.setRange(amp * this.masterGain, 0.0001);
    env.play(osc, 0, 0);
    const steps = 12;
    for (let i=1;i<=steps;i++) {
      const t = i/steps;
      const f = lerp(startFreq, endFreq, t);
      setTimeout(()=> osc.freq(f), t*duration*1000);
    }
  }

  spawnAlien() {
    if (!this.init() || this.muted) return;
    const cfg = SOUND_CONFIG.alienSpawn;
    this.pitchSweep(cfg.baseFreq*0.75, cfg.baseFreq, cfg.decay*0.5, 'square', 0.35);
    setTimeout(()=> this.tone(cfg.baseFreq*1.15, cfg.decay*0.6, 'sine', 0.25), cfg.decay*400);
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

  setMasterGain(g) { this.masterGain = g; }

  // Backward compatibility wrappers (old API names)
  playShot(shots=1){ this.shot(shots); }
  playExplosion(kind='alien'){ this.explosion(kind); }
  playPowerup(type){ this.powerup(type); }
  playLevelUp(){ this.levelUp(); }
  playGameOver(){ this.gameOver(); }
  playTone(freq, decay=0.2, type='sine', gain=0.5){ this.tone(freq, decay, type, gain); }
}

