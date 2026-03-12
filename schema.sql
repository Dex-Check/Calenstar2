-- ═══════════════════════════════════════════════
-- CalenStar 2.0 — Supabase Schema
-- Run this in Supabase Dashboard → SQL Editor
-- ═══════════════════════════════════════════════

-- 1. PROFILES
create table if not exists public.profiles (
  id            uuid references auth.users(id) on delete cascade primary key,
  username      text unique not null,
  avatar_url    text,
  bio           text,
  is_private    boolean default false,
  streak        int default 0,
  best_streak   int default 0,
  last_logged   date,
  created_at    timestamptz default now()
);
alter table public.profiles enable row level security;
create policy "Public profiles" on public.profiles for select using (true);
create policy "Own profile" on public.profiles for all using (auth.uid() = id);

-- 2. ENTRIES
create table if not exists public.entries (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete cascade not null,
  date        date not null,
  text        text,
  mood        text,
  cats        text[] default '{}',
  is_public   boolean default true,
  media_urls  text[] default '{}',
  like_count  int default 0,
  comment_count int default 0,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now(),
  unique(user_id, date)
);
alter table public.entries enable row level security;
create policy "Public entries readable" on public.entries for select using (is_public = true or auth.uid() = user_id);
create policy "Own entries writable"  on public.entries for all  using (auth.uid() = user_id);

-- 3. FOLLOWS
create table if not exists public.follows (
  id           uuid primary key default gen_random_uuid(),
  follower_id  uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  status       text default 'accepted', -- accepted | pending
  created_at   timestamptz default now(),
  unique(follower_id, following_id)
);
alter table public.follows enable row level security;
create policy "Follows readable" on public.follows for select using (auth.uid() = follower_id or auth.uid() = following_id);
create policy "Follows writable" on public.follows for all  using (auth.uid() = follower_id);

-- 4. LIKES
create table if not exists public.likes (
  id        uuid primary key default gen_random_uuid(),
  entry_id  uuid references public.entries(id) on delete cascade,
  user_id   uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  unique(entry_id, user_id)
);
alter table public.likes enable row level security;
create policy "Likes readable" on public.likes for select using (true);
create policy "Likes writable" on public.likes for all  using (auth.uid() = user_id);

-- 5. COMMENTS
create table if not exists public.comments (
  id         uuid primary key default gen_random_uuid(),
  entry_id   uuid references public.entries(id) on delete cascade,
  user_id    uuid references public.profiles(id) on delete cascade,
  text       text not null,
  created_at timestamptz default now()
);
alter table public.comments enable row level security;
create policy "Comments readable" on public.comments for select using (true);
create policy "Comments writable" on public.comments for all using (auth.uid() = user_id);

-- 6. NOTIFICATIONS
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles(id) on delete cascade,
  actor_id   uuid references public.profiles(id) on delete cascade,
  type       text not null, -- like | comment | follow
  entry_id   uuid references public.entries(id) on delete cascade,
  meta       jsonb default '{}',
  read       boolean default false,
  created_at timestamptz default now()
);
alter table public.notifications enable row level security;
create policy "Own notifications" on public.notifications for all using (auth.uid() = user_id);

-- 7. AUTO-CREATE PROFILE ON SIGNUP
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email,'@',1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 8. STREAK UPDATE FUNCTION (call from app after saving entry)
create or replace function public.update_streak(p_user_id uuid)
returns void language plpgsql security definer as $$
declare
  v_today      date := current_date;
  v_last       date;
  v_streak     int;
  v_best       int;
begin
  select last_logged, streak, best_streak
  into v_last, v_streak, v_best
  from public.profiles where id = p_user_id;

  if v_last = v_today then
    return; -- already updated today
  elsif v_last = v_today - interval '1 day' then
    v_streak := v_streak + 1;
  else
    v_streak := 1; -- broken or first time
  end if;

  if v_streak > coalesce(v_best, 0) then
    v_best := v_streak;
  end if;

  update public.profiles
  set streak = v_streak, best_streak = v_best, last_logged = v_today
  where id = p_user_id;
end;
$$;

-- 9. LIKE COUNT TRIGGERS
create or replace function update_like_count() returns trigger language plpgsql as $$
begin
  if TG_OP = 'INSERT' then
    update public.entries set like_count = like_count + 1 where id = new.entry_id;
  elsif TG_OP = 'DELETE' then
    update public.entries set like_count = greatest(like_count - 1, 0) where id = old.entry_id;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_like_count on public.likes;
create trigger trg_like_count after insert or delete on public.likes
  for each row execute procedure update_like_count();

-- 10. STORAGE BUCKET (run separately in Dashboard > Storage)
-- Create a bucket named: entry-media
-- Set it to PUBLIC
-- Policy: authenticated users can upload to their own folder (user_id/*)
