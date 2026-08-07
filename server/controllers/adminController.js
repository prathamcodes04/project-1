import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import pool from "../database/db.js";
import {v2 as cloudinary} from "cloudinary";

//get all users with pagination (excluding admins)
export const getAllUsers = catchAsyncErrors(async(req, res, next) => {
    //get requested page number
    const page = parseInt(req.query.page) || 1;

    //fetch total number of users
    const totalUsersResult = await pool.query(
        "SELECT COUNT(*) FROM users WHERE role = $1", ["User"]
    );

    const totalUsers = parseInt(totalUsersResult.rows[0].count);

    //calculate number of pages to skip
    const offset = (page - 1) * 10;

    //fetch users for current page  
    const users = await pool.query(
        "SELECT * FROM users WHERE role = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3", ["User", 10, offset]
    );

    //return paginated users
    res.status(200).json({
        success: true,
        totalUsers,
        currentPage: page,
        users: users.rows,
    });
});

//delete a user by id
export const deleteUser = catchAsyncErrors(async(req, res, next) => {
    const {id} = req.params;

    //delete user and return the record
    const deleteUser = await pool.query(
        "DELETE FROM users WHERE id = $1 RETURNING *", [id]
    );

    if(deleteUser.rows.length === 0){
        return next(new ErrorHandler("User not found", 404));
    }

    //deleting users avatar from cloudinary
    const avatar = deleteUser.rows[0].avatar;
    if(avatar?.public_id){
        await cloudinary.uploader.destroy(avatar.public_id);
    }

    res.status(200).json({
        success: true,
        message: "User successfully deleted",
        user: deleteUser.rows[0]
    });
});

//dashboard stats
export const dashboardStats = catchAsyncErrors(async(req, res, next) => {
    // get today's and yesterday's date
    const today = new Date();
    const todayDate = today.toISOString().split("T")[0];

    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayDate = yesterday.toISOString().split("T")[0];

    // current month start date
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

    // previoud month start and end dates
    const previousMonthStart = new Date(today.getFullYear(), today.getMonth() - 1);
    const previousMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);


    // total revenue (all time)
    const totalRevenueAllTimeQuery = await pool.query(`
        SELECT SUM(total_price) FROM orders
    `);
    // if no orders exist, default to 0
    const totalRevenueAllTime = parseFloat(totalRevenueAllTimeQuery.rows[0].sum) || 0;


    // total registered users
    const totalUsersCountQuery = await pool.query(
        "SELECT COUNT(*) FROM users WHERE role = 'User'"
    );
    const totalUsersCount = parseInt(totalUsersCountQuery.rows[0].count) || 0;


    // count order by status (Processing, Shipped, Delivered, Cancelled)
    const orderStatusCountsQuery = await pool.query(`
        SELECT order_status, COUNT(*)
        FROM orders
        GROUP BY order_status
    `);

    //initialize all statuses with 0
    const orderStatusCounts = {
        Processing: 0,
        Shipped: 0,
        Delivered: 0,
        Cancelled: 0,
    };

    // fill actual counts from database
    orderStatusCountsQuery.rows.forEach((row) => {
        orderStatusCounts[row.order_status] = parseInt(row.count);
    })


    //today's revenue
    const todayRevenueQuery = await pool.query(
        "SELECT SUM(total_price) FROM orders WHERE created_at::date = $1", [todayDate]
    );

    const todayRevenue = parseFloat(todayRevenueQuery.rows[0].sum) || 0;


    //yesterday's revenue
    const yesterdayRevenueQuery = await pool.query(
        "SELECT SUM(total_price) FROM orders WHERE created_at::date = $1", [yesterdayDate]
    );

    const yesterdayRevenue = parseFloat(yesterdayRevenueQuery.rows[0].sum) || 0;


    // monthly sales data
    // used for line chart
    const monthlySalesQuery = await pool.query(
        `SELECT TO_CHAR(created_at, 'Mon YYYY') AS month,
        DATE_TRUNC('month', created_at) as date,
        SUM(total_price) as totalSales
        FROM orders
        GROUP BY month, date
        ORDER BY date ASC
    `);
    
    // convert query result into frontend-friendly format
    const monthlySales = monthlySalesQuery.rows.map(row => ({
        month: row.month,
        totalSales: parseFloat(row.totalSales) || 0,
    }));


    //top 5 most best selling products
    const topSellingProductsQuery = await pool.query(`
        SELECT p.name, 
        p.images->0->>'url' AS image,
        p.category,
        p.ratings,
        SUM(oi.quantity) AS total_sold
        FROM order_items oi
        JOIN products p ON p.id =  oi.product_id
        GROUP BY p.name, p.images, p.category, p.ratings
        ORDER BY total_sold DESC
        LIMIT 5
    `);

    const topSellingProducts = topSellingProductsQuery.rows;


    //current month revenue
    const currentMonthSalesQuery = await pool.query(`
        SELECT SUM(total_price) AS total
        FROM orders
        WHERE created_at >= $1
        AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
    `, [currentMonthStart]);

    const currentMonthSales = parseFloat(currentMonthSalesQuery.rows[0].total) || 0;


    //low stock products (stock <= 5)
    const lowStockProductsQuery = await pool.query(`
       SELECT name, stock FROM products WHERE stock <= 5 
    `);

    const lowStockProducts = lowStockProductsQuery.rows;


    //last month revenue
    //used to calculate growth percentage (%)
    const lastMonthRevenueQuery = await pool.query(`
        SELECT SUM(total_price) AS total
        FROM orders
        WHERE created_at BETWEEN $1 AND $2
    `, [previousMonthStart, previousMonthEnd]);

    const lastMonthRevenue = parseFloat(lastMonthRevenueQuery.rows[0].total) || 0;


    //revenue growth rate
    //formula: ((current - previous ) / previoud) * 100
    let revenueGrowthRate = "0%";

    if(lastMonthRevenue > 0){
        const growthRate = ((currentMonthSales - lastMonthRevenue) / lastMonthRevenue) * 100;
        revenueGrowthRate = `${growthRate >= 0 ? "+" : ""}${growthRate.toFixed(2)}%`;
    }


    // new users joined this month
    const newUsersThisMonthQuery = await pool.query(`
       SELECT COUNT(*) FROM users WHERE created_at >= $1 
    `, [currentMonthStart]);

    const newUsersThisMonth = parseInt(newUsersThisMonthQuery.rows[0].count) || 0;


    //send dashboard statistics
    res.status(200).json({
        success: true,
        message: "Dashboard stats fetched successfully",
        totalRevenueAllTime,
        todayRevenue,
        yesterdayRevenue,
        totalUsersCount,
        orderStatusCounts,
        monthlySales,
        currentMonthSales,
        topSellingProducts,
        lowStockProducts,
        revenueGrowthRate,
        newUsersThisMonth,
    });
});