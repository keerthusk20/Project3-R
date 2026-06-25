import { db } from './firebase';
import {
    collection,
    query,
    where,
    getDocs,
    getDoc,
    setDoc,
    doc,
    updateDoc,
    deleteDoc,
    orderBy,
    onSnapshot,
    writeBatch,
    limit as firestoreLimit
} from 'firebase/firestore';
import { UserProfile, UserRole, ServiceDocument, Notification } from '../types';

export const dbService = {
    // --- User Management ---
    async getAllUsers(): Promise<UserProfile[]> {
        const usersSnap = await getDocs(collection(db, "users"));
        const users: UserProfile[] = [];
        usersSnap.forEach(doc => {
            users.push({ uid: doc.id, ...doc.data() } as UserProfile);
        });
        return users;
    },

    async getUsersByRole(role: UserRole): Promise<UserProfile[]> {
        const q = query(collection(db, "users"), where("role", "==", role));
        const snap = await getDocs(q);
        const users: UserProfile[] = [];
        snap.forEach(doc => {
            users.push({ uid: doc.id, ...doc.data() } as UserProfile);
        });
        return users;
    },

    async getUserProfile(uid: string): Promise<UserProfile | null> {
        const userDoc = await getDoc(doc(db, "users", uid));
        if (userDoc.exists()) {
            return { uid: userDoc.id, ...userDoc.data() } as UserProfile;
        }
        return null;
    },

    async updateUserRole(uid: string, newRole: UserRole): Promise<void> {
        await updateDoc(doc(db, "users", uid), { role: newRole, updatedAt: Date.now() });
    },

    async deleteSystemUser(uid: string): Promise<void> {
        // This only deletes the Firestore profile. Auth deletion requires Admin SDK or Cloud Function.
        await deleteDoc(doc(db, "users", uid));
    },

    // --- Application / Task Management ---
    async getAllApplications(): Promise<ServiceDocument[]> {
        const allApps: ServiceDocument[] = [];

        // Define all known collections from Documents.tsx
        const collectionsToFetch = [
            'applications',
            'msme-applications',
            'pan-applications',
            'gst-applications',
            'gst-proprietorship-applications',
            'gst-shop-retail-applications',
            'fssai-applications',
            'trademark-applications',
            'startup-applications',
            'dsc-applications',
            'company-registrations',
            'llp-registrations',
            'dir3kyc-applications',
            'dir-3-kyc-applications',
            'inc20a-applications',
            'adt1-applications',
            'roc-compliance-applications',
            'roc-normal-packages',
            'roc-standard-packages',
            'roc-premium-packages'
        ];

        const fetchPromises = collectionsToFetch.map(async (collName) => {
            try {
                const q = query(collection(db, collName), orderBy("submittedAt", "desc"));
                return await getDocs(q);
            } catch (e) {
                console.warn(`Collection ${collName} fetch failed (possibly missing index):`, e);
                try {
                    // Fallback without ordering to prevent complete failure
                    return await getDocs(collection(db, collName));
                } catch (fallbackErr) {
                    return null;
                }
            }
        });

        const snapshots = await Promise.all(fetchPromises);

        snapshots.forEach((snap, index) => {
            if (!snap || snap.empty) return;

            const collName = collectionsToFetch[index];
            snap.forEach(d => {
                const data = d.data();

                // Hide individual sub-forms if they are part of a master ROC package
                if (data.packageCaseId) return;

                // Skip anything marked as deleted
                if (data.status === 'deleted' || data.isDeleted) return;

                let docType = data.type || 'general';
                
                // Auto-detect types for general applications
                if (docType === 'general' && data.title) {
                    const t = data.title.toLowerCase();
                    if (t.includes('gst')) docType = 'gst';
                    else if (t.includes('fssai')) docType = 'fssai';
                    else if (t.includes('msme')) docType = 'msme';
                    else if (t.includes('pan')) docType = 'pan';
                    else if (t.includes('dsc')) docType = 'dsc';
                    else if (t.includes('shop') || t.includes('establishment')) docType = 'shop-establishment';
                    else if (t.includes('dir-3') || t.includes('dir3')) docType = 'dir3kyc';
                    else if (t.includes('inc-20a') || t.includes('inc20a')) docType = 'inc20a';
                    else if (t.includes('adt-1') || t.includes('adt1')) docType = 'adt1';
                    else if (t.includes('roc')) docType = 'roc';
                    else if (t.includes('aoc-4') || t.includes('aoc4')) docType = 'aoc4';
                    else if (t.includes('inc-22a') || t.includes('inc22a')) docType = 'inc22a';
                    else if (t.includes('mgt-7') || t.includes('mgt7')) docType = 'mgt7a';
                    else if (t.includes('company') || t.includes('pvt ltd') || t.includes('llp') || t.includes('limited liability')) docType = 'company_registration';
                }

                allApps.push({
                    id: d.id,
                    ...data,
                    type: docType,
                    submittedAt: data.submittedAt?.toDate ? data.submittedAt.toDate().getTime() : (data.submittedAt || data.createdAt || Date.now()),
                    sourceCollection: collName
                } as unknown as ServiceDocument);
            });
        });

        return allApps.sort((a, b) => b.submittedAt - a.submittedAt);
    },

    async getAllTickets(): Promise<any[]> {
        try {
            const snap = await getDocs(collection(db, "tickets"));
            const tickets: any[] = [];
            snap.forEach(d => {
                tickets.push({ id: d.id, ...d.data() });
            });
            return tickets.sort((a, b) => {
                const aTime = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime();
                const bTime = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime();
                return bTime - aTime;
            });
        } catch (e) {
            console.error("Error fetching all tickets:", e);
            return [];
        }
    },

    async getAllDrafts(): Promise<ServiceDocument[]> {
        try {
            const snap = await getDocs(collection(db, "drafts"));
            const drafts: ServiceDocument[] = [];
            snap.forEach(d => {
                const data = d.data();
                drafts.push({
                    id: d.id,
                    ...data,
                    submittedAt: data.updatedAt?.toDate ? data.updatedAt.toDate().getTime() : (data.updatedAt || data.createdAt || Date.now())
                } as unknown as ServiceDocument);
            });
            return drafts;
        } catch (e) {
            console.error("Error fetching all drafts:", e);
            return [];
        }
    },

    async updateApplicationStatus(docId: string, userId: string, status: string, sourceCollection: string = 'applications'): Promise<void> {
        const batch = writeBatch(db);

        // 1. Update in the specific root collection (applications, msme-applications, etc.)
        const rootRef = doc(db, sourceCollection, docId);
        batch.update(rootRef, { status, updatedAt: Date.now() });

        // 2. Update in user's subcollection (for customer dashboard consistency)
        const userDocRef = doc(db, 'users', userId, 'documents', docId);
        // Check if doc exists in user subcollection first or just use merge
        batch.set(userDocRef, { status, updatedAt: Date.now() }, { merge: true });

        await batch.commit();
    },

    async assignTask(docId: string, userId: string | undefined, assignedTo: string, assignedBy: string, sourceCollection: string = 'applications'): Promise<void> {
        if (!docId) throw new Error("Document ID is missing. Cannot update database.");
        if (!sourceCollection) throw new Error("Source Collection is missing. Cannot update database.");
        
        const timestamp = Date.now();
        const batch = writeBatch(db);

        const updateData = {
            assignedTo,
            assignedBy,
            assignedAt: timestamp,
            taskStatus: 'assigned',
            updatedAt: timestamp
        };

        batch.update(doc(db, sourceCollection, docId), updateData);
        
        if (userId) {
            batch.set(doc(db, 'users', userId, 'documents', docId), updateData, { merge: true });
        }

        await batch.commit();
    },

    // --- Notification Management ---
    async createNotification(userId: string, notification: Omit<Notification, 'id' | 'userId'>): Promise<void> {
        const notifId = `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const newNotification: Notification = {
            id: notifId,
            userId,
            ...notification,
            createdAt: (notification as any).createdAt || Date.now()
        } as Notification;
        await setDoc(doc(db, 'users', userId, 'notifications', notifId), newNotification);
    },

    async getNotifications(userId: string, limitCount: number = 20): Promise<Notification[]> {
        const q = query(
            collection(db, 'users', userId, 'notifications'),
            orderBy('createdAt', 'desc'),
            firestoreLimit(limitCount)
        );
        const snap = await getDocs(q);
        const notifications: Notification[] = [];
        snap.forEach(d => notifications.push(d.data() as Notification));
        return notifications;
    },

    async markNotificationAsRead(userId: string, notificationId: string): Promise<void> {
        await updateDoc(doc(db, 'users', userId, 'notifications', notificationId), { read: true });
    },

    async deleteNotification(userId: string, notificationId: string): Promise<void> {
        await deleteDoc(doc(db, 'users', userId, 'notifications', notificationId));
    },

    async updateUser(uid: string, data: Partial<UserProfile>): Promise<void> {
        await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: Date.now() });
    }
};