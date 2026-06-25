import React from 'react';
import { User, Briefcase, ChevronRight, Activity } from 'lucide-react';
import { UserProfile } from '../types';

interface CustomerCardProps {
  customer: UserProfile;
  requestCount: number;
  onClick: () => void;
}

const CustomerCard: React.FC<CustomerCardProps> = ({ customer, requestCount, onClick }) => {
  return (
    <div 
      onClick={onClick} // ✅ Click triggers on the main container
      className="glass-card p-5 rounded-xl border border-white/5 relative group hover:bg-white/[0.02] cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-orange-500/5"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-sm font-bold text-white shadow-lg shadow-blue-500/20">
            {customer.displayName?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div>
            <h3 className="font-bold text-white text-sm truncate max-w-[140px]">{customer.displayName}</h3>
            <p className="text-[10px] text-gray-500 font-mono">{customer.userId}</p>
          </div>
        </div>
        <div className={`w-2 h-2 rounded-full ${customer.status === 'active' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-gray-500'}`}></div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 mb-4">
        <div className="bg-white/5 p-2 rounded-lg border border-white/5">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Briefcase size={12} />
            <span className="text-[10px] uppercase font-bold">Requests</span>
          </div>
          <p className="text-lg font-bold text-white">{requestCount}</p>
        </div>
        <div className="bg-white/5 p-2 rounded-lg border border-white/5">
          <div className="flex items-center gap-1.5 text-gray-400 mb-1">
            <Activity size={12} />
            <span className="text-[10px] uppercase font-bold">Status</span>
          </div>
          <p className="text-xs font-bold text-emerald-400 capitalize">{customer.status}</p>
        </div>
      </div>

      {/* Footer / Action Hint */}
      <div className="flex items-center justify-between pt-3 border-t border-white/5">
        <span className="text-[10px] text-gray-500">{customer.email}</span>
        <ChevronRight size={14} className="text-gray-600 group-hover:text-orange-400 group-hover:translate-x-1 transition-all" />
      </div>
    </div>
  );
};

export default CustomerCard;