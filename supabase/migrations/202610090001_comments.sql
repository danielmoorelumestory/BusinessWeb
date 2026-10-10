-- Run in the BusinessWeb Supabase project (SQL Editor). Idempotent.
-- 章节评论：匿名提交，默认 pending，在 Supabase 后台把 status 改为 approved 后才对外显示。
begin;

create table if not exists public.businessweb_comments (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (char_length(slug) between 1 and 160),
  nickname text not null default '匿名读者' check (char_length(nickname) between 1 and 20),
  content text not null check (char_length(content) between 2 and 1000),
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  ip_hash text not null check (char_length(ip_hash) = 64),
  created_at timestamptz not null default now()
);
create index if not exists businessweb_comments_slug_status_idx
  on public.businessweb_comments (slug, status, created_at);
create index if not exists businessweb_comments_ip_idx
  on public.businessweb_comments (ip_hash, created_at);

-- 只允许服务端 secret key 访问；前端不能直连。
alter table public.businessweb_comments enable row level security;
revoke all on public.businessweb_comments from public, anon, authenticated;
grant select, insert, update, delete on public.businessweb_comments to service_role;

commit;
