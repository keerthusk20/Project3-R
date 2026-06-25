// pages/ConsultationManagement.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, CheckCircle2, ChevronRight, User,
  Calendar, Activity, Loader2,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import {
  subscribeToPendingConsultations,
  getConsultationsByStatus,
  updateConsultationStatus,
} from '../services/consultationService';
import { AssignmentModal } from '../components/consultation/AssignmentModal';
import type { ConsultationRequest } from '../Types/consultation';
import { UserProfile } from '../types';

type Tab = 'Pending' | 'Assigned' | 'In-Progress' | 'Completed';
const TABS: Tab[] = ['Pending', 'Assigned', 'In-Progress', 'Completed'];

const statusColors: Record<ConsultationRequest['status'], string> = {
  Pending: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
  Assigned: 'text-blue-300 bg-blue-400/10 border-blue-400/20',
  'In-Progress': 'text-cyan-300 bg-cyan-400/10 border-cyan-400/20',
  Completed: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/20',
  Cancelled: 'text-red-300 bg-red-400/10 border-red-400/20',
};

function formatDate(val: Date | string | null | undefined): string {
  if (!val) return '—';
  const d = typeof val === 'string' ? new Date(val) : val;
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

interface ConsultationManagementProps {
  user: UserProfile;
}

const ConsultationManagement: React.FC<ConsultationManagementProps> = ({ user }) => {
  const [activeTab, setActiveTab] = useState<Tab>('Pending');
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedConsultation, setSelectedConsultation] = useState<ConsultationRequest | null>(null);

  // Real-time for Pending tab
  useEffect(() => {
    if (activeTab !== 'Pending') return;
    setLoading(true);
    const unsub = subscribeToPendingConsultations((data) => {
      setConsultations(data);
      setLoading(false);
    });
    return unsub;
  }, [activeTab]);

  const fetchByStatus = useCallback(async (tab: Tab) => {
  if (tab === 'Pending') return;
  setLoading(true);
  try {
    const statusMap = { Assigned: 'Assigned', 'In-Progress': 'In-Progress', Completed: 'Completed' };
    const data = await getConsultationsByStatus(statusMap[tab as Exclude<Tab, 'Pending'>] as any);
    setConsultations(data);
  } catch (err: any) {
    console.error(`Failed to fetch ${tab} consultations:`, err.message);
    // Show empty state instead of crashing
    setConsultations([]);
  } finally {
    setLoading(false);
  }
}, []);

  

  useEffect(() => {
    if (activeTab !== 'Pending') fetchByStatus(activeTab);
  }, [activeTab, fetchByStatus]);

  const handleMarkInProgress = async (c: ConsultationRequest) => {
    await updateConsultationStatus(c.id, 'In-Progress');
    fetchByStatus(activeTab);
  };

  const handleMarkCompleted = async (c: ConsultationRequest) => {
    await updateConsultationStatus(c.id, 'Completed');
    fetchByStatus(activeTab);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-0 left-1/4 w-80 h-80 bg-cyan-500/4 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-purple-500/4 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-cyan-400/10 border border-cyan-400/20 flex items-center justify-center">
              <ClipboardList size={20} className="text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">Consultation Management</h1>
              <p className="text-slate-400 text-sm">Monitor and assign incoming consultation requests</p>
            </div>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20">
            <Activity size={12} className="text-emerald-400 animate-pulse" />
            <span className="text-emerald-400 text-xs font-medium">Live</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8 mb-6 w-fit">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setLoading(true); }}
              className={`relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
                ${activeTab === tab ? 'text-white' : 'text-slate-400 hover:text-white'}`}
            >
              {activeTab === tab && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute inset-0 rounded-lg bg-white/10 border border-white/10"
                />
              )}
              <span className="relative">{tab}</span>
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/10 overflow-hidden backdrop-blur-md bg-white/3">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 size={28} className="text-cyan-400 animate-spin" />
            </div>
          ) : consultations.length === 0 ? (
            <div className="flex flex-col items-center py-20 text-center">
              <CheckCircle2 size={36} className="text-slate-600 mb-3" />
              <p className="text-slate-400">No {activeTab.toLowerCase()} consultations.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-12 px-5 py-3 text-xs text-slate-500 uppercase tracking-wider border-b border-white/8 bg-white/3">
                <div className="col-span-3">Customer</div>
                <div className="col-span-3">Service</div>
                <div className="col-span-2">Expert</div>
                <div className="col-span-2">Scheduled</div>
                <div className="col-span-1">Status</div>
                <div className="col-span-1 text-right">Action</div>
              </div>

              <AnimatePresence>
                {consultations.map((c, i) => (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="grid grid-cols-12 px-5 py-4 border-b border-white/5 hover:bg-white/3 transition-colors items-center"
                  >
                    <div className="col-span-3 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {c.customerName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium truncate">{c.customerName}</p>
                        <p className="text-slate-500 text-xs truncate">{c.customerEmail ?? ''}</p>
                      </div>
                    </div>

                    <div className="col-span-3">
                      <p className="text-white text-sm truncate">{c.serviceType}</p>
                      <p className="text-slate-500 text-xs">{c.serviceCategory}</p>
                    </div>

                    <div className="col-span-2">
                      {c.assignedExpertName ? (
                        <div className="flex items-center gap-1.5">
                          <User size={12} className="text-cyan-400" />
                          <span className="text-white text-sm truncate">{c.assignedExpertName}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500 text-xs italic">Unassigned</span>
                      )}
                    </div>

                    <div className="col-span-2">
                      <div className="flex items-center gap-1">
                        <Calendar size={11} className="text-slate-500" />
                        <span className="text-slate-300 text-xs">{formatDate(c.scheduledTime)}</span>
                      </div>
                    </div>

                    <div className="col-span-1">
                      <span className={`text-xs px-2 py-0.5 rounded-md border font-medium ${statusColors[c.status]}`}>
                        {c.status}
                      </span>
                    </div>

                    <div className="col-span-1 flex justify-end gap-1">
                      {c.status === 'Pending' && (
                        <button
                          onClick={() => setSelectedConsultation(c)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-400/10 border border-cyan-400/20 text-cyan-300 text-xs font-medium hover:bg-cyan-400/20 transition-all"
                        >
                          Assign <ChevronRight size={12} />
                        </button>
                      )}
                      {c.status === 'Assigned' && (
                        <button
                          onClick={() => handleMarkInProgress(c)}
                          className="px-3 py-1.5 rounded-lg bg-blue-400/10 border border-blue-400/20 text-blue-300 text-xs font-medium hover:bg-blue-400/20 transition-all"
                        >
                          Start
                        </button>
                      )}
                      {c.status === 'In-Progress' && (
                        <button
                          onClick={() => handleMarkCompleted(c)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-400/10 border border-emerald-400/20 text-emerald-300 text-xs font-medium hover:bg-emerald-400/20 transition-all"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </>
          )}
        </div>
      </div>

      <AssignmentModal
        consultation={selectedConsultation}
        agentId={user?.uid ?? ''}
        agentName={user?.displayName ?? 'Support Agent'}
        onClose={() => setSelectedConsultation(null)}
        onSuccess={() => setSelectedConsultation(null)}
      />
    </div>
  );
};

export default ConsultationManagement;