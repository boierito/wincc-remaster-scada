# Architecture

## Workspace Layout

- `apps/engineering`: React engineering environment with explorer, designers, tables, script editor, and publishing controls.
- `apps/runtime`: React runtime web client that consumes published project metadata and live tag streams.
- `services/api`: Node.js API, Socket.IO gateway, migrations, and seed runner.
- `services/acquisition`: Node-RED synchronization worker and live tag acquisition bridge.
- `services/publisher`: deterministic web runtime packager.
- `packages/domain`: shared TypeScript domain model, validation, compatibility helpers, prefix resolution, and cross-reference logic.
- `packages/db`: PostgreSQL schema helpers and migration runner.
- `packages/node-red`: Node-RED flow generation and Admin API client.
- `db/migrations`: SQL migrations.
- `db/seeds`: seed data for the demo project.

## Data Flow

1. Engineering app edits canonical project data through `services/api`.
2. API persists entities in PostgreSQL and emits project/value events over Socket.IO.
3. Acquisition service reads canonical connections and tags, generates Node-RED flows, and maps inbound values to normalized tag samples.
4. Acquisition service also performs cyclic historian sampling and alarm condition evaluation against canonical alarm definitions.
5. Runtime app subscribes to tag samples, refreshes alarm/historian data, evaluates bindings/scripts, displays screens, handles picture windows, and writes commands through the API.
6. Publisher exports a runtime manifest containing selected screens, faceplate versions, scripts, lists, resources, permissions, and connection requirements.

## Persistence

Domain entities use relational tables for searchability and cross-reference:

- projects, screens, screen_objects
- graphic_resources, object_groups
- faceplate_types, faceplate_instances
- communication_providers, connections, tag_groups, tags, udt_types
- plc_symbols, connection_diagnostics
- alarms, alarm_events, historian_archives, historian_samples
- text_libraries, text_list_items, graphic_lists, graphic_list_items
- scripts, users, groups, permissions, user_archives
- published_bundles, audit_events
- reports, report_runs, runtime_publication_items, script_execution_log
- auth_sessions
- cross_reference_index

Complex visual and driver settings are stored in JSONB while preserving searchable entity boundaries.

## Compatibility Layers

- Picture context resolver supports local tags, inherited tag prefix, explicit prefix override, and `@NOTP::`-style no-prefix references.
- Script runtime exposes stable APIs for tags, objects, screens, alarms, users, and picture windows. VBS/C-style compatibility is implemented by translating common WinCC-style calls into these APIs.
- Script execution is logged with trigger context, result/error, writes, opened picture requests, and acknowledged alarm events.
- Timer and tag-change script triggers run in the acquisition worker against persisted tag state, using the same compatibility API shape as manual script execution.
- Faceplate propagation stores type versions and instance overrides so updated types can be applied deterministically.
- Alarm and historian workers operate from persisted tag values, so behavior remains testable and decoupled from a specific PLC driver implementation.
- PLC symbol discovery is cached in `plc_symbols`; imports generate canonical tags while retaining traceability back to the source symbol and connection.
- Graphics Designer operations are persisted through screen objects, graphic resources and object groups. Batch layout helpers live in the shared domain package so API and UI behavior can be tested consistently.
- Report generation stores `report_runs` and supports basic JSON/CSV output from alarm, historian and user archive sections.
- Cross-reference scans domain entities into `cross_reference_index` so engineering can locate tag, screen, script, faceplate, list, archive and report usage.

## Security

- API auth is role and permission based.
- Runtime ACK/write actions and engineering mutations require explicit bearer-token authorization.
- Auth sessions are persisted with token hashes, expiry, last-seen time and revocation.
- Published runtime bundles do not include engineering-only data unless required.
- Future LDAP/OIDC/SIMATIC Logon-like integration should plug into the user provider boundary without changing permissions.
