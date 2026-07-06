import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';

// ── Vehicle Types ─────────────────────────────────────────────────
const VEHICLE_TYPES = [
  { id: 'توك توك',  label: 'توك توك',   icon: 'electric-rickshaw' },
  { id: 'موتوسيكل', label: 'موتوسيكل', icon: 'two-wheeler'        },
  { id: 'سيارة',    label: 'سيارة',     icon: 'directions-car'     },
  { id: 'ميكروباص', label: 'ميكروباص', icon: 'airport-shuttle'    },
];

export default function DriverRegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showAlert } = useAlert();
  const { user } = useAuthContext();

  // ── Form fields ────────────────────────────────────────────────
  const [name,        setName]        = useState(user?.name ?? '');
  const [phone,       setPhone]       = useState(user?.phone ?? '');
  const [vehicle,     setVehicle]     = useState('');
  const [plate,       setPlate]       = useState('');
  const [vehicleType, setVehicleType] = useState(VEHICLE_TYPES[0].id);
  const [submitting,  setSubmitting]  = useState(false);

  // ── Validation ─────────────────────────────────────────────────
  const validate = (): string | null => {
    if (!name.trim())    return 'يرجى إدخال الاسم الكامل';
    if (!phone.trim())   return 'يرجى إدخال رقم الهاتف';
    if (phone.trim().length < 10) return 'رقم الهاتف غير صحيح';
    if (!vehicle.trim()) return 'يرجى إدخال نوع/موديل المركبة';
    if (!plate.trim())   return 'يرجى إدخال رقم اللوحة';
    return null;
  };

  // ── Submit (upsert on phone) ───────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const validationError = validate();
    if (validationError) { showAlert('خطأ', validationError); return; }
    if (!user?.id) { showAlert('خطأ', 'يجب تسجيل الدخول أولاً'); return; }

    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();

      // Check if a driver record already exists for this user_id
      const { data: existing } = await supabase
        .from('drivers')
        .select('id, phone')
        .eq('user_id', user.id)
        .single();

      // Check if the phone number is taken by a DIFFERENT user
      if (!existing) {
        const { data: phoneConflict } = await supabase
          .from('drivers')
          .select('id')
          .eq('phone', phone.trim())
          .neq('user_id', user.id)
          .single();

        if (phoneConflict) {
          showAlert(
            'رقم مستخدم',
            'رقم الهاتف هذا مسجل بحساب سائق آخر. يرجى استخدام رقم مختلف.',
          );
          return;
        }
      }

      const driverPayload = {
        user_id:      user.id,
        name:         name.trim(),
        phone:        phone.trim(),
        vehicle:      vehicle.trim(),
        vehicle_type: vehicleType,
        plate:        plate.trim().toUpperCase(),
        updated_at:   new Date().toISOString(),
      };

      let saveError: any = null;

      if (existing) {
        // UPDATE existing record
        const { error } = await supabase
          .from('drivers')
          .update(driverPayload)
          .eq('id', existing.id);
        saveError = error;
      } else {
        // INSERT new record
        const { error } = await supabase
          .from('drivers')
          .insert({ ...driverPayload, is_online: false, is_active: true, rating: 5.0, total_trips: 0 });
        saveError = error;
      }

      if (saveError) {
        showAlert('خطأ', `فشل حفظ البيانات: ${saveError.message}`);
        return;
      }

      showAlert(
        'تم التسجيل بنجاح!',
        'سيتم مراجعة بياناتك. يرجى رفع المستندات المطلوبة للمتابعة.',
        [
          {
            text: 'رفع المستندات',
            onPress: () => router.push('/driver-registration-docs'),
          },
        ]
      );
    } catch (e: any) {
      showAlert('خطأ', e.message ?? 'حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  }, [name, phone, vehicle, plate, vehicleType, user?.id]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={[styles.container, { paddingTop: insets.top }]}>
        <StatusBar style="light" />

        {/* Header */}
        <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.header}>
          <View style={styles.headerRow}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
              <MaterialIcons name="arrow-forward" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>تسجيل السائق</Text>
            <MaterialIcons name="verified-user" size={26} color={Colors.accent} />
          </View>

          {/* Steps indicator */}
          <View style={styles.stepsRow}>
            {[
              { label: 'البيانات الشخصية', icon: 'person'      },
              { label: 'المستندات',         icon: 'description' },
              { label: 'المراجعة',          icon: 'verified'    },
            ].map((s, i) => (
              <View key={i} style={styles.stepItem}>
                <View style={[styles.stepDot, i === 0 && styles.stepDotActive]}>
                  <MaterialIcons name={s.icon as any} size={14} color={i === 0 ? Colors.bgDark : 'rgba(255,255,255,0.45)'} />
                </View>
                <Text style={[styles.stepLabel, i === 0 && styles.stepLabelActive]}>{s.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
        >
          {/* Personal Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>البيانات الشخصية</Text>

            <Text style={styles.fieldLabel}>الاسم الكامل *</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="person" size={18} color={Colors.textLight} />
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="محمد أحمد علي"
                placeholderTextColor={Colors.textLight}
                textAlign="right"
              />
            </View>

            <View style={styles.fieldDivider} />

            <Text style={styles.fieldLabel}>رقم الهاتف *</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="phone" size={18} color={Colors.textLight} />
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="01XXXXXXXXX"
                placeholderTextColor={Colors.textLight}
                keyboardType="phone-pad"
                textAlign="right"
                maxLength={11}
              />
            </View>
          </View>

          {/* Vehicle Info */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>بيانات المركبة</Text>

            <Text style={styles.fieldLabel}>نوع المركبة *</Text>
            <View style={styles.vehicleTypeRow}>
              {VEHICLE_TYPES.map(vt => (
                <TouchableOpacity
                  key={vt.id}
                  style={[styles.vehicleTypeBtn, vehicleType === vt.id && styles.vehicleTypeBtnActive]}
                  onPress={() => setVehicleType(vt.id)}
                  activeOpacity={0.85}
                >
                  <MaterialIcons
                    name={vt.icon as any}
                    size={20}
                    color={vehicleType === vt.id ? '#fff' : Colors.textSecondary}
                  />
                  <Text style={[styles.vehicleTypeTxt, vehicleType === vt.id && styles.vehicleTypeTxtActive]}>
                    {vt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.fieldDivider} />

            <Text style={styles.fieldLabel}>موديل / وصف المركبة *</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="directions-car" size={18} color={Colors.textLight} />
              <TextInput
                style={styles.input}
                value={vehicle}
                onChangeText={setVehicle}
                placeholder="مثال: توك توك 2022 أحمر"
                placeholderTextColor={Colors.textLight}
                textAlign="right"
              />
            </View>

            <View style={styles.fieldDivider} />

            <Text style={styles.fieldLabel}>رقم اللوحة *</Text>
            <View style={styles.inputWrap}>
              <MaterialIcons name="pin" size={18} color={Colors.textLight} />
              <TextInput
                style={[styles.input, styles.plateInput]}
                value={plate}
                onChangeText={t => setPlate(t.toUpperCase())}
                placeholder="أ ب ج ١٢٣٤"
                placeholderTextColor={Colors.textLight}
                textAlign="right"
                autoCapitalize="characters"
              />
            </View>
          </View>

          {/* Terms notice */}
          <View style={styles.termsBox}>
            <MaterialIcons name="info-outline" size={16} color={Colors.primary} />
            <Text style={styles.termsText}>
              بالتسجيل توافق على{' '}
              <Text style={styles.termsLink}>شروط وأحكام</Text>
              {' '}العمل كسائق على منصة تك توكي.
            </Text>
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
                <MaterialIcons name="arrow-back" size={20} color="#fff" />
                <Text style={styles.submitBtnText}>التالي — رفع المستندات</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={{ height: insets.bottom + 24 }} />
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.lg },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '700' },
  stepsRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', marginTop: Spacing.sm },
  stepItem: { alignItems: 'center', gap: 5 },
  stepDot: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)',
  },
  stepDotActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  stepLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '600', textAlign: 'center' },
  stepLabelActive: { color: Colors.accent, fontWeight: '700' },
  scroll: { padding: Spacing.md },
  card: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.borderLight, ...Shadows.sm,
  },
  cardTitle: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right', marginBottom: Spacing.md },
  fieldLabel: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'right', marginBottom: 6, fontWeight: '600' },
  fieldDivider: { height: 1, backgroundColor: Colors.borderLight, marginVertical: Spacing.md },
  inputWrap: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.bgLight, borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.sm, borderWidth: 1, borderColor: Colors.borderLight,
  },
  input: {
    flex: 1, fontSize: Typography.base, color: Colors.textPrimary,
    paddingVertical: 12, textAlign: 'right',
  },
  plateInput: { fontWeight: '700', letterSpacing: 2, fontSize: Typography.md },
  vehicleTypeRow: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: Spacing.sm },
  vehicleTypeBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 6,
    paddingHorizontal: 12, paddingVertical: 9,
    borderRadius: BorderRadius.md, backgroundColor: Colors.bgLight,
    borderWidth: 1.5, borderColor: Colors.borderLight,
  },
  vehicleTypeBtnActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  vehicleTypeTxt: { fontSize: Typography.sm, color: Colors.textSecondary, fontWeight: '600' },
  vehicleTypeTxtActive: { color: '#fff', fontWeight: '700' },
  termsBox: {
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 8,
    backgroundColor: Colors.primaryLight, borderRadius: BorderRadius.md,
    padding: Spacing.md, marginBottom: Spacing.md,
    borderWidth: 1, borderColor: Colors.primary + '30',
  },
  termsText: { flex: 1, fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'right', lineHeight: 18 },
  termsLink: { color: Colors.primary, fontWeight: '700' },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 15, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 8, ...Shadows.md,
  },
  submitBtnText: { color: '#fff', fontSize: Typography.md, fontWeight: '700' },
});
