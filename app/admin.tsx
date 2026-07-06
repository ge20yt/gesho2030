import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';

import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

const { width } = Dimensions.get('window');

// ── Cancellation Reason Chart ──────────────────────────────────
const CANCEL_REASON_LABELS: Record<string, string> = {
  driver_late:  'السائق تأخر',
  plan_changed: 'تغيير الخطة',
  wrong_order:  'خطأ في الطلب',
  found_other:  'وجدت وسيلة أخرى',
  other:        'سبب آخر',
};
const PIE_COLORS = [Colors.primary, Colors.error, Colors.success, Colors.accent, Colors.info ?? '#6366f1'];

interface CancelStat { reason: string; count: number; pct: number; color: string }

function CancellationChart({ data }: { data: CancelStat[] }) {
  const total = data.reduce((s, d) => s + d.count, 0);
  if (total === 0) return (
    <View style={pieStyles.empty}>
      <MaterialIcons name="pie-chart" size={44} color={Colors.borderLight} />
      <Text style={pieStyles.emptyText}>لا توجد بيانات إلغاء</Text>
    </View>
  );
  return (
    <View style={pieStyles.container}>
      <View style={pieStyles.barsArea}>
        {data.map(d => (
          <View key={d.reason} style={pieStyles.barRow}>
            <Text style={pieStyles.barCount}>{d.count}</Text>
            <View style={pieStyles.barTrack}>
              <View style={[pieStyles.barFill, { width: `${d.pct}%`, backgroundColor: d.color }]} />
            </View>
            <View style={pieStyles.barLabelWrap}>
              <View style={[pieStyles.colorDot, { backgroundColor: d.color }]} />
              <Text style={pieStyles.barLabel} numberOfLines={1}>{CANCEL_REASON_LABELS[d.reason] ?? d.reason}</Text>
            </View>
          </View>
        ))}
      </View>
      <View style={pieStyles.legendRow}>
        {data.map(d => (
          <View key={d.reason} style={pieStyles.legendItem}>
            <Text style={[pieStyles.legendPct, { color: d.color }]}>{d.pct.toFixed(0)}%</Text>
            <Text style={pieStyles.legendLabel} numberOfLines={1}>{(CANCEL_REASON_LABELS[d.reason] ?? d.reason).split(' ')[0]}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ── Real-time stats types ─────────────────────────────────────────
interface AdminStats {
  totalTrips: number;
  activeTrips: number;
  completedTrips: number;
  cancelledTrips: number;
  totalRevenue: number;
  activeDrivers: number;
  totalDrivers: number;
  pendingComplaints: number;
  totalUsers: number;
}

const NAV_ITEMS = [
  { icon: 'home',                  label: 'الرئيسية'     },
  { icon: 'people',                label: 'السائقين'     },
  { icon: 'directions-car',        label: 'الرحلات'      },
  { icon: 'report-problem',        label: 'الشكاوى'      },
  { icon: 'account-balance-wallet',label: 'المدفوعات'    },
  { icon: 'bar-chart',             label: 'التقارير'     },
  { icon: 'settings',              label: 'الإعدادات'    },
  { icon: 'exit-to-app',           label: 'تسجيل خروج'  },
];

type ReportPeriod = 'daily' | 'weekly' | 'monthly';

export default function AdminScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { logout } = useAuthContext();
  const { showAlert } = useAlert();

  const [activeNav,   setActiveNav]   = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);

  // ── Real complaints from Supabase ──────────────────────────────
  const [complaints, setComplaints]     = useState<any[]>([]);
  const [complaintsLoading, setComplaintsLoading] = useState(true);

  // ── Real stats from Supabase ────────────────────────────────────
  const [stats, setStats]           = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // ── Drivers list ────────────────────────────────────────────────
  const [drivers, setDrivers]       = useState<any[]>([]);
  const [driverStatuses, setDriverStatuses] = useState<Record<string, boolean>>({});

  // ── Cancellation stats ──────────────────────────────────────────
  const [cancelStats, setCancelStats]   = useState<CancelStat[]>([]);
  const [cancelLoading, setCancelLoading] = useState(true);

  // ── Detailed reports ────────────────────────────────────────────
  const [reportPeriod, setReportPeriod]   = useState<ReportPeriod>('daily');
  const [reportData, setReportData]       = useState<{ label: string; trips: number; revenue: number }[]>([]);
  const [reportLoading, setReportLoading] = useState(true);
  const [reportRevTotal, setReportRevTotal]     = useState(0);
  const [reportTripTotal, setReportTripTotal]   = useState(0);

  // ── Load main stats ─────────────────────────────────────────────
  // ── Load complaints ──────────────────────────────────────────
  const loadComplaints = useCallback(async () => {
    setComplaintsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('complaints')
        .select('id, reason, description, status, created_at, user_id, trip_id')
        .order('created_at', { ascending: false })
        .limit(20);
      if (data) {
        setComplaints(data);
        // Update pending complaints count in stats
        const pendingCount = data.filter(c => c.status === 'pending').length;
        setStats(prev => prev ? { ...prev, pendingComplaints: pendingCount } : prev);
      }
    } catch { /* silent */ }
    finally { setComplaintsLoading(false); }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();

      const [tripsRes, driversRes, usersRes] = await Promise.all([
        supabase.from('trips').select('status, price'),
        supabase.from('drivers').select('id, name, vehicle, avatar_url, rating, total_trips, is_online, is_active, plate, vehicle_type'),
        supabase.from('user_profiles').select('id', { count: 'exact', head: true }),
      ]);

      const tripsData  = tripsRes.data  ?? [];
      const driversData = driversRes.data ?? [];

      const totalTrips     = tripsData.length;
      const activeTrips    = tripsData.filter(t => t.status === 'active').length;
      const completedTrips = tripsData.filter(t => t.status === 'completed').length;
      const cancelledTrips = tripsData.filter(t => t.status === 'cancelled').length;
      const totalRevenue   = tripsData
        .filter(t => t.status === 'completed')
        .reduce((sum, t) => sum + Number(t.price), 0);
      const activeDrivers  = driversData.filter(d => d.is_online && d.is_active).length;
      const totalDrivers   = driversData.length;

      setStats({
        totalTrips,
        activeTrips,
        completedTrips,
        cancelledTrips,
        totalRevenue,
        activeDrivers,
        totalDrivers,
        pendingComplaints: complaints.filter(c => c.status === 'pending').length,
        totalUsers: usersRes.count ?? 0,
      });

      setDrivers(driversData);
      setDriverStatuses(Object.fromEntries(driversData.map(d => [d.id, d.is_active])));
    } catch { /* silent */ }
    finally { setStatsLoading(false); setRefreshing(false); }
  }, []);

  // ── Load cancellation stats ─────────────────────────────────────
  const loadCancelStats = useCallback(async () => {
    setCancelLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('trips')
        .select('cancellation_reason')
        .eq('status', 'cancelled')
        .not('cancellation_reason', 'is', null);

      if (!data || data.length === 0) return;
      const counts: Record<string, number> = {};
      for (const row of data) {
        const r = row.cancellation_reason as string;
        counts[r] = (counts[r] ?? 0) + 1;
      }
      const total = data.length;
      const result: CancelStat[] = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([reason, count], i) => ({
          reason, count, pct: (count / total) * 100,
          color: PIE_COLORS[i % PIE_COLORS.length],
        }));
      setCancelStats(result);
    } catch { /* silent */ }
    finally { setCancelLoading(false); }
  }, []);

  // ── Load detailed reports ───────────────────────────────────────
  const loadReports = useCallback(async () => {
    setReportLoading(true);
    try {
      const supabase = getSupabaseClient();
      const now = new Date();
      const buckets: { label: string; from: Date; to: Date }[] = [];

      if (reportPeriod === 'daily') {
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now); d.setDate(d.getDate() - i);
          const from = new Date(d); from.setHours(0, 0, 0, 0);
          const to   = new Date(d); to.setHours(23, 59, 59, 999);
          buckets.push({ label: d.toLocaleDateString('ar-EG', { weekday: 'short', day: 'numeric' }), from, to });
        }
      } else if (reportPeriod === 'weekly') {
        for (let i = 5; i >= 0; i--) {
          const from = new Date(now); from.setDate(from.getDate() - (i + 1) * 7); from.setHours(0, 0, 0, 0);
          const to   = new Date(now); to.setDate(to.getDate() - i * 7);           to.setHours(23, 59, 59, 999);
          buckets.push({ label: `أسبوع ${6 - i}`, from, to });
        }
      } else {
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now); d.setMonth(d.getMonth() - i);
          const from = new Date(d.getFullYear(), d.getMonth(), 1);
          const to   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
          buckets.push({ label: d.toLocaleDateString('ar-EG', { month: 'short' }), from, to });
        }
      }

      const results = await Promise.all(
        buckets.map(async b => {
          const { data } = await supabase.from('trips').select('price')
            .eq('status', 'completed')
            .gte('created_at', b.from.toISOString())
            .lte('created_at', b.to.toISOString());
          return {
            label: b.label,
            trips: data?.length ?? 0,
            revenue: data?.reduce((s, t) => s + Number(t.price), 0) ?? 0,
          };
        })
      );
      setReportData(results);
      setReportRevTotal(results.reduce((s, r) => s + r.revenue, 0));
      setReportTripTotal(results.reduce((s, r) => s + r.trips, 0));
    } catch { /* silent */ }
    finally { setReportLoading(false); }
  }, [reportPeriod]);

  useEffect(() => { loadStats(); loadCancelStats(); loadComplaints(); }, []);
  useEffect(() => { loadReports(); }, [loadReports]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadStats();
    loadCancelStats();
    loadReports();
    loadComplaints();
  };

  // ── Update complaint status ────────────────────────────────────
  const handleUpdateComplaintStatus = (id: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'pending' ? 'reviewed' : currentStatus === 'reviewed' ? 'resolved' : 'dismissed';
    const labels: Record<string, string> = { reviewed: 'تمت المراجعة', resolved: 'تم الحل', dismissed: 'مرفوضة' };
    showAlert(
      'تحديث الشكوى',
      `هل تريد تغيير حالة الشكوى إلى "${labels[nextStatus]}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تأكيد',
          onPress: async () => {
            setComplaints(prev => prev.map(c => c.id === id ? { ...c, status: nextStatus } : c));
            try {
              const supabase = getSupabaseClient();
              await supabase.from('complaints').update({ status: nextStatus, updated_at: new Date().toISOString() }).eq('id', id);
            } catch { /* silent */ }
          },
        },
      ]
    );
  };

  const toggleDriverStatus = (id: string, name: string, currentStatus: boolean) => {
    showAlert(
      currentStatus ? 'تعطيل الحساب' : 'تفعيل الحساب',
      `هل تريد ${currentStatus ? 'تعطيل' : 'تفعيل'} حساب السائق ${name}؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: currentStatus ? 'تعطيل' : 'تفعيل',
          style: currentStatus ? 'destructive' : 'default',
          onPress: async () => {
            setDriverStatuses(prev => ({ ...prev, [id]: !currentStatus }));
            try {
              const supabase = getSupabaseClient();
              await supabase.from('drivers').update({ is_active: !currentStatus }).eq('id', id);
            } catch { /* silent */ }
          },
        },
      ]
    );
  };

  const handleNavPress = (idx: number, label: string) => {
    setActiveNav(idx);
    if (label === 'تسجيل خروج') {
      showAlert('تسجيل الخروج', 'هل تريد الخروج من لوحة التحكم؟', [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'خروج', onPress: () => { logout(); router.replace('/'); } },
      ]);
    }
    setSidebarOpen(false);
  };

  // Stat cards from real data
  const statCards = stats ? [
    { label: 'إجمالي الرحلات',  value: stats.totalTrips.toLocaleString(),            icon: 'directions-car',         color: Colors.primary,  bg: Colors.primaryLight },
    { label: 'الإيرادات (ج.م)', value: `${(stats.totalRevenue / 1000).toFixed(1)}k`, icon: 'attach-money',           color: Colors.success,  bg: Colors.success + '18' },
    { label: 'سائقين متاحين',   value: `${stats.activeDrivers}/${stats.totalDrivers}`,icon: 'drive-eta',             color: Colors.accent,   bg: Colors.accent + '18' },
    { label: 'رحلات جارية',     value: stats.activeTrips.toLocaleString(),            icon: 'my-location',            color: Colors.error,    bg: Colors.error + '18' },
  ] : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Sidebar */}
      {sidebarOpen && (
        <TouchableOpacity style={styles.sidebarOverlay} onPress={() => setSidebarOpen(false)} activeOpacity={1}>
          <View style={styles.sidebar}>
            <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.sidebarGradient}>
              <View style={styles.sidebarHeader}>
                <Image source={require('@/assets/images/logo.png')} style={styles.sidebarLogo} contentFit="contain" transition={200} />
                <Text style={styles.sidebarTitle}>تك توكي</Text>
                <Text style={styles.sidebarSubtitle}>لوحة الإدارة</Text>
              </View>
              {NAV_ITEMS.map((item, i) => (
                <TouchableOpacity
                  key={i}
                  style={[styles.navItem, activeNav === i && styles.navItemActive]}
                  onPress={() => handleNavPress(i, item.label)}
                >
                  <Text style={[styles.navLabel, activeNav === i && styles.navLabelActive]}>{item.label}</Text>
                  <MaterialIcons name={item.icon as any} size={22} color={activeNav === i ? Colors.accent : 'rgba(255,255,255,0.6)'} />
                </TouchableOpacity>
              ))}
            </LinearGradient>
          </View>
        </TouchableOpacity>
      )}

      {/* Main Content */}
      <View style={styles.main}>
        <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.topBar}>
          <View style={styles.topBarContent}>
            <TouchableOpacity onPress={() => setSidebarOpen(true)}>
              <MaterialIcons name="menu" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.topBarTitle}>لوحة التحكم الإدارية</Text>
            <TouchableOpacity onPress={handleRefresh}>
              <MaterialIcons name="refresh" size={22} color="rgba(255,255,255,0.7)" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <ScrollView
          style={styles.scroll}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={Colors.accent} />
          }
        >
          {/* Stats Grid */}
          {statsLoading ? (
            <View style={styles.statsLoader}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text style={styles.statsLoaderText}>جارٍ تحميل الإحصائيات...</Text>
            </View>
          ) : (
            <View style={styles.statsGrid}>
              {statCards.map((card, i) => (
                <View key={i} style={[styles.statCard, { backgroundColor: card.bg }]}>
                  <View style={[styles.statIconBg, { backgroundColor: card.color + '25' }]}>
                    <MaterialIcons name={card.icon as any} size={22} color={card.color} />
                  </View>
                  <Text style={[styles.statValue, { color: card.color }]}>{card.value}</Text>
                  <Text style={styles.statLabel}>{card.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Secondary stats row */}
          {stats && !statsLoading && (
            <View style={styles.secondaryStats}>
              {[
                { label: 'مكتملة',   value: stats.completedTrips, color: Colors.success },
                { label: 'ملغاة',    value: stats.cancelledTrips, color: Colors.error },
                { label: 'مستخدمين', value: stats.totalUsers,     color: Colors.primary },
              ].map((s, i) => (
                <View key={i} style={styles.secStatItem}>
                  <Text style={[styles.secStatValue, { color: s.color }]}>{s.value.toLocaleString()}</Text>
                  <Text style={styles.secStatLabel}>{s.label}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Complaints — from Supabase */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>بيانات حية</Text>
              </View>
              <Text style={styles.sectionTitle}>
                الشكاوى ({complaints.filter(c => c.status === 'pending').length} معلقة)
              </Text>
            </View>
            {complaintsLoading ? (
              <View style={styles.emptyBlock}>
                <ActivityIndicator color={Colors.accent} />
              </View>
            ) : complaints.length === 0 ? (
              <View style={styles.emptyBlock}>
                <MaterialIcons name="report-off" size={36} color={Colors.borderLight} />
                <Text style={styles.emptyText}>لا توجد شكاوى بعد</Text>
              </View>
            ) : (
              complaints.map(complaint => {
                const statusColors: Record<string, string> = {
                  pending: Colors.warning, reviewed: Colors.primary,
                  resolved: Colors.success, dismissed: Colors.textLight,
                };
                const statusLabels: Record<string, string> = {
                  pending: 'معلقة', reviewed: 'مراجعة', resolved: 'محلولة', dismissed: 'مرفوضة',
                };
                const sColor = statusColors[complaint.status] ?? Colors.warning;
                const sLabel = statusLabels[complaint.status] ?? complaint.status;
                return (
                  <View key={complaint.id} style={styles.complaintRow}>
                    <TouchableOpacity
                      style={[styles.complaintAction, { backgroundColor: sColor + '18' }]}
                      onPress={() => handleUpdateComplaintStatus(complaint.id, complaint.status)}
                    >
                      <Text style={[styles.complaintActionText, { color: sColor }]}>{sLabel}</Text>
                    </TouchableOpacity>
                    <View style={styles.complaintInfo}>
                      <Text style={styles.complaintTitle}>{complaint.reason}</Text>
                      <Text style={styles.complaintReason} numberOfLines={2}>{complaint.description}</Text>
                      <Text style={[styles.complaintReason, { fontSize: 10, marginTop: 2 }]}>
                        {new Date(complaint.created_at).toLocaleDateString('ar-EG')}
                      </Text>
                    </View>
                    <View style={[styles.complaintAvatar, { borderRadius: 8, backgroundColor: sColor + '12', alignItems: 'center', justifyContent: 'center' }]}>
                      <MaterialIcons name="report-problem" size={22} color={sColor} />
                    </View>
                  </View>
                );
              })
            )}
          </View>

          {/* Drivers Management — from Supabase */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>بيانات حية</Text>
              </View>
              <Text style={styles.sectionTitle}>إدارة السائقين ({drivers.length})</Text>
            </View>
            {drivers.length === 0 && !statsLoading ? (
              <View style={styles.emptyBlock}>
                <MaterialIcons name="drive-eta" size={40} color={Colors.borderLight} />
                <Text style={styles.emptyText}>لا يوجد سائقون مسجلون بعد</Text>
              </View>
            ) : (
              drivers.map(driver => {
                const isActive = driverStatuses[driver.id] ?? driver.is_active;
                return (
                  <View key={driver.id} style={styles.driverRow}>
                    <TouchableOpacity
                      style={[styles.driverToggleBtn, { backgroundColor: isActive ? Colors.error + '12' : Colors.success + '12' }]}
                      onPress={() => toggleDriverStatus(driver.id, driver.name, isActive)}
                    >
                      <MaterialIcons name={isActive ? 'block' : 'check-circle'} size={16} color={isActive ? Colors.error : Colors.success} />
                      <Text style={[styles.driverToggleText, { color: isActive ? Colors.error : Colors.success }]}>
                        {isActive ? 'تعطيل' : 'تفعيل'}
                      </Text>
                    </TouchableOpacity>
                    <View style={styles.driverAdminInfo}>
                      <Text style={styles.driverAdminName}>{driver.name}</Text>
                      <View style={styles.driverAdminMeta}>
                        <View style={[styles.statusIndicator, { backgroundColor: driver.is_online ? Colors.success : Colors.offline }]} />
                        <Text style={styles.driverAdminMetaText}>{driver.is_online ? 'متصل' : 'غير متصل'}</Text>
                        <Text style={styles.driverAdminMetaDivider}>·</Text>
                        <MaterialIcons name="star" size={11} color={Colors.accent} />
                        <Text style={styles.driverAdminMetaText}>{Number(driver.rating).toFixed(1)}</Text>
                        <Text style={styles.driverAdminMetaDivider}>·</Text>
                        <Text style={styles.driverAdminMetaText}>{driver.total_trips} رحلة</Text>
                      </View>
                      <Text style={styles.driverAdminVehicle}>{driver.vehicle} — {driver.plate}</Text>
                    </View>
                    {driver.avatar_url ? (
                      <Image source={{ uri: driver.avatar_url }} style={styles.driverAdminAvatar} contentFit="cover" transition={200} />
                    ) : (
                      <View style={[styles.driverAdminAvatar, styles.avatarPlaceholder]}>
                        <MaterialIcons name="person" size={22} color={Colors.textLight} />
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>

          {/* Detailed Reports */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>بيانات حية</Text>
              </View>
              <Text style={styles.sectionTitle}>تقارير مفصلة</Text>
            </View>
            {/* Period Tabs */}
            <View style={reportStyles.periodRow}>
              {(['daily', 'weekly', 'monthly'] as const).map(p => (
                <TouchableOpacity
                  key={p}
                  style={[reportStyles.periodBtn, reportPeriod === p && reportStyles.periodBtnActive]}
                  onPress={() => setReportPeriod(p)}
                >
                  <Text style={[reportStyles.periodText, reportPeriod === p && reportStyles.periodTextActive]}>
                    {p === 'daily' ? 'يومي' : p === 'weekly' ? 'أسبوعي' : 'شهري'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            {/* Summary */}
            <View style={reportStyles.summaryRow}>
              <View style={[reportStyles.summaryCard, { backgroundColor: Colors.primary + '12' }]}>
                <MaterialIcons name="directions-car" size={16} color={Colors.primary} />
                <Text style={[reportStyles.summaryVal, { color: Colors.primary }]}>{reportTripTotal}</Text>
                <Text style={reportStyles.summaryLbl}>رحلات مكتملة</Text>
              </View>
              <View style={[reportStyles.summaryCard, { backgroundColor: Colors.success + '12' }]}>
                <MaterialIcons name="attach-money" size={16} color={Colors.success} />
                <Text style={[reportStyles.summaryVal, { color: Colors.success }]}>{reportRevTotal.toFixed(0)} ج.م</Text>
                <Text style={reportStyles.summaryLbl}>إجمالي الإيرادات</Text>
              </View>
            </View>
            {reportLoading ? (
              <View style={pieStyles.loadingWrap}><ActivityIndicator color={Colors.accent} /></View>
            ) : reportData.every(d => d.trips === 0) ? (
              <View style={pieStyles.empty}>
                <MaterialIcons name="bar-chart" size={44} color={Colors.borderLight} />
                <Text style={pieStyles.emptyText}>لا توجد بيانات بعد</Text>
              </View>
            ) : (
              <View style={reportStyles.chartArea}>
                {reportData.map((item, i) => {
                  const maxT = Math.max(...reportData.map(d => d.trips), 1);
                  const pct  = (item.trips / maxT) * 100;
                  return (
                    <View key={i} style={reportStyles.barColV}>
                      <Text style={reportStyles.barValLabel}>{item.trips > 0 ? item.trips : ''}</Text>
                      <View style={reportStyles.barTrackV}>
                        <View style={[reportStyles.barFillV, {
                          height: `${Math.max(pct, 4)}%`,
                          backgroundColor: i === reportData.length - 1 ? Colors.primary : Colors.primary + '65',
                        }]} />
                      </View>
                      <Text style={reportStyles.barXLbl} numberOfLines={1}>{item.label}</Text>
                      {item.revenue > 0 && (
                        <Text style={reportStyles.barRevLbl}>{(item.revenue / 1000).toFixed(1)}k</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            )}
          </View>

          {/* Cancellation Reasons */}
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View style={styles.liveBadge}>
                <Text style={styles.liveBadgeText}>بيانات حية</Text>
              </View>
              <Text style={styles.sectionTitle}>أسباب إلغاء الرحلات</Text>
            </View>
            {cancelLoading ? (
              <View style={pieStyles.loadingWrap}><ActivityIndicator color={Colors.accent} /></View>
            ) : (
              <CancellationChart data={cancelStats} />
            )}
          </View>

          {/* Quick Actions */}
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
            <View style={styles.actionsGrid}>
              {[
                { icon: 'person-add',   label: 'إضافة سائق',    color: Colors.primary },
                { icon: 'block',        label: 'حظر سائق',      color: Colors.error },
                { icon: 'local-offer',  label: 'عروض خاصة',     color: Colors.accent },
                { icon: 'notifications',label: 'إشعار جماعي',   color: Colors.success },
              ].map((action, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.actionItem}
                  onPress={() => showAlert(action.label, 'هذه الميزة ستكون متاحة قريباً')}
                >
                  <View style={[styles.actionIcon, { backgroundColor: action.color + '18' }]}>
                    <MaterialIcons name={action.icon as any} size={24} color={action.color} />
                  </View>
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: insets.bottom + 20 }} />
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  sidebarOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, flexDirection: 'row-reverse',
  },
  sidebar: { width: 260, height: '100%' },
  sidebarGradient: { flex: 1, paddingTop: 60 },
  sidebarHeader: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl, alignItems: 'flex-end' },
  sidebarLogo: { width: 60, height: 60, borderRadius: 12 },
  sidebarTitle: { color: '#fff', fontSize: Typography.xxl, fontWeight: '800', marginTop: Spacing.sm },
  sidebarSubtitle: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm },
  navItem: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.lg, paddingVertical: 14,
  },
  navItemActive: { backgroundColor: 'rgba(255,255,255,0.1)', borderRightWidth: 3, borderRightColor: Colors.accent },
  navLabel: { flex: 1, color: 'rgba(255,255,255,0.6)', fontSize: Typography.base, textAlign: 'right' },
  navLabelActive: { color: '#fff', fontWeight: '600' },
  main: { flex: 1 },
  topBar: { paddingBottom: Spacing.md },
  topBarContent: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  topBarTitle: { color: '#fff', fontSize: Typography.lg, fontWeight: '700' },
  scroll: { flex: 1 },
  statsLoader: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  statsLoaderText: { color: Colors.textSecondary, fontSize: Typography.sm },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', padding: Spacing.md, gap: Spacing.sm },
  statCard: {
    width: (width - Spacing.md * 2 - Spacing.sm) / 2 - 1,
    borderRadius: BorderRadius.xl, padding: Spacing.md, alignItems: 'flex-end',
  },
  statIconBg: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.sm },
  statValue: { fontSize: Typography.xxl, fontWeight: '800' },
  statLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  secondaryStats: {
    flexDirection: 'row-reverse', marginHorizontal: Spacing.md, marginBottom: Spacing.sm,
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadows.sm,
  },
  secStatItem: { flex: 1, alignItems: 'center' },
  secStatValue: { fontSize: Typography.xl, fontWeight: '800' },
  secStatLabel: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  sectionCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.md, marginBottom: Spacing.sm, padding: Spacing.md, ...Shadows.sm,
  },
  sectionHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  sectionTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  liveBadge: {
    backgroundColor: Colors.success + '18', borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  liveBadgeText: { fontSize: Typography.xs, color: Colors.success, fontWeight: '700' },
  complaintRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  complaintAvatar: { width: 44, height: 44, borderRadius: 22 },
  complaintInfo: { flex: 1 },
  complaintTitle: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
  complaintReason: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  complaintAction: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: Colors.primary + '18', borderRadius: 8,
  },
  complaintActionText: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '600' },
  driverRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  driverAdminAvatar: { width: 46, height: 46, borderRadius: 23 },
  avatarPlaceholder: { backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center' },
  driverAdminInfo: { flex: 1 },
  driverAdminName: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: 3 },
  driverAdminVehicle: { fontSize: Typography.xs, color: Colors.textLight, textAlign: 'right', marginTop: 2 },
  driverAdminMeta: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  driverAdminMetaText: { fontSize: Typography.xs, color: Colors.textSecondary },
  driverAdminMetaDivider: { color: Colors.border, fontSize: Typography.xs },
  statusIndicator: { width: 7, height: 7, borderRadius: 4 },
  driverToggleBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10,
  },
  driverToggleText: { fontSize: Typography.xs, fontWeight: '700' },
  emptyBlock: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { color: Colors.textLight, fontSize: Typography.sm },
  actionsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  actionItem: { width: '48%', alignItems: 'center', gap: Spacing.xs },
  actionIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  actionLabel: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
});

const pieStyles = StyleSheet.create({
  container: { marginTop: Spacing.sm },
  barsArea: { gap: Spacing.sm },
  barRow: { gap: 6 },
  barLabelWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6 },
  colorDot: { width: 8, height: 8, borderRadius: 4 },
  barLabel: { fontSize: Typography.xs, color: Colors.textSecondary, flex: 1, textAlign: 'right' },
  barTrack: { height: 12, backgroundColor: Colors.bgLight, borderRadius: 6, overflow: 'hidden', marginVertical: 2 },
  barFill: { height: '100%', borderRadius: 6, minWidth: 8 },
  barCount: { fontSize: Typography.xs, color: Colors.textLight, textAlign: 'right', fontWeight: '600' },
  legendRow: {
    flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm,
    marginTop: Spacing.md, paddingTop: Spacing.md,
    borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  legendItem: { alignItems: 'center', minWidth: 60 },
  legendPct: { fontSize: Typography.md, fontWeight: '800' },
  legendLabel: { fontSize: 10, color: Colors.textSecondary, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { color: Colors.textLight, fontSize: Typography.sm },
  loadingWrap: { paddingVertical: 24, alignItems: 'center' },
});

const reportStyles = StyleSheet.create({
  periodRow: { flexDirection: 'row-reverse', gap: 6, marginVertical: Spacing.sm },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center', backgroundColor: Colors.bgLight,
  },
  periodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  periodText: { fontSize: Typography.xs, color: Colors.textSecondary, fontWeight: '600' },
  periodTextActive: { color: '#fff', fontWeight: '700' },
  summaryRow: { flexDirection: 'row-reverse', gap: Spacing.sm, marginBottom: Spacing.md },
  summaryCard: { flex: 1, borderRadius: BorderRadius.md, padding: Spacing.sm, alignItems: 'center', gap: 3 },
  summaryVal: { fontSize: Typography.md, fontWeight: '800' },
  summaryLbl: { fontSize: Typography.xs, color: Colors.textSecondary },
  chartArea: { flexDirection: 'row-reverse', alignItems: 'flex-end', height: 120, gap: 4, marginBottom: Spacing.sm },
  barColV: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  barValLabel: { fontSize: 9, color: Colors.textLight, marginBottom: 2 },
  barTrackV: { width: '80%', height: '100%', justifyContent: 'flex-end', backgroundColor: Colors.bgLight, borderRadius: 4 },
  barFillV: { width: '100%', borderRadius: 4, minHeight: 4 },
  barXLbl: { fontSize: 8, color: Colors.textLight, marginTop: 3, textAlign: 'center' },
  barRevLbl: { fontSize: 8, color: Colors.primary, fontWeight: '700' },
});
