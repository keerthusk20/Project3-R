import React, { useEffect, useState } from 'react';
import { Users, CheckCircle, Activity, Calendar, FileText, DollarSign, Shield, Briefcase, Maximize2, X, Clock, ClipboardList, TrendingUp } from 'lucide-react';
import { UserProfile, ServiceDocument } from '../../types';
import { dbService } from '../../services/dbService';
import { getSuperadminStats } from '../../services/consultationService';
import MetricCard from '../../components/superadmin/MetricCard';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line } from 'recharts';
import { collection, getDocs, query, orderBy } from 'firebase/firestore';
import { db } from '../../services/firebase';

interface SuperAdminDashboardProps {
  user: UserProfile;
}

const COLORS = ['#06b6d4', '#f97316', '#10b981', '#8b5cf6', '#3b82f6'];
const STATUS_COLORS = { pending: '#f59e0b', assigned: '#3b82f6', approved: '#10b981', rejected: '#ef4444', completed: '#10b981', in_progress: '#8b5cf6', open: '#ef4444' };

const SuperAdminDashboard: React.FC<SuperAdminDashboardProps> = ({ user }) => {
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState({
    customers: 0, admins: 0, support: 0, experts: 0, totalUsers: 0,
    appsTotal: 0, appsPending: 0, appsCompleted: 0, drafts: 0,
    consultationsTotal: 0, totalRevenue: 0, monthlyRevenue: 0,
    ticketsTotal: 0, ticketsOpen: 0, tasksActive: 0
  });

  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [appsList, setAppsList] = useState<ServiceDocument[]>([]);
  const [consultationsList, setConsultationsList] = useState<any[]>([]);
  const [ticketsList, setTicketsList] = useState<any[]>([]);
  
  const [expandedList, setExpandedList] = useState<'apps' | 'customers' | 'staff' | 'experts' | 'consultations' | 'tickets' | null>(null);

  const [revenueData, setRevenueData] = useState<any[]>([]);
  const [appStatusData, setAppStatusData] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const users = await dbService.getAllUsers();
      const apps = await dbService.getAllApplications();
      const drafts = await dbService.getAllDrafts();
      const consultStats = await getSuperadminStats();
      const tickets = await dbService.getAllTickets();

      // Fetch Consultations
      const bookingsSnap = await getDocs(query(collection(db, 'consultationBookings'), orderBy('createdAt', 'desc')));
      const consultations = bookingsSnap.docs.map(d => ({id: d.id, ...d.data()}));

      let customers = 0, admins = 0, support = 0, experts = 0;
      users.forEach(u => {
        if (u.role === 'customer') customers++;
        if (u.role === 'admin') admins++;
        if (u.role === 'support') support++;
        if (u.role === 'expert') experts++;
      });
      
      let appsPending = 0, appsCompleted = 0, totalRevenue = 0, monthlyRevenue = 0, tasksActive = 0;
      const statusCounts: Record<string, number> = {};
      const revByMonth: Record<string, number> = {};
      const currentMonth = new Date().toISOString().slice(0, 7);

      apps.forEach(app => {
        const stat = (app.status as string) || 'pending';
        if (stat === 'approved' || stat === 'completed') appsCompleted++;
        else appsPending++;
        
        statusCounts[stat] = (statusCounts[stat] || 0) + 1;
        
        if (app.taskStatus === 'assigned') tasksActive++;

        if (app.amount) {
           const amt = typeof app.amount === 'string' ? parseFloat(app.amount) : app.amount;
           if (!isNaN(amt)) {
             totalRevenue += amt;
             const submittedAt = new Date(app.submittedAt);
             const month = submittedAt.toISOString().slice(0, 7);
             if (month === currentMonth) monthlyRevenue += amt;
             
             const monthName = submittedAt.toLocaleString('default', { month: 'short' });
             revByMonth[monthName] = (revByMonth[monthName] || 0) + amt;
           }
        }
      });

      // Prepare Revenue Chart Data
      const revChartData = Object.keys(revByMonth).map(k => ({ name: k, revenue: revByMonth[k] }));
      
      // Prepare App Status Chart Data
      const appStatData = Object.keys(statusCounts).map(k => ({ name: k.charAt(0).toUpperCase() + k.slice(1), value: statusCounts[k] }));

      let ticketsOpen = 0;
      tickets.forEach(t => {
        if (t.status === 'open' || t.status === 'in_progress') ticketsOpen++;
      });

      setMetrics({
        customers, admins, support, experts, totalUsers: users.length,
        appsTotal: apps.length, appsPending, appsCompleted, drafts: drafts.length,
        consultationsTotal: consultations.length, totalRevenue, monthlyRevenue,
        ticketsTotal: tickets.length, ticketsOpen, tasksActive
      });

      setUsersList(users.sort((a, b) => b.createdAt - a.createdAt));
      setAppsList(apps);
      setConsultationsList(consultations);
      setTicketsList(tickets);
      setRevenueData(revChartData.reverse());
      setAppStatusData(appStatData);

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const pieData = [
    { name: 'Customers', value: metrics.customers },
    { name: 'Admins', value: metrics.admins },
    { name: 'Support', value: metrics.support },
    { name: 'Experts', value: metrics.experts }
  ].filter(d => d.value > 0);

  const staffList = usersList.filter(u => u.role === 'admin' || u.role === 'support');
  const expertsOnlyList = usersList.filter(u => u.role === 'expert');
  const customersOnlyList = usersList.filter(u => u.role === 'customer');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
     return <div className="p-10 flex justify-center"><Activity className="animate-spin text-cyan-400" size={32} /></div>;
  }

  const renderAppsTable = (limit?: number) => (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 bg-card z-10">
        <tr className="text-muted-foreground border-b border-border">
          <th className="pb-2 font-bold">Service Type</th>
          <th className="pb-2 font-bold">Customer ID</th>
          <th className="pb-2 font-bold">Amount</th>
          <th className="pb-2 font-bold">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {(limit ? appsList.slice(0, limit) : appsList).map(app => (
          <tr key={app.id} className="hover:bg-muted/50">
            <td className="py-3 capitalize font-semibold text-foreground">{app.type?.replace(/-/g, ' ')}</td>
            <td className="py-3 text-muted-foreground">{app.userId.slice(0, 8)}...</td>
            <td className="py-3 font-semibold text-emerald-400">{app.amount ? formatCurrency(typeof app.amount === 'string' ? parseFloat(app.amount) : app.amount) : 'Free'}</td>
            <td className="py-3">
               <span className={`px-2 py-1 text-[10px] rounded-md font-bold uppercase tracking-wider border ${app.status === 'approved' || (app.status as string) === 'completed' ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-orange-500/30 text-orange-400 bg-orange-500/10'}`}>
                 {app.status || 'Pending'}
               </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderConsultationsTable = (limit?: number) => (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 bg-card z-10">
        <tr className="text-muted-foreground border-b border-border">
          <th className="pb-2 font-bold">Customer</th>
          <th className="pb-2 font-bold">Type</th>
          <th className="pb-2 font-bold">Date</th>
          <th className="pb-2 font-bold">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {(limit ? consultationsList.slice(0, limit) : consultationsList).map(c => (
          <tr key={c.id} className="hover:bg-muted/50">
            <td className="py-3 font-semibold text-foreground">{c.userName || 'Unknown'}</td>
            <td className="py-3 text-muted-foreground">{c.consultationType}</td>
            <td className="py-3 text-muted-foreground">{c.date} {c.time}</td>
            <td className="py-3">
               <span className={`px-2 py-1 text-[10px] rounded-md font-bold uppercase tracking-wider border ${(c.status === 'completed' || c.status === 'confirmed') ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-orange-500/30 text-orange-400 bg-orange-500/10'}`}>
                 {c.status || 'Pending'}
               </span>
            </td>
          </tr>
        ))}
        {consultationsList.length === 0 && <tr><td colSpan={4} className="py-3 text-muted-foreground text-center">No consultations found.</td></tr>}
      </tbody>
    </table>
  );

  const renderTicketsTable = (limit?: number) => (
    <table className="w-full text-left text-sm">
      <thead className="sticky top-0 bg-card z-10">
        <tr className="text-muted-foreground border-b border-border">
          <th className="pb-2 font-bold">Ticket No.</th>
          <th className="pb-2 font-bold">Subject</th>
          <th className="pb-2 font-bold">Priority</th>
          <th className="pb-2 font-bold">Status</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {(limit ? ticketsList.slice(0, limit) : ticketsList).map(t => (
          <tr key={t.id} className="hover:bg-muted/50">
            <td className="py-3 font-semibold text-cyan-400">{t.ticketNumber}</td>
            <td className="py-3 text-foreground truncate max-w-[150px]">{t.title}</td>
            <td className={`py-3 font-bold ${t.priority === 'high' ? 'text-rose-400' : t.priority === 'medium' ? 'text-orange-400' : 'text-blue-400'}`}>{t.priority?.toUpperCase()}</td>
            <td className="py-3">
               <span className={`px-2 py-1 text-[10px] rounded-md font-bold uppercase tracking-wider border ${(t.status === 'resolved' || t.status === 'closed') ? 'border-emerald-500/30 text-emerald-400 bg-emerald-500/10' : 'border-rose-500/30 text-rose-400 bg-rose-500/10'}`}>
                 {t.status || 'Open'}
               </span>
            </td>
          </tr>
        ))}
        {ticketsList.length === 0 && <tr><td colSpan={4} className="py-3 text-muted-foreground text-center">No tickets found.</td></tr>}
      </tbody>
    </table>
  );

  const renderUserList = (list: UserProfile[], roleLabel: string, colorClass: string, limit?: number) => (
    <div className="space-y-3">
      {(limit ? list.slice(0, limit) : list).map(u => (
        <div key={u.uid} className="flex justify-between items-center p-3 rounded-xl border border-border/50 bg-secondary/30">
          <div>
            <p className="font-bold text-sm text-foreground">{u.displayName || 'Unnamed'}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[150px]">{u.email}</p>
          </div>
          <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded ${u.role === 'admin' ? 'text-rose-400 bg-rose-500/10' : colorClass}`}>
            {u.role === 'admin' || u.role === 'support' ? u.role : roleLabel}
          </span>
        </div>
      ))}
      {list.length === 0 && <p className="text-xs text-muted-foreground">No records found.</p>}
    </div>
  );

  return (
    <div className="p-6 md:p-10 animate-fade-in relative max-w-[1600px] mx-auto bg-background text-foreground min-h-screen">
      <div className="mb-10">
        <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-tight flex items-center gap-3">
          <Activity className="text-cyan-400" size={36} /> SuperAdmin Operations Hub
        </h1>
        <p className="text-muted-foreground text-sm font-medium mt-2">
          Comprehensive real-time platform analytics, user tracking, and administrative controls.
        </p>
      </div>

      {/* Main Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
        <MetricCard title="Total Users" value={metrics.totalUsers} icon={<Users size={20} />} colorClass="text-cyan-400 bg-cyan-500/10" />
        <MetricCard title="Customers" value={metrics.customers} icon={<Users size={20} />} colorClass="text-blue-400 bg-blue-500/10" />
        <MetricCard title="Staff & Admins" value={metrics.admins + metrics.support} icon={<Shield size={20} />} colorClass="text-purple-400 bg-purple-500/10" />
        <MetricCard title="Experts" value={metrics.experts} icon={<Briefcase size={20} />} colorClass="text-orange-400 bg-orange-500/10" />
        <MetricCard title="Total Revenue" value={formatCurrency(metrics.totalRevenue)} icon={<DollarSign size={20} />} colorClass="text-emerald-400 bg-emerald-500/10" />
        <MetricCard title="Monthly Revenue" value={formatCurrency(metrics.monthlyRevenue)} icon={<TrendingUp size={20} />} colorClass="text-emerald-300 bg-emerald-500/20" />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <MetricCard title="Total Apps" value={metrics.appsTotal} icon={<FileText size={20} />} colorClass="text-indigo-400 bg-indigo-500/10" />
        <MetricCard title="Pending Apps" value={metrics.appsPending} icon={<Clock size={20} />} colorClass="text-amber-400 bg-amber-500/10" />
        <MetricCard title="Completed Apps" value={metrics.appsCompleted} icon={<CheckCircle size={20} />} colorClass="text-emerald-400 bg-emerald-500/10" />
        <MetricCard title="Consultations" value={metrics.consultationsTotal} icon={<Calendar size={20} />} colorClass="text-rose-400 bg-rose-500/10" />
        <MetricCard title="Active Tasks" value={metrics.tasksActive} icon={<Activity size={20} />} colorClass="text-cyan-400 bg-cyan-500/10" />
        <MetricCard title="Open Tickets" value={metrics.ticketsOpen} icon={<ClipboardList size={20} />} colorClass="text-red-400 bg-red-500/10" />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        {/* User Distribution */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><Users className="text-cyan-400" size={18}/> User Distribution</h3>
          <div className="h-64">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                    {pieData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                  <Legend verticalAlign="bottom" height={36} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center"><p className="text-muted-foreground">No data</p></div>
            )}
          </div>
        </div>

        {/* Revenue Chart */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><TrendingUp className="text-emerald-400" size={18}/> Monthly Revenue</h3>
          <div className="h-64">
            {revenueData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `₹${val/1000}k`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} 
                    formatter={(val: number) => [formatCurrency(val), 'Revenue']}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} dot={{ fill: '#10b981', strokeWidth: 2 }} activeDot={{ r: 6 }} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center"><p className="text-muted-foreground">Not enough data</p></div>
            )}
          </div>
        </div>

        {/* App Status Chart */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg">
          <h3 className="text-lg font-bold mb-6 flex items-center gap-2"><FileText className="text-blue-400" size={18}/> Application Status</h3>
          <div className="h-64">
            {appStatusData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={appStatusData} layout="vertical" margin={{ top: 0, right: 0, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={true} vertical={false} />
                  <XAxis type="number" stroke="#64748b" fontSize={12} hide />
                  <YAxis dataKey="name" type="category" stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} width={80} />
                  <Tooltip cursor={{ fill: '#1e293b' }} contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} />
                  <Bar dataKey="value" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20}>
                    {appStatusData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={STATUS_COLORS[entry.name.toLowerCase() as keyof typeof STATUS_COLORS] || '#3b82f6'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center"><p className="text-muted-foreground">No data</p></div>
            )}
          </div>
        </div>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        
        {/* Recent Applications */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg overflow-hidden flex flex-col relative group">
          <button onClick={() => setExpandedList('apps')} className="absolute top-6 right-6 text-muted-foreground hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
            <Maximize2 size={18} />
          </button>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 pr-8"><FileText className="text-blue-400" size={18}/> Recent Applications</h3>
          <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar max-h-64">
             {renderAppsTable(10)}
          </div>
        </div>

        {/* Recent Consultations */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg overflow-hidden flex flex-col relative group">
          <button onClick={() => setExpandedList('consultations')} className="absolute top-6 right-6 text-muted-foreground hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
            <Maximize2 size={18} />
          </button>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 pr-8"><Calendar className="text-rose-400" size={18}/> Recent Consultations</h3>
          <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar max-h-64">
             {renderConsultationsTable(10)}
          </div>
        </div>

        {/* Support Tickets */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg overflow-hidden flex flex-col relative group">
          <button onClick={() => setExpandedList('tickets')} className="absolute top-6 right-6 text-muted-foreground hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
            <Maximize2 size={18} />
          </button>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 pr-8"><ClipboardList className="text-orange-400" size={18}/> Support Tickets</h3>
          <div className="overflow-y-auto flex-1 pr-2 custom-scrollbar max-h-64">
             {renderTicketsTable(10)}
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Customers List */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg overflow-hidden flex flex-col relative group">
          <button onClick={() => setExpandedList('customers')} className="absolute top-6 right-6 text-muted-foreground hover:text-cyan-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
            <Maximize2 size={18} />
          </button>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 pr-8"><Users className="text-cyan-400" size={18}/> Recent Customers</h3>
          <div className="overflow-y-auto max-h-72 custom-scrollbar pr-2">
             {renderUserList(customersOnlyList, 'Customer', 'text-cyan-400 bg-cyan-500/10', 10)}
          </div>
        </div>

        {/* Staff List */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg overflow-hidden flex flex-col relative group">
          <button onClick={() => setExpandedList('staff')} className="absolute top-6 right-6 text-muted-foreground hover:text-purple-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
            <Maximize2 size={18} />
          </button>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 pr-8"><Shield className="text-purple-400" size={18}/> Staff Directory</h3>
          <div className="overflow-y-auto max-h-72 custom-scrollbar pr-2">
             {renderUserList(staffList, 'Staff', 'text-purple-400 bg-purple-500/10')}
          </div>
        </div>

        {/* Experts List */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-lg overflow-hidden flex flex-col relative group">
          <button onClick={() => setExpandedList('experts')} className="absolute top-6 right-6 text-muted-foreground hover:text-orange-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
            <Maximize2 size={18} />
          </button>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 pr-8"><Briefcase className="text-orange-400" size={18}/> Expert Directory</h3>
          <div className="overflow-y-auto max-h-72 custom-scrollbar pr-2">
             {renderUserList(expertsOnlyList, 'Expert', 'text-orange-400 bg-orange-500/10')}
          </div>
        </div>

      </div>

      {/* ── Expanded List Modal ── */}
      {expandedList && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-2xl w-full max-w-5xl max-h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center p-6 border-b border-border">
              <h2 className="text-xl font-bold flex items-center gap-2">
                {expandedList === 'apps' && <><FileText className="text-blue-400"/> All Applications ({appsList.length})</>}
                {expandedList === 'consultations' && <><Calendar className="text-rose-400"/> All Consultations ({consultationsList.length})</>}
                {expandedList === 'tickets' && <><ClipboardList className="text-orange-400"/> All Tickets ({ticketsList.length})</>}
                {expandedList === 'customers' && <><Users className="text-cyan-400"/> All Customers ({customersOnlyList.length})</>}
                {expandedList === 'staff' && <><Shield className="text-purple-400"/> Staff Directory ({staffList.length})</>}
                {expandedList === 'experts' && <><Briefcase className="text-orange-400"/> Expert Directory ({expertsOnlyList.length})</>}
              </h2>
              <button onClick={() => setExpandedList(null)} className="text-muted-foreground hover:text-rose-400 transition-colors">
                <X size={24} />
              </button>
            </div>
            <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
              {expandedList === 'apps' && renderAppsTable()}
              {expandedList === 'consultations' && renderConsultationsTable()}
              {expandedList === 'tickets' && renderTicketsTable()}
              {expandedList === 'customers' && renderUserList(customersOnlyList, 'Customer', 'text-cyan-400 bg-cyan-500/10')}
              {expandedList === 'staff' && renderUserList(staffList, 'Staff', 'text-purple-400 bg-purple-500/10')}
              {expandedList === 'experts' && renderUserList(expertsOnlyList, 'Expert', 'text-orange-400 bg-orange-500/10')}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SuperAdminDashboard;
