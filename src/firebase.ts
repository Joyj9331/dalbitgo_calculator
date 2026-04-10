import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);

// persistentLocalCache: IndexedDB 오프라인 캐시 우선 → 쓰기 즉시 응답 후 백그라운드 서버 동기화
// → WebSocket 불안정 시 백오프 경고 억제, 업로드 응답성 개선
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
}, firebaseConfig.firestoreDatabaseId);

export const reviewDb = db; // 같은 named DB — 단일 인스턴스로 중복 연결 제거