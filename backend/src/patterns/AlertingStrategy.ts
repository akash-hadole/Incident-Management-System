// Strategy Pattern for Alerting
export interface AlertStrategy {
  send(recipient: string, message: string, severity: string): Promise<void>;
}

export class EmailAlertStrategy implements AlertStrategy {
  async send(recipient: string, message: string, severity: string): Promise<void> {
    console.log(`[EMAIL] To: ${recipient}, Severity: ${severity}`);
    console.log(`Message: ${message}`);
    // TODO: Implement actual email sending
  }
}

export class SlackAlertStrategy implements AlertStrategy {
  async send(recipient: string, message: string, severity: string): Promise<void> {
    console.log(`[SLACK] Channel: ${recipient}, Severity: ${severity}`);
    console.log(`Message: ${message}`);
    // TODO: Implement actual Slack integration
  }
}

export class PagerDutyAlertStrategy implements AlertStrategy {
  async send(recipient: string, message: string, severity: string): Promise<void> {
    console.log(`[PAGERDUTY] Escalation: ${recipient}, Severity: ${severity}`);
    console.log(`Message: ${message}`);
    // TODO: Implement actual PagerDuty integration
  }
}

export class AlertFactory {
  static getAlertStrategy(componentType: string): AlertStrategy {
    switch (componentType) {
      case 'DATABASE':
      case 'API':
        return new PagerDutyAlertStrategy(); // P0/P1 - immediate escalation
      case 'CACHE':
      case 'QUEUE':
        return new SlackAlertStrategy(); // P2 - notify team
      default:
        return new EmailAlertStrategy(); // P3 - email summary
    }
  }
}
