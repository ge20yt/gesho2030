import React, { useRef, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Dimensions, Animated, Easing, ScrollView, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

// ─── Step identifiers ───────────────────────────────────────────────
type Step = 'welcome' | 'features';

// ─── Feature data ────────────────────────────────────────────────────
const FEATURES = [
  {
    icon: 'electric-rickshaw',
    color: Colors.primary,
    bg: Colors.primary + '18',
    title: 'النقل الذكي',
    items: ['طلب رحلات التوكتوك بسهولة', 'تتبع مباشر للرحلة', 'مشاركة الرحلة مع الأسرة'],
  },
  {
    icon: 'family-restroom',
    color: '#10B981',
    bg: '#10B981' + '18',
    title: 'الأسرة الذكية',
    items: ['متابعة الأبناء لحظياً', 'تحديد المناطق المسموح بها', 'تنبيهات فورية للأهل'],
  },
  {
    icon: 'account-balance-wallet',
    color: Colors.accent,
    bg: Colors.accent + '18',
    title: 'المحفظة الإلكترونية',
    items: ['إدارة الرصيد بسهولة', 'استقبال المكافآت', 'سحب الأرباح فوراً'],
  },
  {
    icon: 'people',
    color: '#8B5CF6',
    bg: '#8B5CF6' + '18',
    title: 'الشبكة الاجتماعية',
    items: ['مشاركة المنشورات والصور', 'التواصل مع الأصدقاء', 'بيئة آمنة ومراقبة'],
  },
];

// ─── Floating particle ───────────────────────────────────────────────
function Particle({ x, y, size, color, duration }: {
  x: number; y: number; size: number; color: string; duration: number;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();
  }, []);
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, -18] });
  const opacity = anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.25, 0.7, 0.25] });
  return (
    <Animated.View style={{
      position: 'absolute', left: x, top: y,
      width: size, height: size, borderRadius: size / 2,
      backgroundColor: color, opacity, transform: [{ translateY }],
    }} />
  );
}

// ─── Feature card ─────────────────────────────────────────────────────
function FeatureCard({ feat, index, isVisible }: {
  feat: typeof FEATURES[0]; index: number; isVisible: boolean;
}) {
  const slideAnim = useRef(new Animated.Value(60)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (isVisible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0, duration: 450, delay: index * 100,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1, duration: 450, delay: index * 100,
          easing: Easing.out(Easing.cubic), useNativeDriver: true,
        }),
      ]).start();
    } else {
      slideAnim.setValue(60);
      opacityAnim.setValue(0);
    }
  }, [isVisible]);

  return (
    <Animated.View style={[
      featureStyles.card,
      { transform: [{ translateY: slideAnim }], opacity: opacityAnim },
    ]}>
      <View style={[featureStyles.iconWrap, { backgroundColor: feat.bg }]}>
        <MaterialIcons name={feat.icon as any} size={26} color={feat.color} />
      </View>
      <View style={featureStyles.cardContent}>
        <Text style={[featureStyles.cardTitle, { color: feat.color }]}>{feat.title}</Text>
        {feat.items.map((item, i) => (
          <View key={i} style={featureStyles.itemRow}>
            <View style={[featureStyles.bullet, { backgroundColor: feat.color }]} />
            <Text style={featureStyles.itemText}>{item}</Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

// ─── WELCOME SCREEN ──────────────────────────────────────────────────
function WelcomeScreen({ onNext, onLearnMore }: { onNext: () => void; onLearnMore: () => void }) {
  const insets = useSafeAreaInsets();
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const btnOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.spring(logoScale, { toValue: 1, tension: 80, friction: 8, useNativeDriver: true }),
        Animated.timing(logoOpacity, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
      Animated.timing(textOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(btnOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={welcomeStyles.container}>
      {/* Background */}
      <LinearGradient
        colors={['#0D0D0D', '#0D1A2E', '#1A1400']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Particles */}
      {[
        { x: width * 0.1, y: height * 0.15, size: 6,  color: Colors.accent,  duration: 2800 },
        { x: width * 0.8, y: height * 0.2,  size: 4,  color: Colors.primary, duration: 3200 },
        { x: width * 0.25,y: height * 0.55, size: 5,  color: Colors.accent,  duration: 2600 },
        { x: width * 0.7, y: height * 0.48, size: 7,  color: Colors.primary, duration: 3500 },
        { x: width * 0.5, y: height * 0.12, size: 4,  color: '#10B981',      duration: 2400 },
        { x: width * 0.9, y: height * 0.65, size: 5,  color: Colors.accent,  duration: 3000 },
      ].map((p, i) => <Particle key={i} {...p} />)}

      {/* Hero Image */}
      <Animated.View style={[welcomeStyles.heroWrap, {
        opacity: logoOpacity,
        transform: [{ scale: logoScale }],
      }]}>
        <Image
          source={require('@/assets/images/onboarding-1.png')}
          style={welcomeStyles.heroImage}
          contentFit="cover"
          transition={300}
        />
        <LinearGradient
          colors={['transparent', 'rgba(13,13,13,0.6)', 'rgba(13,13,13,0.95)']}
          style={welcomeStyles.heroOverlay}
        />
        {/* Glow ring */}
        <View style={welcomeStyles.glowRing} />
      </Animated.View>

      {/* Content */}
      <Animated.View style={[welcomeStyles.content, {
        paddingBottom: insets.bottom + 32,
        opacity: textOpacity,
      }]}>
        {/* Logo + Brand */}
        <View style={welcomeStyles.brandRow}>
          <Image
            source={require('@/assets/images/logo.png')}
            style={welcomeStyles.logo}
            contentFit="contain"
            transition={200}
          />
          <View style={welcomeStyles.brandText}>
            <Text style={welcomeStyles.brandName}>تك توكي</Text>
            <Text style={welcomeStyles.brandTagline}>TukToki</Text>
          </View>
        </View>

        {/* Main headline */}
        <Text style={welcomeStyles.headline}>مرحباً بك في{'\n'}تك توكي</Text>
        <Text style={welcomeStyles.subtitle}>
          المنصة المصرية الذكية المتكاملة للنقل{'\n'}والتواصل والحماية الأسرية
        </Text>

        {/* Feature pills */}
        <View style={welcomeStyles.pillsRow}>
          {['النقل الذكي', 'الأسرة الذكية', 'المحفظة', 'TukTalk'].map((pill, i) => (
            <View key={i} style={welcomeStyles.pill}>
              <Text style={welcomeStyles.pillText}>{pill}</Text>
            </View>
          ))}
        </View>

        {/* Buttons */}
        <Animated.View style={{ opacity: btnOpacity, gap: 12 }}>
          <TouchableOpacity style={welcomeStyles.primaryBtn} onPress={onNext} activeOpacity={0.88}>
            <LinearGradient
              colors={['#FFD050', '#E8A020', '#C47D0A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={welcomeStyles.primaryBtnGradient}
            >
              <Text style={welcomeStyles.primaryBtnText}>ابدأ الآن</Text>
              <MaterialIcons name="arrow-back" size={22} color={Colors.bgDark} />
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity style={welcomeStyles.secondaryBtn} onPress={onLearnMore} activeOpacity={0.85}>
            <Text style={welcomeStyles.secondaryBtnText}>تعرف على المزيد</Text>
            <MaterialIcons name="info-outline" size={18} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

// ─── FEATURES SCREEN ─────────────────────────────────────────────────
function FeaturesScreen({ onNext, onSkip }: { onNext: () => void; onSkip: () => void }) {
  const insets = useSafeAreaInsets();
  const [visible, setVisible] = useState(false);
  const headerAnim = useRef(new Animated.Value(-30)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerAnim, { toValue: 0, duration: 500, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start(() => setVisible(true));
  }, []);

  return (
    <View style={featStyles.container}>
      <LinearGradient
        colors={['#0D0D0D', '#0A1628', '#0D0D0D']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top decoration */}
      <View style={featStyles.topDecor}>
        <LinearGradient
          colors={[Colors.accent + '30', 'transparent']}
          style={featStyles.topGlow}
        />
      </View>

      {/* Skip */}
      <TouchableOpacity
        style={[featStyles.skipBtn, { top: insets.top + 12 }]}
        onPress={onSkip}
      >
        <Text style={featStyles.skipText}>تخطي</Text>
        <MaterialIcons name="close" size={14} color="rgba(255,255,255,0.6)" />
      </TouchableOpacity>

      {/* Header */}
      <Animated.View style={[featStyles.header, {
        paddingTop: insets.top + 56,
        transform: [{ translateY: headerAnim }],
        opacity: headerOpacity,
      }]}>
        <View style={featStyles.headerBadge}>
          <MaterialIcons name="stars" size={14} color={Colors.accent} />
          <Text style={featStyles.headerBadgeText}>المميزات الرئيسية</Text>
        </View>
        <Text style={featStyles.headerTitle}>كل ما تحتاجه{'\n'}في مكان واحد</Text>
      </Animated.View>

      {/* Feature cards */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[featStyles.cardsContainer, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {FEATURES.map((feat, i) => (
          <FeatureCard key={i} feat={feat} index={i} isVisible={visible} />
        ))}
      </ScrollView>

      {/* Bottom CTA */}
      <View style={[featStyles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity style={featStyles.nextBtn} onPress={onNext} activeOpacity={0.88}>
          <LinearGradient
            colors={['#FFD050', '#E8A020', '#C47D0A']}
            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={featStyles.nextBtnGradient}
          >
            <Text style={featStyles.nextBtnText}>التالي — إنشاء حساب</Text>
            <MaterialIcons name="arrow-back" size={20} color={Colors.bgDark} />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── ROOT COMPONENT ───────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('welcome');

  const slideAnim = useRef(new Animated.Value(0)).current;

  const goToFeatures = () => {
    Animated.timing(slideAnim, {
      toValue: -width, duration: 380, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
    }).start(() => setStep('features'));
    slideAnim.setValue(0);
  };

  const finishOnboarding = () => {
    AsyncStorage.setItem('onboarding_done', 'true');
    router.replace('/register');
  };

  const handleSkip = () => {
    AsyncStorage.setItem('onboarding_done', 'true');
    router.replace('/');
  };

  return (
    <View style={{ flex: 1, backgroundColor: Colors.bgDark }}>
      <StatusBar style="light" />
      {step === 'welcome' ? (
        <WelcomeScreen onNext={goToFeatures} onLearnMore={goToFeatures} />
      ) : (
        <FeaturesScreen onNext={finishOnboarding} onSkip={handleSkip} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────
const welcomeStyles = StyleSheet.create({
  container: { flex: 1 },
  heroWrap: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: height * 0.62,
  },
  heroImage: { width: '100%', height: '100%' },
  heroOverlay: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: height * 0.45,
  },
  glowRing: {
    position: 'absolute', bottom: -30, left: width * 0.5 - 60,
    width: 120, height: 120, borderRadius: 60,
    backgroundColor: Colors.accent + '08',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 40,
    elevation: 0,
  },
  content: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg,
  },
  brandRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.lg,
  },
  logo: { width: 48, height: 48, borderRadius: 12 },
  brandText: { alignItems: 'flex-end' },
  brandName: { color: '#fff', fontSize: Typography.lg, fontWeight: '800', letterSpacing: 1 },
  brandTagline: { color: Colors.accent, fontSize: Typography.xs, fontWeight: '600', letterSpacing: 3, marginTop: -2 },
  headline: {
    color: '#fff', fontSize: Typography.display, fontWeight: '800',
    textAlign: 'right', lineHeight: 44, marginBottom: Spacing.sm,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.62)', fontSize: Typography.base,
    textAlign: 'right', lineHeight: 24, marginBottom: Spacing.lg,
  },
  pillsRow: {
    flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8,
    marginBottom: Spacing.xl,
  },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: BorderRadius.full,
    paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  pillText: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.xs, fontWeight: '600' },
  primaryBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.lg },
  primaryBtnGradient: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 17,
  },
  primaryBtnText: { fontSize: Typography.lg, fontWeight: '800', color: Colors.bgDark },
  secondaryBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: BorderRadius.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  secondaryBtnText: { color: 'rgba(255,255,255,0.75)', fontSize: Typography.base, fontWeight: '600' },
});

const featStyles = StyleSheet.create({
  container: { flex: 1 },
  topDecor: { position: 'absolute', top: 0, left: 0, right: 0, height: 200 },
  topGlow: { flex: 1, borderBottomLeftRadius: 200, borderBottomRightRadius: 200 },
  skipBtn: {
    position: 'absolute', left: Spacing.md, zIndex: 10,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
  },
  skipText: { color: 'rgba(255,255,255,0.65)', fontSize: Typography.xs, fontWeight: '600' },
  header: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, alignItems: 'flex-end' },
  headerBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 5,
    backgroundColor: Colors.accent + '18', borderRadius: BorderRadius.full,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: Spacing.sm,
    borderWidth: 1, borderColor: Colors.accent + '35',
  },
  headerBadgeText: { color: Colors.accent, fontSize: Typography.xs, fontWeight: '700' },
  headerTitle: {
    color: '#fff', fontSize: Typography.xxl + 4, fontWeight: '800',
    textAlign: 'right', lineHeight: 38,
  },
  cardsContainer: { paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, gap: Spacing.sm },
  bottomBar: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Spacing.lg, paddingTop: 16,
    backgroundColor: 'rgba(13,13,13,0.92)',
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
  },
  nextBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.lg },
  nextBtnGradient: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  nextBtnText: { fontSize: Typography.md, fontWeight: '800', color: Colors.bgDark },
});

const featureStyles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: BorderRadius.xl,
    flexDirection: 'row-reverse', gap: Spacing.md, padding: Spacing.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 52, height: 52, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: Typography.md, fontWeight: '700', textAlign: 'right', marginBottom: 8 },
  itemRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    gap: 8, marginBottom: 5,
  },
  bullet: { width: 5, height: 5, borderRadius: 3, flexShrink: 0 },
  itemText: { color: 'rgba(255,255,255,0.65)', fontSize: Typography.sm, textAlign: 'right', flex: 1 },
});
