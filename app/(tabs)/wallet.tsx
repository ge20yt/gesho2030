import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, FlatList, TextInput,
  Modal, ActivityIndicator, RefreshControl, Linking, Platform,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { PAYMENT_METHODS } from '@/services/mockData';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { FunctionsHttpError } from '@supabase/supabase-js';

// ── Types ──────────────────────────────────────────────────────────
interface WalletRow {
  id: string;
  balance: number;
  total_charged: number;
  total_spent: number;
}

interface TransactionRow {
  id: string;
  type: 'credit' | 'debit';
  amount: number;
  description: string;
  reference_id: string | null;
  created_at: string;
}

// ── Payment method selector ────────────────────────────────────────
type PayMethod = 'wallet' | 'card';

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ar-EG', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function WalletScreen() {
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuthContext();
  const router = useRouter();

  const [wallet, setWallet] = useState<WalletRow | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // ── Charge modal state ─────────────────────────────────────────
  const [chargeModal, setChargeModal] = useState(false);
  const [chargeAmount, setChargeAmount] = useState('');
  const [payMethod, setPayMethod] = useState<PayMethod>('card');
  const [charging, setCharging] = useState(false);
  const [stripeLoading, setStripeLoading] = useState(false);

  // ── Fetch or create wallet ─────────────────────────────────────
  const loadWallet = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const supabase = getSupabaseClient();

      // Upsert wallet (create if not exists)
      await supabase
        .from('wallets')
        .upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true });

      const { data: walletData } = await supabase
        .from('wallets')
        .select('id, balance, total_charged, total_spent')
        .eq('user_id', user.id)
        .single();

      if (walletData) setWallet(walletData as WalletRow);

      // Fetch transactions
      const { data: txData } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      setTransactions((txData ?? []) as TransactionRow[]);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadWallet(); }, [loadWallet]);

  // ── Cash top-up (direct DB write, no payment gateway) ─────────
  const handleCashCharge = async (amt: number) => {
    if (!user?.id || !wallet?.id) return;
    const supabase = getSupabaseClient();

    await supabase.from('wallet_transactions').insert({
      user_id: user.id,
      type: 'credit',
      amount: amt,
      description: 'شحن المحفظة — نقداً',
    });

    const newBalance = (wallet.balance ?? 0) + amt;
    const newTotalCharged = (wallet.total_charged ?? 0) + amt;
    await supabase.from('wallets').update({
      balance: newBalance,
      total_charged: newTotalCharged,
      updated_at: new Date().toISOString(),
    }).eq('user_id', user.id);
  };

  // ── Stripe card top-up via Edge Function ───────────────────────
  const handleStripeCharge = async (amt: number): Promise<boolean> => {
    if (!user?.id) return false;
    const supabase = getSupabaseClient();
    setStripeLoading(true);
    try {
      const { data: sessionData, error } = await supabase.functions.invoke('create-payment', {
        body: {
          amount: amt,
          description: `شحن محفظة تك توكي — ${amt} ج.م`,
        },
      });

      if (error) {
        let msg = error.message;
        if (error instanceof FunctionsHttpError) {
          try {
            const statusCode = error.context?.status ?? 500;
            const textContent = await error.context?.text();
            msg = `[${statusCode}] ${textContent || error.message}`;
          } catch { /* silent */ }
        }
        showAlert('خطأ في الدفع', `Stripe: ${msg}`);
        return false;
      }

      if (!sessionData?.url) {
        showAlert('خطأ', 'لم يتم إنشاء رابط الدفع');
        return false;
      }

      // Open Stripe Checkout URL in browser
      const canOpen = await Linking.canOpenURL(sessionData.url);
      if (canOpen) {
        await Linking.openURL(sessionData.url);
        // After payment we can't auto-confirm on mobile, so inform user
        showAlert(
          'تم فتح صفحة الدفع',
          'أكمل عملية الدفع في المتصفح. سيتم تحديث رصيدك تلقائياً بعد نجاح الدفع.',
          [{ text: 'حسناً', onPress: () => loadWallet() }]
        );
        return true;
      } else {
        showAlert('خطأ', 'لا يمكن فتح رابط الدفع');
        return false;
      }
    } catch (e: any) {
      showAlert('خطأ', e.message ?? 'حدث خطأ أثناء الدفع');
      return false;
    } finally {
      setStripeLoading(false);
    }
  };

  // ── Main charge handler ────────────────────────────────────────
  const handleCharge = async () => {
    const amt = parseFloat(chargeAmount);
    if (!amt || amt <= 0 || isNaN(amt)) {
      showAlert('تنبيه', 'أدخل مبلغ صحيح للشحن');
      return;
    }
    if (!user?.id || !wallet?.id) {
      showAlert('خطأ', 'يجب تسجيل الدخول أولاً');
      return;
    }

    setCharging(true);
    try {
      if (payMethod === 'card') {
        // Stripe payment — opens browser
        const ok = await handleStripeCharge(amt);
        if (ok) {
          setChargeModal(false);
          setChargeAmount('');
        }
      } else {
        // Direct wallet credit (cash / manual)
        await handleCashCharge(amt);
        setChargeModal(false);
        setChargeAmount('');
        showAlert('تم الشحن ✅', `تم إضافة ${amt} ج.م إلى محفظتك`);
        loadWallet();
      }
    } catch (e: any) {
      showAlert('خطأ', e.message ?? 'حدث خطأ أثناء شحن المحفظة');
    } finally {
      setCharging(false);
    }
  };

  const balance = wallet?.balance ?? 0;
  const totalCharged = wallet?.total_charged ?? 0;
  const totalSpent = wallet?.total_spent ?? 0;

  const getTransactionIcon = (type: string) => (type === 'credit' ? 'add-circle' : 'remove-circle');
  const getTransactionColor = (type: string) => (type === 'credit' ? Colors.success : Colors.error);

  const renderTransaction = ({ item }: { item: TransactionRow }) => (
    <View style={styles.transactionRow}>
      <View style={styles.transactionLeft}>
        <Text style={[styles.transactionAmount, { color: getTransactionColor(item.type) }]}>
          {item.type === 'credit' ? '+' : '-'}{Math.abs(Number(item.amount)).toFixed(0)} ج.م
        </Text>
        <Text style={styles.transactionDate}>{formatDate(item.created_at)}</Text>
      </View>
      <View style={styles.transactionCenter}>
        <Text style={styles.transactionDesc} numberOfLines={2}>{item.description}</Text>
      </View>
      <View style={[styles.transactionIcon, { backgroundColor: getTransactionColor(item.type) + '18' }]}>
        <MaterialIcons name={getTransactionIcon(item.type) as any} size={22} color={getTransactionColor(item.type)} />
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, styles.center, { paddingTop: insets.top }]}>
        <StatusBar style="light" />
        <ActivityIndicator size="large" color={Colors.accent} />
        <Text style={styles.loadingText}>جارٍ تحميل المحفظة...</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Balance Card */}
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy, Colors.primary]} style={styles.balanceCard}>
        <Text style={styles.balanceLabel}>رصيد المحفظة</Text>
        <Text style={styles.balanceAmount}>{balance.toFixed(2)}</Text>
        <Text style={styles.balanceCurrency}>ج.م</Text>

        {/* Stats row */}
        <View style={styles.miniStats}>
          <View style={styles.miniStatItem}>
            <MaterialIcons name="add-circle-outline" size={16} color={Colors.accent} />
            <Text style={styles.miniStatValue}>{totalCharged.toFixed(0)}</Text>
            <Text style={styles.miniStatLabel}>ج.م محملة</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStatItem}>
            <MaterialIcons name="payments" size={16} color={Colors.accent} />
            <Text style={styles.miniStatValue}>{totalSpent.toFixed(0)}</Text>
            <Text style={styles.miniStatLabel}>ج.م أنفقت</Text>
          </View>
          <View style={styles.miniStatDivider} />
          <View style={styles.miniStatItem}>
            <MaterialIcons name="receipt-long" size={16} color={Colors.accent} />
            <Text style={styles.miniStatValue}>{transactions.length}</Text>
            <Text style={styles.miniStatLabel}>معاملة</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.cardActions}>
          <TouchableOpacity style={styles.cardActionBtn} onPress={() => setChargeModal(true)}>
            <MaterialIcons name="add" size={20} color={Colors.accent} />
            <Text style={styles.cardActionText}>شحن المحفظة</Text>
          </TouchableOpacity>
          <View style={styles.cardActionDivider} />
          <TouchableOpacity
            style={styles.cardActionBtn}
            onPress={() => router.push('/payment' as any)}
          >
            <MaterialIcons name="payment" size={20} color={Colors.accent} />
            <Text style={styles.cardActionText}>الدفع</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Payment Methods */}
      <View style={styles.paymentSection}>
        <Text style={styles.sectionTitle}>طرق الدفع المتاحة</Text>
        <View style={styles.paymentMethods}>
          {PAYMENT_METHODS.slice(0, 4).map(method => (
            <View key={method.id} style={styles.paymentMethodItem}>
              <View style={[styles.paymentMethodIcon, { backgroundColor: method.color + '18' }]}>
                <MaterialIcons name="payment" size={20} color={method.color} />
              </View>
              <Text style={styles.paymentMethodName}>{method.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Transactions */}
      <View style={styles.transactionSection}>
        <View style={styles.transactionHeader}>
          <Text style={styles.txCount}>{transactions.length} معاملة</Text>
          <Text style={styles.sectionTitle}>آخر العمليات</Text>
        </View>

        <FlatList
          data={transactions}
          keyExtractor={t => t.id}
          renderItem={renderTransaction}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); loadWallet(); }}
              tintColor={Colors.accent}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyTx}>
              <MaterialIcons name="receipt-long" size={48} color={Colors.borderLight} />
              <Text style={styles.emptyTxText}>لا توجد معاملات بعد</Text>
              <Text style={styles.emptyTxSub}>ستظهر هنا جميع عمليات الشحن والدفع</Text>
            </View>
          }
        />
      </View>

      {/* Charge Modal */}
      <Modal visible={chargeModal} transparent animationType="slide" onRequestClose={() => setChargeModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + Spacing.md }]}>
            <View style={styles.modalHeader}>
              <TouchableOpacity onPress={() => setChargeModal(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <MaterialIcons name="close" size={24} color={Colors.textSecondary} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>شحن المحفظة</Text>
            </View>

            {/* Payment method toggle */}
            <View style={styles.payMethodToggle}>
              <TouchableOpacity
                style={[styles.payMethodBtn, payMethod === 'card' && styles.payMethodBtnActive]}
                onPress={() => setPayMethod('card')}
                activeOpacity={0.85}
              >
                <MaterialIcons name="credit-card" size={18} color={payMethod === 'card' ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.payMethodText, payMethod === 'card' && styles.payMethodTextActive]}>
                  بطاقة (Stripe)
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.payMethodBtn, payMethod === 'wallet' && styles.payMethodBtnActive]}
                onPress={() => setPayMethod('wallet')}
                activeOpacity={0.85}
              >
                <MaterialIcons name="account-balance-wallet" size={18} color={payMethod === 'wallet' ? '#fff' : Colors.textSecondary} />
                <Text style={[styles.payMethodText, payMethod === 'wallet' && styles.payMethodTextActive]}>
                  نقداً / تحويل
                </Text>
              </TouchableOpacity>
            </View>

            {/* Stripe notice */}
            {payMethod === 'card' && (
              <View style={styles.stripeNotice}>
                <MaterialIcons name="lock" size={14} color={Colors.success} />
                <Text style={styles.stripeNoticeText}>
                  دفع آمن عبر Stripe — سيتم فتح صفحة الدفع في المتصفح
                </Text>
              </View>
            )}

            <Text style={styles.chargeLabel}>المبلغ (ج.م)</Text>
            <TextInput
              style={styles.chargeInput}
              value={chargeAmount}
              onChangeText={setChargeAmount}
              keyboardType="numeric"
              placeholder="أدخل المبلغ"
              placeholderTextColor={Colors.textLight}
              textAlign="right"
            />

            <View style={styles.quickAmounts}>
              {['50', '100', '200', '500'].map(amt => (
                <TouchableOpacity
                  key={amt}
                  style={[styles.quickAmountBtn, chargeAmount === amt && styles.quickAmountActive]}
                  onPress={() => setChargeAmount(amt)}
                  activeOpacity={0.85}
                >
                  <Text style={[styles.quickAmountText, chargeAmount === amt && styles.quickAmountTextActive]}>
                    {amt} ج.م
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[styles.chargeBtn, (charging || stripeLoading) && { opacity: 0.7 }]}
              onPress={handleCharge}
              disabled={charging || stripeLoading}
              activeOpacity={0.85}
            >
              {(charging || stripeLoading) ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialIcons
                    name={payMethod === 'card' ? 'credit-card' : 'add'}
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.chargeBtnText}>
                    {payMethod === 'card' ? 'الدفع بالبطاقة' : 'شحن الآن'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { color: Colors.textSecondary, marginTop: Spacing.sm },
  balanceCard: {
    paddingHorizontal: Spacing.lg, paddingTop: Spacing.md,
    paddingBottom: Spacing.xl, alignItems: 'center',
  },
  balanceLabel: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.sm, marginBottom: Spacing.xs },
  balanceAmount: { color: '#fff', fontSize: 52, fontWeight: '800', lineHeight: 60 },
  balanceCurrency: { color: Colors.accent, fontSize: Typography.xl, fontWeight: '600', marginTop: -10 },
  miniStats: {
    flexDirection: 'row-reverse', marginTop: Spacing.md, marginBottom: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, width: '100%',
  },
  miniStatItem: { flex: 1, alignItems: 'center', gap: 2 },
  miniStatValue: { color: '#fff', fontSize: Typography.sm, fontWeight: '700' },
  miniStatLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 10 },
  miniStatDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 4 },
  cardActions: {
    flexDirection: 'row-reverse', marginTop: Spacing.md,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: BorderRadius.lg, width: '100%', overflow: 'hidden',
  },
  cardActionBtn: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 8, paddingVertical: 14,
  },
  cardActionText: { color: '#fff', fontSize: Typography.sm, fontWeight: '600' },
  cardActionDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 10 },
  paymentSection: { backgroundColor: Colors.bgWhite, padding: Spacing.md, marginTop: -Spacing.sm },
  sectionTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing.sm },
  paymentMethods: { flexDirection: 'row-reverse', gap: Spacing.sm },
  paymentMethodItem: { flex: 1, alignItems: 'center', gap: 6 },
  paymentMethodIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  paymentMethodName: { fontSize: 10, color: Colors.textSecondary, textAlign: 'center' },
  transactionSection: {
    flex: 1, backgroundColor: Colors.bgWhite,
    marginTop: Spacing.xs, paddingHorizontal: Spacing.md, paddingTop: Spacing.md,
  },
  transactionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.sm },
  txCount: { color: Colors.textLight, fontSize: Typography.sm },
  transactionRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: Spacing.sm, gap: Spacing.sm },
  transactionIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  transactionCenter: { flex: 1 },
  transactionDesc: { fontSize: Typography.base, fontWeight: '500', color: Colors.textPrimary, textAlign: 'right' },
  transactionLeft: { alignItems: 'flex-end', minWidth: 70 },
  transactionAmount: { fontSize: Typography.base, fontWeight: '700' },
  transactionDate: { fontSize: Typography.xs, color: Colors.textLight, marginTop: 2 },
  separator: { height: 1, backgroundColor: Colors.borderLight, marginLeft: 56 },
  emptyTx: { alignItems: 'center', paddingVertical: 40, gap: 8 },
  emptyTxText: { fontSize: Typography.md, color: Colors.textSecondary, fontWeight: '600' },
  emptyTxSub: { fontSize: Typography.sm, color: Colors.textLight, textAlign: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: Colors.bgWhite, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  modalTitle: { fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary },
  // Payment method toggle
  payMethodToggle: {
    flexDirection: 'row-reverse', gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  payMethodBtn: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: Colors.border, backgroundColor: Colors.bgLight,
  },
  payMethodBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  payMethodText: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600' },
  payMethodTextActive: { color: '#fff', fontWeight: '700' },
  stripeNotice: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    backgroundColor: Colors.success + '12', borderRadius: BorderRadius.sm,
    paddingHorizontal: Spacing.sm, paddingVertical: 8,
    borderWidth: 1, borderColor: Colors.success + '30',
    marginBottom: Spacing.md,
  },
  stripeNoticeText: { flex: 1, fontSize: Typography.xs, color: Colors.success, textAlign: 'right', lineHeight: 16 },
  chargeLabel: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 6 },
  chargeInput: {
    borderWidth: 1.5, borderColor: Colors.border, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md, paddingVertical: 14,
    fontSize: Typography.xl, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right',
    marginBottom: Spacing.md,
  },
  quickAmounts: { flexDirection: 'row-reverse', gap: Spacing.sm, marginBottom: Spacing.lg },
  quickAmountBtn: {
    flex: 1, paddingVertical: 10, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  quickAmountActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  quickAmountText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textSecondary },
  quickAmountTextActive: { color: '#fff' },
  chargeBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 8,
  },
  chargeBtnText: { color: '#fff', fontSize: Typography.md, fontWeight: '700' },
});
