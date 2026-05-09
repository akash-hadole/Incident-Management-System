/**
 * Alerting Strategy Pattern
 * Different component failures → different alert priorities & channels
 */

class RDBMSAlertStrategy {
  getPriority() { return 'P0'; }
  getAlertChannels() { return ['PAGERDUTY', 'SMS', 'EMAIL', 'SLACK']; }
  getEscalationTimeMinutes() { return 5; }
}

class APIAlertStrategy {
  getPriority(signal) {
    return signal.errorRate > 50 ? 'P1' : 'P2';
  }
  getAlertChannels() { return ['SLACK', 'EMAIL']; }
  getEscalationTimeMinutes() { return 15; }
}

class CacheAlertStrategy {
  getPriority() { return 'P2'; }
  getAlertChannels() { return ['SLACK']; }
  getEscalationTimeMinutes() { return 30; }
}

class AsyncQueueAlertStrategy {
  getPriority(signal) {
    return signal.queueDepth > 10000 ? 'P1' : 'P2';
  }
  getAlertChannels() { return ['SLACK', 'EMAIL']; }
  getEscalationTimeMinutes() { return 20; }
}

class NoSQLAlertStrategy {
  getPriority() { return 'P1'; }
  getAlertChannels() { return ['PAGERDUTY', 'SLACK']; }
  getEscalationTimeMinutes() { return 10; }
}

class MCPHostAlertStrategy {
  getPriority() { return 'P1'; }
  getAlertChannels() { return ['PAGERDUTY', 'SLACK', 'EMAIL']; }
  getEscalationTimeMinutes() { return 10; }
}

class DefaultAlertStrategy {
  getPriority() { return 'P3'; }
  getAlertChannels() { return ['EMAIL']; }
  getEscalationTimeMinutes() { return 60; }
}

export class AlertingStrategyFactory {
  static getStrategy(componentType) {
    const strategies = {
      RDBMS: new RDBMSAlertStrategy(),
      API: new APIAlertStrategy(),
      CACHE: new CacheAlertStrategy(),
      ASYNC_QUEUE: new AsyncQueueAlertStrategy(),
      NOSQL: new NoSQLAlertStrategy(),
      MCP_HOST: new MCPHostAlertStrategy(),
    };
    return strategies[componentType] || new DefaultAlertStrategy();
  }

  static getAllPriorities() {
    return ['P0', 'P1', 'P2', 'P3'];
  }
}
