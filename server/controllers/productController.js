import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import ErrorHandler from "../middlewares/errorMiddlewares.js";
import cloudinary from "../config/cloudinary.js";
import pool from "../database/db.js";

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


export const deleteProduct = catchAsyncErrors(async (req, res, next) => {});
export const fetchSingleProduct = catchAsyncErrors(async (req, res, next) => {});
export const postProductReview = catchAsyncErrors(async (req, res, next) => {});
export const deleteReview = catchAsyncErrors(async (req, res, next) => {});
export const fetchAllFilteredProducts = catchAsyncErrors(async (req, res, next) => {});