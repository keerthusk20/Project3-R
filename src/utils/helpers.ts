//src/utils/helpers.ts

import { UserRole } from '../types';
import { Timestamp } from 'firebase/firestore';

// ============================================================================
// 🆔 ID Generators
// ============================================================================

/**
 * Generates a human-readable User ID: USR-{YYYY}-{NNN}
 * Note: For production, use Firestore transactions + a global counter collection
 * to ensure uniqueness across clients.
 */
export const generateUserId = (): string => {
  const year = new Date().getFullYear();
  const counter = Math.floor(Math.random() * 900) + 100;
  return `USR-${year}-${counter}`;
};

/**
 * Generates Customer ID: REGI-YYMM-PHONELAST6
 * Example: REGI-2603-622240
 */
export const generateCustomerId = (phoneNumber: string, createdAt: Date = new Date()): string => {
  const cleanNumber = phoneNumber.replace(/\D/g, '');

  const year = createdAt.getFullYear().toString().slice(-2); // "26"
  const month = (createdAt.getMonth() + 1).toString().padStart(2, '0'); // "03"
  const lastSixDigits = cleanNumber.slice(-6); // "622240"
  return `REGI-${year}${month}-${lastSixDigits}`;
};

export const generateServiceId = (prefix: string): string => {
  const year = new Date().getFullYear();
  const counter = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${year}-${counter}`;
};

/**
 * Generates ROC Reference ID: ROC {TYPE} {NNN}
 * Example: ROC NOR 101, ROC STD 105, ROC PRE 110
 */
export const generateRocReferenceId = (packageType: 'normal' | 'standard' | 'premium'): string => {
  const prefix = packageType === 'normal' ? 'NOR' : packageType === 'standard' ? 'STD' : 'PRE';
  const counter = Math.floor(Math.random() * 900) + 100; // 3-digit random number
  return `ROC ${prefix} ${counter}`;
};

// ============================================================================
// 🔐 Permission Helpers
// ============================================================================

export const canInvite = (currentUserRole: UserRole): boolean => {
  return (
    currentUserRole === UserRole.SUPERADMIN ||
    currentUserRole === UserRole.ADMIN
  );
};

export const canViewAdminPanel = (currentUserRole: UserRole): boolean => {
  return (
    currentUserRole === UserRole.SUPERADMIN ||
    currentUserRole === UserRole.ADMIN
  );
};

export const canAccessServiceHub = (currentUserRole: UserRole): boolean => {
  return (
    currentUserRole === UserRole.SUPERADMIN ||
    currentUserRole === UserRole.ADMIN ||
    currentUserRole === UserRole.SUPPORT ||
    currentUserRole === UserRole.CUSTOMER
  );
};

export const canViewSensitiveStats = (currentUserRole: UserRole): boolean => {
  return (
    currentUserRole === UserRole.SUPERADMIN ||
    currentUserRole === UserRole.ADMIN
  );
};

// ============================================================================
// 📅 Date & Time Formatting
// ============================================================================

/**
 * Enhanced formatDate: handles number timestamps, Firestore Timestamp, ISO strings
 */
export const formatDate = (input: number | Timestamp | string | Date | null | undefined): string => {
  if (!input) return '—';

  let date: Date;
  if (input instanceof Timestamp) {
    date = input.toDate();
  } else if (typeof input === 'string') {
    date = new Date(input);
  } else if (typeof input === 'number') {
    date = new Date(input);
  } else if (input instanceof Date) {
    date = input;
  } else {
    return '—';
  }

  if (isNaN(date.getTime())) return '—';

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (input: number | Timestamp | string | Date | null | undefined): string => {
  if (!input) return '—';

  let date: Date;
  if (input instanceof Timestamp) {
    date = input.toDate();
  } else if (typeof input === 'string') {
    date = new Date(input);
  } else if (typeof input === 'number') {
    date = new Date(input);
  } else if (input instanceof Date) {
    date = input;
  } else {
    return '—';
  }

  if (isNaN(date.getTime())) return '—';

  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// ============================================================================
// 📋 Form Data Formatting Helpers (For CustomerDetailPage)
// ============================================================================

/**
 * Human-readable field labels with optional Tamil support
 */
export const formatFieldKey = (key: string, options?: { language?: 'en' | 'ta' }): string => {
  const { language = 'en' } = options || {};

  // English labels (default)
  const labelMapEn: Record<string, string> = {
    // Personal
    fullName: 'Full Name',
    firstName: 'First Name',
    lastName: 'Last Name',
    phoneNumber: 'Phone Number',
    email: 'Email Address',
    dob: 'Date of Birth',
    gender: 'Gender',
    aadhaarNumber: 'Aadhaar Number',
    panNumber: 'PAN Number',

    // Business
    companyName: 'Company Name',
    businessType: 'Business Type',
    gstNumber: 'GST Number',
    msmeNumber: 'MSME/Udyam Number',
    fssaiNumber: 'FSSAI License No.',
    businessAddress: 'Business Address',

    // Address
    addressLine1: 'Address Line 1',
    addressLine2: 'Address Line 2',
    city: 'City',
    district: 'District',
    state: 'State',
    pincode: 'Pincode',
    country: 'Country',

    // Service Specific
    serviceType: 'Service Type',
    applicationType: 'Application Type',
    remarks: 'Remarks / Notes',
    paymentId: 'Payment Reference',
    transactionId: 'Transaction ID',

    // Account
    profileCompleted: 'Profile Completed',
    isExpert: 'Verified Expert',
    status: 'Account Status',
    role: 'User Role',
  };

  // Tamil labels (optional - future use)
  const labelMapTa: Record<string, string> = {
    fullName: 'முழு பெயர்',
    phoneNumber: 'தொலைபேசி எண்',
    email: 'மின்னஞ்சல்',
    companyName: 'நிறுவன பெயர்',
    gstNumber: 'ஜிஎஸ்டி எண்',
    panNumber: 'பான் எண்',
    aadhaarNumber: 'ஆதார் எண்',
    pincode: 'அஞ்சல் குறியீடு',
    city: 'நகரம்',
    district: 'மாவட்டம்',
    state: 'மாநிலம்',
  };

  if (language === 'ta' && labelMapTa[key]) {
    return labelMapTa[key];
  }

  return labelMapEn[key] ||
    key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
};

/**
 * Smart value formatter: handles dates, booleans, arrays, nulls, objects
 */
export const formatFieldValue = (value: any, options?: { key?: string }): string => {
  if (value === null || value === undefined || value === '') return '—';

  // Boolean
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';

  // Date handling (including Firestore Timestamp)
  if (value instanceof Timestamp ||
    (typeof value === 'object' && value?.toDate) ||
    (typeof value === 'string' && !isNaN(Date.parse(value))) ||
    (typeof value === 'number')) {
    return formatDate(value);
  }

  // Array
  if (Array.isArray(value)) {
    if (value.length === 0) return '—';
    return value.map(v => formatFieldValue(v)).join(', ');
  }

  // Object (nested)
  if (typeof value === 'object') {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return '[Object]';
    }
  }

  // Sensitive fields masking (optional)
  const sensitiveKeys = ['aadhaarNumber', 'panNumber', 'password'];
  if (options?.key && sensitiveKeys.includes(options.key) && String(value).length > 4) {
    return '•••• ' + String(value).slice(-4);
  }

  return String(value);
};

/**
 * Groups form fields into logical sections for better UI organization
 */
export const getFieldGroup = (key: string): string => {
  const groups: Record<string, string[]> = {
    'Personal Information': [
      'fullName', 'firstName', 'lastName', 'phoneNumber', 'email',
      'dob', 'gender', 'aadhaarNumber', 'panNumber'
    ],
    'Business Details': [
      'companyName', 'businessType', 'gstNumber', 'msmeNumber',
      'fssaiNumber', 'businessAddress', 'industry'
    ],
    'Address': [
      'addressLine1', 'addressLine2', 'city', 'district', 'state',
      'pincode', 'country', 'landmark'
    ],
    'Service Details': [
      'serviceType', 'applicationType', 'serviceId', 'referenceId',
      'amount', 'paymentId', 'transactionId', 'remarks'
    ],
    'Account Meta': [
      'profileCompleted', 'isExpert', 'status', 'role', 'createdAt',
      'lastLogin', 'assignedTo'
    ]
  };

  for (const [group, keys] of Object.entries(groups)) {
    if (keys.includes(key)) return group;
  }

  return 'Other Details';
};

/**
 * Returns fields grouped by category for easy rendering
 */
export const getGroupedFormData = (formData: Record<string, any>): Record<string, Array<[string, any]>> => {
  const grouped: Record<string, Array<[string, any]>> = {};
  const excludeKeys = ['paymentId', 'createdAt', 'updatedAt', 'submittedAt'];

  for (const [key, value] of Object.entries(formData)) {
    if (excludeKeys.includes(key)) continue;

    const group = getFieldGroup(key);
    if (!grouped[group]) grouped[group] = [];
    grouped[group].push([key, value]);
  }

  return grouped;
};

// ============================================================================
// 🔗 Utility Functions
// ============================================================================

/**
 * Generates a fully qualified frontend URL for invite links
 */
export const generateInviteLink = (token: string): string => {
  const origin = window.location.origin;
  return `${origin}/#/register?token=${token}`;
};

/**
 * Currency formatter for INR
 */
export const formatCurrency = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined || amount === '') return '₹0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₹0';

  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
};

/**
 * Truncate long text with ellipsis
 */
export const truncateText = (text: string, maxLength: number = 50): string => {
  if (!text || text.length <= maxLength) return text || '';
  return text.slice(0, maxLength) + '…';
};