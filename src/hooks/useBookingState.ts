// src/hooks/useBookingState.ts
// ─────────────────────────────────────────────────────────────────────────────
// Central state management hook for the 4-step consultation booking wizard.
// Steps: 1 = Type Selection, 2 = Date/Time, 3 = Payment, 4 = Confirmation
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useCallback } from 'react';
import { ExpertType } from '../Types/consultation';
import { CONSULTATION_PRICING } from '../services/consultationService';

export type WizardStep = 1 | 2 | 3 | 4;

export interface BookingState {
  // Step 1
  expertType: ExpertType | null;

  // Step 2
  selectedDate: string | null;   // "YYYY-MM-DD"
  selectedTime: string | null;   // "10:00 AM"

  // Step 3 (Payment)
  paymentDone: boolean;
  paymentId: string | null;
  razorpayOrderId: string | null;

  // Step 4 (Post-booking)
  bookingId: string | null;
  caseId: string | null;

  // Wizard state
  currentStep: WizardStep;
  isLoading: boolean;
  error: string | null;
}

const INITIAL_STATE: BookingState = {
  expertType: null,
  selectedDate: null,
  selectedTime: null,
  paymentDone: false,
  paymentId: null,
  razorpayOrderId: null,
  bookingId: null,
  caseId: null,
  currentStep: 1,
  isLoading: false,
  error: null,
};

export interface UseBookingStateReturn {
  state: BookingState;
  setExpertType: (type: ExpertType) => void;
  setDateTime: (date: string, time: string) => void;
  setPaymentDone: (paymentId: string, orderId: string) => void;
  setBookingCreated: (bookingId: string, caseId: string) => void;
  goToStep: (step: WizardStep) => void;
  nextStep: () => void;
  prevStep: () => void;
  setLoading: (v: boolean) => void;
  setError: (msg: string | null) => void;
  reset: () => void;
  // Derived
  currentPrice: { amount: number; label: string; description: string } | null;
  canProceedFromStep: (step: WizardStep) => boolean;
}

export const useBookingState = (): UseBookingStateReturn => {
  const [state, setState] = useState<BookingState>(INITIAL_STATE);

  const setExpertType = useCallback((type: ExpertType) => {
    setState(prev => ({ ...prev, expertType: type, error: null }));
  }, []);

  const setDateTime = useCallback((date: string, time: string) => {
    setState(prev => ({ ...prev, selectedDate: date, selectedTime: time, error: null }));
  }, []);

  const setPaymentDone = useCallback((paymentId: string, orderId: string) => {
    setState(prev => ({
      ...prev,
      paymentDone: true,
      paymentId,
      razorpayOrderId: orderId,
      error: null,
    }));
  }, []);

  const setBookingCreated = useCallback((bookingId: string, caseId: string) => {
    setState(prev => ({ ...prev, bookingId, caseId, error: null }));
  }, []);

  const goToStep = useCallback((step: WizardStep) => {
    setState(prev => ({ ...prev, currentStep: step, error: null }));
  }, []);

  const nextStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.min(4, prev.currentStep + 1) as WizardStep,
      error: null,
    }));
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => ({
      ...prev,
      currentStep: Math.max(1, prev.currentStep - 1) as WizardStep,
      error: null,
    }));
  }, []);

  const setLoading = useCallback((v: boolean) => {
    setState(prev => ({ ...prev, isLoading: v }));
  }, []);

  const setError = useCallback((msg: string | null) => {
    setState(prev => ({ ...prev, error: msg, isLoading: false }));
  }, []);

  const reset = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  const currentPrice = state.expertType ? CONSULTATION_PRICING[state.expertType] : null;

  const canProceedFromStep = useCallback((step: WizardStep): boolean => {
    switch (step) {
      case 1: return !!state.expertType;
      case 2: return !!state.selectedDate && !!state.selectedTime;
      case 3: return state.paymentDone;
      case 4: return !!state.bookingId;
      default: return false;
    }
  }, [state]);

  return {
    state,
    setExpertType,
    setDateTime,
    setPaymentDone,
    setBookingCreated,
    goToStep,
    nextStep,
    prevStep,
    setLoading,
    setError,
    reset,
    currentPrice,
    canProceedFromStep,
  };
};