// === Space Defenders Game ===

let players = [];
let projectiles = [];
let planets = [];
let aliens = [];
let thrustParticles = [];
let isFullscreen = false;

function setup() {
  createCanvas(800, 600);
  angleMode(RADIANS);
  players.push(new Player(width * 0.25, height / 2, LEFT_ARROW, RIGHT_ARROW, UP_ARROW, DOWN_ARROW));
  players.push(new Player(width * 0.75, height / 2, 65, 68, 87, 32)); // A, D, W, SPACE
  for (let i = 0; i < 3; i++) {
    planets.push(new Planet(random(width), random(height)));
  }
}

function draw() {
  background(10);

  // Update and draw planets
  for (let i = planets.length - 1; i >= 0; i--) {
    planets[i].display();
    if (planets[i].health <= 0) {
      explode(planets[i].pos);
      planets.splice(i, 1);
    }
  }

  // Update and draw players
  for (let i = players.length - 1; i >= 0; i--) {
    players[i].update();
    players[i].display();
    for (let j = aliens.length - 1; j >= 0; j--) {
      if (dist(players[i].pos.x, players[i].pos.y, aliens[j].pos.x, aliens[j].pos.y) < 20) {
        // Increased damage from alien collision
        players[i].health -= 10;
        explode(players[i].pos);
        aliens.splice(j, 1);
        if (players[i].health <= 0) {
          players.splice(i, 1);
          break;
        }
      }
    }
  }

  // Update and draw projectiles
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    for (let j = aliens.length - 1; j >= 0; j--) {
      if (dist(p.pos.x, p.pos.y, aliens[j].pos.x, aliens[j].pos.y) < 15) {
        explode(aliens[j].pos);
        aliens.splice(j, 1);
        projectiles.splice(i, 1);
        break;
      }
    }
    if (p && (p.pos.x < 0 || p.pos.x > width || p.pos.y < 0 || p.pos.y > height)) {
      projectiles.splice(i, 1);
    } else if (p) {
      p.update();
      p.display();
    }
  }

  // Update and draw aliens
  for (let i = aliens.length - 1; i >= 0; i--) {
    aliens[i].update();
    aliens[i].display();
    for (let j = planets.length - 1; j >= 0; j--) {
      if (dist(aliens[i].pos.x, aliens[i].pos.y, planets[j].pos.x, planets[j].pos.y) < 30) {
        planets[j].health -= 1;
        explode(aliens[i].pos);
        aliens.splice(i, 1);
        break;
      }
    }
  }

  // Spawn aliens
  if (frameCount % 120 === 0) {
    let edge = floor(random(4));
    let pos;
    if (edge === 0) pos = createVector(random(width), 0);
    else if (edge === 1) pos = createVector(width, random(height));
    else if (edge === 2) pos = createVector(random(width), height);
    else pos = createVector(0, random(height));

    let type = random(["dumb", "planet", "player"]);
    aliens.push(new Alien(pos.x, pos.y, type));
  }

  // Thrust particles
  for (let i = thrustParticles.length - 1; i >= 0; i--) {
    thrustParticles[i].update();
    thrustParticles[i].display();
    if (thrustParticles[i].lifespan <= 0) {
      thrustParticles.splice(i, 1);
    }
  }
}

// Add a mousePressed function to handle fullscreen toggle
function mousePressed() {
  if (!isFullscreen) {
    fullscreen(true);
    isFullscreen = true;
  }
  return false; // Prevent default behavior
}

// Handle fullscreen change events
function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

class Player {
  constructor(x, y, lKey, rKey, tKey, sKey) {
    this.pos = createVector(x, y);
    this.vel = createVector();
    this.acc = createVector();
    this.angle = -HALF_PI;
    this.lKey = lKey;
    this.rKey = rKey;
    this.tKey = tKey;
    this.sKey = sKey;
    this.health = 100;
    this.col = color(random(100, 255), random(100, 255), random(100, 255));
    this.lastShot = 0;
  }

  update() {
    if (keyIsDown(this.lKey)) this.angle -= 0.05;
    if (keyIsDown(this.rKey)) this.angle += 0.05;
    if (keyIsDown(this.tKey)) {
      let force = p5.Vector.fromAngle(this.angle).mult(0.1);
      this.acc.add(force);
      
      // Get the position at the back of the ship for thrust particles
      let backPos = this.pos.copy();
      let backOffset = p5.Vector.fromAngle(this.angle + PI).mult(10);
      backPos.add(backOffset);
      
      // Create thrust particles from the back of the ship
      thrustParticles.push(new ThrustParticle(backPos, p5.Vector.fromAngle(this.angle + PI).mult(random(1, 2))));
    }
    if (keyIsDown(this.sKey) && millis() - this.lastShot > 600) {
      // Calculate the position at the tip of the ship
      let tipPos = this.pos.copy();
      let tipOffset = p5.Vector.fromAngle(this.angle).mult(15);
      tipPos.add(tipOffset);
      
      // Create projectile from the tip of the ship
      let pVel = p5.Vector.fromAngle(this.angle).mult(4);
      projectiles.push(new Projectile(tipPos, pVel));
      this.lastShot = millis();
    }

    for (let planet of planets) {
      let force = p5.Vector.sub(planet.pos, this.pos);
      let d = force.mag();
      if (d > 5) {
        let strength = 20 / (d * d);
        force.setMag(strength);
        this.acc.add(force);
      }
    }

    this.vel.add(this.acc);
    this.vel.limit(3);
    this.pos.add(this.vel);
    this.acc.mult(0);

    this.pos.x = constrain(this.pos.x, 0, width);
    this.pos.y = constrain(this.pos.y, 0, height);
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    fill(this.col);
    stroke(255);
    strokeWeight(1);
    beginShape();
    vertex(15, 0);
    vertex(-10, 7);
    vertex(-10, -7);
    endShape(CLOSE);
    pop();

    // Health bar
    push();
    fill(255, 0, 0);
    rect(this.pos.x - 20, this.pos.y - 30, 40, 5);
    fill(0, 255, 0);
    rect(this.pos.x - 20, this.pos.y - 30, map(this.health, 0, 100, 0, 40), 5);
    pop();
  }
}

class Projectile {
  constructor(pos, vel) {
    this.pos = pos;
    this.vel = vel;
  }

  update() {
    for (let planet of planets) {
      let force = p5.Vector.sub(planet.pos, this.pos);
      let d = force.mag();
      if (d > 5) {
        let strength = 20 / (d * d);
        force.setMag(strength);
        this.vel.add(force);
      }
    }
    this.pos.add(this.vel);
  }

  display() {
    fill(255, 200, 0);
    noStroke();
    ellipse(this.pos.x, this.pos.y, 6);
  }
}

class Planet {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.health = 100;
  }

  display() {
    fill(100, 150, 255);
    stroke(255);
    ellipse(this.pos.x, this.pos.y, 40);
    fill(0, 255, 0);
    rect(this.pos.x - 20, this.pos.y - 30, map(this.health, 0, 100, 40, 0), 5);
  }
}

class Alien {
  constructor(x, y, type) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(0.5);
    this.type = type;
    this.sides = type === "planet" ? 5 : type === "player" ? 4 : 6;
  }

  update() {
    // Type-specific movement
    if (this.type === "planet" && planets.length > 0) {
      let target = planets.reduce((a, b) => p5.Vector.dist(this.pos, a.pos) < p5.Vector.dist(this.pos, b.pos) ? a : b);
      let dir = p5.Vector.sub(target.pos, this.pos).setMag(0.3);
      this.vel = dir;
    } else if (this.type === "player" && players.length > 0) {
      let target = players.reduce((a, b) => p5.Vector.dist(this.pos, a.pos) < p5.Vector.dist(this.pos, b.pos) ? a : b);
      let dir = p5.Vector.sub(target.pos, this.pos).setMag(0.3);
      this.vel = dir;
    }
    // Apply gravity from planets, similar to players
    for (let planet of planets) {
      let force = p5.Vector.sub(planet.pos, this.pos);
      let d = force.mag();
      if (d > 5) {
        let strength = 20 / (d * d);
        force.setMag(strength);
        this.vel.add(force);
      }
    }
    // Update position
    this.pos.add(this.vel);
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    // Color based on alien type
    let col;
    if (this.type === 'planet') col = color(0, 255, 100);
    else if (this.type === 'player') col = color(255, 50, 50);
    else col = color(150, 0, 255);
    fill(col);
    stroke(255);
    strokeWeight(1);
    beginShape();
    for (let i = 0; i < this.sides; i++) {
      let angle = map(i, 0, this.sides, 0, TWO_PI);
      vertex(cos(angle) * 15, sin(angle) * 15);
    }
    endShape(CLOSE);
    pop();
  }
}

class ThrustParticle {
  constructor(pos, vel) {
    this.pos = pos;
    this.vel = vel;
    this.lifespan = 255;
  }

  update() {
    this.pos.add(this.vel);
    this.lifespan -= 5;
  }

  display() {
    noStroke();
    fill(255, this.lifespan);
    ellipse(this.pos.x, this.pos.y, 4);
  }
}

function explode(pos, col = color(255, 100, 0)) {
  for (let i = 0; i < 20; i++) {
    thrustParticles.push(new ThrustParticle(pos.copy(), p5.Vector.random2D().mult(random(1, 3))));
  }
}