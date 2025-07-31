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
  PROJECTILE_SPEED: 4,
  PROJECTILE_SIZE: 6,
  PROJECTILE_HIT_RADIUS: 15,
  PROJECTILE_LIFETIME: 300, // New: Frames before projectile expires
  
  // Planet settings
  PLANET_COUNT: 3,
  PLANET_SIZE: 40,
  PLANET_MAX_HEALTH: 10,
  PLANET_HIT_RADIUS: 30,
  
  // Alien settings
  ALIEN_SPAWN_INTERVAL: 120, // frames
  ALIEN_BASE_SPEED: 0.5,
  ALIEN_TARGET_SPEED: 0.3,
  ALIEN_SIZE: 15,
  ALIEN_PLAYER_HIT_RADIUS: 20,
  
  // Particle settings
  THRUST_PARTICLE_LIFESPAN: 255,
  THRUST_PARTICLE_DECAY: 5,
  EXPLOSION_PARTICLE_COUNT: 20,
  
  // Performance settings
  MAX_PARTICLES: 500, // New: Limit total particles for performance
  MAX_PROJECTILES: 50, // New: Limit total projectiles
  MAX_ALIENS: 20 // New: Limit total aliens
};

// === GAME STATE ===
let gameState = {
  players: [],
  projectiles: [],
  planets: [],
  aliens: [],
  thrustParticles: [],
  isFullscreen: false
};

// === MAIN GAME FUNCTIONS ===

/**
 * Initialize the game canvas and create initial game objects
 */
function setup() {
  createCanvas(GAME_CONFIG.CANVAS_WIDTH, GAME_CONFIG.CANVAS_HEIGHT);
  angleMode(RADIANS);
  
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
    gameState.planets.push(new Planet(random(width), random(height)));
  }
}

/**
 * Main game loop - updates and renders all game objects
 */
function draw() {
  background(GAME_CONFIG.BACKGROUND_COLOR);
  
  // Process all game entities in order
  updateAndDrawPlanets();
  updateAndDrawPlayers();
  updateAndDrawProjectiles();
  updateAndDrawAliens();
  spawnAliens();
  updateAndDrawParticles();
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
      // Apply damage to player
      player.health -= GAME_CONFIG.COLLISION_DAMAGE_TO_PLAYER;
      createExplosion(player.pos, player.color); // Use player's color for explosion
      gameState.aliens.splice(j, 1);
      
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
  for (let j = gameState.aliens.length - 1; j >= 0; j--) {
    const alien = gameState.aliens[j];
    const distance = dist(projectile.pos.x, projectile.pos.y, alien.pos.x, alien.pos.y);
    
    if (distance < GAME_CONFIG.PROJECTILE_HIT_RADIUS) {
      createExplosion(alien.pos, alien.color); // Use alien's color for explosion
      gameState.aliens.splice(j, 1);
      gameState.projectiles.splice(projectileIndex, 1);
      return true; // Projectile destroyed
    }
  }
  return false; // Projectile still exists
}

/**
 * Handle alien updates, rendering, and collision with planets
 */
function updateAndDrawAliens() {
  for (let i = gameState.aliens.length - 1; i >= 0; i--) {
    const alien = gameState.aliens[i];
    alien.update();
    alien.display();
    
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
      gameState.aliens.splice(alienIndex, 1);
      break;
    }
  }
}

/**
 * Spawn new aliens at regular intervals from screen edges with population limit
 */
function spawnAliens() {
  if (frameCount % GAME_CONFIG.ALIEN_SPAWN_INTERVAL === 0 && 
      gameState.aliens.length < GAME_CONFIG.MAX_ALIENS) {
    const spawnPosition = getRandomEdgePosition();
    const alienType = random(["dumb", "planet", "player"]);
    gameState.aliens.push(new Alien(spawnPosition.x, spawnPosition.y, alienType));
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
  if (!gameState.isFullscreen) {
    fullscreen(true);
    gameState.isFullscreen = true;
  }
  return false; // Prevent default behavior
}

/**
 * Handle canvas resizing when entering/exiting fullscreen
 */
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
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
  }

  /**
   * Update player physics and handle input
   */
  update() {
    this.handleInput();
    this.applyPhysics();
    this.constrainToScreen();
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
   * Apply thrust force in the direction the ship is facing
   */
  applyThrust() {
    const thrustVector = p5.Vector.fromAngle(this.angle).mult(GAME_CONFIG.PLAYER_THRUST_FORCE);
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
    if (currentTime - this.lastShotTime > GAME_CONFIG.PLAYER_SHOT_COOLDOWN) {
      this.shoot();
      this.lastShotTime = currentTime;
    }
  }

  /**
   * Create and fire a projectile from the ship's tip with population limit
   */
  shoot() {
    // Limit total projectiles for performance
    if (gameState.projectiles.length >= GAME_CONFIG.MAX_PROJECTILES) {
      return; // Don't create new projectile if at limit
    }
    
    const tipPosition = this.getTipPosition();
    const projectileVelocity = p5.Vector.fromAngle(this.angle).mult(GAME_CONFIG.PROJECTILE_SPEED);
    gameState.projectiles.push(new Projectile(tipPosition, projectileVelocity));
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
   * Render the player ship and health bar
   */
  display() {
    this.drawShip();
    this.drawHealthBar();
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
    const barWidth = 40;
    const barHeight = 5;
    const barX = this.pos.x - barWidth / 2;
    const barY = this.pos.y - 30;

    push();
    // Background (red)
    fill(255, 0, 0);
    noStroke();
    rect(barX, barY, barWidth, barHeight);
    
    // Health (green)
    fill(0, 255, 0);
    const healthWidth = map(this.health, 0, GAME_CONFIG.PLAYER_MAX_HEALTH, 0, barWidth);
    rect(barX, barY, healthWidth, barHeight);
    pop();
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
  }

  /**
   * Update projectile physics
   */
  update() {
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
   * Render the projectile as a yellow circle
   */
  display() {
    fill(255, 200, 0);
    noStroke();
    ellipse(this.pos.x, this.pos.y, GAME_CONFIG.PROJECTILE_SIZE);
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
    const barWidth = 40;
    const barHeight = 5;
    const barX = this.pos.x - barWidth / 2;
    const barY = this.pos.y - 30;

    fill(0, 255, 0);
    noStroke();
    const healthWidth = map(this.health, 0, GAME_CONFIG.PLANET_MAX_HEALTH, 0, barWidth);
    rect(barX, barY, healthWidth, barHeight);
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
    this.vel = p5.Vector.random2D().mult(GAME_CONFIG.ALIEN_BASE_SPEED);
    this.type = type;
    this.sides = this.getSidesForType(type);
    this.color = this.getColorForType(type);
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
      default: return color(150, 0, 255);        // Purple - random movement
    }
  }

  /**
   * Update alien movement and physics
   */
  update() {
    this.updateMovement();
    this.applyGravity();
    this.updatePosition();
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
      direction.setMag(GAME_CONFIG.ALIEN_TARGET_SPEED);
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
   * Update position based on velocity
   */
  updatePosition() {
    this.pos.add(this.vel);
  }

  /**
   * Render the alien as a colored polygon
   */
  display() {
    push();
    translate(this.pos.x, this.pos.y);
    fill(this.color);
    stroke(255);
    strokeWeight(1);
    
    // Draw polygon based on number of sides
    beginShape();
    for (let i = 0; i < this.sides; i++) {
      const angle = map(i, 0, this.sides, 0, TWO_PI);
      vertex(cos(angle) * GAME_CONFIG.ALIEN_SIZE, sin(angle) * GAME_CONFIG.ALIEN_SIZE);
    }
    endShape(CLOSE);
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

// === LEGACY FUNCTION COMPATIBILITY ===

/**
 * Legacy explosion function for backward compatibility
 * @param {p5.Vector} pos - Position to create explosion
 * @param {p5.Color} explosionColor - Color of explosion particles (optional)
 */
function explode(pos, explosionColor = color(255, 100, 0)) {
  createExplosion(pos, explosionColor);
}