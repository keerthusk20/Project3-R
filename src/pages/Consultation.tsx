import React, { useEffect, useState } from 'react';
import { Calendar, Clock, FileText, Loader2, MessageSquare } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { subscribeToExpertConsultations, updateConsultationStatus } from '../services/consultationService';
import { UserProfile } from '../types';

// Types/consultation.ts

export type ExpertRole = 'CA' | 'Lawyer';
export type AvailabilityStatus = 'Available' | 'Busy' | 'Offline';
export type ConsultationStatus = 'Pending' | 'Assigned' | 'In-Progress' | 'Completed' | 'Cancelled';

export interface ExpertProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: ExpertRole;
  specialization: string;
  availabilityStatus: AvailabilityStatus;
  rating: number;
  totalConsultations: number;
  bio?: string;
  profileImageUrl?: string;
  isActive: boolean;
  createdAt: Date | string;
}

export interface ConsultationRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  serviceType: string;
  serviceCategory: ExpertRole; // 'CA' | 'Lawyer'
  status: ConsultationStatus;
  assignedExpertId: string | null;
  assignedExpertName: string | null;
  supportAgentId: string | null;
  supportAgentName: string | null;
  timestamp: Date | string;
  scheduledTime: Date | string | null;
  notes: string;
  priority?: 'Low' | 'Medium' | 'High';
}

export interface ActivityLog {
  id: string;
  message: string;
  supportAgentId: string;
  supportAgentName: string;
  expertId: string;
  expertName: string;
  customerId: string;
  customerName: string;
  consultationId: string;
  timestamp: Date | string;
}

export interface SuperadminStats {
  totalExperts: number;
  totalCAs: number;
  totalLawyers: number;
  activeConsultations: number;
  pendingAssignments: number;
  completedConsultations: number;
  availableExperts: number;
}



interface ConsultationProps {
  user: UserProfile;
}

const Consultation: React.FC<ConsultationProps> = ({ user }) => {
  const [consultations, setConsultations] = useState<ConsultationRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.uid) {
      setConsultations([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToExpertConsultations(user.uid, (rows) => {
      setConsultations(rows);
      setLoading(false);
    });
    return () => unsub();
  }, [user?.uid]);

  const handleStatus = async (id: string, status: ConsultationStatus) => {
    setUpdatingId(id);
    try {
      await updateConsultationStatus(id, status);
    } finally {
      setUpdatingId(null);
    }
  };

  const formatDate = (value: Date | string | null) => {
    if (!value) return 'Not scheduled';
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <p className="text-amber-400 text-sm font-bold uppercase tracking-wider mb-1">Expert Workspace</p>
          <h1 className="text-3xl font-black tracking-tight">My Consultations</h1>
          <p className="text-slate-400 text-sm mt-2">Review assigned customer consultations and update their progress.</p>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="animate-spin text-amber-400" size={32} />
          </div>
        ) : consultations.length === 0 ? (
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-12 text-center">
            <MessageSquare className="mx-auto mb-4 text-slate-600" size={36} />
            <p className="text-slate-400">No consultations assigned yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {consultations.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-400">{item.serviceCategory}</p>
                    <h2 className="text-xl font-bold mt-1">{item.serviceType}</h2>
                    <p className="text-sm text-slate-400 mt-1">{item.customerName}</p>
                  </div>
                  <span className="px-3 py-1 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 text-xs font-bold">
                    {item.status}
                  </span>
                </div>

                <div className="space-y-3 text-sm text-slate-300">
                  <div className="flex items-center gap-2">
                    <Calendar size={15} className="text-slate-500" />
                    <span>{formatDate(item.scheduledTime)}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Clock size={15} className="text-slate-500" />
                    <span>Requested: {formatDate(item.timestamp)}</span>
                  </div>
                  {item.notes && (
                    <div className="flex items-start gap-2">
                      <FileText size={15} className="text-slate-500 mt-0.5" />
                      <span>{item.notes}</span>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 mt-5">
                  <button
                    onClick={() => handleStatus(item.id, 'In-Progress')}
                    disabled={updatingId === item.id || item.status === 'In-Progress' || item.status === 'Completed'}
                    className="px-4 py-2 rounded-lg bg-cyan-500/15 border border-cyan-500/30 text-cyan-300 text-sm font-bold disabled:opacity-40"
                  >
                    Start
                  </button>
                  <button
                    onClick={() => handleStatus(item.id, 'Completed')}
                    disabled={updatingId === item.id || item.status === 'Completed'}
                    className="px-4 py-2 rounded-lg bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm font-bold disabled:opacity-40"
                  >
                    Complete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Consultation;