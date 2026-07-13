# دليل الإعداد السريع - TukTouky Platform

## المتطلبات الأساسية

- Node.js 18+
- npm أو yarn
- Expo CLI
- Git

## خطوات الإعداد

### 1. تثبيت الحزم

```bash
npm install
# أو
yarn install
# أو
pnpm install
```

### 2. إعداد متغيرات البيئة

انسخ ملف `.env.example` إلى `.env.development.local`:

```bash
cp .env.example .env.development.local
```

أضف قيم البيئة التالية:

```env
# Supabase
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_key

# App Config
EXPO_PUBLIC_APP_ENV=development
EXPO_PUBLIC_API_URL=http://localhost:3000
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=your_google_maps_key

# Feature Flags
EXPO_PUBLIC_ENABLE_ADMIN_PANEL=true
EXPO_PUBLIC_ENABLE_ANALYTICS=true
EXPO_PUBLIC_ENABLE_PUSH_NOTIFICATIONS=true
```

### 3. إعداد قاعدة البيانات

#### إنشاء الجداول الأساسية:

```sql
-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Wallets table
CREATE TABLE wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  balance DECIMAL DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Wallet Transactions
CREATE TABLE wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID REFERENCES wallets(id),
  amount DECIMAL,
  type TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Navigation Items
CREATE TABLE navigation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label TEXT NOT NULL,
  path TEXT NOT NULL,
  icon TEXT,
  role TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Audit Logs
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id),
  action TEXT,
  resource TEXT,
  details JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 4. تشغيل التطبيق للويب

```bash
npm run dev
```

سيفتح التطبيق على `http://localhost:8081`

### 5. تشغيل على الهاتف

#### iOS:
```bash
npm run ios
```

#### Android:
```bash
npm run android
```

## البنية المعمارية

```
src/
├── app/                    # صفحات التطبيق
├── components/             # مكونات React
├── contexts/              # Context Providers
├── hooks/                 # Custom Hooks
├── lib/
│   ├── auth/             # خدمات المصادقة
│   ├── platform/         # أساسيات النظام الأساسي
│   ├── navigation/       # إدارة الملاحة
│   ├── admin/            # لوحة التحكم
│   ├── wallet/           # خدمات المحفظة
│   ├── security/         # الأمان والتدقيق
│   ├── database/         # أنواع قاعدة البيانات
│   └── services/         # خدمات عامة
├── styles/               # التنسيقات العامة
└── utils/                # دوال مساعدة
```

## التصريح والمصادقة

جميع الطلبات إلى الخادم يجب أن تتضمن رمز التفويض:

```typescript
const token = await auth.getToken();
const response = await fetch('/api/endpoint', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## استخدام الخوادم الوهمية للتطوير

لتطوير المكونات بدون خادم حقيقي، استخدم البيانات الوهمية:

```typescript
// في lib/mock/data.ts
export const mockUsers = [
  { id: '1', email: 'admin@test.com', role: 'admin' },
  { id: '2', email: 'driver@test.com', role: 'driver' },
];

// في الخدمات
if (process.env.NODE_ENV === 'development') {
  return mockUsers;
}
```

## نصائح التطوير

### استخدام React DevTools

```bash
npm install -g react-devtools
react-devtools
```

### استخدام Expo DevTools

اضغط على `d` أثناء تشغيل Expo لفتح الأدوات.

### تصحيح الأخطاء

استخدم `console.log` مع البادئة `[v0]`:

```typescript
console.log('[v0] Debug message:', data);
```

## الاختبار

### تشغيل الاختبارات

```bash
npm test
```

### كتابة اختبارات جديدة

```typescript
import { render, screen, fireEvent } from '@testing-library/react-native';
import MyComponent from './MyComponent';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeOnTheScreen();
  });
});
```

## النشر

### نشر على Expo

```bash
expo publish
```

### بناء APK أو IPA

```bash
# Android
expo build:android

# iOS
expo build:ios
```

## استكشاف الأخطاء والمشاكل الشائعة

### المشكلة: خطأ "Module not found"

**الحل:**
```bash
npm install --legacy-peer-deps
```

### المشكلة: خطأ Supabase

**الحل:** تحقق من متغيرات البيئة في `.env.development.local`

### المشكلة: خطأ في الملاحة

**الحل:** تأكد من أن جميع المسارات معرفة في `app/` و `_layout.tsx`

## المساعدة والدعم

للمزيد من المعلومات:
- [Expo Documentation](https://docs.expo.dev)
- [React Native Docs](https://reactnative.dev)
- [Supabase Docs](https://supabase.com/docs)

## الخطوات التالية

1. اقرأ `ARCHITECTURE.md` لفهم البنية
2. اقرأ `USAGE_EXAMPLES.md` للأمثلة العملية
3. تعرف على `IMPLEMENTATION_GUIDE.md` لتطبيق الميزات الجديدة
