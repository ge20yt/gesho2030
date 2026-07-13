# Usage Examples - TukTouky Platform

استخدام جميع الأنظمة المدمجة مع أمثلة عملية كاملة.

## 1. استخدام Auth Hook

```tsx
import { useAuth } from '@/hooks/useAuth';

export function LoginComponent() {
  const { login, isLoading, error, isAuthenticated } = useAuth();

  const handleLogin = async () => {
    try {
      await login('user@example.com', 'password');
      // Redirect to dashboard
    } catch (err) {
      console.error('Login failed:', err);
    }
  };

  return (
    <div>
      {error && <p>Error: {error}</p>}
      <button onClick={handleLogin} disabled={isLoading}>
        {isLoading ? 'Logging in...' : 'Login'}
      </button>
    </div>
  );
}
```

## 2. استخدام Wallet Hook

```tsx
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/hooks/useAuth';

export function WalletComponent() {
  const { user } = useAuth();
  const { wallet, getBalance, addFunds, withdraw, isLoading } = useWallet(user?.id);

  const handleAddFunds = async () => {
    try {
      await addFunds(100, 'credit_card', 'ref123');
      alert('Funds added successfully');
    } catch (err) {
      console.error('Failed to add funds:', err);
    }
  };

  return (
    <div>
      <h3>Wallet Balance: {getBalance()}</h3>
      <button onClick={handleAddFunds} disabled={isLoading}>
        Add Funds
      </button>
    </div>
  );
}
```

## 3. استخدام Navigation Hook

```tsx
import { useNavigation } from '@/hooks/useNavigation';
import { useAuth } from '@/hooks/useAuth';

export function NavigationComponent() {
  const { user } = useAuth();
  const { getMenuItems, isActive, setCurrentPath } = useNavigation(user?.role, user?.tenantId);

  return (
    <nav>
      {getMenuItems().map(item => (
        <a
          key={item.id}
          href={item.path}
          className={isActive(item.path) ? 'active' : ''}
          onClick={() => setCurrentPath(item.path)}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
```

## 4. استخدام Dashboard Hook

```tsx
import { useDashboard } from '@/hooks/useDashboard';

export function DashboardComponent() {
  const { metrics, alerts, getCriticalAlerts, dismissAlert } = useDashboard('tenant-1');

  return (
    <div>
      <h2>Dashboard Metrics</h2>
      {metrics && (
        <div>
          <p>Total Users: {metrics.totalUsers}</p>
          <p>Active Trips: {metrics.activeTrips}</p>
        </div>
      )}
      
      <h3>Critical Alerts</h3>
      {getCriticalAlerts().map(alert => (
        <div key={alert.id}>
          <p>{alert.message}</p>
          <button onClick={() => dismissAlert(alert.id)}>Dismiss</button>
        </div>
      ))}
    </div>
  );
}
```

## 5. استخدام Platform Context

```tsx
import { usePlatform } from '@/contexts/PlatformContext';

export function SettingsComponent() {
  const { isDarkMode, toggleDarkMode, language, setLanguage } = usePlatform();

  return (
    <div>
      <button onClick={toggleDarkMode}>
        {isDarkMode ? 'Light Mode' : 'Dark Mode'}
      </button>
      
      <select value={language} onChange={e => setLanguage(e.target.value)}>
        <option value="ar">العربية</option>
        <option value="en">English</option>
      </select>
    </div>
  );
}
```

## 6. دمج كل الأنظمة معاً

```tsx
import { useAuth } from '@/hooks/useAuth';
import { useWallet } from '@/hooks/useWallet';
import { useNavigation } from '@/hooks/useNavigation';
import { useDashboard } from '@/hooks/useDashboard';
import { usePlatform } from '@/contexts/PlatformContext';

export function CompleteAppLayout() {
  const { user, hasRole } = useAuth();
  const { wallet, getBalance } = useWallet(user?.id);
  const { getMenuItems } = useNavigation(user?.role, user?.tenantId);
  const { alerts } = useDashboard(user?.tenantId);
  const { isDarkMode, language } = usePlatform();

  if (!user) {
    return <LoginPage />;
  }

  return (
    <div className={isDarkMode ? 'dark' : 'light'} lang={language}>
      <header>
        <nav>
          {getMenuItems().map(item => (
            <NavLink key={item.id} item={item} />
          ))}
        </nav>
        <div>
          <Badge>{alerts.length} Alerts</Badge>
          <Badge>{getBalance()} Credits</Badge>
          <UserMenu />
        </div>
      </header>

      <main>
        {hasRole('admin') && <AdminDashboard />}
        {hasRole('driver') && <DriverDashboard />}
        {hasRole('user') && <UserDashboard />}
      </main>
    </div>
  );
}
```

## 7. مثال على الصفحة الإدارية

```tsx
import { useDashboard } from '@/hooks/useDashboard';
import { useAuth } from '@/hooks/useAuth';

export default function AdminPage() {
  const { user, hasRole } = useAuth();
  const { metrics, alerts, systemStatus, getCriticalAlerts } = useDashboard(user?.tenantId);

  if (!hasRole('admin')) {
    return <div>Access Denied</div>;
  }

  return (
    <div>
      <h1>Admin Dashboard</h1>
      
      <section>
        <h2>System Metrics</h2>
        {metrics && (
          <MetricsGrid>
            <MetricCard title="Total Users" value={metrics.totalUsers} />
            <MetricCard title="Active Trips" value={metrics.activeTrips} />
            <MetricCard title="Revenue" value={metrics.totalRevenue} />
            <MetricCard title="System Health" value={systemStatus?.healthScore} />
          </MetricsGrid>
        )}
      </section>

      <section>
        <h2>Critical Alerts ({getCriticalAlerts().length})</h2>
        <AlertsList alerts={getCriticalAlerts()} />
      </section>
    </div>
  );
}
```

## 8. مثال على عملية الشحن

```tsx
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/hooks/useAuth';

export function RechargeWallet() {
  const { user } = useAuth();
  const { addFunds, isLoading } = useWallet(user?.id);

  const handleRecharge = async (amount: number, method: string) => {
    try {
      const transaction = await addFunds(
        amount,
        method,
        `RECHARGE-${Date.now()}`
      );
      alert(`Successfully charged ${amount} to your wallet`);
      return transaction;
    } catch (error) {
      alert('Recharge failed. Please try again.');
    }
  };

  return (
    <div>
      <h2>Recharge Your Wallet</h2>
      <button onClick={() => handleRecharge(10, 'credit_card')}>
        Charge 10 Credits
      </button>
      <button onClick={() => handleRecharge(50, 'credit_card')}>
        Charge 50 Credits
      </button>
      <button onClick={() => handleRecharge(100, 'credit_card')}>
        Charge 100 Credits
      </button>
    </div>
  );
}
```

## 9. مثال على الصرف من المحفظة

```tsx
import { useWallet } from '@/hooks/useWallet';
import { useAuth } from '@/hooks/useAuth';

export function WithdrawFunds() {
  const { user } = useAuth();
  const { withdraw, getBalance, isLoading } = useWallet(user?.id);
  const [amount, setAmount] = useState(0);

  const handleWithdraw = async () => {
    try {
      await withdraw(
        amount,
        'bank_transfer',
        `WITHDRAW-${Date.now()}`
      );
      alert('Withdrawal successful');
      setAmount(0);
    } catch (error) {
      alert('Withdrawal failed');
    }
  };

  return (
    <div>
      <h2>Withdraw Funds</h2>
      <p>Available Balance: {getBalance()} Credits</p>
      <input
        type="number"
        value={amount}
        onChange={e => setAmount(Number(e.target.value))}
        max={getBalance()}
      />
      <button onClick={handleWithdraw} disabled={isLoading || amount > getBalance()}>
        Withdraw
      </button>
    </div>
  );
}
```

## 10. مثال على التحقق من الأذونات

```tsx
import { useAuth } from '@/hooks/useAuth';

export function FeatureComponent() {
  const { hasPermission, hasRole } = useAuth();

  return (
    <div>
      {hasRole('admin') && (
        <div>
          <h3>Admin Only Section</h3>
          <AdminPanel />
        </div>
      )}

      {hasPermission('manage_drivers') && (
        <div>
          <DriverManagement />
        </div>
      )}

      {hasPermission('view_transactions') && (
        <div>
          <TransactionHistory />
        </div>
      )}
    </div>
  );
}
```

## نصائح الأداء

1. استخدم `useCallback` لتجنب إعادة العرض غير الضرورية
2. استخدم `useMemo` للحسابات الثقيلة
3. لا تستدعي الخوادم بشكل متكرر
4. استخدم البيانات المخزنة مؤقتاً

## معالجة الأخطاء

جميع الخطافات توفر كائن `error` يمكن التحقق منه:

```tsx
const { error, isLoading, user } = useAuth();

if (error) {
  return <ErrorBoundary message={error} />;
}

if (isLoading) {
  return <LoadingSpinner />;
}

return <MainContent />;
```
