
import React, { useRef, useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { GameSettings, Particle, Entity, Perk, FloatingLetter, PerkType, Shockwave, Obstacle, GridNode } from '../types';
import { QUOTES } from '../constants';
import { playShootSound, playExplosionSound, playHitSound, playPowerupSound, setMasterVolume, initAudio } from '../utils/audio';

interface GameCanvasProps {
    settings: GameSettings;
    isPaused: boolean;
    onTogglePause: () => void;
    onUpdateStats: (health: number, score: number, kills: number) => void;
    onGameOver: (stats: { wisdom: number; kills: number; timeSurvived: number }) => void;
}

export interface GameCanvasHandle {
    clearEnemies: () => void;
}

interface FormingEnemy {
    id: number;
    x: number;
    y: number;
    startTime: number;
    totalParticles: number;
    radiusTarget: number;
}

const GameCanvas = forwardRef<GameCanvasHandle, GameCanvasProps>(({ settings, isPaused, onTogglePause, onUpdateStats, onGameOver }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Game State Refs
    const playerRef = useRef({ x: 0, y: 0, health: settings.maxHealth, energy: 100, visibility: 1.0 });
    const enemiesRef = useRef<Entity[]>([]);
    const projectilesRef = useRef<Entity[]>([]);
    const particlesRef = useRef<Particle[]>([]);
    const perksRef = useRef<Perk[]>([]);
    const lettersRef = useRef<FloatingLetter[]>([]);
    const shockwavesRef = useRef<Shockwave[]>([]);
    const obstaclesRef = useRef<Obstacle[]>([]);

    // Aggregation State
    const formingEnemiesRef = useRef<FormingEnemy[]>([]);
    const lastAggregationTimeRef = useRef(0);
    const formingIdCounter = useRef(0);

    // Grid System
    const gridRef = useRef<GridNode[]>([]);
    const gridColsRef = useRef(0);
    const gridRowsRef = useRef(0);

    // Death State
    const deathStateRef = useRef({
        active: false,
        gatherStartTime: 0,
        respawnX: 0,
        respawnY: 0
    });

    const scoreRef = useRef(0);
    const killsRef = useRef(0);
    const sessionStartRef = useRef(Date.now());
    const startTimeRef = useRef(Date.now());

    // Buffs state
    const buffsRef = useRef({
        shell: false,
        fireRate: false,
        speed: false,
        timeSlow: false,
        explosiveAmmo: false,
        fireRateUntil: 0,
        speedUntil: 0,
        timeSlowUntil: 0,
        explosiveAmmoUntil: 0
    });

    const keysRef = useRef<{ [key: string]: boolean }>({});
    const mouseRef = useRef({ x: 0, y: 0, down: false, lastX: 0, lastY: 0, velocity: 0 });
    const lastTimeRef = useRef<number>(0);
    const lastShotTimeRef = useRef<number>(0);
    const lastSpawnTimeRef = useRef<number>(0);
    const lastQuoteSpawnTimeRef = useRef<number>(0);
    const currentSpawnRateRef = useRef<number>(settings.enemySpawnRate);

    // Visual Effects State
    const shakeRef = useRef(0);

    // Internal ID counters
    const projectileIdCounter = useRef(0);
    const enemyIdCounter = useRef(0);
    const particleIdCounter = useRef(0);
    const perkIdCounter = useRef(0);
    const letterIdCounter = useRef(0);
    const shockwaveIdCounter = useRef(0);
    const obstacleIdCounter = useRef(0);

    // Stats Throttling
    const lastStatsUpdateRef = useRef(0);

    // --- AUDIO INIT ---
    useEffect(() => {
        setMasterVolume(settings.masterVolume);
    }, [settings.masterVolume]);

    useEffect(() => {
        const startAudio = () => initAudio();
        window.addEventListener('click', startAudio);
        window.addEventListener('keydown', startAudio);
        return () => {
            window.removeEventListener('click', startAudio);
            window.removeEventListener('keydown', startAudio);
        };
    }, []);

    // --- MAP & GRID GENERATION ---
    const initGrid = () => {
        if (!canvasRef.current) return;
        const width = canvasRef.current.width;
        const height = canvasRef.current.height;
        const spacing = settings.gridSpacing || 50;

        const cols = Math.ceil(width / spacing) + 2;
        const rows = Math.ceil(height / spacing) + 2;

        gridColsRef.current = cols;
        gridRowsRef.current = rows;

        const newGrid: GridNode[] = [];

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                // Offset slightly to center the grid or ensure coverage
                const x = (c - 1) * spacing;
                const y = (r - 1) * spacing;
                newGrid.push({
                    x, y,
                    baseX: x,
                    baseY: y,
                    vx: 0,
                    vy: 0
                });
            }
        }
        gridRef.current = newGrid;
    };

    const generateObstacles = () => {
        if (!canvasRef.current) return;
        obstaclesRef.current = [];
        if (settings.modeStealth) {
            const count = 15;
            for (let i = 0; i < count; i++) {
                const w = Math.random() * 100 + 50;
                const h = Math.random() * 100 + 50;
                const x = Math.random() * (canvasRef.current.width - w);
                const y = Math.random() * (canvasRef.current.height - h);

                // Don't spawn on player
                const dx = x + w / 2 - playerRef.current.x;
                const dy = y + h / 2 - playerRef.current.y;
                if (Math.sqrt(dx * dx + dy * dy) < 300) continue;

                obstaclesRef.current.push({
                    id: obstacleIdCounter.current++,
                    x, y, width: w, height: h, color: '#333333'
                });
            }
        }
    };

    useEffect(() => {
        // Regenerate map if mode changes
        generateObstacles();
        enemiesRef.current = []; // Clear enemies on mode switch
    }, [settings.modeStealth]);

    useEffect(() => {
        // Only update spawn rate from settings if we are not deep into a run
        if (!deathStateRef.current.active) {
            currentSpawnRateRef.current = Math.min(currentSpawnRateRef.current, settings.enemySpawnRate);
        }
    }, [settings.enemySpawnRate]);

    useEffect(() => {
        if (!deathStateRef.current.active) {
            playerRef.current.health = Math.min(playerRef.current.health, settings.maxHealth);
        }
    }, [settings.maxHealth]);

    const handleResize = useCallback(() => {
        if (canvasRef.current) {
            canvasRef.current.width = window.innerWidth;
            canvasRef.current.height = window.innerHeight;
            if (playerRef.current.x === 0 && playerRef.current.y === 0) {
                playerRef.current.x = window.innerWidth / 2;
                playerRef.current.y = window.innerHeight / 2;
            }
            generateObstacles();
            initGrid();
        }
    }, [settings.modeStealth, settings.gridSpacing]); // Re-init grid when spacing changes

    useEffect(() => {
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, [handleResize]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key.toLowerCase() === 'p') onTogglePause();
            keysRef.current[e.key.toLowerCase()] = true;
            if (e.shiftKey) keysRef.current['shift'] = true;
        };
        const handleKeyUp = (e: KeyboardEvent) => {
            keysRef.current[e.key.toLowerCase()] = false;
            if (!e.shiftKey) keysRef.current['shift'] = false;
        };
        const handleMouseMove = (e: MouseEvent) => {
            const dist = Math.sqrt(Math.pow(e.clientX - mouseRef.current.lastX, 2) + Math.pow(e.clientY - mouseRef.current.lastY, 2));
            mouseRef.current.velocity = dist;
            mouseRef.current.lastX = e.clientX;
            mouseRef.current.lastY = e.clientY;
            mouseRef.current.x = e.clientX;
            mouseRef.current.y = e.clientY;
        };
        const handleMouseDown = () => { mouseRef.current.down = true; };
        const handleMouseUp = () => { mouseRef.current.down = false; };

        window.addEventListener('keydown', handleKeyDown);
        window.addEventListener('keyup', handleKeyUp);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mouseup', handleMouseUp);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [onTogglePause]);

    // --- GAME LOGIC FUNCTIONS ---

    const createExplosion = (x: number, y: number, impactVx: number, impactVy: number, countOverride?: number, colorOverride?: string) => {
        const impactSpeed = Math.sqrt(impactVx * impactVx + impactVy * impactVy);
        const nVx = impactVx / (impactSpeed || 1);
        const nVy = impactVy / (impactSpeed || 1);

        const count = countOverride || settings.particleCount;

        // 1. Spawn New Particles
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * settings.particleSpeed;
            const pVx = Math.cos(angle) * speed + (nVx * settings.particleSpeed * 0.5);
            const pVy = Math.sin(angle) * speed + (nVy * settings.particleSpeed * 0.5);

            particlesRef.current.push({
                id: particleIdCounter.current++,
                x,
                y,
                vx: pVx,
                vy: pVy,
                life: settings.particleLife,
                maxLife: settings.particleLife,
                radius: settings.particleSize,
                color: colorOverride || settings.particleColor,
                type: 'default'
            });
        }

        // 2. Affect Existing Particles (Shockwave Effect)
        const explosionForce = 800; // Force strength
        const explosionRadius = 300;

        particlesRef.current.forEach(p => {
            // Skip the just created ones (optimization: check life approx maxLife? or just accept self-push which is fine)
            const dx = p.x - x;
            const dy = p.y - y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < explosionRadius * explosionRadius && dist2 > 1) {
                const dist = Math.sqrt(dist2);
                const force = (explosionForce * (1 - dist / explosionRadius)) / dist; // linear falloff

                // Add randomness to scatter them nicely
                p.vx += dx * force + (Math.random() - 0.5) * 50;
                p.vy += dy * force + (Math.random() - 0.5) * 50;
            }
        });

        // 3. Affect Grid (Ripples) - Significantly Increased
        // Refined constant for smoother visuals given the 0.1 max request
        const gridForce = 15000 * settings.gridDistortion;
        const gridRadius = 500;
        gridRef.current.forEach(node => {
            const dx = node.x - x;
            const dy = node.y - y;
            const dist2 = dx * dx + dy * dy;
            if (dist2 < gridRadius * gridRadius) {
                const dist = Math.sqrt(dist2);
                const force = gridForce * (1 - dist / gridRadius);
                const angle = Math.atan2(dy, dx);
                node.vx += Math.cos(angle) * force;
                node.vy += Math.sin(angle) * force;
            }
        });
    };

    const spawnPerk = (x: number, y: number) => {
        const baseTypes: PerkType[] = ['nuke', 'shell', 'time', 'fire', 'speed', 'life', 'gun_explosive'];

        let weaponTypes: PerkType[] = [];
        if (settings.modeStealth) {
            // Only sniper available in stealth mode
            weaponTypes = ['weapon_sniper'];
        } else {
            // Sniper NOT available in normal mode
            weaponTypes = ['weapon_shotgun', 'weapon_machinegun', 'weapon_blaster'];
        }

        // 40% chance for a weapon, 60% chance for a buff
        const isWeapon = Math.random() < 0.4;
        const types = isWeapon ? weaponTypes : baseTypes;

        const type = types[Math.floor(Math.random() * types.length)];

        perksRef.current.push({
            id: perkIdCounter.current++,
            x, y, vx: 0, vy: 0, radius: 10, color: isWeapon ? '#ff00ff' : '#ffff00',
            type,
            life: 10
        });
    };

    const activatePerk = (type: PerkType, timestamp: number) => {
        playPowerupSound();

        if (type.startsWith('weapon_')) {
            // Set local weapon logic via refs since we can't easily mutate parent state from here
            // We rely on spawnProjectile checking localActiveWeaponRef
        }

        switch (type) {
            case 'nuke':
                shockwavesRef.current.push({
                    id: shockwaveIdCounter.current++,
                    x: playerRef.current.x,
                    y: playerRef.current.y,
                    radius: 10,
                    maxRadius: settings.nukeBlastRadius,
                    life: 1.0
                });
                playShootSound('nuke'); // Trigger rumble

                // Trigger grid ripple for nuke
                createExplosion(playerRef.current.x, playerRef.current.y, 0, 0, 0);

                enemiesRef.current = enemiesRef.current.filter(e => {
                    const dist = Math.sqrt(Math.pow(playerRef.current.x - e.x, 2) + Math.pow(playerRef.current.y - e.y, 2));
                    if (dist < settings.nukeBlastRadius) {
                        // Award score for nuke kills
                        const points = getEnemyKillScore(e);
                        scoreRef.current += points;
                        killsRef.current += 1;
                        createExplosion(e.x, e.y, (e.x - playerRef.current.x) * 2, (e.y - playerRef.current.y) * 2, e.radius * settings.enemyDeathParticleMultiplier, '#ef4444');
                        return false;
                    }
                    return true;
                });
                shakeRef.current = settings.screenShakeIntensity * 3;
                break;
            case 'shell':
                buffsRef.current.shell = true;
                setTimeout(() => buffsRef.current.shell = false, settings.perkDuration);
                break;
            case 'time':
                buffsRef.current.timeSlowUntil = timestamp + settings.perkDuration;
                break;
            case 'fire':
                buffsRef.current.fireRateUntil = timestamp + settings.perkDuration;
                break;
            case 'speed':
                buffsRef.current.speedUntil = timestamp + settings.perkDuration;
                break;
            case 'life':
                playerRef.current.health = Math.min(playerRef.current.health + 5, settings.maxHealth);
                break;
            case 'gun_explosive':
                buffsRef.current.explosiveAmmoUntil = timestamp + settings.perkDuration;
                break;
        }
    };

    const localActiveWeaponRef = useRef<string | null>(null);

    // Sync local weapon with settings initially or when settings change
    useEffect(() => {
        localActiveWeaponRef.current = settings.activeWeapon;
    }, [settings.activeWeapon]);

    const getEnemyKillScore = (enemy: Entity): number => {
        switch (enemy.type) {
            case 'level1': return 1;
            case 'level2': return 3;
            case 'aggregate': return Math.ceil(enemy.radius / 10);
            case 'stealth_sniper': return 2;
            default: return 1;
        }
    };

    const killEnemy = (index: number, vx: number, vy: number) => {
        const enemy = enemiesRef.current[index];
        if (!enemy) return;

        // Award score and kills
        const points = getEnemyKillScore(enemy);
        scoreRef.current += points;
        killsRef.current += 1;

        const particleMultiplier = settings.modeStealth ? 5.0 : settings.enemyDeathParticleMultiplier;
        // Multiply by 5 as requested for "Increase the particle number 5 times"
        const finalMultiplier = particleMultiplier * 5;
        const particleCount = Math.ceil(enemy.radius * finalMultiplier);

        createExplosion(enemy.x, enemy.y, vx, vy, particleCount, settings.modeStealth ? '#ffffff' : '#ef4444');
        playExplosionSound(1 + (enemy.radius / 15));

        enemiesRef.current.splice(index, 1);

        // Spawn Perk Chance
        if (Math.random() < settings.perkSpawnChance) {
            spawnPerk(enemy.x, enemy.y);
        }
    };

    const spawnQuote = () => {
        if (!canvasRef.current) return;
        const quoteObj = QUOTES[Math.floor(Math.random() * QUOTES.length)];
        const quoteText = quoteObj.text;
        const quoteAuthor = "- " + quoteObj.author;

        const width = canvasRef.current.width;
        const height = canvasRef.current.height;

        const fontSize = 16;
        const charWidth = 10;
        const lineHeight = 24;
        const maxLineWidth = Math.min(600, width - 100);

        const words = quoteText.split(' ');
        const lines: string[] = [];
        let currentLine = words[0];

        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            const width = (currentLine + " " + word).length * charWidth;
            if (width < maxLineWidth) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        lines.push("");
        lines.push(quoteAuthor);

        const totalHeight = lines.length * lineHeight;
        const startY = (height - totalHeight) / 2;

        lines.forEach((line, lineIndex) => {
            const lineWidth = line.length * charWidth;
            const startX = (width - lineWidth) / 2;
            const y = startY + lineIndex * lineHeight;

            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === ' ') continue;
                lettersRef.current.push({
                    id: letterIdCounter.current++,
                    x: startX + i * charWidth,
                    y: y,
                    vx: 0, vy: 0, radius: 8, color: '#ffffff',
                    char,
                    life: 40
                });
            }
        });
    };

    const spawnEnemy = () => {
        if (!canvasRef.current) return;
        const angle = Math.random() * Math.PI * 2;
        const r = Math.max(canvasRef.current.width, canvasRef.current.height) / 1.5 + 50;
        const x = playerRef.current.x + Math.cos(angle) * r;
        const y = playerRef.current.y + Math.sin(angle) * r;

        if (settings.modeStealth) {
            enemiesRef.current.push({
                id: enemyIdCounter.current++,
                x, y, vx: 0, vy: 0,
                radius: settings.enemyRadius,
                color: '#ffffff',
                type: 'stealth_sniper',
                hp: 1,
                maxHp: 1,
                visibility: 0,
                state: 'idle',
                stateTimer: Math.random() * 2000
            });
            return;
        }

        // Check for Level 2 (Red) Enemies after 60 seconds
        const elapsedTime = Date.now() - startTimeRef.current;
        const isLevel2 = elapsedTime > 60000 && Math.random() > 0.8;

        if (isLevel2) {
            enemiesRef.current.push({
                id: enemyIdCounter.current++,
                x, y, vx: 0, vy: 0,
                radius: settings.enemyRadius * 1.5,
                color: '#ef4444', // Red
                type: 'level2',
                hp: 15,
                maxHp: 15,
                hitShake: 0
            });
        } else {
            enemiesRef.current.push({
                id: enemyIdCounter.current++,
                x, y, vx: 0, vy: 0,
                radius: settings.enemyRadius,
                color: settings.enemyColor, // Purple default
                type: 'level1',
                hp: 2,
                maxHp: 2,
                hitShake: 0
            });
        }
    };

    const spawnAggregateEnemy = (x: number, y: number, particleCount: number) => {
        const radiusBase = 20;
        const radius = Math.min(100, radiusBase + particleCount * 0.5); // Cap size
        const health = Math.max(20, particleCount * 2); // Health scales with particles

        enemiesRef.current.push({
            id: enemyIdCounter.current++,
            x, y, vx: 0, vy: 0,
            radius: radius,
            color: '#22d3ee', // Cyan
            type: 'aggregate',
            hp: health,
            maxHp: health,
            hitShake: 0
        });

        // Small shockwave on spawn
        shockwavesRef.current.push({
            id: shockwaveIdCounter.current++,
            x, y, radius: 10, maxRadius: radius * 1.5, life: 1.0
        });
    };

    const spawnProjectile = (timestamp: number) => {
        // Draining Bullets Logic
        if (settings.modeDrainingBullets) {
            playerRef.current.energy -= 2; // Cost per shot
            if (playerRef.current.energy <= 0) {
                triggerDeath(timestamp);
                return;
            }
        }

        const dx = mouseRef.current.x - playerRef.current.x;
        const dy = mouseRef.current.y - playerRef.current.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Base Velocity Normalized
        const nvx = (dx / dist);
        const nvy = (dy / dist);

        // Determines actual weapon based on settings and perks
        let weapon = localActiveWeaponRef.current || settings.activeWeapon;
        // Enforce sniper in stealth mode if no local weapon overrides, or simply prefer sniper for gameplay
        if (settings.modeStealth) weapon = 'sniper';

        if (buffsRef.current.explosiveAmmo) weapon = 'nuke';

        playShootSound(weapon);

        // Shotgun Logic
        if (weapon === 'shotgun') {
            for (let i = -2; i <= 2; i++) {
                const spread = 0.15 * i; // Spread angle approx
                // Rotate vector
                const vx = (nvx * Math.cos(spread) - nvy * Math.sin(spread)) * settings.projectileSpeed;
                const vy = (nvx * Math.sin(spread) + nvy * Math.cos(spread)) * settings.projectileSpeed;

                projectilesRef.current.push({
                    id: projectileIdCounter.current++,
                    x: playerRef.current.x,
                    y: playerRef.current.y,
                    vx, vy,
                    radius: settings.projectileRadius,
                    color: settings.projectileColor,
                    type: 'default',
                    damage: 2,
                    bounces: 0
                });
            }
        }
        // Machine Gun Logic (Faster, slight spread)
        else if (weapon === 'machinegun') {
            const spread = (Math.random() - 0.5) * 0.1;
            const vx = (nvx * Math.cos(spread) - nvy * Math.sin(spread)) * settings.projectileSpeed * 1.2;
            const vy = (nvx * Math.sin(spread) + nvy * Math.cos(spread)) * settings.projectileSpeed * 1.2;

            projectilesRef.current.push({
                id: projectileIdCounter.current++,
                x: playerRef.current.x,
                y: playerRef.current.y,
                vx, vy,
                radius: settings.projectileRadius * 0.8,
                color: '#fbbf24', // Amber
                type: 'default',
                damage: 1,
                bounces: 0
            });
        }
        // Nuke / Explosive
        else if (weapon === 'nuke') {
            const vx = nvx * (settings.projectileSpeed * 0.6); // Slower
            const vy = nvy * (settings.projectileSpeed * 0.6);
            projectilesRef.current.push({
                id: projectileIdCounter.current++,
                x: playerRef.current.x,
                y: playerRef.current.y,
                vx, vy,
                radius: settings.projectileRadius + 4,
                color: '#f59e0b',
                type: 'explosive',
                damage: 0,
                bounces: 0
            });
        }
        // Sniper
        else if (weapon === 'sniper') {
            const vx = nvx * (settings.projectileSpeed * 3.0); // Very fast
            const vy = nvy * (settings.projectileSpeed * 3.0);
            projectilesRef.current.push({
                id: projectileIdCounter.current++,
                x: playerRef.current.x,
                y: playerRef.current.y,
                vx, vy,
                radius: settings.projectileRadius,
                color: '#00ffff', // Cyan
                type: 'sniper',
                damage: 50,
                bounces: 0
            });
        }
        // Default Blaster
        else {
            const vx = nvx * settings.projectileSpeed;
            const vy = nvy * settings.projectileSpeed;
            projectilesRef.current.push({
                id: projectileIdCounter.current++,
                x: playerRef.current.x,
                y: playerRef.current.y,
                vx, vy,
                radius: settings.projectileRadius,
                color: settings.projectileColor,
                type: 'default',
                damage: 1,
                bounces: 0
            });
        }
    };

    const triggerDeath = (timestamp: number) => {
        if (!canvasRef.current) return;
        playExplosionSound(4);

        // Report game over stats
        const timeSurvived = Math.floor((Date.now() - sessionStartRef.current) / 1000);
        onGameOver({ wisdom: scoreRef.current, kills: killsRef.current, timeSurvived });

        // Reset session tracking for next run
        sessionStartRef.current = Date.now();
        scoreRef.current = 0;
        killsRef.current = 0;

        // Keep score until respawn
        currentSpawnRateRef.current = settings.enemySpawnRate;
        startTimeRef.current = Date.now(); // Reset level timer
        playerRef.current.energy = 100; // Reset energy
        generateObstacles(); // New layout on death

        enemiesRef.current.forEach(e => {
            createExplosion(e.x, e.y, (e.x - playerRef.current.x), (e.y - playerRef.current.y), undefined, '#ef4444');
        });

        shockwavesRef.current.push({
            id: shockwaveIdCounter.current++,
            x: playerRef.current.x,
            y: playerRef.current.y,
            radius: 10,
            maxRadius: Math.max(canvasRef.current.width, canvasRef.current.height) * 1.5,
            life: 1.0
        });

        enemiesRef.current = [];
        projectilesRef.current = [];
        perksRef.current = [];
        lettersRef.current = [];

        deathStateRef.current = {
            active: true,
            gatherStartTime: timestamp + 5000,
            respawnX: Math.random() * (canvasRef.current.width - 100) + 50,
            respawnY: Math.random() * (canvasRef.current.height - 100) + 50
        };

        for (let i = 0; i < 100; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 500 + 100;
            particlesRef.current.push({
                id: particleIdCounter.current++,
                x: playerRef.current.x,
                y: playerRef.current.y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 6,
                maxLife: 6,
                radius: 3,
                color: '#ffffff',
                type: 'death'
            });
        }

        shakeRef.current = 50;
    };

    const checkLineOfSight = (x1: number, y1: number, x2: number, y2: number) => {
        // Simple line segment intersection against AABB obstacles
        for (const obs of obstaclesRef.current) {
            const minX = obs.x;
            const maxX = obs.x + obs.width;
            const minY = obs.y;
            const maxY = obs.y + obs.height;

            const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const steps = Math.ceil(dist / 20);
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const px = x1 + (x2 - x1) * t;
                const py = y1 + (y2 - y1) * t;
                if (px > minX && px < maxX && py > minY && py < maxY) {
                    return false; // Blocked
                }
            }
        }
        return true;
    };

    const findParticleCluster = () => {
        const gridSize = 100;
        const grid: { [key: string]: Particle[] } = {};

        // Bin particles into grid
        for (const p of particlesRef.current) {
            if (p.type === 'death' || p.formingTargetId !== undefined) continue;
            // Only consider relatively stationary "ground" particles
            if (Math.abs(p.vx) + Math.abs(p.vy) > 20) continue;

            const key = `${Math.floor(p.x / gridSize)},${Math.floor(p.y / gridSize)}`;
            if (!grid[key]) grid[key] = [];
            grid[key].push(p);
        }

        let maxKey = null;
        let maxLen = 0;
        for (const key in grid) {
            if (grid[key].length > maxLen) {
                maxLen = grid[key].length;
                maxKey = key;
            }
        }

        // Threshold: at least 10 stationary particles to form a Golem
        if (maxKey && maxLen >= 10) {
            const pts = grid[maxKey];
            let sx = 0, sy = 0;
            pts.forEach(p => { sx += p.x; sy += p.y; });
            return {
                x: sx / pts.length,
                y: sy / pts.length,
                particles: pts
            };
        }
        return null;
    };

    const update = (timestamp: number, dt: number) => {
        // --- ALWAYS UPDATE VISUALS ---
        shockwavesRef.current.forEach(sw => {
            sw.radius += dt * 1000;
            sw.life -= dt * 1.5;
        });
        shockwavesRef.current = shockwavesRef.current.filter(sw => sw.life > 0);

        // Update Grid
        gridRef.current.forEach(node => {
            // Spring physics to return to base
            const dx = node.baseX - node.x;
            const dy = node.baseY - node.y;

            const forceX = dx * 8; // Stiffness
            const forceY = dy * 8;

            node.vx += forceX * dt;
            node.vy += forceY * dt;

            node.vx *= 0.92; // Damping
            node.vy *= 0.92;

            node.x += node.vx * dt;
            node.y += node.vy * dt;
        });

        // Check for Aggregation every 30s
        if (timestamp - lastAggregationTimeRef.current > 30000) {
            const cluster = findParticleCluster();
            if (cluster) {
                lastAggregationTimeRef.current = timestamp;
                const targetId = formingIdCounter.current++;

                // Assign particle targets
                cluster.particles.forEach(p => {
                    p.formingTargetId = targetId;
                    p.life = 10; // Extend life so they don't vanish during formation
                });

                formingEnemiesRef.current.push({
                    id: targetId,
                    x: cluster.x,
                    y: cluster.y,
                    startTime: timestamp,
                    totalParticles: cluster.particles.length,
                    radiusTarget: 20 + cluster.particles.length * 0.5
                });

                shakeRef.current += 10; // Rumbling effect
            } else {
                // If check failed, maybe retry sooner than 30s? No, keep it rare.
                lastAggregationTimeRef.current = timestamp;
            }
        }

        // Update Forming Enemies
        formingEnemiesRef.current = formingEnemiesRef.current.filter(fe => {
            const progress = (timestamp - fe.startTime) / 2000; // 2 seconds form time

            if (progress >= 1) {
                spawnAggregateEnemy(fe.x, fe.y, fe.totalParticles);
                // Remove absorbed particles
                particlesRef.current = particlesRef.current.filter(p => p.formingTargetId !== fe.id);
                return false;
            }
            return true;
        });

        // Particles
        let allGathered = true;
        let activeDeathParticles = 0;

        particlesRef.current.forEach(p => {
            // Aggregation Physics override
            if (p.formingTargetId !== undefined) {
                const fe = formingEnemiesRef.current.find(f => f.id === p.formingTargetId);
                if (fe) {
                    // Pull to center
                    const dx = fe.x - p.x;
                    const dy = fe.y - p.y;
                    p.x += dx * dt * 3; // Lerp speed
                    p.y += dy * dt * 3;
                    return; // Skip standard physics
                }
            }

            // Shockwave Interaction
            shockwavesRef.current.forEach(sw => {
                const dx = p.x - sw.x;
                const dy = p.y - sw.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                // Apply force if particle is near the shockwave front
                if (dist < sw.radius + 20 && dist > sw.radius - 20) {
                    const angle = Math.atan2(dy, dx);
                    const force = 800 * sw.life;
                    p.vx += Math.cos(angle) * force * dt;
                    p.vy += Math.sin(angle) * force * dt;
                }
            });

            if (p.type === 'death' && deathStateRef.current.active) {
                activeDeathParticles++;
                if (timestamp < deathStateRef.current.gatherStartTime) {
                    p.x += p.vx * dt;
                    p.y += p.vy * dt;
                    p.vx *= 0.95;
                    p.vy *= 0.95;
                    allGathered = false;
                } else {
                    const dx = deathStateRef.current.respawnX - p.x;
                    const dy = deathStateRef.current.respawnY - p.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist > 10) {
                        p.x += dx * 5 * dt;
                        p.y += dy * 5 * dt;
                        allGathered = false;
                    } else {
                        p.x = deathStateRef.current.respawnX;
                        p.y = deathStateRef.current.respawnY;
                    }
                }
            } else {
                p.x += p.vx * dt;
                p.y += p.vy * dt;
                p.vx *= settings.particleDrag;
                p.vy *= settings.particleDrag;
                p.life -= dt;
            }
        });
        particlesRef.current = particlesRef.current.filter(p => {
            if (p.type === 'death' && deathStateRef.current.active) return true;
            // Keep particles alive if they are forming
            if (p.formingTargetId !== undefined) return true;
            return p.life > 0;
        });

        // --- DEATH STATE ---
        if (deathStateRef.current.active) {
            if (timestamp > deathStateRef.current.gatherStartTime && (allGathered || activeDeathParticles === 0)) {
                playerRef.current.x = deathStateRef.current.respawnX;
                playerRef.current.y = deathStateRef.current.respawnY;
                playerRef.current.health = settings.maxHealth;
                playerRef.current.energy = 100;
                scoreRef.current = 0; // Reset score on respawn
                deathStateRef.current.active = false;
                particlesRef.current = particlesRef.current.filter(p => p.type !== 'death');
                createExplosion(playerRef.current.x, playerRef.current.y, 0, 0);
            }
            if (shakeRef.current > 0) shakeRef.current *= 0.9;
            return;
        }

        // --- NORMAL GAME LOOP ---
        buffsRef.current.fireRate = timestamp < buffsRef.current.fireRateUntil;
        buffsRef.current.speed = timestamp < buffsRef.current.speedUntil;
        buffsRef.current.timeSlow = timestamp < buffsRef.current.timeSlowUntil;
        buffsRef.current.explosiveAmmo = timestamp < buffsRef.current.explosiveAmmoUntil;

        // Movement
        let currentSpeed = settings.playerSpeed;
        if (buffsRef.current.speed) currentSpeed *= 1.5;
        if (buffsRef.current.timeSlow) currentSpeed *= 0.5;

        // Stealth Speed Mods
        if (settings.modeStealth) {
            if (keysRef.current['shift']) {
                // Normal speed
            } else {
                currentSpeed *= 0.4; // Slow crawl
            }
        }

        const moveStep = currentSpeed * dt;
        let dx = 0;
        let dy = 0;
        if (keysRef.current['w']) dy -= moveStep;
        if (keysRef.current['s']) dy += moveStep;
        if (keysRef.current['a']) dx -= moveStep;
        if (keysRef.current['d']) dx += moveStep;

        // Normalize diagonal
        if (dx !== 0 && dy !== 0) {
            const len = Math.sqrt(dx * dx + dy * dy);
            dx = (dx / len) * moveStep;
            dy = (dy / len) * moveStep;
        }

        let newX = playerRef.current.x + dx;
        let newY = playerRef.current.y + dy;

        // Obstacle Collision (Player)
        if (settings.modeStealth) {
            let collided = false;
            const pr = settings.playerRadius;
            for (const obs of obstaclesRef.current) {
                // AABB-Circle collision simplified to AABB-AABB for movement blocking
                if (newX + pr > obs.x && newX - pr < obs.x + obs.width &&
                    newY + pr > obs.y && newY - pr < obs.y + obs.height) {
                    collided = true;
                    break;
                }
            }
            if (!collided) {
                playerRef.current.x = newX;
                playerRef.current.y = newY;
            }
        } else {
            playerRef.current.x = newX;
            playerRef.current.y = newY;
        }

        if (canvasRef.current) {
            playerRef.current.x = Math.max(settings.playerRadius, Math.min(canvasRef.current.width - settings.playerRadius, playerRef.current.x));
            playerRef.current.y = Math.max(settings.playerRadius, Math.min(canvasRef.current.height - settings.playerRadius, playerRef.current.y));
        }

        // Stealth Visibility Calculation
        if (settings.modeStealth) {
            const isMoving = dx !== 0 || dy !== 0;
            const mouseVelocity = mouseRef.current.velocity;

            let targetVisibility = 0;
            if (keysRef.current['shift'] && isMoving) targetVisibility = 1.0;
            else if (isMoving) targetVisibility = 0.6;
            else if (mouseVelocity > 2) targetVisibility = 0.3; // Looking around
            else targetVisibility = 0.05;

            // Smooth transition
            playerRef.current.visibility += (targetVisibility - playerRef.current.visibility) * dt * 5;

            // Decay mouse velocity
            mouseRef.current.velocity *= 0.8;
        } else {
            playerRef.current.visibility = 1.0;
        }

        // Energy Logic for Draining Bullets Mode
        if (settings.modeDrainingBullets) {
            // Regen if not firing
            if (!mouseRef.current.down && playerRef.current.energy < 100) {
                playerRef.current.energy += dt * 10; // Regen rate
                if (playerRef.current.energy > 100) playerRef.current.energy = 100;
            }

            // Shake if low energy
            if (playerRef.current.energy < 40) {
                shakeRef.current = Math.max(shakeRef.current, (40 - playerRef.current.energy) * 0.2);
            }
        } else {
            // Reset energy if mode switched off during play
            playerRef.current.energy = 100;
        }

        // Spawning Enemies
        let spawnRate = currentSpawnRateRef.current;
        if (buffsRef.current.timeSlow) spawnRate *= 2;

        if (timestamp - lastSpawnTimeRef.current > spawnRate) {
            spawnEnemy();
            lastSpawnTimeRef.current = timestamp;
            if (!settings.modeStealth) {
                currentSpawnRateRef.current = Math.max(50, currentSpawnRateRef.current - settings.enemySpawnIncreaseRate);
            }
        }

        // Spawning Quotes
        if (timestamp - lastQuoteSpawnTimeRef.current > settings.quoteSpawnInterval) {
            spawnQuote();
            lastQuoteSpawnTimeRef.current = timestamp;
        }

        // Shooting
        let fireRate = settings.projectileFireRate;
        let weapon = localActiveWeaponRef.current || settings.activeWeapon;
        if (settings.modeStealth) weapon = 'sniper';
        if (buffsRef.current.explosiveAmmo) weapon = 'nuke';

        if (buffsRef.current.fireRate) fireRate /= 2;
        if (weapon === 'machinegun') fireRate /= 3;
        if (weapon === 'shotgun') fireRate *= 3;
        if (weapon === 'sniper') fireRate = 2000; // 2 seconds to load
        if (buffsRef.current.explosiveAmmo || weapon === 'nuke') fireRate = Math.max(fireRate, 400);

        if (mouseRef.current.down && timestamp - lastShotTimeRef.current > fireRate) {
            spawnProjectile(timestamp);
            lastShotTimeRef.current = timestamp;
        }

        // Update Entities
        projectilesRef.current.forEach(p => {
            p.x += p.vx * dt;
            p.y += p.vy * dt;
        });

        // Remove projectiles hitting obstacles
        if (settings.modeStealth) {
            projectilesRef.current = projectilesRef.current.filter(p => {
                for (const obs of obstaclesRef.current) {
                    if (p.x > obs.x && p.x < obs.x + obs.width && p.y > obs.y && p.y < obs.y + obs.height) {
                        createExplosion(p.x, p.y, -p.vx * 0.5, -p.vy * 0.5, 3, '#fff');
                        return false;
                    }
                }
                return true;
            });
        }

        if (canvasRef.current) {
            const { width, height } = canvasRef.current;
            projectilesRef.current = projectilesRef.current.filter(p =>
                p.x >= -50 && p.x <= width + 50 && p.y >= -50 && p.y <= height + 50
            );
        }

        const enemySpeedMultiplier = buffsRef.current.timeSlow ? 0.3 : 1.0;
        enemiesRef.current.forEach(e => {
            // Shake decay
            if (e.hitShake && e.hitShake > 0) e.hitShake -= dt * 30;

            // Stealth Enemy Logic
            if (settings.modeStealth && e.type === 'stealth_sniper') {
                // AI State Machine
                e.stateTimer = (e.stateTimer || 0) - dt * 1000;
                if (e.stateTimer <= 0) {
                    if (e.state === 'idle') {
                        e.state = 'moving';
                        e.stateTimer = 1000 + Math.random() * 2000;
                        // Random target
                        const angle = Math.random() * Math.PI * 2;
                        e.vx = Math.cos(angle) * settings.enemySpeed;
                        e.vy = Math.sin(angle) * settings.enemySpeed;
                    } else if (e.state === 'moving') {
                        e.state = 'idle';
                        e.stateTimer = 2000 + Math.random() * 2000;
                        e.vx = 0;
                        e.vy = 0;
                    }
                }

                // Visibility based on movement
                const isMoving = e.vx !== 0 || e.vy !== 0;
                const targetVis = isMoving ? 1.0 : 0.05;
                e.visibility = (e.visibility || 0) + (targetVis - (e.visibility || 0)) * dt * 5;

                // Aggro logic
                if (e.state === 'idle' && playerRef.current.visibility > 0.2) {
                    // Check LOS
                    if (checkLineOfSight(e.x, e.y, playerRef.current.x, playerRef.current.y)) {
                        // SHOOT (Simplified: instant hitscan damage or fast projectile)
                        // For fairness, let's spawn a projectile aimed at player
                        if (Math.random() < dt * 0.5) { // Random chance to fire when locked
                            const ang = Math.atan2(playerRef.current.y - e.y, playerRef.current.x - e.x);
                            // Use Enemy Projectiles list if we had one, but we reuse projectile list with type='enemy_bullet'
                            // For now, simpler: instant damage if close, or spawn a generic "enemy" entity?
                            // Let's just hurt the player directly with a visual line
                            playerRef.current.health -= 20;
                            shakeRef.current = 20;
                            if (playerRef.current.health <= 0) triggerDeath(timestamp);

                            // Visual Trace
                            createExplosion(playerRef.current.x, playerRef.current.y, 0, 0, 10, '#ff0000');
                            playShootSound('sniper');

                            // Reveal enemy on fire
                            e.visibility = 1.0;
                        }
                    }
                }
            } else if (e.type === 'aggregate') {
                // Aggregate Enemy Logic: Heavy, slow, relentless
                const dx = playerRef.current.x - e.x;
                const dy = playerRef.current.y - e.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    // Slower than normal enemies
                    e.vx = (dx / dist) * settings.enemySpeed * 0.5 * enemySpeedMultiplier;
                    e.vy = (dy / dist) * settings.enemySpeed * 0.5 * enemySpeedMultiplier;
                }
            } else {
                // Normal Chase Logic
                const dx = playerRef.current.x - e.x;
                const dy = playerRef.current.y - e.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist > 0) {
                    e.vx = (dx / dist) * settings.enemySpeed * enemySpeedMultiplier;
                    e.vy = (dy / dist) * settings.enemySpeed * enemySpeedMultiplier;
                }
            }

            e.x += e.vx * dt;
            e.y += e.vy * dt;
        });

        perksRef.current.forEach(e => {
            // Update perk to accept specific weapon perks
            if (e.type.startsWith('weapon_')) {
                e.color = `hsl(${timestamp * 0.1 % 360}, 100%, 50%)`;
            }
            e.x += Math.cos(e.id) * 10 * dt;
            e.y += Math.sin(e.id) * 10 * dt;
        });

        lettersRef.current.forEach(e => {
            e.x += Math.cos(e.id * 0.1) * 2 * dt;
            e.y += Math.sin(e.id * 0.1) * 2 * dt;
            e.life -= dt;
        });
        lettersRef.current = lettersRef.current.filter(l => l.life > 0);

        // Collision: Projectile vs Enemy
        for (let i = projectilesRef.current.length - 1; i >= 0; i--) {
            const proj = projectilesRef.current[i];
            let removed = false;

            for (let j = enemiesRef.current.length - 1; j >= 0; j--) {
                const enemy = enemiesRef.current[j];

                const dx = proj.x - enemy.x;
                const dy = proj.y - enemy.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < enemy.radius + proj.radius) {

                    if (proj.type === 'explosive') {
                        // AOE
                        createExplosion(proj.x, proj.y, 0, 0);
                        shockwavesRef.current.push({
                            id: shockwaveIdCounter.current++,
                            x: proj.x,
                            y: proj.y,
                            radius: 5,
                            maxRadius: 80,
                            life: 0.5
                        });

                        const blastRadius = 80;
                        enemiesRef.current = enemiesRef.current.filter(e => {
                            const ex = e.x - proj.x;
                            const ey = e.y - proj.y;
                            const edist = Math.sqrt(ex * ex + ey * ey);
                            if (edist <= blastRadius) {
                                e.hp = (e.hp || 1) - 10;
                                if (e.hp <= 0) {
                                    killEnemy(enemiesRef.current.indexOf(e), ex * 2, ey * 2);
                                    return false;
                                } else {
                                    e.x += (ex / edist) * 20;
                                    e.y += (ey / edist) * 20;
                                    e.hitShake = 5;
                                }
                            }
                            return true;
                        });
                        removed = true;
                    } else {
                        // Standard Damage
                        const damage = proj.damage || 1;
                        enemy.hp = (enemy.hp || 1) - damage;

                        if (enemy.hp <= 0) {
                            killEnemy(j, proj.vx, proj.vy);
                        } else {
                            enemy.hitShake = 5;
                            const impactAngle = Math.atan2(proj.vy, proj.vx);
                            enemy.x += Math.cos(impactAngle) * 5;
                            enemy.y += Math.sin(impactAngle) * 5;
                            createExplosion(proj.x, proj.y, proj.vx * -0.5, proj.vy * -0.5, 3, '#fff');
                            playHitSound();
                        }

                        // Bouncing Logic
                        if (settings.projectileBounces > 0 && (proj.bounces || 0) < settings.projectileBounces) {
                            proj.bounces = (proj.bounces || 0) + 1;
                            // Reflection vector at circular boundary
                            const nx = dx / dist;
                            const ny = dy / dist;
                            const dot = proj.vx * nx + proj.vy * ny;
                            // Only reflect if moving towards the enemy center
                            if (dot < 0) {
                                proj.vx = proj.vx - 2 * dot * nx;
                                proj.vy = proj.vy - 2 * dot * ny;
                            }
                            // Move outside slightly to prevent multi-hit stickiness
                            const overlap = (enemy.radius + proj.radius) - dist;
                            proj.x += nx * (overlap + 2);
                            proj.y += ny * (overlap + 2);
                        } else {
                            removed = true;
                        }
                    }
                    break;
                }
            }

            if (removed) {
                projectilesRef.current.splice(i, 1);
            }
        }

        // Collision: Enemy vs Player
        for (let i = enemiesRef.current.length - 1; i >= 0; i--) {
            const enemy = enemiesRef.current[i];
            if (!enemy) continue;

            const dx = playerRef.current.x - enemy.x;
            const dy = playerRef.current.y - enemy.y;
            const dist = Math.sqrt(dx * dx + dy * dy);

            const hitRadius = buffsRef.current.shell ? settings.playerRadius + 20 : settings.playerRadius;

            if (dist < hitRadius + enemy.radius) {
                if (buffsRef.current.shell) {
                    killEnemy(i, enemy.vx * -2, enemy.vy * -2);
                } else {
                    playerRef.current.health -= 10;
                    shakeRef.current = settings.screenShakeIntensity;
                    playHitSound();

                    const angle = Math.atan2(dy, dx);
                    enemy.x -= Math.cos(angle) * 50;
                    enemy.y -= Math.sin(angle) * 50;

                    if (playerRef.current.health <= 0) {
                        triggerDeath(timestamp);
                        break;
                    }
                }
            }
        }

        // Player vs Perks
        for (let i = perksRef.current.length - 1; i >= 0; i--) {
            const perk = perksRef.current[i];
            const dx = playerRef.current.x - perk.x;
            const dy = playerRef.current.y - perk.y;
            if (Math.sqrt(dx * dx + dy * dy) < settings.playerRadius + perk.radius) {
                // If it's a weapon perk, we toggle the weapon.
                if (perk.type.startsWith('weapon_')) {
                    const weaponMap: { [key: string]: string } = {
                        'weapon_shotgun': 'shotgun',
                        'weapon_machinegun': 'machinegun',
                        'weapon_blaster': 'blaster',
                        'weapon_sniper': 'sniper'
                    };
                    localActiveWeaponRef.current = weaponMap[perk.type];
                    playPowerupSound();
                } else {
                    activatePerk(perk.type, timestamp);
                }
                perksRef.current.splice(i, 1);
            }
        }

        // Player vs Letters
        for (let i = lettersRef.current.length - 1; i >= 0; i--) {
            const letter = lettersRef.current[i];
            const dx = playerRef.current.x - letter.x;
            const dy = playerRef.current.y - letter.y;
            if (Math.sqrt(dx * dx + dy * dy) < settings.playerRadius + letter.radius) {
                scoreRef.current += 10;
                lettersRef.current.splice(i, 1);
            }
        }

        if (shakeRef.current > 0) shakeRef.current *= 0.9;
        if (shakeRef.current < 0.5) shakeRef.current = 0;
    };

    const draw = (timestamp: number) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Shake Transformation (Global)
        let dx = 0, dy = 0;
        if (shakeRef.current > 0) {
            dx = (Math.random() - 0.5) * shakeRef.current;
            dy = (Math.random() - 0.5) * shakeRef.current;
        }

        ctx.save();
        ctx.translate(dx, dy);

        // Clear with Background Color
        ctx.fillStyle = settings.backgroundColor;
        ctx.fillRect(-canvas.width, -canvas.height, canvas.width * 3, canvas.height * 3);

        // Draw Grid (Background)
        const grid = gridRef.current;
        if (grid.length > 0) {
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)'; // Increased visibility slightly
            ctx.lineWidth = 1;

            const cols = gridColsRef.current;
            const rows = gridRowsRef.current;

            // Draw Horizontal Curves
            for (let r = 0; r < rows; r++) {
                ctx.beginPath();
                const p0 = grid[r * cols];
                ctx.moveTo(p0.x, p0.y);

                for (let c = 0; c < cols - 1; c++) {
                    const pCurrent = grid[r * cols + c];
                    const pNext = grid[r * cols + c + 1];
                    const mx = (pCurrent.x + pNext.x) / 2;
                    const my = (pCurrent.y + pNext.y) / 2;
                    ctx.quadraticCurveTo(pCurrent.x, pCurrent.y, mx, my);
                }
                const pLast = grid[r * cols + cols - 1];
                ctx.lineTo(pLast.x, pLast.y);
                ctx.stroke();
            }

            // Draw Vertical Curves
            for (let c = 0; c < cols; c++) {
                ctx.beginPath();
                const p0 = grid[c];
                ctx.moveTo(p0.x, p0.y);

                for (let r = 0; r < rows - 1; r++) {
                    const pCurrent = grid[r * cols + c];
                    const pNext = grid[(r + 1) * cols + c];
                    const mx = (pCurrent.x + pNext.x) / 2;
                    const my = (pCurrent.y + pNext.y) / 2;
                    ctx.quadraticCurveTo(pCurrent.x, pCurrent.y, mx, my);
                }
                const pLast = grid[(rows - 1) * cols + c];
                ctx.lineTo(pLast.x, pLast.y);
                ctx.stroke();
            }
        }

        // Draw Obstacles (Stealth Mode)
        if (settings.modeStealth) {
            ctx.fillStyle = '#111111';
            ctx.strokeStyle = '#333333';
            ctx.lineWidth = 2;
            obstaclesRef.current.forEach(obs => {
                ctx.fillRect(obs.x, obs.y, obs.width, obs.height);
                ctx.strokeRect(obs.x, obs.y, obs.width, obs.height);
            });
        }

        // Draw Everything (Normal Game Loop)

        // Particles
        particlesRef.current.forEach(p => {
            if (p.type === 'death') {
                ctx.globalAlpha = 1;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
                ctx.fill();
            } else {
                const opacity = p.life < 1 ? p.life : 1;
                ctx.globalAlpha = opacity;
                ctx.fillStyle = p.color || settings.particleColor;
                ctx.beginPath();
                ctx.arc(p.x, p.y, settings.particleSize, 0, Math.PI * 2);
                ctx.fill();
            }
        });
        ctx.globalAlpha = 1;

        // Perks
        perksRef.current.forEach(p => {
            ctx.save();
            ctx.translate(p.x, p.y);
            const scale = 1 + Math.sin(timestamp * 0.005) * 0.1;
            ctx.scale(scale, scale);
            ctx.strokeStyle = p.color || '#fff'; // Use weapon color if applicable
            ctx.lineWidth = 2;
            ctx.fillStyle = 'rgba(255,255,255,0.1)';

            // Icons
            if (p.type.startsWith('weapon_')) {
                ctx.beginPath(); ctx.moveTo(0, -5); ctx.lineTo(5, 0); ctx.lineTo(0, 5); ctx.lineTo(-5, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
            } else if (p.type === 'nuke') {
                ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 10, 0, Math.PI / 3); ctx.fill();
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 10, 2 * Math.PI / 3, Math.PI); ctx.fill();
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 10, 4 * Math.PI / 3, 5 * Math.PI / 3); ctx.fill();
            } else if (p.type === 'shell') {
                ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.stroke();
            } else if (p.type === 'time') {
                ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.stroke();
                ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -6); ctx.stroke();
                ctx.moveTo(0, 0); ctx.lineTo(4, 0); ctx.stroke();
            } else if (p.type === 'fire') {
                ctx.beginPath(); ctx.moveTo(0, -10); ctx.lineTo(6, 6); ctx.lineTo(-6, 6); ctx.closePath(); ctx.stroke(); ctx.fill();
            } else if (p.type === 'speed') {
                ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(2, 0); ctx.lineTo(-6, 6); ctx.moveTo(0, -6); ctx.lineTo(8, 0); ctx.lineTo(0, 6); ctx.stroke();
            } else if (p.type === 'life') {
                ctx.strokeStyle = '#4ade80';
                ctx.beginPath(); ctx.moveTo(0, -8); ctx.lineTo(0, 8); ctx.moveTo(-8, 0); ctx.lineTo(8, 0); ctx.stroke();
            } else if (p.type === 'gun_explosive') {
                ctx.fillStyle = '#facc15';
                ctx.beginPath(); ctx.arc(-6, 4, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(6, 4, 3, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(0, -6, 3, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        });

        // Letters
        ctx.font = '16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        lettersRef.current.forEach(l => {
            const opacity = Math.min(1, l.life);
            ctx.globalAlpha = opacity;
            ctx.fillText(l.char, l.x, l.y);
        });
        ctx.globalAlpha = 1;

        // Enemies
        enemiesRef.current.forEach(e => {
            ctx.save();
            let ex = e.x;
            let ey = e.y;
            if (e.hitShake && e.hitShake > 0) {
                ex += (Math.random() - 0.5) * e.hitShake;
                ey += (Math.random() - 0.5) * e.hitShake;
            }

            // Stealth visibility
            if (settings.modeStealth) {
                ctx.globalAlpha = Math.max(0.05, e.visibility || 0);
            }

            ctx.fillStyle = e.color;
            ctx.beginPath();
            ctx.arc(ex, ey, e.radius, 0, Math.PI * 2);
            ctx.fill();

            // Health bars (for stronger enemies)
            if ((e.type === 'level2' || e.type === 'aggregate') && e.hp && e.maxHp && e.hp < e.maxHp) {
                const barWidth = e.type === 'aggregate' ? 40 : 20;
                const barHeight = 3;
                ctx.fillStyle = 'rgba(0,0,0,0.5)';
                ctx.fillRect(ex - barWidth / 2, ey - e.radius - 8, barWidth, barHeight);
                ctx.fillStyle = e.type === 'aggregate' ? '#22d3ee' : '#ef4444';
                ctx.fillRect(ex - barWidth / 2, ey - e.radius - 8, barWidth * (e.hp / e.maxHp), barHeight);
            }
            ctx.restore();
        });

        // Projectiles
        ctx.shadowBlur = settings.projectileGlow;
        ctx.shadowColor = settings.projectileColor;
        ctx.fillStyle = settings.projectileColor;
        projectilesRef.current.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
            ctx.fillStyle = p.color;
            ctx.fill();
        });
        ctx.shadowBlur = 0;

        // Player
        if (!deathStateRef.current.active) {
            // Line to Cursor
            const dx = mouseRef.current.x - playerRef.current.x;
            const dy = mouseRef.current.y - playerRef.current.y;
            const angle = Math.atan2(dy, dx);
            const maxDist = Math.max(canvas.width, canvas.height) * 2;

            ctx.beginPath();
            ctx.moveTo(playerRef.current.x, playerRef.current.y);
            ctx.lineTo(playerRef.current.x + Math.cos(angle) * maxDist, playerRef.current.y + Math.sin(angle) * maxDist);

            ctx.strokeStyle = settings.cursorLineColor;
            ctx.lineWidth = settings.cursorLineWidth;
            ctx.globalAlpha = settings.cursorLineOpacity;
            ctx.stroke();
            ctx.globalAlpha = 1;

            if (settings.modeStealth) {
                ctx.globalAlpha = playerRef.current.visibility;
            }

            ctx.shadowBlur = settings.playerGlow;
            ctx.shadowColor = settings.playerColor;
            ctx.fillStyle = settings.playerColor;
            ctx.beginPath();
            ctx.arc(playerRef.current.x, playerRef.current.y, settings.playerRadius, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;

            // Energy Bar for Draining Bullets
            if (settings.modeDrainingBullets && playerRef.current.energy < 100) {
                const barWidth = 40;
                const barHeight = 4;
                const yOffset = settings.playerRadius + 10;

                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.fillRect(playerRef.current.x - barWidth / 2, playerRef.current.y + yOffset, barWidth, barHeight);

                ctx.fillStyle = playerRef.current.energy < 30 ? '#ef4444' : '#3b82f6';
                ctx.fillRect(playerRef.current.x - barWidth / 2, playerRef.current.y + yOffset, barWidth * (playerRef.current.energy / 100), barHeight);
            }

            if (buffsRef.current.shell) {
                ctx.strokeStyle = '#00ffff';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(playerRef.current.x, playerRef.current.y, settings.playerRadius + 15, 0, Math.PI * 2);
                ctx.stroke();
            }
        }

        // Shockwaves
        shockwavesRef.current.forEach(sw => {
            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
            ctx.lineWidth = 20 * sw.life;
            ctx.strokeStyle = `rgba(255, 255, 255, ${sw.life * 0.5})`;
            ctx.stroke();

            ctx.beginPath();
            ctx.arc(sw.x, sw.y, sw.radius * 0.9, 0, Math.PI * 2);
            ctx.lineWidth = 2;
            ctx.strokeStyle = `rgba(255, 255, 255, ${sw.life})`;
            ctx.stroke();
        });

        // --- DARK MODE OVERLAY ---
        if (settings.modeDark && !deathStateRef.current.active) {

            const mouseX = mouseRef.current.x - dx;
            const mouseY = mouseRef.current.y - dy;
            const playerX = playerRef.current.x;
            const playerY = playerRef.current.y;

            const angle = Math.atan2(mouseY - playerY, mouseX - playerX);
            const radius = Math.max(canvas.width, canvas.height);
            const coneWidth = Math.PI / 4;

            // 1. Draw Light Mask
            ctx.globalCompositeOperation = 'destination-in';
            ctx.shadowBlur = 60;
            ctx.shadowColor = '#ffffff';

            ctx.beginPath();
            ctx.moveTo(playerX, playerY);
            ctx.arc(playerX, playerY, radius, angle - coneWidth / 2, angle + coneWidth / 2);
            ctx.lineTo(playerX, playerY);
            ctx.arc(playerX, playerY, 120, 0, Math.PI * 2);
            ctx.fillStyle = '#ffffff';
            ctx.fill();

            ctx.shadowBlur = 0;

            // 2. Draw Shadows
            ctx.globalCompositeOperation = 'destination-out';

            enemiesRef.current.forEach(e => {
                if (settings.modeStealth && (e.visibility || 0) < 0.2) return; // Don't cast shadow if invisible

                const dx = e.x - playerX;
                const dy = e.y - playerY;
                const angleToEnemy = Math.atan2(dy, dx);

                const shadowLen = 3000;
                const offsetAngle = Math.PI / 2;

                const p1x = e.x + Math.cos(angleToEnemy + offsetAngle) * e.radius;
                const p1y = e.y + Math.sin(angleToEnemy + offsetAngle) * e.radius;

                const p2x = e.x + Math.cos(angleToEnemy - offsetAngle) * e.radius;
                const p2y = e.y + Math.sin(angleToEnemy - offsetAngle) * e.radius;

                const p3x = p2x + Math.cos(angleToEnemy) * shadowLen;
                const p3y = p2y + Math.sin(angleToEnemy) * shadowLen;

                const p4x = p1x + Math.cos(angleToEnemy) * shadowLen;
                const p4y = p1y + Math.sin(angleToEnemy) * shadowLen;

                ctx.beginPath();
                ctx.moveTo(p1x, p1y);
                ctx.lineTo(p2x, p2y);
                ctx.lineTo(p3x, p3y);
                ctx.lineTo(p4x, p4y);
                ctx.closePath();
                ctx.fillStyle = '#000000';
                ctx.fill();
            });

            // Obstacles cast shadows in dark mode too?
            // It's expensive but cool. Let's do rects.
            obstaclesRef.current.forEach(obs => {
                const cx = obs.x + obs.width / 2;
                const cy = obs.y + obs.height / 2;
                const angle = Math.atan2(cy - playerY, cx - playerX);
                // Approximate shadow by casting from corners.
                // For simplicity, skip obstacle shadows in this iteration to save perf/complexity.
            });

            ctx.globalCompositeOperation = 'source-over';
        }

        ctx.restore();
    };

    useEffect(() => {
        let animationFrameId: number;
        const loop = (timestamp: number) => {
            if (!lastTimeRef.current) lastTimeRef.current = timestamp;
            const dt = (timestamp - lastTimeRef.current) / 1000;
            lastTimeRef.current = timestamp;

            if (!isPaused && canvasRef.current) {
                update(timestamp, dt);
                draw(timestamp);
            } else if (isPaused && canvasRef.current) {
                draw(timestamp);
            }

            if (timestamp - lastStatsUpdateRef.current > 100) {
                const reportHealth = deathStateRef.current.active ? 0 : Math.max(0, playerRef.current.health);
                onUpdateStats(reportHealth, scoreRef.current, killsRef.current);
                lastStatsUpdateRef.current = timestamp;
            }
            animationFrameId = requestAnimationFrame(loop);
        };
        animationFrameId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationFrameId);
    });

    useImperativeHandle(ref, () => ({
        clearEnemies: () => {
            enemiesRef.current.forEach(e => {
                createExplosion(e.x, e.y, 0, 0);
            });
            enemiesRef.current = [];
            shakeRef.current = 20;
        }
    }));

    return (
        <canvas ref={canvasRef} className="block w-full h-full" />
    );
});

export default GameCanvas;
