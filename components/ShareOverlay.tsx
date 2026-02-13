
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
    const [saving, setSaving] = useState(false);
    const [saveResult, setSaveResult] = useState<string | null>(null);

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

    const saveVideoFile = async () => {
        if (!videoBlob) return;
        setSaving(true);
        setSaveResult(null);
        try {
            const electronAPI = (window as any).electronAPI;
            if (electronAPI?.saveVideo) {
                const buffer = await videoBlob.arrayBuffer();
                const result = await electronAPI.saveVideo(Array.from(new Uint8Array(buffer)), `Bzoink1_Session_${Date.now()}.mp4`);
                if (result.success) {
                    setSaveResult(`Saved to ${result.path}`);
                } else if (result.canceled) {
                    setSaveResult(null);
                } else {
                    setSaveResult('Save failed');
                }
            } else {
                // Browser fallback
                const url = URL.createObjectURL(videoBlob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Bzoink1_Session_${Date.now()}.mp4`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setSaveResult('Download started');
            }
        } catch (err) {
            console.error('Save failed:', err);
            setSaveResult('Save failed');
        }
        setSaving(false);
        if (saveResult) setTimeout(() => setSaveResult(null), 4000);
    };

    // Platform "create new post" URLs
    const platformLinks = [
        {
            name: 'X (Twitter)',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>,
            url: `https://x.com/intent/post?text=${encodeURIComponent(postText)}`,
            bg: '#1a1a1a',
            hover: '#2a2a2a',
        },
        {
            name: 'Instagram',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z" /></svg>,
            url: 'https://www.instagram.com/',
            bg: '#833AB4',
            hover: '#9b4dca',
        },
        {
            name: 'Facebook',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" /></svg>,
            url: 'https://www.facebook.com/',
            bg: '#1877F2',
            hover: '#2d8cf5',
        },
        {
            name: 'Twitch',
            icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M11.571 4.714h1.715v5.143H11.57zm4.715 0H18v5.143h-1.714zM6 0L1.714 4.286v15.428h5.143V24l4.286-4.286h3.428L22.286 12V0zm14.571 11.143l-3.428 3.428h-3.429l-3 3v-3H6.857V1.714h13.714z" /></svg>,
            url: profile.twitch ? `https://www.twitch.tv/${profile.twitch}` : 'https://www.twitch.tv/',
            bg: '#6441A5',
            hover: '#7b5cba',
        },
    ];

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 200,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.92)',
            overflowY: 'auto',
        }}>

            {/* Close button */}
            <button onClick={onClose} style={{
                position: 'absolute', top: 24, right: 24, padding: 8,
                borderRadius: '50%', background: 'transparent', border: 'none',
                color: 'rgba(255,255,255,0.4)', cursor: 'pointer', zIndex: 10,
            }}>
                <X size={20} />
            </button>

            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 16, maxWidth: 440, width: '100%', padding: '32px 24px',
            }}>

                {/* Header */}
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ color: '#fff', fontSize: 28, fontWeight: 200, margin: 0, letterSpacing: -0.5 }}>Session Over</h2>
                    {profile.username && <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, margin: '4px 0 0' }}>{profile.username}</p>}
                    <p style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, letterSpacing: 3, textTransform: 'uppercase', margin: '6px 0 0' }}>Bzoink1 by Asvalin Games</p>
                </div>

                {/* Stats */}
                <div style={{ display: 'flex', gap: 32, alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#facc15', fontSize: 24, fontWeight: 300 }}>{wisdom}</div>
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Wisdom</div>
                    </div>
                    <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#f87171', fontSize: 24, fontWeight: 300 }}>{kills}</div>
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Kills</div>
                    </div>
                    <div style={{ width: 1, height: 28, background: 'rgba(255,255,255,0.1)' }} />
                    <div style={{ textAlign: 'center' }}>
                        <div style={{ color: '#22d3ee', fontSize: 24, fontWeight: 300 }}>{formatTime(timeSurvived)}</div>
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginTop: 4 }}>Survived</div>
                    </div>
                </div>

                {/* Video Preview — small, not autoplaying */}
                {videoURL && (
                    <div style={{ width: '100%', borderRadius: 8, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)', background: '#000', maxHeight: 160 }}>
                        <video
                            ref={videoRef}
                            src={videoURL}
                            controls
                            muted
                            preload="metadata"
                            style={{ width: '100%', maxHeight: 160, display: 'block', objectFit: 'cover' }}
                        />
                    </div>
                )}

                {/* Step 1: Save Video */}
                {videoBlob && (
                    <div style={{ width: '100%' }}>
                        <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Step 1 · Save your video</div>
                        <button onClick={saveVideoFile} disabled={saving} style={{
                            width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                            padding: '10px 12px', borderRadius: 8,
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)',
                            color: saving ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.6)',
                            fontSize: 12, cursor: saving ? 'default' : 'pointer',
                        }}>
                            <Download size={14} />
                            {saving ? 'Saving...' : 'Save Video'}
                        </button>
                        {saveResult && (
                            <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: 10, textAlign: 'center', marginTop: 4 }}>{saveResult}</div>
                        )}
                    </div>
                )}

                {/* Step 2: Copy Post */}
                <div style={{ width: '100%' }}>
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
                        {videoBlob ? 'Step 2' : 'Step 1'} · Copy your post
                    </div>
                    <div style={{
                        width: '100%', padding: 12, borderRadius: 8,
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        marginBottom: 8,
                    }}>
                        <pre style={{ color: 'rgba(255,255,255,0.35)', fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: 'inherit', margin: 0 }}>{postText}</pre>
                    </div>
                    <button onClick={copyPostText} style={{
                        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                        padding: '10px 12px', borderRadius: 8,
                        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.06)',
                        color: textCopied ? '#4ade80' : 'rgba(255,255,255,0.6)',
                        fontSize: 12, cursor: 'pointer',
                    }}>
                        {textCopied ? <Check size={14} /> : <Copy size={14} />}
                        {textCopied ? 'Copied to clipboard!' : 'Copy Post Text & Hashtags'}
                    </button>
                </div>

                {/* Step 3: Platform Links */}
                <div style={{ width: '100%' }}>
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>
                        {videoBlob ? 'Step 3' : 'Step 2'} · Share on your platform
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                        {platformLinks.map(p => (
                            <a key={p.name} href={p.url} target="_blank" rel="noopener noreferrer" style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                                padding: '10px 8px', borderRadius: 8,
                                background: p.bg, color: '#fff', fontSize: 12,
                                textDecoration: 'none', cursor: 'pointer',
                            }}>
                                {p.icon}
                                {p.name}
                                <ExternalLink size={9} style={{ opacity: 0.4 }} />
                            </a>
                        ))}
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 10, textAlign: 'center', marginTop: 6 }}>Paste your video & text on the platform</p>
                </div>

                {/* Play Again */}
                <button onClick={onPlayAgain} style={{
                    marginTop: 8, padding: '12px 40px',
                    border: '1px solid rgba(255,255,255,0.1)',
                    background: 'transparent', color: 'rgba(255,255,255,0.4)',
                    fontSize: 11, letterSpacing: 3, textTransform: 'uppercase',
                    borderRadius: 4, cursor: 'pointer',
                }}>
                    Play Again
                </button>
            </div>
        </div>
    );
};

export default ShareOverlay;
