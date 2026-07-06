import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, Platform, ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { Colors, Typography, Spacing, BorderRadius, Shadows } from '@/constants/theme';
import { MOCK_DRIVERS, SERVICE_TYPES } from '@/services/mockData';
import { useAuthContext } from '@/contexts/AuthContext';
import { useNotifications } from '@/contexts/NotificationsContext';
import HomeMapView from '@/components/HomeMapView';
import { getSupabaseClient } from '@/template';

// Supabase driver shape
interface SupabaseDriver {
  id: string;
  name: string;
  phone: string;
  avatar_url: string | null;
  vehicle: string;
  vehicle_type: string;
  plate: string;
  rating: number;
  total_trips: number;
  is_online: boolean;
  lat: number;
  lng: number;
}

// Normalized driver shape used in UI
interface DisplayDriver {
  id: string;
  supabaseId?: string;
  name: string;
  rating: number;
  reviewCount: number;
  vehicle: string;
  vehicleType: string;
  plate: string;
  distance: string;
  eta: string;
  avatar: string;
  cityPrice: { from: number; to: number };
  villagePrice: { from: number; to: number };
  pricePerKm: number;
  trips: number;
  isOnline: boolean;
  lat: number;
  lng: number;
}

const SERVICE_ICONS: Record<string, string> = {
  'طلب رحلة': 'directions-car',
  'توك توك': 'electric-rickshaw',
  'موتوسيكل': 'two-wheeler',
  'ميكروباص': 'airport-shuttle',
  'شحن': 'local-shipping',
  'رحلات طويلة': 'map',
};

// ── Map driver rows to display shape ──────────────────────────────
function mapDriver(d: SupabaseDriver): DisplayDriver {
  return {
    id: d.id,
    supabaseId: d.id,
    name: d.name,
    rating: Number(d.rating) || 5.0,
    reviewCount: d.total_trips || 0,
    vehicle: d.vehicle,
    vehicleType: d.vehicle_type || 'توك توك',
    plate: d.plate,
    distance: '500 م',
    eta: '5 دقائق',
    avatar: d.avatar_url || 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=face',
    cityPrice: { from: 15, to: 25 },
    villagePrice: { from: 20, to: 35 },
    pricePerKm: 5,
    trips: d.total_trips || 0,
    isOnline: d.is_online,
    lat: Number(d.lat) || 30.0444,
    lng: Number(d.lng) || 31.2357,
  };
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthContext();
  const [selectedService, setSelectedService] = useState('طلب رحلة');
  const [from, setFrom] = useState('القاهرة، مصر الجديدة');
  const [to, setTo] = useState('');
  const { unreadCount } = useNotifications();
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [realDrivers, setRealDrivers] = useState<DisplayDriver[]>([]);
  const [driversLoading, setDriversLoading] = useState(true);

  // Ref to keep latest drivers without causing re-renders on the poll timer
  const driversRef = useRef<DisplayDriver[]>([]);
  const locationPollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch online drivers from Supabase (full list) ──────────────
  const fetchDrivers = useCallback(async () => {
    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase
        .from('drivers')
        .select('*')
        .eq('is_online', true)
        .eq('is_active', true)
        .order('rating', { ascending: false })
        .limit(20);

      if (error || !data || data.length === 0) {
        if (driversRef.current.length === 0) {
          // Only fall back to mock when we have NO data at all
          const mapped = MOCK_DRIVERS as DisplayDriver[];
          driversRef.current = mapped;
          setRealDrivers(mapped);
        }
      } else {
        const mapped = data.map(mapDriver);
        driversRef.current = mapped;
        setRealDrivers(mapped);
      }
    } catch {
      if (driversRef.current.length === 0) {
        const mapped = MOCK_DRIVERS as DisplayDriver[];
        driversRef.current = mapped;
        setRealDrivers(mapped);
      }
    } finally {
      setDriversLoading(false);
    }
  }, []);

  // ── Lightweight coordinate-only refresh (every 10 s) ───────────
  // Only updates lat/lng fields to avoid full list re-render flicker
  const refreshDriverCoordinates = useCallback(async () => {
    if (driversRef.current.length === 0) return;
    try {
      const supabase = getSupabaseClient();
      const ids = driversRef.current
        .filter(d => d.supabaseId)
        .map(d => d.supabaseId as string);

      if (ids.length === 0) return;

      const { data, error } = await supabase
        .from('drivers')
        .select('id, lat, lng, is_online')
        .in('id', ids);

      if (error || !data) return;

      // Build a lookup map
      const coordMap: Record<string, { lat: number; lng: number; is_online: boolean }> = {};
      for (const row of data) {
        coordMap[row.id] = {
          lat: Number(row.lat) || 30.0444,
          lng: Number(row.lng) || 31.2357,
          is_online: row.is_online,
        };
      }

      // Only update if coords actually changed (shallow compare)
      let changed = false;
      const updated = driversRef.current.map(d => {
        if (!d.supabaseId) return d;
        const fresh = coordMap[d.supabaseId];
        if (!fresh) return d;
        if (fresh.lat !== d.lat || fresh.lng !== d.lng || fresh.is_online !== d.isOnline) {
          changed = true;
          return { ...d, lat: fresh.lat, lng: fresh.lng, isOnline: fresh.is_online };
        }
        return d;
      });

      if (changed) {
        driversRef.current = updated;
        setRealDrivers([...updated]);
      }
    } catch { /* silent — non-critical refresh */ }
  }, []);

  // ── Location permission + initial position ──────────────────────
  useEffect(() => {
    (async () => {
      if (Platform.OS === 'web') return;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {
        setUserLocation({ latitude: 30.0444, longitude: 31.2357 });
      }
    })();
  }, []);

  // ── Initial full fetch ──────────────────────────────────────────
  useEffect(() => {
    fetchDrivers();
  }, [fetchDrivers]);

  // ── Coordinate refresh every 10 seconds ────────────────────────
  useEffect(() => {
    locationPollRef.current = setInterval(refreshDriverCoordinates, 10000);
    return () => {
      if (locationPollRef.current) clearInterval(locationPollRef.current);
    };
  }, [refreshDriverCoordinates]);

  const filteredDrivers = realDrivers.filter(d => d.isOnline);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity style={styles.headerIconWrap} onPress={() => router.push('/notifications')}>
          <MaterialIcons name="notifications-none" size={24} color={Colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.notifBadge}>
              <Text style={styles.notifBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.greeting}>مرحباً، {user?.name?.split(' ')[0] ?? 'راكب'} 👋</Text>
          <Text style={styles.locationText}>القاهرة، مصر الجديدة</Text>
        </View>
        <TouchableOpacity style={styles.headerIcon}>
          <MaterialIcons name="menu" size={24} color={Colors.textPrimary} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={styles.scroll}>
        {/* Real Map — receives live-updated drivers array */}
        <View style={styles.mapContainer}>
          <HomeMapView
            userLocation={userLocation}
            drivers={realDrivers}
            onDriverPress={(id) => router.push(`/driver/${id}`)}
            initialRegion={{
              latitude: userLocation?.latitude ?? 30.0444,
              longitude: userLocation?.longitude ?? 31.2357,
              latitudeDelta: 0.05,
              longitudeDelta: 0.05,
            }}
          />

          {/* Filter button */}
          <TouchableOpacity style={styles.mapFilterBtn} onPress={() => router.push('/driver-search')}>
            <MaterialIcons name="tune" size={20} color={Colors.textPrimary} />
          </TouchableOpacity>

          {/* GPS recenter button */}
          <TouchableOpacity
            style={styles.gpsBtn}
            onPress={async () => {
              if (Platform.OS === 'web') return;
              try {
                const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
              } catch {}
            }}
          >
            <MaterialIcons name="my-location" size={20} color={Colors.primary} />
          </TouchableOpacity>

          {/* Live badge */}
          <View style={styles.liveBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.liveText}>مباشر</Text>
          </View>
        </View>

        {/* Search Bar */}
        <View style={styles.searchSection}>
          <View style={styles.searchCard}>
            <View style={styles.searchRow}>
              <MaterialIcons name="location-on" size={20} color={Colors.success} />
              <TextInput
                style={styles.searchInput}
                value={from}
                onChangeText={setFrom}
                placeholder="من أين؟"
                placeholderTextColor={Colors.textLight}
                textAlign="right"
              />
              <MaterialIcons name="my-location" size={18} color={Colors.primary} />
            </View>
            <View style={styles.searchDivider} />
            <View style={styles.searchRow}>
              <MaterialIcons name="location-on" size={20} color={Colors.error} />
              <TextInput
                style={styles.searchInput}
                value={to}
                onChangeText={setTo}
                placeholder="إلى أين؟"
                placeholderTextColor={Colors.textLight}
                textAlign="right"
              />
            </View>
          </View>
        </View>

        {/* Services */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>خدمات متنوعة</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.servicesRow}>
            {SERVICE_TYPES.map(service => (
              <TouchableOpacity
                key={service.id}
                style={[styles.serviceItem, selectedService === service.name && styles.serviceItemActive]}
                onPress={() => setSelectedService(service.name)}
                activeOpacity={0.8}
              >
                <View style={[
                  styles.serviceIcon,
                  { backgroundColor: service.color + '18' },
                  selectedService === service.name && { backgroundColor: service.color },
                ]}>
                  <MaterialIcons
                    name={SERVICE_ICONS[service.name] as any ?? 'directions-car'}
                    size={22}
                    color={selectedService === service.name ? '#fff' : service.color}
                  />
                </View>
                <Text style={[styles.serviceName, selectedService === service.name && { color: service.color, fontWeight: '600' }]}>
                  {service.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* Nearby Drivers */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <TouchableOpacity onPress={() => router.push('/driver-search')}>
              <Text style={styles.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
            <Text style={styles.sectionTitle}>سائقين بالقرب منك</Text>
          </View>

          {driversLoading ? (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={Colors.primary} />
              <Text style={styles.loadingText}>جارٍ تحميل السائقين القريبين...</Text>
            </View>
          ) : null}

          {filteredDrivers.map(driver => (
            <TouchableOpacity
              key={driver.id}
              style={styles.driverCard}
              onPress={() => router.push({
                pathname: `/driver/${driver.id}`,
                params: { fromLocation: from, toLocation: to },
              } as any)}
              activeOpacity={0.92}
            >
              <View style={styles.driverInfo}>
                <View style={styles.driverMeta}>
                  <Text style={styles.driverVehicle}>{driver.vehicle}</Text>
                  <Text style={styles.driverDistance}>{driver.distance}</Text>
                </View>
                <View style={styles.driverNameRow}>
                  <View style={styles.ratingBadge}>
                    <Text style={styles.ratingText}>{driver.rating}</Text>
                    <MaterialIcons name="star" size={12} color={Colors.accent} />
                  </View>
                  <Text style={styles.driverName}>{driver.name}</Text>
                </View>
              </View>
              <View style={styles.driverAvatarContainer}>
                <Image
                  source={{ uri: driver.avatar }}
                  style={styles.driverAvatar}
                  contentFit="cover"
                  transition={200}
                />
                <View style={[styles.onlineDot, { backgroundColor: driver.isOnline ? Colors.success : Colors.offline }]} />
              </View>
            </TouchableOpacity>
          ))}
        </View>

        <View style={{ height: 20 }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bgLight },
  scroll: { flex: 1 },
  header: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: Spacing.md, paddingBottom: Spacing.md,
    backgroundColor: Colors.bgWhite,
    borderBottomWidth: 1, borderBottomColor: Colors.borderLight,
  },
  headerIcon: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center',
  },
  headerIconWrap: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.bgLight, alignItems: 'center', justifyContent: 'center',
    position: 'relative',
  },
  notifBadge: {
    position: 'absolute', top: -2, right: -2,
    backgroundColor: Colors.error, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4, borderWidth: 1.5, borderColor: Colors.bgWhite,
  },
  notifBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  headerCenter: { flex: 1, alignItems: 'flex-end', paddingHorizontal: Spacing.sm },
  greeting: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
  locationText: { fontSize: Typography.sm, color: Colors.textSecondary, marginTop: 2 },
  mapContainer: {
    height: 220, margin: Spacing.md, borderRadius: BorderRadius.lg,
    overflow: 'hidden', position: 'relative', ...Shadows.md,
  },
  mapFilterBtn: {
    position: 'absolute', top: 12, left: 12,
    width: 36, height: 36, borderRadius: 8,
    backgroundColor: Colors.bgWhite, alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  gpsBtn: {
    position: 'absolute', bottom: 12, left: 12,
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: Colors.bgWhite, alignItems: 'center', justifyContent: 'center',
    ...Shadows.sm,
  },
  liveBadge: {
    position: 'absolute', top: 12, right: 12,
    flexDirection: 'row-reverse', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: Colors.success },
  liveText: { color: '#fff', fontSize: Typography.xs, fontWeight: '700' },
  searchSection: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  searchCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadows.sm,
    borderWidth: 1, borderColor: Colors.borderLight,
  },
  searchRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: Spacing.sm },
  searchInput: {
    flex: 1, fontSize: Typography.base, color: Colors.textPrimary,
    paddingVertical: 8, textAlign: 'right',
  },
  searchDivider: {
    height: 1, backgroundColor: Colors.borderLight,
    marginVertical: Spacing.xs, marginHorizontal: 24,
  },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.sm },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: Spacing.sm },
  sectionTitle: { fontSize: Typography.lg, fontWeight: '700', color: Colors.textPrimary, marginBottom: Spacing.sm },
  seeAll: { color: Colors.primary, fontSize: Typography.sm, fontWeight: '600' },
  servicesRow: { paddingBottom: Spacing.sm, gap: 12 },
  serviceItem: { alignItems: 'center', width: 72 },
  serviceItemActive: {},
  serviceIcon: {
    width: 56, height: 56, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  serviceName: { fontSize: Typography.xs, color: Colors.textSecondary, textAlign: 'center', fontWeight: '500' },
  driverCard: {
    backgroundColor: Colors.bgWhite, borderRadius: BorderRadius.lg,
    padding: Spacing.md, marginBottom: Spacing.sm,
    flexDirection: 'row-reverse', alignItems: 'center',
    ...Shadows.sm, borderWidth: 1, borderColor: Colors.borderLight,
  },
  driverAvatarContainer: { position: 'relative', marginLeft: Spacing.md },
  driverAvatar: { width: 60, height: 60, borderRadius: 30 },
  onlineDot: {
    position: 'absolute', bottom: 2, right: 2,
    width: 12, height: 12, borderRadius: 6,
    borderWidth: 2, borderColor: '#fff',
  },
  driverInfo: { flex: 1 },
  driverNameRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8, marginBottom: 4 },
  driverName: { fontSize: Typography.md, fontWeight: '700', color: Colors.textPrimary },
  ratingBadge: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 2,
    backgroundColor: Colors.bgLight, borderRadius: 12,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  ratingText: { fontSize: Typography.sm, fontWeight: '600', color: Colors.textPrimary },
  driverMeta: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: 4 },
  driverVehicle: { fontSize: Typography.sm, color: Colors.textSecondary },
  driverDistance: { fontSize: Typography.sm, color: Colors.primary, fontWeight: '500' },
  loadingRow: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8, paddingVertical: Spacing.sm,
  },
  loadingText: { fontSize: Typography.sm, color: Colors.textSecondary },
});
