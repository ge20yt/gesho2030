import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';
import { MOCK_TRIPS } from '@/services/mockData';

const FILTERS = ['الكل', 'قيد الانتظار', 'جارية', 'مكتملة', 'ملغاة'];

interface DriverInfo {
  id: string;
  name: string;
  vehicle: string;
  avatar_url: string | null;
  rating: number;
  plate: string;
}

interface TripRow {
  id: string;
  user_id: string;
  driver_id: string | null;
  from_location: string;
  to_location: string;
  distance: string;
  duration: string;
  price: number;
  status: string;
  payment_method: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
  cancellation_reason: string | null;
  drivers: DriverInfo | null;
}

// Status config
const STATUS_CONFIG: Record<string, { label: string; bg: string; color: string; icon: string }> = {
  pending:   { label: 'قيد الانتظار', bg: Colors.warning + '18',  color: Colors.warning,  icon: 'schedule' },
  active:    { label: 'جارية',        bg: Colors.primary + '18',  color: Colors.primary,  icon: 'directions-car' },
  completed: { label: 'مكتملة',       bg: Colors.success + '18',  color: Colors.success,  icon: 'check-circle' },
  cancelled: { label: 'ملغاة',        bg: Colors.error + '18',    color: Colors.error,    icon: 'cancel' },
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
}

export default function OrdersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthContext();

  const [filter, setFilter] = useState('الكل');
  const [trips, setTrips] = useState<TripRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTrips = useCallback(async () => {
    if (!user?.id) {
      // No auth — show mock data as demo
      setTrips(MOCK_TRIPS.map((t: any) => ({
        id: t.id,
        user_id: '',
        driver_id: t.driver?.id ?? null,
        from_location: t.from ?? '',
        to_location: t.to ?? '',
        distance: t.distance ?? '',
        duration: t.duration ?? '',
        price: t.price,
        status: t.status,
        payment_method: 'كاش',
        rating: t.rating ?? null,
        created_at: t.date ?? new Date().toISOString(),
        updated_at: t.date ?? new Date().toISOString(),
        cancellation_reason: null,
        drivers: t.driver ? {
          id: t.driver.id,
          name: t.driver.name,
          vehicle: t.driver.vehicle,
          avatar_url: t.driver.avatar,
          rating: t.driver.rating,
          plate: t.driver.plate ?? '',
        } : null,
      })));
      setLoading(false);
      setRefreshing(false);
      return;
    }

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('trips')
        .select(`
          *,
          drivers (
            id,
            name,
            vehicle,
            avatar_url,
            rating,
            plate
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !data || data.length === 0) {
        setTrips([]);
      } else {
        setTrips(data as TripRow[]);
      }
    } catch {
      setTrips([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  const filteredTrips = trips.filter(t => {
    if (filter === 'الكل') return true;
    if (filter === 'قيد الانتظار') return t.status === 'pending';
    if (filter === 'جارية') return t.status === 'active';
    if (filter === 'مكتملة') return t.status === 'completed';
    if (filter === 'ملغاة') return t.status === 'cancelled';
    return true;
  });

  const renderItem = ({ item }: { item: TripRow }) => {
    const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG['pending'];
    const driverName = item.drivers?.name ?? 'سائق تك توكي';
    const driverVehicle = item.drivers?.vehicle ?? 'توك توك';
    const driverAvatar = item.drivers?.avatar_url;
    const hasRating = (item.rating ?? 0) > 0;

    return (
      <TouchableOpacity
        style={styles.card}
        activeOpacity={0.9}
        onPress={() => router.push({ pathname: '/trip-details', params: { id: item.id } } as any)}
      >
        {/* Header */}
        <View style={styles.cardHeader}>
          <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <MaterialIcons name={cfg.icon as any} size={12} color={cfg.color} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
          </View>
          <View style={styles.dateRow}>
            <MaterialIcons name="schedule" size={13} color={Colors.textLight} />
            <Text style={styles.cardDate}>{formatTime(item.created_at)} · {formatDate(item.created_at)}</Text>
          </View>
        </View>

        {/* Driver row */}
        <View style={styles.driverRow}>
          {driverAvatar ? (
            <Image source={{ uri: driverAvatar }} style={styles.avatar} contentFit="cover" transition={200} />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <MaterialIcons name="person" size={22} color={Colors.textLight} />
            </View>
          )}
          <View style={styles.driverInfo}>
            <Text style={styles.driverName}>{driverName}</Text>
            <Text style={styles.vehicleName}>{driverVehicle}</Text>
          </View>
          <View style={styles.priceBlock}>
            <Text style={styles.price}>{Number(item.price).toFixed(0)} ج.م</Text>
            <Text style={styles.paymentMethod}>{item.payment_method}</Text>
          </View>
        </View>

        {/* Route */}
        <View style={styles.routeBlock}>
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, { backgroundColor: Colors.success }]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.from_location}</Text>
          </View>
          <View style={styles.routeConnector} />
          <View style={styles.routeItem}>
            <View style={[styles.routeDot, { backgroundColor: Colors.error }]} />
            <Text style={styles.routeText} numberOfLines={1}>{item.to_location}</Text>
          </View>
        </View>

        {/* Distance / Duration */}
        {(item.distance !== '0 كم' || item.duration !== '0 دقيقة') ? (
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <MaterialIcons name="straighten" size={13} color={Colors.textLight} />
              <Text style={styles.statText}>{item.distance}</Text>
            </View>
            <View style={styles.statItem}>
              <MaterialIcons name="timer" size={13} color={Colors.textLight} />
              <Text style={styles.statText}>{item.duration}</Text>
            </View>
          </View>
        ) : null}

        {/* Cancellation reason */}
        {item.status === 'cancelled' && item.cancellation_reason ? (
          <View style={styles.cancelNote}>
            <MaterialIcons name="info-outline" size={14} color={Colors.error} />
            <Text style={styles.cancelNoteText}>{item.cancellation_reason}</Text>
          </View>
        ) : null}

        {/* Footer */}
        <View style={styles.cardFooter}>
          {/* Rating */}
          {item.status === 'completed' && hasRating && (
            <View style={styles.ratingRow}>
              {[1,2,3,4,5].map(i => (
                <MaterialIcons key={i} name="star" size={15} color={i <= (item.rating ?? 0) ? Colors.accent : Colors.borderLight} />
              ))}
            </View>
          )}

          {/* Active trip: track button */}
          {item.status === 'active' && (
            <TouchableOpacity
              style={[styles.footerBtn, { backgroundColor: Colors.success }]}
              onPress={() => router.push({ pathname: '/trip-tracking', params: { tripId: item.id } } as any)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="my-location" size={14} color="#fff" />
              <Text style={styles.footerBtnText}>تتبع الرحلة</Text>
            </TouchableOpacity>
          )}

          {/* Details button */}
          <TouchableOpacity
            style={[styles.footerBtn, styles.footerBtnOutline]}
            onPress={() => router.push({ pathname: '/trip-details', params: { id: item.id } } as any)}
            activeOpacity={0.85}
          >
            <Text style={[styles.footerBtnText, { color: Colors.primary }]}>تفاصيل الطلب</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { setRefreshing(true); loadTrips(); }}>
          <MaterialIcons name="refresh" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <Text style={styles.title}>الطلبات</Text>
      </View>

      {/* Filter bar */}
      <View style={styles.filterBar}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={f => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterList}
          renderItem={({ item: f }) => (
            <TouchableOpacity
              style={[styles.filterBtn, filter === f && styles.filterBtnActive]}
              onPress={() => setFilter(f)}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>{f}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="large" color={Colors.accent} />
          <Text style={styles.loadingText}>جارٍ تحميل الطلبات...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          keyExtractor={t => t.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadTrips(); }}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={64} color={Colors.borderLight} />
              <Text style={styles.emptyTitle}>لا توجد طلبات</Text>
              <Text style={styles.emptySubtitle}>
                {filter === 'الكل' ? 'لم تقم بأي طلبات بعد' : `لا توجد طلبات بحالة "${filter}"`}
              </Text>
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
  title: { fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary },
  filterBar: {
    backgroundColor: Colors.bgWhite,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  filterList: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterBtn: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: BorderRadius.full,
    borderWidth: 1, borderColor: Colors.border,
  },
  filterBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '700' },
  list: { padding: Spacing.md, gap: Spacing.sm },
  loaderWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { fontSize: Typography.sm, color: Colors.textSecondary },
  card: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadows.sm, borderWidth: 1, borderColor: Colors.borderLight,
  },
  cardHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: Spacing.sm,
  },
  badge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full,
  },
  badgeText: { fontSize: Typography.xs, fontWeight: '700' },
  dateRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  cardDate: { fontSize: Typography.xs, color: Colors.textLight },
  driverRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: Spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, marginLeft: Spacing.sm },
  avatarPlaceholder: { backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center' },
  driverInfo: { flex: 1 },
  driverName: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  vehicleName: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right' },
  priceBlock: { alignItems: 'flex-end' },
  price: { fontSize: Typography.lg, fontWeight: '800', color: Colors.primary },
  paymentMethod: { fontSize: Typography.xs, color: Colors.textLight },
  routeBlock: { marginBottom: Spacing.sm },
  routeItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: 6 },
  routeDot: { width: 8, height: 8, borderRadius: 4, flexShrink: 0 },
  routeConnector: { width: 2, height: 10, backgroundColor: Colors.border, marginRight: 3, marginLeft: 'auto' },
  routeText: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right' },
  statsRow: {
    flexDirection: 'row-reverse', gap: Spacing.md, marginBottom: Spacing.xs,
    paddingTop: Spacing.xs, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  statItem: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  statText: { fontSize: Typography.xs, color: Colors.textLight },
  cancelNote: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: Colors.error + '10', borderRadius: 8, padding: 8, marginBottom: Spacing.xs,
  },
  cancelNoteText: { flex: 1, fontSize: Typography.xs, color: Colors.error, textAlign: 'right' },
  cardFooter: {
    flexDirection: 'row-reverse', gap: Spacing.sm,
    paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight,
    alignItems: 'center',
  },
  ratingRow: { flexDirection: 'row-reverse', gap: 2, flex: 1 },
  footerBtn: {
    flex: 1, paddingVertical: 9, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
    flexDirection: 'row-reverse', justifyContent: 'center', gap: 4,
  },
  footerBtnOutline: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: Colors.primary },
  footerBtnText: { fontSize: Typography.sm, fontWeight: '600', color: '#fff' },
  empty: { alignItems: 'center', paddingVertical: 80, gap: 8 },
  emptyTitle: { fontSize: Typography.lg, color: Colors.textSecondary, fontWeight: '600' },
  emptySubtitle: { fontSize: Typography.sm, color: Colors.textLight, textAlign: 'center' },
});
