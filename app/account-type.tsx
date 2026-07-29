import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  Dimensions, Animated, Easing,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';

const { width } = Dimensions.get('window');

// ─── Account types config ─────────────────────────────────────────────
interface AccountType {
  id: string;
  icon: string;
  emoji: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  gradient: [string, string];
  route: string;
}

const ACCOUNT_TYPES: AccountType[] = [
  {
    id: 'parent',
    icon: 'family-restroom',
    emoji: '👨‍👩‍👧',
    title: 'ولي أمر',
    subtitle: 'Family Guardian',
    description: 'إدارة الأسرة ومتابعة الأبناء والتحكم بالصلاحيات',
    color: '#10B981',
    gradient: ['#10B981', '#059669'],
    route: '/(tabs)',
  },
  {
    id: 'child',
    icon: 'child-care',
    emoji: '👦',
    title: 'ابن / ابنة',
    subtitle: 'Family Member',
    description: 'استخدام خدمات التطبيق تحت إشراف ولي الأمر',
    color: '#3B82F6',
    gradient: ['#3B82F6', '#2563EB'],
    route: '/(tabs)',
  },
  {
    id: 'driver',
    icon: 'electric-rickshaw',
    emoji: '🛺',
    title: 'سائق توكتوك',
    subtitle: 'TukTuk Driver',
    description: 'استقبال الرحلات وتحقيق الأرباح من خلال المنصة',
    color: Colors.primary,
    gradient: [Colors.primary, Colors.primaryDark],
    route: '/driver-register',
  },
  {
    id: 'technician',
    icon: 'build',
    emoji: '🔧',
    title: 'صنايعي',
    subtitle: 'Technician',
    description: 'عرض الخدمات المهنية واستقبال الطلبات من العملاء',
    color: '#F59E0B',
    gradient: ['#F59E0B', '#D97706'],
    route: '/(tabs)',
  },
  {
    id: 'workshop',
    icon: 'garage',
    emoji: '🏭',
    title: 'صاحب ورشة',
    subtitle: 'Workshop Owner',
    description: 'إدارة الورشة والتواصل مع العملاء وعرض خدماتك',
    color: '#8B5CF6',
    gradient: ['#8B5CF6', '#7C3AED'],
    route: '/(tabs)',
  },
  {
    id: 'merchant',
    icon: 'storefront',
    emoji: '🏪',
    title: 'صاحب محل',
    subtitle: 'Merchant',
    description: 'عرض المنتجات والخدمات داخل منصة تك توكي',
    color: '#EC4899',
    gradient: ['#EC4899', '#DB2777'],
    route: '/(tabs)',
  },
];

// ─── Type Card ────────────────────────────────────────────────────────
function TypeCard({
  type, isSelected, onPress, index,
}: {
  type: AccountType; isSelected: boolean; onPress: () => void; index: number;
}) {
  const slideAnim = useRef(new Animated.Value(50)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0, duration: 480,
        delay: index * 70, easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1, duration: 480, delay: index * 70, useNativeDriver: true,
      }),
    ]).start();
  }, []);

  useEffect(() => {
    Animated.spring(scaleAnim, {
      toValue: isSelected ? 1.02 : 1,
      tension: 200, friction: 12, useNativeDriver: true,
    }).start();
  }, [isSelected]);

  return (
    <Animated.View style={{
      transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      opacity: opacityAnim,
      width: (width - Spacing.md * 2 - Spacing.sm) / 2,
    }}>
      <TouchableOpacity
        style={[
          cardStyles.card,
          isSelected && { borderColor: type.color, borderWidth: 2 },
        ]}
        onPress={onPress}
        activeOpacity={0.85}
      >
        {/* Selection indicator */}
        {isSelected && (
          <View style={[cardStyles.checkBadge, { backgroundColor: type.color }]}>
            <MaterialIcons name="check" size={12} color="#fff" />
          </View>
        )}

        {/* Gradient top bar */}
        {isSelected && (
          <LinearGradient
            colors={[type.color + '30', 'transparent']}
            style={cardStyles.cardTopGradient}
          />
        )}

        {/* Icon */}
        <View style={[
          cardStyles.iconWrap,
          { backgroundColor: isSelected ? type.color : type.color + '18' },
          isSelected && {
            shadowColor: type.color,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5, shadowRadius: 12, elevation: 6,
          },
        ]}>
          <Text style={cardStyles.emoji}>{type.emoji}</Text>
        </View>

        <Text style={[cardStyles.title, isSelected && { color: type.color }]}>{type.title}</Text>
        <Text style={cardStyles.subtitle}>{type.subtitle}</Text>
        <Text style={cardStyles.description} numberOfLines={2}>{type.description}</Text>

        {/* Selected underline */}
        {isSelected && (
          <View style={[cardStyles.selectedLine, { backgroundColor: type.color }]} />
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────
export default function AccountTypeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuthContext();

  const [selected, setSelected] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const headerAnim = useRef(new Animated.Value(-30)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(headerAnim, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      ]),
      Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  const selectedType = ACCOUNT_TYPES.find(t => t.id === selected);

  const handleContinue = async () => {
    if (!selected) {
      showAlert('تنبيه', 'من فضلك اختر نوع الحساب للمتابعة');
      return;
    }

    setSaving(true);

    // Save account type to user_profiles metadata
    if (user?.id) {
      try {
        const supabase = getSupabaseClient();
        await supabase
          .from('user_profiles')
          .update({ username: user.name ?? '' })
          .eq('id', user.id);
        // Note: account_type would require a DB column; for now navigate based on selection
      } catch { /* silent */ }
    }

    setSaving(false);

    const route = selectedType?.route ?? '/(tabs)';

    if (selected === 'driver') {
      router.replace('/driver-register' as any);
    } else {
      router.replace('/(tabs)' as any);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0D0D0D', '#0A1628', '#1A1400']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Background decoration */}
      <View style={styles.bgDecorLeft} pointerEvents="none" />
      <View style={styles.bgDecorRight} pointerEvents="none" />

      {/* Header */}
      <Animated.View style={[
        styles.header,
        { paddingTop: insets.top + 12 },
        { transform: [{ translateY: headerAnim }], opacity: headerOpacity },
      ]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <MaterialIcons name="arrow-forward" size={22} color="rgba(255,255,255,0.8)" />
        </TouchableOpacity>

        <View style={styles.headerCenter}>
          <View style={styles.stepBadge}>
            <Text style={styles.stepBadgeText}>الخطوة 3 من 3</Text>
          </View>
          <Text style={styles.headerTitle}>اختر نوع حسابك</Text>
          <Text style={styles.headerSub}>اختر الفئة التي تناسبك للحصول على أفضل تجربة</Text>
        </View>

        <Image source={require('@/assets/images/logo.png')} style={styles.headerLogo} contentFit="contain" />
      </Animated.View>

      {/* Cards Grid */}
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 120 }]}
      >
        {/* Selected type preview */}
        {selectedType && (
          <Animated.View style={styles.selectedPreview}>
            <LinearGradient
              colors={[selectedType.color + '20', selectedType.color + '08']}
              style={styles.selectedPreviewGradient}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            >
              <View style={styles.selectedPreviewContent}>
                <Text style={styles.selectedPreviewDesc}>{selectedType.description}</Text>
                <Text style={[styles.selectedPreviewTitle, { color: selectedType.color }]}>
                  {selectedType.emoji} {selectedType.title}
                </Text>
              </View>
              <MaterialIcons name="check-circle" size={24} color={selectedType.color} />
            </LinearGradient>
          </Animated.View>
        )}

        {/* Grid */}
        <View style={styles.grid}>
          {ACCOUNT_TYPES.map((type, i) => (
            <TypeCard
              key={type.id}
              type={type}
              isSelected={selected === type.id}
              onPress={() => setSelected(type.id)}
              index={i}
            />
          ))}
        </View>

        {/* Info note */}
        <View style={styles.infoNote}>
          <MaterialIcons name="info-outline" size={16} color="rgba(255,255,255,0.35)" />
          <Text style={styles.infoText}>يمكنك تغيير نوع الحساب لاحقاً من إعدادات الملف الشخصي</Text>
        </View>
      </ScrollView>

      {/* Bottom CTA */}
      <Animated.View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16, opacity: btnOpacity }]}>
        <TouchableOpacity
          style={[styles.continueBtn, !selected && styles.continueBtnDisabled]}
          onPress={handleContinue}
          disabled={!selected || saving}
          activeOpacity={0.88}
        >
          {selected ? (
            <LinearGradient
              colors={selectedType ? selectedType.gradient : ['#FFD050', '#C47D0A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.continueBtnGradient}
            >
              {saving ? (
                <View style={styles.continueBtnLoading}>
                  <Text style={styles.continueBtnText}>جارٍ الحفظ...</Text>
                </View>
              ) : (
                <>
                  <Text style={styles.continueBtnText}>
                    متابعة كـ {selectedType?.title}
                  </Text>
                  <MaterialIcons name="arrow-back" size={20} color="#fff" />
                </>
              )}
            </LinearGradient>
          ) : (
            <View style={styles.continueBtnGradient}>
              <Text style={[styles.continueBtnText, { color: 'rgba(255,255,255,0.4)' }]}>
                اختر نوع الحساب أولاً
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDark },
  bgDecorLeft: {
    position: 'absolute', left: -60, top: 100, width: 200, height: 200, borderRadius: 100,
    backgroundColor: Colors.primary + '08',
  },
  bgDecorRight: {
    position: 'absolute', right: -80, top: 300, width: 250, height: 250, borderRadius: 125,
    backgroundColor: '#3B82F6' + '08',
  },
  header: {
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  headerCenter: { flex: 1, alignItems: 'flex-end' },
  stepBadge: {
    backgroundColor: Colors.accent + '18', borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 4, marginBottom: Spacing.xs,
    borderWidth: 1, borderColor: Colors.accent + '35',
    alignSelf: 'flex-end',
  },
  stepBadgeText: { color: Colors.accent, fontSize: Typography.xs, fontWeight: '700' },
  headerTitle: { color: '#fff', fontSize: Typography.xxl, fontWeight: '800', textAlign: 'right', marginBottom: 4 },
  headerSub: { color: 'rgba(255,255,255,0.45)', fontSize: Typography.sm, textAlign: 'right', lineHeight: 18 },
  headerLogo: { width: 40, height: 40, borderRadius: 10, marginTop: 4 },
  scrollContent: { paddingHorizontal: Spacing.md, paddingTop: 0 },
  // Selected preview
  selectedPreview: { marginBottom: Spacing.md, borderRadius: BorderRadius.lg, overflow: 'hidden' },
  selectedPreviewGradient: { borderRadius: BorderRadius.lg, padding: Spacing.md },
  selectedPreviewContent: { flex: 1 },
  selectedPreviewTitle: { fontSize: Typography.md, fontWeight: '800', textAlign: 'right', marginBottom: 2 },
  selectedPreviewDesc: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.xs, textAlign: 'right', lineHeight: 16 },
  // Grid
  grid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm },
  // Info
  infoNote: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    marginTop: Spacing.md, paddingHorizontal: Spacing.sm,
  },
  infoText: { flex: 1, color: 'rgba(255,255,255,0.3)', fontSize: Typography.xs, textAlign: 'right', lineHeight: 16 },
  // Bottom
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.md, paddingTop: 16,
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  continueBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.lg },
  continueBtnDisabled: { opacity: 0.5 },
  continueBtnGradient: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  continueBtnText: { fontSize: Typography.md, fontWeight: '800', color: '#fff' },
  continueBtnLoading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});

const cardStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.xl,
    padding: Spacing.md, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden', position: 'relative',
    minHeight: 160,
  },
  checkBadge: {
    position: 'absolute', top: 10, left: 10,
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center', zIndex: 10,
  },
  cardTopGradient: {
    position: 'absolute', top: 0, left: 0, right: 0, height: 60,
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: Spacing.sm, alignSelf: 'flex-end',
  },
  emoji: { fontSize: 26 },
  title: { color: '#fff', fontSize: Typography.md, fontWeight: '800', textAlign: 'right', marginBottom: 2 },
  subtitle: { color: 'rgba(255,255,255,0.35)', fontSize: 10, textAlign: 'right', marginBottom: Spacing.sm, fontWeight: '500', letterSpacing: 0.5 },
  description: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.xs, textAlign: 'right', lineHeight: 16 },
  selectedLine: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 3 },
});
