
let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let streamDest: MediaStreamAudioDestinationNode | null = null;

// Get the AudioContext instance (for stream capture)
export const getAudioContext = (): AudioContext | null => audioCtx;

// Get an audio MediaStream for recording
export const getAudioStream = (): MediaStream | null => {
    if (!audioCtx || !masterGain) return null;
    if (!streamDest) {
        streamDest = audioCtx.createMediaStreamDestination();
        masterGain.connect(streamDest);
    }
    return streamDest.stream;
};

// Initialize Audio Context on first interaction
export const initAudio = () => {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        masterGain = audioCtx.createGain();
        masterGain.connect(audioCtx.destination);
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => { });
    }
};

export const setMasterVolume = (vol: number) => {
    if (!audioCtx) initAudio();
    if (masterGain && audioCtx) {
        masterGain.gain.setValueAtTime(vol, audioCtx.currentTime);
    }
};

// Create a buffer of white noise
let noiseBuffer: AudioBuffer | null = null;
const getNoiseBuffer = (ctx: AudioContext) => {
    if (!noiseBuffer) {
        const bufferSize = ctx.sampleRate * 2; // 2 seconds of noise
        noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
    }
    return noiseBuffer;
};

export const playShootSound = (type: string, volumeMulti: number = 1) => {
    initAudio();
    if (!audioCtx || !masterGain) return;

    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();

    gain.connect(masterGain);
    osc.connect(gain);

    switch (type) {
        case 'shotgun':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(150, t);
            osc.frequency.exponentialRampToValueAtTime(40, t + 0.2);
            gain.gain.setValueAtTime(0.2 * volumeMulti, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.start(t);
            osc.stop(t + 0.2);
            // Punchy noise
            playNoise(0.15, 0.3 * volumeMulti, 800);
            break;
        case 'sniper':
            // High tech charge sound
            osc.type = 'square';
            osc.frequency.setValueAtTime(1200, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.3);
            gain.gain.setValueAtTime(0.15 * volumeMulti, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
            osc.start(t);
            osc.stop(t + 0.3);
            break;
        case 'machinegun':
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(300 + Math.random() * 50, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
            gain.gain.setValueAtTime(0.12 * volumeMulti, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
            osc.start(t);
            osc.stop(t + 0.1);
            break;
        case 'nuke':
            playNoise(2.0, 0.8 * volumeMulti, 200); // Deep rumble
            // Siren falling
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(50, t + 1.5);
            gain.gain.setValueAtTime(0.2 * volumeMulti, t);
            gain.gain.linearRampToValueAtTime(0.01, t + 1.5);
            osc.start(t);
            osc.stop(t + 1.5);
            break;
        case 'blaster':
        default:
            osc.type = 'triangle';
            osc.frequency.setValueAtTime(800, t);
            osc.frequency.exponentialRampToValueAtTime(100, t + 0.15);
            gain.gain.setValueAtTime(0.1 * volumeMulti, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
            osc.start(t);
            osc.stop(t + 0.15);
            break;
    }
};

const playNoise = (duration: number, vol: number, filterFreq: number = 1000) => {
    if (!audioCtx || !masterGain) return;

    const noise = audioCtx.createBufferSource();
    noise.buffer = getNoiseBuffer(audioCtx);

    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(filterFreq, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + duration);

    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(masterGain);

    noise.start();
    noise.stop(audioCtx.currentTime + duration);
};

export const playExplosionSound = (size: number = 1) => {
    initAudio();
    // Size roughly 1 to 5
    const duration = 0.2 + Math.min(size * 0.1, 0.8);
    const filterStart = 1000 - Math.min(size * 100, 800); // Larger = deeper
    const vol = Math.min(0.4, 0.1 + size * 0.05);

    playNoise(duration, vol, filterStart);
};

export const playHitSound = () => {
    initAudio();
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);

    gain.gain.setValueAtTime(0.2, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);

    osc.start(t);
    osc.stop(t + 0.1);
};

export const playPowerupSound = () => {
    initAudio();
    if (!audioCtx || !masterGain) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(masterGain);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, t);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.4);

    gain.gain.setValueAtTime(0.1, t);
    gain.gain.linearRampToValueAtTime(0.01, t + 0.4);

    osc.start(t);
    osc.stop(t + 0.4);
};
