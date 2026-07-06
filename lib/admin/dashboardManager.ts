/**
 * Admin Dashboard Manager
 * Centralized management for admin dashboard features and data
 */

export interface DashboardMetrics {
  totalUsers: number;
  totalDrivers: number;
  totalCustomers: number;
  activeTrips: number;
  completedTrips: number;
  platformRevenue: number;
  averageRating: number;
  systemHealth: number; // 0-100
}

export interface DashboardCard {
  id: string;
  title: string;
  value: string | number;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  icon?: string;
  color?: string;
}

export interface SystemAlert {
  id: string;
  type: 'error' | 'warning' | 'info' | 'success';
  title: string;
  message: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  component?: string;
  timestamp: Date;
  resolved: boolean;
}

export interface FeatureFlagToggle {
  id: string;
  key: string;
  name: string;
  enabled: boolean;
  rolloutPercentage: number;
  description?: string;
}

export class DashboardManager {
  private static instance: DashboardManager;
  private metrics: DashboardMetrics | null = null;
  private alerts: SystemAlert[] = [];
  private featureFlags: FeatureFlagToggle[] = [];
  private listeners: Set<(data: any) => void> = new Set();

  private constructor() {}

  static getInstance(): DashboardManager {
    if (!DashboardManager.instance) {
      DashboardManager.instance = new DashboardManager();
    }
    return DashboardManager.instance;
  }

  /**
   * Load dashboard metrics from backend
   */
  async loadMetrics(): Promise<DashboardMetrics> {
    try {
      // TODO: Fetch from backend API
      const response = await fetch('/api/admin/metrics');
      const data = await response.json();
      this.metrics = data;
      this.notifyListeners();
      return data;
    } catch (error) {
      console.error('Failed to load metrics:', error);
      return this.getDefaultMetrics();
    }
  }

  /**
   * Get dashboard cards for display
   */
  getDashboardCards(): DashboardCard[] {
    if (!this.metrics) {
      return [];
    }

    return [
      {
        id: 'total-users',
        title: 'Total Users',
        value: this.metrics.totalUsers,
        change: 12,
        changeType: 'increase',
        icon: 'people',
        color: 'blue',
      },
      {
        id: 'active-drivers',
        title: 'Active Drivers',
        value: this.metrics.totalDrivers,
        change: 8,
        changeType: 'increase',
        icon: 'directions-car',
        color: 'green',
      },
      {
        id: 'active-trips',
        title: 'Active Trips',
        value: this.metrics.activeTrips,
        change: -5,
        changeType: 'decrease',
        icon: 'timeline',
        color: 'orange',
      },
      {
        id: 'platform-revenue',
        title: 'Platform Revenue',
        value: `$${this.metrics.platformRevenue.toFixed(2)}`,
        change: 25,
        changeType: 'increase',
        icon: 'paid',
        color: 'purple',
      },
      {
        id: 'avg-rating',
        title: 'Average Rating',
        value: this.metrics.averageRating.toFixed(2),
        change: 0,
        changeType: 'neutral',
        icon: 'star',
        color: 'yellow',
      },
      {
        id: 'system-health',
        title: 'System Health',
        value: `${this.metrics.systemHealth}%`,
        change: 0,
        changeType: 'neutral',
        icon: 'favorite',
        color: 'red',
      },
    ];
  }

  /**
   * Load system alerts
   */
  async loadAlerts(): Promise<SystemAlert[]> {
    try {
      // TODO: Fetch from backend API
      const response = await fetch('/api/admin/alerts');
      const data = await response.json();
      this.alerts = data;
      this.notifyListeners();
      return data;
    } catch (error) {
      console.error('Failed to load alerts:', error);
      return [];
    }
  }

  /**
   * Get active (unresolved) alerts
   */
  getActiveAlerts(): SystemAlert[] {
    return this.alerts.filter((alert) => !alert.resolved);
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId: string): Promise<void> {
    try {
      await fetch(`/api/admin/alerts/${alertId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved: true }),
      });

      const alert = this.alerts.find((a) => a.id === alertId);
      if (alert) {
        alert.resolved = true;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
      throw error;
    }
  }

  /**
   * Load feature flags
   */
  async loadFeatureFlags(): Promise<FeatureFlagToggle[]> {
    try {
      // TODO: Fetch from backend API
      const response = await fetch('/api/admin/feature-flags');
      const data = await response.json();
      this.featureFlags = data;
      this.notifyListeners();
      return data;
    } catch (error) {
      console.error('Failed to load feature flags:', error);
      return [];
    }
  }

  /**
   * Toggle feature flag
   */
  async toggleFeatureFlag(flagId: string, enabled: boolean): Promise<void> {
    try {
      await fetch(`/api/admin/feature-flags/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      });

      const flag = this.featureFlags.find((f) => f.id === flagId);
      if (flag) {
        flag.enabled = enabled;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Failed to toggle feature flag:', error);
      throw error;
    }
  }

  /**
   * Update feature flag rollout percentage
   */
  async updateFlagRollout(flagId: string, percentage: number): Promise<void> {
    if (percentage < 0 || percentage > 100) {
      throw new Error('Rollout percentage must be between 0 and 100');
    }

    try {
      await fetch(`/api/admin/feature-flags/${flagId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rolloutPercentage: percentage }),
      });

      const flag = this.featureFlags.find((f) => f.id === flagId);
      if (flag) {
        flag.rolloutPercentage = percentage;
        this.notifyListeners();
      }
    } catch (error) {
      console.error('Failed to update flag rollout:', error);
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics(): DashboardMetrics | null {
    return this.metrics;
  }

  /**
   * Get alerts
   */
  getAlerts(): SystemAlert[] {
    return this.alerts;
  }

  /**
   * Get feature flags
   */
  getFeatureFlags(): FeatureFlagToggle[] {
    return this.featureFlags;
  }

  /**
   * Subscribe to dashboard updates
   */
  onChange(callback: (data: any) => void): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => {
      listener({
        metrics: this.metrics,
        alerts: this.alerts,
        featureFlags: this.featureFlags,
      });
    });
  }

  private getDefaultMetrics(): DashboardMetrics {
    return {
      totalUsers: 0,
      totalDrivers: 0,
      totalCustomers: 0,
      activeTrips: 0,
      completedTrips: 0,
      platformRevenue: 0,
      averageRating: 0,
      systemHealth: 100,
    };
  }
}

export const dashboardManager = DashboardManager.getInstance();
