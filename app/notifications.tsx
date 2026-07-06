import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotifications, AppNotification } from '@/contexts/NotificationsContext';

// ── DB notification row ───────────────────────────────────────────
interface DbNotification {
  id: string;
  user_id: string;
  title: string;
  message: string;
  type: string;
  icon: string;
  icon_color: string;
  is_read: boolean;
  created_at: string;
}

// ── Merge DB notification into AppNotification shape ─────────────
function toAppNotification(n: DbNotification): AppNotification {
  const now = new Date();
  const created = new Date(n.created_at);
  const diffMs = now.getTime() - created.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);
  let time = 'الآن';
  if (diffMin >= 1 && diffMin < 60) time = `منذ ${diffMin} دقيقة`;
  else if (diffH >= 1 && diffH < 24) time = `منذ ${diffH} ساعة`;
  else if (diffD >= 1) time = `منذ ${diffD} يوم`;

  return {
    id: n.id,
    type: n.type as AppNotification['type'],
    title: n.title,
    body: n.message,
    time,
    icon: n.icon,
    iconColor: n.icon_color,
    read: n.is_read,
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();

  // ── In-memory context notifications (from push/trip events) ────
  const { notifications: ctxNotifs, markAllRead: ctxMarkAllRead, clearAll: ctxClearAll } = useNotifications();

  // ── DB-backed notifications ────────────────────────────────────
  const [dbNotifs, setDbNotifs] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch notifications from Supabase ──────────────────────────
  const fetchDbNotifications = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (!error && data) {
        setDbNotifs(data.map(toAppNotification));
      }
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.id]);

  useEffect(() => {
    fetchDbNotifications();
    // Poll for new notifications every 15 seconds
    pollRef.current = setInterval(fetchDbNotifications, 15000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [fetchDbNotifications]);

  // ── Merge context + DB notifications (deduplicate by id) ───────
  const allNotifications = React.useMemo(() => {
    const dbIds = new Set(dbNotifs.map(n => n.id));
    const ctxOnly = ctxNotifs.filter(n => !dbIds.has(n.id));
    return [...ctxOnly, ...dbNotifs].sort((a, b) => {
      // Put unread first, then by position
      if (!a.read && b.read) return -1;
      if (a.read && !b.read) return 1;
      return 0;
    });
  }, [dbNotifs, ctxNotifs]);

  const unreadCount = allNotifications.filter(n => !n.read).length;

  // ── Mark single notification as read ──────────────────────────
  const handleMarkRead = useCallback(async (id: string) => {
    if (!user?.id) return;
    // Optimistic update
    setDbNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id)
        .eq('user_id', user.id);
    } catch { /* silent — already updated optimistically */ }
  }, [user?.id]);

  // ── Mark all as read ───────────────────────────────────────────
  const handleMarkAllRead = useCallback(async () => {
    if (!user?.id) return;
    setDbNotifs(prev => prev.map(n => ({ ...n, read: true })));
    ctxMarkAllRead();
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
    } catch { /* silent */ }
  }, [user?.id, ctxMarkAllRead]);

  // ── Clear all (context only; DB records preserved) ────────────
  const handleClearAll = () => {
    ctxClearAll();
    setDbNotifs([]);
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity
      style={[styles.notifCard, !item.read && styles.notifCardUnread]}
      onPress={() => handleMarkRead(item.id)}
      activeOpacity={0.85}
    >
      {!item.read && <View style={styles.unreadDot} />}
      <View style={styles.notifContent}>
        <View style={styles.notifTitleRow}>
          <Text style={styles.notifTime}>{item.time}</Text>
          <Text style={[styles.notifTitle, !item.read && styles.notifTitleUnread]}>
            {item.title}
          </Text>
        </View>
        <Text style={styles.notifBody}>{item.body}</Text>
      </View>
      <View style={[styles.iconBg, { backgroundColor: (item.iconColor ?? Colors.primary) + '18' }]}>
        <MaterialIcons name={item.icon as any} size={24} color={item.iconColor ?? Colors.primary} />
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity onPress={handleMarkAllRead} style={styles.markAllBtn}>
              <Text style={styles.markAllText}>قراءة الكل</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleClearAll} style={styles.clearBtn}>
            <MaterialIcons name="delete-outline" size={20} color={Colors.error} />
          </TouchableOpacity>
        </View>

        <View style={styles.titleRow}>
          {unreadCount > 0 && (
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{unreadCount > 99 ? '99+' : unreadCount}</Text>
            </View>
          )}
          <Text style={styles.title}>الإشعارات</Text>
        </View>

        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-forward" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loaderText}>جارٍ تحميل الإشعارات...</Text>
        </View>
      ) : (
        <FlatList
          data={allNotifications}
          keyExtractor={n => n.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); fetchDbNotifications(); }}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="notifications-none" size={64} color={Colors.borderLight} />
              <Text style={styles.emptyText}>لا توجد إشعارات</Text>
              <Text style={styles.emptySubText}>ستظهر هنا إشعارات رحلاتك وعروضك</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.bgWhite, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center',
  },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  title: { fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary },
  countBadge: {
    backgroundColor: Colors.error, borderRadius: BorderRadius.full,
    paddingHorizontal: 8, paddingVertical: 2, minWidth: 22, alignItems: 'center',
  },
  countText: { color: '#fff', fontSize: Typography.xs, fontWeight: '800' },
  headerActions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  markAllBtn: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.md,
  },
  markAllText: { color: Colors.primary, fontSize: Typography.xs, fontWeight: '600' },
  clearBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.error + '12', alignItems: 'center', justifyContent: 'center',
  },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loaderText: { color: Colors.textSecondary, fontSize: Typography.sm },
  list: { padding: Spacing.md, gap: Spacing.xs },
  notifCard: {
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: Spacing.sm,
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadows.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
    position: 'relative',
  },
  notifCardUnread: {
    borderColor: Colors.primary + '30',
    backgroundColor: Colors.primaryLight,
  },
  unreadDot: {
    position: 'absolute', top: 12, left: 12,
    width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.primary,
  },
  iconBg: {
    width: 50, height: 50, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  notifContent: { flex: 1 },
  notifTitleRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 4,
  },
  notifTitle: { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary },
  notifTitleUnread: { fontWeight: '700', color: Colors.bgDark },
  notifTime: { fontSize: Typography.xs, color: Colors.textLight },
  notifBody: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 20 },
  empty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  emptyText: { fontSize: Typography.lg, color: Colors.textLight, fontWeight: '600' },
  emptySubText: { fontSize: Typography.sm, color: Colors.textLight, textAlign: 'center' },
});
