# TukTouky Platform - Implementation Guide

## Overview

This guide provides step-by-step instructions for implementing and extending the TukTouky platform architecture.

---

## Part 1: Initial Setup

### Step 1: Project Configuration

1. **Clone the repository**
   ```bash
   git clone <repo-url>
   cd tuk-touky
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   # or npm install
   ```

3. **Setup environment file**
   ```bash
   cp .env.example .env.development.local
   ```

4. **Configure environment variables**
   ```
   EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   API_BASE_URL=http://localhost:3000
   ENVIRONMENT=development
   ```

### Step 2: Database Setup

1. **Create Supabase project**
   - Go to supabase.com
   - Create new project
   - Get credentials and update .env

2. **Run database migrations**
   - Execute SQL scripts in `supabase/migrations/`
   - Setup RLS policies
   - Create indexes for performance

3. **Seed initial data**
   ```bash
   pnpm run seed:dev
   ```

### Step 3: Start Development

1. **Start the app**
   ```bash
   pnpm start
   # or for web: pnpm web
   # or for iOS: pnpm ios
   # or for Android: pnpm android
   ```

2. **Verify initialization**
   - Check console for initialization logs
   - Verify platform kernel loaded
   - Confirm services registered

---

## Part 2: Implementing Common Features

### Implement: User Login Flow

**File Structure:**
```
app/
├── login.tsx          (Login screen)
└── app-root.tsx       (Post-login routing)
```

**Steps:**

1. **Create login page** (`app/login.tsx`)
   ```typescript
   import { authProvider } from '@/lib/auth/authProvider';
   import { platformInitializer } from '@/lib/platform/appInitializer';

   export default function LoginScreen() {
     const [email, setEmail] = useState('');
     const [password, setPassword] = useState('');
     const [loading, setLoading] = useState(false);

     const handleLogin = async () => {
       try {
         setLoading(true);
         const session = await authProvider.login({ email, password });
         
         // Initialize user session
         await platformInitializer.initializeUserSession(session.roles);
         
         // Navigate to app
         router.replace('/(tabs)');
       } catch (error) {
         Alert.alert('Login failed', error.message);
       } finally {
         setLoading(false);
       }
     };

     return (
       // Form UI...
     );
   }
   ```

2. **Update root layout** to handle auth state
   ```typescript
   const [session, setSession] = useState(null);

   useEffect(() => {
     const unsubscribe = authProvider.onAuthStateChanged(setSession);
     return unsubscribe;
   }, []);

   if (!session) {
     return <LoginScreen />;
   }

   return <AppTabs />;
   ```

### Implement: Trip Creation and Commission

**Files to Create:**
```
lib/trips/
├── tripService.ts         (Trip management)
└── tripUtils.ts           (Helper functions)

app/
└── trip-creation.tsx      (Trip booking UI)
```

**Steps:**

1. **Create Trip Service** (`lib/trips/tripService.ts`)
   ```typescript
   export class TripService {
     async createTrip(data: {
       customerId: string;
       startLocation: Location;
       endLocation: Location;
     }) {
       // 1. Create trip record
       const trip = await this.supabase
         .from('trips')
         .insert({ ...data, status: 'pending' })
         .single();

       // 2. Lock amount in wallet
       const walletService = this.factory.getService('wallet');
       const estimatedFare = this.calculateFare(data);
       await walletService.lockAmount(data.customerId, estimatedFare);

       // 3. Log action
       const auditService = this.factory.getService('audit');
       await auditService.logAction('TRIP_CREATED', 'trips', trip.id, data.customerId);

       return trip;
     }

     async completeTrip(tripId: string, finalFare: number) {
       const trip = await this.getTrip(tripId);
       
       // 1. Unlock wallet
       const walletService = this.factory.getService('wallet');
       await walletService.unlockAmount(trip.customer_id, trip.estimated_fare);

       // 2. Charge actual fare
       await walletService.addTransaction(trip.customer_id, {
         type: 'debit',
         amount: finalFare,
         description: `Trip ${tripId} fare`,
         reference: tripId,
       });

       // 3. Calculate and apply commission
       const commissionService = this.factory.getService('commission');
       const commission = await commissionService.calculateCommission(
         finalFare,
         trip.driver_id
       );

       await walletService.addTransaction(trip.driver_id, {
         type: 'commission',
         amount: commission.totalCommission,
         description: `Trip ${tripId} commission`,
         reference: tripId,
       });

       // 4. Update trip status
       await this.supabase
         .from('trips')
         .update({ status: 'completed', final_fare: finalFare })
         .eq('id', tripId);

       // 5. Log
       const auditService = this.factory.getService('audit');
       await auditService.logAction('TRIP_COMPLETED', 'trips', tripId, trip.driver_id, {
         fare: finalFare,
         commission: commission.totalCommission,
       });
     }
   }
   ```

2. **Register service**
   ```typescript
   // In appInitializer.ts
   const tripService = createTripService(supabase, factory);
   serviceFactory.registerService('trips', tripService);
   ```

3. **Use in component**
   ```typescript
   const handleBookTrip = async (startLocation, endLocation) => {
     const factory = platformInitializer.getServiceFactory();
     const tripService = factory.getService('trips');
     
     const trip = await tripService.createTrip({
       customerId: session.user.id,
       startLocation,
       endLocation,
     });
   };
   ```

### Implement: Admin Analytics Dashboard

**Files to Create:**
```
app/
├── admin-analytics.tsx    (Main analytics page)
├── admin-reports.tsx      (Reports generation)
└── analytics-charts.tsx   (Chart components)
```

**Steps:**

1. **Create analytics service**
   ```typescript
   export class AnalyticsService {
     async getTripMetrics(startDate: Date, endDate: Date) {
       const { data } = await this.supabase
         .from('trips')
         .select('*')
         .gte('created_at', startDate)
         .lte('created_at', endDate);

       return {
         totalTrips: data.length,
         completedTrips: data.filter(t => t.status === 'completed').length,
         cancelledTrips: data.filter(t => t.status === 'cancelled').length,
         totalRevenue: data.reduce((sum, t) => sum + t.final_fare, 0),
         averageFare: data.reduce((sum, t) => sum + t.final_fare, 0) / data.length,
       };
     }

     async getDriverMetrics(driverId: string) {
       const { data } = await this.supabase
         .from('trips')
         .select('*')
         .eq('driver_id', driverId);

       return {
         totalTrips: data.length,
         acceptanceRate: /* calculate */,
         averageRating: /* calculate */,
         totalEarnings: /* calculate */,
       };
     }
   }
   ```

2. **Create analytics page**
   ```typescript
   export default function AdminAnalyticsPage() {
     const [metrics, setMetrics] = useState(null);
     const [dateRange, setDateRange] = useState({
       startDate: new Date(),
       endDate: new Date(),
     });

     useEffect(() => {
       loadMetrics();
     }, [dateRange]);

     const loadMetrics = async () => {
       const factory = platformInitializer.getServiceFactory();
       const analytics = factory.getService('analytics');
       
       const data = await analytics.getTripMetrics(
         dateRange.startDate,
         dateRange.endDate
       );
       setMetrics(data);
     };

     return (
       // Analytics UI with charts
     );
   }
   ```

---

## Part 3: Adding New Roles and Permissions

### Step 1: Define New Role

**File:** `lib/platform/kernel.ts`

```typescript
export enum UserRole {
  // Add new role
  DISPATCH_MANAGER = 'dispatch_manager',
  // ... existing roles
}
```

### Step 2: Add Role Permissions

```typescript
export const ROLE_PERMISSIONS: RolePermission[] = [
  {
    role: UserRole.DISPATCH_MANAGER,
    permissions: [
      { resource: 'trips', action: 'read' },
      { resource: 'trips', action: 'update' },
      { resource: 'drivers', action: 'read' },
      { resource: 'assignments', action: 'create' },
    ],
  },
  // ... other roles
];
```

### Step 3: Update Navigation

**File:** `lib/navigation/navigationManager.ts`

```typescript
{
  id: 'dispatch-center',
  key: 'dispatch',
  label: 'Dispatch Center',
  icon: 'radio',
  path: '/dispatch',
  order: 102,
  visibleTo: ['dispatch_manager', 'super_admin'],
  enabled: true,
}
```

### Step 4: Verify Permission Checking

The system will automatically:
- Hide navigation items
- Block unauthorized access
- Log permission failures
- Track suspicious activity

---

## Part 4: Extending Services

### Add New Service Method

**Example:** Add payment processing to Wallet Service

```typescript
export class WalletService {
  // Existing methods...

  async processPayment(
    userId: string,
    amount: number,
    paymentMethod: 'card' | 'bank_transfer'
  ) {
    try {
      // 1. Validate balance if using wallet
      if (paymentMethod === 'wallet') {
        const balance = await this.getBalance(userId);
        if (!balance || balance.available < amount) {
          throw new Error('Insufficient balance');
        }
      }

      // 2. Process payment (call external API)
      const paymentResult = await this.processExternalPayment(
        userId,
        amount,
        paymentMethod
      );

      // 3. Record transaction if successful
      if (paymentResult.success) {
        await this.addTransaction(userId, {
          type: 'debit',
          amount,
          description: `Payment via ${paymentMethod}`,
          reference: paymentResult.transactionId,
        });
      }

      return paymentResult;
    } catch (error) {
      // Log error
      throw error;
    }
  }

  private async processExternalPayment(...) {
    // Call Stripe, PayPal, etc.
  }
}
```

### Register and Use New Method

```typescript
// In component
const walletService = factory.getService('wallet');
const result = await walletService.processPayment(
  userId,
  amount,
  'card'
);
```

---

## Part 5: Adding Feature Flags

### Step 1: Define Flag

**File:** `lib/platform/kernel.ts`

```typescript
export enum FeatureFlag {
  NEW_BOOKING_UI = 'new_booking_ui',
  // ... existing flags
}
```

### Step 2: Check in Code

```typescript
const kernel = PlatformKernel.getInstance();

if (kernel.isFeatureEnabled(FeatureFlag.NEW_BOOKING_UI)) {
  return <NewBookingUI />;
} else {
  return <LegacyBookingUI />;
}
```

### Step 3: Toggle via Admin Dashboard

```typescript
// User can toggle via admin interface
const dashboard = dashboardManager;
await dashboard.toggleFeatureFlag(flagId, true);
```

---

## Part 6: Database Migrations

### Creating a New Table

**File:** `supabase/migrations/001_create_new_table.sql`

```sql
CREATE TABLE IF NOT EXISTS new_table (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  data JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add RLS
ALTER TABLE new_table ENABLE ROW LEVEL SECURITY;

CREATE POLICY new_table_user_policy ON new_table
  FOR SELECT
  USING (auth.uid() = user_id);

-- Add index
CREATE INDEX idx_new_table_user_id ON new_table(user_id);
```

**Apply migration:**
```bash
# Via Supabase dashboard or CLI
supabase db push
```

---

## Part 7: Error Handling

### Implement Error Handling in Services

```typescript
async function fetchData() {
  try {
    const data = await service.getData();
    return data;
  } catch (error) {
    // 1. Log error
    const audit = factory.getService('audit');
    await audit.log({
      action: 'DATA_FETCH_ERROR',
      resource: 'data',
      status: 'failure',
      errorMessage: error.message,
    });

    // 2. Show user-friendly error
    if (error.message.includes('not found')) {
      throw new Error('Data not found');
    }

    // 3. Re-throw for upstream handling
    throw error;
  }
}
```

### Global Error Handler

```typescript
// In app root
useEffect(() => {
  const errorHandler = (error) => {
    console.error('Global error:', error);
    // Send to error tracking service
    // Show user notification
  };

  window.addEventListener('error', errorHandler);
  return () => window.removeEventListener('error', errorHandler);
}, []);
```

---

## Part 8: Testing

### Unit Test Example

```typescript
// __tests__/commission.test.ts

import { CommissionService } from '@/lib/wallet/commissionService';

describe('CommissionService', () => {
  let service: CommissionService;
  let mockSupabase: any;

  beforeEach(() => {
    mockSupabase = {
      from: jest.fn(),
    };
    service = new CommissionService(mockSupabase);
  });

  test('should calculate percentage commission', async () => {
    const calc = await service.calculateCommission(100, 'driver1');
    
    expect(calc.baseCommission).toBe(20); // 20%
  });

  test('should throw error for invalid amount', async () => {
    await expect(
      service.calculateCommission(-100, 'driver1')
    ).rejects.toThrow();
  });
});
```

### Integration Test Example

```typescript
// __tests__/integration/trip.integration.ts

describe('Trip Workflow', () => {
  test('complete trip flow', async () => {
    // 1. Create trip
    const trip = await tripService.createTrip({...});
    expect(trip.status).toBe('pending');

    // 2. Accept trip
    await tripService.updateTrip(trip.id, { status: 'accepted' });

    // 3. Complete trip
    await tripService.completeTrip(trip.id, 50);

    // 4. Verify commission added
    const wallet = await walletService.getBalance(trip.driver_id);
    expect(wallet.total).toBeGreaterThan(0);
  });
});
```

---

## Part 9: Performance Optimization

### Implement Caching

```typescript
private cache = new Map<string, any>();
private cacheExpiry = new Map<string, number>();

async getWithCache(key: string, fetcher: () => Promise<any>) {
  const cached = this.cache.get(key);
  const expiry = this.cacheExpiry.get(key) || 0;

  if (cached && Date.now() < expiry) {
    return cached;
  }

  const data = await fetcher();
  this.cache.set(key, data);
  this.cacheExpiry.set(key, Date.now() + 3600000); // 1 hour
  return data;
}
```

### Query Optimization

```typescript
// Bad: Multiple queries
const driver = await getDriver(id);
const earnings = await getDriverEarnings(id);
const trips = await getDriverTrips(id);

// Good: Single query with joins
const driver = await supabase
  .from('drivers')
  .select(`
    *,
    earnings:wallet_transactions(*),
    trips(*)
  `)
  .eq('id', id)
  .single();
```

---

## Troubleshooting

### Service Not Found

**Error:** "Service [name] not registered"

**Solution:**
```typescript
// Make sure service is registered in appInitializer.ts
serviceFactory.registerService('name', serviceInstance);
```

### Permission Denied

**Error:** "User does not have permission"

**Solution:**
1. Verify user role in auth
2. Check role in ROLE_PERMISSIONS
3. Verify resource and action names match
4. Check audit logs for denied attempts

### Navigation Not Updating

**Error:** Navigation items not showing

**Solution:**
```typescript
// After login, explicitly initialize navigation
await navigationManager.initializeForUser(session.roles);
```

---

## Best Practices

1. **Always use platform initializer**
   - Don't directly instantiate services
   - Use getServiceFactory() to access services

2. **Check permissions before operations**
   - Use authProvider.canAccess()
   - Log unauthorized attempts

3. **Use transaction-like patterns**
   - Lock funds before operations
   - Unlock on failure
   - Commit on success

4. **Log all important actions**
   - Especially financial operations
   - Admin actions
   - Security events

5. **Handle errors gracefully**
   - Show user-friendly messages
   - Log technical details
   - Recover when possible

6. **Test thoroughly**
   - Unit test services
   - Integration test workflows
   - E2E test user journeys

---

## Conclusion

This guide provides the framework for implementing and extending the TukTouky platform. Follow these patterns for consistency and maintainability.

For detailed API references, see PLATFORM_ARCHITECTURE.md
For quick start, see QUICK_START.md
