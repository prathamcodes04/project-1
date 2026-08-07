import express from "express";
import { config } from "dotenv"; //loads .env
import cors from "cors"; //allow frontend request
import cookieParser from "cookie-parser"; //read cookie
import fileUpload from "express-fileupload"; //handles uploaded files
import { createTables } from "./utils/createTables.js";
import { errorMiddleware } from "./middlewares/errorMiddlewares.js";
import authRouter from "./router/authRoutes.js"
import productRouter from "./router/productRoutes.js"
import adminRouter from "./router/adminRoutes.js";
import Stripe from "stripe";


//load env variables
config({ path: "./config/config.env" });

const app = express();

//stripe instance
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

//configure cors
app.use(
  cors({
    //only these websites are allowed to access backend
    origin: [process.env.FRONTEND_URL, process.env.DASHBOARD_URL],
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true,
  }),
);

// stripe webhook endpoint
app.post(
   "/api/v1/payment/webhook", 
   express.raw({type:"application/json"}),
   async(req, res) => {
      // Stripe sends a signature header to verify that
      // the webhook request is genuinely from Stripe.
      const sig = req.headers["stripe-signature"];
      let event;
      try{
         // Verify webhook signature using the webhook secret.
         event = stripe.webhooks.constructEvent(
            req.body, 
            sig, 
            process.env.STRIPE_WEBHOOK_SECRET
         );
      }catch(error){
         return res.status(400).send(`Webhook error: ${error.message || error}`);
      }

      // Handle successful payment event
      if (event.type === "payment_intent.succeeded") {
         // const payementIntent_client_secret = event.data.object.client_secret;
         // Extract payment details from the event
         const paymentIntent = event.data.object;
         // Better to use the Payment Intent ID instead of client_secret
         const paymentIntentId = paymentIntent.id;
         try {
            // Mark payment as paid and retrieve its order_id
            const updatedPaymentStatus = "Paid";

            const payementTableUpdateResult = await pool.query(`
               UPDATE payements
               SET payment_status = $1
               WHERE payment_intend_id = $2
               RETURNING *
            `, [updatedPaymentStatus, paymentIntentId]);

            // Safety check
            if (paymentTableUpdateResult.rowCount === 0) {
               return res.status(404).send("Payment not found.");
            }

            // mark order as paid
            await pool.query(`
               UPDATE orders 
               SET paid_at = NOW() 
               WHERE id = $1 RETURNING *
            `, [payementTableUpdateResult.rows[0].order_id]);

            // get all ordered products
            const orderId = payementTableUpdateResult.rows[0].order_id;

            const {rows: orderedItems} = await pool.query(
               `SELECT product_id, quantity
               FROM order_items
               WHERE order_id = $1`
            , [orderId]);
            
            // Reduce stock of each purchased product
            for(const item of orderedItems){
               await pool.query(`
                  UPDATE products 
                  SET stock = stock - $1 
                  WHERE id = $2
               `, [item.quantity, item.product_id]);
            }
         } catch (error) {
            return res.status(500).send(`Error updating paid_at timestamp in orders table.`);
         }
      }

      // Acknowledge receipt of the webhook
      res.status(200).json({ received: true });
   }
);

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); //parse html forms

//file upload
app.use(
  fileUpload({
    useTempFiles: true,
    tempFileDir: "./uploads",
    limits: {
        fileSize: 5 * 1024 * 1024 //5 mb
    },
    abortOnLimit: true,
  }),
);

app.use("/api/v1/auth", authRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/admin", adminRouter);

createTables();

app.use(errorMiddleware);

export default app;