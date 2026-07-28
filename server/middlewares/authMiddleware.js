import jwt from "jsonwebtoken";
import {catchAsyncErrors} from "./catchAsyncError.js";
import ErrorHandler from "./errorMiddlewares.js";
import pool from "../database/db.js"

export const isAuthenticated = catchAsyncErrors(async(req, res, next) => {
    //get token from cookies
    const {token} = req.cookies;

    if(!token){
        return next(new ErrorHandler("Please login first", 401));
    }

    //verify jwt
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    //get user id
    const user = await pool.query("SELECT * FROM users WHERE id = $1 LIMIT 1",
        [decoded.id]
    );

    req.user = user.rows[0];
    next();
})

export const authorizedRoles = (...roles) => {
    return (req, res, next) => {
        if(!roles.includes(req.user.role)){
            return next(
                new ErrorHandler(
                    `Role: ${req.user.role} is not allowed to access this resource.`,
                    403
                )
            );
        }
        next();
    }
}