import React, { useState, useEffect } from 'react';
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  CheckCircle, Clock, UserPlus, X, User,
  ShieldCheck, Headset, Briefcase, Info
} from 'lucide-react';
import { UserProfile, ServiceDocument, UserRole } from '../types';
import { mockDbService } from '../services/mockFirebase';
import { getHolidaysForMonth } from '../utils/holidays';

interface ScheduleProps { user: UserProfile; }
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const Schedule: React.FC<ScheduleProps> = ({ user }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [docs, setDocs] = useState<ServiceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [timelineUsers, setTimelineUsers] = useState<UserProfile[]>([]);
  const [allDocsMap, setAllDocsMap] = useState<Map<string, {doc: ServiceDocument, user: UserProfile}>>(new Map());
  
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [modalEvents, setModalEvents] = useState<any[]>([]);

  const isSuperAdmin = user.role === UserRole.SUPERADMIN;
  const isAdmin = user.role === UserRole.ADMIN;
  const isSupport = user.role === UserRole.SUPPORT;
  const isCustomer = user.role === UserRole.CUSTOMER;

  useEffect(() => {
    fetchData();
    if (isSuperAdmin) fetchTimeline();
  }, [user.uid, user.role, currentDate]);

  // ✅ MAIN FIX: Fetch from ALL sources with proper fallback
  const fetchData = async () => {
    setLoading(true);
    try {
      if (isSuperAdmin || isAdmin) {
        console.log('[Calendar] Admin/SuperAdmin fetching ALL customer submissions...');
        
        const allUsers = await mockDbService.getAllUsers();
        const customers = allUsers.filter(u => u.role === UserRole.CUSTOMER);
        const docsMap = new Map<string, {doc: ServiceDocument, user: UserProfile}>();
        
        // Method 1: Fetch from user subcollections (MAIN SOURCE - Most Reliable)
        console.log(`[Calendar] Fetching from ${customers.length} customer subcollections...`);
        for (const cust of customers) {
          try {
            const userDocs = await mockDbService.getDocuments(cust.uid);
            userDocs.forEach(doc => {
              // Use composite key to avoid duplicates: userId_docId
              const key = `${cust.uid}_${doc.id}`;
              if (!docsMap.has(key)) {
                docsMap.set(key, { doc, user: cust });
              }
            });
          } catch (e) {
            console.warn(`Failed to fetch docs for ${cust.email}`, e);
          }
        }
        
        // Method 2: Also try root collections as fallback
        try {
          const rootData = await mockDbService.getAllDocuments();
          rootData.forEach(item => {
            const key = `${item.user.uid}_${item.doc.id}`;
            if (!docsMap.has(key)) {
              docsMap.set(key, item);
            }
          });
        } catch (e) { console.warn('Root collection fetch failed', e); }
        
        // Method 3: MSME Applications
        try {
          const msmeDocs = await mockDbService.getMsmeApplications();
          msmeDocs.forEach(doc => {
            const owner = allUsers.find(u => u.uid === doc.userId);
            if (owner) {
              const key = `${owner.uid}_${doc.id}`;
              if (!docsMap.has(key)) {
                docsMap.set(key, { doc, user: owner });
              }
            }
          });
        } catch (e) { console.warn('MSME fetch failed', e); }
        
        // Method 4: PAN Applications
        try {
          const panDocs = await mockDbService.getPanApplications();
          panDocs.forEach(doc => {
            const owner = allUsers.find(u => u.uid === doc.userId);
            if (owner) {
              const key = `${owner.uid}_${doc.id}`;
              if (!docsMap.has(key)) {
                docsMap.set(key, { doc, user: owner });
              }
            }
          });
        } catch (e) { console.warn('PAN fetch failed', e); }
        
        setAllDocsMap(docsMap);
        setDocs(Array.from(docsMap.values()).map(item => item.doc));
        console.log(`[Calendar] ✅ Loaded ${docsMap.size} total documents`);
        
      } else if (isSupport) {
        console.log('[Calendar] Support fetching assigned tasks...');
        const allUsers = await mockDbService.getAllUsers();
        const allDocs: {doc: ServiceDocument, user: UserProfile}[] = [];
        
        for (const cust of allUsers.filter(u => u.role === UserRole.CUSTOMER)) {
          try {
            const userDocs = await mockDbService.getDocuments(cust.uid);
            userDocs.forEach(doc => {
              if (doc.assignedTo === user.uid) {
                allDocs.push({ doc, user: cust });
              }
            });
          } catch (e) { console.warn(e); }
        }
        
        setDocs(allDocs.map(item => item.doc));
        const map = new Map(allDocs.map(item => [`${item.user.uid}_${item.doc.id}`, item]));
        setAllDocsMap(map);
        console.log(`[Calendar] ✅ Support loaded ${allDocs.length} assigned tasks`);
        
      } else {
        // Customer: Only own docs
        console.log('[Calendar] Customer fetching own documents...');
        const myDocs = await mockDbService.getDocuments(user.uid);
        setDocs(myDocs);
        // Build map for customer too (for modal)
        const map = new Map(myDocs.map(doc => [`${user.uid}_${doc.id}`, { doc, user }]));
        setAllDocsMap(map);
        console.log(`[Calendar] ✅ Customer loaded ${myDocs.length} documents`);
      }
    } catch (error) {
      console.error("Fetch failed:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTimeline = async () => {
    try {
      const allUsers = await mockDbService.getAllUsers();
      const staff = allUsers.filter(u => 
        u.role === UserRole.ADMIN || 
        u.role === UserRole.SUPPORT || 
        u.isExpert === true
      );
      setTimelineUsers(staff.sort((a, b) => b.createdAt - a.createdAt));
    } catch (e) { console.error(e); }
  };

  // Calendar vars
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === month;
  const holidays = getHolidaysForMonth(year, month);

  // ✅ Get events for a specific day - Check ALL date fields
  const getDayEvents = (day: number) => {
    return docs.filter(d => {
      // Check multiple possible date fields
      const datesToCheck = [
        d.formData?.dueDate,    // Due date from form
        d.assignedAt,           // When task was assigned (for Support)
        d.submittedAt,          // When customer submitted
      ].filter(date => date != null);
      
      // Return true if ANY date matches the current day
      return datesToCheck.some(date => {
        const docDate = new Date(date);
        return docDate.getFullYear() === year &&
               docDate.getMonth() === month &&
               docDate.getDate() === day;
      });
    });
  };

  // ✅ Calculate Support deadline (assignedAt + 30 days)
  const getSupportDeadline = (doc: ServiceDocument) => {
    if (isSupport && doc.assignedAt) {
      const assigned = new Date(doc.assignedAt);
      const deadline = new Date(assigned);
      deadline.setDate(deadline.getDate() + 30);
      const isOverdue = new Date() > deadline && doc.taskStatus !== 'completed';
      return { deadline, isOverdue };
    }
    return null;
  };

  // ✅ Handle date click - show modal with role-based details
  const handleDayClick = (day: number) => {
    const clickedDate = new Date(year, month, day);
    setSelectedDate(clickedDate);
    
    const dayDocs = getDayEvents(day);
    const events = dayDocs.map(doc => {
      // Find user from map using composite key
      const mapEntry = Array.from(allDocsMap.values()).find(entry => entry.doc.id === doc.id);
      const userData = mapEntry?.user;
      const deadlineInfo = getSupportDeadline(doc);
      
      return {
        doc,
        customerName: userData?.displayName || userData?.email || 'Unknown',
        submittedAt: doc.submittedAt,
        renewalDate: doc.formData?.renewalDate,
        status: doc.status,
        assignedAt: doc.assignedAt,
        deadline: deadlineInfo?.deadline,
        isOverdue: deadlineInfo?.isOverdue
      };
    });
    
    setModalEvents(events);
    setShowModal(true);
  };

  const renderCalendarDays = () => {
    const blanks = Array(firstDay).fill(null);
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    
    return [...blanks, ...days].map((day, idx) => {
      if (!day) return <div key={`b-${idx}`} className="bg-card/30 border border-white/5 h-24" />;
      
      const dayDocs = getDayEvents(day);
      const isToday = isCurrentMonth && today.getDate() === day;
      
      return (
        <div
          key={day}
          onClick={() => handleDayClick(day)}
          className={`relative border border-white/5 p-2 h-24 cursor-pointer group ${
            isToday ? 'bg-orange-500/10 border-orange-500/30' : 'bg-card/30 hover:bg-white/5'
          }`}
        >
          <span className={`text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full ${
            isToday ? 'bg-orange-500 text-white' : 'text-gray-400'
          }`}>{day}</span>
          
          <div className="mt-2 space-y-1 overflow-y-auto max-h-[calc(100%-24px)]">
            {dayDocs.slice(0, 3).map(doc => {
              const deadlineInfo = getSupportDeadline(doc);
              return (
                <div key={doc.id} className={`text-[10px] px-1.5 py-0.5 rounded border truncate ${
                  doc.status === 'approved' || doc.status === 'paid'
                    ? 'bg-orange-500/10 text-orange-300 border-orange-500/20'
                    : deadlineInfo?.isOverdue
                    ? 'bg-red-500/10 text-red-300 border-red-500/20'
                    : 'bg-blue-500/10 text-blue-300 border-blue-500/20'
                }`}>
                  {doc.status === 'approved' ? <CheckCircle size={8} className="inline mr-1"/> : <Clock size={8} className="inline mr-1"/>}
                  {doc.title}
                  {isSupport && deadlineInfo && (
                    <span className={`ml-1 ${deadlineInfo.isOverdue ? 'text-red-400 font-bold' : ''}`}>
                      ({deadlineInfo.deadline.toLocaleDateString(undefined, {day:'numeric', month:'short'})})
                    </span>
                  )}
                </div>
              );
            })}
            {dayDocs.length > 3 && <span className="text-[9px] text-gray-500">+{dayDocs.length - 3} more</span>}
          </div>
        </div>
      );
    });
  };

  // ✅ Modal Component - Role-based details
  const DateModal = () => {
    if (!showModal || !selectedDate) return null;
    
    return (
      <div className="fixed inset-0 bg-secondary z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
        <div className="bg-card border border-white/10 rounded-2xl w-full max-w-md max-h-[90vh] overflow-hidden" onClick={e => e.stopPropagation()}>
          <div className="flex justify-between items-center p-4 border-b border-white/5">
            <h3 className="text-lg font-bold text-white">
              {selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </h3>
            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
              <X size={18} className="text-gray-400" />
            </button>
          </div>
          
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-80px)] space-y-3">
            {modalEvents.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No activities on this date</p>
            ) : (
              modalEvents.map((evt, i) => (
                <div key={i} className="p-3 rounded-lg bg-white/5 border border-white/10">
                  <p className="text-sm font-medium text-white">{evt.doc.title}</p>
                  
                  {/* ✅ ADMIN/SUPERADMIN: Customer name + submission + renewal */}
                  {(isAdmin || isSuperAdmin) && (
                    <div className="text-xs text-gray-400 mt-2 space-y-1">
                      <p className="flex items-center gap-1"><User size={10}/> {evt.customerName}</p>
                      <p>📤 Submitted: <span className="text-orange-300">{new Date(evt.submittedAt).toLocaleDateString()}</span></p>
                      {evt.renewalDate && (
                        <p>🔄 Renewal: <span className="text-blue-300">{new Date(evt.renewalDate).toLocaleDateString()}</span></p>
                      )}
                      <p>Status: <span className={`font-medium ${evt.status === 'approved' ? 'text-orange-400' : 'text-amber-400'}`}>{evt.status}</span></p>
                    </div>
                  )}
                  
                  {/* ✅ SUPPORT: Assigned + Deadline + Overdue warning */}
                  {isSupport && (
                    <div className="text-xs text-gray-400 mt-2 space-y-1">
                      {evt.assignedAt && <p>📋 Assigned: {new Date(evt.assignedAt).toLocaleDateString()}</p>}
                      {evt.deadline && (
                        <p className={evt.isOverdue ? 'text-red-400 font-bold' : 'text-blue-300'}>
                          ⏰ Deadline: {evt.deadline.toLocaleDateString()} {evt.isOverdue && '(OVERDUE!)'}
                        </p>
                      )}
                      <p>Task: <span className="capitalize">{evt.doc.taskStatus || 'unassigned'}</span></p>
                    </div>
                  )}
                  
                  {/* ✅ CUSTOMER: Simple submission + renewal only */}
                  {isCustomer && (
                    <div className="text-xs text-gray-400 mt-2 space-y-1">
                      <p>📤 Submitted: {new Date(evt.submittedAt).toLocaleDateString()}</p>
                      {evt.renewalDate && (
                        <p className="text-blue-300">🔄 Renewal: {new Date(evt.renewalDate).toLocaleDateString()}</p>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    );
  };

  // Sidebar events (current month) - Check multiple date fields
  const sidebarEvents = docs.filter(d => {
    const datesToCheck = [
      d.formData?.dueDate,
      d.assignedAt,
      d.submittedAt,
    ].filter(date => date != null);
    
    return datesToCheck.some(date => {
      const dDate = new Date(date);
      return dDate.getFullYear() === year && dDate.getMonth() === month;
    });
  }).sort((a, b) => {
    const aDate = new Date(a.formData?.dueDate || a.assignedAt || a.submittedAt);
    const bDate = new Date(b.formData?.dueDate || b.assignedAt || b.submittedAt);
    return bDate.getTime() - aDate.getTime();
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-64px)] bg-background relative">
        <div className="fixed inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
          <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
        </div>
        <div className="text-orange-400 animate-pulse relative z-10">Loading calendar...</div>
      </div>
    );
  }

  const admins = timelineUsers.filter(u => u.role === UserRole.ADMIN);
  const supportStaff = timelineUsers.filter(u => u.role === UserRole.SUPPORT);
  const experts = timelineUsers.filter(u => u.isExpert === true && u.role !== UserRole.ADMIN && u.role !== UserRole.SUPPORT);

  return (
    <div className="flex flex-col md:flex-row h-[calc(100vh-64px)] bg-background text-foreground relative">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>
      {/* Calendar */}
      <div className="flex-1 flex flex-col">
        <div className="h-16 border-b border-white/5 flex items-center justify-between px-4 bg-card/50">
          <div>
            <h2 className="text-xl font-bold text-white">Compliance Calendar</h2>
            <p className="text-xs text-gray-400">{currentDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</p>
            {(isAdmin || isSuperAdmin) && (
              <p className="text-[10px] text-orange-400">Viewing {docs.length} submissions</p>
            )}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setCurrentDate(new Date(year, month - 1, 1))} className="p-2 hover:bg-white/10 rounded"><ChevronLeft size={18}/></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-3 text-xs text-orange-400 hover:bg-orange-500/10 rounded">Today</button>
            <button onClick={() => setCurrentDate(new Date(year, month + 1, 1))} className="p-2 hover:bg-white/10 rounded"><ChevronRight size={18}/></button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-white/5 bg-secondary/30">
          {WEEKDAYS.map(d => <div key={d} className="py-2 text-center text-xs text-gray-500 uppercase">{d}</div>)}
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-7 auto-rows-fr">
            {renderCalendarDays()}
          </div>
          <div className="p-3 flex gap-3 text-xs text-gray-500 border-t border-white/5">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500"></span>Completed</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500"></span>Pending</span>
            {isSupport && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500"></span>Overdue</span>}
            <span className="ml-auto flex items-center gap-1"><Info size={10}/> Click date for details</span>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-72 border-l border-white/5 bg-card/50 overflow-y-auto">
        <div className="p-4 border-b border-white/5">
          <h3 className="text-sm font-bold text-white">
            {isSuperAdmin ? 'Super Admin' : isAdmin ? 'Admin' : isSupport ? 'Support' : 'My Activity'}
          </h3>
        </div>
        
        <div className="p-4 space-y-6">
          {/* Super Admin: Team Timeline */}
          {isSuperAdmin && timelineUsers.length > 0 && (
            <div>
              <h4 className="text-xs font-semibold text-gray-500 mb-3 flex items-center gap-1"><UserPlus size={12}/> Team Joining Dates</h4>
              
              {admins.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] text-orange-400 font-bold uppercase mb-2">Admins ({admins.length})</p>
                  {admins.map(u => (
                    <div key={u.uid} className="flex justify-between text-xs text-gray-400 py-1 border-b border-white/5">
                      <span>{u.displayName || u.email}</span>
                      <span className="text-orange-300">{new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {supportStaff.length > 0 && (
                <div className="mb-4">
                  <p className="text-[10px] text-blue-400 font-bold uppercase mb-2">Support ({supportStaff.length})</p>
                  {supportStaff.map(u => (
                    <div key={u.uid} className="flex justify-between text-xs text-gray-400 py-1 border-b border-white/5">
                      <span>{u.displayName || u.email}</span>
                      <span className="text-blue-300">{new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
              
              {experts.length > 0 && (
                <div>
                  <p className="text-[10px] text-purple-400 font-bold uppercase mb-2">Legal Experts ({experts.length})</p>
                  {experts.map(u => (
                    <div key={u.uid} className="flex justify-between text-xs text-gray-400 py-1 border-b border-white/5">
                      <span>{u.displayName || u.email}</span>
                      <span className="text-purple-300">{new Date(u.createdAt).toLocaleDateString()}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Current Month Submissions */}
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-3">
              {isSuperAdmin || isAdmin ? 'Customer Submissions' : isSupport ? 'My Tasks' : 'My Filings'}
            </h4>
            
            {sidebarEvents.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">No items this month</p>
            ) : (
              sidebarEvents.map(doc => {
                const mapEntry = Array.from(allDocsMap.values()).find(entry => entry.doc.id === doc.id);
                const userData = mapEntry?.user;
                const deadlineInfo = getSupportDeadline(doc);
                return (
                  <div key={doc.id} className="flex items-start gap-2 p-2 rounded bg-white/5 hover:bg-white/10 transition">
                    <div className={`mt-0.5 ${
                      doc.status === 'approved' ? 'text-orange-400' : 
                      deadlineInfo?.isOverdue ? 'text-red-400' : 'text-amber-400'
                    }`}>
                      {doc.status === 'approved' ? <CheckCircle size={14}/> : <Clock size={14}/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white truncate">{doc.title}</p>
                      {(isSuperAdmin || isAdmin) && userData && (
                        <p className="text-[10px] text-gray-500 truncate">{userData.displayName || userData.email}</p>
                      )}
                      <p className="text-xs text-gray-500 mt-1">
                        📤 {new Date(doc.submittedAt).toLocaleDateString()}
                        {doc.formData?.renewalDate && (
                          <span className="text-blue-400 ml-2">🔄 {new Date(doc.formData.renewalDate).toLocaleDateString()}</span>
                        )}
                        {isSupport && deadlineInfo && (
                          <span className={`ml-2 ${deadlineInfo.isOverdue ? 'text-red-400 font-bold' : ''}`}>
                            Due: {deadlineInfo.deadline.toLocaleDateString(undefined, {day:'numeric', month:'short'})}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <DateModal />
    </div>
  );
};

export default Schedule;