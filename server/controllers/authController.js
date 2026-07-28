import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import pool from "../database/db.js";
import bcrypt from "bcrypt";
import { sendToken } from "../utils/jwtToken.js";

//register user
export const register = catchAsyncErrors(async (req, res, next) => {
    //getting input from user
    const {name, email, password} = req.body;

    //check if all fields are provided
    if(!name || !email || !password){
        return next(new ErrorHandler("Please fill all the fields", 400))
    }

    //check if user already exists
    const existingUser = await pool.query(
        "SELECT * FROM USERS WHERE email = $1",
        [email]
    );

    if(existingUser.rows.length > 0){
        return next(new ErrorHandler("User already exists", 409));
    }

    //hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    //insert user into database
    const result = await pool.query(
        `INSERT INTO USERS (name, email, password)
        VALUES ($1, $2, $3)
        RETURNING*`,
        [name, email, hashedPassword]
    );

    //get user
    const user = result.rows[0];

    //send response
    sendToken(user, 201, "User registered successfully", res);
});

//login user
export const login = catchAsyncErrors(async (req, res, next) => {
    //getting input from user
    const {email, password} = req.body;

    //validate input
    if(!email || !password){
        return next(new ErrorHandler("Please provide email and password.", 400))
    }

    //find user
    const existingUser = await pool.query(
        "SELECT * FROM USERS WHERE email = $1",
        [email]
    );

    //if user not found
    if(existingUser.rows.length === 0){
        return next(new ErrorHandler("Invalid email or password", 401));
    }

    const user = existingUser.rows[0];

    //compare passwords
    const isPasswordMatched = await bcrypt.compare(
        password,
        user.password
    );

    if(!isPasswordMatched){
        return next(new ErrorHandler("Invalid email or password", 401));
    }

    //remove password before sending response
    delete user.password;

    //send response
    sendToken(user, 200, "User logged successfully", res);
});

//logout user
export const logout = catchAsyncErrors(async (req, res, next) => {
    //getting input from user
    const {name, email, password} = req.body;

    //check if all fields are provided
    if(!name || !email || !password){
        return next(new ErrorHandler("Please fill all the fields", 400))
    }

    //check if user already exists
    const existingUser = await pool.query(
        "SELECT * FROM USERS WHERE email = $1",
        [email]
    );

    if(existingUser.rows.length > 0){
        return next(new ErrorHandler("User already exists", 409));
    }

    //hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    //insert user into database
    const result = await pool.query(
        `INSERT INTO USERS (name, email, password)
        VALUES ($1, $2, $3)
        RETURNING*`,
        [name, email, hashedPassword]
    );

    //send response
    sendToken(user.rows[0], 201, "User registered successfully", res);
});

//get user
export const getUser = catchAsyncErrors(async (req, res, next) => {
    //getting input from user
    const {name, email, password} = req.body;

    //check if all fields are provided
    if(!name || !email || !password){
        return next(new ErrorHandler("Please fill all the fields", 400))
    }

    //check if user already exists
    const existingUser = await pool.query(
        "SELECT * FROM USERS WHERE email = $1",
        [email]
    );

    if(existingUser.rows.length > 0){
        return next(new ErrorHandler("User already exists", 409));
    }

    //hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    //insert user into database
    const result = await pool.query(
        `INSERT INTO USERS (name, email, password)
        VALUES ($1, $2, $3)
        RETURNING*`,
        [name, email, hashedPassword]
    );

    //send response
    sendToken(user.rows[0], 201, "User registered successfully", res);
});
