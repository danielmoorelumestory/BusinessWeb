-- 显式记录扣款日期；保留原函数供旧部署使用。
begin;
create or replace function public.businessweb_consume_ask(p_user uuid, p_ip text, p_user_limit integer, p_ip_limit integer, p_global_limit integer, p_day date)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  today date := p_day;
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
create or replace function public.businessweb_refund_ask(p_user uuid, p_ip text, p_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare today date := p_day;
begin
  update businessweb_ask_global_usage set used = greatest(used - 1, 0) where day = today;
  update businessweb_ask_ip_usage set used = greatest(used - 1, 0) where ip_hash = p_ip and day = today;
  update businessweb_ask_usage set used = greatest(used - 1, 0) where user_id = p_user and day = today;
end;
$$;


revoke all on function public.businessweb_consume_ask(uuid, text, integer, integer, integer, date) from public, anon, authenticated;
revoke all on function public.businessweb_refund_ask(uuid, text, date) from public, anon, authenticated;
grant execute on function public.businessweb_consume_ask(uuid, text, integer, integer, integer, date) to service_role;
grant execute on function public.businessweb_refund_ask(uuid, text, date) to service_role;
notify pgrst, 'reload schema';
commit;
