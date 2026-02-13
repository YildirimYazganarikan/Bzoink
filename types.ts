
export type WeaponType = 'blaster' | 'shotgun' | 'machinegun' | 'nuke' | 'sniper';

export interface GameSettings {
  // Player
  playerColor: string;
  playerRadius: number;
  playerSpeed: number;
  playerGlow: number;
  maxHealth: number;
  
  // Weapon
  activeWeapon: WeaponType;

  // Game Modes
  modeDrainingBullets: boolean;
  modeDark: boolean;
  modeStealth: boolean;

  // Enemy
  enemyColor: string;
  enemyRadius: number;
  enemySpeed: number;
  enemySpawnRate: number; // ms
  enemySpawnIncreaseRate: number; // amount to decrease spawn rate by per second or kill
  
  // Projectile
  projectileColor: string;
  projectileRadius: number;
  projectileSpeed: number;
  projectileFireRate: number; // ms
  projectileGlow: number;
  projectileBounces: number; // Max number of bounces

  // Particles
  particleColor: string;
  particleSize: number;
  particleCount: number; // Explosion count (general)
  particleSpeed: number;
  particleLife: number; // seconds
  particleDrag: number; // 0-1, friction
  enemyDeathParticleMultiplier: number; // particles per radius unit
  
  // Visuals
  cursorLineColor: string;
  cursorLineWidth: number;
  cursorLineOpacity: number; // 0-1
  backgroundColor: string;
  bloomStrength: number;
  screenShakeIntensity: number;
  gridDistortion: number; // Multiplier for grid ripple effects
  gridSpacing: number; // Pixel spacing between grid lines

  // Audio
  masterVolume: number; // 0-1

  // Perks & Gameplay
  perkSpawnChance: number; // 0-1 chance per kill
  perkDuration: number; // How long buffs last (ms)
  quoteSpawnInterval: number; // ms
  
  // Nuke Visuals
  nukeBlastRadius: number;
  nukeDistortionStrength: number;
}

export interface Entity {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  color: string;
  type?: string;
  hp?: number;
  maxHp?: number;
  hitShake?: number;
  damage?: number;
  bounces?: number; // Current bounce count for projectiles
  // Stealth specific
  visibility?: number; // 0 to 1
  state?: 'idle' | 'moving' | 'aiming' | 'cooldown';
  stateTimer?: number;
}

export interface Obstacle {
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
}

export interface Particle extends Entity {
  life: number;
  maxLife: number;
  type?: 'default' | 'death';
  formingTargetId?: number; // ID of the forming enemy this particle is being sucked into
}

export type PerkType = 'nuke' | 'shell' | 'time' | 'fire' | 'speed' | 'life' | 'gun_explosive' | 'weapon_shotgun' | 'weapon_machinegun' | 'weapon_blaster' | 'weapon_sniper';

export interface Perk extends Entity {
  type: PerkType;
  life: number;
}

export interface FloatingLetter extends Entity {
  char: string;
  life: number;
}

export interface Shockwave {
  id: number;
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number; // 0 to 1
}

export interface GridNode {
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  vx: number;
  vy: number;
}

export interface Quote {
  text: string;
  author: string;
}
