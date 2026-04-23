import { getApp, getApps, initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";

export const firebaseConfig = {
  apiKey: "AIzaSyBCXImZjshTb_0vQb1sYSb632Qjk52_UL0",
  authDomain: "barter-e7775.firebaseapp.com",
  projectId: "barter-e7775",
  storageBucket: "barter-e7775.firebasestorage.app",
  messagingSenderId: "465254216539",
  appId: "1:465254216539:web:461d1dbd6f8410c086607e",
  measurementId: "G-N0TC5BQNC9"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
