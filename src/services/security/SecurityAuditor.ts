import { WebhookEvent, webhookHandler } from '../webhook/WebhookHandler';

/**
 * Security event types
 */
export enum SecurityEventType {
  AUTHENTICATION_SUCCESS = 'AUTHENTICATION_SUCCESS',
  AUTHENTICATION_FAILURE = 'AUTHENTICATION_FAILURE',
  TOKEN_REFRESHED = 'TOKEN_REFRESHED',
  TOKEN_ROTATED = 'TOKEN_ROTATED',
  TOKEN_REFRESH_FAILED = 'TOKEN_REFRESH_FAILED',
  TOKEN_ROTATION_FAILED = 'TOKEN_ROTATION_FAILED',
  TOKEN_ROTATION_ERROR = 'TOKEN_ROTATION_ERROR',
  PKCE_VALIDATION_FAILED = 'PKCE_VALIDATION_FAILED',
  ENCRYPTION_ERROR = 'ENCRYPTION_ERROR',
  DECRYPTION_ERROR = 'DECRYPTION_ERROR',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SUSPICIOUS_ACTIVITY = 'SUSPICIOUS_ACTIVITY',
  SECURITY_VIOLATION = 'SECURITY_VIOLATION',
  ACCESS_DENIED = 'ACCESS_DENIED'
}

/**
 * Security event log entry
 */
export interface SecurityEvent {
  id: string;
  eventType: SecurityEventType;
  timestamp: Date;
  userId?: string;
  providerId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: Record<string, any>;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

/**
 * Security audit configuration
 */
interface SecurityAuditConfig {
  // Enable/disable security auditing
  enabled: boolean;
  // Log level threshold
  logLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  // Retention period for logs (in days)
  retentionDays: number;
  // Enable webhook notifications for critical events
  webhookNotifications: boolean;
}

/**
 * Security Auditor - Audit security events and log suspicious activities
 * 
 * This class handles security event logging, monitoring, and reporting.
 */
export class SecurityAuditor {
  private static instance: SecurityAuditor;
  private config: SecurityAuditConfig;
  private eventBuffer: SecurityEvent[];
  private bufferFlushTimer: NodeJS.Timeout | null;

  private constructor() {
    this.config = {
      enabled: true,
      logLevel: 'MEDIUM',
      retentionDays: 30,
      webhookNotifications: true
    };
    this.eventBuffer = [];
    this.bufferFlushTimer = null;
    
    // Schedule periodic buffer flush
    this.scheduleBufferFlush();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SecurityAuditor {
    if (!SecurityAuditor.instance) {
      SecurityAuditor.instance = new SecurityAuditor();
    }
    return SecurityAuditor.instance;
  }

  /**
   * Configure security audit settings
   */
  configure(config: Partial<SecurityAuditConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Log a security event
   */
  async logSecurityEvent(
    eventType: SecurityEventType,
    details?: Record<string, any>,
    userId?: string,
    providerId?: string
  ): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    const event: SecurityEvent = {
      id: this.generateEventId(),
      eventType,
      timestamp: new Date(),
      userId,
      providerId,
      ipAddress: this.getClientIP(),
      userAgent: this.getUserAgent(),
      details,
      severity: this.determineSeverity(eventType)
    };

    // Add to buffer
    this.eventBuffer.push(event);

    // Log to console for development
    console.log(`[SECURITY] ${eventType}:`, {
      userId,
      providerId,
      severity: event.severity,
      details
    });

    // Send webhook notification for critical events
    if (this.config.webhookNotifications && event.severity === 'CRITICAL') {
      await this.sendWebhookNotification(event);
    }

    // Flush buffer if it's getting large
    if (this.eventBuffer.length >= 50) {
      await this.flushEventBuffer();
    }
  }

  /**
   * Generate unique event ID
   */
  private generateEventId(): string {
    return 'evt_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Get client IP address (simplified implementation)
   */
  private getClientIP(): string | undefined {
    // In a real implementation, this would come from request headers
    // For now, we'll return undefined as we're in a client-side context
    return undefined;
  }

  /**
   * Get user agent
   */
  private getUserAgent(): string | undefined {
    if (typeof navigator !== 'undefined') {
      return navigator.userAgent;
    }
    return undefined;
  }

  /**
   * Determine event severity
   */
  private determineSeverity(eventType: SecurityEventType): SecurityEvent['severity'] {
    switch (eventType) {
      case SecurityEventType.AUTHENTICATION_FAILURE:
      case SecurityEventType.PKCE_VALIDATION_FAILED:
      case SecurityEventType.RATE_LIMIT_EXCEEDED:
        return 'HIGH';
      
      case SecurityEventType.TOKEN_REFRESH_FAILED:
      case SecurityEventType.TOKEN_ROTATION_FAILED:
      case SecurityEventType.ENCRYPTION_ERROR:
      case SecurityEventType.DECRYPTION_ERROR:
        return 'MEDIUM';
      
      case SecurityEventType.SUSPICIOUS_ACTIVITY:
      case SecurityEventType.SECURITY_VIOLATION:
      case SecurityEventType.ACCESS_DENIED:
        return 'CRITICAL';
      
      default:
        return 'LOW';
    }
  }

  /**
   * Send webhook notification for critical events
   */
  private async sendWebhookNotification(event: SecurityEvent): Promise<void> {
    try {
      // Use the webhook handler to process security events
      await webhookHandler.handleWebhook(
        'security',
        'security.alert',
        {
          securityEvent: event
        }
      );
    } catch (error) {
      console.error('Failed to send security webhook notification:', error);
    }
  }

  /**
   * Schedule periodic buffer flush
   */
  private scheduleBufferFlush(): void {
    if (this.bufferFlushTimer) {
      clearTimeout(this.bufferFlushTimer);
    }

    this.bufferFlushTimer = setTimeout(async () => {
      try {
        await this.flushEventBuffer();
      } catch (error) {
        console.error('Failed to flush security event buffer:', error);
      } finally {
        // Schedule next flush
        this.scheduleBufferFlush();
      }
    }, 30000); // Flush every 30 seconds
  }

  /**
   * Flush event buffer to persistent storage
   */
  private async flushEventBuffer(): Promise<void> {
    if (this.eventBuffer.length === 0) {
      return;
    }

    // In a real implementation, this would save to a database
    // For now, we'll just clear the buffer and log the events
    console.log(`Flushing ${this.eventBuffer.length} security events to storage`);
    
    // Filter events based on log level
    const eventsToLog = this.eventBuffer.filter(event => {
      const severityLevels: Record<string, number> = {
        'LOW': 1,
        'MEDIUM': 2,
        'HIGH': 3,
        'CRITICAL': 4
      };
      
      return severityLevels[event.severity] >= severityLevels[this.config.logLevel];
    });

    // In a real implementation, you would save these events to a database
    // For now, we'll just clear the buffer
    this.eventBuffer = [];
  }

  /**
   * Get recent security events
   */
  getRecentEvents(limit: number = 50, userId?: string): SecurityEvent[] {
    // In a real implementation, this would query from a database
    // For now, we'll return from the buffer
    let events = [...this.eventBuffer].reverse(); // Most recent first
    
    if (userId) {
      events = events.filter(event => event.userId === userId);
    }
    
    return events.slice(0, limit);
  }

  /**
   * Get events by type
   */
  getEventsByType(eventType: SecurityEventType, limit: number = 50): SecurityEvent[] {
    // In a real implementation, this would query from a database
    // For now, we'll return from the buffer
    const events = [...this.eventBuffer]
      .filter(event => event.eventType === eventType)
      .reverse() // Most recent first
      
    return events.slice(0, limit);
  }

  /**
   * Detect suspicious activity patterns
   */
  async detectSuspiciousActivity(userId?: string): Promise<SecurityEvent[]> {
    // In a real implementation, this would analyze patterns in the events
    // For now, we'll just return critical events
    const criticalEvents = this.eventBuffer.filter(
      event => event.severity === 'CRITICAL' || event.severity === 'HIGH'
    );
    
    if (userId) {
      return criticalEvents.filter(event => event.userId === userId);
    }
    
    return criticalEvents;
  }

  /**
   * Clean up old events based on retention policy
   */
  async cleanupOldEvents(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);
    
    const initialCount = this.eventBuffer.length;
    this.eventBuffer = this.eventBuffer.filter(
      event => event.timestamp >= cutoffDate
    );
    
    return initialCount - this.eventBuffer.length;
  }

  /**
   * Export security events (for compliance/auditing)
   */
  exportEvents(format: 'json' | 'csv' = 'json', userId?: string): string {
    let events = [...this.eventBuffer];
    
    if (userId) {
      events = events.filter(event => event.userId === userId);
    }
    
    if (format === 'json') {
      return JSON.stringify(events, null, 2);
    } else {
      // Simple CSV export
      const headers = ['id', 'eventType', 'timestamp', 'userId', 'providerId', 'severity'];
      const csvRows = events.map(event => [
        event.id,
        event.eventType,
        event.timestamp.toISOString(),
        event.userId || '',
        event.providerId || '',
        event.severity
      ]);
      
      return [headers.join(','), ...csvRows.map(row => row.join(','))].join('\n');
    }
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.bufferFlushTimer) {
      clearTimeout(this.bufferFlushTimer);
      this.bufferFlushTimer = null;
    }
    
    await this.flushEventBuffer();
  }
}

// Export singleton instance
export const securityAuditor = SecurityAuditor.getInstance();