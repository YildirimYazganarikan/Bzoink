
import React, { useState, useRef } from 'react';
import GameCanvas, { GameCanvasHandle } from './components/GameCanvas';
import SettingsMenu from './components/SettingsMenu';
import { GameSettings } from './types';
import { DEFAULT_SETTINGS } from './constants';
import { Settings2 } from 'lucide-react';
import { initAudio } from './utils/audio';

const App: React.FC = () => {
  const [settings, setSettings] = useState<GameSettings>(DEFAULT_SETTINGS);
  const [isPaused, setIsPaused] = useState(true); // Paused by default for landing
  const [isLanding, setIsLanding] = useState(true);
  const [gameState, setGameState] = useState({ health: DEFAULT_SETTINGS.maxHealth, score: 0 });
  
  const gameCanvasRef = useRef<GameCanvasHandle>(null);

  const togglePause = () => {
    if (isLanding) return;
    setIsPaused(prev => !prev);
  };

  const handleStart = () => {
    initAudio();
    setIsLanding(false);
    setIsPaused(false);
  };

  const handleUpdateStats = (health: number, score: number) => {
      setGameState({ health, score });
  };

  // Generate health dots (20 dots, each 5% of max health)
  const healthDots = [];
  const totalDots = 20;
  const healthPercentage = Math.max(0, gameState.health) / settings.maxHealth;
  const filledDots = Math.ceil(healthPercentage * totalDots);

  for (let i = 0; i < totalDots; i++) {
      healthDots.push(
          <div 
            key={i} 
            className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${i < filledDots ? 'bg-white' : 'bg-white/10'}`}
          />
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
      />

      {/* Landing Page Overlay */}
      {isLanding && (
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

      {/* Top HUD: Health & Score */}
      {!isPaused && !isLanding && (
          <div className="absolute top-8 left-0 w-full flex flex-col items-center pointer-events-none gap-2 z-10">
              <div className={`flex gap-1.5 transition-opacity duration-500 ${isDead ? 'opacity-0' : 'opacity-100'}`}>
                  {healthDots}
              </div>
              <div className={`text-white/40 text-xs tracking-[0.2em] font-light transition-all duration-500 ${isDead ? 'scale-150 text-white shadow-lg mt-8' : ''}`}>
                  WISDOM <span className={`font-medium ml-2 transition-colors duration-300 ${isDead ? 'text-yellow-400' : 'text-white'}`}>{gameState.score}</span>
              </div>
          </div>
      )}

      {/* Settings / Pause Menu (Docked Left) */}
      {isPaused && !isLanding && (
        <SettingsMenu 
          settings={settings} 
          onUpdate={setSettings} 
          onClearEnemies={() => gameCanvasRef.current?.clearEnemies()}
        />
      )}

      {/* Close/Pause Button */}
      {!isPaused && !isLanding && (
        <button 
          onClick={() => setIsPaused(true)}
          className="absolute top-6 right-6 p-2 rounded-full bg-black/20 hover:bg-zinc-800/50 text-white/30 hover:text-white transition-all backdrop-blur-sm border border-transparent hover:border-zinc-700 z-10"
        >
          <Settings2 size={20} />
        </button>
      )}

      {/* Resume Overlay Button for Pause State */}
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

    </div>
  );
};

export default App;
