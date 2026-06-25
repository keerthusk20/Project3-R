// pages/BookConsultation.tsx
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Scale, Calculator, ChevronRight, ChevronLeft,
  Calendar, Clock, FileText, CheckCircle2, Loader2, ArrowRight, User,
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { getAvailableExperts, bookConsultation, getCustomerConsultations } from '../services/consultationService';
import { ExpertSelectionCard } from '../components/consultation/ExpertSelectionCard';
import type { ExpertProfile, ExpertRole, ConsultationRequest } from '../Types/consultation';
import { UserProfile } from '../types';

const SERVICE_TYPES: Record<ExpertRole, string[]> = {
  CA: ['GST Notice', 'Tax Filing', 'Audit Support', 'Financial Advisory', 'Company Registration'],
  Lawyer: ['Legal Drafting', 'Contract Review', 'Court Representation', 'IP Filing', 'Compliance Advisory'],
};

const STEPS = ['Category', 'Expert', 'Schedule', 'Confirm'];



interface BookConsultationProps {
  user: UserProfile;
}

const BookConsultation: React.FC<BookConsultationProps> = ({ user }) => {
  const [step, setStep] = useState(0);
  const [category, setCategory] = useState<ExpertRole | null>(null);
  const [serviceType, setServiceType] = useState('');
  const [experts, setExperts] = useState<ExpertProfile[]>([]);
  const [selectedExpert, setSelectedExpert] = useState<ExpertProfile | null>(null);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [myConsultations, setMyConsultations] = useState<ConsultationRequest[]>([]);

  const loadMyConsultations = async () => {
    if (!user?.uid) return;
    setHistoryLoading(true);
    try {
      const rows = await getCustomerConsultations(user.uid, user.email ?? undefined);
      setMyConsultations(rows);
    } catch {
      setMyConsultations([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (category && step === 1) {
      setLoading(true);
      getAvailableExperts(category)
        .then(setExperts)
        .catch(() => setExperts([]))
        .finally(() => setLoading(false));
    }
  }, [category, step]);

  useEffect(() => {
    loadMyConsultations();
  }, [user?.uid]);

  const handleCategorySelect = (cat: ExpertRole) => {
    setCategory(cat);
    setServiceType('');
    setSelectedExpert(null);
  };

  const canNext = () => {
    if (step === 0) return category && serviceType;
    if (step === 1) return selectedExpert !== null;
    if (step === 2) return scheduledDate && scheduledTime;
    return true;
  };

  const handleNext = () => { if (canNext()) setStep((s) => s + 1); };
  const handleBack = () => setStep((s) => s - 1);

  const handleSubmit = async () => {
    if (!user || !category || !selectedExpert) return;
    setLoading(true);
    setError('');
    try {
      const [year, month, day] = scheduledDate.split('-').map(Number);
      const [hour, minute] = scheduledTime.split(':').map(Number);
      const scheduled = new Date(year, month - 1, day, hour, minute);
      await bookConsultation({
        customerId: user.uid,
        customerName: user.displayName ?? 'Customer',
        customerEmail: user.email ?? '',
        serviceType,
        serviceCategory: category,
        scheduledTime: scheduled,
        notes,
        preferredExpertId: selectedExpert.id,
        preferredExpertName: selectedExpert.name,
      });
      await loadMyConsultations();
      setSubmitted(true);
    } catch {
      setError('Failed to submit booking. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-md"
        >
          <div className="w-20 h-20 rounded-full bg-emerald-400/10 border border-emerald-400/30 flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 size={40} className="text-emerald-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">Booking Confirmed</h2>
          <p className="text-slate-400 mb-2">
            Your consultation with <span className="text-white">{selectedExpert?.name}</span> has been submitted.
          </p>
          <p className="text-slate-500 text-sm">Our support team will confirm your appointment shortly.</p>
          <button
            onClick={() => {
              setSubmitted(false); setStep(0); setCategory(null);
              setSelectedExpert(null); setNotes('');
            }}
            className="mt-8 px-6 py-2.5 rounded-xl bg-white/10 border border-white/10 text-white text-sm hover:bg-white/15 transition-all"
          >
            Book Another
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="relative max-w-3xl mx-auto px-4 py-12">
        <div className="mb-10">
          <h1 className="text-3xl font-bold text-white mb-2">Book a Consultation</h1>
          <p className="text-slate-400">Connect with top CAs and Advocates for your compliance needs.</p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center gap-2 mb-10">
          {STEPS.map((label, i) => (
            <React.Fragment key={label}>
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300
                  ${i < step ? 'bg-cyan-400 text-[#020c1b]' : i === step ? 'bg-cyan-400/20 border border-cyan-400/60 text-cyan-400' : 'bg-white/5 border border-white/10 text-slate-500'}`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i === step ? 'text-white' : 'text-slate-500'}`}>{label}</span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px transition-all duration-500 ${i < step ? 'bg-cyan-400/50' : 'bg-white/10'}`} />
              )}
            </React.Fragment>
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25 }}
          >
            {/* STEP 0: Category */}
            {step === 0 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white">What do you need help with?</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {(['CA', 'Lawyer'] as ExpertRole[]).map((cat) => (
                    <motion.button
                      key={cat}
                      whileHover={{ y: -4 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={() => handleCategorySelect(cat)}
                      className={`p-6 rounded-2xl border text-left transition-all duration-300 backdrop-blur-md
                        ${category === cat
                          ? 'border-cyan-400/60 bg-cyan-500/10 shadow-[0_0_30px_rgba(34,211,238,0.12)]'
                          : 'border-white/10 bg-white/5 hover:border-white/25'}`}
                    >
                      <div className="mb-4">
                        {cat === 'CA'
                          ? <Calculator size={28} className={category === cat ? 'text-cyan-400' : 'text-slate-400'} />
                          : <Scale size={28} className={category === cat ? 'text-cyan-400' : 'text-slate-400'} />}
                      </div>
                      <h3 className="font-bold text-white mb-1">{cat === 'CA' ? 'Chartered Accountant' : 'Advocate'}</h3>
                      <p className="text-slate-400 text-sm">{cat === 'CA' ? 'Tax, GST, Audit & Financial' : 'Contracts, Compliance & Litigation'}</p>
                    </motion.button>
                  ))}
                </div>

                {category && (
                  <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
                    <p className="text-slate-400 text-sm mb-3">Select a service type:</p>
                    <div className="flex flex-wrap gap-2">
                      {SERVICE_TYPES[category].map((svc) => (
                        <button
                          key={svc}
                          onClick={() => setServiceType(svc)}
                          className={`px-3 py-1.5 rounded-lg text-sm border transition-all
                            ${serviceType === svc
                              ? 'bg-cyan-400/20 border-cyan-400/60 text-cyan-300'
                              : 'bg-white/5 border-white/10 text-slate-300 hover:border-white/25'}`}
                        >
                          {svc}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </div>
            )}

            {/* STEP 1: Expert */}
            {step === 1 && (
              <div>
                <h2 className="text-xl font-semibold text-white mb-1">Choose your Expert</h2>
                <p className="text-slate-400 text-sm mb-6">
                  Showing available {category === 'Lawyer' ? 'Advocates' : 'CAs'} for {serviceType}
                </p>
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 size={32} className="text-cyan-400 animate-spin" />
                  </div>
                ) : experts.length === 0 ? (
                  <div className="text-center py-16 text-slate-500">
                    No experts available at the moment. Please try later.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {experts.map((expert) => (
                      <ExpertSelectionCard
                        key={expert.id}
                        expert={expert}
                        selected={selectedExpert?.id === expert.id}
                        onSelect={setSelectedExpert}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* STEP 2: Schedule */}
            {step === 2 && (
              <div className="space-y-6">
                <h2 className="text-xl font-semibold text-white mb-1">Pick a Date & Time</h2>
                <p className="text-slate-400 text-sm">Scheduling with {selectedExpert?.name}</p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-slate-400 text-xs mb-2 uppercase tracking-wider">Date</label>
                    <div className="relative">
                      <Calendar size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="date"
                        value={scheduledDate}
                        onChange={(e) => setScheduledDate(e.target.value)}
                        min={new Date().toISOString().split('T')[0]}
                        className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 transition-all"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-slate-400 text-xs mb-2 uppercase tracking-wider">Time</label>
                    <div className="relative">
                      <Clock size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="time"
                        value={scheduledTime}
                        onChange={(e) => setScheduledTime(e.target.value)}
                        className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-cyan-400/50 transition-all"
                      />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="block text-slate-400 text-xs mb-2 uppercase tracking-wider">Notes (optional)</label>
                  <div className="relative">
                    <FileText size={14} className="absolute left-3 top-3.5 text-slate-400" />
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Describe your issue briefly..."
                      rows={4}
                      className="w-full pl-9 pr-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-cyan-400/50 resize-none transition-all"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Confirm */}
            {step === 3 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-white mb-1">Confirm Booking</h2>
                <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md p-6 space-y-4">
                  {[
                    { label: 'Service', value: `${serviceType} (${category})` },
                    { label: 'Expert', value: selectedExpert?.name ?? '' },
                    { label: 'Specialization', value: selectedExpert?.specialization ?? '' },
                    { label: 'Date', value: scheduledDate },
                    { label: 'Time', value: scheduledTime },
                    ...(notes ? [{ label: 'Notes', value: notes }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-start gap-4">
                      <span className="text-slate-400 text-sm flex-shrink-0">{label}</span>
                      <span className="text-white text-sm text-right">{value}</span>
                    </div>
                  ))}
                </div>
                {error && <p className="text-red-400 text-sm">{error}</p>}
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-10">
          <button
            onClick={handleBack}
            disabled={step === 0}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-white/10 text-slate-400 hover:text-white hover:border-white/25 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft size={16} /> Back
          </button>

          {step < 3 ? (
            <button
              onClick={handleNext}
              disabled={!canNext()}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-cyan-500 to-cyan-400 text-[#020c1b] hover:from-cyan-400 hover:to-cyan-300 transition-all disabled:opacity-30 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(34,211,238,0.2)]"
            >
              Next <ChevronRight size={16} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-medium text-sm bg-gradient-to-r from-cyan-500 to-purple-500 text-white hover:from-cyan-400 hover:to-purple-400 transition-all disabled:opacity-50 shadow-[0_0_24px_rgba(34,211,238,0.25)]"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : <ArrowRight size={16} />}
              {loading ? 'Submitting...' : 'Confirm Booking'}
            </button>
          )}
        </div>

        <div className="mt-12">
          <h3 className="text-xl font-semibold text-white mb-4">My Booked Experts</h3>
          {historyLoading ? (
            <div className="flex items-center gap-2 text-slate-400 text-sm">
              <Loader2 size={16} className="animate-spin" />
              Loading your consultations...
            </div>
          ) : myConsultations.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-slate-500 text-sm">
              No consultations booked yet.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {myConsultations.map((item) => {
                const expertName = item.assignedExpertName || (item as any).expertName || 'Awaiting assignment';
                return (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
                    <p className="text-xs text-cyan-300 font-bold uppercase tracking-wider">{item.serviceCategory}</p>
                    <p className="text-white font-semibold mt-1">{item.serviceType}</p>
                    <div className="mt-2 text-sm text-slate-300 flex items-center gap-2">
                      <User size={14} className="text-slate-400" />
                      <span>{expertName}</span>
                    </div>
                    <p className="text-xs text-slate-400 mt-2">Status: {item.status}</p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookConsultation;