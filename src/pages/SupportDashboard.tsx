import React, { useState, useEffect } from 'react';
import {
  Mail, FileText, Clock, CheckCircle, AlertCircle, X, ChevronRight, Search, Inbox, Loader2, RefreshCw, Star, TrendingUp, BarChart2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { mockAuthService } from '../services/mockFirebase';
import { triggerNotification } from '../services/NotificationService';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';

type RequestStatus = 'Assigned' | 'In Progress' | 'Completed' | 'Admin';

interface SupportRequest {
  id: string;
  customerName: string;
  customerEmail: string;
  customerId?: string;
  userId?: string;
  mobile?: string;
  topic?: string;
  time?: string;
  submittedAt?: any;
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

const formatDate = (dateVal: any): string => {
  if (!dateVal) return 'N/A';
  if (typeof dateVal === 'string') return dateVal.split('T')[0];
  if (typeof dateVal === 'object' && dateVal.toDate) return dateVal.toDate().toISOString().split('T')[0];
  try { return new Date(dateVal).toISOString().split('T')[0]; } catch (e) { return 'Invalid Date'; }
};

const StatusBadge: React.FC<{ status: RequestStatus }> = ({ status }) => {
  const styles = {
    'Assigned': 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
    'In Progress': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
    'Completed': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    'Admin': 'bg-orange-500/10 text-orange-400 border-orange-500/20',
  };
  return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${styles[status] || styles['Assigned']}`}>{status}</span>;
};

interface StatCardProps {
  title: string; count: number | string; icon: React.ReactNode; colorClass: string; isActive?: boolean; onClick?: () => void;
}

const StatCard: React.FC<StatCardProps> = ({ title, count, icon, colorClass, isActive = false, onClick }) => (
  <div onClick={onClick} className={`relative overflow-hidden rounded-2xl p-6 border transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} group ${isActive ? 'bg-white/10 border-white/20 shadow-lg shadow-cyan-900/20 scale-[1.02]' : 'bg-card/40 border-white/5 hover:bg-secondary/60 hover:border-white/10'}`}>
    <div className="flex justify-between items-start mb-4">
      <div>
        <p className="text-slate-400 text-sm font-medium mb-1">{title}</p>
        <h3 className="text-3xl font-bold text-white">{count}</h3>
      </div>
      <div className={`p-3 rounded-xl bg-background border border-white/5 ${colorClass} group-hover:scale-110 transition-transform`}>{icon}</div>
    </div>
    <div className={`absolute -bottom-10 -right-10 w-32 h-32 bg-gradient-to-br from-white/5 to-transparent rounded-full blur-2xl transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
  </div>
);

const CustomerSidebar: React.FC<{ request: SupportRequest | null; onClose: () => void; onStatusChange?: (id: string, newStatus: RequestStatus) => void; }> = ({ request, onClose, onStatusChange }) => {
  if (!request) return null;
  const handleLocalStatusChange = (newStatus: RequestStatus) => { if (onStatusChange && request.id) onStatusChange(request.id, newStatus); };
  return (
    <>
      <div className="fixed inset-0 bg-background/60 backdrop-blur-sm z-40 animate-fade-in" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full max-w-md bg-background border-l border-white/10 z-50 shadow-2xl flex flex-col">
        <div className="p-6 border-b border-white/10 flex justify-between items-center bg-card/50">
          <div>
            <h2 className="text-xl font-bold text-white">Customer Details</h2>
            <p className="text-xs text-slate-400 mt-1">Request ID: {request.id}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <div className="bg-white/5 p-4 rounded-xl border border-white/10">
            <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 block">Update Status</label>
            <div className="grid grid-cols-2 gap-2">
              {(['Assigned', 'In Progress', 'Completed', 'Admin'] as RequestStatus[]).map((s) => (
                <button key={s} onClick={() => handleLocalStatusChange(s)} className={`text-xs py-2 px-2 rounded border transition-all ${request.status === s ? 'bg-cyan-600 border-cyan-500 text-white font-bold' : 'bg-card border-white/10 text-slate-400 hover:border-white/30'}`}>{s}</button>
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Full Name</label><p className="text-lg text-white font-medium mt-1">{request.customerName}</p></div>
            <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Email Address</label><p className="text-lg text-white font-medium mt-1 break-all">{request.customerEmail}</p></div>
            {request.mobile && <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Mobile</label><p className="text-lg text-white font-medium mt-1">{request.mobile}</p></div>}
            <div><label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Issue Type</label><div className="flex items-center gap-2 mt-1"><AlertCircle size={16} className="text-orange-400" /><p className="text-white">{request.issueType}</p></div></div>
          </div>
        </div>
        <div className="p-6 border-t border-white/10 bg-card/50">
          <button onClick={() => window.location.href = `mailto:${request.customerEmail}`} className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-cyan-900/20"><Mail size={18} /> Send Email</button>
        </div>
      </div>
    </>
  );
};

// MOCK DATA FOR CHARTS
const priorityData = [
  { name: 'High', value: 25 },
  { name: 'Medium', value: 45 },
  { name: 'Low', value: 30 },
];
const PRIORITY_COLORS = ['#ef4444', '#f59e0b', '#3b82f6'];

const csatData = [
  { name: '5 Star', count: 120 },
  { name: '4 Star', count: 45 },
  { name: '3 Star', count: 10 },
  { name: '2 Star', count: 3 },
  { name: '1 Star', count: 1 },
];

const SupportDashboard: React.FC<{ user: UserProfile }> = ({ user: initialUser }) => {
  const [filter, setFilter] = useState<RequestStatus | 'All'>('All');
  const [selectedRequest, setSelectedRequest] = useState<SupportRequest | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [requests, setRequests] = useState<SupportRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<UserProfile>(initialUser);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (initialUser) { setCurrentUser(initialUser); fetchSupportRequests(initialUser.uid); }
  }, [initialUser]);

  const fetchSupportRequests = async (userId: string) => {
    setLoading(true);
    try {
      const allRequests: SupportRequest[] = [];
      const collectionsToCheck = ['applications', 'msme-applications', 'pan-applications', 'gst-applications', 'bookings'];
      for (const colName of collectionsToCheck) {
        try {
          let q = colName === "bookings" ? query(collection(db, colName)) : query(collection(db, colName), where("assignedTo", "==", userId));
          const snapshot = await getDocs(q);
          snapshot.forEach((docSnap) => {
            const data: any = docSnap.data();
            let uiStatus: RequestStatus = 'Assigned';
            const rawStatus = (data.status || data.taskStatus || 'submitted').toLowerCase();
            if (rawStatus === 'completed' || rawStatus === 'approved') uiStatus = 'Completed';
            else if (rawStatus === 'processing' || rawStatus === 'in-progress' || rawStatus === 'review') uiStatus = 'In Progress';
            else if (rawStatus === 'admin' || rawStatus === 'rejected') uiStatus = 'Admin';
            
            allRequests.push({
              id: docSnap.id, customerId: data.userId || data.customerId, userId: data.userId,
              customerName: data.customerName || data.businessName || data.fullName || 'User',
              customerEmail: data.userEmail || data.email || 'no-email@example.com',
              issueType: data.title || data.serviceType || colName, status: uiStatus,
              date: formatDate(data.submittedAt || data.date || Date.now()), applications: [], rawStatus
            });
          });
        } catch (err) {}
      }
      setRequests(allRequests);
    } finally { setLoading(false); }
  };

  const handleStatusUpdate = async (reqId: string, newStatus: RequestStatus) => {
    setUpdating(true);
    try {
      setRequests(prev => prev.map(r => r.id === reqId ? { ...r, status: newStatus } : r));
      if (selectedRequest && selectedRequest.id === reqId) setSelectedRequest({ ...selectedRequest, status: newStatus });
    } finally { setUpdating(false); }
  };

  const filteredRequests = requests.filter(req => (filter === 'All' || req.status === filter) && req.customerName.toLowerCase().includes(searchTerm.toLowerCase()));

  const counts = {
    Assigned: requests.filter(r => r.status === 'Assigned').length,
    'In Progress': requests.filter(r => r.status === 'In Progress').length,
    Completed: requests.filter(r => r.status === 'Completed').length,
  };

  if (loading) return <div className="min-h-screen flex justify-center items-center"><Loader2 className="animate-spin text-cyan-500" size={40} /></div>;

  return (
    <div className="p-6 md:p-8 min-h-screen bg-background text-slate-200 font-sans selection:bg-cyan-500/30">
      <div className="mb-8 flex justify-between items-end">
        <div><h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Support Dashboard</h1><p className="text-slate-400">Live dashboard for your assigned tasks.</p></div>
        <button onClick={() => fetchSupportRequests(currentUser.uid)} className="p-2 bg-white/5 rounded-lg hover:bg-white/10"><RefreshCw size={18} /></button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <StatCard title="Assigned Requests" count={counts.Assigned} icon={<Inbox size={24} className="text-cyan-400" />} colorClass="text-cyan-400" isActive={filter === 'Assigned'} onClick={() => setFilter(filter === 'Assigned' ? 'All' : 'Assigned')} />
        <StatCard title="In Progress" count={counts['In Progress']} icon={<Clock size={24} className="text-blue-400" />} colorClass="text-blue-400" isActive={filter === 'In Progress'} onClick={() => setFilter(filter === 'In Progress' ? 'All' : 'In Progress')} />
        <StatCard title="Resolved Tickets" count={counts.Completed} icon={<CheckCircle size={24} className="text-emerald-400" />} colorClass="text-emerald-400" isActive={filter === 'Completed'} onClick={() => setFilter(filter === 'Completed' ? 'All' : 'Completed')} />
        <StatCard title="Avg Response Time" count="45m" icon={<TrendingUp size={24} className="text-purple-400" />} colorClass="text-purple-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        <div className="bg-card border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-2"><BarChart2 className="text-orange-400" size={18} /> Priority Distribution</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={priorityData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {priorityData.map((entry, index) => <Cell key={index} fill={PRIORITY_COLORS[index % PRIORITY_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                <Legend verticalAlign="bottom" height={36}/>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="bg-card border border-white/5 rounded-2xl p-6">
          <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-2"><Star className="text-yellow-400" size={18} /> CSAT Ratings</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={csatData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} cursor={{fill: '#1e293b'}} />
                <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="bg-card/40 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="flex justify-between items-center p-4 border-b border-white/5">
          <div className="flex gap-2">
            {(['All', 'Assigned', 'In Progress', 'Completed'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)} className={`px-4 py-1.5 rounded-lg text-sm font-medium ${filter === s ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>{s}</button>
            ))}
          </div>
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" /><input type="text" placeholder="Search..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="bg-background border border-white/10 rounded-lg pl-9 pr-4 py-1.5 text-sm text-white focus:outline-none focus:border-cyan-500/50" /></div>
        </div>
        <table className="w-full text-left border-collapse">
          <thead><tr className="border-b border-white/5 bg-white/[0.02]">
            <th className="p-4 text-xs font-semibold text-slate-400 uppercase">Customer</th><th className="p-4 text-xs font-semibold text-slate-400 uppercase">Issue</th><th className="p-4 text-xs font-semibold text-slate-400 uppercase">Status</th><th className="p-4 text-xs font-semibold text-slate-400 uppercase">Date</th>
          </tr></thead>
          <tbody className="divide-y divide-white/5">
            {filteredRequests.map(req => (
              <tr key={req.id} onClick={() => setSelectedRequest(req)} className="hover:bg-white/[0.03] cursor-pointer">
                <td className="p-4"><div className="text-sm font-medium text-white">{req.customerName}</div></td>
                <td className="p-4 text-sm text-slate-300">{req.issueType}</td>
                <td className="p-4"><StatusBadge status={req.status} /></td>
                <td className="p-4 text-sm text-slate-400">{formatDate(req.date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <CustomerSidebar request={selectedRequest} onClose={() => setSelectedRequest(null)} onStatusChange={handleStatusUpdate} />
    </div>
  );
};
export default SupportDashboard;