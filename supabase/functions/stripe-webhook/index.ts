import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, Stripe-Signature",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const stripeSecret = Deno.env.get("STRIPE_SECRET_KEY") ?? "";
  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") ?? "";
  const stripe = new Stripe(stripeSecret, { apiVersion: "2024-06-20" });

  try {
    const signature = req.headers.get("Stripe-Signature") ?? "";
    const rawBody = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(
        rawBody,
        signature,
        webhookSecret
      );
    } catch (err) {
      return new Response(
        JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const tripId = session.metadata?.trip_id;
        const amountTotal = session.amount_total ? session.amount_total / 100 : 0;

        if (!userId) break;

        // Record wallet transaction for the payment
        const { data: wallet } = await supabase
          .from("wallets")
          .select("id, balance")
          .eq("user_id", userId)
          .single();

        if (wallet) {
          const newBalance = (wallet.balance ?? 0) + amountTotal;
          await supabase.from("wallet_transactions").insert({
            wallet_id: wallet.id,
            user_id: userId,
            type: "credit",
            amount: amountTotal,
            balance: newBalance,
            description: tripId ? `دفع رحلة #${tripId}` : "شحن المحفظة",
            reference: session.id,
          });
          await supabase.from("wallets").update({ balance: newBalance }).eq("id", wallet.id);
        }

        // Update trip status if tripId present
        if (tripId) {
          await supabase
            .from("trips")
            .update({ payment_method: "card", updated_at: new Date().toISOString() })
            .eq("id", tripId);
        }
        break;
      }

      case "payment_intent.payment_failed": {
        const intent = event.data.object as Stripe.PaymentIntent;
        console.error("Payment failed:", intent.id, intent.last_payment_error?.message);
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err.message);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
