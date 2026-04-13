import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// AI Studio named DB — 브랜드·메뉴·원가·리뷰 (읽기 위주, quota 제한 있음)
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const reviewDb = db;

// Standard (default) DB — 매출 데이터 전용 (대량 쓰기 가능, quota 여유)
// ⚠️ Firebase Console > Standard DB > Rules 에서 아래 규칙 적용 필요:
// allow read, write: if request.auth != null;
export const salesDb = getFirestore(app);

// 파일 업로드용 Storage
export const storage = getStorage(app);