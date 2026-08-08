import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import pool from "../database/db.js";
import { generatePayementIntent } from "../utils/generatePayementIntent.js";

// place new order
export const placeNewOrder = catchAsyncErrors(async (req, res, next) => {
    // extract shipping and cart details from request body
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

    // ensure orderedItems is an array
    const items = Array.isArray(orderedItems)
        ? orderedItems
        : [];
    
    // check whether cart contains any items
    if(!items || items.length === 0){
        return next(new ErrorHandler("No items in cart", 400));
    }

    // extract product ids from ordered items
    const productIds = items.map(item => item.product.id);

    // fetch all products from db 
    const {rows: products} = await pool.query(
        `SELECT id, price, stock, name
        FROM products
        WHERE id = ANY($1::uuid[])`, [productIds]
    );

    
    let total_price = 0;
    // array used to prepare bulk insertion of order items
    const values = [];
    const placeHolders = [];

    //validate products, check stock and calculate order total
    items.forEach((item, index) => {
        const product = products.find(p => p.id === item.product.id);

        // check whether product exists
        if(!product){
            return next(new ErrorHandler(`Product not found for id: ${item.product.id}`, 404));
        }

        // check whether enough stock is available
        if(item.quantity > product.stock){
            return next(new ErrorHandler(`Only ${product.stock} units available for ${product.name}`, 400));
        }

        // caculate total price using the current db price
        const itemTotal = product.price * item.quantity;
        total_price += itemTotal

        // prepare values for order_items bulk insertion
        values.push(
            null, // order id will be replaced later
            product.id, 
            item.quantity, 
            product.price, 
            item.product.images[0].url || "", 
            product.name
        );

        // cgenerate $1, $2, $3... placeholders for the bulk insert query
        const offset = index * 6;

        placeHolders.push(
            `($${offset + 1}, $${offset + 2}, $${offset + 3}, 
            $${offset + 4}, $${offset + 5}, $${offset + 6})`
        );
    });

    // calculate tax and shipping charges
    const tax_price = 0.008;
    const shipping_price = 2;

    total_price = Math.round(
        total_price + 
        total_price * tax_price 
        + shipping_price
    );

    // create the main order record
    const orderResult = await pool.query(
        `INSERT INTO orders (buyer_id, total_price, tax_price, shipping_price)
        VALUES ($1, $2, $3, $4)
        RETURNING *`,
        [
            req.user.id, 
            total_price, 
            tax_price, 
            shipping_price
        ]
    );

    const orderId = orderResult.rows[0].id;

    // replace temporary order_id values with the actual order ID
    for(let i = 0; i < values.length; i += 6){
        values[i] = orderId;
    }

    // insert all ordered products into order_items
    await pool.query(
        `INSERT INTO order_items 
        (order_id, product_id, quantity, price, image, title)
        VALUES ${placeHolders.join(", ")} 
        RETURNING *`, 
        values
    );

    // save customers shipping information
    await pool.query(
        `INSERT INTO shipping_info
        (order_id, full_name, state, city, country, address, pincode, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *`
    , [orderId, full_name, state, city, country, address, pincode, phone]);

    // generate stripe payment intent for the order
    // telling stripe that we want to pay
    const paymentResponse = await generatePayementIntent(orderId, total_price);

    // handle payment intent creation failure
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
export const fetchSingleOrder = catchAsyncErrors(async (req, res, next) => {
    // get order id from request parameters
    const {orderId} = req.params;

    // fetch order details along with its items and shipping information
    const result = await pool.query(
        `SELECT
            o.*,
            -- combine all order items into a JSON array
            COALESCE(
                json_agg(
                    json_build_object(
                        'order_item_id', oi.id,
                        'order_id', oi.order_id,
                        'product_id', oi.product_id,
                        'quantity', oi.quantity,
                        'price', oi.price
                    )
                ) FILTER (WHERE oi.id IS NOT NULL), '[]'
            ) AS order_items,

            -- create a json object containing shipping information
            json_build_object(
                'full_name', s.full_name,
                'state', s.state,
                'city', s.city,
                'country', s.country,
                'address', s.address,
                'pincode', s.pincode,
                'phone', s.phone
            ) AS shipping_info
        FROM orders o
        -- join order items belonging to this order
        LEFT JOIN order_items oi ON o.id = oi.order_id
        --  join shipping information belonging to this order
        LEFT JOIN shipping_info s ON o.id = s.order_id
        -- fetch only requested order
        WHERE o.id = $1
        -- required because aggregate function are being used
        GROUP BY o.id, s.id;`
    , [orderId]);

    // send fetch order to the client
    res.status(200).json({
        success: true,
        message: "Order fetched",
        order: result.rows[0],
    });
});

// fetch my orders
export const fetchMyOrders = catchAsyncErrors(async (req, res, next) => {
    const result = await pool.query(
        `SELECT o.*, COALESCE(
            json_agg(
                json_build_object(
                    'order_item_id', oi.id,
                    'order_id', oi.order_id,
                    'product_id', oi.product_id,
                    'quantity', oi.quantity,
                    'price', oi.price,
                    'image', oi.image,
                    'title', oi.title
                )
            ) FILTER (WHERE oi.id IS NOT NULL), '[]'
            ) AS order_items,
                json_build_object(
                    'full_name', s.full_name,
                    'state', s.state,
                    'city', s.city,
                    'country', s.country,
                    'address', s.address,
                    'pincode', s.pincode,
                    'phone', s.phone
                ) AS shipping_info
            FROM orders o
            LEFT JOIN order_items oi ON o.id = oi.order_id
            LEFT JOIN shipping_info s ON o.id = s.order_id
        WHERE o.buyer_id = $1
        GROUP BY o.id, s.id
        `
    , [req.user.id]);

    res.status(200).json({
        success: true,
        message: "Orders fetched",
        orders: result.rows,
    })
})

// fetch all orders
export const fetchAllOrders = catchAsyncErrors(async (req, res, next) => {
    const result = await pool.query(
        `SELECT o.*,
        COALESCE(
            json_agg(
                json_build_object(
                    'order_item_id', oi.id,
                    'order_id', oi.order_id,
                    'product_id', oi.product_id,
                    'quantity', oi.quantity,
                    'price', oi.price,
                    'image', oi.image,
                    'title', oi.title
                )
            ) FILTER (WHERE oi.id IS NOT NULL),
            '[]'
        ) AS order_items,
        json_build_object(
            'full_name', s.full_name,
            'state', s.state,
            'city', s.city,
            'country', s.country,
            'address', s.address,
            'pincode', s.pincode,
            'phone', s.phone
        ) AS shipping_info
        FROM orders o
        LEFT JOIN order_items oi ON o.id = oi.order_id
        LEFT JOIN shipping_info s ON o.id = s.order_id
        GROUP BY o.id, s.id`
    );

    res.status(200).json({
        success: true,
        message: "All orders fetched",
        orders: result.rows,
    })
})

// udpate order status
export const updateOrderStatus = catchAsyncErrors(async (req, res, next) => {})

// delete order
export const deleteOrder = catchAsyncErrors(async (req, res, next) => {})
