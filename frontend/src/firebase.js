// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCjSH89faj_IUm8_JffpJYx1osyOo5hR80",
  authDomain: "safety-70570.firebaseapp.com",
  projectId: "safety-70570",
  storageBucket: "safety-70570.appspot.com",
  messagingSenderId: "248338638514",
  appId: "1:248338638514:web:e0a4bd6c93eadb4fc7cbab",
  measurementId: "G-X4TSX9J8TR"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);
