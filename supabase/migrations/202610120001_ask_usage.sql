-- Run in the BusinessWeb Supabase project (SQL Editor). Idempotent.
-- AI 试问：登录用户每天固定次数，按北京时间日期计数；只允许服务端 secret key 调用。
begin;

create table if not exists public.businessweb_ask_usage (
  user_id uuid not null,
  day date not null,
  used integer not null default 0 check (used >= 0),
  primary key (user_id, day)
);

alter table public.businessweb_ask_usage enable row level security;
revoke all on public.businessweb_ask_usage from public, anon, authenticated;
grant select, insert, update, delete on public.businessweb_ask_usage to service_role;

create table if not exists public.businessweb_ask_ip_usage (
  ip_hash text not null check (char_length(ip_hash) = 64),
  day date not null,
  used integer not null default 0 check (used >= 0),
  primary key (ip_hash, day)
);
create table if not exists public.businessweb_ask_global_usage (
  day date primary key,
  used integer not null default 0 check (used >= 0)
);
alter table public.businessweb_ask_ip_usage enable row level security;
alter table public.businessweb_ask_global_usage enable row level security;
revoke all on public.businessweb_ask_ip_usage, public.businessweb_ask_global_usage from public, anon, authenticated;
grant select, insert, update, delete on public.businessweb_ask_ip_usage, public.businessweb_ask_global_usage to service_role;

-- 原子扣减：先锁住用户 / IP / 全站三行，三项都未超额才一起 +1。
-- 返回 'ok' | 'user' | 'ip' | 'global'，表示哪一项先超额。
create or replace function public.businessweb_consume_ask(p_user uuid, p_ip text, p_user_limit integer, p_ip_limit integer, p_global_limit integer)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := (now() at time zone 'Asia/Shanghai')::date;
  u integer; i integer; g integer;
begin
  insert into businessweb_ask_global_usage (day, used) values (today, 0) on conflict do nothing;
  insert into businessweb_ask_ip_usage (ip_hash, day, used) values (p_ip, today, 0) on conflict do nothing;
  insert into businessweb_ask_usage (user_id, day, used) values (p_user, today, 0) on conflict do nothing;

  select used into g from businessweb_ask_global_usage where day = today for update;
  select used into i from businessweb_ask_ip_usage where ip_hash = p_ip and day = today for update;
  select used into u from businessweb_ask_usage where user_id = p_user and day = today for update;

  if g >= p_global_limit then return 'global'; end if;
  if i >= p_ip_limit then return 'ip'; end if;
  if u >= p_user_limit then return 'user'; end if;

  update businessweb_ask_global_usage set used = used + 1 where day = today;
  update businessweb_ask_ip_usage set used = used + 1 where ip_hash = p_ip and day = today;
  update businessweb_ask_usage set used = used + 1 where user_id = p_user and day = today;
  return 'ok';
end;
$$;

-- 模型调用失败时三项一起退还。
create or replace function public.businessweb_refund_ask(p_user uuid, p_ip text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare today date := (now() at time zone 'Asia/Shanghai')::date;
begin
  update businessweb_ask_global_usage set used = greatest(used - 1, 0) where day = today;
  update businessweb_ask_ip_usage set used = greatest(used - 1, 0) where ip_hash = p_ip and day = today;
  update businessweb_ask_usage set used = greatest(used - 1, 0) where user_id = p_user and day = today;
end;
$$;

revoke all on function public.businessweb_consume_ask(uuid, text, integer, integer, integer) from public, anon, authenticated;
revoke all on function public.businessweb_refund_ask(uuid, text) from public, anon, authenticated;
grant execute on function public.businessweb_consume_ask(uuid, text, integer, integer, integer) to service_role;
grant execute on function public.businessweb_refund_ask(uuid, text) to service_role;

commit;
