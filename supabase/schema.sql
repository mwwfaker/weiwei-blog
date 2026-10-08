-- 唯唯园 · Supabase 数据库结构
--
-- 用法：Supabase 控制台 → 左侧 SQL Editor → 整段粘贴 → Run。
-- 这段脚本可以重复执行（全部是 if not exists / drop policy if exists），改坏了再跑一次即可。
--
-- 设计说明：
--   * 所有数据表都以 owner_id 指向 auth.users(id)，账号体系交给 Supabase Auth，
--     本文件不保存密码。
--   * 访问控制全部靠 RLS（行级安全）：公开内容（visibility='PUBLIC'）任何人可读，
--     其余只有本人可读；写操作永远只有本人。
--   * 绩效数据按既定设计对所有人开放读取（含成员邮箱），写入仍然只认本人。

-- ---------------------------------------------------------------- 用户资料
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  bio text not null default '',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- 注册时自动建资料行；昵称从注册表单传进 raw_user_meta_data.display_name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), split_part(new.email, '@', 1)))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------- 日记
create table if not exists public.diary_entries (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  entry_date date not null,
  mood text not null default '',
  weather text not null default '',
  visibility text not null default 'PRIVATE',
  tags text not null default '',
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_diary_owner_date on public.diary_entries (owner_id, entry_date desc, id desc);
create index if not exists idx_diary_public_date on public.diary_entries (visibility, entry_date desc);

-- ---------------------------------------------------------------- 文章
create table if not exists public.blog_articles (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null default '',
  category text not null default '',
  visibility text not null default 'PUBLIC',
  tags text not null default '',
  excerpt text not null default '',
  content text not null default '',
  cover_url text,
  article_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_articles_owner_date on public.blog_articles (owner_id, article_date desc, id desc);
create index if not exists idx_articles_public_date on public.blog_articles (visibility, article_date desc);

-- ---------------------------------------------------------------- 媒体（照片 / 音乐）
create table if not exists public.media_assets (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null default 'IMAGE',          -- IMAGE / MUSIC / MUSIC_URL
  title text not null default '',
  album_name text not null default '日常',
  object_key text not null,                    -- 对象存储里的路径，或 MUSIC_URL 时的外部链接
  content_type text not null default '',
  visibility text not null default 'PRIVATE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists uk_media_object_key on public.media_assets (object_key);
create index if not exists idx_media_owner_created on public.media_assets (owner_id, created_at desc);
create index if not exists idx_media_public on public.media_assets (kind, visibility, created_at desc);

-- ---------------------------------------------------------------- 绩效工作区
create table if not exists public.perf_queues (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  name text not null default '',
  kpi integer not null default 0,
  sort_order integer not null default 0,
  unique (owner_id, client_id)
);

create table if not exists public.perf_members (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  name text not null default '',
  email text not null default '',
  queue_name text not null default '',
  required_hours double precision not null default 0,
  transfer_hours double precision not null default 0,
  overtime_hours double precision not null default 0,
  triple_hours double precision not null default 0,
  sort_order integer not null default 0,
  unique (owner_id, client_id)
);

create table if not exists public.perf_entries (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  client_id text not null,
  member_client_id text not null,
  queue_name text not null default '',
  actual_aht double precision not null default 0,
  audit_count integer not null default 0,
  triple_count integer not null default 0,
  unique (owner_id, client_id)
);
create index if not exists idx_perf_entries_member on public.perf_entries (owner_id, member_client_id);

-- ================================================================ RLS
alter table public.profiles      enable row level security;
alter table public.diary_entries enable row level security;
alter table public.blog_articles enable row level security;
alter table public.media_assets  enable row level security;
alter table public.perf_queues   enable row level security;
alter table public.perf_members  enable row level security;
alter table public.perf_entries  enable row level security;

-- 资料：所有人可读（公开页面要显示作者昵称，表里不含邮箱），只有本人可改
drop policy if exists profiles_read_all on public.profiles;
create policy profiles_read_all on public.profiles for select using (true);
drop policy if exists profiles_write_own on public.profiles;
create policy profiles_write_own on public.profiles for insert with check (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- 日记：公开的任何人可读，私密的只有本人；写永远只有本人
drop policy if exists diary_read on public.diary_entries;
create policy diary_read on public.diary_entries for select
  using (visibility = 'PUBLIC' or owner_id = auth.uid());
drop policy if exists diary_insert on public.diary_entries;
create policy diary_insert on public.diary_entries for insert with check (owner_id = auth.uid());
drop policy if exists diary_update on public.diary_entries;
create policy diary_update on public.diary_entries for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists diary_delete on public.diary_entries;
create policy diary_delete on public.diary_entries for delete using (owner_id = auth.uid());

-- 文章：同日记
drop policy if exists article_read on public.blog_articles;
create policy article_read on public.blog_articles for select
  using (visibility = 'PUBLIC' or owner_id = auth.uid());
drop policy if exists article_insert on public.blog_articles;
create policy article_insert on public.blog_articles for insert with check (owner_id = auth.uid());
drop policy if exists article_update on public.blog_articles;
create policy article_update on public.blog_articles for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists article_delete on public.blog_articles;
create policy article_delete on public.blog_articles for delete using (owner_id = auth.uid());

-- 媒体：同日记
drop policy if exists media_read on public.media_assets;
create policy media_read on public.media_assets for select
  using (visibility = 'PUBLIC' or owner_id = auth.uid());
drop policy if exists media_insert on public.media_assets;
create policy media_insert on public.media_assets for insert with check (owner_id = auth.uid());
drop policy if exists media_update on public.media_assets;
create policy media_update on public.media_assets for update
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists media_delete on public.media_assets;
create policy media_delete on public.media_assets for delete using (owner_id = auth.uid());

-- 绩效：读取对所有人开放（既定设计），写入只认本人
drop policy if exists perf_queues_read on public.perf_queues;
create policy perf_queues_read on public.perf_queues for select using (true);
drop policy if exists perf_queues_write on public.perf_queues;
create policy perf_queues_write on public.perf_queues for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists perf_members_read on public.perf_members;
create policy perf_members_read on public.perf_members for select using (true);
drop policy if exists perf_members_write on public.perf_members;
create policy perf_members_write on public.perf_members for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists perf_entries_read on public.perf_entries;
create policy perf_entries_read on public.perf_entries for select using (true);
drop policy if exists perf_entries_write on public.perf_entries;
create policy perf_entries_write on public.perf_entries for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- ================================================================ 绩效整份写入
-- 原来 Java 后端在一个事务里「先全删再全插」。前端一次 POST 做不到事务，
-- 所以放进数据库函数里，要么全部生效，要么全部回滚。
create or replace function public.save_perf_workspace(
  incoming_queues jsonb,
  incoming_members jsonb,
  incoming_entries jsonb
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  me uuid := auth.uid();
  q jsonb; m jsonb; e jsonb;
  ord integer;
  member_ids text[] := '{}';
begin
  if me is null then raise exception '未登录'; end if;

  delete from public.perf_queues  where owner_id = me;
  delete from public.perf_members where owner_id = me;
  delete from public.perf_entries where owner_id = me;

  ord := 0;
  for q in select * from jsonb_array_elements(coalesce(incoming_queues, '[]'::jsonb)) loop
    if coalesce(q->>'id', '') = '' then continue; end if;
    insert into public.perf_queues (owner_id, client_id, name, kpi, sort_order)
    values (me, q->>'id', coalesce(q->>'name', ''), greatest(0, coalesce((q->>'kpi')::int, 0)), ord);
    ord := ord + 1;
  end loop;

  ord := 0;
  for m in select * from jsonb_array_elements(coalesce(incoming_members, '[]'::jsonb)) loop
    if coalesce(m->>'id', '') = '' then continue; end if;
    insert into public.perf_members (owner_id, client_id, name, email, queue_name,
                                     required_hours, transfer_hours, overtime_hours, triple_hours, sort_order)
    values (me, m->>'id', coalesce(m->>'name', ''), coalesce(m->>'email', ''), coalesce(m->>'queue', ''),
            greatest(0, coalesce((m->>'requiredHours')::double precision, 0)),
            greatest(0, coalesce((m->>'transferHours')::double precision, 0)),
            greatest(0, coalesce((m->>'overtimeHours')::double precision, 0)),
            greatest(0, coalesce((m->>'tripleHours')::double precision, 0)), ord);
    member_ids := member_ids || (m->>'id');
    ord := ord + 1;
  end loop;

  for e in select * from jsonb_array_elements(coalesce(incoming_entries, '[]'::jsonb)) loop
    if coalesce(e->>'id', '') = '' then continue; end if;
    -- 指向不存在员工的明细直接丢掉，不留孤儿数据
    if not (coalesce(e->>'memberId', '') = any(member_ids)) then continue; end if;
    insert into public.perf_entries (owner_id, client_id, member_client_id, queue_name,
                                     actual_aht, audit_count, triple_count)
    values (me, e->>'id', e->>'memberId', coalesce(e->>'queue', ''),
            coalesce((e->>'actualAht')::double precision, 0),
            coalesce((e->>'auditCount')::int, 0),
            coalesce((e->>'tripleCount')::int, 0));
  end loop;
end $$;

revoke all on function public.save_perf_workspace(jsonb, jsonb, jsonb) from public;
grant execute on function public.save_perf_workspace(jsonb, jsonb, jsonb) to authenticated;

-- ================================================================ 对象存储
-- 桶 weiwei-media 保持私有，读取一律走短期签名链接（和原来一致）。
-- 上传只允许写进自己的目录 users/<自己的 uuid>/...
drop policy if exists weiwei_media_read on storage.objects;
create policy weiwei_media_read on storage.objects for select
  using (bucket_id = 'weiwei-media');

drop policy if exists weiwei_media_insert on storage.objects;
create policy weiwei_media_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'weiwei-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists weiwei_media_update on storage.objects;
create policy weiwei_media_update on storage.objects for update to authenticated
  using (
    bucket_id = 'weiwei-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

drop policy if exists weiwei_media_delete on storage.objects;
create policy weiwei_media_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'weiwei-media'
    and (storage.foldername(name))[1] = 'users'
    and (storage.foldername(name))[2] = auth.uid()::text
  );

-- ================================================================ 自检
-- 执行完可以把下面这句单独跑一下，确认 7 张表都开了 RLS：
--   select relname, relrowsecurity from pg_class where relname in
--     ('profiles','diary_entries','blog_articles','media_assets','perf_queues','perf_members','perf_entries');
