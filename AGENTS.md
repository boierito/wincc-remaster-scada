# Agent Operating Notes

This repository implements a clean-room SCADA platform inspired by classic WinCC workflows. Do not copy Siemens source code, proprietary assets, binary formats, branding, UI strings, iconography, or documentation text.

## Engineering Rules

- Preserve functional compatibility through behavior, data modeling, and workflow affordances.
- Keep canonical project data in PostgreSQL. Node-RED is a generated driver/orchestration layer, not the source of truth.
- Prefer explicit domain entities over opaque JSONB. Use JSONB for extensible object properties, script metadata, animation settings, and vendor-specific driver options.
- Every milestone must update `docs/parity-matrix.md`.
- Keep runtime and engineering apps separate: engineering edits and publishes; runtime consumes published bundles and live services.
- PLC reads and writes must carry value, quality, timestamp, source, and connection state.
- Engineering mutation routes and runtime ACK/write routes must remain permission protected.

## Local Workflow

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Run `docker compose up -d postgres node-red`.
3. Run `npm install`.
4. Run `npm run db:migrate && npm run db:seed`.
5. Run `npm run dev`.
6. Validate with `npm test` and `npm run build`.

## Compatibility Policy

The product targets mental-model parity with WinCC V7.5-style engineering and operation. This is not a binary-compatible WinCC runtime and it does not import proprietary project files unless a future clean-room importer is written from documented, user-owned exports.
