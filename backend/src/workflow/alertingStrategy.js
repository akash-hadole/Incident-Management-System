/**
 * Alerting Strategy Pattern
 * Different component types trigger different alert priorities
 */

const PRIORITY_MAP = {
  RDBMS:         { level: 'P0', label: 'Critical',  color: '#FF2D55', emoji: '🔴' },
  API:           { level: 'P1', label: 'High',      color: '#FF9500', emoji: '🟠' },
  MCP_HOST:      { level: 'P1', label: 'High',      color: '#FF9500', emoji: '🟠' },
  ASYNC_QUEUE:   { level: 'P2', label: 'Medium',    color: '#FFCC00', emoji: '🟡' },
  NOSQL:         { level: 'P2', label: 'Medium',    color: '#FFCC00', emoji: '🟡' },
  CACHE_CLUSTER: { level: 'P2', label: 'Medium',    color: '#FFCC00', emoji: '🟡' },
  DEFAULT:       { level: 'P3', label: 'Low',       color: '#34C759', emoji: '🟢' },
};

class AlertStrategy {
  constructor(componentType) {
    const key = Object.keys(PRIORITY_MAP).find(k => componentType?.toUpperCase().startsWith(k));
    this.priority = PRIORITY_MAP[key] || PRIORITY_MAP.DEFAULT;
    this.componentType = componentType;
  }

  getAlert(signal) {
    return {
      priority: this.priority.level,
      label:    this.priority.label,
      color:    this.priority.color,
      emoji:    this.priority.emoji,
      message:  `[${this.priority.level}] ${this.componentType} failure detected: ${signal.errorCode || 'UNKNOWN_ERROR'}`,
      timestamp: new Date().toISOString(),
    };
  }

  getPriority() { return this.priority; }
}

// Strategy factory
function createAlertStrategy(componentId) {
  const type = componentId?.split('_').slice(0, -1).join('_') || 'DEFAULT';
  return new AlertStrategy(type);
}

module.exports = { AlertStrategy, createAlertStrategy, PRIORITY_MAP };
