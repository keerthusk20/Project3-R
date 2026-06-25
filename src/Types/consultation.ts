// Types/consultation.ts

export type ExpertRole = 'CA' | 'Lawyer';
export type ExpertType = ExpertRole; // ✅ backward-compat alias for old files
export type AvailabilityStatus = 'Available' | 'Busy' | 'Offline';
export type ConsultationStatus = 'Pending' | 'Assigned' | 'In-Progress' | 'Completed' | 'Cancelled';

export interface ExpertProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: ExpertRole;
  specialization: string;
  availabilityStatus: AvailabilityStatus;
  rating: number;
  totalConsultations: number;
  bio?: string;
  profileImageUrl?: string;
  isActive: boolean;
  createdAt: Date | string;
}

export interface ConsultationRequest {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail?: string;
  serviceType: string;
  serviceCategory: ExpertRole;
  status: ConsultationStatus;
  assignedExpertId: string | null;
  assignedExpertName: string | null;
  supportAgentId: string | null;
  supportAgentName: string | null;
  timestamp: Date | string;
  scheduledTime: Date | string | null;
  notes: string;
  priority?: 'Low' | 'Medium' | 'High';
}

export interface ActivityLog {
  id: string;
  message: string;
  supportAgentId: string;
  supportAgentName: string;
  expertId: string;
  expertName: string;
  customerId: string;
  customerName: string;
  consultationId: string;
  timestamp: Date | string;
}

export interface SuperadminStats {
  totalExperts: number;
  totalCAs: number;
  totalLawyers: number;
  availableExperts: number;
  activeConsultations: number;
  pendingAssignments: number;
  completedConsultations: number;
}