-- Lost and Found school system schema
-- Run this in the Supabase SQL Editor.

create extension if not exists "pgcrypto";

do $$
begin
  create type public.profile_role as enum ('admin', 'student');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.item_status as enum ('pending', 'approved', 'returned', 'rejected');
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create type public.claim_status as enum ('pending', 'resolved', 'rejected');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  role public.profile_role not null default 'student',
  created_at timestamptz not null default now()
);

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  description text not null,
  image_url text,
  status public.item_status not null default 'pending',
  user_id uuid not null references public.profiles(id) on delete cascade
);

create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  item_id uuid not null references public.items(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  status public.claim_status not null default 'pending',
  unique (item_id, student_id)
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  message text not null,
  is_read boolean not null default false
);

create index if not exists items_status_created_at_idx
  on public.items (status, created_at desc);

create index if not exists items_user_id_idx
  on public.items (user_id);

create index if not exists claims_status_created_at_idx
  on public.claims (status, created_at desc);

create index if not exists claims_student_id_idx
  on public.claims (student_id);

create index if not exists notifications_user_read_idx
  on public.notifications (user_id, is_read, created_at desc);

create unique index if not exists profiles_email_lower_key
  on public.profiles (lower(email));

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    lower(new.email),
    case
      when new.raw_user_meta_data ->> 'role' in ('admin', 'student')
        then (new.raw_user_meta_data ->> 'role')::public.profile_role
      when new.raw_app_meta_data ->> 'role' in ('admin', 'student')
        then (new.raw_app_meta_data ->> 'role')::public.profile_role
      else 'student'
    end
  )
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

create or replace function public.email_is_registered(check_email text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where lower(email) = lower(btrim(check_email))
  );
$$;

grant execute on function public.email_is_registered(text) to anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.items enable row level security;
alter table public.claims enable row level security;
alter table public.notifications enable row level security;

drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile"
on public.profiles for select
to authenticated
using (id = auth.uid() or public.is_admin());

drop policy if exists "Admins can update profiles" on public.profiles;
create policy "Admins can update profiles"
on public.profiles for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Students can read approved items" on public.items;
create policy "Students can read approved items"
on public.items for select
to authenticated
using (status = 'approved' or user_id = auth.uid() or public.is_admin());

drop policy if exists "Students can submit items" on public.items;
create policy "Students can submit items"
on public.items for insert
to authenticated
with check (user_id = auth.uid() and status = 'pending');

drop policy if exists "Admins can update items" on public.items;
create policy "Admins can update items"
on public.items for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Admins can delete items" on public.items;
create policy "Admins can delete items"
on public.items for delete
to authenticated
using (public.is_admin());

drop policy if exists "Students and admins can read relevant claims" on public.claims;
create policy "Students and admins can read relevant claims"
on public.claims for select
to authenticated
using (
  student_id = auth.uid()
  or public.is_admin()
  or exists (
    select 1 from public.items
    where items.id = claims.item_id
      and items.user_id = auth.uid()
  )
);

drop policy if exists "Students can create claims" on public.claims;
create policy "Students can create claims"
on public.claims for insert
to authenticated
with check (student_id = auth.uid());

drop policy if exists "Admins can update claims" on public.claims;
create policy "Admins can update claims"
on public.claims for update
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "Users can read their notifications" on public.notifications;
create policy "Users can read their notifications"
on public.notifications for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Users can mark notifications read" on public.notifications;
create policy "Users can mark notifications read"
on public.notifications for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "Admins can create notifications" on public.notifications;
create policy "Admins can create notifications"
on public.notifications for insert
to authenticated
with check (public.is_admin());

insert into storage.buckets (id, name, public)
values ('item-photos', 'item-photos', true)
on conflict (id) do nothing;

drop policy if exists "Authenticated users can upload item photos" on storage.objects;
create policy "Authenticated users can upload item photos"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'item-photos'
  and owner = auth.uid()
);

drop policy if exists "Anyone authenticated can view item photos" on storage.objects;
create policy "Anyone authenticated can view item photos"
on storage.objects for select
to authenticated
using (bucket_id = 'item-photos');

drop policy if exists "Users can update own item photos" on storage.objects;
create policy "Users can update own item photos"
on storage.objects for update
to authenticated
using (bucket_id = 'item-photos' and owner = auth.uid())
with check (bucket_id = 'item-photos' and owner = auth.uid());

drop policy if exists "Users can delete own item photos" on storage.objects;
create policy "Users can delete own item photos"
on storage.objects for delete
to authenticated
using (bucket_id = 'item-photos' and owner = auth.uid());

create or replace function public.notify_item_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status = 'approved' then
    insert into public.notifications (user_id, message)
    values (new.user_id, 'Your lost and found post was approved.');
  end if;

  return new;
end;
$$;

drop trigger if exists on_item_approved on public.items;

create trigger on_item_approved
after update on public.items
for each row execute function public.notify_item_approved();

create or replace function public.notify_admins_new_claim()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, message)
  select id, 'A student submitted a new claim.'
  from public.profiles
  where role = 'admin';

  return new;
end;
$$;

drop trigger if exists on_claim_created on public.claims;

create trigger on_claim_created
after insert on public.claims
for each row execute function public.notify_admins_new_claim();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'items'
  ) then
    alter publication supabase_realtime add table public.items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'claims'
  ) then
    alter publication supabase_realtime add table public.claims;
  end if;
end $$;
