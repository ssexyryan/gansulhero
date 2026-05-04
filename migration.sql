alter table public.drink_logs add column if not exists memo text;
create unique index if not exists drink_logs_drink_date_user_name_idx on public.drink_logs (drink_date, user_name);

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'drink_logs_unique'
  ) then
    alter table public.drink_logs add constraint drink_logs_unique unique using index drink_logs_drink_date_user_name_idx;
  end if;
exception when others then
  null;
end $$;

alter table public.drink_logs enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='drink_logs' and policyname='Public read drink logs'
  ) then
    create policy "Public read drink logs" on public.drink_logs for select to anon, authenticated using (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='drink_logs' and policyname='Public insert drink logs'
  ) then
    create policy "Public insert drink logs" on public.drink_logs for insert to anon, authenticated with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='drink_logs' and policyname='Public update drink logs'
  ) then
    create policy "Public update drink logs" on public.drink_logs for update to anon, authenticated using (true) with check (true);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='drink_logs' and policyname='Public delete drink logs'
  ) then
    create policy "Public delete drink logs" on public.drink_logs for delete to anon, authenticated using (true);
  end if;
end $$;
