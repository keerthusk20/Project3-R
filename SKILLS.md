# SKILLS.md — Regibiz (Cloudmasa) Development Skills

> This file documents the concrete, reusable skills, patterns, and know-how specific to the Regibiz codebase. Claude Code uses this as a lookup reference when generating, reviewing, or refactoring code.

---

## 📦 Skill Index

1. [Firebase Firestore Patterns](#1-firebase-firestore-patterns)
2. [Firebase Auth — Dual Auth Flows](#2-firebase-auth--dual-auth-flows)
3. [Cloud Functions — Secure Backend Logic](#3-cloud-functions--secure-backend-logic)
4. [Razorpay Payment Integration](#4-razorpay-payment-integration)
5. [RTK Query — Data Fetching Pattern](#5-rtk-query--data-fetching-pattern)
6. [RBAC — Role-Based Access Control](#6-rbac--role-based-access-control)
7. [Consultation Tracker + Messaging](#7-consultation-tracker--messaging)
8. [Pincode-to-District Mapping (Tamil Nadu)](#8-pincode-to-district-mapping-tamil-nadu)
9. [Non-Dismissible Onboarding Modal](#9-non-dismissible-onboarding-modal)
10. [Service Panel Architecture](#10-service-panel-architecture)
11. [HR & Payroll — Payslip Generation](#11-hr--payroll--payslip-generation)
12. [AI Integration — Claude + OpenRouter](#12-ai-integration--claude--openrouter)
13. [n8n Webhook Automation](#13-n8n-webhook-automation)
14. [Dark SaaS Theme — Tailwind Conventions](#14-dark-saas-theme--tailwind-conventions)
15. [TypeScript — Shared Type Patterns](#15-typescript--shared-type-patterns)

---

## 1. Firebase Firestore Patterns

### Standard Document Interface
```typescript
import { Timestamp } from 'firebase/firestore';

interface BaseDocument {
  id: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### Writing a Document (Cloud Function — preferred for sensitive data)
```typescript
import * as admin from 'firebase-admin';

await admin.firestore().collection('consultations').doc(docId).set({
  ...data,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
});
```

### Real-time Listener (Client)
```typescript
import { onSnapshot, doc, getFirestore } from 'firebase/firestore';

const db = getFirestore();

useEffect(() => {
  const unsub = onSnapshot(doc(db, 'consultations', id), (snap) => {
    if (snap.exists()) setData({ id: snap.id, ...snap.data() });
  });
  return () => unsub();
}, [id]);
```

### Rules Pattern (Firestore)
```
match /consultations/{docId} {
  allow read: if isSignedIn() && (isAdmin() || isOwner(resource.data.userId));
  allow write: if false; // writes via Cloud Functions only
}
```

---

## 2. Firebase Auth — Dual Auth Flows

### Admin: Email/Password
```typescript
import { signInWithEmailAndPassword, getAuth } from 'firebase/auth';

const auth = getAuth();
await signInWithEmailAndPassword(auth, email, password);
```

### Customer: Phone OTP
```typescript
import { RecaptchaVerifier, signInWithPhoneNumber, getAuth } from 'firebase/auth';

const auth = getAuth();

// Setup invisible reCAPTCHA
const recaptcha = new RecaptchaVerifier(auth, 'recaptcha-container', { size: 'invisible' });

// Send OTP
const confirmationResult = await signInWithPhoneNumber(auth, '+91' + phoneNumber, recaptcha);

// Verify OTP
const credential = await confirmationResult.confirm(otpCode);
```

### Get Current User Role (from Firestore)
```typescript
const getUserRole = async (uid: string): Promise<UserRole> => {
  const snap = await getDoc(doc(db, 'users', uid));
  return snap.data()?.role ?? 'customer';
};
```

---

## 3. Cloud Functions — Secure Backend Logic

### Callable Function Template
```typescript
import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';

export const mySecureFunction = functions.https.onCall(async (data, context) => {
  // Auth check
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  // Role check
  const userDoc = await admin.firestore().doc(`users/${context.auth.uid}`).get();
  if (userDoc.data()?.role !== 'admin') {
    throw new functions.https.HttpsError('permission-denied', 'Admins only');
  }

  // Business logic here
  return { success: true };
});
```

### Calling from Client
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';

const functions = getFunctions();
const myFn = httpsCallable(functions, 'mySecureFunction');
const result = await myFn({ payload });
```

---

## 4. Razorpay Payment Integration

### Order Creation (Cloud Function — NEVER client-side)
```typescript
import Razorpay from 'razorpay';
import * as crypto from 'crypto';

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID!,
  key_secret: process.env.RAZORPAY_KEY_SECRET!,
});

export const createOrder = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Login required');

  const order = await razorpay.orders.create({
    amount: data.amount * 100, // paise
    currency: 'INR',
    receipt: `receipt_${Date.now()}`,
  });

  // Log to Firestore
  await admin.firestore().collection('paymentLogs').add({
    orderId: order.id,
    userId: context.auth.uid,
    amount: data.amount,
    status: 'created',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return { orderId: order.id };
});
```

### Signature Verification (Webhook / Cloud Function)
```typescript
export const verifyPayment = functions.https.onCall(async (data) => {
  const { orderId, paymentId, signature } = data;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');

  if (expectedSignature !== signature) {
    throw new functions.https.HttpsError('invalid-argument', 'Signature mismatch');
  }

  // Update Firestore on verified payment
  await admin.firestore().collection('paymentLogs')
    .where('orderId', '==', orderId)
    .limit(1)
    .get()
    .then(snap => snap.docs[0]?.ref.update({ status: 'paid', paymentId }));

  return { verified: true };
});
```

### Client-side Razorpay Checkout
```typescript
const openRazorpay = (orderId: string, amount: number) => {
  const options = {
    key: import.meta.env.VITE_RAZORPAY_KEY_ID,
    amount: amount * 100,
    currency: 'INR',
    order_id: orderId,
    handler: async (response: any) => {
      await verifyPaymentFn({
        orderId: response.razorpay_order_id,
        paymentId: response.razorpay_payment_id,
        signature: response.razorpay_signature,
      });
    },
  };
  new (window as any).Razorpay(options).open();
};
```

---

## 5. RTK Query — Data Fetching Pattern

### API Slice Template
```typescript
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react';
import { collection, getDocs, getFirestore } from 'firebase/firestore';

export const consultationsApi = createApi({
  reducerPath: 'consultationsApi',
  baseQuery: fakeBaseQuery(),
  tagTypes: ['Consultation'],
  endpoints: (builder) => ({
    getConsultations: builder.query<Consultation[], string>({
      async queryFn(userId) {
        try {
          const db = getFirestore();
          const snap = await getDocs(collection(db, 'consultations'));
          const data = snap.docs.map(d => ({ id: d.id, ...d.data() } as Consultation));
          return { data };
        } catch (error) {
          return { error };
        }
      },
      providesTags: ['Consultation'],
    }),
  }),
});

export const { useGetConsultationsQuery } = consultationsApi;
```

---

## 6. RBAC — Role-Based Access Control

### User Role Type
```typescript
type UserRole = 'superadmin' | 'admin' | 'support' | 'customer' | 'employee';
```

### useAuth Hook Pattern
```typescript
export const useAuth = () => {
  const user = useAppSelector(state => state.auth.user);
  const role = useAppSelector(state => state.auth.role) as UserRole;

  const isAdmin = () => ['superadmin', 'admin'].includes(role);
  const isSuperAdmin = () => role === 'superadmin';
  const isCustomer = () => role === 'customer';
  const isEmployee = () => role === 'employee';
  const isSupport = () => role === 'support';
  const hasRole = (r: UserRole) => role === r;

  return { user, role, isAdmin, isSuperAdmin, isCustomer, isEmployee, isSupport, hasRole };
};
```

### Route Guard Component
```typescript
interface ProtectedRouteProps {
  allowedRoles: UserRole[];
  children: React.ReactNode;
}

const ProtectedRoute = ({ allowedRoles, children }: ProtectedRouteProps) => {
  const { role } = useAuth();
  if (!allowedRoles.includes(role)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
};
```

### Conditional UI Rendering
```typescript
const { isAdmin, isCustomer } = useAuth();

return (
  <>
    {isAdmin() && <AdminPanel />}
    {isCustomer() && <CustomerDashboard />}
  </>
);
```

---

## 7. Consultation Tracker + Messaging

### Consultation Status Steps
```typescript
type ConsultationStatus =
  | 'submitted'
  | 'documents_requested'
  | 'documents_received'
  | 'processing'
  | 'completed'
  | 'rejected';

const STATUS_STEPS: ConsultationStatus[] = [
  'submitted',
  'documents_requested',
  'documents_received',
  'processing',
  'completed',
];
```

### Message Document Structure (Firestore)
```typescript
interface Message {
  id: string;
  consultationId: string;
  senderId: string;
  senderRole: UserRole;
  content: string;
  type: 'text' | 'document';
  fileUrl?: string;
  createdAt: Timestamp;
  read: boolean;
}
```

### Real-time Messages Listener
```typescript
const messagesRef = collection(db, 'consultations', consultationId, 'messages');
const q = query(messagesRef, orderBy('createdAt', 'asc'));

onSnapshot(q, (snap) => {
  setMessages(snap.docs.map(d => ({ id: d.id, ...d.data() } as Message)));
});
```

---

## 8. Pincode-to-District Mapping (Tamil Nadu)

### Usage Pattern
```typescript
import { tamilNaduPincodeMap } from '@/utils/tamilNaduPincodes';

const handlePincodeChange = (pincode: string) => {
  if (pincode.length === 6) {
    const district = tamilNaduPincodeMap[pincode];
    if (district) setValue('district', district);
    else setValue('district', '');
  }
};
```

### Map Structure (`src/utils/tamilNaduPincodes.ts`)
```typescript
export const tamilNaduPincodeMap: Record<string, string> = {
  '600001': 'Chennai',
  '600002': 'Chennai',
  '641001': 'Coimbatore',
  '625001': 'Madurai',
  // ... full mapping
};
```

---

## 9. Non-Dismissible Onboarding Modal

### Pattern
```typescript
const ProfileCompletionModal = () => {
  const { user } = useAuth();
  const [profileComplete, setProfileComplete] = useState(true);

  useEffect(() => {
    // Check if profile is complete
    const checkProfile = async () => {
      const snap = await getDoc(doc(db, 'users', user.uid));
      const data = snap.data();
      setProfileComplete(!!(data?.name && data?.phone && data?.address));
    };
    if (user) checkProfile();
  }, [user]);

  if (profileComplete) return null;

  return (
    // No onClose prop — intentionally non-dismissible
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80">
      <div className="bg-[#0d1f35] rounded-xl p-8 w-full max-w-md">
        <h2 className="text-white text-xl font-semibold mb-4">Complete Your Profile</h2>
        <ProfileCompletionForm onComplete={() => setProfileComplete(true)} />
      </div>
    </div>
  );
};
```

**Key:** No close button, no backdrop click dismiss, `z-[9999]` ensures it's always on top.

---

## 10. Service Panel Architecture

### Directory Structure per Service
```
src/servicepanel/
└── gst-registration/
    ├── index.tsx              # Main panel entry
    ├── GstRegistrationForm.tsx
    ├── GstDocumentUpload.tsx
    ├── GstStatusTracker.tsx
    └── types.ts
```

### Service Panel Entry Pattern
```typescript
const GstRegistrationPanel = () => {
  const [step, setStep] = useState<'form' | 'upload' | 'track'>('form');
  const { consultationId } = useActiveConsultation('gst-registration');

  if (consultationId) return <GstStatusTracker id={consultationId} />;

  return (
    <>
      {step === 'form' && <GstRegistrationForm onNext={() => setStep('upload')} />}
      {step === 'upload' && <GstDocumentUpload onSubmit={() => setStep('track')} />}
    </>
  );
};
```

---

## 11. HR & Payroll — Payslip Generation

### Payslip Data Structure
```typescript
interface Payslip {
  employeeId: string;
  employeeName: string;
  month: string; // 'YYYY-MM'
  basicSalary: number;
  hra: number;
  allowances: number;
  deductions: number;
  pf: number;
  professionalTax: number;
  netPay: number;
  generatedAt: Timestamp;
}
```

### PDF-style Payslip (HTML → Print)
```typescript
const generatePayslip = (payslip: Payslip) => {
  const printWindow = window.open('', '_blank');
  printWindow?.document.write(payslipHtmlTemplate(payslip));
  printWindow?.document.close();
  printWindow?.print();
};
```

---

## 12. AI Integration — Claude + OpenRouter

### Claude API Call (`src/services/aiService.ts`)
```typescript
export const askClaude = async (prompt: string): Promise<string> => {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': import.meta.env.VITE_CLAUDE_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  return data.content[0]?.text ?? '';
};
```

> ⚠️ **Security Note:** For production, proxy Claude API calls through a Cloud Function to avoid exposing API keys in the client bundle.

### OpenRouter Fallback
```typescript
export const askOpenRouter = async (prompt: string): Promise<string> => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'anthropic/claude-3-haiku',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  const data = await response.json();
  return data.choices[0]?.message?.content ?? '';
};
```

---

## 13. n8n Webhook Automation

### Triggering from Cloud Function
```typescript
export const triggerDocumentVerification = functions.firestore
  .document('consultations/{docId}')
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    if (before.status !== 'documents_received' && after.status === 'documents_received') {
      await fetch(process.env.N8N_WEBHOOK_URL!, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          consultationId: context.params.docId,
          documents: after.documents,
          customerEmail: after.customerEmail,
        }),
      });
    }
  });
```

---

## 14. Dark SaaS Theme — Tailwind Conventions

### Core Palette Classes
```
Background:     bg-[#020c1b]           (deepest layer)
Surface:        bg-[#0d1f35]           (cards, panels)
Surface Hover:  bg-[#112240]           (interactive hover)
Border:         border-[#1e3a5f]       (subtle borders)
Accent Teal:    text-teal-400          (primary accent)
Accent Blue:    text-blue-400          (secondary accent)
Gradient:       bg-gradient-to-r from-teal-500 to-blue-600
Text Primary:   text-white
Text Secondary: text-slate-400
```

### Standard Card Component Pattern
```tsx
<div className="bg-[#0d1f35] border border-[#1e3a5f] rounded-xl p-6 hover:border-teal-500/50 transition-colors">
  <h3 className="text-white font-semibold text-lg">{title}</h3>
  <p className="text-slate-400 text-sm mt-1">{description}</p>
</div>
```

### Gradient Button
```tsx
<button className="bg-gradient-to-r from-teal-500 to-blue-600 hover:from-teal-400 hover:to-blue-500 text-white font-semibold px-6 py-2.5 rounded-lg transition-all duration-200 shadow-lg shadow-teal-500/20">
  {label}
</button>
```

### Aurora Glow Effect
```tsx
<div className="relative">
  <div className="absolute inset-0 bg-gradient-to-r from-teal-500/10 to-blue-600/10 blur-3xl rounded-full" />
  <div className="relative z-10">{children}</div>
</div>
```

---

## 15. TypeScript — Shared Type Patterns

### User / Auth Types
```typescript
type UserRole = 'superadmin' | 'admin' | 'support' | 'customer' | 'employee';

interface AppUser {
  uid: string;
  name: string;
  email?: string;
  phone?: string;
  role: UserRole;
  profileComplete: boolean;
  createdAt: Timestamp;
}
```

### API Response Wrapper
```typescript
type ApiResult<T> =
  | { success: true; data: T }
  | { success: false; error: string };
```

### Firestore Collection Paths (constants)
```typescript
export const COLLECTIONS = {
  USERS: 'users',
  CONSULTATIONS: 'consultations',
  PAYMENT_LOGS: 'paymentLogs',
  EMPLOYEES: 'employees',
  ATTENDANCE: 'attendance',
  PAYSLIPS: 'payslips',
} as const;
```

---

## ✅ Skill Usage Quick Reference

| I need to... | Skill # |
|---|---|
| Write/read Firestore data | 1 |
| Handle login (admin or customer) | 2 |
| Create a secure backend function | 3 |
| Integrate or debug payments | 4 |
| Fetch data with RTK Query | 5 |
| Restrict access by user role | 6 |
| Build consultation tracking / chat | 7 |
| Auto-fill district from pincode | 8 |
| Force profile completion | 9 |
| Add a new service offering | 10 |
| Generate or display payslips | 11 |
| Use AI (Claude / OpenRouter) | 12 |
| Trigger n8n automation | 13 |
| Style a new component correctly | 14 |
| Define TypeScript types | 15 |