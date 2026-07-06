import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Platform, Modal, Alert, Linking,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import { useAuthContext } from '@/contexts/AuthContext';
import { useAlert } from '@/template';

const DOCS = [
  {
    id: 'id_card',
    title: 'الهوية الشخصية',
    description: 'صورة واضحة لوجهتي بطاقة الهوية الشخصية',
    placeholder: require('@/assets/images/id-card.png'),
    required: true,
    icon: 'badge',
  },
  {
    id: 'driver_license',
    title: 'رخصة القيادة',
    description: 'صورة واضحة لرخصة القيادة الخاصة بك',
    placeholder: require('@/assets/images/id-card.png'),
    required: true,
    icon: 'drive-eta',
  },
  {
    id: 'vehicle_license',
    title: 'رخصة المركبة',
    description: 'صورة واضحة لرخصة تشغيل المركبة',
    placeholder: require('@/assets/images/vehicle-photo.png'),
    required: true,
    icon: 'article',
  },
  {
    id: 'vehicle_photo',
    title: 'صورة المركبة',
    description: 'صورة واضحة للمركبة من الجانب',
    placeholder: require('@/assets/images/vehicle-photo.png'),
    required: true,
    icon: 'directions-car',
  },
];

interface DocState {
  uri: string | null;
  storagePath: string | null;
  uploading: boolean;
  uploadProgress: number;
  error: string | null;
}

function initialDocState(): DocState {
  return { uri: null, storagePath: null, uploading: false, uploadProgress: 0, error: null };
}

// ── Upload Source Modal ───────────────────────────────────────────
function UploadSourceModal({
  visible,
  docTitle,
  onCamera,
  onGallery,
  onClose,
}: {
  visible: boolean;
  docTitle: string;
  onCamera: () => void;
  onGallery: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <View style={modalStyles.overlay}>
        <TouchableOpacity style={modalStyles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={modalStyles.sheet}>
          <View style={modalStyles.handle} />

          <Text style={modalStyles.title}>رفع مستند</Text>
          <Text style={modalStyles.subtitle}>{docTitle}</Text>

          <View style={modalStyles.options}>
            {/* Camera */}
            <TouchableOpacity
              style={modalStyles.optionBtn}
              onPress={() => { onClose(); onCamera(); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.primary + '20', Colors.primary + '08']}
                style={modalStyles.optionGrad}
              >
                <View style={[modalStyles.optionIcon, { backgroundColor: Colors.primary + '20' }]}>
                  <MaterialIcons name="camera-alt" size={28} color={Colors.primary} />
                </View>
                <Text style={[modalStyles.optionLabel, { color: Colors.primary }]}>الكاميرا</Text>
                <Text style={modalStyles.optionSub}>التقط صورة جديدة</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Gallery */}
            <TouchableOpacity
              style={modalStyles.optionBtn}
              onPress={() => { onClose(); onGallery(); }}
              activeOpacity={0.85}
            >
              <LinearGradient
                colors={[Colors.success + '20', Colors.success + '08']}
                style={modalStyles.optionGrad}
              >
                <View style={[modalStyles.optionIcon, { backgroundColor: Colors.success + '20' }]}>
                  <MaterialIcons name="photo-library" size={28} color={Colors.success} />
                </View>
                <Text style={[modalStyles.optionLabel, { color: Colors.success }]}>مكتبة الصور</Text>
                <Text style={modalStyles.optionSub}>اختر من معرض الصور</Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={modalStyles.cancelBtn} onPress={onClose} activeOpacity={0.85}>
            <Text style={modalStyles.cancelText}>إلغاء</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ── Image Preview Modal ───────────────────────────────────────────
function ImagePreviewModal({
  uri,
  title,
  onClose,
  onReplace,
  onDelete,
}: {
  uri: string;
  title: string;
  onClose: () => void;
  onReplace: () => void;
  onDelete: () => void;
}) {
  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onClose}>
      <View style={previewStyles.overlay}>
        <TouchableOpacity style={previewStyles.backdrop} onPress={onClose} activeOpacity={1} />
        <View style={previewStyles.container}>
          <View style={previewStyles.header}>
            <TouchableOpacity onPress={onClose} style={previewStyles.closeBtn}>
              <MaterialIcons name="close" size={22} color="#fff" />
            </TouchableOpacity>
            <Text style={previewStyles.title}>{title}</Text>
            <View style={{ width: 36 }} />
          </View>

          <Image
            source={{ uri }}
            style={previewStyles.image}
            contentFit="contain"
            transition={200}
          />

          <View style={previewStyles.actions}>
            <TouchableOpacity
              style={[previewStyles.actionBtn, { backgroundColor: Colors.error + '18', borderColor: Colors.error + '40' }]}
              onPress={onDelete}
              activeOpacity={0.85}
            >
              <MaterialIcons name="delete" size={18} color={Colors.error} />
              <Text style={[previewStyles.actionText, { color: Colors.error }]}>حذف</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[previewStyles.actionBtn, { backgroundColor: Colors.primary + '18', borderColor: Colors.primary + '40' }]}
              onPress={onReplace}
              activeOpacity={0.85}
            >
              <MaterialIcons name="refresh" size={18} color={Colors.primary} />
              <Text style={[previewStyles.actionText, { color: Colors.primary }]}>استبدال</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ── Permissions Helper ────────────────────────────────────────────
async function requestCameraPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();
  if (status === 'granted') return true;
  if (!canAskAgain) {
    Alert.alert(
      'إذن الكاميرا مطلوب',
      'يرجى تفعيل إذن الكاميرا من إعدادات الجهاز.',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }
  return false;
}

async function requestGalleryPermission(): Promise<boolean> {
  const { status, canAskAgain } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status === 'granted') return true;
  if (!canAskAgain) {
    Alert.alert(
      'إذن معرض الصور مطلوب',
      'يرجى تفعيل إذن الوصول لمعرض الصور من إعدادات الجهاز.',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'فتح الإعدادات', onPress: () => Linking.openSettings() },
      ]
    );
    return false;
  }
  return false;
}

export default function DriverRegistrationDocsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const { showAlert } = useAlert();

  const [docStates, setDocStates] = useState<Record<string, DocState>>(
    Object.fromEntries(DOCS.map(d => [d.id, initialDocState()]))
  );

  // Which doc is currently showing the upload source modal
  const [uploadModalDocId, setUploadModalDocId] = useState<string | null>(null);
  // Which doc is showing image preview
  const [previewDocId, setPreviewDocId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateDoc = (id: string, patch: Partial<DocState>) => {
    setDocStates(prev => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  // ── Upload image to Supabase storage ──────────────────────────
  const uploadToStorage = useCallback(async (docId: string, uri: string): Promise<string | null> => {
    if (!user?.id) return null;
    updateDoc(docId, { uploading: true, error: null, uploadProgress: 0 });
    try {
      const supabase = getSupabaseClient();
      const ext = uri.split('.').pop()?.toLowerCase().replace('jpeg', 'jpg') ?? 'jpg';
      const path = `${user.id}/${docId}.${ext}`;

      // Simulate progress feedback
      updateDoc(docId, { uploadProgress: 20 });

      const resp = await fetch(uri);
      const blob = await resp.blob();
      updateDoc(docId, { uploadProgress: 50 });
      const uploadData = await blob.arrayBuffer();
      updateDoc(docId, { uploadProgress: 75 });

      const contentType = ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      const { error } = await supabase.storage
        .from('driver-documents')
        .upload(path, uploadData, { contentType, upsert: true });

      if (error) {
        updateDoc(docId, { uploading: false, uploadProgress: 0, error: error.message });
        return null;
      }

      updateDoc(docId, { uploading: false, uploadProgress: 100, storagePath: path });
      return path;
    } catch (e: any) {
      updateDoc(docId, { uploading: false, uploadProgress: 0, error: e.message ?? 'فشل الرفع' });
      return null;
    }
  }, [user?.id]);

  // ── Take photo from camera ────────────────────────────────────
  const takePhoto = useCallback(async (docId: string) => {
    const ok = await requestCameraPermission();
    if (!ok) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    updateDoc(docId, { uri, storagePath: null, error: null });
    await uploadToStorage(docId, uri);
  }, [uploadToStorage]);

  // ── Pick from gallery ─────────────────────────────────────────
  const pickFromGallery = useCallback(async (docId: string) => {
    const ok = await requestGalleryPermission();
    if (!ok) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      allowsEditing: true,
      base64: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const uri = result.assets[0].uri;
    updateDoc(docId, { uri, storagePath: null, error: null });
    await uploadToStorage(docId, uri);
  }, [uploadToStorage]);

  // ── Remove doc ────────────────────────────────────────────────
  const removeDoc = useCallback((docId: string) => {
    setDocStates(prev => ({ ...prev, [docId]: initialDocState() }));
    setPreviewDocId(null);
  }, []);

  const uploadedCount = Object.values(docStates).filter(s => s.storagePath !== null).length;
  const allUploaded = uploadedCount === DOCS.length;

  // ── Submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!allUploaded || !user?.id) return;
    setSubmitting(true);
    try {
      const supabase = getSupabaseClient();
      const documents: Record<string, string> = {};
      DOCS.forEach(d => {
        if (docStates[d.id].storagePath) documents[d.id] = docStates[d.id].storagePath!;
      });

      const { error } = await supabase
        .from('drivers')
        .update({ documents, updated_at: new Date().toISOString() })
        .eq('user_id', user.id);

      if (error) {
        showAlert('خطأ', 'حدث خطأ أثناء حفظ الوثائق. يرجى المحاولة مرة أخرى.');
        return;
      }

      showAlert(
        'تم الإرسال بنجاح!',
        'تم رفع وثائقك وسيتم مراجعتها خلال 24-48 ساعة.',
        [{ text: 'حسناً', onPress: () => router.back() }]
      );
    } catch (e: any) {
      showAlert('خطأ', e.message ?? 'حدث خطأ غير متوقع');
    } finally {
      setSubmitting(false);
    }
  };

  const uploadModalDoc = DOCS.find(d => d.id === uploadModalDocId);
  const previewDoc = previewDocId ? DOCS.find(d => d.id === previewDocId) : null;
  const previewState = previewDocId ? docStates[previewDocId] : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="light" />

      {/* Upload Source Modal */}
      {uploadModalDocId && uploadModalDoc ? (
        <UploadSourceModal
          visible={true}
          docTitle={uploadModalDoc.title}
          onCamera={() => takePhoto(uploadModalDocId)}
          onGallery={() => pickFromGallery(uploadModalDocId)}
          onClose={() => setUploadModalDocId(null)}
        />
      ) : null}

      {/* Image Preview Modal */}
      {previewDocId && previewDoc && previewState?.uri ? (
        <ImagePreviewModal
          uri={previewState.uri}
          title={previewDoc.title}
          onClose={() => setPreviewDocId(null)}
          onReplace={() => {
            setPreviewDocId(null);
            setUploadModalDocId(previewDocId);
          }}
          onDelete={() => removeDoc(previewDocId)}
        />
      ) : null}

      {/* Header */}
      <LinearGradient colors={[Colors.bgDark, Colors.bgNavy]} style={styles.header}>
        <View style={styles.headerRow}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <MaterialIcons name="arrow-forward" size={22} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>وثائق التسجيل</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Progress */}
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(uploadedCount / DOCS.length) * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{uploadedCount} من {DOCS.length} وثائق مرفوعة</Text>
      </LinearGradient>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {DOCS.map(doc => {
          const state = docStates[doc.id];
          const isUploaded = state.storagePath !== null;
          const isUploading = state.uploading;

          return (
            <TouchableOpacity
              key={doc.id}
              style={[
                styles.docCard,
                isUploaded && styles.docCardUploaded,
                state.error ? styles.docCardError : null,
              ]}
              onPress={() => {
                if (isUploading) return;
                if (isUploaded && state.uri) {
                  setPreviewDocId(doc.id);
                } else {
                  setUploadModalDocId(doc.id);
                }
              }}
              activeOpacity={0.88}
              disabled={isUploading}
            >
              {/* Preview thumbnail */}
              <View style={styles.docPreview}>
                {state.uri ? (
                  <Image source={{ uri: state.uri }} style={styles.docImage} contentFit="cover" transition={200} />
                ) : (
                  <Image source={doc.placeholder} style={styles.docImage} contentFit="cover" transition={200} />
                )}

                {isUploading && (
                  <View style={styles.uploadingOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
                    {state.uploadProgress > 0 && (
                      <Text style={styles.progressPct}>{state.uploadProgress}%</Text>
                    )}
                  </View>
                )}

                {isUploaded && !isUploading && (
                  <View style={styles.uploadedOverlay}>
                    <MaterialIcons name="check-circle" size={28} color="#fff" />
                  </View>
                )}
              </View>

              {/* Info */}
              <View style={styles.docBody}>
                <View style={styles.docTitleRow}>
                  <View style={[styles.docIconBg, { backgroundColor: isUploaded ? Colors.success + '18' : Colors.primary + '15' }]}>
                    <MaterialIcons
                      name={doc.icon as any}
                      size={16}
                      color={isUploaded ? Colors.success : Colors.primary}
                    />
                  </View>
                  <Text style={[styles.docTitle, isUploaded && styles.docTitleUploaded]} numberOfLines={1}>
                    {doc.title}
                  </Text>
                  {doc.required && (
                    <View style={styles.requiredBadge}>
                      <Text style={styles.requiredText}>مطلوب</Text>
                    </View>
                  )}
                </View>

                <Text style={styles.docDesc}>{doc.description}</Text>

                {state.error ? (
                  <View style={styles.errorRow}>
                    <MaterialIcons name="error-outline" size={13} color={Colors.error} />
                    <Text style={styles.errorText} numberOfLines={2}>{state.error}</Text>
                  </View>
                ) : null}

                {isUploading ? (
                  <View style={styles.progressBarWrap}>
                    <View style={styles.progressBarTrack}>
                      <View style={[styles.progressBarFill, { width: `${state.uploadProgress}%` }]} />
                    </View>
                    <Text style={styles.uploadingText}>جارٍ الرفع {state.uploadProgress}%</Text>
                  </View>
                ) : null}

                {/* CTA hint */}
                {!isUploaded && !isUploading && !state.error && (
                  <View style={styles.ctaHint}>
                    <MaterialIcons name="add-a-photo" size={13} color={Colors.primary} />
                    <Text style={styles.ctaText}>اضغط لرفع الوثيقة</Text>
                  </View>
                )}

                {isUploaded && !isUploading && (
                  <View style={styles.uploadedHint}>
                    <MaterialIcons name="check-circle" size={13} color={Colors.success} />
                    <Text style={styles.uploadedHintText}>تم الرفع — اضغط للمعاينة أو الاستبدال</Text>
                  </View>
                )}
              </View>

              {/* Status icon */}
              <View style={[
                styles.statusIcon,
                { backgroundColor: isUploaded ? Colors.success + '18' : isUploading ? Colors.primary + '18' : Colors.bgLight }
              ]}>
                {isUploading ? (
                  <ActivityIndicator size="small" color={Colors.primary} />
                ) : (
                  <MaterialIcons
                    name={isUploaded ? 'check-circle' : state.error ? 'error' : 'cloud-upload'}
                    size={22}
                    color={isUploaded ? Colors.success : state.error ? Colors.error : Colors.textLight}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}

        {/* Submit */}
        <TouchableOpacity
          style={[styles.submitBtn, (!allUploaded || submitting) && styles.submitBtnDisabled]}
          disabled={!allUploaded || submitting}
          onPress={handleSubmit}
          activeOpacity={0.9}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialIcons name="send" size={20} color="#fff" />
              <Text style={styles.submitBtnText}>إرسال للمراجعة</Text>
            </>
          )}
        </TouchableOpacity>

        {!allUploaded && (
          <Text style={styles.submitNote}>
            {`يرجى رفع جميع الوثائق المطلوبة (${uploadedCount}/${DOCS.length})`}
          </Text>
        )}

        <View style={{ height: insets.bottom + 24 }} />
      </ScrollView>
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
  progressTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 3,
    marginBottom: 6, overflow: 'hidden',
  },
  progressFill: { height: 6, backgroundColor: Colors.accent, borderRadius: 3 },
  progressText: { color: 'rgba(255,255,255,0.7)', fontSize: Typography.xs, textAlign: 'right' },
  scroll: { padding: Spacing.md },
  docCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.xl,
    flexDirection: 'row-reverse', marginBottom: Spacing.sm,
    borderWidth: 1.5, borderColor: Colors.borderLight,
    overflow: 'hidden', ...Shadows.sm,
  },
  docCardUploaded: { borderColor: Colors.success + '60' },
  docCardError: { borderColor: Colors.error + '60' },
  docPreview: { width: 90, position: 'relative' },
  docImage: { width: 90, height: 90 },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(26,86,219,0.75)',
    alignItems: 'center', justifyContent: 'center', gap: 4,
  },
  progressPct: { color: '#fff', fontSize: 11, fontWeight: '700' },
  uploadedOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.success + 'BB',
    alignItems: 'center', justifyContent: 'center',
  },
  docBody: { flex: 1, padding: Spacing.sm, justifyContent: 'center' },
  docTitleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 6, marginBottom: 4 },
  docIconBg: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  docTitle: { flex: 1, fontSize: Typography.sm, fontWeight: '700', color: Colors.textPrimary, textAlign: 'right' },
  docTitleUploaded: { color: Colors.success },
  docDesc: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'right', lineHeight: 17, marginBottom: 6 },
  requiredBadge: { backgroundColor: Colors.error + '18', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  requiredText: { fontSize: 10, color: Colors.error, fontWeight: '700' },
  errorRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, marginTop: 2 },
  errorText: { flex: 1, fontSize: 11, color: Colors.error, textAlign: 'right' },
  progressBarWrap: { marginTop: 4 },
  progressBarTrack: { height: 4, backgroundColor: Colors.borderLight, borderRadius: 2, overflow: 'hidden', marginBottom: 3 },
  progressBarFill: { height: '100%', backgroundColor: Colors.primary, borderRadius: 2 },
  uploadingText: { fontSize: 11, color: Colors.primary, fontWeight: '500', textAlign: 'right' },
  ctaHint: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  ctaText: { fontSize: 11, color: Colors.primary, fontWeight: '500' },
  uploadedHint: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  uploadedHintText: { fontSize: 11, color: Colors.success, fontWeight: '500' },
  statusIcon: { width: 50, alignItems: 'center', justifyContent: 'center' },
  submitBtn: {
    backgroundColor: Colors.primary, borderRadius: BorderRadius.md,
    paddingVertical: 16, flexDirection: 'row-reverse', alignItems: 'center',
    justifyContent: 'center', gap: 8, marginTop: Spacing.sm, ...Shadows.md,
  },
  submitBtnDisabled: { backgroundColor: Colors.border },
  submitBtnText: { color: '#fff', fontSize: Typography.base, fontWeight: '700' },
  submitNote: { textAlign: 'center', color: Colors.textLight, fontSize: Typography.xs, marginTop: 8 },
});

const modalStyles = StyleSheet.create({
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
  title: { fontSize: Typography.xl, fontWeight: '800', color: Colors.textPrimary, textAlign: 'center', marginBottom: 4 },
  subtitle: { fontSize: Typography.sm, color: Colors.textSecondary, textAlign: 'center', marginBottom: Spacing.lg },
  options: { flexDirection: 'row-reverse', gap: Spacing.sm, marginBottom: Spacing.md },
  optionBtn: { flex: 1, borderRadius: BorderRadius.xl, overflow: 'hidden' },
  optionGrad: { padding: Spacing.lg, alignItems: 'center', gap: 10 },
  optionIcon: {
    width: 60, height: 60, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center', marginBottom: 4,
  },
  optionLabel: { fontSize: Typography.base, fontWeight: '700' },
  optionSub: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center' },
  cancelBtn: {
    paddingVertical: 14, borderRadius: BorderRadius.md,
    borderWidth: 1, borderColor: Colors.border, alignItems: 'center',
  },
  cancelText: { fontSize: Typography.base, color: Colors.textSecondary, fontWeight: '600' },
});

const previewStyles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.92)', justifyContent: 'center' },
  backdrop: StyleSheet.absoluteFillObject,
  container: { margin: Spacing.md },
  header: {
    flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#fff', fontSize: Typography.lg, fontWeight: '700' },
  image: { width: '100%', height: 380, borderRadius: BorderRadius.lg },
  actions: { flexDirection: 'row-reverse', gap: Spacing.sm, marginTop: Spacing.md },
  actionBtn: {
    flex: 1, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 14, borderRadius: BorderRadius.md, borderWidth: 1,
  },
  actionText: { fontSize: Typography.base, fontWeight: '600' },
});
