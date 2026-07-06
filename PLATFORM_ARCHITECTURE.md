# TukTouky Platform Architecture Documentation

## Overview

The TukTouky platform is a comprehensive ride-hailing and marketplace ecosystem built with modular, scalable architecture. This document outlines the core systems, services, and their interactions.

## Core Systems

### 1. Platform Kernel (`lib/platform/kernel.ts`)

The foundation of the platform that defines:

- **User Roles**: Super Admin, Platform Admin, Drivers (Standard/Premium), Customers, Support Staff, Marketplace Owners
- **Feature Flags**: Wallet System, Commission System, Premium Features, Marketplace, AI Dispatch, Analytics, etc.
- **Environment Configuration**: Development, Staging, Production with role-based permissions
- **Permission Management**: Resource-based access control (RBAC)

**Key Classes:**
- `PlatformKernel` - Singleton managing platform configuration and permissions
- `UserRole` - Enum defining all role types
- `FeatureFlag` - Enum controlling feature availability
- `RolePermission` - Defines what each role can access

**Usage:**
```typescript
const kernel = PlatformKernel.getInstance();
const hasPermission = kernel.hasPermission(UserRole.DRIVER, 'trips', 'create');
const isFeatureEnabled = kernel.isFeatureEnabled(FeatureFlag.WALLET_SYSTEM);
```

### 2. Service Factory (`lib/services/serviceFactory.ts`)

Central registry for all platform services with dependency injection pattern.

**Registered Services:**
- Auth Service - Authentication and session management
- Wallet Service - Financial management
- Commission Service - Commission calculation and tracking
- Trip Service - Trip management
- Driver Service - Driver profile and status
- Notification Service - Real-time notifications
- Audit Service - Activity logging
- Analytics Service - Metrics and analytics

**Usage:**
```typescript
const factory = ServiceFactory.getInstance(config);
const walletService = factory.getService<IWalletService>('wallet');
const balance = await walletService.getBalance(userId);
```

### 3. Authentication & Authorization (`lib/auth/authProvider.ts`)

Enhanced authentication provider with role-based access control.

**Features:**
- Session management with refresh tokens
- Multi-role support per user
- Resource-level permission checking
- Auth state change listeners

**Usage:**
```typescript
const auth = authProvider;
await auth.login({ email, password });
const hasRole = auth.hasRole(UserRole.DRIVER);
const canAccess = auth.canAccess('trips', 'create');
```

### 4. Dynamic Navigation System (`lib/navigation/navigationManager.ts`)

Generates navigation menus dynamically based on user roles and feature flags.

**Features:**
- Role-based menu visibility
- Hierarchical navigation items
- Feature flag integration
- Customizable layout and appearance

**Navigation Structure:**
- Customer Views (Home, Trips, Wallet, Family, Rewards)
- Driver Views (Dashboard, Available Trips, Earnings, Documents)
- Admin Views (Users, Operations, Finance, Analytics, Settings)
- Support Views (Help, Profile Settings)

**Usage:**
```typescript
const nav = navigationManager;
await nav.initializeForUser(userRoles);
const config = nav.getNavigationConfig();
const canAccess = nav.canAccessItem(item);
```

### 5. Admin Dashboard Manager (`lib/admin/dashboardManager.ts`)

Centralized management for admin dashboards and system monitoring.

**Features:**
- Real-time metrics collection
- System health monitoring
- Alert management with severity levels
- Feature flag configuration and rollout
- Activity reports and analytics

**Dashboard Components:**
- Key Metrics Cards (Users, Drivers, Trips, Revenue)
- System Alerts (Critical, High, Medium, Low)
- Feature Flag Controls with rollout percentages
- Quick Actions for common admin tasks

**Usage:**
```typescript
const dashboard = dashboardManager;
await dashboard.loadMetrics();
const cards = dashboard.getDashboardCards();
await dashboard.toggleFeatureFlag(flagId, enabled);
```

### 6. Wallet Service (`lib/wallet/walletService.ts`)

Complete wallet management system for users.

**Features:**
- Balance management (available and locked funds)
- Transaction history with detailed records
- Multiple transaction types (credit, debit, commission, refund, etc.)
- Withdrawal requests with status tracking
- Monthly financial reports
- Real-time transaction notifications

**Transaction Types:**
- `CREDIT` - Money added to wallet
- `DEBIT` - Money withdrawn
- `LOCK` - Funds reserved for pending operations
- `COMMISSION` - Driver earnings
- `PENALTY` - Deductions
- `REFUND` - Refunded amounts

**Usage:**
```typescript
const wallet = factory.getService<IWalletService>('wallet');
const balance = await wallet.getBalance(userId);
const tx = await wallet.addTransaction(userId, {
  type: WalletTransactionType.CREDIT,
  amount: 100,
  description: 'Top-up'
});
const history = await wallet.getTransactionHistory(userId);
const report = await wallet.getMonthlyReport(userId, 2024, 1);
```

### 7. Commission Service (`lib/wallet/commissionService.ts`)

Advanced commission calculation and management system.

**Features:**
- Multiple commission rule types (percentage, fixed, tiered)
- Conditional commission rules based on:
  - Trip amount ranges
  - Driver level/tier
  - Day and time of operation
  - Special promotions
- Automatic commission application
- Commission history and statistics
- Bonus program support

**Commission Rules:**
- **Percentage**: 20% of trip fare
- **Fixed**: Flat amount per trip
- **Tiered**: Different rates based on total amount

**Usage:**
```typescript
const commission = factory.getService<ICommissionService>('commission');
const calculation = await commission.calculateCommission(tripAmount, driverId);
const stats = await commission.getCommissionStats(driverId);
await commission.updateCommissionRules(newRules);
```

### 8. Audit Service (`lib/security/auditService.ts`)

Comprehensive audit logging and security monitoring.

**Features:**
- Action logging with batching for performance
- Detailed audit trails with context
- Suspicious activity detection
- User and system activity reports
- Audit log filtering and search

**Logged Actions:**
- Authentication events
- Trip operations
- Financial transactions
- Admin actions
- System configuration changes

**Usage:**
```typescript
const audit = factory.getService<IAuditService>('audit');
await audit.logAction(
  AuditAction.TRIP_CREATED,
  'trips',
  tripId,
  userId,
  { fare: 50 }
);
const logs = await audit.getLogs({ userId, startDate });
const suspiciousActivity = await audit.detectSuspiciousActivity(userId);
```

## Data Models

### Core Entities

**User**
```typescript
{
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  role: string;
  roles: string[];
  status: 'active' | 'inactive' | 'suspended' | 'banned';
}
```

**Driver** (extends User)
```typescript
{
  licenseNumber: string;
  licenseExpiry: Date;
  vehicleType: 'motorcycle' | 'car' | 'truck' | 'auto';
  rating: number;
  totalTrips: number;
  totalEarnings: number;
  backgroundCheckStatus: 'pending' | 'approved' | 'rejected';
}
```

**Wallet**
```typescript
{
  id: string;
  userId: string;
  balance: number;
  lockedBalance: number;
  currency: string;
  transactionHistory: WalletTransaction[];
}
```

**Trip**
```typescript
{
  id: string;
  customerId: string;
  driverId?: string;
  status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';
  startLocation: Location;
  endLocation: Location;
  fare: number;
  commission?: number;
  rating?: TripRating;
}
```

**Commission**
```typescript
{
  id: string;
  driverId: string;
  tripId: string;
  amount: number;
  rate: number;
  type: 'trip' | 'referral' | 'bonus' | 'penalty';
  status: 'pending' | 'approved' | 'paid' | 'rejected';
}
```

**AuditLog**
```typescript
{
  id: string;
  userId: string;
  action: string;
  resource: string;
  resourceId: string;
  changes?: Record<string, any>;
  status: 'success' | 'failure';
  createdAt: Date;
}
```

## Platform Initialization

### Application Startup

```typescript
// 1. Initialize Platform
const initializer = platformInitializer;
await initializer.initialize({
  environment: PlatformEnvironment.PRODUCTION,
  supabaseUrl: process.env.SUPABASE_URL,
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
});

// 2. After User Login
const session = authProvider.getSession();
await initializer.initializeUserSession(session.roles);

// 3. Access Services
const factory = initializer.getServiceFactory();
const walletService = factory.getService('wallet');
```

### Layout Integration

```typescript
// Wrap app with platform layout
<PlatformLayout>
  <YourAppContent />
</PlatformLayout>

// PlatformLayout handles:
// - Service initialization
// - Dynamic navigation generation
// - Auth state management
// - Dashboard setup for admins
```

## Usage Examples

### Example 1: Processing a Trip Completion

```typescript
// 1. Get required services
const factory = platformInitializer.getServiceFactory();
const walletService = factory.getService<IWalletService>('wallet');
const commissionService = factory.getService<ICommissionService>('commission');
const auditService = factory.getService<IAuditService>('audit');

// 2. Calculate commission
const calc = await commissionService.calculateCommission(trip.fare, trip.driverId);

// 3. Record commission
await commissionService.recordCommission(trip.driverId, trip.id, calc.totalCommission);

// 4. Add to wallet
await walletService.addTransaction(trip.driverId, {
  type: WalletTransactionType.COMMISSION,
  amount: calc.totalCommission,
  description: `Trip ${trip.id} commission`,
  reference: trip.id,
});

// 5. Log action
await auditService.logAction(
  AuditAction.TRIP_COMPLETED,
  'trips',
  trip.id,
  trip.driverId,
  { fare: trip.fare, commission: calc.totalCommission }
);
```

### Example 2: Admin Feature Toggle

```typescript
// 1. Toggle feature
await dashboardManager.toggleFeatureFlag(flagId, true);

// 2. Update rollout
await dashboardManager.updateFlagRollout(flagId, 25); // 25% rollout

// 3. Check in code
const kernel = PlatformKernel.getInstance();
if (kernel.isFeatureEnabled(FeatureFlag.PREMIUM_DRIVER)) {
  // Show premium features
}
```

### Example 3: Detecting Suspicious Activity

```typescript
const audit = factory.getService<IAuditService>('audit');
const suspicious = await audit.detectSuspiciousActivity(userId, 3600000); // 1 hour

if (suspicious.length > 0) {
  // Alert admin
  await dashboardManager.logAlert({
    type: 'warning',
    title: 'Suspicious Activity Detected',
    message: suspicious.join(', '),
    severity: 'high',
  });
}
```

## Environment Variables

Required environment variables:

```
EXPO_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=xxxx
API_BASE_URL=https://api.tuktuky.app
ENVIRONMENT=production
```

## Database Schema

Key tables required in Supabase:

- `users` - User accounts
- `drivers` - Driver-specific data
- `customers` - Customer-specific data
- `wallets` - User wallet balances
- `wallet_transactions` - Transaction history
- `commissions` - Commission records
- `commission_rules` - Commission calculation rules
- `trips` - Trip records
- `audit_logs` - Activity logs
- `navigation_items` - Dynamic navigation config
- `feature_flags` - Feature flag configuration
- `system_config` - System settings
- `notifications` - User notifications
- `support_tickets` - Support requests

## Security Considerations

1. **RBAC**: All resource access is role-based
2. **Audit Trail**: All actions are logged
3. **Rate Limiting**: Implement rate limits on API endpoints
4. **Data Validation**: Validate all inputs before processing
5. **Encryption**: Encrypt sensitive data (PII, financial info)
6. **JWT Tokens**: Use short-lived access tokens with refresh tokens

## Performance Optimization

1. **Service Caching**: Commission rules cached for 1 hour
2. **Batch Operations**: Audit logs batched for efficiency
3. **Lazy Loading**: Navigation and dashboards load on-demand
4. **Memoization**: Component state cached appropriately
5. **Database Indexing**: Index frequently queried fields

## Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] Message queue for async operations
- [ ] Caching layer (Redis) for hot data
- [ ] GraphQL API option
- [ ] Machine learning for fraud detection
- [ ] Advanced analytics dashboards
- [ ] Multi-currency support
- [ ] Advanced scheduling system
- [ ] AI dispatch system
- [ ] Mobile app optimization
