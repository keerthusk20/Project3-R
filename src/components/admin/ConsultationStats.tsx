// components/admin/ConsultationStats.tsx

import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users, Scale, Calculator, Activity,
  Clock, CheckCircle2, Loader2, ToggleLeft, ToggleRight,
  Zap,
} from 'lucide-react';
import {
  getSuperadminStats,
  getActivityLogs,
  getAllExperts,
  toggleExpertActive,
  updateExpertStatus,
} from '../../services/consultationService';
import type { SuperadminStats, ActivityLog, ExpertProfile, AvailabilityStatus } from '../../Types/consultation';

function timeAgo(val: Date | string): string {
  const d = typeof val === 'string' ? new Date(val) : val;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const StatCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number | string;
  sub?: string;
  accent?: string;
  delay?: number;
}> = ({ icon, label, value, sub, accent = 'from-cyan-500/20 to-cyan-400/5', delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="relative rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-5 overflow-hidden"
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${accent} opacity-40 pointer-events-none`} />
    <div className="relative flex items-start justify-between">
      <div>
        <p className="text-slate-400 text-xs uppercase tracking-wider mb-3">{label}</p>
        <p className="text-3xl font-bold text-white">{value}</p>
        {sub && <p className="text-slate-500 text-xs mt-1">{sub}</p>}
      </div>
      <div className="p-2.5 rounded-xl bg-white/8 border border-white/8">{icon}</div>
    </div>
  </motion.div>
);

export const ConsultationStats: React.FC = () => {
  const [stats, setStats] = useState<SuperadminStats | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [experts, setExperts] = useState<ExpertProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState<'overview' | 'experts'>('overview');

  const load = async () => {
    setLoading(true);
    const [s, l, e] = await Promise.all([
      getSuperadminStats(),
      getActivityLogs(15),
      getAllExperts(),
    ]);
    setStats(s);
    setLogs(l);
    setExperts(e);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleToggleActive = async (expert: ExpertProfile) => {
    await toggleExpertActive(expert.id, !expert.isActive);
    setExperts((prev) => prev.map((e) => e.id === expert.id ? { ...e, isActive: !e.isActive } : e));
  };

  const handleStatusChange = async (expert: ExpertProfile, status: AvailabilityStatus) => {
    await updateExpertStatus(expert.id, status);
    setExperts((prev) => prev.map((e) => e.id === expert.id ? { ...e, availabilityStatus: status } : e));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 size={28} className="text-cyan-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Section Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-purple-400/10 border border-purple-400/20 flex items-center justify-center">
            <Zap size={16} className="text-purple-400" />
          </div>
          <h2 className="text-white font-bold text-lg">Consultation Overview</h2>
        </div>
        <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/8">
          {(['overview', 'experts'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all capitalize
                ${section === s ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {section === 'overview' && stats && (
        <>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard delay={0} icon={<Users size={18} className="text-cyan-400" />} label="Total Experts" value={stats.totalExperts}
              sub={`${stats.availableExperts} available now`} accent="from-cyan-500/15 to-transparent" />
            <StatCard delay={0.05} icon={<Calculator size={18} className="text-blue-400" />} label="CAs" value={stats.totalCAs}
              accent="from-blue-500/15 to-transparent" />
            <StatCard delay={0.1} icon={<Scale size={18} className="text-violet-400" />} label="Lawyers" value={stats.totalLawyers}
              accent="from-violet-500/15 to-transparent" />
            <StatCard delay={0.15} icon={<Activity size={18} className="text-emerald-400" />} label="Active Consultations" value={stats.activeConsultations}
              accent="from-emerald-500/15 to-transparent" />
            <StatCard delay={0.2} icon={<Clock size={18} className="text-amber-400" />} label="Pending Assignment" value={stats.pendingAssignments}
              accent="from-amber-500/15 to-transparent" />
            <StatCard delay={0.25} icon={<CheckCircle2 size={18} className="text-teal-400" />} label="Completed" value={stats.completedConsultations}
              accent="from-teal-500/15 to-transparent" />
          </div>

          {/* Activity Log */}
          <div className="rounded-2xl border border-white/10 bg-white/3 backdrop-blur-md overflow-hidden">
            <div className="px-5 py-3.5 border-b border-white/8 flex items-center gap-2">
              <Activity size={14} className="text-cyan-400" />
              <h3 className="text-white text-sm font-semibold">Recent Activity</h3>
            </div>
            <div className="divide-y divide-white/5">
              {logs.length === 0 && (
                <p className="text-slate-500 text-sm text-center py-10">No activity yet.</p>
              )}
              {logs.map((log, i) => (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className="px-5 py-3.5 flex items-start justify-between gap-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 w-6 h-6 rounded-full bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center flex-shrink-0">
                      <Users size={11} className="text-cyan-400" />
                    </div>
                    <p className="text-slate-300 text-sm leading-relaxed">{log.message}</p>
                  </div>
                  <span className="text-slate-600 text-xs flex-shrink-0 mt-0.5">{timeAgo(log.timestamp)}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </>
      )}

      {section === 'experts' && (
        <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/3 backdrop-blur-md">
          <div className="px-5 py-3.5 border-b border-white/8">
            <h3 className="text-white text-sm font-semibold">Expert Management</h3>
          </div>
          <div className="divide-y divide-white/5">
            {experts.map((expert, i) => (
              <motion.div
                key={expert.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.04 }}
                className="px-5 py-4 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                    {expert.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-white text-sm font-medium">{expert.name}</p>
                    <p className="text-slate-500 text-xs">{expert.role} · {expert.specialization}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Status Selector */}
                  <select
                    value={expert.availabilityStatus}
                    onChange={(e) => handleStatusChange(expert, e.target.value as AvailabilityStatus)}
                    className="text-xs bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white focus:outline-none focus:border-cyan-400/40 cursor-pointer"
                  >
                    <option value="Available">Available</option>
                    <option value="Busy">Busy</option>
                    <option value="Offline">Offline</option>
                  </select>

                  {/* Active Toggle */}
                  <button
                    onClick={() => handleToggleActive(expert)}
                    className="flex items-center gap-1.5 text-xs transition-colors"
                  >
                    {expert.isActive ? (
                      <>
                        <ToggleRight size={20} className="text-emerald-400" />
                        <span className="text-emerald-400">Active</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft size={20} className="text-slate-500" />
                        <span className="text-slate-500">Inactive</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ConsultationStats;