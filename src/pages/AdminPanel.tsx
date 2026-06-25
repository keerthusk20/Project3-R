import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Activity,
  Briefcase,
  Calendar,
  CheckCircle,
  ClipboardList,
  CreditCard,
  FileText,
  Loader2,
  Mail,
  Phone,
  Search,
  Shield,
  Ticket,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import { collection, getDocs } from 'firebase/firestore';
import { UserProfile, UserRole, ServiceDocument } from '../types';
import { authService } from '../services/authService';
import { dbService } from '../services/dbService';
import { db } from '../services/firebase';
import { getAllExperts } from '../services/consultationService';

interface AdminPanelProps {
  user: UserProfile;
}

type InviteRole = UserRole.EXPERT | UserRole.SUPPORT;

type ExpertRow = {
  id: string;
  name?: string;
  email?: string;
  availabilityStatus?: string;
  isActive?: boolean;
  role?: string;
};

type TicketRow = {
  status?: string;
  priority?: string;
  assignedTo?: string | null;
  assignedToId?: string | null;
};

type InviteForm = {
  displayName: string;
  email: string;
  password: string;
  role: InviteRole;
};

type ToastState = {
  message: string;
  type: 'success' | 'error' | 'info';
} | null;

const normalize = (value: unknown) => String(value || '').trim().toLowerCase();
const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
const formatDate = (ts: number) =>
  new Date(ts).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const isSameDay = (value: number, compareTo = new Date()) => {
  const date = new Date(value);
  return (
    date.getFullYear() === compareTo.getFullYear() &&
    date.getMonth() === compareTo.getMonth() &&
    date.getDate() === compareTo.getDate()
  );
};

const isWithinDays = (value: number, days: number, compareTo = new Date()) => {
  const date = new Date(value);
  const diff = compareTo.getTime() - date.getTime();
  return diff >= 0 && diff <= days * 24 * 60 * 60 * 1000;
};

const AdminPanel: React.FC<AdminPanelProps> = ({ user: currentUser }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [experts, setExperts] = useState<ExpertRow[]>([]);
  const [applications, setApplications] = useState<ServiceDocument[]>([]);
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'customers' | 'experts' | 'support'>('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteForm, setInviteForm] = useState<InviteForm>({
    displayName: '',
    email: '',
    password: '',
    role: UserRole.SUPPORT,
  });
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const generateTempPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) password += chars.charAt(Math.floor(Math.random() * chars.length));
    return password;
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [allUsers, allApps, allExperts, ticketSnap] = await Promise.all([
          dbService.getAllUsers(),
          dbService.getAllApplications(),
          getAllExperts(),
          getDocs(collection(db, 'tickets')),
        ]);

        setUsersList(allUsers.filter((u) => [UserRole.CUSTOMER, UserRole.SUPPORT, UserRole.EXPERT].includes(u.role)));
        setApplications(allApps);
        setExperts(allExperts as ExpertRow[]);
        setTickets(ticketSnap.docs.map((doc) => doc.data() as TicketRow));
      } catch (error) {
        console.error(error);
        showToast('Failed to load admin data', 'error');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const metrics = useMemo(() => {
    const customers = usersList.filter((u) => u.role === UserRole.CUSTOMER);
    const supportStaff = usersList.filter((u) => u.role === UserRole.SUPPORT);
    const expertUsers = experts;

    const paidApps = applications.filter((app) => ['paid', 'success'].includes(normalize((app as any).paymentStatus)));
    const revenueOverview = paidApps.reduce((sum, app) => sum + Number(app.amount || 0), 0);

    const pendingCustomerRequests = applications.filter((app) => {
      const status = normalize(app.status);
      return ['submitted', 'pending', 'documents_pending', 'verification_pending', 'under_review'].includes(status);
    }).length;

    const serviceStatus = {
      submitted: applications.filter((app) => normalize(app.status) === 'submitted').length,
      documentsPending: applications.filter((app) => normalize(app.status) === 'documents_pending').length,
      verificationPending: applications.filter((app) => ['verification_pending', 'under_review'].includes(normalize(app.status))).length,
      inProgress: applications.filter((app) => ['processing', 'expert_processing', 'in-progress'].includes(normalize(app.status))).length,
      completed: applications.filter((app) => ['completed', 'approved'].includes(normalize(app.status))).length,
      rejected: applications.filter((app) => normalize(app.status) === 'rejected').length,
    };

    const assignments = {
      assigned: applications.filter((app) => !!app.assignedTo).length,
      unassigned: applications.filter((app) => !app.assignedTo).length,
    };

    const ticketsOpen = tickets.filter((ticket) => normalize(ticket.status) === 'open').length;
    const ticketsClosed = tickets.filter((ticket) => ['resolved', 'closed'].includes(normalize(ticket.status))).length;
    const busyExperts = expertUsers.filter((expert) => normalize(expert.availabilityStatus) === 'busy').length;

    return {
      totalCustomers: customers.length,
      activeCustomers: customers.filter((customer) => customer.status === 'active' || customer.status === 'accepted').length,
      pendingCustomerRequests,
      totalExperts: expertUsers.length,
      activeExperts: expertUsers.filter((expert) => expert.isActive !== false).length,
      availableExperts: expertUsers.filter((expert) => normalize(expert.availabilityStatus) === 'available').length,
      busyExperts,
      totalSupportStaff: supportStaff.length,
      activeSupportStaff: supportStaff.filter((staff) => staff.status === 'active').length,
      ticketsOpen,
      ticketsClosed,
      revenueOverview,
      recentRegistrations: customers.filter((customer) => isWithinDays(customer.createdAt, 7)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 5),
      serviceStatus,
      assignments,
    };
  }, [applications, experts, tickets, usersList]);

  const customerUsers = useMemo(() => usersList.filter((u) => u.role === UserRole.CUSTOMER), [usersList]);
  const expertUsers = useMemo(() => experts, [experts]);
  const supportUsers = useMemo(() => usersList.filter((u) => u.role === UserRole.SUPPORT), [usersList]);

  const filteredPeople = useMemo(() => {
    const sq = searchQuery.trim().toLowerCase();
    const source = activeTab === 'customers' ? customerUsers : activeTab === 'experts' ? expertUsers.map((e) => ({
      uid: e.id,
      displayName: e.name || 'Unnamed Expert',
      email: e.email || '',
      role: UserRole.EXPERT,
      status: e.isActive === false ? 'blocked' : 'active',
      createdAt: 0,
      provider: 'system',
      userId: e.id,
      isActive: e.isActive,
      availabilityStatus: e.availabilityStatus,
    } as any)) : activeTab === 'support' ? supportUsers : [];

    if (!sq) return source;
    return source.filter((item: any) => {
      return (
        (item.displayName || '').toLowerCase().includes(sq) ||
        (item.email || '').toLowerCase().includes(sq) ||
        (item.phoneNumber || '').toLowerCase().includes(sq)
      );
    });
  }, [activeTab, customerUsers, expertUsers, searchQuery, supportUsers]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteLoading(true);
    try {
      await authService.createInternalUser({
        email: inviteForm.email,
        password: inviteForm.password,
        displayName: inviteForm.displayName,
        role: inviteForm.role,
        invitedBy: currentUser.uid,
      });
      showToast(`Invitation sent to ${inviteForm.email}`, 'success');
      setInviteModalOpen(false);
      setInviteForm({ displayName: '', email: '', password: '', role: UserRole.SUPPORT });
    } catch (error: any) {
      showToast(error?.message || 'Failed to invite user', 'error');
    } finally {
      setInviteLoading(false);
    }
  };

  const toggleUserStatus = async (u: UserProfile) => {
    try {
      const nextStatus = u.status === 'blocked' ? 'active' : 'blocked';
      await dbService.updateUser(u.uid, { status: nextStatus as any });
      showToast(`User is now ${nextStatus}`, 'success');
      const allUsers = await dbService.getAllUsers();
      setUsersList(allUsers.filter((item) => [UserRole.CUSTOMER, UserRole.SUPPORT, UserRole.EXPERT].includes(item.role)));
    } catch (error) {
      showToast('Failed to update user status', 'error');
    }
  };

  const toggleExpertAvailability = async (expert: ExpertRow) => {
    try {
      const next = normalize(expert.availabilityStatus) === 'available' ? 'Busy' : 'Available';
      await dbService.updateUser(expert.id, { availabilityStatus: next as any, isActive: true });
      showToast(`Expert marked ${next}`, 'success');
      const latestExperts = await getAllExperts();
      setExperts(latestExperts as ExpertRow[]);
    } catch (error) {
      showToast('Failed to update expert availability', 'error');
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview' },
    { id: 'customers', label: 'Customers' },
    { id: 'experts', label: 'Experts' },
    { id: 'support', label: 'Support Team' },
  ] as const;

  return (
    <div className="p-6 md:p-10 animate-fade-in pb-20 relative max-w-[1600px] mx-auto bg-background text-foreground min-h-screen">
      {toast && (
        <div className="fixed top-24 right-8 z-50 animate-slide-in bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 backdrop-blur-xl">
          <CheckCircle size={20} /> <span className="text-sm font-semibold">{toast.message}</span>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/20 shadow-lg shadow-cyan-500/5">
              <Activity className="text-cyan-400" size={24} />
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gradient-heading tracking-tight">Admin Dashboard</h2>
          </div>
          <p className="text-muted-foreground text-base font-medium max-w-xl">
            Operational business view for customers, experts, support staff, service requests, tickets, assignments, and revenue.
          </p>
        </div>

        <button
          onClick={() => setInviteModalOpen(true)}
          className="bg-primary hover:opacity-90 text-primary-foreground font-bold py-3 px-8 rounded-xl flex items-center gap-3 transition-all shadow-xl hover:shadow-cyan-500/30 transform hover:-translate-y-0.5 border border-primary/20"
        >
          <UserPlus className="w-5 h-5" />
          <span>Invite Expert / Support</span>
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border ${activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' : 'bg-secondary/50 text-muted-foreground border-transparent hover:bg-secondary'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-cyan-400" size={32} /></div>
      ) : activeTab === 'overview' ? (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Customers', value: metrics.totalCustomers, icon: <Users className="text-cyan-400" /> },
              { label: 'Active Customers', value: metrics.activeCustomers, icon: <TrendingUp className="text-emerald-400" /> },
              { label: 'Pending Customer Requests', value: metrics.pendingCustomerRequests, icon: <ClipboardList className="text-amber-400" /> },
              { label: 'Total Experts', value: metrics.totalExperts, icon: <Briefcase className="text-blue-400" /> },
              { label: 'Active Experts', value: metrics.activeExperts, icon: <Shield className="text-emerald-400" /> },
              { label: 'Available Experts', value: metrics.availableExperts, icon: <Activity className="text-cyan-400" /> },
              { label: 'Busy Experts', value: metrics.busyExperts, icon: <Activity className="text-orange-400" /> },
              { label: 'Total Support Staff', value: metrics.totalSupportStaff, icon: <Users className="text-purple-400" /> },
              { label: 'Active Support Staff', value: metrics.activeSupportStaff, icon: <TrendingUp className="text-emerald-400" /> },
              { label: 'Open Support Tickets', value: metrics.ticketsOpen, icon: <Ticket className="text-rose-400" /> },
              { label: 'Closed Support Tickets', value: metrics.ticketsClosed, icon: <CheckCircle className="text-emerald-400" /> },
              { label: 'Revenue Overview', value: formatCurrency(metrics.revenueOverview), icon: <CreditCard className="text-cyan-400" /> },
            ].map((card) => (
              <div key={card.label} className="bg-card border border-border rounded-2xl p-5 shadow-lg">
                <div className="flex justify-between items-start mb-3">
                  <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">{card.icon}</div>
                  <span className="text-2xl font-black text-foreground">{card.value}</span>
                </div>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{card.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><ClipboardList className="text-cyan-400" size={18}/> Service Request Status</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-secondary/40 p-4"><p className="text-muted-foreground text-xs">Submitted</p><p className="text-2xl font-black">{metrics.serviceStatus.submitted}</p></div>
                <div className="rounded-xl bg-secondary/40 p-4"><p className="text-muted-foreground text-xs">Documents Pending</p><p className="text-2xl font-black">{metrics.serviceStatus.documentsPending}</p></div>
                <div className="rounded-xl bg-secondary/40 p-4"><p className="text-muted-foreground text-xs">Verification Pending</p><p className="text-2xl font-black">{metrics.serviceStatus.verificationPending}</p></div>
                <div className="rounded-xl bg-secondary/40 p-4"><p className="text-muted-foreground text-xs">In Progress</p><p className="text-2xl font-black">{metrics.serviceStatus.inProgress}</p></div>
                <div className="rounded-xl bg-secondary/40 p-4"><p className="text-muted-foreground text-xs">Completed</p><p className="text-2xl font-black">{metrics.serviceStatus.completed}</p></div>
                <div className="rounded-xl bg-secondary/40 p-4"><p className="text-muted-foreground text-xs">Rejected</p><p className="text-2xl font-black">{metrics.serviceStatus.rejected}</p></div>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2"><Briefcase className="text-purple-400" size={18}/> Expert Assignment Status</h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-xl bg-secondary/40 p-4"><p className="text-muted-foreground text-xs">Assigned</p><p className="text-2xl font-black">{metrics.assignments.assigned}</p></div>
                <div className="rounded-xl bg-secondary/40 p-4"><p className="text-muted-foreground text-xs">Unassigned</p><p className="text-2xl font-black">{metrics.assignments.unassigned}</p></div>
              </div>
              <h4 className="text-sm font-bold text-muted-foreground uppercase tracking-wider mt-6 mb-3">Recent Registrations</h4>
              <div className="space-y-2">
                {metrics.recentRegistrations.length > 0 ? metrics.recentRegistrations.map((customer) => (
                  <div key={customer.uid} className="flex items-center justify-between rounded-xl bg-secondary/30 px-4 py-3">
                    <div>
                      <p className="font-semibold text-foreground text-sm">{customer.displayName || 'Unnamed Customer'}</p>
                      <p className="text-xs text-muted-foreground">{customer.email}</p>
                    </div>
                    <span className="text-xs text-cyan-300">{formatDate(customer.createdAt)}</span>
                  </div>
                )) : <p className="text-sm text-muted-foreground">No recent registrations.</p>}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-3">
            <Search size={16} className="text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={`Search ${activeTab}...`}
              className="w-full bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
            />
          </div>

          {activeTab === 'customers' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              <div className="grid grid-cols-12 px-5 py-4 text-xs uppercase tracking-[0.16em] text-muted-foreground border-b border-border bg-background/30">
                <div className="col-span-4">Customer</div>
                <div className="col-span-3">Contact</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Applications</div>
                <div className="col-span-1 text-right">Action</div>
              </div>
              {filteredPeople.map((u: any) => {
                const uApps = applications.filter((app) => app.userId === u.uid);
                const isBlocked = u.status === 'blocked';
                return (
                  <div key={u.uid} className="grid grid-cols-12 px-5 py-4 border-b border-border/60 items-center hover:bg-background/30 transition-colors">
                    <div className="col-span-4 min-w-0">
                      <p className="font-semibold text-foreground truncate">{u.displayName || 'Unnamed Customer'}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.customerId || u.userId || u.uid}</p>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <p className="text-sm text-foreground truncate">{u.email || 'No email'}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.phoneNumber || 'No phone number'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] border ${isBlocked ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
                        {isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </div>
                    <div className="col-span-2 text-sm text-foreground">{uApps.length}</div>
                    <div className="col-span-1 text-right">
                      <button onClick={() => toggleUserStatus(u)} className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm font-semibold">Toggle</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'experts' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              <div className="grid grid-cols-12 px-5 py-4 text-xs uppercase tracking-[0.16em] text-muted-foreground border-b border-border bg-background/30">
                <div className="col-span-4">Expert</div>
                <div className="col-span-3">Contact</div>
                <div className="col-span-2">Availability</div>
                <div className="col-span-2">Active</div>
                <div className="col-span-1 text-right">Action</div>
              </div>
              {filteredPeople.map((e: any) => (
                <div key={e.uid} className="grid grid-cols-12 px-5 py-4 border-b border-border/60 items-center hover:bg-background/30 transition-colors">
                  <div className="col-span-4 min-w-0">
                    <p className="font-semibold text-foreground truncate">{e.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">{e.userId || e.uid}</p>
                  </div>
                  <div className="col-span-3 min-w-0">
                    <p className="text-sm text-foreground truncate">{e.email || 'No email'}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] border text-cyan-400 bg-cyan-500/10 border-cyan-500/20">
                      {e.availabilityStatus || 'Offline'}
                    </span>
                  </div>
                  <div className="col-span-2">
                    <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] border ${e.isActive !== false ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' : 'text-rose-400 bg-rose-500/10 border-rose-500/20'}`}>
                      {e.isActive !== false ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <div className="col-span-1 text-right">
                    <button onClick={() => toggleExpertAvailability(e)} className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm font-semibold">Toggle</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'support' && (
            <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-lg">
              <div className="grid grid-cols-12 px-5 py-4 text-xs uppercase tracking-[0.16em] text-muted-foreground border-b border-border bg-background/30">
                <div className="col-span-4">Support Staff</div>
                <div className="col-span-3">Contact</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Applications</div>
                <div className="col-span-1 text-right">Action</div>
              </div>
              {filteredPeople.map((u: any) => {
                const uApps = applications.filter((app) => app.assignedBy === u.uid || app.assignedTo === u.uid);
                const isBlocked = u.status === 'blocked';
                return (
                  <div key={u.uid} className="grid grid-cols-12 px-5 py-4 border-b border-border/60 items-center hover:bg-background/30 transition-colors">
                    <div className="col-span-4 min-w-0">
                      <p className="font-semibold text-foreground truncate">{u.displayName || 'Unnamed Staff'}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.userId || u.uid}</p>
                    </div>
                    <div className="col-span-3 min-w-0">
                      <p className="text-sm text-foreground truncate">{u.email || 'No email'}</p>
                      <p className="text-xs text-muted-foreground truncate">{u.phoneNumber || 'No phone number'}</p>
                    </div>
                    <div className="col-span-2">
                      <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.14em] border ${isBlocked ? 'text-rose-400 bg-rose-500/10 border-rose-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'}`}>
                        {isBlocked ? 'Blocked' : 'Active'}
                      </span>
                    </div>
                    <div className="col-span-2 text-sm text-foreground">{uApps.length}</div>
                    <div className="col-span-1 text-right">
                      <button onClick={() => toggleUserStatus(u)} className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-sm font-semibold">Toggle</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold flex items-center gap-2 text-cyan-400"><UserPlus size={20} /> Invite New User</h2>
              <button onClick={() => setInviteModalOpen(false)} className="text-muted-foreground hover:text-rose-400"><X size={24} /></button>
            </div>
            <form onSubmit={handleInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Full Name</label>
                <input required type="text" value={inviteForm.displayName} onChange={(e) => setInviteForm({ ...inviteForm, displayName: e.target.value })} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-sm focus:border-cyan-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Email</label>
                  <input required type="email" value={inviteForm.email} onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-sm focus:border-cyan-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Password</label>
                  <div className="flex gap-2">
                    <input required type="text" value={inviteForm.password} onChange={(e) => setInviteForm({ ...inviteForm, password: e.target.value })} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-sm focus:border-cyan-500 outline-none" />
                    <button type="button" onClick={() => setInviteForm({ ...inviteForm, password: generateTempPassword() })} className="px-3 rounded-xl bg-secondary border border-border text-xs font-bold">Gen</button>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Role</label>
                <select required value={inviteForm.role} onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value as InviteRole })} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-sm focus:border-cyan-500 outline-none">
                  <option value={UserRole.EXPERT}>Expert</option>
                  <option value={UserRole.SUPPORT}>Support</option>
                </select>
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setInviteModalOpen(false)} className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                <button type="submit" disabled={inviteLoading} className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl shadow-lg disabled:opacity-50">{inviteLoading ? 'Sending...' : 'Send Invitation'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;
