/**
 * Dynamic Sidebar Component
 * Advanced navigation sidebar with collapsible items and dynamic rendering
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  LayoutAnimation,
  Platform,
} from 'react-native';
import { navigationManager } from '@/lib/navigation/navigationManager';
import { authProvider } from '@/lib/auth/authProvider';
import type { NavigationItem } from '@/lib/database/schema';

interface DynamicSidebarProps {
  onNavigate?: (path: string) => void;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export const DynamicSidebar: React.FC<DynamicSidebarProps> = ({
  onNavigate,
  collapsed = false,
  onCollapsedChange,
}) => {
  const [items, setItems] = useState<NavigationItem[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [isCollapsed, setIsCollapsed] = useState(collapsed);
  const [userRole, setUserRole] = useState<string>('');

  // Initialize sidebar
  useEffect(() => {
    const session = authProvider.getSession();
    if (session) {
      setUserRole(session.roles[0]);
      loadNavigationItems();
    }

    // Subscribe to navigation changes
    const unsubscribe = navigationManager.onChange((config) => {
      setItems(config.items);
    });

    return () => unsubscribe?.();
  }, []);

  const loadNavigationItems = () => {
    const config = navigationManager.getNavigationConfig();
    setItems(config.items);
  };

  const handleToggleExpand = (itemId: string) => {
    if (Platform.OS === 'ios') {
      LayoutAnimation.easeInEaseOut();
    }

    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };

  const handleNavigate = (path?: string) => {
    if (path) {
      onNavigate?.(path);
    }
  };

  const handleCollapsedToggle = () => {
    const newCollapsed = !isCollapsed;
    setIsCollapsed(newCollapsed);
    onCollapsedChange?.(newCollapsed);
  };

  const renderNavItem = (item: NavigationItem, depth: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const hasChildren = item.children && item.children.length > 0;
    const isAccessible = navigationManager.getNavigationConfig().items.some((i) => i.id === item.id);

    return (
      <View key={item.id} style={{ width: '100%' }}>
        <TouchableOpacity
          style={[
            styles.navItem,
            {
              paddingLeft: 12 + depth * 12,
              backgroundColor: expandedItems.has(item.id) ? '#f0f0f0' : 'transparent',
            },
          ]}
          onPress={() => {
            if (hasChildren) {
              handleToggleExpand(item.id);
            } else {
              handleNavigate(item.path);
            }
          }}
        >
          <View style={styles.itemContent}>
            {item.icon && !isCollapsed && <Text style={styles.itemIcon}>{item.icon}</Text>}

            {!isCollapsed && (
              <Text
                style={styles.itemLabel}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            )}

            {hasChildren && !isCollapsed && (
              <View
                style={[
                  styles.chevron,
                  {
                    transform: [{ rotate: isExpanded ? '180deg' : '0deg' }],
                  },
                ]}
              >
                <Text>▼</Text>
              </View>
            )}
          </View>

          {isCollapsed && item.icon && (
            <View style={styles.collapsedTooltip}>
              <Text style={styles.tooltipText}>{item.label}</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Children */}
        {hasChildren && isExpanded && !isCollapsed && (
          <View style={{ width: '100%' }}>
            {item.children!.map((child) => renderNavItem(child, depth + 1))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, isCollapsed && styles.containerCollapsed]}>
      {/* Header */}
      <View style={styles.header}>
        {!isCollapsed && <Text style={styles.logo}>TukTouky</Text>}
        <TouchableOpacity style={styles.collapseButton} onPress={handleCollapsedToggle}>
          <Text style={styles.collapseIcon}>{isCollapsed ? '>' : '<'}</Text>
        </TouchableOpacity>
      </View>

      {/* Navigation Items */}
      <ScrollView style={styles.navContainer} showsVerticalScrollIndicator={false}>
        {items.map((item) => renderNavItem(item))}
      </ScrollView>

      {/* Footer */}
      {!isCollapsed && (
        <View style={styles.footer}>
          <View style={styles.userInfo}>
            <View style={styles.userAvatar}>
              <Text style={styles.avatarText}>{userRole[0]?.toUpperCase()}</Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>My Account</Text>
              <Text style={styles.userRole} numberOfLines={1}>
                {userRole}
              </Text>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: 260,
    backgroundColor: '#ffffff',
    borderRightWidth: 1,
    borderRightColor: '#e0e0e0',
    flexDirection: 'column',
    paddingTop: 12,
  },
  containerCollapsed: {
    width: 80,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    marginBottom: 12,
  },
  logo: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0066cc',
  },
  collapseButton: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f5f5f5',
  },
  collapseIcon: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#666',
  },
  navContainer: {
    flex: 1,
    paddingHorizontal: 8,
  },
  navItem: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginVertical: 2,
    borderRadius: 6,
    minHeight: 44,
    justifyContent: 'center',
  },
  itemContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 12,
  },
  itemIcon: {
    fontSize: 18,
    minWidth: 24,
  },
  itemLabel: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
    flex: 1,
  },
  chevron: {
    padding: 4,
  },
  collapsedTooltip: {
    position: 'absolute',
    left: 70,
    top: 0,
    backgroundColor: '#333',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    minWidth: 80,
    zIndex: 1000,
  },
  tooltipText: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#0066cc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  userRole: {
    fontSize: 11,
    color: '#999',
    marginTop: 2,
  },
});
