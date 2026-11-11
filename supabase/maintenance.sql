-- 002 적용 후 Supabase SQL Editor에서 DB 소유자로 실행합니다.
-- 만료 영상/채널과 연결 분석·자막·분류·선정 연결을 삭제하는 정기 작업입니다.
-- 같은 이름의 작업은 갱신됩니다. 앱의 service-role 키는 필요 없습니다.
create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule(
  'youtube-archive-retention',
  '17 * * * *',
  'select public.purge_expired_archive();'
);
select public.archive_maintenance_ready() as maintenance_ready;
