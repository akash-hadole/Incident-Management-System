/**
 * Mock Failure Event Simulator
 * Simulates: RDBMS outage followed by MCP Host failure cascade
 */

const BASE_URL = process.env.IMS_URL || 'http://localhost:3001';

const FAILURE_SCENARIOS = [
  // Phase 1: RDBMS Outage (P0)
  { componentId: 'RDBMS_PRIMARY', errorCode: 'CONNECTION_POOL_EXHAUSTED', severity: 'CRITICAL', message: 'Primary DB connection pool exhausted', delay: 0 },
  { componentId: 'RDBMS_PRIMARY', errorCode: 'DEADLOCK_DETECTED', severity: 'CRITICAL', message: 'Deadlock in transactions table', delay: 200 },
  { componentId: 'RDBMS_PRIMARY', errorCode: 'REPLICATION_LAG', severity: 'ERROR', message: 'Replication lag > 30s', delay: 400 },

  // Phase 2: API cascade (P1)
  { componentId: 'API_GATEWAY', errorCode: 'UPSTREAM_TIMEOUT', severity: 'ERROR', message: 'RDBMS upstream timeout after 5000ms', delay: 1000 },
  { componentId: 'API_GATEWAY', errorCode: 'CIRCUIT_OPEN', severity: 'ERROR', message: 'Circuit breaker opened on DB route', delay: 1200 },

  // Phase 3: MCP Host (P1)
  { componentId: 'MCP_HOST_01', errorCode: 'CONTEXT_FETCH_FAILED', severity: 'ERROR', message: 'Cannot fetch context from RDBMS', delay: 2000 },
  { componentId: 'MCP_HOST_02', errorCode: 'HEALTH_CHECK_FAILED', severity: 'WARNING', message: 'MCP Host 02 health check failing', delay: 2200 },

  // Phase 4: Cache pressure (P2)
  { componentId: 'CACHE_CLUSTER_01', errorCode: 'EVICTION_STORM', severity: 'WARNING', message: 'Cache eviction rate 10x normal', delay: 3000 },
  { componentId: 'CACHE_CLUSTER_01', errorCode: 'MEMORY_PRESSURE', severity: 'WARNING', message: 'Memory usage at 94%', delay: 3100 },

  // Phase 5: Queue backlog (P2)
  { componentId: 'ASYNC_QUEUE_01', errorCode: 'BACKLOG_EXCEEDED', severity: 'ERROR', message: 'Queue depth > 50,000 messages', delay: 4000 },
  { componentId: 'NOSQL_STORE_01', errorCode: 'WRITE_THROTTLED', severity: 'WARNING', message: 'Write operations throttled', delay: 4500 },
];

async function sendSignal(signal) {
  const { delay, ...payload } = signal;
  try {
    const res = await fetch(`${BASE_URL}/api/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    console.log(`✅ [${payload.componentId}] ${payload.errorCode} → ${res.status}`, data);
  } catch (err) {
    console.error(`❌ Failed to send signal for ${payload.componentId}:`, err.message);
  }
}

async function runSimulation() {
  console.log('🔥 Starting RDBMS Outage → MCP Cascade simulation...\n');
  for (const scenario of FAILURE_SCENARIOS) {
    await new Promise(r => setTimeout(r, scenario.delay));
    await sendSignal(scenario);
  }
  console.log('\n✅ Simulation complete! Check your IMS dashboard.');
}

runSimulation();
