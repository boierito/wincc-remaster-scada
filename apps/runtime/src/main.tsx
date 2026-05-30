import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import ReactECharts from "echarts-for-react";
import { io } from "socket.io-client";
import { resolveTagReference } from "@scada/domain";
import { Bell, Lock, LogOut, Maximize2, PlayCircle, ShieldCheck } from "lucide-react";
import "./styles.css";

const PROJECT_ID = "10000000-0000-0000-0000-000000000001";

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

type RuntimeSession = {
  token: string;
  user: { id: string; username: string; displayName: string; permissions: string[]; timeoutSeconds: number };
  expiresAt: string;
};

function useManifest() {
  const [manifest, setManifest] = useState<any>();
  useEffect(() => {
    void api(`/projects/${PROJECT_ID}/runtime-manifest`).then(setManifest);
  }, []);
  return manifest;
}

function useRuntimeData(manifest: any) {
  const [alarmEvents, setAlarmEvents] = useState<any[]>([]);
  const [historianSamples, setHistorianSamples] = useState<Record<string, any[]>>({});
  useEffect(() => {
    if (!manifest) return;
    let cancelled = false;
    async function refreshRuntimeData() {
      const alarms = await api<{ events: any[] }>(`/projects/${PROJECT_ID}/alarms`);
      const archives = manifest.historian ?? [];
      const samplePairs = await Promise.all(archives.map(async (archive: any) => [archive.id, await api<any[]>(`/projects/${PROJECT_ID}/historian/${archive.id}/samples`)] as const));
      if (!cancelled) {
        setAlarmEvents(alarms.events);
        setHistorianSamples(Object.fromEntries(samplePairs));
      }
    }
    void refreshRuntimeData();
    const timer = window.setInterval(() => void refreshRuntimeData(), 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [manifest]);
  return { alarmEvents, historianSamples };
}

function useLiveTags(manifest: any) {
  const initial = useMemo(() => Object.fromEntries((manifest?.tags ?? []).map((tag: any) => [tag.path, tag.last_value ?? false])), [manifest]);
  const [values, setValues] = useState<Record<string, unknown>>(initial);
  useEffect(() => setValues(initial), [initial]);
  useEffect(() => {
    const socket = io();
    socket.on("tag:sample", (sample: any) => setValues((current) => ({ ...current, [sample.path]: sample.value })));
    return () => {
      socket.disconnect();
    };
  }, []);
  return values;
}

function EquipmentFaceplate({ instance, values, onOpen }: { instance: any; values: Record<string, unknown>; onOpen: (prefix: string) => void }) {
  const title = instance.property_overrides?.title ?? instance.name;
  const running = Boolean(values[instance.tag_bindings?.running]);
  const fault = Boolean(values[instance.tag_bindings?.fault]);
  const speed = values[instance.tag_bindings?.speed] ?? "--";
  return (
    <button className={`faceplate ${fault ? "fault" : running ? "running" : ""}`} onClick={() => onOpen(instance.name)}>
      <div className="faceplate-title">{title}</div>
      <div className="faceplate-state">{fault ? "Fault" : running ? "Running" : "Stopped"}</div>
      <div className="faceplate-speed">{String(speed)} rpm</div>
    </button>
  );
}

function EmbeddedPicture({ object, manifest, values, openPicture }: { object: any; manifest: any; values: Record<string, unknown>; openPicture: (screen: string, prefix?: string) => void }) {
  const targetScreen = manifest.screens.find((screen: any) => screen.name === object.properties?.screen);
  const prefix = object.properties?.tagPrefix;
  const faultTag = prefix ? resolveTagReference("Fault", { inheritedPrefix: prefix }) : "";
  return (
    <button className="picture-window" onClick={() => openPicture(object.properties?.screen ?? "Main", prefix)}>
      <div className="picture-window-title">{object.properties?.title ?? targetScreen?.name ?? "Picture"}</div>
      <div>Target: {targetScreen?.name ?? "Missing"}</div>
      <div>Prefix: {prefix ?? "none"}</div>
      <div>Fault: {String(values[faultTag] ?? false)}</div>
    </button>
  );
}

function RuntimeObject({ object, manifest, values, alarmEvents, historianSamples, openPicture, onAck }: { object: any; manifest: any; values: Record<string, unknown>; alarmEvents: any[]; historianSamples: Record<string, any[]>; openPicture: (screen: string, prefix?: string) => void; onAck: (eventId: string) => void }) {
  const style = {
    left: Number(object.x),
    top: Number(object.y),
    width: Number(object.width),
    height: Number(object.height),
    zIndex: Number(object.z_index)
  };

  if (object.type === "text") return <div className="rt-text" style={style}>{object.properties?.text}</div>;
  if (object.type === "faceplate") {
    const instance = manifest.faceplateInstances.find((item: any) => item.id === object.properties?.faceplateInstanceId);
    return <div className="rt-object" style={style}>{instance && <EquipmentFaceplate instance={instance} values={values} onOpen={(prefix) => openPicture("EquipmentPopup", prefix)} />}</div>;
  }
  if (object.type === "trend") {
    const path = object.bindings?.value;
    const value = Number(values[path] ?? 0);
    const archive = (manifest.historian ?? []).find((item: any) => item.tag_path === path || item.name === object.properties?.archive);
    const samples = archive ? historianSamples[archive.id] ?? [] : [];
    const labels = samples.length ? samples.map((sample: any) => new Date(sample.ts).toLocaleTimeString()) : ["-4m", "-3m", "-2m", "-1m", "now"];
    const series = samples.length ? samples.map((sample: any) => Number(sample.value)) : [18.2, 20.1, 19.7, 21.4, value];
    return (
      <div className="rt-panel" style={style}>
        <h3>{object.properties?.title}</h3>
        <ReactECharts style={{ height: "205px" }} option={{ grid: { left: 35, right: 10, top: 15, bottom: 25 }, xAxis: { type: "category", data: labels }, yAxis: { type: "value" }, series: [{ type: "line", smooth: true, data: series }] }} />
      </div>
    );
  }
  if (object.type === "alarmTable") {
    return (
      <div className="rt-panel" style={style}>
        <h3><Bell size={16} /> Active alarms</h3>
        {alarmEvents.map((event: any) => <div className="alarm-row" key={event.id}>{event.message}<button onClick={() => onAck(event.id)}>ACK</button></div>)}
      </div>
    );
  }
  if (object.type === "pictureWindow") {
    return <div className="rt-object" style={style}><EmbeddedPicture object={object} manifest={manifest} values={values} openPicture={openPicture} /></div>;
  }
  return <div className="rt-object" style={style}>{object.name}</div>;
}

function App() {
  const manifest = useManifest();
  const values = useLiveTags(manifest);
  const { alarmEvents, historianSamples } = useRuntimeData(manifest);
  const [session, setSession] = useState<RuntimeSession | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [windowContext, setWindowContext] = useState<{ screen: string; prefix?: string } | null>(null);
  const [password, setPassword] = useState("operator");

  if (!manifest) return <div className="loading">Loading runtime manifest...</div>;
  const screen = manifest.screens.find((item: any) => item.name === "Main") ?? manifest.screens[0];
  const objects = manifest.objects.filter((object: any) => object.screen_id === screen.id);
  const popupTag = windowContext?.prefix ? resolveTagReference("Fault", { inheritedPrefix: windowContext.prefix }) : "";
  const permissions = session?.user.permissions ?? [];

  async function login(username: string, nextPassword = password) {
    try {
      const nextSession = await api<RuntimeSession>("/auth/login", { method: "POST", body: JSON.stringify({ projectId: PROJECT_ID, username, password: nextPassword }) });
      setSession(nextSession);
      setAuthError(null);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Login failed");
    }
  }

  async function logout() {
    if (session) await api("/auth/logout", { method: "POST", body: "{}" }, session.token).catch(() => undefined);
    setSession(null);
  }

  async function acknowledge(eventId: string) {
    if (!session) {
      setAuthError("Login required for ACK");
      return;
    }
    await api(`/alarm-events/${eventId}/ack`, { method: "POST", body: "{}" }, session.token);
  }

  return (
    <main className="runtime">
      <header className="runtime-top">
        <div className="runtime-brand"><PlayCircle size={20} /> {manifest.project.name}</div>
        <div className="runtime-actions">
          <span><ShieldCheck size={15} /> {session?.user.displayName ?? "No session"}</span>
          <input aria-label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
          <button onClick={() => void login("operator")}><Lock size={15} /> Operator</button>
          <button onClick={() => { setPassword("engineer"); void login("engineer", "engineer"); }}><Lock size={15} /> Engineer</button>
          <button onClick={() => void logout()}><LogOut size={15} /> Logout</button>
        </div>
      </header>
      {authError && <div className="runtime-auth-error">{authError}</div>}
      <div className="runtime-permissions">Permissions: {permissions.length ? permissions.join(", ") : "none"}</div>
      <section className="screen" style={{ width: screen.width, height: screen.height, background: screen.background?.color ?? "#0f1720" }}>
        {objects.map((object: any) => <RuntimeObject key={object.id} object={object} manifest={manifest} values={values} alarmEvents={alarmEvents} historianSamples={historianSamples} onAck={(eventId) => void acknowledge(eventId)} openPicture={(name, prefix) => setWindowContext({ screen: name, prefix })} />)}
      </section>
      {windowContext && (
        <div className="popup">
          <div className="popup-title"><Maximize2 size={16} /> {windowContext.screen} {windowContext.prefix}</div>
          <div>Prefix-resolved fault tag: {popupTag}</div>
          <div>Current value: {String(values[popupTag] ?? false)}</div>
          <button onClick={() => setWindowContext(null)}>Close</button>
        </div>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
