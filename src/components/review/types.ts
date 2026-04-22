export interface Review {
  id: string;
  매장명: string;
  작성일: string;
  리뷰내용: string;
  감정분석: '긍정' | '부정' | '중립';
  방문시간?: string;
  동반자?: string;
  고객반응_포인트?: string;
  매장_TOP인기반응?: string;
}

export interface RankData {
  id: string;
  매장명: string;
  타겟키워드: string;
  현재순위: number;
  등락폭: string;
  '1위_매장명': string;
  '1위_사용_키워드': string;
  AI_인사이트: string;
  수집일자: string;
}

export interface RoiData {
  id: string;
  매장명: string;
  세팅된_키워드: string;
  네이버_월간_총검색량: string;
  키워드_적중률: string;
  추천_키워드?: string;
  추천_근거?: string;
}

export interface CompetitorData {
  id: string;
  경쟁브랜드명_엑셀: string;
  실제_플레이스_업체명: string;
  타겟_키워드: string;
  메뉴_및_가격: string;
  수집일자: string;
}

export interface WeeklyReport {
  id: string;
  생성일시: string;
  기간_시작: string;
  기간_종료: string;
  리뷰_요약: {
    총_신규리뷰: string;
    전주_리뷰수: string;
    증감: string;
    긍정수: string;
    부정수: string;
    긍정률: string;
    매장별_집계: {
      매장명: string;
      이번주_리뷰수: string;
      지난주_리뷰수: string;
      증감: string;
      긍정: string;
      부정: string;
      긍정률: string;
    }[];
    부정_리뷰_목록: { 매장명: string; 작성일: string; 리뷰내용: string }[];
  };
  키워드_분석: { 매장명: string; 긍정_핵심키워드: string; 부정_핵심키워드: string }[];
  경쟁사_변동: { 브랜드: string; 변동: string; 이번주_최저가: string; 지난주_최저가: string }[];
  순위_변동: {
    상승_매장: { 매장명: string; 타겟키워드: string; 현재순위: string; 등락폭: string }[];
    하락_매장: { 매장명: string; 타겟키워드: string; 현재순위: string; 등락폭: string }[];
    노출실패: { 매장명: string; 타겟키워드: string }[];
  };
}

export interface ReviewState {
  resolved: string[];
  overridden: string[];
}

export type TabType = 'overview' | 'store' | 'marketing' | 'competitor' | 'weekly';

export function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0];
}

export function parseRate(x: string): number {
  try { return parseFloat(String(x).replace('%', '').replace('분석 불가 (리뷰 없음)', '0')); }
  catch { return 0; }
}

export function getMonthRange(monthOffset: number = 0): { start: string; end: string; label: string } {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + monthOffset;
  const d = new Date(year, month, 1);
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
  const label = `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
  return { start, end, label };
}
