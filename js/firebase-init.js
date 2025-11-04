// js/firebase-init.js
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getDatabase } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBnaTr8kIsNdJTKhZQIpcs7ZcocnXCd1sE",
  authDomain: "card-8a025.firebaseapp.com",
  databaseURL: "https://card-8a025-default-rtdb.firebaseio.com", // ✅ Realtime Database URL
  projectId: "card-8a025",
  storageBucket: "card-8a025.firebasestorage.app",
  messagingSenderId: "752630162630",
  appId: "1:752630162630:web:2ea00951368f2636e0a3c7",
  measurementId: "G-D6DNS0ZWY5"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const database = getDatabase(app); // ✅ Realtime Database

console.log('✅ Firebase initialized successfully');
console.log('✅ Realtime Database URL:', firebaseConfig.databaseURL);

// Make available globally
window.auth = auth;
window.db = db;
window.database = database;
window.firebaseApp = app;

export { auth, db, database, app };
