import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { Colors, Typography, Spacing, BorderRadius } from '@/constants/theme';

type AuthMode = 'login' | 'otp-email' | 'otp-verify';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, sendOTP, verifyOTP, signInWithGoogle, operationLoading, isLoggedIn, loading } = useAuthContext();
  const { showAlert } = useAlert();

  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(1)).current;

  // Redirect authenticated users to tabs
  useEffect(() => {
    if (!loading && isLoggedIn) {
      router.replace('/(tabs)');
      return;
    }
    AsyncStorage.getItem('onboarding_done').then(val => {
      if (!val) router.replace('/onboarding');
    });
  }, [isLoggedIn, loading]);

  const switchMode = (newMode: AuthMode) => {
    Animated.sequence([
      Animated.timing(fadeAnim, { toValue: 0, duration: 150, useNativeDriver: true }),
      Animated.timing(fadeAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
    ]).start();
    setMode(newMode);
    setOtpCode('');
  };

  // ── Password Login ─────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      showAlert('تنبيه', 'من فضلك أدخل البريد الإلكتروني وكلمة المرور');
      return;
    }
    const { error } = await login(email.trim(), password);
    if (error) { showAlert('خطأ في تسجيل الدخول', error); return; }
    router.replace('/(tabs)');
  };

  // ── Google Sign-In ─────────────────────────────────────────────
  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    const { error } = await signInWithGoogle();
    setGoogleLoading(false);
    if (error) {
      showAlert('خطأ', error);
    }
    // Navigation handled by AuthContext auth state change
  };

  // ── OTP Flow ───────────────────────────────────────────────────
  const handleSendOTP = async () => {
    if (!email.trim()) { showAlert('تنبيه', 'من فضلك أدخل البريد الإلكتروني'); return; }
    const { error } = await sendOTP(email.trim());
    if (error) { showAlert('خطأ', error); return; }
    showAlert('تم الإرسال', `تم إرسال رمز التحقق إلى ${email}`);
    switchMode('otp-verify');
  };

  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 4) {
      showAlert('تنبيه', 'من فضلك أدخل رمز التحقق المكون من 4 أرقام');
      return;
    }
    const { error } = await verifyOTP(email.trim(), otpCode);
    if (error) { showAlert('رمز غير صحيح', error); return; }
    router.replace('/(tabs)');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[Colors.bgDark, Colors.bgNavy, '#1E3A8A']}
        style={StyleSheet.absoluteFillObject}
      />

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 20, paddingBottom: insets.bottom + 20 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Logo */}
          <View style={styles.heroSection}>
            <Image
              source={require('@/assets/images/logo.png')}
              style={styles.logoImage}
              contentFit="contain"
              transition={200}
            />
            <Text style={styles.appName}>تك توكي</Text>
            <Text style={styles.tagline}>أمان .. سرعة .. أمانة</Text>
          </View>

          {/* Hero Image */}
          <View style={styles.heroImageContainer}>
            <Image
              source={require('@/assets/images/splash-hero.png')}
              style={styles.heroImage}
              contentFit="cover"
              transition={300}
            />
            <LinearGradient colors={['transparent', Colors.bgDark]} style={styles.heroGradient} />
          </View>

          <Animated.View style={[styles.formCard, { opacity: fadeAnim }]}>

            {/* ── PASSWORD LOGIN ── */}
            {mode === 'login' && (
              <>
                <Text style={styles.formTitle}>تسجيل الدخول</Text>

                <View style={styles.inputWrapper}>
                  <MaterialIcons name="email" size={20} color={Colors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="البريد الإلكتروني"
                    placeholderTextColor={Colors.textLight}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textAlign="right"
                  />
                </View>

                <View style={styles.inputWrapper}>
                  <TouchableOpacity onPress={() => setShowPass(!showPass)} style={styles.inputIcon}>
                    <MaterialIcons name={showPass ? 'visibility' : 'visibility-off'} size={20} color={Colors.primary} />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.input}
                    placeholder="كلمة المرور"
                    placeholderTextColor={Colors.textLight}
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry={!showPass}
                    textAlign="right"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.btnPrimary, operationLoading && styles.btnDisabled]}
                  onPress={handleLogin}
                  disabled={operationLoading}
                  activeOpacity={0.85}
                >
                  {operationLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>تسجيل دخول</Text>
                  )}
                </TouchableOpacity>

                {/* OTP option */}
                <TouchableOpacity style={styles.altMethodBtn} onPress={() => switchMode('otp-email')}>
                  <MaterialIcons name="sms" size={16} color={Colors.accent} />
                  <Text style={styles.altMethodText}>دخول برمز التحقق OTP</Text>
                </TouchableOpacity>

                {/* ── Google Sign-In ── */}
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>أو</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={[styles.googleBtn, googleLoading && styles.btnDisabled]}
                  onPress={handleGoogleSignIn}
                  disabled={googleLoading}
                  activeOpacity={0.85}
                >
                  {googleLoading ? (
                    <ActivityIndicator color={Colors.textPrimary} />
                  ) : (
                    <>
                      {/* Google G icon using colored circles */}
                      <View style={styles.googleIcon}>
                        <Text style={styles.googleIconText}>G</Text>
                      </View>
                      <Text style={styles.googleBtnText}>تسجيل الدخول بـ Google</Text>
                    </>
                  )}
                </TouchableOpacity>

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>جديد؟</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.btnOutline}
                  onPress={() => router.push('/register')}
                  activeOpacity={0.85}
                >
                  <Text style={styles.btnOutlineText}>إنشاء حساب جديد</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.driverLink} onPress={() => router.push('/driver-register')}>
                  <MaterialIcons name="drive-eta" size={16} color={Colors.accent} />
                  <Text style={styles.driverLinkText}>سجل كسائق</Text>
                </TouchableOpacity>
              </>
            )}

            {/* ── OTP EMAIL INPUT ── */}
            {mode === 'otp-email' && (
              <>
                <TouchableOpacity style={styles.backRow} onPress={() => switchMode('login')}>
                  <MaterialIcons name="arrow-forward" size={20} color={Colors.textWhite} />
                  <Text style={styles.backRowText}>رجوع</Text>
                </TouchableOpacity>

                <Text style={styles.formTitle}>دخول برمز التحقق</Text>
                <Text style={styles.formSubtitle}>سنرسل رمز تحقق مكون من 4 أرقام إلى بريدك</Text>

                <View style={styles.inputWrapper}>
                  <MaterialIcons name="email" size={20} color={Colors.primary} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    placeholder="البريد الإلكتروني"
                    placeholderTextColor={Colors.textLight}
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    textAlign="right"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.btnPrimary, operationLoading && styles.btnDisabled]}
                  onPress={handleSendOTP}
                  disabled={operationLoading}
                  activeOpacity={0.85}
                >
                  {operationLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>إرسال رمز التحقق</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {/* ── OTP VERIFY ── */}
            {mode === 'otp-verify' && (
              <>
                <TouchableOpacity style={styles.backRow} onPress={() => switchMode('otp-email')}>
                  <MaterialIcons name="arrow-forward" size={20} color={Colors.textWhite} />
                  <Text style={styles.backRowText}>رجوع</Text>
                </TouchableOpacity>

                <Text style={styles.formTitle}>أدخل رمز التحقق</Text>
                <Text style={styles.formSubtitle}>تم إرسال رمز مكون من 4 أرقام إلى{'\n'}{email}</Text>

                <View style={[styles.inputWrapper, styles.otpInput]}>
                  <TextInput
                    style={[styles.input, styles.otpText]}
                    placeholder="0000"
                    placeholderTextColor={Colors.textLight}
                    value={otpCode}
                    onChangeText={t => setOtpCode(t.replace(/[^0-9]/g, '').slice(0, 4))}
                    keyboardType="number-pad"
                    textAlign="center"
                    maxLength={4}
                  />
                </View>

                <TouchableOpacity
                  style={[styles.btnPrimary, (operationLoading || otpCode.length < 4) && styles.btnDisabled]}
                  onPress={handleVerifyOTP}
                  disabled={operationLoading || otpCode.length < 4}
                  activeOpacity={0.85}
                >
                  {operationLoading ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <Text style={styles.btnPrimaryText}>تأكيد</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity style={styles.resendBtn} onPress={handleSendOTP} disabled={operationLoading}>
                  <Text style={styles.resendText}>إعادة إرسال الرمز</Text>
                </TouchableOpacity>
              </>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDark },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.md },
  heroSection: { alignItems: 'center', marginBottom: Spacing.sm },
  logoImage: { width: 120, height: 120, borderRadius: 20, marginBottom: Spacing.sm },
  appName: { fontSize: 38, fontWeight: '800', color: Colors.textWhite, textAlign: 'center', letterSpacing: 1 },
  tagline: { fontSize: Typography.md, color: Colors.accent, textAlign: 'center', marginTop: 4 },
  heroImageContainer: { height: 180, borderRadius: BorderRadius.lg, overflow: 'hidden', marginVertical: Spacing.md },
  heroImage: { width: '100%', height: '100%' },
  heroGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80 },
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: BorderRadius.xl, padding: Spacing.lg,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  formTitle: { color: Colors.textWhite, fontSize: Typography.xl, fontWeight: '700', textAlign: 'center', marginBottom: Spacing.xs },
  formSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.sm, textAlign: 'center', marginBottom: Spacing.lg, lineHeight: 22 },
  backRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: Spacing.md },
  backRowText: { color: Colors.textWhite, fontSize: Typography.sm, fontWeight: '600' },
  inputWrapper: {
    flexDirection: 'row-reverse', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)',
    marginBottom: Spacing.sm, paddingHorizontal: Spacing.md,
  },
  otpInput: { justifyContent: 'center' },
  inputIcon: { marginLeft: Spacing.sm },
  input: { flex: 1, color: Colors.textWhite, fontSize: Typography.md, paddingVertical: 14, textAlign: 'right' },
  otpText: { fontSize: 28, fontWeight: '700', letterSpacing: 12, textAlign: 'center', color: Colors.accent },
  btnPrimary: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 15, alignItems: 'center', marginTop: Spacing.md, marginBottom: Spacing.sm,
  },
  btnDisabled: { opacity: 0.5 },
  btnPrimaryText: { color: '#fff', fontSize: Typography.md, fontWeight: '700' },
  altMethodBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10,
  },
  altMethodText: { color: Colors.accent, fontSize: Typography.sm, fontWeight: '600' },
  divider: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm, marginVertical: Spacing.sm },
  dividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },
  dividerText: { color: 'rgba(255,255,255,0.35)', fontSize: Typography.xs },
  // ── Google Button ──
  googleBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 10,
    backgroundColor: '#fff', borderRadius: BorderRadius.md,
    paddingVertical: 13, marginBottom: Spacing.sm,
  },
  googleIcon: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: '#4285F4', alignItems: 'center', justifyContent: 'center',
  },
  googleIconText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  googleBtnText: { color: '#1F2937', fontSize: Typography.base, fontWeight: '700' },
  // ──────────────────
  btnOutline: {
    borderWidth: 1.5, borderColor: Colors.accent, borderRadius: BorderRadius.md,
    paddingVertical: 14, alignItems: 'center', marginBottom: Spacing.md,
  },
  btnOutlineText: { color: Colors.accent, fontSize: Typography.md, fontWeight: '600' },
  driverLink: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  driverLinkText: { color: Colors.accent, fontSize: Typography.sm, fontWeight: '500' },
  resendBtn: { alignItems: 'center', paddingVertical: Spacing.sm },
  resendText: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm },
});
