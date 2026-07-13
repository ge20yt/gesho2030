import { useCallback, useEffect, useState } from 'react';
import { DashboardManager } from '../lib/admin/dashboardManager';
import type { DashboardMetrics, Alert, SystemStatus } from '../lib/database/schema';

interface DashboardState {
  metrics: DashboardMetrics | null;
  alerts: Alert[];
  systemStatus: SystemStatus | null;
  isLoading: boolean;
  error: string | null;
}

export const useDashboard = (tenantId: string | null) => {
  const [state, setState] = useState<DashboardState>({
    metrics: null,
    alerts: [],
    systemStatus: null,
    isLoading: true,
    error: null,
  });

  const dashboardManager = new DashboardManager();

  const fetchMetrics = useCallback(async () => {
    if (!tenantId) {
      setState(prev => ({ ...prev, isLoading: false }));
      return;
    }

    setState(prev => ({ ...prev, isLoading: true, error: null }));
    try {
      const metrics = await dashboardManager.getMetrics(tenantId);
      setState(prev => ({ ...prev, metrics, isLoading: false }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch metrics';
      setState(prev => ({ ...prev, error: message, isLoading: false }));
    }
  }, [tenantId]);

  const fetchAlerts = useCallback(async () => {
    if (!tenantId) return;

    try {
      const alerts = await dashboardManager.getAlerts(tenantId);
      setState(prev => ({ ...prev, alerts }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch alerts';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [tenantId]);

  const fetchSystemStatus = useCallback(async () => {
    if (!tenantId) return;

    try {
      const systemStatus = await dashboardManager.getSystemStatus(tenantId);
      setState(prev => ({ ...prev, systemStatus }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch system status';
      setState(prev => ({ ...prev, error: message }));
    }
  }, [tenantId]);

  const dismissAlert = useCallback(async (alertId: string) => {
    try {
      await dashboardManager.dismissAlert(alertId);
      setState(prev => ({
        ...prev,
        alerts: prev.alerts.filter(a => a.id !== alertId),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to dismiss alert';
      setState(prev => ({ ...prev, error: message }));
    }
  }, []);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([fetchMetrics(), fetchAlerts(), fetchSystemStatus()]);
  }, [fetchMetrics, fetchAlerts, fetchSystemStatus]);

  const getMetricTrend = useCallback((metric: keyof DashboardMetrics): number => {
    if (!state.metrics) return 0;
    const value = state.metrics[metric];
    return typeof value === 'number' ? value : 0;
  }, [state.metrics]);

  const getAlertCount = useCallback((): number => {
    return state.alerts.length;
  }, [state.alerts]);

  const getCriticalAlerts = useCallback(() => {
    return state.alerts.filter(a => a.severity === 'critical');
  }, [state.alerts]);

  // Fetch on mount and set up polling
  useEffect(() => {
    refreshDashboard();
  }, [tenantId, refreshDashboard]);

  // Polling interval
  useEffect(() => {
    const interval = setInterval(() => {
      refreshDashboard();
    }, 60000); // Poll every minute

    return () => clearInterval(interval);
  }, [tenantId, refreshDashboard]);

  return {
    ...state,
    fetchMetrics,
    fetchAlerts,
    fetchSystemStatus,
    dismissAlert,
    refreshDashboard,
    getMetricTrend,
    getAlertCount,
    getCriticalAlerts,
  };
};
