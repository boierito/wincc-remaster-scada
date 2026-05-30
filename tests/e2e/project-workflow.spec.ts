import { expect, test } from "@playwright/test";

const API = "http://localhost:4100/api";
const DEMO_PROJECT_ID = "10000000-0000-0000-0000-000000000001";

test("creates a usable project with providers, connection, tag and Node-RED flow", async ({ request }) => {
  const demoLogin = await request.post(`${API}/auth/login`, {
    data: { projectId: DEMO_PROJECT_ID, username: "engineer", password: "engineer" }
  });
  expect(demoLogin.ok()).toBeTruthy();
  const demoSession = await demoLogin.json();
  const demoHeaders = { authorization: `Bearer ${demoSession.token}` };

  const suffix = Date.now();
  const projectResponse = await request.post(`${API}/projects`, {
    headers: demoHeaders,
    data: { name: `E2E Project ${suffix}`, description: "Created by automated workflow coverage" }
  });
  expect(projectResponse.ok()).toBeTruthy();
  const project = await projectResponse.json();

  const projectLogin = await request.post(`${API}/auth/login`, {
    data: { projectId: project.id, username: "engineer", password: "engineer" }
  });
  expect(projectLogin.ok()).toBeTruthy();
  const projectSession = await projectLogin.json();
  const projectHeaders = { authorization: `Bearer ${projectSession.token}` };

  const providersResponse = await request.get(`${API}/projects/${project.id}/providers`);
  expect(providersResponse.ok()).toBeTruthy();
  const providers = await providersResponse.json();
  expect(providers.map((provider: any) => provider.key)).toEqual(expect.arrayContaining(["s7", "opcua", "mpi-ppi-dp"]));

  const customProviderResponse = await request.post(`${API}/projects/${project.id}/providers`, {
    headers: projectHeaders,
    data: {
      key: `custom-${suffix}`,
      name: "Custom engineering driver",
      driver: "node-red-custom",
      capabilities: { read: true, write: true, browse: false }
    }
  });
  expect(customProviderResponse.ok()).toBeTruthy();

  const s7Provider = providers.find((provider: any) => provider.key === "s7");
  const connectionResponse = await request.post(`${API}/projects/${project.id}/connections`, {
    headers: projectHeaders,
    data: {
      providerId: s7Provider.id,
      name: `PLC_${suffix}`,
      endpoint: "192.168.10.20",
      state: "online",
      options: { rack: 0, slot: 1 }
    }
  });
  expect(connectionResponse.ok()).toBeTruthy();
  const connection = await connectionResponse.json();

  const tagResponse = await request.post(`${API}/projects/${project.id}/tags`, {
    headers: projectHeaders,
    data: {
      connectionId: connection.id,
      name: "MotorRunning",
      path: "Motor01.Running",
      scope: "external",
      dataType: "bool",
      address: "DB1,X0.0",
      properties: { workflow: "e2e" }
    }
  });
  expect(tagResponse.ok()).toBeTruthy();

  const syncResponse = await request.post(`${API}/projects/${project.id}/node-red/sync`, {
    headers: projectHeaders,
    data: { deploy: false }
  });
  expect(syncResponse.ok()).toBeTruthy();
  const sync = await syncResponse.json();
  expect(sync.flows).toHaveLength(1);
  expect(sync.flows[0].nodes.map((node: any) => node.type)).toEqual(expect.arrayContaining(["s7 endpoint", "s7 in", "function"]));

  const treeResponse = await request.get(`${API}/projects/${project.id}/tree`);
  expect(treeResponse.ok()).toBeTruthy();
  const tree = await treeResponse.json();
  expect(JSON.stringify(tree)).toContain("Main");
  expect(JSON.stringify(tree)).toContain("@System.ConnectionState");
});
