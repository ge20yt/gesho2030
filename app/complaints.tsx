import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, FlatList, RefreshControl,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';

// ── Types ──────────────────────────────────────────────────────────
interface ComplaintRow {
  id: string;
  trip_id: string | null;
  reason: string;
  description: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  created_at: string;
}

interface TripOption {
  id: string;
  from_location: string;
  to_location: string;
  created_at: string;
  price: number;
}

const COMPLAINT_REASONS = [
  'سلوك السائق',
  'قيادة خطرة',
  'تلاعب بالسعر',
  'تأخر الوصول',
  'مركبة غير نظيفة',
  'رفض الرحلة',
  'أخرى',
];

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending:   { label: 'قيد المراجعة', color: Colors.warning,   bg: Colors.warning   + '18' },
  reviewed:  { label: 'تمت المراجعة', color: Colors.primary,   bg: Colors.primary   + '18' },
  resolved:  { label: 'تم الحل',      color: Colors.success,   bg: Colors.success   + '18' },
  dismissed: { label: 'مرفوضة',       color: Colors.textLight, bg: Colors.borderLight },
};

export default function ComplaintsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuthContext();
  const params = useLocalSearchParams<{ tripId?: string }>();

  const [activeTab, setActiveTab] = useState<'submit' | 'history'>('submit');

  // ── Form state ─────────────────────────────────────────────────
  const [selectedReason, setSelectedReason] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTripId, setSelectedTripId] = useState<string | null>(params.tripId ?? null);
  const [submitting, setSubmitting] = useState(false);

  // ── Trip list for picker ───────────────────────────────────────
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [tripsLoading, setTripsLoading] = useState(false);
  const [showTripPicker, setShowTripPicker] = useState(false);

  // ── History ────────────────────────────────────────────────────
  const [complaints, setComplaints] = useState<ComplaintRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // ── Load user trips for picker ─────────────────────────────────
  const loadTrips = useCallback(async () => {
    if (!user?.id) return;
    setTripsLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('trips')
        .select('id, from_location, to_location, created_at, price')
        .eq('user_id', user.id)
        .in('status', ['completed', 'cancelled'])
        .order('created_at', { ascending: false })
        .limit(20);
      setTrips((data ?? []) as TripOption[]);
    } catch { /* silent */ }
    finally { setTripsLoading(false); }
  }, [user?.id]);

  // ── Load complaint history ─────────────────────────────────────
  const loadComplaints = useCallback(async () => {
    if (!user?.id) return;
    setHistoryLoading(true);
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('complaints')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30);
      setComplaints((data ?? []) as ComplaintRow[]);
    } catch { /* silent */ }
    finally { setHistoryLoading(false); setRefreshing(false); }
  }, [user?.id]);

  useEffect(() => { loadTrips(); }, [loadTrips]);
  useEffect(() => { if (activeTab === 'history') loadComplaints(); }, [activeTab, loadComplaints]);

  // ── Get label for selected trip ────────────────────────────────
  const selectedTrip = trips.find(t => t.id === selectedTripId);
  const tripLabel = selectedTrip
    ? `${selectedTrip.from_location} → ${selectedTrip.to_location}`
    : 'اختر الرحلة (اختياري)';

  // ── Submit complaint ───────────────────────────────────────────
  const handleSubmit = async () => {
    if (!selectedReason) {
      showAlert('تنبيه', 'يرجى اختيار نوع المشكلة');
      return;
    }
    if (!description.trim() || description.trim().length < 10) {
      showAlert('تنبيه', 'يرجى كتابة تفاصيل الشكوى (10 أحرف على الأقل)');
      return;
    }
    if (!user?.id) {
      showAlert('خطأ', 'يجب تسجيل الدخول أولاً');
      return;
    }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.from('complaints').insert({
        user_id: user.id,
        trip_id: selectedTripId ?? null,
        reason: selectedReason,
        description: description.trim(),
        status: 'pending',
      });

      if (error) {
        showAlert('خطأ', `فشل إرسال الشكوى: ${error.message}`);
        return;
      }

      showAlert(
        'تم الإرسال ✅',
        'تم إرسال شكواك بنجاح. سيتم مراجعتها خلال 24 ساعة والرد عليك.',
        [{ text: 'حسناً', onPress: () => { setDescription(''); setSelectedReason(''); setSelectedTripId(null); setActiveTab('history'); } }]
      );
    } catch (e: any) {
      showAlert('خطأ', e.message ?? 'حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-forward" size={22} color={Colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.title}>الشكاوى والتقييمات</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabsRow}>
        {[{ key: 'submit', label: 'إرسال شكوى' }, { key: 'history', label: 'شكاواي' }].map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tab, activeTab === tab.key && styles.tabActive]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>{tab.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {activeTab === 'submit' ? (
        <ScrollView style={styles.body} showsVerticalScrollIndicator={false} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">

          {/* Trip Picker */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>الرحلة المرتبطة (اختياري)</Text>
            <TouchableOpacity
              style={styles.tripPickerBtn}
              onPress={() => setShowTripPicker(v => !v)}
              activeOpacity={0.85}
            >
              <MaterialIcons name={showTripPicker ? 'expand-less' : 'expand-more'} size={20} color={Colors.textSecondary} />
              <Text style={[styles.tripPickerText, selectedTripId && { color: Colors.textPrimary }]} numberOfLines={1}>
                {tripLabel}
              </Text>
              <MaterialIcons name="directions-car" size={18} color={Colors.primary} />
            </TouchableOpacity>

            {showTripPicker && (
              <View style={styles.tripList}>
                <TouchableOpacity
                  style={[styles.tripOption, !selectedTripId && styles.tripOptionSelected]}
                  onPress={() => { setSelectedTripId(null); setShowTripPicker(false); }}
                >
                  <Text style={styles.tripOptionText}>بدون رحلة محددة</Text>
                </TouchableOpacity>
                {tripsLoading ? (
                  <ActivityIndicator size="small" color={Colors.primary} style={{ paddingVertical: 12 }} />
                ) : trips.length === 0 ? (
                  <Text style={styles.noTripsText}>لا توجد رحلات سابقة</Text>
                ) : (
                  trips.map(trip => (
                    <TouchableOpacity
                      key={trip.id}
                      style={[styles.tripOption, trip.id === selectedTripId && styles.tripOptionSelected]}
                      onPress={() => { setSelectedTripId(trip.id); setShowTripPicker(false); }}
                    >
                      <Text style={styles.tripOptionPrice}>{Number(trip.price).toFixed(0)} ج.م</Text>
                      <View style={styles.tripOptionInfo}>
                        <Text style={styles.tripOptionText} numberOfLines={1}>{trip.from_location} → {trip.to_location}</Text>
                        <Text style={styles.tripOptionDate}>{new Date(trip.created_at).toLocaleDateString('ar-EG')}</Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </View>
            )}
          </View>

          {/* Reason */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>نوع المشكلة *</Text>
            <View style={styles.reasonGrid}>
              {COMPLAINT_REASONS.map(reason => (
                <TouchableOpacity
                  key={reason}
                  style={[styles.reasonBtn, selectedReason === reason && styles.reasonBtnActive]}
                  onPress={() => setSelectedReason(reason)}
                  activeOpacity={0.85}
                >
                  {selectedReason === reason && (
                    <MaterialIcons name="check-circle" size={14} color="#fff" />
                  )}
                  <Text style={[styles.reasonText, selectedReason === reason && styles.reasonTextActive]}>
                    {reason}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Description */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>تفاصيل الشكوى *</Text>
            <TextInput
              style={styles.descInput}
              placeholder="اشرح مشكلتك بالتفصيل... (10 أحرف على الأقل)"
              placeholderTextColor={Colors.textLight}
              multiline
              numberOfLines={5}
              value={description}
              onChangeText={setDescription}
              textAlign="right"
              textAlignVertical="top"
            />
            <Text style={styles.charCount}>{description.length} / 500</Text>
          </View>

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitBtn, submitting && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={submitting}
            activeOpacity={0.9}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <MaterialIcons name="send" size={18} color="#fff" />
                <Text style={styles.submitBtnText}>إرسال الشكوى</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      ) : (
        /* History Tab */
        <FlatList
          data={complaints}
          keyExtractor={c => c.id}
          contentContainerStyle={styles.historyList}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadComplaints(); }}
              tintColor={Colors.primary}
            />
          }
          ListEmptyComponent={
            historyLoading ? (
              <View style={styles.historyLoader}>
                <ActivityIndicator size="large" color={Colors.primary} />
                <Text style={styles.historyLoaderText}>جارٍ التحميل...</Text>
              </View>
            ) : (
              <View style={styles.historyEmpty}>
                <MaterialIcons name="report-off" size={56} color={Colors.borderLight} />
                <Text style={styles.historyEmptyText}>لا توجد شكاوى بعد</Text>
                <Text style={styles.historyEmptySub}>ستظهر هنا شكاواك المرسلة</Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            const cfg = STATUS_CONFIG[item.status] ?? STATUS_CONFIG['pending'];
            return (
              <View style={styles.historyCard}>
                <View style={styles.historyCardTop}>
                  <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
                    <Text style={[styles.statusText, { color: cfg.color }]}>{cfg.label}</Text>
                  </View>
                  <Text style={styles.historyDate}>{new Date(item.created_at).toLocaleDateString('ar-EG')}</Text>
                </View>
                <Text style={styles.historyReason}>{item.reason}</Text>
                <Text style={styles.historyDesc} numberOfLines={3}>{item.description}</Text>
                {item.trip_id && (
                  <View style={styles.tripBadge}>
                    <MaterialIcons name="directions-car" size={12} color={Colors.primary} />
                    <Text style={styles.tripBadgeText}>مرتبطة برحلة</Text>
                  </View>
                )}
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
    backgroundColor: Colors.bgWhite, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  backBtn: { marginLeft: Spacing.sm },
  title: { flex: 1, fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  tabsRow: {
    flexDirection: 'row-reverse', backgroundColor: Colors.bgWhite,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.sm, paddingTop: Spacing.xs,
    gap: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md,
    alignItems: 'center', borderWidth: 1, borderColor: Colors.border,
  },
  tabActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  tabText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
  tabTextActive: { color: '#fff', fontWeight: '700' },
  body: { flex: 1 },
  bodyContent: { padding: Spacing.md, gap: Spacing.md },
  card: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  cardTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing.sm },
  // Trip picker
  tripPickerBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgLight, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm, paddingVertical: 12,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  tripPickerText: { flex: 1, fontSize: Typography.sm, color: Colors.textLight, textAlign: 'right' },
  tripList: { marginTop: Spacing.sm, gap: 6 },
  tripOption: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 10, paddingHorizontal: Spacing.sm,
    borderRadius: BorderRadius.md, backgroundColor: Colors.bgLight,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  tripOptionSelected: { borderColor: Colors.primary + '60', backgroundColor: Colors.primaryLight ?? Colors.primary + '08' },
  tripOptionInfo: { flex: 1 },
  tripOptionText: { fontSize: Typography.sm, color: Colors.textPrimary, textAlign: 'right', fontWeight: '500' },
  tripOptionDate: { fontSize: Typography.xs, color: Colors.textLight, textAlign: 'right', marginTop: 2 },
  tripOptionPrice: { fontSize: Typography.sm, fontWeight: '700', color: Colors.primary },
  noTripsText: { textAlign: 'center', color: Colors.textLight, fontSize: Typography.sm, paddingVertical: 12 },
  // Reason
  reasonGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm },
  reasonBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 5,
    paddingHorizontal: 14, paddingVertical: 9, borderRadius: BorderRadius.full,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bgLight,
  },
  reasonBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  reasonText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '500' },
  reasonTextActive: { color: '#fff', fontWeight: '700' },
  // Description
  descInput: {
    borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md,
    padding: Spacing.md, fontSize: Typography.base, color: Colors.textPrimary,
    minHeight: 120, backgroundColor: Colors.bgLight,
  },
  charCount: { fontSize: Typography.xs, color: Colors.textLight, textAlign: 'left', marginTop: 4 },
  // Submit
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 15, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 8, ...Shadows.md,
  },
  submitBtnText: { color: '#fff', fontSize: Typography.md, fontWeight: '700' },
  // History
  historyList: { padding: Spacing.md, gap: Spacing.sm, paddingBottom: 40 },
  historyLoader: { alignItems: 'center', paddingVertical: 60, gap: 12 },
  historyLoaderText: { color: Colors.textSecondary, fontSize: Typography.sm },
  historyEmpty: { alignItems: 'center', paddingVertical: 80, gap: Spacing.sm },
  historyEmptyText: { fontSize: Typography.lg, color: Colors.textSecondary, fontWeight: '600' },
  historyEmptySub: { fontSize: Typography.sm, color: Colors.textLight, textAlign: 'center' },
  historyCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  historyCardTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.xs },
  statusBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusText: { fontSize: Typography.xs, fontWeight: '700' },
  historyDate: { fontSize: Typography.xs, color: Colors.textLight },
  historyReason: { fontSize: Typography.base, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: 4 },
  historyDesc: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 20 },
  tripBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: Spacing.xs,
    backgroundColor: Colors.primaryLight ?? Colors.primary + '08', borderRadius: 8,
    paddingHorizontal: 8, paddingVertical: 4, alignSelf: 'flex-end',
  },
  tripBadgeText: { fontSize: 10, color: Colors.primary, fontWeight: '600' },
});
