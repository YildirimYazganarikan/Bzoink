
import { GameSettings, Quote } from './types';

export const DEFAULT_SETTINGS: GameSettings = {
  // Player
  playerColor: "#ffffff",
  playerRadius: 15,
  playerSpeed: 450,
  playerGlow: 20,
  maxHealth: 100,
  
  // Weapon
  activeWeapon: "blaster",

  // Game Modes
  modeDrainingBullets: false,
  modeDark: false,
  modeStealth: false,

  // Enemy
  enemyColor: "#a855f7",
  enemyRadius: 9,
  enemySpeed: 172,
  enemySpawnRate: 1000,
  enemySpawnIncreaseRate: 10,

  // Projectile
  projectileColor: "#ffffff",
  projectileRadius: 4,
  projectileSpeed: 1412,
  projectileFireRate: 150,
  projectileGlow: 10,
  projectileBounces: 0,

  // Particles
  particleColor: "#ef4444",
  particleSize: 2,
  particleCount: 12,
  particleSpeed: 400,
  particleLife: 30,
  particleDrag: 0.95,
  enemyDeathParticleMultiplier: 1,

  // Visuals
  cursorLineColor: "#ffffff",
  cursorLineWidth: 1,
  cursorLineOpacity: 0.1,
  backgroundColor: "#09090b",
  bloomStrength: 0,
  screenShakeIntensity: 50,
  gridDistortion: 0.016,
  gridSpacing: 20,

  // Audio
  masterVolume: 0.5,

  // Perks & Gameplay
  perkSpawnChance: 0.25,
  perkDuration: 5000,
  quoteSpawnInterval: 45000,
  
  // Nuke
  nukeBlastRadius: 400,
  nukeDistortionStrength: 0.1,
};

export const QUOTES: Quote[] = [
  { text: "Imagination is more important than knowledge.", author: "Albert Einstein" },
  { text: "I think therefore I am.", author: "René Descartes" },
  { text: "Be water my friend.", author: "Bruce Lee" },
  { text: "Knowledge is power.", author: "Francis Bacon" },
  { text: "This too shall pass.", author: "Persian Adage" },
  { text: "Carpe Diem.", author: "Horace" },
  { text: "The unexamined life is not worth living.", author: "Socrates" },
  { text: "I know that I know nothing.", author: "Socrates" },
  { text: "Hell is other people.", author: "Jean-Paul Sartre" },
  { text: "God is dead.", author: "Friedrich Nietzsche" },
  { text: "Almost everything you do will be insignificant, but it is very important that you do it.", author: "Mahatma Gandhi" }
];
