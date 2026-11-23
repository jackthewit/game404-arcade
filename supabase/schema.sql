-- 이게뭔겜? 404 아케이드 — Supabase 데이터베이스 스키마
-- onlinegym 프로젝트(zaxwhkbeuriuxbtvlwsi)에 다른 앱(arte_, att_ 등)과 함께 둔다. (추가 요금 0원)
-- 표·함수 이름은 모두 g404_ 로 시작하며, 브라우저는 표를 직접 건드리지 않고 g404_ RPC 함수만 호출한다.
-- 여러 번 실행해도 안전하다(멱등성 보장).

create extension if not exists pgcrypto with schema extensions;

-- 1) 관리자 설정 (비밀번호 해시 + 실패 잠금)
create table if not exists public.g404_config (
  k text primary key,
  v text not null,
  updated_at timestamptz not null default now()
);

-- 2) 게임 카탈로그 (관리자 모드에서 공개/공개예정/숨김, 순서, 문구 편집)
create table if not exists public.g404_games (
  id text primary key,
  title text not null,
  kicker text not null default '',
  badge text not null default '',
  description text not null default '',
  metric_label text not null default '',
  thumb_url text not null default '',
  href text not null default '',
  status text not null default 'public' check (status in ('public', 'coming_soon', 'hidden')),
  lock_message text not null default '',
  featured boolean not null default false,
  sort_order integer not null default 100,
  updated_at timestamptz not null default now()
);

create index if not exists idx_g404_games_order
  on public.g404_games (sort_order asc, id asc);

-- 3) 전체 플레이어 글로벌 랭킹 기록
create table if not exists public.g404_runs (
  id text primary key,
  room_id text not null,
  game_id text not null,
  nickname text not null default '익명 도전자',
  target_value numeric not null default 0,
  actual_value numeric not null default 0,
  score numeric not null default 0,
  error_mm numeric,
  rank_title text not null default '',
  seed integer not null default 1,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_g404_runs_global
  on public.g404_runs (game_id, score desc, error_mm asc nulls last, created_at asc);

create index if not exists idx_g404_runs_recent
  on public.g404_runs (game_id, created_at desc);

-- 4) RLS: 브라우저는 테이블에 직접 접근 불가 (아래 g404_ RPC 함수로만 안전하게 접근)
alter table public.g404_config enable row level security;
alter table public.g404_games enable row level security;
alter table public.g404_runs enable row level security;

-- 5) 초기 관리자 비밀번호 해시 (원본 비밀번호는 로컬 .admin-pw-initial 파일 참고, 관리자 > 설정에서 변경)
insert into public.g404_config (k, v)
values ('admin_hash', '663e0dda09e8018b5cb6e4e65c3c1f7def1317e7654b4ef74283b187a25b5a84')
on conflict (k) do nothing;

-- 6) 초기 게임 4종 시드 (이미 있으면 관리자 편집값 유지)
insert into public.g404_games
  (id, title, kicker, badge, description, metric_label, thumb_url, href, status, lock_message, featured, sort_order)
values
  (
    'cake',
    '케이크 글씨 쓰기',
    '한 번 짜면 못 지워요!',
    '🎂 쫀득 초코펜 · 360° 캡처',
    '누르는 시간에 따라 두께가 달라지는 리얼 초코펜! 완성한 케이크에 촛불을 켜고 이리저리 돌려 사진으로 공유해 보세요.',
    '수제 케이크 짤 생성',
    './assets/thumb-cake.jpg',
    './cake/',
    'public',
    '곧 공개 예정입니다! 조금만 기다려 주세요.',
    true,
    10
  ),
  (
    'haircut',
    '어떻게 잘라드릴까요?',
    '왼쪽 · 가운데 · 오른쪽',
    '✂️ 실제 cm · 3구간 컷',
    '눈금 없이 오직 눈대중으로! 세 구간을 고르게 다듬어 목표 길이 오차와 좌우 단차로 실력을 겨뤄 보세요.',
    '오차 mm 랭킹',
    './assets/thumb-haircut.jpg',
    './haircut/',
    'public',
    '곧 공개 예정입니다! 조금만 기다려 주세요.',
    false,
    20
  ),
  (
    'toilet',
    '무한 두루마리',
    '휴… 휴지가 있다!!',
    '🧻 100km 도전 · 미라 진화',
    '중간 심을 피해서 한 방향으로 돌돌돌돌! 안 끊기고 길게 말수록 10m마다 응원 폭죽과 3D 미라 변신이 펼쳐집니다.',
    '길이 m/km 랭킹',
    './assets/thumb-toilet.jpg',
    './toilet/',
    'public',
    '조회수 10만, 댓글 100개 넘으면 진짜 게임 공개!!',
    false,
    30
  ),
  (
    'film',
    '강화필름 한번에',
    '기포 0 · 먼지 0 도전',
    '📱 3D 멀티앵글 · 정밀 부착',
    '탑·프론트·레프트 구도로 미세한 미끄러짐을 잡아 딱 맞춰 붙이고, 굳기 전에 기포를 깔끔하게 밀어내 보세요.',
    '100점 정밀 랭킹',
    './assets/thumb-film.jpg',
    './film/',
    'public',
    '곧 공개 예정입니다! 조금만 기다려 주세요.',
    false,
    40
  )
on conflict (id) do nothing;

-- ───────── 내부 도우미 함수 ─────────
create or replace function public.g404__h(t text) returns text
language sql immutable set search_path = public, extensions as $$
  select encode(extensions.digest(coalesce(t, ''), 'sha256'), 'hex')
$$;

-- 관리자 비밀번호 검증 (8회 실패 시 2분 잠금, 롤백되지 않게 결과 문자열 반환)
create or replace function public.g404__admin_ok(pw text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare
  n int;
  t timestamptz;
begin
  n := coalesce((select v::int from public.g404_config where k = 'fail_n'), 0);
  t := (select v::timestamptz from public.g404_config where k = 'fail_at');
  if n >= 8 and t > now() - interval '2 minutes' then
    return 'locked';
  end if;

  if public.g404__h(pw) = (select v from public.g404_config where k = 'admin_hash') then
    if n > 0 then
      update public.g404_config set v = '0', updated_at = now() where k = 'fail_n';
    end if;
    return 'ok';
  end if;

  insert into public.g404_config (k, v, updated_at)
  values ('fail_n', (n + 1)::text, now())
  on conflict (k) do update set v = excluded.v, updated_at = now();

  insert into public.g404_config (k, v, updated_at)
  values ('fail_at', now()::text, now())
  on conflict (k) do update set v = excluded.v, updated_at = now();

  return 'bad_pw';
end;
$$;

-- ───────── 공개 RPC (브라우저 누구나 호출 가능) ─────────

-- 1) 공개/공개예정 게임 목록 (hidden 제외)
create or replace function public.g404_public_games()
returns table(
  id text,
  title text,
  kicker text,
  badge text,
  description text,
  metric_label text,
  thumb_url text,
  href text,
  status text,
  lock_message text,
  featured boolean,
  sort_order integer
)
language sql stable security definer set search_path = public as $$
  select
    id, title, kicker, badge, description, metric_label,
    thumb_url, href, status, lock_message, featured, sort_order
  from public.g404_games
  where status in ('public', 'coming_soon')
  order by sort_order asc, id asc;
$$;

-- 2) 특정 게임 공개 여부 단건 조회 (게임 페이지 직접 접속 시 잠금 체크)
create or replace function public.g404_get_game(p_id text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(
    (
      select jsonb_build_object(
        'found', true,
        'id', id,
        'title', title,
        'kicker', kicker,
        'badge', badge,
        'thumb_url', thumb_url,
        'status', status,
        'lock_message', lock_message
      )
      from public.g404_games
      where id = p_id
      limit 1
    ),
    jsonb_build_object('found', false)
  );
$$;

-- 3) 스코어 등록 RPC
create or replace function public.g404_submit_run(
  p_id text,
  p_room_id text,
  p_game_id text,
  p_nickname text,
  p_target_value numeric default 0,
  p_actual_value numeric default 0,
  p_score numeric default 0,
  p_error_mm numeric default null,
  p_rank_title text default '',
  p_seed integer default 1,
  p_meta jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_id text := trim(coalesce(p_id, ''));
  v_room text := trim(coalesce(p_room_id, ''));
  v_game text := lower(trim(coalesce(p_game_id, '')));
  v_nick text := left(trim(coalesce(p_nickname, '익명 도전자')), 20);
begin
  if char_length(v_id) < 4 or char_length(v_id) > 16 then
    return jsonb_build_object('ok', false, 'error', 'invalid_id');
  end if;
  if char_length(v_room) < 4 or char_length(v_room) > 16 then
    v_room := v_id;
  end if;
  if v_game !~ '^[a-z0-9_-]{1,32}$' then
    return jsonb_build_object('ok', false, 'error', 'invalid_game');
  end if;
  if char_length(v_nick) = 0 then
    v_nick := '익명 도전자';
  end if;

  insert into public.g404_runs (
    id, room_id, game_id, nickname,
    target_value, actual_value, score, error_mm,
    rank_title, seed, meta
  )
  values (
    v_id, v_room, v_game, v_nick,
    coalesce(p_target_value, 0),
    coalesce(p_actual_value, 0),
    coalesce(p_score, 0),
    p_error_mm,
    left(coalesce(p_rank_title, ''), 40),
    coalesce(p_seed, 1),
    coalesce(p_meta, '{}'::jsonb)
  )
  on conflict (id) do update set
    nickname = excluded.nickname;

  return jsonb_build_object('ok', true, 'id', v_id);
end;
$$;

-- 4) 공유 코드로 지인 기록 1건 조회 RPC
create or replace function public.g404_get_run(p_id text)
returns jsonb
language sql stable security definer set search_path = public as $$
  select to_jsonb(r)
  from public.g404_runs r
  where r.id = p_id
  limit 1;
$$;

-- 5) 전체 유저 백분위 계산 RPC
create or replace function public.g404_get_percentile(p_game_id text, p_score numeric)
returns table(total_count bigint, better_or_equal bigint, top_percent numeric)
language sql stable security definer set search_path = public as $$
  with stats as (
    select
      count(*) as total_count,
      count(*) filter (where score > p_score) as strictly_better
    from public.g404_runs
    where game_id = p_game_id
  )
  select
    total_count,
    strictly_better + 1 as better_or_equal,
    case
      when total_count = 0 then 1.0
      else round(greatest(0.1, ((strictly_better + 1)::numeric / greatest(1, total_count)::numeric) * 100), 1)
    end as top_percent
  from stats;
$$;

-- 6) 전체 글로벌 랭킹 사다리 + 지인 위치 핀 조회 RPC
create or replace function public.g404_get_ladder(
  p_game_id text,
  p_my_id text default null,
  p_ref_id text default null
)
returns table(
  rank_no bigint,
  total_count bigint,
  id text,
  nickname text,
  score numeric,
  error_mm numeric,
  actual_value numeric,
  target_value numeric,
  rank_title text,
  is_me boolean,
  is_ref boolean
)
language sql stable security definer set search_path = public as $$
  with ranked as (
    select
      row_number() over (order by score desc, error_mm asc nulls last, created_at asc) as rank_no,
      count(*) over () as total_count,
      id,
      nickname,
      score,
      error_mm,
      actual_value,
      target_value,
      rank_title
    from public.g404_runs
    where game_id = p_game_id
  ),
  my_pos as (
    select rank_no from ranked where id = p_my_id limit 1
  ),
  ref_pos as (
    select rank_no from ranked where id = p_ref_id limit 1
  )
  select
    r.rank_no,
    r.total_count,
    r.id,
    r.nickname,
    r.score,
    r.error_mm,
    r.actual_value,
    r.target_value,
    r.rank_title,
    (r.id = p_my_id) as is_me,
    (r.id = p_ref_id) as is_ref
  from ranked r
  where
    r.rank_no <= 5
    or r.id = p_my_id
    or r.id = p_ref_id
    or exists (select 1 from my_pos m where abs(r.rank_no - m.rank_no) <= 1)
    or exists (select 1 from ref_pos f where abs(r.rank_no - f.rank_no) <= 1)
  order by r.rank_no asc;
$$;

-- ───────── 관리자 전용 RPC ─────────
create or replace function public.g404_admin(
  p_pw text,
  p_action text,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_auth text;
  v_id text;
  v_status text;
  v_new_pw text;
  v_ids text[];
  i int;
begin
  v_auth := public.g404__admin_ok(p_pw);
  if v_auth <> 'ok' then
    return jsonb_build_object('ok', false, 'error', v_auth);
  end if;

  if p_action = 'login' or p_action = 'list_games' then
    return jsonb_build_object(
      'ok', true,
      'games', coalesce((
        select jsonb_agg(
          to_jsonb(g) || jsonb_build_object(
            'run_count', (select count(*) from public.g404_runs r where r.game_id = g.id)
          )
          order by g.sort_order asc, g.id asc
        )
        from public.g404_games g
      ), '[]'::jsonb)
    );

  elsif p_action = 'set_status' then
    v_id := lower(trim(coalesce(p_payload ->> 'id', '')));
    v_status := trim(coalesce(p_payload ->> 'status', ''));
    if v_status not in ('public', 'coming_soon', 'hidden') then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;
    update public.g404_games
    set
      status = v_status,
      lock_message = case
        when p_payload ? 'lock_message' then coalesce(p_payload ->> 'lock_message', '')
        else lock_message
      end,
      updated_at = now()
    where id = v_id;
    return jsonb_build_object('ok', true);

  elsif p_action = 'save_game' then
    v_id := lower(trim(coalesce(p_payload ->> 'id', '')));
    if v_id !~ '^[a-z0-9_-]{1,32}$' then
      return jsonb_build_object('ok', false, 'error', 'invalid_game_id');
    end if;
    v_status := coalesce(nullif(trim(coalesce(p_payload ->> 'status', '')), ''), 'public');
    if v_status not in ('public', 'coming_soon', 'hidden') then
      return jsonb_build_object('ok', false, 'error', 'invalid_status');
    end if;

    insert into public.g404_games (
      id, title, kicker, badge, description, metric_label,
      thumb_url, href, status, lock_message, featured, sort_order, updated_at
    )
    values (
      v_id,
      coalesce(nullif(trim(p_payload ->> 'title'), ''), v_id),
      coalesce(p_payload ->> 'kicker', ''),
      coalesce(p_payload ->> 'badge', ''),
      coalesce(p_payload ->> 'description', ''),
      coalesce(p_payload ->> 'metric_label', ''),
      coalesce(nullif(trim(p_payload ->> 'thumb_url'), ''), './assets/thumb-' || v_id || '.jpg'),
      coalesce(nullif(trim(p_payload ->> 'href'), ''), './' || v_id || '/'),
      v_status,
      coalesce(p_payload ->> 'lock_message', ''),
      coalesce((p_payload ->> 'featured')::boolean, false),
      coalesce(
        (p_payload ->> 'sort_order')::integer,
        (select coalesce(max(sort_order), 0) + 10 from public.g404_games)
      ),
      now()
    )
    on conflict (id) do update set
      title = excluded.title,
      kicker = excluded.kicker,
      badge = excluded.badge,
      description = excluded.description,
      metric_label = excluded.metric_label,
      thumb_url = excluded.thumb_url,
      href = excluded.href,
      status = excluded.status,
      lock_message = excluded.lock_message,
      featured = excluded.featured,
      sort_order = excluded.sort_order,
      updated_at = now();

    return jsonb_build_object('ok', true, 'id', v_id);

  elsif p_action = 'reorder' then
    select array_agg(x) into v_ids
    from jsonb_array_elements_text(coalesce(p_payload -> 'ids', '[]'::jsonb)) as x;
    if v_ids is not null then
      for i in 1..array_length(v_ids, 1) loop
        update public.g404_games
        set sort_order = i * 10, updated_at = now()
        where id = v_ids[i];
      end loop;
    end if;
    return jsonb_build_object('ok', true);

  elsif p_action = 'delete_game' then
    v_id := lower(trim(coalesce(p_payload ->> 'id', '')));
    delete from public.g404_games where id = v_id;
    return jsonb_build_object('ok', true);

  elsif p_action = 'list_runs' then
    v_id := nullif(lower(trim(coalesce(p_payload ->> 'game_id', ''))), '');
    return jsonb_build_object(
      'ok', true,
      'runs', coalesce((
        select jsonb_agg(to_jsonb(r) order by r.created_at desc)
        from (
          select id, game_id, nickname, score, error_mm, actual_value, target_value, rank_title, created_at
          from public.g404_runs
          where (v_id is null or game_id = v_id)
          order by created_at desc
          limit 100
        ) r
      ), '[]'::jsonb)
    );

  elsif p_action = 'delete_run' then
    v_id := trim(coalesce(p_payload ->> 'id', ''));
    delete from public.g404_runs where id = v_id;
    return jsonb_build_object('ok', true);

  elsif p_action = 'change_pw' then
    v_new_pw := trim(coalesce(p_payload ->> 'new_pw', ''));
    if char_length(v_new_pw) < 4 then
      return jsonb_build_object('ok', false, 'error', 'pw_too_short');
    end if;
    update public.g404_config
    set v = public.g404__h(v_new_pw), updated_at = now()
    where k = 'admin_hash';
    return jsonb_build_object('ok', true);

  else
    return jsonb_build_object('ok', false, 'error', 'unknown_action');
  end if;
end;
$$;

-- ───────── 권한 부여 ─────────
revoke all on table public.g404_config from anon, authenticated;
revoke all on table public.g404_games from anon, authenticated;
revoke all on table public.g404_runs from anon, authenticated;

grant execute on function public.g404_public_games() to anon, authenticated;
grant execute on function public.g404_get_game(text) to anon, authenticated;
grant execute on function public.g404_submit_run(text, text, text, text, numeric, numeric, numeric, numeric, text, integer, jsonb) to anon, authenticated;
grant execute on function public.g404_get_run(text) to anon, authenticated;
grant execute on function public.g404_get_percentile(text, numeric) to anon, authenticated;
grant execute on function public.g404_get_ladder(text, text, text) to anon, authenticated;
grant execute on function public.g404_admin(text, text, jsonb) to anon, authenticated;
