import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus, Search, CheckCircle, Clock, AlertCircle, User, Send,
  BarChart3, Users, ClipboardList, Headset, Loader2, FileText,
  CreditCard, HelpCircle, Settings, X, ChevronLeft, Play, Archive,
  Trash2
} from 'lucide-react';
import { UserRole, UserProfile } from '../types';
import { db } from '../services/firebase';
import {
  collection,
  addDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  doc,
  query,
  orderBy,
  where,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';

// --- Types ---
interface TicketUpdate {
  id: string;
  author: string;
  authorId: string;
  message: string;
  timestamp: any;
  type: 'comment' | 'status_change' | 'assignment';
}

interface Ticket {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: string;
  department: string;
  status: 'open' | 'assigned' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high';
  raisedBy: string;
  raisedById: string;
  assignedTo: string | null;
  assignedToId: string | null;
  applicationId: string;
  createdAt: any;
  updatedAt: any;
  resolvedAt: any | null;
  closedAt: any | null;
  slaDeadline: any | null;
  updates: TicketUpdate[];
}

interface SupportAgent {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface TicketsPageProps {
  user: UserProfile;
}

interface TicketCategory {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  department: string;
}

const TicketsPage: React.FC<TicketsPageProps> = ({ user }) => {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [supportAgents, setSupportAgents] = useState<SupportAgent[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'list' | 'detail' | 'metrics'>('list');
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showCategorySelection, setShowCategorySelection] = useState(true);
  const [tableView, setTableView] = useState(true);

  interface NewTicketForm {
    title: string;
    description: string;
    category: string;
    priority: 'low' | 'medium' | 'high';
    department: string;
    applicationId?: string;
  }

  const [newTicket, setNewTicket] = useState<NewTicketForm>({
    title: '',
    description: '',
    category: '',
    priority: 'low',
    department: ''
  });

  const [assigneeSelect, setAssigneeSelect] = useState('');
  const [commentText, setCommentText] = useState('');
  const [resolutionMessage, setResolutionMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [actionLoading, setActionLoading] = useState(false);

  // 🍞 Toast Notification State
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'success' | 'error' | 'info'>('success');

  const showToastNotification = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const { role: userRole, uid: currentUserId, displayName: userName } = user;

  // 🎫 Ticket Categories
  const ticketCategories: TicketCategory[] = [
    {
      id: 'application',
      name: 'Application Support',
      description: 'Application submission, edit issues',
      icon: FileText,
      department: 'Application Support Team'
    },
    {
      id: 'document',
      name: 'Document Upload Issue',
      description: 'Document upload, verification',
      icon: ClipboardList,
      department: 'Document Verification Team'
    },
    {
      id: 'status',
      name: 'Status / Approval Issue',
      description: 'Status not updating, delays',
      icon: Clock,
      department: 'Approval Team'
    },
    {
      id: 'payment',
      name: 'Payment Issue',
      description: 'Payment failed, not updated',
      icon: CreditCard,
      department: 'Payment Support Team'
    },
    {
      id: 'account',
      name: 'Account / Login Issue',
      description: 'Cannot login, OTP issues',
      icon: User,
      department: 'Account Support Team'
    },
    {
      id: 'technical',
      name: 'Technical Problem',
      description: 'Website errors, bugs',
      icon: Settings,
      department: 'Technical Support Team'
    },
    {
      id: 'general',
      name: 'General Inquiry',
      description: 'Process doubts, requirements',
      icon: HelpCircle,
      department: 'Customer Support Team'
    }
  ];

  const parseDate = (dateData: any) => {
    if (!dateData) return new Date().toISOString();
    if (dateData instanceof Timestamp) return dateData.toDate().toISOString();
    if (typeof dateData === 'string') return dateData;
    return new Date().toISOString();
  };

  const calculateSLADeadline = (priority: string, createdAt: Date) => {
    const hours = { 'high': 4, 'medium': 12, 'low': 24 };
    const deadline = new Date(createdAt);
    deadline.setHours(deadline.getHours() + (hours[priority] || 24));
    return deadline;
  };

  const generateTicketNumber = async () => {
    const year = new Date().getFullYear();
    const q = query(
      collection(db, "tickets"),
      where("createdAt", ">=", new Date(year, 0, 1)),
      where("createdAt", "<", new Date(year + 1, 0, 1))
    );
    const snapshot = await getDocs(q);
    const count = snapshot.size + 1;
    return `TCK-${year}-${String(count).padStart(4, '0')}`;
  };

  useEffect(() => {
    if (showTicketModal || (selectedTicket && view === 'detail')) {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [showTicketModal, selectedTicket, view]);

  useEffect(() => {
    const fetchSupportAgents = async () => {
      try {
        if (userRole !== UserRole.ADMIN && userRole !== UserRole.SUPERADMIN) return;
        const q = query(collection(db, "users"), where("role", "==", UserRole.SUPPORT));
        const querySnapshot = await getDocs(q);
        const agents: SupportAgent[] = [];
        querySnapshot.forEach((doc) => {
          const data = doc.data();
          agents.push({
            id: doc.id,
            name: (data.displayName as string) || (data.email as string) || 'Unknown',
            email: data.email as string,
            role: data.role as UserRole
          });
        });
        setSupportAgents(agents);
      } catch (error) {
        console.error("Error fetching support agents:", error);
      }
    };
    fetchSupportAgents();
  }, [userRole]);

  // ✅ Real-time listener using onSnapshot
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    const setupTicketListener = async () => {
      try {
        setLoading(true);
        let q;

        if (userRole === UserRole.CUSTOMER) {
          q = query(
            collection(db, "tickets"),
            where("raisedById", "==", currentUserId)
          );
        }
        else if (userRole === UserRole.SUPPORT) {
          q = query(
            collection(db, "tickets"),
            where("assignedToId", "==", currentUserId)
          );
        }
        else {
          q = query(collection(db, "tickets"), orderBy("createdAt", "desc"));
        }

        unsubscribe = onSnapshot(q, (querySnapshot) => {
          const loadedTickets: Ticket[] = [];
          querySnapshot.forEach((doc) => {
            const data = doc.data() as any;
            loadedTickets.push({
              id: doc.id,
              ticketNumber: data.ticketNumber || `TCK-${doc.id.slice(0, 8)}`,
              title: data.title || '',
              description: data.description || '',
              category: data.category || 'general',
              department: data.department || '',
              status: data.status || 'open',
              priority: data.priority || 'medium',
              raisedBy: data.raisedBy || 'Unknown',
              raisedById: data.raisedById || '',
              assignedTo: data.assignedTo || null,
              assignedToId: data.assignedToId || null,
              applicationId: data.applicationId || '',
              createdAt: data.createdAt,
              updatedAt: data.updatedAt,
              resolvedAt: data.resolvedAt || null,
              closedAt: data.closedAt || null,
              slaDeadline: data.slaDeadline || null,
              updates: data.updates || []
            });
          });
          setTickets(loadedTickets);
          if (selectedTicket) {
            const updated = loadedTickets.find(t => t.id === selectedTicket.id);
            if (updated) setSelectedTicket(updated);
          }
          setLoading(false);
        }, (error) => {
          console.error("Error listening to tickets:", error);
          setLoading(false);
        });
      } catch (error) {
        console.error("Error setting up listener:", error);
        setLoading(false);
      }
    };

    if (currentUserId) {
      setupTicketListener();
    }

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [userRole, currentUserId]);

  // ✅ Filtered Tickets with Client-Side Sorting
  const filteredTickets = useMemo(() => {
    let filtered = [...tickets];

    if (userRole === UserRole.CUSTOMER) {
      filtered = filtered.filter(t =>
        t.raisedById === currentUserId &&
        t.status !== 'resolved' &&
        t.status !== 'closed'
      );
    }

    if (userRole === UserRole.SUPPORT) {
      filtered = filtered.filter(t => t.assignedToId === currentUserId);
    }

    if (filterCategory !== 'all' && (userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN)) {
      filtered = filtered.filter(t => t.category === filterCategory);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(t =>
        t.title.toLowerCase().includes(term) ||
        t.ticketNumber.toLowerCase().includes(term) ||
        t.description.toLowerCase().includes(term)
      );
    }

    filtered.sort((a, b) => {
      const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
      const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
      return dateB - dateA;
    });

    return filtered;
  }, [tickets, userRole, currentUserId, filterCategory, searchTerm]);

  const handleCategorySelect = (category: TicketCategory) => {
    setNewTicket({ ...newTicket, category: category.id, department: category.department });
    setShowCategorySelection(false);
  };

  // ✅ FIXED: handleCreateTicket with Timestamps and Safety Checks
  const handleCreateTicket = async () => {
    try {
      setActionLoading(true);

      // 1. VALIDATION
      if (!newTicket.title.trim() || !newTicket.description.trim()) {
        showToastNotification('Please fill in all required fields', 'error');
        return;
      }

      // 2. SAFETY CHECK: Ensure User is Logged In
      if (!currentUserId) {
        showToastNotification('User not authenticated. Please refresh.', 'error');
        return;
      }

      const now = new Date();
      const category = ticketCategories.find(c => c.id === newTicket.category);

      // 3. GENERATE TICKET NUMBER
      const ticketNumber = await generateTicketNumber();

      // 4. PREPARE DATA WITH FIREBASE TIMESTAMPS
      const createdAtTs = Timestamp.fromDate(now);
      const slaDeadlineTs = Timestamp.fromDate(calculateSLADeadline(newTicket.priority, now));

      const ticketData = {
        ticketNumber,
        title: newTicket.title.trim(),
        description: newTicket.description.trim(),
        category: newTicket.category,
        department: newTicket.department,
        priority: newTicket.priority,
        status: 'open' as const,

        // CRITICAL: This MUST match request.auth.uid in your Security Rules
        raisedById: currentUserId,
        raisedBy: userName || 'Unknown',

        assignedTo: null,
        assignedToId: null,
        applicationId: newTicket.applicationId || '',

        // Use Timestamps instead of raw Date objects
        createdAt: createdAtTs,
        updatedAt: createdAtTs,
        resolvedAt: null,
        closedAt: null,
        slaDeadline: slaDeadlineTs,

        updates: [{
          id: Date.now().toString(),
          author: userName || 'System',
          authorId: currentUserId,
          message: `Ticket created for ${category?.name || 'Support'}.`,
          timestamp: createdAtTs,
          type: 'status_change' as const
        }]
      };

      // 5. CREATE DOCUMENT
      const docRef = await addDoc(collection(db, "tickets"), ticketData);

      // 6. RESET FORM
      setNewTicket({ title: '', description: '', category: '', priority: 'low', department: '' });
      setShowTicketModal(false);
      setShowCategorySelection(true);
      showToastNotification('Ticket submitted successfully!', 'success');

    } catch (error: any) {
      console.error("Error creating ticket:", error);
      showToastNotification('Failed: ' + error.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignTicket = async (ticketId: string, supportName: string, supportId: string) => {
    if (!supportName || !supportId) return;
    setActionLoading(true);
    try {
      const ticketRef = doc(db, "tickets", ticketId);
      const newUpdate = {
        id: Date.now().toString(),
        author: userName || 'Admin',
        authorId: currentUserId,
        message: `Assigned to ${supportName}`,
        timestamp: Timestamp.fromDate(new Date()),
        type: 'assignment' as const
      };
      const currentUpdates = selectedTicket?.updates || [];

      await updateDoc(ticketRef, {
        status: 'assigned',
        assignedTo: supportName,
        assignedToId: supportId,
        updatedAt: Timestamp.fromDate(new Date()),
        updates: [...currentUpdates, newUpdate]
      });

      const updatedTicket: Ticket = {
        ...selectedTicket!,
        status: 'assigned',
        assignedTo: supportName,
        assignedToId: supportId,
        updatedAt: Timestamp.fromDate(new Date()),
        updates: [...currentUpdates, newUpdate]
      };

      setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
      setSelectedTicket(updatedTicket);
      setAssigneeSelect('');
      showToastNotification('Ticket assigned successfully!', 'success');
    } catch (error) {
      console.error("Error assigning ticket:", error);
      showToastNotification("Failed to assign ticket.", 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartWorking = async (ticketId: string) => {
    setActionLoading(true);
    try {
      const ticketRef = doc(db, "tickets", ticketId);
      const newUpdate = {
        id: Date.now().toString(),
        author: userName || 'Support',
        authorId: currentUserId,
        message: `Started working on this ticket.`,
        timestamp: Timestamp.fromDate(new Date()),
        type: 'status_change' as const
      };
      const currentUpdates = selectedTicket?.updates || [];

      await updateDoc(ticketRef, {
        status: 'in_progress',
        updatedAt: Timestamp.fromDate(new Date()),
        updates: [...currentUpdates, newUpdate]
      });

      const updatedTicket: Ticket = {
        ...selectedTicket!,
        status: 'in_progress',
        updatedAt: Timestamp.fromDate(new Date()),
        updates: [...currentUpdates, newUpdate]
      };

      setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
      setSelectedTicket(updatedTicket);
      showToastNotification('Working on ticket!', 'success');
    } catch (error) {
      console.error("Error:", error);
      showToastNotification("Failed to update status.", 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolveTicket = async (ticketId: string) => {
    if (!resolutionMessage.trim()) {
      showToastNotification('Please provide a resolution message for the customer', 'error');
      return;
    }

    setActionLoading(true);
    try {
      const ticketRef = doc(db, "tickets", ticketId);
      const newUpdate = {
        id: Date.now().toString(),
        author: userName || 'Support',
        authorId: currentUserId,
        message: `Resolution: ${resolutionMessage}`,
        timestamp: Timestamp.fromDate(new Date()),
        type: 'status_change' as const
      };
      const currentUpdates = selectedTicket?.updates || [];

      await updateDoc(ticketRef, {
        status: 'resolved',
        resolvedAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        updates: [...currentUpdates, newUpdate]
      });

      const updatedTicket: Ticket = {
        ...selectedTicket!,
        status: 'resolved',
        resolvedAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        updates: [...currentUpdates, newUpdate]
      };

      setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
      setSelectedTicket(updatedTicket);
      setResolutionMessage('');
      showToastNotification('Ticket resolved and customer notified!', 'success');
    } catch (error) {
      console.error("Error resolving ticket:", error);
      showToastNotification("Failed to resolve ticket.", 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    setActionLoading(true);
    try {
      const ticketRef = doc(db, "tickets", ticketId);
      const newUpdate = {
        id: Date.now().toString(),
        author: userName || 'User',
        authorId: currentUserId,
        message: `Ticket closed and archived.`,
        timestamp: Timestamp.fromDate(new Date()),
        type: 'status_change' as const
      };
      const currentUpdates = selectedTicket?.updates || [];

      await updateDoc(ticketRef, {
        status: 'closed',
        closedAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        updates: [...currentUpdates, newUpdate]
      });

      const updatedTicket: Ticket = {
        ...selectedTicket!,
        status: 'closed',
        closedAt: Timestamp.fromDate(new Date()),
        updatedAt: Timestamp.fromDate(new Date()),
        updates: [...currentUpdates, newUpdate]
      };

      setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
      setSelectedTicket(updatedTicket);
      showToastNotification('Ticket closed!', 'success');
    } catch (error) {
      console.error("Error:", error);
      showToastNotification("Failed to close ticket.", 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTicket = async (ticketId: string) => {
    if (!confirm('Are you sure you want to delete this ticket permanently? This action cannot be undone.')) return;
    setActionLoading(true);
    try {
      await deleteDoc(doc(db, "tickets", ticketId));
      setTickets(prev => prev.filter(t => t.id !== ticketId));
      if (selectedTicket?.id === ticketId) {
        setSelectedTicket(null);
        setView('list');
      }
      showToastNotification('Ticket deleted successfully!', 'success');
    } catch (error: any) {
      console.error("Error deleting ticket:", error);
      showToastNotification("Failed to delete ticket: " + error.message, 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddComment = async (ticketId: string) => {
    if (!commentText.trim()) return;
    setActionLoading(true);
    try {
      const ticketRef = doc(db, "tickets", ticketId);
      const newUpdate = {
        id: Date.now().toString(),
        author: userName || 'User',
        authorId: currentUserId,
        message: commentText,
        timestamp: Timestamp.fromDate(new Date()),
        type: 'comment' as const
      };
      const currentUpdates = selectedTicket?.updates || [];

      await updateDoc(ticketRef, {
        updatedAt: Timestamp.fromDate(new Date()),
        updates: [...currentUpdates, newUpdate]
      });

      const updatedTicket: Ticket = {
        ...selectedTicket!,
        updatedAt: Timestamp.fromDate(new Date()),
        updates: [...currentUpdates, newUpdate]
      };

      setTickets(prev => prev.map(t => t.id === ticketId ? updatedTicket : t));
      setSelectedTicket(updatedTicket);
      setCommentText('');
    } catch (error) {
      console.error("Error adding comment:", error);
      showToastNotification("Failed to add comment.", 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const metrics = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter(t => t.status === 'open').length,
    assigned: tickets.filter(t => t.status === 'assigned').length,
    inProgress: tickets.filter(t => t.status === 'in_progress').length,
    resolved: tickets.filter(t => t.status === 'resolved').length,
    closed: tickets.filter(t => t.status === 'closed').length,
    byPriority: {
      high: tickets.filter(t => t.priority === 'high').length,
      medium: tickets.filter(t => t.priority === 'medium').length,
      low: tickets.filter(t => t.priority === 'low').length,
    }
  }), [tickets]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'assigned': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'in_progress': return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'resolved': return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'closed': return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-500';
      case 'medium': return 'text-yellow-500';
      case 'low': return 'text-blue-500';
      default: return 'text-gray-500';
    }
  };

  const formatSLA = (deadline: any) => {
    if (!deadline) return 'N/A';
    const date = deadline instanceof Timestamp ? deadline.toDate() : new Date(deadline);
    return date.toLocaleString();
  };

  const isOverdue = (ticket: Ticket) => {
    if (!ticket.slaDeadline || ['resolved', 'closed'].includes(ticket.status)) return false;
    const deadline = ticket.slaDeadline instanceof Timestamp
      ? ticket.slaDeadline.toDate()
      : new Date(ticket.slaDeadline);
    return new Date() > deadline;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-background relative min-h-screen">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        <div className="text-center relative z-10">
          <Loader2 className="animate-spin mx-auto text-orange-500 mb-4" size={48} />
          <p className="text-gray-400">Loading tickets...</p>
        </div>
      </div>
    );
  }

  if (view === 'metrics' && userRole === UserRole.SUPERADMIN) {
    return (
      <div className="p-6 space-y-6 animate-fade-in">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-bold text-white">Overall Ticket Metrics</h2>
          <button onClick={() => setView('list')} className="text-sm text-gray-400 hover:text-white flex items-center gap-2">
            <ClipboardList size={16} /> Back to List
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400"><BarChart3 size={24} /></div>
            <div><p className="text-xs text-gray-400">Total</p><p className="text-2xl font-bold text-white">{metrics.total}</p></div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
            <div className="p-3 bg-red-500/10 rounded-lg text-red-400"><AlertCircle size={24} /></div>
            <div><p className="text-xs text-gray-400">Open</p><p className="text-2xl font-bold text-white">{metrics.open}</p></div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 rounded-lg text-blue-400"><Users size={24} /></div>
            <div><p className="text-xs text-gray-400">Assigned</p><p className="text-2xl font-bold text-white">{metrics.assigned}</p></div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
            <div className="p-3 bg-orange-500/10 rounded-lg text-orange-400"><Play size={24} /></div>
            <div><p className="text-xs text-gray-400">In Progress</p><p className="text-2xl font-bold text-white">{metrics.inProgress}</p></div>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-white/5 flex items-center gap-4">
            <div className="p-3 bg-green-500/10 rounded-lg text-green-400"><CheckCircle size={24} /></div>
            <div><p className="text-xs text-gray-400">Resolved</p><p className="text-2xl font-bold text-white">{metrics.resolved}</p></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 h-full flex flex-col animate-fade-in bg-background text-foreground relative min-h-screen">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">
            {userRole === UserRole.SUPERADMIN ? 'Ticket Overview' :
              userRole === UserRole.CUSTOMER ? 'My Support Tickets' :
                userRole === UserRole.SUPPORT ? 'Assigned Tickets' : 'Ticket Management'}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {userRole === UserRole.CUSTOMER && 'Track and manage your support requests'}
            {userRole === UserRole.SUPPORT && 'Tickets assigned to you for resolution'}
            {userRole === UserRole.ADMIN && 'Assign and monitor all support tickets'}
            {userRole === UserRole.SUPERADMIN && 'System-wide ticket analytics and management'}
          </p>
        </div>
        <div className="flex gap-3">
          {userRole === UserRole.SUPERADMIN && (
            <>
              <button
                onClick={() => setTableView(!tableView)}
                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-white rounded-lg border border-white/10 transition-all"
              >
                {tableView ? <ClipboardList size={16} /> : <BarChart3 size={16} />}
                {tableView ? 'Card View' : 'Table View'}
              </button>
              <button
                onClick={() => setView(view === 'metrics' ? 'list' : 'metrics')}
                className="flex items-center gap-2 px-4 py-2 bg-secondary hover:bg-accent text-white rounded-lg border border-white/10 transition-all"
              >
                {view === 'metrics' ? <ClipboardList size={16} /> : <BarChart3 size={16} />}
                {view === 'metrics' ? 'List' : 'Metrics'}
              </button>
            </>
          )}
          {userRole === UserRole.CUSTOMER && (
            <button
              onClick={() => setShowTicketModal(true)}
              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 py-2 sm:px-4 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white rounded-lg hover:shadow-lg hover:shadow-cyan-500/20 transition-all text-xs sm:text-sm font-medium leading-none"
            >
              <Plus size={16} /> Raise Ticket
            </button>
          )}
        </div>
      </div>

      {(userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN) && (
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Search tickets..."
              className="w-full bg-card/50 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:outline-none focus:border-orange-500/50"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select
            className="bg-card/50 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-orange-500/50"
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
          >
            <option value="all">All Categories</option>
            {ticketCategories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>
        </div>
      )}

      {userRole === UserRole.SUPERADMIN && tableView ? (
        <div className="glass-panel rounded-xl border border-white/10 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-card/50 border-b border-white/10">
                <tr>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Number</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Subject</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">Department</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Status</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4 hidden md:table-cell">Priority</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4 hidden sm:table-cell">Submitted</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4 hidden lg:table-cell">Last Updated</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {filteredTickets.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-6 py-20 text-center text-gray-500">
                      <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
                      <p>No tickets found.</p>
                    </td>
                  </tr>
                ) : (
                  filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => { setSelectedTicket(ticket); setView('detail'); }}
                      className={`hover:bg-white/5 transition-colors cursor-pointer ${isOverdue(ticket) ? 'bg-red-500/5' : ''}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-sm font-mono font-semibold text-gray-300">
                          #{ticket.ticketNumber}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-md">
                          <p className="text-sm font-medium text-white line-clamp-2">
                            {ticket.title}
                          </p>
                          <p className="text-xs text-gray-500 mt-1 line-clamp-1">{ticket.description}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <span className="text-sm text-gray-400">{ticket.department || 'General'}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex text-xs px-2.5 py-1 rounded-full border font-medium ${getStatusColor(ticket.status)}`}>
                          {ticket.status.replace('_', ' ')}
                        </span>
                        {isOverdue(ticket) && (
                          <span className="ml-2 text-xs text-red-400 font-medium">OVERDUE</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                        <span className={`text-sm font-medium capitalize ${getPriorityColor(ticket.priority)}`}>
                          {ticket.priority}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden sm:table-cell">
                        <span className="text-sm text-gray-400">
                          {new Date(parseDate(ticket.createdAt)).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-gray-600 block">
                          {new Date(parseDate(ticket.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap hidden lg:table-cell">
                        <span className="text-sm text-gray-400">
                          {new Date(parseDate(ticket.updatedAt)).toLocaleDateString()}
                        </span>
                        <span className="text-xs text-gray-600 block">
                          {new Date(parseDate(ticket.updatedAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteTicket(ticket.id); }}
                          className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete Ticket"
                        >
                          <Trash2 size={16} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 overflow-y-auto custom-scrollbar pb-10">
          {filteredTickets.length === 0 ? (
            <div className="text-center py-20 text-gray-500 glass-panel rounded-xl">
              <ClipboardList size={48} className="mx-auto mb-4 opacity-50" />
              <p>No tickets found.</p>
            </div>
          ) : (
            filteredTickets.map((ticket) => (
              <div
                key={ticket.id}
                onClick={() => { setSelectedTicket(ticket); setView('detail'); }}
                className={`glass-panel p-4 rounded-xl border border-white/5 hover:border-orange-500/30 transition-all cursor-pointer group hover:bg-white/5 ${isOverdue(ticket) ? 'border-red-500/50 bg-red-500/5' : ''}`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-xs px-2 py-0.5 rounded border ${getStatusColor(ticket.status)} uppercase font-bold tracking-wider`}>
                        {ticket.status.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500 font-mono">#{ticket.ticketNumber}</span>
                      <span className={`text-xs capitalize ${getPriorityColor(ticket.priority)}`}>{ticket.priority}</span>
                      {isOverdue(ticket) && (
                        <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                          OVERDUE
                        </span>
                      )}
                      {userRole === UserRole.CUSTOMER && ticket.assignedTo && (
                        <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center gap-1">
                          <Headset size={10} />
                          {ticket.assignedTo}
                        </span>
                      )}
                      {userRole === UserRole.SUPERADMIN && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteTicket(ticket.id);
                          }}
                          className="ml-auto text-xs px-2 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 transition-colors flex items-center gap-1"
                          title="Delete Ticket"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      )}
                    </div>
                    <h3 className="text-lg font-semibold text-white group-hover:text-orange-400 transition-colors">
                      {ticket.title}
                    </h3>
                    <p className="text-gray-400 text-sm mt-1 line-clamp-2">{ticket.description}</p>
                    <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
                      {(userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN || userRole === UserRole.SUPPORT) && (
                        <div className="flex items-center gap-1">
                          <User size={12} />
                          <span className="text-gray-300">{ticket.raisedBy}</span>
                        </div>
                      )}
                      {(userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN) && ticket.assignedTo && (
                        <div className="flex items-center gap-1">
                          <Headset size={12} />
                          <span className="text-blue-400">{ticket.assignedTo}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-1">
                        <Clock size={12} />
                        SLA: {formatSLA(ticket.slaDeadline)}
                      </div>
                      <div className="flex items-center gap-1 ml-auto">
                        <Clock size={12} />
                        {new Date(parseDate(ticket.createdAt)).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {showTicketModal && userRole === UserRole.CUSTOMER && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 p-4 bg-secondary backdrop-blur-sm">
          <div className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl border border-white/10 p-8 relative shadow-2xl animate-fade-in">
            <button
              onClick={() => { setShowTicketModal(false); setShowCategorySelection(true); setNewTicket({ title: '', description: '', category: '', priority: 'low', department: '' }); }}
              className="absolute top-6 right-6 text-gray-400 hover:text-white p-1 hover:bg-white/5 rounded-lg transition-colors"
            >
              <X size={24} />
            </button>

            {showCategorySelection ? (
              <div>
                <h2 className="text-3xl font-bold text-white mb-2">Submit Ticket</h2>
                <p className="text-gray-400 mb-8">Select the category that best matches your issue</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {ticketCategories.map((category) => {
                    const Icon = category.icon;
                    return (
                      <button
                        key={category.id}
                        onClick={() => handleCategorySelect(category)}
                        className="glass-panel p-6 rounded-xl border border-white/10 hover:border-orange-500/50 transition-all text-left group hover:bg-white/5"
                      >
                        <div className="flex items-start gap-4">
                          <div className="p-3 bg-orange-500/10 rounded-lg text-orange-400 group-hover:bg-orange-500/20 transition-colors">
                            <Icon size={24} />
                          </div>
                          <div className="flex-1">
                            <h3 className="text-white font-semibold text-lg mb-1">{category.name}</h3>
                            <p className="text-gray-400 text-sm">{category.description}</p>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div>
                <button onClick={() => setShowCategorySelection(true)} className="flex items-center gap-2 text-gray-400 hover:text-white mb-6 transition-colors">
                  <ChevronLeft size={20} /> Back to Categories
                </button>
                <h2 className="text-3xl font-bold text-white mb-6">Submit Ticket</h2>

                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-white mb-4">Ticket Information</h3>
                  <div className="glass-panel p-6 rounded-xl border border-white/5 space-y-4">
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Department</label>
                      <input
                        type="text"
                        value={newTicket.department}
                        readOnly
                        className="w-full bg-card/30 border border-white/10 rounded-lg px-4 py-3 text-gray-300 cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Urgency</label>
                      <select
                        className="w-full bg-card/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-orange-500/50"
                        value={newTicket.priority}
                        onChange={(e) => setNewTicket({ ...newTicket, priority: e.target.value as 'low' | 'medium' | 'high' })}
                      >
                        <option value="low">Low (24h response)</option>
                        <option value="medium">Medium (12h response)</option>
                        <option value="high">High (4h response)</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="mb-8">
                  <h3 className="text-lg font-semibold text-white mb-4">Message</h3>
                  <div className="glass-panel p-6 rounded-xl border border-white/5 space-y-4">
                    {['application', 'document', 'status', 'payment'].includes(newTicket.category) && (
                      <div>
                        <label className="block text-sm text-gray-400 mb-2">Application ID (Optional)</label>
                        <input
                          type="text"
                          className="w-full bg-card/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                          placeholder="e.g., APP-2026-001"
                          value={newTicket.applicationId || ''}
                          onChange={(e) => setNewTicket({ ...newTicket, applicationId: e.target.value })}
                        />
                      </div>
                    )}
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Subject <span className="text-orange-500">*</span></label>
                      <input
                        type="text"
                        className="w-full bg-card/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50"
                        placeholder="Brief description of your issue"
                        value={newTicket.title}
                        onChange={(e) => setNewTicket({ ...newTicket, title: e.target.value })}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Message <span className="text-orange-500">*</span></label>
                      <textarea
                        className="w-full bg-card/50 border border-white/10 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-orange-500/50 h-40 resize-none"
                        placeholder="Describe your issue in detail..."
                        value={newTicket.description}
                        onChange={(e) => setNewTicket({ ...newTicket, description: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button
                    onClick={() => setShowCategorySelection(true)}
                    className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleCreateTicket}
                    disabled={!newTicket.title || !newTicket.description || actionLoading}
                    className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 text-white font-medium py-3 rounded-lg hover:shadow-lg hover:shadow-orange-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {actionLoading && <Loader2 size={18} className="animate-spin" />}
                    Submit Ticket
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTicket && view === 'detail' && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-10 p-4 bg-secondary backdrop-blur-sm animate-fade-in">
          <div className="glass-panel w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-2xl border border-white/10 p-6 relative shadow-2xl">
            <button
              onClick={() => { setSelectedTicket(null); setView('list'); }}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors"
            >
              <X size={24} />
            </button>

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-white">{selectedTicket.title}</h2>
                <span className={`text-xs px-2 py-1 rounded border ${getStatusColor(selectedTicket.status)} uppercase font-bold`}>
                  {selectedTicket.status.replace('_', ' ')}
                </span>
                {isOverdue(selectedTicket) && (
                  <span className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    OVERDUE
                  </span>
                )}
              </div>
              <p className="text-gray-400">{selectedTicket.description}</p>
              <div className="flex gap-4 mt-4 text-xs text-gray-500 border-t border-white/5 pt-4 flex-wrap">
                <span>Ticket #: <span className="text-gray-300 font-mono">{selectedTicket.ticketNumber}</span></span>
                <span>Priority: <span className={`capitalize ${getPriorityColor(selectedTicket.priority)}`}>{selectedTicket.priority}</span></span>
                <span>Raised By: <span className="text-gray-300">{selectedTicket.raisedBy}</span></span>
                <span>SLA: <span className="text-gray-300">{formatSLA(selectedTicket.slaDeadline)}</span></span>
                {selectedTicket.resolvedAt && (
                  <span>Resolved: <span className="text-gray-300">{new Date(parseDate(selectedTicket.resolvedAt)).toLocaleString()}</span></span>
                )}
                {selectedTicket.closedAt && (
                  <span>Closed: <span className="text-gray-300">{new Date(parseDate(selectedTicket.closedAt)).toLocaleString()}</span></span>
                )}
              </div>
            </div>

            <div className="mb-8 p-4 bg-card/30 rounded-lg border border-white/5">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Actions</h4>
              {userRole === UserRole.SUPERADMIN && (
                <button
                  onClick={() => handleDeleteTicket(selectedTicket.id)}
                  disabled={actionLoading}
                  className="w-full bg-red-600/20 hover:bg-red-600/30 border border-red-500/30 text-red-400 px-4 py-2 rounded text-sm font-medium transition-colors flex items-center justify-center gap-2 mb-4"
                >
                  {actionLoading && <Loader2 size={14} className="animate-spin" />}
                  <Trash2 size={14} /> Delete Ticket Permanently
                </button>
              )}
              {(userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN) && selectedTicket.status === 'open' && (
                <div className="flex gap-2">
                  <select
                    className="bg-secondary border border-white/10 text-white text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500 flex-1"
                    value={assigneeSelect.split('|')[0] || ''}
                    onChange={(e) => setAssigneeSelect(e.target.value)}
                    disabled={actionLoading}
                  >
                    <option value="">Select Support Agent...</option>
                    {supportAgents.map(agent => (
                      <option key={agent.id} value={`${agent.name}|${agent.id}`}>{agent.name}</option>
                    ))}
                  </select>
                  <button
                    onClick={() => { const [name, id] = assigneeSelect.split('|'); handleAssignTicket(selectedTicket.id, name, id); }}
                    disabled={!assigneeSelect || actionLoading}
                    className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {actionLoading && <Loader2 size={14} className="animate-spin" />}
                    Assign
                  </button>
                </div>
              )}
              {userRole === UserRole.SUPPORT && selectedTicket.status === 'assigned' && selectedTicket.assignedToId === currentUserId && (
                <button
                  onClick={() => handleStartWorking(selectedTicket.id)}
                  disabled={actionLoading}
                  className="bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  {actionLoading && <Loader2 size={14} className="animate-spin" />}
                  <Play size={14} /> Start Working
                </button>
              )}
              {(userRole === UserRole.SUPPORT || userRole === UserRole.SUPERADMIN) &&
                ['assigned', 'in_progress'].includes(selectedTicket.status) &&
                (userRole === UserRole.SUPERADMIN || selectedTicket.assignedToId === currentUserId) && (
                  <button
                    onClick={() => handleResolveTicket(selectedTicket.id)}
                    disabled={actionLoading}
                    className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium transition-colors"
                  >
                    {actionLoading && <Loader2 size={14} className="animate-spin" />}
                    Mark as Resolved
                  </button>
                )}
              {selectedTicket.status === 'resolved' && (userRole === UserRole.CUSTOMER || userRole === UserRole.ADMIN || userRole === UserRole.SUPERADMIN) && (
                <button
                  onClick={() => handleCloseTicket(selectedTicket.id)}
                  disabled={actionLoading}
                  className="bg-gray-600 hover:bg-gray-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium flex items-center gap-2 transition-colors"
                >
                  <Archive size={14} /> Close Ticket
                </button>
              )}
            </div>

            {/* ✅ RESOLUTION MESSAGE SECTION FOR SUPPORT */}
            {userRole === UserRole.SUPPORT &&
              selectedTicket.assignedToId === currentUserId &&
              ['assigned', 'in_progress'].includes(selectedTicket.status) && (
                <div className="mb-8 p-4 bg-green-900/20 rounded-lg border border-green-500/30">
                  <h4 className="text-sm font-semibold text-green-400 mb-3">Resolution Message to Customer</h4>
                  <p className="text-xs text-gray-400 mb-3">This message will be sent to the customer when you resolve the ticket</p>
                  <textarea
                    className="w-full bg-card/50 border border-green-500/30 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-green-500/50 h-24 resize-none"
                    placeholder="Describe how you resolved this issue..."
                    value={resolutionMessage}
                    onChange={(e) => setResolutionMessage(e.target.value)}
                  />
                  <button
                    onClick={() => handleResolveTicket(selectedTicket.id)}
                    disabled={!resolutionMessage.trim() || actionLoading}
                    className="mt-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    {actionLoading && <Loader2 size={14} className="animate-spin" />}
                    <CheckCircle size={14} /> Resolve & Notify Customer
                  </button>
                </div>
              )}

            <div className="space-y-6">
              <h4 className="text-sm font-semibold text-gray-300 border-b border-white/5 pb-2">Activity & Comments</h4>
              <div className="space-y-4 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                {selectedTicket.updates.length === 0 && (
                  <p className="text-gray-500 text-sm italic">No updates yet.</p>
                )}
                {selectedTicket.updates.map((update) => (
                  <div key={update.id} className="flex gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 border border-white/10 ${update.type === 'assignment' ? 'bg-blue-500/20 text-blue-400' :
                      update.type === 'status_change' && update.message.includes('Resolution') ? 'bg-green-500/20 text-green-400' :
                        update.type === 'status_change' ? 'bg-orange-500/20 text-orange-400' :
                          'bg-gray-700 text-gray-300'
                      }`}>
                      {update.type === 'assignment' ? <Users size={14} /> :
                        update.type === 'status_change' && update.message.includes('Resolution') ? <CheckCircle size={14} /> :
                          update.type === 'status_change' ? <Play size={14} /> :
                            <User size={14} />}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">{update.author}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(parseDate(update.timestamp)).toLocaleString()}
                        </span>
                        {update.message.includes('Resolution') ? (
                          <span className="text-xs px-2 py-0.5 rounded bg-green-500/20 text-green-400 border border-green-500/30">
                            Resolution Sent
                          </span>
                        ) : (
                          <span className={`text-xs px-2 py-0.5 rounded ${update.type === 'comment' ? 'bg-gray-700/50 text-gray-400' :
                            update.type === 'assignment' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-orange-500/20 text-orange-400'
                            }`}>
                            {update.type === 'comment' ? 'Comment' : update.type === 'assignment' ? 'Assignment' : 'Status Update'}
                          </span>
                        )}
                      </div>
                      <p className={`text-sm mt-1 ${update.message.includes('Resolution') ? 'text-green-300 font-medium' : 'text-gray-300'
                        }`}>
                        {update.message}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {/* ✅ ALL ROLES CAN ADD COMMENTS */}
              {(selectedTicket.status !== 'closed') && (
                userRole === UserRole.CUSTOMER ||
                userRole === UserRole.SUPPORT ||
                userRole === UserRole.ADMIN ||
                userRole === UserRole.SUPERADMIN
              ) && (
                  <div className="flex gap-2 pt-4 border-t border-white/5">
                    <input
                      type="text"
                      placeholder={
                        userRole === UserRole.CUSTOMER ? "Add a comment..." :
                          userRole === UserRole.SUPPORT ? "Add support update..." :
                            userRole === UserRole.ADMIN ? "Add admin note..." :
                              "Add super admin note..."
                      }
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter' && !actionLoading) handleAddComment(selectedTicket.id); }}
                      disabled={actionLoading}
                      className="flex-1 bg-card/50 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-orange-500/50 disabled:opacity-50"
                    />
                    <button
                      onClick={() => handleAddComment(selectedTicket.id)}
                      disabled={!commentText.trim() || actionLoading}
                      className="p-2 bg-orange-500/20 text-orange-400 rounded-lg hover:bg-orange-500/30 disabled:opacity-50 transition-colors flex items-center justify-center"
                    >
                      {actionLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* 🍞 Toast Notification */}
      {showToast && (
        <div className="fixed top-6 right-6 z-[9999] animate-slide-in">
          <div className={`flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border backdrop-blur-md ${toastType === 'success'
            ? 'bg-green-900/90 border-green-500/30 text-green-200'
            : toastType === 'error'
              ? 'bg-red-900/90 border-red-500/30 text-red-200'
              : 'bg-blue-900/90 border-blue-500/30 text-blue-200'
            }`}>
            {toastType === 'success' && (
              <CheckCircle size={20} className="text-green-400 shrink-0" />
            )}
            {toastType === 'error' && (
              <AlertCircle size={20} className="text-red-400 shrink-0" />
            )}
            {toastType === 'info' && (
              <Clock size={20} className="text-blue-400 shrink-0" />
            )}
            <span className="text-sm font-medium">{toastMessage}</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default TicketsPage;