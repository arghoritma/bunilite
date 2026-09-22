# bunilite

Backend REST API template built with **Bun**, **TypeScript**, and **Hono**. optional Redis session caching, JWT authentication, multi-device sessions, refresh-token rotation, and native Bun WebSocket broadcast.

## Requirements

- Bun 1.4+
- Redis is optional. The application continues using SQLite when Redis is unavailable.

## Start

```bash
bun install
cp .env.example .env
bun run dev
```

Apply SQLite migrations before starting the application. The default database is `data/bunilite.sqlite`.

## Commands

```bash
bun run dev     # watch mode
bun run start   # production server
bun run check   # TypeScript validation
bun test        # test suite in tests/
bun run migrate:latest              # apply pending migrations
bun run migrate:rollback            # roll back the latest migration batch
bun run migrate:make -- add-posts   # generate an up/down migration
```

## Database migrations

Migrations use native `bun:sqlite` and are stored in `src/migrations`. Every migration exports `up` and `down`; applied migrations are tracked in SQLite's `schema_migrations` table.

Create a migration with `bun run migrate:make -- <name>`, implement its SQL, then use `bun run migrate:latest`. `migrate:rollback` reverses all migrations applied by the latest `migrate:latest` invocation, in reverse order.

Existing databases created before this migration system are automatically baselined as `001_initial_schema` when the original `users`, `user_sessions`, and `refresh_tokens` tables are present. Their data is preserved.

Do not edit a migration after it has been applied to a shared environment. Create a new migration instead.

## API

| Method | Path                      | Description                         |
| ------ | ------------------------- | ----------------------------------- |
| POST   | `/api/auth/register`      | Register a user                     |
| POST   | `/api/auth/login`         | Create a device session and tokens  |
| POST   | `/api/auth/refresh-token` | Rotate a refresh token              |
| GET    | `/api/auth/sessions`      | List active sessions (Bearer token) |
| GET    | `/api/auth/logout`        | End current session (Bearer token)  |
| GET    | `/api/auth/logout-all`    | End all sessions (Bearer token)     |
| GET    | `/api/users/profile`      | Read profile (Bearer token)         |
| GET    | `/api/events`             | Receive Server-Sent Events           |
| POST   | `/api/ws/broadcast`       | Send a message to WebSocket and SSE clients |
| GET    | `/health`                 | Health check                        |

WebSocket clients connect to `ws://localhost:3000/ws`; SSE clients connect to `http://localhost:3000/api/events`. Visit `/` for a browser playground that demonstrates REST, WebSocket, and SSE together.

## Security behavior

- Passwords and persisted refresh tokens use bcrypt via Bun's password API.
- Access tokens expire in 15 minutes; refresh tokens and sessions expire after 30 days.
- Refresh token rotation revokes every prior refresh token for the current session.
- Protected routes always validate active, unexpired session state in SQLite, so a cache entry cannot authorize a logged-out session.
- Configure long, unique `ACCESS_SECRET` and `REFRESH_SECRET` values before deploying.
