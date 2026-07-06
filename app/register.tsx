import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, TextInput,
  KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
  Animated, Easing, Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';

const { width, height } = Dimensions.get('window');

type RegisterStep = 'details' | 'otp';

// ─── Animated Input Field ─────────────────────────────────────────────
function AnimField({
  label, placeholder, icon, value, onChangeText, secureEntry,
  keyboardType, autoCapitalize, rightAction, index,
}: {
  label: string; placeholder: string; icon: string;
  value: string; onChangeText: (t: string) => void;
  secureEntry?: boolean; keyboardType?: any; autoCapitalize?: any;
  rightAction?: React.ReactNode; index: number;
}) {
  const slideAnim = useRef(new Animated.Value(40)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0, duration: 400, delay: index * 80,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1, duration: 400, delay: index * 80,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateY: slideAnim }], opacity: opacityAnim, marginBottom: Spacing.md }}>
      <Text style={styles.label}>{label}</Text>
      <View style={[
        styles.inputWrapper,
        focused && styles.inputWrapperFocused,
      ]}>
        {rightAction || (
          <MaterialIcons name={icon as any} size={20} color={focused ? Colors.accent : 'rgba(255,255,255,0.4)'} style={styles.inputIcon} />
        )}
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="rgba(255,255,255,0.3)"
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={secureEntry}
          keyboardType={keyboardType ?? 'default'}
          autoCapitalize={autoCapitalize ?? 'none'}
          textAlign="right"
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
        />
      </View>
    </Animated.View>
  );
}

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, sendOTP, verifyOTP, operationLoading } = useAuthContext();
  const { showAlert } = useAlert();

  const [step, setStep] = useState<RegisterStep>('details');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');

  // Header animation
  const headerAnim = useRef(new Animated.Value(-20)).current;
  const headerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(headerAnim, { toValue: 0, tension: 80, friction: 8, useNativeDriver: true }),
      Animated.timing(headerOpacity, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
  }, [step]);

  // Progress steps
  const progressSteps = ['التفاصيل', 'التأكيد', 'نوع الحساب'];
  const currentProgress = step === 'details' ? 0 : 1;

  // ── Step 1: Register ──────────────────────────────────────────────
  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPass) {
      showAlert('تنبيه', 'من فضلك أكمل جميع البيانات');
      return;
    }
    if (password !== confirmPass) {
      showAlert('خطأ', 'كلمتا المرور غير متطابقتين');
      return;
    }
    if (password.length < 6) {
      showAlert('تنبيه', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    if (!email.includes('@')) {
      showAlert('تنبيه', 'البريد الإلكتروني غير صحيح');
      return;
    }

    const { error, needsConfirmation } = await register(name.trim(), email.trim(), password);

    if (error) {
      showAlert('خطأ في التسجيل', error);
      return;
    }

    if (needsConfirmation) {
      const { error: otpErr } = await sendOTP(email.trim());
      if (otpErr) {
        showAlert('تم إنشاء الحساب', 'يرجى تأكيد البريد الإلكتروني.');
        router.replace('/account-type');
        return;
      }
      setPendingEmail(email.trim());
      setStep('otp');
      return;
    }

    router.replace('/account-type');
  };

  // ── Step 2: OTP ───────────────────────────────────────────────────
  const handleVerifyOTP = async () => {
    if (!otpCode || otpCode.length < 4) {
      showAlert('تنبيه', 'أدخل رمز التحقق المكون من 4 أرقام');
      return;
    }
    const { error } = await verifyOTP(pendingEmail, otpCode);
    if (error) {
      showAlert('خطأ', error);
      return;
    }
    router.replace('/account-type');
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <LinearGradient
        colors={['#0D0D0D', '#0A1628', '#1A1400']}
        style={StyleSheet.absoluteFillObject}
      />

      {/* Top decorative glow */}
      <View style={styles.topGlow} pointerEvents="none" />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 32 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <Animated.View style={[styles.header, { transform: [{ translateY: headerAnim }], opacity: headerOpacity }]}>
            <TouchableOpacity
              onPress={() => step === 'otp' ? setStep('details') : router.back()}
              style={styles.backBtn}
            >
              <MaterialIcons name="arrow-forward" size={22} color="rgba(255,255,255,0.8)" />
            </TouchableOpacity>
            <View style={styles.headerTextWrap}>
              <Text style={styles.headerTitle}>
                {step === 'details' ? 'إنشاء حساب جديد' : 'تأكيد البريد الإلكتروني'}
              </Text>
              <Text style={styles.headerSub}>
                {step === 'details' ? 'انضم إلى عائلة تك توكي' : `تم الإرسال إلى ${pendingEmail}`}
              </Text>
            </View>
            <Image source={require('@/assets/images/logo.png')} style={styles.headerLogo} contentFit="contain" />
          </Animated.View>

          {/* Progress Bar */}
          <View style={styles.progressRow}>
            {progressSteps.map((s, i) => (
              <React.Fragment key={i}>
                <View style={styles.progressItem}>
                  <View style={[
                    styles.progressDot,
                    i <= currentProgress && styles.progressDotActive,
                    i < currentProgress && styles.progressDotDone,
                  ]}>
                    {i < currentProgress ? (
                      <MaterialIcons name="check" size={12} color="#fff" />
                    ) : (
                      <Text style={[styles.progressNum, i <= currentProgress && styles.progressNumActive]}>{i + 1}</Text>
                    )}
                  </View>
                  <Text style={[styles.progressLabel, i <= currentProgress && styles.progressLabelActive]}>{s}</Text>
                </View>
                {i < progressSteps.length - 1 && (
                  <View style={[styles.progressLine, i < currentProgress && styles.progressLineDone]} />
                )}
              </React.Fragment>
            ))}
          </View>

          {/* ── DETAILS STEP ── */}
          {step === 'details' && (
            <View style={styles.formCard}>
              <AnimField
                label="الاسم الكامل *" placeholder="أدخل اسمك الكامل"
                icon="person" value={name} onChangeText={setName}
                autoCapitalize="words" index={0}
              />
              <AnimField
                label="رقم الهاتف" placeholder="01xxxxxxxxx"
                icon="phone" value={phone} onChangeText={setPhone}
                keyboardType="phone-pad" index={1}
              />
              <AnimField
                label="البريد الإلكتروني *" placeholder="example@email.com"
                icon="email" value={email} onChangeText={setEmail}
                keyboardType="email-address" index={2}
              />

              {/* Password with toggle */}
              <View style={{ marginBottom: Spacing.md }}>
                <Text style={styles.label}>كلمة المرور *</Text>
                <View style={styles.inputWrapper}>
                  <TouchableOpacity onPress={() => setShowPass(v => !v)} style={styles.inputIcon}>
                    <MaterialIcons
                      name={showPass ? 'visibility' : 'visibility-off'}
                      size={20} color="rgba(255,255,255,0.5)"
                    />
                  </TouchableOpacity>
                  <TextInput
                    style={styles.input}
                    placeholder="6 أحرف على الأقل"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={password} onChangeText={setPassword}
                    secureTextEntry={!showPass} textAlign="right"
                  />
                </View>
              </View>

              {/* Confirm Password */}
              <View style={{ marginBottom: Spacing.lg }}>
                <Text style={styles.label}>تأكيد كلمة المرور *</Text>
                <View style={[
                  styles.inputWrapper,
                  confirmPass.length > 0 && password !== confirmPass && styles.inputWrapperError,
                  confirmPass.length > 0 && password === confirmPass && styles.inputWrapperSuccess,
                ]}>
                  <View style={styles.inputIcon}>
                    {confirmPass.length > 0 ? (
                      <MaterialIcons
                        name={password === confirmPass ? 'check-circle' : 'error'}
                        size={20}
                        color={password === confirmPass ? Colors.success : Colors.error}
                      />
                    ) : (
                      <MaterialIcons name="lock-outline" size={20} color="rgba(255,255,255,0.4)" />
                    )}
                  </View>
                  <TextInput
                    style={styles.input}
                    placeholder="أعد إدخال كلمة المرور"
                    placeholderTextColor="rgba(255,255,255,0.3)"
                    value={confirmPass} onChangeText={setConfirmPass}
                    secureTextEntry textAlign="right"
                  />
                </View>
              </View>

              {/* Password strength indicator */}
              {password.length > 0 && (
                <View style={styles.strengthRow}>
                  {[
                    password.length >= 6,
                    /[A-Z]/.test(password) || /[a-z]/.test(password),
                    /[0-9]/.test(password),
                  ].map((ok, i) => (
                    <View key={i} style={[styles.strengthBar, { backgroundColor: ok ? Colors.success : 'rgba(255,255,255,0.15)' }]} />
                  ))}
                  <Text style={styles.strengthLabel}>
                    {password.length < 6 ? 'ضعيفة' : /[0-9]/.test(password) ? 'قوية' : 'متوسطة'}
                  </Text>
                </View>
              )}

              <TouchableOpacity
                style={[styles.primaryBtn, operationLoading && styles.btnDisabled]}
                onPress={handleRegister}
                disabled={operationLoading}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#FFD050', '#E8A020', '#C47D0A']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.primaryBtnGradient}
                >
                  {operationLoading ? (
                    <ActivityIndicator color={Colors.bgDark} />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>متابعة</Text>
                      <MaterialIcons name="arrow-back" size={20} color={Colors.bgDark} />
                    </>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity onPress={() => router.back()} style={styles.loginLink}>
                <Text style={styles.loginLinkText}>
                  لديك حساب بالفعل؟{' '}
                  <Text style={styles.loginLinkBold}>تسجيل الدخول</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* ── OTP STEP ── */}
          {step === 'otp' && (
            <View style={styles.formCard}>
              {/* OTP illustration */}
              <View style={styles.otpIllustration}>
                <View style={styles.otpIconRing}>
                  <MaterialIcons name="mark-email-read" size={44} color={Colors.accent} />
                </View>
                <Text style={styles.otpTitle}>تحقق من بريدك</Text>
                <Text style={styles.otpSubtitle}>
                  أرسلنا رمز مكون من 4 أرقام إلى{'\n'}
                  <Text style={{ color: Colors.accent, fontWeight: '700' }}>{pendingEmail}</Text>
                </Text>
              </View>

              {/* OTP Boxes */}
              <View style={styles.otpBoxRow}>
                {[0, 1, 2, 3].map(i => (
                  <View key={i} style={[
                    styles.otpBox,
                    otpCode.length === i && styles.otpBoxActive,
                    otpCode.length > i && styles.otpBoxFilled,
                  ]}>
                    <Text style={styles.otpBoxText}>{otpCode[i] ?? ''}</Text>
                  </View>
                ))}
              </View>

              {/* Hidden input */}
              <TextInput
                style={styles.hiddenOtpInput}
                value={otpCode}
                onChangeText={t => setOtpCode(t.replace(/[^0-9]/g, '').slice(0, 4))}
                keyboardType="number-pad"
                maxLength={4}
                autoFocus
                caretHidden
              />

              <TouchableOpacity
                style={[styles.primaryBtn, (operationLoading || otpCode.length < 4) && styles.btnDisabled, { marginTop: Spacing.xl }]}
                onPress={handleVerifyOTP}
                disabled={operationLoading || otpCode.length < 4}
                activeOpacity={0.88}
              >
                <LinearGradient
                  colors={['#FFD050', '#E8A020', '#C47D0A']}
                  start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                  style={styles.primaryBtnGradient}
                >
                  {operationLoading ? (
                    <ActivityIndicator color={Colors.bgDark} />
                  ) : (
                    <Text style={styles.primaryBtnText}>تأكيد وإنهاء التسجيل</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              <TouchableOpacity style={styles.loginLink} onPress={() => sendOTP(pendingEmail)}>
                <Text style={styles.loginLinkText}>
                  لم يصلك الرمز؟{' '}
                  <Text style={styles.loginLinkBold}>إعادة الإرسال</Text>
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgDark },
  topGlow: {
    position: 'absolute', top: -80, left: width * 0.3, right: width * 0.3,
    height: 200, borderRadius: 100,
    backgroundColor: Colors.accent + '15',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5, shadowRadius: 60, elevation: 0,
  },
  scroll: { flexGrow: 1, paddingHorizontal: Spacing.md },
  // Header
  header: {
    flexDirection: 'row-reverse', alignItems: 'center',
    gap: Spacing.sm, marginBottom: Spacing.lg,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTextWrap: { flex: 1, alignItems: 'flex-end' },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '800' },
  headerSub: { color: 'rgba(255,255,255,0.45)', fontSize: Typography.xs, marginTop: 2 },
  headerLogo: { width: 40, height: 40, borderRadius: 10 },
  // Progress
  progressRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    marginBottom: Spacing.lg, paddingHorizontal: Spacing.sm,
  },
  progressItem: { alignItems: 'center', gap: 5 },
  progressDot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  progressDotActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '20' },
  progressDotDone: { backgroundColor: Colors.success, borderColor: Colors.success },
  progressNum: { color: 'rgba(255,255,255,0.4)', fontSize: Typography.xs, fontWeight: '700' },
  progressNumActive: { color: Colors.accent },
  progressLabel: { fontSize: 10, color: 'rgba(255,255,255,0.35)', fontWeight: '500' },
  progressLabelActive: { color: Colors.accent, fontWeight: '700' },
  progressLine: {
    flex: 1, height: 2, marginHorizontal: Spacing.xs, marginBottom: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  progressLineDone: { backgroundColor: Colors.success },
  // Form
  formCard: {
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: BorderRadius.xl,
    padding: Spacing.lg, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  label: { color: 'rgba(255,255,255,0.65)', fontSize: Typography.sm, textAlign: 'right', marginBottom: 8, fontWeight: '500' },
  inputWrapper: {
    flexDirection: 'row-reverse', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: BorderRadius.md,
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: Spacing.sm,
  },
  inputWrapperFocused: { borderColor: Colors.accent + '60', backgroundColor: 'rgba(255,208,80,0.06)' },
  inputWrapperError: { borderColor: Colors.error + '70' },
  inputWrapperSuccess: { borderColor: Colors.success + '70' },
  inputIcon: { paddingHorizontal: 6 },
  input: {
    flex: 1, color: '#fff', fontSize: Typography.md,
    paddingVertical: 14, textAlign: 'right',
  },
  // Strength
  strengthRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: Spacing.md, marginTop: -4 },
  strengthBar: { flex: 1, height: 4, borderRadius: 2 },
  strengthLabel: { color: 'rgba(255,255,255,0.45)', fontSize: Typography.xs },
  // Buttons
  primaryBtn: { borderRadius: BorderRadius.lg, overflow: 'hidden', marginTop: Spacing.sm, ...Shadows.lg },
  btnDisabled: { opacity: 0.45 },
  primaryBtnGradient: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16,
  },
  primaryBtnText: { fontSize: Typography.md, fontWeight: '800', color: Colors.bgDark },
  loginLink: { alignItems: 'center', marginTop: Spacing.md, paddingVertical: 6 },
  loginLinkText: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.sm },
  loginLinkBold: { color: Colors.accent, fontWeight: '700' },
  // OTP
  otpIllustration: { alignItems: 'center', marginBottom: Spacing.xl },
  otpIconRing: {
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: Colors.accent + '12', borderWidth: 2, borderColor: Colors.accent + '40',
    alignItems: 'center', justifyContent: 'center', marginBottom: Spacing.md,
    shadowColor: Colors.accent, shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3, shadowRadius: 20, elevation: 0,
  },
  otpTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '800', marginBottom: Spacing.xs },
  otpSubtitle: { color: 'rgba(255,255,255,0.55)', fontSize: Typography.sm, textAlign: 'center', lineHeight: 20 },
  otpBoxRow: {
    flexDirection: 'row-reverse', justifyContent: 'center', gap: 12, marginBottom: Spacing.sm,
  },
  otpBox: {
    width: 56, height: 64, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  otpBoxActive: { borderColor: Colors.accent, backgroundColor: Colors.accent + '12' },
  otpBoxFilled: { borderColor: Colors.success, backgroundColor: Colors.success + '10' },
  otpBoxText: { color: '#fff', fontSize: 26, fontWeight: '800' },
  hiddenOtpInput: {
    position: 'absolute', opacity: 0, width: 1, height: 1,
  },
});
