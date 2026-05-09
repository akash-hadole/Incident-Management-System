/**
 * Strategy Pattern — Alerting
 * Each component type maps to a priority strategy.
 */

class RDBMSAlertStrategy {
  get priority() { return 'P0'; }
  get label() { return '🔴 CRITICAL'; }
  get escalateTo() { return ['oncall-lead', 'cto']; }
  format(signal) {
    return `[P0 CRITICAL] RDBMS failure on ${signal.componentId}: ${signal.message}`;
  }
}

class APIAlertStrategy {
  get priority() { return 'P1'; }
  get label() { return '🟠 HIGH'; }
  get escalateTo() { return ['oncall-engineer']; }
  format(signal) {
    return `[P1 HIGH] API degradation on ${signal.componentId}: ${signal.message}`;
  }
}

class CacheAlertStrategy {
  get priority() { return 'P2'; }
  get label() { return '🟡 MEDIUM'; }
  get escalateTo() { return ['sre-team']; }
  format(signal) {
    return `[P2 MEDIUM] Cache failure on ${signal.componentId}: ${signal.message}`;
  }
}

class QueueAlertStrategy {
  get priority() { return 'P2'; }
  get label() { return '🟡 MEDIUM'; }
  get escalateTo() { return ['sre-team']; }
  format(signal) {
    return `[P2 MEDIUM] Queue backup on ${signal.componentId}: ${signal.message}`;
  }
}

class NoSQLAlertStrategy {
  get priority() { return 'P1'; }
  get label() { return '🟠 HIGH'; }
  get escalateTo() { return ['db-team', 'oncall-engineer']; }
  format(signal) {
    return `[P1 HIGH] NoSQL failure on ${signal.componentId}: ${signal.message}`;
  }
}

class MCPAlertStrategy {
  get priority() { return 'P1'; }
  get label() { return '🟠 HIGH'; }
  get escalateTo() { return ['platform-team']; }
  format(signal) {
    return `[P1 HIGH] MCP Host failure on ${signal.componentId}: ${signal.message}`;
  }
}

class DefaultAlertStrategy {
  get priority() { return 'P3'; }
  get label() { return '🔵 LOW'; }
  get escalateTo() { return ['sre-team']; }
  format(signal) {
    return `[P3 LOW] Issue on ${signal.componentId}: ${signal.message}`;
  }
}

const STRATEGY_MAP = {
  RDBMS: new RDBMSAlertStrategy(),
  API: new APIAlertStrategy(),
  CACHE: new CacheAlertStrategy(),
  QUEUE: new QueueAlertStrategy(),
  NOSQL: new NoSQLAlertStrategy(),
  MCP: new MCPAlertStrategy(),
};

export function getAlertStrategy(componentType) {
  const type = (componentType || '').toUpperCase();
  for (const [key, strategy] of Object.entries(STRATEGY_MAP)) {
    if (type.includes(key)) return strategy;
  }
  return new DefaultAlertStrategy();
}
