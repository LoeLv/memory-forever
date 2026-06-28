create table if not exists public.upload_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique,
  name text not null default '受邀上传',
  used_count integer not null default 0,
  expires_at timestamptz,
  revoked_at timestamptz,
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.upload_invites enable row level security;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'upload_invites'
  loop
    execute format('drop policy if exists %I on public.upload_invites', policy_name);
  end loop;
end $$;

create policy "No public invite reads"
on public.upload_invites
for select
to anon, authenticated
using (false);

create policy "No public invite writes"
on public.upload_invites
for all
to anon, authenticated
using (false)
with check (false);

alter table public.photos enable row level security;

do $$
declare
  policy_name text;
begin
  for policy_name in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'photos'
  loop
    execute format('drop policy if exists %I on public.photos', policy_name);
  end loop;
end $$;

create policy "Public photo read"
on public.photos
for select
to anon, authenticated
using (true);

create policy "No public photo insert"
on public.photos
for insert
to anon, authenticated
with check (false);

create policy "No public photo update"
on public.photos
for update
to anon, authenticated
using (false)
with check (false);

create policy "No public photo delete"
on public.photos
for delete
to anon, authenticated
using (false);
