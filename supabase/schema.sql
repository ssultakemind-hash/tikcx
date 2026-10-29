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
