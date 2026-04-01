import React, { useState } from 'react';
import { auth, db } from '../firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  sendEmailVerification, 
  sendPasswordResetEmail,
  updatePassword,
  signInWithPopup,
  GoogleAuthProvider
} from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { User } from '../types';

export const Auth: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const createUserDocument = async (user: any, displayName?: string) => {
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
      setLoading(true); // App.tsx will handle the redirect
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans">
      <div className="bg-white p-8 rounded-2xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] border border-slate-100 w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">F&B Dashboard</h1>
          <p className="text-sm text-slate-500 mt-2">
            {isForgotPassword ? '비밀번호 찾기' : isLogin ? '로그인' : '회원가입'}
          </p>
        </div>
        
        {error && <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
        {message && <div className="mb-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg">{message}</div>}

        <div className="space-y-4">
          <button 
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 bg-white border border-slate-200 text-slate-700 py-2.5 rounded-lg hover:bg-slate-50 font-medium transition-colors text-sm disabled:opacity-50"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" />
            Google로 계속하기
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-100"></div>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400">또는</span>
            </div>
          </div>

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">이메일</label>
              <input 
                type="email" 
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full border border-slate-200 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-sm"
                placeholder="이메일을 입력하세요"
              />
            </div>
            
            {!isForgotPassword && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">비밀번호</label>
                <input 
                  type="password" 
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full border border-slate-200 px-3 py-2.5 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 focus:border-transparent transition-all text-sm"
                  placeholder="비밀번호를 입력하세요"
                />
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
              className="w-full bg-slate-900 text-white py-2.5 rounded-lg hover:bg-slate-800 font-medium transition-colors mt-4 disabled:opacity-50"
            >
              {loading ? '처리 중...' : isForgotPassword ? '비밀번호 재설정 메일 보내기' : isLogin ? '로그인' : '가입하기'}
            </button>
          </form>
        </div>

        <div className="mt-6 text-center text-sm text-slate-500 space-y-2">
          {isForgotPassword ? (
            <button onClick={() => setIsForgotPassword(false)} className="text-slate-900 font-medium hover:underline">
              로그인으로 돌아가기
            </button>
          ) : (
            <>
              <div>
                <button onClick={() => setIsForgotPassword(true)} className="text-slate-900 hover:underline">
                  비밀번호를 잊으셨나요?
                </button>
              </div>
              <div>
                {isLogin ? '계정이 없으신가요? ' : '이미 계정이 있으신가요? '}
                <button onClick={() => setIsLogin(!isLogin)} className="text-slate-900 font-medium hover:underline">
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setLoading(true);
    setError('');
    try {
      await updatePassword(auth.currentUser, newPassword);
      alert('비밀번호가 변경되었습니다.');
      onClose();
    } catch (err: any) {
      setError(err.message || '비밀번호 변경 실패. (최근 로그인한 상태여야 합니다)');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm overflow-hidden p-6">
        <h2 className="text-lg font-semibold mb-4">비밀번호 변경</h2>
        {error && <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">{error}</div>}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">새 비밀번호</label>
            <input 
              type="password" 
              required
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm"
              placeholder="새 비밀번호 입력"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 rounded-md">취소</button>
            <button type="submit" disabled={loading} className="px-4 py-2 text-sm text-white bg-slate-900 hover:bg-slate-800 rounded-md disabled:opacity-50">
              변경
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
