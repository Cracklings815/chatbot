// firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; 

const firebaseConfig = {
  apiKey: "AIzaSyDSfVp6iTI_-pBxJGhMHY1S9kXjAqubuKw",
  authDomain: "appdev-chatbot.firebaseapp.com",
  projectId: "appdev-chatbot",
  storageBucket: "appdev-chatbot.firebasestorage.app",
  messagingSenderId: "385110494392",
  appId: "1:385110494392:web:f2650a42a51fc87f69f84d"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app); 

export { db };
