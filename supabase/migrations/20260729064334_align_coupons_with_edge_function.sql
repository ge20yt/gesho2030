/*
# Align coupons table with validate-coupon edge function

## Changes
- Add `max_uses` column (integer, nullable) to coupons — supports usage cap checks.
- Rename `discount_value` → `discount_amount` to match the edge function code.
- Add `discount_type` value 'percent' support (already text, no constraint to change).

## Notes
- Idempotent: uses DO $$ blocks for conditional column adds.
- No data loss: only additive changes.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coupons' AND column_name = 'max_uses') THEN
    ALTER TABLE coupons ADD COLUMN max_uses integer;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'coupons' AND column_name = 'discount_amount') THEN
    ALTER TABLE coupons ADD COLUMN discount_amount numeric NOT NULL DEFAULT 0;
  END IF;
END $$;
