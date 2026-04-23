# WebSocket + Redis Scaling Implementation Guide

## 1. Purpose

This document explains the full implementation of Socket.IO horizontal scaling with Redis Pub/Sub, distributed room state, validation, and resilient error handling.

It is designed as:
- A developer onboarding guide
- A production operations reference
- A future extension blueprint (WebRTC signaling and SFU-ready architecture)

---

## 2. What Was Implemented

### Core Goals Achieved

- Horizontal scaling for Socket.IO across multiple Node.js instances
- Room and user event synchronization between instances
- Redis adapter integration with retry and timeout behavior
- Distributed room membership state (not only in-process memory)
- Reusable utility layer for IDs, validation, socket helpers, and socket error logging
- Validation layer for `roomId` and `userId` to prevent invalid joins and malformed payloads

### New/Updated Components

- `backend/src/config/socketRedis.ts`
- `backend/src/services/Room/distributedRoomStateService.ts`
- `backend/src/services/WebSocket/utils/generateRoomId.ts`
- `backend/src/services/WebSocket/utils/validateRoom.ts`
- `backend/src/services/WebSocket/utils/socketHelpers.ts`
- `backend/src/services/WebSocket/utils/errorHandler.ts`
- `backend/src/services/WebSocket/socketService.ts`
- `backend/src/services/Room/roomService.ts`
- `backend/src/controllers/Room/roomController.ts`
- `backend/src/index.ts`
- `backend/.env.example`
- `backend/package.json` (added `@socket.io/redis-adapter`)

---

## 3. Architecture Overview

### High-Level Design

```text
Client A ----\
              \        ┌───────────────┐
Client B ------> LB -->│ Node Instance │---\
              /        └───────────────┘   \
Client C ----/                               > Redis Pub/Sub + Redis Sets
              \        ┌───────────────┐   /
Client D ------> LB -->│ Node Instance │---/
              /        └───────────────┘
Client E ----/
```

### Why this matters

- Without adapter: events stay on one instance.
- With adapter: all instances receive room/user events correctly.
- With distributed room state: room participants are consistent across instances.

---

## 4. Socket.IO Redis Adapter

### File

- `backend/src/config/socketRedis.ts`

### Responsibilities

- Create dedicated Redis pub/sub clients for Socket.IO adapter
- Apply connection timeout and reconnect strategy
- Handle adapter setup failure gracefully (degrade to single-node behavior)
- Provide cleanup helpers on shutdown

### Important behavior

- `createSocketRedisClients()` returns `null` if connection fails.
- WebSocket service logs the issue and continues (no hard crash).
- Reconnect strategy uses bounded exponential backoff.

### Tunable environment variables

- `SOCKET_REDIS_CONNECT_TIMEOUT_MS` (default: `4000`)
- `SOCKET_REDIS_MAX_RETRIES` (default: `5`)

---

## 5. Distributed Room State

### File

- `backend/src/services/Room/distributedRoomStateService.ts`

### Why this exists

In-memory room membership is not enough for multi-instance deployments. We need shared room state.

### Storage strategy

- Primary: Redis Set per room key: `rooms:state:<roomId>:users`
- Fallback: local in-memory `Map<string, Set<string>>` if Redis is unavailable

### Key methods

- `validateRoomExists(roomId)`
- `validateUserCanJoinRoom(roomId, userId)`
- `addUserToRoom(roomId, userId)`
- `removeUserFromRoom(roomId, userId)`
- `getRoomUsers(roomId)`

### Notes

- Uses MongoDB room data to enforce participant authorization.
- Adds TTL (`ROOM_STATE_TTL_SECONDS`, default `21600`) to Redis room membership keys.

---

## 6. Validation Layer

### File

- `backend/src/services/WebSocket/utils/validateRoom.ts`

### Validation coverage

- `validateRoomId(roomId)`
- `validateUserId(userId)` (ObjectId validation)
- `validateRoomJoinPayload(payload)` via Joi schema
- `validateRoomMessagePayload(payload)` via Joi schema

### Protection provided

- Blocks malformed room events early
- Prevents invalid ID formats from reaching business logic
- Prevents invalid joins and bad message payloads

---

## 7. Reusable Socket Utilities

### `generateRoomId.ts`

- Central utility for creating room IDs (`room_<timestamp>_<random>`)
- Room service now uses this helper instead of inline generation

### `socketHelpers.ts`

- Channel naming helpers:
  - `roomChannel(roomId)`
  - `userChannel(userId)`
  - `profileChannel(userId)`
- Standardized emit helpers:
  - `emitSocketSuccess(...)`
  - `emitSocketError(...)`

### `errorHandler.ts`

- Structured logging for socket context:
  - `logSocketInfo(context, metadata)`
  - `logSocketError(context, error, metadata)`

---

## 8. WebSocket Service Refactor

### File

- `backend/src/services/WebSocket/socketService.ts`

### Key upgrades

1. Adapter integration
- Initializes Socket.IO Redis adapter at startup.
- Falls back gracefully if adapter cannot be initialized.

2. Channel-based emits for multi-instance support
- `notifyUser` now emits to `user:<userId>` room, not only direct socketId.
- Improves delivery reliability across nodes.

3. Strict socket payload validation
- Room join/leave/message now validated before processing.
- WebRTC signaling payloads validate room and target user IDs.

4. Distributed membership tracking
- On room join/call join: add user to distributed state.
- On room leave/disconnect/call leave: remove user from distributed state.
- `getRoomCallParticipants` now reads distributed state.

5. Better failure logging
- Structured error logs for join failures, adapter init issues, and Redis problems.

6. Graceful shutdown
- On app shutdown, closes Redis adapter clients safely.

---

## 9. Room Service and Controller Updates

### Room service (`backend/src/services/Room/roomService.ts`)

- Added `roomId` and `userId` validation guards across room/call APIs.
- Uses shared `generateRoomId()`.

### Room controller (`backend/src/controllers/Room/roomController.ts`)

- Added HTTP `400` responses for invalid ID errors (message contains `Invalid`).

---

## 10. Event Flow Walkthrough

### A. Room Join

1. Client emits `room:join`.
2. WebSocket service validates payload and user ID.
3. Service checks:
- Room exists and active
- User is authorized participant/host
4. Socket joins `room:<roomId>`.
5. Distributed state service records membership in Redis set.
6. Success ack sent to client.

### B. Room Message

1. Client emits `room:message`.
2. Payload validated.
3. Event broadcast with `socket.to(roomChannel(roomId)).emit(...)`.
4. Targeted room-only emit avoids unnecessary global broadcasts.

### C. Disconnect

1. Socket disconnect event fires.
2. Service iterates socket rooms.
3. Removes user from distributed room state.
4. Emits `webrtc:user-left-call` to affected room channels.
5. Cleans local maps and profile presence channel state.

### D. WebRTC Join Call

1. Client emits `webrtc:join-call`.
2. Validate `roomId`, authorization.
3. Add user to distributed state.
4. Fetch participants from distributed state.
5. Notify existing users and return participant list to joining user.

---

## 11. Scalability and Performance Design Rules Mapping

### Rule: Do not keep room state only in memory

- Implemented via Redis set-backed distributed room state service.
- Local fallback only when Redis is down.

### Rule: Targeted emits, no unnecessary broadcasts

- Room-scoped emits: `room:<roomId>`
- User-scoped emits: `user:<userId>`
- Profile-scoped emits: `profile:<userId>`

### Rule: Multi-instance correctness

- Socket.IO Redis adapter syncs pub/sub events across nodes.
- Distributed membership ensures consistent participant lookups.

### Rule: Avoid blocking operations

- Async Redis/Mongo operations
- Non-blocking socket handlers
- Fast validation before expensive calls

---

## 12. Redis Failure and Timeout Handling

### Behaviors implemented

- Adapter connection timeout with bounded retries.
- Adapter init failure does not crash the server.
- Distributed state service logs Redis failures and uses local fallback.
- Shutdown path cleans adapter resources safely.

### Operational implication

- System remains available during transient Redis failures.
- Horizontal sync is reduced when Redis is unavailable, but service remains up.

---

## 13. Environment Configuration

Add or confirm in `.env`:

```env
REDIS_URL=redis://<host>:<port>
SOCKET_REDIS_CONNECT_TIMEOUT_MS=4000
SOCKET_REDIS_MAX_RETRIES=5
ROOM_STATE_TTL_SECONDS=21600
```

If all instances share the same `REDIS_URL`, multi-instance sync works.

---

## 14. Deployment Guide (How to Use)

### Single instance (development)

1. Start Redis (optional but recommended).
2. Start backend.
3. Socket service works with adapter if Redis is reachable.

### Multi-instance (production)

1. Run Redis reachable by all Node instances.
2. Configure same `REDIS_URL` on every instance.
3. Start backend replicas behind load balancer.
4. Verify:
- Users connected to different instances can join same room
- Room/user events propagate cross-instance

### Quick checks

- Log contains: `socket redis adapter enabled`
- Join user on Instance A, receive events on Instance B clients

---

## 15. Troubleshooting Runbook

### Symptom: Events not crossing instances

Check:
- Redis reachable from all nodes
- `REDIS_URL` same across nodes
- Adapter enabled log appears

### Symptom: Invalid join errors

Check:
- `roomId` format and existence
- `userId` validity and room membership in MongoDB

### Symptom: Redis timeout warnings

Actions:
- Increase `SOCKET_REDIS_CONNECT_TIMEOUT_MS`
- Check network latency/firewall
- Verify Redis CPU/memory saturation

### Symptom: Inconsistent participants during Redis outage

Expected:
- Local fallback kicks in.
- Cross-instance participant accuracy is reduced until Redis recovers.

---

## 16. Future Extension Readiness

Current design intentionally keeps transport and domain separated:

- Socket helpers are reusable and event-agnostic.
- Validation is centralized.
- Room state service can be swapped (Redis -> dedicated state store).
- WebRTC signaling can expand without controller coupling.

### For Mediasoup/SFU integration later

- Keep socket events thin and command-based.
- Put SFU orchestration in dedicated service (`services/Media`).
- Reuse existing room/user validation and channel helpers.
- Keep distributed participant state decoupled from media transport internals.

---

## 17. File Map

- Adapter config:
  - `src/config/socketRedis.ts`
- Distributed room state:
  - `src/services/Room/distributedRoomStateService.ts`
- WebSocket utilities:
  - `src/services/WebSocket/utils/generateRoomId.ts`
  - `src/services/WebSocket/utils/validateRoom.ts`
  - `src/services/WebSocket/utils/socketHelpers.ts`
  - `src/services/WebSocket/utils/errorHandler.ts`
- WebSocket orchestration:
  - `src/services/WebSocket/socketService.ts`
- Room domain logic:
  - `src/services/Room/roomService.ts`
- API layer updates:
  - `src/controllers/Room/roomController.ts`
- Startup/shutdown wiring:
  - `src/index.ts`
- Env documentation:
  - `.env.example`

---

## 18. Limitations and Current Repo Context

- The backend repository currently contains unrelated pre-existing TypeScript errors outside this feature area.
- This WebSocket/Redis implementation was designed to be modular and production-oriented regardless of those unrelated issues.

---

## 19. Maintenance Checklist

Before each release:

1. Confirm Redis connectivity from all instances.
2. Validate adapter enabled logs.
3. Test cross-instance room join/leave/message propagation.
4. Test disconnect cleanup behavior.
5. Test invalid payload rejection (`roomId`, `userId`, malformed events).
6. Review logs for repeated Redis timeout/retry failures.

---

## 20. Recommended Next Improvements

1. Add integration tests for cross-instance socket propagation using Docker Redis and two backend processes.
2. Add metrics:
- adapter enabled/disabled state
- Redis reconnect attempts
- per-event validation failures
3. Replace fallback in-memory room state with persistent queue/event log for stronger outage behavior.
4. Add schema validation for all WebRTC payloads (offer/answer/candidate structure).

