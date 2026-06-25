import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyBUcmLapN8b6qFAAbu9IvCF4rRXIe9koho",
  authDomain: "regibiz2026.firebaseapp.com",
  projectId: "regibiz2026",
  storageBucket: "regibiz2026.firebasestorage.app",
  messagingSenderId: "727187432645",
  appId: "1:727187432645:web:5da4504ea525d0a2a23cac",
  measurementId: "G-5167Y99B2R",    
};
  
// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app);
export const storage = getStorage(app);