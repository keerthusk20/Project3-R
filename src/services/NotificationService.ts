import { dbService } from './dbService';
import { UserRole, Notification } from '../types';

// Helper to get all users of a specific role
const getUsersByRole = async (role: string): Promise<any[]> => {
  try {
    const allUsers = await dbService.getAllUsers();
    return allUsers.filter((u) => u.role?.toUpperCase() === role.toUpperCase());
  } catch (error) {
    console.error("Error fetching users by role from DB:", error);
    return [];
  }
};

export const triggerNotification = async (
  eventType: string,
  data: any
) => {
  const timestamp = Date.now();

  try {
    // --- SCENARIO 1: CUSTOMER SUBMITS A FORM ---
    if (eventType === 'FORM_SUBMITTED') {
      const { customerId, customerName, formTitle, serviceId, businessName } = data;

      const displayTitle = businessName || customerName;

      // 1. Notify Customer (Confirmation) - Friendly & Clear
      await dbService.createNotification(customerId, {
        title: '✅ Application Submitted Successfully!',
        body: `Thank you! Your ${formTitle} application has been received and is in our queue. Our team will review it within 24-48 hours.`,
        type: 'success',
        docStatus: 'Submitted',
        redirectUrl: '/documents',
        createdAt: timestamp,
        read: false,
        meta: {
          formType: formTitle,  // ✅ Shows MSME/GST/FSSAI
          customerName: displayTitle,
          serviceId: serviceId,
          expectedReviewTime: '24-48 hours'
        }
      });

      // 2. Notify Admin & Superadmin (Action Required)
      const adminNotificationData = {
        title: `📥 New ${formTitle} Application`,
        body: `${displayTitle} has submitted a ${formTitle} application. Please review and process at your earliest convenience.`,
        type: 'alert',
        docStatus: 'Pending Review',
        redirectUrl: `/admin/tasks?serviceId=${serviceId}`,
        createdAt: timestamp,
        read: false,
        meta: {
          serviceId,
          customerId,
          formType: formTitle,
          customerName: displayTitle,
          priority: 'high',
          submittedAt: new Date(timestamp).toLocaleString()
        }
      };

      await broadcastToRole('ADMIN', adminNotificationData);
      await broadcastToRole('SUPERADMIN', adminNotificationData);
    }

    // --- SCENARIO 2: STATUS CHANGE BY SUPPORT ---
    if (eventType === 'STATUS_CHANGED') {
      const { customerId, newStatus, formTitle, updatedBy, rejectionReason } = data;

      // ✅ FIX: Explicitly type notificationType to match Notification type
      let title = '';
      let msgBody = '';
      let notificationType: 'success' | 'update' | 'alert' | 'info' = 'update';

      // Clear, friendly messages based on status
      switch (newStatus.toLowerCase()) {
        case 'approved':
        case 'completed':
          title = '🎉 Great News! Application Approved';
          msgBody = `Congratulations! Your ${formTitle} has been approved and processed successfully. You can now download your certificate/documents from the dashboard.`;
          notificationType = 'success';
          break;

        case 'processing':
        case 'in progress':
        case 'under review':
          title = '⏳ Application Under Review';
          msgBody = `Your ${formTitle} is currently being processed by our team. We're working on it and will update you soon.`;
          notificationType = 'update';
          break;

        case 'rejected':
        case 'needs correction':
          title = '⚠️ Application Requires Attention';
          msgBody = rejectionReason
            ? `Your ${formTitle} needs some corrections. Reason: ${rejectionReason}. Please update and resubmit.`
            : `Your ${formTitle} requires some corrections. Please check the details and resubmit.`;
          notificationType = 'alert';
          break;

        case 'pending documents':
        case 'documents required':
          title = '📄 Additional Documents Needed';
          msgBody = `Your ${formTitle} is on hold. Please upload the required documents to continue processing.`;
          notificationType = 'alert';
          break;

        case 'assigned':
          title = '👤 Task Assigned';
          msgBody = `Your ${formTitle} has been assigned to our support team. They will contact you if needed.`;
          notificationType = 'update';
          break;

        default:
          title = `📋 Status Update: ${formTitle}`;
          msgBody = `Your ${formTitle} status has been updated to ${newStatus}.`;
          notificationType = 'update';
      }

      // Notify Customer
      await dbService.createNotification(customerId, {
        title,
        body: msgBody,
        type: notificationType,
        docStatus: newStatus,
        redirectUrl: '/documents',
        createdAt: timestamp,
        read: false,
        meta: {
          formType: formTitle,  // ✅ Shows MSME/GST/FSSAI
          updatedBy,
          statusChangeTime: new Date(timestamp).toLocaleString()
        }
      });

      // Notify Admin/Superadmin about progress
      const adminMsg = `${formTitle} for ${updatedBy} has been moved to ${newStatus} status.`;

      await broadcastToRole('ADMIN', {
        title: '📊 Status Updated',
        body: adminMsg,
        type: 'info',
        docStatus: newStatus,
        redirectUrl: '/tasks',
        createdAt: timestamp,
        read: false,
      });

      await broadcastToRole('SUPERADMIN', {
        title: '📊 Status Updated',
        body: adminMsg,
        type: 'info',
        docStatus: newStatus,
        redirectUrl: '/tasks',
        createdAt: timestamp,
        read: false,
      });
    }

    // --- SCENARIO 3: TASK ASSIGNED TO SUPPORT ---
    if (eventType === 'TASK_ASSIGNED') {
      const { supportUserId, assignedBy, formTitle, serviceId, customerName, priority } = data;

      const priorityEmoji = priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢';

      await dbService.createNotification(supportUserId, {
        title: `${priorityEmoji} New Task Assigned`,
        body: `${assignedBy} has assigned "${formTitle}" for ${customerName} to you. Please review and take necessary action.`,
        type: 'alert',
        docStatus: 'Assigned',
        redirectUrl: `/support/tasks?serviceId=${serviceId}`,
        createdAt: timestamp,
        read: false,
        meta: {
          serviceId,
          assignedBy,
          customerName,
          formType: formTitle,  // ✅ Shows MSME/GST/FSSAI
          priority: priority || 'medium',
          assignedAt: new Date(timestamp).toLocaleString()
        }
      });
    }

    // --- SCENARIO 4: NEW USER JOINS ---
    if (eventType === 'USER_JOINED') {
      const { newUserRole, userName, userId } = data;

      const roleEmoji = newUserRole.toUpperCase() === 'SUPPORT' ? '🎧' :
        newUserRole.toUpperCase() === 'ADMIN' ? '👨‍' : '👤';

      const message = `${userName} has joined the team as ${newUserRole}.`;

      await broadcastToRole('SUPERADMIN', {
        title: '👥 New Team Member',
        body: message,
        type: 'alert',
        docStatus: 'New Joiner',
        redirectUrl: '/admin',
        createdAt: timestamp,
        read: false,
        meta: { newUserId: userId, joinedAt: new Date(timestamp).toLocaleString() }
      });

      if (newUserRole.toUpperCase() === 'SUPPORT') {
        await broadcastToRole('ADMIN', {
          title: '🎧 New Support Agent Joined',
          body: message,
          type: 'alert',
          docStatus: 'New Joiner',
          redirectUrl: '/admin',
          createdAt: timestamp,
          read: false,
          meta: { newUserId: userId }
        });
      }
    }

    // --- SCENARIO 5: DEADLINE REMINDER ---
    if (eventType === 'DEADLINE_APPROACHING') {
      const { customerId, formTitle, daysRemaining } = data;

      await dbService.createNotification(customerId, {
        title: '⏰ Reminder: Action Required',
        body: `Your ${formTitle} application is pending. ${daysRemaining} day${daysRemaining > 1 ? 's' : ''} remaining to complete the process. Please submit required documents.`,
        type: 'alert',
        docStatus: 'Pending',
        redirectUrl: '/documents',
        createdAt: timestamp,
        read: false,
        meta: { formType: formTitle, daysRemaining }  // ✅ Shows MSME/GST/FSSAI
      });
    }

    // --- SCENARIO 6: DOCUMENT VERIFIED ---
    if (eventType === 'DOCUMENT_VERIFIED') {
      const { customerId, documentName, verifiedBy } = data;

      await dbService.createNotification(customerId, {
        title: '✓ Document Verified',
        body: `Your ${documentName} has been verified successfully by ${verifiedBy}. Processing will continue.`,
        type: 'success',
        docStatus: 'Verified',
        redirectUrl: '/documents',
        createdAt: timestamp,
        read: false,
        meta: { documentName, verifiedBy }
      });
    }

    // --- SCENARIO 7: SYSTEM ANNOUNCEMENT ---
    if (eventType === 'SYSTEM_ANNOUNCEMENT') {
      const { targetRole, title, body, redirectUrl } = data;

      const notificationData = {
        title: `📢 ${title}`,
        body: body,
        type: 'info' as 'success' | 'update' | 'alert' | 'info',
        docStatus: 'Announcement',
        redirectUrl: redirectUrl || '/dashboard',
        createdAt: timestamp,
        read: false,
        meta: { announcement: true }
      };

      if (targetRole) {
        await broadcastToRole(targetRole, notificationData);
      } else {
        // Broadcast to all roles
        await broadcastToRole('CUSTOMER', notificationData);
        await broadcastToRole('SUPPORT', notificationData);
        await broadcastToRole('ADMIN', notificationData);
        await broadcastToRole('SUPERADMIN', notificationData);
      }
    }

  } catch (error) {
    console.error("Error triggering notification:", error);
  }
};

async function broadcastToRole(role: string, notificationData: any) {
  const users = await getUsersByRole(role);

  if (users.length === 0) {
    return;
  }

  const promises = users.map((user: any) =>
    dbService.createNotification(user.uid, notificationData)
  );

  await Promise.all(promises);
}