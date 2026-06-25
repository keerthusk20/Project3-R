import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserProfile, Notification } from '../types';
import { mockDbService } from '../services/mockFirebase';
import {
  Bell, Clock, CheckCircle, AlertCircle, FileText,
  MessageSquare, Shield, UserCheck, Headphones, User,
  Briefcase, ArrowRight, Trash2, X, ExternalLink,
  TrendingUp, Calendar, Tag, ChevronRight
} from 'lucide-react';
import { useNotification } from '../context/NotificationContext';
import { UserRole } from '../types';

// ============================================================================
// 🎯 EXPORTABLE NOTIFICATION FUNCTIONS (Use in ANY component)
// ============================================================================

export const notifyRoles = async (roles: UserRole[], notificationData: any) => {
  for (const role of roles) {
    const users = await mockDbService.getUsersByRole(role);
    for (const user of users) {
      await mockDbService.createNotification(user.uid, notificationData);
    }
  }
};

export const notifyWelcome = async (userId: string, userName: string = 'User') => {
  await mockDbService.createNotification(userId, {
    title: "Welcome Back 👋",
    body: `Welcome back to CloudMasa. Your dashboard is ready.`,
    type: 'system',
    status: 'success',
    read: false,
    createdAt: Date.now(),
    redirectUrl: '/',
    meta: {
      docStatus: 'success'
    }
  });
};

export const notifyUserRegistered = async (
  userId: string,
  userName: string,
  role: string = 'User'
) => {
  await notifyRoles([UserRole.ADMIN, UserRole.SUPERADMIN], {
    title: `👤 New User Registration`,
    body: `${userName} has registered as a new ${role}.`,
    type: 'system',
    status: 'success',
    read: false,
    createdAt: Date.now(),
    redirectUrl: '/admin',
    meta: {
      userId,
      docStatus: 'success'
    }
  });
};

export const notifyServicePurchased = async (
  userId: string,
  serviceName: string,
  serviceId?: string
) => {
  await mockDbService.createNotification(userId, {
    title: "🎉 Service Purchased Successfully",
    body: `Your ${serviceName} service has been activated successfully.`,
    type: 'payment',
    status: 'success',
    read: false,
    createdAt: Date.now(),
    redirectUrl: serviceId ? `/documents?id=${serviceId}` : '/documents',
    meta: {
      docStatus: 'success',
      serviceName,
      serviceId
    }
  });

  await notifyRoles([UserRole.ADMIN, UserRole.SUPERADMIN], {
    title: `💰 New Service Purchase`,
    body: `A user has purchased the ${serviceName} service.`,
    type: 'payment',
    status: 'success',
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/admin`,
    meta: {
      userId,
      serviceName,
      serviceId
    }
  });
};

export const notifyFormSubmitted = async (
  userId: string,
  formType: string,
  formId: string,
  customerName: string,
  serviceId: string
) => {
  await mockDbService.createNotification(userId, {
    title: `${formType} Form Submitted`,
    body: `Your ${formType} application has been submitted successfully. We'll review it shortly.`,
    type: 'form_submission',
    status: 'submitted',
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/documents?id=${formId}`,
    meta: {
      formType: formType as any,
      formId,
      customerName,
      serviceId,
      docStatus: 'submitted' // 🔵 BLUE - "In Progress"
    }
  });

  await notifyRoles([UserRole.ADMIN, UserRole.SUPERADMIN], {
    title: `📥 New ${formType} Form Submitted`,
    body: `${customerName} has submitted a new ${formType} application.`,
    type: 'form_submission',
    status: 'submitted',
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/admin/tasks?serviceId=${serviceId}`,
    meta: {
      userId,
      formType: formType as any,
      formId,
      serviceId
    }
  });
};

export const notifyFormStatusUpdate = async (
  userId: string,
  formType: string,
  formId: string,
  newStatus: 'approved' | 'rejected' | 'processing' | 'completed' | 'review' | 'filed',
  notes?: string
) => {
  const statusConfig: Record<string, { title: string; body: string }> = {
    approved: {
      title: `${formType} - Approved ✅`,
      body: notes || `Congratulations! Your ${formType} application has been approved.`
    },
    rejected: {
      title: `${formType} - Action Required ❌`,
      body: notes || `Your ${formType} application needs correction. Please check details and resubmit.`
    },
    processing: {
      title: `${formType} - Under Review 🔄`,
      body: notes || `Our team is currently reviewing your ${formType} application.`
    },
    completed: {
      title: `${formType} - Completed 🎉`,
      body: notes || `Your ${formType} application process has been completed successfully.`
    },
    review: {
      title: `${formType} - Under Review 📝`,
      body: notes || `Your ${formType} application is currently under review by our team.`
    },
    filed: {
      title: `${formType} - Filed Successfully 📑`,
      body: notes || `Your ${formType} application has been successfully filed with the authorities.`
    }
  };

  const config = statusConfig[newStatus];

  await mockDbService.createNotification(userId, {
    title: config.title,
    body: config.body,
    type: 'form_submission',
    status: newStatus,
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/documents?id=${formId}`,
    meta: {
      formType: formType as any,
      formId,
      docStatus: newStatus // 🟢 GREEN / 🔴 RED / 🔵 BLUE based on status
    }
  });
};

export const notifyTicketRaised = async (
  userId: string,
  ticketId: string,
  subject: string,
  priority: 'low' | 'medium' | 'high' = 'medium'
) => {
  await mockDbService.createNotification(userId, {
    title: `🎫 Ticket Raised: ${subject}`,
    body: `Your support ticket #${ticketId.slice(-6)} has been created. Our team will respond within 24 hours.`,
    type: 'ticket',
    status: 'pending',
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/tickets/${ticketId}`,
    meta: {
      ticketId,
      ticketSubject: subject,
      docStatus: 'pending' // 🔵 BLUE - "In Progress"
    }
  });

  await notifyRoles([UserRole.ADMIN, UserRole.SUPERADMIN, UserRole.SUPPORT], {
    title: `🎫 New Ticket Raised`,
    body: `A new support ticket #${ticketId.slice(-6)}: "${subject}" has been raised.`,
    type: 'ticket',
    status: 'pending',
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/tickets/${ticketId}`,
    meta: {
      userId,
      ticketId,
      priority
    }
  });
};

export const notifyTicketStatusUpdate = async (
  userId: string,
  ticketId: string,
  subject: string,
  newStatus: 'in-progress' | 'resolved' | 'closed' | 'assigned',
  agentNote?: string
) => {
  const statusLabels: Record<string, string> = {
    'in-progress': '🔧 In Progress',
    'resolved': '✅ Resolved',
    'closed': '🔒 Closed',
    'assigned': '👤 Assigned'
  };

  await mockDbService.createNotification(userId, {
    title: `Ticket #${ticketId.slice(-6)} - ${statusLabels[newStatus]}`,
    body: agentNote || `Your ticket "${subject}" status updated to: ${newStatus.replace('-', ' ')}`,
    type: 'ticket',
    status: newStatus as any,
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/tickets/${ticketId}`,
    meta: {
      ticketId,
      ticketSubject: subject,
      docStatus: newStatus
    }
  });
};

export const notifyPaymentSuccess = async (
  userId: string,
  paymentId: string,
  amount: number,
  currency: string = 'INR',
  formType?: string,
  serviceId?: string
) => {
  await mockDbService.createNotification(userId, {
    title: `💳 Payment Successful`,
    body: `₹${amount.toLocaleString('en-IN')} paid successfully for ${formType || 'your service'}. Receipt: #${paymentId.slice(-8)}`,
    type: 'payment',
    status: 'success',
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/payments/${paymentId}`,
    meta: {
      paymentId,
      amount,
      currency,
      formType: formType as any,
      serviceId,
      docStatus: 'success' // 🟢 GREEN - "Completed"
    }
  });

  await notifyRoles([UserRole.ADMIN, UserRole.SUPERADMIN], {
    title: `💳 Payment Received`,
    body: `₹${amount.toLocaleString('en-IN')} received successfully for ${formType || 'a service'}.`,
    type: 'payment',
    status: 'success',
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/admin`,
    meta: {
      userId,
      paymentId,
      amount
    }
  });
};

export const notifyPaymentFailed = async (
  userId: string,
  paymentId: string,
  amount: number,
  reason: string = 'Payment declined'
) => {
  await mockDbService.createNotification(userId, {
    title: `⚠️ Payment Failed`,
    body: `₹${amount.toLocaleString('en-IN')} payment failed: ${reason}. Please try again.`,
    type: 'payment',
    status: 'failed',
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/payments/${paymentId}?retry=true`,
    meta: {
      paymentId,
      amount,
      docStatus: 'failed' // 🔴 RED - "Action Required"
    }
  });

  await notifyRoles([UserRole.ADMIN, UserRole.SUPERADMIN], {
    title: `⚠️ Payment Failed`,
    body: `A payment of ₹${amount.toLocaleString('en-IN')} has failed: ${reason}.`,
    type: 'payment',
    status: 'failed',
    read: false,
    createdAt: Date.now(),
    redirectUrl: `/admin`,
    meta: {
      userId,
      paymentId,
      amount
    }
  });
};

export const notifyGeneric = async (
  userId: string,
  title: string,
  body: string,
  type: 'system' | 'message' | 'document' = 'system',
  status?: string,
  redirectUrl?: string,
  meta?: Record<string, any>
) => {
  await mockDbService.createNotification(userId, {
    title,
    body,
    type,
    status: status as any,
    read: false,
    createdAt: Date.now(),
    redirectUrl,
    meta: {
      docStatus: status,
      ...meta
    }
  });
};

// ============================================================================
// 🎯 COMPONENT CODE STARTS HERE
// ============================================================================

interface NotificationDropdownProps {
  user: UserProfile;
  onToggle?: (isOpen: boolean) => void;
}

const NotificationDropdown: React.FC<NotificationDropdownProps> = ({ user, onToggle }) => {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);

  // Notify parent of toggle
  useEffect(() => {
    onToggle?.(isOpen);
  }, [isOpen, onToggle]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<'all' | 'unread' | 'read'>('all');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { showNotification } = useNotification();
  const initialLoadRef = useRef(true);
  const prevNotifsRef = useRef<Notification[]>([]);

  // Subscribe to real-time updates
  useEffect(() => {
    const unsubscribe = mockDbService.subscribeToNotifications(user.uid, (data) => {
      const sorted = [...data].sort((a, b) => b.createdAt - a.createdAt);

      if (!initialLoadRef.current) {
        // Find new unread notifications
        const prevIds = new Set(prevNotifsRef.current.map(n => n.id));
        const newNotifs = sorted.filter(n => !prevIds.has(n.id) && !n.read);

        newNotifs.forEach(n => {
           let type = 'info';
           const status = n.status?.toLowerCase();
           if (status === 'success' || status === 'approved' || status === 'completed') type = 'success';
           else if (status === 'failed' || status === 'rejected' || status === 'action required') type = 'error';
           else if (status === 'processing' || status === 'submitted' || status === 'pending' || status === 'in-progress') type = 'info';
           else type = 'warning'; // General updates

           showNotification(n.title, type as any, { duration: 4000 });
        });
      } else {
         initialLoadRef.current = false;
      }

      prevNotifsRef.current = sorted;
      setNotifications(sorted);
    });
    return () => unsubscribe();
  }, [user.uid, showNotification]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowDeleteConfirm(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const readCount = notifications.filter((n) => n.read).length;

  // Filter notifications
  const filteredNotifications = notifications.filter(n => {
    if (filterType === 'unread') return !n.read;
    if (filterType === 'read') return n.read;
    return true;
  });



  // Dynamic Styling based on Type and Status
  const getStyle = (type: string, status?: string) => {
    const s = status?.toLowerCase() || '';

    if (type === 'message')
      return {
        bg: 'bg-gradient-to-br from-purple-500/15 to-purple-600/5',
        border: 'border-purple-500/40',
        text: 'text-purple-400',
        iconBg: 'bg-purple-500/20',
        icon: <MessageSquare size={20} />,
        label: 'Message',
        accent: 'from-purple-500 to-purple-600'
      };

    if (s === 'approved' || s === 'completed' || s === 'success' || s === 'verified')
      return {
        bg: 'bg-stat-green/10',
        border: 'border-stat-green/20',
        text: 'text-stat-green',
        iconBg: 'bg-stat-green/15',
        icon: <CheckCircle size={20} />,
        label: 'Completed',
        accent: 'from-stat-green/50 to-stat-green'
      };

    if (s === 'processing' || s === 'review' || s === 'assigned' || s === 'in-progress' || s === 'pending review' || s === 'new' || s === 'submitted' || s === 'under review')
      return {
        bg: 'bg-stat-blue/10',
        border: 'border-stat-blue/20',
        text: 'text-stat-blue',
        iconBg: 'bg-stat-blue/15',
        icon: <Briefcase size={20} />,
        label: 'In Progress',
        accent: 'from-stat-blue/50 to-stat-blue'
      };

    if (s === 'rejected' || s === 'blocked' || s === 'failed' || s === 'action required' || s === 'needs correction')
      return {
        bg: 'bg-destructive/10',
        border: 'border-destructive/20',
        text: 'text-destructive',
        iconBg: 'bg-destructive/15',
        icon: <AlertCircle size={20} />,
        label: 'Action Required',
        accent: 'from-destructive/50 to-destructive'
      };

    return {
      bg: 'bg-stat-amber/10',
      border: 'border-stat-amber/20',
      text: 'text-stat-amber',
      iconBg: 'bg-stat-amber/15',
      icon: <FileText size={20} />,
      label: 'Update',
      accent: 'from-stat-amber/50 to-stat-amber'
    };
  };

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const getRoleIcon = () => {
    const role = user.role?.toUpperCase() || 'USER';
    switch (role) {
      case 'SUPERADMIN': return <Shield className="text-teal-400" size={22} />;
      case 'ADMIN': return <UserCheck className="text-blue-400" size={22} />;
      case 'SUPPORT': return <Headphones className="text-orange-400" size={22} />;
      case 'CUSTOMER': return <User className="text-gray-400" size={22} />;
      default: return <User className="text-gray-400" size={22} />;
    }
  };

  // ✅ DELETE NOTIFICATION FUNCTION
  const handleDeleteNotification = async (notificationId: string) => {
    try {
      if (mockDbService.deleteNotification) {
        await mockDbService.deleteNotification(user.uid, notificationId);
        setNotifications(prev => prev.filter(n => n.id !== notificationId));
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  const handleNotificationClick = (n: Notification) => {
    if (!n.read && mockDbService.markNotificationRead) {
      mockDbService.markNotificationRead(user.uid, n.id);
    }

    if (n.redirectUrl) {
      navigate(n.redirectUrl);
    }
    setIsOpen(false);
  };

  const markAllRead = async () => {
    if (mockDbService.markAllNotificationsRead) {
      await mockDbService.markAllNotificationsRead(user.uid);
    }
  };

  // ✅ EXTRACT FORM NAME FROM META OR TITLE
  const getFormDetails = (n: Notification) => {
    const meta = (n as any).meta || {};

    if (meta.formType) {
      return {
        formName: meta.formType,
        customerName: meta.customerName || '',
        serviceId: meta.serviceId || '',
        showBadge: true
      };
    }

    // ✅ ADD NULL CHECKS - This fixes the error
    if (n.title && typeof n.title === 'string') {
      const titleMatch = n.title.match(/(MSME|GST|FSSAI|PAN|TAN|Udyam|Trademark|License)/i);
      if (titleMatch) {
        return {
          formName: titleMatch[0].toUpperCase(),
          customerName: '',
          serviceId: '',
          showBadge: true
        };
      }
    }

    if (n.body && typeof n.body === 'string') {
      const bodyMatch = n.body.match(/(MSME|GST|FSSAI|PAN|TAN|Udyam|Trademark|License)/i);
      if (bodyMatch) {
        return {
          formName: bodyMatch[0].toUpperCase(),
          customerName: '',
          serviceId: '',
          showBadge: true
        };
      }
    }

    return {
      formName: null,
      customerName: '',
      serviceId: '',
      showBadge: false
    };
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger Button - Enhanced */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Notifications"
        className="group relative p-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-teal-500/50 hover:shadow-lg hover:shadow-teal-500/10"
      >
        <Bell size={22} className={`transition-all duration-300 ${isOpen ? 'scale-110 rotate-12' : 'group-hover:scale-110'}`} />

        {/* ✅ GLOWING RED DOT - UNREAD NOTIFICATIONS */}
        {unreadCount > 0 && (
          <>
            <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-ping opacity-75"></span>
            <span className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,1)] animate-pulse"></span>
          </>
        )}
      </button>

      {/* Backdrop for blurring background */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/5 backdrop-blur-[2px] z-40 transition-all duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Dropdown Panel - Professional & Bigger */}
      {isOpen && (
        <div className="fixed left-3 right-3 top-20 max-h-[calc(100dvh-6rem)] glass-panel rounded-3xl shadow-2xl overflow-hidden z-50 flex flex-col animate-in fade-in zoom-in-95 duration-300 sm:absolute sm:left-auto sm:right-0 sm:top-full sm:mt-4 sm:w-[min(520px,calc(100vw-2rem))] sm:max-h-[700px]">

          {/* Header - Enhanced */}
          <div className="p-4 sm:p-6 border-b border-border bg-white/[0.02]">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-start mb-4">
              <div className="flex min-w-0 items-center gap-3 sm:gap-4">
                <div className="p-2.5 sm:p-3 bg-primary/10 rounded-xl border border-primary/20 shadow-lg shadow-primary/5 shrink-0">
                  {getRoleIcon()}
                </div>
                <div className="min-w-0">
                  <h3 className="text-base sm:text-lg font-bold text-foreground tracking-wide flex items-center gap-2">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-gradient-primary text-white rounded-full">
                        {unreadCount} New
                      </span>
                    )}
                  </h3>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5 truncate">
                    {user.role?.toUpperCase() === 'CUSTOMER' ? 'Application Updates & Alerts' : 'Task & System Notifications'}
                  </p>
                </div>
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="self-start text-xs font-semibold text-primary hover:text-primary/80 transition-all px-3 py-1.5 rounded-lg hover:bg-primary/10 border border-primary/20"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              {[
                { type: 'all', count: notifications.length, label: 'All' },
                { type: 'unread', count: unreadCount, label: 'Unread' },
                { type: 'read', count: readCount, label: 'Read' }
              ].map((tab) => (
                <button
                  key={tab.type}
                  onClick={() => setFilterType(tab.type as any)}
                  className={`flex-1 px-3 py-2.5 text-xs font-bold rounded-xl transition-all border ${filterType === tab.type
                    ? 'bg-primary/20 text-primary border-primary/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-white/5 border-transparent'
                    }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* List - Enhanced */}
          <div className="overflow-y-auto flex-1 p-3 sm:p-4 space-y-3 custom-scrollbar">
            {filteredNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
                <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mb-4 border border-border">
                  <Bell size={40} className="opacity-20" />
                </div>
                <p className="text-base font-bold text-foreground">
                  {filterType === 'unread' ? 'No unread notifications' : 'No notifications'}
                </p>
                <p className="text-sm opacity-60 mt-1">
                  {filterType === 'unread' ? 'All caught up!' : "You're all set!"}
                </p>
              </div>
            ) : (
              filteredNotifications.map((n) => {
                const style = getStyle(n.type, (n as any).docStatus || n.title);
                const formDetails = getFormDetails(n);
                const isUnread = !n.read;

                return (
                  <div
                    key={n.id}
                    className={`group relative p-4 sm:p-5 rounded-2xl border transition-all duration-300 
                      ${isUnread
                        ? `${style.bg} ${style.border} shadow-lg hover:shadow-xl hover:scale-[1.01]`
                        : 'bg-white/[0.02] border-border/50 hover:bg-white/[0.04] opacity-80 hover:opacity-100'
                      }
                    `}
                  >
                    {/* Unread Indicator */}
                    {isUnread && (
                      <div className="absolute top-5 right-5 w-2.5 h-2.5 rounded-full bg-gradient-to-r from-heading-from to-heading-to shadow-[0_0_12px_rgba(249,115,22,0.4)] animate-pulse"></div>
                    )}

                    {/* Delete Button */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(n.id);
                      }}
                      className="absolute top-3 right-3 p-2 rounded-xl opacity-0 group-hover:opacity-100 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-all z-20"
                      title="Delete notification"
                    >
                      <Trash2 size={16} />
                    </button>

                    {/* Delete Confirmation */}
                    {showDeleteConfirm === n.id && (
                      <div className="absolute inset-0 z-30 p-5 bg-background/95 backdrop-blur-sm rounded-2xl flex items-center justify-center border border-destructive/20">
                        <div className="text-center">
                          <p className="text-sm text-foreground mb-4 font-bold">Delete this notification?</p>
                          <div className="flex gap-2 justify-center">
                            <button
                              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(null); }}
                              className="px-4 py-2 text-xs rounded-xl bg-white/10 hover:bg-white/20 text-foreground font-bold transition-all border border-border"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteNotification(n.id); }}
                              className="px-4 py-2 text-xs rounded-xl bg-destructive hover:bg-destructive/80 text-white font-bold transition-all shadow-lg"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div
                      onClick={() => handleNotificationClick(n)}
                      className="flex items-start gap-4 cursor-pointer"
                    >
                      {/* Icon Box - Enhanced */}
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center shrink-0 transition-all ${isUnread
                        ? `${style.iconBg} ${style.text} shadow-lg shadow-current/10 border ${style.border}`
                        : 'bg-white/5 text-muted-foreground border border-border'
                        }`}>
                        {style.icon}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0 pr-8">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className={`text-sm font-black truncate pr-2 ${isUnread ? 'text-foreground' : 'text-muted-foreground'}`}>
                            {n.title}
                          </h4>
                        </div>

                        {/* Form Badge - Enhanced */}
                        {formDetails.showBadge && formDetails.formName && (
                          <div className="flex items-center gap-2 mb-2 flex-wrap">
                            <span className={`inline-flex items-center px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider bg-white/10 text-foreground border border-white/20 shadow-sm`}>
                              <Tag size={12} className="mr-1.5 opacity-70" />
                              {formDetails.formName}
                            </span>
                            {formDetails.customerName && (
                              <span className="text-[11px] text-muted-foreground font-bold truncate max-w-[200px] opacity-70">
                                {formDetails.customerName}
                              </span>
                            )}
                          </div>
                        )}

                        <p className={`text-sm leading-relaxed mb-4 line-clamp-2 ${isUnread ? 'text-muted-foreground' : 'text-muted-foreground/60'}`}>
                          {n.body}
                        </p>

                        <div className="flex items-center justify-between mt-auto pt-3 border-t border-white/5">
                          <span className="text-[10px] font-bold text-muted-foreground/60 flex items-center gap-2 uppercase tracking-widest">
                            <Clock size={12} className="opacity-50" />
                            {formatTime(n.createdAt)}
                          </span>

                          <span className={`text-[10px] uppercase font-black px-2 sm:px-3 py-1.5 rounded-lg border tracking-widest flex items-center gap-1.5 ${style.text} ${style.bg} ${style.border.split(' ').pop()}`}>
                            {(n as any).docStatus || style.label}
                            {isUnread && <ChevronRight size={12} className="opacity-50" />}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Footer - Enhanced */}
          <div className="p-4 sm:p-5 border-t border-border bg-white/[0.02] text-center shrink-0">
            <p className="text-[11px] text-muted-foreground font-bold flex items-center justify-center gap-2 uppercase tracking-widest opacity-60">
              <ExternalLink size={12} />
              Tap to view • Swipe to dismiss
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;