import { expect, test } from "@playwright/test";

const API = "http://localhost:4100/api";
const DEMO_PROJECT_ID = "10000000-0000-0000-0000-000000000001";

test("auth verifies password hashes and preserves permission checks", async ({ request }) => {
  const rejected = await request.post(`${API}/auth/login`, {
    data: { projectId: DEMO_PROJECT_ID, username: "engineer", password: "wrong" }
  });
  expect(rejected.status()).toBe(401);

  const accepted = await request.post(`${API}/auth/login`, {
    data: { projectId: DEMO_PROJECT_ID, username: "engineer", password: "engineer" }
  });
  expect(accepted.ok()).toBeTruthy();
  const session = await accepted.json();
  expect(session.user.permissions).toEqual(expect.arrayContaining(["engineering.edit", "runtime.write"]));

  const current = await request.get(`${API}/auth/session`, {
    headers: { authorization: `Bearer ${session.token}` }
  });
  expect(current.ok()).toBeTruthy();
  expect((await current.json()).user.username).toBe("engineer");
});
