# TukTouky Platform - Quick Start Guide

## Installation & Setup

### 1. Environment Configuration

Create `.env.development.local`:

```
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
API_BASE_URL=http://localhost:3000
```

### 2. Install Dependencies

```bash
npm install
# or
pnpm install
```

### 3. Initialize Platform in App

In your main app file:

```typescript
import { platformInitializer } from '@/lib/platform/appInitializer';

// In app initialization (useEffect)
useEffect(() => {
  platformInitializer.initialize({
    environment: 'development',
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  });
}, []);
```

### 4. Wrap App with Platform Layout

```typescript
import { PlatformLayout } from '@/components/PlatformLayout';

export default function App() {
  return (
    <PlatformLayout>
      {/* Your app content */}
    </PlatformLayout>
  );
}
```

## Core Concepts

### User Roles

The system supports multiple roles:

**Customer Roles:**
- `customer` - Basic customer
- `customer_premium` - Premium customer with family tracking

**Driver Roles:**
- `driver` - Standard driver
- `driver_premium` - Premium driver with advanced features

**Admin Roles:**
- `admin` - Platform administrator
- `super_admin` - Full system access
- `operations_admin` - Operations management
- `finance_admin` - Financial operations

### Feature Flags

Enable/disable features dynamically:

```typescript
const kernel = PlatformKernel.getInstance();
if (kernel.isFeatureEnabled(FeatureFlag.WALLET_SYSTEM)) {
  // Show wallet features
}
```

## Common Tasks

### Task 1: Get User Balance

```typescript
async function getUserBalance(userId: string) {
  const factory = platformInitializer.getServiceFactory();
  const walletService = factory.getService('wallet');
  
  const balance = await walletService.getBalance(userId);
  console.log(`Balance: ${balance.currency} ${balance.total}`);
}
```

### Task 2: Process Commission for Trip

```typescript
async function processTrip(tripId: string, driverId: string, fare: number) {
  const factory = platformInitializer.getServiceFactory();
  const commission = factory.getService('commission');
  const wallet = factory.getService('wallet');
  const audit = factory.getService('audit');

  // Calculate commission
  const calc = await commission.calculateCommission(fare, driverId);
  
  // Add to wallet
  await wallet.addTransaction(driverId, {
    type: 'commission',
    amount: calc.totalCommission,
    description: `Trip ${tripId} commission`,
    reference: tripId,
  });
  
  // Log action
  await audit.logAction(
    'TRIP_COMPLETED',
    'trips',
    tripId,
    driverId,
    { fare, commission: calc.totalCommission }
  );
}
```

### Task 3: Check User Permissions

```typescript
async function canUserAccess(userId: string, resource: string, action: string) {
  const session = authProvider.getSession();
  
  if (!session) {
    return false;
  }

  return session.roles.some(role => 
    PlatformKernel.getInstance().hasPermission(role, resource, action)
  );
}
```

### Task 4: Log Admin Action

```typescript
async function logAdminAction(action: string, userId: string, changes: any) {
  const factory = platformInitializer.getServiceFactory();
  const audit = factory.getService('audit');
  
  await audit.logAction(
    action,
    'users',
    userId,
    getCurrentUserId(),
    changes
  );
}
```

### Task 5: Toggle Feature Flag

```typescript
async function toggleWalletFeature(enabled: boolean) {
  const factory = platformInitializer.getServiceFactory();
  const kernel = PlatformKernel.getInstance();
  
  // In production, this would call an admin API
  // For now, just check if feature is enabled
  const isEnabled = kernel.isFeatureEnabled(FeatureFlag.WALLET_SYSTEM);
  console.log(`Wallet System: ${isEnabled}`);
}
```

### Task 6: Get Transaction History

```typescript
async function getTransactions(userId: string, limit: number = 50) {
  const factory = platformInitializer.getServiceFactory();
  const wallet = factory.getService('wallet');
  
  const history = await wallet.getTransactionHistory(userId, limit);
  return history;
}
```

### Task 7: Generate Activity Report

```typescript
async function generateUserReport(userId: string) {
  const factory = platformInitializer.getServiceFactory();
  const audit = factory.getService('audit');
  
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30); // Last 30 days
  
  const report = await audit.getUserActivityReport(userId, startDate);
  return report;
}
```

### Task 8: Detect Suspicious Activity

```typescript
async function checkSuspiciousActivity(userId: string) {
  const factory = platformInitializer.getServiceFactory();
  const audit = factory.getService('audit');
  
  const suspicious = await audit.detectSuspiciousActivity(
    userId,
    3600000 // 1 hour
  );
  
  if (suspicious.length > 0) {
    console.warn('Suspicious activity detected:', suspicious);
    return true;
  }
  return false;
}
```

## Component Usage

### WalletDashboard Component

```typescript
import { WalletDashboard } from '@/components/WalletDashboard';

export default function WalletPage() {
  return (
    <View>
      <Text style={{ fontSize: 24, fontWeight: 'bold' }}>My Wallet</Text>
      <WalletDashboard />
    </View>
  );
}
```

### Admin Dashboard

```typescript
// File: app/admin.tsx
import AdminDashboard from '@/app/admin-dashboard';

export default function AdminPage() {
  return <AdminDashboard />;
}
```

### Dynamic Navigation

The platform automatically generates navigation based on user roles. The navigation is available via:

```typescript
const navConfig = navigationManager.getNavigationConfig();
// Use navConfig.items to render menu
```

## API Endpoints (To Be Implemented)

The following endpoints should be implemented in your backend:

**Authentication:**
- `POST /auth/login` - Login
- `POST /auth/signup` - Register
- `POST /auth/logout` - Logout
- `POST /auth/refresh` - Refresh token
- `GET /auth/me` - Get current user

**Wallet:**
- `GET /wallet/:userId` - Get wallet
- `GET /wallet/:userId/balance` - Get balance
- `POST /wallet/:userId/transactions` - Add transaction
- `GET /wallet/:userId/transactions` - Get transactions
- `GET /wallet/:userId/monthly-report` - Monthly report
- `POST /wallet/:userId/withdraw` - Request withdrawal

**Commissions:**
- `POST /commissions/calculate` - Calculate commission
- `GET /commissions/:driverId` - Get commission history
- `GET /commissions/:driverId/stats` - Commission statistics
- `PUT /commissions/rules` - Update rules

**Admin:**
- `GET /admin/metrics` - Dashboard metrics
- `GET /admin/alerts` - System alerts
- `PATCH /admin/alerts/:id` - Resolve alert
- `GET /admin/feature-flags` - Get flags
- `PATCH /admin/feature-flags/:id` - Update flag

**Audit:**
- `GET /audit-logs` - Get audit logs
- `GET /audit-logs/:userId/report` - User activity report
- `GET /audit-logs/system/report` - System report

## Supabase Schema Setup

Run these migrations in your Supabase project:

```sql
-- Users table (extends auth.users)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  email VARCHAR(255) NOT NULL,
  phone VARCHAR(20),
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  role VARCHAR(50) NOT NULL,
  roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  status VARCHAR(50) DEFAULT 'active',
  email_verified BOOLEAN DEFAULT FALSE,
  phone_verified BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  metadata JSONB
);

-- Wallets table
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  balance DECIMAL(15,2) DEFAULT 0,
  locked_balance DECIMAL(15,2) DEFAULT 0,
  currency VARCHAR(3) DEFAULT 'USD',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Wallet transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id),
  type VARCHAR(50) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  balance DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  resource VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255) NOT NULL,
  changes JSONB,
  metadata JSONB,
  ip_address VARCHAR(50),
  user_agent TEXT,
  status VARCHAR(20) NOT NULL,
  error_message TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Feature flags
CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key VARCHAR(100) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT FALSE,
  rollout_percentage SMALLINT DEFAULT 0,
  target_roles TEXT[],
  target_countries TEXT[],
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Navigation items
CREATE TABLE IF NOT EXISTS navigation_items (
  id VARCHAR(100) PRIMARY KEY,
  key VARCHAR(100) NOT NULL UNIQUE,
  label VARCHAR(255) NOT NULL,
  icon VARCHAR(100),
  path VARCHAR(255),
  parent_id VARCHAR(100),
  order_index INT,
  visible_to TEXT[] DEFAULT ARRAY[]::TEXT[],
  enabled BOOLEAN DEFAULT TRUE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

## Troubleshooting

### Services Not Initializing

Make sure `platformInitializer.initialize()` is called before accessing services:

```typescript
if (!platformInitializer.isInitialized()) {
  await platformInitializer.initialize();
}
```

### User Session Not Updating

After login, call `initializeUserSession` with user roles:

```typescript
const session = authProvider.getSession();
await platformInitializer.initializeUserSession(session.roles);
```

### Navigation Not Showing

Ensure `navigationManager.initializeForUser()` is called:

```typescript
await navigationManager.initializeForUser(userRoles);
```

## Next Steps

1. Implement backend API endpoints (see API section above)
2. Set up Supabase with required tables
3. Connect authentication to Supabase Auth
4. Add more UI components as needed
5. Implement real-time features with Supabase subscriptions
6. Add more admin features
7. Implement notification system
8. Add payment processing

## Support

For issues or questions:
1. Check PLATFORM_ARCHITECTURE.md for detailed documentation
2. Review example implementations in components/
3. Check error logs in console
4. Verify environment variables are set correctly
