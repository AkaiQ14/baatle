// js/firebase-config.js
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js';
import { getApp } from 'https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js';

// Get the initialized app
const app = getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };