// Firebase Configuration
// TODO: Замените эти значения на ваши данные из Firebase Console
// https://console.firebase.google.com/

const firebaseConfig = {
  apiKey: "AIzaSyBKBsGkKsiy0DWYG8vupn2DjKiWELlbM3Y",
  authDomain: "sphere-33177.firebaseapp.com",
  projectId: "sphere-33177",
  storageBucket: "sphere-33177.firebasestorage.app",
  messagingSenderId: "1016062837244",
  appId: "1:1016062837244:web:e5a928c6ba78253ebc7279",
  measurementId: "G-MZSFD5R8QB"
};

// Инициализация Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// Экспорт для использования в других файлах
window.db = db;
