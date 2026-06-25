//indexconst functions = require("firebase-functions");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

// ✅ USE onCall INSTEAD OF onRequest
exports.generateDSCCaseId = functions.https.onCall(async (data, context) => {
  // 1. Security Check: Ensure user is logged in
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be logged in to generate a Case ID."
    );
  }

  const year = data.year || new Date().getFullYear();
  const counterRef = db.collection("counters").doc("dsc_cases");

  try {
    return await db.runTransaction(async (transaction) => {
      const counterDoc = await transaction.get(counterRef);
      let nextId = 1;
      let lastYear = year;

      if (counterDoc.exists) {
        const counterData = counterDoc.data();
        // If it's the same year, increment. If new year, reset to 1.
        if (counterData.year === year) {
          nextId = counterData.current + 1;
        } else {
          nextId = 1;
          lastYear = year;
        }
      }

      // Update the counter
      transaction.set(counterRef, { current: nextId, year: lastYear }, { merge: true });

      // Format: DSC-2026-0001
      const paddedId = String(nextId).padStart(4, "0");
      const caseId = `DSC-${year}-${paddedId}`;

      return { caseId: caseId };
    });
  } catch (error) {
    console.error("Error generating Case ID:", error);
    throw new functions.https.HttpsError("internal", "Could not generate Case ID");
  }
});