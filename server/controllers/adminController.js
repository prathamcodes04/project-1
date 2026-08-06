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
export const dashboardStats = catchAsyncErrors(async(req, res, next) => {})