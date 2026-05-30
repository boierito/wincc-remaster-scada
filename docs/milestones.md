# Executable Milestones

## M1 Foundation

- Create npm workspaces, TypeScript config, lint/test scripts.
- Define domain model and compatibility helpers.
- Add PostgreSQL migrations and demo seed.
- Add API skeleton and unit tests.
- Update parity matrix.

Validation: `npm test`, `npm run build`.

## M2 Engineering Shell

- Implement project explorer, tag grid, graphics designer, faceplate panel, alarm/historian/user views.
- Persist edits through API.
- Add Monaco script editor and TanStack engineering grids.
- Add quick-create workbench actions for connections, tags, screens, objects, faceplate versions, propagation, scripts and reports.
- Add persisted graphics-designer operations for alignment, z-order, groups, resources and picture-window objects.

Validation: component tests and E2E create-project flow.

## M3 Acquisition and Node-RED Sync

- Generate S7 and OPC UA Node-RED flows from canonical connections/tags.
- Deploy flows through Node-RED Admin API.
- Normalize value samples with quality/timestamp/source/state.

Validation: flow-generation tests and integration test against Node-RED when available.

## M4 Runtime

- Load published manifest.
- Render screens, bindings, faceplates, picture windows, trends, alarms, and login.
- Execute script triggers through compatibility APIs.
- Run timer and tag-change triggers in the acquisition worker with execution logs.

Validation: E2E runtime navigation, ACK, historian query, authorized write.

## M5 Publisher and Hardening

- Package selected runtime assets deterministically.
- Store runtime publication items and checksums for traceability.
- Include report templates and report run metadata in publish output.
- Maintain a persisted cross-reference index for engineering traceability.
- Add docs for deployment, backup/restore, security, operations.
- Expand tests and add CI.

Validation: publish demo, serve bundle, run E2E smoke suite.
