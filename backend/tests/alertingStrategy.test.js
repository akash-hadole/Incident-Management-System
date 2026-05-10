const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createAlertStrategy } = require('../src/workflow/alertingStrategy');

describe('Alerting Strategy', () => {
  it('RDBMS_PRIMARY gets P0', () => {
    assert.strictEqual(createAlertStrategy('RDBMS_PRIMARY').getPriority().level, 'P0');
  });
  it('CACHE_CLUSTER_01 gets P2', () => {
    assert.strictEqual(createAlertStrategy('CACHE_CLUSTER_01').getPriority().level, 'P2');
  });
  it('API_GATEWAY gets P1', () => {
    assert.strictEqual(createAlertStrategy('API_GATEWAY').getPriority().level, 'P1');
  });
  it('Unknown gets P3', () => {
    assert.strictEqual(createAlertStrategy('UNKNOWN_01').getPriority().level, 'P3');
  });
  it('getAlert returns P0 message', () => {
    const alert = createAlertStrategy('RDBMS_PRIMARY').getAlert({ errorCode: 'CONN_REFUSED' });
    assert.ok(alert.message.includes('P0'));
    assert.ok(alert.timestamp);
  });
});
