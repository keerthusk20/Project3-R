import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { mockDbService } from '../services/mockFirebase';
import { UserProfile, ServiceDocument } from '../types';
import { FileText, Clock, CheckCircle, XCircle, MessageSquare, ExternalLink } from 'lucide-react';
import BackButton from '../components/BackButton';

interface MyServicesProps {
  user: UserProfile;
}

type TabType = 'active' | 'pending' | 'completed' | 'closed' | 'support';

const MyServices: React.FC<MyServicesProps> = ({ user }) => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('active');
  const [services, setServices] = useState<ServiceDocument[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const docs = await mockDbService.getDocuments(user.uid);
        setServices(docs.sort((a, b) => b.submittedAt - a.submittedAt));
      } catch (error) {
        console.error("Failed to fetch services", error);
      } finally {
        setLoading(false);
      }
    };
    fetchServices();
  }, [user.uid]);

  // Filter services based on active tab
  const filteredServices = services.filter(doc => {
    if (activeTab === 'active') return ['submitted', 'processing', 'paid'].includes(doc.status || '');
    if (activeTab === 'pending') return ['submitted', 'paid'].includes(doc.status || '');
    if (activeTab === 'completed') return doc.status === 'approved';
    if (activeTab === 'closed') return doc.status === 'rejected';
    if (activeTab === 'support') return doc.messages && doc.messages.length > 0;
    return true;
  });

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'approved': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'processing': return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
      case 'submitted': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
      case 'rejected': return 'text-red-400 bg-red-500/10 border-red-500/20';
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20';
    }
  };

  const tabs: { id: TabType; label: string }[] = [
    { id: 'active', label: 'Active' },
    { id: 'pending', label: 'Pending' },
    { id: 'completed', label: 'Completed' },
    { id: 'closed', label: 'Closed' },
    { id: 'support', label: 'Support Requests' },
  ];

  // --- DARK MODE COLOR CONSTANTS ---
  // Lighter Teal/Cyan for better visibility on dark bg
  const headingGradientClass = "text-primary bg-clip-text text-transparent";
  
  // Red/Orange Gradient for actions
  const actionGradientClass = "bg-gradient-to-r from-heading-from to-heading-to";
  const actionGradientHoverClass = "hover:from-red-600 hover:to-orange-600";
  
  // Active Tab: Bright Red/Orange text and border
  const activeTabClass = "border-orange-500 text-orange-500 shadow-[0_2px_10px_rgba(249,115,22,0.3)]";

  return (
    <div className="p-6 md:p-8 min-h-screen bg-background text-foreground relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
      <BackButton />

      {/* Heading: Teal/Cyan/Blue Gradient */}
      <h1 className={`text-2xl md:text-3xl font-bold mb-8 ${headingGradientClass}`}>My Services</h1>

      {/* Tabs */}
      <div className="flex border-b border-white/10 mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-all duration-300 ${
              activeTab === tab.id
                ? `${activeTabClass} font-bold` 
                : 'border-transparent text-gray-400 hover:text-white hover:border-gray-600'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading services...</div>
      ) : filteredServices.length === 0 ? (
        <div className="text-center py-20 bg-[#0f172a]/50 rounded-2xl border border-dashed border-white/10 backdrop-blur-md flex-1 flex flex-col items-center justify-center">
          <div className="inline-flex items-center justify-center w-24 h-24 rounded-full bg-white/5 mb-6">
            <FileText className="h-10 w-10 text-gray-400" />
          </div>
          {/* Sub-heading: Teal/Cyan/Blue Gradient */}
          <h3 className={`text-2xl font-bold mb-2 ${headingGradientClass}`}>No services found</h3>
          <p className="text-gray-400 mt-1 mb-8 text-lg">You haven't applied for any services in this category yet.</p>
          
          {/* Button: Red/Orange Gradient */}
          <button 
            onClick={() => navigate('/services')}
            className={`inline-flex items-center px-8 py-3.5 border border-transparent text-base font-bold rounded-xl shadow-lg text-white ${actionGradientClass} ${actionGradientHoverClass} transition-all transform hover:scale-105 hover:shadow-orange-500/25`}
          >
            Apply for a Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredServices.map((doc) => (
            <div key={doc.id} className="bg-[#0f172a] rounded-2xl border border-white/10 shadow-sm overflow-hidden hover:shadow-xl hover:border-white/20 transition-all group backdrop-blur-sm">
              {/* Card Header */}
              <div className="p-6 md:p-8 border-b border-white/5 bg-white/[0.02] flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  {/* Title: Teal/Cyan/Blue Gradient */}
                  <h3 className={`text-xl md:text-2xl font-bold ${headingGradientClass}`}>{doc.title}</h3>
                  <p className="text-sm text-gray-500 mt-1 font-mono tracking-wider uppercase">Ticket no #{doc.serviceId || doc.id.slice(-6)}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`px-4 py-1.5 rounded-full text-xs font-bold border tracking-wide uppercase ${getStatusColor(doc.status)}`}>
                    {doc.status || 'Unknown'}
                  </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6 md:p-8">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Status</p>
                    <p className="text-sm text-gray-300">
                      {doc.status === 'approved' ? 'Service Completed' : 'Application Status Check'}
                    </p>
                  </div>
                  
                  <div className="flex gap-4">
                    {doc.messages && doc.messages.length > 0 && (
                       /* Link: Red/Orange Gradient Text Effect */
                       <button className="text-sm font-medium bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent hover:from-red-300 hover:to-orange-300 flex items-center gap-1.5 transition-all">
                         <MessageSquare size={14} className="text-orange-400" /> Chat
                       </button>
                    )}
                    {/* Link: Red/Orange Gradient Text Effect */}
                    <button className="text-sm font-medium bg-gradient-to-r from-red-400 to-orange-400 bg-clip-text text-transparent hover:from-red-300 hover:to-orange-300 flex items-center gap-1.5 transition-all">
                      View all Invoices <ExternalLink size={14} className="text-orange-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MyServices;