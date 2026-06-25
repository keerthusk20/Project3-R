// src/pages/Auth.tsx
import React, { useEffect, useState } from 'react';
import { Mail, ArrowRight, Loader2, Lock, User, Eye, EyeOff, Users, Briefcase, ChevronLeft, CheckCircle2, ShieldCheck, Star } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { mockAuthService } from '../services/mockFirebase';
import { getAuth, sendPasswordResetEmail } from 'firebase/auth';
import { UserProfile } from '../types';
import { triggerNotification } from '../services/NotificationService';
import { generateCustomerId } from '../utils/helpers';

interface AuthProps {
  onLogin: (user: UserProfile) => void;
}

type AuthMode = 'login' | 'register-select' | 'signup' | 'forgot';

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const navigate = useNavigate();
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const location = useLocation();
  const [formData, setFormData] = useState({
    displayName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
  });

  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    const state = location.state as { successMsg?: string; email?: string } | null;
    if (!state?.successMsg) return;

    setSuccessMsg(state.successMsg);
    setAuthMode('login');
    if (state.email) {
      setFormData(prev => ({ ...prev, email: state.email || '' }));
    }
    navigate('/auth', { replace: true, state: null });
  }, [location.state, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

 const handleSocialLogin = async (provider: 'google') => {
  setLoading(true);
  setError('');
  try {
    const user = await mockAuthService.loginWithGoogle();
    if (user && user.uid) {
      onLogin(user);
      
      // ✅ Get redirect target: state → sessionStorage → fallback
      const redirectTo = location.state?.redirectTo || sessionStorage.getItem('postLoginRedirect');
      
      // ✅ Clear sessionStorage after use
      if (redirectTo) {
        sessionStorage.removeItem('postLoginRedirect');
      }
      
      if (redirectTo) {
        navigate(redirectTo);
      } else if (user.role === 'expert') {
        navigate('/expert-dashboard');
      } else {
        navigate('/');
      }
    }
  } catch (err: any) {
    if (err.message !== 'Login cancelled' && err.message !== 'concurrent-request') {
      setError(err.message);
    }
  } finally {
    setLoading(false);
  }
};

  const handleMailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      if (authMode === 'login') {
        const user = await mockAuthService.loginWithEmail(formData.email, formData.password);
        onLogin(user);

        const redirectTo = location.state?.redirectTo || sessionStorage.getItem('postLoginRedirect');
        if (redirectTo) {
          sessionStorage.removeItem('postLoginRedirect');
          navigate(redirectTo);
        } else if (user.role === 'expert') {
          navigate('/expert-dashboard');
        } else {
          navigate('/');
        }
        return;
      }
        // Registration Flow
        if (formData.password !== formData.confirmPassword)
          throw new Error('Passwords do not match');
        if (!formData.phone || formData.phone.length < 10)
          throw new Error('Please enter a valid phone number');

        const customerId = generateCustomerId(formData.phone);

        // Register the user (Creates account, sends email, SIGNS OUT)
        await mockAuthService.registerWithEmail(
          formData.email,
          formData.password,
          formData.displayName,
          customerId,
          formData.phone
        );

        // Trigger Notification
        await triggerNotification('USER_JOINED', {
          newUserRole: 'CUSTOMER',
          userName: formData.displayName,
          userId: customerId,
        });

        // ✅ Show success message and force login screen
        setSuccessMsg(`✅ Account created! Please check your email for verification and then sign in.`);
        setAuthMode('login');

        // Keep email prefilled, clear passwords
        setFormData(prev => ({
          ...prev,
          password: '',
          confirmPassword: '',
          phone: ''
        }));

        // Clear error to avoid confusion
        setError('');

        // ✅ CRITICAL: Do NOT call onLogin() - user must manually sign in
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email) {
      setError('Please enter your email address first.');
      return;
    }
    setLoading(true);
    setError('');
    setSuccessMsg('');
    try {
      const auth = getAuth();
      await sendPasswordResetEmail(auth, formData.email);
      setSuccessMsg('Check your email for the reset link.');
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset email.');
    } finally {
      setLoading(false);
    }
  };

  const goBack = () => {
    setError('');
    setSuccessMsg('');
    if (authMode === 'signup') setAuthMode('register-select');
    else if (authMode === 'register-select') setAuthMode('login');
    else if (authMode === 'forgot') setAuthMode('login');
    else setAuthMode('login');
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-transparent">
      {/* Background Ambience removed in favor of global App background */}

      <div className="relative z-10 w-full max-w-5xl p-6 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
        <div className="w-full max-w-md mx-auto">
          {/* Logo */}
        <div className="flex flex-col items-center justify-center text-center mb-8 group">
          <div className="flex items-center gap-3 mb-2 md:mb-4">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500/20 blur-lg rounded-full group-hover:bg-cyan-500/30 transition-all"></div>
              <img
                src="/roundmasa.webp"
                alt="RegiBIZ Logo"
                className="w-8 h-16 md:w-10 md:h-20 rounded-lg object-contain relative z-10 group-hover:scale-105 transition-transform mx-auto"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            </div>
            <div className="flex flex-col text-left">
              <div className="flex items-baseline">
                <span className="text-2xl md:text-3xl font-extrabold text-orange-500 tracking-tight drop-shadow-sm">
                  Regi
                </span>
                <span className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 tracking-tight drop-shadow-sm">
                  BIZ
                </span>
              </div>
              <div className="flex items-center gap-0.5 ml-6 md:ml-7">
                <span className="text-[8px] md:text-[9px] font-bold tracking-wider text-gray-200">by</span>
                <span className="text-[12px] md:text-[14px] font-extrabold tracking-tight">
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-blue-500 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">Cloud</span>
                  <span className="text-orange-500 ml-0.5 drop-shadow-[0_0_8px_rgba(249,115,22,0.5)]">MaSa</span>
                </span>
              </div>
            </div>
          </div>
          <p className="text-gray-400 mt-1 text-sm md:text-base">Government Compliance & Registration</p>
        </div>

        <div className="glass-panel rounded-2xl p-1 shadow-2xl">
          <div className="px-6 pb-6 pt-4">

            {/* ── Alerts ── */}
            {error && (
              <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs flex items-center gap-2 animate-fade-in">
                <span className="w-1 h-4 bg-red-500 rounded-full" />
                {error}
              </div>
            )}
            {successMsg && (
              <div className="mb-4 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 text-xs flex items-center gap-2 animate-fade-in">
                <span className="w-1 h-4 bg-orange-500 rounded-full" />
                {successMsg}
              </div>
            )}

            {/* ════════════════════════════════════════════
                SCREEN 1 — LOGIN
            ════════════════════════════════════════════ */}
            {authMode === 'login' && (
              <form onSubmit={handleMailAuth} className="space-y-4 animate-fade-in">
                <div className="text-center mb-2">
                  <h3 className="text-lg font-bold text-gradient-heading">Welcome Back</h3>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Mail size={16} /></span>
                  <input
                    name="email" type="email" placeholder="Email Address"
                    value={formData.email} onChange={handleInputChange} required
                    className="w-full bg-white/80 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
                  />
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Lock size={16} /></span>
                  <input
                    name="password" type={showPassword ? 'text' : 'password'} placeholder="Password"
                    value={formData.password} onChange={handleInputChange} required
                    className="w-full bg-white/80 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="flex justify-end mt-1 mb-2">
                  <button type="button" onClick={() => { setError(''); setSuccessMsg(''); setAuthMode('forgot'); }}
                    className="text-xs text-teal-400 hover:text-cyan-300 transition-colors">
                    Forgot Password?
                  </button>
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <><span>Sign In</span><ArrowRight size={18} /></>}
                </button>

                {/* Google */}
                <div className="mt-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                      <span className="px-2 bg-card text-gray-500">Or continue with</span>
                    </div>
                  </div>
                  <button type="button" onClick={() => handleSocialLogin('google')} disabled={loading}
                    className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 border border-white/10 rounded-xl hover:bg-white/5 transition-all text-sm font-medium text-white">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                    </svg>
                    Google
                  </button>
                </div>

               

               

                <div className="text-center pt-2">
                  <p className="text-xs text-gray-500">
                    Don't have an account?{' '}
                    <button type="button"
                      onClick={() => { setError(''); setAuthMode('register-select'); }}
                      className="text-orange-400 hover:text-orange-300 font-medium ml-1">
                      Register
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* ════════════════════════════════════════════
                SCREEN 2 — REGISTER TYPE SELECTOR
            ════════════════════════════════════════════ */}
            {authMode === 'register-select' && (
              <div className="animate-fade-in">
                {/* Back button */}
                <button type="button" onClick={goBack}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-4 group">
                  <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  Back to Login
                </button>

                <div className="text-center mb-6">
                  <h3 className="text-lg font-bold text-gradient-heading">Create an Account</h3>
                  <p className="text-xs text-gray-400 mt-1">Choose how you'd like to join RegiBIZ</p>
                </div>

                <div className="space-y-3">

                  {/* ── Option 1: Customer ── */}
                  <button
                    type="button"
                    onClick={() => { setError(''); setAuthMode('signup'); }}
                    className="w-full group relative p-4 rounded-xl border border-white/10 bg-white/3 hover:border-orange-500/50 hover:bg-orange-500/5 transition-all duration-200 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-orange-500/25 transition-all">
                        <Users size={20} className="text-orange-400" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-white">Customer Account</p>
                        <p className="text-xs text-gray-500 mt-0.5">Access compliance & registration services</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-600 group-hover:text-orange-400 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-1.5 mt-3 pl-15">
                      {['MSME', 'GST', 'PAN', 'FSSAI'].map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>

                  {/* ── Option 2: Associate Partner ── */}
                  <button
                    type="button"
                    onClick={() => navigate('/expert-registration')}
                    className="w-full group relative p-4 rounded-xl border border-white/10 bg-white/3 hover:border-amber-500/50 hover:bg-amber-500/5 transition-all duration-200 text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-500/25 transition-all">
                        <Briefcase size={20} className="text-amber-400" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-white">Associate Partner</p>
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase tracking-wider">
                            Expert
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Join as a CA or Lawyer — admin verified</p>
                      </div>
                      <ArrowRight size={16} className="text-gray-600 group-hover:text-amber-400 group-hover:translate-x-0.5 transition-all" />
                    </div>

                    {/* Feature pills */}
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {['Chartered Accountant', 'Lawyer'].map(tag => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-gray-400">
                          {tag}
                        </span>
                      ))}
                    </div>

                    {/* Verification badge */}
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <CheckCircle2 size={11} className="text-amber-500/70" />
                      <span className="text-[10px] text-amber-500/70">Requires admin verification · 3–5 business days</span>
                    </div>
                  </button>
                </div>

                <p className="text-center text-xs text-gray-500 mt-5">
                  Already have an account?{' '}
                  <button type="button" onClick={() => { setError(''); setAuthMode('login'); }}
                    className="text-orange-400 hover:text-orange-300 font-medium ml-1">
                    Sign In
                  </button>
                </p>
              </div>
            )}

            {/* ════════════════════════════════════════════
                SCREEN 3 — CUSTOMER SIGNUP FORM
            ════════════════════════════════════════════ */}
            {authMode === 'signup' && (
              <form onSubmit={handleMailAuth} className="space-y-4 animate-fade-in">

                {/* Back button */}
                <button type="button" onClick={goBack}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2 group">
                  <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  Back
                </button>

                <div className="text-center mb-2">
                  <div className="w-10 h-10 rounded-xl bg-orange-500/15 border border-orange-500/20 flex items-center justify-center mx-auto mb-3">
                    <Users size={18} className="text-orange-400" />
                  </div>
                  <h3 className="text-lg font-bold text-gradient-heading">Create Customer Account</h3>
                  <p className="text-xs text-gray-400 mt-1">Sign up to access compliance services</p>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><User size={16} /></span>
                  <input
                    name="displayName" type="text" placeholder="Full Name"
                    value={formData.displayName} onChange={handleInputChange} required
                    className="w-full bg-white/80 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
                  />
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Mail size={16} /></span>
                  <input
                    name="email" type="email" placeholder="Email Address"
                    value={formData.email} onChange={handleInputChange} required
                    className="w-full bg-white/80 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
                  />
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Mail size={16} /></span>
                  <input
                    name="phone" type="tel" placeholder="Phone Number (for Customer ID)"
                    value={formData.phone} onChange={handleInputChange} required maxLength={10}
                    className="w-full bg-white/80 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
                  />
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Lock size={16} /></span>
                  <input
                    name="password" type={showPassword ? 'text' : 'password'} placeholder="Password"
                    value={formData.password} onChange={handleInputChange} required
                    className="w-full bg-white/80 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Lock size={16} /></span>
                  <input
                    name="confirmPassword" type="password" placeholder="Confirm Password"
                    value={formData.confirmPassword} onChange={handleInputChange} required
                    className="w-full bg-white/80 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
                  />
                </div>

                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-400 hover:to-red-500 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-orange-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <><span>Create Account</span><ArrowRight size={18} /></>}
                </button>

                <div className="text-center pt-2">
                  <p className="text-xs text-gray-500">
                    Already have an account?{' '}
                    <button type="button" onClick={() => { setError(''); setAuthMode('login'); }}
                      className="text-orange-400 hover:text-orange-300 font-medium ml-1">
                      Sign In
                    </button>
                  </p>
                </div>
              </form>
            )}

            {/* ════════════════════════════════════════════
          SCREEN 4 — FORGOT PASSWORD
      ════════════════════════════════════════════ */}
            {authMode === 'forgot' && (
              <form onSubmit={handleForgotPassword} className="space-y-4 animate-fade-in">
                <button type="button" onClick={goBack}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors mb-2 group">
                  <ChevronLeft size={14} className="group-hover:-translate-x-0.5 transition-transform" />
                  Back to Login
                </button>
                <div className="text-center mb-4">
                  <h3 className="text-lg font-bold text-gradient-heading">Reset Password</h3>
                  <p className="text-xs text-gray-400 mt-1">Enter your email to receive a reset link</p>
                </div>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Mail size={16} /></span>
                  <input
                    name="email" type="email" placeholder="Email Address"
                    value={formData.email} onChange={handleInputChange} required
                    className="w-full bg-white/80 border border-gray-200 rounded-xl pl-10 pr-4 py-3 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500/50 focus:border-orange-500/50 transition-all text-sm"
                  />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-semibold py-3.5 rounded-xl shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2">
                  {loading ? <Loader2 className="animate-spin" size={20} /> : <><span>Send Reset Link</span><ArrowRight size={18} /></>}
                </button>
              </form>
            )}

          </div>
        </div>
        </div>
        {/* Right: Trust Signals (Hidden on mobile) */}
        <div className="hidden md:flex flex-col justify-center space-y-8 pl-8 md:border-l border-white/10">
          <div>
            <h2 className="text-3xl font-bold text-white mb-4">India's Most Trusted Compliance Platform</h2>
            <p className="text-gray-400">Join 10,000+ businesses who have simplified their legal and financial registrations.</p>
          </div>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 shrink-0">
                <ShieldCheck className="text-emerald-400 w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white font-bold mb-1">Bank-Grade Security</h4>
                <p className="text-sm text-gray-400">Your documents and data are secured with 256-bit encryption.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shrink-0">
                <Users className="text-blue-400 w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white font-bold mb-1">Verified CA & Legal Experts</h4>
                <p className="text-sm text-gray-400">Every application is reviewed and filed by certified professionals.</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center border border-orange-500/20 shrink-0">
                <Star className="text-orange-400 w-6 h-6" />
              </div>
              <div>
                <h4 className="text-white font-bold mb-1">4.9/5 Average Rating</h4>
                <p className="text-sm text-gray-400">Trusted by founders across India for lightning-fast registrations.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;