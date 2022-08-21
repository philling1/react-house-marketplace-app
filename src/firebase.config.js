import { initializeApp } from "firebase/app";
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyDAJKFKtYN_rcnUElpCLZrtEX8bPQ2vW0o",
  authDomain: "house-marketplace-app-b40ac.firebaseapp.com",
  projectId: "house-marketplace-app-b40ac",
  storageBucket: "house-marketplace-app-b40ac.appspot.com",
  messagingSenderId: "913265886707",
  appId: "1:913265886707:web:8a0f4d6dbcf32d52d7fe86"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore()