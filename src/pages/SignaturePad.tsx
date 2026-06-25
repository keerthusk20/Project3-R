import React, { useEffect, useState } from 'react';
import {
  Trash,
  AlertTriangle,
  X,
  Shield,
  UserX,
  Edit2,
  CheckCircle,
  Loader2,
  Check,
  User,
  Users,
  FileText,
  Clock,
  Activity,
  Briefcase
} from 'lucide-react';
import { UserProfile, UserRole } from '../types';
import { dbService } from '../services/dbService';
import { authService } from '../services/authService';
// 👇 1. IMPORT THE NOTIFICATION SERVICE
import { triggerNotification } from '../services/NotificationService';

const AdminPanel: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [teamMembers, setTeamMembers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // ✅ Create User Modal States Only
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUserData, setNewUserData] = useState({
    displayName: '',
    email: '',
    password: '',
    role: UserRole.SUPPORT,
  });
  const [createUserLoading, setCreateUserLoading] = useState(false);
  const [createUserError, setCreateUserError] = useState('');
  const [createdCredentials, setCreatedCredentials] = useState<{ email: string, password: string } | null>(null);

  // Action States
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Delete Modal States
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToAction, setUserToAction] = useState<UserProfile | null>(null);
  const [isProcessingAction, setIsProcessingAction] = useState(false);

  // Helper
  const isSuperAdmin = currentUser?.role === UserRole.SUPERADMIN;

  // Metrics States
  const [userMetrics, setUserMetrics] = useState({
    customers: 0,
    admins: 0,
    support: 0,
    experts: 0,
    total: 0
  });

  const [serviceMetrics, setServiceMetrics] = useState({
    total: 0,
    submitted: 0,
    processing: 0,
    approved: 0,
    rejected: 0
  });
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = authService.subscribeToAuth((u) => {
      if (u) {
        setCurrentUser(u);
        fetchUsers();
      }
    });
    return () => unsubscribe();
  }, []);

  // Toast Timer
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => setToastMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const data = await dbService.getAllUsers();
      const nonCustomers = data.filter(u => u.role !== UserRole.CUSTOMER);
      setTeamMembers(nonCustomers);

      // calculate user metrics
      const uMetrics = { customers: 0, admins: 0, support: 0, experts: 0, total: data.length };
      data.forEach(u => {
        if (u.role === UserRole.CUSTOMER) uMetrics.customers++;
        if (u.role === UserRole.ADMIN) uMetrics.admins++;
        if (u.role === UserRole.SUPPORT) uMetrics.support++;
        if (u.role === UserRole.EXPERT) uMetrics.experts++;
      });
      setUserMetrics(uMetrics);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchServiceMetrics = async () => {
    setMetricsLoading(true);
    try {
      const apps = await dbService.getAllApplications();
      const sMetrics = { total: apps.length, submitted: 0, processing: 0, approved: 0, rejected: 0 };
      apps.forEach(app => {
        if (app.status === 'submitted') sMetrics.submitted++;
        if (app.status === 'processing') sMetrics.processing++;
        if (app.status === 'approved') sMetrics.approved++;
        if (app.status === 'rejected') sMetrics.rejected++;
      });
      setServiceMetrics(sMetrics);
    } catch (e) {
      console.error("Failed to fetch service metrics", e);
    } finally {
      setMetricsLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) {
      fetchServiceMetrics();
    }
  }, [isSuperAdmin]);

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    if (!isSuperAdmin) return;
    try {
      await dbService.updateUserRole(uid, newRole);
      fetchUsers();
    } catch (e) {
      console.error("Role update failed", e);
      alert("Failed to update role");
    }
  };

  // Generate temporary password
  const generateTempPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  // Auto-fill password
  const autoFillPassword = () => {
    setNewUserData({ ...newUserData, password: generateTempPassword() });
  };

  // Handle Create User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateUserError('');
    setCreateUserLoading(true);
    try {
      if (!currentUser) throw new Error("You must be logged in");

      // 1. Create the user
      await authService.createInternalUser({
        email: newUserData.email,
        password: newUserData.password,
        displayName: newUserData.displayName,
        role: newUserData.role,
        invitedBy: currentUser.uid,
      });

      // 2. TRIGGER NOTIFICATION: New User Joined
      // Notifies Superadmins (and Admins if Support joins)
      await triggerNotification('USER_JOINED', {
        newUserRole: newUserData.role,
        userName: newUserData.displayName,
        userId: 'new-user-' + Date.now() // Temp ID, service finds by role anyway
      });

      setCreatedCredentials({
        email: newUserData.email,
        password: newUserData.password,
      });
      setToastMessage(`User created successfully!`);
      setShowCreateUserModal(false);
      resetCreateUserForm();
      fetchUsers();
    } catch (err: any) {
      console.error("Create user error:", err);
      setCreateUserError(err.message || "Failed to create user");
    } finally {
      setCreateUserLoading(false);
    }
  };

  const resetCreateUserForm = () => {
    setNewUserData({
      displayName: '',
      email: '',
      password: '',
      role: UserRole.SUPPORT,
    });
    setCreatedCredentials(null);
  };

  const confirmDeleteUser = (user: UserProfile) => {
    setUserToAction(user);
    setShowDeleteModal(true);
  };

  const handleDeleteUser = async () => {
    if (!userToAction || !isSuperAdmin) return;
    setIsProcessingAction(true);
    try {
      await dbService.deleteSystemUser(userToAction.uid);
      setShowDeleteModal(false);
      setUserToAction(null);
      setToastMessage("User deleted successfully.");
      fetchUsers();
    } catch (e: any) {
      console.error("Delete failed:", e);
      alert("Failed to delete user: " + e.message);
    } finally {
      setIsProcessingAction(false);
    }
  };

  const StatusBadge = ({ status }: { status: string }) => {
    const styles = {
      invited: 'text-amber-400 bg-amber-500/10 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.1)]',
      accepted: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.1)]',
      active: 'text-cyan-400 bg-cyan-500/10 border-cyan-500/20 shadow-[0_0_12px_rgba(6,182,212,0.1)]',
      blocked: 'text-rose-400 bg-rose-500/10 border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.1)]'
    };
    const label = status === 'blocked' ? 'Deactivated' : status;
    return (
      <div className="flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${status === 'active' ? 'bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.6)]' :
          status === 'accepted' ? 'bg-emerald-400 shadow-[0_0_8px_rgba(16,185,129,0.6)]' :
            status === 'invited' ? 'bg-amber-400 shadow-[0_0_8px_rgba(245,158,11,0.6)]' :
              'bg-rose-400 shadow-[0_0_8px_rgba(244,63,94,0.6)]'
          }`} />
        <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${styles[status as keyof typeof styles] || 'bg-gray-500/10 text-gray-500 border-gray-500/20'}`}>
          {label}
        </span>
      </div>
    );
  };

  return (
    <div className="p-6 md:p-10 animate-fade-in pb-20 relative max-w-[1600px] mx-auto">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-24 right-8 z-50 animate-slide-in">
          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-4 backdrop-blur-xl shadow-emerald-500/10">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
              <CheckCircle size={20} />
            </div>
            <span className="text-sm font-semibold tracking-tight">{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-12 gap-6">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/20 shadow-lg shadow-orange-500/5">
              <Shield className="text-orange-500 w-6 h-6" />
            </div>
            <h2 className="text-3xl md:text-4xl font-black text-gradient-heading tracking-tight">Team Management</h2>
          </div>
          <p className="text-gray-400 text-base font-medium max-w-xl">
            Configure internal access levels, manage team credentials, and monitor administrative permissions.
          </p>
        </div>

        <button
          onClick={() => setShowCreateUserModal(true)}
          className="bg-gradient-primary hover:opacity-90 text-white font-bold py-3 px-8 rounded-xl flex items-center gap-3 transition-all shadow-xl shadow-cyan-500/20 hover:shadow-cyan-500/30 transform hover:-translate-y-0.5 border border-white/10"
        >
          <User className="w-5 h-5" />
          <span>Create New Member</span>
        </button>
      </div>

      {/* Super Admin Metrics Board */}
      {isSuperAdmin && (
        <div className="mb-12 space-y-6 animate-fade-in">
          <div className="flex items-center gap-3 border-b border-white/10 pb-4">
            <div className="p-2 bg-purple-500/10 rounded-lg border border-purple-500/20">
              <Activity className="text-purple-400 w-5 h-5" />
            </div>
            <h3 className="text-xl font-black text-white tracking-tight">System Telemetry</h3>
            {metricsLoading && <Loader2 size={16} className="animate-spin text-gray-500 ml-2" />}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Total Users */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-xl hover:border-cyan-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[40px] group-hover:bg-cyan-500/10 transition-colors"></div>
              <div className="flex justify-between items-start mb-4 relative">
                <div className="p-3 bg-cyan-500/10 rounded-xl border border-cyan-500/20">
                  <Users className="text-cyan-400 w-5 h-5" />
                </div>
                <span className="text-3xl font-black text-white">{userMetrics.total}</span>
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 relative">Total Users</p>
              <div className="flex gap-3 text-xs font-semibold text-gray-500 mt-3 pt-3 border-t border-white/5 relative">
                <span>Cust: <span className="text-cyan-400">{userMetrics.customers}</span></span>
                <span>Exp: <span className="text-cyan-400">{userMetrics.experts}</span></span>
              </div>
            </div>

            {/* Total Staff */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-xl hover:border-orange-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 blur-[40px] group-hover:bg-orange-500/10 transition-colors"></div>
              <div className="flex justify-between items-start mb-4 relative">
                <div className="p-3 bg-orange-500/10 rounded-xl border border-orange-500/20">
                  <Briefcase className="text-orange-400 w-5 h-5" />
                </div>
                <span className="text-3xl font-black text-white">{userMetrics.admins + userMetrics.support}</span>
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 relative">Internal Staff</p>
              <div className="flex gap-3 text-xs font-semibold text-gray-500 mt-3 pt-3 border-t border-white/5 relative">
                <span>Adm: <span className="text-orange-400">{userMetrics.admins}</span></span>
                <span>Sup: <span className="text-orange-400">{userMetrics.support}</span></span>
              </div>
            </div>

            {/* Total Services */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-xl hover:border-emerald-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[40px] group-hover:bg-emerald-500/10 transition-colors"></div>
              <div className="flex justify-between items-start mb-4 relative">
                <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
                  <FileText className="text-emerald-400 w-5 h-5" />
                </div>
                <span className="text-3xl font-black text-white">{serviceMetrics.total}</span>
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 relative">Service Apps</p>
              <div className="flex gap-3 text-xs font-semibold text-gray-500 mt-3 pt-3 border-t border-white/5 relative">
                <span>Sub: <span className="text-emerald-400">{serviceMetrics.submitted}</span></span>
                <span>Proc: <span className="text-amber-400">{serviceMetrics.processing}</span></span>
              </div>
            </div>

            {/* Service Status */}
            <div className="bg-black/40 border border-white/5 rounded-2xl p-6 backdrop-blur-xl hover:border-purple-500/30 transition-all group relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[40px] group-hover:bg-purple-500/10 transition-colors"></div>
              <div className="flex justify-between items-start mb-4 relative">
                <div className="p-3 bg-purple-500/10 rounded-xl border border-purple-500/20">
                  <CheckCircle className="text-purple-400 w-5 h-5" />
                </div>
                <span className="text-3xl font-black text-white">{serviceMetrics.approved}</span>
              </div>
              <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-1 relative">Completed</p>
              <div className="flex gap-3 text-xs font-semibold text-gray-500 mt-3 pt-3 border-t border-white/5 relative">
                <span>Appr: <span className="text-emerald-400">{serviceMetrics.approved}</span></span>
                <span>Rej: <span className="text-red-400">{serviceMetrics.rejected}</span></span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Team Members List */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-white/90 flex items-center gap-2 px-1">
            <div className="w-1.5 h-6 bg-orange-500 rounded-full"></div>
            Internal Team Roles
          </h3>
          <span className="text-xs font-bold text-gray-500 bg-white/5 px-3 py-1 rounded-full border border-white/5">
            {teamMembers.length} Members Total
          </span>
        </div>

        <div className="glass-panel rounded-2xl border border-white/10 overflow-hidden shadow-2xl bg-black/20 backdrop-blur-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-white/[0.02] text-gray-400 text-[11px] uppercase tracking-[0.15em] font-black border-b border-white/5">
                  <th className="p-5 pl-8">Identity & Profile</th>
                  <th className="p-5">Access Tier</th>
                  <th className="p-5">Service Status</th>
                  <th className="p-5">Onboarding</th>
                  <th className="p-5 text-right pr-8">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {teamMembers.map((u) => (
                  <tr key={u.uid} className="hover:bg-white/[0.04] transition-all group">
                    <td className="p-5 pl-8">
                      <div className="flex items-center gap-4">
                        <div className="relative">
                          <div className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-base shadow-xl transform transition-transform group-hover:scale-105 duration-300 ${u.role === UserRole.SUPERADMIN ? 'bg-gradient-to-br from-purple-600/30 to-purple-800/30 text-purple-300 ring-1 ring-purple-500/40' :
                            u.role === UserRole.ADMIN ? 'bg-gradient-to-br from-blue-600/30 to-blue-800/30 text-blue-300 ring-1 ring-blue-500/40' :
                              'bg-gradient-to-br from-teal-600/30 to-teal-800/30 text-teal-300 ring-1 ring-teal-500/40'
                            }`}>
                            {u.displayName ? u.displayName.charAt(0).toUpperCase() : '?'}
                          </div>
                          {u.status === 'active' && (
                            <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-emerald-500 rounded-full border-2 border-background shadow-lg shadow-emerald-500/20 animate-pulse"></div>
                          )}
                        </div>
                        <div>
                          <p className="text-white font-bold text-base tracking-tight leading-none mb-1.5">{u.displayName || 'Unnamed User'}</p>
                          <p className="text-gray-500 text-xs font-medium tracking-wide">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-5">
                      {isSuperAdmin && u.role !== UserRole.SUPERADMIN ? (
                        <div className="relative group/select inline-block min-w-[120px]">
                          <select
                            value={u.role}
                            onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                            className="appearance-none w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-xs text-gray-200 focus:border-orange-500 outline-none pr-10 cursor-pointer hover:bg-white/10 transition-all font-bold tracking-wide shadow-inner"
                          >
                            <option value={UserRole.ADMIN}>ADMIN STAFF</option>
                            <option value={UserRole.SUPPORT}>SUPPORT AGENT</option>
                          </select>
                          <Edit2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none group-hover/select:text-orange-400 transition-colors" />
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2">
                          <span className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.1em] ${u.role === UserRole.SUPERADMIN ? 'text-purple-400 bg-purple-500/10 border border-purple-500/20' : 'text-gray-400 bg-white/5 border border-white/10'
                            }`}>
                            {u.role}
                          </span>
                        </div>
                      )}
                    </td>
                    <td className="p-5">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="p-5">
                      <div className="flex flex-col gap-1">
                        <span className="text-gray-400 font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5">
                          {u.invitedBy ? (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></div>
                              Admin Panel
                            </>
                          ) : (
                            <>
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]"></div>
                              System Root
                            </>
                          )}
                        </span>
                        <p className="text-[11px] text-gray-600 font-medium">Auto-Provisioned</p>
                      </div>
                    </td>
                    <td className="p-5 pr-8 text-right">
                      {isSuperAdmin && u.role !== UserRole.SUPERADMIN ? (
                        <button
                          onClick={() => confirmDeleteUser(u)}
                          className="p-3 rounded-xl text-gray-500 hover:text-white hover:bg-red-500 transition-all duration-300 group/btn border border-transparent hover:border-red-400 hover:shadow-lg hover:shadow-red-500/20"
                          title="Revoke Access & Delete User"
                        >
                          <Trash size={18} className="transform group-hover/btn:scale-110 transition-transform" />
                        </button>
                      ) : (
                        <div className="flex items-center justify-end gap-2 text-gray-600">
                          <span className="text-[10px] font-black uppercase tracking-widest opacity-40">Immune Profile</span>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
                {teamMembers.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-16 text-center">
                      <div className="flex flex-col items-center gap-4">
                        <div className="p-6 rounded-full bg-white/5 border border-white/5 text-gray-600 mb-2">
                          <UserX size={48} strokeWidth={1} />
                        </div>
                        <p className="text-gray-400 text-lg font-medium">No internal team members found.</p>
                        <button onClick={() => setShowCreateUserModal(true)} className="text-cyan-400 hover:text-cyan-300 font-bold text-sm underline underline-offset-4">
                          Onboard your first team member
                        </button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ✅ Create User Modal */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
          <div className="bg-[#0c0c10] rounded-[2rem] border border-white/10 w-full max-w-lg p-10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] relative overflow-hidden group">
            {/* Decorative Background Element */}
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/5 blur-[80px] rounded-full group-hover:bg-cyan-500/10 transition-colors duration-700"></div>

            <button
              onClick={() => { setShowCreateUserModal(false); resetCreateUserForm(); }}
              className="absolute top-8 right-8 p-2 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-all border border-white/5"
            >
              <X size={20} />
            </button>

            <div className="mb-10">
              <h3 className="text-3xl font-black text-white tracking-tight mb-2">New Identity</h3>
              <p className="text-gray-500 font-medium">Create a new secure internal team account.</p>
            </div>

            {!createdCredentials ? (
              <form onSubmit={handleCreateUser} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2.5 ml-1">Full Legal Name</label>
                    <input
                      required
                      type="text"
                      value={newUserData.displayName}
                      onChange={e => setNewUserData({ ...newUserData, displayName: e.target.value })}
                      placeholder="e.g. Aditi Sharma"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all text-sm font-medium placeholder:text-gray-700"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2.5 ml-1">Email Connection</label>
                    <input
                      required
                      type="email"
                      value={newUserData.email}
                      onChange={e => setNewUserData({ ...newUserData, email: e.target.value })}
                      placeholder="name@cloudmasa.com"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all text-sm font-medium placeholder:text-gray-700"
                    />
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2.5 ml-1">Initial Keyphrase</label>
                    <div className="flex gap-3">
                      <input
                        required
                        type="text"
                        value={newUserData.password}
                        onChange={e => setNewUserData({ ...newUserData, password: e.target.value })}
                        placeholder="Static or generated key"
                        className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all text-sm font-medium placeholder:text-gray-700"
                      />
                      <button
                        type="button"
                        onClick={autoFillPassword}
                        className="px-6 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-cyan-400 text-xs font-black uppercase tracking-widest transition-all hover:border-cyan-500/30"
                      >
                        Roll
                      </button>
                    </div>
                  </div>

                  <div className="md:col-span-2">
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2.5 ml-1">Access Authorization</label>
                    <select
                      value={newUserData.role}
                      onChange={e => setNewUserData({ ...newUserData, role: e.target.value as UserRole })}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-cyan-500 focus:ring-4 focus:ring-cyan-500/10 transition-all text-sm font-black uppercase tracking-[0.15em] cursor-pointer"
                    >
                      {isSuperAdmin && <option value={UserRole.ADMIN}>ADMINISTRATOR</option>}
                      <option value={UserRole.SUPPORT}>SUPPORT SPECIALIST</option>
                    </select>
                  </div>
                </div>

                {createUserError && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3">
                    <AlertTriangle size={16} className="text-red-500 shrink-0" />
                    <p className="text-xs text-red-500 font-bold leading-tight">{createUserError}</p>
                  </div>
                )}

                <div className="pt-6 flex flex-col sm:flex-row gap-4">
                  <button
                    type="submit"
                    disabled={createUserLoading}
                    className="flex-1 order-1 sm:order-2 bg-gradient-primary text-white font-black uppercase tracking-widest rounded-2xl py-4 hover:opacity-90 transition-all shadow-xl shadow-cyan-500/20 disabled:opacity-50 flex items-center justify-center gap-3 border border-white/10"
                  >
                    {createUserLoading ? <Loader2 size={18} className="animate-spin" /> : (
                      <>
                        <CheckCircle size={18} />
                        Confirm Provisioning
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setShowCreateUserModal(false); resetCreateUserForm(); }}
                    className="order-2 sm:order-1 px-8 py-4 text-gray-500 hover:text-white text-xs font-black uppercase tracking-widest transition-colors"
                  >
                    Discard
                  </button>
                </div>
              </form>
            ) : (
              <div className="text-center py-4">
                <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
                  <CheckCircle className="text-emerald-500" size={40} strokeWidth={2.5} />
                </div>
                <h4 className="text-2xl font-black text-white mb-2 tracking-tight">Access Provisioned</h4>
                <p className="text-gray-500 font-medium mb-8">Credentials generated successfully.</p>

                <div className="bg-white/5 rounded-3xl p-6 mb-8 text-left border border-white/5 space-y-4">
                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Portal ID</p>
                    <p className="text-white font-bold text-sm bg-black/40 px-4 py-3 rounded-xl border border-white/5 select-all">{createdCredentials.email}</p>
                  </div>

                  <div>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1.5 ml-1">Temporary Access Key</p>
                    <div className="flex items-center justify-between bg-orange-500/5 px-4 py-3 rounded-xl border border-orange-500/20 group/key">
                      <p className="text-orange-400 font-mono text-base font-bold select-all">{createdCredentials.password}</p>
                      <Check size={16} className="text-emerald-500 opacity-60" />
                    </div>
                  </div>
                </div>

                <p className="text-[11px] text-gray-600 font-bold mb-8 italic">
                  * Provisioning complete. Notify member of their new secure keys.
                </p>

                <button
                  onClick={() => { setShowCreateUserModal(false); resetCreateUserForm(); }}
                  className="w-full bg-white/10 hover:bg-white/15 text-white font-black uppercase tracking-widest rounded-2xl py-4 transition-all border border-white/10"
                >
                  Return to Panel
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && userToAction && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
          <div className="bg-[#120a0a] rounded-[2rem] border border-red-500/20 w-full max-w-sm p-10 shadow-[0_32px_64px_-16px_rgba(239,68,68,0.2)] relative animate-fade-in overflow-hidden">
            {/* Red Glow Decal */}
            <div className="absolute -top-12 -left-12 w-32 h-32 bg-red-500/10 blur-[60px] rounded-full"></div>

            <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center mb-6 mx-auto border border-red-500/20 rotate-12 shadow-inner">
              <UserX className="text-red-500" size={32} />
            </div>

            <h3 className="text-2xl font-black text-white text-center mb-2 tracking-tight">Revoke Access?</h3>
            <p className="text-gray-400 text-center mb-8 text-sm leading-relaxed font-medium">
              You are removing <span className="text-white font-bold">{userToAction.displayName || userToAction.email}</span>. This internal identity will be permanently decommissioned.
            </p>

            <div className="space-y-3">
              <button
                onClick={handleDeleteUser}
                disabled={isProcessingAction}
                className="w-full bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest rounded-2xl py-4 text-xs shadow-xl shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-3 transition-all border border-red-400/20"
              >
                {isProcessingAction ? <Loader2 size={16} className="animate-spin" /> : (
                  <>
                    <Trash size={16} />
                    Confirm Revocation
                  </>
                )}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-4 text-gray-600 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all"
              >
                Abort Action
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanel;