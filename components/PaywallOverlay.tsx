
import React, { useState } from 'react';

interface PaywallOverlayProps {
    sessionsPlayed: number;
    maxFreeSessions: number;
    onUnlock: (email: string) => void;
    onOpenPayment: () => void;
}

const PaywallOverlay: React.FC<PaywallOverlayProps> = ({ sessionsPlayed, maxFreeSessions, onUnlock, onOpenPayment }) => {
    const [email, setEmail] = useState('');
    const [showEmailInput, setShowEmailInput] = useState(false);
    const [error, setError] = useState('');

    const handleUnlock = () => {
        const trimmed = email.trim().toLowerCase();
        if (!trimmed || !trimmed.includes('@') || !trimmed.includes('.')) {
            setError('Please enter a valid email');
            return;
        }
        setError('');
        onUnlock(trimmed);
    };

    return (
        <div style={{
            position: 'absolute', inset: 0, zIndex: 250,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.95)',
        }}>
            <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center',
                gap: 20, maxWidth: 400, width: '100%', padding: '40px 24px',
            }}>

                {/* Icon */}
                <div style={{ fontSize: 48, marginBottom: -8 }}>🔒</div>

                {/* Title */}
                <div style={{ textAlign: 'center' }}>
                    <h2 style={{ color: '#fff', fontSize: 26, fontWeight: 200, margin: 0, letterSpacing: -0.5 }}>
                        Trial Complete
                    </h2>
                    <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, margin: '8px 0 0' }}>
                        You've played {sessionsPlayed} of {maxFreeSessions} free sessions
                    </p>
                </div>

                {/* Message */}
                <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: 13, textAlign: 'center', lineHeight: 1.6, margin: 0 }}>
                    Unlock <span style={{ color: '#fff', fontWeight: 500 }}>Bzoink1</span> forever with a one-time purchase.
                    <br />No subscriptions, no limits.
                </p>

                {/* Buy button */}
                <button onClick={onOpenPayment} style={{
                    width: '100%', padding: '14px 20px',
                    background: '#fff', color: '#000',
                    fontSize: 13, fontWeight: 600, letterSpacing: 1,
                    textTransform: 'uppercase',
                    border: 'none', borderRadius: 6, cursor: 'pointer',
                }}>
                    Unlock Bzoink1 — $4.99
                </button>

                {/* Already purchased */}
                {!showEmailInput ? (
                    <button onClick={() => setShowEmailInput(true)} style={{
                        background: 'none', border: 'none',
                        color: 'rgba(255,255,255,0.3)', fontSize: 11,
                        cursor: 'pointer', textDecoration: 'underline',
                    }}>
                        Already purchased? Enter your email
                    </button>
                ) : (
                    <div style={{ width: '100%' }}>
                        <div style={{ display: 'flex', gap: 8 }}>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => { setEmail(e.target.value); setError(''); }}
                                onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                                placeholder="Purchase email..."
                                autoFocus
                                style={{
                                    flex: 1, padding: '10px 14px',
                                    background: 'rgba(255,255,255,0.06)',
                                    border: '1px solid rgba(255,255,255,0.1)',
                                    borderRadius: 6, color: '#fff', fontSize: 13,
                                    outline: 'none',
                                }}
                            />
                            <button onClick={handleUnlock} style={{
                                padding: '10px 18px',
                                background: 'rgba(255,255,255,0.1)',
                                border: '1px solid rgba(255,255,255,0.1)',
                                borderRadius: 6, color: '#fff', fontSize: 12,
                                cursor: 'pointer',
                            }}>
                                Unlock
                            </button>
                        </div>
                        {error && <p style={{ color: '#f87171', fontSize: 11, margin: '6px 0 0' }}>{error}</p>}
                    </div>
                )}

                {/* Footer */}
                <p style={{ color: 'rgba(255,255,255,0.15)', fontSize: 9, letterSpacing: 2, textTransform: 'uppercase', margin: '8px 0 0' }}>
                    Bzoink1 by Asvalin Games · www.asvalingames.com
                </p>
            </div>
        </div>
    );
};

export default PaywallOverlay;
