create table reports (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  name text not null,
  template jsonb not null default '{}',
  output_options jsonb not null default '{"formats":["pdf","csv"]}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(project_id, name)
);

create table runtime_publication_items (
  id uuid primary key default gen_random_uuid(),
  bundle_id uuid not null references published_bundles(id) on delete cascade,
  entity_kind text not null,
  entity_id uuid,
  name text not null,
  checksum text not null,
  metadata jsonb not null default '{}'
);

create table script_execution_log (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  script_id uuid references scripts(id) on delete set null,
  trigger_context jsonb not null default '{}',
  status text not null,
  result jsonb,
  error text,
  executed_at timestamptz not null default now()
);
