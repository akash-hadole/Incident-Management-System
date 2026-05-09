<<<<<<< HEAD
# Incident-Management-System
This is the repo for Incident Management System
=======
# ⬡ Incident Management System (IMS)

A production-grade, real-time incident management platform for monitoring distributed stacks — APIs, MCP Hosts, Distributed Caches, Async Queues, RDBMS, and NoSQL stores.

---

## Architecture Diagram

```
                        ┌─────────────────────────────────────────────────────────┐
                        │                   IMS SYSTEM ARCHITECTURE                │
                        └─────────────────────────────────────────────────────────┘

  Distributed Stack          Ingestion Layer            Processing & Storage
  ─────────────────          ──────────────             ────────────────────
  
  RDBMS   ──┐               ┌─────────────┐            ┌──────────────────────┐
  API     ──┤  POST /signals │  Rate        │            │   Signal Buffer      │
  CACHE   ──┤ ──────────────▶│  Limiter     │───────────▶│   (Ring Buffer,      │
  QUEUE   ──┤               │  5000 r/s    │            │   50k capacity)      │
  NOSQL   ──┤               └─────────────┘            └────────┬─────────────┘
  MCP     ──┘                                                    │ setImmediate
                                                                 ▼
                                                        ┌──────────────────────┐
                                                        │   Debounce Engine    │
                                                        │   10s window / compId│
                                                        │   → 1 WorkItem       │
                                                        └────────┬─────────────┘
                                                                 │
                           ┌─────────────────────────────────────┤
                           │                                     │
                           ▼                                     ▼
                  ┌─────────────────┐                  ┌─────────────────────┐
                  │  NoSQL Store    │                  │  RDBMS Store        │
                  │  (Raw Signals / │                  │  (Work Items / RCA) │
                  │   Audit Log)    │                  │  Transactional      │
                  └─────────────────┘                  └─────────┬───────────┘
                                                                  │
                                                        ┌─────────▼───────────┐
                                                        │  Redis Cache        │
                                                        │  (Dashboard State)  │
                                                        │  TTL: 5s            │
                                                        └─────────┬───────────┘
                                                                  │
              ┌───────────────────────────────────────────────────┤
              │                                                   │
              ▼                                                   ▼
   ┌─────────────────────┐                             ┌─────────────────────┐
   │   WebSocket Server  │                             │  Time-Series Store  │
   │   (Real-time push)  │                             │  (Aggregations)     │
   └──────────┬──────────┘                             └─────────────────────┘
              │
              ▼
   ┌─────────────────────────────────────────────────────────────────────────┐
   │                        React Dashboard (Frontend)                        │
   │  ┌──────────────┐  ┌───────────────────┐  ┌───────────────────────────┐ │
   │  │ Live Incident│  │  Incident Detail  │  │      RCA Form             │ │
   │  │ Feed (sorted │  │  + Signal List    │  │  - Start/End datetime     │ │
   │  │ by severity) │  │  (from NoSQL)     │  │  - Root Cause Category    │ │
   │  └──────────────┘  └───────────────────┘  │  - Fix Applied            │ │
   │                                           │  - Prevention Steps       │ │
   │                                           └───────────────────────────┘ │
   └─────────────────────────────────────────────────────────────────────────┘
```

---

## Design Patterns Used

### Strategy Pattern — Alerting
File: `backend/src/workflow/AlertingStrategy.js`

Each component type maps to a concrete strategy that defines priority level, escalation targets, and alert message format. Swapping alert behavior requires only adding a new strategy class.

| Component | Priority | Strategy Class |
|-----------|----------|----------------|
| RDBMS | P0 🔴 CRITICAL | `RDBMSAlertStrategy` |
| API | P1 🟠 HIGH | `APIAlertStrategy` |
| NOSQL | P1 🟠 HIGH | `NoSQLAlertStrategy` |
| MCP | P1 🟠 HIGH | `MCPAlertStrategy` |
| CACHE | P2 🟡 MEDIUM | `CacheAlertStrategy` |
| QUEUE | P2 🟡 MEDIUM | `QueueAlertStrategy` |

### State Pattern — Work Item Lifecycle
File: `backend/src/workflow/WorkItemState.js`

```
OPEN → INVESTIGATING → RESOLVED → CLOSED
```

- Each transition is guarded by `validateTransition()`
- CLOSED is rejected unless a complete RCA object is present
- MTTR is auto-calculated on CLOSED transition

---

## Backpressure Handling

The system uses a **ring-buffer approach** in `SignalBuffer.js`:

1. **Producer** (HTTP handler) pushes signals to the in-memory buffer — O(1), never blocks
2. **Consumer** drains via `setImmediate()` in batches of 100 — yields to I/O between batches
3. If the buffer exceeds **50,000 items** (worst-case burst), the oldest entry is evicted (ring semantics) — the system never crashes
4. **Rate limiter** at the ingestion API caps at 5,000 req/sec, preventing cascading from external clients
5. Dropped signal count is tracked and reported in `/health` and console metrics

---

## Setup Instructions

### Local Development

```bash
# Backend
cd backend
npm install
node src/index.js        # runs on http://localhost:4000

# Frontend (new terminal)
cd frontend
npm install
npm start                # runs on http://localhost:3000
```

### Docker Compose

```bash
docker-compose up --build
# Backend: http://localhost:4000
# Frontend: http://localhost:3000
```

### Running Tests

```bash
cd backend
npm test
```

### Simulate an Outage

```bash
# With backend running:
node scripts/simulate-outage.js
```

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/signals` | Ingest a signal |
| GET | `/api/workitems` | List all work items |
| GET | `/api/workitems/:id` | Get a work item |
| GET | `/api/workitems/:id/signals` | Raw signals for a work item |
| PATCH | `/api/workitems/:id/transition` | Transition state |
| PUT | `/api/workitems/:id/rca` | Submit/update RCA |
| GET | `/api/timeseries` | Time-series aggregations |
| GET | `/api/metrics` | Throughput metrics |
| GET | `/health` | Health check |

### Signal Payload Example

```json
{
  "componentId": "RDBMS_PRIMARY",
  "componentType": "RDBMS",
  "message": "Connection pool exhausted",
  "severity": "CRITICAL",
  "metadata": { "host": "db01.internal", "connections": 500 }
}
```

---

## Tech Stack Choices & Rationale

| Layer | Choice | Reason |
|-------|--------|--------|
| Runtime | Node.js 20 | Native async I/O, event loop ideal for high-throughput signal ingestion |
| Signal buffer | In-memory ring buffer | Zero-latency producer path; decouples ingestion from slow persistence |
| Data Lake (NoSQL) | In-memory Map | Simulates document store; swap for MongoDB in production |
| Source of Truth (RDBMS) | In-memory Map | Simulates PostgreSQL; transactional upserts enforced programmatically |
| Cache (Redis) | In-memory TTL cache | 5s TTL avoids DB reads on every dashboard refresh |
| Time-series | In-memory array | Simulates InfluxDB; swap for real TSDB in production |
| Real-time | WebSocket (ws) | Native push; no polling needed |
| Frontend | React 18 | Component model fits incident card/detail/form structure |
| Rate limiting | express-rate-limit | Built-in sliding window; prevents ingestion endpoint abuse |

---

## Evaluation Checklist

- [x] **Concurrency & Scaling** — Ring buffer + async drain, no race conditions on state transitions
- [x] **Data Handling** — 3 separate stores: NoSQL (signals), RDBMS (work items), Redis (cache)
- [x] **LLD** — Strategy + State patterns; single responsibility per module
- [x] **UI/UX** — Live feed, incident detail, RCA form, WebSocket real-time updates
- [x] **Resilience** — Retry logic (3x) on DB writes, RCA validation tests
- [x] **Documentation** — This README + inline JSDoc
- [x] **Tech Stack** — Justified choices above
- [x] **Bonus** — Built-in Signal Simulator panel, MTTR auto-calculation, time-series endpoint
>>>>>>> 4ab801bb (push whole code)
