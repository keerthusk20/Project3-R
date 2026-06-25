import { Timestamp } from 'firebase/firestore';

export interface Application {
  id: string;
  type: string;
  title: string;
  status: string;
  submittedAt: number | Timestamp;
  formData: any;
  commonData?: any;
  uploadedFileUrls: Record<string, string>;
  userId: string;
  caseId?: string;
  userEmail?: string;
  assignedTo?: string;
  taskStatus?: string;
  sourceCollection?: string;
  promoters?: any[];
  directors?: any[];
  partners?: any[];
  constitution?: string;
  propertyType?: 'owned' | 'rented';
  includeSignatoryDetails?: boolean;
  signatoryDetails?: any;
  paymentId?: string;
  applicationRef?: string;
  serviceId?: string;
  services?: any;
  storageFolder?: string;
  documentCount?: number;
  documentKeys?: string[];
  bundleServices?: Array<{ key: string; label: string; included?: boolean }>;
}
