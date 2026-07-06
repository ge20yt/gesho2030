/**
 * Audit Service
 * Comprehensive audit logging and monitoring system
 */

import type { AuditLog } from '@/lib/database/schema';

export enum AuditAction {
  // Auth
  LOGIN = 'LOGIN',
  LOGOUT = 'LOGOUT',
  SIGNUP = 'SIGNUP',
  PASSWORD_CHANGE = 'PASSWORD_CHANGE',
  PASSWORD_RESET = 'PASSWORD_RESET',
  TWO_FA_ENABLE = 'TWO_FA_ENABLE',
  TWO_FA_DISABLE = 'TWO_FA_DISABLE',

  // Trip
  TRIP_CREATED = 'TRIP_CREATED',
  TRIP_ACCEPTED = 'TRIP_ACCEPTED',
  TRIP_STARTED = 'TRIP_STARTED',
  TRIP_COMPLETED = 'TRIP_COMPLETED',
  TRIP_CANCELLED = 'TRIP_CANCELLED',

  // Wallet
  WALLET_FUNDED = 'WALLET_FUNDED',
  WALLET_WITHDRAWAL = 'WALLET_WITHDRAWAL',
  COMMISSION_APPLIED = 'COMMISSION_APPLIED',

  // Admin
  USER_CREATED = 'USER_CREATED',
  USER_UPDATED = 'USER_UPDATED',
  USER_DELETED = 'USER_DELETED',
  USER_SUSPENDED = 'USER_SUSPENDED',
  ROLE_CHANGED = 'ROLE_CHANGED',
  SETTING_CHANGED = 'SETTING_CHANGED',

  // System
  FEATURE_FLAG_CHANGED = 'FEATURE_FLAG_CHANGED',
  SYSTEM_CONFIG_CHANGED = 'SYSTEM_CONFIG_CHANGED',
}

export interface AuditEntry {
  action: AuditAction;
  resource: string;
  resourceId: string;
  userId: string;
  changes?: Record<string, any>;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
}

export interface AuditFilter {
  userId?: string;
  action?: AuditAction;
  resource?: string;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  status?: 'success' | 'failure';
}

export class AuditService {
  private supabase: any;
  private queue: AuditEntry[] = [];
  private readonly BATCH_SIZE = 10;
  private readonly BATCH_TIMEOUT = 5000; // 5 seconds
  private flushTimer: any;

  constructor(supabaseClient: any) {
    this.supabase = supabaseClient;
    this.startBatchFlusher();
  }

  /**
   * Log an action
   */
  async log(entry: AuditEntry): Promise<void> {
    try {
      this.queue.push(entry);

      // Flush if batch size reached
      if (this.queue.length >= this.BATCH_SIZE) {
        await this.flush();
      }
    } catch (error) {
      console.error('Audit log error:', error);
      // Don't throw - audit failures should not break main operations
    }
  }

  /**
   * Log with common parameters
   */
  async logAction(
    action: AuditAction,
    resource: string,
    resourceId: string,
    userId: string,
    changes?: Record<string, any>,
    metadata?: Record<string, any>
  ): Promise<void> {
    const entry: AuditEntry = {
      action,
      resource,
      resourceId,
      userId,
      changes,
      metadata,
      status: 'success',
    };

    await this.log(entry);
  }

  /**
   * Flush queued logs
   */
  private async flush(): Promise<void> {
    if (this.queue.length === 0) {
      return;
    }

    const batch = this.queue.splice(0, this.BATCH_SIZE);

    try {
      const { error } = await this.supabase.from('audit_logs').insert(
        batch.map((entry) => ({
          action: entry.action,
          resource: entry.resource,
          resource_id: entry.resourceId,
          user_id: entry.userId,
          changes: entry.changes,
          metadata: entry.metadata,
          ip_address: entry.ipAddress,
          user_agent: entry.userAgent,
          status: entry.status,
          error_message: entry.errorMessage,
          created_at: new Date(),
        }))
      );

      if (error) {
        console.error('Batch flush error:', error);
        // Re-queue if failed
        this.queue.unshift(...batch);
      }
    } catch (error) {
      console.error('Audit flush error:', error);
      this.queue.unshift(...batch);
    }
  }

  /**
   * Start batch flusher timer
   */
  private startBatchFlusher(): void {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error('Periodic flush error:', error);
      });
    }, this.BATCH_TIMEOUT);
  }

  /**
   * Get audit logs
   */
  async getLogs(filter: AuditFilter = {}, limit: number = 100, offset: number = 0): Promise<AuditLog[]> {
    try {
      let query = this.supabase.from('audit_logs').select('*');

      if (filter.userId) {
        query = query.eq('user_id', filter.userId);
      }
      if (filter.action) {
        query = query.eq('action', filter.action);
      }
      if (filter.resource) {
        query = query.eq('resource', filter.resource);
      }
      if (filter.resourceId) {
        query = query.eq('resource_id', filter.resourceId);
      }
      if (filter.status) {
        query = query.eq('status', filter.status);
      }
      if (filter.startDate) {
        query = query.gte('created_at', filter.startDate.toISOString());
      }
      if (filter.endDate) {
        query = query.lte('created_at', filter.endDate.toISOString());
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Failed to fetch audit logs:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Audit log fetch error:', error);
      return [];
    }
  }

  /**
   * Get user activity report
   */
  async getUserActivityReport(
    userId: string,
    startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate: Date = new Date()
  ): Promise<any> {
    try {
      const logs = await this.getLogs(
        {
          userId,
          startDate,
          endDate,
        },
        1000
      );

      // Group by action
      const actionCounts: Record<string, number> = {};
      const successRate: Record<string, { success: number; failure: number }> = {};

      for (const log of logs) {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;

        if (!successRate[log.action]) {
          successRate[log.action] = { success: 0, failure: 0 };
        }

        if (log.status === 'success') {
          successRate[log.action].success++;
        } else {
          successRate[log.action].failure++;
        }
      }

      return {
        userId,
        period: { startDate, endDate },
        totalActions: logs.length,
        actionBreakdown: actionCounts,
        successRates: successRate,
        lastActivity: logs[0]?.createdAt,
      };
    } catch (error) {
      console.error('User activity report error:', error);
      throw error;
    }
  }

  /**
   * Get system activity report
   */
  async getSystemActivityReport(startDate: Date = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)): Promise<any> {
    try {
      const logs = await this.getLogs(
        {
          startDate,
        },
        10000
      );

      const actionCounts: Record<string, number> = {};
      const failureCount: Record<string, number> = {};
      const userActivityCount: Record<string, number> = {};

      for (const log of logs) {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;

        if (log.status === 'failure') {
          failureCount[log.action] = (failureCount[log.action] || 0) + 1;
        }

        userActivityCount[log.userId] = (userActivityCount[log.userId] || 0) + 1;
      }

      return {
        period: { startDate },
        totalEvents: logs.length,
        uniqueUsers: Object.keys(userActivityCount).length,
        actionBreakdown: actionCounts,
        failureBreakdown: failureCount,
        topUsers: Object.entries(userActivityCount)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10),
      };
    } catch (error) {
      console.error('System activity report error:', error);
      throw error;
    }
  }

  /**
   * Detect suspicious activity
   */
  async detectSuspiciousActivity(userId: string, timeWindow: number = 3600000): Promise<string[]> {
    // 1 hour default
    try {
      const startDate = new Date(Date.now() - timeWindow);
      const logs = await this.getLogs(
        {
          userId,
          startDate,
        },
        100
      );

      const suspiciousPatterns: string[] = [];

      // Multiple failed login attempts
      const failedLogins = logs.filter((l) => l.action === AuditAction.LOGIN && l.status === 'failure');
      if (failedLogins.length >= 5) {
        suspiciousPatterns.push('Multiple failed login attempts');
      }

      // Multiple password changes
      const passwordChanges = logs.filter((l) => l.action === AuditAction.PASSWORD_CHANGE);
      if (passwordChanges.length >= 3) {
        suspiciousPatterns.push('Multiple password changes');
      }

      // Rapid API calls
      if (logs.length >= 100) {
        suspiciousPatterns.push('Unusual activity frequency');
      }

      // Multiple resource accesses
      const uniqueResources = new Set(logs.map((l) => l.resource));
      if (uniqueResources.size >= 20) {
        suspiciousPatterns.push('Access to many resources');
      }

      return suspiciousPatterns;
    } catch (error) {
      console.error('Suspicious activity detection error:', error);
      return [];
    }
  }

  /**
   * Stop the audit service
   */
  destroy(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
    }
    // Final flush before shutdown
    this.flush().catch(() => {
      // Ignore errors on shutdown
    });
  }
}

export const createAuditService = (supabaseClient: any) => {
  return new AuditService(supabaseClient);
};
