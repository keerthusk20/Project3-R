import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { getAuth, verifyPasswordResetCode, confirmPasswordReset } from 'firebase/auth';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const oobCode = searchParams.get('oobCode');
  const mode = searchParams.get('mode');
  
  // Debugging logs to verify URL parameters are read correctly
  console.log("Reset Password Debug -> Mode:", mode);
  console.log("Reset Password Debug -> oobCode:", oobCode);
  
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  
  const [passwords, setPasswords] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    const auth = getAuth();
    if (mode && mode !== 'resetPassword') {
      console.warn("Invalid mode detected:", mode);
      setError('Invalid request mode. Please ensure you clicked a password reset link.');
      setVerifying(false);
      return;
    }
    if (!oobCode) {
      console.warn("No oobCode found in URL.");
      setError('Invalid or missing password reset code.');
      setVerifying(false);
      return;
    }

    console.log("Verifying reset code with Firebase...");
    verifyPasswordResetCode(auth, oobCode)
      .then((email) => {
        console.log("Code verified successfully for email:", email);
        setEmail(email);
        setVerifying(false);
      })
      .catch((err) => {
        console.error("Verification error:", err);
        setError('The password reset link is invalid or has expired. Please try requesting a new one.');
        setVerifying(false);
      });
  }, [oobCode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (passwords.newPassword.length < 6) {
      setError('Password should be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');
    const auth = getAuth();
    try {
      await confirmPasswordReset(auth, oobCode!, passwords.newPassword);
      setSuccessMsg('Password updated successfully! Redirecting to login...');
      setTimeout(() => {
        navigate('/auth');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambience */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-900/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-teal-900/20 rounded-full blur-[120px] pointer-events-none" />

      <div className="glass-card rounded-2xl p-8 max-w-md w-full border border-white/10 shadow-2xl relative z-10">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold bg-gradient-to-r from-teal-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Set New Password
          </h2>
          <p className="text-sm text-gray-400 mt-2">
            {email ? `Resetting password for ${email}` : 'Enter your new password below'}
          </p>
        </div>

        {verifying ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="animate-spin text-cyan-500 mb-4" size={32} />
            <p className="text-gray-400 text-sm">Verifying link...</p>
          </div>
        ) : error ? (
          <div className="text-center">
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
              <AlertCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-sm text-red-400 leading-relaxed">{error}</p>
            </div>
            <Link to="/auth" className="text-cyan-400 hover:text-cyan-300 text-sm font-medium transition-colors">
              Return to Login
            </Link>
          </div>
        ) : successMsg ? (
          <div className="text-center py-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <CheckCircle2 className="text-emerald-500" size={32} />
            </div>
            <p className="text-emerald-400 font-medium mb-4">{successMsg}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5 animate-fade-in">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Lock size={16} /></span>
              <input
                type={showPassword ? 'text' : 'password'} placeholder="New Password"
                value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} required
                className="w-full bg-secondary/50 border border-white/10 rounded-xl pl-10 pr-10 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all text-sm"
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500"><Lock size={16} /></span>
              <input
                type="password" placeholder="Confirm New Password"
                value={passwords.confirmPassword} onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })} required
                className="w-full bg-secondary/50 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all text-sm"
              />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-cyan-900/20 flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed mt-2">
              {loading ? <Loader2 className="animate-spin" size={20} /> : <><span>Reset Password</span><ArrowRight size={18} /></>}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;