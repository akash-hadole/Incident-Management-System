# IMS Architecture Deep-Dive

## Signal Flow

```
HTTP POST /api/signals
    │
    ▼
Rate Limiter (5000 req/s)
    │
    ▼
SignalBuffer.push(signal)           ← O(1), never blocks HTTP handler
    │
    ▼ (setImmediate — async)
Drain batch of 100
    │
    ▼
DebounceEngine
    ├── componentId seen in last 10s? → link to existing WorkItem
    └── new componentId? → create WorkItem via AlertStrategy
                                       (Priority, escalation, message)
    │
    ▼
appendSignal(componentId, signal)   ← NoSQL / Data Lake
upsertWorkItem(workItem)            ← RDBMS / Source of Truth
recordTimeSeriesPoint(...)          ← TimeSeries Aggregation
broadcastUpdate(ws)                 ← Real-time dashboard push
setCacheEntry('dashboard', ...)     ← Redis hot-path invalidation
```

## State Machine

```
       ┌─────┐
  ──▶  │OPEN │
       └──┬──┘
          │ transition('INVESTIGATING')
       ┌──▼──────────────┐
       │  INVESTIGATING   │
       └──┬──────────────┘
          │ transition('RESOLVED')
       ┌──▼──────┐
       │RESOLVED │
       └──┬──────┘
          │ transition('CLOSED') — requires complete RCA
       ┌──▼────┐
       │CLOSED │  ← terminal state; MTTR computed here
       └───────┘
```

## MTTR Calculation

MTTR = RCA.endTime − RCA.startTime (in seconds)

Set by the responder on the RCA form; represents actual service restoration time.

## Debounce Window

- t=0s:  Signal A for RDBMS_01 → CREATE WorkItem WI-001
- t=1s:  Signal B for RDBMS_01 → LINK to WI-001 (no new item)
- t=10s: Window expires
- t=11s: Signal D for RDBMS_01 → CREATE new WorkItem WI-002
