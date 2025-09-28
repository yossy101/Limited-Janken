-- Schema for Limited Janken
create table if not exists rooms (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'waiting',
  running boolean not null default false,
  end_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  name text not null,
  user_id uuid not null,
  created_at timestamptz not null default now()
);

create table if not exists player_assets (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  stars integer not null default 0,
  rock integer not null default 0,
  paper integer not null default 0,
  scissors integer not null default 0,
  cash numeric(12,2) not null default 0,
  loan numeric(12,2) not null default 0,
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'player_assets_player_id_key'
  ) then
    alter table player_assets
      add constraint player_assets_player_id_key unique (player_id);
  end if;
end $$;

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  challenger_id uuid not null references players(id),
  opponent_id uuid not null references players(id),
  status text not null default 'proposed',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create table if not exists match_moves (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  phase text not null check (phase in ('check','set','open')),
  hand text,
  created_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'match_moves_unique_phase'
  ) then
    alter table match_moves
      add constraint match_moves_unique_phase unique (match_id, player_id, phase);
  end if;
end $$;

create table if not exists used_card_logs (
  id uuid primary key default gen_random_uuid(),
  player_id uuid not null references players(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  hand text not null,
  created_at timestamptz not null default now()
);

create table if not exists star_transfers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  from_player uuid references players(id),
  to_player uuid references players(id),
  amount integer not null,
  created_at timestamptz not null default now()
);

create table if not exists trade_offers (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  maker_id uuid not null references players(id),
  taker_id uuid references players(id),
  give_json jsonb not null,
  take_json jsonb not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists penalties (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references rooms(id) on delete cascade,
  player_id uuid references players(id),
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id bigint generated always as identity primary key,
  room_id uuid not null references rooms(id) on delete cascade,
  message text not null,
  created_at timestamptz not null default now()
);

alter table player_assets
  enable row level security;

create policy "Players can view own assets" on player_assets
  for select
  using (auth.uid() = (select user_id from players where players.id = player_assets.player_id));

create policy "Players can update own assets" on player_assets
  for update
  using (auth.uid() = (select user_id from players where players.id = player_assets.player_id));

alter table matches enable row level security;
create policy "Players in room can select matches" on matches
  for select
  using (exists (
    select 1 from players p
    where p.id in (matches.challenger_id, matches.opponent_id)
      and p.user_id = auth.uid()
  ));

alter table match_moves enable row level security;
create policy "Players in match can select moves" on match_moves
  for select
  using (exists (
    select 1 from matches m
    join players p on p.id in (m.challenger_id, m.opponent_id)
    where m.id = match_moves.match_id and p.user_id = auth.uid()
  ));

alter table events enable row level security;
create policy "Room members can read events" on events
  for select using (exists (
    select 1 from players p
    where p.room_id = events.room_id and p.user_id = auth.uid()
  ));
