import React, { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { User } from '../types';
import { Check, X, Trash2, ShieldAlert } from 'lucide-react';

export const AdminPanel: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'users'), (snapshot) => {
      const usersData: User[] = [];
      snapshot.forEach((doc) => {
        usersData.push(doc.data() as User);
      });
      setUsers(usersData);
    });
    return () => unsubscribe();
  }, []);

  const handleApprove = async (uid: string, isApproved: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isApproved });
    } catch (error) {
      console.error('Error updating approval:', error);
      alert('권한 업데이트 실패');
    }
  };

  const handleToggleActive = async (uid: string, isActive: boolean) => {
    try {
      await updateDoc(doc(db, 'users', uid), { isActive });
    } catch (error) {
      console.error('Error updating active status:', error);
      alert('상태 업데이트 실패');
    }
  };

  const handleDelete = async (uid: string) => {
    if (window.confirm('정말 이 사용자를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) {
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (error) {
        console.error('Error deleting user:', error);
        alert('사용자 삭제 실패');
      }
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
        <ShieldAlert className="text-slate-700" size={20} />
        <h2 className="text-lg font-semibold text-slate-900">관리자 패널 - 사용자 관리</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left text-slate-600">
          <thead className="text-xs text-slate-700 uppercase bg-slate-50 border-b">
            <tr>
              <th className="px-4 py-3">이름</th>
              <th className="px-4 py-3">이메일</th>
              <th className="px-4 py-3 text-center">권한</th>
              <th className="px-4 py-3 text-center">승인 상태</th>
              <th className="px-4 py-3 text-center">활성 상태</th>
              <th className="px-4 py-3 text-center">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map(user => (
              <tr key={user.uid} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                <td className="px-4 py-3">{user.email}</td>
                <td className="px-4 py-3 text-center">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-700'}`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-center">
                  {user.isApproved ? (
                    <span className="text-green-600 font-medium flex items-center justify-center gap-1"><Check size={14}/> 승인됨</span>
                  ) : (
                    <span className="text-orange-500 font-medium flex items-center justify-center gap-1">대기중</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center">
                  {user.isActive ? (
                    <span className="text-blue-600 font-medium">활성</span>
                  ) : (
                    <span className="text-red-500 font-medium">정지됨</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center space-x-2">
                  {user.role !== 'admin' && (
                    <>
                      <button 
                        onClick={() => handleApprove(user.uid, !user.isApproved)} 
                        className={`px-2 py-1 text-xs rounded-md border ${user.isApproved ? 'border-orange-200 text-orange-600 hover:bg-orange-50' : 'border-green-200 text-green-600 hover:bg-green-50'}`}
                      >
                        {user.isApproved ? '승인 취소' : '가입 승인'}
                      </button>
                      <button 
                        onClick={() => handleToggleActive(user.uid, !user.isActive)} 
                        className={`px-2 py-1 text-xs rounded-md border ${user.isActive ? 'border-red-200 text-red-600 hover:bg-red-50' : 'border-blue-200 text-blue-600 hover:bg-blue-50'}`}
                      >
                        {user.isActive ? '계정 정지' : '계정 활성'}
                      </button>
                      <button 
                        onClick={() => handleDelete(user.uid)} 
                        className="px-2 py-1 text-xs rounded-md border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-red-600"
                        title="완전 삭제"
                      >
                        <Trash2 size={14} />
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
