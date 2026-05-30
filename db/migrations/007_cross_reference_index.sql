create table cross_reference_index (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  owner_kind text not null,
  owner_id uuid not null,
  field text not null,
  reference_kind text not null,
  reference text not null,
  rebuilt_at timestamptz not null default now()
);

create index cross_reference_index_project_reference_idx on cross_reference_index (project_id, reference_kind, reference);
create index cross_reference_index_owner_idx on cross_reference_index (owner_kind, owner_id);
