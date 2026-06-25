# CLAUDE.md — Regibiz (Cloudmasa) Project

> This file provides Claude Code (and any Claude AI assistant) with full context about the Regibiz project so it can assist effectively without repeated re-explanation.

---

## 🏢 Project Identity

| Field | Value |
|---|---|
| **Project Name** | Regibiz |
| **Brand / Company** | Cloudmasa |
| **Type** | SaaS Web Application |
| **Domain** | Business Registration & Compliance Services Portal |
| **Region Focus** | India (Tamil Nadu-specific logic; INR payments) |
| **Status** | Production-ready / Live |

---

## 🛠️ Tech Stack

### Frontend

| Layer | Technology |
|---|---|
| Framework | React 18+ |
| Language | TypeScript |
| Bundler | Vite |
| State Management | Redux Toolkit (RTK Query) + React Hooks |
| Styling | Tailwind CSS (custom dark SaaS theme) |
| Icons | Lucide React, Heroicons |
| Animations | Canvas Confetti (celebration events) |
| Math / Precision | fraction.js |
| Compression | fflate |

**Theme Details:**
- Primary Background: `#020c1b`
- Accent: Teal-to-blue aurora glow gradients
- Mode: Dark Mode Professional SaaS

### Backend / Infrastructure (Firebase BaaS)

| Service | Usage |
|---|---|
| Firestore | Primary NoSQL database |
| Firebase Auth | Email/Password (admins), Phone OTP (customers) |
| Cloud Functions | Node.js / TypeScript — backend business logic |
| Firebase Storage | Documents, profile images |
| Firebase Hosting | Frontend deployment |

### Payments

| Gateway | Use Case |
|---|---|
| Razorpay | Primary payment gateway |
| IDFC First Bank | Net Banking / UPI |
| Signature Verification | HMAC-SHA256 in Cloud Functions (secure server-side) |

### AI & Automation

| Tool | Role |
|---|---|
| Claude AI (Anthropic) | Intelligent dynamic responses, NLP |
| OpenRouter API | Multi-model AI routing / fallback |
| n8n Webhooks | Automated document verification pipelines |
| Gmail SMTP (Nodemailer / Firebase Extensions) | Transactional emails |

---

## 📁 Project Structure

```
regibiz/
├── src/
│   ├── App.tsx                  # Root component, routing setup
│   ├── pages/                   # Top-level route/page components
│   ├── services/                # API calls, Firebase interactions, business logic
│   ├── hooks/                   # Custom React hooks
│   ├── servicepanel/            # UI panels per registration service offered
│   ├── components/              # Shared UI components
│   ├── store/                   # Redux store, slices, RTK Query APIs
│   └── utils/                   # Helper functions, constants
├── functions/                   # Firebase Cloud Functions (Node.js / TypeScript)
├── public/
├── firebase.json
├── firestore.rules
├── storage.rules
└── vite.config.ts
```

---

## 🔑 Core Modules & Features

### 1. Role-Based Access Control (RBAC)

Roles defined in the system:
- `superadmin` — Full system access
- `admin` — Operational management
- `support` — Customer-facing support
- `customer` — External end users (Phone OTP auth)
- `employee` — Internal staff (HR/Payroll access)

UI renders dynamically based on role. Route guards and Firestore rules enforce access boundaries.

### 2. Registration Services (`servicepanel/`)

Each service offered by Regibiz has its own dedicated panel under `servicepanel/`. These handle:
- Service-specific form flows
- Document uploads to Firebase Storage
- Progress/status tracking per consultation

### 3. Consultation Tracking

- Step-by-step progress tracker per registration case
- WhatsApp-style integrated messaging for customer ↔ support communication
- Real-time updates via Firestore listeners

### 4. Payment Processing

- Order creation handled in Cloud Functions (never client-side)
- Razorpay integration with HMAC-SHA256 webhook signature verification
- IDFC First Bank for Net Banking / UPI flows
- Payment status synced to Firestore

### 5. Smart User Onboarding

- **Non-dismissible profile completion modals** — user cannot bypass until profile is complete
- Dynamic form validation
- **Pincode-to-District mapping** — Tamil Nadu specific; auto-fills district from pincode input

### 6. HR & Payroll System

Internal employee management tools:
- Employee profiles
- Attendance tracking
- Leave management
- Payslip generation (PDF-style output)

### 7. AI-Powered Features

- Claude AI / OpenRouter used for intelligent query responses
- NLP for automating repetitive customer support tasks
- n8n webhook pipelines for document verification automation

---

## ⚙️ Development Conventions

### TypeScript
- Strict mode preferred
- All Firebase documents should have corresponding TypeScript interfaces/types
- RTK Query endpoints should be fully typed (request + response)

### Firestore
- Collection naming: `camelCase` (e.g., `consultations`, `userProfiles`)
- Always use server timestamps: `serverTimestamp()` for `createdAt` / `updatedAt`
- Never perform writes directly from client for sensitive operations — use Cloud Functions

### Cloud Functions
- All payment order creation and verification must remain in Cloud Functions
- Use `firebase-admin` SDK; never expose service account credentials client-side
- Functions should validate inputs strictly before processing

### Payments
- Never trust client-provided payment status — always verify via Razorpay webhook + HMAC-SHA256 in Cloud Functions
- Log payment events to a `paymentLogs` Firestore collection

### Styling
- Use Tailwind utility classes; avoid inline styles
- Follow the dark SaaS theme — `bg-[#020c1b]`, teal/blue gradients for accents
- Responsive-first: mobile → tablet → desktop

### State Management
- Local/UI state: `useState` / `useReducer`
- Server/async data: RTK Query
- Global app state (auth, user role, etc.): Redux slice

---

## 🌏 Region-Specific Logic

- **Currency:** INR (₹)
- **Phone Auth:** Indian phone numbers (+91)
- **Pincode Mapping:** Tamil Nadu pincode → district auto-fill
- **Payment Methods:** Razorpay (cards, UPI, wallets), IDFC Net Banking/UPI

---

## 🔐 Security Rules Summary

- Firestore rules enforce role-based read/write access
- Storage rules restrict uploads to authenticated users
- Payment signatures verified server-side only
- No sensitive keys in frontend code — all secrets in Firebase environment config / Cloud Functions

---

## 🤖 AI Assistant Guidelines (for Claude)

When working on this codebase:

1. **Always preserve the dark SaaS theme** — do not introduce light backgrounds or generic UI patterns
2. **Firestore writes for sensitive data must go through Cloud Functions** — never suggest direct client writes for payments, role changes, or verification status
3. **TypeScript is mandatory** — do not suggest plain `.js` files; always use proper types
4. **Payment flows are security-critical** — always verify on server, never trust client
5. **RBAC is central** — when adding new features, always consider which roles should have access and add appropriate guards
6. **Tamil Nadu locale** — respect regional logic (pincode mapping, INR, +91 phone)
7. **RTK Query for data fetching** — do not introduce other data-fetching patterns unless explicitly requested
8. **n8n / webhook integrations** — document verification pipelines are automated; don't add manual workarounds that bypass them

---

## 📌 Common Tasks Reference

| Task | Location |
|---|---|
| Add a new service panel | `src/servicepanel/` — create new folder with Panel + Form components |
| Add a Cloud Function | `functions/src/` — export from `index.ts` |
| Add a new user role | Update RBAC logic in `src/hooks/useAuth.ts` + Firestore rules |
| Add payment flow | Cloud Function for order + webhook; client uses Razorpay SDK |
| Add AI feature | Use Claude API via `src/services/aiService.ts` or OpenRouter |
| Add n8n automation | Configure webhook trigger in n8n; call from Cloud Function |