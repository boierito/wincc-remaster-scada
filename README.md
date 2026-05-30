# Clean-Room Web SCADA

Monorepo TypeScript for a productizable web SCADA platform with WinCC V7.5-style engineering workflows, implemented without Siemens code, proprietary assets, branding, binary formats, or UI copy.

## Contents

- Engineering app: `apps/engineering`
- Runtime web app: `apps/runtime`
- API and Socket.IO gateway: `services/api`
- Acquisition and Node-RED synchronization worker: `services/acquisition`
- Runtime publisher: `services/publisher`
- Shared domain model and compatibility helpers: `packages/domain`
- PostgreSQL migrations and seed data: `db`
- Technical docs: `docs`

## Local Start

```powershell
copy .env.example .env
docker compose up -d postgres node-red
npm install
npm run db:migrate
npm run db:seed
npm run dev
```

Engineering runs on `http://localhost:5173`.
Runtime runs on `http://localhost:5174`.
API runs on `http://localhost:4100/api`.
Node-RED runs on `http://localhost:1880`.

## Validation

```powershell
npm test
npm run lint
npm run build
```

Run E2E after PostgreSQL is available and seeded:

```powershell
npm run db:migrate
npm run db:seed
npm run test:e2e
```

## Demo Project

The seed project contains:

- motor, valve and conveyor tags
- PLC/OPC UA symbol cache records and connection diagnostics
- graphic resources, object groups and a `pictureWindow` demo object
- reusable `EquipmentStatus` UDT
- shared equipment faceplate type
- multiple faceplate instances with distinct tag bindings
- active alarm event, alarm definitions and worker evaluation support
- historian archives, trend seed samples and cyclic sampling worker support
- operator/engineer groups and permissions
- scrypt password hashes, bearer-token auth sessions and permission checks on protected actions
- text lists, graphic list entries and editable user archive rows
- report template and runtime publication checksum records
- report run records with JSON/CSV output payloads
- timer and tag-change script triggers executed by the acquisition worker
- persistent cross-reference index across tags, screens, scripts, faceplates, lists, archives and reports

Demo credentials:

- `operator` / `operator`
- `engineer` / `engineer`

## Current Scope

This is an actively growing implementation. The current milestone provides real TypeScript code, PostgreSQL migrations, seed data, API routes, Node-RED flow generation, engineering/runtime apps, publisher records, and unit tests. Full WinCC V7.5 behavioral parity is not complete yet; `docs/parity-matrix.md` is the authoritative status tracker.

## Documentation

- [Vision](docs/vision.md)
- [Architecture](docs/architecture.md)
- [Milestones](docs/milestones.md)
- [Parity Matrix](docs/parity-matrix.md)
- [User Guide](docs/user-guide.md)
