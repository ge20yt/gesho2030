/**
 * Admin Users Management Page
 * Manage all users, drivers, and customers
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  SectionList,
  Alert,
} from 'react-native';
import { platformInitializer } from '@/lib/platform/appInitializer';
import { authProvider } from '@/lib/auth/authProvider';

interface UserItem {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: string;
  status: 'active' | 'inactive' | 'suspended' | 'banned';
  joinedAt: Date;
}

interface SectionData {
  title: string;
  data: UserItem[];
}

export default function AdminUsersPage() {
  const [selectedTab, setSelectedTab] = useState<'all' | 'drivers' | 'customers'>('all');
  const [users, setUsers] = useState<UserItem[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<UserItem | null>(null);
  const [showDetails, setShowDetails] = useState(false);

  // Check authorization
  useEffect(() => {
    const session = authProvider.getSession();
    if (!session || !session.roles.some((r) => r.includes('admin'))) {
      Alert.alert('Unauthorized', 'Admin access required');
    }
  }, []);

  // Load users
  useEffect(() => {
    loadUsers();
  }, [selectedTab]);

  // Filter users by search
  useEffect(() => {
    let filtered = users;

    if (searchQuery.trim()) {
      filtered = filtered.filter((user) =>
        user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.phone.includes(searchQuery)
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchQuery]);

  const loadUsers = async () => {
    try {
      setIsLoading(true);

      // TODO: Fetch from API
      // For now, use mock data
      const mockUsers: UserItem[] = [
        {
          id: '1',
          email: 'driver1@tuktuky.app',
          name: 'Ahmed Hassan',
          phone: '+201001234567',
          role: 'driver',
          status: 'active',
          joinedAt: new Date('2024-01-15'),
        },
        {
          id: '2',
          email: 'customer1@tuktuky.app',
          name: 'Fatma Ali',
          phone: '+201101234567',
          role: 'customer',
          status: 'active',
          joinedAt: new Date('2024-02-20'),
        },
        {
          id: '3',
          email: 'driver2@tuktuky.app',
          name: 'Mohamed Yousif',
          phone: '+201201234567',
          role: 'driver_premium',
          status: 'active',
          joinedAt: new Date('2024-01-10'),
        },
      ];

      setUsers(mockUsers);
      setFilteredUsers(mockUsers);
    } catch (error) {
      console.error('Failed to load users:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSuspendUser = async (userId: string) => {
    Alert.alert('Suspend User', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Suspend',
        onPress: async () => {
          // TODO: Call API to suspend user
          setUsers((prev) =>
            prev.map((u) =>
              u.id === userId ? { ...u, status: 'suspended' } : u
            )
          );
          Alert.alert('Success', 'User suspended');
        },
        style: 'destructive',
      },
    ]);
  };

  const handleActivateUser = async (userId: string) => {
    // TODO: Call API to activate user
    setUsers((prev) =>
      prev.map((u) =>
        u.id === userId ? { ...u, status: 'active' } : u
      )
    );
    Alert.alert('Success', 'User activated');
  };

  const getUserStats = () => {
    const total = filteredUsers.length;
    const drivers = filteredUsers.filter((u) => u.role.includes('driver')).length;
    const customers = filteredUsers.filter((u) => u.role.includes('customer')).length;
    const suspended = filteredUsers.filter((u) => u.status === 'suspended').length;

    return { total, drivers, customers, suspended };
  };

  const stats = getUserStats();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0066cc" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Users Management</Text>
        <Text style={styles.subtitle}>Manage all platform users</Text>
      </View>

      {/* Stats */}
      <View style={styles.statsContainer}>
        <StatCard label="Total Users" value={stats.total} color="#0066cc" />
        <StatCard label="Drivers" value={stats.drivers} color="#00aa00" />
        <StatCard label="Customers" value={stats.customers} color="#0099ff" />
        <StatCard label="Suspended" value={stats.suspended} color="#ff6600" />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, email, or phone..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor="#999"
        />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TabButton
          label="All Users"
          active={selectedTab === 'all'}
          onPress={() => setSelectedTab('all')}
        />
        <TabButton
          label="Drivers"
          active={selectedTab === 'drivers'}
          onPress={() => setSelectedTab('drivers')}
        />
        <TabButton
          label="Customers"
          active={selectedTab === 'customers'}
          onPress={() => setSelectedTab('customers')}
        />
      </View>

      {/* Users List */}
      <ScrollView style={styles.listContainer}>
        {filteredUsers.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No users found</Text>
          </View>
        ) : (
          filteredUsers.map((user) => (
            <UserCard
              key={user.id}
              user={user}
              onPress={() => {
                setSelectedUser(user);
                setShowDetails(true);
              }}
              onSuspend={() => handleSuspendUser(user.id)}
              onActivate={() => handleActivateUser(user.id)}
            />
          ))
        )}
      </ScrollView>

      {/* Details Modal */}
      {showDetails && selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          onClose={() => setShowDetails(false)}
          onSuspend={() => handleSuspendUser(selectedUser.id)}
        />
      )}
    </View>
  );
}

interface StatCardProps {
  label: string;
  value: number;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, color }) => (
  <View style={[styles.statCard, { borderLeftColor: color }]}>
    <Text style={styles.statLabel}>{label}</Text>
    <Text style={styles.statValue}>{value}</Text>
  </View>
);

interface TabButtonProps {
  label: string;
  active: boolean;
  onPress: () => void;
}

const TabButton: React.FC<TabButtonProps> = ({ label, active, onPress }) => (
  <TouchableOpacity
    style={[styles.tabButton, active && styles.tabButtonActive]}
    onPress={onPress}
  >
    <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
  </TouchableOpacity>
);

interface UserCardProps {
  user: UserItem;
  onPress: () => void;
  onSuspend: () => void;
  onActivate: () => void;
}

const UserCard: React.FC<UserCardProps> = ({ user, onPress, onSuspend, onActivate }) => {
  const statusColor = {
    active: '#00aa00',
    inactive: '#999',
    suspended: '#ff6600',
    banned: '#ff0000',
  }[user.status];

  return (
    <TouchableOpacity style={styles.userCard} onPress={onPress}>
      <View style={styles.userCardContent}>
        <View style={styles.userHeader}>
          <View style={styles.userAvatar}>
            <Text style={styles.avatarText}>{user.name[0]}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        </View>

        <View style={styles.userMeta}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Phone:</Text>
            <Text style={styles.metaValue}>{user.phone}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Role:</Text>
            <Text style={styles.metaValue}>{user.role}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Status:</Text>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <Text style={styles.statusText}>{user.status}</Text>
            </View>
          </View>
        </View>
      </View>

      {user.status === 'active' ? (
        <TouchableOpacity style={[styles.actionButton, styles.suspendButton]} onPress={onSuspend}>
          <Text style={styles.actionButtonText}>Suspend</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity style={[styles.actionButton, styles.activateButton]} onPress={onActivate}>
          <Text style={styles.actionButtonText}>Activate</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
};

interface UserDetailsModalProps {
  user: UserItem;
  onClose: () => void;
  onSuspend: () => void;
}

const UserDetailsModal: React.FC<UserDetailsModalProps> = ({ user, onClose, onSuspend }) => {
  return (
    <View style={styles.modal}>
      <View style={styles.modalContent}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>User Details</Text>
          <TouchableOpacity onPress={onClose}>
            <Text style={styles.closeButton}>✕</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody}>
          <DetailRow label="Name" value={user.name} />
          <DetailRow label="Email" value={user.email} />
          <DetailRow label="Phone" value={user.phone} />
          <DetailRow label="Role" value={user.role} />
          <DetailRow label="Status" value={user.status} />
          <DetailRow label="Joined" value={user.joinedAt.toLocaleDateString()} />
        </ScrollView>

        <View style={styles.modalActions}>
          <TouchableOpacity style={styles.closeModalButton} onPress={onClose}>
            <Text style={styles.closeModalButtonText}>Close</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.suspendModalButton} onPress={onSuspend}>
            <Text style={styles.suspendModalButtonText}>Suspend</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

interface DetailRowProps {
  label: string;
  value: string;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value }) => (
  <View style={styles.detailRow}>
    <Text style={styles.detailLabel}>{label}</Text>
    <Text style={styles.detailValue}>{value}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#ffffff',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#000',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 8,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderLeftWidth: 4,
    borderRadius: 8,
    padding: 12,
  },
  statLabel: {
    fontSize: 11,
    color: '#666',
    marginBottom: 4,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000',
  },
  searchContainer: {
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  searchInput: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#000',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 6,
    borderBottomWidth: 2,
    borderBottomColor: '#e0e0e0',
  },
  tabButtonActive: {
    backgroundColor: '#f0f0f0',
    borderBottomColor: '#0066cc',
  },
  tabLabel: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
    fontWeight: '500',
  },
  tabLabelActive: {
    color: '#0066cc',
  },
  listContainer: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  userCard: {
    backgroundColor: '#ffffff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  userCardContent: {
    flex: 1,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
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
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000',
  },
  userEmail: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  userMeta: {
    gap: 6,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaLabel: {
    fontSize: 12,
    color: '#999',
    minWidth: 50,
  },
  metaValue: {
    fontSize: 12,
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 11,
    color: '#fff',
    fontWeight: '600',
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginLeft: 12,
  },
  suspendButton: {
    backgroundColor: '#ff6600',
  },
  activateButton: {
    backgroundColor: '#00aa00',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  modal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    width: '80%',
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
  },
  closeButton: {
    fontSize: 20,
    color: '#999',
  },
  modalBody: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  detailLabel: {
    fontSize: 13,
    color: '#666',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 13,
    color: '#000',
    fontWeight: '600',
  },
  modalActions: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  closeModalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  closeModalButtonText: {
    color: '#333',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  suspendModalButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 6,
    backgroundColor: '#ff6600',
  },
  suspendModalButtonText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  emptyState: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 14,
    color: '#999',
  },
});
