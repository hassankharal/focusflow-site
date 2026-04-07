-- Foques waitlist schema
-- Run this in Supabase SQL Editor.

create table if not exists public.waitlist_signups (
  id bigserial primary key,
  email text not null,
  normalized_email text not null,
  full_name text,
  source text,
  metadata jsonb not null default '{}'::jsonb,
  signup_rank integer not null,
  qualifies_free_year boolean not null default false,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists waitlist_signups_normalized_email_key
  on public.waitlist_signups (normalized_email);

create unique index if not exists waitlist_signups_signup_rank_key
  on public.waitlist_signups (signup_rank);

create index if not exists waitlist_signups_created_at_idx
  on public.waitlist_signups (created_at);

create index if not exists waitlist_signups_qualifies_idx
  on public.waitlist_signups (qualifies_free_year);

alter table public.waitlist_signups enable row level security;

comment on table public.waitlist_signups is 'Foques launch waitlist and founding-offer qualifiers.';

create or replace function public.waitlist_offer_status(p_limit integer default 25)
returns table (
  limit_total integer,
  claimed_count integer,
  spots_remaining integer
)
language sql
stable
as $$
  select
    greatest(0, coalesce(p_limit, 25)) as limit_total,
    (count(*) filter (where qualifies_free_year))::integer as claimed_count,
    greatest(
      0,
      greatest(0, coalesce(p_limit, 25)) -
      (count(*) filter (where qualifies_free_year))::integer
    ) as spots_remaining
  from public.waitlist_signups;
$$;

create or replace function public.signup_waitlist(
  p_email text,
  p_name text default null,
  p_source text default 'foques-landing',
  p_metadata jsonb default '{}'::jsonb,
  p_honeypot text default null,
  p_limit integer default 25
)
returns table (
  success boolean,
  duplicate boolean,
  qualified_for_free_year boolean,
  spots_remaining integer,
  rank integer,
  message text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_normalized_email text;
  v_existing public.waitlist_signups%rowtype;
  v_next_rank integer;
  v_qualifies boolean;
  v_spots integer;
  v_limit integer := greatest(0, coalesce(p_limit, 25));
begin
  if p_honeypot is not null and btrim(p_honeypot) <> '' then
    raise exception 'BOT_FIELD_FILLED';
  end if;

  v_normalized_email := lower(btrim(coalesce(p_email, '')));

  if v_normalized_email = '' then
    raise exception 'INVALID_EMAIL';
  end if;

  if v_normalized_email !~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$' then
    raise exception 'INVALID_EMAIL';
  end if;

  select *
    into v_existing
  from public.waitlist_signups
  where normalized_email = v_normalized_email;

  if found then
    select s.spots_remaining
      into v_spots
    from public.waitlist_offer_status(v_limit) s;

    return query
      select
        true,
        true,
        v_existing.qualifies_free_year,
        v_spots,
        v_existing.signup_rank,
        case
          when v_existing.qualifies_free_year then 'You are already on the waitlist and your 1-year founding offer is secured.'
          else 'You are already on the waitlist. We will send launch updates.'
        end;

    return;
  end if;

  -- Keep ranking deterministic under concurrency.
  perform pg_advisory_xact_lock(807012026);

  select *
    into v_existing
  from public.waitlist_signups
  where normalized_email = v_normalized_email;

  if found then
    select s.spots_remaining
      into v_spots
    from public.waitlist_offer_status(v_limit) s;

    return query
      select
        true,
        true,
        v_existing.qualifies_free_year,
        v_spots,
        v_existing.signup_rank,
        case
          when v_existing.qualifies_free_year then 'You are already on the waitlist and your 1-year founding offer is secured.'
          else 'You are already on the waitlist. We will send launch updates.'
        end;

    return;
  end if;

  select coalesce(max(signup_rank), 0) + 1
    into v_next_rank
  from public.waitlist_signups;

  v_qualifies := v_next_rank <= v_limit;

  insert into public.waitlist_signups (
    email,
    normalized_email,
    full_name,
    source,
    metadata,
    signup_rank,
    qualifies_free_year
  ) values (
    btrim(p_email),
    v_normalized_email,
    nullif(btrim(coalesce(p_name, '')), ''),
    nullif(btrim(coalesce(p_source, '')), ''),
    coalesce(p_metadata, '{}'::jsonb),
    v_next_rank,
    v_qualifies
  );

  select s.spots_remaining
    into v_spots
  from public.waitlist_offer_status(v_limit) s;

  return query
    select
      true,
      false,
      v_qualifies,
      v_spots,
      v_next_rank,
      case
        when v_qualifies then 'You are in. Your 1-year founding offer is secured.'
        when v_spots <= 0 then 'You joined the waitlist. The founding offer has already been fully claimed.'
        else 'You joined the waitlist.'
      end;

exception
  when unique_violation then
    select *
      into v_existing
    from public.waitlist_signups
    where normalized_email = v_normalized_email;

    select s.spots_remaining
      into v_spots
    from public.waitlist_offer_status(v_limit) s;

    return query
      select
        true,
        true,
        coalesce(v_existing.qualifies_free_year, false),
        coalesce(v_spots, v_limit),
        v_existing.signup_rank,
        case
          when coalesce(v_existing.qualifies_free_year, false) then 'You are already on the waitlist and your 1-year founding offer is secured.'
          else 'You are already on the waitlist. We will send launch updates.'
        end;
end;
$$;

revoke all on function public.waitlist_offer_status(integer) from public;
revoke all on function public.signup_waitlist(text, text, text, jsonb, text, integer) from public;

grant execute on function public.waitlist_offer_status(integer) to service_role;
grant execute on function public.signup_waitlist(text, text, text, jsonb, text, integer) to service_role;
