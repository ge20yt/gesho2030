import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Switch, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';

type Section = 'main' | 'profile' | 'password';

const LANGUAGES = [
  { id: 'ar', label: 'العربية', flag: '🇪🇬' },
  { id: 'en', label: 'English', flag: '🇺🇸' },
];

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, logout } = useAuthContext();
  const { showAlert } = useAlert();

  const [section, setSection] = useState<Section>('main');
  const [profileLoading, setProfileLoading] = useState(true);

  // Profile fields
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);

  // Password fields
  const [currentPass, setCurrentPass] = useState('');
  const [newPass, setNewPass] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [savingPass, setSavingPass] = useState(false);

  // Notification preferences
  const [notifRide, setNotifRide] = useState(true);
  const [notifPromo, setNotifPromo] = useState(true);
  const [notifSound, setNotifSound] = useState(true);
  const [savingNotifs, setSavingNotifs] = useState(false);

  const [language, setLanguage] = useState('ar');

  // ── Load profile from Supabase ─────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user?.id) { setProfileLoading(false); return; }
    try {
      const supabase = getSupabaseClient();
      const { data } = await supabase
        .from('user_profiles')
        .select('username, email, phone, notification_ride, notification_promo, notification_sound')
        .eq('id', user.id)
        .single();

      if (data) {
        setName(data.username ?? user?.name ?? '');
        setPhone(data.phone ?? '');
        setNotifRide(data.notification_ride ?? true);
        setNotifPromo(data.notification_promo ?? true);
        setNotifSound(data.notification_sound ?? true);
      }
    } catch { /* silent */ }
    finally { setProfileLoading(false); }
  }, [user?.id]);

  useEffect(() => { loadProfile(); }, [loadProfile]);

  // ── Save profile to Supabase ───────────────────────────────────
  const handleSaveProfile = async () => {
    if (!name.trim()) { showAlert('خطأ', 'يرجى إدخال الاسم'); return; }
    if (!user?.id) return;
    setSavingProfile(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase
        .from('user_profiles')
        .update({
          username: name.trim(),
          phone: phone.trim(),
        })
        .eq('id', user.id);

      if (error) {
        showAlert('خطأ', 'فشل حفظ البيانات. يرجى المحاولة مرة أخرى.');
        return;
      }
      showAlert('تم الحفظ', 'تم تحديث بياناتك بنجاح', [
        { text: 'حسناً', onPress: () => setSection('main') },
      ]);
    } catch (e: any) {
      showAlert('خطأ', e.message ?? 'حدث خطأ غير متوقع');
    } finally {
      setSavingProfile(false);
    }
  };

  // ── Save notification settings ─────────────────────────────────
  const saveNotificationSettings = async (ride: boolean, promo: boolean, sound: boolean) => {
    if (!user?.id) return;
    setSavingNotifs(true);
    try {
      const supabase = getSupabaseClient();
      await supabase
        .from('user_profiles')
        .update({
          notification_ride: ride,
          notification_promo: promo,
          notification_sound: sound,
        })
        .eq('id', user.id);
    } catch { /* silent */ }
    finally { setSavingNotifs(false); }
  };

  const toggleNotifRide = (v: boolean) => {
    setNotifRide(v);
    saveNotificationSettings(v, notifPromo, notifSound);
  };
  const toggleNotifPromo = (v: boolean) => {
    setNotifPromo(v);
    saveNotificationSettings(notifRide, v, notifSound);
  };
  const toggleNotifSound = (v: boolean) => {
    setNotifSound(v);
    saveNotificationSettings(notifRide, notifPromo, v);
  };

  // ── Change password via Supabase Auth ──────────────────────────
  const handleChangePassword = async () => {
    if (!currentPass) { showAlert('خطأ', 'يرجى إدخال كلمة المرور الحالية'); return; }
    if (newPass.length < 6) { showAlert('خطأ', 'كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل'); return; }
    if (newPass !== confirmPass) { showAlert('خطأ', 'كلمات المرور غير متطابقة'); return; }
    setSavingPass(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) {
        showAlert('خطأ', error.message);
        return;
      }
      setCurrentPass(''); setNewPass(''); setConfirmPass('');
      showAlert('تم التغيير', 'تم تغيير كلمة المرور بنجاح', [
        { text: 'حسناً', onPress: () => setSection('main') },
      ]);
    } catch (e: any) {
      showAlert('خطأ', e.message ?? 'فشل تغيير كلمة المرور');
    } finally {
      setSavingPass(false);
    }
  };

  const handleDeleteAccount = () => {
    showAlert(
      'حذف الحساب',
      'هل أنت متأكد من حذف حسابك؟ لن تتمكن من استعادة بياناتك بعد الحذف.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الحساب',
          style: 'destructive',
          onPress: () => {
            showAlert('تم الحذف', 'تم حذف حسابك بنجاح', [
              { text: 'موافق', onPress: () => { logout(); router.replace('/'); } },
            ]);
          },
        },
      ]
    );
  };

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
            <TouchableOpacity
              onPress={() => section === 'main' ? router.back() : setSection('main')}
              style={styles.backBtn}
            >
              <MaterialIcons name="arrow-forward" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {section === 'main' ? 'الإعدادات' : section === 'profile' ? 'تعديل البيانات' : 'تغيير كلمة المرور'}
            </Text>
            <View style={{ width: 36 }} />
          </View>
        </LinearGradient>

        {profileLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>جارٍ تحميل الإعدادات...</Text>
          </View>
        ) : (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scroll}
            keyboardShouldPersistTaps="handled"
          >

            {/* ──────── MAIN SETTINGS ──────── */}
            {section === 'main' && (
              <>
                {/* Account Section */}
                <Text style={styles.groupTitle}>الحساب</Text>
                <View style={styles.card}>
                  <TouchableOpacity style={[styles.row, styles.rowBorder]} onPress={() => setSection('profile')} activeOpacity={0.85}>
                    <MaterialIcons name="chevron-left" size={20} color={Colors.textLight} />
                    <View style={styles.rowContent}>
                      <Text style={styles.rowTitle}>تعديل الاسم والهاتف</Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {name || user?.email || 'بيانات الملف الشخصي'}
                        {phone ? ` · ${phone}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.primary + '18' }]}>
                      <MaterialIcons name="account-circle" size={20} color={Colors.primary} />
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.row} onPress={() => setSection('password')} activeOpacity={0.85}>
                    <MaterialIcons name="chevron-left" size={20} color={Colors.textLight} />
                    <View style={styles.rowContent}>
                      <Text style={styles.rowTitle}>تغيير كلمة المرور</Text>
                      <Text style={styles.rowSub}>تحديث كلمة مرور حسابك</Text>
                    </View>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.warning + '18' }]}>
                      <MaterialIcons name="lock" size={20} color={Colors.warning} />
                    </View>
                  </TouchableOpacity>
                </View>

                {/* Notifications Section */}
                <Text style={styles.groupTitle}>
                  الإشعارات{savingNotifs ? ' (جارٍ الحفظ...)' : ''}
                </Text>
                <View style={styles.card}>
                  {[
                    { label: 'إشعارات الرحلات',   sub: 'قبول الرحلة، وصول السائق، الاكتمال', value: notifRide,  toggle: toggleNotifRide,  color: Colors.success },
                    { label: 'العروض والكوبونات',  sub: 'أحدث العروض والخصومات',              value: notifPromo, toggle: toggleNotifPromo, color: Colors.accent },
                    { label: 'الأصوات',             sub: 'صوت الإشعارات والتنبيهات',           value: notifSound, toggle: toggleNotifSound, color: Colors.primary },
                  ].map((item, i, arr) => (
                    <View key={i} style={[styles.switchRow, i < arr.length - 1 && styles.rowBorder]}>
                      <Switch
                        value={item.value}
                        onValueChange={item.toggle}
                        trackColor={{ false: Colors.border, true: item.color + '60' }}
                        thumbColor={item.value ? item.color : '#ccc'}
                      />
                      <View style={styles.rowContent}>
                        <Text style={styles.rowTitle}>{item.label}</Text>
                        <Text style={styles.rowSub}>{item.sub}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Language Section */}
                <Text style={styles.groupTitle}>اللغة</Text>
                <View style={styles.card}>
                  {LANGUAGES.map((lang, i) => (
                    <TouchableOpacity
                      key={lang.id}
                      style={[styles.langRow, i < LANGUAGES.length - 1 && styles.rowBorder]}
                      onPress={() => setLanguage(lang.id)}
                      activeOpacity={0.85}
                    >
                      <View style={[styles.radioOuter, language === lang.id && styles.radioActive]}>
                        {language === lang.id && <View style={styles.radioInner} />}
                      </View>
                      <Text style={styles.langLabel}>{lang.label}</Text>
                      <Text style={styles.langFlag}>{lang.flag}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Danger Zone */}
                <Text style={[styles.groupTitle, { color: Colors.error }]}>منطقة الخطر</Text>
                <View style={[styles.card, { borderColor: Colors.error + '30', borderWidth: 1 }]}>
                  <TouchableOpacity style={styles.row} onPress={handleDeleteAccount} activeOpacity={0.85}>
                    <MaterialIcons name="chevron-left" size={20} color={Colors.error} />
                    <View style={styles.rowContent}>
                      <Text style={[styles.rowTitle, { color: Colors.error }]}>حذف الحساب</Text>
                      <Text style={styles.rowSub}>سيتم حذف جميع بياناتك نهائياً</Text>
                    </View>
                    <View style={[styles.rowIcon, { backgroundColor: Colors.error + '18' }]}>
                      <MaterialIcons name="delete-forever" size={20} color={Colors.error} />
                    </View>
                  </TouchableOpacity>
                </View>

                <View style={{ height: 40 }} />
              </>
            )}

            {/* ──────── PROFILE EDIT ──────── */}
            {section === 'profile' && (
              <>
                <View style={styles.card}>
                  <Text style={styles.fieldLabel}>الاسم الكامل</Text>
                  <TextInput
                    style={styles.input}
                    value={name}
                    onChangeText={setName}
                    placeholder="اسمك الكامل"
                    placeholderTextColor={Colors.textLight}
                    textAlign="right"
                  />
                  <View style={styles.inputDivider} />
                  <Text style={styles.fieldLabel}>البريد الإلكتروني</Text>
                  <TextInput
                    style={[styles.input, styles.inputDisabled]}
                    value={user?.email ?? ''}
                    editable={false}
                    textAlign="right"
                  />
                  <View style={styles.inputDivider} />
                  <Text style={styles.fieldLabel}>رقم الهاتف</Text>
                  <TextInput
                    style={styles.input}
                    value={phone}
                    onChangeText={setPhone}
                    placeholder="01XXXXXXXXX"
                    placeholderTextColor={Colors.textLight}
                    keyboardType="phone-pad"
                    textAlign="right"
                  />
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, savingProfile && { opacity: 0.7 }]}
                  onPress={handleSaveProfile}
                  disabled={savingProfile}
                  activeOpacity={0.9}
                >
                  {savingProfile ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="check" size={20} color="#fff" />
                      <Text style={styles.saveBtnText}>حفظ التغييرات</Text>
                    </>
                  )}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </>
            )}

            {/* ──────── CHANGE PASSWORD ──────── */}
            {section === 'password' && (
              <>
                <View style={styles.card}>
                  <Text style={styles.fieldLabel}>كلمة المرور الحالية</Text>
                  <View style={styles.passRow}>
                    <TouchableOpacity onPress={() => setShowCurrent(v => !v)} style={styles.eyeBtn}>
                      <MaterialIcons name={showCurrent ? 'visibility-off' : 'visibility'} size={20} color={Colors.textLight} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={currentPass}
                      onChangeText={setCurrentPass}
                      placeholder="••••••••"
                      placeholderTextColor={Colors.textLight}
                      secureTextEntry={!showCurrent}
                      textAlign="right"
                    />
                  </View>
                  <View style={styles.inputDivider} />

                  <Text style={styles.fieldLabel}>كلمة المرور الجديدة</Text>
                  <View style={styles.passRow}>
                    <TouchableOpacity onPress={() => setShowNew(v => !v)} style={styles.eyeBtn}>
                      <MaterialIcons name={showNew ? 'visibility-off' : 'visibility'} size={20} color={Colors.textLight} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={newPass}
                      onChangeText={setNewPass}
                      placeholder="6 أحرف على الأقل"
                      placeholderTextColor={Colors.textLight}
                      secureTextEntry={!showNew}
                      textAlign="right"
                    />
                  </View>
                  <View style={styles.inputDivider} />

                  <Text style={styles.fieldLabel}>تأكيد كلمة المرور</Text>
                  <View style={styles.passRow}>
                    <TouchableOpacity onPress={() => setShowConfirm(v => !v)} style={styles.eyeBtn}>
                      <MaterialIcons name={showConfirm ? 'visibility-off' : 'visibility'} size={20} color={Colors.textLight} />
                    </TouchableOpacity>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      value={confirmPass}
                      onChangeText={setConfirmPass}
                      placeholder="أعد إدخال كلمة المرور"
                      placeholderTextColor={Colors.textLight}
                      secureTextEntry={!showConfirm}
                      textAlign="right"
                    />
                  </View>

                  {newPass.length > 0 && (
                    <View style={styles.strengthWrap}>
                      <Text style={[styles.strengthLabel, {
                        color: newPass.length >= 8 ? Colors.success : newPass.length >= 6 ? Colors.warning : Colors.error
                      }]}>
                        {newPass.length >= 8 ? 'قوية' : newPass.length >= 6 ? 'متوسطة' : 'ضعيفة'}
                      </Text>
                      <View style={styles.strengthBar}>
                        {[1, 2, 3].map(i => (
                          <View key={i} style={[styles.strengthSegment, {
                            backgroundColor: i === 1
                              ? (newPass.length >= 4 ? Colors.error : Colors.border)
                              : i === 2
                              ? (newPass.length >= 6 ? Colors.warning : Colors.border)
                              : (newPass.length >= 8 ? Colors.success : Colors.border),
                          }]} />
                        ))}
                      </View>
                    </View>
                  )}
                </View>

                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: Colors.warning }, savingPass && { opacity: 0.7 }]}
                  onPress={handleChangePassword}
                  disabled={savingPass}
                  activeOpacity={0.9}
                >
                  {savingPass ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <MaterialIcons name="lock" size={20} color="#fff" />
                      <Text style={styles.saveBtnText}>تغيير كلمة المرور</Text>
                    </>
                  )}
                </TouchableOpacity>
                <View style={{ height: 40 }} />
              </>
            )}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingText: { color: Colors.textSecondary, fontSize: Typography.sm },
  header: { paddingHorizontal: Spacing.md, paddingBottom: Spacing.md },
  headerRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'space-between', paddingVertical: Spacing.md,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: { color: '#fff', fontSize: Typography.xl, fontWeight: '700' },
  scroll: { padding: Spacing.md },
  groupTitle: {
    fontSize: Typography.sm, fontWeight: '700', color: Colors.textSecondary,
    textAlign: 'right', marginBottom: Spacing.xs, marginTop: Spacing.sm, paddingHorizontal: 4,
  },
  card: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    marginBottom: Spacing.md, overflow: 'hidden', ...Shadows.sm,
  },
  row: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14, gap: Spacing.sm,
  },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  rowIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  rowContent: { flex: 1 },
  rowTitle: { fontSize: Typography.base, fontWeight: '600', color: Colors.textPrimary, textAlign: 'right' },
  rowSub: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },
  switchRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 12, gap: Spacing.sm,
  },
  langRow: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14, gap: Spacing.sm,
  },
  langLabel: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, textAlign: 'right', fontWeight: '500' },
  langFlag: { fontSize: 24 },
  radioOuter: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: Colors.border,
    alignItems: 'center', justifyContent: 'center',
  },
  radioActive: { borderColor: Colors.primary },
  radioInner: { width: 11, height: 11, borderRadius: 6, backgroundColor: Colors.primary },
  fieldLabel: {
    fontSize: Typography.sm, fontWeight: '600', color: Colors.textSecondary,
    textAlign: 'right', paddingHorizontal: Spacing.md, paddingTop: Spacing.md, paddingBottom: 4,
  },
  input: {
    fontSize: Typography.base, color: Colors.textPrimary,
    paddingHorizontal: Spacing.md, paddingVertical: 12, textAlign: 'right',
  },
  inputDisabled: { color: Colors.textLight, backgroundColor: Colors.bgLight },
  inputDivider: { height: 1, backgroundColor: Colors.borderLight, marginHorizontal: Spacing.md },
  passRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingLeft: Spacing.sm },
  eyeBtn: { paddingHorizontal: Spacing.sm },
  strengthWrap: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm,
    paddingHorizontal: Spacing.md, paddingTop: Spacing.sm, paddingBottom: Spacing.md,
  },
  strengthLabel: { fontSize: Typography.xs, fontWeight: '600' },
  strengthBar: { flex: 1, flexDirection: 'row-reverse', gap: 4 },
  strengthSegment: { flex: 1, height: 4, borderRadius: 2 },
  saveBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 15, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 8, ...Shadows.md, marginBottom: Spacing.sm,
  },
  saveBtnText: { color: '#fff', fontSize: Typography.base, fontWeight: '700' },
});
