// src/types.ts

export enum UserRole {
  SUPERADMIN = 'superadmin',
  ADMIN = 'admin',
  SUPPORT = 'support',
  CUSTOMER = 'customer',
  EXPERT = 'expert',
}
export type ProfessionalType = 'ca' | 'lawyer';
export type UserStatus = 'active' | 'invited' | 'blocked' | 'accepted' | 'rejected';
export type VerificationStatus = 'pending' | 'under_review' | 'approved' | 'rejected';

export interface ProfessionalDetails {
  professionalType: ProfessionalType;
  icaiMembershipNumber?: string;
  membershipType?: 'associate' | 'fellow';
  copNumber?: string;
  dscExpiryDate?: string;
  barCouncilNumber?: string;
  barCouncilState?: string;
  enrollmentYear?: string;
  highCourts?: string[];
  firmName: string;
  panNumber: string;
  yearsOfExperience: string;
  specializationAreas: string[];
  verificationStatus: VerificationStatus;
}

export interface UserProfile {
  uid: string;
  customerId?: string;
  phoneNumber?: string;
  alternatePhone?: string;
  email?: string;
  userId: string;
  role: UserRole;
  address?: {
    line1: string;
    line2?: string;
    city: string;
    district: string;
    state: string;
    pincode: string;
  };
  status: UserStatus;
  displayName: string;
  company?: string;
  isExpert?: boolean;
  expertise?: string;
  createdAt: number;
  invitedBy?: string;
  invitedAt?: number;
  updatedAt?: number;
  gender?: 'male' | 'female' | 'other';
  dob?: string;
  profileCompleted?: boolean;
  isTemporaryPassword?: boolean;
  photoURL?: string | null;
  emailVerified?: boolean;
  isVerifiedExpert?: boolean;  // 
  professionalDetails?: ProfessionalDetails;
  justRegistered?: boolean;
  provider?: string;
}

export interface Folder {
  id: string;
  name: string;
  type: 'system' | 'custom';
  userId: string;
  createdAt: number;
}

export interface AppMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  isStaff: boolean;
  subject?: string;
  read?: boolean;

  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'file';
  attachmentName?: string;
}

export interface ServiceDocument {
  id: string;
  type: 'gst' | 'pan' | 'trademark' | 'fssai' | 'note' | 'file' | 'legal' | 'msme' | 'startup' | 'trade-license' | 'dsc' | 'professional-tax' | 'itr' | 'tds' | 'trademark-search' | 'email-gstin' | 'fssai-basic' | 'roc-package' | 'company_registration' | 'dir3kyc' | 'inc20a' | 'adt1' | 'roc' | 'general';
  subtype?: string;
  title: string;
  serviceId?: string;
  status?: 'submitted' | 'processing' | 'approved' | 'rejected' | 'paid';
  submittedAt: number;
  formData?: Record<string, any>;
  userId: string;
  amount?: number;
  folderId: string;
  content?: string;
  size?: string;
  fileType?: string;
  messages?: AppMessage[];
  assignedTo?: string;
  assignedBy?: string;
  assignedAt?: number;
  taskStatus?: 'unassigned' | 'assigned' | 'in-progress' | 'completed';
  notes?: string;
  sourceCollection?: string;
}

export interface Invite {
  token: string;
  email: string;
  role: UserRole;
  invitedBy: string;
  expiresAt: number;
  createdAt: number;
  used: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: 'document' | 'reminder' | 'system' | 'message' | 'update' | 'success' | 'alert' | 'form_submission' | 'ticket' | 'payment';
  status?: 'submitted' | 'approved' | 'rejected' | 'processing' | 'completed' | 'success' | 'failed' | 'pending' | 'in-progress' | 'resolved' | 'closed' | 'assigned' | 'review' | 'filed';
  docStatus?: string;
  read: boolean;
  createdAt: number;
  redirectUrl?: string;
  serviceId?: string;
  meta?: {
    formType?: string;
    customerName?: string;
    serviceId?: string;
    ticketId?: string;
    ticketSubject?: string;
    paymentId?: string;
    amount?: number;
    currency?: string;
    docStatus?: string;
    [key: string]: any;
  };
}

export type ServiceStatus =
  | 'draft' | 'submitted' | 'processing' | 'under_review' | 'approved' | 'rejected' | 'on_hold' | 'completed';

export interface StatusHistoryEntry {
  status: ServiceStatus;
  timestamp: number;
  note?: string;
  updatedBy?: string; // UID of the agent who made the change
}
export interface ServiceApplication {
  id: string;
  serviceName: string;
  serviceType: string; // e.g., 'gst', 'msme'
  userId: string;
  currentStatus: ServiceStatus;
  statusHistory: StatusHistoryEntry[];
  assignedAgent?: {
    uid: string;
    name: string;
    email: string;
  };
  estimatedContactTime?: number;
  nextAction?: string;
  documents: any[];
  notes: any[];
  createdAt: number;
  updatedAt: number;
}

// Helper type for the Mock Service interface to ensure consistency
export interface MockDbServiceMethods {
  getFolders: (uid: string) => Promise<Folder[]>;
  createUser: (userData: { email: string; password: string; displayName: string; role: UserRole; invitedBy: string; }) => Promise<UserProfile>;
  getUserByUid: (uid: string) => Promise<UserProfile | null>;
  updateUser: (uid: string, data: Partial<UserProfile>) => Promise<void>;
  getUsersByRole: (role: UserRole) => Promise<UserProfile[]>;
  getAllUsers: () => Promise<UserProfile[]>;
  deleteUser: (uid: string) => Promise<void>;
  createNotification: (notification: Omit<Notification, 'id' | 'createdAt'>) => Promise<Notification>;
  getNotifications: (userId: string, limit?: number) => Promise<Notification[]>;
  markNotificationAsRead: (notificationId: string, userId: string) => Promise<void>;
  deleteNotification: (notificationId: string, userId: string) => Promise<void>; // Added this
  // Add other existing methods here as needed to match your actual implementation
  [key: string]: any;
}