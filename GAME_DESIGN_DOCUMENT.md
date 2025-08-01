# Space Defenders - Game Design Document (Updated)

## Overview
Space Defenders is a multiplayer space combat game featuring realistic gravitational physics, where players pilot spaceships in a universe with planets that exe### 🤖 **AI System (Enhanced)**

**Population Management**:
- **Alien Limit**: Maximum 20 aliens simultaneously
- **Smart Spawning**: Only spawn when below population limit and based on level
- **Performance**: Prevents entity explosion that could lag the game

**Alien Spawning**:
- **Base Frequency**: Every 120 frames (2 seconds at 60fps)
- **Level Scaling**: Spawn rate increases by 10 frames per level
- **Location**: Random edge of screen
- **Type**: Random selection from ["dumb", "planet", "player"]
- **Speed Variance**: Each alien gets ±30% random speed variation
- **Population Control**: Respects MAX_ALIENS limit

**AI Behaviors**:
1. **Target Seeking**: Find closest target of appropriate type
2. **Movement**: Set velocity toward target (with individual speeds)
3. **Gravity Response**: Affected by planetary forces
4. **Collision**: Damage targets on contact with colored explosions
5. **Level Adaptation**: Speed increases with each level progressionorces on all entities. The game features dynamic colored explosions, performance optimization, and balanced gameplay mechanics.

## Recent Updates & Optimizations

### 🎨 **Visual Enhancements**
- **Colored Explosions**: Explosions now use the color of the destroyed object
  - Blue explosions for destroyed planets
  - Player-colored explosions for damaged players
  - Alien-colored explosions (green/red/purple) for destroyed aliens
  - White particles for thrust effects

### ⚡ **Performance Optimizations**
- **Entity Limits**: Maximum caps on projectiles (50), aliens (20), and particles (500)
- **Projectile Lifetime**: Bullets automatically expire after 300 frames
- **Optimized Gravity**: Uses `magSq()` instead of `mag()` for better performance
- **Smart Cleanup**: Automatic removal of excess entities when limits are reached

### 🎯 **Gameplay Balance**
- **Population Control**: Prevents entity spam that could cause performance issues
- **Improved Physics**: More realistic gravity calculations with configurable falloff
- **Enhanced Feedback**: Visual distinction between different explosion types

## Game Architecture

### Core Game Loop
The game follows an optimized game loop pattern implemented in the `draw()` function:
1. **Render Background** - Clear screen with dark space background
2. **Update & Render Planets** - Process planet health and destruction with colored explosions
3. **Update & Render Players** - Handle player input, physics, and collisions
4. **Update & Render Projectiles** - Move bullets with lifetime management and collision detection
5. **Update & Render Aliens** - Enemy AI movement with population limits
6. **Spawn New Aliens** - Generate enemies with population control
7. **Update & Render Particles** - Visual effects with performance limits

---

## Game Classes and Their Relationships

### 1. **Player Class** 🚀
**Purpose**: Represents controllable spaceships for human players

**Key Properties**:
- `pos` - Current position (p5.Vector)
- `vel` - Current velocity (p5.Vector) 
- `acc` - Current acceleration (p5.Vector)
- `angle` - Ship rotation angle
- `health` - Current health points (0-100)
- `controls` - Key bindings for movement and shooting
- `color` - Visual appearance color
- `lastShotTime` - Cooldown tracking for shooting

**Key Methods**:
- `update()` - Main update loop (input → physics → constraints)
- `handleInput()` - Process keyboard input for movement and shooting
- `applyThrust()` - Add forward acceleration
- `shoot()` - Create projectile from ship tip
- `display()` - Render ship and health bar

**Interactions**:
- **→ Projectile**: Creates projectiles when shooting
- **→ ThrustParticle**: Creates particles when thrusting
- **← Planet**: Affected by gravitational forces
- **← Alien**: Takes damage from collisions

### 2. **Projectile Class** 💥
**Purpose**: Represents bullets fired by players with lifetime management

**Key Properties**:
- `pos` - Current position (p5.Vector)
- `vel` - Current velocity (p5.Vector)
- `age` - Frames since creation (for lifetime management)

**Key Methods**:
- `update()` - Apply gravity and move projectile
- `isExpired()` - Check if projectile should be removed
- `display()` - Render as yellow circle

**Interactions**:
- **← Player**: Created by players when shooting (with population limits)
- **← Planet**: Affected by gravitational forces
- **→ Alien**: Destroys aliens on contact with colored explosion
- **Auto-removal**: Expires after 300 frames or when off-screen

### 3. **Planet Class** 🪐
**Purpose**: Gravitational bodies that affect all entities

**Key Properties**:
- `pos` - Fixed position (p5.Vector)
- `health` - Current health points (0-100)

**Key Methods**:
- `display()` - Render planet and health bar
- `drawPlanet()` - Draw blue circle representation
- `drawHealthBar()` - Show remaining health

**Interactions**:
- **→ ALL ENTITIES**: Applies gravitational force to players, projectiles, and aliens
- **← Alien**: Takes damage from alien collisions
- **→ ThrustParticle**: Creates explosion when destroyed

### **4. Alien Class** 👾
**Purpose**: Enemy entities with different AI behaviors, random speeds, and level scaling

**Key Properties**:
- `pos` - Current position (p5.Vector)
- `vel` - Current velocity (p5.Vector) with random variance
- `type` - Behavior type ("dumb", "planet", "player")
- `sides` - Number of polygon sides (visual indicator)
- `color` - Type-specific color
- `targetSpeed` - Individual seeking speed (with variance and level scaling)

**Alien Types**:
- **"dumb"** (Purple, 6 sides): Random movement
- **"planet"** (Green, 5 sides): Seeks and attacks planets
- **"player"** (Red, 4 sides): Seeks and attacks players

**Speed System**:
- **Base Speed**: Configured value with ±30% random variance
- **Level Scaling**: 20% speed increase per level
- **Individual Variation**: Each alien has unique movement characteristics

**Key Methods**:
- `update()` - AI movement + gravity + position update
- `seekTarget()` - Move toward closest target using individual speed
- `display()` - Render as colored polygon

**Interactions**:
- **← Planet**: Affected by gravitational forces AND damages planets
- **→ Player**: Damages players on collision
- **← Projectile**: Destroyed by player projectiles (increments kill counter)
- **→ ThrustParticle**: Creates explosion when destroyed
- **→ Level System**: Killing aliens advances game level

### 5. **ThrustParticle Class** ✨
**Purpose**: Enhanced visual effects for thrust, explosions, and impacts with custom colors

**Key Properties**:
- `pos` - Current position (p5.Vector)
- `vel` - Current velocity (p5.Vector)
- `lifespan` - Remaining display time (255 → 0)
- `color` - Particle color (p5.Color)

**Key Methods**:
- `update()` - Move particle and reduce lifespan
- `display()` - Render with fading alpha and custom color

**Color System**:
- **White**: Thrust particles from player ships
- **Blue**: Planet destruction explosions
- **Player Colors**: Player damage/destruction explosions  
- **Alien Colors**: Alien destruction explosions (green/red/purple)

**Interactions**:
- **← Player**: Created during thrust (white) and damage (player color)
- **← Explosions**: Created when entities are destroyed (entity color)
- **→ NONE**: Pure visual effect, no gameplay impact
- **Performance**: Limited to 500 particles maximum

---

## Game Systems

### 🌍 **Physics System (Optimized)**
**Core Function**: `applyPlanetaryGravity(pos, vel)`

**Performance Improvements**:
- Uses `magSq()` instead of `mag()` for distance calculations (faster)
- Optimized force calculations with configurable falloff factor
- Early exit for objects within minimum gravity distance

**Gravitational Mechanics**:
1. **Attraction Phase**: Objects far from planets experience attractive force
   - Force strength = `GRAVITY_STRENGTH / (distanceSquared × distance × GRAVITY_FALLOFF_FACTOR)`
   - More realistic physics with better performance

2. **Safe Zone**: Objects too close to planet surface experience repulsive force
   - Prevents entities from penetrating planets
   - Creates realistic orbital mechanics
   - Safe distance = planet radius + buffer zone

3. **Affected Entities**: 
   - Players (through acceleration)
   - Projectiles (through velocity)
   - Aliens (through velocity)

### ⚔️ **Combat System**

**Player vs Alien Combat**:
- **Detection**: Distance-based collision detection
- **Damage**: 10 health points per collision
- **Effects**: Explosion particles, alien destruction
- **Player Death**: Removed from game when health ≤ 0

**Projectile vs Alien Combat**:
- **Detection**: 15-pixel hit radius
- **Effects**: Instant alien destruction, explosion particles
- **Projectile**: Destroyed on impact

**Alien vs Planet Combat**:
- **Detection**: 30-pixel hit radius  
- **Damage**: 1 health point per collision
- **Effects**: Explosion particles, alien destruction
- **Planet Death**: Removed when health ≤ 0

### 🎮 **Input System**

**Player 1 Controls**:
- Arrow Keys: Rotation and thrust
- Control: Shoot

**Player 2 Controls**:
- WASD: Movement (A/D rotate, W thrust)
- Space: Shoot

**Global Controls**:
- Mouse Click: Toggle fullscreen mode

### 🎮 **Level Progression System**
- **Advancement**: Kill 10 aliens to advance to next level
- **Speed Scaling**: Each level increases alien speed by 20%
- **Spawn Rate**: Aliens spawn 10 frames faster each level (minimum 0.5 seconds)
- **Visual Feedback**: Yellow particle burst when leveling up
- **UI Display**: Shows current level, kill progress, and spawn rate

### 📊 **Alien Variability System**
- **Random Speed**: Each alien gets ±30% speed variation
- **Individual Stats**: Each alien has unique movement and target speeds
- **Level Scaling**: All speeds scale with current level
- **Balanced Difficulty**: Maintains challenge while keeping variety

**Population Management**:
- **Alien Limit**: Maximum 20 aliens simultaneously
- **Smart Spawning**: Only spawn when below population limit
- **Performance**: Prevents entity explosion that could lag the game

**Alien Spawning**:
- **Frequency**: Every 120 frames (2 seconds at 60fps)
- **Location**: Random edge of screen
- **Type**: Random selection from ["dumb", "planet", "player"]
- **Population Control**: Respects MAX_ALIENS limit

**AI Behaviors**:
1. **Target Seeking**: Find closest target of appropriate type
2. **Movement**: Set velocity toward target
3. **Gravity Response**: Affected by planetary forces
4. **Collision**: Damage targets on contact with colored explosions

### 💥 **Effects System (Enhanced)**

**Colored Explosion System**:
- **Trigger**: Entity destruction or collision
- **Color Logic**: 
  - Planets: Blue explosions
  - Players: Use player's unique color
  - Aliens: Type-specific colors (green/red/purple)
- **Particles**: 20 ThrustParticles with random velocities and entity color
- **Visual**: Colored particles that fade over time

**Thrust Effects**:
- **Trigger**: Player thrust input
- **Location**: Back of ship
- **Direction**: Opposite to ship facing
- **Visual**: Continuous white particle stream
- **Performance**: Contributes to particle limit

**Performance Management**:
- **Particle Limit**: Maximum 500 particles total
- **Auto-cleanup**: Excess particles removed automatically
- **Memory Efficient**: No particle memory leaks

---

## Data Flow Diagram

```
GAME_CONFIG (Constants)
    ↓
gameState (Global State + Level Progression)
    ├── players[]
    ├── projectiles[]  
    ├── planets[]
    ├── aliens[] (with individual speeds)
    ├── thrustParticles[]
    ├── level (current game level)
    ├── aliensKilled (progress toward next level)
    └── totalAliensKilled (total score)
    
Input Events → Players → Projectiles
                ↓           ↓
            ThrustParticles  ↓
                           Aliens (collision → kill counter → level up)
                             ↓
                        ThrustParticles (colored explosions)
                             
Planets → Gravity → ALL ENTITIES

Level System → Alien Speed/Spawn Rate → Dynamic Difficulty
```

## Collision Matrix

| Entity | Player | Projectile | Planet | Alien | ThrustParticle |
|--------|--------|------------|--------|-------|----------------|
| **Player** | ❌ | ❌ | Gravity | Damage | ❌ |
| **Projectile** | ❌ | ❌ | Gravity | Destroy | ❌ |
| **Planet** | Gravity | Gravity | ❌ | Damage | ❌ |
| **Alien** | Damage | Destroyed | Damage | ❌ | ❌ |
| **ThrustParticle** | ❌ | ❌ | ❌ | ❌ | ❌ |

## Configuration System (Enhanced)

All game balance is controlled through the enhanced `GAME_CONFIG` object:

### **Physics Tuning**:
- `GRAVITY_STRENGTH`: Overall gravitational force
- `MIN_GRAVITY_DISTANCE`: Minimum effective gravity range
- `PLANET_SURFACE_BUFFER`: Safe zone around planets
- `GRAVITY_FALLOFF_FACTOR`: Controls gravity strength at distance

### **Performance Settings**:
- `MAX_PARTICLES`: Particle limit (500) for smooth performance
- `MAX_PROJECTILES`: Projectile limit (50) to prevent spam
- `MAX_ALIENS`: Alien population limit (20) for balanced gameplay
- `PROJECTILE_LIFETIME`: Auto-expire bullets after 300 frames

### **Level Progression Settings**:
- `ALIENS_PER_LEVEL`: Aliens to kill to advance (10)
- `LEVEL_SPEED_MULTIPLIER`: Speed increase per level (20%)
- `LEVEL_SPAWN_REDUCTION`: Spawn rate increase per level (10 frames)
- `ALIEN_SPEED_VARIANCE`: Random speed variation (±30%)

### **Gameplay Balance**:
- `PLAYER_SHOT_COOLDOWN`: Rate of fire limitation
- `ALIEN_SPAWN_INTERVAL`: Base enemy spawn frequency
- `MAX_VELOCITY`: Speed limitation for all entities

### **Visual Settings**:
- Particle lifespans and decay rates
- Entity sizes and colors
- Health bar dimensions
- Explosion particle counts

---

## Game States and Transitions

### **Initialization** (`setup()`)
1. Create canvas
2. Initialize 2 players with different controls
3. Create 3 random planets
4. Set angle mode to radians

### **Running** (`draw()`)
- Continuous update/render loop
- Real-time collision detection
- Dynamic entity creation/destruction

### **Fullscreen Toggle**
- Mouse click switches to fullscreen
- Canvas resizes to window dimensions
- Game continues without interruption

---

## Performance Considerations (Updated)

### **Optimization Techniques**:
1. **Reverse Iteration**: Loop backwards through arrays for safe removal
2. **Distance Optimization**: Use `magSq()` instead of `mag()` for performance
3. **Early Exit**: Break loops when entities are destroyed
4. **Smart Limits**: Population caps prevent performance degradation
5. **Particle Management**: Automatic cleanup of excess particles
6. **Projectile Lifecycle**: Automatic expiration prevents infinite accumulation

### **Memory Management**:
- **Entity Limits**: Hard caps on all dynamic entities
- **Automatic Cleanup**: Remove off-screen and expired entities
- **Particle Lifespan**: Finite lifespan for all visual effects
- **Smart Arrays**: Trim arrays when they exceed limits
- **No Memory Leaks**: Proper cleanup in all game loops

### **Performance Metrics**:
- **Target**: 60 FPS with hundreds of entities
- **Scalability**: Graceful degradation under load
- **Memory**: Stable memory usage over time
- **Responsiveness**: Consistent input response

---

## Extensibility (Enhanced)

The optimized modular design makes it easy to:
- **Add new alien types**: Extend the Alien class with new behaviors and colors
- **Create new weapons**: Add projectile variants with different properties
- **Implement power-ups**: New entity classes with special effects  
- **Add game modes**: Modify win conditions and spawning rules
- **Enhance graphics**: Replace simple shapes with sprites and animations
- **Add sound**: Integrate audio for actions and collisions
- **Performance Scaling**: Adjust limits based on device capabilities
- **Visual Themes**: Easy color scheme changes for different environments

The enhanced configuration system allows rapid prototyping and balance adjustments without code changes, while the performance limits ensure the game remains playable even with extensive modifications.

## Code Quality Improvements

### **Recent Refactoring**:
- **Consistent Naming**: All functions and variables use clear, descriptive names
- **Enhanced Documentation**: Comprehensive JSDoc comments for all methods
- **Performance Focus**: Optimized algorithms throughout the codebase
- **Visual Polish**: Colored explosions add visual clarity and feedback
- **Maintainability**: Modular design makes adding features straightforward

### **Best Practices Implemented**:
- **Single Responsibility**: Each function has one clear purpose
- **DRY Principle**: No code duplication
- **Performance First**: Optimizations throughout without sacrificing readability
- **Configurable**: All game balance through configuration constants
- **Extensible**: Easy to add new features without breaking existing code
