import React, { useState, useEffect } from 'react';
import {
  Mail,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  X,
  ChevronRight,
  Search,
  Inbox,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, updateDoc, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { UserProfile } from '../types';
import { mockAuthService } from '../services/mockFirebase';
// 👇 1. IMPORT THE NOTIFICATION SERVICE
import { triggerNotification } from '../services/NotificationService';

// --- Types ---

type RequestStatus = 'Assigned' | 'In Progress' | 'Completed' | 'Admin';

interface SupportRequest {
  id: string;
  customerName: string;
  customerEmail: string;
  customerId?: string; // Needed for notifications

  // Added fields to fix TS errors from various collections
  userId?: string;
  mobile?: string;
  topic?: string;
  time?: string; // For bookings
  submittedAt?: any; // Firestore timestamp or string
  businessName?: string;
  fullName?: string;
  userEmail?: string;
  title?: string;
  serviceType?: string;
  uploadedFileUrls?: any;
  taskStatus?: string;
  trackingId?: string;

  issueType: string;
  status: RequestStatus;
  date: string;
  applications: string[];
  description?: string;
  sourceCollection?: string;
  rawStatus?: string;
}

// --- Helper Functions ---

// Safely format dates from Firestore Timestamps or strings
const formatDate = (dateVal: any): string => {
  if (!dateVal) return 'N/A';

  // If it's already a string
  if (typeof dateVal === 'string') {
    return dateVal.split('T')[0]; // Return YYYY-MM-DD
  }

  // If it's a Firestore Timestamp object
  if (typeof dateVal === 'object' && dateVal.toDate) {
    return dateVal.toDate().toISOString().split('T')[0];
  }

  // Fallback for other number/date formats
  try {
    return new Date(dateVal).toISOString().split('T')[0];
  } catch (e) {
    return 'Invalid Date';
  }
};

// --- Sub-Components ---

// 1. Status Badge Component
const StatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
  const styles = {
    'Assigned': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Admin': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };

  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles['Assigned']}`}>
      {status}
    </span>
  );
};

const getStoredStatus = (status: RequestStatus) => {
  switch (status) {
    case 'Completed':
      return 'approved';
    case 'In Progress':
      return 'processing';
    case 'Admin':
      return 'review';
    case 'Assigned':
    default:
      return 'assigned';
  }
};

const getStoredTaskStatus = (status: RequestStatus) => {
  switch (status) {
    case 'Completed':
      return 'completed';
    case 'In Progress':
      return 'processing';
    case 'Admin':
      return 'review';
    case 'Assigned':
    default:
      return 'assigned';
  }
};

// 2. Stat Card Component
interface StatCardProps {
  title: string;
  count: number;
  icon: React.ReactNode;
  colorClass: string;
  isActive: boolean;
  onClick: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, count, icon, colorClass, isActive, onClick }) => (
  <div
    onClick={onClick}
    className={`
      relative overflow-hidden rounded-2xl p-6 border transition-all duration-300 cursor-pointer group
      ${isActive
        ? 'bg-white/10 border-white/20 shadow-lg shadow-cyan-900/20 scale-[1.02]'
        : 'bg-card/40 border-white/5 hover:bg-secondary/60 hover:border-white/10'}
    `}
  >
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white">{count}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-background border border-white/5 ${colorClass} group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
    </div>
    <div className={`absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
  </div>
);

// 3. Customer Sidebar Component
interface SidebarProps {
  request: SupportRequest | null;
  onClose: () => void;
  onStatusChange?: (id: string, newStatus: RequestStatus) => void;
}

const CustomerSidebar: React.FC<SidebarProps> = ({ request, onClose, onStatusChange }) => {
  if (!request) return null;

  const handleEmailClick = () => {
    window.location.href = `mailto:${request.customerEmail}?subject=Regarding your request ${request.id}&body=Hello ${request.customerName},%0D%0A%0D%0AWe are following up on your request: ${request.issueType}.%0D%0A%0D%0ABest regards,%0D%0ASupport Team`;
  };

  const handleLocalStatusChange = (newStatus: RequestStatus) => {
    if (onStatusChange && request.id) {
      onStatusChange(request.id, newStatus);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 transition-opacity animate-fade-in"
        onClick={onClose}
      />

      {/* Slide-over Panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-white/10 z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col">

        {/* Header */}
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-card/50">
          <div>
            <h2 className="text-xl font-bold text-white">Customer Details</h2>
            <p className="text-xs text-slate-400 mt-1">Request ID: {request.id}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

          {/* Status Action Box */}
          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Update Status</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Assigned', 'In Progress', 'Completed', 'Admin'] as RequestStatus[]).map((s) => (
                <button
                  key={s}
                  onClick={() => handleLocalStatusChange(s)}
                  className={`text-xs py-2 px-2 rounded border transition-all ${request.status === s
                      ? 'bg-cyan-600 border-cyan-500 text-white font-bold'
                      : 'bg-card border-white/10 text-slate-400 hover:border-white/30'
                    }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Personal Info */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name</label>
              <p className="text-lg text-white font-medium mt-1">{request.customerName}</p>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label>
              <p className="text-lg text-white font-medium mt-1 break-all">{request.customerEmail}</p>
            </div>
            {request.mobile && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mobile</label>
                <p className="text-lg text-white font-medium mt-1">{request.mobile}</p>
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue Type</label>
              <div className="flex items-center gap-2 mt-1">
                <AlertCircle size={16} className="text-orange-400" />
                <p className="text-white">{request.issueType}</p>
              </div>
            </div>
            {request.description && (
              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Description</label>
                <p className="text-sm text-slate-300 mt-1 leading-relaxed bg-white/5 p-3 rounded-lg border border-white/5">
                  {request.description}
                </p>
              </div>
            )}
          </div>

          {/* Applications List */}
          <div>
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText size={16} className="text-cyan-400" />
              Submitted Applications
            </h3>
            {request.applications.length > 0 ? (
              <div className="space-y-2">
                {request.applications.map((app, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 rounded-lg bg-card border border-white/5 hover:border-cyan-500/30 transition-colors">
                    <div className="w-2 h-2 rounded-full bg-cyan-500" />
                    <span className="text-sm text-slate-200">{app}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-6 bg-white/5 rounded-lg border border-dashed border-white/10">
                <p className="text-sm text-slate-500">No applications found</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer Action */}
        <div className="p-6 border-t border-white/10 bg-card/50">
          <button
            onClick={handleEmailClick}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-cyan-900/20 active:scale-[0.98]"
          >
            <Mail size={18} />
            Send Email to Customer
          </button>
        </div>
      </div>
    </>
  );
};

// --- Main Dashboard Component ---

interface StaffDashboardProps {
  user: UserProfile;
}

const StaffDashboard: React.FC<StaffDashboardProps> = ({ user: initialUser }) => {
  const [filter, setFilter] = useState<RequestStatus | 'All'>('All');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialUser);
  const [updating, setUpdating] = useState(false);

  const navigate = useNavigate();

  // 1. Sync user prop & Data
  useEffect(() => {
    if (initialUser) {
      setCurrentUser(initialUser);
      fetchSupportRequests(initialUser.uid);
    }
  }, [initialUser]);

  // 2. Fetch Real Data from Firestore
  const fetchSupportRequests = async (userId: string) => {
    setLoading(true);
    try {
      const allRequests: SupportRequest[] = [];
      const collectionsToCheck = [
        'applications',
        'msme-applications',
        'pan-applications',
        'gst-applications',
        'gst-proprietorship-applications',
        'gst-shop-retail-applications',
        'fssai-applications',
        'trademark-applications',
        'startup-applications',
        'bookings'
      ];

      for (const colName of collectionsToCheck) {
        try {
          let q;
          if (colName === "bookings") {
            // 🔥 fetch ALL bookings
            q = query(collection(db, colName));
          } else {
            // existing logic for applications
            q = query(
              collection(db, colName),
              where("assignedTo", "==", userId)
            );
          }

          const snapshot = await getDocs(q);

          snapshot.forEach((docSnap) => {
            // FIX: Cast data to 'any' to allow accessing dynamic properties
            const data: any = docSnap.data();

            if (colName === "bookings") {
              allRequests.push({
                id: docSnap.id,
                customerId: data.userId,
                userId: data.userId,
                customerName: data.customerName || "Consultation User",
                customerEmail: data.email || data.userEmail || "No Email",
                mobile: data.mobile,
                topic: data.topic || "Consultation",
                issueType: data.topic || "Consultation",
                status: data.status === "confirmed" ? "Completed" : "Assigned",
                rawStatus: data.status,
                date: formatDate(data.date), // ✅ Safe formatting
                time: data.time ? `${data.time.time} ${data.time.period}` : undefined,
                applications: [],
                description: `Consultation at ${data.time?.time} (${data.time?.period})`,
                sourceCollection: "bookings"
              });

              return;
            }

            // Handle standard application collections
            const submittedAt = data.submittedAt?.toDate ? data.submittedAt.toDate() : new Date(data.submittedAt || Date.now());

            // 🔥 Hide individual sub-forms of packages
            if (data.packageCaseId) {
              return;
            }

            let uiStatus: RequestStatus = 'Assigned';
            const rawStatus = (data.status || data.taskStatus || 'submitted').toLowerCase();

            if (rawStatus === 'completed' || rawStatus === 'approved') {
              uiStatus = 'Completed';
            } else if (rawStatus === 'processing' || rawStatus === 'in-progress' || rawStatus === 'review') {
              uiStatus = 'In Progress';
            } else if (rawStatus === 'admin' || rawStatus === 'rejected') {
              uiStatus = 'Admin';
            } else {
              uiStatus = 'Assigned';
            }

            let cName = data.customerName || data.businessName || data.fullName || 'Unknown Customer';
            if (!cName || cName === 'Unknown Customer') {
              cName = `User (${data.userId?.substring(0, 6) || 'ID'}...)`;
            }

            allRequests.push({
              id: docSnap.id,
              customerId: data.userId || data.customerId, // Capture ID for notifications
              userId: data.userId,
              customerName: cName,
              businessName: data.businessName,
              fullName: data.fullName,
              customerEmail: data.userEmail || data.email || 'no-email@example.com',
              userEmail: data.userEmail,
              mobile: data.mobile,
              issueType: data.title || data.serviceType || colName.replace('-', ' '),
              title: data.title,
              serviceType: data.serviceType,
              trackingId: data.trackingId,
              status: uiStatus,
              taskStatus: data.taskStatus,
              rawStatus: rawStatus,
              date: formatDate(submittedAt), // ✅ Safe formatting
              submittedAt: submittedAt,
              applications: data.uploadedFileUrls ? Object.keys(data.uploadedFileUrls) : [],
              uploadedFileUrls: data.uploadedFileUrls,
              description: data.description || `Status: ${rawStatus}`,
              sourceCollection: colName
            });
          });
        } catch (err) {
          console.warn(`Error fetching ${colName}:`, err);
        }
      }

      allRequests.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setRequests(allRequests);
    } catch (error) {
      console.error("Failed to fetch support requests:", error);
    } finally {
      setLoading(false);
    }
  };

  // 3. Handle Status Change with NOTIFICATION TRIGGER
  const handleStatusUpdate = async (reqId: string, newStatus: RequestStatus) => {
    if (!currentUser) return;

    const req = requests.find(r => r.id === reqId);
    if (!req) return;

    setUpdating(true);
    try {
      const storedStatus = getStoredStatus(newStatus);
      const storedTaskStatus = getStoredTaskStatus(newStatus);
      const sourceCollection = req.sourceCollection || 'applications';

      // 1. Update Firestore with normalized backend values. UI labels stay local-only.
      const collectionRef = doc(db, req.sourceCollection || 'applications', reqId);
      await updateDoc(collectionRef, {
        status: storedStatus,
        taskStatus: storedTaskStatus,
        statusLabel: newStatus,
        statusUpdatedAt: serverTimestamp(),
        statusHistory: arrayUnion({
          status: storedStatus,
          taskStatus: storedTaskStatus,
          statusLabel: newStatus,
          updatedAt: new Date().toISOString(),
          updatedBy: currentUser.uid,
          updatedByName: currentUser.displayName || 'Support Team'
        }),
        updatedAt: Date.now()
      });

      if (req.customerId || req.userId) {
        try {
          await updateDoc(doc(db, 'users', req.customerId || req.userId!, 'documents', reqId), {
            status: storedStatus,
            taskStatus: storedTaskStatus,
            statusLabel: newStatus,
            statusUpdatedAt: serverTimestamp(),
            updatedAt: Date.now(),
            sourceCollection
          });
        } catch (mirrorError) {
          console.warn('Customer document mirror status update skipped:', mirrorError);
        }
      }

      // 2. TRIGGER NOTIFICATIONS. Notification failures should not undo the status update.
      if (req.customerId) {
        try {
          await triggerNotification('STATUS_CHANGED', {
            customerId: req.customerId,
            newStatus: newStatus,
            formTitle: req.issueType,
            updatedBy: currentUser.displayName || 'Support Team'
          });
        } catch (notificationError) {
          console.warn('Status notification failed after update:', notificationError);
        }
      }

      // 3. Update Local State
      setRequests(prev => prev.map(r =>
        r.id === reqId ? { ...r, status: newStatus, rawStatus: storedStatus, taskStatus: storedTaskStatus } : r
      ));

      // Update sidebar if open
      if (selectedRequest && selectedRequest.id === reqId) {
        setSelectedRequest({ ...selectedRequest, status: newStatus, rawStatus: storedStatus, taskStatus: storedTaskStatus });
      }

      alert(`Status updated to ${newStatus}. Notifications sent.`);

    } catch (error: any) {
      console.error("Error updating status:", error);
      alert(`Failed to update status: ${error?.message || 'Please check your permissions and try again.'}`);
    } finally {
      setUpdating(false);
    }
  };

  // Filter Logic
  const filteredRequests = requests.filter(req => {
    const matchesFilter = filter === 'All' || req.status === filter;
    const matchesSearch = req.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.issueType.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const counts = {
    All: requests.length,
    Assigned: requests.filter(r => r.status === 'Assigned').length,
    'In Progress': requests.filter(r => r.status === 'In Progress').length,
    Completed: requests.filter(r => r.status === 'Completed').length,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        <div className="flex flex-col items-center gap-4 relative z-10">
          <Loader2 className="animate-spin text-cyan-500" size={40} />
          <p className="text-cyan-400 animate-pulse">Loading Support Requests...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 min-h-screen bg-background text-slate-200 font-sans selection:bg-cyan-500/30 relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header Section */}
      <div className="mb-8 flex justify-between items-end">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Support Overview</h1>
          <p className="text-slate-400">Live dashboard for assigned tasks and customer requests.</p>
        </div>
        <button onClick={() => currentUser && fetchSupportRequests(currentUser.uid)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-slate-400 hover:text-white">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Assigned Requests"
          count={counts.Assigned}
          icon={<Inbox size={24} className="text-cyan-400" />}
          colorClass="text-cyan-400"
          isActive={filter === 'Assigned'}
          onClick={() => setFilter(filter === 'Assigned' ? 'All' : 'Assigned')}
        />
        <StatCard
          title="In Progress"
          count={counts['In Progress']}
          icon={<Clock size={24} className="text-blue-400" />}
          colorClass="text-blue-400"
          isActive={filter === 'In Progress'}
          onClick={() => setFilter(filter === 'In Progress' ? 'All' : 'In Progress')}
        />
        <StatCard
          title="Completed"
          count={counts.Completed}
          icon={<CheckCircle size={24} className="text-emerald-400" />}
          colorClass="text-emerald-400"
          isActive={filter === 'Completed'}
          onClick={() => setFilter(filter === 'Completed' ? 'All' : 'Completed')}
        />
      </div>

      {/* Controls Bar */}
      <div className="flex flex-col md:flex-row justify-between items-center gap-4 mb-6">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0">
          {(['All', 'Assigned', 'In Progress', 'Completed'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all ${filter === status
                  ? 'bg-white/10 text-white border border-white/20'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search customer, ID, or issue..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-card border border-white/10 rounded-lg pl-10 pr-4 py-2 text-sm text-white focus:outline-none focus:border-cyan-500/50 transition-colors"
          />
        </div>
      </div>

      {/* Requests Table */}
      <div className="bg-card/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.02]">
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Request ID</th>
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Customer</th>
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Issue</th>
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</th>
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">Date</th>
                <th className="p-4 text-xs font-semibold text-slate-400 uppercase tracking-wider text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredRequests.length > 0 ? (
                filteredRequests.map((req) => (
                  <tr
                    key={req.id}
                    onClick={() => setSelectedRequest(req)}
                    className="group hover:bg-white/[0.03] cursor-pointer transition-colors"
                  >
                    <td className="p-4 text-sm font-mono text-cyan-400/80 group-hover:text-cyan-300">
                      {req.trackingId || `${req.id.substring(0, 8)}...`}
                    </td>
                    <td className="p-4">
                      <div className="text-sm font-medium text-white">{req.customerName}</div>
                      <div className="text-xs text-slate-500">{req.customerEmail}</div>
                    </td>
                    <td className="p-4 text-sm text-slate-300">{req.issueType}</td>
                    <td className="p-4">
                      <StatusBadge status={req.status} />
                    </td>
                    <td className="p-4 text-sm text-slate-400">
                      {/* ✅ Safe Date Rendering */}
                      {formatDate(req.date)}
                    </td>
                    <td className="p-4 text-right">
                      <ChevronRight size={16} className="inline-block text-slate-600 group-hover:text-white transition-colors" />
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-500">
                    <div className="flex flex-col items-center gap-2">
                      <Inbox size={32} className="opacity-20" />
                      <p>No requests found matching your filters.</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Slide-over Sidebar with Status Controls */}
      <CustomerSidebar
        request={selectedRequest}
        onClose={() => setSelectedRequest(null)}
        onStatusChange={handleStatusUpdate}
      />

      {updating && (
        <div className="fixed bottom-6 right-6 bg-cyan-600 text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 z-50 animate-fade-in">
          <Loader2 size={18} className="animate-spin" />
          <span className="text-sm font-medium">Updating status & sending notifications...</span>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;