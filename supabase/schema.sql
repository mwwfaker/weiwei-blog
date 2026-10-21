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
  -- 歌词原文（LRC 或纯文本）。解析发生在上传时：先读音频文件的内嵌歌词标签，再按
  -- 「曲名 + 时长」去在线歌词库匹配，最后可以手动粘贴覆盖。存原文而不是解析结果，
  -- 是为了让你能直接改时间轴，前后端也不用维护两套格式。
  lyrics text not null default '',
  lyrics_source text not null default '',      -- manual / embedded / lrclib / netease
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 已经建过表的项目：这两句把新字段补上。列已存在时是空操作，可以放心重复执行。
alter table public.media_assets add column if not exists lyrics text not null default '';
alter table public.media_assets add column if not exists lyrics_source text not null default '';
create unique index if not exists uk_media_object_key on public.media_assets (object_key);
create index if not exists idx_media_owner_created on public.media_assets (owner_id, created_at desc);
create index if not exists idx_media_public on public.media_assets (kind, visibility, created_at desc);

-- ---------------------------------------------------------------- 相册（两级：相册 → 子相册）
-- 照片上的 album_name 从「唯一真相」降级成**显示用的冗余副本**：真正的归属是 album_id。
-- 这样做是因为公开照片墙要给访客显示相册名，而相册表对访客基本不可见（见下面的 RLS），
-- 让访客为了一个名字去读别人的相册表不划算。
create table if not exists public.photo_albums (
  id bigint generated always as identity primary key,
  owner_id uuid not null references auth.users(id) on delete cascade,
  parent_id bigint references public.photo_albums(id) on delete cascade,
  name text not null default '',
  -- 相册盒子自己的描述：这一盒装的是什么、什么时候拍的。和「照片的描述」是两回事。
  description text not null default '',
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- 已经建过表的项目：这一句把新字段补上（列已存在时是空操作）。
alter table public.photo_albums add column if not exists description text not null default '';
create index if not exists idx_photo_albums_owner on public.photo_albums (owner_id, parent_id, sort_order, id);
-- 同一层里不许重名。两条**部分唯一索引**而不是一条表达式索引：parent_id 可空，
-- 空值在唯一索引里互不相等，直接建 (owner_id, parent_id, name) 等于对一级相册完全不设限。
create unique index if not exists uk_photo_albums_root_name on public.photo_albums (owner_id, name)
  where parent_id is null;
create unique index if not exists uk_photo_albums_child_name on public.photo_albums (owner_id, parent_id, name)
  where parent_id is not null;

-- 只允许两级。写在触发器里而不是靠前端自觉：前端可以被改坏，
-- 而「三级相册」一旦存进去，页面上的面包屑、筛选、删除都会开始各算各的。
create or replace function public.photo_albums_keep_two_levels()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  grandparent bigint;
  parent_owner uuid;
begin
  if new.parent_id is null then return new; end if;
  if new.id is not null and new.parent_id = new.id then
    raise exception '相册不能成为自己的子相册';
  end if;

  select parent_id, owner_id into grandparent, parent_owner
  from public.photo_albums where id = new.parent_id;
  if not found then raise exception '父相册不存在'; end if;
  if parent_owner <> new.owner_id then raise exception '父相册不属于你'; end if;
  if grandparent is not null then
    raise exception '相册只支持两级，子相册下面不能再建子相册';
  end if;

  -- 自己已经有子相册时不能再挂到别人下面，否则会凭空多出一级。
  if new.id is not null and exists (select 1 from public.photo_albums where parent_id = new.id) then
    raise exception '这个相册下面已经有子相册，不能再挂到别的相册下';
  end if;
  return new;
end $$;

drop trigger if exists trg_photo_albums_two_levels on public.photo_albums;
create trigger trg_photo_albums_two_levels before insert or update on public.photo_albums
  for each row execute function public.photo_albums_keep_two_levels();

-- 已经建过表的项目：这三句把新字段补上。列已存在时是空操作，可以放心重复执行。
alter table public.media_assets add column if not exists album_id bigint
  references public.photo_albums(id) on delete set null;
-- 照片描述：和 title（名称）分开——名称是「这张是什么」，描述是「当时发生了什么」。
alter table public.media_assets add column if not exists description text not null default '';
-- 缩略图的对象键。网格里加载原图太慢（一张手机照片 3–5 MB，二十张就是上百 MB），
-- 上传时顺手生成一张 ~30 KB 的小图。为空时前端回退到原图，所以老照片不会被这张新表搞坏。
alter table public.media_assets add column if not exists thumb_key text;
-- 拍摄时间（EXIF DateTimeOriginal）。原来界面上显示的日期是从 created_at 推的，也就是**上传时间**——
-- 「X 年前的今天」这类功能必须用真实拍摄时间，否则回忆出来的是"你哪天传的"。
alter table public.media_assets add column if not exists taken_at timestamptz;
-- 拍摄地点（EXIF GPS），用来在地图上连足迹。没有 GPS 的照片留空，不是错误。
alter table public.media_assets add column if not exists latitude double precision;
alter table public.media_assets add column if not exists longitude double precision;

create index if not exists idx_media_album on public.media_assets (album_id);
-- 「同一天拍的」要按月日查，没法走普通索引，但按 owner + 拍摄时间排序要能走
create index if not exists idx_media_taken on public.media_assets (owner_id, taken_at desc);
create index if not exists idx_media_geo on public.media_assets (owner_id) where latitude is not null;

-- 把老数据里「照片上的相册名」升级成真正的相册，并把照片挂上去。
-- 只在相册表还是空的时候做这一次：不设这个前提的话，以后每次重跑 schema.sql
-- 都会把那些故意留在「未分类」的照片（album_name='日常'、album_id 为空）塞进「日常」相册。
do $$
declare
  has_albums boolean;
begin
  select exists (select 1 from public.photo_albums) into has_albums;
  if has_albums then return; end if;

  insert into public.photo_albums (owner_id, name)
  select distinct m.owner_id, coalesce(nullif(btrim(m.album_name), ''), '日常')
  from public.media_assets m
  where m.kind = 'IMAGE' and m.album_id is null;

  update public.media_assets m
  set album_id = a.id, album_name = a.name
  from public.photo_albums a
  where m.album_id is null and m.kind = 'IMAGE'
    and a.owner_id = m.owner_id and a.parent_id is null
    and a.name = coalesce(nullif(btrim(m.album_name), ''), '日常');
end $$;

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

-- ================================================================ Data API 权限（GRANT）
-- Supabase 从 2026-10-30 起不再给 public 里**新建**的表自动加 Data API 权限。
-- 已经建好的表保持原样，所以线上不会当天就坏；但「新项目 / 预览分支 / 本地 supabase db reset /
-- 这之后新建的表」只会拿到所有权，PostgREST 用 anon 或 authenticated 的身份一查就是
-- `permission denied for table ...`（401，正文里会附上该跑的 GRANT）。
-- 所以把权限写进这份脚本、和建表放在一起：重跑幂等，重建环境也一次到位。
--
-- 只给到够用为止，不替代 RLS：
--   anon           只读。未登录访客也要能看公开日记 / 文章 / 照片和整份绩效。
--   authenticated  读写。能不能写到别人的行仍由 RLS 逐行决定，grant 只是让请求进得了门。
--   service_role   全权。它本来就在 RLS 之外，留给运维脚本；前端永远拿不到这把钥匙。
grant select on public.profiles, public.diary_entries, public.blog_articles,
  public.media_assets, public.photo_albums, public.perf_queues,
  public.perf_members, public.perf_entries
  to anon;

grant select, insert, update, delete on public.profiles, public.diary_entries,
  public.blog_articles, public.media_assets, public.photo_albums,
  public.perf_queues, public.perf_members, public.perf_entries
  to authenticated;

grant select, insert, update, delete on public.profiles, public.diary_entries,
  public.blog_articles, public.media_assets, public.photo_albums,
  public.perf_queues, public.perf_members, public.perf_entries
  to service_role;

-- identity 列的自增值来自**另一个对象**（序列），表的 GRANT 不会顺带它。
-- 少了这句，insert 会报 `permission denied for sequence ..._id_seq`——错误里提到的是表，
-- 很容易误判成 RLS 或表权限。
grant usage on all sequences in schema public to authenticated, service_role;

-- ================================================================ RLS
alter table public.profiles      enable row level security;
alter table public.diary_entries enable row level security;
alter table public.blog_articles enable row level security;
alter table public.media_assets  enable row level security;
alter table public.photo_albums  enable row level security;
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

-- 相册：本人可读自己的全部相册；别人的相册**只有装着公开照片的那些**才可读。
-- 为什么不是「所有人可读」：相册名本身就能说明问题（「离婚材料」这种名字不该漏出去），
-- 而访客看图时又确实需要它来分组，所以按「里面有没有公开照片」逐条放行。
drop policy if exists photo_albums_read on public.photo_albums;
create policy photo_albums_read on public.photo_albums for select
  using (
    owner_id = auth.uid()
    or exists (
      select 1 from public.media_assets m
      where m.album_id = public.photo_albums.id
        and m.kind = 'IMAGE' and m.visibility = 'PUBLIC'
    )
  );
drop policy if exists photo_albums_write on public.photo_albums;
create policy photo_albums_write on public.photo_albums for all
  using (owner_id = auth.uid()) with check (owner_id = auth.uid());

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

-- ---------------------------------------------------------------- 公开资源桶（模型文件）
-- 立体浏览要拉一份 ~26 MB 的深度模型。默认从 HuggingFace 取，国内很慢；
-- 放进自己的项目里，访客就从同一处拿。
-- 这个桶是**公开读**的：只放模型这种本来就人人可下的东西。
-- 照片与音乐仍然在私有桶 weiwei-media 里走签名链接，两者不要混。
insert into storage.buckets (id, name, public)
values ('weiwei-assets', 'weiwei-assets', true)
on conflict (id) do update set public = true;

-- 写只允许登录用户，而且只能在 models/ 前缀下（免得有人拿公开桶当免费网盘）。
-- 另外**必须有一条 SELECT**：storage 的 upload 是 `insert ... returning`，
-- 少了 SELECT 时 Postgres 会用 "new row violates row-level security policy" 报错 ——
-- 信息极具误导性，看起来像 write 策略写错了，其实是读策略缺了。
drop policy if exists weiwei_assets_models_read on storage.objects;
create policy weiwei_assets_models_read on storage.objects for select to authenticated
  using (bucket_id = 'weiwei-assets');
drop policy if exists weiwei_assets_models_write on storage.objects;
create policy weiwei_assets_models_write on storage.objects for insert to authenticated
  with check (bucket_id = 'weiwei-assets' and name like 'models/%');
drop policy if exists weiwei_assets_models_update on storage.objects;
create policy weiwei_assets_models_update on storage.objects for update to authenticated
  using (bucket_id = 'weiwei-assets' and name like 'models/%');

-- ================================================================ 自检
-- 执行完可以把下面这句单独跑一下，确认 8 张表都开了 RLS：
--   select relname, relrowsecurity from pg_class where relname in
--     ('profiles','diary_entries','blog_articles','media_assets','photo_albums','perf_queues','perf_members','perf_entries');
--
-- 再确认权限没漏（8 张表 × 3 个角色都该有行；缺了 Data API 就会 401）：
--   select table_name, grantee, string_agg(privilege_type, ', ' order by privilege_type) as privileges
--   from information_schema.role_table_grants
--   where table_schema = 'public' and grantee in ('anon', 'authenticated', 'service_role')
--   group by table_name, grantee order by table_name, grantee;

-- 让 PostgREST 立刻重读一次结构。少了这句，刚建好的表可能还会继续回
-- "Could not find the table ... in the schema cache" 一段时间——前端看到的
-- 就是「点了创建没反应，弹一句英文」，和真的没建表一模一样。
notify pgrst, 'reload schema';
