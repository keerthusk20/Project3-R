export type InitialApplicationStatusInput = {
  serviceType: string;
  serviceName: string;
  userId?: string;
  now?: number;
};

export const buildInitialApplicationStatus = ({
  serviceType,
  serviceName,
  userId,
  now = Date.now(),
}: InitialApplicationStatusInput) => ({
  status: 'submitted',
  applicationStatus: 'submitted',
  taskStatus: 'unassigned',
  workflowStatus: 'intake_submitted',
  statusLabel: 'Submitted',
  statusPriority: 'new',
  statusUpdatedAt: now,
  lastStatusUpdate: now,
  nextAction: 'Awaiting staff review',
  assignedTo: null,
  assignedBy: null,
  assignedAt: null,
  isArchived: false,
  statusHistory: [
    {
      status: 'submitted',
      taskStatus: 'unassigned',
      workflowStatus: 'intake_submitted',
      label: 'Application submitted',
      serviceType,
      serviceName,
      changedAt: now,
      changedBy: userId || 'system',
      changedByRole: 'customer',
    },
  ],
  statusTimeline: {
    submitted: {
      state: 'completed',
      label: 'Submitted',
      completedAt: now,
    },
    review: {
      state: 'pending',
      label: 'Document Review',
    },
    assignment: {
      state: 'pending',
      label: 'Staff Assignment',
    },
    processing: {
      state: 'pending',
      label: 'Processing',
    },
    filing: {
      state: 'pending',
      label: 'Government Filing',
    },
    completed: {
      state: 'pending',
      label: 'Completed',
    },
  },
  workflow: {
    intake: 'completed',
    documentReview: 'pending',
    assignment: 'pending',
    processing: 'pending',
    filing: 'pending',
    completion: 'pending',
  },
});