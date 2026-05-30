create table report_runs (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references reports(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  format text not null,
  status text not null,
  output_uri text,
  payload jsonb not null default '{}',
  error text,
  generated_at timestamptz not null default now()
);

create index report_runs_project_generated_idx on report_runs (project_id, generated_at desc);
