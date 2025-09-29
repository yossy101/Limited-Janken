-- Schema for Limited Janken
create extension if not exists "uuid-ossp";
create extension if not exists pgcrypto;

create table if not exists rooms (
  id uuid primary key,
  title text,
  status text not null default 'waiting',
  time_limit_seconds integer default 600,
  loan_amount integer default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  ends_at timestamptz
);

create table if not exists players (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists player_assets (
  player_id uuid primary key references players(id) on delete cascade,
  stars integer not null default 0,
  cards_rock integer not null default 4,
  cards_paper integer not null default 4,
  cards_scissors integer not null default 4,
  cash integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references rooms(id) on delete cascade,
  challenger_id uuid not null references players(id) on delete cascade,
  opponent_id uuid not null references players(id) on delete cascade,
  status text not null default 'pending',
  wager integer not null default 1,
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  resolved_at timestamptz
);

create table if not exists match_moves (
  match_id uuid not null references matches(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  hand text,
  committed_at timestamptz,
  opened_at timestamptz,
  primary key (match_id, player_id)
);

create table if not exists used_card_logs (
  id bigserial primary key,
  match_id uuid references matches(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  hand text not null,
  created_at timestamptz not null default now()
);

create table if not exists star_transfers (
  id bigserial primary key,
  match_id uuid references matches(id) on delete cascade,
  winner_id uuid references players(id),
  loser_id uuid references players(id),
  stars integer not null,
  created_at timestamptz not null default now()
);

create table if not exists trade_offers (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid not null references rooms(id) on delete cascade,
  maker_id uuid not null references players(id) on delete cascade,
  taker_id uuid references players(id) on delete cascade,
  give_json jsonb not null,
  take_json jsonb not null,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  accepted_at timestamptz,
  settled_at timestamptz
);

create table if not exists penalties (
  id bigserial primary key,
  room_id uuid references rooms(id) on delete cascade,
  player_id uuid references players(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now()
);

create table if not exists events (
  id uuid primary key default uuid_generate_v4(),
  room_id uuid references rooms(id) on delete cascade,
  actor_id uuid references players(id),
  message text not null,
  created_at timestamptz not null default now()
);

create or replace view view_monitor_scoreboard as
select
  p.id,
  p.display_name,
  pa.stars,
  pa.cards_rock,
  pa.cards_paper,
  pa.cards_scissors
from players p
join player_assets pa on pa.player_id = p.id;

alter table rooms enable row level security;
alter table players enable row level security;
alter table player_assets enable row level security;
alter table matches enable row level security;
alter table match_moves enable row level security;
alter table trade_offers enable row level security;
alter table events enable row level security;

create policy if not exists player_assets_select_self on player_assets
  for select using (auth.uid() = player_id);

create policy if not exists player_assets_update_self on player_assets
  for update using (auth.uid() = player_id) with check (auth.uid() = player_id);

create policy if not exists players_select_room on players
  for select using (auth.uid() = id);

create policy if not exists matches_select_participant on matches
  for select using (auth.uid() in (challenger_id, opponent_id));

create policy if not exists match_moves_select_participant on match_moves
  for select using (auth.uid() in (select challenger_id from matches where id = match_id) or auth.uid() in (select opponent_id from matches where id = match_id));

create or replace function log_event(p_room uuid, p_actor uuid, p_message text)
returns void
language plpgsql
as $$
begin
  insert into events (room_id, actor_id, message) values (p_room, p_actor, p_message);
end;
$$;

create or replace function fn_start_game(p_room uuid, p_time_limit integer, p_loan integer)
returns void
language plpgsql
as $$
declare
  v_room rooms;
begin
  select * into v_room from rooms where id = p_room for update;
  if not found then
    raise exception 'room % not found', p_room;
  end if;

  update rooms
    set status = 'running',
        time_limit_seconds = p_time_limit,
        loan_amount = p_loan,
        started_at = now(),
        ends_at = now() + make_interval(secs => p_time_limit)
  where id = p_room;

  update player_assets
    set stars = stars + p_loan
  where player_id in (select id from players where room_id = p_room);

  perform log_event(p_room, null, format('ゲーム開始：制限 %s 秒 / 貸付 %s スター', p_time_limit, p_loan));
end;
$$;

create or replace function fn_propose_match(p_challenger uuid, p_opponent uuid)
returns uuid
language plpgsql
as $$
declare
  v_room uuid;
  v_match uuid;
  v_wager integer := 1;
begin
  select room_id into v_room from players where id = p_challenger for update;
  if not found then
    raise exception 'challenger not found';
  end if;

  select id into v_match from matches where status = 'pending' and challenger_id = p_challenger and opponent_id = p_opponent;
  if found then
    return v_match;
  end if;

  insert into matches (room_id, challenger_id, opponent_id, status, wager)
  values (v_room, p_challenger, p_opponent, 'pending', v_wager)
  returning id into v_match;

  insert into match_moves (match_id, player_id) values (v_match, p_challenger)
    on conflict do nothing;
  insert into match_moves (match_id, player_id) values (v_match, p_opponent)
    on conflict do nothing;

  perform log_event(v_room, p_challenger, format('挑戦: %s -> %s', p_challenger, p_opponent));
  return v_match;
end;
$$;

create or replace function fn_accept_match(p_match uuid, p_opponent uuid)
returns void
language plpgsql
as $$
declare
  v_match matches;
begin
  select * into v_match from matches where id = p_match for update;
  if not found then
    raise exception 'match not found';
  end if;

  if v_match.opponent_id <> p_opponent then
    raise exception 'opponent mismatch';
  end if;

  update matches set status = 'active', locked_at = now() where id = p_match;
  perform log_event(v_match.room_id, p_opponent, format('マッチ承諾: %s', p_match));
end;
$$;

create or replace function fn_move_check(p_match uuid, p_player uuid)
returns jsonb
language plpgsql
as $$
declare
  v_move match_moves;
  v_match matches;
begin
  select * into v_match from matches where id = p_match for update;
  if not found then
    raise exception 'match not found';
  end if;

  select * into v_move from match_moves where match_id = p_match and player_id = p_player for update;
  if not found then
    raise exception 'move not found';
  end if;

  return jsonb_build_object(
    'status', v_match.status,
    'hand_set', v_move.hand is not null,
    'opened', v_move.opened_at is not null
  );
end;
$$;

create or replace function fn_move_set(p_match uuid, p_player uuid, p_hand text)
returns void
language plpgsql
as $$
declare
  v_assets player_assets;
  v_move match_moves;
begin
  select * into v_assets from player_assets where player_id = p_player for update;
  if not found then
    raise exception 'assets not found';
  end if;

  if p_hand not in ('rock', 'paper', 'scissors') then
    raise exception 'invalid hand';
  end if;

  if (p_hand = 'rock' and v_assets.cards_rock <= 0)
     or (p_hand = 'paper' and v_assets.cards_paper <= 0)
     or (p_hand = 'scissors' and v_assets.cards_scissors <= 0) then
    raise exception 'card not available';
  end if;

  update player_assets
    set
      cards_rock = case when p_hand = 'rock' then cards_rock - 1 else cards_rock end,
      cards_paper = case when p_hand = 'paper' then cards_paper - 1 else cards_paper end,
      cards_scissors = case when p_hand = 'scissors' then cards_scissors - 1 else cards_scissors end,
      updated_at = now()
  where player_id = p_player;

  insert into used_card_logs (match_id, player_id, hand)
  values (p_match, p_player, p_hand);

  update match_moves
    set hand = p_hand, committed_at = now()
  where match_id = p_match and player_id = p_player;
end;
$$;

create or replace function fn_move_open(p_match uuid, p_player uuid)
returns void
language plpgsql
as $$
begin
  update match_moves
    set opened_at = now()
  where match_id = p_match and player_id = p_player;
end;
$$;

create or replace function fn_resolve_match(p_match uuid)
returns jsonb
language plpgsql
as $$
declare
  v_match matches;
  v_challenger match_moves;
  v_opponent match_moves;
  v_winner uuid;
  v_loser uuid;
  v_outcome text;
  v_delta integer := 0;
begin
  select * into v_match from matches where id = p_match for update;
  if not found then
    raise exception 'match not found';
  end if;

  select * into v_challenger from match_moves where match_id = p_match and player_id = v_match.challenger_id for update;
  select * into v_opponent from match_moves where match_id = p_match and player_id = v_match.opponent_id for update;

  if v_challenger.hand is null or v_opponent.hand is null then
    raise exception 'hands not set';
  end if;

  if v_challenger.hand = v_opponent.hand then
    v_outcome := 'draw';
  elsif (v_challenger.hand = 'rock' and v_opponent.hand = 'scissors')
     or (v_challenger.hand = 'paper' and v_opponent.hand = 'rock')
     or (v_challenger.hand = 'scissors' and v_opponent.hand = 'paper') then
    v_outcome := 'challenger';
    v_winner := v_match.challenger_id;
    v_loser := v_match.opponent_id;
    v_delta := v_match.wager;
  else
    v_outcome := 'opponent';
    v_winner := v_match.opponent_id;
    v_loser := v_match.challenger_id;
    v_delta := v_match.wager;
  end if;

  if v_outcome <> 'draw' then
    update player_assets set stars = stars + v_delta where player_id = v_winner;
    update player_assets set stars = stars - v_delta where player_id = v_loser;
    insert into star_transfers (match_id, winner_id, loser_id, stars) values (p_match, v_winner, v_loser, v_delta);
  end if;

  update matches set status = 'resolved', resolved_at = now() where id = p_match;

  perform log_event(v_match.room_id, v_winner, format('マッチ結果: %s (%s vs %s)', v_outcome, v_challenger.hand, v_opponent.hand));

  return jsonb_build_object(
    'outcome', v_outcome,
    'winner_id', v_winner,
    'loser_id', v_loser,
    'stars', v_delta
  );
end;
$$;

-- Placeholder functions for trade and defeat evaluation (M2)
create or replace function fn_create_trade_offer(p_maker uuid, p_taker uuid, p_give jsonb, p_take jsonb)
returns uuid language plpgsql as $$
begin
  raise notice 'Trade functionality will be implemented in M2 phase.';
  return null;
end;$$;

create or replace function fn_accept_trade_offer(p_offer uuid, p_taker uuid)
returns void language plpgsql as $$
begin
  raise notice 'Trade functionality will be implemented in M2 phase.';
end;$$;

create or replace function fn_settle_trade(p_offer uuid)
returns void language plpgsql as $$
begin
  raise notice 'Trade functionality will be implemented in M2 phase.';
end;$$;

create or replace function fn_cancel_trade(p_offer uuid, p_actor uuid)
returns void language plpgsql as $$
begin
  raise notice 'Trade functionality will be implemented in M2 phase.';
end;$$;

create or replace function fn_evaluate_defeats(p_room uuid)
returns void language plpgsql as $$
begin
  raise notice 'Defeat evaluation will be implemented in M2 phase.';
end;$$;
