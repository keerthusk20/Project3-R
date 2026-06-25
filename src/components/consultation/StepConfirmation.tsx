import React, { useState } from 'react';
import {
  CreditCard, ShieldCheck, Loader2, AlertCircle,
  Calendar, Clock, Briefcase, Gavel, CheckCircle2, IndianRupee,
  ArrowRight,
} from 'lucide-react';
import { ExpertType } from '../../Types/consultation';
import {
  CONSULTATION_PRICING,
  createRazorpayOrder,
  openRazorpayCheckout,
  createBooking,
  confirmBookingPayment,
  sendEmailNotification,
  emailTemplates,
} from '../../services/consultationService';

interface StepConfirmationProps {
  expertType: ExpertType;
  selectedDate: string;
  selectedTime: string;
  user: {
    uid: string;
    displayName: string | null;
    email: string | null;
    phoneNumber?: string | null;
  };
  onPaymentSuccess: (paymentId: string, orderId: string, bookingId: string, caseId: string) => void;
  onError: (msg: string) => void;
}

type PaymentStep = 'idle' | 'creating_order' | 'processing' | 'confirming' | 'done' | 'error';

export const StepConfirmation: React.FC<StepConfirmationProps> = ({
  expertType, selectedDate, selectedTime, user, onPaymentSuccess, onError,
}) => {
  const [paymentStep, setPaymentStep] = useState<PaymentStep>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const pricing = CONSULTATION_PRICING[expertType];
  const isCA = expertType === 'CA';
  const gradient = isCA ? 'from-amber-500 to-orange-500' : 'from-cyan-500 to-blue-600';
  const gradientText = isCA ? 'from-amber-400 to-orange-400' : 'from-cyan-400 to-blue-400';

  const formattedDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const gst = Math.round(pricing.amount * 0.18);
  const total = pricing.amount + gst;

  const handlePayNow = async () => {
    if (!user) return;
    setErrorMsg(null);
    setPaymentStep('creating_order');
    let bookingId = '';
    try {
      bookingId = await createBooking({
        userId: user.uid,
        userName: user.displayName || 'Unknown',
        userEmail: user.email || '',
        userPhone: user.phoneNumber || '',
        consultationType: expertType,
        date: selectedDate,
        time: selectedTime,
        status: 'pending',
        paymentStatus: 'pending',
        amount: total,
        assignedTo: undefined,
        assignedExpertName: undefined,
        scheduledDate: null,
        issues: [],
        reviewSubmitted: false,
      });

      const order = await createRazorpayOrder(total, bookingId);
      setPaymentStep('processing');

      await new Promise<void>((resolve, reject) => {
        openRazorpayCheckout({
          orderId: order.orderId,
          amount: order.amount,
          currency: order.currency,
          keyId: order.keyId,
          userName: user.displayName || 'Customer',
          userEmail: user.email || '',
          userPhone: user.phoneNumber || '',
          bookingId,
          expertType,
          onSuccess: async (paymentId, rzpOrderId) => {
            try {
              setPaymentStep('confirming');
              await confirmBookingPayment(bookingId, paymentId, rzpOrderId);
              const { getBooking } = await import('../../services/consultationService');
              const booking = await getBooking(bookingId);
              const caseId = booking?.caseId || bookingId;

              if (user.email) {
                await sendEmailNotification({
                  to: user.email,
                  ...emailTemplates.bookingConfirmed({
                    caseId, consultationType: expertType,
                    date: formattedDate, time: selectedTime, amount: total,
                  }),
                });
              }

              const adminEmail = import.meta.env.VITE_ADMIN_EMAIL || 'admin@regibiz.com';
              await sendEmailNotification(emailTemplates.newBookingAlert(
                { caseId, userName: user.displayName || 'Customer', userEmail: user.email || '', consultationType: expertType, date: selectedDate, time: selectedTime, amount: total },
                adminEmail
              ));

              setPaymentStep('done');
              onPaymentSuccess(paymentId, rzpOrderId, bookingId, caseId);
              resolve();
            } catch (err: any) { reject(err); }
          },
          onFailure: (errMsg) => reject(new Error(errMsg)),
        });
      });
    } catch (err: any) {
      const msg = err?.message || 'Payment failed. Please try again.';
      setErrorMsg(msg);
      setPaymentStep('error');
      onError(msg);
    }
  };

  const isProcessing = ['creating_order', 'processing', 'confirming'].includes(paymentStep);

  const stepLabels: Record<PaymentStep, string> = {
    idle: `Pay ₹${(total / 100).toFixed(0)} with Razorpay`,
    creating_order: 'Creating Order...',
    processing: 'Complete Payment in Popup...',
    confirming: 'Confirming Payment...',
    done: 'Payment Confirmed!',
    error: `Retry Payment · ₹${(total / 100).toFixed(0)}`,
  };

  return (
    <div className="space-y-4">

      {/* Expert Header */}
      <div className={`rounded-2xl overflow-hidden bg-gradient-to-r ${gradient}`}>
        <div className="p-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
            {isCA ? <Briefcase size={22} className="text-white" /> : <Gavel size={22} className="text-white" />}
          </div>
          <div>
            <h3 className="text-white font-black text-base">
              {isCA ? 'Chartered Accountant' : 'Corporate Lawyer'} Session
            </h3>
            <p className="text-white/70 text-xs">{pricing.description}</p>
          </div>
        </div>
      </div>

      {/* Booking Details */}
      <div className="bg-white/3 rounded-2xl border border-white/10 p-4 space-y-3">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Session Details</p>
        <div className="space-y-2.5">
          <div className="flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
              <Calendar size={13} className="text-slate-400" />
            </div>
            <span className="text-slate-300">{formattedDate}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
              <Clock size={13} className="text-slate-400" />
            </div>
            <span className="text-slate-300">{selectedTime}</span>
          </div>
          <div className="flex items-center gap-3 text-sm">
            <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center">
              <ShieldCheck size={13} className="text-emerald-400" />
            </div>
            <span className="text-slate-300">One-on-one expert session via phone call</span>
          </div>
        </div>
      </div>

      {/* Price Breakdown */}
      <div className="bg-white/3 rounded-2xl border border-white/10 p-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">Price Breakdown</p>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Session fee</span>
            <span className="text-slate-200">₹{(pricing.amount / 100).toFixed(0)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">GST (18%)</span>
            <span className="text-slate-200">₹{(gst / 100).toFixed(0)}</span>
          </div>
          <div className="flex justify-between font-black text-base border-t border-white/10 pt-2 mt-1">
            <span className="text-white">Total</span>
            <span className={`bg-gradient-to-r ${gradientText} bg-clip-text text-transparent`}>
              ₹{(total / 100).toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* What Happens Next */}
      <div className="bg-white/3 rounded-2xl border border-white/10 p-4">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3">What Happens Next</p>
        <div className="space-y-2.5">
          {[
            'Payment processed securely via Razorpay',
            'Confirmation email sent to your inbox',
            'Support team calls you within 24 hours',
            'Expert assigned and session scheduled',
          ].map((text, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className={`w-5 h-5 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                <span className="text-[9px] font-black text-white">{i + 1}</span>
              </div>
              <p className="text-slate-400 text-xs">{text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Error */}
      {errorMsg && (
        <div className="flex items-start gap-3 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl">
          <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
          <p className="text-red-400 text-sm">{errorMsg}</p>
        </div>
      )}

      {/* Pay Button */}
      <button onClick={handlePayNow} disabled={isProcessing || paymentStep === 'done'}
        className={`w-full py-4 rounded-xl font-black text-sm flex items-center justify-center gap-3 transition-all duration-200
          ${paymentStep === 'done'
            ? 'bg-emerald-600 text-white cursor-default'
            : isProcessing
            ? 'bg-white/5 border border-white/10 text-slate-500 cursor-not-allowed'
            : `bg-gradient-to-r ${gradient} text-white hover:brightness-110 shadow-xl active:scale-[0.98]`}`}>
        {isProcessing ? (
          <><Loader2 className="animate-spin" size={18} /><span>{stepLabels[paymentStep]}</span></>
        ) : paymentStep === 'done' ? (
          <><CheckCircle2 size={18} /><span>Payment Confirmed!</span></>
        ) : (
          <><IndianRupee size={18} /><span>{stepLabels[paymentStep]}</span><ArrowRight size={16} /></>
        )}
      </button>

      <p className="text-center text-[11px] text-slate-700 flex items-center justify-center gap-1.5">
        <ShieldCheck size={11} className="text-slate-600" />
        Secured by Razorpay · 256-bit SSL
      </p>
    </div>
  );
};