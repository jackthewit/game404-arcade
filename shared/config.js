// Supabase 공개 연결 설정 — onlinegym 프로젝트를 다른 앱(arte_, att_)과 함께 사용 (표·함수는 g404_ 접두사)
// Vercel 환경변수(/api/config)가 있으면 그 값을 우선 사용하고, 없으면 이 공개 설정을 폴백으로 사용한다.
export const SUPABASE_FALLBACK = {
  url: 'https://zaxwhkbeuriuxbtvlwsi.supabase.co',
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpheHdoa2JldXJpdXhidHZsd3NpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM2MjgwNzQsImV4cCI6MjEwOTIwNDA3NH0.rXuoxJxtbZU7vog7dMNwLpeiMeJd6YK6W_ZNGS36ZFM',
};
