import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Shield, Lock, ArrowRight, Loader2, User } from 'lucide-react';
import { mockDbService } from '../services/mockFirebase';
import { Invite } from '../types';
// 👇 Import the notification service
import { triggerNotification } from '../services/NotificationService';

const AcceptInvite: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    displayName: '',
    password: '',
    confirmPassword: ''
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid link. Missing invitation token.");
      setLoading(false);
      return;
    }

    // Validate Token
    mockDbService.validateInviteToken(token)
      .then(data => {
        setInvite(data);
        setLoading(false);
      })
      .catch(err => {
        console.error("Invite Error:", err);
        setError(err.message || "Invitation invalid or expired.");
        setLoading(false);
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !invite) return;

    if (formData.password.length < 6) {
      alert("Password must be at least 6 characters.");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      alert("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      // 1. Create the user account (returns void)
      await mockDbService.acceptInvite(token, formData.password, formData.displayName);

      // 2. TRIGGER NOTIFICATION: New User Joined
      // We use the invite data and form data since the user is now created in DB
      // We don't need the return value from acceptInvite
      await triggerNotification('USER_JOINED', {
        newUserRole: invite.role,
        userName: formData.displayName,
        userId: 'new-user-' + Date.now() // Temporary ID reference, service finds by role anyway
      });

      // 3. Success Feedback
      alert("Account activated! You will now be redirected to login.");
      navigate('/');
    } catch (err: any) {
      alert("Activation failed: " + err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-card flex items-center justify-center">
      <Loader2 className="animate-spin text-orange-500" size={32} />
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-card flex items-center justify-center p-4">
      <div className="glass-panel p-8 rounded-xl max-w-md text-center border border-red-500/20">
        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
          <Shield className="text-red-500" size={32} />
        </div>
        <h2 className="text-xl font-bold text-gradient-heading mb-2">Invitation Error</h2>
        <p className="text-gray-400 mb-6">{error}</p>
        <button onClick={() => navigate('/')} className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-orange-400 text-sm font-medium transition-colors">Return to Home</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-card flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-[100px] pointer-events-none" />

      <div className="glass-panel rounded-2xl p-8 max-w-md w-full border border-orange-500/20 shadow-2xl shadow-orange-900/20 relative z-10">
        <div className="flex flex-col items-center justify-center text-center mb-8 group">
          <div className="flex items-center gap-3 mb-6">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full group-hover:bg-cyan-500/30 transition-all"></div>
              <img
                src="/roundmasa.webp"
                alt="RegiBIZ Logo"
                className="w-10 h-20 rounded-lg object-contain relative z-10 group-hover:scale-105 transition-transform mx-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-heading-from to-heading-to tracking-tight drop-shadow-sm">
                RegiBIZ
              </span>
              <div className="flex items-center gap-0.5 ml-7">
                <span className="text-[9px] font-bold tracking-wider text-gray-200">by</span>
                <span className="text-[14px] font-extrabold tracking-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Cloud</span>
                  <span className="text-orange-500 ml-0.5 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">MaSa</span>
                </span>
              </div>
            </div>
          </div>

          <h1 className="text-2xl font-bold text-gradient-heading">Join the Team</h1>
          <p className="text-gray-400 mt-2 text-sm">
            You have been invited to join RegiBIZ as <strong className="text-white uppercase tracking-wider bg-white/5 px-2 py-0.5 rounded text-xs">{invite?.role}</strong>.
          </p>
          <div className="mt-4 inline-block px-4 py-1.5 bg-background/20 rounded-full border border-white/5">
            <p className="text-xs text-gray-400">{invite?.email}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Full Name</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><User size={16} /></span>
              <input
                required
                type="text"
                placeholder="e.g. John Doe"
                value={formData.displayName}
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                className="w-full bg-card/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Set Password</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Lock size={16} /></span>
              <input
                required
                type="password"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
                className="w-full bg-card/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1.5 ml-1">Confirm Password</label>
            <div className="relative group">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Lock size={16} /></span>
              <input
                required
                type="password"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="w-full bg-card/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 transition-all mt-6 disabled:opacity-50 transform active:scale-[0.98]"
          >
            {submitting ? <Loader2 className="animate-spin" size={20} /> : (
              <>Complete Setup <ArrowRight size={18} /></>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AcceptInvite;