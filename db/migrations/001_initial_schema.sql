create extension if not exists pgcrypto;

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table screens (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  width integer not null default 1280,
  height integer not null default 720,
  background jsonb not null default '{"color":"#101418"}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, name)
);

create table screen_objects (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references screens(id) on delete cascade,
  type text not null,
  name text not null,
  x numeric not null,
  y numeric not null,
  width numeric not null,
  height numeric not null,
  z_index integer not null default 0,
  properties jsonb not null default '{}',
  bindings jsonb not null default '{}',
  events jsonb not null default '{}'
);

create table communication_providers (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  key text not null,
  name text not null,
  driver text not null,
  capabilities jsonb not null default '{}',
  unique(project_id, key)
);

create table connections (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references communication_providers(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  endpoint text not null,
  state text not null default 'disabled',
  options jsonb not null default '{}',
  unique(project_id, name)
);

create table tag_groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  parent_id uuid references tag_groups(id) on delete cascade,
  name text not null
);

create table udt_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  fields jsonb not null,
  version integer not null default 1,
  unique(project_id, name)
);

create table tags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  group_id uuid references tag_groups(id) on delete set null,
  connection_id uuid references connections(id) on delete set null,
  udt_type_id uuid references udt_types(id) on delete set null,
  name text not null,
  path text not null,
  scope text not null check (scope in ('internal', 'external', 'system')),
  data_type text not null,
  address text,
  quality text not null default 'stale',
  last_value jsonb,
  last_timestamp timestamptz,
  properties jsonb not null default '{}',
  unique(project_id, path)
);

create table faceplate_types (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  version integer not null default 1,
  interface jsonb not null,
  composition jsonb not null default '[]',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, name, version)
);

create table faceplate_instances (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  screen_id uuid references screens(id) on delete cascade,
  type_id uuid not null references faceplate_types(id) on delete restrict,
  type_version integer not null,
  name text not null,
  tag_bindings jsonb not null default '{}',
  property_overrides jsonb not null default '{}',
  event_overrides jsonb not null default '{}'
);

create table scripts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  owner_kind text not null,
  owner_id uuid,
  name text not null,
  language text not null check (language in ('javascript', 'vbs-compat', 'c-compat')),
  trigger jsonb not null default '{}',
  source text not null,
  enabled boolean not null default true
);

create table alarm_classes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  severity integer not null,
  color text not null default '#ef4444'
);

create table alarms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  class_id uuid references alarm_classes(id) on delete set null,
  source_tag_id uuid references tags(id) on delete set null,
  name text not null,
  condition jsonb not null,
  message_template text not null,
  ack_required boolean not null default true,
  enabled boolean not null default true
);

create table alarm_events (
  id uuid primary key default gen_random_uuid(),
  alarm_id uuid not null references alarms(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  state text not null,
  message text not null,
  value jsonb,
  raised_at timestamptz not null default now(),
  cleared_at timestamptz,
  acked_at timestamptz,
  acked_by uuid
);

create table historian_archives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  name text not null,
  sample_mode text not null,
  cycle_ms integer not null default 1000,
  retention_days integer not null default 365
);

create table historian_samples (
  archive_id uuid not null references historian_archives(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  ts timestamptz not null,
  value jsonb not null,
  quality text not null,
  source text not null,
  primary key (archive_id, ts)
);

create index historian_samples_tag_ts_idx on historian_samples (tag_id, ts desc);

create table text_libraries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  default_locale text not null default 'en-US'
);

create table text_list_items (
  id uuid primary key default gen_random_uuid(),
  library_id uuid not null references text_libraries(id) on delete cascade,
  list_name text not null,
  key text not null,
  locale text not null,
  text text not null
);

create table graphic_lists (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null
);

create table graphic_list_items (
  id uuid primary key default gen_random_uuid(),
  list_id uuid not null references graphic_lists(id) on delete cascade,
  key text not null,
  asset_ref text not null,
  metadata jsonb not null default '{}'
);

create table groups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  timeout_seconds integer not null default 900
);

create table users (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  username text not null,
  display_name text not null,
  password_hash text,
  enabled boolean not null default true,
  unique(project_id, username)
);

create table user_groups (
  user_id uuid not null references users(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  primary key (user_id, group_id)
);

create table permissions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  group_id uuid not null references groups(id) on delete cascade,
  key text not null,
  allowed boolean not null default true,
  unique(group_id, key)
);

create table user_archives (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  schema jsonb not null,
  rows jsonb not null default '[]'
);

create table published_bundles (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  version text not null,
  manifest jsonb not null,
  created_at timestamptz not null default now()
);

create table audit_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references projects(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  entity_kind text not null,
  entity_id uuid,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
