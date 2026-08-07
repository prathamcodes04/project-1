import stripe from "../config/stripe.js"
import pool from "../database/db.js";

export async function generatePayementIntent(orderId, totalPrice) {
   try {
      // create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
         amount: Math.round(totalPrice * 100),
         currency: "inr",
      });

      // save payment details
      await pool.query(
         `INSERT INTO payments
         (order_id, payment_type, payment_status, payment_intent_id)
         VALUES ($1, $2, $3, $4) RETURNING *`,
         [orderId, "Online", "Pending", paymentIntent.client_secret]
      );

      return {success: true, clientSecret: paymentIntent.id};
   } catch (error) {
      console.error("Payment error:", error.message || error);
      return {success: false, message: "Payment failed"};      
   }
}