import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle, Clock, FileText, Users, Star, Calendar, DollarSign, Activity, Briefcase, ChevronRight } from 'lucide-react';
import { collection, doc, getDoc, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../services/firebase';
import { UserProfile, UserRole } from '../types';
import { getExpertConsultations } from '../services/consultationService';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

type SimpleDoc = {
  id: string; userId?: string; title?: string; serviceName?: string; status?: string; taskStatus?: string;
};

type ExpertBooking = {
  id: string; caseId?: string; userId?: string; userName?: string; userEmail?: string; consultationType?: string; date?: string; time?: string; status?: string; notes?: string;
};

// MOCK DATA FOR CHARTS
const earningsData = [
  { name: 'Week 1', earnings: 4500 },
  { name: 'Week 2', earnings: 5200 },
  { name: 'Week 3', earnings: 4800 },
  { name: 'Week 4', earnings: 6100 },
];

const specializationData = [
  { name: 'Tax Advice', value: 45 },
  { name: 'Legal Consult', value: 30 },
  { name: 'Audit', value: 15 },
  { name: 'Compliance', value: 10 },
];
const COLORS = ['#06b6d4', '#8b5cf6', '#f59e0b', '#10b981'];

const ExpertDashboard: React.FC<{ user: UserProfile }> = ({ user }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [consultations, setConsultations] = useState<any[]>([]);
  const [bookings, setBookings] = useState<ExpertBooking[]>([]);
  const [customerDocs, setCustomerDocs] = useState<SimpleDoc[]>([]);
  const [recentClients, setRecentClients] = useState<UserProfile[]>([]);

  const isBlocked = user.role !== UserRole.EXPERT || !user.isExpert || user.status !== 'active';

  const customerIds = useMemo(() => {
    const fromConsultations = consultations.map((c) => c.customerId).filter(Boolean);
    const fromBookings = bookings.map((b) => b.userId).filter(Boolean);
    return Array.from(new Set([...fromConsultations, ...fromBookings])) as string[];
  }, [consultations, bookings]);

  useEffect(() => {
    if (isBlocked) { setLoading(false); return; }
    let alive = true;
    const unsubBookings = onSnapshot(query(collection(db, 'consultationBookings'), where('assignedTo', '==', user.uid)), (snap) => {
      if (!alive) return;
      const next = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as ExpertBooking[];
      setBookings(next.sort((a, b) => String(b.date || '').localeCompare(String(a.date || ''))));
    });

    getExpertConsultations(user.uid).then((rows) => { if (alive) setConsultations(rows); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; unsubBookings(); };
  }, [user.uid, isBlocked]);

  useEffect(() => {
    if (isBlocked) return;
    let cancelled = false;
    const loadDynamic = async () => {
      if (customerIds.length === 0) { setCustomerDocs([]); setRecentClients([]); return; }
      const clientProfiles: UserProfile[] = [];
      const docs: SimpleDoc[] = [];

      for (const uid of customerIds) {
        const userSnap = await getDoc(doc(db, 'users', uid));
        if (userSnap.exists()) clientProfiles.push(userSnap.data() as UserProfile);
      }
      for (const uid of customerIds) {
        try {
          const sub = await getDocs(collection(db, 'users', uid, 'documents'));
          sub.forEach((d) => docs.push({ id: d.id, ...(d.data() as any), userId: uid }));
        } catch {}
      }
      if (!cancelled) { setRecentClients(clientProfiles.slice(0, 8)); setCustomerDocs(docs); }
    };
    loadDynamic();
    return () => { cancelled = true; };
  }, [customerIds, isBlocked]);

  const stats = useMemo(() => {
    const activeConsultations = consultations.filter((c) => c.status === 'Assigned' || c.status === 'In-Progress').length;
    const completedConsultations = consultations.filter((c) => c.status === 'Completed').length;
    return { totalClients: customerIds.length, activeConsultations, completedConsultations };
  }, [consultations, customerDocs, customerIds.length]);

  if (isBlocked) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6 relative">
        <div className="max-w-md w-full text-center">
          <h1 className="text-2xl font-black text-white mb-2">Access Denied</h1>
          <p className="text-slate-400 mb-6">Expert dashboard access requires an approved expert account with active status.</p>
          <button onClick={() => navigate(-1)} className="px-6 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 text-slate-400 hover:text-white hover:border-slate-600 transition-all">Back</button>
        </div>
      </div>
    );
  }

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center relative"><div className="w-10 h-10 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" /></div>;
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative pb-20 p-6 md:p-8">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto relative z-10">
        <p className="text-cyan-400 text-sm font-bold uppercase tracking-wider mb-1">Expert Dashboard</p>
        <div className="flex flex-col md:flex-row justify-between md:items-end mb-8 gap-4">
            <h1 className="text-3xl md:text-4xl font-black text-white tracking-tight">Welcome back, {user.displayName?.split(' ')[0] || 'Expert'}</h1>
            <div className="flex gap-2">
                <button onClick={() => navigate('/calendar')} className="bg-secondary/50 border border-border px-4 py-2 rounded-lg text-sm font-bold text-white hover:bg-secondary flex items-center gap-2 transition-all"><Calendar size={16}/> Update Availability</button>
                <button className="bg-gradient-primary border border-cyan-500/30 px-4 py-2 rounded-lg text-sm font-bold text-white shadow-lg shadow-cyan-500/20 hover:scale-105 flex items-center gap-2 transition-all"><CheckCircle size={16}/> Submit Deliverables</button>
            </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card title="Assigned Consultations" value={stats.activeConsultations} icon={<Briefcase size={24} className="text-cyan-400" />} />
          <Card title="Completed Tasks" value={stats.completedConsultations} icon={<CheckCircle size={24} className="text-emerald-400" />} />
          <Card title="Expert Rating" value="4.8/5.0" icon={<Star size={24} className="text-amber-400" />} />
          <Card title="Monthly Earnings" value="₹20,600" icon={<DollarSign size={24} className="text-emerald-400" />} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-2"><Activity size={18} className="text-emerald-400"/> Revenue Trend (This Month)</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={earningsData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                        <XAxis dataKey="name" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} cursor={{fill: '#1e293b'}} />
                        <Bar dataKey="earnings" fill="#10b981" radius={[4, 4, 0, 0]} />
                    </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            <div className="bg-card border border-border rounded-2xl p-6">
                <h3 className="text-lg font-bold mb-6 text-white flex items-center gap-2"><Briefcase size={18} className="text-purple-400"/> Specialization Utilization</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie data={specializationData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                        {specializationData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                    </PieChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <section>
            <div className="flex justify-between items-end mb-3">
                <h2 className="text-white font-bold">Pending Consultations</h2>
                <button onClick={() => navigate('/consult')} className="text-cyan-400 text-xs font-bold hover:underline flex items-center">View All <ChevronRight size={14}/></button>
            </div>
            <div className="grid grid-cols-1 gap-3">
                {consultations.length === 0 ? <Empty label="No assigned consultations yet." /> : consultations.slice(0, 4).map((c) => (
                <div key={c.id} className="bg-card border border-border hover:border-cyan-500/30 transition-all rounded-xl p-5 cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs text-amber-400 font-bold uppercase tracking-wider">{c.serviceCategory}</p>
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">{c.status}</span>
                    </div>
                    <p className="text-white font-bold text-lg mb-1">{c.customerName}</p>
                    <p className="text-slate-400 text-sm mb-3">{c.serviceType}</p>
                    <div className="flex gap-2">
                        <button className="flex-1 bg-secondary hover:bg-muted border border-border py-2 rounded-lg text-xs font-bold text-white transition-all">Review Case</button>
                    </div>
                </div>
                ))}
            </div>
            </section>

            <section>
            <div className="flex justify-between items-end mb-3">
                <h2 className="text-white font-bold">Upcoming Bookings</h2>
                <button onClick={() => navigate('/calendar')} className="text-cyan-400 text-xs font-bold hover:underline flex items-center">View Calendar <ChevronRight size={14}/></button>
            </div>
            <div className="grid grid-cols-1 gap-3">
                {bookings.length === 0 ? <Empty label="No assigned booking records yet." /> : bookings.slice(0, 4).map((b) => (
                <div key={b.id} className="bg-card border border-border hover:border-cyan-500/30 transition-all rounded-xl p-5 cursor-pointer">
                    <div className="flex justify-between items-start mb-2">
                        <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider">{b.consultationType || 'Consultation'}</p>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-slate-400"><Clock size={12}/> {b.date || '-'} {b.time || ''}</span>
                    </div>
                    <p className="text-white font-bold text-lg mb-1">{b.userName || 'Customer'}</p>
                    <p className="text-slate-400 text-sm mb-3">{b.userEmail || '-'}</p>
                    <div className="flex gap-2">
                        <button className="flex-1 bg-gradient-primary shadow-lg shadow-cyan-500/20 py-2 rounded-lg text-xs font-bold text-white transition-all">Join Call</button>
                    </div>
                </div>
                ))}
            </div>
            </section>
        </div>

      </div>
    </div>
  );
};

const Card: React.FC<{ title: string; value: string | number; icon: React.ReactNode }> = ({ title, value, icon }) => (
  <div className="bg-card border border-border rounded-2xl p-6 relative overflow-hidden group">
    <div className="flex justify-between items-start mb-2">
      <div className="p-3 bg-secondary rounded-xl">{icon}</div>
      <span className="text-3xl font-black text-white">{value}</span>
    </div>
    <p className="text-sm font-bold text-muted-foreground uppercase">{title}</p>
  </div>
);

const Empty: React.FC<{ label: string }> = ({ label }) => (
  <div className="bg-card border border-dashed border-border rounded-xl p-8 text-center text-slate-500 text-sm font-medium">{label}</div>
);

export default ExpertDashboard;