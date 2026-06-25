import React, { useEffect } from 'react';
import {
  X, Briefcase, Gavel, CheckCircle2, Calendar,
  CreditCard, User, ChevronRight, Sparkles, Phone, ArrowLeft,
} from 'lucide-react';
import { ExpertType } from '../../Types/consultation';
import { useBookingState, WizardStep } from '../../hooks/useBookingState';
import { StepDateTime } from './StepDateTime';
import { StepConfirmation } from './StepConfirmation';
import { CONSULTATION_PRICING } from '../../services/consultationService';

interface BookingWizardProps {
  isOpen: boolean;
  expertType?: ExpertType;
  user?: any;
  onClose: () => void;
}

// ─── Step Indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: 'Expert' },
  { num: 2, label: 'Schedule' },
  { num: 3, label: 'Payment' },
  { num: 4, label: 'Done' },
];

const StepIndicator: React.FC<{ current: WizardStep }> = ({ current }) => (
  <div className="flex items-center gap-0 px-6 pb-5">
    {STEPS.map((step, i) => {
      const done = step.num < current;
      const active = step.num === current;
      return (
        <React.Fragment key={step.num}>
          <div className="flex flex-col items-center gap-1.5 shrink-0">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all duration-300
              ${done ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30'
                : active ? 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-lg shadow-amber-500/30 scale-110'
                : 'bg-white/8 text-slate-600 border border-white/10'}`}>
              {done ? <CheckCircle2 size={14} /> : step.num}
            </div>
            <span className={`text-[9px] font-bold uppercase tracking-wider
              ${active ? 'text-amber-400' : done ? 'text-emerald-400' : 'text-slate-600'}`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`flex-1 h-0.5 mx-2 mb-4 rounded-full transition-all duration-500
              ${done ? 'bg-gradient-to-r from-emerald-500 to-emerald-400' : 'bg-white/8'}`} />
          )}
        </React.Fragment>
      );
    })}
  </div>
);

// ─── Expert Type Card ─────────────────────────────────────────────────────────

const ExpertTypeCard: React.FC<{
  type: ExpertType;
  selected: boolean;
  onSelect: () => void;
}> = ({ type, selected, onSelect }) => {
  const isCA = type === 'CA';
  const pricing = CONSULTATION_PRICING[type];
  const gradient = isCA ? 'from-amber-500 to-orange-500' : 'from-cyan-500 to-blue-600';
  const features = isCA
    ? ['Tax Planning & ITR', 'GST Registration', 'Audit Support', 'Business Finance']
    : ['Contract Drafting', 'Legal Compliance', 'Trademark Filing', 'IP Protection'];

  return (
    <button onClick={onSelect}
      className={`relative w-full p-5 rounded-2xl border-2 text-left transition-all duration-200 overflow-hidden group
        ${selected
          ? `border-transparent shadow-2xl ${isCA ? 'shadow-amber-500/20' : 'shadow-cyan-500/20'}`
          : 'border-white/10 bg-white/3 hover:border-white/20 hover:bg-white/5'}`}>

      {selected && (
        <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-10`} />
      )}
      {selected && (
        <div className={`absolute inset-0 border-2 rounded-2xl border-transparent bg-gradient-to-br ${gradient} opacity-60`}
          style={{ WebkitMask: 'linear-gradient(#fff 0 0) padding-box, linear-gradient(#fff 0 0)', WebkitMaskComposite: 'destination-out', maskComposite: 'exclude' }} />
      )}

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
            {isCA ? <Briefcase size={20} className="text-white" /> : <Gavel size={20} className="text-white" />}
          </div>
          {selected && (
            <div className={`w-6 h-6 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-lg`}>
              <CheckCircle2 size={13} className="text-white" />
            </div>
          )}
        </div>

        <h3 className="text-white font-bold text-base mb-0.5">
          {isCA ? 'Chartered Accountant' : 'Corporate Lawyer'}
        </h3>
        <p className={`text-xs font-semibold mb-3 bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
          {isCA ? 'Tax & Finance' : 'Legal & Compliance'}
        </p>

        <ul className="space-y-1 mb-4">
          {features.map(f => (
            <li key={f} className="flex items-center gap-2 text-xs text-slate-400">
              <span className={`w-1 h-1 rounded-full bg-gradient-to-r ${gradient} shrink-0`} />
              {f}
            </li>
          ))}
        </ul>

        <div className="flex items-baseline gap-1 pt-3 border-t border-white/8">
          <span className={`text-xl font-black bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
            {pricing.label}
          </span>
          <span className="text-xs text-slate-600">+ GST / session</span>
        </div>
      </div>
    </button>
  );
};

// ─── Success Step ─────────────────────────────────────────────────────────────

const SuccessStep: React.FC<{
  caseId: string;
  expertType: ExpertType;
  date: string;
  time: string;
  onClose: () => void;
}> = ({ caseId, expertType, date, time, onClose }) => {
  const isCA = expertType === 'CA';
  const gradient = isCA ? 'from-amber-400 to-orange-500' : 'from-cyan-400 to-blue-500';

  return (
    <div className="text-center py-4 space-y-6">
      {/* Animated success */}
      <div className="relative flex items-center justify-center h-24">
        <div className="absolute w-24 h-24 rounded-full bg-emerald-500/10 animate-ping" />
        <div className="absolute w-16 h-16 rounded-full bg-emerald-500/20 animate-pulse" />
        <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center shadow-2xl shadow-emerald-500/30">
          <CheckCircle2 size={36} className="text-white" />
        </div>
      </div>

      <div>
        <h3 className="text-2xl font-black text-white mb-2">Booking Confirmed!</h3>
        <p className="text-slate-400 text-sm max-w-xs mx-auto">
          Your consultation is booked. Our team will call you within 24 hours to schedule the session.
        </p>
      </div>

      {/* Case ID */}
      <div className="bg-white/3 border border-white/10 rounded-2xl p-4">
        <p className="text-xs text-slate-500 uppercase tracking-widest mb-2">Case Reference</p>
        <p className={`font-black text-xl font-mono tracking-widest bg-gradient-to-r ${gradient} bg-clip-text text-transparent`}>
          {caseId}
        </p>
      </div>

      {/* Summary */}
      <div className="bg-white/3 rounded-xl border border-white/8 p-4 text-left space-y-3">
        {[
          { label: 'Expert Type', value: isCA ? 'Chartered Accountant' : 'Corporate Lawyer' },
          { label: 'Preferred Date', value: new Date(date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) },
          { label: 'Preferred Time', value: time },
        ].map(({ label, value }) => (
          <div key={label} className="flex justify-between items-center text-sm">
            <span className="text-slate-500">{label}</span>
            <span className="text-white font-semibold">{value}</span>
          </div>
        ))}
      </div>

      {/* Phone note */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/8">
        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
          <Phone size={15} className="text-white" />
        </div>
        <p className="text-slate-300 text-sm text-left">
          Our support team will call your registered number within <strong className="text-white">24 hours</strong>.
        </p>
      </div>

      <button onClick={onClose}
        className={`w-full py-3.5 rounded-xl bg-gradient-to-r ${gradient} text-white font-black hover:brightness-110 transition-all shadow-lg`}>
        Done
      </button>
    </div>
  );
};

// ─── Main Wizard ──────────────────────────────────────────────────────────────

export const BookingWizard: React.FC<BookingWizardProps> = ({
  isOpen, expertType: preselectedType, user, onClose,
}) => {
  const {
    state, setExpertType, setDateTime, setPaymentDone, setBookingCreated,
    goToStep, nextStep, prevStep, setError, reset, canProceedFromStep,
  } = useBookingState();

  useEffect(() => {
    if (isOpen && preselectedType) { setExpertType(preselectedType); goToStep(2); }
    else if (isOpen && !preselectedType) { goToStep(1); }
  }, [isOpen, preselectedType]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleClose = () => { reset(); onClose(); };

  const handlePaymentSuccess = (paymentId: string, orderId: string, bookingId: string, caseId: string) => {
    setPaymentDone(paymentId, orderId);
    setBookingCreated(bookingId, caseId);
    goToStep(4);
  };

  const stepTitles: Record<number, string> = {
    1: 'Choose Expert Type',
    2: 'Pick Date & Time',
    3: 'Review & Pay',
    4: 'Booking Confirmed',
  };

  if (!isOpen) return null;

  const isCA = state.expertType === 'CA';
  const accentGradient = state.expertType
    ? (isCA ? 'from-amber-400 to-orange-500' : 'from-cyan-400 to-blue-500')
    : 'from-slate-400 to-slate-500';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-slate-950/90 backdrop-blur-md">
      <div className="bg-[#0d1117] w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border-0 sm:border border-white/10 shadow-2xl flex flex-col max-h-[95vh] sm:max-h-[90vh] overflow-hidden">

        {/* Top gradient accent */}
        <div className={`h-0.5 bg-gradient-to-r ${accentGradient} shrink-0`} />

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 shrink-0">
          <div>
            <p className="text-[10px] text-slate-600 uppercase tracking-widest font-bold mb-0.5">
              Step {state.currentStep} of 4
            </p>
            <h2 className="text-xl font-black text-white">{stepTitles[state.currentStep]}</h2>
          </div>
          <button onClick={handleClose}
            className="w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all">
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <StepIndicator current={state.currentStep} />

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 pb-4">

          {/* Step 1: Type */}
          {state.currentStep === 1 && (
            <div className="space-y-4">
              <p className="text-slate-500 text-sm mb-5">Select the expert you'd like to consult.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(['CA', 'Lawyer'] as ExpertType[]).map(type => (
                  <ExpertTypeCard key={type} type={type} selected={state.expertType === type} onSelect={() => setExpertType(type)} />
                ))}
              </div>
              <div className="flex items-center gap-2 p-3 bg-white/3 rounded-xl border border-white/8 mt-4">
                <Sparkles size={14} className="text-amber-400 shrink-0" />
                <p className="text-xs text-slate-500">All sessions include detailed Q&A, document review, and follow-up guidance.</p>
              </div>
            </div>
          )}

          {/* Step 2: Date & Time */}
          {state.currentStep === 2 && state.expertType && (
            <StepDateTime
              expertType={state.expertType}
              selectedDate={state.selectedDate}
              selectedTime={state.selectedTime}
              onSelect={setDateTime}
            />
          )}

          {/* Step 3: Payment */}
          {state.currentStep === 3 && state.expertType && state.selectedDate && state.selectedTime && (
            <StepConfirmation
              expertType={state.expertType}
              selectedDate={state.selectedDate}
              selectedTime={state.selectedTime}
              user={user}
              onPaymentSuccess={handlePaymentSuccess}
              onError={setError}
            />
          )}

          {/* Step 4: Success */}
          {state.currentStep === 4 && state.expertType && state.selectedDate && state.selectedTime && state.caseId && (
            <SuccessStep
              caseId={state.caseId}
              expertType={state.expertType}
              date={state.selectedDate}
              time={state.selectedTime}
              onClose={handleClose}
            />
          )}

          {/* Error */}
          {state.error && state.currentStep !== 3 && (
            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
              <p className="text-red-400 text-sm">{state.error}</p>
            </div>
          )}
        </div>

        {/* Footer Nav */}
        {state.currentStep !== 3 && state.currentStep !== 4 && (
          <div className="px-6 py-4 border-t border-white/8 shrink-0 flex gap-3">
            {state.currentStep > 1 && (
              <button onClick={prevStep}
                className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-slate-400 bg-white/5 hover:bg-white/8 border border-white/10 transition-all text-sm">
                <ArrowLeft size={15} /> Back
              </button>
            )}
            <button onClick={nextStep} disabled={!canProceedFromStep(state.currentStep)}
              className={`flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2 transition-all
                ${canProceedFromStep(state.currentStep)
                  ? `bg-gradient-to-r ${accentGradient} text-white hover:brightness-110 shadow-lg`
                  : 'bg-white/5 text-slate-600 cursor-not-allowed border border-white/5'}`}>
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};