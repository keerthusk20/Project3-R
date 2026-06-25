import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { db } from '../services/firebase';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { 
  collection, query, where, orderBy, onSnapshot, 
  addDoc, serverTimestamp, doc, getDoc, updateDoc, Timestamp,
  limit, increment
} from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { 
  Paperclip, Send, Smile, X, FileText, Check, CheckCheck, 
  MoreVertical, Phone, Video, Info, AlertCircle, Loader2
} from 'lucide-react';
import { UserProfile } from '../types';

// ================= INTERFACES =================
interface Message {
  id: string;
  senderId: string;
  senderRole: string;
  text: string;
  timestamp: Timestamp;
  read: boolean;
  delivered?: boolean;
  attachmentUrl?: string;
  attachmentType?: 'image' | 'video' | 'file';
  attachmentName?: string;
}

interface Conversation {
  id: string;
  participants: string[];
  participantRoles: Record<string, string>;
  lastMessage: string;
  lastMessageTime: Timestamp;
  createdBy: string;
  assignedTo?: string;
  status: 'open' | 'closed' | 'pending';
  unreadCount?: Record<string, number>;
}

interface User {
  uid: string;
  displayName?: string;
  email: string;
  role: 'customer' | 'support' | 'admin' | 'superadmin';
  photoURL?: string;
  isOnline?: boolean;
  lastSeen?: Timestamp;
}

interface SupportProps {
  user: UserProfile;
}

export default function Support({ user }: SupportProps) {
  // State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [filterRole, setFilterRole] = useState<string>('all');
  
  // ✅ Use passed user prop
  const currentUser = user;
  const userRole = user.role;
  
  const [isLoading, setIsLoading] = useState(false);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  
  // Attachment & UI states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isCreatingConv, setIsCreatingConv] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = getAuth();
  const storage = getStorage();

  // 🔐 Role Permission Matrix
  const checkRolePermission = (currentRole: string, targetRole: string): boolean => {
    const permissions: Record<string, string[]> = {
      superadmin: ['admin', 'support', 'customer'], // Superadmin can chat with everyone
      admin: ['support', 'customer'],                // Admin → Support + Customer
      support: ['customer', 'admin', 'superadmin'],  // Support → All
      customer: ['support', 'admin', 'superadmin']   // Customer → Support + Admin/Superadmin
    };
    return permissions[currentRole]?.includes(targetRole) || false;
  };

  // 1. Online Status Update
  useEffect(() => {
    if (!currentUser?.uid) return;

    // Update online status
    const userRef = doc(db, 'users', currentUser.uid);
    updateDoc(userRef, {
      isOnline: true,
      lastSeen: serverTimestamp()
    }).catch(() => {});

    return () => {
      updateDoc(userRef, {
        isOnline: false,
        lastSeen: serverTimestamp()
      }).catch(() => {});
    };
  }, [currentUser?.uid]);

  // 2. Fetch Conversations
  useEffect(() => {
    if (!currentUser) return;
    
    let q;
    if (userRole === 'customer') {
      // Customers only see their own conversations
      q = query(
        collection(db, 'conversations'),
        where('participants', 'array-contains', currentUser.uid),
        orderBy('lastMessageTime', 'desc')
      );
    } else {
      // Staff sees all conversations (sorted by latest)
      q = query(
        collection(db, 'conversations'), 
        orderBy('lastMessageTime', 'desc')
      );
    }

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const convs: Conversation[] = [];
      snapshot.forEach((docSnap) => {
        convs.push({ id: docSnap.id, ...docSnap.data() } as Conversation);
      });
      setConversations(convs);
    }, (err) => {
      console.error("Error fetching conversations:", err);
      setError("Permission denied: Cannot load conversations.");
    });

    return () => unsubscribe();
  }, [currentUser, userRole]);

  // 3. Fetch Users (Filtered by Role)
  useEffect(() => {
    if (!currentUser) return;
    
    let q;
    const usersCollection = collection(db, 'users');
    
    // Strict Role Filtering
    if (userRole === 'superadmin') {
      q = query(usersCollection, where('role', 'in', ['admin', 'support', 'customer']));
    } else if (userRole === 'admin') {
      q = query(usersCollection, where('role', 'in', ['support', 'customer'])); 
    } else if (userRole === 'support') {
      q = query(usersCollection, where('role', 'in', ['customer', 'admin', 'superadmin']));
    } else if (userRole === 'customer') {
      q = query(usersCollection, where('role', 'in', ['support', 'admin', 'superadmin'])); 
    } else {
      q = query(usersCollection, where('role', '==', 'support'));
    }
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersList: User[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        const uid = docSnap.id;
        
        if (uid === currentUser?.uid) return; // Don't show self
        if (userRole !== 'customer' && filterRole !== 'all' && data.role !== filterRole) return;
        
        usersList.push({ uid, ...data } as User);
      });
      setUsers(usersList);
    }, (err) => {
      console.error('Error fetching users:', err);
    });
    
    return () => unsubscribe();
  }, [currentUser, userRole, filterRole]);

  // 4. Fetch Messages for Selected Conversation
  useEffect(() => {
    if (!selectedConversation) {
      setMessages([]);
      return;
    }

    const q = query(
      collection(db, 'conversations', selectedConversation, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(50) // Load last 50 messages for performance
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: Message[] = [];
      snapshot.forEach((docSnap) => {
        msgs.push({ id: docSnap.id, ...docSnap.data() } as Message);
      });
      setMessages(msgs);
      // Scroll to bottom after render
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }, (err) => {
      console.error("Error loading messages:", err);
    });

    return () => unsubscribe();
  }, [selectedConversation]);

  // 5. Set Active User Details
  useEffect(() => {
    if (!selectedConversation || !currentUser) return;
    
    const conv = conversations.find(c => c.id === selectedConversation);
    if (!conv) return;
    
    const otherUserId = conv.participants.find((p: string) => p !== currentUser.uid);
    if (!otherUserId) return;
    
    // Try to find in cached users list first
    const foundUser = users.find((u: User) => u.uid === otherUserId);
    if (foundUser) {
      setActiveUser(foundUser);
    } else {
      // Fallback: Fetch directly if not in list (e.g., deleted or filtered out)
      getDoc(doc(db, 'users', otherUserId))
        .then((userDoc) => {
          if (userDoc.exists()) {
            setActiveUser({ uid: otherUserId, ...userDoc.data() } as User);
          }
        })
        .catch(console.error);
    }
  }, [selectedConversation, conversations, users, currentUser]);

  // 6. Mark Messages as Read
  useEffect(() => {
    if (!selectedConversation || !currentUser || messages.length === 0) return;
    
    const unread = messages.filter(m => m.senderId !== currentUser.uid && !m.read);
    if (unread.length > 0) {
      const batch = unread.map(msg => 
        updateDoc(doc(db, 'conversations', selectedConversation, 'messages', msg.id), {
          read: true,
          readAt: serverTimestamp()
        })
      );
      Promise.all(batch).catch(console.error);
    }
  }, [messages, selectedConversation, currentUser]);

  // 7. Handle URL Auto-Select (?chatWith=UID&name=Name)
  useEffect(() => {
    const chatWithId = searchParams.get('chatWith');
    const customerName = searchParams.get('name');
    
    // Wait for data to load
    if (!chatWithId || !currentUser || (users.length === 0 && !isLoading)) return;
    
    const attemptAutoSelect = async () => {
      // Prevent loop if already selected
      const existingConv = conversations.find(c => 
        c.participants.includes(currentUser.uid) && c.participants.includes(chatWithId)
      );
      
      if (existingConv && selectedConversation === existingConv.id) return;

      let targetUser = users.find(u => u.uid === chatWithId);

      // If not in list, fetch directly
      if (!targetUser) {
        try {
          const userDoc = await getDoc(doc(db, 'users', chatWithId));
          if (userDoc.exists()) {
            targetUser = { uid: chatWithId, ...userDoc.data() } as User;
          }
        } catch (err) {
          console.error('Failed to fetch target user:', err);
          return;
        }
      }

      if (targetUser) {
        console.log('🎯 Auto-starting conversation with:', targetUser.displayName);
        startConversation(targetUser.uid, targetUser.role, targetUser.displayName || customerName || 'User');
        
        // Clean URL
        const newParams = new URLSearchParams(searchParams);
        newParams.delete('chatWith');
        newParams.delete('name');
        window.history.replaceState({}, '', `${window.location.pathname}${newParams.toString() ? '?' + newParams.toString() : ''}`);
      }
    };
    
    attemptAutoSelect();
  }, [currentUser, users, conversations, searchParams, isLoading, selectedConversation]);

  // --- Handlers ---

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('File too large. Max 10MB allowed.');
        return;
      }
      setSelectedFile(file);
      setError(null);
    }
  };

  const uploadAttachment = async (file: File): Promise<string> => {
    setIsUploading(true);
    try {
      const fileRef = ref(storage, `attachments/${selectedConversation}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`);
      await uploadBytes(fileRef, file);
      return await getDownloadURL(fileRef);
    } catch (err) {
      console.error("Upload failed:", err);
      throw new Error("Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const startConversation = async (targetUserId: string, targetUserRole: string, targetUserName?: string) => {
    if (!currentUser) return;
    if (isCreatingConv) return;

    // Permission Check
    if (!checkRolePermission(userRole, targetUserRole)) {
      setError(`You cannot chat with ${targetUserRole}s.`);
      return;
    }

    setIsCreatingConv(true);
    setError(null);

    try {
      // Check for existing conversation
      const existingConv = conversations.find(
        (conv) =>
          conv.participants.includes(currentUser.uid) &&
          conv.participants.includes(targetUserId)
      );

      if (existingConv) {
        setSelectedConversation(existingConv.id);
        updateActiveUser(targetUserId, targetUserName, targetUserRole);
        if (window.innerWidth < 768) setIsSidebarOpen(false);
        return;
      }

      // Create new
      const convData = {
        participants: [currentUser.uid, targetUserId],
        participantRoles: {
          [currentUser.uid]: userRole,
          [targetUserId]: targetUserRole
        },
        createdBy: currentUser.uid,
        assignedTo: userRole !== 'customer' ? currentUser.uid : undefined,
        lastMessage: 'Conversation started',
        lastMessageTime: serverTimestamp(),
        status: 'open' as const,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      const convRef = await addDoc(collection(db, 'conversations'), convData);
      setSelectedConversation(convRef.id);
      updateActiveUser(targetUserId, targetUserName, targetUserRole);
      
      if (window.innerWidth < 768) setIsSidebarOpen(false);
      
    } catch (err: any) {
      console.error('Error creating conversation:', err);
      setError(err.code === 'permission-denied' ? 'Permission denied.' : 'Failed to start chat.');
    } finally {
      setIsCreatingConv(false);
    }
  };

  const sendMessage = async () => {
    if (!selectedConversation || !currentUser) return;
    if ((!newMessage.trim() && !selectedFile) || isUploading) return;

    try {
      let attachmentUrl = '';
      let attachmentType = '';
      let attachmentName = '';
      
      if (selectedFile) {
        attachmentUrl = await uploadAttachment(selectedFile);
        attachmentType = selectedFile.type.startsWith('image/') ? 'image' : 
                        selectedFile.type.startsWith('video/') ? 'video' : 'file';
        attachmentName = selectedFile.name;
      }

      const messagesRef = collection(db, 'conversations', selectedConversation, 'messages');
      
      await addDoc(messagesRef, {
        senderId: currentUser.uid,
        senderRole: userRole,
        text: newMessage.trim(),
        attachmentUrl,
        attachmentType,
        attachmentName,
        timestamp: serverTimestamp(),
        read: false,
        delivered: true,
      });

      // Update Conversation Preview
      const convRef = doc(db, 'conversations', selectedConversation);
      const previewText = attachmentName 
        ? `📎 ${attachmentName}` 
        : newMessage.trim().substring(0, 50);
        
      await updateDoc(convRef, {
        lastMessage: previewText,
        lastMessageTime: serverTimestamp(),
        updatedAt: serverTimestamp(),
        [`unreadCount.${currentUser.uid}`]: 0, // Reset my unread
        // Increment other user's unread count (simplified logic)
      });

      setNewMessage('');
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      setShowEmojiPicker(false);
      
    } catch (err: any) {
      console.error('Send error:', err);
      setError('Failed to send message.');
    }
  };

  const updateActiveUser = (uid: string, name?: string, role?: string) => {
    const foundUser = users.find(u => u.uid === uid);
    if (foundUser) {
      setActiveUser(foundUser);
    } else if (name) {
      setActiveUser({ uid, displayName: name, role: (role as User['role']) || 'customer', email: '' });
    }
  };

  const getRoleBadge = (role: string) => {
    const map: Record<string, string> = {
      superadmin: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      admin: 'bg-red-500/20 text-red-400 border-red-500/30',
      support: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      customer: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };
    return map[role] || map.customer;
  };

  const formatTime = (ts?: Timestamp) => {
    if (!ts) return '';
    const d = ts.toDate();
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday
      ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getInitial = (name?: string) => {
    if (!name) return 'U';
    return name.trim().charAt(0).toUpperCase();
  };

  const handleEmojiClick = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-3 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-teal-400 font-medium animate-pulse">Loading RegiBIZ Chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-slate-300 flex overflow-hidden font-sans">
      
      {/* ===== SIDEBAR ===== */}
      <div className={`
        ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0 fixed md:relative z-40 w-80 h-full 
        border-r border-white/5 bg-secondary/95 backdrop-blur-xl 
        flex flex-col transition-transform duration-300 ease-in-out
      `}>
        {/* Header */}
        <div className="p-4 border-b border-white/5 bg-gradient-to-r from-teal-900/20 to-blue-900/20">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-cyan-400">
              Messages
            </h2>
            <button className="md:hidden p-2 text-slate-400 hover:text-white" onClick={() => setIsSidebarOpen(false)}>
              <X className="w-5 h-5" />
            </button>
          </div>
          
          {userRole !== 'customer' && (
            <select 
              value={filterRole} 
              onChange={(e) => setFilterRole(e.target.value)} 
              className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-300 focus:ring-1 focus:ring-teal-500 outline-none transition"
            >
              <option value="all">All Users</option>
              {userRole !== 'support' && <option value="support">Support Team</option>}
              {userRole === 'superadmin' && <option value="admin">Admins</option>}
              <option value="customer">Customers</option>
            </select>
          )}
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto p-2 custom-scrollbar">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-2 mt-2">
            {userRole === 'support' ? 'Customers' : userRole === 'customer' ? 'Support & Admin' : 'Team Members'}
          </h3>
          
          {users.length === 0 ? (
            <div className="text-center py-8 text-slate-600 text-sm">No users found</div>
          ) : (
            users.map((user: User) => (
              <button
                key={user.uid}
                onClick={() => startConversation(user.uid, user.role, user.displayName)}
                disabled={isCreatingConv}
                className="w-full text-left p-3 rounded-xl hover:bg-white/5 transition-all duration-200 mb-1 flex items-center gap-3 disabled:opacity-50 group"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center border border-white/5 group-hover:border-teal-500/30 transition-colors">
                    <span className="text-sm font-bold text-slate-200">{getInitial(user.displayName)}</span>
                  </div>
                  {user.isOnline && (
                    <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-[#000000cc] rounded-full shadow-lg shadow-emerald-500/20" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium text-slate-200 truncate group-hover:text-teal-300 transition-colors">
                      {user.displayName || 'Unknown User'}
                    </p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full border ${getRoleBadge(user.role)}`}>
                    {user.role}
                  </span>
                </div>
              </button>
            ))
          )}

          {/* Recent Conversations */}
          {conversations.length > 0 && (
            <>
              <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2 px-2 mt-6">
                Recent Chats
              </h3>
              {conversations.map((conv) => {
                const otherId = conv.participants.find((p: string) => p !== currentUser?.uid);
                const other = users.find((u: User) => u.uid === otherId);
                const active = selectedConversation === conv.id;
                
                return (
                  <button
                    key={conv.id}
                    onClick={() => { 
                      setSelectedConversation(conv.id); 
                      if (other) setActiveUser(other);
                      if(window.innerWidth < 768) setIsSidebarOpen(false); 
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-200 mb-1 flex items-center gap-3 border ${
                      active 
                        ? 'bg-teal-900/10 border-teal-500/30 shadow-lg shadow-teal-900/10' 
                        : 'border-transparent hover:bg-white/5 hover:border-white/5'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-bold text-slate-400">{getInitial(other?.displayName)}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-baseline">
                        <p className="text-sm font-medium text-slate-200 truncate">{other?.displayName || 'Unknown'}</p>
                        <span className="text-[10px] text-slate-500">{formatTime(conv.lastMessageTime)}</span>
                      </div>
                      <p className="text-xs text-slate-500 truncate">{conv.lastMessage || 'No messages yet'}</p>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      </div>

      {/* ===== CHAT AREA ===== */}
      <div className="flex-1 flex flex-col min-w-0 bg-background relative">
        {selectedConversation ? (
          <>
            {/* Chat Header */}
            <div className="h-16 border-b border-white/5 bg-secondary/80 backdrop-blur-md flex items-center justify-between px-4 md:px-6 flex-shrink-0">
              <div className="flex items-center gap-3">
                <button className="md:hidden p-2 text-slate-400 hover:text-white" onClick={() => setIsSidebarOpen(true)}>
                  <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
                </button>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-600 to-blue-700 flex items-center justify-center shadow-lg shadow-teal-900/20">
                    <span className="text-sm font-bold text-white">{getInitial(activeUser?.displayName)}</span>
                  </div>
                  <div>
                    <h3 className="text-white font-semibold text-sm md:text-base flex items-center gap-2">
                      {activeUser?.displayName || 'User'}
                      {activeUser?.isOnline && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />}
                    </h3>
                    <p className="text-xs text-slate-400 flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getRoleBadge(activeUser?.role || 'customer')}`}>
                        {activeUser?.role}
                      </span>
                      {activeUser?.isOnline ? 'Active now' : 'Offline'}
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition hidden sm:block"><Phone className="w-5 h-5" /></button>
                <button className="p-2 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-lg transition hidden sm:block"><Video className="w-5 h-5" /></button>
                <button className="p-2 text-slate-400 hover:text-white hover:bg-white/5 rounded-lg transition"><Info className="w-5 h-5" /></button>
              </div>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 bg-background custom-scrollbar">
              {messages.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                    <MessageIcon className="w-8 h-8" />
                  </div>
                  <p>No messages yet. Say hello!</p>
                </div>
              ) : (
                messages.map((msg) => {
                  const mine = msg.senderId === currentUser?.uid;
                  const hasAttachment = msg.attachmentUrl;
                  return (
                    <div key={msg.id} className={`flex ${mine ? 'justify-end' : 'justify-start'} group`}>
                      <div className={`max-w-[85%] md:max-w-[70%] flex flex-col ${mine ? 'items-end' : 'items-start'}`}>
                        <div className={`
                          rounded-2xl px-4 py-3 shadow-lg relative
                          ${mine 
                            ? 'bg-gradient-to-br from-teal-600 to-cyan-700 text-white rounded-br-sm' 
                            : 'bg-slate-800/80 border border-white/5 text-slate-200 rounded-bl-sm backdrop-blur-sm'}
                        `}>
                          {hasAttachment && (
                            <div className="mb-2 rounded-lg overflow-hidden bg-background/20 border border-white/10">
                              {msg.attachmentType === 'image' ? (
                                <img src={msg.attachmentUrl} alt={msg.attachmentName} className="max-w-full h-auto max-h-64 object-cover cursor-pointer hover:opacity-90 transition" onClick={() => window.open(msg.attachmentUrl, '_blank')} />
                              ) : (
                                <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 hover:bg-background/10 rounded-lg transition">
                                  <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center flex-shrink-0"><FileText className="w-5 h-5" /></div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium truncate">{msg.attachmentName}</p>
                                    <p className="text-xs opacity-70">Tap to download</p>
                                  </div>
                                </a>
                              )}
                            </div>
                          )}
                          
                          {msg.text && <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{msg.text}</p>}
                          
                          <div className={`flex items-center justify-end gap-1 mt-1.5 text-[10px] opacity-70`}>
                            <span>{formatTime(msg.timestamp)}</span>
                            {mine && (
                              <span className="ml-1">
                                {msg.read ? <CheckCheck className="w-3 h-3" /> : <Check className="w-3 h-3" />}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-white/5 p-3 md:p-4 bg-secondary/90 backdrop-blur-xl flex-shrink-0">
              {error && (
                <div className="mb-2 flex items-center gap-2 text-red-400 text-xs bg-red-500/10 p-2 rounded-lg border border-red-500/20">
                  <AlertCircle className="w-3 h-3" /> {error}
                  <button onClick={() => setError(null)} className="ml-auto"><X className="w-3 h-3" /></button>
                </div>
              )}

              {selectedFile && (
                <div className="mb-3 flex items-center gap-3 bg-slate-800/50 border border-slate-700 rounded-xl p-3 max-w-md mx-auto md:mx-0 animate-in fade-in slide-in-from-bottom-2">
                  <div className="w-10 h-10 rounded-lg bg-teal-500/20 flex items-center justify-center text-teal-400 flex-shrink-0">
                    <FileText className="w-5 h-5" />
                  </div>
                  <span className="text-sm text-slate-300 truncate flex-1">{selectedFile.name}</span>
                  <button onClick={() => { setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} className="p-1.5 hover:bg-red-500/20 hover:text-red-400 rounded-lg transition flex-shrink-0"><X className="w-4 h-4" /></button>
                </div>
              )}

              <div className="flex items-end gap-2 max-w-4xl mx-auto">
                <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.txt" />
                
                <button 
                  onClick={() => fileInputRef.current?.click()} 
                  disabled={isUploading} 
                  className="p-3 text-slate-400 hover:text-teal-400 hover:bg-teal-500/10 rounded-xl transition disabled:opacity-50 flex-shrink-0"
                  title="Attach File"
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Paperclip className="w-5 h-5" />}
                </button>

                <div className="flex-1 relative bg-slate-900/50 border border-slate-700 rounded-2xl focus-within:border-teal-500/50 focus-within:ring-1 focus-within:ring-teal-500/20 transition-all">
                  <input 
                    ref={inputRef} 
                    type="text" 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)} 
                    onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())} 
                    placeholder="Type your message about GST, PAN, or MSME..." 
                    className="w-full bg-transparent text-white placeholder-slate-500 px-4 py-3.5 pr-10 focus:outline-none text-sm" 
                  />
                  <button 
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)} 
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-yellow-400 transition"
                  >
                    <Smile className="w-5 h-5" />
                  </button>
                </div>

                <button 
                  onClick={sendMessage} 
                  disabled={(!newMessage.trim() && !selectedFile) || isUploading} 
                  className="p-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-xl hover:from-teal-500 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-900/20 flex-shrink-0 transform active:scale-95"
                >
                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>

              {/* Emoji Picker */}
              {showEmojiPicker && (
                <div className="mt-3 p-3 bg-slate-800/90 border border-slate-700 rounded-xl grid grid-cols-8 gap-2 max-h-40 overflow-y-auto shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2">
                  {['😀','😂','😍','','🙏','','💯','','✅','','⚠️','💡','📌','','📎','','👋','','😎','','🎯','✨','🚀',''].map(emoji => (
                    <button key={emoji} onClick={() => handleEmojiClick(emoji)} className="text-xl hover:bg-slate-700 rounded p-1 transition transform hover:scale-110">{emoji}</button>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex flex-col items-center justify-center bg-background relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
            
            <div className="relative z-10 text-center p-8">
              <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/5 flex items-center justify-center shadow-2xl shadow-teal-900/10">
                <svg className="w-10 h-10 text-teal-500/50" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-2xl font-bold text-white mb-2 bg-clip-text text-transparent bg-gradient-to-r from-teal-400 to-cyan-400">
                RegiBIZ Secure Chat
              </h3>
              <p className="text-slate-400 max-w-md mx-auto mb-8">
                Select a contact from the sidebar to start a secure conversation regarding your GST, MSME, or PAN applications.
              </p>
              <div className="flex items-center justify-center gap-4 text-xs text-slate-500">
                <span className="flex items-center gap-1"><Check className="w-3 h-3" /> End-to-End Encrypted</span>
                <span className="flex items-center gap-1"><Check className="w-3 h-3" /> Real-time Support</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Mobile Overlay */}
      {isSidebarOpen && (
        <div className="md:hidden fixed inset-0 bg-background/60 backdrop-blur-sm z-30" onClick={() => setIsSidebarOpen(false)} />
      )}
    </div>    
  );
}

// Simple Icon Component for Empty State
function MessageIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}