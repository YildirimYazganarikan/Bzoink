
import React, { useState } from 'react';
import { GameSettings, WeaponType } from '../types';
import { Copy, Check, RotateCcw } from 'lucide-react';
import { DEFAULT_SETTINGS } from '../constants';

interface UserProfile {
  username: string;
  instagram: string;
  facebook: string;
  twitch: string;
  x: string;
}

interface SettingsMenuProps {
  settings: GameSettings;
  onUpdate: (newSettings: GameSettings) => void;
  onClearEnemies: () => void;
  profile?: UserProfile;
  onProfileUpdate?: (profile: UserProfile) => void;
}

const SettingsMenu: React.FC<SettingsMenuProps> = ({ settings, onUpdate, onClearEnemies, profile, onProfileUpdate }) => {
  const [copied, setCopied] = useState(false);

  const handleChange = (key: keyof GameSettings, value: string | number | boolean) => {
    onUpdate({
      ...settings,
      [key]: value,
    });
  };

  const handleProfileChange = (key: keyof UserProfile, value: string) => {
    if (profile && onProfileUpdate) {
      onProfileUpdate({ ...profile, [key]: value });
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(JSON.stringify(settings, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetDefaults = () => {
    onUpdate(DEFAULT_SETTINGS);
  };

  const renderColorInput = (label: string, key: keyof GameSettings) => (
    <div className="flex items-center justify-between mb-2">
      <label className="text-zinc-500 text-xs uppercase tracking-wider">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={settings[key] as string}
          onChange={(e) => handleChange(key, e.target.value)}
          className="w-6 h-6 rounded cursor-pointer bg-transparent border-none outline-none"
        />
      </div>
    </div>
  );

  const renderNumberInput = (label: string, key: keyof GameSettings, min: number, max: number, step: number = 1) => (
    <div className="mb-4">
      <div className="flex justify-between mb-1">
        <label className="text-zinc-500 text-xs uppercase tracking-wider">{label}</label>
        <span className="text-zinc-400 text-xs font-mono">{typeof settings[key] === 'number' ? (settings[key] as number).toFixed(step < 0.001 ? 4 : (step < 1 ? 3 : 0)) : settings[key]}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={settings[key] as number}
        onChange={(e) => handleChange(key, parseFloat(e.target.value))}
        className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
      />
    </div>
  );

  const renderToggle = (label: string, key: keyof GameSettings) => (
    <div className="flex items-center justify-between mb-4">
      <label className="text-zinc-500 text-xs uppercase tracking-wider">{label}</label>
      <button
        onClick={() => handleChange(key, !settings[key])}
        className={`w-10 h-5 rounded-full relative transition-colors duration-300 ${settings[key] ? 'bg-white' : 'bg-zinc-800'}`}
      >
        <div className={`absolute top-1 left-1 w-3 h-3 rounded-full bg-black transition-transform duration-300 ${settings[key] ? 'translate-x-5' : 'translate-x-0'}`} />
      </button>
    </div>
  );

  const renderSpawnRateInput = () => {
    const currentRate = settings.enemySpawnRate > 0 ? Math.round(60000 / settings.enemySpawnRate) : 0;
    return (
      <div className="mb-4">
        <div className="flex justify-between mb-1">
          <label className="text-zinc-500 text-xs uppercase tracking-wider">Spawn Rate</label>
          <span className="text-zinc-400 text-xs font-mono">{currentRate}/min</span>
        </div>
        <input
          type="range"
          min={10} max={1200} step={10}
          value={currentRate}
          onChange={(e) => {
            const val = parseFloat(e.target.value);
            if (val > 0) handleChange("enemySpawnRate", 60000 / val);
          }}
          className="w-full h-1 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-white"
        />
      </div>
    );
  };

  const renderWeaponSelector = () => {
    const weapons: WeaponType[] = ['blaster', 'shotgun', 'machinegun', 'nuke', 'sniper'];
    return (
      <div className="mb-4">
        <label className="text-zinc-500 text-xs uppercase tracking-wider block mb-2">Active Gun</label>
        <div className="grid grid-cols-3 gap-2">
          {weapons.map(w => (
            <button
              key={w}
              onClick={() => handleChange('activeWeapon', w)}
              className={`text-[10px] uppercase py-2 px-1 rounded border transition-colors ${settings.activeWeapon === w
                ? 'bg-white text-black border-white'
                : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:border-zinc-700'}`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderTextInput = (label: string, value: string, placeholder: string, onChange: (val: string) => void) => (
    <div className="mb-3">
      <label className="text-zinc-500 text-[10px] uppercase tracking-wider block mb-1">{label}</label>
      <input
        type="text"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-zinc-900 border border-zinc-800 rounded px-3 py-1.5 text-xs text-white placeholder:text-zinc-700 outline-none focus:border-zinc-600 transition-colors"
      />
    </div>
  );

  return (
    <div className="absolute top-0 left-0 h-full w-80 z-50 flex flex-col bg-black/80 border-r border-zinc-900 text-zinc-200 shadow-2xl">
      <div className="p-6 border-b border-zinc-900">
        <h2 className="text-lg font-light tracking-widest text-white uppercase">Settings</h2>
        <div className="flex gap-4 mt-4">
          <button onClick={resetDefaults} className="text-zinc-500 hover:text-white transition-colors text-xs flex items-center gap-1">
            <RotateCcw size={12} /> Reset
          </button>
          <button onClick={copyToClipboard} className="text-zinc-500 hover:text-white transition-colors text-xs flex items-center gap-1">
            {copied ? <Check size={12} className="text-green-500" /> : <Copy size={12} />} Copy JSON
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">

        {/* Profile & Social Section */}
        {profile && onProfileUpdate && (
          <section>
            <h3 className="text-white text-sm font-medium mb-4">Profile & Socials</h3>
            {renderTextInput("Username", profile.username, "Your username", (v) => handleProfileChange('username', v))}
            {renderTextInput("Instagram", profile.instagram, "@username", (v) => handleProfileChange('instagram', v))}
            {renderTextInput("Facebook", profile.facebook, "username or page", (v) => handleProfileChange('facebook', v))}
            {renderTextInput("Twitch", profile.twitch, "username", (v) => handleProfileChange('twitch', v))}
            {renderTextInput("X (Twitter)", profile.x, "@handle", (v) => handleProfileChange('x', v))}
          </section>
        )}

        <section>
          <h3 className="text-white text-sm font-medium mb-4">Game Modes</h3>
          {renderToggle("Draining Bullets", "modeDrainingBullets")}
          {renderToggle("Dark Mode", "modeDark")}
          {renderToggle("Stealth Mode", "modeStealth")}
        </section>

        <section>
          <h3 className="text-white text-sm font-medium mb-4">Audio</h3>
          {renderNumberInput("Master Volume", "masterVolume", 0, 1, 0.05)}
        </section>

        <section>
          <h3 className="text-white text-sm font-medium mb-4">Player</h3>
          {renderColorInput("Color", "playerColor")}
          {renderNumberInput("Radius", "playerRadius", 5, 50)}
          {renderNumberInput("Speed", "playerSpeed", 50, 1000)}
          {renderNumberInput("Max Health", "maxHealth", 1, 200)}
          {renderNumberInput("Glow", "playerGlow", 0, 100)}
        </section>

        <section>
          <h3 className="text-white text-sm font-medium mb-4">Combat</h3>
          {renderWeaponSelector()}
          {renderColorInput("Proj Color", "projectileColor")}
          {renderNumberInput("Proj Speed", "projectileSpeed", 100, 2000)}
          {renderNumberInput("Proj Radius", "projectileRadius", 1, 20)}
          {renderNumberInput("Fire Rate", "projectileFireRate", 20, 1000)}
          {renderNumberInput("Bounces", "projectileBounces", 0, 10, 1)}
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-white text-sm font-medium">Enemies</h3>
            <button onClick={onClearEnemies} className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 rounded transition-colors">
              Clear Enemies
            </button>
          </div>
          {renderColorInput("Color", "enemyColor")}
          {renderNumberInput("Radius", "enemyRadius", 5, 50)}
          {renderNumberInput("Speed", "enemySpeed", 10, 600)}
          {renderSpawnRateInput()}
          {renderNumberInput("Difficulty Increase", "enemySpawnIncreaseRate", 0, 100)}
        </section>

        <section>
          <h3 className="text-white text-sm font-medium mb-4">Visuals</h3>
          {renderColorInput("Background", "backgroundColor")}
          {renderColorInput("Line Color", "cursorLineColor")}
          {renderNumberInput("Line Width", "cursorLineWidth", 0.1, 10, 0.1)}
          {renderNumberInput("Line Opacity", "cursorLineOpacity", 0, 1, 0.05)}
          {renderNumberInput("Shake Intensity", "screenShakeIntensity", 0, 50)}
          {renderNumberInput("Grid Distortion", "gridDistortion", 0, 0.1, 0.0001)}
          {renderNumberInput("Grid Spacing (Density)", "gridSpacing", 20, 150, 5)}
        </section>

        <section>
          <h3 className="text-white text-sm font-medium mb-4">Particles</h3>
          {renderColorInput("Color", "particleColor")}
          {renderNumberInput("Size", "particleSize", 1, 10, 0.5)}
          {renderNumberInput("Count", "particleCount", 1, 50)}
          {renderNumberInput("Death Amount (x Radius)", "enemyDeathParticleMultiplier", 0.1, 5, 0.1)}
          {renderNumberInput("Speed", "particleSpeed", 100, 1000)}
          {renderNumberInput("Life", "particleLife", 1, 60)}
          {renderNumberInput("Drag", "particleDrag", 0.8, 0.99, 0.01)}
        </section>

        <section>
          <h3 className="text-white text-sm font-medium mb-4">Perks & Quotes</h3>
          {renderNumberInput("Perk Chance (0-1)", "perkSpawnChance", 0, 1, 0.05)}
          {renderNumberInput("Perk Duration (ms)", "perkDuration", 1000, 20000, 500)}
          {renderNumberInput("Quote Interval (ms)", "quoteSpawnInterval", 5000, 120000, 1000)}
        </section>

        <section>
          <h3 className="text-white text-sm font-medium mb-4">Nuke</h3>
          {renderNumberInput("Blast Radius", "nukeBlastRadius", 100, 2000, 50)}
          {renderNumberInput("Distortion", "nukeDistortionStrength", 0, 0.5, 0.01)}
        </section>
      </div>
    </div>
  );
};

export default SettingsMenu;
