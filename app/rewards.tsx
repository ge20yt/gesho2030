import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, RefreshControl, FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { REDEEM_OPTIONS, LEVEL_CONFIG } from '@/services/rewardsService';

interface RewardData {
  id: string;
  user_id: string;
  points: number;
  total_earned: number;
  total_redeemed: number;
  level: string;
}

interface TxRow {
  id: string;
  user_id: string;
  points: number;
  type: string;
  description: string;
  created_at: string;
}

const PAGE_SIZE = 20;

export default function RewardsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const { showAlert } = useAlert();

  const [rewards, setRewards] = useState<RewardData | null>(null);
  const [transactions, setTransactions] = useState<TxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── Load or create rewards record ──────────────────────────────
  const loadRewards = useCallback(async () => {
    if (!user?.id) { setLoading(false); return; }
    try {
      const supabase = getSupabaseClient();
      let { data } = await supabase
        .from('rewards')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (!data) {
        const { data: created } = await supabase
          .from('rewards')
          .insert({ user_id: user.id, points: 0, total_earned: 0, total_redeemed: 0, level: 'bronze' })
          .select('*')
          .single();
        data = created;
      }

      if (data) setRewards(data as RewardData);
    } catch { /* silent */ }
  }, [user?.id]);

  // ── Load transactions with pagination ─────────────────────────
  const loadTransactions = useCallback(async (reset = false) => {
    if (!user?.id) return;
    const currentPage = reset ? 0 : page;
    if (!reset && !hasMore) return;
    if (!reset) setLoadingMore(true);
    try {
      const supabase = getSupabaseClient();
      const from = currentPage * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      const { data, error } = await supabase
        .from('reward_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (error || !data) return;

      if (reset) {
        setTransactions(data as TxRow[]);
        setPage(1);
      } else {
        setTransactions(prev => {
          const ids = new Set(prev.map(t => t.id));
          const unique = (data as TxRow[]).filter(t => !ids.has(t.id));
          return [...prev, ...unique];
        });
        setPage(p => p + 1);
      }
      setHasMore(data.length === PAGE_SIZE);
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  }, [user?.id, page, hasMore]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([loadRewards(), loadTransactions(true)]);
    setLoading(false);
    setRefreshing(false);
  }, [loadRewards]);

  useEffect(() => { loadAll(); }, []);

  // ── Redeem points ──────────────────────────────────────────────
  const handleRedeem = (option: typeof REDEEM_OPTIONS[0]) => {
    if (!rewards) return;
    if (rewards.points < option.points) {
      showAlert('رصيد غير كافٍ', `تحتاج ${option.points} نقطة. رصيدك الحالي ${rewards.points} نقطة`);
      return;
    }
    showAlert(
      'تأكيد الاستبدال',
      `هل تريد استبدال ${option.points} نقطة بـ "${option.label}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'استبدال',
          onPress: async () => {
            if (!user?.id) return;
            setRedeeming(option.id);
            try {
              const supabase = getSupabaseClient();

              // Insert transaction
              await supabase.from('reward_transactions').insert({
                user_id: user.id,
                points: -option.points,
                type: 'redeem',
                description: `استبدال: ${option.label}`,
              });

              const newPoints = rewards.points - option.points;
              const newRedeemed = rewards.total_redeemed + option.points;

              // Update level based on total_earned
              const totalEarned = rewards.total_earned;
              const newLevel =
                totalEarned >= LEVEL_CONFIG.platinum.min ? 'platinum' :
                totalEarned >= LEVEL_CONFIG.gold.min ? 'gold' :
                totalEarned >= LEVEL_CONFIG.silver.min ? 'silver' : 'bronze';

              await supabase.from('rewards').update({
                points: newPoints,
                total_redeemed: newRedeemed,
                level: newLevel,
                updated_at: new Date().toISOString(),
              }).eq('user_id', user.id);

              setRewards(prev => prev ? { ...prev, points: newPoints, total_redeemed: newRedeemed, level: newLevel } : prev);
              await loadTransactions(true);
              showAlert('تم الاستبدال!', `تم استبدال ${option.points} نقطة بـ ${option.label} بنجاح`);
            } catch (e: any) {
              showAlert('خطأ', e.message ?? 'فشل الاستبدال');
            } finally {
              setRedeeming(null);
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const levelCfg = LEVEL_CONFIG[(rewards?.level ?? 'bronze') as keyof typeof LEVEL_CONFIG] ?? LEVEL_CONFIG.bronze;
  const levelKeys = ['bronze', 'silver', 'gold', 'platinum'] as const;
  const currentIdx = levelKeys.indexOf((rewards?.level ?? 'bronze') as any);
  const nextLevelKey = currentIdx < levelKeys.length - 1 ? levelKeys[currentIdx + 1] : null;
  const nextLevelCfg = nextLevelKey ? LEVEL_CONFIG[nextLevelKey] : null;
  const totalEarned = rewards?.total_earned ?? 0;
  const progressPct = nextLevelCfg
    ? Math.min(100, ((totalEarned - levelCfg.min) / Math.max(1, nextLevelCfg.min - levelCfg.min)) * 100)
    : 100;
  const pointsToNext = nextLevelCfg ? Math.max(0, nextLevelCfg.min - totalEarned) : 0;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Header */}
      <LinearGradient colors={[Colors.bgDark, '#1A1200', Colors.bgNavy]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>نقاط المكافآت</Text>
          <TouchableOpacity onPress={() => { setRefreshing(true); loadAll(); }} style={styles.refreshBtn}>
            <MaterialIcons name="refresh" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </View>

        {/* Hero Card */}
        <View style={styles.heroCard}>
          <LinearGradient colors={['rgba(255,208,80,0.15)', 'rgba(232,160,32,0.08)']} style={styles.heroGradient}>
            <View style={styles.levelRow}>
              <View style={[styles.levelBadge, { borderColor: levelCfg.color + '60', backgroundColor: levelCfg.color + '20' }]}>
                <Text style={styles.levelIcon}>{levelCfg.icon}</Text>
                <Text style={[styles.levelLabel, { color: levelCfg.color }]}>{levelCfg.label}</Text>
              </View>
            </View>

            <Text style={styles.pointsValue}>{(rewards?.points ?? 0).toLocaleString()}</Text>
            <Text style={styles.pointsLabel}>نقطة متاحة</Text>

            <View style={styles.progressBlock}>
              <View style={styles.progressLabelRow}>
                {nextLevelCfg ? (
                  <>
                    <Text style={styles.progressNextLabel}>{nextLevelCfg.label} {nextLevelCfg.icon}</Text>
                    <Text style={styles.progressSubLabel}>{pointsToNext} نقطة للمستوى التالي</Text>
                  </>
                ) : (
                  <Text style={styles.progressSubLabel}>أعلى مستوى! 🎉</Text>
                )}
              </View>
              <View style={styles.progressTrack}>
                <LinearGradient
                  colors={['#FFD050', '#E8A020']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${progressPct}%` }]}
                />
              </View>
              <Text style={styles.progressPct}>{Math.round(progressPct)}%</Text>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{(rewards?.total_earned ?? 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>مجموع مكتسب</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{(rewards?.total_redeemed ?? 0).toLocaleString()}</Text>
                <Text style={styles.statLabel}>مجموع مستبدل</Text>
              </View>
            </View>
          </LinearGradient>
        </View>
      </LinearGradient>

      <FlatList
        data={transactions}
        keyExtractor={t => t.id}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadAll(); }} tintColor={Colors.accent} />
        }
        onEndReached={() => { if (hasMore && !loadingMore) loadTransactions(); }}
        onEndReachedThreshold={0.3}
        ListFooterComponent={
          loadingMore ? (
            <View style={styles.loadMoreWrap}>
              <ActivityIndicator size="small" color={Colors.accent} />
            </View>
          ) : null
        }
        ListHeaderComponent={
          <>
            {/* How to Earn */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>كيف تكسب النقاط؟</Text>
              <View style={styles.earnGrid}>
                {[
                  { icon: 'directions-car', label: 'لكل رحلة',     pts: '5–50 نقطة',  color: Colors.primary },
                  { icon: 'star',           label: 'رحلة مقيّمة',  pts: '+10 نقاط',   color: Colors.accent },
                  { icon: 'person-add',     label: 'دعوة صديق',    pts: '+100 نقطة',  color: '#10B981' },
                  { icon: 'cake',           label: 'يوم ميلادك',   pts: '+50 نقطة',   color: '#8B5CF6' },
                ].map((item, i) => (
                  <View key={i} style={styles.earnItem}>
                    <View style={[styles.earnIcon, { backgroundColor: item.color + '15' }]}>
                      <MaterialIcons name={item.icon as any} size={22} color={item.color} />
                    </View>
                    <Text style={styles.earnLabel}>{item.label}</Text>
                    <Text style={[styles.earnPts, { color: item.color }]}>{item.pts}</Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Redeem */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>استبدل نقاطك</Text>
              <Text style={styles.sectionSubtitle}>
                رصيدك الحالي: <Text style={styles.boldAccent}>{rewards?.points ?? 0} نقطة</Text>
              </Text>
              <View style={styles.redeemGrid}>
                {REDEEM_OPTIONS.map(opt => {
                  const canRedeem = (rewards?.points ?? 0) >= opt.points;
                  return (
                    <TouchableOpacity
                      key={opt.id}
                      style={[styles.redeemCard, !canRedeem && styles.redeemCardDisabled]}
                      onPress={() => handleRedeem(opt)}
                      activeOpacity={canRedeem ? 0.85 : 1}
                    >
                      {redeeming === opt.id ? (
                        <ActivityIndicator color={opt.color} />
                      ) : (
                        <>
                          <View style={[styles.redeemIcon, { backgroundColor: opt.color + '18' }]}>
                            <MaterialIcons name={opt.icon as any} size={26} color={canRedeem ? opt.color : Colors.textLight} />
                          </View>
                          <Text style={[styles.redeemLabel, !canRedeem && styles.textDisabled]}>{opt.label}</Text>
                          <View style={[styles.redeemBadge, { backgroundColor: canRedeem ? opt.color : Colors.border }]}>
                            <Text style={styles.redeemBadgeText}>{opt.points} نقطة</Text>
                          </View>
                          {!canRedeem && (
                            <Text style={styles.redeemNeedText}>تحتاج {opt.points - (rewards?.points ?? 0)} نقطة</Text>
                          )}
                        </>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Levels */}
            <View style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>مستويات العضوية</Text>
              {(Object.entries(LEVEL_CONFIG) as [string, typeof LEVEL_CONFIG['bronze']][]).map(([key, cfg]) => {
                const isCurrent = rewards?.level === key;
                return (
                  <View key={key} style={[styles.levelItem, isCurrent && styles.levelItemActive]}>
                    <View style={styles.levelItemRight}>
                      <Text style={styles.levelItemIcon}>{cfg.icon}</Text>
                      <View>
                        <Text style={[styles.levelItemName, { color: cfg.color }]}>{cfg.label}</Text>
                        <Text style={styles.levelItemRange}>
                          {cfg.min.toLocaleString()} — {key === 'platinum' ? '∞' : cfg.max.toLocaleString()} نقطة
                        </Text>
                      </View>
                    </View>
                    {isCurrent && (
                      <View style={[styles.currentBadge, { backgroundColor: cfg.color }]}>
                        <Text style={styles.currentBadgeText}>مستواك الحالي</Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>

            {/* Transactions header */}
            <View style={styles.txHeader}>
              <Text style={styles.txCount}>{transactions.length} معاملة</Text>
              <Text style={styles.sectionTitleInline}>سجل النقاط</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <MaterialIcons name="history" size={40} color={Colors.borderLight} />
            <Text style={styles.emptyText}>لا توجد معاملات بعد</Text>
          </View>
        }
        renderItem={({ item: tx }) => (
          <View style={styles.txRow}>
            <Text style={[styles.txPoints, { color: tx.type === 'earn' ? Colors.success : Colors.error }]}>
              {tx.type === 'earn' ? '+' : ''}{tx.points}
            </Text>
            <View style={styles.txInfo}>
              <Text style={styles.txDesc}>{tx.description}</Text>
              <Text style={styles.txDate}>{new Date(tx.created_at).toLocaleDateString('ar-EG')}</Text>
            </View>
            <View style={[styles.txIcon, { backgroundColor: tx.type === 'earn' ? Colors.success + '18' : Colors.error + '18' }]}>
              <MaterialIcons
                name={tx.type === 'earn' ? 'add-circle' : 'remove-circle'}
                size={22}
                color={tx.type === 'earn' ? Colors.success : Colors.error}
              />
            </View>
          </View>
        )}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  center: { justifyContent: 'center', alignItems: 'center' },
  header: { paddingBottom: Spacing.lg },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  refreshBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '700' },
  heroCard: {
    marginHorizontal: Spacing.md, borderRadius: BorderRadius.xl, overflow: 'hidden',
    borderWidth: 1, borderColor: 'rgba(255,208,80,0.3)',
  },
  heroGradient: { padding: Spacing.lg, alignItems: 'center' },
  levelRow: { marginBottom: Spacing.sm },
  levelBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: Spacing.md, paddingVertical: 6,
    borderRadius: BorderRadius.full, borderWidth: 1.5,
  },
  levelIcon: { fontSize: 18 },
  levelLabel: { fontSize: Typography.sm, fontWeight: '800', letterSpacing: 1 },
  pointsValue: { fontSize: 56, fontWeight: '900', color: Colors.accent, letterSpacing: -1, lineHeight: 64 },
  pointsLabel: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.base, marginBottom: Spacing.lg },
  progressBlock: { width: '100%', marginBottom: Spacing.lg },
  progressLabelRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: Spacing.xs },
  progressSubLabel: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.xs },
  progressNextLabel: { color: Colors.accent, fontSize: Typography.xs, fontWeight: '700' },
  progressTrack: { height: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 5, overflow: 'hidden', marginBottom: 4 },
  progressFill: { height: '100%', borderRadius: 5, minWidth: 8 },
  progressPct: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.xs, textAlign: 'right' },
  statsRow: {
    flexDirection: 'row-reverse', width: '100%',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: BorderRadius.lg, padding: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.15)', marginVertical: 4 },
  statValue: { color: '#fff', fontSize: Typography.xl, fontWeight: '800' },
  statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.xs, marginTop: 2 },
  sectionCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    marginHorizontal: Spacing.md, marginTop: Spacing.md,
    padding: Spacing.md, ...Shadows.sm, borderWidth: 1, borderColor: Colors.borderLight,
  },
  sectionTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: 4 },
  sectionTitleInline: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
  sectionSubtitle: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: Spacing.md },
  boldAccent: { color: Colors.primary, fontWeight: '700' },
  earnGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  earnItem: {
    width: '47%', backgroundColor: Colors.bgLight,
    borderRadius: BorderRadius.lg, padding: Spacing.md, alignItems: 'center', gap: 6,
  },
  earnIcon: { width: 50, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  earnLabel: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: '600', textAlign: 'center' },
  earnPts: { fontSize: Typography.xs, fontWeight: '700' },
  redeemGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  redeemCard: {
    width: '47%', backgroundColor: Colors.bgLight, borderRadius: BorderRadius.lg,
    padding: Spacing.md, alignItems: 'center', gap: 6,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  redeemCardDisabled: { opacity: 0.55 },
  redeemIcon: { width: 54, height: 54, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  redeemLabel: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: '700', textAlign: 'center' },
  textDisabled: { color: Colors.textLight },
  redeemBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  redeemBadgeText: { color: '#fff', fontSize: Typography.xs, fontWeight: '700' },
  redeemNeedText: { fontSize: 10, color: Colors.error, fontWeight: '500' },
  levelItem: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  levelItemActive: {
    backgroundColor: Colors.primaryLight, marginHorizontal: -Spacing.md,
    paddingHorizontal: Spacing.md, borderRadius: BorderRadius.md,
  },
  levelItemRight: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm },
  levelItemIcon: { fontSize: 24 },
  levelItemName: { fontSize: Typography.base, fontWeight: '700' },
  levelItemRange: { fontSize: Typography.xs, color: Colors.textSecondary, marginTop: 2 },
  currentBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 12, paddingVertical: 4 },
  currentBadgeText: { color: '#fff', fontSize: Typography.xs, fontWeight: '700' },
  txHeader: {
    flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: Spacing.sm,
  },
  txCount: { color: Colors.textLight, fontSize: Typography.sm },
  txRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingVertical: 12, paddingHorizontal: Spacing.md,
    backgroundColor: Colors.bgWhite,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  txIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  txInfo: { flex: 1 },
  txDesc: { fontSize: Typography.sm, color: Colors.textPrimary, fontWeight: '500', textAlign: 'right' },
  txDate: { fontSize: Typography.xs, color: Colors.textLight, textAlign: 'right', marginTop: 2 },
  txPoints: { fontSize: Typography.lg, fontWeight: '800', minWidth: 50, textAlign: 'left' },
  loadMoreWrap: { paddingVertical: 16, alignItems: 'center' },
  empty: { alignItems: 'center', paddingVertical: 30, gap: 8, paddingHorizontal: Spacing.md },
  emptyText: { fontSize: Typography.base, color: Colors.textLight },
});
