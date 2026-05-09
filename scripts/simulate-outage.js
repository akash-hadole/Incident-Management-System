/**
 * simulate-outage.js — Simulates a cascading RDBMS + MCP failure scenario
 * Run: node scripts/simulate-outage.js
 */

const BASE_URL = 'http://localhost:4000/api';

async function post(path, body) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function main() {
  console.log('🔴 Starting RDBMS outage simulation...');
  for (let i = 0; i < 15; i++) {
    await post('/signals', {
      componentId: 'RDBMS_PRIMARY',
      componentType: 'RDBMS',
      message: `Connection timeout #${i + 1}`,
      severity: 'CRITICAL',
      metadata: { retry: i, host: 'db-primary.internal' },
    });
  }
  console.log('  Sent 15 RDBMS signals → 1 work item (debounced)');

  await sleep(500);
  console.log('\n🟠 Simulating MCP cascade...');
  for (const msg of ['MCP Host unreachable', 'MCP queue overflow', 'MCP auth timeout']) {
    await post('/signals', { componentId: 'MCP_HOST_02', componentType: 'MCP', message: msg, severity: 'ERROR' });
    await sleep(100);
  }

  console.log('\n🟡 Simulating cache degradation...');
  for (let i = 0; i < 5; i++) {
    await post('/signals', { componentId: 'CACHE_CLUSTER_01', componentType: 'CACHE', message: `Cache miss rate: ${70 + i * 5}%`, severity: 'WARNING' });
    await sleep(50);
  }

  console.log('\n✅ Simulation complete. Check the dashboard at http://localhost:3000');
}

main().catch(console.error);
