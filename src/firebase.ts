import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// 직접 서버 쓰기 (메모리 캐시) — named DB에서 persistentLocalCache sync 대기 문제 방지
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const reviewDb = db; // 같은 named DB 인스턴스