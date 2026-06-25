import React, { useEffect, useState } from 'react';
import { Shield, Users, Edit2, Trash, UserX, CheckCircle, UserPlus, Mail, Phone, Calendar, Search, Filter, X, Lock, Eye, Activity, FileText } from 'lucide-react';
import { UserProfile, UserRole } from '../../types';
import { dbService } from '../../services/dbService';
import { collection, query, getDocs, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { db, functions } from '../../services/firebase';
import { httpsCallable } from 'firebase/functions';

interface Invitation {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  message?: string;
  createdAt: number;
}

interface UserManagementProps {
  user: UserProfile;
}

const UserManagement: React.FC<UserManagementProps> = ({ user: currentUser }) => {
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [invitationsList, setInvitationsList] = useState<Invitation[]>([]);
  const [appsByUser, setAppsByUser] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [authFilter, setAuthFilter] = useState<string>('all');
  
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<UserProfile | Invitation | null>(null);
  const [isDeletingInvite, setIsDeletingInvite] = useState(false);
  const [isSyncingAuth, setIsSyncingAuth] = useState(false);

  const [inviteForm, setInviteForm] = useState({
    fullName: '', email: '', phone: '', role: 'admin', message: ''
  });

  const [toast, setToast] = useState<{ message: string, type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const users = await dbService.getAllUsers();
      setUsersList(users);

      const apps = await dbService.getAllApplications();
      const appsMap: Record<string, any[]> = {};
      apps.forEach(app => {
        if (!appsMap[app.userId]) appsMap[app.userId] = [];
        appsMap[app.userId].push(app);
      });
      setAppsByUser(appsMap);

      const invSnap = await getDocs(collection(db, 'invitations'));
      const invs = invSnap.docs.map(d => ({ id: d.id, ...d.data() } as Invitation));
      setInvitationsList(invs);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (uid: string, newRole: UserRole) => {
    if (uid === currentUser.uid) {
      showToast("You cannot change your own role.", "error");
      return;
    }
    try {
      await dbService.updateUserRole(uid, newRole);
      showToast(`User role successfully updated to ${newRole}`, "success");
      fetchAllData();
    } catch (e) {
      showToast("Failed to update role", "error");
    }
  };

  const toggleUserStatus = async (u: UserProfile) => {
    if (u.uid === currentUser.uid) {
      showToast("Cannot disable your own SuperAdmin account.", "error");
      return;
    }
    try {
      const newStatus = (u.status === 'blocked' || u.status === 'disabled' as any) ? 'active' : 'disabled';
      await dbService.updateUser(u.uid, { status: newStatus as any });
      showToast(`User account is now ${newStatus}`, "success");
      fetchAllData();
    } catch (e) {
      showToast("Failed to update status", "error");
    }
  };

  const handleDeleteUser = async () => {
    if (!deleteConfirmUser) return;
    try {
      if (isDeletingInvite) {
        await deleteDoc(doc(db, 'invitations', (deleteConfirmUser as Invitation).id));
        showToast("Invitation revoked successfully", "success");
      } else {
        const u = deleteConfirmUser as UserProfile;
        if (u.uid === currentUser.uid) {
          showToast("Cannot delete your own account.", "error");
          return;
        }
        const deleteAuthFn = httpsCallable(functions, 'deleteAuthUser');
        const result: any = await deleteAuthFn({ targetUid: u.uid });
        if (result.data?.success) {
          showToast("User account deleted successfully", "success");
        } else {
          showToast("Failed to delete user account", "error");
        }
      }
      setDeleteConfirmUser(null);
      setIsDeletingInvite(false);
      fetchAllData();
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || "Failed to delete user or invite", "error");
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'invitations'), {
        ...inviteForm,
        status: 'pending',
        invitedBy: currentUser.uid,
        createdAt: Date.now()
      });
      setInviteModalOpen(false);
      setInviteForm({ fullName: '', email: '', phone: '', role: 'admin', message: '' });
      showToast(`Invitation sent to ${inviteForm.email}`, "success");
      fetchAllData();
    } catch (e) {
      showToast("Failed to send invite", "error");
    }
  };

  const handleSyncAuthUsers = async () => {
    setIsSyncingAuth(true);
    try {
      const syncAuthFn = httpsCallable(functions, 'syncAuthToFirestore');
      const result: any = await syncAuthFn();
      
      if (result.data?.success) {
        showToast(`Sync complete! ${result.data.syncedCount} users added.`, "success");
        fetchAllData();
      } else {
        showToast("Sync failed to complete.", "error");
      }
    } catch (e: any) {
      console.error(e);
      showToast(e?.message || "Failed to sync users", "error");
    } finally {
      setIsSyncingAuth(false);
    }
  };

  // ─── Filtering Logic ───
  let filteredUsers = usersList;
  if (activeTab === 'customers') filteredUsers = usersList.filter(u => u.role === 'customer');
  else if (activeTab === 'admins') filteredUsers = usersList.filter(u => u.role === 'admin');
  else if (activeTab === 'support') filteredUsers = usersList.filter(u => u.role === 'support');
  else if (activeTab === 'experts') filteredUsers = usersList.filter(u => u.role === 'expert');
  else if (activeTab === 'employees') filteredUsers = usersList.filter(u => u.role === 'employee' as any);
  else if (activeTab === 'disabled') filteredUsers = usersList.filter(u => u.status === 'blocked' || u.status === 'disabled' as any);

  if (searchQuery) {
    const sq = searchQuery.toLowerCase();
    filteredUsers = filteredUsers.filter(u => 
      u.displayName?.toLowerCase().includes(sq) || 
      u.email?.toLowerCase().includes(sq) || 
      u.phoneNumber?.includes(sq)
    );
  }

  if (authFilter === 'google') {
    filteredUsers = filteredUsers.filter(u => u.provider === 'google.com');
  } else if (authFilter === 'email') {
    filteredUsers = filteredUsers.filter(u => u.provider === 'password' || !u.provider);
  }

  const filteredInvites = invitationsList.filter(i => 
    i.fullName.toLowerCase().includes(searchQuery.toLowerCase()) || 
    i.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // ─── Stats ───
  const stats = {
    total: usersList.length,
    customers: usersList.filter(u => u.role === 'customer').length,
    admins: usersList.filter(u => u.role === 'admin' || u.role === 'superadmin').length,
    support: usersList.filter(u => u.role === 'support').length,
    experts: usersList.filter(u => u.role === 'expert').length,
    pending: invitationsList.filter(i => i.status === 'pending').length,
    disabled: usersList.filter(u => u.status === 'blocked' || u.status === 'disabled' as any).length,
  };

  const formatDate = (ts: number) => {
    if (!ts) return 'N/A';
    return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  return (
    <div className="p-6 md:p-10 animate-fade-in relative max-w-[1600px] mx-auto bg-background text-foreground min-h-screen">
      
      {/* ─── Header ─── */}
      <div className="mb-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight flex items-center gap-3">
            <Users className="text-cyan-400" size={36} /> User Management
          </h1>
          <p className="text-muted-foreground text-sm font-medium mt-2">
            Manage platform users, roles, permissions, and invitations.
          </p>
        </div>
        <div className="flex gap-3">
          {currentUser.role === 'superadmin' && (
            <button 
              onClick={handleSyncAuthUsers}
              disabled={isSyncingAuth}
              className={`flex items-center gap-2 px-5 py-3 ${isSyncingAuth ? 'bg-secondary text-muted-foreground' : 'bg-secondary hover:bg-secondary/80 text-foreground border border-border'} font-bold rounded-xl transition-all shadow-lg`}
            >
              {isSyncingAuth ? <Activity size={18} className="animate-spin" /> : <Activity size={18} />}
              {isSyncingAuth ? 'Syncing...' : 'Sync Auth Users'}
            </button>
          )}
          <button 
            onClick={() => setInviteModalOpen(true)}
            className="flex items-center gap-2 px-6 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl transition-all shadow-[0_0_20px_rgba(6,182,212,0.3)] hover:shadow-[0_0_30px_rgba(6,182,212,0.5)] transform hover:-translate-y-1"
          >
            <UserPlus size={18} /> Invite User
          </button>
        </div>
      </div>

      {/* ─── Summary Cards ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        {[
          { label: 'Total Users', value: stats.total, color: 'text-cyan-400' },
          { label: 'Customers', value: stats.customers, color: 'text-emerald-400' },
          { label: 'Admins', value: stats.admins, color: 'text-rose-400' },
          { label: 'Support', value: stats.support, color: 'text-purple-400' },
          { label: 'Experts', value: stats.experts, color: 'text-orange-400' },
          { label: 'Pending Invites', value: stats.pending, color: 'text-blue-400' },
          { label: 'Disabled', value: stats.disabled, color: 'text-gray-400' },
        ].map((s, i) => (
          <div key={i} className="bg-card border border-border rounded-2xl p-4 shadow-lg text-center flex flex-col items-center justify-center">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">{s.label}</p>
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* ─── Tabs & Filters ─── */}
      <div className="bg-card border border-border rounded-2xl p-4 mb-6 shadow-lg flex flex-col xl:flex-row justify-between items-center gap-4">
        <div className="flex flex-wrap gap-2">
          {['all', 'customers', 'admins', 'support', 'experts', 'pending', 'disabled'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all ${
                activeTab === tab 
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/50 shadow-[0_0_15px_rgba(6,182,212,0.2)]' 
                : 'bg-secondary/50 text-muted-foreground border border-transparent hover:bg-secondary'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex flex-col md:flex-row items-center gap-3 w-full xl:w-auto">
          <select 
            value={authFilter} 
            onChange={e => setAuthFilter(e.target.value)}
            className="w-full md:w-auto bg-secondary/50 border border-border rounded-xl px-4 py-2.5 text-xs font-bold focus:border-cyan-500 outline-none transition-all uppercase tracking-wider text-muted-foreground cursor-pointer hover:bg-secondary"
          >
            <option value="all">All Providers</option>
            <option value="google">Google Auth</option>
            <option value="email">Email Auth</option>
          </select>
          <div className="relative w-full md:w-64 xl:w-80">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input 
              type="text" 
              placeholder="Search users..." 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:border-cyan-500 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* ─── Data Tables ─── */}
      <div className="glass-panel rounded-2xl border border-border overflow-hidden shadow-2xl bg-card">
        <div className="overflow-x-auto custom-scrollbar">
          
          {/* CUSTOMER TABLE */}
          {activeTab === 'customers' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-secondary/50 text-muted-foreground text-[10px] uppercase tracking-widest font-black border-b border-border">
                <tr>
                  <th className="p-4 pl-6">Customer</th>
                  <th className="p-4">Contact</th>
                  <th className="p-4">Joined Date</th>
                  <th className="p-4 text-center">Applications</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map(u => {
                  const uApps = appsByUser[u.uid] || [];
                  const activeApps = uApps.filter(a => a.status !== 'completed' && a.status !== 'approved').length;
                  const isBlocked = u.status === 'blocked' || u.status === 'disabled' as any;
                  return (
                    <tr key={u.uid} className="hover:bg-muted/30 transition-all">
                      <td className="p-4 pl-6 font-bold text-foreground">{u.displayName || 'Unnamed'}</td>
                      <td className="p-4">
                        <div className="text-xs text-muted-foreground"><Mail size={10} className="inline mr-1"/>{u.email}</div>
                        <div className="text-xs text-muted-foreground mt-1"><Phone size={10} className="inline mr-1"/>{u.phoneNumber || 'N/A'}</div>
                        <div className="mt-1.5 flex items-center gap-1">
                          {u.provider === 'google.com' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm" title="Logged in with Google">Google Auth</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-500/10 text-slate-400 border border-slate-500/20 shadow-sm" title="Logged in with Email/Password">Email Auth</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4 text-xs font-medium text-muted-foreground">{formatDate(u.createdAt)}</td>
                      <td className="p-4 text-center">
                        <div className="text-xs"><span className="text-cyan-400 font-bold">{uApps.length}</span> Total</div>
                        <div className="text-[10px] text-orange-400 mt-1">{activeApps} Active</div>
                      </td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isBlocked ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {isBlocked ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right space-x-2">
                        <button className="p-1.5 rounded-lg text-cyan-400 hover:bg-cyan-500/20" title="View Profile"><Eye size={16}/></button>
                        <button onClick={() => toggleUserStatus(u)} className={`p-1.5 rounded-lg ${isBlocked ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-orange-400 hover:bg-orange-500/20'}`} title={isBlocked ? "Enable" : "Disable"}>
                          {isBlocked ? <CheckCircle size={16}/> : <Lock size={16}/>}
                        </button>
                        <button onClick={() => { setDeleteConfirmUser(u); setIsDeletingInvite(false); }} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20" title="Delete">
                          <Trash size={16}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* STAFF / ALL TABLE */}
          {activeTab !== 'customers' && activeTab !== 'pending' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-secondary/50 text-muted-foreground text-[10px] uppercase tracking-widest font-black border-b border-border">
                <tr>
                  <th className="p-4 pl-6">User</th>
                  <th className="p-4">Role</th>
                  <th className="p-4">Joined Date</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredUsers.map(u => {
                  const isBlocked = u.status === 'blocked' || u.status === 'disabled' as any;
                  return (
                    <tr key={u.uid} className="hover:bg-muted/30 transition-all">
                      <td className="p-4 pl-6">
                        <div className="font-bold text-foreground">{u.displayName || 'Unnamed'}</div>
                        <div className="text-xs text-muted-foreground mb-1">{u.email}</div>
                        <div className="flex items-center gap-1">
                          {u.provider === 'google.com' ? (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm" title="Logged in with Google">Google Auth</span>
                          ) : (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold uppercase bg-slate-500/10 text-slate-400 border border-slate-500/20 shadow-sm" title="Logged in with Email/Password">Email Auth</span>
                          )}
                        </div>
                      </td>
                      <td className="p-4">
                        <select
                          value={u.role}
                          onChange={(e) => handleRoleChange(u.uid, e.target.value as UserRole)}
                          className="bg-transparent border border-border rounded px-2 py-1 text-xs font-bold uppercase focus:border-cyan-500 outline-none text-cyan-400"
                        >
                          <option value="customer">Customer</option>
                          <option value="support">Support</option>
                          <option value="expert">Expert</option>
                          <option value="admin">Admin</option>
                          <option value="superadmin">SuperAdmin</option>
                        </select>
                      </td>
                      <td className="p-4 text-xs font-medium text-muted-foreground">{formatDate(u.createdAt)}</td>
                      <td className="p-4 text-center">
                        <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${isBlocked ? 'bg-rose-500/10 text-rose-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                          {isBlocked ? 'Disabled' : 'Active'}
                        </span>
                      </td>
                      <td className="p-4 pr-6 text-right space-x-2">
                        <button onClick={() => toggleUserStatus(u)} className={`p-1.5 rounded-lg ${isBlocked ? 'text-emerald-400 hover:bg-emerald-500/20' : 'text-orange-400 hover:bg-orange-500/20'}`} title={isBlocked ? "Enable" : "Disable"}>
                          {isBlocked ? <CheckCircle size={16}/> : <Lock size={16}/>}
                        </button>
                        <button onClick={() => { setDeleteConfirmUser(u); setIsDeletingInvite(false); }} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20" title="Delete">
                          <Trash size={16}/>
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* PENDING INVITES TABLE */}
          {activeTab === 'pending' && (
            <table className="w-full text-left border-collapse text-sm">
              <thead className="bg-secondary/50 text-muted-foreground text-[10px] uppercase tracking-widest font-black border-b border-border">
                <tr>
                  <th className="p-4 pl-6">Invitee</th>
                  <th className="p-4">Assigned Role</th>
                  <th className="p-4">Invited On</th>
                  <th className="p-4 text-center">Status</th>
                  <th className="p-4 text-right pr-6">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredInvites.map(inv => (
                  <tr key={inv.id} className="hover:bg-muted/30 transition-all">
                    <td className="p-4 pl-6">
                      <div className="font-bold text-foreground">{inv.fullName}</div>
                      <div className="text-xs text-muted-foreground">{inv.email}</div>
                    </td>
                    <td className="p-4 text-xs font-bold uppercase text-purple-400">{inv.role}</td>
                    <td className="p-4 text-xs font-medium text-muted-foreground">{formatDate(inv.createdAt)}</td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 rounded text-[10px] font-bold uppercase bg-blue-500/10 text-blue-400">
                        {inv.status}
                      </span>
                    </td>
                    <td className="p-4 pr-6 text-right space-x-2">
                      <button onClick={() => { setDeleteConfirmUser(inv); setIsDeletingInvite(true); }} className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/20" title="Revoke Invite">
                        <Trash size={16}/>
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredInvites.length === 0 && (
                  <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">No pending invites.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {loading && (
            <div className="p-10 flex justify-center"><Activity className="animate-spin text-cyan-400" size={32} /></div>
          )}
          {!loading && filteredUsers.length === 0 && activeTab !== 'pending' && (
            <div className="p-10 flex justify-center text-muted-foreground">No users found.</div>
          )}
        </div>
      </div>

      {/* ─── Invite Modal ─── */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold flex items-center gap-2 text-cyan-400">
                <UserPlus size={20} /> Invite New User
              </h2>
              <button onClick={() => setInviteModalOpen(false)} className="text-muted-foreground hover:text-rose-400">
                <X size={24} />
              </button>
            </div>
            <form onSubmit={handleSendInvite} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Full Name</label>
                <input required type="text" value={inviteForm.fullName} onChange={e => setInviteForm({...inviteForm, fullName: e.target.value})} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-sm focus:border-cyan-500 outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Email</label>
                  <input required type="email" value={inviteForm.email} onChange={e => setInviteForm({...inviteForm, email: e.target.value})} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-sm focus:border-cyan-500 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Phone</label>
                  <input type="tel" value={inviteForm.phone} onChange={e => setInviteForm({...inviteForm, phone: e.target.value})} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-sm focus:border-cyan-500 outline-none" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Role</label>
                <select required value={inviteForm.role} onChange={e => setInviteForm({...inviteForm, role: e.target.value})} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-sm focus:border-cyan-500 outline-none">
                  <option value="admin">Admin</option>
                  <option value="support">Support Staff</option>
                  <option value="expert">Expert</option>
                  <option value="employee">Employee</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-muted-foreground uppercase mb-1">Optional Message</label>
                <textarea value={inviteForm.message} onChange={e => setInviteForm({...inviteForm, message: e.target.value})} className="w-full bg-secondary/50 border border-border rounded-xl px-4 py-2 text-sm focus:border-cyan-500 outline-none resize-none h-20" />
              </div>
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setInviteModalOpen(false)} className="px-4 py-2 text-sm font-bold text-muted-foreground hover:text-foreground">Cancel</button>
                <button type="submit" className="px-6 py-2 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-xl shadow-lg">Send Invitation</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirmUser && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-rose-500/30 rounded-2xl w-full max-w-sm shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-16 h-16 bg-rose-500/10 text-rose-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Confirm Deletion</h2>
            <p className="text-muted-foreground text-sm mb-6">
              Are you sure you want to {isDeletingInvite ? 'revoke this invitation' : 'delete this user'}? This action cannot be undone.
            </p>
            <div className="flex justify-center gap-3">
              <button onClick={() => { setDeleteConfirmUser(null); setIsDeletingInvite(false); }} className="px-4 py-2 bg-secondary text-foreground font-bold rounded-xl hover:bg-secondary/80">Cancel</button>
              <button onClick={handleDeleteUser} className="px-4 py-2 bg-rose-500 text-white font-bold rounded-xl hover:bg-rose-600 shadow-lg shadow-rose-500/20">Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* ─── Toast Notification ─── */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 duration-300">
          <div className={`flex items-center gap-3 px-6 py-4 rounded-xl shadow-2xl border backdrop-blur-md ${
            toast.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' :
            toast.type === 'error' ? 'bg-rose-500/10 border-rose-500/30 text-rose-400' :
            'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}>
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'error' && <X size={20} />}
            {toast.type === 'info' && <Activity size={20} />}
            <span className="font-bold text-sm tracking-wide">{toast.message}</span>
          </div>
        </div>
      )}

    </div>
  );
};

export default UserManagement;
