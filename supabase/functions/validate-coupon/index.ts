import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from '../_shared/cors.ts';

interface ValidateRequest {
  code: string;
  user_id: string;
  order_amount: number;
}

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, user_id, order_amount }: ValidateRequest = await req.json();

    if (!code || !user_id) {
      return new Response(
        JSON.stringify({ valid: false, error: 'بيانات غير مكتملة' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // ── 1. Fetch coupon by code ─────────────────────────────────
    const { data: coupon, error: couponErr } = await supabase
      .from('coupons')
      .select('*')
      .eq('code', code.toUpperCase().trim())
      .eq('is_active', true)
      .single();

    if (couponErr || !coupon) {
      return new Response(
        JSON.stringify({ valid: false, error: 'الكود غير صالح أو غير موجود' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 2. Check expiry ─────────────────────────────────────────
    if (new Date(coupon.expiry_date) < new Date()) {
      return new Response(
        JSON.stringify({ valid: false, error: 'انتهت صلاحية هذا الكوبون' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 3. Check minimum order amount ───────────────────────────
    if (order_amount < Number(coupon.min_order_amount ?? 0)) {
      return new Response(
        JSON.stringify({
          valid: false,
          error: `الحد الأدنى للطلب هو ${coupon.min_order_amount} ج.م`,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 4. Check max uses ───────────────────────────────────────
    if (coupon.max_uses !== null) {
      const { count } = await supabase
        .from('coupon_usage')
        .select('*', { count: 'exact', head: true })
        .eq('coupon_id', coupon.id);

      if ((count ?? 0) >= coupon.max_uses) {
        return new Response(
          JSON.stringify({ valid: false, error: 'تم استنفاد الحد الأقصى لاستخدامات هذا الكوبون' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // ── 5. Check if user already used this coupon ───────────────
    const { data: existingUsage } = await supabase
      .from('coupon_usage')
      .select('id')
      .eq('user_id', user_id)
      .eq('coupon_id', coupon.id)
      .single();

    if (existingUsage) {
      return new Response(
        JSON.stringify({ valid: false, error: 'لقد استخدمت هذا الكوبون من قبل' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── 6. Calculate discount ────────────────────────────────────
    let discountAmount = 0;
    if (coupon.discount_type === 'percent') {
      discountAmount = Math.round((order_amount * Number(coupon.discount_amount)) / 100);
    } else {
      discountAmount = Math.min(Number(coupon.discount_amount), order_amount);
    }
    const finalPrice = Math.max(0, order_amount - discountAmount);

    // ── 7. Record usage in coupon_usage ──────────────────────────
    const { error: usageErr } = await supabase
      .from('coupon_usage')
      .insert({ user_id, coupon_id: coupon.id });

    if (usageErr) {
      console.error('Supabase: Failed to record coupon usage:', usageErr.message);
      // Still return valid — don't block user for DB write failure
    }

    return new Response(
      JSON.stringify({
        valid: true,
        coupon_id: coupon.id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_amount: discountAmount,
        final_price: finalPrice,
        description: coupon.description,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('validate-coupon error:', err);
    return new Response(
      JSON.stringify({ valid: false, error: err.message ?? 'خطأ في الخادم' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
