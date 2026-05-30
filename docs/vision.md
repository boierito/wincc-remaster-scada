# Vision

This project is a clean-room, productizable web SCADA platform for engineering and operation workflows familiar to users of classic WinCC V7.5. It provides a project explorer, graphics designer, faceplate type system, tag management, alarm logging, tag logging, user administration, text and graphic lists, picture windows, runtime scripting, Node-RED driver synchronization, and a web publisher.

The design goal is functional equivalence, not visual cloning. The platform should feel understandable to a WinCC engineer because the domain model, navigation flow, object hierarchy, and runtime concepts map cleanly to their existing mental model. It must not copy Siemens code, assets, proprietary binary formats, UI copy, icons, or branding.

## Product Principles

- PostgreSQL is the canonical source of project truth.
- Engineering, runtime, acquisition, and publishing are separate deployable concerns.
- Node-RED is used for PLC and industrial protocol integration, generated from canonical SCADA configuration.
- Runtime values always include value, quality, timestamp, source, and connection state.
- Scripts run through a compatibility layer that exposes stable SCADA APIs instead of browser globals.
- Faceplate instances must remain traceable to their type version and support controlled propagation.
- Cross-reference is a first-class feature, not a search afterthought.
- Historical storage must scale from local PostgreSQL to TimescaleDB-style hypertables.

## Initial Milestones

1. Repository foundation: monorepo, docs, domain model, PostgreSQL migrations, seed project, tests.
2. Engineering shell: project explorer, tag management, graphics designer, faceplate designer, script editor, alarm and historian views.
3. API and persistence: CRUD for projects, screens, objects, tags, faceplates, alarms, users, lists, scripts, archives, and cross-reference.
4. Acquisition service: Node-RED flow generation, S7 and OPC UA connector descriptors, live value bus, diagnostics.
5. Runtime: published project loading, picture navigation, prefix resolution, bindings, scripts, alarms, trends, login and authorization.
6. Publisher: deterministic runtime package generation with selected screens, assets, scripts, lists, and metadata.
7. Hardening: integration tests, E2E workflows, deployment docs, backup/restore, security review.
