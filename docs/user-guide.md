# User Guide

## Create and Run the Demo

1. Start dependencies with `docker compose up -d postgres node-red`.
2. Install packages with `npm install`.
3. Create the schema with `npm run db:migrate`.
4. Seed the sample plant with `npm run db:seed`.
5. Start development services with `npm run dev`.

Engineering opens on the Vite port for `apps/engineering`. Runtime opens on the Vite port for `apps/runtime`.

Demo credentials:

- `operator` / `operator`
- `engineer` / `engineer`

## Main Workflows

- Create a project from the engineering shell.
- Define communication providers, connections, tag groups, UDTs, and tags.
- Browse PLC/OPC UA symbols from a connection, review diagnostics, and import selected symbols into canonical tags.
- Synchronize Node-RED flows from canonical tag configuration.
- Draw screens in the graphics designer and bind object properties to tags.
- Use designer actions to add picture windows, align selected objects, normalize z-order, create groups and register graphic resources.
- Create faceplate types, instantiate them, and propagate type changes.
- Configure alarms and historian archives.
- Let the acquisition worker evaluate alarms and perform cyclic historian sampling from persisted tag values.
- Use timer and tag-change scripts for automatic runtime actions.
- Create users, groups, and permissions.
- Log into runtime as `operator` for ACK permissions or `engineer` for runtime write and engineering permissions.
- Maintain text lists, graphic lists and user archives from the engineering shell/API.
- Generate basic JSON/CSV report runs from report templates.
- Rebuild cross-reference to locate where tags, screens, scripts, faceplates, lists, archives and reports are used.
- Publish a runtime bundle and run it in the runtime app.

## Demo Plant

The seed project contains a motor, valve, conveyor, reusable equipment UDT, several faceplate instances, alarms, trend archives, permissions, and text/graphic lists.
