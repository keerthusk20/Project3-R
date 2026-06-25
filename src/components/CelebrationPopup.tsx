import React, { useEffect, useState } from 'react';
import * as confettiModule from 'canvas-confetti';
const confetti = (confettiModule as any).default || confettiModule;
import { motion, AnimatePresence } from 'framer-motion';

interface CelebrationPopupProps {
    trigger: boolean;
    message: string;
    onComplete?: () => void;
    duration?: number;
}

const CelebrationPopup: React.FC<CelebrationPopupProps> = ({
    trigger,
    message,
    onComplete,
    duration = 3000
}) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (trigger) {
            setIsVisible(true);

            // Fire confetti burst
            const end = Date.now() + 1000;
            const colors = ['#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

            (function frame() {
                confetti({
                    particleCount: 5,
                    angle: 60,
                    spread: 55,
                    origin: { x: 0 },
                    colors: colors
                });
                confetti({
                    particleCount: 5,
                    angle: 120,
                    spread: 55,
                    origin: { x: 1 },
                    colors: colors
                });

                if (Date.now() < end) {
                    requestAnimationFrame(frame);
                }
            }());

            // Big center burst
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: colors,
                gravity: 1.2,
                scalar: 1.2,
            });

            // Auto-dismiss
            const timer = setTimeout(() => {
                setIsVisible(false);
                if (onComplete) onComplete();
            }, duration);

            return () => clearTimeout(timer);
        }
    }, [trigger, duration, onComplete]);

    return (
        <AnimatePresence>
            {isVisible && message && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none p-4">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.5, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.8, y: -20 }}
                        transition={{
                            type: "spring",
                            damping: 12,
                            stiffness: 200,
                            duration: 0.5
                        }}
                        className="bg-slate-900/90 backdrop-blur-2xl border border-white/10 px-8 py-6 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex flex-col items-center gap-4"
                    >
                        <motion.div
                            initial={{ rotate: -20, scale: 0 }}
                            animate={{ rotate: 0, scale: 1 }}
                            transition={{ delay: 0.2, type: "spring" }}
                            className="w-16 h-16 bg-gradient-to-br from-orange-400 to-orange-600 rounded-2xl flex items-center justify-center shadow-lg shadow-orange-500/20"
                        >
                            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                        </motion.div>

                        <h2 className="text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white via-slate-200 to-slate-400 text-center tracking-tight">
                            {message}
                        </h2>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default CelebrationPopup;
