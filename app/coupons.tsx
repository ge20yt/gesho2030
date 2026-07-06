import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ── Types ─────────────────────────────────────────────────────────
interface CouponRow {
  id: string;
  code: string;
  discount_type: 'fixed' | 'percent';
  discount_amount: number;
  min_order_amount: number;
  max_uses: number | null;
  expiry_date: string;
  is_active: boolean;
  description: string | null;
}

interface ApplyResult {
  valid: boolean;
  error?: string;
  coupon_id?: string;
  code?: string;
  discount_type?: 'fixed' | 'percent';
  discount_amount?: number;
  final_price?: number;
  description?: string;
}

const ICON_MAP: Record<string, string> = {
  fixed:   'local-offer',
  percent: 'percent',
};
const COLOR_MAP = [Colors.primary, Colors.success, Colors.accent, Colors.error, '#8B5CF6'];

export default function CouponsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuthContext();
  const params = useLocalSearchParams<{ price?: string; driverId?: string }>();

  const originalPrice = Number(params.price) || 0;

  const [code, setCode] = useState('');
  const [applying, setApplying] = useState(false);
  const [appliedResult, setAppliedResult] = useState<ApplyResult | null>(null);

  const [coupons, setCoupons] = useState<CouponRow[]>([]);
  const [usedIds, setUsedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Load active coupons + user's used coupon IDs ───────────────
  const loadCoupons = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const [couponsRes, usageRes] = await Promise.all([
        supabase
          .from('coupons')
          .select('*')
          .eq('is_active', true)
          .gt('expiry_date', new Date().toISOString())
          .order('created_at', { ascending: false }),
        user?.id
          ? supabase
              .from('coupon_usage')
              .select('coupon_id')
              .eq('user_id', user.id)
          : Promise.resolve({ data: [] }),
      ]);

      if (couponsRes.data) setCoupons(couponsRes.data as CouponRow[]);

      const usedSet = new Set<string>(
        ((usageRes as any).data ?? []).map((u: any) => u.coupon_id as string)
      );
      setUsedIds(usedSet);
    } catch { /* silent */ }
    finally { setLoading(false); setRefreshing(false); }
  }, [user?.id]);

  useEffect(() => { loadCoupons(); }, [loadCoupons]);

  // ── Call edge function to validate + record usage ──────────────
  const validateCode = async (inputCode: string): Promise<ApplyResult> => {
    if (!user?.id) return { valid: false, error: 'يجب تسجيل الدخول أولاً' };

    const supabase = getSupabaseClient();
    try {
      const { data, error } = await supabase.functions.invoke('validate-coupon', {
        body: {
          code: inputCode.trim().toUpperCase(),
          user_id: user.id,
          order_amount: originalPrice,
        },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const text = await error.context?.text();
            msg = text || msg;
          } catch { /* silent */ }
        }
        return { valid: false, error: msg };
      }

      return data as ApplyResult;
    } catch (e: any) {
      return { valid: false, error: e.message ?? 'خطأ في التحقق' };
    }
  };

  // ── Handle manual code input ───────────────────────────────────
  const handleApplyCode = async () => {
    if (!code.trim()) return;
    setApplying(true);
    const result = await validateCode(code.trim());
    setApplying(false);

    if (!result.valid) {
      showAlert('كوبون غير صالح', result.error ?? 'الكود غير صحيح');
      return;
    }

    setAppliedResult(result);
    setCode('');
    // Refresh to show this coupon as used
    loadCoupons();
  };

  // ── Tap on a coupon card ───────────────────────────────────────
  const handleSelectCoupon = async (coupon: CouponRow) => {
    if (usedIds.has(coupon.id)) {
      showAlert('مستخدم', 'لقد استخدمت هذا الكوبون من قبل');
      return;
    }
    if (originalPrice > 0 && originalPrice < coupon.min_order_amount) {
      showAlert('الحد الأدنى', `هذا الكوبون يتطلب حد أدنى ${coupon.min_order_amount} ج.م`);
      return;
    }

    setApplying(true);
    const result = await validateCode(coupon.code);
    setApplying(false);

    if (!result.valid) {
      showAlert('تعذر التطبيق', result.error ?? 'الكوبون غير صالح');
      return;
    }

    setAppliedResult(result);
    loadCoupons();

    // If opened from driver screen, navigate back with coupon data
    if (params.driverId) {
      router.navigate({
        pathname: '/driver/[id]',
        params: {
          id: params.driverId,
          appliedCouponCode: result.code,
          appliedCouponDiscount: String(result.discount_amount ?? 0),
          appliedCouponType: result.discount_type ?? 'fixed',
          appliedCouponMax: '0',
        },
      } as any);
    }
  };

  const savedAmount = appliedResult?.discount_amount ?? 0;
  const discountedPrice = appliedResult?.final_price ?? originalPrice;

  const handleConfirm = () => {
    if (!appliedResult || !params.driverId) {
      router.back();
      return;
    }
    router.navigate({
      pathname: '/driver/[id]',
      params: {
        id: params.driverId,
        appliedCouponCode: appliedResult.code,
        appliedCouponDiscount: String(appliedResult.discount_amount ?? 0),
        appliedCouponType: appliedResult.discount_type ?? 'fixed',
        appliedCouponMax: '0',
      },
    } as any);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>كوبونات الخصم</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Code Input */}
        <View style={styles.codeInputRow}>
          <TouchableOpacity
            style={[styles.applyBtn, applying && { opacity: 0.7 }]}
            onPress={handleApplyCode}
            disabled={applying}
            activeOpacity={0.85}
          >
            {applying ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles.applyBtnText}>تطبيق</Text>
            )}
          </TouchableOpacity>
          <TextInput
            style={styles.codeInput}
            placeholder="أدخل كود الخصم..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={code}
            onChangeText={setCode}
            textAlign="right"
            autoCapitalize="characters"
            onSubmitEditing={handleApplyCode}
          />
          <MaterialIcons name="confirmation-number" size={20} color="rgba(255,255,255,0.6)" style={styles.codeIcon} />
        </View>
      </LinearGradient>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCoupons(); }} tintColor={Colors.accent} />
        }
      >
        {/* Applied coupon banner */}
        {appliedResult?.valid ? (
          <View style={styles.appliedCard}>
            <TouchableOpacity style={styles.removeCoupon} onPress={() => setAppliedResult(null)}>
              <MaterialIcons name="close" size={16} color={Colors.error} />
            </TouchableOpacity>
            <View style={styles.appliedInfo}>
              <Text style={styles.appliedTitle}>تم تطبيق الكوبون!</Text>
              <Text style={styles.appliedCode}>{appliedResult.code}</Text>
              {appliedResult.description ? (
                <Text style={styles.appliedDesc}>{appliedResult.description}</Text>
              ) : null}
            </View>
            <View style={styles.savingsBadge}>
              <Text style={styles.savingsText}>وفرت {savedAmount} ج.م</Text>
            </View>
            <MaterialIcons name="check-circle" size={28} color={Colors.success} />
          </View>
        ) : null}

        {/* Price summary */}
        {originalPrice > 0 ? (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>ملخص السعر</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryVal}>{originalPrice} ج.م</Text>
              <Text style={styles.summaryLabel}>السعر الأصلي</Text>
            </View>
            {appliedResult?.valid ? (
              <View style={styles.summaryRow}>
                <Text style={[styles.summaryVal, { color: Colors.success }]}>- {savedAmount} ج.م</Text>
                <Text style={styles.summaryLabel}>قيمة الخصم</Text>
              </View>
            ) : null}
            <View style={[styles.summaryRow, styles.totalRow]}>
              <Text style={styles.totalVal}>{discountedPrice} ج.م</Text>
              <Text style={styles.totalLabel}>الإجمالي</Text>
            </View>
          </View>
        ) : null}

        {/* Available Coupons */}
        <Text style={styles.sectionTitle}>العروض المتاحة</Text>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={Colors.accent} size="large" />
            <Text style={styles.loaderText}>جارٍ تحميل الكوبونات...</Text>
          </View>
        ) : coupons.length === 0 ? (
          <View style={styles.emptyWrap}>
            <MaterialIcons name="local-offer" size={48} color={Colors.borderLight} />
            <Text style={styles.emptyText}>لا توجد كوبونات متاحة حالياً</Text>
          </View>
        ) : (
          coupons.map((coupon, idx) => {
            const isUsed    = usedIds.has(coupon.id);
            const isApplied = appliedResult?.coupon_id === coupon.id;
            const color     = COLOR_MAP[idx % COLOR_MAP.length];
            const icon      = ICON_MAP[coupon.discount_type] ?? 'local-offer';
            const daysLeft  = Math.max(0, Math.ceil(
              (new Date(coupon.expiry_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            ));
            const expiryLabel = daysLeft === 0 ? 'ينتهي اليوم!' : `ينتهي خلال ${daysLeft} يوم`;

            return (
              <TouchableOpacity
                key={coupon.id}
                style={[
                  styles.couponCard,
                  isUsed && styles.couponUsed,
                  isApplied && styles.couponApplied,
                ]}
                onPress={() => handleSelectCoupon(coupon)}
                activeOpacity={isUsed ? 1 : 0.88}
                disabled={applying}
              >
                <View style={[styles.couponStripe, { backgroundColor: isUsed ? Colors.border : color }]} />
                <View style={styles.couponDash} />

                {/* Right: info */}
                <View style={styles.couponRight}>
                  <View style={styles.couponCodeRow}>
                    {isApplied && <MaterialIcons name="check-circle" size={16} color={Colors.success} />}
                    {isUsed && (
                      <View style={styles.usedBadge}>
                        <Text style={styles.usedBadgeText}>مستخدم</Text>
                      </View>
                    )}
                    <Text style={[styles.couponCode, isUsed && styles.couponCodeUsed]}>{coupon.code}</Text>
                  </View>
                  {coupon.description ? (
                    <Text style={[styles.couponDesc, isUsed && { color: Colors.textLight }]} numberOfLines={2}>
                      {coupon.description}
                    </Text>
                  ) : null}
                  <View style={styles.couponMeta}>
                    <Text style={[styles.couponExpiry, daysLeft <= 3 && { color: Colors.error }, isUsed && { color: Colors.textLight }]}>
                      {expiryLabel}
                    </Text>
                    {coupon.min_order_amount > 0 ? (
                      <Text style={[styles.couponMin, isUsed && { color: Colors.textLight }]}>
                        حد أدنى {coupon.min_order_amount} ج.م
                      </Text>
                    ) : null}
                  </View>
                </View>

                {/* Left: discount badge */}
                <View style={[styles.couponLeft, { backgroundColor: isUsed ? Colors.bgLight : color + '12' }]}>
                  <MaterialIcons name={icon as any} size={24} color={isUsed ? Colors.textLight : color} />
                  <Text style={[styles.discountAmount, { color: isUsed ? Colors.textLight : color }]}>
                    {coupon.discount_type === 'percent'
                      ? `${coupon.discount_amount}%`
                      : `${coupon.discount_amount} ج`}
                  </Text>
                  <Text style={[styles.discountLabel, { color: isUsed ? Colors.textLight : color }]}>خصم</Text>
                </View>
              </TouchableOpacity>
            );
          })
        )}

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + Spacing.sm }]}>
        <TouchableOpacity style={styles.confirmBtn} onPress={handleConfirm} activeOpacity={0.9}>
          <Text style={styles.confirmBtnText}>
            {appliedResult?.valid
              ? `تأكيد — الدفع ${discountedPrice} ج.م`
              : 'متابعة بدون خصم'}
          </Text>
          <MaterialIcons name="arrow-back" size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '700' },
  codeInputRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm, marginTop: Spacing.xs,
  },
  codeIcon: { paddingHorizontal: 4 },
  codeInput: {
    flex: 1, color: '#fff', fontSize: Typography.base,
    paddingVertical: 14, textAlign: 'right',
  },
  applyBtn: {
    backgroundColor: Colors.accent, borderRadius: BorderRadius.sm,
    paddingHorizontal: 18, paddingVertical: 10,
    minWidth: 70, alignItems: 'center',
  },
  applyBtnText: { color: Colors.bgDark, fontSize: Typography.sm, fontWeight: '800' },
  scroll: { padding: Spacing.md },
  appliedCard: {
    backgroundColor: Colors.success + '12', borderRadius: BorderRadius.lg,
    borderWidth: 1.5, borderColor: Colors.success + '40',
    padding: Spacing.md, flexDirection: 'row-reverse', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.sm,
  },
  appliedInfo: { flex: 1 },
  appliedTitle: { fontSize: Typography.sm, fontWeight: '700', color: Colors.success, textAlign: 'right' },
  appliedCode: { fontSize: Typography.base, fontWeight: '800', color: Colors.textPrimary, textAlign: 'right' },
  appliedDesc: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  savingsBadge: {
    backgroundColor: Colors.success, borderRadius: BorderRadius.full,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  savingsText: { color: '#fff', fontSize: Typography.xs, fontWeight: '700' },
  removeCoupon: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: Colors.error + '15', alignItems: 'center', justifyContent: 'center',
  },
  summaryCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  summaryTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing.sm },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  summaryLabel: { fontSize: Typography.base, color: Colors.textSecondary },
  summaryVal: { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary },
  totalRow: { borderBottomWidth: 0, paddingTop: Spacing.sm },
  totalLabel: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary },
  totalVal: { fontSize: Typography.xl, fontWeight: '800', color: Colors.primary },
  sectionTitle: {
    fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary,
    textAlign: 'right', marginBottom: Spacing.sm,
  },
  loaderWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  loaderText: { color: Colors.textSecondary, fontSize: Typography.sm },
  emptyWrap: { alignItems: 'center', paddingVertical: 40, gap: 10 },
  emptyText: { color: Colors.textLight, fontSize: Typography.base },
  couponCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    flexDirection: 'row-reverse', marginBottom: Spacing.sm,
    overflow: 'hidden', borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  couponUsed: { opacity: 0.55 },
  couponApplied: { borderColor: Colors.success, borderWidth: 1.5 },
  couponStripe: { width: 5 },
  couponDash: {
    width: 1, marginVertical: 12,
    borderStyle: 'dashed', borderWidth: 1, borderColor: Colors.borderLight,
  },
  couponRight: { flex: 1, padding: Spacing.md },
  couponCodeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 },
  couponCode: { fontSize: Typography.md, fontWeight: '800', color: Colors.textPrimary },
  couponCodeUsed: { color: Colors.textLight },
  couponDesc: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 6, lineHeight: 18 },
  couponMeta: { flexDirection: 'row-reverse', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 },
  couponExpiry: { fontSize: Typography.xs, color: Colors.warning, fontWeight: '500' },
  couponMin: { fontSize: Typography.xs, color: Colors.textLight },
  couponLeft: {
    width: 88, alignItems: 'center', justifyContent: 'center',
    paddingVertical: Spacing.md, gap: 4,
  },
  discountAmount: { fontSize: Typography.xl, fontWeight: '800' },
  discountLabel: { fontSize: Typography.xs, fontWeight: '600' },
  usedBadge: {
    backgroundColor: Colors.border, borderRadius: 6,
    paddingHorizontal: 6, paddingVertical: 2,
  },
  usedBadgeText: { fontSize: 10, color: Colors.textLight, fontWeight: '600' },
  footer: {
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm,
    backgroundColor: Colors.bgWhite, borderTopWidth: 1, borderTopColor: Colors.borderLight,
  },
  confirmBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 15, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 8, ...Shadows.md,
  },
  confirmBtnText: { color: '#fff', fontSize: Typography.base, fontWeight: '700' },
});
