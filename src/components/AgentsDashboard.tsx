/**
 * AgentsDashboard.tsx
 * 새모양 F&B 에이전트 팀 모니터링 대시보드
 * Firestore run_logs 컬렉션에서 각 봇의 실행 상태를 조회해 카드로 표시
 */

import React, { useState, useEffect } from 'react';
import { reviewDb } from '../firebase';
import {
  collection, getDocs, query, orderBy, limit, where,
} from 'firebase/firestore';
import {
  MessageSquare, Hash, TrendingUp, BarChart2,
  ShieldAlert, Sparkles, RefreshCw, Clock, CheckCircle2,
  XCircle, AlertCircle, Bot,
} from 'lucide-react';

// ==========================================
// 타입 정의
// ==========================================
interface AgentDef {
  id: string;
  label: string;
  botName: string;
  dataCollection: string;
  icon: React.ElementType;
  color: string;
  desc: string;
}

interface StepInfo {
  label?: string;
  status?: string;
  exit_code?: number;
}

interface RunLog {
  id: string;
  bot_name?: string;
  timestamp?: string;
  status?: string;
  steps?: Record<string, StepInfo>;
}

interface ReviewItem {
  id: string;
  매장명?: string;
  작성일?: string;
  리뷰내용?: string;
}

type AgentStatus = 'active' | 'idle' | 'offline';

interface AgentState {
  status: AgentStatus;
  lastRun: string | null;
  stepSummary: string;
}

// ==========================================
// 에이전트 정의
// ==========================================
const AGENTS: AgentDef[] = [
  {
    id: 'review',
    label: '리뷰 수집 봇',
    botName: 'naver_review_crawler',
    dataCollection: 'reviews',
    icon: MessageSquare,
    color: 'blue',
    desc: '네이버 플레이스 방문자 리뷰 자동 수집',
  },
  {
    id: 'keyword',
    label: '키워드 분석 봇',
    botName: 'naver_keyword_crawler',
    dataCollection: 'keywords',
    icon: Hash,
    color: 'violet',
    desc: '리뷰 기반 매장별 핵심 키워드 추출',
  },
  {
    id: 'rank',
    label: '순위 추적 봇',
    botName: 'naver_rank_tracker',
    dataCollection: 'rank_tracking',
    icon: TrendingUp,
    color: 'emerald',
    desc: '네이버 검색 순위 변동 추적',
  },
  {
    id: 'roi',
    label: 'ROI 분석 봇',
    botName: 'keyword_roi_analyzer',
    dataCollection: 'roi_analysis',
    icon: BarChart2,
    color: 'amber',
    desc: '키워드 광고 ROI 효율 분석',
  },
  {
    id: 'competitor',
    label: '경쟁사 모니터링 봇',
    botName: 'competitor_brand_crawler',
    dataCollection: 'competitor_menu',
    icon: ShieldAlert,
    color: 'rose',
    desc: '경쟁 브랜드 메뉴 · 가격 자동 수집',
  },
  {
    id: 'clean',
    label: '데이터 정제 봇',
    botName: 'clean_data',
    dataCollection: 'reviews',
    icon: Sparkles,
    color: 'slate',
    desc: '수집 데이터 품질 검증 및 소급 정제',
  },
];

// ==========================================
// 색상 유틸
// ==========================================
const COLOR_MAP: Record<string, { bg: string; icon: string; border: string; badge: string }> = {
  blue:    { bg: 'bg-blue-50 dark:bg-blue-900/20',    icon: 'text-blue-600 dark:text-blue-400',    border: 'border-blue-100 dark:border-blue-800',    badge: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' },
  violet:  { bg: 'bg-violet-50 dark:bg-violet-900/20', icon: 'text-violet-600 dark:text-violet-400', border: 'border-violet-100 dark:border-violet-800', badge: 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300' },
  emerald: { bg: 'bg-emerald-50 dark:bg-emerald-900/20', icon: 'text-emerald-600 dark:text-emerald-400', border: 'border-emerald-100 dark:border-emerald-800', badge: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300' },
  amber:   { bg: 'bg-amber-50 dark:bg-amber-900/20',   icon: 'text-amber-600 dark:text-amber-400',   border: 'border-amber-100 dark:border-amber-800',   badge: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300' },
  rose:    { bg: 'bg-rose-50 dark:bg-rose-900/20',     icon: 'text-rose-600 dark:text-rose-400',     border: 'border-rose-100 dark:border-rose-800',     badge: 'bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' },
  slate:   { bg: 'bg-slate-100 dark:bg-slate-800',     icon: 'text-slate-500 dark:text-slate-400',   border: 'border-slate-200 dark:border-slate-700',   badge: 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300' },
};

// ==========================================
// 상태 결정 함수
// ==========================================
function resolveAgentStatus(lastRun: string | null, logStatus: string | undefined): AgentStatus {
  if (!lastRun) return 'offline';
  const diffHours = (Date.now() - new Date(lastRun).getTime()) / 1000 / 3600;
  if (logStatus === 'failed') return 'offline';
  if (logStatus === 'partial_failure') return 'idle';
  if (diffHours <= 24 && logStatus === 'success') return 'active';
  if (diffHours <= 168) return 'idle';
  return 'offline';
}

function formatRelativeTime(ts: string | null): string {
  if (!ts) return '실행 기록 없음';
  const diff = Date.now() - new Date(ts).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  return `${days}일 전`;
}

// ==========================================
// 상태 배지 컴포넌트
// ==========================================
function StatusBadge({ status }: { status: AgentStatus }) {
  if (status === 'active') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        활성
      </span>
    );
  }
  if (status === 'idle') {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800">
        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
        대기
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800">
      <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
      오프라인
    </span>
  );
}

// ==========================================
// 메인 컴포넌트
// ==========================================
export function AgentsDashboard() {
  const [agentStates, setAgentStates] = useState<Record<string, AgentState>>({});
  const [recentReviews, setRecentReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      // 가장 최근 _summary 문서 1건 조회
      const summaryQ = query(
        collection(reviewDb, 'run_logs'),
        orderBy('timestamp', 'desc'),
        limit(1),
      );
      const summarySnap = await getDocs(summaryQ);

      let summaryDoc: RunLog | null = null;
      if (!summarySnap.empty) {
        const d = summarySnap.docs[0];
        summaryDoc = { id: d.id, ...(d.data() as Omit<RunLog, 'id'>) };
      }

      // 각 봇별 마지막 실행 로그 조회 (bot_name 필드 기준)
      const newStates: Record<string, AgentState> = {};

      for (const agent of AGENTS) {
        let lastRun: string | null = null;
        let logStatus: string | undefined;
        let stepSummary = '정보 없음';

        try {
          const botQ = query(
            collection(reviewDb, 'run_logs'),
            where('bot_name', '==', agent.botName),
            orderBy('timestamp', 'desc'),
            limit(1),
          );
          const botSnap = await getDocs(botQ);
          if (!botSnap.empty) {
            const d = botSnap.docs[0].data() as Omit<RunLog, 'id'>;
            lastRun = d.timestamp ?? null;
            logStatus = d.status;

            if (d.steps) {
              const steps = Object.values(d.steps);
              const total = steps.length;
              const succeeded = steps.filter(s => s.status === 'success' || s.exit_code === 0).length;
              const failed = steps.filter(s => s.status === 'failed' || (s.exit_code !== undefined && s.exit_code !== 0)).length;
              if (total > 0) {
                stepSummary = `${total}단계 중 ${succeeded}개 완료${failed > 0 ? `, ${failed}개 실패` : ''}`;
              }
            } else if (logStatus === 'success') {
              stepSummary = '완료';
            } else if (logStatus === 'failed') {
              stepSummary = '실패';
            } else if (logStatus === 'partial_failure') {
              stepSummary = '부분 실패';
            }
          }

          // summaryDoc에서 이 봇의 steps를 참고해 보완
          if (summaryDoc && summaryDoc.steps) {
            const matchedStep = Object.values(summaryDoc.steps).find(
              (s) => s.label?.toLowerCase().includes(agent.id) || s.label?.toLowerCase().includes(agent.botName.split('_')[0])
            );
            if (matchedStep && !lastRun) {
              logStatus = matchedStep.status;
            }
          }
        } catch {
          // 권한 오류 등 — offline 처리
        }

        newStates[agent.id] = {
          status: resolveAgentStatus(lastRun, logStatus),
          lastRun,
          stepSummary,
        };
      }

      setAgentStates(newStates);

      // reviews 컬렉션 최신 10건 조회
      try {
        const reviewQ = query(
          collection(reviewDb, 'reviews'),
          orderBy('작성일', 'desc'),
          limit(10),
        );
        const reviewSnap = await getDocs(reviewQ);
        const items: ReviewItem[] = [];
        reviewSnap.forEach(d => items.push({ id: d.id, ...(d.data() as Omit<ReviewItem, 'id'>) }));
        setRecentReviews(items);
      } catch {
        // 리뷰 컬렉션 조회 실패 무시
      }

      setLastRefreshed(new Date());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stateValues = Object.values(agentStates) as AgentState[];
  const activeCount = stateValues.filter(s => s.status === 'active').length;
  const idleCount   = stateValues.filter(s => s.status === 'idle').length;
  const offlineCount = stateValues.filter(s => s.status === 'offline').length;

  return (
    <div className="space-y-6">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">에이전트 팀</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">자동화 봇 실행 상태 모니터링</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-slate-400 dark:text-slate-500">
            마지막 갱신: {lastRefreshed.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            새로고침
          </button>
        </div>
      </div>

      {/* 요약 KPI */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: '활성', count: activeCount,  bg: 'bg-emerald-50 dark:bg-emerald-900/20', text: 'text-emerald-700 dark:text-emerald-400', dot: 'bg-emerald-500' },
          { label: '대기', count: idleCount,    bg: 'bg-amber-50 dark:bg-amber-900/20',    text: 'text-amber-700 dark:text-amber-400',   dot: 'bg-amber-400' },
          { label: '오프라인', count: offlineCount, bg: 'bg-rose-50 dark:bg-rose-900/20',    text: 'text-rose-700 dark:text-rose-400',     dot: 'bg-rose-500' },
        ].map(kpi => (
          <div key={kpi.label} className={`flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900`}>
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${kpi.bg}`}>
              <span className={`w-2.5 h-2.5 rounded-full ${kpi.dot}`} />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500">{kpi.label}</p>
              <p className={`text-lg font-bold ${kpi.text}`}>{kpi.count}<span className="text-xs font-medium ml-0.5">봇</span></p>
            </div>
          </div>
        ))}
      </div>

      {/* 에이전트 카드 그리드 */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map(a => (
            <div key={a.id} className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 animate-pulse h-32" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {AGENTS.map(agent => {
            const Icon = agent.icon;
            const colors = COLOR_MAP[agent.color] ?? COLOR_MAP.slate;
            const state = agentStates[agent.id];
            const status = state?.status ?? 'offline';
            const lastRun = state?.lastRun ?? null;
            const stepSummary = state?.stepSummary ?? '정보 없음';

            let statusIcon: React.ReactNode;
            let statusLabel: string;
            if (status === 'active') {
              statusIcon = <CheckCircle2 size={13} className="text-emerald-500" />;
              statusLabel = '완료';
            } else if (status === 'idle') {
              statusIcon = <AlertCircle size={13} className="text-amber-500" />;
              statusLabel = '대기 중';
            } else {
              statusIcon = <XCircle size={13} className="text-rose-500" />;
              statusLabel = '오프라인';
            }

            return (
              <div
                key={agent.id}
                className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${colors.bg}`}>
                      <Icon size={17} className={colors.icon} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white leading-tight">{agent.label}</p>
                    </div>
                  </div>
                  <StatusBadge status={status} />
                </div>

                <p className="text-xs text-slate-500 dark:text-slate-400 mb-3 leading-relaxed">{agent.desc}</p>

                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400 dark:text-slate-500">
                    <Clock size={11} />
                    <span>마지막 실행: {formatRelativeTime(lastRun)}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    {statusIcon}
                    <span>{stepSummary}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 최근 수집 리뷰 목록 */}
      <div>
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
          <MessageSquare size={14} className="text-blue-500" />
          최근 수집 리뷰
        </h2>
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="p-6 text-center text-sm text-slate-400">로딩 중...</div>
          ) : recentReviews.length === 0 ? (
            <div className="p-8 text-center">
              <MessageSquare size={32} className="mx-auto text-slate-300 dark:text-slate-600 mb-3" />
              <p className="text-sm text-slate-400 dark:text-slate-500">수집된 리뷰가 없습니다.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {recentReviews.map(review => (
                <div key={review.id} className="flex items-start gap-3 px-4 py-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare size={13} className="text-blue-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                        {review.매장명 ?? '매장명 없음'}
                      </span>
                      {review.작성일 && (
                        <span className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">
                          {review.작성일}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {review.리뷰내용 ? review.리뷰내용.slice(0, 50) : '내용 없음'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
