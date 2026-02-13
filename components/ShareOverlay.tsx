
import React, { useRef, useEffect, useState } from 'react';
import { Download, X, Copy, Check, ExternalLink } from 'lucide-react';

interface UserProfile {
    username: string;
    instagram: string;
    facebook: string;
    twitch: string;
    x: string;
}

interface ShareOverlayProps {
    wisdom: number;
    kills: number;
    timeSurvived: number;
    videoBlob: Blob | null;
    profile: UserProfile;
    onPlayAgain: () => void;
    onClose: () => void;
}

const formatTime = (seconds: number): string => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
};

const ShareOverlay: React.FC<ShareOverlayProps> = ({ wisdom, kills, timeSurvived, videoBlob, profile, onPlayAgain, onClose }) => {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [videoURL, setVideoURL] = useState<string | null>(null);
    const [textCopied, setTextCopied] = useState(false);
    const [videoCopied, setVideoCopied] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (videoBlob) {
            const url = URL.createObjectURL(videoBlob);
            setVideoURL(url);
            return () => URL.revokeObjectURL(url);
        }
    }, [videoBlob]);

    // Build the full share post text
    const buildPostText = (): string => {
        const lines = [
            `Checkout my Bzoink1 Session, a game by asvalingames!`,
            ``,
            `🏆 Wisdom: ${wisdom} | ⚔️ Kills: ${kills} | ⏱️ Time: ${formatTime(timeSurvived)}`,
        ];
        if (profile.username) lines.push(`🎮 Player: ${profile.username}`);
        lines.push(``);
        lines.push(`🌐 www.asvalingames.com`);
        lines.push(``);
        // Include user handles if set
        const handles: string[] = [];
        if (profile.instagram) handles.push(`IG: ${profile.instagram}`);
        if (profile.x) handles.push(`X: ${profile.x}`);
        if (profile.twitch) handles.push(`Twitch: ${profile.twitch}`);
        if (profile.facebook) handles.push(`FB: ${profile.facebook}`);
        if (handles.length > 0) {
            lines.push(handles.join(' | '));
            lines.push(``);
        }
        lines.push(`#Bzoink1 #NebulaSurvivor #AsvalinGames #IndieGame #Gaming`);
        return lines.join('\n');
    };

    const postText = buildPostText();

    const copyPostText = () => {
        navigator.clipboard.writeText(postText);
        setTextCopied(true);
        setTimeout(() => setTextCopied(false), 2500);
    };

    const copyVideoToClipboard = async () => {
        if (!videoBlob) return;
        try {
            // ClipboardItem with video isn't widely supported, so we copy as file
            // Most browsers don't support video in clipboard — fall back to download
            await navigator.clipboard.write([
                new ClipboardItem({ [videoBlob.type]: videoBlob })
            ]);
            setVideoCopied(true);
            setTimeout(() => setVideoCopied(false), 2500);
        } catch {
            // Fallback: trigger download instead
            saveVideoFile();
        }
    };

    const saveVideoFile = async () => {
        if (!videoBlob) return;
        setSaving(true);
        try {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI?.saveVideo) {
                const buffer = await videoBlob.arrayBuffer();
                await electronAPI.saveVideo(Array.from(new Uint8Array(buffer)), `Bzoink1_Session_${Date.now()}.mp4`);
            } else {
                const url = URL.createObjectURL(videoBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Bzoink1_Session_${Date.now()}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Save failed:', err);
        }
        setSaving(false);
    };

    // Platform "create new post" URLs
    const platformLinks = [
        {
            name: 'X (Twitter)',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
            // X compose with pre-filled text
            url: `https://x.com/intent/post?text=${encodeURIComponent(postText)}`,
            color: 'bg-zinc-800 hover:bg-zinc-700',
        },
        {
            name: 'Instagram',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>,
            // Instagram doesn't have a create-post URL, link to profile or app
            url: 'https://www.instagram.com/create/style/',
            color: 'bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-500 hover:to-pink-400',
        },
        {
            name: 'Facebook',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
            // Facebook share dialog
            url: 'https://www.facebook.com/sharer/sharer.php?quote=' + encodeURIComponent(postText),
            color: 'bg-blue-600 hover:bg-blue-500',
        },
        {
            name: 'Twitch',
            icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" /></svg>,
            url: profile.twitch ? `https://www.twitch.tv/${profile.twitch}` : 'https://www.twitch.tv/',
            color: 'bg-purple-700 hover:bg-purple-600',
        },
    ];

    return (
        <div className="absolute inset-0 z-[200] flex items-center justify-center overflow-y-auto" style={{ backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(16px)' }}>

            <button onClick={onClose} className="absolute top-6 right-6 p-2 rounded-full hover:bg-white/10 text-white/40 hover:text-white transition-all z-10">
                <X size={20} />
            </button>

            <div className="flex flex-col items-center gap-5 max-w-lg w-full px-6 py-10">

                {/* Header */}
                <div className="text-center">
                    <h2 className="text-white text-3xl font-extralight tracking-tight mb-1">Session Over</h2>
                    {profile.username && <p className="text-white/50 text-sm font-light">{profile.username}</p>}
                    <p className="text-white/20 text-[9px] tracking-[0.4em] uppercase mt-1">Bzoink1 by Asvalin Games</p>
                </div>

                {/* Stats */}
                <div className="flex gap-8 items-center justify-center">
                    <div className="text-center">
                        <div className="text-yellow-400 text-2xl font-light">{wisdom}</div>
                        <div className="text-white/25 text-[9px] tracking-[0.3em] uppercase mt-1">Wisdom</div>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="text-center">
                        <div className="text-red-400 text-2xl font-light">{kills}</div>
                        <div className="text-white/25 text-[9px] tracking-[0.3em] uppercase mt-1">Kills</div>
                    </div>
                    <div className="w-px h-8 bg-white/10" />
                    <div className="text-center">
                        <div className="text-cyan-400 text-2xl font-light">{formatTime(timeSurvived)}</div>
                        <div className="text-white/25 text-[9px] tracking-[0.3em] uppercase mt-1">Survived</div>
                    </div>
                </div>

                {/* Video Preview */}
                {videoURL && (
                    <div className="w-full rounded-lg overflow-hidden border border-white/10 bg-black/60" style={{ maxHeight: '180px' }}>
                        <video ref={videoRef} src={videoURL} controls autoPlay muted loop className="w-full h-full object-cover" style={{ maxHeight: '180px' }} />
                    </div>
                )}

                {/* Step 1: Get Your Video */}
                <div className="w-full">
                    <div className="text-white/30 text-[9px] tracking-[0.3em] uppercase mb-2">Step 1 · Get your video</div>
                    <div className="flex gap-2">
                        {videoBlob && (
                            <>
                                <button onClick={saveVideoFile} disabled={saving}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white text-xs tracking-wide transition-all border border-white/[0.06] disabled:opacity-50">
                                    <Download size={14} />
                                    {saving ? 'Saving...' : 'Download Video'}
                                </button>
                                <button onClick={copyVideoToClipboard}
                                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white text-xs tracking-wide transition-all border border-white/[0.06]">
                                    {videoCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                                    {videoCopied ? 'Copied!' : 'Copy Video'}
                                </button>
                            </>
                        )}
                        {!videoBlob && (
                            <div className="flex-1 flex items-center justify-center py-3 text-white/15 text-xs">No recording available</div>
                        )}
                    </div>
                </div>

                {/* Step 2: Copy Post Text */}
                <div className="w-full">
                    <div className="text-white/30 text-[9px] tracking-[0.3em] uppercase mb-2">Step 2 · Copy your post</div>
                    <div className="w-full p-3 rounded-lg bg-white/[0.03] border border-white/[0.06] mb-2">
                        <pre className="text-white/40 text-[11px] leading-relaxed whitespace-pre-wrap font-sans">{postText}</pre>
                    </div>
                    <button onClick={copyPostText}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white/60 hover:text-white text-xs tracking-wide transition-all border border-white/[0.06]">
                        {textCopied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                        {textCopied ? 'Copied to clipboard!' : 'Copy Post Text & Hashtags'}
                    </button>
                </div>

                {/* Step 3: Post to Platform */}
                <div className="w-full">
                    <div className="text-white/30 text-[9px] tracking-[0.3em] uppercase mb-2">Step 3 · Share on your platform</div>
                    <div className="grid grid-cols-2 gap-2">
                        {platformLinks.map(p => (
                            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer"
                                className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-white text-xs tracking-wide transition-all ${p.color}`}>
                                {p.icon}
                                {p.name}
                                <ExternalLink size={10} className="opacity-40" />
                            </a>
                        ))}
                    </div>
                    <p className="text-white/15 text-[10px] text-center mt-2">Paste your video & text on the platform</p>
                </div>

                {/* Play Again */}
                <button onClick={onPlayAgain}
                    className="mt-3 px-10 py-3 border border-white/10 hover:border-white/40 text-white/40 hover:text-white transition-all text-xs tracking-[0.3em] uppercase hover:bg-white/5 rounded">
                    Play Again
                </button>
            </div>
        </div>
    );
};

export default ShareOverlay;
