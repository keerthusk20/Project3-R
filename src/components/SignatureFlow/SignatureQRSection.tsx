// src/components/SignatureFlow/SignatureQRSection.tsx
    import React, { useState, useEffect } from 'react';
    import QRCode from 'react-qr-code';
    import { doc, onSnapshot } from 'firebase/firestore';
    import { db } from '../../services/firebase'; // Check if this path is correct

    interface SignatureQRSectionProps {
    onSignatureChange: (url: string | null) => void;
    disabled?: boolean;
    }

    export default function SignatureQRSection({ onSignatureChange, disabled     }: SignatureQRSectionProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [sessionId, setSessionId] = useState<string>('');
    const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
    const [isSigned, setIsSigned] = useState(false);

    // Generate Session ID when opening modal
    const openModal = () => {
        const newId = crypto.randomUUID();
        setSessionId(newId);
        setIsOpen(true);
        setIsSigned(false);
        setSignatureUrl(null);
        onSignatureChange(null);
    };

    // Listen for signature update from Firebase
    useEffect(() => {
        if (!isOpen || !sessionId) return;

        const unsubscribe = onSnapshot(doc(db, 'signatures', sessionId), (snap) => {
        if (snap.exists()) {
            const data = snap.data();
            if (data.status === 'completed' && data.image) {
            setSignatureUrl(data.image);
            setIsSigned(true);
            onSignatureChange(data.image);
            
            // Auto close after 2 seconds
            setTimeout(() => {
                setIsOpen(false);
            }, 2000);
            }
        }
        });

        return () => unsubscribe();
    }, [isOpen, sessionId, onSignatureChange]);

    return (
        <>
        {/* Button to Open QR */}
        {!isSigned ? (
            <button
            type="button"
            onClick={openModal}
            disabled={disabled}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded-lg text-sky-400 font-medium transition-all group"
            >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
            </svg>
            Scan QR to Sign Digitally
            </button>
        ) : (
            <div className="w-full p-4 bg-emerald-900/20 border border-emerald-500/30 rounded-lg flex items-center gap-4">
            <div className="bg-white p-1 rounded border border-emerald-500/20">
                <img src={signatureUrl!} alt="Signature" className="h-12 w-auto object-contain" />
            </div>
            <div>
                <p className="text-emerald-400 font-bold text-sm">✅ Signature Captured</p>
                <button 
                type="button"
                onClick={() => {
                    setIsSigned(false);
                    setSignatureUrl(null);
                    onSignatureChange(null);
                }}
                className="text-xs text-slate-400 hover:text-red-400 underline mt-1"
                >
                Remove & Re-sign
                </button>
            </div>
            </div>
        )}

        {/* QR Modal */}
        {isOpen && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-secondary backdrop-blur-sm animate-fade-in">
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6 max-w-sm w-full relative shadow-2xl">
                <button
                onClick={() => setIsOpen(false)}
                className="absolute top-3 right-3 text-slate-400 hover:text-white"
                >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>

                {!isSigned ? (
                <>
                    <h3 className="text-xl font-bold text-white mb-2 text-center">Sign on Phone</h3>
                    <p className="text-slate-400 text-sm text-center mb-6">
                    Scan this QR code with your phone camera to sign digitally.
                    </p>
                    
                    <div className="bg-white p-4 rounded-xl flex justify-center mb-4">
                    <QRCode 
                    value={`${window.location.origin}/#/signature?session=${sessionId}`} 
                    size={180}
                    level="H"
                    />
                    </div>

                    <div className="flex items-center justify-center gap-2 text-sky-400 text-sm animate-pulse">
                    <div className="w-2 h-2 bg-sky-400 rounded-full"></div>
                    Waiting for signature...
                    </div>
                </>
                ) : (
                <div className="text-center py-8">
                    <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                    </div>
                    <h3 className="text-xl font-bold text-white">Success!</h3>
                    <p className="text-slate-400 mt-2">Signature added to form.</p>
                </div>
                )}
            </div>
            </div>
        )}
        </>
    );
    }