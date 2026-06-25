import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip as RechartsTooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import {
  Briefcase,
  Calendar,
  ChevronRight,
  ArrowLeft,
  Loader2,
  Lock,
  BarChart2,
  Building2,
  ShieldCheck,
  CheckCircle,
  FileText,
  Search,
  TrendingUp,
  Users,
  IndianRupee,
  Clock,
  X,
  Info,
  AlertCircle,
  Utensils,
  Rocket,
  Key,
  Star,
  Receipt,
  CreditCard,
  UserCheck
} from 'lucide-react';
import { db } from '../services/firebase';
import {
  collection,
  getDocs,
  query,
  orderBy,
  where,
  addDoc,
  serverTimestamp,
  runTransaction,
  doc
} from 'firebase/firestore';
import { generateServiceId } from '../utils/helpers';
import { UserProfile, UserRole } from '../types';
import { PRICING_CONFIG } from '../data/pricingConfig';

// --- Tracking ID Generator ---
const generateTrackingId = async () => {
  const currentYear = new Date().getFullYear();
  const counterRef = doc(db, 'system_counters', `tracking_${currentYear}`);
  try {
    return await runTransaction(db, async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let newSequence = 1;
      if (!counterDoc.exists()) {
        transaction.set(counterRef, { current: 1 });
      } else {
        newSequence = (counterDoc.data().current || 0) + 1;
        transaction.update(counterRef, { current: newSequence });
      }
      return `TRACK-${currentYear}-${newSequence.toString().padStart(2, '0')}`;
    });
  } catch (error) {
    console.error("Error generating tracking ID:", error);
    return `TRACK-${currentYear}-${Date.now().toString().slice(-6)}`;
  }
};

// --- Interfaces ---
interface Service {
  id: string;
  name: string;
  fee: number;
  tag?: 'Popular' | 'Free' | 'New' | 'Trending' | 'Best Value' | 'Recommended' | 'Essentials' | 'Legal';
  path: string;
  govCharges?: string;
  category: 'recommended' | 'company-setup' | 'licenses-certificates' | 'roc-complaints';
  applications?: number;
  completionRate?: number;
  tabs: Array<'recommended' | 'company-setup' | 'licenses-certificates' | 'roc-complaints'>;
  sortOrder: number;
  isPackage?: boolean;
  packageServices?: string[];
}

interface ServiceHubProps {
  user: UserProfile;
}

// --- Components ---
const FreeRibbon: React.FC = () => (
  <div className="ribbon-free-container">
    <div className="ribbon-fold-left" />
    <div className="ribbon-fold-right" />
    <div className="ribbon-free">
      <div className="ribbon-shimmer" />
      <span className="ribbon-free-text">FREE</span>
    </div>
  </div>
);

const ServiceHub: React.FC<ServiceHubProps> = ({ user }) => {
  const navigate = useNavigate();

  // State
  const [expandedService, setExpandedService] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [isAdminView, setIsAdminView] = useState(false);
  const [activeTab, setActiveTab] = useState<'recommended' | 'company-setup' | 'licenses-certificates' | 'roc-complaints'>(
    (localStorage.getItem('serviceHub_activeTab') as any) || 'recommended'
  );
  const [step, setStep] = useState<'select' | 'form' | 'review'>('select');
  const [activeStatBox, setActiveStatBox] = useState<'thisMonth' | 'completed' | 'saved' | null>(null);
  const [realServiceStats, setRealServiceStats] = useState<Record<string, { total: number; completed: number; completionRate: number }>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'free' | 'paid' | 'popular'>(
    (localStorage.getItem('serviceHub_filterType') as any) || 'all'
  );
  const [sortBy, setSortBy] = useState<'name' | 'fee' | 'popular'>(
    (localStorage.getItem('serviceHub_sortBy') as any) || 'popular'
  );
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    businessName: '',
    panNumber: '',
    address: '',
    email: user.email || '',
    phone: user.phoneNumber || ''
  });
  const [serviceStats, setServiceStats] = useState<any[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [monthlyStats, setMonthlyStats] = useState({ applications: 0, completed: 0, savings: 0 });
  const [serviceBreakdown, setServiceBreakdown] = useState<any[]>([]);
  const [customDateRange, setCustomDateRange] = useState<{ start: string; end: string }>({ start: '', end: '' });
  const [showCustomDateFilter, setShowCustomDateFilter] = useState(false);

  const isStaff = user.role === UserRole.SUPERADMIN || user.role === UserRole.ADMIN;

  // Persistence Effect
  useEffect(() => {
    localStorage.setItem('serviceHub_activeTab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    localStorage.setItem('serviceHub_filterType', filterType);
  }, [filterType]);

  useEffect(() => {
    localStorage.setItem('serviceHub_sortBy', sortBy);
  }, [sortBy]);

  // --- GRADIENTS & STYLES (Strict Adherence) ---
  const HEADING_GRADIENT = "bg-gradient-to-r from-heading-from to-heading-to bg-clip-text text-transparent";
  const PRIMARY_GRADIENT = "bg-gradient-primary";
  const PRIMARY_GRADIENT_TEXT = "text-primary bg-clip-text text-transparent";
  const CARD_HOVER = "hover:border-primary/50 hover:shadow-[0_18px_45px_-28px_rgba(15,118,110,0.65)] transition-all duration-300";
  const GLASS_CARD = "bg-card border border-border rounded-2xl shadow-[0_18px_45px_-34px_rgba(15,23,42,0.55)]";

  // --- Data ---
  const allServices: Service[] = useMemo(() => [
    {
      id: 'gst',
      name: 'GST Registration',
      fee: 0,
      tag: 'Free',
      category: 'recommended',
      path: '/services/gst-registration',
      govCharges: 'Service fee applicable',
      applications: 0,
      completionRate: 95,
      tabs: ['recommended', 'company-setup'],
      sortOrder: 1,
    },
    {
      id: 'msme',
      name: 'MSME Registration',
      fee: 0,
      tag: 'Trending',
      category: 'recommended',
      path: '/services/msme-registration',
      govCharges: 'Service fee applicable',
      applications: 0,
      completionRate: 92,
      tabs: ['recommended', 'company-setup'],
      sortOrder: 2,
    },
    {
      id: "roc-package",
      name: "ROC Compliance Package",
      fee: PRICING_CONFIG["roc-package-standard"]?.fee || 0,
      tag: "Popular",
      category: "roc-complaints",
      path: "/services/roc-selection",
      govCharges: PRICING_CONFIG["roc-package-standard"]?.description || "Select a package",
      applications: 0,
      completionRate: 98,
      tabs: ["recommended", "roc-complaints"],
      sortOrder: 6,
      isPackage: true,
    },
    /*{
      id: "trade-license",
      name: "Trade License",
      fee: PRICING_CONFIG["trade-license"].fee,
      tag: "Legal",
      category: "licenses-certificates",
      path: "/services/trade-license",
      govCharges: PRICING_CONFIG["trade-license"].description,
      applications: 0,
      completionRate: 92,
      tabs: ["licenses-certificates"],
      sortOrder: 15,
    },*/
    {
      id: "startup",
      name: "Startup India Registration",
      fee: PRICING_CONFIG["startup"]?.fee || 0,
      tag: "Popular",
      category: "company-setup",
      path: "/services/startup-india",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 88,
      tabs: ["recommended", "company-setup"],
      sortOrder: 5,
    },
    /*{
      id: "shop-establishment",
      name: "Shops & Establishment License",
      fee: PRICING_CONFIG["shop-establishment"]?.fee || 1999,
      tag: "Legal",
      category: "licenses-certificates",
      path: "/services/shop-establishment-license",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 92,
      tabs: ["recommended", "licenses-certificates"],
      sortOrder: 7,
    },*/
    {
      id: "dsc",
      name: "DSC Registration",
      fee: PRICING_CONFIG["dsc"]?.fee || 0,
      tag: "New",
      category: "licenses-certificates",
      path: "/services/dsc-registration",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 94,
      tabs: ["recommended", "licenses-certificates"],
      sortOrder: 4,
    },
    {
      id: "company-registration",
      name: "Company Registration (MCA)",
      fee: PRICING_CONFIG["company-registration"]?.fee || 0,
      tag: "Popular",
      category: "company-setup",
      path: "/services/company-registration",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 90,
      tabs: ["recommended", "company-setup"],
      sortOrder: 3,
    },
    {
      id: "adt-1",
      name: "ADT-1 Filing",
      fee: PRICING_CONFIG["adt-1"]?.fee || 0,
      tag: "New",
      category: "roc-complaints",
      path: "/services/adt-1-filing",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 90,
      tabs: ["recommended", "roc-complaints"],
      sortOrder: 6,
    },
    {
      id: "inc-20a",
      name: "INC-20A Filing",
      fee: PRICING_CONFIG["inc-20a"]?.fee || 0,
      tag: "Trending",
      category: "roc-complaints",
      path: "/services/inc-20a-filing",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 93,
      tabs: ["recommended", "roc-complaints"],
      sortOrder: 7,
    },
    {
      id: "inc-22a",
      name: "INC-22A (Optional)",
      fee: 699,
      tag: "Trending",
      category: "roc-complaints",
      path: "/services/inc-22a-filing",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 95,
      tabs: ["recommended", "roc-complaints"],
      sortOrder: 11,
    },
    {
      id: "mgt7",
      name: "MGT-7A Filing",
      fee: 699,
      tag: "Trending",
      category: "roc-complaints",
      path: "/services/mgt-7-filing",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 92,
      tabs: ["recommended", "roc-complaints"],
      sortOrder: 10,
    },
    {
      id: "aoc4",
      name: "AOC-4 Filing",
      fee: 699,
      tag: "Trending",
      category: "roc-complaints",
      path: "/services/a0c4-filing",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 91,
      tabs: ["recommended", "roc-complaints"],
      sortOrder: 9,
    },
    {
      id: "dir-3-kyc",
      name: "DIR-3 KYC",
      fee: PRICING_CONFIG["dir-3-kyc"]?.fee || 0,
      tag: "Trending",
      category: "roc-complaints",
      path: "/services/dir-3-kyc-filing",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 92,
      tabs: ["recommended", "roc-complaints"],
      sortOrder: 8,
    },
    /*{
      id: "pan",
      name: "PAN Registration",
      fee: PRICING_CONFIG["pan"].fee,
      tag: "Essentials",
      category: "licenses-certificates",
      path: "/services/pan-registration",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 98,
      tabs: ["licenses-certificates"],
      sortOrder: 15,
    },*/
    /*{
      id: "fssai",
      name: "FSSAI Food License",
      fee: PRICING_CONFIG["fssai"].fee,
      tag: "Popular",
      category: "licenses-certificates",
      path: "/services/fssai-license",
      govCharges: "Govt charges applicable",
      applications: 0,
      completionRate: 91,
      tabs: ["licenses-certificates"],
      sortOrder: 16,
    },*/
    /*{
      id: "trademark",
      name: "Trademark Registration",
      fee: PRICING_CONFIG["trademark"].fee,
      tag: "Legal",
      category: "licenses-certificates",
      path: "/services/trademark-registration",
      govCharges: `₹${PRICING_CONFIG["trademark"].fee} Service Fee\nZero service charges`,
      applications: 0,
      completionRate: 85,
      tabs: ["licenses-certificates"],
      sortOrder: 17,
    },*/
  ], []);

  // --- Logic (Unchanged from original, just ensuring it works) ---
  const fetchAllApplicationsFromFirestore = useCallback(async () => {
    try {
      const collectionNames = [
        "applications", "msme-applications", "pan-applications", "gst-applications",
        "gst-proprietorship-applications", "gst-shop-retail-applications",
        "fssai-applications", "trademark-applications", "startup-applications",
        "shop-establishment-applications",
        "dsc-applications", "adt1-applications", "inc20a-applications",
        "dir-3-kyc-applications", "company-registration", "roc-standard-packages",
        "roc-premium-packages"
      ];
      let allDocs: any[] = [];
      const promises = collectionNames.map(async (colName) => {
        try {
          const colRef = collection(db, colName);
          let q;
          if (isStaff) {
            q = query(colRef, orderBy("submittedAt", "desc"));
          } else {
            q = query(colRef, where("userId", "==", user.uid));
          }
          const snapshot = await getDocs(q);
          return snapshot.docs.map(doc => ({
            id: doc.id,
            ...(doc.data() as Record<string, any>),
            sourceCollection: colName
          }));
        } catch (e) {
          return [];
        }
      });
      const results = await Promise.all(promises);
      allDocs = results.flat();
      return allDocs.map(doc => {
        const submittedAtRaw = doc.submittedAt;
        const submittedAt = submittedAtRaw?.toDate ? submittedAtRaw.toDate().getTime() : (submittedAtRaw || Date.now());
        let type = doc.type;
        if (!type && doc.sourceCollection) {
          if (doc.sourceCollection.includes('pan')) type = 'pan';
          else if (doc.sourceCollection.includes('gst')) type = 'gst';
          else if (doc.sourceCollection.includes('msme')) type = 'msme';
          else if (doc.sourceCollection.includes('fssai')) type = 'fssai';
          else if (doc.sourceCollection.includes('trademark')) type = 'trademark';
          else if (doc.sourceCollection.includes('startup')) type = 'startup';
          else if (doc.sourceCollection.includes('shop-establishment')) type = 'shop-establishment';
          else if (doc.sourceCollection.includes('dsc')) type = 'dsc';
          else if (doc.sourceCollection.includes('adt-1')) type = 'adt-1';
          else if (doc.sourceCollection.includes('inc-20a')) type = 'inc-20a';
          else if (doc.sourceCollection.includes('dir-3-kyc')) type = 'dir-3-kyc';
          else if (doc.sourceCollection.includes('company')) type = 'company-registration';
          else type = 'general';
        }
        return { ...doc, submittedAt, type: type || 'general', status: doc.status || 'submitted' };
      });
    } catch (error) {
      console.error("Error fetching real applications:", error);
      return [];
    }
  }, [isStaff, user.uid]);

  const loadHubData = useCallback(async () => {
    try {
      setStatsLoading(true);
      const allDocs = await fetchAllApplicationsFromFirestore();
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999).getTime();
      const currentMonthDocs = allDocs.filter(d => d.submittedAt >= startOfMonth && d.submittedAt <= endOfMonth);

      const allThisMonthBreakdown = allServices.map(service => {
        const serviceDocs = currentMonthDocs.filter(d => d.type === service.id);
        const completed = serviceDocs.filter(d => d.status === 'approved').length;
        const savings = serviceDocs.reduce((total, doc) => total + (service.fee || 0), 0);
        return { id: service.id, name: service.name, total: serviceDocs.length, completed, savings };
      }).filter(b => b.total > 0);

      const completedBreakdown = allServices.map(service => {
        const serviceDocs = currentMonthDocs.filter(d => d.type === service.id && d.status === 'approved');
        const savings = serviceDocs.reduce((total, doc) => total + (service.fee || 0), 0);
        return { id: service.id, name: service.name, completed: serviceDocs.length, savings };
      }).filter(b => b.completed > 0);

      let customerSavingsBreakdown: any[] = [];
      if (user.role === UserRole.CUSTOMER) {
        const userDocs = currentMonthDocs.filter(d => d.userId === user.uid);
        customerSavingsBreakdown = allServices.map(service => {
          const serviceDocs = userDocs.filter(d => d.type === service.id);
          const savings = serviceDocs.reduce((total, doc) => total + (service.fee || 0), 0);
          return { id: service.id, name: service.name, total: serviceDocs.length, savings };
        }).filter(b => b.total > 0);
      }

      setServiceBreakdown([
        { type: 'thisMonth', data: allThisMonthBreakdown },
        { type: 'completed', data: completedBreakdown },
        { type: 'saved', data: customerSavingsBreakdown }
      ]);

      const totalApplications = currentMonthDocs.length;
      const completedApplications = currentMonthDocs.filter(d => d.status === 'approved').length;
      let totalSavings = 0;
      if (user.role === UserRole.CUSTOMER) {
        const userDocs = currentMonthDocs.filter(d => d.userId === user.uid);
        totalSavings = userDocs.reduce((total, doc) => {
          const service = allServices.find(s => s.id === doc.type);
          return total + (service?.fee || 0);
        }, 0);
      }
      setMonthlyStats({ applications: totalApplications, completed: completedApplications, savings: totalSavings });

      let startDate: number;
      let endDate: number = Date.now();
      if (timeRange === 'today') {
        startDate = new Date(now).setHours(0, 0, 0, 0);
      } else if (timeRange === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay() + 1);
        startOfWeek.setHours(0, 0, 0, 0);
        startDate = startOfWeek.getTime();
      } else if (timeRange === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).setHours(0, 0, 0, 0);
      } else if (timeRange === 'custom' && customDateRange.start) {
        startDate = new Date(customDateRange.start).getTime();
        if (customDateRange.end) endDate = new Date(customDateRange.end).setHours(23, 59, 59, 999);
      } else {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1).setHours(0, 0, 0, 0);
      }

      const timeFilteredDocs = allDocs.filter(d => d.submittedAt >= startDate && d.submittedAt <= endDate);
      const statsMap: Record<string, { total: number; completed: number; completionRate: number }> = {};
      const analyticsData = allServices.map(srv => {
        const relevantDocs = timeFilteredDocs.filter(d => d.type === srv.id);
        const total = relevantDocs.length;
        const completed = relevantDocs.filter(d => d.status === 'approved').length;
        const processing = relevantDocs.filter(d => d.status === 'processing').length;
        statsMap[srv.id] = { total, completed, completionRate: total > 0 ? Math.round((completed / total) * 100) : 0 };
        return { ...srv, total, completed, processing };
      });
      setRealServiceStats(statsMap);
      if (isStaff) setServiceStats(analyticsData);
    } catch (error) {
      console.error("Error loading hub data:", error);
    } finally {
      setStatsLoading(false);
    }
  }, [allServices, user, timeRange, customDateRange, isStaff, fetchAllApplicationsFromFirestore]);

  useEffect(() => {
    loadHubData();
  }, [loadHubData]);

  const filteredServices = useMemo(() => {
    let filtered = allServices.filter(service => {
      if (!service.tabs.includes(activeTab)) return false;
      if (searchQuery && !service.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      if (filterType === 'free' && service.fee !== 0) return false;
      if (filterType === 'paid' && service.fee === 0) return false;
      if (filterType === 'popular' && service.tag !== 'Popular') return false;
      return true;
    });
    filtered.sort((a, b) => {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'fee') return a.fee - b.fee;
      if (a.sortOrder !== undefined && b.sortOrder !== undefined) return a.sortOrder - b.sortOrder;
      if (sortBy === 'popular') {
        const aCount = realServiceStats[a.id]?.total ?? a.applications ?? 0;
        const bCount = realServiceStats[b.id]?.total ?? b.applications ?? 0;
        return bCount - aCount;
      }
      return 0;
    });
    return filtered;
  }, [activeTab, searchQuery, filterType, sortBy, allServices, realServiceStats]);

  const handleServiceSelect = (service: Service) => {
    if (service.path) {
      navigate(service.path);
    } else if (service.isPackage) {
      setSelectedService(service);
      setStep('select');
    } else {
      setSelectedService(service);
      setStep('form');
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedService) setStep('review');
  };

  const handleConfirmSubmission = async () => {
    if (!selectedService) return;
    setLoading(true);
    try {
      if (selectedService.isPackage && selectedService.packageServices) {
        for (const svcId of selectedService.packageServices) {
          const pkgService = allServices.find(s => s.id === svcId);
          if (!pkgService) continue;
          let pkgCollectionName = 'applications';
          if (svcId === 'adt-1') pkgCollectionName = 'adt-1-applications';
          else if (svcId === 'inc-20a') pkgCollectionName = 'inc-20a-applications';
          else if (svcId === 'dir-3-kyc') pkgCollectionName = 'dir-3-kyc-applications';
          else if (svcId === 'msme') pkgCollectionName = 'msme-applications';

          const trackingId = await generateTrackingId();
          await addDoc(collection(db, pkgCollectionName), {
            id: `DOC-${Date.now()}-${svcId}`,
            type: svcId,
            title: pkgService.name,
            serviceId: generateServiceId(pkgService.id.toUpperCase()),
            trackingId: trackingId,
            status: 'submitted',
            submittedAt: serverTimestamp(),
            formData: {
              ...formData,
              paymentStatus: 'Pending Offline Payment',
              customerName: user.displayName || 'Unknown',
              customerId: user.userId || user.uid,
              isPartOfPackage: true,
              packageName: 'ROC Compliance Package'
            },
            userId: user.uid,
            amount: pkgService.fee,
            folderId: 'regibiz',
            createdAt: serverTimestamp()
          });
        }
        alert('ROC Package Application Submitted Successfully!');
      } else {
        const docId = `DOC-${Date.now()}`;
        const serviceId = generateServiceId(selectedService.id.toUpperCase());
        let collectionName = 'applications';
        if (selectedService.id === 'gst') collectionName = 'gst-applications';
        else if (selectedService.id === 'pan') collectionName = 'pan-applications';
        else if (selectedService.id === 'msme') collectionName = 'msme-applications';
        else if (selectedService.id === 'fssai') collectionName = 'fssai-applications';
        else if (selectedService.id === 'trademark') collectionName = 'trademark-applications';
        else if (selectedService.id === 'startup') collectionName = 'startup-applications';
        else if (selectedService.id === 'shop-establishment') collectionName = 'shop-establishment-applications';
        else if (selectedService.id === 'dsc') collectionName = 'dsc-applications';
        else if (selectedService.id === 'adt-1') collectionName = 'adt-1-applications';
        else if (selectedService.id === 'inc-20a') collectionName = 'inc-20a-applications';
        else if (selectedService.id === 'dir-3-kyc') collectionName = 'dir-3-kyc-applications';
        else if (selectedService.id === 'company-registration') collectionName = 'company-applications';

        const trackingId = await generateTrackingId();
        await addDoc(collection(db, collectionName), {
          id: docId,
          type: selectedService.id,
          title: selectedService.name,
          serviceId: serviceId,
          trackingId: trackingId,
          status: 'submitted',
          submittedAt: serverTimestamp(),
          formData: {
            ...formData,
            paymentStatus: 'Pending Offline Payment',
            customerName: user.displayName || 'Unknown',
            customerId: user.userId || user.uid
          },
          userId: user.uid,
          amount: selectedService.fee,
          folderId: 'regibiz',
          createdAt: serverTimestamp()
        });
        alert('Application Submitted Successfully!');
      }
      setStep('select');
      setSelectedService(null);
      setFormData({ businessName: '', panNumber: '', address: '', email: user.email || '', phone: user.phoneNumber || '' });
      loadHubData();
    } catch (err) {
      console.error(err);
      alert('Error submitting application.');
    } finally {
      setLoading(false);
    }
  };

  const getCategoryIcon = (category: string, serviceId?: string) => {
    if (serviceId === 'fssai') return <Utensils className="h-5 w-5" />;
    if (serviceId === 'startup') return <Rocket className="h-5 w-5" />;
    if (serviceId === 'shop-establishment') return <Building2 className="h-5 w-5" />;
    if (serviceId === 'dsc') return <Key className="h-5 w-5" />;
    if (['adt-1', 'inc-20a', 'dir-3-kyc'].includes(serviceId || '')) return <FileText className="h-5 w-5" />;
    switch (category) {
      case 'company-setup': return <Building2 className="h-5 w-5" />;
      case 'licenses-certificates': return <ShieldCheck className="h-5 w-5" />;
      case 'roc-complaints': return <FileText className="h-5 w-5" />;
      default: return <Briefcase className="h-5 w-5" />;
    }
  };

  const getTagColor = (tag?: string) => {
    switch (tag) {
      case 'Free': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Popular': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Trending': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'New': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
      case 'Best Value': return 'bg-violet-500/20 text-violet-400 border-violet-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setFilterType('all');
    setSortBy('popular');
  };

  // --- ADMIN VIEW ---
  if (isAdminView) {
    const totalApplications = serviceStats.reduce((acc, stat) => acc + stat.total, 0);
    const totalCompleted = serviceStats.reduce((acc, stat) => acc + stat.completed, 0);
    const totalProcessing = serviceStats.reduce((acc, stat) => acc + stat.processing, 0);
    const totalRevenue = serviceStats.reduce((acc, stat) => acc + (stat.completed * stat.fee), 0);

    const statusDistributionData = [
      { name: 'Completed', value: totalCompleted, color: '#10b981' },
      { name: 'Processing', value: totalProcessing, color: '#f59e0b' },
      { name: 'Pending', value: totalApplications - totalCompleted - totalProcessing, color: '#ef4444' }
    ];

    const serviceComparisonData = serviceStats.map(stat => ({
      name: stat.name.split(' ')[0],
      applications: stat.total,
      completed: stat.completed,
      revenue: stat.total * stat.fee
    }));

    return (
      <div className="min-h-screen bg-background text-foreground p-6 md:p-8 animate-fade-in pb-20 space-y-8 relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        {/* Admin Header */}
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
          <div className="space-y-1">
            <h2 className={`text-3xl md:text-4xl font-black ${HEADING_GRADIENT} tracking-tight`}>Services Analytics</h2>
            <p className="text-gray-400 text-base md:text-lg">Real-time performance tracking.</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap md:flex-nowrap w-full lg:w-auto">
            <button onClick={() => { navigate('/services'); setIsAdminView(false); }} className="px-4 py-2.5 border border-white/10 rounded-xl text-sm hover:bg-white/5 transition-colors flex items-center gap-2 text-gray-300 font-medium whitespace-nowrap">
              <ArrowLeft size={16} /> Back
            </button>
            <div className="flex bg-white/5 p-1 rounded-xl border border-white/5 shrink-0 overflow-x-auto no-scrollbar">
              {['today', 'week', 'month'].map((range) => (
                <button key={range} onClick={() => { setTimeRange(range as any); setShowCustomDateFilter(false); }} className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${timeRange === range ? `${PRIMARY_GRADIENT} text-white shadow-lg shadow-cyan-900/30` : 'text-gray-400 hover:text-white'}`}>
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </button>
              ))}
            </div>
            <button onClick={() => { setTimeRange('custom'); setShowCustomDateFilter(!showCustomDateFilter); }} className={`px-4 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 whitespace-nowrap ${timeRange === 'custom' ? `${PRIMARY_GRADIENT} text-white shadow-lg shadow-cyan-900/30` : 'bg-white/5 text-gray-400 hover:text-white hover:bg-white/10 border border-white/5'}`}>
              <Calendar size={14} /> Custom
            </button>
          </div>
        </div>

        {showCustomDateFilter && (
          <div className={`${GLASS_CARD} p-5 border-cyan-500/30 animate-fade-in`}>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">Start Date</label>
                <input type="date" value={customDateRange.start} onChange={(e) => setCustomDateRange(prev => ({ ...prev, start: e.target.value }))} className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500/50" />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] uppercase font-bold text-gray-500 ml-1">End Date</label>
                <input type="date" value={customDateRange.end} onChange={(e) => setCustomDateRange(prev => ({ ...prev, end: e.target.value }))} className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500/50" />
              </div>
              <button onClick={() => { if (customDateRange.start) { loadHubData(); setShowCustomDateFilter(false); } }} className={`${PRIMARY_GRADIENT} text-white px-6 py-3 rounded-lg text-sm font-bold hover:opacity-90 transition-opacity shadow-lg shadow-cyan-900/30 sm:mt-5`}>Apply Filter</button>
            </div>
          </div>
        )}

        {/* Admin Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[
            { label: 'Total Apps', value: totalApplications, icon: FileText, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
            { label: 'Completed', value: totalCompleted, icon: CheckCircle, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
            { label: 'Processing', value: totalProcessing, icon: Clock, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
            { label: 'Revenue', value: `₹${totalRevenue.toLocaleString()}`, icon: IndianRupee, color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
          ].map((stat, idx) => (
            <div key={idx} className={`${GLASS_CARD} p-4 md:p-6 border ${stat.border} hover:scale-[1.02] transition-transform duration-300`}>
              <div className="flex items-center justify-between mb-2 md:mb-4">
                <div className={`p-2 md:p-3 rounded-xl ${stat.bg}`}><stat.icon className={stat.color} size={18} /></div>
              </div>
              <p className="text-xl md:text-3xl font-bold text-white leading-none">{stat.value}</p>
              <p className="text-[10px] md:text-sm text-gray-400 mt-2 font-medium uppercase tracking-wider">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${GLASS_CARD} p-6 border border-white/10`}>
            <h3 className={`text-xl font-bold ${HEADING_GRADIENT} mb-6`}>Status Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={statusDistributionData.filter(item => item.value > 0)} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {statusDistributionData.filter(item => item.value > 0).map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={{ backgroundColor: '#000000', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-4">
              {statusDistributionData.map((item) => (
                <div key={item.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="text-sm text-gray-400">{item.name}: {item.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className={`${GLASS_CARD} p-6 border border-white/10`}>
            <h3 className={`text-xl font-bold ${HEADING_GRADIENT} mb-6`}>Service Performance</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={serviceComparisonData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" vertical={false} />
                <XAxis dataKey="name" stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#9ca3af" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip cursor={{ fill: '#ffffff10' }} contentStyle={{ backgroundColor: '#000000', borderColor: '#ffffff20', borderRadius: '12px', color: '#fff' }} />
                <Bar dataKey="applications" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="completed" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  // --- CUSTOMER VIEW ---
  return (
    <div className="service-hub-page min-h-screen bg-background text-foreground p-4 sm:p-6 md:p-8 animate-fade-in pb-20 max-w-7xl mx-auto relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* STEP 1: SERVICE SELECTION */}
      {step === 'select' && !selectedService?.isPackage && (
        <>
          {/* Top Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-10">
            <div
              className={`${GLASS_CARD} p-5 cursor-pointer hover:border-cyan-500/30 transition-all group relative overflow-hidden`}
              onMouseEnter={() => setActiveStatBox('thisMonth')}
              onMouseLeave={() => setActiveStatBox(null)}
              onClick={() => setActiveStatBox(activeStatBox === 'thisMonth' ? null : 'thisMonth')}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <TrendingUp size={64} className="text-cyan-400" />
              </div>
              <div className="relative z-10">
                <p className="text-muted-foreground text-sm font-medium mb-1">This Month</p>
                <h3 className="text-3xl font-bold text-foreground">{statsLoading ? '-' : monthlyStats.applications}</h3>
                <div className="mt-2 flex items-center gap-2 text-xs text-cyan-400">
                  <span className="bg-cyan-500/10 px-2 py-1 rounded-md">Active Applications</span>
                </div>
              </div>
            </div>

            <div
              className={`${GLASS_CARD} p-5 cursor-pointer hover:border-emerald-500/30 transition-all group relative overflow-hidden`}
              onMouseEnter={() => setActiveStatBox('completed')}
              onMouseLeave={() => setActiveStatBox(null)}
              onClick={() => setActiveStatBox(activeStatBox === 'completed' ? null : 'completed')}
            >
              <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <CheckCircle size={64} className="text-emerald-400" />
              </div>
              <div className="relative z-10">
                <p className="text-muted-foreground text-sm font-medium mb-1">Completed</p>
                <h3 className="text-3xl font-bold text-foreground">{statsLoading ? '-' : monthlyStats.completed}</h3>
              </div>
            </div>

            {user.role === UserRole.CUSTOMER && (
              <div
                className={`${GLASS_CARD} p-5 cursor-pointer hover:border-orange-500/30 transition-all group relative overflow-hidden`}
                onMouseEnter={() => setActiveStatBox('saved')}
                onMouseLeave={() => setActiveStatBox(null)}
                onClick={() => setActiveStatBox(activeStatBox === 'saved' ? null : 'saved')}
              >
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <IndianRupee size={64} className="text-orange-400" />
                </div>
                <div className="relative z-10">
                  <p className="text-muted-foreground text-sm font-medium mb-1">You Saved</p>
                  <h3 className={`text-3xl font-bold ${HEADING_GRADIENT}`}>{statsLoading ? '-' : `₹${monthlyStats.savings.toLocaleString()}`}</h3>
                  <div className="mt-2 flex items-center gap-2 text-xs text-orange-400">
                    <span className="bg-orange-500/10 px-2 py-1 rounded-md">Zero Service Charges</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Dynamic Breakdown Popup */}
          {activeStatBox && (
            <div className="mb-10 animate-fade-in">
              <div className={`${GLASS_CARD} p-6 border border-cyan-500/30 relative`}>
                <div className="flex justify-between items-center mb-6">
                  <h3 className={`text-xl font-bold ${HEADING_GRADIENT}`}>
                    {activeStatBox === 'thisMonth' && 'Monthly Activity'}
                    {activeStatBox === 'completed' && 'Completed Services'}
                    {activeStatBox === 'saved' && 'Your Savings Breakdown'}
                  </h3>
                  <button onClick={() => setActiveStatBox(null)} className="text-gray-400 hover:text-white p-2 hover:bg-white/5 rounded-full transition-colors"><X size={20} /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {serviceBreakdown.find(b => b.type === activeStatBox)?.data.map((service: any) => (
                    <div key={service.id} className="bg-white/5 rounded-xl p-4 border border-white/5 hover:border-white/10 transition-colors">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="text-white font-semibold text-sm truncate pr-2">{service.name}</h4>
                        {service.total > 0 && <span className="text-[10px] bg-cyan-500/20 text-cyan-300 px-2 py-0.5 rounded-full">{service.total}</span>}
                      </div>
                      <div className="space-y-1 text-xs">
                        {activeStatBox === 'saved' ? (
                          <div className="flex justify-between text-orange-300 font-medium"><span>Saved:</span> <span>₹{service.savings.toLocaleString()}</span></div>
                        ) : (
                          <>
                            <div className="flex justify-between text-gray-400"><span>Completed:</span> <span className="text-emerald-400">{service.completed}</span></div>
                            <div className="flex justify-between text-gray-400"><span>Value:</span> <span className="text-white">₹{service.savings.toLocaleString()}</span></div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                {serviceBreakdown.find(b => b.type === activeStatBox)?.data.length === 0 && (
                  <p className="text-center text-gray-500 py-4">No data available for this period.</p>
                )}
              </div>
            </div>
          )}

          {/* Main Header */}
          <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-10">
            <div className="space-y-1">
              <h2 className={`text-4xl font-black ${HEADING_GRADIENT} tracking-tight`}>Compliance Hub</h2>
              <p className="text-muted-foreground text-lg">Streamline your business with expert compliance services.</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={loadHubData}
                disabled={statsLoading}
                className="p-3 rounded-xl bg-card border border-border text-primary hover:bg-primary/10 hover:border-primary/40 transition-all flex items-center gap-2 disabled:opacity-50"
                title="Refresh Metrics"
              >
                <Clock size={18} className={statsLoading ? 'animate-spin' : ''} />
                <span className="text-sm font-bold uppercase tracking-wider hidden sm:block">Sync Data</span>
              </button>
              {isStaff && (
                <button onClick={() => setIsAdminView(true)} className={`${PRIMARY_GRADIENT} text-white px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90 flex items-center gap-2 shadow-lg shadow-cyan-900/40`}>
                  <BarChart2 size={18} /> View Analytics
                </button>
              )}
            </div>
          </div>

          {/* Tabs - Scrollable on mobile */}
          <div className="relative mb-8 -mx-6 px-6 md:mx-0 md:px-0">
            <div className="flex overflow-x-auto no-scrollbar gap-3 px-2 pt-1 pb-2">
              {Object.entries({
                recommended: 'All Services',
                'company-setup': 'Registration',
                'licenses-certificates': 'Licenses',
                'roc-complaints': 'ROC-Compliance'
              }).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key as any)}
                  className={`px-6 py-3 rounded-xl text-sm font-bold transition-all duration-300 whitespace-nowrap min-w-max ${activeTab === key
                    ? `${PRIMARY_GRADIENT} text-white shadow-lg shadow-cyan-900/30 scale-105`
                    : 'bg-card text-muted-foreground hover:text-foreground hover:bg-secondary border border-border'
                    }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Search & Filters */}
          <div className={`${GLASS_CARD} p-4 mb-10 flex flex-col md:flex-row gap-4 items-center`}>
            <div className="flex-1 relative w-full">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground" size={20} />
              <input
                type="text"
                placeholder="Search services..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-background border border-border rounded-xl pl-12 pr-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/30 transition-all"
              />
              {searchQuery && <button onClick={() => setSearchQuery('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"><X size={16} /></button>}
            </div>
            <div className="flex gap-3 w-full md:w-auto">
              <select value={filterType} onChange={(e) => setFilterType(e.target.value as any)} className="flex-1 md:flex-none bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/50 cursor-pointer appearance-none">
                <option value="all">All Services</option>
                <option value="free">Free Only</option>
                <option value="paid">Paid Only</option>
                <option value="popular">Popular</option>
              </select>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)} className="flex-1 md:flex-none bg-background border border-border rounded-xl px-4 py-3 text-foreground focus:outline-none focus:border-primary/50 cursor-pointer appearance-none">
                <option value="popular">Sort: Popular</option>
                <option value="name">Sort: Name</option>
                <option value="fee">Sort: Price</option>
              </select>
              {(searchQuery || filterType !== 'all' || sortBy !== 'popular') && (
                <button onClick={clearFilters} className="px-4 py-3 text-muted-foreground hover:text-foreground border border-border rounded-xl hover:bg-secondary transition-colors whitespace-nowrap">Clear</button>
              )}
            </div>
          </div>

          {/* Services Grid */}
          {filteredServices.length === 0 ? (
            <div className="text-center py-20">
              <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-white/5 flex items-center justify-center"><Search className="text-gray-600" size={40} /></div>
              <h3 className="text-2xl font-bold text-foreground mb-2">No services found</h3>
              <p className="text-muted-foreground mb-6">Try adjusting your search or filters</p>
              <button onClick={clearFilters} className={`${PRIMARY_GRADIENT} text-white px-8 py-3 rounded-xl font-bold hover:opacity-90 transition-opacity shadow-lg shadow-cyan-900/30`}>Clear All Filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredServices.map((service) => (
                <div
                  key={service.id}
                  onClick={() => handleServiceSelect(service)}
                  className={`${GLASS_CARD} service-card cursor-pointer group relative transition-all duration-300 ${CARD_HOVER} flex flex-col h-full`}
                >
                  {/* Free Ribbon for GST & MSME */}
                  {(service.id === 'gst' || service.id === 'msme') && <FreeRibbon />}

                  {/* Top Gradient Line */}
                  <div className={`absolute top-0 left-0 right-0 h-1 rounded-t-2xl ${PRIMARY_GRADIENT} opacity-0 group-hover:opacity-100 transition-opacity`} />

                  {/* Tags */}
                  <div className="p-5 pb-0 flex justify-between items-start">
                    {service.sortOrder <= 2 && (
                      <span className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-lg shadow-cyan-500/20 flex items-center gap-1">
                        <Star size={10} fill="currentColor" /> START HERE
                      </span>
                    )}
                    {service.isPackage && (
                      <span className="ml-auto text-[10px] px-2 py-1 rounded-full border font-bold bg-cyan-500/10 border-cyan-500/30 text-cyan-400 flex items-center gap-1">
                        <Briefcase size={10} /> PACKAGE
                      </span>
                    )}
                    {service.tag && !service.isPackage && service.sortOrder > 2 && (
                      <span className={`ml-auto text-[10px] px-2 py-1 rounded-full border font-bold whitespace-nowrap ${getTagColor(service.tag)}`}>{service.tag}</span>
                    )}
                  </div>

                  {/* Content */}
                  <div className="p-5 flex-1 flex flex-col">
                    <div className="flex items-start gap-4 mb-4">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${PRIMARY_GRADIENT} shadow-lg shadow-cyan-900/20 shrink-0 group-hover:scale-110 transition-transform duration-300`}>
                        {getCategoryIcon(service.category, service.id)}
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-foreground leading-tight group-hover:text-primary transition-colors">{service.name}</h3>
                        <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                          <Users size={12} />
                          <span>{realServiceStats[service.id]?.total ?? service.applications ?? 0} applications</span>
                        </div>
                      </div>
                    </div>

                    {/* Fee Breakdown Box - Streamlined to Govt Fee only */}
                    <div className="bg-secondary/70 rounded-xl p-4 mb-4 border border-border group-hover:border-primary/25 transition-colors">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-muted-foreground font-medium flex items-center gap-1"><Receipt size={12} /> {PRICING_CONFIG[service.id]?.label || 'Service Fee'}</span>
                        <span className="text-sm font-bold text-foreground tracking-tight">
                          {service.fee > 0 ? `₹${service.fee.toLocaleString()} + GST` : 'FREE'}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[11px] text-muted-foreground font-bold flex items-center gap-1.5">
                        <Info size={12} className="text-cyan-400" /> Govt Charges Applicable
                      </div>
                      {service.fee === 0 && (
                        <div className="mt-2 text-[10px] text-emerald-400 font-bold uppercase tracking-widest flex items-center gap-1">
                          <CheckCircle size={10} /> No Service Charges
                        </div>
                      )}
                    </div>

                    <div className="mt-auto pt-4 border-t border-border flex items-center justify-end">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${PRIMARY_GRADIENT} text-white shadow-lg shadow-cyan-900/20 group-hover:scale-110`}>
                        <ChevronRight size={16} />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* STEP 2: PACKAGE DETAILS (If Package Selected) */}
      {step === 'select' && selectedService?.isPackage && (
        <div className="max-w-4xl mx-auto animate-fade-in">
          <button onClick={() => { setSelectedService(null); setStep('select'); }} className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors group font-medium">
            <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Services
          </button>

          <div className={`${GLASS_CARD} p-8 md:p-10 border border-white/10 relative overflow-hidden`}>
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>

            <div className="relative z-10">
              <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                <div className="flex items-center gap-5">
                  <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-white ${PRIMARY_GRADIENT} shadow-lg shadow-cyan-900/30`}>
                    <Briefcase size={32} />
                  </div>
                  <div>
                    <h3 className="text-3xl font-bold text-white">{selectedService.name}</h3>
                    <p className="text-gray-400">Complete ROC Compliance Solution</p>
                  </div>
                </div>
                <div className="bg-cyan-500/10 border border-cyan-500/30 px-4 py-2 rounded-full text-cyan-400 font-bold text-sm">
                  {selectedService.packageServices?.length} Services Included
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left: Included Services */}
                <div className="lg:col-span-2 space-y-4">
                  <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <span className="text-cyan-400">PACKAGE</span> Includes:
                  </h4>
                  <div className="space-y-3">
                    {selectedService.packageServices?.map((svcId) => {
                      const svc = allServices.find(s => s.id === svcId);
                      if (!svc) return null;
                      return (
                        <div key={svcId} className="bg-white/5 rounded-xl p-4 border border-white/5 flex items-center gap-4 hover:border-white/10 transition-colors">
                          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${PRIMARY_GRADIENT} shrink-0`}>
                            {getCategoryIcon(svc.category, svc.id)}
                          </div>
                          <div className="flex-1">
                            <h5 className="text-white font-semibold">{svc.name}</h5>
                            <p className="text-xs text-gray-400 mt-0.5">{svc.govCharges}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-emerald-400 font-bold text-sm">{svc.fee === 0 ? 'Free' : `₹${svc.fee}`}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Right: Benefits & Action */}
                <div className="space-y-6">
                  <div className="bg-gradient-to-br from-cyan-900/20 to-blue-900/20 rounded-xl p-6 border border-cyan-500/20">
                    <h4 className="text-white font-bold mb-4 flex items-center gap-2"><Star size={16} className="text-yellow-400" /> Why Choose This?</h4>
                    <ul className="space-y-3 text-sm text-gray-300">
                      <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Save time with bundled filing</li>
                      <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Single point of contact</li>
                      <li className="flex items-start gap-2"><CheckCircle size={14} className="text-emerald-400 mt-0.5 shrink-0" /> Zero service charges on individual items</li>
                    </ul>
                  </div>

                  <div className="space-y-3">
                    <button onClick={() => navigate(`/services/roc-package?package=${selectedService.id.split('-')[1]}`)} className={`w-full ${PRIMARY_GRADIENT} text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-cyan-900/30 hover:scale-[1.02] flex items-center justify-center gap-2`}>
                      Apply for {selectedService.name} <ChevronRight size={20} />
                    </button>
                    <button onClick={() => { setSelectedService(null); }} className="w-full py-4 text-gray-400 hover:text-white font-medium transition-colors">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: FORM */}
      {step === 'form' && selectedService && (
        <div className="max-w-3xl mx-auto">
          <button onClick={() => setStep('select')} className="flex items-center text-gray-400 hover:text-white mb-8 transition-colors group font-medium">
            <ArrowLeft size={18} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Services
          </button>

          <div className={`${GLASS_CARD} p-8 md:p-10 border border-white/10`}>
            <div className="flex items-center gap-4 mb-8 pb-8 border-b border-white/10">
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${PRIMARY_GRADIENT} shadow-lg shadow-cyan-900/20`}>
                {getCategoryIcon(selectedService.category, selectedService.id)}
              </div>
              <div>
                <h3 className="text-2xl font-bold text-white">{selectedService.name}</h3>
                <p className="text-sm text-gray-400">Step 1 of 2 - Basic Information</p>
              </div>
            </div>

            <form onSubmit={handleFormSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white">Legal Business Name <span className="text-red-400">*</span></label>
                  <input required type="text" placeholder="Enter your business name" className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all" value={formData.businessName} onChange={e => setFormData({ ...formData, businessName: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white">PAN Number <span className="text-red-400">*</span></label>
                  <input required type="text" placeholder="ABCDE1234F" maxLength={10} className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all uppercase" value={formData.panNumber} onChange={e => setFormData({ ...formData, panNumber: e.target.value.toUpperCase() })} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-white">Registered Office Address <span className="text-red-400">*</span></label>
                <textarea required rows={4} placeholder="Enter complete address with pincode" className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all resize-none" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white">Email Address</label>
                  <input type="email" className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-white">Phone Number</label>
                  <input type="tel" className="w-full bg-background border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/50 transition-all" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-6">
                <button type="button" onClick={() => setStep('select')} className="px-6 py-3 text-gray-400 hover:text-white font-medium transition-colors">Cancel</button>
                <button type="submit" className={`${PRIMARY_GRADIENT} text-white font-bold py-3 px-8 rounded-xl transition-all shadow-lg shadow-cyan-900/30 hover:scale-105`}>Continue to Review →</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 4: REVIEW */}
      {step === 'review' && selectedService && (
        <div className="max-w-2xl mx-auto mt-10 animate-fade-in">
          <div className={`${GLASS_CARD} p-8 md:p-10 border border-white/10 shadow-2xl`}>
            <div className="text-center mb-10">
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 ${PRIMARY_GRADIENT} shadow-lg shadow-cyan-900/30`}><FileText className="text-white" size={32} /></div>
              <h3 className={`text-3xl font-bold ${HEADING_GRADIENT} mb-2`}>Review Application</h3>
              <p className="text-sm text-gray-400">Please verify all details before submitting</p>
            </div>

            <div className="space-y-6 mb-10">
              {/* Service Summary */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Selected Service</p>
                    <h4 className="text-xl font-bold text-white">{selectedService.name}</h4>
                  </div>
                  {selectedService.isPackage && <span className="bg-cyan-500/10 text-cyan-400 px-3 py-1 rounded-full text-xs font-bold border border-cyan-500/30">PACKAGE</span>}
                </div>

                {/* CLEAR FEE BREAKDOWN */}
                <div className="bg-background rounded-lg p-4 border border-white/5 space-y-3">
                  <div className="mb-2 flex items-center gap-2 text-emerald-400 text-xs font-bold uppercase tracking-widest bg-emerald-500/10 px-3 py-1.5 w-fit rounded-lg border border-emerald-500/20">
                    <ShieldCheck size={14} /> Transparent Pricing Promise
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400 flex items-center gap-2"><Receipt size={14} /> Professional Service Fee</span>
                    <span className="text-lg font-bold text-white">{selectedService.fee === 0 ? 'FREE' : `₹${selectedService.fee.toLocaleString()}`}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-400 flex items-center gap-2"><Building2 size={14} /> Govt/Statutory Fee</span>
                    <span className="text-sm text-gray-300 font-medium text-right">At Actuals</span>
                  </div>
                  <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-sm text-gray-400 flex items-center gap-2"><Info size={14} /> GST (18%)</span>
                    <span className="text-sm text-gray-300 font-medium text-right">{selectedService.fee === 0 ? '₹0' : `₹${Math.round(selectedService.fee * 0.18).toLocaleString()}`}</span>
                  </div>
                  <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                    <span className="text-sm font-bold text-gray-300">Estimated Total (Service + GST)</span>
                    <span className="text-xl font-bold text-cyan-400">{selectedService.fee === 0 ? 'FREE' : `₹${Math.round(selectedService.fee * 1.18).toLocaleString()}`}</span>
                  </div>
                </div>
              </div>

              {/* User Details */}
              <div className="bg-white/5 rounded-xl p-5 border border-white/5">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-4">Business Details</p>
                <div className="grid grid-cols-1 gap-4 text-sm">
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-400">Business Name</span>
                    <span className="text-white font-medium">{formData.businessName}</span>
                  </div>
                  <div className="flex justify-between border-b border-white/5 pb-2">
                    <span className="text-gray-400">PAN Number</span>
                    <span className="text-white font-medium">{formData.panNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Contact Email</span>
                    <span className="text-white font-medium">{formData.email}</span>
                  </div>
                </div>
              </div>

              {/* Payment Info */}
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-5 flex items-start gap-4">
                <CreditCard className="text-blue-400 mt-1 shrink-0" size={20} />
                <div>
                  <p className="text-sm text-blue-300 font-bold mb-1">Payment Information</p>
                  <p className="text-xs text-blue-400/70 leading-relaxed">No online payment is required at this stage. Our team will contact you within 24 hours to collect documents and process any applicable government fees.</p>
                </div>
              </div>
            </div>

            <button onClick={handleConfirmSubmission} disabled={loading} className={`w-full ${PRIMARY_GRADIENT} text-white font-bold text-lg py-4 rounded-xl shadow-lg shadow-cyan-900/30 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed hover:scale-[1.02]`}>
              {loading ? (<><Loader2 className="animate-spin" size={24} />Submitting...</>) : (<><CheckCircle size={24} />Confirm & Submit Application</>)}
            </button>

            <div className="text-center mt-6">
              <button onClick={() => setStep('form')} className="text-sm text-gray-500 hover:text-white transition-colors font-medium">← Edit Details</button>
            </div>

            <div className="mt-8 pt-6 border-t border-white/5 flex flex-col sm:flex-row items-center justify-center gap-6 text-gray-400">
              <div className="flex items-center gap-2"><Lock size={16} className="text-emerald-500" /><span className="text-xs font-medium">256-bit Secure</span></div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-gray-600"></div>
              <div className="flex items-center gap-2"><ShieldCheck size={16} className="text-blue-500" /><span className="text-xs font-medium">Data Privacy Guaranteed</span></div>
              <div className="hidden sm:block w-1 h-1 rounded-full bg-gray-600"></div>
              <div className="flex items-center gap-2"><UserCheck size={16} className="text-cyan-500" /><span className="text-xs font-medium">CA/CS Verified Filing</span></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceHub;