create table graphic_resources (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('image', 'symbol', 'font', 'style')),
  uri text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  unique(project_id, name)
);

create table object_groups (
  id uuid primary key default gen_random_uuid(),
  screen_id uuid not null references screens(id) on delete cascade,
  name text not null,
  object_ids uuid[] not null,
  properties jsonb not null default '{}',
  created_at timestamptz not null default now()
);
