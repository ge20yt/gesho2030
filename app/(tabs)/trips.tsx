import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, Platform, KeyboardAvoidingView,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { MOCK_TRIPS } from '@/services/mockData';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';
import { FlatList } from 'react-native';

const FILTERS = ['الكل', 'مكتملة', 'ملغاة', 'جارية'];

// ── Inline Rating Modal ────────────────────────────────────────────
function TripRatingModal({
  tripId,
  visible,
  onClose,
  onSaved,
}: {
  tripId: string;
  visible: boolean;
  onClose: () => void;
  onSaved: (tripId: string, stars: number) => void;
}) {
  const [stars, setStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const handleSubmit = async () => {
    if (stars === 0) return;
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('trips')
        .update({ rating: stars, updated_at: new Date().toISOString() })
        .eq('id', tripId);
      setDone(true);
      onSaved(tripId, stars);
      setTimeout(onClose, 1200);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={onClose}>
      <KeyboardAvoidingView style={rStyle.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={rStyle.backdrop} />
        <View style={rStyle.sheet}>
          {done ? (
            <View style={rStyle.success}>
              <View style={rStyle.successIcon}>
                <MaterialIcons name="check" size={32} color="#fff" />
              </View>
              <Text style={rStyle.successText}>شكراً لتقييمك!</Text>
            </View>
          ) : (
            <>
              <View style={rStyle.handle} />
              <Text style={rStyle.title}>قيّم رحلتك</Text>
              <View style={rStyle.starsRow}>
                {[1,2,3,4,5].map(i => (
                  <TouchableOpacity key={i} onPress={() => setStars(i)} hitSlop={{ top: 8, bottom: 8, left: 6, right: 6 }}>
                    <MaterialIcons name="star" size={44} color={stars >= i ? Colors.accent : Colors.borderLight} />
                  </TouchableOpacity>
                ))}
              </View>
              {stars > 0 && (
                <Text style={rStyle.label}>
                  {stars === 1 ? 'سيء جداً 😞' : stars === 2 ? 'سيء 😕' : stars === 3 ? 'مقبول 😐' : stars === 4 ? 'جيد 😊' : 'ممتاز! 🤩'}
                </Text>
              )}
              <View style={rStyle.btnRow}>
                <TouchableOpacity style={rStyle.skipBtn} onPress={onClose}>
                  <Text style={rStyle.skipText}>تخطي</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[rStyle.submitBtn, (stars === 0 || submitting) && rStyle.submitDisabled]}
                  onPress={handleSubmit}
                  disabled={stars === 0 || submitting}
                >
                  {submitting
                    ? <ActivityIndicator color="#fff" size="small" />
                    : <Text style={rStyle.submitText}>إرسال التقييم</Text>}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// Unified Trip type (covers both Supabase real data and mock data)
interface TripItem {
  id: string;
  from_location?: string;
  to_location?: string;
  from?: string;
  to?: string;
  price: number;
  status: string;
  created_at?: string;
  date?: string;
  time?: string;
  distance?: string;
  duration?: string;
  rating?: number;
  driver?: { name: string; vehicle: string; avatar: string; rating: number; id: string; vehicleType: string; trips: number; plate: string };
  driver_id?: string;
}

export default function TripsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuthContext();
  const [activeFilter, setActiveFilter] = useState('الكل');
  const [trips, setTrips] = useState<TripItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ratingTripId, setRatingTripId] = useState<string | null>(null);

  const loadTrips = useCallback(async () => {
    if (!user?.id) {
      // Demo mode: use mock data
      setTrips(MOCK_TRIPS as any);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('trips')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data || data.length === 0) {
        // Fallback to mock data if no real trips
        setTrips(MOCK_TRIPS as any);
      } else {
        setTrips(data);
      }
    } catch {
      setTrips(MOCK_TRIPS as any);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadTrips(); }, [loadTrips]);

  const filteredTrips = trips.filter(trip => {
    if (activeFilter === 'الكل') return true;
    if (activeFilter === 'مكتملة') return trip.status === 'completed';
    if (activeFilter === 'ملغاة') return trip.status === 'cancelled';
    return trip.status === 'active' || trip.status === 'pending';
  });

  const getStatusStyle = (status: string) => {
    if (status === 'completed') return { bg: Colors.success + '18', text: Colors.success, label: 'مكتملة' };
    if (status === 'cancelled') return { bg: Colors.error + '18', text: Colors.error, label: 'ملغاة' };
    if (status === 'active') return { bg: Colors.primary + '18', text: Colors.primary, label: 'جارية' };
    return { bg: Colors.warning + '18', text: Colors.warning, label: 'قيد الانتظار' };
  };

  const getFrom = (t: TripItem) => t.from_location ?? t.from ?? '-';
  const getTo = (t: TripItem) => t.to_location ?? t.to ?? '-';
  const getDate = (t: TripItem) => {
    if (t.created_at) return new Date(t.created_at).toLocaleDateString('ar-EG');
    return t.date ?? '-';
  };
  const getTime = (t: TripItem) => {
    if (t.created_at) return new Date(t.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
    return t.time ?? '';
  };

  const handleRatingSaved = (tripId: string, stars: number) => {
    setTrips(prev => prev.map(t => t.id === tripId ? { ...t, rating: stars } : t));
    setRatingTripId(null);
  };

  const renderTrip = ({ item }: { item: TripItem }) => {
    const status = getStatusStyle(item.status);
    const isCompleted = item.status === 'completed';
    const hasRating = (item.rating ?? 0) > 0;
    return (
      <TouchableOpacity
        style={styles.tripCard}
        onPress={() => router.push({ pathname: '/trip-details', params: { id: item.id } } as any)}
        activeOpacity={0.9}
      >
        <View style={styles.tripHeader}>
          <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
            <Text style={[styles.statusText, { color: status.text }]}>{status.label}</Text>
          </View>
          <View style={styles.tripDateRow}>
            <MaterialIcons name="schedule" size={14} color={Colors.textLight} />
            <Text style={styles.tripDate}>{getTime(item)} · {getDate(item)}</Text>
          </View>
        </View>

        {item.driver ? (
          <View style={styles.driverRow}>
            <Image source={{ uri: item.driver.avatar }} style={styles.avatar} contentFit="cover" transition={200} />
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>{item.driver.name}</Text>
              <Text style={styles.vehicleName}>{item.driver.vehicle}</Text>
            </View>
            <Text style={styles.tripPrice}>{item.price} ج.م</Text>
          </View>
        ) : (
          <View style={styles.driverRow}>
            <View style={[styles.avatar, { backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center' }]}>
              <MaterialIcons name="directions-car" size={22} color={Colors.primary} />
            </View>
            <View style={styles.driverInfo}>
              <Text style={styles.driverName}>سائق تك توكي</Text>
              <Text style={styles.vehicleName}>توك توك</Text>
            </View>
            <Text style={styles.tripPrice}>{item.price} ج.م</Text>
          </View>
        )}

        <View style={styles.routeRow}>
          <View style={styles.routePoint}>
            <MaterialIcons name="location-on" size={16} color={Colors.success} />
            <Text style={styles.routeText} numberOfLines={1}>{getFrom(item)}</Text>
          </View>
          <View style={styles.routePoint}>
            <MaterialIcons name="location-on" size={16} color={Colors.error} />
            <Text style={styles.routeText} numberOfLines={1}>{getTo(item)}</Text>
          </View>
        </View>

        {isCompleted && (
          <View style={styles.tripFooter}>
            {hasRating ? (
              <View style={styles.ratingRow}>
                {[1,2,3,4,5].map(i => (
                  <MaterialIcons key={i} name="star" size={16} color={i <= (item.rating ?? 0) ? Colors.accent : Colors.borderLight} />
                ))}
              </View>
            ) : (
              <TouchableOpacity
                style={styles.rateBtn}
                onPress={(e) => { e.stopPropagation(); setRatingTripId(item.id); }}
                activeOpacity={0.85}
              >
                <MaterialIcons name="star-outline" size={15} color={Colors.accent} />
                <Text style={styles.rateBtnText}>قيّم الرحلة</Text>
              </TouchableOpacity>
            )}
            {item.distance && item.duration ? (
              <View style={styles.statsRow}>
                <Text style={styles.statText}>{item.distance}</Text>
                <Text style={styles.statDivider}>·</Text>
                <Text style={styles.statText}>{item.duration}</Text>
              </View>
            ) : null}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />
      {ratingTripId && (
        <TripRatingModal
          tripId={ratingTripId}
          visible={true}
          onClose={() => setRatingTripId(null)}
          onSaved={handleRatingSaved}
        />
      )}

      <View style={styles.header}>
        <Text style={styles.title}>تاريخ الرحلات</Text>
        <TouchableOpacity onPress={() => { setRefreshing(true); loadTrips(); }}>
          <MaterialIcons name="refresh" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={styles.filtersOuter}>
        <FlatList
          horizontal
          data={FILTERS}
          keyExtractor={f => f}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filtersList}
          renderItem={({ item: filter }) => (
            <TouchableOpacity
              style={[styles.filterChip, activeFilter === filter && styles.filterChipActive]}
              onPress={() => setActiveFilter(filter)}
              activeOpacity={0.85}
            >
              <Text style={[styles.filterText, activeFilter === filter && styles.filterTextActive]}>{filter}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={Colors.accent} />
        </View>
      ) : (
        <FlatList
          data={filteredTrips}
          keyExtractor={t => t.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadTrips(); }}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <MaterialIcons name="history" size={64} color={Colors.borderLight} />
              <Text style={styles.emptyText}>لا توجد رحلات</Text>
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
  filtersOuter: { backgroundColor: Colors.bgWhite, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  filtersList: { paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, gap: Spacing.xs },
  filterChip: {
    paddingHorizontal: 18, paddingVertical: 8, borderRadius: BorderRadius.full,
    backgroundColor: Colors.bgLight, borderWidth: 1, borderColor: Colors.border,
  },
  filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  filterText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
  filterTextActive: { color: '#fff', fontWeight: '700' },
  listContent: { padding: Spacing.md, gap: Spacing.sm },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  tripCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadows.sm, borderWidth: 1, borderColor: Colors.borderLight,
  },
  tripHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: BorderRadius.full },
  statusText: { fontSize: Typography.xs, fontWeight: '700' },
  tripDateRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  tripDate: { fontSize: Typography.xs, color: Colors.textLight },
  driverRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: Spacing.sm },
  avatar: { width: 48, height: 48, borderRadius: 24, marginLeft: Spacing.sm },
  driverInfo: { flex: 1 },
  driverName: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  vehicleName: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right' },
  tripPrice: { fontSize: Typography.lg, fontWeight: '800', color: Colors.primary },
  routeRow: { gap: Spacing.xs, marginBottom: Spacing.sm },
  routePoint: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: Colors.bgLight, borderRadius: 8, padding: 8,
  },
  routeText: { flex: 1, fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right' },
  tripFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingTop: Spacing.sm, borderTopWidth: 1, borderTopColor: Colors.borderLight },
  ratingRow: { flexDirection: 'row-reverse', gap: 2 },
  statsRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  statText: { fontSize: Typography.xs, color: Colors.textSecondary },
  statDivider: { color: Colors.textLight },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: Typography.lg, color: Colors.textLight, marginTop: Spacing.md },
  rateBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4,
    backgroundColor: Colors.accent + '18', borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 5,
    borderWidth: 1, borderColor: Colors.accent + '40',
  },
  rateBtnText: { fontSize: Typography.xs, fontWeight: '700', color: Colors.accent },
});

const rStyle = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: {
    backgroundColor: Colors.bgWhite, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.xl, paddingBottom: Spacing.xl + 8, alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 12, elevation: 10,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    marginBottom: Spacing.md,
  },
  title: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary, marginBottom: Spacing.lg },
  starsRow: { flexDirection: 'row', gap: 6, marginBottom: Spacing.sm },
  label: { fontSize: Typography.md, fontWeight: '600', color: Colors.accent, marginBottom: Spacing.lg },
  btnRow: { flexDirection: 'row-reverse', gap: Spacing.sm, width: '100%', marginTop: Spacing.md },
  skipBtn: {
    flex: 1, paddingVertical: 14, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, alignItems: 'center',
  },
  skipText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '600' },
  submitBtn: {
    flex: 2, paddingVertical: 14, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary, alignItems: 'center',
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { fontSize: Typography.base, color: '#fff', fontWeight: '700' },
  success: { alignItems: 'center', paddingVertical: Spacing.xl },
  successIcon: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: Colors.success,
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
  },
  successText: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary },
});
