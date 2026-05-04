import React, { useState, useEffect, useCallback } from 'react';
import { db } from '../firebase';
import {
  collection, query, orderBy, limit, startAfter, getDocs,
  QueryDocumentSnapshot, where
} from 'firebase/firestore';
import { User } from '../types';
import { History, ChevronDown, Filter, X, Search } from 'lucide-react';

interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
  section?: string;
  storeName?: string;
  before?: string;
  after?: string;
}

const ACTION_COLORS: Record<string, string> = {
  '일정 등록':   'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  '일정 수정':   'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  '일정 삭제':   'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  '일정 변경':   'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  '일정 보관':   'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  '진행 체크':   'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  '체크리스트 업데이트': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  '로그인':      'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
};

const PAGE_SIZE = 30;

interface Props {
  currentUser: User;
}

export function ActivityLogView({ currentUser }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(true);

  // 필터
  const [searchText, setSearchText] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterUser, setFilterUser] = useState('');

  const isAdmin = currentUser.role === 'admin';
  const isDeptHead = (currentUser.departmentHeadOf?.length ?? 0) > 0;

  const buildQuery = (afterDoc?: QueryDocumentSnapshot) => {
    let q = query(
      collection(db, 'activity_logs'),
      orderBy('timestamp', 'desc'),
      limit(PAGE_SIZE)
    );
    if (afterDoc) {
      q = query(
        collection(db, 'activity_logs'),
        orderBy('timestamp', 'desc'),
        startAfter(afterDoc),
        limit(PAGE_SIZE)
      );
    }
    return q;
  };

  const fetchLogs = useCallback(async (afterDoc?: QueryDocumentSnapshot) => {
    try {
      const q = buildQuery(afterDoc);
      const snap = await getDocs(q);
      const fetched: ActivityLog[] = snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog));

      // 부서장은 로그인 외 본인 부서 관련 이력만 — storeName 또는 userName 기준 필터
      // (로그에 storeName 필드가 없으면 details 텍스트에서 유추)
      const filtered = isAdmin ? fetched : fetched.filter(log => {
        if (log.action === '로그인') return false;
        // 부서장: 본인이 작성한 로그 + 본인 userName이 포함된 로그
        return log.userId === currentUser.uid || log.userName === currentUser.name;
      });

      if (afterDoc) {
        setLogs(prev => [...prev, ...filtered]);
      } else {
        setLogs(filtered);
      }

      setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
      setHasMore(snap.docs.length === PAGE_SIZE);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [isAdmin, currentUser]);

  useEffect(() => {
    setLoading(true);
    setLogs([]);
    setLastDoc(null);
    setHasMore(true);
    fetchLogs();
  }, [fetchLogs]);

  const loadMore = () => {
    if (!lastDoc || loadingMore) return;
    setLoadingMore(true);
    fetchLogs(lastDoc);
  };

  // 클라이언트 사이드 필터 (검색, 액션, 유저)
  const displayed = logs.filter(log => {
    if (filterAction && log.action !== filterAction) return false;
    if (filterUser && !log.userName.includes(filterUser)) return false;
    if (searchText) {
      const q = searchText.toLowerCase();
      return log.details.toLowerCase().includes(q) || log.userName.toLowerCase().includes(q) || log.action.toLowerCase().includes(q);
    }
    return true;
  });

  const uniqueActions = Array.from(new Set(logs.map(l => l.action)));
  const uniqueUsers = Array.from(new Set(logs.map(l => l.userName)));

  const formatTime = (ts: string) => {
    try {
      return new Date(ts).toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      });
    } catch { return ts; }
  };

  const getTimeAgo = (ts: string) => {
    const diff = Date.now() - new Date(ts).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return '방금 전';
    if (mins < 60) return `${mins}분 전`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}시간 전`;
    const days = Math.floor(hours / 24);
    return `${days}일 전`;
  };

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <div className="flex items-center gap-3">
        <History size={22} className="text-slate-600 dark:text-slate-400" />
        <div>
          <h1 className="text-xl font-black text-slate-900 dark:text-white tracking-tight">변경 이력</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            {isAdmin ? '전체 변경 이력을 조회합니다.' : '내가 수행한 변경 이력을 조회합니다.'}
          </p>
        </div>
      </div>

      {/* 필터 바 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-3 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="매장명, 사용자, 내용 검색..."
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800 text-slate-800 dark:text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>

        <select
          value={filterAction}
          onChange={e => setFilterAction(e.target.value)}
          className="text-xs font-bold px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
        >
          <option value="">전체 유형</option>
          {uniqueActions.map(a => <option key={a} value={a}>{a}</option>)}
        </select>

        {isAdmin && (
          <select
            value={filterUser}
            onChange={e => setFilterUser(e.target.value)}
            className="text-xs font-bold px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200"
          >
            <option value="">전체 사용자</option>
            {uniqueUsers.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
        )}

        {(searchText || filterAction || filterUser) && (
          <button
            onClick={() => { setSearchText(''); setFilterAction(''); setFilterUser(''); }}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-500 transition-colors"
          >
            <X size={13} /> 초기화
          </button>
        )}

        <span className="ml-auto text-xs text-slate-400 font-bold">{displayed.length}건 표시</span>
      </div>

      {/* 로그 목록 */}
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 text-sm">불러오는 중...</div>
        ) : displayed.length === 0 ? (
          <div className="py-16 text-center text-slate-400 text-sm">이력이 없습니다.</div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {displayed.map(log => (
              <div key={log.id} className="px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                <div className="flex items-start gap-3">
                  {/* 액션 뱃지 */}
                  <span className={`mt-0.5 shrink-0 px-2 py-0.5 rounded text-[10px] font-black whitespace-nowrap ${ACTION_COLORS[log.action] ?? 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                    {log.action}
                  </span>

                  {/* 내용 */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 dark:text-slate-100 font-medium leading-snug">
                      {log.details}
                    </p>
                    {/* 변경 전/후 */}
                    {(log.before || log.after) && (
                      <div className="mt-1.5 flex items-center gap-2 text-xs">
                        {log.before && (
                          <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded border border-red-100 dark:border-red-800 line-through">
                            {log.before}
                          </span>
                        )}
                        {log.before && log.after && <span className="text-slate-300">→</span>}
                        {log.after && (
                          <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 rounded border border-emerald-100 dark:border-emerald-800 font-bold">
                            {log.after}
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 우측 메타 */}
                  <div className="shrink-0 text-right space-y-0.5">
                    <p className="text-xs font-bold text-slate-600 dark:text-slate-300">{log.userName}</p>
                    <p className="text-[10px] text-slate-400" title={formatTime(log.timestamp)}>
                      {getTimeAgo(log.timestamp)}
                    </p>
                    <p className="text-[10px] text-slate-300 dark:text-slate-600">
                      {formatTime(log.timestamp).split(' ').slice(0, 2).join(' ')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 더보기 */}
        {!loading && hasMore && (
          <div className="px-5 py-3 border-t border-slate-100 dark:border-slate-800">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full flex items-center justify-center gap-2 py-2 text-sm font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors disabled:opacity-50"
            >
              <ChevronDown size={15} />
              {loadingMore ? '불러오는 중...' : '더보기 (30건)'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
