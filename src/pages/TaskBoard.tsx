import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList, User, Clock, CheckCircle, AlertCircle, Search, Filter,
  X, FileText, MessageSquare, DollarSign, Calendar, ChevronRight, Loader2,
  ExternalLink, Hash, Mail, Hourglass, Building, CreditCard, Briefcase,
  Users, Phone, MapPin, Contact, Banknote, Activity, UserX
} from 'lucide-react';
import { mockDbService, mockAuthService } from '../services/mockFirebase';
import { dbService } from '../services/dbService';
import { ServiceDocument, UserProfile, UserRole } from '../types';
import AssignTaskModal from '../components/AssignTaskModal';
import { triggerNotification } from '../services/NotificationService';

// ========================================================================
// 🔥 STATE MAPPING - Indian State Abbreviations to Full Names
// ========================================================================
const STATE_MAPPING: Record<string, string> = {
  'AP': 'Andhra Pradesh', 'AR': 'Arunachal Pradesh', 'AS': 'Assam',
  'BR': 'Bihar', 'CG': 'Chhattisgarh', 'GA': 'Goa', 'GJ': 'Gujarat',
  'HR': 'Haryana', 'HP': 'Himachal Pradesh', 'JH': 'Jharkhand',
  'KA': 'Karnataka', 'KL': 'Kerala', 'MP': 'Madhya Pradesh',
  'MH': 'Maharashtra', 'MN': 'Manipur', 'ML': 'Meghalaya',
  'MZ': 'Mizoram', 'NL': 'Nagaland', 'OD': 'Odisha', 'PB': 'Punjab',
  'RJ': 'Rajasthan', 'SK': 'Sikkim', 'TN': 'Tamil Nadu',
  'TS': 'Telangana', 'TR': 'Tripura', 'UP': 'Uttar Pradesh',
  'UK': 'Uttarakhand', 'WB': 'West Bengal', 'DL': 'Delhi',
  'JK': 'Jammu and Kashmir', 'LA': 'Ladakh', 'PY': 'Puducherry',
  'CH': 'Chandigarh', 'DN': 'Dadra and Nagar Haveli',
  'DD': 'Daman and Diu', 'LD': 'Lakshadweep', 'AN': 'Andaman and Nicobar Islands'
};

// All application collections from your rules
const APPLICATION_COLLECTIONS = [
  'applications',
  'msme-applications',
  'pan-applications',
  'gst-applications',
  'gst-proprietorship-applications',
  'gst-shop-retail-applications',
  'fssai-applications',
  'startup-applications',
  'trademark-applications',
  'dsc-applications',
  'company-registrations',
  'company-applications',
  'dir3kyc-applications',
  'dir-3-kyc-applications',
  'inc20a-applications',
  'inc-22a-applications',
  'adt1-applications',
  'adt-1-applications',
  'roc-compliance-applications',
  'rocSubmissions',
  'aoc4-applications',
  'mgt7a-applications',
  'roc-standard-packages',
  'roc-premium-packages'
];

// ========================================================================
// 🔥 HELPER FUNCTIONS
// ========================================================================
const parseDate = (dateData: any) => {
  if (!dateData) return new Date();
  if (dateData.toDate && typeof dateData.toDate === 'function') {
    return dateData.toDate();
  }
  if (typeof dateData === 'number') return new Date(dateData);
  return new Date(dateData);
};

const formatDate = (dateData: any) => {
  const date = parseDate(dateData);
  return date.toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
};

const formatFieldName = (key: string) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
};

const formatStateValue = (key: string, value: any): any => {
  if (!value || typeof value !== 'string') return value;
  const keyLower = key.toLowerCase().replace(/\s+/g, '');
  const upperValue = value.toUpperCase().trim();
  if (keyLower.includes('state')) {
    return STATE_MAPPING[upperValue] || value;
  }
  return value;
};

// Fixed renderField with key prop
const renderField = (label: string, value: any, icon?: React.ReactNode) => {
  if (value === undefined || value === null || value === '') return null;
  const displayValue = formatStateValue(label, value);
  return (
    <div key={label} className="flex items-start gap-2 text-sm">
      {icon}
      <span className="text-muted-foreground">{label}:</span>
      <span className="text-foreground font-medium">{String(displayValue)}</span>
    </div>
  );
};

// ========================================================================
// 🔥 DYNAMIC FIELD RENDERER - Shows ALL form fields (Nothing Skipped)
// ========================================================================
const renderAllFormFields = (formData: any) => {
  if (!formData) return <p className="text-muted-foreground">No form data available</p>;

  const fields = Object.entries(formData);
  if (fields.length === 0) {
    return <p className="text-muted-foreground">No form data available</p>;
  }

  // Fields to skip (internal/metadata only)
  const skipFields = ['userId', 'submittedAt', 'status', 'createdAt', 'updatedAt', 'folderId', 'paymentId', 'signatureUrl', 'uploadedFiles', 'digitalSignature', 'directors', 'partners'];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {fields.map(([key, value]) => {
        if (skipFields.includes(key)) return null;
        if (value === undefined || value === null || value === '') return null;

        // Handle nested objects
        if (typeof value === 'object' && !Array.isArray(value)) {
          return (
            <div key={key} className="col-span-full p-3 bg-secondary/50 rounded-lg border border-border">
              <label className="text-[10px] text-orange-400 uppercase font-bold mb-2">
                {formatFieldName(key)}
              </label>
              <div className="text-sm text-muted-foreground space-y-1">
                {Object.entries(value).map(([subKey, subValue]) => {
                  const formattedSubValue = formatStateValue(subKey, subValue);
                  return (
                    <div key={subKey} className="flex justify-between">
                      <span className="text-muted-foreground">{formatFieldName(subKey)}: </span>
                      <span className="text-foreground font-medium">{String(formattedSubValue)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // Handle arrays
        if (Array.isArray(value)) {
          if (value.length === 0) return null;
          return (
            <div key={key} className="col-span-full p-3 bg-secondary/50 rounded-lg border border-border">
              <label className="text-[10px] text-orange-400 uppercase font-bold mb-2">
                {formatFieldName(key)} ({value.length} items)
              </label>
              <div className="space-y-3">
                {value.map((item: any, idx: number) => (
                  <div key={`${key}-${idx}`} className="text-sm text-muted-foreground pl-3 border-l-2 border-cyan-500/30">
                    {typeof item === 'object'
                      ? Object.entries(item).map(([k, v], subIdx) => {
                        const formattedValue = formatStateValue(k, v);
                        return (
                          <div key={`${k}-${idx}-${subIdx}`} className="flex justify-between py-0.5">
                            <span className="text-muted-foreground">{formatFieldName(k)}: </span>
                            <span className="text-foreground">{String(formattedValue)}</span>
                          </div>
                        );
                      })
                      : String(item)
                    }
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Regular fields - Apply state mapping
        const displayValue = formatStateValue(key, value);
        return renderField(formatFieldName(key), displayValue);
      })}
    </div>
  );
};

interface TaskBoardProps {
  user: UserProfile;
}

const TaskBoard: React.FC<TaskBoardProps> = ({ user }) => {
  const navigate = useNavigate();
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(user);
  const [documents, setDocuments] = useState<ServiceDocument[]>([]);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [filter, setFilter] = useState<'unassigned' | 'assigned'>('unassigned');
  const [serviceFilter, setServiceFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals State
  const [selectedDocForAssign, setSelectedDocForAssign] = useState<ServiceDocument | null>(null);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);

  // Detail View State
  const [selectedDocForView, setSelectedDocForView] = useState<ServiceDocument | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    setLoading(true);
    try {
      // USERS
      const allUsersList = await mockDbService.getAllUsers();
      setAllUsers(allUsersList);

      // FETCH FROM ALL COLLECTIONS
      const allDocs = await dbService.getAllApplications();


      setDocuments(allDocs);
    } catch (error) {
      console.error("Failed to fetch tasks", error);
    } finally {
      setLoading(false);
    }
  };

  const getCustomerName = (userId?: string) => {
    if (!userId) return 'Unknown Client';
    const user = allUsers.find(u => u.uid === userId);
    if (user?.displayName) return user.displayName;
    return userId.substring(0, 8) + '...';
  };

  const getCustomerEmail = (doc: ServiceDocument) => {
    const user = allUsers.find(u => u.uid === doc.userId);
    if (user?.email) return user.email;
    const fd = doc.formData || {};
    return fd.email || fd.promoterEmail || 'No email provided';
  };

  // ===================== ✅ FILTER CONFIG =====================
  const serviceFilters = [''] as const;

  const getAvailableFilters = () => {
    if (currentUser?.role === UserRole.SUPERADMIN || currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.SUPPORT) {
      return ['unassigned', 'assigned'];
    }
    return [];
  };

  const availableFilters = getAvailableFilters();

  // ===================== ✅ DEFAULT FILTER LOGIC =====================
  useEffect(() => {
    if (currentUser) {
      const filters = getAvailableFilters();
      if (filters.length > 0 && !filters.includes(filter)) {
        // Default to the first available filter for the role
        setFilter(filters[0] as any);
      }
    }
  }, [currentUser]);

  // ===================== ✅ FILTERING LOGIC =====================
  const filteredDocs = documents.filter(doc => {
    const currentStatus = (doc.taskStatus || doc.status || 'unassigned').toLowerCase();
    const isAssigned = !!doc.assignedTo && doc.assignedTo !== "";
    const docType = doc.type?.toLowerCase() || 'general';

    // 🔐 SECURITY: CUSTOMER has NO access
    if (currentUser?.role === UserRole.CUSTOMER) return false;

    // 🔐 SECURITY: Support can ONLY see tasks assigned to them OR unassigned (if allowed)
    if (currentUser?.role === UserRole.SUPPORT) {
      // Option 1: Support sees ONLY their own tasks always
      if (doc.assignedTo !== currentUser.uid) {
        return false;
      }
    }

    // TAB FILTERS
    if (filter === 'unassigned') {
      if (isAssigned) return false;
    }

    if (filter === 'assigned') {
      if (!isAssigned || currentStatus === 'completed') return false;
    }

    // Service Base Filter
    if (serviceFilter !== 'all') {
      if (doc.type !== serviceFilter) {
        return false;
      }
    }



    // Search Filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      const titleMatch = doc.title?.toLowerCase().includes(term);
      const nameMatch = getCustomerName(doc.userId).toLowerCase().includes(term);
      const emailMatch = getCustomerEmail(doc).toLowerCase().includes(term);
      if (!titleMatch && !nameMatch && !emailMatch) return false;
    }

    return true;
  });

  const handleAssignClick = (e: React.MouseEvent, doc: ServiceDocument) => {
    e.stopPropagation();
    setSelectedDocForAssign(doc);
    setIsAssignModalOpen(true);
  };

  const handleCardClick = (doc: ServiceDocument) => {
    setSelectedDocForView(doc);
    setIsDetailModalOpen(true);
  };

  const handleAssignmentSuccess = async () => {
    // Preserve the doc before clearing state
    const assignedDoc = selectedDocForAssign;
    setIsAssignModalOpen(false);
    setSelectedDocForAssign(null);

    // Refresh data
    await fetchInitialData();

    if (assignedDoc && assignedDoc.assignedTo) {
      await triggerNotification('TASK_ASSIGNED', {
        supportUserId: assignedDoc.assignedTo,
        assignedBy: currentUser?.displayName || 'Admin',
        formTitle: assignedDoc.title,
        serviceId: assignedDoc.id
      });
    }
  };

  const handleStatusUpdate = async (newStatus: string) => {
    if (!selectedDocForView || !currentUser) return;
    setUpdatingStatus(true);
    try {
      await mockDbService.updateDocumentStatus(selectedDocForView.id, selectedDocForView.userId, newStatus);
      await triggerNotification('STATUS_CHANGED', {
        customerId: selectedDocForView.userId,
        newStatus: newStatus,
        formTitle: selectedDocForView.title,
        updatedBy: currentUser.displayName || 'Staff'
      });
      fetchInitialData();
      setSelectedDocForView(prev => prev ? { ...prev, status: newStatus as any } : null);
    } catch (err) {
      alert("Failed to update status");
      console.error(err);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status || 'unassigned';
    const styles: any = {
      completed: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      'in-progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      assigned: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20',
      unassigned: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      approved: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      processing: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      rejected: 'bg-red-500/10 text-red-400 border-red-500/20',
      submitted: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
      paid: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
    };
    return <span className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border ${styles[s] || styles.submitted}`}>{s}</span>;
  };

  if (loading) return (
    <div className="p-8 text-center text-muted-foreground min-h-screen bg-background flex flex-col items-center justify-center relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
      <div className="relative z-10">
        <Loader2 size={40} className="text-orange-500 animate-spin mx-auto mb-4" />
        <p>Loading Task Board...</p>
      </div>
    </div>
  );

  if (currentUser?.role === UserRole.CUSTOMER) {
    return (
      <div className="p-8 text-center text-muted-foreground min-h-screen bg-background flex flex-col items-center justify-center relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        <div className="relative z-10">
          <AlertCircle size={60} className="text-red-500 mx-auto mb-6 opacity-80" />
          <h2 className="text-3xl font-black text-foreground mb-3 tracking-tight">Access Restricted</h2>
          <p className="text-muted-foreground font-medium">Your current role does not have permission to access the Operations Task Board.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 animate-fade-in pb-20 relative max-w-[1600px] mx-auto bg-background text-foreground min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-orange-500/10 border border-orange-500/20 shadow-lg shadow-orange-500/5">
              <ClipboardList className="text-orange-500 w-6 h-6" />
            </div>
            <h1 className="text-3xl md:text-4xl font-black text-foreground tracking-tight">Task Board</h1>
          </div>
          <p className="text-muted-foreground text-base font-medium">Manage, assign, and monitor service requests across the ecosystem.</p>
        </div>

        {/* Dynamic Filters based on Role */}
        <div className="flex gap-1.5 overflow-x-auto w-full md:w-auto bg-card/40 p-1.5 rounded-2xl border border-border backdrop-blur-xl shadow-2xl">
          {availableFilters.map((f: string) => {
            const label = f === 'my-tasks' ? 'My Tasks' :
              f === 'unassigned' ? 'Unassigned' :
                f === 'assigned' ? 'Assigned' :
                  f.toUpperCase();
            const isActive = filter === f;
            return (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`px-5 py-2.5 rounded-xl text-xs font-black tracking-widest uppercase transition-all whitespace-nowrap ${isActive
                  ? 'bg-orange-500 text-white shadow-xl shadow-orange-500/30'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Actions */}
      <div className="flex flex-col md:flex-row gap-4 mb-10">
        <div className="relative flex-1 group">
          <div className="absolute inset-0 bg-orange-500/5 blur-3xl rounded-full opacity-0 group-focus-within:opacity-100 transition-opacity duration-700"></div>
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-muted-foreground group-focus-within:text-orange-500 transition-colors" size={20} />
          <input
            type="text"
            placeholder="Search by service, client, or identification code..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-secondary border border-border rounded-[1.5rem] pl-16 pr-6 py-5 text-foreground focus:outline-none focus:border-orange-500/50 focus:ring-4 focus:ring-orange-500/5 transition-all placeholder:text-muted-foreground text-base font-medium backdrop-blur-md"
          />
        </div>

        {/* Service Type Filter Dropdown */}
        <div className="relative min-w-[250px]">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Filter size={18} className="text-orange-500" />
          </div>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="w-full h-full min-h-[64px] bg-secondary border border-border rounded-[1.5rem] pl-14 pr-10 text-foreground focus:outline-none focus:border-orange-500/50 transition-all appearance-none cursor-pointer backdrop-blur-md font-bold text-sm tracking-wide uppercase"
          >
            <option value="all" className="bg-background text-foreground">ALL SERVICES</option>
            {Array.from(new Set(documents.map(d => d.type || 'general'))).sort().map(type => {
              const nameMap: Record<string, string> = {
                fssai: 'FSSAI', gst: 'GST', trademark: 'Trademark', msme: 'MSME', pan: 'PAN Card',
                dsc: 'DSC', 'shop-establishment': 'Shop & Establishment', startup: 'Startup India',
                legal: 'Legal Drafts', general: 'General Service', dir3kyc: 'DIR-3 KYC',
                inc20a: 'INC-20A', adt1: 'ADT-1', roc: 'ROC Compliance',
                aoc4: 'AOC-4', inc22a: 'INC-22A', mgt7a: 'MGT-7/7A',
                company_registration: 'Company Registration', 
                roc_standard: 'ROC - Standard Package',
                roc_premium: 'ROC - Premium Package'
              };
              const label = nameMap[type] || type.replace(/_/g, ' ').toUpperCase();
              return (
                <option key={type} value={type} className="bg-background text-foreground">
                  {label}
                </option>
              );
            })}
          </select>
          <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none">
            <ChevronRight size={16} className="text-muted-foreground rotate-90" />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {filteredDocs.length === 0 ? (
          <div className="col-span-full py-32 flex flex-col items-center justify-center">
            <div className="w-24 h-24 bg-secondary rounded-full flex items-center justify-center mb-6 border border-border text-muted-foreground">
              <ClipboardList size={40} strokeWidth={1} />
            </div>
            <p className="text-muted-foreground text-xl font-medium max-w-sm text-center leading-relaxed">
              {filter === 'unassigned' ? "Zero unassigned operations found. Everything is currently in progress." :
                filter === 'assigned' ? "No active assignments matching this criteria." :
                  filter === 'my-tasks' ? "Your queue is currently empty. Enjoy the peace!" :
                    "No records found matching your current refinement parameters."}
            </p>
          </div>
        ) : (
          filteredDocs.map((doc, i) => {
            const currentStatus = doc.taskStatus || 'unassigned';
            const isAssigned = !!doc.assignedTo;
            const custName = getCustomerName(doc.userId);
            const custEmail = getCustomerEmail(doc);

            return (
              <div
                key={`${doc.id}-${i}`}
                onClick={() => handleCardClick(doc)}
                className="group relative bg-card border border-border rounded-[2rem] p-7 hover:border-orange-500/30 transition-all duration-500 cursor-pointer overflow-hidden flex flex-col shadow-2xl hover:shadow-orange-500/10 hover:-translate-y-1"
              >
                {/* Decorative Elements */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-orange-500/5 to-transparent rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>

                <div className="relative z-10 flex-1 flex flex-col">
                  {/* Card Header */}
                  <div className="flex justify-between items-start gap-4 mb-6">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="text-[10px] font-black text-orange-500 uppercase tracking-widest">{doc.type || 'Service Request'}</span>
                        <div className="w-1 h-1 rounded-full bg-gray-700"></div>
                        <span className="text-[10px] font-bold text-muted-foreground font-mono tracking-tighter">#{(doc as any).trackingId || doc.id || 'N/A'}</span>
                      </div>
                      <h3 className="font-black text-foreground text-xl tracking-tight leading-tight group-hover:text-orange-400 transition-colors truncate">{doc.title}</h3>
                    </div>
                    {getStatusBadge(currentStatus)}
                  </div>

                  {/* Customer Information Section */}
                  <div className="mb-6 p-4 rounded-2xl bg-secondary/50 border border-border group-hover:bg-secondary transition-colors">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-foreground font-black text-sm shadow-inner overflow-hidden">
                        {custName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-foreground font-bold text-sm truncate">{custName}</p>
                        <p className="text-muted-foreground text-[10px] font-bold tracking-wide truncate">{custEmail}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground font-medium">
                      <Clock size={12} className="text-orange-500/60" />
                      <span>Received {formatDate(doc.submittedAt)}</span>
                    </div>
                  </div>

                  {/* Operational Status */}
                  <div className="mt-auto pt-6 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {isAssigned ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                          <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Active</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
                          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shadow-[0_0_8px_rgba(245,158,11,0.5)]"></div>
                          <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Pending</span>
                        </div>
                      )}
                    </div>

                    {!isAssigned && !!currentUser && (
                      <button
                        onClick={(e) => handleAssignClick(e, doc)}
                        className="bg-primary hover:bg-orange-500 hover:text-white text-primary-foreground px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl hover:shadow-orange-500/20 transform active:scale-95"
                      >
                        Assign
                      </button>
                    )}

                    {isAssigned && (
                      <div className="flex -space-x-2">
                        <div className="w-7 h-7 rounded-full bg-blue-500 border-2 border-background flex items-center justify-center text-[10px] font-black text-white shadow-lg">
                          OP
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Assign Modal */}
      {isAssignModalOpen && selectedDocForAssign && (
        <AssignTaskModal
          doc={selectedDocForAssign}
          onClose={() => setIsAssignModalOpen(false)}
          onAssignSuccess={handleAssignmentSuccess}
          currentUser={currentUser!}
        />
      )}

      {/* Task Detail Modal - Redesigned for Maximum Impact */}
      {isDetailModalOpen && selectedDocForView && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-background/80 backdrop-blur-xl animate-fade-in"
          onClick={() => setIsDetailModalOpen(false)}
        >
          <div
            className="bg-card rounded-[2.5rem] w-full max-w-6xl max-h-[92vh] border border-border shadow-2xl flex flex-col overflow-hidden relative z-10 animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            {/* Modal Ambient Glow */}
            <div className="absolute top-0 left-1/4 w-1/2 h-64 bg-orange-500/5 blur-[120px] rounded-full pointer-events-none"></div>

            {/* Modal Header */}
            <div className="px-10 py-8 border-b border-border bg-secondary/40 backdrop-blur-md flex justify-between items-start shrink-0 sticky top-0 z-10">
              <div>
                <div className="flex flex-wrap items-center gap-4 mb-3">
                  <h2 className="text-4xl font-black text-foreground tracking-tighter">
                    {selectedDocForView.title}
                  </h2>
                  <div className="px-4 py-1.5 rounded-full bg-secondary text-[11px] font-black text-muted-foreground border border-border flex items-center gap-2">
                    <Hash size={12} className="text-orange-500" />
                    <span className="tracking-widest uppercase">ID: {(selectedDocForView as any).trackingId || selectedDocForView.id}</span>
                  </div>
                </div>
                <div className="flex items-center gap-8 text-sm font-bold text-muted-foreground">
                  <span className="flex items-center gap-2 uppercase tracking-widest text-[10px]">
                    <Calendar size={14} className="text-orange-500" /> Received: {formatDate(selectedDocForView.submittedAt)}
                  </span>
                  <span className="flex items-center gap-2 uppercase tracking-widest text-[10px]">
                    <DollarSign size={14} className="text-emerald-500" /> Value: ₹{selectedDocForView.amount?.toLocaleString() || 0}
                  </span>
                </div>
              </div>
              <button onClick={() => setIsDetailModalOpen(false)} className="p-4 bg-secondary hover:bg-muted rounded-2xl text-muted-foreground hover:text-foreground transition-all border border-border group active:scale-90">
                <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                {/* Information Column */}
                <div className="lg:col-span-8 space-y-10">
                  {/* Client Snapshot Card */}
                  <div className="p-8 rounded-[2rem] bg-secondary/30 border border-border shadow-inner">
                    <h4 className="text-[11px] font-black text-orange-500 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                      <div className="w-5 h-5 rounded bg-orange-500/20 flex items-center justify-center">
                        <User size={12} />
                      </div>
                      Client Information Snapshot
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                      <div className="group/info">
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 transition-colors group-hover/info:text-foreground">Legal Name of Applicant</p>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center text-xl font-black text-foreground border border-border">
                            {getCustomerName(selectedDocForView.userId).charAt(0)}
                          </div>
                          <p className="text-xl font-black text-foreground tracking-tight">{getCustomerName(selectedDocForView.userId)}</p>
                        </div>
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2">Primary Digital Contact</p>
                        <div className="p-4 rounded-2xl bg-secondary/40 border border-border flex items-center gap-4">
                          <div className="w-10 h-10 rounded-xl bg-cyan-500/10 flex items-center justify-center text-cyan-400 border border-cyan-500/20">
                            <Mail size={18} />
                          </div>
                          <p className="text-sm font-bold text-foreground truncate">{getCustomerEmail(selectedDocForView)}</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Core Application Grid */}
                  <div className="space-y-6">
                    <div className="flex items-center justify-between px-2">
                      <h4 className="text-xl font-black text-foreground flex items-center gap-3 tracking-tight">
                        <FileText size={24} className="text-orange-500" />
                        Application Specifications
                      </h4>
                      <span className="px-3 py-1 bg-secondary rounded-full text-[10px] font-black text-muted-foreground uppercase tracking-widest border border-border">
                        {Object.keys(selectedDocForView.formData || {}).filter(k =>
                          !['userId', 'submittedAt', 'status', 'createdAt', 'updatedAt', 'folderId', 'paymentId', 'signatureUrl', 'uploadedFiles', 'digitalSignature', 'directors', 'partners'].includes(k)
                          && selectedDocForView.formData?.[k]
                        ).length} Attributes Total
                      </span>
                    </div>

                    <div className="p-8 rounded-[2.5rem] bg-secondary/40 border border-border shadow-2xl">
                      {renderAllFormFields(selectedDocForView.formData)}
                    </div>
                  </div>
                </div>

                {/* Operations Column */}
                <div className="lg:col-span-4 space-y-8">
                  {/* Status Hub */}
                  <div className="p-8 rounded-[2rem] bg-card border border-border shadow-2xl">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6">Workflow Status</h3>

                    <div className="flex flex-col gap-6">
                      <div className="flex items-center gap-4">
                        <div className={`w-4 h-4 rounded-full shadow-[0_0_12px_rgba(245,158,11,0.5)] animate-pulse ${selectedDocForView.status === 'approved' ? 'bg-emerald-500' :
                          selectedDocForView.status === 'rejected' ? 'bg-red-500' : 'bg-orange-500'
                          }`}></div>
                        <span className={`text-2xl font-black tracking-tighter uppercase ${selectedDocForView.status === 'approved' ? 'text-emerald-400' :
                            selectedDocForView.status === 'rejected' ? 'text-red-400' : 'text-orange-400'
                          }`}>
                          {selectedDocForView.status?.toUpperCase()}
                        </span>
                      </div>

                      {!!currentUser && (
                        <div className="space-y-4 pt-4 border-t border-border">
                          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest ml-1">Override Status</label>
                          <div className="relative">
                            <select
                              value={selectedDocForView.status}
                              onChange={(e) => handleStatusUpdate(e.target.value)}
                              disabled={updatingStatus}
                              className="w-full bg-secondary border border-border rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-widest text-foreground appearance-none focus:border-orange-500 outline-none disabled:opacity-50 transition-all cursor-pointer shadow-inner"
                            >
                              <option value="submitted">SUBMITTED</option>
                              <option value="paid">PAYMENT CONFIRMED</option>
                              <option value="processing">IN PROCESSING</option>
                              <option value="approved">APPROVED</option>
                              <option value="rejected">REJECTED</option>
                            </select>
                            <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
                              <ChevronRight size={16} className="rotate-90" />
                            </div>
                          </div>
                          {updatingStatus && <div className="flex items-center justify-center gap-2 p-3 bg-orange-500/5 rounded-xl border border-orange-500/10">
                            <Loader2 size={16} className="text-orange-500 animate-spin" />
                            <span className="text-[11px] font-black text-orange-400 uppercase tracking-widest">Applying Changes...</span>
                          </div>}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Allocation Hub */}
                  <div className="p-8 rounded-[2rem] bg-gradient-to-br from-card to-background border border-border shadow-2xl">
                    <h3 className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.2em] mb-6">Execution Log</h3>

                    {selectedDocForView.assignedTo ? (
                      (() => {
                        const assignedStaff = allUsers.find(s => s.uid === selectedDocForView.assignedTo);
                        const staffName = assignedStaff ? assignedStaff.displayName : 'Unknown Member';
                        const staffInitials = assignedStaff ? assignedStaff.displayName.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2) : '??';
                        return (
                          <div className="space-y-6">
                            <div className="flex items-center gap-4 p-5 rounded-[1.5rem] bg-cyan-500/5 border border-cyan-500/10">
                              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-white font-black text-xl shadow-xl shadow-cyan-500/20">
                                {staffInitials}
                              </div>
                              <div className="min-w-0">
                                <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1">Assigned Agent</p>
                                <p className="text-xl font-black text-foreground tracking-tight truncate">{staffName}</p>
                              </div>
                            </div>
                            <div className="flex items-center justify-between px-2">
                              <p className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest">Timestamp</p>
                              <p className="text-[11px] text-foreground font-mono font-bold">{formatDate(selectedDocForView.assignedAt!)}</p>
                            </div>
                          </div>
                        );
                      })()
                    ) : (
                      <div className="text-center py-6">
                        <div className="w-20 h-20 bg-secondary rounded-full flex items-center justify-center mx-auto mb-6 border border-border text-muted-foreground">
                          <UserX size={32} strokeWidth={1} />
                        </div>
                        <p className="text-sm font-medium text-muted-foreground mb-8 max-w-[200px] mx-auto leading-relaxed">Identity is currently unallocated in the workflow.</p>
                        {!!currentUser && (
                          <button
                            onClick={() => {
                              setIsDetailModalOpen(false);
                              setSelectedDocForAssign(selectedDocForView);
                              setIsAssignModalOpen(true);
                            }}
                            className="w-full py-5 bg-primary hover:bg-orange-500 hover:text-white text-primary-foreground rounded-[1.5rem] text-[11px] font-black uppercase tracking-[0.2em] transition-all shadow-xl hover:shadow-orange-500/20 transform active:scale-95"
                          >
                            Assign Task
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TaskBoard;