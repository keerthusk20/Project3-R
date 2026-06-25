// components/consultation/AssignmentModal.tsx

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Star, Briefcase, CheckCircle, Loader2, AlertCircle } from 'lucide-react';
import { getAvailableExperts, assignExpert } from '../../services/consultationService';
import type { ConsultationRequest, ExpertProfile } from '../../Types/consultation';

interface Props {
  consultation: ConsultationRequest | null;
  agentId: string;
  agentName: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const AssignmentModal: React.FC<Props> = ({ consultation, agentId, agentName, onClose, onSuccess }) => {
  const [experts, setExperts] = useState<ExpertProfile[]>([]);
  const [selected, setSelected] = useState<ExpertProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!consultation) return;
    setLoading(true);
    getAvailableExperts(consultation.serviceCategory)
      .then(setExperts)
      .catch(() => setExperts([]))
      .finally(() => setLoading(false));
  }, [consultation]);

  const handleAssign = async () => {
    if (!consultation || !selected) return;
    setSubmitting(true);
    setError('');
    try {
      await assignExpert(consultation.id, selected.id, selected.name, agentId, agentName);
      onSuccess();
      onClose();
    } catch {
      setError('Assignment failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {consultation && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ type: 'spring', stiffness: 280, damping: 22 }}
            className="fixed inset-0 flex items-center justify-center z-50 p-4"
          >
            <div className="w-full max-w-lg rounded-2xl bg-[#070f1e] border border-white/10 shadow-2xl overflow-hidden">
              {/* Header */}
              <div className="px-6 py-4 border-b border-white/8 flex items-start justify-between">
                <div>
                  <h2 className="text-white font-semibold">Assign Expert</h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    {consultation.serviceType} · {consultation.customerName}
                  </p>
                </div>
                <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5">
                  <X size={18} />
                </button>
              </div>

              {/* Request Details */}
              <div className="px-6 py-3 bg-white/3 border-b border-white/8 flex items-center gap-3">
                <span className="text-xs px-2 py-0.5 rounded-md bg-amber-400/10 text-amber-300 border border-amber-400/20 font-medium">
                  {consultation.status}
                </span>
                <span className="text-slate-400 text-xs">{consultation.serviceCategory} Consultation</span>
                {consultation.notes && (
                  <span className="text-slate-500 text-xs truncate">"{consultation.notes}"</span>
                )}
              </div>

              {/* Expert List */}
              <div className="px-6 py-4 max-h-72 overflow-y-auto space-y-2">
                {loading ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 size={24} className="text-cyan-400 animate-spin" />
                  </div>
                ) : experts.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center">
                    <AlertCircle size={24} className="text-slate-500 mb-2" />
                    <p className="text-slate-400 text-sm">No available {consultation.serviceCategory}s right now.</p>
                  </div>
                ) : (
                  experts.map((expert) => (
                    <motion.button
                      key={expert.id}
                      whileHover={{ x: 2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelected(expert)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all
                        ${selected?.id === expert.id
                          ? 'border-cyan-400/50 bg-cyan-500/10'
                          : 'border-white/8 bg-white/3 hover:border-white/20 hover:bg-white/5'}`}
                    >
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {expert.name.charAt(0)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-medium truncate">{expert.name}</span>
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                            expert.availabilityStatus === 'Available' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`} />
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-slate-500 text-xs truncate">{expert.specialization}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Star size={10} className="text-amber-400 fill-amber-400" />
                            <span className="text-amber-400 text-xs">{expert.rating.toFixed(1)}</span>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <Briefcase size={10} className="text-slate-500" />
                            <span className="text-slate-500 text-xs">{expert.totalConsultations}</span>
                          </div>
                        </div>
                      </div>

                      {selected?.id === expert.id && (
                        <CheckCircle size={16} className="text-cyan-400 flex-shrink-0" />
                      )}
                    </motion.button>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t border-white/8 flex items-center justify-between gap-4">
                {error && <p className="text-red-400 text-xs">{error}</p>}
                <div className="flex gap-3 ml-auto">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 rounded-xl border border-white/10 text-slate-300 text-sm hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleAssign}
                    disabled={!selected || submitting}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium
                      bg-gradient-to-r from-cyan-500 to-cyan-400 text-[#020c1b]
                      hover:from-cyan-400 hover:to-cyan-300 transition-all
                      disabled:opacity-40 disabled:cursor-not-allowed
                      shadow-[0_0_16px_rgba(34,211,238,0.2)]"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    Assign Expert
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default AssignmentModal;