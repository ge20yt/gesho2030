/*
# TukTouky Core Schema — Phase 0 Foundation

## Purpose
Creates the complete database layer the application code already expects.
18 tables + RLS policies + signup trigger + updated_at triggers.

## Tables (18)
user_profiles, drivers, trips, wallets, wallet_transactions, wallet_withdrawals,
commissions, commission_rules, commission_bonuses, complaints, coupons,
coupon_usage, notifications, messages, rider_ratings, rewards,
reward_transactions, audit_logs

## Security
- RLS enabled on every table.
- 4 policies per table (SELECT/INSERT/UPDATE/DELETE), scoped to authenticated.
- user_profiles.id defaults to auth.uid().
- Trigger auto-creates user_profiles + wallets on signup.
*/

-- 1. user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id          uuid PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  username    text,
  email       text,
  phone       text,
  avatar_url  text,
  role        text NOT NULL DEFAULT 'rider',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON user_profiles;
CREATE POLICY "select_own_profile" ON user_profiles FOR SELECT TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "insert_own_profile" ON user_profiles;
CREATE POLICY "insert_own_profile" ON user_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "update_own_profile" ON user_profiles;
CREATE POLICY "update_own_profile" ON user_profiles FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
DROP POLICY IF EXISTS "delete_own_profile" ON user_profiles;
CREATE POLICY "delete_own_profile" ON user_profiles FOR DELETE TO authenticated USING (auth.uid() = id);

-- 2. drivers
CREATE TABLE IF NOT EXISTS drivers (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  name          text NOT NULL,
  phone         text NOT NULL,
  vehicle       text,
  vehicle_type  text,
  plate         text,
  avatar_url    text,
  rating        numeric NOT NULL DEFAULT 5.0,
  total_trips   integer NOT NULL DEFAULT 0,
  is_online     boolean NOT NULL DEFAULT false,
  is_active     boolean NOT NULL DEFAULT true,
  level         text NOT NULL DEFAULT 'standard',
  lat           double precision,
  lng           double precision,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_drivers_user_id ON drivers(user_id);
CREATE INDEX IF NOT EXISTS idx_drivers_online_active ON drivers(is_online, is_active);
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_drivers" ON drivers;
CREATE POLICY "select_drivers" ON drivers FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_own_driver" ON drivers;
CREATE POLICY "insert_own_driver" ON drivers FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_driver" ON drivers;
CREATE POLICY "update_own_driver" ON drivers FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_driver" ON drivers;
CREATE POLICY "delete_own_driver" ON drivers FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 3. trips
CREATE TABLE IF NOT EXISTS trips (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  driver_id           uuid REFERENCES drivers(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'pending',
  from_location       text,
  to_location         text,
  price               numeric NOT NULL DEFAULT 0,
  payment_method      text NOT NULL DEFAULT 'cash',
  cancellation_reason text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_driver_id ON trips(driver_id);
CREATE INDEX IF NOT EXISTS idx_trips_status ON trips(status);
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_trips" ON trips;
CREATE POLICY "select_trips" ON trips FOR SELECT TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM drivers WHERE drivers.id = trips.driver_id AND drivers.user_id = auth.uid())
);
DROP POLICY IF EXISTS "insert_own_trip" ON trips;
CREATE POLICY "insert_own_trip" ON trips FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_trip" ON trips;
CREATE POLICY "update_trip" ON trips FOR UPDATE TO authenticated
  USING (auth.uid() = user_id OR EXISTS (SELECT 1 FROM drivers WHERE drivers.id = trips.driver_id AND drivers.user_id = auth.uid()))
  WITH CHECK (auth.uid() = user_id OR EXISTS (SELECT 1 FROM drivers WHERE drivers.id = trips.driver_id AND drivers.user_id = auth.uid()));
DROP POLICY IF EXISTS "delete_own_trip" ON trips;
CREATE POLICY "delete_own_trip" ON trips FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 4. wallets
CREATE TABLE IF NOT EXISTS wallets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  balance       numeric NOT NULL DEFAULT 0,
  locked_balance numeric NOT NULL DEFAULT 0,
  currency      text NOT NULL DEFAULT 'EGP',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wallet" ON wallets;
CREATE POLICY "select_own_wallet" ON wallets FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wallet" ON wallets;
CREATE POLICY "insert_own_wallet" ON wallets FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wallet" ON wallets;
CREATE POLICY "update_own_wallet" ON wallets FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wallet" ON wallets;
CREATE POLICY "delete_own_wallet" ON wallets FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 5. wallet_transactions
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id   uuid NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text NOT NULL,
  amount      numeric NOT NULL,
  balance     numeric,
  description text,
  reference   text,
  metadata    jsonb,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_wallet_id ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_tx_user_id ON wallet_transactions(user_id);
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_wallet_tx" ON wallet_transactions;
CREATE POLICY "select_own_wallet_tx" ON wallet_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_wallet_tx" ON wallet_transactions;
CREATE POLICY "insert_own_wallet_tx" ON wallet_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_wallet_tx" ON wallet_transactions;
CREATE POLICY "update_own_wallet_tx" ON wallet_transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_wallet_tx" ON wallet_transactions;
CREATE POLICY "delete_own_wallet_tx" ON wallet_transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6. wallet_withdrawals
CREATE TABLE IF NOT EXISTS wallet_withdrawals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  amount          numeric NOT NULL,
  method          text NOT NULL,
  account_details jsonb,
  reason          text,
  status          text NOT NULL DEFAULT 'pending',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wallet_withdrawals_user_id ON wallet_withdrawals(user_id);
ALTER TABLE wallet_withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_withdrawal" ON wallet_withdrawals;
CREATE POLICY "select_own_withdrawal" ON wallet_withdrawals FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_withdrawal" ON wallet_withdrawals;
CREATE POLICY "insert_own_withdrawal" ON wallet_withdrawals FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_withdrawal" ON wallet_withdrawals;
CREATE POLICY "update_own_withdrawal" ON wallet_withdrawals FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_withdrawal" ON wallet_withdrawals;
CREATE POLICY "delete_own_withdrawal" ON wallet_withdrawals FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 7. commissions
CREATE TABLE IF NOT EXISTS commissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  trip_id    uuid REFERENCES trips(id) ON DELETE SET NULL,
  amount     numeric NOT NULL,
  rate       numeric,
  type       text NOT NULL DEFAULT 'trip',
  status     text NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  paid_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_commissions_driver_id ON commissions(driver_id);
ALTER TABLE commissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_commission" ON commissions;
CREATE POLICY "select_own_commission" ON commissions FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM drivers WHERE drivers.id = commissions.driver_id AND drivers.user_id = auth.uid())
);
DROP POLICY IF EXISTS "insert_own_commission" ON commissions;
CREATE POLICY "insert_own_commission" ON commissions FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM drivers WHERE drivers.id = commissions.driver_id AND drivers.user_id = auth.uid())
);
DROP POLICY IF EXISTS "update_own_commission" ON commissions;
CREATE POLICY "update_own_commission" ON commissions FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM drivers WHERE drivers.id = commissions.driver_id AND drivers.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM drivers WHERE drivers.id = commissions.driver_id AND drivers.user_id = auth.uid())
);
DROP POLICY IF EXISTS "delete_own_commission" ON commissions;
CREATE POLICY "delete_own_commission" ON commissions FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM drivers WHERE drivers.id = commissions.driver_id AND drivers.user_id = auth.uid())
);

-- 8. commission_rules
CREATE TABLE IF NOT EXISTS commission_rules (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  type       text NOT NULL DEFAULT 'percentage',
  base_value numeric NOT NULL DEFAULT 20,
  conditions jsonb,
  enabled    boolean NOT NULL DEFAULT true,
  priority   integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE commission_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_commission_rules" ON commission_rules;
CREATE POLICY "select_commission_rules" ON commission_rules FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_commission_rules" ON commission_rules;
CREATE POLICY "insert_commission_rules" ON commission_rules FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "update_commission_rules" ON commission_rules;
CREATE POLICY "update_commission_rules" ON commission_rules FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_commission_rules" ON commission_rules;
CREATE POLICY "delete_commission_rules" ON commission_rules FOR DELETE TO authenticated USING (true);

-- 9. commission_bonuses
CREATE TABLE IF NOT EXISTS commission_bonuses (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  driver_id  uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'percentage',
  value      numeric NOT NULL,
  active      boolean NOT NULL DEFAULT true,
  start_date  timestamptz NOT NULL DEFAULT now(),
  end_date    timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_commission_bonuses_driver_id ON commission_bonuses(driver_id);
ALTER TABLE commission_bonuses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_bonus" ON commission_bonuses;
CREATE POLICY "select_own_bonus" ON commission_bonuses FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM drivers WHERE drivers.id = commission_bonuses.driver_id AND drivers.user_id = auth.uid())
);
DROP POLICY IF EXISTS "insert_own_bonus" ON commission_bonuses;
CREATE POLICY "insert_own_bonus" ON commission_bonuses FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM drivers WHERE drivers.id = commission_bonuses.driver_id AND drivers.user_id = auth.uid())
);
DROP POLICY IF EXISTS "update_own_bonus" ON commission_bonuses;
CREATE POLICY "update_own_bonus" ON commission_bonuses FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM drivers WHERE drivers.id = commission_bonuses.driver_id AND drivers.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM drivers WHERE drivers.id = commission_bonuses.driver_id AND drivers.user_id = auth.uid())
);
DROP POLICY IF EXISTS "delete_own_bonus" ON commission_bonuses;
CREATE POLICY "delete_own_bonus" ON commission_bonuses FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM drivers WHERE drivers.id = commission_bonuses.driver_id AND drivers.user_id = auth.uid())
);

-- 10. complaints
CREATE TABLE IF NOT EXISTS complaints (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  trip_id     uuid REFERENCES trips(id) ON DELETE SET NULL,
  reason      text NOT NULL,
  description text,
  status      text NOT NULL DEFAULT 'pending',
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_complaints_user_id ON complaints(user_id);
CREATE INDEX IF NOT EXISTS idx_complaints_status ON complaints(status);
ALTER TABLE complaints ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_complaints" ON complaints;
CREATE POLICY "select_complaints" ON complaints FOR SELECT TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
);
DROP POLICY IF EXISTS "insert_own_complaint" ON complaints;
CREATE POLICY "insert_own_complaint" ON complaints FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_complaints" ON complaints;
CREATE POLICY "update_complaints" ON complaints FOR UPDATE TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_own_complaint" ON complaints;
CREATE POLICY "delete_own_complaint" ON complaints FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 11. coupons
CREATE TABLE IF NOT EXISTS coupons (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code              text NOT NULL UNIQUE,
  description       text,
  discount_type     text NOT NULL DEFAULT 'fixed',
  discount_value    numeric NOT NULL DEFAULT 0,
  min_order_amount  numeric NOT NULL DEFAULT 0,
  max_discount       numeric NOT NULL DEFAULT 0,
  is_active          boolean NOT NULL DEFAULT true,
  expiry_date        timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_coupons" ON coupons;
CREATE POLICY "select_coupons" ON coupons FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "insert_coupons" ON coupons;
CREATE POLICY "insert_coupons" ON coupons FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
);
DROP POLICY IF EXISTS "update_coupons" ON coupons;
CREATE POLICY "update_coupons" ON coupons FOR UPDATE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
) WITH CHECK (
  EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
);
DROP POLICY IF EXISTS "delete_coupons" ON coupons;
CREATE POLICY "delete_coupons" ON coupons FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
);

-- 12. coupon_usage
CREATE TABLE IF NOT EXISTS coupon_usage (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coupon_id   uuid NOT NULL REFERENCES coupons(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  used_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_coupon_usage_coupon_user ON coupon_usage(coupon_id, user_id);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_user_id ON coupon_usage(user_id);
ALTER TABLE coupon_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_coupon_usage" ON coupon_usage;
CREATE POLICY "select_own_coupon_usage" ON coupon_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_coupon_usage" ON coupon_usage;
CREATE POLICY "insert_own_coupon_usage" ON coupon_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_coupon_usage" ON coupon_usage;
CREATE POLICY "update_own_coupon_usage" ON coupon_usage FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_coupon_usage" ON coupon_usage;
CREATE POLICY "delete_own_coupon_usage" ON coupon_usage FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 13. notifications
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  type       text NOT NULL DEFAULT 'alert',
  title      text NOT NULL,
  body       text,
  data       jsonb,
  read       boolean NOT NULL DEFAULT false,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_notification" ON notifications;
CREATE POLICY "select_own_notification" ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_notification" ON notifications;
CREATE POLICY "insert_own_notification" ON notifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_notification" ON notifications;
CREATE POLICY "update_own_notification" ON notifications FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_notification" ON notifications;
CREATE POLICY "delete_own_notification" ON notifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 14. messages
CREATE TABLE IF NOT EXISTS messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id      uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  sender_id    uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_role  text NOT NULL,
  content      text NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_trip_id ON messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_messages" ON messages;
CREATE POLICY "select_messages" ON messages FOR SELECT TO authenticated USING (
  auth.uid() = sender_id
  OR EXISTS (
    SELECT 1 FROM trips WHERE trips.id = messages.trip_id
    AND (trips.user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM drivers WHERE drivers.id = trips.driver_id AND drivers.user_id = auth.uid()))
  )
);
DROP POLICY IF EXISTS "insert_messages" ON messages;
CREATE POLICY "insert_messages" ON messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1 FROM trips WHERE trips.id = messages.trip_id
    AND (trips.user_id = auth.uid()
         OR EXISTS (SELECT 1 FROM drivers WHERE drivers.id = trips.driver_id AND drivers.user_id = auth.uid()))
  )
);
DROP POLICY IF EXISTS "update_own_message" ON messages;
CREATE POLICY "update_own_message" ON messages FOR UPDATE TO authenticated USING (auth.uid() = sender_id) WITH CHECK (auth.uid() = sender_id);
DROP POLICY IF EXISTS "delete_own_message" ON messages;
CREATE POLICY "delete_own_message" ON messages FOR DELETE TO authenticated USING (auth.uid() = sender_id);

-- 15. rider_ratings
CREATE TABLE IF NOT EXISTS rider_ratings (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id    uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  driver_id  uuid NOT NULL REFERENCES drivers(id) ON DELETE CASCADE,
  rider_id   uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating     integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment    text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rider_ratings_trip ON rider_ratings(trip_id);
CREATE INDEX IF NOT EXISTS idx_rider_ratings_driver_id ON rider_ratings(driver_id);
ALTER TABLE rider_ratings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_rider_ratings" ON rider_ratings;
CREATE POLICY "select_rider_ratings" ON rider_ratings FOR SELECT TO authenticated USING (
  auth.uid() = rider_id
  OR EXISTS (SELECT 1 FROM drivers WHERE drivers.id = rider_ratings.driver_id AND drivers.user_id = auth.uid())
);
DROP POLICY IF EXISTS "insert_rider_rating" ON rider_ratings;
CREATE POLICY "insert_rider_rating" ON rider_ratings FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = rider_id
  AND EXISTS (SELECT 1 FROM trips WHERE trips.id = rider_ratings.trip_id AND trips.user_id = auth.uid())
);
DROP POLICY IF EXISTS "update_own_rating" ON rider_ratings;
CREATE POLICY "update_own_rating" ON rider_ratings FOR UPDATE TO authenticated USING (auth.uid() = rider_id) WITH CHECK (auth.uid() = rider_id);
DROP POLICY IF EXISTS "delete_own_rating" ON rider_ratings;
CREATE POLICY "delete_own_rating" ON rider_ratings FOR DELETE TO authenticated USING (auth.uid() = rider_id);

-- 16. rewards
CREATE TABLE IF NOT EXISTS rewards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  points        integer NOT NULL DEFAULT 0,
  total_earned  integer NOT NULL DEFAULT 0,
  total_redeemed integer NOT NULL DEFAULT 0,
  level         text NOT NULL DEFAULT 'bronze',
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_rewards_user_id ON rewards(user_id);
ALTER TABLE rewards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_rewards" ON rewards;
CREATE POLICY "select_own_rewards" ON rewards FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_rewards" ON rewards;
CREATE POLICY "insert_own_rewards" ON rewards FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_rewards" ON rewards;
CREATE POLICY "update_own_rewards" ON rewards FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_rewards" ON rewards;
CREATE POLICY "delete_own_rewards" ON rewards FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 17. reward_transactions
CREATE TABLE IF NOT EXISTS reward_transactions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  points      integer NOT NULL,
  type        text NOT NULL,
  description text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_reward_tx_user_id ON reward_transactions(user_id);
ALTER TABLE reward_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_reward_tx" ON reward_transactions;
CREATE POLICY "select_own_reward_tx" ON reward_transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "insert_own_reward_tx" ON reward_transactions;
CREATE POLICY "insert_own_reward_tx" ON reward_transactions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "update_own_reward_tx" ON reward_transactions;
CREATE POLICY "update_own_reward_tx" ON reward_transactions FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "delete_own_reward_tx" ON reward_transactions;
CREATE POLICY "delete_own_reward_tx" ON reward_transactions FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 18. audit_logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action        text NOT NULL,
  resource      text,
  resource_id   text,
  changes       jsonb,
  ip_address    text,
  user_agent    text,
  status        text NOT NULL DEFAULT 'success',
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_audit_logs" ON audit_logs;
CREATE POLICY "select_audit_logs" ON audit_logs FOR SELECT TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
);
DROP POLICY IF EXISTS "insert_audit_logs" ON audit_logs;
CREATE POLICY "insert_audit_logs" ON audit_logs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
DROP POLICY IF EXISTS "update_audit_logs" ON audit_logs;
CREATE POLICY "update_audit_logs" ON audit_logs FOR UPDATE TO authenticated USING (
  auth.uid() = user_id
  OR EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
) WITH CHECK (true);
DROP POLICY IF EXISTS "delete_audit_logs" ON audit_logs;
CREATE POLICY "delete_audit_logs" ON audit_logs FOR DELETE TO authenticated USING (
  EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
);

-- Trigger: auto-create profile + wallet on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, username)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)))
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger: auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'user_profiles','drivers','trips','wallets','wallet_withdrawals',
    'complaints','coupons','commission_rules','notifications','rewards'
  ])
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON %I;', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();', t);
  END LOOP;
END $$;
