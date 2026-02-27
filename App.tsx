
import React, { useState, useRef, useCallback, useEffect } from 'react';
import GameCanvas, { GameCanvasHandle } from './components/GameCanvas';
import SettingsMenu from './components/SettingsMenu';
import ShareOverlay from './components/ShareOverlay';
import PaywallOverlay from './components/PaywallOverlay';
import { GameSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { Settings2, Maximize, Minimize } from 'lucide-react';
import { initAudio, getAudioStream } from './utils/audio';

// ---- User Profile (localStorage) ----
interface UserProfile {
  username: string;
  instagram: string;
  facebook: string;
  twitch: string;
  x: string;
}

const PROFILE_KEY = 'bzoink1_profile';

const loadProfile = (): UserProfile => {
  try {
    const saved = localStorage.getItem(PROFILE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { }
  return { username: '', instagram: '', facebook: '', twitch: '', x: '' };
};

const saveProfile = (profile: UserProfile) => {
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
};

// ---- Session / Unlock (localStorage) ----
const MAX_FREE_SESSIONS = 30;
const SESSION_KEY = 'bzoink1_sessions';
const UNLOCK_KEY = 'bzoink1_unlocked';
const STRIPE_PAYMENT_URL = 'https://buy.stripe.com/test_5kQ4gBgDH0oVdi40fdfQI00';

const getSessionCount = (): number => {
  try { return parseInt(localStorage.getItem(SESSION_KEY) || '0', 10); } catch { return 0; }
};
const incrementSession = (): number => {
  const count = getSessionCount() + 1;
  localStorage.setItem(SESSION_KEY, String(count));
  return count;
};
const isGameUnlocked = (): boolean => {
  return localStorage.getItem(UNLOCK_KEY) === 'true';
};
const unlockGame = (email: string) => {
  localStorage.setItem(UNLOCK_KEY, 'true');
  localStorage.setItem('bzoink1_purchase_email', email);
};

const App: React.FC = () => {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [isPaused, setIsPaused] = useState(true);
  const [isLanding, setIsLanding] = useState(true);
  const [gameState, setGameState] = useState({ health: DEFAULT_SETTINGS.maxHealth, score: 0, kills: 0 });
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Session / paywall
  const [sessionsPlayed, setSessionsPlayed] = useState(getSessionCount);
  const [unlocked, setUnlocked] = useState(isGameUnlocked);
  const [showPaywall, setShowPaywall] = useState(false);

  // Username prompt
  const [profile, setProfile] = useState<UserProfile>(loadProfile);
  const [showUsernamePrompt, setShowUsernamePrompt] = useState(false);
  const [usernameInput, setUsernameInput] = useState('');

  // Game Over / Share state
  const [showGameOver, setShowGameOver] = useState(false);
  const [sessionStats, setSessionStats] = useState({ wisdom: 0, kills: 0, timeSurvived: 0 });
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  // Screen recording refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const isRecordingRef = useRef(false);
  const recordingMimeRef = useRef('video/mp4');

  const gameCanvasRef = useRef<GameCanvasHandle>(null);

  // Show username prompt if no username set
  useEffect(() => {
    if (!profile.username) {
      setShowUsernamePrompt(true);
    }
  }, []);

  const handleSaveUsername = () => {
    const name = usernameInput.trim();
    if (name) {
      const updated = { ...profile, username: name };
      setProfile(updated);
      saveProfile(updated);
      setShowUsernamePrompt(false);
    }
  };

  const handleProfileUpdate = (updated: UserProfile) => {
    setProfile(updated);
    saveProfile(updated);
  };

  const togglePause = () => {
    if (isLanding) return;
    setIsPaused(prev => !prev);
  };

  // Start screen recording with audio
  const startRecording = () => {
    try {
      const canvas = document.querySelector('canvas');
      if (!canvas) return;

      const videoStream = canvas.captureStream(60);
      const audioStream = getAudioStream();

      // Merge video + audio streams
      let combinedStream: MediaStream;
      if (audioStream) {
        const tracks = [
          ...videoStream.getVideoTracks(),
          ...audioStream.getAudioTracks()
        ];
        combinedStream = new MediaStream(tracks);
      } else {
        combinedStream = videoStream;
      }

      // Prefer MP4, fall back to WebM
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,opus')
        ? 'video/mp4;codecs=avc1,opus'
        : MediaRecorder.isTypeSupported('video/mp4')
          ? 'video/mp4'
          : MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
            ? 'video/webm;codecs=vp9,opus'
            : 'video/webm';

      recordingMimeRef.current = mimeType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';

      const mediaRecorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: 8_000_000
      });

      recordedChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          recordedChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: recordingMimeRef.current });
        setRecordedBlob(blob);
        isRecordingRef.current = false;
      };

      mediaRecorder.start(1000);
      mediaRecorderRef.current = mediaRecorder;
      isRecordingRef.current = true;
    } catch (err) {
      console.warn('Recording not supported:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }
  };

  const handleStart = () => {
    // Check if trial exhausted
    if (!unlocked && sessionsPlayed >= MAX_FREE_SESSIONS) {
      setShowPaywall(true);
      return;
    }
    const newCount = incrementSession();
    setSessionsPlayed(newCount);
    initAudio();
    setIsLanding(false);
    setIsPaused(false);
    setShowGameOver(false);
    setRecordedBlob(null);
    setTimeout(startRecording, 100);
  };

  const handleUpdateStats = (health: number, score: number, kills: number) => {
    setGameState({ health, score, kills });
  };

  const handleGameOver = useCallback((stats: { wisdom: number; kills: number; timeSurvived: number }) => {
    setSessionStats(stats);
    // Delay stop by 2s to capture the death explosion
    setTimeout(() => {
      stopRecording();
      // Then show game over after recording finalizes
      setTimeout(() => {
        setIsPaused(true); // Pause the game while showing Game Over
        setShowGameOver(true);
      }, 500);
    }, 2000);
  }, []);

  const handlePlayAgain = () => {
    // Check paywall before allowing another game
    if (!unlocked && sessionsPlayed >= MAX_FREE_SESSIONS) {
      setShowGameOver(false);
      setShowPaywall(true);
      return;
    }
    const newCount = incrementSession();
    setSessionsPlayed(newCount);
    setShowGameOver(false);
    setIsPaused(false);
    setRecordedBlob(null);
    setGameState({ health: settings.maxHealth, score: 0, kills: 0 });
    setTimeout(startRecording, 100);
  };

  const handleCloseGameOver = () => {
    setShowGameOver(false);
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => { });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => { });
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  // Close settings menu on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isPaused && !isLanding && !showGameOver) {
        setIsPaused(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isPaused, isLanding, showGameOver]);

  // Health dots
  const healthDots = [];
  const totalDots = 20;
  const healthPercentage = Math.max(0, gameState.health) / settings.maxHealth;
  const filledDots = Math.ceil(healthPercentage * totalDots);
  for (let i = 0; i < totalDots; i++) {
    healthDots.push(
      <div key={i} className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i < filledDots ? 'bg-white' : 'bg-white/10'}`} />
    );
  }

  const isDead = gameState.health <= 0;

  return (
    <div className="relative w-screen h-screen overflow-hidden font-sans select-none bg-black">

      {/* Game Layer */}
      <GameCanvas
        ref={gameCanvasRef}
        settings={settings}
        isPaused={isPaused}
        onTogglePause={togglePause}
        onUpdateStats={handleUpdateStats}
        onGameOver={handleGameOver}
      />

      {/* Username Prompt Overlay */}
      {showUsernamePrompt && (
        <div className="absolute inset-0 z-[300] flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.95)' }}>
          <div className="flex flex-col items-center gap-6 max-w-sm w-full px-6">
            <h2 className="text-white text-2xl font-extralight tracking-tight">Welcome, Survivor</h2>
            <p className="text-white/30 text-xs tracking-wide text-center">Enter your username to begin</p>
            <input
              type="text"
              value={usernameInput}
              onChange={(e) => setUsernameInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveUsername()}
              placeholder="Your username..."
              autoFocus
              className="w-full bg-transparent border-b border-white/20 focus:border-white/60 text-white text-center text-lg py-3 outline-none placeholder:text-white/15 transition-colors"
              maxLength={20}
            />
            <button
              onClick={handleSaveUsername}
              disabled={!usernameInput.trim()}
              className="px-10 py-3 border border-white/10 hover:border-white/40 text-white/40 hover:text-white transition-all text-xs tracking-[0.3em] uppercase hover:bg-white/5 rounded disabled:opacity-20 disabled:hover:border-white/10 disabled:hover:text-white/40 disabled:hover:bg-transparent"
            >
              Continue
            </button>
          </div>
        </div>
      )}

      {/* Landing Page Overlay */}
      {isLanding && !showUsernamePrompt && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black z-[100] transition-opacity duration-1000">
          <h1 className="text-white text-7xl font-extralight tracking-tighter mb-2 animate-pulse">Bzoink1</h1>
          <p className="text-white/30 text-[10px] tracking-[0.5em] uppercase mb-16 font-light">by Asvalin Games</p>
          <button
            onClick={handleStart}
            className="px-12 py-3 border border-white/10 hover:border-white/40 text-white/40 hover:text-white transition-all text-xs tracking-[0.3em] uppercase hover:bg-white/5"
          >
            Enter Nebula
          </button>
        </div>
      )}

      {/* Top HUD: Health, Score, Kills & Username */}
      {!isPaused && !isLanding && (
        <div className="absolute top-8 left-0 w-full flex flex-col items-center pointer-events-none gap-2 z-10">
          <div className={`flex gap-1.5 transition-opacity duration-500 ${isDead ? 'opacity-0' : 'opacity-100'}`}>
            {healthDots}
          </div>
          {/* Username */}
          {profile.username && (
            <div className="text-white/20 text-[9px] tracking-[0.4em] uppercase font-light">
              {profile.username}
            </div>
          )}
          <div className={`flex gap-6 items-center transition-all duration-500 ${isDead ? 'scale-150 text-white shadow-lg mt-8' : ''}`}>
            <div className="text-white/40 text-xs tracking-[0.2em] font-light">
              WISDOM <span className={`font-medium ml-2 transition-colors duration-300 ${isDead ? 'text-yellow-400' : 'text-white'}`}>{gameState.score}</span>
            </div>
            <div className="text-white/40 text-xs tracking-[0.2em] font-light">
              KILLS <span className={`font-medium ml-2 transition-colors duration-300 ${isDead ? 'text-red-400' : 'text-white'}`}>{gameState.kills}</span>
            </div>
          </div>
          {/* Remaining sessions indicator (only show if not unlocked) */}
          {!unlocked && (
            <div className="text-white/15 text-[8px] tracking-[0.3em] uppercase mt-1">
              {Math.max(0, MAX_FREE_SESSIONS - sessionsPlayed)} sessions remaining
            </div>
          )}
        </div>
      )}

      {/* Settings / Pause Menu with click-outside-to-close backdrop */}
      {isPaused && !isLanding && !showGameOver && (
        <>
          {/* Backdrop — click to close settings */}
          <div
            className="absolute inset-0 z-40"
            onClick={() => setIsPaused(false)}
          />
          <SettingsMenu
            settings={settings}
            onUpdate={setSettings}
            onClearEnemies={() => gameCanvasRef.current?.clearEnemies()}
            profile={profile}
            onProfileUpdate={handleProfileUpdate}
          />
        </>
      )}

      {/* Top-Right Buttons */}
      {!isPaused && !isLanding && (
        <div className="absolute top-6 right-6 flex gap-2 z-10">
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full bg-black/20 hover:bg-zinc-800/50 text-white/30 hover:text-white transition-all backdrop-blur-sm border border-transparent hover:border-zinc-700"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={20} /> : <Maximize size={20} />}
          </button>
          <button
            onClick={() => setIsPaused(true)}
            className="p-2 rounded-full bg-black/20 hover:bg-zinc-800/50 text-white/30 hover:text-white transition-all backdrop-blur-sm border border-transparent hover:border-zinc-700"
          >
            <Settings2 size={20} />
          </button>
        </div>
      )}

      {/* Recording indicator */}
      {isRecordingRef.current && !isPaused && !isLanding && !isDead && (
        <div className="absolute top-6 left-6 flex items-center gap-2 z-10 pointer-events-none">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-white/30 text-[9px] tracking-[0.2em] uppercase">REC</span>
        </div>
      )}

      {/* Resume Button */}
      {isPaused && !isLanding && (
        <button
          onClick={() => setIsPaused(false)}
          className="absolute top-6 right-6 p-2 rounded-full bg-white text-black hover:bg-zinc-200 transition-all z-[60]"
        >
          <div className="w-5 h-5 flex items-center justify-center">
            <div className="border-l-[6px] border-l-black border-y-[6px] border-y-transparent ml-1" />
          </div>
        </button>
      )}

      {/* Game Over / Share Overlay */}
      {showGameOver && (
        <ShareOverlay
          wisdom={sessionStats.wisdom}
          kills={sessionStats.kills}
          timeSurvived={sessionStats.timeSurvived}
          videoBlob={recordedBlob}
          profile={profile}
          onPlayAgain={handlePlayAgain}
          onClose={handleCloseGameOver}
        />
      )}

      {/* Paywall Overlay */}
      {showPaywall && (
        <PaywallOverlay
          sessionsPlayed={sessionsPlayed}
          maxFreeSessions={MAX_FREE_SESSIONS}
          onUnlock={(email) => {
            unlockGame(email);
            setUnlocked(true);
            setShowPaywall(false);
          }}
          onOpenPayment={() => {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI?.openExternal) {
              electronAPI.openExternal(STRIPE_PAYMENT_URL);
            } else {
              window.open(STRIPE_PAYMENT_URL, '_blank');
            }
          }}
        />
      )}

    </div>
  );
};

export default App;
