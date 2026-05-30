import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import Editor from "@monaco-editor/react";
import { Stage, Layer, Rect, Text, Group, Line } from "react-konva";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { Boxes, Cpu, FileCode2, Network, Play, RefreshCw, Save, Shield, Siren, Workflow } from "lucide-react";
import "golden-layout/dist/css/goldenlayout-base.css";
import "./styles.css";

const DEMO_PROJECT_ID = "10000000-0000-0000-0000-000000000001";

type WorkbenchSession = {
  token: string;
  user: { id: string; username: string; displayName: string; permissions: string[] };
  expiresAt: string;
};

type ApiState = {
  tree?: TreeNode;
  providers: any[];
  connections: any[];
  plcSymbols: any[];
  connectionDiagnostics: any[];
  tags: any[];
  screens: any[];
  objects: any[];
  faceplates: { types: any[]; instances: any[] };
  alarms: { definitions: any[]; events: any[] };
  historian: any[];
  users: { users: any[]; groups: any[]; permissions: any[] };
  scripts: any[];
  reports: { reports: any[]; runs: any[] };
  lists: { textLibraries: any[]; textItems: any[]; graphicLists: any[]; graphicItems: any[] };
  graphics: { resources: any[]; groups: any[] };
  userArchives: any[];
  crossReference: any[];
};

type TreeNode = { id: string; label: string; kind: string; children?: TreeNode[] };

async function api<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

function useApiState() {
  const [state, setState] = useState<ApiState>({ providers: [], connections: [], plcSymbols: [], connectionDiagnostics: [], tags: [], screens: [], objects: [], faceplates: { types: [], instances: [] }, alarms: { definitions: [], events: [] }, historian: [], users: { users: [], groups: [], permissions: [] }, scripts: [], reports: { reports: [], runs: [] }, lists: { textLibraries: [], textItems: [], graphicLists: [], graphicItems: [] }, graphics: { resources: [], groups: [] }, userArchives: [], crossReference: [] });
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const [tree, providers, connections, tags, screenData, faceplates, alarms, historian, users, scripts, reports, lists, graphics, userArchives, crossReference] = await Promise.all([
        api<TreeNode>(`/projects/${DEMO_PROJECT_ID}/tree`),
        api<any[]>(`/projects/${DEMO_PROJECT_ID}/providers`),
        api<any[]>(`/projects/${DEMO_PROJECT_ID}/connections`),
        api<any[]>(`/projects/${DEMO_PROJECT_ID}/tags`),
        api<{ screens: any[]; objects: any[] }>(`/projects/${DEMO_PROJECT_ID}/screens`),
        api<{ types: any[]; instances: any[] }>(`/projects/${DEMO_PROJECT_ID}/faceplates`),
        api<{ definitions: any[]; events: any[] }>(`/projects/${DEMO_PROJECT_ID}/alarms`),
        api<any[]>(`/projects/${DEMO_PROJECT_ID}/historian`),
        api<{ users: any[]; groups: any[]; permissions: any[] }>(`/projects/${DEMO_PROJECT_ID}/users`),
        api<any[]>(`/projects/${DEMO_PROJECT_ID}/scripts`),
        api<{ reports: any[]; runs: any[] }>(`/projects/${DEMO_PROJECT_ID}/reports`),
        api<{ textLibraries: any[]; textItems: any[]; graphicLists: any[]; graphicItems: any[] }>(`/projects/${DEMO_PROJECT_ID}/lists`),
        api<{ resources: any[]; groups: any[] }>(`/projects/${DEMO_PROJECT_ID}/graphic-resources`),
        api<any[]>(`/projects/${DEMO_PROJECT_ID}/user-archives`),
        api<any[]>(`/projects/${DEMO_PROJECT_ID}/cross-reference`)
      ]);
      const firstConnection = connections[0];
      const [plcSymbols, connectionDiagnostics] = firstConnection
        ? await Promise.all([
          api<any[]>(`/connections/${firstConnection.id}/symbols`),
          api<any[]>(`/connections/${firstConnection.id}/diagnostics`)
        ])
        : [[], []];
      setState({ tree, providers, connections, plcSymbols, connectionDiagnostics, tags, screens: screenData.screens, objects: screenData.objects, faceplates, alarms, historian, users, scripts, reports, lists, graphics, userArchives, crossReference });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load API data");
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  return { state, error, refresh };
}

function Tree({ node }: { node: TreeNode }) {
  return (
    <div className="tree-node">
      <div className={`tree-label kind-${node.kind}`}>{node.label}</div>
      {node.children?.map((child) => <Tree key={child.id} node={child} />)}
    </div>
  );
}

function DataGrid({ rows }: { rows: any[] }) {
  const columns = useMemo<ColumnDef<any>[]>(() => {
    const keys = Object.keys(rows[0] ?? {}).slice(0, 8);
    return keys.map((key) => ({ accessorKey: key, header: key }));
  }, [rows]);
  const table = useReactTable({ data: rows, columns, getCoreRowModel: getCoreRowModel() });
  return (
    <table className="grid">
      <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead>
      <tbody>{table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id}>{formatCell(cell.getValue())}</td>)}</tr>)}</tbody>
    </table>
  );
}

function formatCell(value: unknown) {
  if (value == null) return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function GraphicsDesigner({ objects }: { objects: any[] }) {
  return (
    <div className="designer">
      <div className="toolstrip">
        <button><Save size={15} /> Save</button>
        <button><Boxes size={15} /> Group</button>
        <button><RefreshCw size={15} /> Propagate</button>
      </div>
      <Stage width={760} height={420} className="canvas-stage">
        <Layer>
          {Array.from({ length: 16 }).map((_, i) => <Line key={`v${i}`} points={[i * 50, 0, i * 50, 420]} stroke="#243241" strokeWidth={1} />)}
          {Array.from({ length: 9 }).map((_, i) => <Line key={`h${i}`} points={[0, i * 50, 760, i * 50]} stroke="#243241" strokeWidth={1} />)}
          {objects.map((object) => (
            <Group key={object.id} x={Number(object.x)} y={Number(object.y)}>
              <Rect width={Number(object.width)} height={Number(object.height)} fill={object.type === "alarmTable" ? "#182334" : "#223041"} stroke="#5eead4" cornerRadius={6} />
              <Text text={object.name} x={10} y={10} fill="#e5edf5" fontSize={15} />
              {object.bindings && <Text text={JSON.stringify(object.bindings)} x={10} y={34} fill="#94a3b8" fontSize={11} width={Number(object.width) - 20} />}
            </Group>
          ))}
        </Layer>
      </Stage>
    </div>
  );
}

function App() {
  const { state, error, refresh } = useApiState();
  const [syncResult, setSyncResult] = useState<string>("Not synchronized");
  const [session, setSession] = useState<WorkbenchSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const mainScreen = state.screens[0];
  const screenObjects = state.objects.filter((object) => object.screen_id === mainScreen?.id);
  const firstProvider = state.providers[0];
  const firstConnection = state.connections[0];
  const firstFaceplateType = state.faceplates.types[0];
  const firstScript = state.scripts[0];
  const firstTextLibrary = state.lists.textLibraries[0];
  const firstGraphicList = state.lists.graphicLists[0];
  const firstUserArchive = state.userArchives[0];
  const firstReport = state.reports.reports[0];

  useEffect(() => {
    void loginEngineer();
  }, []);

  async function loginEngineer() {
    try {
      const nextSession = await api<WorkbenchSession>("/auth/login", { method: "POST", body: JSON.stringify({ projectId: DEMO_PROJECT_ID, username: "engineer", password: "engineer" }) });
      setSession(nextSession);
      setAuthError(null);
    } catch (err) {
      setAuthError(err instanceof Error ? err.message : "Engineer login failed");
    }
  }

  function requireToken() {
    if (!session?.token) throw new Error("Engineer session required");
    return session.token;
  }

  async function syncNodeRed() {
    const result = await api<{ flows: any[] }>(`/projects/${DEMO_PROJECT_ID}/node-red/sync`, { method: "POST", body: JSON.stringify({ deploy: false }) }, requireToken());
    setSyncResult(`${result.flows.length} generated flow(s)`);
  }

  async function publish() {
    const bundle = await api<any>(`/projects/${DEMO_PROJECT_ID}/publish`, { method: "POST", body: JSON.stringify({ version: `dev-${Date.now()}` }) }, requireToken());
    setSyncResult(`Published ${bundle.version}`);
  }

  async function createEngineeringSample(kind: "provider" | "connection" | "tag" | "screen" | "object" | "faceplateVersion" | "propagate" | "script" | "report" | "runReport" | "textItem" | "graphicItem" | "archiveRow" | "historianSample" | "browseSymbols" | "importSymbols" | "alignLeft" | "zOrder" | "groupObjects" | "graphicResource" | "pictureWindow" | "rebuildXref") {
    if (kind === "provider") {
      await api(`/projects/${DEMO_PROJECT_ID}/providers`, { method: "POST", body: JSON.stringify({ key: `custom-${Date.now()}`, name: `Custom driver ${Date.now()}`, driver: "node-red-custom", capabilities: { read: true, write: true, browse: false } }) }, requireToken());
    }
    if (kind === "connection" && firstProvider) {
      await api(`/projects/${DEMO_PROJECT_ID}/connections`, { method: "POST", body: JSON.stringify({ providerId: firstProvider.id, name: `PLC_${Date.now()}`, endpoint: "192.168.0.20", state: "disabled", options: { rack: 0, slot: 1 } }) }, requireToken());
    }
    if (kind === "tag") {
      await api(`/projects/${DEMO_PROJECT_ID}/tags`, { method: "POST", body: JSON.stringify({ connectionId: firstConnection?.id, name: `NewTag${Date.now()}`, path: `Demo.NewTag${Date.now()}`, scope: firstConnection ? "external" : "internal", dataType: "bool", address: "DB10,X0.0", properties: { createdFromWorkbench: true } }) }, requireToken());
    }
    if (kind === "screen") {
      await api(`/projects/${DEMO_PROJECT_ID}/screens`, { method: "POST", body: JSON.stringify({ name: `Screen_${Date.now()}`, width: 1280, height: 720, background: { color: "#101820" } }) }, requireToken());
    }
    if (kind === "object" && mainScreen) {
      await api(`/screens/${mainScreen.id}/objects`, { method: "POST", body: JSON.stringify({ type: "text", name: `Label_${Date.now()}`, x: 120, y: 80, width: 180, height: 42, properties: { text: "New object", fill: "#e5edf5" }, bindings: {}, events: {} }) }, requireToken());
    }
    if (kind === "pictureWindow" && mainScreen) {
      await api(`/screens/${mainScreen.id}/objects`, { method: "POST", body: JSON.stringify({ type: "pictureWindow", name: `PictureWindow_${Date.now()}`, x: 720, y: 620, width: 300, height: 120, properties: { screen: "EquipmentPopup", tagPrefix: "Motor01", title: "Motor details" }, bindings: {}, events: {} }) }, requireToken());
    }
    if (kind === "faceplateVersion" && firstFaceplateType) {
      await api(`/faceplate-types/${firstFaceplateType.id}/new-version`, { method: "POST", body: JSON.stringify({ interface: firstFaceplateType.interface, composition: firstFaceplateType.composition }) }, requireToken());
    }
    if (kind === "propagate" && firstFaceplateType) {
      await api(`/faceplate-types/${firstFaceplateType.id}/propagate`, { method: "POST", body: "{}" }, requireToken());
    }
    if (kind === "script") {
      const script = firstScript ?? await api<any>(`/projects/${DEMO_PROJECT_ID}/scripts`, { method: "POST", body: JSON.stringify({ name: `Script_${Date.now()}`, language: "javascript", source: 'api.writeTag("Motor01.Speed", 42);' }) }, requireToken());
      const result = await api<any>(`/scripts/${script.id}/execute`, { method: "POST", body: JSON.stringify({ context: { manual: true } }) }, requireToken());
      setSyncResult(`Script executed: ${result.writes.length} write(s), ${result.openedPictures.length} picture(s)`);
    }
    if (kind === "report") {
      await api(`/projects/${DEMO_PROJECT_ID}/reports`, { method: "POST", body: JSON.stringify({ name: `Report_${Date.now()}`, template: { sections: [{ kind: "alarms" }, { kind: "historian" }] } }) }, requireToken());
    }
    if (kind === "runReport" && firstReport) {
      const result = await api<{ run: any; output: string }>(`/reports/${firstReport.id}/generate`, { method: "POST", body: JSON.stringify({ format: "csv" }) }, requireToken());
      setSyncResult(`Report generated: ${result.run.output_uri}`);
    }
    if (kind === "textItem" && firstTextLibrary) {
      await api(`/text-libraries/${firstTextLibrary.id}/items`, { method: "POST", body: JSON.stringify({ listName: "EquipmentState", key: `state_${Date.now()}`, locale: "en-US", text: "Service" }) }, requireToken());
    }
    if (kind === "graphicItem" && firstGraphicList) {
      await api(`/graphic-lists/${firstGraphicList.id}/items`, { method: "POST", body: JSON.stringify({ key: `asset_${Date.now()}`, assetRef: "assets/custom.svg", metadata: { createdFromWorkbench: true } }) }, requireToken());
    }
    if (kind === "archiveRow" && firstUserArchive) {
      await api(`/user-archives/${firstUserArchive.id}/rows`, { method: "POST", body: JSON.stringify({ row: { ts: new Date().toISOString(), equipment: "Conveyor01", note: "Workbench entry" } }) }, requireToken());
    }
    if (kind === "historianSample" && state.historian[0]) {
      await api(`/historian/${state.historian[0].id}/samples`, { method: "POST", body: JSON.stringify({ value: Number((Math.random() * 10 + 15).toFixed(2)), quality: "good", source: "engineering" }) }, requireToken());
    }
    if (kind === "browseSymbols" && firstConnection) {
      const result = await api<{ symbols: any[] }>(`/connections/${firstConnection.id}/browse`, { method: "POST", body: "{}" }, requireToken());
      setSyncResult(`Browsed ${result.symbols.length} symbol(s)`);
    }
    if (kind === "importSymbols" && firstConnection) {
      const result = await api<{ imported: any[] }>(`/connections/${firstConnection.id}/symbols/import`, { method: "POST", body: JSON.stringify({ symbolIds: state.plcSymbols.filter((symbol) => !symbol.imported_tag_id).map((symbol) => symbol.id) }) }, requireToken());
      setSyncResult(`Imported ${result.imported.length} tag(s)`);
    }
    if (kind === "alignLeft" && mainScreen) {
      await api(`/screens/${mainScreen.id}/objects/align`, { method: "POST", body: JSON.stringify({ objectIds: screenObjects.slice(0, 3).map((object) => object.id), mode: "left" }) }, requireToken());
    }
    if (kind === "zOrder" && mainScreen) {
      await api(`/screens/${mainScreen.id}/objects/z-order`, { method: "POST", body: JSON.stringify({ objectIds: screenObjects.map((object) => object.id), start: 1 }) }, requireToken());
    }
    if (kind === "groupObjects" && mainScreen) {
      await api(`/screens/${mainScreen.id}/object-groups`, { method: "POST", body: JSON.stringify({ name: `Group_${Date.now()}`, objectIds: screenObjects.slice(0, 2).map((object) => object.id), properties: { locked: false } }) }, requireToken());
    }
    if (kind === "graphicResource") {
      await api(`/projects/${DEMO_PROJECT_ID}/graphic-resources`, { method: "POST", body: JSON.stringify({ name: `Resource_${Date.now()}`, kind: "symbol", uri: "assets/generated-symbol.svg", metadata: { createdFromWorkbench: true } }) }, requireToken());
    }
    if (kind === "rebuildXref") {
      const result = await api<{ count: number }>(`/projects/${DEMO_PROJECT_ID}/cross-reference/rebuild`, { method: "POST", body: "{}" }, requireToken());
      setSyncResult(`Cross-reference indexed ${result.count} hit(s)`);
    }
    await refresh();
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><Workflow size={22} /> OpenSCADA Workbench</div>
        <div className="sidebar-actions">
          <button onClick={() => void refresh()}><RefreshCw size={15} /> Refresh</button>
          <button onClick={() => void syncNodeRed()}><Network size={15} /> Node-RED</button>
          <button onClick={() => void publish()}><Play size={15} /> Publish</button>
        </div>
        <div className="quick-create">
          <button onClick={() => void createEngineeringSample("provider")}>New provider</button>
          <button onClick={() => void createEngineeringSample("connection")}>New connection</button>
          <button onClick={() => void createEngineeringSample("tag")}>New tag</button>
          <button onClick={() => void createEngineeringSample("screen")}>New screen</button>
          <button onClick={() => void createEngineeringSample("object")}>New object</button>
          <button onClick={() => void createEngineeringSample("faceplateVersion")}>Version faceplate</button>
          <button onClick={() => void createEngineeringSample("propagate")}>Propagate</button>
          <button onClick={() => void createEngineeringSample("script")}>Run script</button>
          <button onClick={() => void createEngineeringSample("report")}>New report</button>
          <button onClick={() => void createEngineeringSample("runReport")}>Run report</button>
          <button onClick={() => void createEngineeringSample("textItem")}>New text</button>
          <button onClick={() => void createEngineeringSample("graphicItem")}>New graphic</button>
          <button onClick={() => void createEngineeringSample("archiveRow")}>Archive row</button>
          <button onClick={() => void createEngineeringSample("historianSample")}>Hist sample</button>
          <button onClick={() => void createEngineeringSample("browseSymbols")}>Browse PLC</button>
          <button onClick={() => void createEngineeringSample("importSymbols")}>Import PLC</button>
          <button onClick={() => void createEngineeringSample("pictureWindow")}>Pic window</button>
          <button onClick={() => void createEngineeringSample("alignLeft")}>Align left</button>
          <button onClick={() => void createEngineeringSample("zOrder")}>Z-order</button>
          <button onClick={() => void createEngineeringSample("groupObjects")}>Group</button>
          <button onClick={() => void createEngineeringSample("graphicResource")}>Resource</button>
          <button onClick={() => void createEngineeringSample("rebuildXref")}>Rebuild xref</button>
        </div>
        {state.tree && <Tree node={state.tree} />}
      </aside>
      <section className="workspace">
        <header className="topbar">
          <div>
            <h1>Engineering Shell</h1>
            <p>Canonical project engineering, runtime publishing, Node-RED sync and cross-reference.</p>
          </div>
          <span className="status">{authError ?? error ?? `${session?.user.displayName ?? "No engineer session"} - ${syncResult}`}</span>
        </header>
        <div className="dock">
          <section className="panel wide">
            <h2><Cpu size={17} /> Tag Management</h2>
            <DataGrid rows={state.tags} />
          </section>
          <section className="panel">
            <h2><Network size={17} /> Connections and Historian</h2>
            <DataGrid rows={[...state.providers, ...state.connections, ...state.historian]} />
          </section>
          <section className="panel">
            <h2><Network size={17} /> PLC Symbols and Diagnostics</h2>
            <DataGrid rows={[...state.plcSymbols, ...state.connectionDiagnostics]} />
          </section>
          <section className="panel wide">
            <h2><Boxes size={17} /> Graphics Designer</h2>
            <GraphicsDesigner objects={screenObjects} />
          </section>
          <section className="panel">
            <h2><Boxes size={17} /> Faceplates</h2>
            <DataGrid rows={[...state.faceplates.types, ...state.faceplates.instances]} />
          </section>
          <section className="panel">
            <h2><FileCode2 size={17} /> Script Editor</h2>
            <Editor height="310px" defaultLanguage="javascript" value={'if (api.readTag("Motor01.Fault")) api.openPicture("EquipmentPopup", "Motor01");'} theme="vs-dark" options={{ minimap: { enabled: false }, fontSize: 13 }} />
          </section>
          <section className="panel">
            <h2><Siren size={17} /> Alarm Logging</h2>
            <DataGrid rows={state.alarms.events} />
          </section>
          <section className="panel">
            <h2><Shield size={17} /> Users and Permissions</h2>
            <DataGrid rows={[...state.users.users, ...state.users.permissions]} />
          </section>
          <section className="panel">
            <h2><RefreshCw size={17} /> Cross-reference</h2>
            <DataGrid rows={state.crossReference} />
          </section>
          <section className="panel">
            <h2><FileCode2 size={17} /> Reports and Archives</h2>
            <DataGrid rows={[...state.reports.reports, ...state.reports.runs, ...state.userArchives]} />
          </section>
          <section className="panel">
            <h2><Boxes size={17} /> Text and Graphic Lists</h2>
            <DataGrid rows={[...state.lists.textItems, ...state.lists.graphicItems]} />
          </section>
          <section className="panel">
            <h2><Boxes size={17} /> Graphic Resources and Groups</h2>
            <DataGrid rows={[...state.graphics.resources, ...state.graphics.groups]} />
          </section>
        </div>
      </section>
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
