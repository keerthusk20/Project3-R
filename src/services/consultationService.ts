// services/consultationService.ts

import {
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  onSnapshot,
  QuerySnapshot,
  DocumentData,
} from 'firebase/firestore';
import { db } from './firebase'; // ✅ FIXED: was '../services/firebase'
import { initiateRazorpayPayment } from './razorpayService';
import type {
  ExpertProfile,
  ConsultationRequest,
  ActivityLog,
  SuperadminStats,
  ExpertRole,
  AvailabilityStatus,
} from '../Types/consultation';

export const CONSULTATION_PRICING = {
  CA: {
    amount: 149900,
    label: '₹1,499',
    description: 'Chartered Accountant consultation',
  },
  Lawyer: {
    amount: 199900,
    label: '₹1,999',
    description: 'Corporate lawyer consultation',
  },
} as const;

export interface BookingIssue {
  status: 'open' | 'resolved';
  reason: string;
  reportedBy: string;
  resolvedBy?: string | null;
  resolvedAt?: Date | string | null;
}

export type BookingStatus = 'pending' | 'confirmed' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded' | 'free';

export interface BookingData {
  id: string;
  caseId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  consultationType: ExpertRole;
  date: string;
  time: string;
  status: BookingStatus;
  paymentStatus: PaymentStatus;
  amount: number;
  paymentId?: string;
  orderId?: string;
  assignedTo?: string | null;
  assignedExpertName?: string | null;
  scheduledDate?: Date | string | Timestamp | null;
  notes?: string;
  issues?: BookingIssue[];
  adminNotes?: string;
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface ExpertRecord {
  id: string;
  name: string;
  expertise: ExpertRole;
  specialization?: string;
  experience: number | string;
  rating: number;
  availabilityStatus: AvailabilityStatus;
  isActive?: boolean;
  userId?: string;
  email?: string;
}

export interface RazorpayOrderDetails {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface EmailPayload {
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
}

export interface EmailTemplateInput {
  caseId?: string;
  consultationType?: ExpertRole;
  date?: string;
  time?: string;
  amount?: number;
  userName?: string;
  userEmail?: string;
  assignedExpertName?: string;
}

const bookingsCol = collection(db, 'consultationBookings');

// ─── Collection References ────────────────────────────────────────────────────
const expertsCol = collection(db, 'experts');
const consultationsCol = collection(db, 'consultations');
const activityLogsCol = collection(db, 'activityLogs');

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toDate(val: Timestamp | Date | string | null): Date | string | null {
  if (!val) return null;
  if (val instanceof Timestamp) return val.toDate();
  return val;
}

function mapExpert(id: string, data: DocumentData): ExpertProfile {
  const rawProfessionalType = data.professionalType ?? data.professionalDetails?.professionalType;
  const role = data.role === 'Advocate' || rawProfessionalType === 'advocate' || rawProfessionalType === 'lawyer'
    ? 'Lawyer'
    : 'CA';
  const professionalTag = role === 'Lawyer' ? 'Advocate' : 'CA';

  return {
    id,
    userId: data.userId ?? '',
    name: data.name ?? '',
    email: data.email ?? '',
    role,
    professionalType: role === 'Lawyer' ? 'advocate' : 'ca',
    professionalTag,
    specialization: data.specialization ?? '',
    availabilityStatus: data.availabilityStatus ?? 'Offline',
    rating: data.rating ?? 0,
    totalConsultations: data.totalConsultations ?? 0,
    bio: data.bio ?? '',
    profileImageUrl: data.profileImageUrl ?? '',
    isActive: data.isActive ?? true,
    status: data.status ?? null,
    isVerifiedExpert: data.isVerifiedExpert ?? false,
    createdAt: toDate(data.createdAt) ?? '',
  } as ExpertProfile;
}

function mapConsultation(id: string, data: DocumentData): ConsultationRequest {
  return {
    id,
    customerId: data.customerId ?? '',
    customerName: data.customerName ?? '',
    customerEmail: data.customerEmail ?? '',
    serviceType: data.serviceType ?? '',
    serviceCategory: data.serviceCategory ?? 'CA',
    status: data.status ?? 'Pending',
    assignedExpertId: data.assignedExpertId ?? null,
    assignedExpertName: data.assignedExpertName ?? null,
    supportAgentId: data.supportAgentId ?? null,
    supportAgentName: data.supportAgentName ?? null,
    timestamp: toDate(data.timestamp) ?? new Date(),
    scheduledTime: toDate(data.scheduledTime),
    notes: data.notes ?? '',
    priority: data.priority ?? 'Medium',
  };
}

function mapExpertRecord(id: string, data: DocumentData): ExpertRecord {
  return {
    id,
    name: data.name ?? '',
    expertise: (data.expertise ?? data.role ?? 'CA') as ExpertRole,
    specialization: data.specialization ?? '',
    experience: data.experience ?? data.totalConsultations ?? 0,
    rating: data.rating ?? 0,
    availabilityStatus: data.availabilityStatus ?? 'Offline',
    isActive: data.isActive ?? true,
    userId: data.userId ?? '',
    email: data.email ?? '',
  };
}

function mapBooking(id: string, data: DocumentData): BookingData {
  return {
    id,
    caseId: data.caseId ?? id,
    userId: data.userId ?? '',
    userName: data.userName ?? '',
    userEmail: data.userEmail ?? '',
    userPhone: data.userPhone ?? '',
    consultationType: (data.consultationType ?? 'CA') as ExpertRole,
    date: data.date ?? '',
    time: data.time ?? '',
    status: data.status ?? 'pending',
    paymentStatus: data.paymentStatus ?? 'pending',
    amount: data.amount ?? 0,
    paymentId: data.paymentId ?? '',
    orderId: data.orderId ?? '',
    assignedTo: data.assignedTo ?? null,
    assignedExpertName: data.assignedExpertName ?? null,
    scheduledDate: toDate(data.scheduledDate ?? null),
    notes: data.notes ?? '',
    issues: (data.issues ?? []) as BookingIssue[],
    adminNotes: data.adminNotes ?? '',
    createdAt: toDate(data.createdAt ?? null) ?? '',
    updatedAt: toDate(data.updatedAt ?? null) ?? '',
  };
}

function generateCaseId(): string {
  const year = new Date().getFullYear();
  const suffix = Math.floor(Math.random() * 9000 + 1000);
  return `CONS-${year}-${suffix}`;
}

// ─── Expert Functions ─────────────────────────────────────────────────────────

export async function getAvailableExperts(role?: ExpertRole): Promise<ExpertProfile[]> {
  const snap = await getDocs(expertsCol);
  return snap.docs
    .map((d) => mapExpert(d.id, d.data()))
    .filter((expert) =>
      (expert as any).status !== 'rejected' &&
      expert.isActive !== false &&
      ((expert as any).status === 'active' || (expert as any).status === 'approved') &&
      ((expert as any).isVerifiedExpert === true || (expert as any).status === 'active') &&
      expert.availabilityStatus === 'Available' &&
      (!role || expert.role === role)
    );
}

export async function getAllExperts(): Promise<ExpertProfile[]> {
  const snap = await getDocs(query(expertsCol, orderBy('name')));
  return snap.docs.map((d) => mapExpert(d.id, d.data()));
}

export async function updateExpertStatus(expertId: string, status: AvailabilityStatus): Promise<void> {
  await updateDoc(doc(db, 'experts', expertId), { availabilityStatus: status });
}

export async function toggleExpertActive(expertId: string, isActive: boolean): Promise<void> {
  await updateDoc(doc(db, 'experts', expertId), { isActive });
}

export async function registerExpert(
  userId: string,
  name: string,
  email: string,
  role: ExpertRole,
  specialization: string,
  bio?: string
): Promise<string> {
  const docRef = await addDoc(expertsCol, {
    userId,
    name,
    email,
    role,
    specialization,
    bio: bio ?? '',
    availabilityStatus: 'Available' as AvailabilityStatus,
    rating: 0,
    totalConsultations: 0,
    isActive: true,
    createdAt: serverTimestamp(),
  });
  await updateDoc(doc(db, 'users', userId), {
    role: 'expert',
    expertType: role,
    availabilityStatus: 'Available',
    expertId: docRef.id,
  });
  return docRef.id;
}

// ─── Consultation Functions ───────────────────────────────────────────────────

export async function bookConsultation(data: {
  customerId: string;
  customerName: string;
  customerEmail: string;
  serviceType: string;
  serviceCategory: ExpertRole;
  scheduledTime: Date;
  notes: string;
  preferredExpertId?: string;
  preferredExpertName?: string;
}): Promise<string> {
  const hasPreferredExpert = !!data.preferredExpertId;
  const docRef = await addDoc(consultationsCol, {
    ...data,
    status: hasPreferredExpert ? 'Assigned' : 'Pending',
    assignedExpertId: data.preferredExpertId ?? null,
    assignedExpertName: data.preferredExpertName ?? null,
    expertId: data.preferredExpertId ?? null,
    expertName: data.preferredExpertName ?? null,
    supportAgentId: null,
    supportAgentName: null,
    timestamp: serverTimestamp(),
    scheduledTime: Timestamp.fromDate(data.scheduledTime),
    priority: 'Medium',
  });
  return docRef.id;
}

export async function getPendingConsultations(): Promise<ConsultationRequest[]> {
  const q = query(consultationsCol, where('status', '==', 'Pending'), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapConsultation(d.id, d.data()));
}

export async function getConsultationsByStatus(status: ConsultationRequest['status']): Promise<ConsultationRequest[]> {
  const q = query(consultationsCol, where('status', '==', status), orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => mapConsultation(d.id, d.data()));
}

export async function assignExpert(
  consultationId: string,
  expertId: string,
  expertName: string,
  supportAgentId: string,
  supportAgentName: string
): Promise<void>;
export async function assignExpert(
  bookingId: string,
  expertId: string,
  expertName: string,
  scheduledDate: Date
): Promise<void>;
export async function assignExpert(
  id: string,
  expertId: string,
  expertName: string,
  arg4: string | Date,
  arg5?: string
): Promise<void> {
  if (arg4 instanceof Date) {
    await updateDoc(doc(db, 'consultationBookings', id), {
      assignedTo: expertId,
      assignedExpertName: expertName,
      scheduledDate: arg4,
      status: 'confirmed',
      updatedAt: serverTimestamp(),
    });
    return;
  }

  await updateDoc(doc(db, 'consultations', id), {
    assignedExpertId: expertId,
    assignedExpertName: expertName,
    expertId,
    expertName,
    supportAgentId: arg4,
    supportAgentName: arg5 ?? '',
    status: 'Assigned',
  });
  const consultation = await getDoc(doc(db, 'consultations', id));
  const cData = consultation.data();
  if (cData) {
    await addDoc(activityLogsCol, {
      message: `Support Agent ${arg5 ?? 'Unknown'} assigned Expert ${expertName} to Customer ${cData.customerName}`,
      supportAgentId: arg4,
      supportAgentName: arg5,
      expertId,
      expertName,
      customerId: cData.customerId,
      customerName: cData.customerName,
      consultationId: id,
      timestamp: serverTimestamp(),
    });
  }
}

export async function updateConsultationStatus(
  consultationId: string,
  status: ConsultationRequest['status']
): Promise<void> {
  await updateDoc(doc(db, 'consultations', consultationId), { status });
}

// ─── Superadmin Stats ─────────────────────────────────────────────────────────

export async function getSuperadminStats(): Promise<SuperadminStats> {
  const [expertsSnap, consultationsSnap] = await Promise.all([
    getDocs(expertsCol),
    getDocs(consultationsCol),
  ]);
  const experts = expertsSnap.docs.map((d) => d.data());
  const consultations = consultationsSnap.docs.map((d) => d.data());
  return {
    totalExperts: experts.length,
    totalCAs: experts.filter((e) => e.role === 'CA').length,
    totalLawyers: experts.filter((e) => e.role === 'Lawyer').length,
    availableExperts: experts.filter((e) => e.availabilityStatus === 'Available').length,
    activeConsultations: consultations.filter((c) => c.status === 'In-Progress').length,
    pendingAssignments: consultations.filter((c) => c.status === 'Pending').length,
    completedConsultations: consultations.filter((c) => c.status === 'Completed').length,
  };
}

export async function getActivityLogs(limit = 20): Promise<ActivityLog[]> {
  const q = query(activityLogsCol, orderBy('timestamp', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.slice(0, limit).map((d) => {
    const data = d.data();
    return {
      id: d.id,
      message: data.message,
      supportAgentId: data.supportAgentId,
      supportAgentName: data.supportAgentName,
      expertId: data.expertId,
      expertName: data.expertName,
      customerId: data.customerId,
      customerName: data.customerName,
      consultationId: data.consultationId,
      timestamp: toDate(data.timestamp) ?? '',
    } as ActivityLog;
  });
}

// ─── Real-time Listener ───────────────────────────────────────────────────────

export function subscribeToPendingConsultations(
  callback: (data: ConsultationRequest[]) => void
): () => void {
  const q = query(consultationsCol, where('status', '==', 'Pending'), orderBy('timestamp', 'desc'));
  return onSnapshot(q, (snap: QuerySnapshot<DocumentData>) => {
    callback(snap.docs.map((d) => mapConsultation(d.id, d.data())));
  });
}

export async function getCustomerConsultations(customerId: string, customerEmail?: string): Promise<ConsultationRequest[]> {
  try {
    const q = query(consultationsCol, where('customerId', '==', customerId));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => mapConsultation(d.id, d.data()))
      .sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp || 0).getTime();
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp || 0).getTime();
        return bTime - aTime;
      });
  } catch {
    const snap = await getDocs(consultationsCol);
    return snap.docs
      .map((d) => mapConsultation(d.id, d.data()))
      .filter((item) =>
        item.customerId === customerId ||
        (!!customerEmail && (item.customerEmail || '').toLowerCase() === customerEmail.toLowerCase())
      )
      .sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp || 0).getTime();
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp || 0).getTime();
        return bTime - aTime;
      });
  }
}

export async function getExpertConsultations(expertId: string): Promise<ConsultationRequest[]> {
  try {
    const [assignedSnap, legacySnap] = await Promise.all([
      getDocs(query(consultationsCol, where('assignedExpertId', '==', expertId))),
      getDocs(query(consultationsCol, where('expertId', '==', expertId))),
    ]);
    const merged = new Map<string, ConsultationRequest>();
    assignedSnap.docs.forEach((d) => merged.set(d.id, mapConsultation(d.id, d.data())));
    legacySnap.docs.forEach((d) => merged.set(d.id, mapConsultation(d.id, d.data())));
    return Array.from(merged.values()).sort((a, b) => {
      const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp || 0).getTime();
      const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    });
  } catch {
    const snap = await getDocs(consultationsCol);
    return snap.docs
      .map((d) => mapConsultation(d.id, d.data()))
      .filter((item) => item.assignedExpertId === expertId || (item as any).expertId === expertId)
      .sort((a, b) => {
        const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp || 0).getTime();
        const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp || 0).getTime();
        return bTime - aTime;
      });
  }
}

export function subscribeToExpertConsultations(
  expertId: string,
  callback: (data: ConsultationRequest[]) => void
): () => void {
  let assignedRows: ConsultationRequest[] = [];
  let legacyRows: ConsultationRequest[] = [];

  const pushMerged = () => {
    const merged = new Map<string, ConsultationRequest>();
    assignedRows.forEach((row) => merged.set(row.id, row));
    legacyRows.forEach((row) => merged.set(row.id, row));
    const sorted = Array.from(merged.values()).sort((a, b) => {
      const aTime = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp || 0).getTime();
      const bTime = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp || 0).getTime();
      return bTime - aTime;
    });
    callback(sorted);
  };

  const unsubAssigned = onSnapshot(query(consultationsCol, where('assignedExpertId', '==', expertId)), (snap: QuerySnapshot<DocumentData>) => {
    assignedRows = snap.docs.map((d) => mapConsultation(d.id, d.data()));
    pushMerged();
  });

  const unsubLegacy = onSnapshot(query(consultationsCol, where('expertId', '==', expertId)), (snap: QuerySnapshot<DocumentData>) => {
    legacyRows = snap.docs.map((d) => mapConsultation(d.id, d.data()));
    pushMerged();
  });

  return () => {
    unsubAssigned();
    unsubLegacy();
  };
}

// ─── Booking Workflow Compatibility Layer ────────────────────────────────────

export interface CreateBookingInput {
  userId: string;
  userName: string;
  userEmail: string;
  userPhone?: string;
  consultationType: ExpertRole;
  date: string;
  time: string;
  status?: BookingStatus;
  paymentStatus?: PaymentStatus;
  amount: number;
  assignedTo?: string;
  assignedExpertName?: string;
  scheduledDate?: Date | null;
  issues?: BookingIssue[];
  notes?: string;
}

export async function createBooking(data: CreateBookingInput): Promise<string> {
  const docRef = await addDoc(bookingsCol, {
    ...data,
    caseId: generateCaseId(),
    status: data.status ?? 'pending',
    paymentStatus: data.paymentStatus ?? 'pending',
    assignedTo: data.assignedTo ?? null,
    assignedExpertName: data.assignedExpertName ?? null,
    scheduledDate: data.scheduledDate ? Timestamp.fromDate(data.scheduledDate) : null,
    issues: data.issues ?? [],
    notes: data.notes ?? '',
    paymentId: '',
    orderId: '',
    adminNotes: '',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

export async function getBooking(bookingId: string): Promise<BookingData | null> {
  const snap = await getDoc(doc(db, 'consultationBookings', bookingId));
  if (!snap.exists()) return null;
  return mapBooking(snap.id, snap.data());
}

export interface RazorpayOrderRequest {
  amount: number;
  bookingId: string;
  currency?: string;
}

export async function createRazorpayOrder(
  amount: number,
  bookingId: string,
  currency = 'INR'
): Promise<RazorpayOrderDetails> {
  return {
    orderId: `order_${bookingId}_${Date.now()}`,
    amount,
    currency,
    keyId: (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_RAZORPAY_KEY_ID) || '',
  };
}

export interface OpenRazorpayCheckoutOptions {
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  bookingId: string;
  expertType: ExpertRole;
  onSuccess: (paymentId: string, rzpOrderId: string) => void | Promise<void>;
  onFailure: (message: string) => void;
}

export async function openRazorpayCheckout(options: OpenRazorpayCheckoutOptions): Promise<void> {
  const started = await initiateRazorpayPayment({
    amount: options.amount,
    currency: options.currency,
    name: 'RegiBIZ Consultation',
    description: `${options.expertType} consultation booking`,
    prefill: {
      name: options.userName,
      email: options.userEmail,
      contact: options.userPhone,
    },
    notes: {
      bookingId: options.bookingId,
      orderId: options.orderId,
      expertType: options.expertType,
    },
    handler: async (response) => {
      await options.onSuccess(response.razorpay_payment_id, response.razorpay_order_id);
    },
    onClosed: () => {
      options.onFailure('Payment window was closed before completion.');
    },
  });

  if (!started) {
    options.onFailure('Unable to open Razorpay checkout.');
  }
}

export async function confirmBookingPayment(
  bookingId: string,
  paymentId: string,
  orderId: string
): Promise<void> {
  await updateDoc(doc(db, 'consultationBookings', bookingId), {
    paymentId,
    orderId,
    paymentStatus: 'paid',
    status: 'confirmed',
    updatedAt: serverTimestamp(),
  });
}

export async function markBookingCompleted(bookingId: string): Promise<void> {
  await updateDoc(doc(db, 'consultationBookings', bookingId), {
    status: 'completed',
    updatedAt: serverTimestamp(),
  });
}

export async function cancelBooking(bookingId: string, reason = 'Cancelled'): Promise<void> {
  await updateDoc(doc(db, 'consultationBookings', bookingId), {
    status: 'cancelled',
    adminNotes: reason,
    updatedAt: serverTimestamp(),
  });
}

export async function resolveIssue(
  bookingId: string,
  issueIndex: number,
  resolvedBy: string,
  issues: BookingIssue[]
): Promise<void> {
  const next = [...issues];
  if (next[issueIndex]) {
    next[issueIndex] = {
      ...next[issueIndex],
      status: 'resolved',
      resolvedBy,
      resolvedAt: new Date(),
    };
  }
  await updateDoc(doc(db, 'consultationBookings', bookingId), {
    issues: next,
    updatedAt: serverTimestamp(),
  });
}

export async function addAdminNote(bookingId: string, note: string): Promise<void> {
  await updateDoc(doc(db, 'consultationBookings', bookingId), {
    adminNotes: note,
    updatedAt: serverTimestamp(),
  });
}

export async function fetchExperts(): Promise<ExpertRecord[]> {
  const snap = await getDocs(query(expertsCol, orderBy('name')));
  return snap.docs.map((d) => mapExpertRecord(d.id, d.data()));
}

export async function getAllExpertsRecords(): Promise<ExpertRecord[]> {
  return fetchExperts();
}

export async function sendEmailNotification(payload: EmailPayload): Promise<void> {
  console.info('Email notification stub:', payload);
}

export const emailTemplates = {
  bookingConfirmed: (input: EmailTemplateInput): EmailPayload => ({
    subject: `Your consultation is confirmed${input.caseId ? ` - ${input.caseId}` : ''}`,
    text: `Your ${input.consultationType ?? 'consultation'} booking is confirmed for ${input.date ?? ''} ${input.time ?? ''}.`,
  }),
  newBookingAlert: (input: EmailTemplateInput, to: string): EmailPayload => ({
    to,
    subject: `New consultation booking${input.caseId ? ` - ${input.caseId}` : ''}`,
    text: `A new ${input.consultationType ?? 'consultation'} booking was created for ${input.date ?? ''} ${input.time ?? ''}.`,
  }),
  expertAssigned: (input: BookingData & { assignedExpertName?: string }): EmailPayload => ({
    subject: `Expert assigned${input.caseId ? ` - ${input.caseId}` : ''}`,
    text: `Your consultation has been assigned to ${input.assignedExpertName ?? 'an expert'}.`,
  }),
};