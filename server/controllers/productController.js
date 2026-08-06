import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import cloudinary from "../config/cloudinary.js";
import pool from "../database/db.js";
import { getAIRecommendation } from "../utils/getAIRecommendation.js";

//create product
export const createProduct = catchAsyncErrors(async (req, res, next) => {
    const {name, description, price, category, stock} = req.body;

    // id of the user creating product
    const created_by = req.user.id;

    //validate input
    if(!name || !description || !price || !category || stock == null){
        return next(new ErrorHandler("Please fill the required fields", 400));
    }

    //storing images
    let uploadedImages = [];
    //check if request contains uploaded files, image field
    if(req.files && req.files.images){
        //handling images
        const images = Array.isArray(req.files.images) 
        ? req.files.images   // handle single image     
        : [req.files.images] //handle multiples images

        for(const image of images){ //upload every image
            const result = await cloudinary.uploader.upload(image.tempFilePath, {
                folder: "Project1_images",
                width: 1000,
                crop: "scale",
            });
            // save image information 
            uploadedImages.push({
                url: result.secure_url,
                public_id: result.public_id,
            })
        }
    }

    //saving product details in database
    const product = await pool.query(`INSERT INTO products (name, description, price, category, stock, images, created_by) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`, [name, description, price, category, stock, JSON.stringify(uploadedImages), created_by]);

    //sending response
    res.status(201).json({
        success: true,
        message: "Product created successfully",
        product: product.rows[0],
    });
});

//fetch all products
export const fetchAllProducts = catchAsyncErrors(async (req, res, next) => {
    const {category, availability, price, ratings, search} = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const conditions = [];
    let values = [];
    let index = 1;

    let paginationPlaceholders = {};

    // filter products by availability
    if(availability === "in-stock"){
        conditions.push(`stock > 5`);
    }else if(availability === "limited"){
        conditions.push(`stock > 0 && stock <= 5`);
    }else if(availability === "out-of-stock"){
        conditions.push(`stock = 0`);
    }

    // filter products by price
    if(price){
        const [minPrice, maxPrice] = price.split("-");
        if(minPrice && maxPrice){
            conditions.push(`price BETWEEN $${index} AND $${index + 1}`);
            values.push(minPrice, maxPrice);
            index += 2;
        }
    }

    // filter products by category
    if(category){
        conditions.push(`category ILIKE $${index}`);
        values.push(`%${category}%`);
        index++;
    }

    // filter products by rating
    if(ratings){
        conditions.push(`ratings >= $${index}`);
        values.push(ratings);
        index++;
    }

    // add search query
    if(search){
        conditions.push(`(p.name ILIKE $${index} OR p.description ILIKE $${index})`);
        values.push(`%${search}%`);
        index++;
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

    //get count of filtered products
    const totalProductsResult = await pool.query(`SELECT COUNT(*) FROM products p ${whereClause}`, values);

    const totalProducts = parseInt(totalProductsResult.rows[0].count);

    paginationPlaceholders.limit = `$${index}`;
    values.push(limit);
    index++;

    paginationPlaceholders.offset = `$${index}`;
    values.push(offset);
    index++;

    // fetch with reviews
    const query = `
        SELECT p.*, 
        COUNT(r.id) AS review_count 
        FROM products p 
        LEFT JOIN reviews r 
        ON p.id = r.product_id
        ${whereClause}
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT ${paginationPlaceholders.limit}
        OFFSET ${paginationPlaceholders.offset}
    `;

    const result = await pool.query(query, values);

    // query for fetching new products
    const newProductsQuery = `
        SELECT p.*, 
        COUNT (r.id) as review_count
        FROM products p
        LEFT JOIN reviews r 
        ON p.id = r.product_id
        WHERE p.created_at >= NOW() - INTERVAL '30 days'
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT 8
    `;
    const newProductsResults = await pool.query(newProductsQuery);

    // query for fetching top rated products (rating >= 4.5)
    const topRatedQuery = `
        SELECT p.*, 
        COUNT (r.id) as review_count
        FROM products p
        LEFT JOIN reviews r 
        ON p.id = r.product_id
        WHERE p.ratings >= 4.5
        GROUP BY p.id
        ORDER BY p.created_at DESC
        LIMIT 8
    `;
    const topRatedResults = await pool.query(topRatedQuery);

    res.status(200).json({
        success: true,
        products: result.rows,
        totalProducts, 
        newProducts: newProductsResults.rows,
        topRatedProducts: topRatedResults.rows
    });
});

//update product
export const updateProduct = catchAsyncErrors(async (req, res, next) => {
    //get product id
    const {productId} = req.params;
    const {name, description, price, category, stock} = req.body;

    //validate input
    if(!name || !description || !price || !category || stock == null){
        return next(new ErrorHandler("Please fill the required fields", 400));
    }

    //finding product in db
    const product = await pool.query("SELECT * FROM products WHERE id = $1", [productId]);

    //if product not found
    if(product.rows.length === 0){
        return next(new ErrorHandler("Product not found.", 404));
    }

    //updating product
    const result = await pool.query(`
        UPDATE products
        SET name = $1, description = $2, price = $3, category = $4, stock = $5
        WHERE id = $6 RETURNING *
    `, [name, description, price, category, stock, productId]);

    res.status(200).json({
        success: true, 
        message: "Product updated successfully.",
        updateProduct: result.rows[0],
    });
});

//delete product
export const deleteProduct = catchAsyncErrors(async (req, res, next) => {
    const {productId} = req.params;

    //finding product in db
    const product = await pool.query("SELECT * FROM products WHERE id = $1", [productId]);

    //if product not found
    if(product.rows.length === 0){
        return next(new ErrorHandler("Product not found", 404));
    }

    //accessing images before deleting
    const images = product.rows[0].images;

    //delete product from db
    const result = await pool.query(`
        DELETE FROM products
        WHERE id = $1
        RETURNING *
    `, [productId]);

    //if failed to delete product
    if(result.rows.length === 0){
        return next(new ErrorHandler("Failed to delete product", 404));
    }

    //delete images form cloduinry
    if(images && images.length > 0){
        for(const image of images){
            await cloudinary.uploader.destroy(image.public_id);
        }
    }

    res.status(200).json({
        success: true, 
        message: "Product deleted successfully.",
        updateProduct: result.rows[0],
    });
});

//fetch single product
export const fetchSingleProduct = catchAsyncErrors(async (req, res, next) => {
    //product id from url
    const {productId} = req.params;

    const result = await pool.query(`
        SELECT p.*,
        COALESCE( 
        json_agg(
        json_build_object(
            'review_id', r.id,
            'rating', r.rating,
            'comment', r.comment,
            'reviewer', json_build_object(
                'id', u.id,
                'name', u.name,
                'avatar', u.avatar
            ))
        ) FILTER(WHERE r.id IS NOT NULL), '[]') AS reviews 
          FROM products p
          LEFT JOIN reviews r ON p.id = r.product_id
          LEFT JOIN users u ON r.user_id = u.id
          WHERE p.id = $1
          GROUP BY p.id
    `, [productId]);

    res.status(200).json({
        success: true,
        message: "Product fetched successfully",
        product: result.rows[0],
    })
});

//adding review
export const postProductReview = catchAsyncErrors(async (req, res, next) => {
    const {productId} = req.params;
    const {rating, comment} = req.body;

    // Validate rating
    if (!rating || rating < 1 || rating > 5) {
        return next(new ErrorHandler("Rating must be between 1 and 5", 400));
    }

    // Validate comment
    if (!comment || comment.trim() === "") {
        return next(new ErrorHandler("Please provide a comment", 400));
    }

    
    //checking if user has bought the product before reviwing
    const purchasedCheckQuery = `
        SELECT oi.product_id
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN payments p ON p.order_id = o.id
        WHERE o.buyer_id = $1
        AND oi.product_id = $2
        AND p.payment_status = 'Paid'
        LIMIT 1
    `;

    const {rows} = await pool.query(purchasedCheckQuery, [
        req.user.id, productId
    ]);

    if(rows.length === 0){
        return res.status(403).json({
            success: false,
            message: "You can only review product that you have purchased",
        });
    }

    //check product exists
    const product = await pool.query("SELECT id FROM products WHERE id = $1", [productId]);

    if(product.rows.length === 0){
        return res.status(409).json({
            success: false,
            message: "Product not found",
        });
    }

    //check if user already reviewed
    const existingReview = await pool.query(`
        SELECT * FROM reviews WHERE product_id = $1 AND user_id = $2    
    `, [productId, req.user.id]);

    if(existingReview.rows.length > 0){
        return res.status(404).json({
            success: false,
            message: "You have already reviewed",
        })
    }

    //insert review
    const review = await pool.query(`
        INSERT INTO reviews (rating, comment, product_id, user_id) 
        VALUES ($1, $2, $3, $4)
        RETURNING *    
    `, [rating, comment, productId, req.user.id]);

    const allReviews = await pool.query(`SELECT ROUND(AVG(rating), 2) AS avg_rating FROM reviews WHERE product_id = $1`, [productId]);

    const newAvgRating = allReviews.rows[0].avg_rating;

    const updatedProduct = await pool.query(`
        UPDATE products SET ratings = $1
        WHERE id = $2 RETURNING *    
    `, [newAvgRating, productId]);

    res.status(201).json({
        success: true,
        message: "Review added successfully",
        review: review.rows[0],
        product: updatedProduct.rows[0],
    });
});

//deleting review
export const deleteReview = catchAsyncErrors(async (req, res, next) => {
    const {productId} = req.params;
    
    const review = await pool.query("DELET FROM reviews WHERE product_id = $1 AND user_id = $2 RETURNING *", [productId, req.user.id]);

    if(review.rows.length === 0){
        return next(new ErrorHandler("Review not found.", 404));
    }

    const allReviews = await pool.query(`SELECT ROUND(AVG(rating), 2) AS avg_rating FROM reviews WHERE product_id = $1`, [productId]);

    const newAvgRating = allReviews.rows[0].avg_rating;

    const updatedProduct = await pool.query(`
        UPDATE products SET ratings = $1
        WHERE id = $2 RETURNING *    
    `, [newAvgRating, productId]);

    res.status(200).json({
        success: true,
        message: "Review deleted",
        review: review.rows[0],
        product: updateProduct.rows[0],
    });
});

//fetch filtered products using ai
export const fetchAIFilteredProducts = catchAsyncErrors(async (req, res, next) => {
    const {userPrompt} = req.body;

    if(!userPrompt){
        return next(new ErrorHandler("Provide a valid prompt", 400));
    }

    //extarcting meaningful keywords from users's prompt
    const filterKeywords = (query) => {
        //stop words that dont help in searching products
        const stopWords = new Set([
        "a", "an", "the",
        "i", "me", "my", "mine",
        "we", "our", "ours",
        "you", "your", "yours",
        "he", "him", "his",
        "she", "her", "hers",
        "it", "its",
        "they", "them", "their", "theirs",

        "is", "am", "are", "was", "were",
        "be", "been", "being",
        "do", "does", "did",
        "has", "have", "had",

        "and", "or", "but", "if", "then",
        "of", "to", "for", "from", "with",
        "in", "on", "at", "by", "as",
        "this", "that", "these", "those",
        "there", "here",
        "who", "whom", "whose",
        "what", "when", "where", "why", "how",

        "can", "could", "should", "would",
        "will", "shall", "may", "might", "must",

        "please", "want", "need", "looking", "find",
        "show", "give", "get", "search"
        ]);

        return [...new Set( //removes duplicate keywords
            query
                .toLowerCase()
                .replace(/[^\w\s]/g, " ") //remove punctuation
                .split(/\s+/) //split sentence into individual words 
                //keep only meaningful words
                .filter(word => 
                    word.length > 1 && 
                    !stopWords.has(word)
                )
        )].map(word => `%${word}%`); //convert each word into sql wildcard format
    };

    //generate sql search keywords from prompt
    const keywords = filterKeywords(userPrompt);

    //handle prompts containing only stop words
    if (keywords.length === 0) {
        return next(new ErrorHandler("Prompt is too vague.", 400));
    }

    //fetch all products matching the extracted keywords
    const result = await pool.query(`
        SELECT *FROM products
        WHERE name ILIKE ANY($1)
        OR description ILIKE ANY($1)
        OR category ILIKE ANY($1)
        LIMIT 200
    `, [keywords]);

    const filteredProducts = result.rows;

    //no matching product found
    if(filteredProducts.length === 0){
        return res.status(200).json({
            success: true,
            message: "No products found matching your prompt.",
            products: [],
        });
    }

    //Use AI to rank and refine the SQL-filtered products
    const {success, products} = await getAIRecommendation(
        req, 
        res, 
        userPrompt, 
        filteredProducts
    )

    //return ai filtered products
    res.status(200).json({
        success: true,
        message: "AI filtered products",
        products,
    });
});