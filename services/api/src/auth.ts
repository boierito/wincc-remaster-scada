import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { query } from "./db.js";

export interface AuthUser {
  id: string;
  projectId: string;
  username: string;
  displayName: string;
  permissions: string[];
  timeoutSeconds: number;
}

declare module "express-serve-static-core" {
  interface Request {
    authUser?: AuthUser;
  }
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function issueToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function createSession(projectId: string, username: string, password?: string): Promise<{ token: string; user: AuthUser; expiresAt: string }> {
  const [userRow] = await query<any>(
    `select u.id, u.project_id, u.username, u.display_name, u.password_hash, coalesce(min(g.timeout_seconds), 900) as timeout_seconds
     from users u
     join user_groups ug on ug.user_id = u.id
     join groups g on g.id = ug.group_id
     where u.project_id = $1 and u.username = $2 and u.enabled = true
     group by u.id`,
    [projectId, username]
  );
  if (!userRow) throw Object.assign(new Error("Invalid user"), { statusCode: 401 });
  if (userRow.password_hash && !verifyPassword(password ?? "", userRow.password_hash)) {
    throw Object.assign(new Error("Invalid user"), { statusCode: 401 });
  }
  const permissions = await permissionsForUser(userRow.id);
  const token = issueToken();
  const expiresAt = new Date(Date.now() + Number(userRow.timeout_seconds) * 1000).toISOString();
  await query("insert into auth_sessions (project_id, user_id, token_hash, expires_at) values ($1,$2,$3,$4)", [projectId, userRow.id, hashToken(token), expiresAt]);
  return { token, user: mapUser(userRow, permissions), expiresAt };
}

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("base64url");
  const key = scryptSync(password, salt, 64, { N: 16_384, r: 8, p: 1 }).toString("base64url");
  return `scrypt$16384$8$1$${salt}$${key}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [algorithm, n, r, p, salt, key] = storedHash.split("$");
  if (algorithm !== "scrypt" || !n || !r || !p || !salt || !key) return false;
  const actual = Buffer.from(key, "base64url");
  const candidate = scryptSync(password, salt, actual.length, { N: Number(n), r: Number(r), p: Number(p) });
  return actual.length === candidate.length && timingSafeEqual(actual, candidate);
}

export async function authenticateToken(token?: string): Promise<AuthUser | undefined> {
  if (!token) return undefined;
  const [session] = await query<any>(
    `select s.id as session_id, s.expires_at, u.id, u.project_id, u.username, u.display_name, coalesce(min(g.timeout_seconds), 900) as timeout_seconds
     from auth_sessions s
     join users u on u.id = s.user_id
     join user_groups ug on ug.user_id = u.id
     join groups g on g.id = ug.group_id
     where s.token_hash = $1 and s.revoked_at is null and s.expires_at > now() and u.enabled = true
     group by s.id, u.id`,
    [hashToken(token)]
  );
  if (!session) return undefined;
  await query("update auth_sessions set last_seen_at = now() where id = $1", [session.session_id]);
  return mapUser(session, await permissionsForUser(session.id));
}

export async function revokeToken(token?: string): Promise<void> {
  if (!token) return;
  await query("update auth_sessions set revoked_at = now() where token_hash = $1", [hashToken(token)]);
}

export async function permissionsForUser(userId: string): Promise<string[]> {
  const rows = await query<{ key: string }>(
    `select distinct p.key
     from permissions p
     join user_groups ug on ug.group_id = p.group_id
     where ug.user_id = $1 and p.allowed = true`,
    [userId]
  );
  return rows.map((row) => row.key);
}

export function authMiddleware() {
  return async (req: Request, _res: Response, next: NextFunction) => {
    try {
      req.authUser = await authenticateToken(bearerToken(req));
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    if (!req.authUser.permissions.includes(permission)) {
      res.status(403).json({ error: `Missing permission: ${permission}` });
      return;
    }
    next();
  };
}

export function bearerToken(req: Request): string | undefined {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice("Bearer ".length);
}

function mapUser(row: any, permissions: string[]): AuthUser {
  return {
    id: row.id,
    projectId: row.project_id,
    username: row.username,
    displayName: row.display_name,
    permissions,
    timeoutSeconds: Number(row.timeout_seconds)
  };
}
