-- tikcx v1 schema
-- Run once in Supabase > SQL Editor.
-- All access goes through the app's server (service role key).
-- RLS is on with no policies, so the public anon key cannot read or write anything directly.

create table if not exists public.weddings (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  couple_names text not null,
  wedding_date date,
  venue text,
  couple_key text not null default replace(gen_random_uuid()::text, '-', ''),
  created_at timestamptz not null default now()
);

create table if not exists public.media (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid not null references public.weddings(id) on delete cascade,
  kind text not null check (kind in ('image', 'video')),
  path text not null,
  thumb_path text,
  uploader_name text not null default '익명 하객',
  is_pro boolean not null default false,
  size_bytes bigint,
  uploaded boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists media_wedding_idx on public.media (wedding_id, created_at desc);

alter table public.weddings enable row level security;
alter table public.media enable row level security;

-- Private bucket for originals and thumbnails.
-- 50MB per file: the Supabase Free plan's global cap. Raise after upgrading to Pro.
insert into storage.buckets (id, name, public, file_size_limit)
values ('media', 'media', false, 52428800)
on conflict (id) do nothing;

-- 2026-10-29: couple can show/hide all photos to guests (default: shown)
alter table public.weddings add column if not exists guest_gallery boolean not null default true;

-- 2026-10-29: cover photo shown at the top of guest and couple pages
alter table public.weddings add column if not exists cover_path text;

-- 2026-10-29: measure upload rate (unique visitors per wedding, uploader device)
alter table public.weddings add column if not exists visitors integer not null default 0;
alter table public.media add column if not exists device_id text;
create or replace function public.inc_visitors(wid uuid) returns void
language sql security definer set search_path = public
as $$ update public.weddings set visitors = visitors + 1 where id = wid; $$;
revoke execute on function public.inc_visitors(uuid) from public, anon, authenticated;

-- 2026-10-30: guests who are getting married leave their contact (with consent)
create table if not exists public.leads (
  id uuid primary key default gen_random_uuid(),
  wedding_id uuid references public.weddings(id) on delete set null,
  wedding_label text,
  name text not null,
  phone text not null,
  timing text not null,
  interests text[] not null default '{}',
  marketing boolean not null default false,
  device_id text,
  status text not null default 'new',
  memo text,
  created_at timestamptz not null default now()
);
create index if not exists leads_created_idx on public.leads (created_at desc);
alter table public.leads enable row level security;

-- 2026-10-30: where guests came from (QR on table card, room screen, invitation link...)
alter table public.weddings add column if not exists visit_sources jsonb not null default '{}'::jsonb;
alter table public.media add column if not exists source text;
create or replace function public.inc_visit(wid uuid, src text) returns void
language sql security definer set search_path = public
as $$ update public.weddings
  set visitors = visitors + 1,
      visit_sources = visit_sources || jsonb_build_object(src, coalesce((visit_sources->>src)::int, 0) + 1)
  where id = wid; $$;
revoke execute on function public.inc_visit(uuid, text) from public, anon, authenticated;
