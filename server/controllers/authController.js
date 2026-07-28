import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import pool from "../database/db.js";
import bcrypt from "bcrypt";
import { sendToken } from "../utils/jwtToken.js";
import { generateEmailTemplate } from "../utils/generateForgotPasswordEmailTemplate.js";
import { generateResetPasswordToken } from "../utils/generateResetPasswordToken.js";
import { sendMail } from "../utils/sendEmail.js";

//register user
export const register = catchAsyncErrors(async (req, res, next) => {
  //getting input from user
  const { name, email, password } = req.body;

  //check if all fields are provided
  if (!name || !email || !password) {
    return next(new ErrorHandler("Please fill all the fields", 400));
  }

  //check if user already exists
  const existingUser = await pool.query(
    "SELECT * FROM USERS WHERE email = $1",
    [email],
  );

  if (existingUser.rows.length > 0) {
    return next(new ErrorHandler("User already exists", 409));
  }

  //hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  //insert user into database
  const result = await pool.query(
    `INSERT INTO USERS (name, email, password)
        VALUES ($1, $2, $3)
        RETURNING*`,
    [name, email, hashedPassword],
  );

  //get user
  const user = result.rows[0];

  //send response
  sendToken(user, 201, "User registered successfully", res);
});

//login user
export const login = catchAsyncErrors(async (req, res, next) => {
  //getting input from user
  const { email, password } = req.body;

  //validate input
  if (!email || !password) {
    return next(new ErrorHandler("Please provide email and password.", 400));
  }

  //find user
  const existingUser = await pool.query(
    "SELECT * FROM USERS WHERE email = $1",
    [email],
  );

  //if user not found
  if (existingUser.rows.length === 0) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  const user = existingUser.rows[0];

  //compare passwords
  const isPasswordMatched = await bcrypt.compare(password, user.password);

  if (!isPasswordMatched) {
    return next(new ErrorHandler("Invalid email or password", 401));
  }

  //remove password before sending response
  delete user.password;

  //send response
  sendToken(user, 200, "User logged successfully", res);
});

//get user
export const getUser = catchAsyncErrors(async (req, res, next) => {
  const { user } = req;
  res.status(200).json({
    success: true,
    user,
  });
});

//logout user
export const logout = catchAsyncErrors(async (req, res, next) => {
  res
    .status(200)
    .cookie("token", "", {
      expires: new Date(Date.now()),
      httpOnly: true,
    })
    .json({
      success: true,
      message: "Logged out successfully.",
    });
});

//forgot password
export const forgotPassword = catchAsyncErrors(async (req, res, next) => {
  //get user email and frontend url from query parameters
  const { email } = req.body;
  const { frontendUrl } = req.query;

  //check if user exists 
  const userResult = await pool.query(`SELECT * FROM users WHERE email = $1`, [
    email,
  ]);

  //if no user found
  if (userResult.rows.length === 0) {
    return next(new ErrorHandler("User not found with this email.", 404));
  }

  //store user details
  const user = userResult.rows[0];

  //generate original reset token (to send via mail), hashed token to store in database and token expiry time
  const { hashedToken, resetToken, resetPasswordExpireTime } =
    generateResetPasswordToken();

    //save hased token and expiry time in database
  await pool.query(
    `UPDATE users SET reset_password_token = $1, reset_password_expire = to_timestamp($2) WHERE email = $3`,
    [hashedToken, resetPasswordExpireTime / 1000, email],
  );

  //ensure frontend url is provided before creating reset link
  if (!frontendUrl) {
    return next(new ErrorHandler("Frontend URL is required.", 400));
  }

  //create password reset url that will be sent to user
  const resetPasswordUrl = `${frontendUrl}/password/reset/${resetToken}`;
  //generating html template
  const message = generateEmailTemplate(resetPasswordUrl);

  try {
    //send password reset email
    await sendMail({
      email: user.email,
      subject: "Project1 password recovery",
      message,
    });
    res.status(200).json({
      success: true,
      message: `Email sent to ${user.email} successfully.`,
    });
  } catch (error) {
    //if email sending fails, remove reset token and expiry from database
    await pool.query(
      `UPDATE users SET reset_password_token = NULL, reset_password_expire = NULL WHERE email = $1`,
      [email],
    );
    //forward error to global error handler
    return next(new ErrorHandler("Email could not be sent", 500));
  }
});
