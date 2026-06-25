import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Phone, Mail, FileText, CreditCard,
  CheckCircle, AlertCircle, ChevronRight, Activity,
  Plus, X, Briefcase, LayoutDashboard, Calendar, Shield,
  Eye, Loader2, Bell, TrendingUp, Users, DollarSign, BarChart3,
  MapPin, Hash, Building, BadgeCheck, Gift, Award, Clock, ExternalLink,
  MessageSquare, Copy
} from 'lucide-react';
import { UserProfile, ServiceDocument, UserRole, Notification } from '../types';
import { db } from '../services/firebase';
import {
  collection, query, where, getDocs, orderBy, doc, updateDoc,
  addDoc, onSnapshot, Timestamp
} from 'firebase/firestore';
import {
  formatDate,
  formatFieldKey,
  formatFieldValue,
  getGroupedFormData,
  formatCurrency
} from '../utils/helpers';

interface CustomerDetailPageProps {
  staffUser: UserProfile;
}

type Section = 'overview' | 'communication' | 'services';
type ViewMode = 'list' | 'detail';

// Extended type for safe optional field access (without modifying base types)
type CustomerWithOptionalFields = UserProfile & Record<string, any>;

const CustomerDetailPage: React.FC<CustomerDetailPageProps> = ({ staffUser }) => {
  const { uid } = useParams<{ uid: string }>();
  const navigate = useNavigate();

  // Navigation State
  const [activeSection, setActiveSection] = useState<Section>('overview');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [selectedService, setSelectedService] = useState<any | null>(null);

  // Data State
  const [customer, setCustomer] = useState<UserProfile | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // UI Feedback State
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Computed Stats
  const [stats, setStats] = useState({ revenue: 0, activeRequests: 0, totalApps: 0 });

  // Function to fetch all applications for a user
  const fetchAllApplications = async (userId: string) => {
    let allApps: any[] = [];
    const collectionsToCheck = [
      "applications",
      "pan-applications",
      "msme-applications",
      "gst-applications",
      "gst-proprietorship-applications",
      "gst-shop-retail-applications",
      "fssai-applications"
    ];
    for (const colName of collectionsToCheck) {
      try {
        const q = query(
          collection(db, colName),
          where("userId", "==", userId),
          orderBy("submittedAt", "desc")
        );
        const snap = await getDocs(q);
        snap.forEach(docSnap => {
          const data = docSnap.data();

          // 🔥 Hide sub-documents that are part of a package
          if (data.packageCaseId) {
            return;
          }

          allApps.push({
            id: docSnap.id,
            sourceCollection: colName,
            type: colName.replace('-applications', ''),
            title: data.title || colName.replace('-', ' ').toUpperCase(),
            ...data,
            submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().getTime() : data.submittedAt,
          });
        });
      } catch (e) {
        console.log(`No data in ${colName} or index missing`);
      }
    }
    allApps.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
    return allApps;
  };

  useEffect(() => {
    if (!uid) return;
    const fetchData = async () => {
      try {
        setLoading(true);
        // 1. Fetch Customer Profile
        const userSnap = await getDocs(collection(db, "users"));
        const foundCustomer = userSnap.docs.find(d => d.id === uid);
        if (foundCustomer) {
          setCustomer({ uid: foundCustomer.id, ...foundCustomer.data() } as UserProfile);
        } else {
          showToast("Customer not found", 'error');
          setLoading(false);
          return;
        }
        // 2. Fetch ALL applications initially
        const allApps = await fetchAllApplications(uid);
        setApplications(allApps);
        calculateStats(allApps);
        // 3. Set up real-time listeners for each collection
        const collectionsToListen = [
          "applications",
          "pan-applications",
          "msme-applications",
          "gst-applications",
          "gst-proprietorship-applications",
          "gst-shop-retail-applications",
          "fssai-applications"
        ];
        const unsubscribers = collectionsToListen.map(colName => {
          const q = query(
            collection(db, colName),
            where("userId", "==", uid),
            orderBy("submittedAt", "desc")
          );
          return onSnapshot(q, (snapshot) => {
            setApplications(prevApps => {
              const appMap = new Map(
                prevApps.filter(app => app.sourceCollection !== colName).map(app => [app.id, app])
              );
              snapshot.forEach(docSnap => {
                const data = docSnap.data();

                // 🔥 Hide sub-documents that are part of a package
                if (data.packageCaseId) {
                  return;
                }

                const appData = {
                  id: docSnap.id,
                  sourceCollection: colName,
                  type: colName.replace('-applications', ''),
                  title: data.title || colName.replace('-', ' ').toUpperCase(),
                  ...data,
                  submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().getTime() : data.submittedAt,
                };
                appMap.set(appData.id, appData);
              });
              const newApps = Array.from(appMap.values()).sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));
              calculateStats(newApps);
              return newApps;
            });
          });
        });
        setLoading(false);
        return () => {
          unsubscribers.forEach(unsub => unsub());
        };
      } catch (e) {
        console.error("Failed to load customer data", e);
        showToast("Failed to load customer data", 'error');
        setLoading(false);
      }
    };
    fetchData();
  }, [uid]);

  const calculateStats = (apps: any[]) => {
    const revenue = apps.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const active = apps.filter(a => ['submitted', 'processing', 'paid', 'approved'].includes(a.status || '')).length;
    setStats({
      revenue,
      activeRequests: active,
      totalApps: apps.length
    });
  };

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleCopyToClipboard = async (text: string, fieldKey: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldKey);
      showToast('Copied to clipboard', 'success');
      setTimeout(() => setCopiedField(null), 2000);
    } catch (err) {
      showToast('Failed to copy', 'error');
    }
  };

  const handleStatusUpdate = async (docId: string, newStatus: string) => {
    if (!uid || !selectedService || !customer) return;
    setUpdatingStatus(docId);
    try {
      const collectionName = selectedService.sourceCollection || 'applications';
      await updateDoc(doc(db, collectionName, docId), {
        status: newStatus,
        lastUpdated: Timestamp.now()
      });
      const notificationData: Omit<Notification, 'id'> = {
        userId: uid,
        title: `Application Status Updated`,
        body: `Your ${selectedService.title} application has been marked as ${newStatus.toUpperCase()}.`,
        type: 'document',
        read: false,
        createdAt: Date.now(),
        redirectUrl: `/documents?id=${docId}`,
        serviceId: docId
      };
      await addDoc(collection(db, "notifications"), notificationData);
      setApplications(prev => prev.map(app =>
        app.id === docId ? { ...app, status: newStatus, lastUpdated: Date.now() } : app
      ));
      setSelectedService(prev => prev ? { ...prev, status: newStatus, lastUpdated: Date.now() } : null);
      showToast(`Status updated to ${newStatus} & Notification sent!`, 'success');
    } catch (e) {
      console.error(e);
      showToast("Failed to update status", 'error');
    } finally {
      setUpdatingStatus(null);
    }
  };

  const handleStartChat = () => {
    if (!uid) return;
    // ✅ Pass both uid AND displayName for auto-select
    navigate(`/chat?chatWith=${uid}&name=${encodeURIComponent(c.displayName || '')}`);
  };

  const navigateToSection = (section: Section) => {
    setActiveSection(section);
    setViewMode('list');
    setSelectedService(null);
  };

  const openServiceDetail = (service: any) => {
    setActiveSection('services');
    setSelectedService(service);
    setViewMode('detail');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBackToSection = () => {
    setViewMode('list');
    setSelectedService(null);
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles: Record<string, string> = {
      approved: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-500/20',
      completed: 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white border-emerald-500/20',
      processing: 'bg-gradient-primary text-white border-cyan-500/20',
      paid: 'bg-gradient-primary text-white border-cyan-500/20',
      rejected: 'bg-gradient-to-r from-red-600 to-rose-700 text-white border-red-500/20',
      submitted: 'bg-gradient-to-r from-heading-from to-heading-to text-white border-orange-500/20',
      pending: 'bg-gradient-to-r from-heading-from to-heading-to text-white border-orange-500/20',
      invited: 'bg-gradient-to-r from-gray-600 to-gray-700 text-white border-gray-500/20',
      active: 'bg-gradient-to-r from-emerald-700 to-teal-700 text-white border-emerald-700/20',
      blocked: 'bg-gradient-to-r from-red-800 to-rose-900 text-white border-red-500/20',
    };
    const style = styles[status] || styles.pending;
    return (
      <span className={`px-3 py-2 rounded-full text-[10px] font-bold uppercase tracking-wider border shadow-lg ${style}`}>
        {status}
      </span>
    );
  };

  // Reusable Field Display Component with Copy Button
  const FormField = ({ fieldKey, value }: { fieldKey: string; value: any }) => {
    const isSensitive = ['aadhaarNumber', 'panNumber', 'password', 'otp'].includes(fieldKey);
    const displayValue = formatFieldValue(value, { key: fieldKey });
    const showCopy = !isSensitive && displayValue !== '—' && displayValue.length > 0;
    return (
      <div className="group relative">
        <label className="text-[10px] bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1.5 flex items-center gap-1">
          {formatFieldKey(fieldKey)}
          {isSensitive && <Shield size={10} className="text-orange-500" />}
        </label>
        <div className="flex items-start gap-2">
        <div className="flex-1 text-sm text-foreground font-medium break-words bg-secondary px-3 py-2.5 rounded-lg border border-border group-hover:border-cyan-400/50 transition-colors">
            {displayValue}
          </div>
          {showCopy && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleCopyToClipboard(String(value), fieldKey);
              }}
            className="p-2 hover:bg-muted rounded-lg text-muted-foreground hover:text-foreground transition-all shrink-0"
              title="Copy value"
            >
              {copiedField === fieldKey ? (
                <CheckCircle size={14} className="text-emerald-500" />
              ) : (
                <Copy size={14} />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (loading || !customer) {
    return (
      <div className="h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 animate-pulse">
          <Loader2 size={40} className="text-orange-500 animate-spin" />
        <p className="text-muted-foreground">Loading Customer Data...</p>
        </div>
      </div>
    );
  }

  // ✅ Type-safe customer access with optional fields
  const c = customer as CustomerWithOptionalFields;
  return (
    <div className="min-h-screen bg-background text-foreground font-sans overflow-x-hidden">
      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-[100] px-4 py-3 rounded-lg shadow-2xl border flex items-center gap-3 animate-slide-in backdrop-blur-md ${toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500' : 'bg-red-500/10 border-red-500/30 text-red-500'
          }`}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          <span className="text-sm font-medium">{toast.msg}</span>
        </div>
      )}

      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/90 backdrop-blur-xl border-b border-border">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/')} className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
              <ArrowLeft size={20} />
            </button>
            <div className="flex flex-col">
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                <span className="hover:text-foreground cursor-pointer" onClick={() => navigate('/')}>Dashboard</span>
                <ChevronRight size={12} />
                <span className="bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent font-medium">Customer Profile</span>
              </div>
              <h1 className="text-xl font-bold text-foreground flex items-center gap-3">
                <span className="bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">{c.displayName}</span>
                <StatusBadge status={c.status || 'active'} />
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleStartChat}
              className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 group border border-primary/20"
            >
              <MessageSquare size={18} className="group-hover:scale-110 transition-transform" />
              <span className="hidden md:inline">Chat with Customer</span>
            </button>
            <div className="hidden md:flex items-center gap-3 px-4 py-2 bg-secondary rounded-xl border border-border">
              <div className="text-right">
                <p className="text-[10px] text-cyan-400 uppercase font-bold">Total Revenue</p>
                <p className="text-sm font-bold text-emerald-400 font-mono">{formatCurrency(stats.revenue)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="px-8 flex items-center gap-1 overflow-x-auto no-scrollbar border-b border-border">
          {[
            { id: 'overview', label: 'Overview', icon: LayoutDashboard },
            { id: 'services', label: `Applications (${stats.totalApps})`, icon: Briefcase },
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => navigateToSection(item.id as Section)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-all duration-200 whitespace-nowrap ${activeSection === item.id
                ? 'border-transparent bg-gradient-to-r from-heading-from to-heading-to text-white shadow-lg'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
            >
              <item.icon size={16} className={activeSection === item.id ? 'text-white' : 'text-muted-foreground'} />
              {item.label}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-3">
            {viewMode === 'detail' && (
              <button onClick={goBackToSection} className="flex items-center gap-2 bg-primary text-primary-foreground hover:bg-primary/90 border border-primary/20 text-xs px-4 py-2 rounded-lg transition-all shadow-lg shadow-primary/20">
                <ArrowLeft size={14} /> Back to List
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-8 max-w-[1600px] mx-auto">
        {/* --- OVERVIEW SECTION --- */}
        {activeSection === 'overview' && (
          <div className="space-y-8 animate-fade-in">
            {/* Top Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="p-6 rounded-2xl bg-card border border-border shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-gradient-to-r from-heading-from to-heading-to text-white shadow-lg shadow-red-900/30"><Users size={24} /></div>
                  <span className="text-xs text-cyan-400 font-mono">ID: {c.userId || c.uid}</span>
                </div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Role</p>
                <p className="text-lg font-bold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent capitalize">{c.role}</p>
              </div>
              <div className="p-6 rounded-2xl bg-card border border-border shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-gradient-primary text-white shadow-lg shadow-cyan-900/30"><CreditCard size={24} /></div>
                </div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Total Revenue</p>
                <p className="text-lg font-bold text-emerald-400 font-mono">{formatCurrency(stats.revenue)}</p>
              </div>
              <div className="p-6 rounded-2xl bg-card border border-border shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-gradient-primary text-white shadow-lg shadow-cyan-900/30"><Briefcase size={24} /></div>
                </div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Active Requests</p>
                <p className="text-lg font-bold text-cyan-400 font-mono">{stats.activeRequests}</p>
              </div>
              <div className="p-6 rounded-2xl bg-card border border-border shadow-lg">
                <div className="flex justify-between items-start mb-4">
                  <div className="p-3 rounded-xl bg-gradient-primary text-white shadow-lg shadow-cyan-900/30"><FileText size={24} /></div>
                </div>
                <p className="text-xs text-muted-foreground uppercase font-bold">Total Applications</p>
                <p className="text-lg font-bold text-cyan-400 font-mono">{stats.totalApps}</p>
              </div>
            </div>

            {/* Detailed Profile Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Personal Info */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                    <User className="bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent" size={20} />
                    <span className="bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">Personal Information</span>
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">Full Name</label>
                      <p className="text-sm text-foreground font-medium">{c.displayName || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">Email Address</label>
                      <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                        <Mail size={14} className="text-cyan-400" />
                        {c.email || 'N/A'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">Phone Number</label>
                      <div className="flex items-center gap-2 text-sm text-foreground font-medium">
                        <Phone size={14} className="text-cyan-400" />
                        {c.phoneNumber || 'Not provided'}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">Gender</label>
                      <p className="text-sm text-foreground font-medium capitalize">{c.gender || 'Not specified'}</p>
                    </div>
                    {c.dob && (
                      <div>
                        <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">Date of Birth</label>
                        <p className="text-sm text-foreground font-medium">{formatDate(c.dob)}</p>
                      </div>
                    )}
                    <div>
                      <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-2  ">Account Status</label>
                      <StatusBadge status={c.status || 'active'} />
                    </div>
                  </div>
                </div>

                {/* ✅ Business Info - Type-Safe with bracket notation */}
                {(c['company'] || c['businessType'] || c['gstNumber'] || c['msmeNumber']) && (
                  <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                    <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                      <Building className="bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent" size={20} />
                      <span className="bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">Business Information</span>
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {c['company'] && (
                        <div>
                          <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">Company Name</label>
                          <p className="text-sm text-foreground font-medium">{c['company']}</p>
                        </div>
                      )}
                      {c['businessType'] && (
                        <div>
                          <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">Business Type</label>
                          <p className="text-sm text-foreground font-medium capitalize">{c['businessType']}</p>
                        </div>
                      )}
                      {c['gstNumber'] && (
                        <div>
                          <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">GST Number</label>
                          <p className="text-sm text-foreground font-mono">{c['gstNumber']}</p>
                        </div>
                      )}
                      {c['msmeNumber'] && (
                        <div>
                          <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">MSME/Udyam No.</label>
                          <p className="text-sm text-foreground font-mono">{c['msmeNumber']}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Sidebar / Meta Info */}
              <div className="space-y-6">
                <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
                  <h3 className="text-lg font-bold text-foreground mb-6 flex items-center gap-2">
                    <Shield className="bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent" size={20} />
                    <span className="bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">Account Meta</span>
                  </h3>
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">Joined Date</label>
                      <p className="text-sm text-foreground font-mono">{formatDate(c.createdAt)}</p>
                    </div>
                    <div>
                      <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-1">Profile Completed</label>
                      <div className="flex items-center gap-2">
                        {c.profileCompleted ?
                          <CheckCircle size={16} className="text-emerald-500" /> :
                          <Clock size={16} className="text-amber-500" />
                        }
                        <span className="text-sm text-foreground">{c.profileCompleted ? 'Yes' : 'No'}</span>
                      </div>
                    </div>
                    {c.isExpert && (
                      <div className="mt-4 p-3 bg-secondary rounded-lg">
                        <div className="flex items-center gap-2 text-cyan-400">
                          <Award size={16} />
                          <span className="text-xs font-bold uppercase">Verified Expert</span>
                        </div>
                      </div>
                    )}
                    {/* ✅ Address - Type-Safe */}
                    {(c['address'] || c['city'] || c['state'] || c['pincode']) && (
                      <div className="mt-4 pt-4 border-t border-border">
                        <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase font-bold mb-2">Primary Address</label>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                          {[c['address'], c['city'], c['state'], c['pincode']]
                            .filter(Boolean)
                            .join(', ') || '—'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Activity Feed */}
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl">
              <div className="p-5 border-b border-border bg-secondary/50 flex justify-between items-center">
                <h3 className="font-bold text-foreground text-sm flex items-center gap-2">
                  <Activity size={16} className="bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent" />
                  <span className="bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">Recent Applications</span>
                </h3>
                <button onClick={() => navigateToSection('services')} className="text-xs bg-gradient-primary text-white px-3 py-1.5 rounded-lg font-medium hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 transition-all">View All</button>
              </div>
              <div className="p-2">
                {applications.slice(0, 5).map(app => (
                  <div key={app.id} className="p-4 hover:bg-muted rounded-xl transition-all cursor-pointer flex items-center justify-between group" onClick={() => openServiceDetail(app)}>
                    <div className="flex items-center gap-4">
                      <div className={`p-3 rounded-lg ${app.status === 'approved' || app.status === 'completed' ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white' : 'bg-gradient-primary text-white'}`}>
                        <FileText size={18} />
                      </div>
                      <div>
                        <p className="text-sm text-foreground font-medium group-hover:text-orange-400 transition-colors">{app.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{formatDate(app.submittedAt)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={app.status || 'pending'} />
                      <ChevronRight size={16} className="text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                  </div>
                ))}
                {applications.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">No applications found.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- SERVICES SECTION (ALL REQUESTS) --- */}
        {activeSection === 'services' && (
          <div className="h-full flex flex-col space-y-6">
            {viewMode === 'list' ? (
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xl flex-1">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-secondary text-muted-foreground text-xs uppercase tracking-wider">
                      <tr>
                        <th className="px-8 py-5 font-semibold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">Service Name</th>
                        <th className="px-8 py-5 font-semibold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">Reference ID</th>
                        <th className="px-8 py-5 font-semibold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">Submission Date</th>
                        <th className="px-8 py-5 font-semibold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">Amount</th>
                        <th className="px-8 py-5 font-semibold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">Status</th>
                        <th className="px-8 py-5 font-semibold text-right bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {applications.map(app => (
                        <tr key={app.id} onClick={() => openServiceDetail(app)} className="hover:bg-muted cursor-pointer transition-all group">
                          <td className="px-8 py-5 text-foreground font-medium group-hover:text-orange-400 transition-colors">{app.title}</td>
                          <td className="px-8 py-5 text-cyan-400 font-mono text-xs">{app.trackingId || app.serviceId || app.id}</td>
                          <td className="px-8 py-5 text-muted-foreground">{formatDate(app.submittedAt)}</td>
                          <td className="px-8 py-5 text-emerald-400 font-mono font-bold">{formatCurrency(app.amount)}</td>
                          <td className="px-8 py-5"><StatusBadge status={app.status || 'pending'} /></td>
                          <td className="px-8 py-5 text-right">
                            <button className="text-xs bg-gradient-primary hover:from-teal-600 hover:via-cyan-700 hover:to-blue-800 text-white font-medium flex items-center justify-end gap-1 px-3 py-1.5 rounded-lg transition-all group-hover:translate-x-1 shadow-lg shadow-cyan-900/20">
                              Manage <ChevronRight size={12} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {applications.length === 0 && (
                        <tr><td colSpan={6} className="px-8 py-12 text-center text-muted-foreground">No applications submitted by this customer.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : selectedService ? (
              <div className="max-w-6xl mx-auto w-full bg-card border border-border rounded-2xl overflow-hidden shadow-2xl animate-fade-in">
                {/* Detail Header */}
                <div className="p-8 border-b border-border bg-secondary/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                    <h2 className="text-2xl font-bold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent mb-2">{selectedService.title}</h2>
                    <div className="flex items-center gap-3">
                      <p className="text-xs text-cyan-400 font-mono bg-secondary px-3 py-1 rounded-lg border border-border">
                        {selectedService.trackingId || selectedService.serviceId || selectedService.id}
                      </p>
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar size={12} className="text-cyan-400" /> {formatDate(selectedService.submittedAt)}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-xs bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent font-bold uppercase">Update Status:</label>
                    <select
                      value={selectedService.status}
                      onChange={(e) => handleStatusUpdate(selectedService.id, e.target.value)}
                      disabled={updatingStatus === selectedService.id}
                      className="bg-secondary border border-border rounded-xl px-4 py-2.5 text-sm text-foreground font-bold focus:border-orange-500 outline-none cursor-pointer min-w-[150px] disabled:opacity-50 shadow-lg shadow-cyan-900/20"
                    >
                      <option value="submitted">Received</option>
                      <option value="paid">Paid</option>
                      <option value="processing">Processing</option>
                      <option value="approved">Approved</option>
                      <option value="rejected">Rejected</option>
                    </select>
                    {updatingStatus === selectedService.id && (
                      <Loader2 size={18} className="animate-spin text-orange-500" />
                    )}
                  </div>
                </div>

                <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-12">
                  {/* Left: Form Data (Grouped & Formatted) */}
                  <div className="lg:col-span-2 space-y-6">
                    <h3 className="text-xs font-bold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase tracking-wider flex items-center gap-2">
                      <FileText size={14} className="text-orange-500" /> Application Details
                    </h3>
                    {selectedService.formData && Object.keys(selectedService.formData).length > 0 ? (
                      <div className="space-y-6">
                        {Object.entries(getGroupedFormData(selectedService.formData)).map(([group, fields]) => (
                            <div key={group} className="bg-secondary/30 border border-border rounded-xl overflow-hidden">
                              <div className="px-5 py-3 bg-secondary/50 border-b border-border">
                              <h4 className="text-xs font-bold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase tracking-wider">{group}</h4>
                            </div>
                            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                              {fields.map(([key, value]) => (
                                <FormField key={key} fieldKey={key} value={value} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                        <div className="text-center py-12 bg-secondary/50 rounded-xl border border-dashed border-border">
                        <FileText size={32} className="mx-auto text-gray-600 mb-3" />
                          <p className="text-muted-foreground">No detailed form data available for this application.</p>
                      </div>
                    )}

                    {/* Files Section */}
                    {selectedService.uploadedFileUrls && Object.keys(selectedService.uploadedFileUrls).length > 0 && (
                      <div className="mt-8">
                        <h3 className="text-xs font-bold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase tracking-wider flex items-center gap-2 mb-4">
                          <FileText size={14} className="text-orange-500" /> Attached Documents
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {Object.entries(selectedService.uploadedFileUrls).map(([name, url]) => (
                            <a key={name} href={url as string} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border hover:bg-secondary transition-all group">
                              <div className="p-2 bg-gradient-to-r from-heading-from to-heading-to text-white rounded"><FileText size={16} /></div>
                              <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground font-medium truncate">{name}</p>
                                  <p className="text-[10px] text-muted-foreground">Click to view</p>
                              </div>
                                <ExternalLink size={14} className="text-muted-foreground group-hover:text-foreground" />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right: Payment & Meta */}
                  <div className="lg:col-span-1 space-y-6">
                      <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-center shadow-lg">
                      <p className="text-[10px] text-emerald-400/80 uppercase font-bold mb-1">Total Amount Paid</p>
                      <p className="text-3xl font-bold text-emerald-400 font-mono mb-2">{formatCurrency(selectedService.amount)}</p>
                      {selectedService.paymentId && (
                          <div className="flex items-center justify-center gap-1 text-[10px] text-muted-foreground font-mono">
                          <Hash size={10} />
                          <span className="break-all">{selectedService.paymentId}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopyToClipboard(selectedService.paymentId, 'paymentId');
                            }}
                              className="hover:text-foreground transition-colors"
                          >
                            {copiedField === 'paymentId' ? <CheckCircle size={10} className="text-emerald-500" /> : <Copy size={10} className="text-cyan-400" />}
                          </button>
                        </div>
                      )}
                    </div>

                      <div className="p-6 rounded-2xl bg-secondary/50 border border-border shadow-lg">
                      <h4 className="text-xs font-bold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase mb-4">Workflow Info</h4>
                      <div className="space-y-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Source</span>
                            <span className="text-foreground font-mono text-xs capitalize">{selectedService.type || selectedService.sourceCollection?.replace('-applications', '')}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Submitted</span>
                            <span className="text-foreground font-mono text-xs">{formatDate(selectedService.submittedAt)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Last Updated</span>
                            <span className="text-foreground font-mono text-xs">{formatDate(selectedService.lastUpdated || Date.now())}</span>
                        </div>
                        {selectedService.assignedTo && (
                          <div className="flex justify-between">
                              <span className="text-muted-foreground">Assigned To</span>
                              <span className="text-foreground font-mono text-xs">{selectedService.assignedTo}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Status</span>
                          <StatusBadge status={selectedService.status || 'pending'} />
                        </div>
                      </div>
                    </div>

                    {/* Quick Actions */}
                      <div className="p-6 rounded-2xl bg-secondary/50 border border-border shadow-lg">
                      <h4 className="text-xs font-bold bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent uppercase mb-4">Quick Actions</h4>
                      <div className="space-y-2">
                        <button
                          onClick={() => handleStartChat()}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-medium transition-all shadow-lg"
                        >
                          <MessageSquare size={14} /> Start Chat
                        </button>
                        <button
                          onClick={() => {
                            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(selectedService, null, 2));
                            const dlAnchor = document.createElement('a');
                            dlAnchor.setAttribute("href", dataStr);
                            dlAnchor.setAttribute("download", `${selectedService.title}-${selectedService.id}.json`);
                            dlAnchor.click();
                          }}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg text-xs font-medium transition-all shadow-lg"
                        >
                          <FileText size={14} /> Export Data
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        )}
      </main>
    </div>
  );
};

export default CustomerDetailPage;