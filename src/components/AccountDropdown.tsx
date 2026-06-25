import React, { useState, useRef, useEffect, useCallback } from 'react';
import { UserProfile, UserRole } from '../types'; // ✅ Import UserRole
import {
  LogOut, User, Camera, Briefcase, CreditCard, HelpCircle, Hash, Phone, Mail
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface AccountDropdownProps {
  user: UserProfile;
  onLogout: () => void;
  onOpenProfile: () => void;
  onPhotoUpdate?: (newPhotoURL: string) => void;
  isProfileIncomplete?: boolean;
  onToggle?: (isOpen: boolean) => void;
}

const AccountDropdown: React.FC<AccountDropdownProps> = ({
  user,
  onLogout,
  onOpenProfile,
  onPhotoUpdate,
  isProfileIncomplete,
  onToggle
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Notify parent of toggle
  useEffect(() => {
    onToggle?.(isOpen);
  }, [isOpen, onToggle]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const [avatarKey, setAvatarKey] = useState(0);
  useEffect(() => {
    setAvatarKey(prev => prev + 1);
  }, [user.photoURL]);

  const handleViewProfile = () => {
    setIsOpen(false);
    onOpenProfile();
  };

  const handleNavigate = (path: string) => {
    setIsOpen(false);
    navigate(path);
  };

  const handlePhotoUpdated = useCallback((newPhotoURL: string) => {
    if (onPhotoUpdate) onPhotoUpdate(newPhotoURL);
    setAvatarKey(prev => prev + 1);
  }, [onPhotoUpdate]);

  useEffect(() => {
    (window as any).__handleProfilePhotoUpdate = handlePhotoUpdated;
    return () => { delete (window as any).__handleProfilePhotoUpdate; };
  }, [handlePhotoUpdated]);

  const formatRole = (role: string) => {
    return role.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  };

  const shouldShowIncompleteWarning = user.role === UserRole.CUSTOMER && !user.profileCompleted;

  // --- Theme Constants ---
  const iconClass = "text-primary transition-colors";
  const logoutIconClass = "text-destructive transition-colors";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-10 h-10 rounded-full overflow-hidden bg-background border border-white/10 hover:scale-105 transition-all relative focus:outline-none"
        aria-label="Account menu"
      >
        <div className="w-full h-full rounded-full bg-background flex items-center justify-center overflow-hidden">
          {user.photoURL ? (
            <img key={`avatar-${avatarKey}`} src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <span className="text-white font-bold text-sm">
              {user.displayName ? user.displayName.charAt(0).toUpperCase() : <User size={16} />}
            </span>
          )}
        </div>
        {shouldShowIncompleteWarning && (
          <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-destructive border-2 border-background rounded-full animate-pulse" title="Please complete your profile"></span>
        )}
      </button>

      {/* Backdrop for blurring background */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/10 backdrop-blur-[2px] z-40 transition-all duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {isOpen && (
        <div className="fixed left-3 right-3 top-20 glass-panel rounded-2xl shadow-2xl overflow-hidden animate-fade-in z-50 border border-border sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-4 sm:w-80">
          <div className="p-6 border-b border-border bg-white/5 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>

            <div className="flex items-start gap-4 relative z-10">
              <div className="relative group shrink-0">
                <div className="w-16 h-16 rounded-full bg-gradient-primary p-[2px] shadow-lg">
                  <div className="w-full h-full rounded-full bg-card overflow-hidden flex items-center justify-center">
                    {user.photoURL ? (
                      <img key={`header-avatar-${avatarKey}`} src={user.photoURL} alt="Profile" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-white text-2xl font-bold">
                        {user.displayName ? user.displayName.charAt(0).toUpperCase() : 'U'}
                      </span>
                    )}
                  </div>
                </div>
                <button onClick={handleViewProfile} className="absolute inset-0 bg-background/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <Camera size={20} className="text-white" />
                </button>
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <h3 className="text-lg font-black text-gradient-heading truncate mb-1">
                  {user.displayName || 'User'}
                </h3>
                <div className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20 text-primary text-[10px] font-bold uppercase tracking-wide">
                  {formatRole(user.role)}
                </div>

                <div className="mt-4 space-y-2">
                  {user.customerId && (
                    <div className="flex items-center gap-2 bg-background/40 px-2.5 py-1.5 rounded-lg border border-border group hover:border-primary/30 transition-colors">
                      <Hash size={12} className="text-primary shrink-0" />
                      <span className="text-[10px] font-mono font-bold tracking-wide text-muted-foreground truncate font-mono">
                        {user.customerId}
                      </span>
                    </div>
                  )}
                  {user.phoneNumber && (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground group hover:text-foreground transition-colors">
                      <Phone size={12} className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="truncate">{user.phoneNumber}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground group hover:text-foreground transition-colors">
                    <Mail size={12} className="shrink-0 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="truncate">{user.email}</span>
                  </div>
                </div>

                <button onClick={handleViewProfile} className="text-[11px] text-primary hover:text-primary/80 font-bold block text-left mt-4 pt-3 border-t border-border w-full flex items-center justify-between group">
                  View Full Profile <span>→</span>
                </button>
              </div>
            </div>
          </div>

          <div className="py-3 px-2">
            {[
              { label: 'My Services', path: '/my-services', icon: <Briefcase size={18} /> },
              { label: 'My Subscriptions', path: '/subscriptions', icon: <CreditCard size={18} /> },
              { label: 'Help Center', path: '/help', icon: <HelpCircle size={18} /> },
              { label: 'FAQs', path: '/faqs', icon: <Hash size={18} /> },
            ].map((item) => (
              <button
                key={item.path}
                onClick={() => handleNavigate(item.path)}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-foreground hover:bg-white/5 rounded-xl transition-all group"
              >
                <span className={`w-8 flex justify-center ${iconClass}`}>{item.icon}</span>
                <span className="flex-1 text-left font-semibold">{item.label}</span>
                <span className="text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all">›</span>
              </button>
            ))}
          </div>

          <div className="p-3 bg-secondary/20">
            <button onClick={onLogout} className="w-full flex items-center gap-3 px-4 py-3 text-sm text-destructive hover:bg-destructive/10 rounded-xl transition-all font-bold group border border-transparent hover:border-destructive/20">
              <span className={`w-8 flex justify-center ${logoutIconClass}`}><LogOut size={18} /></span>
              <span className="flex-1 text-left">Sign Out</span>
              <span className="text-muted-foreground group-hover:text-destructive group-hover:translate-x-1 transition-all">›</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AccountDropdown;