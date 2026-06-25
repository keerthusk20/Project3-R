import { getFunctions, httpsCallable } from "firebase/functions";
import { functions } from "./firebase"; 

export interface RazorpaySuccessResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

export interface RazorpayPaymentOptions {
  amount: number;
  currency?: string;
  name: string;
  description: string;
  prefill?: { name?: string; email?: string; contact?: string };
  notes?: Record<string, string>;
  handler: (response: RazorpaySuccessResponse) => void;
  onClosed?: () => void;
}

const RAZORPAY_KEY = (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_RAZORPAY_KEY_ID) || "";
const MOCK_MODE = !RAZORPAY_KEY || (typeof import.meta !== "undefined" && (import.meta as any).env?.VITE_USE_MOCK_PAYMENT === "true");

const loadRazorpayScript = (): Promise<boolean> => {
  return new Promise((resolve) => {
    if (typeof window === "undefined") return resolve(false);
    if ((window as any).Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export const initiateRazorpayPayment = async (options: RazorpayPaymentOptions): Promise<boolean> => {
  if (MOCK_MODE) {
    console.warn("🧪 [MOCK MODE] Simulating Razorpay payment...");
    return new Promise((resolve) => {
      setTimeout(() => {
        const mockResponse: RazorpaySuccessResponse = {
          razorpay_payment_id: `mock_pay_${Date.now()}`,
          razorpay_order_id: `mock_order_${Date.now()}`,
          razorpay_signature: "mock_signature_test",
        };
        options.handler(mockResponse);
        resolve(true);
      }, 1500);
    });
  }

  const loaded = await loadRazorpayScript();
  if (!loaded) {
    alert("Payment gateway failed to load.");
    return false;
  }
  if (!RAZORPAY_KEY) {
    console.error("❌ VITE_RAZORPAY_KEY_ID missing");
    return false;
  }

  try {
    // If you have a Cloud Function to create order, call it here. 
    // Otherwise, pass amount directly to Razorpay (for standard integration)
    // Assuming standard direct amount passing based on your PanRegistration code structure if no order ID created via backend
    // NOTE: If your PanRegistration used a Cloud Function to create an Order ID, replicate that call here.
    // For this snippet, I am assuming direct amount passing as per typical mock/simple flows, 
    // BUT if you need the Cloud Function call, uncomment below:
    
    /*
    const createOrderFn = httpsCallable(functions, "createRazorpayOrder");
    const result: any = await createOrderFn({ amount: options.amount, ...options.notes });
    const orderId = result.data.orderId;
    */

    const rzpOptions: any = {
      key: RAZORPAY_KEY,
      amount: options.amount,
      currency: options.currency ?? "INR",
      name: options.name,
      description: options.description,
      prefill: options.prefill ?? {},
      notes: options.notes ?? {},
      theme: { color: "#0891b2" },
      // order_id: orderId, // Add if using Cloud Function order creation
      handler: (response: RazorpaySuccessResponse) => {
        options.handler(response);
      },
      modal: { ondismiss: () => options.onClosed?.() },
    };

    const razorpay = new (window as any).Razorpay(rzpOptions);
    razorpay.on("payment.failed", (failureResponse: any) => {
      alert(`Payment failed: ${failureResponse.error?.description}`);
      options.onClosed?.();
    });
    razorpay.open();
    return true;
  } catch (error) {
    console.error("Razorpay init error:", error);
    return false;
  }
};