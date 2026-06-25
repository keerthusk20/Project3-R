import React from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { UserRole } from '../types';
import { Loader2, ShieldAlert } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  userRole: UserRole;           // ← receive role from App.tsx directly
  redirectTo?: string;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
  userRole,
  redirectTo,
}) => {
  const navigate = useNavigate();

  if (!allowedRoles.includes(userRole)) {
    if (redirectTo) {
      return <Navigate to={redirectTo} replace />;
    }

    return (
      <div className="min-h-screen bg-card flex items-center justify-center p-4">
        <div className="glass-panel p-8 rounded-xl max-w-md text-center border border-red-500/20 shadow-2xl">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <ShieldAlert className="text-red-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
          <p className="text-gray-400 mb-6">
            You do not have the required permissions to view this page.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="px-6 py-2.5 bg-primary/10 hover:bg-primary/20 border border-primary/20 text-primary rounded-xl text-sm font-bold transition-all"
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;