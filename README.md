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

SQLite migrations run automatically at startup. The default database is `data/bunilite.sqlite`.

## Commands

```bash
bun run dev     # watch mode
bun run start   # production server
bun run check   # TypeScript validation
bun test        # test suite
```

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
| POST   | `/api/ws/broadcast`       | Send a message to WebSocket clients |
| GET    | `/health`                 | Health check                        |

WebSocket clients connect to `ws://localhost:3000/ws`. Visit `/public/ws-client.html` for a browser client.

## Security behavior

- Passwords and persisted refresh tokens use bcrypt via Bun's password API.
- Access tokens expire in 15 minutes; refresh tokens and sessions expire after 30 days.
- Refresh token rotation revokes every prior refresh token for the current session.
- Protected routes always validate active, unexpired session state in SQLite, so a cache entry cannot authorize a logged-out session.
- Configure long, unique `ACCESS_SECRET` and `REFRESH_SECRET` values before deploying.
