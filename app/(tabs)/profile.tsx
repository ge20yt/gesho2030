import React, { useState, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl,
  Modal, ActivityIndicator, Alert, Linking, Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';
import { getSupabaseClient } from '@/template';


const MENU_ITEMS = [
  { icon: 'account-circle',            label: 'تعديل الملف الشخصي',  color: Colors.primary },
  { icon: 'history',                   label: 'سجل الرحلات',          color: Colors.success,      route: '/(tabs)/trips' },
  { icon: 'account-balance-wallet',    label: 'المحفظة',              color: Colors.accent,       route: '/(tabs)/wallet' },
  { icon: 'star',                      label: 'تقييماتي',             color: Colors.warning },
  { icon: 'report-problem',            label: 'الشكاوى',              color: Colors.error,        route: '/complaints' },
  { icon: 'emoji-events',              label: 'نقاط المكافآت',        color: Colors.accent,       route: '/rewards' },
  { icon: 'drive-eta',                 label: 'لوحة السائق',          color: '#8B5CF6',           route: '/driver-dashboard' },
  { icon: 'app-registration',          label: 'سجل كسائق',            color: '#10B981',           route: '/driver-register' },
  { icon: 'help-outline',              label: 'المساعدة والدعم',      color: Colors.info },
  { icon: 'privacy-tip',              label: 'سياسة الخصوصية',       color: Colors.textSecondary },
  { icon: 'settings',                  label: 'الإعدادات',             color: Colors.textSecondary, route: '/settings' },
];

// ── Avatar Edit Modal ────────────────────────────────────────────
function AvatarModal({
  visible,
  currentUri,
  uploading,
  onCamera,
  onGallery,
  onDelete,
  onClose,
}: {
  visible: boolean;
  currentUri: string | null;
  uploading: boolean;
  onCamera: () => void;
  onGallery: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={avatarModalStyles.overlay}>
        <TouchableOpacity style={avatarModalStyles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={avatarModalStyles.sheet}>
          <View style={avatarModalStyles.handle} />

          {/* Current avatar preview */}
          <View style={avatarModalStyles.previewWrap}>
            <Image
              source={currentUri
                ? { uri: currentUri }
                : { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face' }}
              style={avatarModalStyles.preview}
              contentFit="cover"
              transition={200}
            />
            {uploading && (
              <View style={avatarModalStyles.uploadingOverlay}>
                <ActivityIndicator color="#fff" size="large" />
                <Text style={avatarModalStyles.uploadingText}>جارٍ الرفع...</Text>
              </View>
            )}
          </View>

          <Text style={avatarModalStyles.title}>تغيير الصورة الشخصية</Text>

          <View style={avatarModalStyles.options}>
            <TouchableOpacity style={avatarModalStyles.optionBtn} onPress={() => { onClose(); onCamera(); }} activeOpacity={0.85}>
              <View style={[avatarModalStyles.optionIcon, { backgroundColor: Colors.primary + '15' }]}>
                <MaterialIcons name="camera-alt" size={24} color={Colors.primary} />
              </View>
              <Text style={avatarModalStyles.optionLabel}>الكاميرا</Text>
            </TouchableOpacity>

            <TouchableOpacity style={avatarModalStyles.optionBtn} onPress={() => { onClose(); onGallery(); }} activeOpacity={0.85}>
              <View style={[avatarModalStyles.optionIcon, { backgroundColor: Colors.success + '15' }]}>
                <MaterialIcons name="photo-library" size={24} color={Colors.success} />
              </View>
              <Text style={avatarModalStyles.optionLabel}>معرض الصور</Text>
            </TouchableOpacity>

            {currentUri && (
              <TouchableOpacity style={avatarModalStyles.optionBtn} onPress={() => { onClose(); onDelete(); }} activeOpacity={0.85}>
                <View style={[avatarModalStyles.optionIcon, { backgroundColor: Colors.error + '15' }]}>
                  <MaterialIcons name="delete" size={24} color={Colors.error} />
                </View>
                <Text style={[avatarModalStyles.optionLabel, { color: Colors.error }]}>حذف</Text>
              </TouchableOpacity>
            )}
          </View>

          <TouchableOpacity style={avatarModalStyles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={avatarModalStyles.cancelText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

async function requestCameraPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
  if (status === 'granted') return true;
  if (!canAskAgain) {
    Alert.alert('إذن الكاميرا', 'يرجى تفعيل إذن الكاميرا من الإعدادات', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() },
    ]);
  }
  return false;
}

async function requestGalleryPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status === 'granted') return true;
  if (!canAskAgain) {
    Alert.alert('إذن معرض الصور', 'يرجى تفعيل الإذن من الإعدادات', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() },
    ]);
  }
  return false;
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, logout } = useAuthContext();
  const { showAlert } = useAlert();

  const [tripCount, setTripCount] = useState(0);
  const [walletBalance, setWalletBalance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [avatarUri, setAvatarUri] = useState<string | null>(user?.avatar ?? null);
  const [avatarModalVisible, setAvatarModalVisible] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  const loadStats = useCallback(async () => {
    if (!user?.id) { setRefreshing(false); return; }
    try {
      const supabase = getSupabaseClient();
      const [tripsRes, walletRes, profileRes] = await Promise.all([
        supabase.from('trips').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'completed'),
        supabase.from('wallets').select('balance').eq('user_id', user.id).single(),
        supabase.from('user_profiles').select('avatar_url').eq('id', user.id).single(),
      ]);

      setTripCount(tripsRes.count ?? 0);
      setWalletBalance(Number(walletRes.data?.balance ?? 0));
      if (profileRes.data?.avatar_url) setAvatarUri(profileRes.data.avatar_url);
    } catch {
      setTripCount(0);
    } finally {
      setRefreshing(false);
    }
  }, [user?.id]);

  useEffect(() => { loadStats(); }, [loadStats]);

  // ── Upload avatar to Supabase storage ──────────────────────────
  const uploadAvatar = useCallback(async (uri: string) => {
    if (!user?.id) return;
    setUploadingAvatar(true);
    try {
      const supabase = getSupabaseClient();
      const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
      const path = `${user.id}/avatar.${ext}`;

      const resp = await fetch(uri);
      const blob = await resp.blob();
      const data = await blob.arrayBuffer();

      const { error } = await supabase.storage
        .from('avatars')
        .upload(path, data, {
          contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
          upsert: true,
        });

      if (error) {
        showAlert('خطأ', 'فشل رفع الصورة. يرجى المحاولة مرة أخرى.');
        return;
      }

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = urlData.publicUrl + `?t=${Date.now()}`;

      await supabase.from('user_profiles').update({ avatar_url: publicUrl }).eq('id', user.id);
      setAvatarUri(publicUrl);
      showAlert('تم التحديث', 'تم تحديث صورتك الشخصية بنجاح');
    } catch (e: any) {
      showAlert('خطأ', e.message ?? 'فشل رفع الصورة');
    } finally {
      setUploadingAvatar(false);
    }
  }, [user?.id]);

  const handleCamera = useCallback(async () => {
    const ok = await requestCameraPermission();
    if (!ok) return;
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    setAvatarUri(result.assets[0].uri);
    await uploadAvatar(result.assets[0].uri);
  }, [uploadAvatar]);

  const handleGallery = useCallback(async () => {
    const ok = await requestGalleryPermission();
    if (!ok) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (result.canceled || !result.assets?.[0]) return;
    setAvatarUri(result.assets[0].uri);
    await uploadAvatar(result.assets[0].uri);
  }, [uploadAvatar]);

  const handleDeleteAvatar = useCallback(async () => {
    if (!user?.id) return;
    showAlert('حذف الصورة', 'هل تريد حذف صورتك الشخصية؟', [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            const supabase = getSupabaseClient();
            await supabase.from('user_profiles').update({ avatar_url: null }).eq('id', user.id);
            setAvatarUri(null);
          } catch { /* silent */ }
        },
      },
    ]);
  }, [user?.id]);

  const handleLogout = () => {
    showAlert('تسجيل الخروج', 'هل تريد تسجيل الخروج من الحساب؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: async () => { await logout(); router.replace('/'); } },
    ]);
  };

  const handleMenuPress = (item: typeof MENU_ITEMS[0]) => {
    if (item.route) {
      router.push(item.route as any);
    } else {
      showAlert('قريباً', 'هذه الميزة ستكون متاحة قريباً');
    }
  };

  const displayName = user?.name ?? user?.email?.split('@')[0] ?? 'مستخدم تك توكي';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      <AvatarModal
        visible={avatarModalVisible}
        currentUri={avatarUri}
        uploading={uploadingAvatar}
        onCamera={handleCamera}
        onGallery={handleGallery}
        onDelete={handleDeleteAvatar}
        onClose={() => setAvatarModalVisible(false)}
      />

      {/* Header */}
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.profileHeader}>
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarWrapper}
            onPress={() => setAvatarModalVisible(true)}
            activeOpacity={0.85}
          >
            <Image
              source={avatarUri
                ? { uri: avatarUri }
                : { uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=120&h=120&fit=crop&crop=face' }
              }
              style={styles.avatar}
              contentFit="cover"
              transition={200}
            />
            {uploadingAvatar ? (
              <View style={styles.uploadingOverlay}>
                <ActivityIndicator color="#fff" size="small" />
              </View>
            ) : (
              <View style={styles.editAvatarBtn}>
                <MaterialIcons name="camera-alt" size={14} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          <Text style={styles.userName}>{displayName}</Text>
          <Text style={styles.userEmail}>{user?.email ?? ''}</Text>
          {user?.phone ? <Text style={styles.userPhone}>{user.phone}</Text> : null}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          {[
            { label: 'الرحلات', value: tripCount.toString(),                                   icon: 'directions-car' },
            { label: 'التقييم', value: '4.8',                                                  icon: 'star' },
            { label: 'المحفظة', value: `${walletBalance.toFixed(0)} ج`,                       icon: 'account-balance-wallet' },
          ].map((stat, i) => (
            <View key={i} style={styles.statItem}>
              <MaterialIcons name={stat.icon as any} size={20} color={Colors.accent} />
              <Text style={styles.statValue}>{stat.value}</Text>
              <Text style={styles.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>
      </LinearGradient>

      {/* Menu */}
      <ScrollView
        style={styles.menuScroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); loadStats(); }}
            tintColor={Colors.accent}
          />
        }
      >
        <View style={styles.menuCard}>
          {MENU_ITEMS.map((item, i) => (
            <TouchableOpacity
              key={i}
              style={[styles.menuItem, i < MENU_ITEMS.length - 1 && styles.menuItemBorder]}
              onPress={() => handleMenuPress(item)}
              activeOpacity={0.85}
            >
              <MaterialIcons name="chevron-left" size={20} color={Colors.textLight} />
              <Text style={styles.menuLabel}>{item.label}</Text>
              <View style={[styles.menuIcon, { backgroundColor: item.color + '18' }]}>
                <MaterialIcons name={item.icon as any} size={20} color={item.color} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.85}>
          <MaterialIcons name="logout" size={20} color={Colors.error} />
          <Text style={styles.logoutText}>تسجيل الخروج</Text>
        </TouchableOpacity>

        <Text style={styles.version}>الإصدار 1.0.0 · تك توكي</Text>
        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  profileHeader: { paddingBottom: Spacing.xl, paddingHorizontal: Spacing.md },
  avatarSection: { alignItems: 'center', paddingVertical: Spacing.lg },
  avatarWrapper: { position: 'relative', marginBottom: Spacing.sm },
  avatar: { width: 90, height: 90, borderRadius: 45, borderWidth: 3, borderColor: Colors.accent },
  uploadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 45, backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center', justifyContent: 'center',
  },
  editAvatarBtn: {
    position: 'absolute', bottom: 2, right: 2,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: Colors.bgNavy,
  },
  userName: { color: '#fff', fontSize: Typography.xl, fontWeight: '800' },
  userEmail: { color: 'rgba(255,255,255,0.5)', fontSize: Typography.xs, marginTop: 2 },
  userPhone: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.sm, marginTop: 2 },
  statsRow: {
    flexDirection: 'row-reverse',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.lg, padding: Spacing.md,
  },
  statItem: { flex: 1, alignItems: 'center', gap: 4 },
  statValue: { color: '#fff', fontSize: Typography.lg, fontWeight: '700' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: Typography.xs },
  menuScroll: { flex: 1 },
  menuCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    margin: Spacing.md, ...Shadows.sm, marginTop: -Spacing.md,
  },
  menuItem: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingVertical: 14, gap: Spacing.sm,
  },
  menuItemBorder: { borderBottomWidth: 1, borderBottomColor: Colors.borderLight },
  menuIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  menuLabel: { flex: 1, fontSize: Typography.base, color: Colors.textPrimary, textAlign: 'right', fontWeight: '500' },
  logoutBtn: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginHorizontal: Spacing.md, backgroundColor: Colors.error + '12',
    borderRadius: BorderRadius.lg, paddingVertical: 14,
    borderWidth: 1, borderColor: Colors.error + '30',
  },
  logoutText: { fontSize: Typography.md, fontWeight: '700', color: Colors.error },
  version: { textAlign: 'center', color: Colors.textLight, fontSize: Typography.xs, marginTop: Spacing.md },
});

const avatarModalStyles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: Colors.bgWhite, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: Spacing.lg, paddingBottom: Spacing.xl, ...Shadows.lg,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: Colors.border,
    alignSelf: 'center', marginBottom: Spacing.lg,
  },
  previewWrap: { alignItems: 'center', marginBottom: Spacing.md, position: 'relative' },
  preview: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: Colors.accent },
  uploadingOverlay: {
    position: 'absolute', top: 0, left: '50%', marginLeft: -50,
    width: 100, height: 100, borderRadius: 50,
    backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  uploadingText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  title: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, textAlign: 'center', marginBottom: Spacing.lg },
  options: { flexDirection: 'row-reverse', justifyContent: 'center', gap: Spacing.lg, marginBottom: Spacing.lg },
  optionBtn: { alignItems: 'center', gap: 8, minWidth: 70 },
  optionIcon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  optionLabel: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary },
  cancelBtn: {
    paddingVertical: 14, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '600' },
});
