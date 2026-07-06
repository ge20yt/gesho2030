import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Text } from 'react-native';
import MapView, { Marker, PROVIDER_GOOGLE, Region, Callout } from 'react-native-maps';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, Typography, Shadows } from '@/constants/theme';

interface Driver {
  id: string;
  lat: number;
  lng: number;
  vehicleType: string;
  name: string;
  isOnline: boolean;
  rating?: number;
  plate?: string;
}

interface Props {
  userLocation: { latitude: number; longitude: number } | null;
  drivers: Driver[];
  onDriverPress?: (driverId: string) => void;
  initialRegion?: Region;
}

const VEHICLE_ICONS: Record<string, { icon: string; color: string }> = {
  'سيارة':    { icon: 'directions-car',  color: Colors.primary },
  'توك توك':  { icon: 'electric-rickshaw', color: Colors.accent },
  'موتوسيكل': { icon: 'two-wheeler',     color: Colors.success },
  'ميكروباص': { icon: 'airport-shuttle', color: '#8B5CF6' },
};

export default function HomeMapView({ userLocation, drivers, onDriverPress, initialRegion }: Props) {
  const mapRef = useRef<MapView>(null);

  const defaultRegion: Region = initialRegion ?? {
    latitude: 30.0444,
    longitude: 31.2357,
    latitudeDelta: 0.05,
    longitudeDelta: 0.05,
  };

  // Animate to user location when available
  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.05,
          longitudeDelta: 0.05,
        },
        800
      );
    }
  }, [userLocation]);

  return (
    <MapView
      ref={mapRef}
      style={StyleSheet.absoluteFillObject}
      provider={PROVIDER_GOOGLE}
      initialRegion={defaultRegion}
      showsUserLocation={true}
      showsMyLocationButton={false}
      showsCompass={false}
      showsTraffic={false}
    >
      {drivers
        .filter(d => d.isOnline && d.lat && d.lng)
        .map(driver => {
          const vi = VEHICLE_ICONS[driver.vehicleType] ?? VEHICLE_ICONS['سيارة'];
          const lat = Number(driver.lat);
          const lng = Number(driver.lng);

          // Skip invalid coordinates
          if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;

          return (
            <Marker
              key={driver.id}
              coordinate={{ latitude: lat, longitude: lng }}
              onPress={() => onDriverPress?.(driver.id)}
              tracksViewChanges={false}
            >
              {/* Custom marker */}
              <View style={[styles.markerWrapper, { borderColor: vi.color }]}>
                <View style={[styles.markerDot, { backgroundColor: vi.color }]} />
                <MaterialIcons name={vi.icon as any} size={18} color={vi.color} />
              </View>

              {/* Callout on tap */}
              <Callout tooltip onPress={() => onDriverPress?.(driver.id)}>
                <View style={styles.callout}>
                  <View style={[styles.calloutIcon, { backgroundColor: vi.color + '18' }]}>
                    <MaterialIcons name={vi.icon as any} size={18} color={vi.color} />
                  </View>
                  <View style={styles.calloutInfo}>
                    <Text style={styles.calloutName}>{driver.name}</Text>
                    <Text style={styles.calloutSub}>{driver.vehicleType}</Text>
                    {(driver.rating ?? 0) > 0 && (
                      <View style={styles.calloutRating}>
                        <MaterialIcons name="star" size={12} color={Colors.accent} />
                        <Text style={styles.calloutRatingText}>{Number(driver.rating).toFixed(1)}</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.calloutArrow}>
                    <MaterialIcons name="arrow-back-ios" size={14} color={Colors.primary} />
                  </View>
                </View>
              </Callout>
            </Marker>
          );
        })}
    </MapView>
  );
}

const styles = StyleSheet.create({
  markerWrapper: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2.5,
    ...Shadows.sm,
  },
  markerDot: {
    position: 'absolute', top: 2, right: 2,
    width: 9, height: 9, borderRadius: 5,
    borderWidth: 1.5, borderColor: '#fff',
  },
  callout: {
    flexDirection: 'row-reverse', alignItems: 'center',
    backgroundColor: '#fff', borderRadius: 14,
    padding: 10, gap: 8, minWidth: 160,
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 8, elevation: 6,
    borderWidth: 1, borderColor: 'rgba(0,0,0,0.06)',
  },
  calloutIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  calloutInfo: { flex: 1 },
  calloutName: {
    fontSize: Typography.sm, fontWeight: '700',
    color: '#1a1a1a', textAlign: 'right',
  },
  calloutSub: {
    fontSize: 11, color: '#888', textAlign: 'right',
  },
  calloutRating: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 2, marginTop: 2,
  },
  calloutRatingText: { fontSize: 11, fontWeight: '700', color: Colors.accent },
  calloutArrow: { paddingLeft: 2 },
});
