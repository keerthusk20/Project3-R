import { db } from '../src/services/firebase';
import { doc, setDoc } from 'firebase/firestore';

async function update() {
  await setDoc(doc(db, 'settings', 'socialProof'), {
    customerCount: 12,
    reviewRating: 5.0,
    reviewCount: 12,
    updatedAt: Date.now()
  }, { merge: true });
  console.log("Updated to 12 reviews!");
  process.exit(0);
}
update();
