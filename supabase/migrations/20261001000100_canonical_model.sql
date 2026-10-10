begin;

-- gen_random_uuid() is native to PostgreSQL 13+; no extension is required.
create type public.user_role as enum ('admin', 'coach', 'trainee');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null check (length(btrim(full_name)) > 0),
  role public.user_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_email_normalized check (
    email = lower(btrim(email)) and length(email) > 0 and strpos(email, '@') > 1
  )
);

create table public.coach_trainees (
  id uuid primary key default gen_random_uuid(),
  coach_id uuid not null references public.profiles(id) on delete restrict,
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint coach_trainees_one_coach unique (trainee_id),
  constraint coach_trainees_pair unique (coach_id, trainee_id),
  constraint coach_trainees_distinct_people check (coach_id <> trainee_id)
);
-- The pair index covers coach_id; the single-column unique index covers trainee_id.
comment on constraint coach_trainees_one_coach on public.coach_trainees is
  'V1 permits only one coach per trainee. Provision a trainee and assignment atomically.';

create table public.daily_steps (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  date date not null check (isfinite(date)),
  steps integer not null check (steps >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint daily_steps_trainee_date unique (trainee_id, date)
);
create index daily_steps_date_idx on public.daily_steps(date);
comment on table public.daily_steps is
  'One submitted report per trainee/calendar date. No row means no report, not zero steps.';

create table public.step_targets (
  id uuid primary key default gen_random_uuid(),
  trainee_id uuid not null references public.profiles(id) on delete cascade,
  target_steps integer not null check (target_steps > 0),
  effective_from date not null check (isfinite(effective_from)),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint step_targets_trainee_date unique (trainee_id, effective_from)
);
create index step_targets_created_by_idx on public.step_targets(created_by);
comment on table public.step_targets is
  'Append-only transitions: effective from this date until the next transition. Never overwrite historical targets.';

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  role public.user_role not null,
  token_hash text not null unique,
  coach_id uuid references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  constraint invitations_email_normalized check (
    email = lower(btrim(email)) and length(email) > 0 and strpos(email, '@') > 1
  ),
  constraint invitations_role_coach_shape check (
    (role = 'coach' and coach_id is null)
    or (role = 'trainee' and coach_id is not null and coach_id = invited_by)
  ),
  constraint invitations_hash_format check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint invitations_expiration check (isfinite(expires_at) and expires_at > created_at),
  constraint invitations_acceptance_time check (
    accepted_at is null or (isfinite(accepted_at) and accepted_at >= created_at and accepted_at < expires_at)
  )
);
create index invitations_email_pending_idx on public.invitations(email, expires_at)
  where accepted_at is null;
create index invitations_coach_idx on public.invitations(coach_id) where coach_id is not null;
create index invitations_expires_at_idx on public.invitations(expires_at);
create index invitations_invited_by_idx on public.invitations(invited_by);
comment on column public.invitations.token_hash is
  'Lowercase hex SHA-256 of a cryptographically random token. Plaintext tokens must never be persisted.';
comment on index public.invitations_email_pending_idx is
  'Supports active lookup: normalized email, accepted_at IS NULL, expires_at > current timestamp. Not unique: expired history is retained.';

alter table public.profiles enable row level security;
alter table public.coach_trainees enable row level security;
alter table public.daily_steps enable row level security;
alter table public.step_targets enable row level security;
alter table public.invitations enable row level security;

-- Closed by default. Later RLS migrations must also grant only required table operations.
revoke all on table public.profiles, public.coach_trainees, public.daily_steps,
  public.step_targets, public.invitations from public, anon, authenticated, service_role;
grant select, insert, update, delete on table public.profiles, public.coach_trainees,
  public.daily_steps, public.invitations to service_role;
revoke all on table public.step_targets from service_role;
grant select, insert on table public.step_targets to service_role;
grant usage on type public.user_role to authenticated, service_role;

commit;
