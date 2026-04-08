import React, { useState } from 'react';
import { useToast } from './Toast';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  updatePassword,
  signInWithPopup,
  GoogleAuthProvider,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { User } from '../types';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [email, setEmail] = useState(localStorage.getItem('rememberedEmail') || '');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [rememberMe, setRememberMe] = useState(!!localStorage.getItem('rememberedEmail'));
  const [autoLogin, setAutoLogin] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const createUserDocument = async (user: any, displayName?: string) => {
    try {
      const userDocRef = doc(db, 'users', user.uid);
      const userDoc = await getDoc(userDocRef);
      
      if (!userDoc.exists()) {
        const isAdminEmail = user.email === 'saemoyang_official@naver.com' || user.email === 'wnsdl9331@gmail.com';
        const newUser: User = {
          uid: user.uid,
          email: user.email || '',
          name: displayName || user.displayName || '사용자',
          role: isAdminEmail ? 'admin' : 'user',
          isApproved: isAdminEmail ? true : false,
          isActive: true,
          createdAt: new Date().toISOString()
        };
        await setDoc(userDocRef, newUser);
        return newUser;
      }
      return userDoc.data() as User;
    } catch (err: any) {
      const message = err.message || String(err);
      if (message.includes('Quota exceeded') || message.includes('resource-exhausted')) {
        setError('Firestore 무료 할당량(Quota)을 모두 소진했습니다. 내일 다시 시도해 주세요.');
      } else {
        setError(message);
      }
      throw err;
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      await createUserDocument(result.user);
    } catch (err: any) {
      setError(err.message || '구글 로그인 실패');
    } finally {
      setLoading(false);
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);

    try {
      if (isForgotPassword) {
        await sendPasswordResetEmail(auth, email);
        setMessage('비밀번호 재설정 이메일이 발송되었습니다.');
        setIsForgotPassword(false);
      } else if (isLogin) {
        if (rememberMe) {
          localStorage.setItem('rememberedEmail', email);
        } else {
          localStorage.removeItem('rememberedEmail');
        }
        
        // Set persistence based on autoLogin preference
        await setPersistence(auth, autoLogin ? browserLocalPersistence : browserSessionPersistence);
        
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        if (!userCredential.user.emailVerified) {
          setError('이메일 인증이 필요합니다. 메일함을 확인해주세요.');
          await auth.signOut();
        } else {
          await createUserDocument(userCredential.user);
        }
      } else {
        // Signup
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(userCredential.user);
        
        // Create user document
        await createUserDocument(userCredential.user, name);
        
        setMessage('회원가입이 완료되었습니다. 이메일 인증 후 관리자 승인을 기다려주세요.');
        await auth.signOut();
        setIsLogin(true);
      }
    } catch (err: any) {
      setError(err.message || '인증 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-4 font-sans transition-colors">
      <div className="bg-white dark:bg-slate-900 p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 dark:border-slate-800 w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-gradient-to-br from-slate-900 to-slate-800 dark:from-blue-600 dark:to-blue-700 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl transform -rotate-3 transition-transform hover:rotate-0">
            <span className="text-white font-black text-3xl italic">S</span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter mb-1">SAEMOYANG F&B</h1>
          <div className="h-1 w-12 bg-blue-600 mx-auto rounded-full mb-4"></div>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            {isForgotPassword ? '비밀번호 찾기' : isLogin ? '관리자 시스템 로그인' : '새로운 계정 등록'}
          </p>
        </div>
        
        {error && <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-800">{error}</div>}
        {message && <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 text-sm rounded-lg border border-green-100 dark:border-green-800">{message}</div>}

        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 py-2.5 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-colors text-sm disabled:opacity-50 shadow-sm"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Google로 계속하기
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100 dark:border-slate-800"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white dark:bg-slate-900 px-2 text-slate-400 dark:text-slate-500">또는</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">이메일</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500 focus:border-transparent transition-all text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                placeholder="이메일을 입력하세요"
              />
            </div>
            
            {!isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">비밀번호</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-200 dark:border-slate-700 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 dark:focus:ring-blue-500 focus:border-transparent transition-all text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
                  placeholder="비밀번호를 입력하세요"
                />
              </div>
            )}

            {isLogin && !isForgotPassword && (
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">아이디 저장</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer group">
                    <input 
                      type="checkbox" 
                      checked={autoLogin}
                      onChange={e => setAutoLogin(e.target.checked)}
                      className="w-4 h-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <span className="text-xs text-slate-500 group-hover:text-slate-700 transition-colors">자동 로그인</span>
                  </label>
                </div>
              </div>
            )}

            {!isLogin && !isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">이름</label>
                <input 
                  type="text" 
                  required
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-sm"
                  placeholder="이름을 입력하세요"
                />
              </div>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-slate-900 dark:bg-blue-600 text-white py-2.5 rounded-lg hover:bg-slate-800 dark:hover:bg-blue-700 font-medium transition-colors mt-4 disabled:opacity-50 shadow-md"
            >
              {loading ? '처리 중...' : isForgotPassword ? '비밀번호 재설정 메일 보내기' : isLogin ? '로그인' : '가입하기'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400 space-y-2">
          {isForgotPassword ? (
            <button onClick={() => setIsForgotPassword(false)} className="text-slate-900 dark:text-blue-400 font-medium hover:underline">
              로그인으로 돌아가기
            </button>
          ) : (
            <>
              <div>
                <button onClick={() => setIsForgotPassword(true)} className="text-slate-900 dark:text-blue-400 hover:underline">
                  비밀번호를 잊으셨나요?
                </button>
              </div>
              <div>
                {isLogin ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
                <button onClick={() => setIsLogin(!isLogin)} className="text-slate-900 dark:text-blue-400 font-medium hover:underline">
                  {isLogin ? '회원가입' : '로그인'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export const ChangePasswordModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const toast = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    setError('');
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success('비밀번호가 변경되었습니다.');
      onClose();
    } catch (err: any) {
      setError(err.message || '비밀번호 변경 실패. (최근 로그인한 상태여야 합니다)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-900 rounded-xl shadow-xl w-full max-w-sm overflow-hidden p-6 border border-slate-200 dark:border-slate-700">
        <h2 className="text-lg font-semibold mb-4 text-slate-900 dark:text-white">비밀번호 변경</h2>
        {error && <div className="mb-4 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded border border-red-100 dark:border-red-800">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">새 비밀번호</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full border border-slate-300 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="새 비밀번호 입력"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors">취소</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-slate-900 dark:bg-blue-600 hover:bg-slate-800 dark:hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors">
              변경
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
