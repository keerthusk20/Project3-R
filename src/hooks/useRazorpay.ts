import { useCallback } from 'react';
import {
  initiateRazorpayPayment,
  type RazorpaySuccessResponse,
  type RazorpayPaymentOptions,
} from '../services/razorpayService';

/**
 * Hook that starts the Razorpay checkout flow.
 *
 * @param amount   Amount in INR (e.g. 599 for ₹599). The hook will convert to paise.
 * @param onSuccess Callback invoked with the Razorpay success payload.
 * @param options   Optional override for name, description, prefill, notes, etc.
 */
export const useRazorpay = () => {
  const displayRazorpay = useCallback(
    async (
      amount: number,
      onSuccess: (response: RazorpaySuccessResponse) => void,
      options?: Partial<Omit<RazorpayPaymentOptions, 'amount' | 'handler'>>
    ): Promise<boolean> => {
      // Convert amount to paise (Razorpay expects the smallest currency unit)
      const amountPaise = Math.round(amount * 100);

      const started = await initiateRazorpayPayment({
        amount: amountPaise,
        currency: options?.currency ?? 'INR',
        name: options?.name ?? 'RegiBIZ',
        description: options?.description ?? 'Service Payment',
        prefill: options?.prefill,
        notes: options?.notes,
        handler: (resp) => {
          onSuccess(resp);
        },
        onClosed: options?.onClosed,
      });

      return started;
    },
    []
  );

  return { displayRazorpay };
};
