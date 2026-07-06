/**
 * Admin Dashboard Page
 * Central control center for platform administrators
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
  Card,
} from 'react-native';
import { platformInitializer } from '@/lib/platform/appInitializer';
import { dashboardManager } from '@/lib/admin/dashboardManager';
import { authProvider } from '@/lib/auth/authProvider';
import type { DashboardCard, SystemAlert, FeatureFlagToggle } from '@/lib/admin/dashboardManager';

export default function AdminDashboard() {
  const [dashboardCards, setDashboardCards] = useState<DashboardCard[]>([]);
  const [alerts, setAlerts] = useState<SystemAlert[]>([]);
  const [featureFlags, setFeatureFlags] = useState<FeatureFlagToggle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check authorization
  useEffect(() => {
    const session = authProvider.getSession();
    if (!session || !session.roles.some((r) => r.includes('admin'))) {
      setError('Unauthorized: Admin access required');
    }
  }, []);

  // Load dashboard data
  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setIsLoading(true);

      // Load metrics
      await dashboardManager.loadMetrics();
      setDashboardCards(dashboardManager.getDashboardCards());

      // Load alerts
      await dashboardManager.loadAlerts();
      setAlerts(dashboardManager.getActiveAlerts());

      // Load feature flags
      await dashboardManager.loadFeatureFlags();
      setFeatureFlags(dashboardManager.getFeatureFlags());

      // Subscribe to updates
      const unsubscribe = dashboardManager.onChange((data) => {
        if (data.metrics) {
          setDashboardCards(dashboardManager.getDashboardCards());
        }
        if (data.alerts) {
          setAlerts(dashboardManager.getActiveAlerts());
        }
        if (data.featureFlags) {
          setFeatureFlags(data.featureFlags);
        }
      });

      return () => unsubscribe?.();
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError('Failed to load dashboard data');
    } finally {
      setIsLoading(false);
    }
  };

  if (error) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      </View>
    );
  }

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Platform Control Center</Text>
        <Text style={styles.headerSubtitle}>Central Dashboard</Text>
      </View>

      {/* Metrics Cards Grid */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Key Metrics</Text>
        <View style={styles.cardsGrid}>
          {dashboardCards.map((card) => (
            <MetricCard key={card.id} card={card} />
          ))}
        </View>
      </View>

      {/* System Alerts */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>System Alerts</Text>
          <Text style={styles.alertCount}>{alerts.length}</Text>
        </View>

        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No active alerts</Text>
          </View>
        ) : (
          alerts.map((alert) => (
            <AlertItem
              key={alert.id}
              alert={alert}
              onResolve={() => dashboardManager.resolveAlert(alert.id)}
            />
          ))
        )}
      </View>

      {/* Feature Flags */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Feature Flags</Text>

        {featureFlags.map((flag) => (
          <FeatureFlagItem
            key={flag.id}
            flag={flag}
            onToggle={(enabled) => dashboardManager.toggleFeatureFlag(flag.id, enabled)}
            onRolloutChange={(percentage) => dashboardManager.updateFlagRollout(flag.id, percentage)}
          />
        ))}
      </View>

      {/* Quick Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actionGrid}>
          <ActionButton title="View Users" icon="👥" />
          <ActionButton title="View Reports" icon="📊" />
          <ActionButton title="System Logs" icon="📝" />
          <ActionButton title="Settings" icon="⚙️" />
        </View>
      </View>
    </ScrollView>
  );
}

interface MetricCardProps {
  card: DashboardCard;
}

const MetricCard: React.FC<MetricCardProps> = ({ card }) => {
  const changeColor = card.changeType === 'increase' ? '#00aa00' : card.changeType === 'decrease' ? '#cc0000' : '#999';

  return (
    <View style={[styles.card, { borderLeftColor: card.color || '#0066cc' }]}>
      <Text style={styles.cardTitle}>{card.title}</Text>
      <Text style={styles.cardValue}>{card.value}</Text>
      {card.change !== undefined && (
        <Text style={[styles.cardChange, { color: changeColor }]}>
          {card.change > 0 ? '+' : ''}{card.change}%
        </Text>
      )}
    </View>
  );
};

interface AlertItemProps {
  alert: SystemAlert;
  onResolve: () => Promise<void>;
}

const AlertItem: React.FC<AlertItemProps> = ({ alert, onResolve }) => {
  const [isResolving, setIsResolving] = useState(false);

  const handleResolve = async () => {
    try {
      setIsResolving(true);
      await onResolve();
    } finally {
      setIsResolving(false);
    }
  };

  const severityColor = {
    critical: '#ff0000',
    high: '#ff6600',
    medium: '#ffaa00',
    low: '#00aa00',
  }[alert.severity];

  return (
    <View style={[styles.alertItem, { borderLeftColor: severityColor }]}>
      <View style={styles.alertContent}>
        <Text style={styles.alertTitle}>{alert.title}</Text>
        <Text style={styles.alertMessage}>{alert.message}</Text>
        <Text style={styles.alertTime}>
          {new Date(alert.timestamp).toLocaleString()}
        </Text>
      </View>
      <TouchableOpacity
        style={styles.resolveButton}
        onPress={handleResolve}
        disabled={isResolving}
      >
        {isResolving ? (
          <ActivityIndicator size="small" color="#0066cc" />
        ) : (
          <Text style={styles.resolveButtonText}>Resolve</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

interface FeatureFlagItemProps {
  flag: FeatureFlagToggle;
  onToggle: (enabled: boolean) => Promise<void>;
  onRolloutChange: (percentage: number) => Promise<void>;
}

const FeatureFlagItem: React.FC<FeatureFlagItemProps> = ({ flag, onToggle, onRolloutChange }) => {
  const [isToggling, setIsToggling] = useState(false);

  const handleToggle = async () => {
    try {
      setIsToggling(true);
      await onToggle(!flag.enabled);
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <View style={styles.flagItem}>
      <View style={styles.flagContent}>
        <Text style={styles.flagName}>{flag.name}</Text>
        {flag.description && (
          <Text style={styles.flagDescription}>{flag.description}</Text>
        )}
        <View style={styles.flagRollout}>
          <Text style={styles.rolloutLabel}>Rollout: {flag.rolloutPercentage}%</Text>
        </View>
      </View>
      <TouchableOpacity
        style={[styles.toggleButton, flag.enabled ? styles.toggleOn : styles.toggleOff]}
        onPress={handleToggle}
        disabled={isToggling}
      >
        {isToggling ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={styles.toggleText}>{flag.enabled ? 'ON' : 'OFF'}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
};

interface ActionButtonProps {
  title: string;
  icon: string;
}

const ActionButton: React.FC<ActionButtonProps> = ({ title, icon }) => {
  return (
    <TouchableOpacity style={styles.actionButton}>
      <Text style={styles.actionIcon}>{icon}</Text>
      <Text style={styles.actionTitle}>{title}</Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    marginBottom: 24,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  alertCount: {
    backgroundColor: '#ff0000',
    color: '#fff',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: 'bold',
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  card: {
    flex: 1,
    minWidth: 150,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    borderLeftWidth: 4,
    marginBottom: 8,
  },
  cardTitle: {
    fontSize: 12,
    color: '#999',
    marginBottom: 8,
  },
  cardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  cardChange: {
    fontSize: 12,
    marginTop: 4,
    fontWeight: '600',
  },
  alertItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  alertMessage: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  alertTime: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
  },
  resolveButton: {
    backgroundColor: '#0066cc',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 12,
  },
  resolveButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  flagItem: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  flagContent: {
    flex: 1,
  },
  flagName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  flagDescription: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  flagRollout: {
    marginTop: 8,
  },
  rolloutLabel: {
    fontSize: 12,
    color: '#999',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 4,
    marginLeft: 12,
  },
  toggleOn: {
    backgroundColor: '#00aa00',
  },
  toggleOff: {
    backgroundColor: '#ccc',
  },
  toggleText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    minWidth: 140,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  actionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    textAlign: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#cc0000',
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 32,
    backgroundColor: '#ffffff',
    borderRadius: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});
