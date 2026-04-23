# Production Deployment Readiness

## What was hardened

- Added Redis Socket.IO adapter preflight config checks.
- Added automated production preflight script:
  - `npm run preflight:prod`
- Fixed Docker healthcheck to avoid missing `curl` dependency.
- Fixed Docker Compose scaling blockers:
  - removed fixed `container_name` for app
  - removed misleading non-swarm `deploy.replicas`
  - fixed Mongo init password to use env var
- Fixed Nginx deployment blockers:
  - added `/health` upstream route
  - removed undefined `frontend_server` proxy target
  - added WebSocket upgrade headers
  - removed separate `stream` block requirement
- Sanitized `.env.example` to remove real secrets and use placeholders.

## Mandatory pre-deploy checks

Run from `backend/`:

```bash
npm ci
npm run preflight:prod
```

If preflight shows errors, do not deploy.

## Required production env variables

- `NODE_ENV=production`
- `PORT`
- `MONGODB_URI`
- `REDIS_URL`
- `JWT_SECRET`
- `REFRESH_TOKEN_SECRET`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `FRONTEND_URL`
- `SOCKET_REDIS_CONNECT_TIMEOUT_MS`
- `SOCKET_REDIS_MAX_RETRIES`
- `ROOM_STATE_TTL_SECONDS`

## Docker deployment flow

```bash
docker compose build --no-cache app
docker compose up -d mongodb redis mongodb-init
docker compose up -d app nginx
docker compose ps
docker compose logs -f app
```

To scale app replicas:

```bash
docker compose up -d --scale app=3
```

## Post-deploy validation

- `GET /health` returns `200`
- `GET /ready` returns healthy status
- WebSocket connect works with auth token
- Room join/leave/message works across replicas
- Redis adapter logs show enabled state

## Known repository-wide blockers (outside this hardening scope)

Current backend TypeScript build has existing unrelated compile errors in other modules (jobs, streak, subscription, some model typings).  
These are pre-existing and should be resolved before strict CI gate deployment with `npm run build`.

## Recommended CI gate

1. `npm ci`
2. `npm run preflight:prod`
3. `npm run lint`
4. `npm run test`
5. `npm run build` (once repository-wide TS issues are fixed)

