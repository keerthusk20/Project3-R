import { UserProfile, UserRole, UserStatus, ServiceDocument, Folder, Invite, Notification, AppMessage } from '../types';
import { generateUserId } from '../utils/helpers';
import { auth, db, storage } from './firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  reload,
  sendEmailVerification,
} from 'firebase/auth';
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  where,
  addDoc,
  orderBy,
  onSnapshot,
  writeBatch,
  arrayUnion,
  deleteField,
  serverTimestamp
} from 'firebase/firestore';

const removeUndefinedFields = <T>(value: T): T => {
  if (Array.isArray(value)) {
    return value.map((item) => removeUndefinedFields(item)) as T;
  }
  if (value && typeof value === 'object') {
    if (Object.getPrototypeOf(value) !== Object.prototype) {
      return value;
    }
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, fieldValue]) => fieldValue !== undefined)
        .map(([key, fieldValue]) => [key, removeUndefinedFields(fieldValue)])
    ) as T;
  }
  return value;
};

// System Users Configuration
const PREDEFINED_SYSTEM_USERS = [
  {
    email: 'keerthana.s@cloudmasa.com',
    role: UserRole.SUPERADMIN,
    displayName: 'Keerthana S'
  },
  {
    email: 'support@cloudmasa.com',
    role: UserRole.ADMIN,
    displayName: 'System Admin'
  },
  {
    email: 'info@cloudmasa.com',
    role: UserRole.SUPPORT,
    displayName: 'Support Staff'
  },
  {
    email: 'demo@gmail.com',
    role: UserRole.CUSTOMER,
    displayName: 'Demo User'
  }
];

// --- Auth Service ---

export const mockAuthService = {
  loginWithEmail: async (email: string, password?: string): Promise<UserProfile> => {
    if (!password) throw new Error("Password is required");

    try {
      const normalizedEmail = email.trim().toLowerCase();
      const isPredefinedUser = PREDEFINED_SYSTEM_USERS.some(u => u.email === normalizedEmail);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await reload(userCredential.user);

      if (!isPredefinedUser && !userCredential.user.emailVerified) {
        await signOut(auth);
        throw new Error("Email not verified. Please check your email for the verification link.");
      }

      return await mockAuthService._handleAuthSuccess(userCredential.user);
    } catch (error: any) {
      if (error?.code === 'permission-denied' || error?.message?.includes('Missing or insufficient permissions')) {
        throw new Error("Permission denied by Firestore rules. Please deploy updated users/expert rules.");
      }
      if (error.code === 'auth/user-not-found') {
        const predefinedUser = PREDEFINED_SYSTEM_USERS.find(u => u.email === email.trim().toLowerCase());

        if (predefinedUser) {
          try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const newUser: UserProfile = {
              uid: userCredential.user.uid,
              email: email,
              displayName: predefinedUser.displayName,
              role: predefinedUser.role,
              status: 'active',
              userId: 'USR-SYS-' + Math.floor(Math.random() * 1000),
              createdAt: Date.now(),
              isExpert: predefinedUser.role !== UserRole.CUSTOMER
            };
            await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
            return newUser;
          } catch (createErr) {
            console.error("Failed to auto-create system user", createErr);
            throw error;
          }
        }
      }

      if (error.code === 'auth/invalid-credential' || error.message.includes('password') || error.code === 'auth/wrong-password') {
        throw new Error("Invalid credentials.");
      }
      throw error;
    }
  },

  _handleAuthSuccess: async (fbUser: any): Promise<UserProfile> => {
    const userDocRef = doc(db, 'users', fbUser.uid);
    const userDocSnap = await getDoc(userDocRef);
    const expertDocRef = doc(db, 'experts', fbUser.uid);
    const expertDocSnap = await getDoc(expertDocRef);

    if (userDocSnap.exists()) {
      const dbUser = userDocSnap.data() as UserProfile;
      if (dbUser.status === 'blocked') throw new Error("Account has been deactivated. Contact admin.");
      if (dbUser.role === UserRole.EXPERT && dbUser.status !== 'active') {
        await signOut(auth);
        if (dbUser.status === 'rejected') throw new Error("Expert application rejected. Please contact support.");
        throw new Error("Expert account is pending admin approval.");
      }
      if (dbUser.role === UserRole.EXPERT && dbUser.isVerifiedExpert !== true) {
        await signOut(auth);
        throw new Error("Expert account is pending admin approval.");
      }

      // Auto-verify demo account if needed
      if (dbUser.email === 'demo@gmail.com' && !dbUser.emailVerified) {
        dbUser.emailVerified = true;
        await updateDoc(userDocRef, { emailVerified: true });
      }

      return dbUser;
    }

    if (expertDocSnap.exists()) {
      const expertUser = expertDocSnap.data() as UserProfile;
      if (expertUser.status === 'blocked') throw new Error("Account has been deactivated. Contact admin.");
      if (expertUser.status !== 'active' || expertUser.isVerifiedExpert !== true) {
        await signOut(auth);
        if (expertUser.status === 'rejected') throw new Error("Expert application rejected. Please contact support.");
        throw new Error("Expert account is pending admin approval.");
      }
      return expertUser;
    }

    const predefinedUser = PREDEFINED_SYSTEM_USERS.find(u => u.email === fbUser.email);
    if (predefinedUser) {
      const superUser: UserProfile = {
        uid: fbUser.uid,
        email: fbUser.email,
        displayName: predefinedUser.displayName,
        role: predefinedUser.role,
        status: 'active',
        userId: 'USR-SYS-' + Math.floor(Math.random() * 1000),
        createdAt: Date.now(),
        isExpert: predefinedUser.role !== UserRole.CUSTOMER,
        emailVerified: true
      };
      await setDoc(userDocRef, superUser);
      return superUser;
    }

    throw new Error("User does not exist.");
  },

  registerWithEmail: async (email: string, password: string, displayName: string, customerId: string, phone: string): Promise<void> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });

      const newUser: UserProfile = {
        uid: userCredential.user.uid,
        email: email,
        displayName: displayName,
        role: UserRole.CUSTOMER,
        status: 'active',
        userId: generateUserId(),
        createdAt: Date.now(),
        emailVerified: false,
        justRegistered: true  // ✅ FLAG: Block auto-login after registration
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);

      // Send verification email
      try {
        const actionCodeSettings = {
          url: `${window.location.origin}/#/verify-email`,
          handleCodeInApp: true,
        };
        await sendEmailVerification(userCredential.user, actionCodeSettings);
        console.log("✅ Verification email sent");
      } catch (error) {
        console.error("❌ Email error:", error);
      }

      // ✅ CRITICAL: Sign out immediately so subscribeToAuth won't auto-trigger onLogin
      await signOut(auth);

    } catch (error: any) {
      if (error.code === 'auth/email-already-in-use') {
        throw new Error("User already exists.");
      }
      throw error;
    }
  },

  loginWithGoogle: async (): Promise<UserProfile> => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      return await mockAuthService._handleAuthSuccess(result.user);
    } catch (error: any) {
      console.error("Google Login Error:", error);
      if (error.code === 'auth/popup-blocked') {
        throw new Error("Popup blocked by your browser. Please allow popups for this website to sign in with Google.");
      }
      if (error.code === 'auth/popup-closed-by-user') {
        throw new Error("Sign-in popup was closed before completion. Please try again.");
      }
      if (error.code === 'auth/cancelled-popup-request') {
        throw new Error("concurrent-request");
      }
      throw new Error(error.message || "Failed to login with Google");
    }
  },

  logout: async () => {
    await signOut(auth);
  },

  getCurrentUser: (): UserProfile | null => {
    const user = auth.currentUser;
    return user ? {
      uid: user.uid,
      email: user.email || '',
      displayName: user.displayName || '',
      role: UserRole.CUSTOMER,
      status: 'active',
      userId: '',
      createdAt: 0
    } : null;
  },

  subscribeToAuth: (callback: (user: UserProfile | null) => void) => {
    let unsubscribeProfile: (() => void) | null = null;
    let currentUid: string | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      currentUid = user?.uid ?? null;

      if (!user) {
        callback(null);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const snap = await getDoc(userDocRef);

        if (currentUid !== user.uid) return;

        if (snap.exists()) {
          const dbUser = snap.data() as UserProfile;

          // ✅ BLOCK auto-login if user just registered
          if (dbUser.justRegistered === true) {
            // Remove the flag so next login works normally
            await updateDoc(userDocRef, { justRegistered: deleteField() });
            // Don't call callback - force manual login
            return;
          }

          if (dbUser.status === 'blocked') throw new Error("Account has been deactivated. Contact admin.");
          callback(dbUser);
        } else {
          callback({
            uid: user.uid,
            email: user.email || '',
            displayName: user.displayName || 'User',
            role: UserRole.CUSTOMER,
            status: 'active',
            userId: 'USR-TEMP',
            createdAt: Date.now(),
          });
        }

        await new Promise((resolve) => setTimeout(resolve, 300));

        if (currentUid !== user.uid) return;

        unsubscribeProfile = onSnapshot(
          userDocRef,
          (docSnap) => {
            if (docSnap.exists()) {
              const dbUser = docSnap.data() as UserProfile;
              // ✅ Also check flag in real-time updates
              if (dbUser.justRegistered !== true) {
                callback(dbUser);
              }
            }
          },
          (error) => {
            console.warn('Auth profile snapshot error:', error.code);
          }
        );
      } catch (e) {
        console.error('Auth subscription error:', e);
        if (currentUid === user.uid) {
          callback(null);
        }
      }
    });

    return () => {
      currentUid = null;
      if (unsubscribeProfile) {
        unsubscribeProfile();
        unsubscribeProfile = null;
      }
      unsubscribeAuth();
    };
  },

  updateUserProfile: async (uid: string, data: Partial<UserProfile>): Promise<void> => {
    if (uid.startsWith('phone_')) return;

    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);

    if (!userSnap.exists()) {
      const baseUser: UserProfile = {
        uid: uid,
        email: auth.currentUser?.email || '',
        displayName: data.displayName || auth.currentUser?.displayName || 'User',
        role: UserRole.CUSTOMER,
        status: 'active',
        userId: 'USR-' + uid.substring(0, 6).toUpperCase(),
        createdAt: Date.now(),
        ...data as any
      };
      if (data.profileCompleted !== undefined) baseUser.profileCompleted = data.profileCompleted;
      await setDoc(userDocRef, baseUser);
      return;
    }

    let newStatus = undefined;
    const currentUserData = userSnap.data() as UserProfile;
    if (currentUserData.status === 'accepted' && (data.phoneNumber || data.company)) {
      newStatus = 'active';
    }

    await updateDoc(userDocRef, {
      ...data,
      ...(newStatus ? { status: newStatus } : {})
    });

    if (data.displayName && auth.currentUser) {
      await updateProfile(auth.currentUser, { displayName: data.displayName });
    }
  },

  uploadProfilePhoto: async (uid: string, file: File): Promise<string> => {
    const storageRef = ref(storage, `profiles/${uid}/${Date.now()}_${file.name}`);
    await uploadBytes(storageRef, file);
    const downloadURL = await getDownloadURL(storageRef);
    return downloadURL;
  },

  resetPassword: async (email: string) => { console.log("Reset", email); },
  resendVerification: async () => { console.log("Resend"); },
  loginWithPhone: async (phone: string, otp: string) => {
    return {
      uid: 'phone_' + phone,
      phoneNumber: phone,
      displayName: 'Mobile User',
      role: UserRole.CUSTOMER,
      status: 'active',
      userId: generateUserId(),
      createdAt: Date.now()
    } as UserProfile;
  }
};

// --- DB Service ---

export const mockDbService = {
  getFolders: async (uid: string): Promise<Folder[]> => {
    if (uid.startsWith('phone_')) return [];

    try {
      const foldersRef = collection(db, 'users', uid, 'folders');
      const snap = await getDocs(foldersRef);
      let userFolders: Folder[] = [];
      snap.forEach(doc => userFolders.push(doc.data() as Folder));

      const systemFolderNames = ['regibiz', 'personal'];
      for (const name of systemFolderNames) {
        if (!userFolders.find(f => f.id === name)) {
          const newFolder: Folder = {
            id: name,
            name: name === 'regibiz' ? 'RegiBIZ' : 'Personal',
            type: 'system',
            userId: uid,
            createdAt: Date.now()
          };
          await setDoc(doc(db, 'users', uid, 'folders', name), newFolder);
          userFolders.push(newFolder);
        }
      }
      return userFolders;
    } catch (e) {
      console.error("Error fetching folders:", e);
      return [];
    }
  },

  createUser: async (userData: {
    email: string;
    password: string;
    displayName: string;
    role: UserRole;
    invitedBy: string;
  }): Promise<void> => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, userData.email, userData.password);

      const newUser: UserProfile = {
        uid: userCredential.user.uid,
        email: userData.email,
        displayName: userData.displayName,
        role: userData.role,
        status: 'invited' as UserStatus,
        userId: 'USR-' + userCredential.user.uid.substring(0, 6).toUpperCase(),
        createdAt: Date.now(),
        invitedBy: userData.invitedBy,
        invitedAt: Date.now(),
        isTemporaryPassword: true
      };

      await setDoc(doc(db, 'users', userCredential.user.uid), newUser);
      await updateProfile(userCredential.user, { displayName: userData.displayName });

    } catch (error: any) {
      console.error("Create user error:", error);
      if (error.code === 'auth/email-already-in-use') {
        throw new Error("User already exists with this email.");
      }
      throw error;
    }
  },

  createFolder: async (name: string, uid: string): Promise<Folder> => {
    if (uid.startsWith('phone_')) throw new Error("Mock users cannot create folders");

    const id = `folder-${Date.now()}`;
    const newFolder: Folder = {
      id,
      name,
      type: 'custom',
      userId: uid,
      createdAt: Date.now()
    };
    await setDoc(doc(db, 'users', uid, 'folders', id), newFolder);
    return newFolder;
  },

  renameFolder: async (folderId: string, newName: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No user logged in");

    if (folderId === 'regibiz' || folderId === 'personal') throw new Error("Cannot rename system folders");

    await updateDoc(doc(db, 'users', uid, 'folders', folderId), { name: newName });
  },

  deleteFolder: async (folderId: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No user logged in");

    if (folderId === 'regibiz' || folderId === 'personal') throw new Error("Cannot delete system folders");

    const docsRef = collection(db, 'users', uid, 'documents');
    const q = query(docsRef, where("folderId", "==", folderId));
    const snap = await getDocs(q);

    const batchPromises = snap.docs.map(d => updateDoc(d.ref, { folderId: 'personal' }));
    await Promise.all(batchPromises);

    await deleteDoc(doc(db, 'users', uid, 'folders', folderId));
  },

  getActiveExperts: async (): Promise<UserProfile[]> => {
    try {
      const expertsRef = collection(db, "experts");
      const q = query(expertsRef, where("status", "==", "active"));
      const snapshot = await getDocs(q);
      const experts: UserProfile[] = [];

      snapshot.forEach((doc) => {
        const userData = doc.data() as UserProfile;
        if ((userData.isExpert === true || userData.role === UserRole.EXPERT) && userData.status === 'active') {
          experts.push(userData);
        }
      });

      return experts;

    } catch (e: any) {
      if (e.code === 'permission-denied' || e.message?.includes('Missing or insufficient permissions')) {
        console.warn("Permission denied for experts query");
        return [];
      }
      console.warn("Error fetching experts:", e);
      return [];
    }
  },

  getDocuments: async (uid: string): Promise<ServiceDocument[]> => {
    if (uid.startsWith('phone_')) return [];

    const docsRef = collection(db, 'users', uid, 'documents');
    const snap = await getDocs(docsRef);
    let docs: ServiceDocument[] = [];
    snap.forEach(doc => docs.push(doc.data() as ServiceDocument));
    return docs;
  },

  getAllDocuments: async (): Promise<{ doc: ServiceDocument, user: UserProfile }[]> => {
    try {
      const docsMap = new Map<string, { doc: ServiceDocument, user: UserProfile }>();

      console.log('[DB] Starting fetch from all sources...');

      try {
        const appsRef = collection(db, 'applications');
        const appSnap = await getDocs(appsRef);

        if (!appSnap.empty) {
          const users = await mockDbService.getAllUsers();
          const userMap = new Map(users.map(u => [u.uid, u]));

          appSnap.forEach(d => {
            const docData = d.data() as ServiceDocument;
            const docUser = userMap.get(docData.userId);
            if (docUser) {
              docsMap.set(docData.id, { doc: docData, user: docUser });
            }
          });
          console.log(`[DB] ✓ Found ${appSnap.size} docs in applications`);
        }
      } catch (e) {
        console.warn('[DB] ✗ Applications root fetch failed:', e);
      }

      try {
        console.log('[DB] Fetching customer subcollections...');

        let allUsers: UserProfile[] = [];
        try {
          allUsers = await mockDbService.getAllUsers();
        } catch (e) {
          console.warn('[DB] getAllUsers failed, trying direct query...');
          const q = query(collection(db, "users"), where("role", "==", UserRole.CUSTOMER));
          const snap = await getDocs(q);
          allUsers = snap.docs.map(d => d.data() as UserProfile);
        }

        const customers = allUsers.filter(u => u.role === UserRole.CUSTOMER);
        console.log(`[DB] Found ${customers.length} customers`);

        

        const promises = customers.map(async (cust) => {
        // ── ADD THIS: skip users with missing/invalid uid ──
        if (!cust.uid || typeof cust.uid !== 'string' || cust.uid.startsWith('pending_')) {
          console.warn(`[DB] Skipping user with invalid uid: ${cust.email}`);
          return;
        }

        try {
          const docsRef = collection(db, 'users', cust.uid, 'documents');
          const snap = await getDocs(docsRef);

          if (!snap.empty) {
            snap.forEach(d => {
              const docData = d.data() as ServiceDocument;
              docsMap.set(`${cust.uid}_${docData.id}`, {
                doc: docData,
                user: cust
              });
            });
            console.log(`[DB] ✓ Fetched ${snap.size} docs for ${cust.email}`);
          }
        } catch (e) {
          console.warn(`[DB] ✗ Failed to fetch docs for ${cust.email}:`, e);
        }
      });

        await Promise.all(promises);
        console.log(`[DB] ✓ Completed customer subcollection fetch`);

      } catch (e) {
        console.error('[DB] ✗ User subcollection fetch CRITICAL error:', e);
      }

      try {
        const msmeRef = collection(db, 'msme-applications');
        const msmeSnap = await getDocs(msmeRef);

        if (!msmeSnap.empty) {
          const allUsers = await mockDbService.getAllUsers();
          const userMap = new Map(allUsers.map(u => [u.uid, u]));

          msmeSnap.forEach(d => {
            const data = d.data() as any;
            const owner = userMap.get(data.userId);
            if (owner) {
              docsMap.set(`msme_${d.id}`, {
                doc: {
                  ...data,
                  id: d.id,
                  title: data.title || 'MSME Registration',
                  taskStatus: data.taskStatus || 'unassigned',
                  submittedAt: data.submittedAt || data.createdAt || Date.now()
                } as ServiceDocument,
                user: owner
              });
            }
          });
          console.log(`[DB] ✓ Found ${msmeSnap.size} MSME applications`);
        }
      } catch (e: any) {
        if (e.code !== 'permission-denied') {
          console.warn('[DB] ✗ MSME fetch failed:', e);
        }
      }

      try {
        const panRef = collection(db, 'pan-applications');
        const panSnap = await getDocs(panRef);

        if (!panSnap.empty) {
          const allUsers = await mockDbService.getAllUsers();
          const userMap = new Map(allUsers.map(u => [u.uid, u]));

          panSnap.forEach(d => {
            const data = d.data() as any;
            const owner = userMap.get(data.userId);
            if (owner) {
              docsMap.set(`pan_${d.id}`, {
                doc: {
                  ...data,
                  id: d.id,
                  title: data.title || 'PAN Application',
                  taskStatus: data.taskStatus || 'unassigned',
                  submittedAt: data.submittedAt || data.createdAt || Date.now()
                } as ServiceDocument,
                user: owner
              });
            }
          });
          console.log(`[DB] ✓ Found ${panSnap.size} PAN applications`);
        }
      } catch (e: any) {
        if (e.code !== 'permission-denied') {
          console.warn('[DB] ✗ PAN fetch failed:', e);
        }
      }

      const result = Array.from(docsMap.values());
      console.log(`[DB] 🎉 TOTAL documents: ${result.length}`);
      return result;

    } catch (e) {
      console.error("[DB] 💥 Critical error in getAllDocuments:", e);
      return [];
    }
  },

  getMsmeApplications: async (): Promise<ServiceDocument[]> => {
    try {
      const msmeRef = collection(db, 'msme-applications');
      const snap = await getDocs(msmeRef);
      const docs: ServiceDocument[] = [];

      snap.forEach(d => {
        const data = d.data() as any;
        docs.push({
          ...data,
          id: d.id,
          title: data.title || 'MSME Registration',
          taskStatus: data.taskStatus || (data.assignedTo ? 'assigned' : 'unassigned'),
          submittedAt: data.submittedAt || data.createdAt || Date.now()
        });
      });
      return docs;
    } catch (e) {
      console.error("Error fetching MSME applications:", e);
      return [];
    }
  },

  getPanApplications: async (): Promise<ServiceDocument[]> => {
    try {
      const panRef = collection(db, 'pan-applications');
      const snap = await getDocs(panRef);
      const docs: ServiceDocument[] = [];

      snap.forEach(d => {
        const data = d.data() as any;
        docs.push({
          ...data,
          id: d.id,
          title: data.title || 'PAN Application',
          taskStatus: data.taskStatus || (data.assignedTo ? 'assigned' : 'unassigned'),
          submittedAt: data.submittedAt || data.createdAt || Date.now()
        });
      });
      return docs;
    } catch (e) {
      console.error("Error fetching PAN applications:", e);
      return [];
    }
  },

  deleteNotification: async (uid: string, notificationId: string): Promise<void> => {
    if (uid.startsWith('phone_')) return;

    try {
      const notifRef = doc(db, "users", uid, "notifications", notificationId);
      await deleteDoc(notifRef);
      console.log(`Notification ${notificationId} deleted for user ${uid}`);
    } catch (error) {
      console.error("Error deleting notification:", error);
      throw error;
    }
  },

  subscribeToAllApplications: (callback: (docs: ServiceDocument[]) => void) => {
    const q = query(collection(db, 'applications'));
    return onSnapshot(q, (snapshot) => {
      const docs: ServiceDocument[] = [];
      snapshot.forEach(d => docs.push(d.data() as ServiceDocument));
      callback(docs);
    }, (error) => {
      console.warn("Application subscription error:", error);
    });
  },

  createDocument: async (document: ServiceDocument): Promise<void> => {
    if (document.userId.startsWith('phone_')) return;

    await setDoc(doc(db, 'users', document.userId, 'documents', document.id), document);

    if (document.type !== 'note' && document.type !== 'file' && document.type !== 'legal') {
      const docWithTaskStatus = {
        ...document,
        taskStatus: document.taskStatus || 'unassigned'
      };
      await setDoc(doc(db, 'applications', document.id), docWithTaskStatus);
    }

    if (document.status === 'paid' || document.status === 'submitted') {
      const notifId = `notif-${Date.now()}`;
      const notification: Notification = {
        id: notifId,
        userId: document.userId,
        title: 'Document Submitted',
        body: `${document.title} has been successfully submitted.`,
        type: 'document',
        read: false,
        createdAt: Date.now(),
        serviceId: document.serviceId,
        redirectUrl: `/documents?id=${document.id}`
      };
      await setDoc(doc(db, 'users', document.userId, 'notifications', notifId), notification);
    }
  },

  updateDocumentStatus: async (docId: string, userId: string, status: string, notes?: string): Promise<void> => {
    const batch = writeBatch(db);

    const userDocRef = doc(db, 'users', userId, 'documents', docId);
    batch.update(userDocRef, { status: status });

    const rootDocRef = doc(db, 'applications', docId);
    batch.set(rootDocRef, { status: status }, { merge: true });

    const notifId = `notif-${Date.now()}`;
    let title = "Status Update";
    let body = `Your application status has changed to ${status}.`;

    if (status === 'approved') {
      title = "Application Approved";
      body = "Congratulations! Your application has been processed and approved.";
    } else if (status === 'processing') {
      title = "Under Review";
      body = "Our team is currently reviewing your application.";
    }

    if (notes) body += ` Note: ${notes}`;

    const notification: Notification = {
      id: notifId,
      userId: userId,
      title: title,
      body: body,
      type: 'system',
      read: false,
      createdAt: Date.now(),
      redirectUrl: `/documents?id=${docId}`
    };

    const notifRef = doc(db, 'users', userId, 'notifications', notifId);
    batch.set(notifRef, notification);

    await batch.commit();
  },

  getUsersByRole: async (role: UserRole): Promise<UserProfile[]> => {
    try {
      const q = query(collection(db, "users"), where("role", "==", role));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => doc.data() as UserProfile);
    } catch (e) {
      console.error("Error fetching users by role:", e);
      return [];
    }
  },

  assignTask: async (docId: string, staffUid: string, adminUid: string) => {
    const batch = writeBatch(db);

    const collectionsToCheck = ['applications', 'msme-applications', 'pan-applications'];
    let foundCollection = '';
    let appSnap: any = null;
    let appRef: any = null;

    for (const colName of collectionsToCheck) {
      const ref = doc(db, colName, docId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        foundCollection = colName;
        appSnap = snap;
        appRef = ref;
        break;
      }
    }

    if (!appSnap || !foundCollection) {
      throw new Error(`Document ${docId} not found in any application collection.`);
    }

    const data = appSnap.data() as ServiceDocument;
    const userId = data.userId;

    batch.update(appRef, {
      assignedTo: staffUid,
      assignedBy: adminUid,
      assignedAt: Date.now(),
      taskStatus: 'assigned',
      status: data.status === 'submitted' ? 'processing' : data.status
    });

    const userDocRef = doc(db, "users", userId, "documents", docId);
    const userDocSnap = await getDoc(userDocRef);

    if (userDocSnap.exists()) {
      batch.update(userDocRef, {
        assignedTo: staffUid,
        assignedBy: adminUid,
        assignedAt: Date.now(),
        taskStatus: 'assigned',
        status: data.status === 'submitted' ? 'processing' : data.status
      });
    } else {
      batch.set(userDocRef, {
        ...data,
        assignedTo: staffUid,
        assignedBy: adminUid,
        assignedAt: Date.now(),
        taskStatus: 'assigned',
        status: data.status === 'submitted' ? 'processing' : data.status
      });
    }

    await batch.commit();
  },

  updateTaskStatus: async (docId: string, newTaskStatus: 'in-progress' | 'completed') => {
    const batch = writeBatch(db);

    const collectionsToCheck = ['applications', 'msme-applications', 'pan-applications'];
    let appRef: any = null;
    let appSnap: any = null;

    for (const colName of collectionsToCheck) {
      const ref = doc(db, colName, docId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        appRef = ref;
        appSnap = snap;
        break;
      }
    }

    if (!appSnap) throw new Error("Doc not found in any collection");

    const data = appSnap.data() as ServiceDocument;

    batch.update(appRef, { taskStatus: newTaskStatus });

    const userDocRef = doc(db, "users", data.userId, "documents", docId);
    batch.update(userDocRef, { taskStatus: newTaskStatus });

    await batch.commit();
  },

  sendMessage: async (docId: string, userId: string, messageText: string, senderProfile: UserProfile): Promise<void> => {
    const newMessage: AppMessage = {
      id: `msg-${Date.now()}`,
      senderId: senderProfile.uid,
      senderName: senderProfile.displayName || 'Support',
      text: messageText,
      timestamp: Date.now(),
      isStaff: senderProfile.role !== UserRole.CUSTOMER
    };

    const batch = writeBatch(db);

    const userDocRef = doc(db, 'users', userId, 'documents', docId);
    batch.update(userDocRef, { messages: arrayUnion(newMessage) });

    const rootDocRef = doc(db, 'applications', docId);
    const rootSnap = await getDoc(rootDocRef);
    if (rootSnap.exists()) {
      batch.set(rootDocRef, { messages: arrayUnion(newMessage) }, { merge: true });
    }

    const isStaffSender = senderProfile.role !== UserRole.CUSTOMER;
    if (isStaffSender) {
      const notifId = `notif-${Date.now()}`;
      const notification: Notification = {
        id: notifId,
        userId: userId,
        title: 'New Message',
        body: `Support: ${messageText.substring(0, 30)}${messageText.length > 30 ? '...' : ''}`,
        type: 'message',
        read: false,
        createdAt: Date.now(),
        redirectUrl: `/documents?id=${docId}&tab=chat`,
        serviceId: docId
      };
      const notifRef = doc(db, 'users', userId, 'notifications', notifId);
      batch.set(notifRef, notification);
    }

    await batch.commit();
  },

  subscribeToUserChat: (userId: string, callback: (messages: AppMessage[]) => void) => {
    const messagesRef = collection(db, 'users', userId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const messages: AppMessage[] = [];
      snapshot.forEach(doc => messages.push(doc.data() as AppMessage));
      callback(messages);
    });
  },

  sendUserChat: async (userId: string, messageText: string, senderProfile: UserProfile, subject?: string): Promise<void> => {
    const newMessage: AppMessage = {
      id: `msg-${Date.now()}`,
      senderId: senderProfile.uid,
      senderName: senderProfile.displayName || 'Support',
      text: messageText,
      timestamp: Date.now(),
      isStaff: senderProfile.role !== UserRole.CUSTOMER,
      subject: subject || 'No Subject',
      read: false
    };

    const messagesRef = collection(db, 'users', userId, 'messages');
    await addDoc(messagesRef, newMessage);

    if (senderProfile.role !== UserRole.CUSTOMER) {
      const notifId = `notif-${Date.now()}`;
      const notification: Notification = {
        id: notifId,
        userId: userId,
        title: subject || 'New Support Message',
        body: `Support: ${messageText.substring(0, 30)}...`,
        type: 'message',
        read: false,
        createdAt: Date.now(),
        redirectUrl: `/documents?tab=chat`
      };
      await setDoc(doc(db, 'users', userId, 'notifications', notifId), notification);
    }
  },

  moveDocument: async (docId: string, targetFolderId: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No user logged in");
    await updateDoc(doc(db, 'users', uid, 'documents', docId), { folderId: targetFolderId });
  },

  copyDocument: async (docId: string, targetFolderId: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No user logged in");

    const originalSnap = await getDoc(doc(db, 'users', uid, 'documents', docId));
    if (originalSnap.exists()) {
      const original = originalSnap.data() as ServiceDocument;
      const newId = `DOC-${Date.now()}`;
      const newDoc: ServiceDocument = {
        ...original,
        id: newId,
        folderId: targetFolderId,
        title: `${original.title} (Copy)`,
        submittedAt: Date.now()
      };
      await setDoc(doc(db, 'users', uid, 'documents', newId), newDoc);
    }
  },

  deleteDocument: async (docId: string): Promise<void> => {
    const uid = auth.currentUser?.uid;
    if (!uid) throw new Error("No user logged in");

    await deleteDoc(doc(db, 'users', uid, 'documents', docId));

    const collectionsToCheck = ['applications', 'msme-applications', 'pan-applications'];
    for (const colName of collectionsToCheck) {
      try {
        await deleteDoc(doc(db, colName, docId));
      } catch (e) { /* ignore if not found */ }
    }
  },

  createNotification: async (uid: string, data: Omit<Notification, 'id' | 'userId'>): Promise<void> => {
    if (uid.startsWith('phone_')) return;

    const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const newNotification: Notification = {
      id: notifId,
      userId: uid,
      ...data,
    };

    try {
      const notifRef = doc(db, 'users', uid, 'notifications', notifId);
      await setDoc(notifRef, newNotification);
      console.log(`Notification created for ${uid}: ${data.title}`);
    } catch (error) {
      console.error("Error creating notification:", error);
      throw error;
    }
  },

  subscribeToNotifications: (uid: string, callback: (notifs: Notification[]) => void) => {
    if (!uid || uid.startsWith('phone_')) {
      callback([]);
      return () => { };
    }

    const notifRef = collection(db, "users", uid, "notifications");
    const q = query(notifRef, orderBy('createdAt', 'desc'));

    return onSnapshot(q, (snapshot) => {
      const notifs: Notification[] = [];
      snapshot.forEach(doc => notifs.push(doc.data() as Notification));
      callback(notifs);
    }, (error) => {
      console.warn("Notification snapshot error:", error.message);
    });
  },

  getNotifications: async (uid: string): Promise<Notification[]> => {
    if (uid.startsWith('phone_')) return [];

    const notifRef = collection(db, "users", uid, "notifications");
    const snap = await getDocs(notifRef);
    let notifs: Notification[] = [];
    snap.forEach(doc => notifs.push(doc.data() as Notification));
    return notifs.sort((a, b) => b.createdAt - a.createdAt);
  },

  markNotificationRead: async (uid: string, notifId: string): Promise<void> => {
    if (uid.startsWith('phone_')) return;
    await updateDoc(doc(db, "users", uid, "notifications", notifId), { read: true });
  },

  markAllNotificationsRead: async (uid: string): Promise<void> => {
    if (uid.startsWith('phone_')) return;

    const notifRef = collection(db, "users", uid, "notifications");
    const q = query(notifRef, where("read", "==", false));
    const snap = await getDocs(q);

    const batch = writeBatch(db);
    snap.docs.forEach((d) => {
      batch.update(d.ref, { read: true });
    });
    await batch.commit();
  },

  getAllUsers: async (): Promise<UserProfile[]> => {
    let users: UserProfile[] = [];
    try {
      const querySnapshot = await getDocs(collection(db, "users"));
      querySnapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      const expertsSnapshot = await getDocs(collection(db, "experts"));
      expertsSnapshot.forEach((docSnap) => {
        const expert = docSnap.data() as UserProfile;
        if (!users.some((u) => u.uid === expert.uid)) {
          users.push(expert);
        }
      });
    } catch (e: any) {
      console.warn("Permission denied listing ALL users globally. Using fallback queries.", e);
      return [];
    }

    try {
      const invitesSnapshot = await getDocs(collection(db, "invites"));
      invitesSnapshot.forEach((d) => {
        const inv = d.data() as Invite;
        if (!inv.used) {
          users.push({
            uid: 'pending_' + d.id,
            email: inv.email,
            displayName: 'Invited User',
            role: inv.role,
            status: 'invited',
            userId: 'PENDING',
            createdAt: inv.createdAt,
            invitedBy: inv.invitedBy,
            invitedAt: inv.createdAt
          });
        }
      });
    } catch (e) {
      console.warn("Could not fetch invites:", e);
    }
    return users;
  },

  getUserByUid: async (uid: string): Promise<UserProfile | null> => {
    if (!uid) return null;
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists()) return userSnap.data() as UserProfile;
    const expertSnap = await getDoc(doc(db, 'experts', uid));
    return expertSnap.exists() ? expertSnap.data() as UserProfile : null;
  },

  getUsersByRoles: async (roles: UserRole[]): Promise<UserProfile[]> => {
    try {
      const usersRef = collection(db, "users");
      const q = query(usersRef, where("role", "in", roles));
      const snapshot = await getDocs(q);

      const users: UserProfile[] = [];
      snapshot.forEach((doc) => {
        users.push(doc.data() as UserProfile);
      });
      return users;
    } catch (e: any) {
      console.warn("Error fetching users by roles:", e);
      return [];
    }
  },

  subscribeToCustomers: (callback: (users: UserProfile[]) => void) => {
    const q = query(collection(db, 'users'), where('role', '==', UserRole.CUSTOMER));
    return onSnapshot(q, (snapshot) => {
      const users: UserProfile[] = [];
      snapshot.forEach(doc => users.push(doc.data() as UserProfile));
      callback(users);
    }, (error) => {
      console.warn("Customer subscription error:", error);
      callback([]);
    });
  },

  inviteUser: async (email: string, role: UserRole, invitedByUid: string): Promise<string> => {
    const q = query(collection(db, "users"), where("email", "==", email));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
      throw new Error("User already exists with this email.");
    }

    const iq = query(collection(db, "invites"), where("email", "==", email), where("used", "==", false));
    const iSnapshot = await getDocs(iq);
    if (!iSnapshot.empty) {
      throw new Error("Invite already pending for this email.");
    }

    const token = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    const invite: Invite = {
      token,
      email,
      role,
      invitedBy: invitedByUid,
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
      createdAt: Date.now(),
      used: false
    };

    await setDoc(doc(db, "invites", token), invite);
    return token;
  },

  resendInvite: async (oldToken: string): Promise<void> => {
    const inviteRef = doc(db, "invites", oldToken);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) {
      throw new Error("Invite not found or already deleted.");
    }

    const oldInvite = inviteSnap.data() as Invite;
    await deleteDoc(inviteRef);
    await mockDbService.inviteUser(oldInvite.email, oldInvite.role, oldInvite.invitedBy);
  },

  validateInviteToken: async (token: string): Promise<Invite> => {
    const inviteRef = doc(db, "invites", token);
    const inviteSnap = await getDoc(inviteRef);

    if (!inviteSnap.exists()) throw new Error("Invalid invite link.");

    const invite = inviteSnap.data() as Invite;
    if (invite.used) throw new Error("This invite has already been used.");
    if (invite.expiresAt < Date.now()) throw new Error("Invite link expired.");

    return invite;
  },

  acceptInvite: async (token: string, password: string, displayName: string): Promise<void> => {
    const invite = await mockDbService.validateInviteToken(token);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, invite.email, password);
      await updateProfile(userCredential.user, { displayName });
      await userCredential.user.reload();
      const newUserProfile: UserProfile = {
        uid: userCredential.user.uid,
        email: invite.email,
        displayName,
        role: invite.role,
        status: 'accepted',
        userId: generateUserId(),
        createdAt: Date.now(),
        invitedBy: invite.invitedBy,
        invitedAt: invite.createdAt
      };

      await setDoc(doc(db, "users", userCredential.user.uid), newUserProfile);
      await updateDoc(doc(db, "invites", token), { used: true, status: 'accepted' });
      await signOut(auth);
    } catch (e: any) {
      if (e.code === 'auth/email-already-in-use') {
        throw new Error("Account already exists. Please login.");
      }
      throw e;
    }
  },

  updateUserRole: async (targetUid: string, newRole: UserRole): Promise<void> => {
    const userRef = doc(db, "users", targetUid);
    await updateDoc(userRef, { role: newRole });
  },

  addUser: async (user: UserProfile): Promise<UserProfile> => {
    try {
      await setDoc(doc(db, 'users', user.uid), user);
      console.log('Expert added successfully:', user.displayName);
      return user;
    } catch (error) {
      console.error('Error adding user:', error);
      throw new Error('Failed to add expert to database');
    }
  },

  toggleUserBlock: async (targetUid: string, currentStatus: UserStatus): Promise<void> => {
    const userRef = doc(db, "users", targetUid);
    const newStatus = currentStatus === 'blocked' ? 'active' : 'blocked';
    await updateDoc(userRef, { status: newStatus });
  },

  deactivateUser: async (targetUid: string): Promise<void> => {
    try {
      if (targetUid.startsWith('pending_')) {
        const token = targetUid.replace('pending_', '');
        await deleteDoc(doc(db, "invites", token));
      } else {
        const userRef = doc(db, "users", targetUid);
        await updateDoc(userRef, { status: 'blocked' });
      }
    } catch (error: any) {
      console.error("Deactivate failed in service:", error);
      throw error;
    }
  },

  deleteSystemUser: async (uid: string): Promise<void> => {
    try {
      await deleteDoc(doc(db, "users", uid));
    } catch (error) {
      console.error("Failed to delete user data:", error);
      throw new Error("System deletion failed");
    }
  },

  toggleExpertStatus: async (uid: string, isExpert: boolean): Promise<void> => {
    await updateDoc(doc(db, 'users', uid), { isExpert });
    try {
      await updateDoc(doc(db, 'experts', uid), { isExpert });
    } catch {
      // Expert doc may not exist for legacy users; keep users update as fallback.
    }
  },

  getAllExpertApplications: async (): Promise<any[]> => {
    const snap = await getDocs(collection(db, 'expert_applications'));
    return snap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        ...data,
        uid: data.uid || d.id,
        fullName: data.fullName || data.displayName || data.name || 'Expert',
        status: data.status || 'pending',
        createdAt: data.createdAt || data.appliedAt,
      };
    }).sort((a, b) => {
      const aTime = a.createdAt?.toMillis ? a.createdAt.toMillis() : new Date(a.createdAt || 0).getTime();
      const bTime = b.createdAt?.toMillis ? b.createdAt.toMillis() : new Date(b.createdAt || 0).getTime();
      return bTime - aTime;
    });
  },

  approveExpertApplication: async (applicationId: string, reviewedBy: string, expectedExpertUid?: string): Promise<void> => {
    const appRef = doc(db, 'expert_applications', applicationId);
    const appSnap = await getDoc(appRef);
    if (!appSnap.exists()) throw new Error("Expert application not found.");

    const app = appSnap.data() as any;
    const uid = app.applicationId || applicationId;
    if (!uid) {
      throw new Error("Expert UID missing on application. Cannot approve.");
    }
    if (expectedExpertUid && uid !== expectedExpertUid) {
      throw new Error("Expert UID mismatch. Refresh and approve the correct application.");
    }
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);
    if (!userSnap.exists()) {
      throw new Error("Cannot approve this expert because the pending user profile is missing. Ask the expert to register again, or allow staff to create users in Firestore rules before approving old applications.");
    }

    const professionalType = app.professionalDetails?.professionalType;
    const expertRole = professionalType === 'lawyer' ? 'Lawyer' : 'CA';
    const professionalTag = expertRole === 'CA' ? 'CA' : 'Advocate';
    const name = app.fullName || app.displayName || 'Expert';
    const specializationAreas = app.professionalDetails?.specializationAreas || [];
    const specialization = specializationAreas.length > 0
      ? specializationAreas.join(', ')
      : expertRole === 'CA' ? 'Chartered Accountant' : 'Legal Expert';

    const userData: Partial<UserProfile> = {
      uid,
      email: app.email || '',
      displayName: name,
      phoneNumber: app.phoneNumber || app.phone || '',
      alternatePhone: app.secondaryPhone || '',
      role: UserRole.EXPERT,
      status: 'active',
      userId: app.userId || `EXP-${uid.slice(0, 6).toUpperCase()}`,
      isExpert: true,
      expertise: expertRole === 'CA' ? 'Chartered Accountant' : 'Advocate',
      isVerifiedExpert: true,
      professionalDetails: app.professionalDetails,
      emailVerified: true,
      justRegistered: false,
      updatedAt: Date.now(),
    };

    const expertData = {
      id: uid,
      userId: uid,
      name,
      email: app.email || '',
      role: UserRole.EXPERT,
      isExpert: true,
      isVerifiedExpert: true,
      status: 'active',
      professionalType: expertRole === 'CA' ? 'ca' : 'advocate',
      professionalTag,
      specialization,
      availabilityStatus: 'Available',
      rating: app.rating || 0,
      totalConsultations: app.totalConsultations || 0,
      bio: app.bio || '',
      isActive: true,
      professionalDetails: app.professionalDetails || null,
      createdAt: app.createdAt || app.appliedAt || serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    const applicationUpdate = {
      status: 'approved',
      isVerifiedExpert: true,
      reviewedBy,
      reviewedAt: serverTimestamp(),
      rejectionReason: null,
    };

    const runApprovalStep = async (stepName: string, write: () => Promise<void>) => {
      try {
        await write();
      } catch (error: any) {
        console.error(`Expert approval failed while writing ${stepName}:`, error);
        if (error?.code === 'permission-denied') {
          throw new Error(`Approval was blocked by Firestore rules while writing ${stepName}. Check staff access for users, experts, and expert_applications.`);
        }
        if (error?.code || error?.message) {
          throw new Error(`Approval failed while writing ${stepName}: ${error.message || error.code}`);
        }
        throw error;
      }
    };

    await runApprovalStep('users profile', () => setDoc(userRef, removeUndefinedFields(userData), { merge: true }));
    await runApprovalStep('experts profile', () => setDoc(doc(db, 'experts', uid), removeUndefinedFields(expertData), { merge: true }));
    await runApprovalStep('expert application', () => setDoc(appRef, removeUndefinedFields(applicationUpdate), { merge: true }));
  },

  rejectExpertApplication: async (applicationId: string, reviewedBy: string, rejectionReason: string): Promise<void> => {
    const appRef = doc(db, 'expert_applications', applicationId);
    const appSnap = await getDoc(appRef);
    if (!appSnap.exists()) throw new Error("Expert application not found.");

    const app = appSnap.data() as any;
    const uid = app.applicationId || applicationId;
    const batch = writeBatch(db);
    batch.set(appRef, {
      status: 'rejected',
      isVerifiedExpert: false,
      reviewedBy,
      reviewedAt: serverTimestamp(),
      rejectionReason,
    }, { merge: true });
    batch.set(doc(db, 'users', uid), {
      status: 'rejected',
      isVerifiedExpert: false,
      rejectionReason,
      justRegistered: deleteField(),
      updatedAt: Date.now(),
    }, { merge: true });
    await batch.commit();
  }
};