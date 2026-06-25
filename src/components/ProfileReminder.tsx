import React, { useState } from 'react';
import { Camera, AlertCircle, ArrowRight, X } from 'lucide-react';

interface ProfileReminderProps {
    isProfileIncomplete: boolean;
    isPhotoMissing: boolean;
    onOpenProfile: () => void;
    onDismiss?: () => void;
}

const ProfileReminder: React.FC<ProfileReminderProps> = ({
    isProfileIncomplete,
    isPhotoMissing,
    onOpenProfile,
    onDismiss,
}) => {
    const [dismissed, setDismissed] = useState(false);

    // Don't show if nothing to remind about, or user dismissed
    if ((!isProfileIncomplete && !isPhotoMissing) || dismissed) return null;

    const handleDismiss = () => {
        setDismissed(true);
        onDismiss?.();
    };

    return (
        <div className="px-4 md:px-8 pt-4 animate-fade-in">
            <div className="relative overflow-hidden glass-panel rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">

                {/* Background accent */}
                <div className="absolute top-0 right-0 w-32 h-full bg-gradient-to-l from-blue-500/10 to-transparent pointer-events-none" />

                {/* Dismiss button — always visible */}
                <button
                    onClick={handleDismiss}
                    className="absolute top-2 right-2 text-gray-400 hover:text-white p-1 rounded-full hover:bg-white/10 transition-colors"
                    title="Dismiss reminder"
                >
                    <X size={16} />
                </button>

                <div className="flex items-center gap-4 relative z-10 w-full">
                    <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                        {isProfileIncomplete ? (
                            <AlertCircle className="text-cyan-400" size={20} />
                        ) : (
                            <Camera className="text-cyan-400" size={20} />
                        )}
                    </div>

                    <div className="flex-1">
                        <h4 className="text-sm font-bold text-white">
                            {isProfileIncomplete ? 'Profile Incomplete' : 'Add Profile Photo'}
                        </h4>
                        <p className="text-xs text-gray-400 mt-0.5">
                            {isProfileIncomplete
                                ? <>Complete your profile for a better experience.{' '}
                                    <button onClick={onOpenProfile} className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline underline-offset-2">
                                        Update now
                                    </button>
                                  </>
                                : <>A profile photo helps personalise your account.{' '}
                                    <button onClick={onOpenProfile} className="text-cyan-400 hover:text-cyan-300 font-semibold hover:underline underline-offset-2">
                                        Upload now
                                    </button>
                                  </>
                            }
                        </p>
                    </div>
                </div>

                <button
                    onClick={onOpenProfile}
                    className="relative z-10 flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white text-xs font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-cyan-500/20 flex-shrink-0"
                >
                    {isProfileIncomplete ? 'Complete Profile' : 'Upload Photo'}
                    <ArrowRight size={14} />
                </button>
            </div>
        </div>
    );
};

export default ProfileReminder;