// lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// ★以下の内容を、Firebaseコンソールで取得したあなたの構成オブジェクトに書き換えてください★
const firebaseConfig = {
  apiKey: "AIzaSyCscPYtFlF1FugQT3Q2lbgido5tB1v8nCc",
  authDomain: "odorio-app.firebaseapp.com",
  projectId: "odorio-app",
  storageBucket: "odorio-app.firebasestorage.app",
  messagingSenderId: "932847712539",
  appId: "1:932847712539:web:56d1d246e2ab77c3debbbe",
  measurementId: "G-TS0RJSCYCR"
};

// アプリがすでに初期化されていればそれを使い、なければ新しく作る（二重初期化防止）
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);
const auth = getAuth(app);

// 他のファイルで使えるように export する
export { db, auth };