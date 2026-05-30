# WinCC-Style Parity Matrix

Status values: `covered`, `partial`, `planned`.

| Area | Status | Implemented Now | Remaining Work |
| --- | --- | --- | --- |
| Project Explorer | partial | Tree API and engineering tree UI for projects, screens, tags, scripts, lists, alarms, historian, users; quick-create actions for engineering entities; new-project scaffold with default providers, users, permissions, system tags and main screen | Drag/drop organization, import/export, rich context menus |
| Graphics Designer | partial | React/Konva canvas, layers, basic objects, properties, bindings, z-order fields; API supports creating/updating screen objects, align-left, z-order normalization, object groups and graphic resources | Full object library, complete alignment/distribution tools, image manager UI, animation editor |
| Faceplates | partial | Type and instance schema, versioning, binding interface, propagation helper and propagation API | Full graphical type editor, composition restrictions, conflict UI |
| Tag Management | partial | Providers, connections, groups, scalar/structure/UDT tags, quality model, system tags; API/UI actions create providers, connections and tags; PLC symbol cache, browse/import endpoints and diagnostics panel | Real online browse through live Node-RED driver sessions, bulk import wizard polish |
| Siemens S7 via Node-RED | partial | Flow generation for `node-red-contrib-s7` nodes, SCADA canonical sync, S7 symbol browse/import model and deterministic browse fallback | Online deploy verification and advanced S7 symbol parsing |
| OPC UA | partial | Connector model, flow generation for monitor/read/write shape, OPC UA symbol browse/import model | Live OPC UA browse against server and structure mapping |
| Picture Windows | partial | Prefix resolver, multi-instance data model, runtime popup and embedded `pictureWindow` object with tag prefix display | Complete window manager, application windows, popout persistence |
| Runtime Scripting | partial | Script entities, Monaco editor, timer and tag-change trigger execution in acquisition worker, WinCC-like read/write/open-picture translation, bounded API execution endpoint, permission-protected execution and execution log | Hardened sandbox, broader VBS/C compatibility library |
| Alarm Logging | partial | Alarm definitions, events, ACK API, runtime alarm table, acquisition-worker condition evaluation and raise/clear cycle | Archival policies, advanced filters, short/long archive split |
| Tag Logging | partial | Archive definitions, sample schema, trend controls with ECharts, API sample insertion, acquisition-worker cyclic sampling | Timescale hypertables, retention/compression UI |
| User Administration | partial | Users, groups, permissions, timeout fields, scrypt password hashes, auth sessions, runtime login/logout UI, permission checks for ACK/write/engineering actions, E2E password verification | External identity providers, password rotation and richer user editor |
| Text Library/Text Lists | partial | Tables, seed data, list API and engineering quick-create for localized text list items | Full editor and binding UI |
| Graphic Lists | partial | Tables, seed data, graphic list API and engineering quick-create | Asset manager and runtime list renderer |
| User Archives | partial | Archive/table schema, row append API and engineering quick-create row insertion | Rich editable runtime controls |
| Reports | partial | Report schema, seed report, reports API, engineering listing, report run records, JSON/CSV generation and publisher inclusion | Report designer, print layouts, scheduled exports |
| Cross-reference | partial | Domain scanner for tags, screens, objects, scripts, faceplates, alarms, historian archives, reports, text lists, graphic lists and user archives; persisted `cross_reference_index`; engineering rebuild action | Incremental rebuild hooks and engineering UI deep links |
| Web Publisher | partial | Runtime manifest package generator, published bundle records, publication item checksums | Signed bundles, asset minification, deployment targets |
| Tests | partial | Unit tests for prefix resolution, faceplate propagation, cross-reference, script translation, S7 and OPC UA flow generation; E2E coverage for engineering shell and API workflow from project creation through provider/connection/tag/Node-RED sync | Broader full-stack E2E workflows for graphics editing, runtime scripting, alarms, historian and publication |
