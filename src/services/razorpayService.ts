// src/services/razorpayService.ts

export interface RazorpayPaymentOptions {
  amount: number;
  currency?: string;
  name: string;
  description: string;
  prefill?: {
    name?: string;
    email?: string;
    contact?: string;
  };
  notes?: Record<string, string>;
  handler: (response: RazorpaySuccessResponse) => void;
  onClosed?: () => void;
}

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

import { mockAuthService } from './mockFirebase';
import { notifyPaymentSuccess, notifyPaymentFailed, notifyServicePurchased } from '../components/NotificationDropdown';

// ─────────────────────────────────────────────
// ✅ FIX 1: Mock mode only when key is truly missing or explicitly flagged.
//    Your old check treated `rzp_test_*` keys as mock — that's wrong.
//    Real Razorpay test keys start with "rzp_test_" and ARE valid.
//    Only mock when the env var is absent or you explicitly set VITE_USE_MOCK_PAYMENT=true.
// ─────────────────────────────────────────────
const MOCK_MODE =
  !import.meta.env.VITE_RAZORPAY_KEY_ID ||
  import.meta.env.VITE_USE_MOCK_PAYMENT === "true";

/**
 * Dynamically loads the Razorpay checkout script.
 */
const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);

    // Already loaded
    if ((window as any).Razorpay) return resolve(true);

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => {
      console.error("❌ Failed to load Razorpay SDK");
      resolve(false);
    };
    document.body.appendChild(script);
  });
};

// ─────────────────────────────────────────────
// ✅ FIX 2: In production you MUST create an order on your backend first,
//    then pass `order_id` here. Razorpay requires it for signature verification.
//
//    Example backend call (add when you have a server):
//
//    const { orderId } = await fetch("/api/create-razorpay-order", {
//      method: "POST",
//      body: JSON.stringify({ amount: options.amount, currency: options.currency }),
//    }).then(r => r.json());
//
//    Then set `razorpayOptions.order_id = orderId` below.
//
//    For now, omitting order_id works in test mode but is NOT safe for production.
// ─────────────────────────────────────────────

/**
 * Initiates the Razorpay payment flow.
 * Returns true if flow was successfully initiated, false on failure.
 */
export const initiateRazorpayPayment = async (
  options: RazorpayPaymentOptions
): Promise<boolean> => {
  // ── MOCK MODE ──────────────────────────────
  if (MOCK_MODE) {
    console.warn(
      "🧪 [MOCK MODE] Simulating payment. Set VITE_RAZORPAY_KEY_ID in .env to use real payments."
    );

    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResponse: RazorpaySuccessResponse = {
          razorpay_payment_id: `mock_pay_${Date.now()}`,
          razorpay_order_id: `mock_order_${Date.now()}`,
          razorpay_signature: "mock_signature_test",
        };

        console.log("✅ [MOCK] Payment Successful:", mockResponse);
        // ✅ FIX 3: Use a non-blocking UI notification instead of alert() in production.
        //    For now keeping alert for dev visibility; swap with a toast in prod.
        const user = mockAuthService.getCurrentUser();
        if (user) {
           notifyPaymentSuccess(user.uid, mockResponse.razorpay_payment_id, options.amount / 100, options.currency ?? "INR", options.name);
           notifyServicePurchased(user.uid, options.name || 'Service');
        }

        options.handler(mockResponse);
        resolve(true);
      }, 1500);
    });
  }

  // ── REAL PAYMENT ───────────────────────────
  const isScriptLoaded = await loadRazorpayScript();

  if (!isScriptLoaded) {
    alert("Payment gateway failed to load. Please check your connection and try again.");
    return false;
  }

  const razorpayKeyId = import.meta.env.VITE_RAZORPAY_KEY_ID;

  if (!razorpayKeyId) {
    console.error("❌ VITE_RAZORPAY_KEY_ID is missing from environment");
    return false;
  }

  const razorpayOptions: Record<string, any> = {
    key: razorpayKeyId,
    amount: options.amount,              // In paise (e.g. 59900 = ₹599)
    currency: options.currency ?? "INR",
    name: options.name,
    description: options.description,
    prefill: options.prefill ?? {},
    notes: options.notes ?? {},
    theme: {
      color: "#f97316",                  // Orange — matches your UI
    },
    modal: {
      // ✅ FIX 4: ondismiss fires when user closes the modal.
      //    Your landing page's onClosed callback resets isProcessing — this wires it up correctly.
      ondismiss: () => {
        console.log("💬 Razorpay modal closed by user");
        options.onClosed?.();
      },
      escape: true,                       // Allow Escape key to close
      animation: true,
    },
    handler: (response: RazorpaySuccessResponse) => {
      console.log("✅ Payment Successful:", response);
      const user = mockAuthService.getCurrentUser();
      if (user) {
         notifyPaymentSuccess(user.uid, response.razorpay_payment_id || `mock_pay_${Date.now()}`, options.amount / 100, options.currency ?? "INR", options.name);
         notifyServicePurchased(user.uid, options.name || 'Service');
      }
      options.handler(response);
    },
  };

  try {
    const razorpay = new (window as any).Razorpay(razorpayOptions);

    // ✅ FIX 5: Listen for payment failures (card declined, etc.)
    //    Without this, failed payments silently close the modal with no feedback.
    razorpay.on("payment.failed", (failureResponse: any) => {
      console.error("❌ Payment failed:", failureResponse.error);
      const user = mockAuthService.getCurrentUser();
      if (user) {
         notifyPaymentFailed(user.uid, `failed_${Date.now()}`, options.amount / 100, failureResponse.error?.description ?? "Unknown error");
      }
      alert(
        `Payment failed: ${failureResponse.error?.description ?? "Unknown error"}. Please try again.`
      );
      options.onClosed?.(); // Reset processing state in parent
    });

    razorpay.open();
    return true;
  } catch (error) {
    console.error("❌ Razorpay initialization error:", error);
    alert(`Payment Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    return false;
  }
};

// ─────────────────────────────────────────────
// ✅ FIX 6: Signature verification MUST happen on your backend, not frontend.
//    The frontend cannot safely verify HMAC signatures — the secret key would be exposed.
//
//    Implement this on your server (Node.js example):
//
//    const crypto = require("crypto");
//    const generatedSignature = crypto
//      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//      .update(`${orderId}|${paymentId}`)
//      .digest("hex");
//    return generatedSignature === signature;
//
//    This client stub just calls your backend endpoint:
// ─────────────────────────────────────────────
export const verifyPaymentSignature = async (
  orderId: string,
  paymentId: string,
  signature: string
): Promise<boolean> => {
  try {
    const response = await fetch("/api/verify-payment", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId, paymentId, signature }),
    });

    if (!response.ok) throw new Error("Verification request failed");

    const { verified } = await response.json();
    return verified === true;
  } catch (error) {
    console.error("❌ Signature verification error:", error);
    return false;
  }
};