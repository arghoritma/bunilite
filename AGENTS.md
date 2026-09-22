# Bunilite Agent Guide

## Purpose

`bunilite` is a backend REST API template built with Bun, TypeScript, Hono, native SQLite (`bun:sqlite`), optional Redis session caching, JWT authentication, Bun WebSockets, and Server-Sent Events (SSE).

Use this document as the source of truth for extending the backend. Preserve the existing layer boundaries and API response conventions unless a requested change explicitly requires a breaking change.

## Runtime And Commands

- Runtime: Bun 1.4+.
- Language: TypeScript with `strict` enabled.
- HTTP framework: Hono.
- Database: SQLite through `bun:sqlite`; no ORM is used.
- Cache: Redis through `ioredis`; it is optional.
- JWT: `jose` with HS256.

```bash
bun install
cp .env.example .env
bun run migrate:latest
bun run dev

bun run start
bun run check
bun test
bun run migrate:latest
bun run migrate:rollback
bun run migrate:make -- add-posts
```

`bun test` runs `bun test tests`, so place new tests under `tests/` with a `.test.ts` suffix.

## Environment

```dotenv
PORT=3000
DATABASE_PATH=data/bunilite.sqlite
ACCESS_SECRET=replace-with-a-long-random-access-secret
REFRESH_SECRET=replace-with-a-long-random-refresh-secret
REDIS_URL=redis://localhost:6379
```

- `PORT` defaults to `3000`.
- `DATABASE_PATH` defaults to `data/bunilite.sqlite`. Its parent directory is created automatically by `src/configs/db.ts`.
- `ACCESS_SECRET` and `REFRESH_SECRET` must be different, long, private values. They are read when `src/utils/jwt.ts` is imported.
- Omit `REDIS_URL` to run without Redis. Authentication remains correct because SQLite remains the source of truth.

## Directory Layout

```text
src/
  index.ts                    Application and Bun server bootstrap only
  configs/db.ts               Shared native SQLite connection and PRAGMA setup
  routes/                     URL and HTTP-method declarations by domain
  handlers/                   HTTP parsing, validation, and response mapping
  services/                   Domain logic, SQL queries, and integrations
  middlewares/                Reusable Hono middleware
  utils/                      Shared technical helpers
  migrations/                 Versioned native SQLite schema changes
  scripts/                    Bun CLI entry points
  types.ts                    Shared database/domain/Hono environment types
tests/                        Isolated tests, grouped by layer
public/                       Static files and WebSocket browser example
data/                         Default local SQLite data
```

Current modules:

```text
src/routes/       auth.ts, user.ts, websocket.ts, sse.ts
src/handlers/     auth.handler.ts, user.handler.ts, websocket.handler.ts, sse.handler.ts
src/services/     auth.service.ts, user.service.ts, websocket.service.ts, sse.service.ts
src/middlewares/  auth.middleware.ts
src/utils/        cache.ts, jwt.ts, validation.ts
src/migrations/   001_initial_schema.ts, runner.ts, types.ts
src/scripts/      migrate.ts, make-migration.ts
tests/            migrations/runner.test.ts, utils/validation.test.ts
```

## Layer Rules

### Bootstrap: `src/index.ts`

`index.ts` creates the root `Hono<AppEnv>` application, registers static files, health endpoint, route modules, global 404/500 handlers, optional Redis initialization, and `Bun.serve` WebSocket lifecycle.

Do not add SQL, request validation, business rules, or feature endpoint implementations directly to `index.ts`.

### Routes: `src/routes/`

Each route file represents one domain and exports a `Hono` instance mounted under `/api` by `index.ts`.

```ts
const postRoute = new Hono<AppEnv>();
postRoute.post("/posts", requireAuth, createPost);
export default postRoute;
```

- Define HTTP method, path, middleware, and handler only.
- Do not parse bodies, write SQL, or implement business rules in routes.
- Use `new Hono<AppEnv>()` for routes that use `c.var.user`.
- Mount a new domain with `app.route("/api", postRoute)`.

### Handlers: `src/handlers/`

Handlers are the HTTP adapter. They may parse `c.req`, validate input, call services, select status codes, and map database/domain data into public JSON.

- Do not place SQL, JWT, or Redis implementation in handlers.
- Use `Context<AppEnv>` for protected handlers; do not use `any`.
- Keep request parsing helpers local unless reusable.
- Never expose password hashes, refresh-token hashes, or raw database fields without an intentional public mapping.

Validation errors use:

```json
{ "errors": { "email": "email is required" } }
```

Normal responses conventionally use:

```json
{
  "code": "SUCCESS",
  "message": "Human-readable message",
  "data": {}
}
```

### Services: `src/services/`

Services own use cases, SQL queries, transactional integrity, and infrastructure integration.

- Import the shared `db` from `src/configs/db.ts`.
- Return domain data, `null` for expected absence/invalid credentials, and throw unexpected errors for the global error handler.
- Use parameterized SQLite queries with `?`; never interpolate input into SQL.
- Keep a feature's SQL in its service, not routes or handlers.

### Middleware: `src/middlewares/`

`requireAuth` reads the Bearer token, calls `authenticate`, returns `401` when invalid, and stores the result with `c.set("user", user)`.

Protected routes must use `requireAuth`. Their handlers must authorize using `c.var.user`, not a user ID supplied by the request. Update `AppEnv` in `src/types.ts` for every new shared context variable.

### Utilities: `src/utils/`

- `validation.ts`: reusable validation helpers and validation error shape.
- `jwt.ts`: access/refresh JWT signing and verification.
- `cache.ts`: optional, best-effort Redis session cache operations.

Utilities must not depend on Hono `Context` or endpoint-specific behavior.

## Database And Migrations

The application uses a single `bun:sqlite` connection from `src/configs/db.ts` with WAL mode, `synchronous = NORMAL`, foreign keys enabled, and a 5-second busy timeout.

Current schema from `001_initial_schema`:

- `users`: identity, unique normalized email, bcrypt password hash, timestamps.
- `user_sessions`: device-specific session state, IP/user agent, expiry; references `users`.
- `refresh_tokens`: bcrypt refresh-token hash, revocation, expiry; references `user_sessions`.
- `schema_migrations`: applied migration ID, batch, and timestamp.

Database naming uses snake_case. Public JSON responses normally use camelCase, mapped in handlers.

Migrations are TypeScript files in `src/migrations/`, dynamically loaded by `runner.ts`. No ORM or third-party migration framework is used.

```bash
bun run migrate:make -- add-user-avatar
bun run migrate:latest
bun run migrate:rollback
```

Every migration exports reversible `up` and `down` functions:

```ts
import type { Migration } from "./types";

export const up: Migration["up"] = (db) => {
  db.exec(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`);
};

export const down: Migration["down"] = (db) => {
  db.exec(`ALTER TABLE users DROP COLUMN avatar_url;`);
};
```

Migration rules:

- Run `bun run migrate:latest` before application startup in local, CI, staging, and production. The server never applies migrations automatically.
- `migrate:latest` applies every pending migration in one transaction and records them as one batch.
- `migrate:rollback` reverts the complete latest batch in reverse order and in one transaction.
- Never edit, rename, reorder, or delete a migration applied to a shared environment. Create a new migration.
- Write and test `down` before applying `up`.
- SQLite supports limited schema changes. For complex changes, create a replacement table, copy/transform data, drop the old table, rename the replacement, and recreate indexes/triggers.
- Add tests for non-trivial migrations with `new Database(":memory:")`.
- Databases created before this migration system are automatically baselined as `001_initial_schema` when the three original auth tables exist, without losing data.

## Authentication And Security

`src/services/auth.service.ts` owns authentication.

- Registration validates name (3-30 chars), email, and password (6-50 chars); email is trimmed/lowercased.
- Passwords and stored refresh tokens are hashed with Bun bcrypt at cost 10.
- Login creates a session per device. It uses supplied `deviceId` or generates a UUID, and records `x-forwarded-for` and `user-agent`.
- Sessions and refresh tokens last 30 days; access tokens last 15 minutes.
- JWT payload contains `userId`, `sessionId`, `deviceId`, and `type` (`access` or `refresh`).
- Protected requests need `Authorization: Bearer <access token>`.
- Access tokens are not sufficient alone: authentication verifies the active, unexpired SQLite session and matching device ID.
- Refresh token rotation revokes all earlier refresh tokens for the active session before issuing a new pair.
- Logout disables the current session and revokes its refresh tokens. Logout-all does this for all user sessions.

Do not weaken session-state validation, token rotation, bcrypt hashing, or public response privacy when extending auth.

## Redis Cache

Redis is optional and only caches session metadata.

- `connectCache()` runs once during startup. Connection failure logs a warning and the API continues on SQLite.
- Cache write/delete failure disables cache use for that process.
- Keys are `session:<sessionId>` and `user_sessions:<userId>`; TTL follows the session expiry.
- Never make cache data the authorization source. SQLite is the source of truth.

## WebSockets

- Clients connect to `ws://<host>/ws`.
- Only the exact `/ws` path is upgraded by `Bun.serve`.
- `websocket.service.ts` owns the process-local socket set and exposes `addSocket`, `removeSocket`, and `broadcast`.
- `POST /api/ws/broadcast` sends `{ type, payload }` to all connected sockets.
- Broadcast state is process-local; it does not fan out across multiple server instances.
- Incoming WebSocket messages are currently ignored.
- Server limits: 60-second idle timeout and 32 KiB maximum payload.
- `POST /api/ws/broadcast` currently has no auth middleware. Do not expose it publicly without adding `requireAuth` and a suitable authorization rule.

## Server-Sent Events

- Clients open a one-way event stream at `GET /api/events` using the browser `EventSource` API.
- `sse.service.ts` owns the process-local subscribers and exposes `subscribe` and `publish`.
- `sse.handler.ts` produces `text/event-stream` responses, sends a connection comment, and sends a 25-second keep-alive comment for proxy compatibility.
- The broadcast handler sends each `{ type, payload }` event to both WebSocket and SSE clients.
- SSE uses the event `type` as the SSE event name and JSON-serializes `payload` in the event data. Clients should register a listener for that named event, such as `source.addEventListener("test", handler)`.
- SSE subscriptions are process-local, exactly like WebSockets. They do not fan out between server instances without a shared event broker.
- `GET /api/events` is currently public. Add authentication and authorization before sending sensitive events.

## HTTP API

| Method | Path | Auth | Responsibility |
| --- | --- | --- | --- |
| `GET` | `/health` | No | Liveness response `{ status: "ok" }` |
| `POST` | `/api/auth/register` | No | Create account |
| `POST` | `/api/auth/login` | No | Create device session and token pair |
| `POST` | `/api/auth/refresh-token` | No | Rotate refresh token |
| `GET` | `/api/auth/sessions` | Bearer | List caller sessions |
| `GET` | `/api/auth/logout` | Bearer | End current session |
| `GET` | `/api/auth/logout-all` | Bearer | End all caller sessions |
| `GET` | `/api/users/profile` | Bearer | Read caller profile |
| `GET` | `/api/events` | No currently | Receive server-sent events |
| `POST` | `/api/ws/broadcast` | No currently | Broadcast to connected sockets |

`/` serves the REST/WebSocket/SSE browser playground in `public/index.html`; `/public/*` serves public assets. `public/ws-client.html` redirects to the playground for compatibility.

## Tests And Quality Gate

Put tests under `tests/` by layer:

- `tests/utils/` for pure utilities.
- `tests/services/` for service behavior when added.
- `tests/migrations/` for isolated in-memory SQLite migration tests.
- Add handler/route tests for HTTP contract, status, validation, and authorization when extending endpoints.

Tests must not use `data/bunilite.sqlite`, the application Redis instance, or real secrets. Keep them deterministic and isolated.

Before finishing any change, run:

```bash
bun run check
bun test
```

For schema changes, also apply, verify, roll back, and verify the migration against an isolated database.

## New Resource Checklist

For a new resource such as posts:

1. Create a migration: `bun run migrate:make -- create-posts`.
2. Implement and test reversible `up` and `down` SQL.
3. Add broadly reusable types to `src/types.ts`.
4. Add `src/services/post.service.ts` for SQL/domain logic.
5. Add `src/handlers/post.handler.ts` for validation and public response mapping.
6. Add `src/routes/post.ts` for path, method, and middleware.
7. Mount the route under `/api` in `src/index.ts`.
8. Apply `requireAuth` where needed and scope data using `c.var.user.id`.
9. Add tests under `tests/`.
10. Run migration, type-check, test, and diff checks.

## Prohibited Shortcuts

- Do not put feature code, validation, or SQL in `src/index.ts`.
- Do not query SQLite from routes or handlers.
- Do not authorize with Redis cache data alone.
- Do not expose passwords, refresh-token hashes, or unreviewed raw database rows.
- Do not trust request-provided user IDs for authorization.
- Do not modify an already-applied migration.
- Do not make tests depend on a developer database or Redis instance.
- Do not add an ORM or another migration framework unless requirements explicitly change.
