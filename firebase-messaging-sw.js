/* 背景推播。金鑰與網頁相同，這是 Firebase Web 設定裡本來就公開的那一組。 */
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCkFppEAtDQwR3-MyWLqia1ipUnWcxjk6k",
  authDomain: "blesspressure-44f92.firebaseapp.com",
  projectId: "blesspressure-44f92",
  storageBucket: "blesspressure-44f92.firebasestorage.app",
  messagingSenderId: "283887828179",
  appId: "1:283887828179:web:e6495cbd11795422ca2826"
});

firebase.messaging();
