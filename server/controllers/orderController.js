import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import pool from "../database/db.js";
import { generatePayementIntent } from "../utils/generatePayementIntent";

// place new order
export const placeNewOrder = catchAsyncErrors(async (req, res, next) => {
    const {
        full_name,
        state,
        city,
        country,
        address,
        pincode,
        phone,
        orderedItems
    } = req.body;

    if(
        !full_name ||
        !state ||
        !city ||
        !country ||
        !address ||
        !pincode ||
        !phone
    ){
        return next(new ErrorHandler("Please provide complete shipping details.", 400));
    }

    const items = Array.isArray(orderedItems)
        ? orderedItems
        : JSON.stringify(orderedItems);
    
    if(!items || items.length === 0){
        return next(new ErrorHandler("No items in cart", 400));
    }

    const productIds = items.map(item => item.product.id);
    const {rows: products} = await pool.query(
        `SELECT id, price, stock, name
        FROM products
        WHERE id = ANY($1::uuid[])`, [productIds]
    );

    
    let total_price = 0;
    const values = [];
    const placeHolders = [];

    items.forEach((item, index) => {
        const product = products.find(p => p.id === item.product.id);

        if(!product){
            return next(new ErrorHandler(`Product not found for id: ${item.product.id}`, 404));
        }

        if(item.quantity > product.stock){
            return next(new ErrorHandler(`Only ${product.stock} units available for ${product.name}`, 400));
        }

        const itemTotal = product.price * item.quantity;
        total_price += itemTotal

        values.push(
            null, 
            product.id, 
            item.quantity, 
            product.price, 
            item.product.images[0].url || "", 
            product.name
        );

        const offset = index * 6;

        placeHolders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6})`);
    });

    const tax_price = 0.008;
    const shipping_price = 2;
    total_price = Math.round(total_price + total_price * tax_price + shipping_price);

    // create order
    const orderResult = await pool.query(
        `INSER INTO order
        (buyer_id, total_price, text_price, shipping_price)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
    [req.user.id, total_price, tax_price, shipping_price]);

    const orderId = orderResult.rows[0].id;

    for(let i = 0; i < values.length; i += 6){
        values[i] = orderId;
    }

    await pool.query(
        `INSERT INTO order_items
        (order_id, product_id, quantity, price, image, title)
        VALUES ${placeHolders.join(", ")} RETURNING *`
    , values);

    // shipping info 
    await pool.query(
        `INSERT INTO shipping_info
        (order_id, full_name, state, city, country, address, pincode, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`
    , [orderId, full_name, state, city, country, address, pincode, phone]);

    // generate payment intent
    // telling stripe that we want to pay
    const paymentResponse = await generatePayementIntent(orderId, total_price);

    if(!paymentResponse.success){
        return next(new ErrorHandler("Payment failed try again: ", 500));
    }

    res.status(200).json({
        success: true,
        message: "Order placed successfully, proceed to payment",
        paymentIntent: paymentResponse.clientSecret,
        total_price
    });
});

// fetch single order
export const fetchSingleOrder = catchAsyncErrors(async (req, res, next) => {})

// fetch my orders
export const fetchMyOrders = catchAsyncErrors(async (req, res, next) => {})

// fetch all orders
export const fetchAllOrders = catchAsyncErrors(async (req, res, next) => {})

// udpate order status
export const updateOrderStatus = catchAsyncErrors(async (req, res, next) => {})

// delete order
export const deleteOrder = catchAsyncErrors(async (req, res, next) => {})
