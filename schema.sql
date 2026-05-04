create table if not exists public.drink_logs (
  id bigint generated always as identity primary key,
  drink_date date not null,
  user_name text not null,
  soju integer not null default 0,
  beer integer not null default 0,
  wine integer not null default 0,
  whiskey integer not null default 0,
  session_type text not null default '간술',
  memo text,
  created_at timestamptz not null default now(),
  constraint drink_logs_unique unique (drink_date, user_name),
  constraint drink_logs_soju_check check (soju between 0 and 5),
  constraint drink_logs_beer_check check (beer between 0 and 5),
  constraint drink_logs_wine_check check (wine between 0 and 5),
  constraint drink_logs_whiskey_check check (whiskey between 0 and 5),
  constraint drink_logs_session_type_check check (session_type in ('간술', '공적간술', '찾간'))
);

alter table public.drink_logs add column if not exists memo text;
alter table public.drink_logs enable row level security;

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
