-- DayForge initial database schema. Run in Supabase SQL Editor.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  country_code text not null default 'IN',
  currency_code text not null default 'INR',
  role text not null default 'user' check (role in ('user','admin')),
  trial_started_at timestamptz not null default now(),
  trial_ends_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now()
);
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 240),
  completed boolean not null default false,
  completed_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.reminders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (length(title) between 1 and 240),
  remind_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  razorpay_subscription_id text unique,
  plan text not null check (plan in ('monthly','yearly')),
  ai_coach boolean not null default false,
  status text not null default 'created' check (status in ('created','authenticated','active','pending','halted','cancelled','completed','expired','past_due','failed')),
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric not null check (discount_value > 0),
  active boolean not null default true,
  max_redemptions integer,
  redemption_count integer not null default 0,
  expires_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);
insert into public.app_settings(key,value) values ('price_monthly','399'),('price_yearly','3999'),('ai_monthly','100')
on conflict (key) do nothing;

create or replace function public.is_dayforge_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and lower(p.email) = 'shubhamshxrma987@gmail.com');
$$;

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.reminders enable row level security;
alter table public.subscriptions enable row level security;
alter table public.coupons enable row level security;
alter table public.app_settings enable row level security;

drop policy if exists "profile read own or admin" on public.profiles;
create policy "profile read own or admin" on public.profiles for select to authenticated using (id = auth.uid() or public.is_dayforge_admin());
drop policy if exists "profile insert self" on public.profiles;
create policy "profile insert self" on public.profiles for insert to authenticated with check (id = auth.uid() and lower(email) = lower(auth.jwt()->>'email') and role = 'user');
-- Only admins may update profiles. Users must not be able to change their own role or trial dates.
drop policy if exists "profile update own safe fields" on public.profiles;
drop policy if exists "profile update admin only" on public.profiles;
create policy "profile update admin only" on public.profiles for update to authenticated using (public.is_dayforge_admin()) with check (public.is_dayforge_admin());

drop policy if exists "tasks own or admin" on public.tasks;
create policy "tasks own or admin" on public.tasks for all to authenticated using (user_id = auth.uid() or public.is_dayforge_admin()) with check (user_id = auth.uid() or public.is_dayforge_admin());
drop policy if exists "reminders own or admin" on public.reminders;
create policy "reminders own or admin" on public.reminders for all to authenticated using (user_id = auth.uid() or public.is_dayforge_admin()) with check (user_id = auth.uid() or public.is_dayforge_admin());

drop policy if exists "subscription read own or admin" on public.subscriptions;
create policy "subscription read own or admin" on public.subscriptions for select to authenticated using (user_id = auth.uid() or public.is_dayforge_admin());
drop policy if exists "subscriptions no client writes" on public.subscriptions;
create policy "subscriptions no client writes" on public.subscriptions for insert to authenticated with check (false);
drop policy if exists "subscriptions no client update" on public.subscriptions;
create policy "subscriptions no client update" on public.subscriptions for update to authenticated using (false);

drop policy if exists "coupons admin manage" on public.coupons;
create policy "coupons admin manage" on public.coupons for all to authenticated using (public.is_dayforge_admin()) with check (public.is_dayforge_admin());
drop policy if exists "settings admin read/write" on public.app_settings;
create policy "settings admin read/write" on public.app_settings for all to authenticated using (public.is_dayforge_admin()) with check (public.is_dayforge_admin());

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles(id,email,display_name,country_code,currency_code)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)),
    coalesce(new.raw_user_meta_data->>'country_code','IN'),
    case coalesce(new.raw_user_meta_data->>'country_code','IN')
      when 'US' then 'USD' when 'GB' then 'GBP' when 'NG' then 'NGN'
      when 'CA' then 'CAD' when 'AU' then 'AUD' when 'AE' then 'AED'
      when 'EU' then 'EUR' else 'INR' end
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

