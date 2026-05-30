create table plc_symbols (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  connection_id uuid not null references connections(id) on delete cascade,
  provider_key text not null,
  symbol_path text not null,
  address text not null,
  data_type text not null,
  direction text not null default 'readWrite',
  structure jsonb not null default '{}',
  imported_tag_id uuid references tags(id) on delete set null,
  discovered_at timestamptz not null default now(),
  unique(connection_id, symbol_path)
);

create table connection_diagnostics (
  id uuid primary key default gen_random_uuid(),
  connection_id uuid not null references connections(id) on delete cascade,
  state text not null,
  quality text not null,
  message text not null,
  details jsonb not null default '{}',
  checked_at timestamptz not null default now()
);

create index connection_diagnostics_connection_checked_idx on connection_diagnostics (connection_id, checked_at desc);
