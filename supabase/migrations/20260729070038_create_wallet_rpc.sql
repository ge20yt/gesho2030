/*
# Atomic wallet transaction RPC

## Purpose
Moves wallet balance updates from client-side (read-modify-write) to a single
atomic Postgres function. This prevents race conditions when two operations
hit the same wallet concurrently (e.g. commission credit + withdrawal).

## Function
`process_wallet_transaction(p_user_id, p_type, p_amount, p_description, p_reference, p_metadata)`
- Locks the wallet row with FOR UPDATE.
- Validates sufficient balance for debit/penalty.
- Updates balance atomically.
- Inserts the transaction record with the new balance.
- Returns the transaction row.

## Security
- SECURITY DEFINER so it can run with elevated privileges.
- Validates auth.uid() = p_user_id internally.
- search_path locked to public.
*/

CREATE OR REPLACE FUNCTION public.process_wallet_transaction(
  p_user_id uuid,
  p_type text,
  p_amount numeric,
  p_description text DEFAULT NULL,
  p_reference text DEFAULT NULL,
  p_metadata jsonb DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet record;
  v_new_balance numeric;
  v_tx_id uuid;
  v_result jsonb;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: wallet owner mismatch';
  END IF;

  SELECT * INTO v_wallet
  FROM wallets
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Wallet not found';
  END IF;

  v_new_balance := v_wallet.balance;

  IF p_type IN ('credit', 'commission', 'bonus', 'refund', 'unlock') THEN
    v_new_balance := v_new_balance + p_amount;
    IF p_type = 'unlock' THEN
      v_new_balance := v_new_balance;
      UPDATE wallets SET locked_balance = GREATEST(0, locked_balance - p_amount) WHERE id = v_wallet.id;
    END IF;
  ELSIF p_type IN ('debit', 'penalty') THEN
    IF v_new_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient balance';
    END IF;
    v_new_balance := v_new_balance - p_amount;
  ELSIF p_type = 'lock' THEN
    IF v_new_balance < p_amount THEN
      RAISE EXCEPTION 'Insufficient balance to lock';
    END IF;
    v_new_balance := v_new_balance - p_amount;
    UPDATE wallets SET locked_balance = locked_balance + p_amount WHERE id = v_wallet.id;
  ELSE
    RAISE EXCEPTION 'Unknown transaction type: %', p_type;
  END IF;

  UPDATE wallets SET balance = v_new_balance WHERE id = v_wallet.id;

  INSERT INTO wallet_transactions (wallet_id, user_id, type, amount, balance, description, reference, metadata)
  VALUES (v_wallet.id, p_user_id, p_type, p_amount, v_new_balance, p_description, p_reference, p_metadata)
  RETURNING id INTO v_tx_id;

  v_result := jsonb_build_object(
    'id', v_tx_id,
    'wallet_id', v_wallet.id,
    'type', p_type,
    'amount', p_amount,
    'balance', v_new_balance,
    'description', p_description
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.process_wallet_transaction TO authenticated;
