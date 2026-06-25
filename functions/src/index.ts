/* eslint-disable max-len */
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import * as crypto from "crypto";
import type {Response} from "express";
import {onSchedule} from "firebase-functions/v2/scheduler";
import {onRequest} from "firebase-functions/v2/https";
import {defineSecret} from "firebase-functions/params";

// Initialize Admin SDK
admin.initializeApp();

const googleMapsApiKey = defineSecret("GOOGLE_MAPS_API_KEY");

export const verifyPayment = functions.https.onRequest(
  async (req: functions.https.Request, res: Response) => {
    // Allow CORS for preflight requests if needed
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST");
    res.set("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.status(204).send("");
      return;
    }

    try {
      // 1. Retrieve Secret from Environment Variables
      const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

      if (!KEY_SECRET) {
        console.error("Missing Razorpay Secret");
        res.status(500).json({error: "Server configuration error"});
        return;
      }

      // 2. Extract Payload from Request Body
      const {
        razorpay_order_id: razorpayOrderId,
        razorpay_payment_id: razorpayPaymentId,
        razorpay_signature: razorpaySignature,
      } = req.body;

      if (
        !razorpayOrderId ||
                !razorpayPaymentId ||
                !razorpaySignature
      ) {
        res.status(400).json({error: "Missing required fields"});
        return;
      }

      // 3. Verify Signature
      const generatedSignature = crypto
        .createHmac("sha256", KEY_SECRET)
        .update(razorpayOrderId + "|" + razorpayPaymentId)
        .digest("hex");

      if (generatedSignature !== razorpaySignature) {
        console.warn("Invalid Signature received");
        res.status(400).json({
          status: "failure",
          message: "Invalid signature",
        });
        return;
      }

      // 4. Update Firestore Database
      const db = admin.firestore();
      const orderRef = db.collection("orders").doc(razorpayOrderId);

      await orderRef.update({
        paymentStatus: "captured",
        razorpayPaymentId: razorpayPaymentId,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`Payment verified for order: ${razorpayOrderId}`);
      res.status(200).json({status: "success"});
      return;
    } catch (error) {
      console.error("Error verifying payment:", error);
      res.status(500).json({error: "Internal Server Error"});
      return;
    }
  },
);

export const syncAuthToFirestore = functions.https.onCall(async (request: functions.https.CallableRequest) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  // Ensure the caller is a superadmin
  const callerDoc = await db.collection("users").doc(uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== "superadmin") {
    throw new functions.https.HttpsError("permission-denied", "Only SuperAdmin can perform this sync.");
  }

  let syncedCount = 0;
  let pageToken: string | undefined = undefined;

  try {
    do {
      const listUsersResult: any = await admin.auth().listUsers(1000, pageToken);
      pageToken = listUsersResult.pageToken;

      for (const userRecord of listUsersResult.users) {
        const userRef = db.collection("users").doc(userRecord.uid);
        const docSnap = await userRef.get();

        if (!docSnap.exists) {
          const creationTime = userRecord.metadata?.creationTime ?
            Date.parse(userRecord.metadata.creationTime) :
            Date.now();
          const lastLogin = userRecord.metadata?.lastSignInTime ?
            Date.parse(userRecord.metadata.lastSignInTime) :
            Date.now();

          await userRef.set({
            uid: userRecord.uid,
            fullName: userRecord.displayName || "Unnamed User",
            displayName: userRecord.displayName || "Unnamed User",
            email: userRecord.email || "",
            phoneNumber: userRecord.phoneNumber || "",
            photoURL: userRecord.photoURL || "",
            role: "customer",
            status: "active",
            kycStatus: "pending",
            provider: userRecord.providerData?.[0]?.providerId || "password",
            createdAt: creationTime,
            lastLogin: lastLogin,
            source: "auth_sync",
          });
          syncedCount++;
        }
      }
    } while (pageToken);

    return {success: true, syncedCount};
  } catch (error) {
    console.error("Error syncing users:", error);
    throw new functions.https.HttpsError("internal", "Failed to sync users.");
  }
});

// ─────────────────────────────────────────────
// GOOGLE REVIEWS SYNC
// ─────────────────────────────────────────────

/**
 * Helper function to fetch Google Reviews and update Firestore
 */
async function fetchAndUpdateGoogleReviews() {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;

  if (!apiKey || !placeId) {
    console.error("Missing GOOGLE_PLACES_API_KEY or GOOGLE_PLACE_ID environment variables.");
    return {success: false, error: "Missing configuration"};
  }

  const url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=rating,user_ratings_total&key=${apiKey}`;

  try {
    const response = await fetch(url);
    const data: any = await response.json();

    if (data.status === "OK" && data.result) {
      const db = admin.firestore();

      await db.collection("settings").doc("socialProof").set({
        reviewRating: data.result.rating,
        reviewCount: data.result.user_ratings_total,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      }, {merge: true});

      console.log(`Successfully synced Google Reviews: Rating ${data.result.rating}, Count ${data.result.user_ratings_total}`);
      return {success: true, rating: data.result.rating, count: data.result.user_ratings_total};
    } else {
      console.error("Error from Google Places API:", data.status, data.error_message);
      return {success: false, error: data.error_message || data.status};
    }
  } catch (error) {
    console.error("Error fetching Google reviews:", error);
    return {success: false, error: "Network error"};
  }
}

/**
 * Scheduled function to sync Google Reviews every 24 hours
 */
export const scheduledSyncGoogleReviews = onSchedule("every 24 hours", async (event) => {
  await fetchAndUpdateGoogleReviews();
});

/**
 * HTTP Callable function so admins can manually trigger a sync
 */
export const triggerSyncGoogleReviews = functions.https.onCall(async (request: functions.https.CallableRequest) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  // Ensure the caller is a superadmin
  const callerDoc = await db.collection("users").doc(uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== "superadmin") {
    throw new functions.https.HttpsError("permission-denied", "Only SuperAdmin can perform this action.");
  }

  const result = await fetchAndUpdateGoogleReviews();
  if (!result.success) {
    throw new functions.https.HttpsError("internal", result.error || "Failed to sync Google Reviews.");
  }

  return result;
});

export const getGoogleReviews = onRequest(
  {
    cors: true,
    secrets: [googleMapsApiKey],
  },
  async (req, res) => {
    const placeId = "ChIJJV20g0NhUzoRVh4Dl9OzUW4";

    const url =
      "https://maps.googleapis.com/maps/api/place/details/json" +
      `?place_id=${placeId}` +
      "&fields=name,rating,user_ratings_total,url" +
      `&key=${googleMapsApiKey.value()}`;

    const response = await fetch(url);
    const data = await response.json();

    res.status(200).json({
      rating: data.result?.rating ?? 0,
      reviewCount: data.result?.user_ratings_total ?? 0,
      googleUrl: data.result?.url ?? "",
    });
  }
);

export const deleteAuthUser = functions.https.onCall(async (request: functions.https.CallableRequest) => {
  if (!request.auth) {
    throw new functions.https.HttpsError("unauthenticated", "User must be authenticated.");
  }

  const uid = request.auth.uid;
  const db = admin.firestore();

  // Ensure the caller is a superadmin
  const callerDoc = await db.collection("users").doc(uid).get();
  if (!callerDoc.exists || callerDoc.data()?.role !== "superadmin") {
    throw new functions.https.HttpsError("permission-denied", "Only SuperAdmin can perform this action.");
  }

  const {targetUid} = request.data;
  if (!targetUid) {
    throw new functions.https.HttpsError("invalid-argument", "Missing targetUid.");
  }

  if (targetUid === uid) {
    throw new functions.https.HttpsError("invalid-argument", "Cannot delete yourself.");
  }

  try {
    const userDocRef = db.collection("users").doc(targetUid);
    const userDocSnap = await userDocRef.get();
    const userData = userDocSnap.data() || {};
    const userEmail = userData.email || targetUid;

    // Delete subcollections manually (notifications, documents)
    const subcollections = ["notifications", "documents"];
    for (const subcol of subcollections) {
      const snap = await userDocRef.collection(subcol).get();
      const batch = db.batch();
      snap.docs.forEach((d) => batch.delete(d.ref));
      if (!snap.empty) {
        await batch.commit();
      }
    }

    // Delete from Firestore users collection
    await userDocRef.delete();

    // Delete from Firebase Auth
    await admin.auth().deleteUser(targetUid);

    // Create Audit Log
    await db.collection("auditLogs").add({
      action: "USER_DELETED",
      targetUid: targetUid,
      targetEmail: userEmail,
      performedBy: uid,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      details: "User permanently deleted by SuperAdmin",
    });

    return {success: true};
  } catch (error) {
    console.error("Error deleting user:", error);
    throw new functions.https.HttpsError("internal", "Failed to delete user.");
  }
});
