import ErrorHandler from "../middlewares/errorMiddlewares.js";
import { catchAsyncErrors } from "../middlewares/catchAsyncError.js";
import pool from "../database/db.js";
import bcrypt from "bcrypt";
import { sendToken } from "../utils/jwtToken.js";
import { generateEmailTemplate } from "../utils/generateForgotPasswordEmailTemplate.js";
import { generateResetPasswordToken } from "../utils/generateResetPasswordToken.js";
import { sendMail } from "../utils/sendEmail.js";
import crypto from "crypto";
import cloudinary from "../config/cloudinary.js";

// console.log({
//   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
//   api_key: process.env.CLOUDINARY_API_KEY,
//   api_secret: process.env.CLOUDINARY_API_SECRET ? "Loaded" : "Missing",
// });

//register user
export const register = catchAsyncErrors(async (req, res, next) => {
  //getting input from user
  const { password } = req.body;
  const name = req.body.name?.trim();
  const email = req.body.email?.trim().toLowerCase();

  //check if all fields are provided
  if (!name || !email || !password) {
    return next(new ErrorHandler("Please fill all the fields", 400));
  }

  if(
        password.length < 8 || 
        password.length > 16
    ){
        return next(new ErrorHandler("Password must be between 8 and 16 characters", 400));
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
//   const { frontendUrl } = req.query;

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
//   if (!frontendUrl) {
//     return next(new ErrorHandler("Frontend URL is required.", 400));
//   }

  //create password reset url that will be sent to user
  const resetPasswordUrl =
    `${process.env.FRONTEND_URL}/password/reset/${resetToken}`;
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

//reset password
export const resetPassword = catchAsyncErrors(async(req, res, next) => {
    const {token} = req.params;

    const resetPasswordToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await pool.query(
        `SELECT * FROM users
        WHERE reset_password_token = $1 
        AND reset_password_expire > NOW()`,
    [resetPasswordToken]);

    if(user.rows.length === 0){
        return next(new ErrorHandler("Invalid or expired token", 400));
    }

    if(req.body.password !== req.body.confirmPassword){
        return next(new ErrorHandler("Passwords do not match", 400));
    }

    if(
        req.body.password?.length < 8 || 
        req.body.password?.length > 16 || 
        req.body.confirmPassword?.length < 8 || 
        req.body.confirmPassword?.length > 16
    ){
        return next(new ErrorHandler("Password must be between 8 and 16 characters", 400));
    }

    //hashing user password to store in database
    const hashedPassword = await bcrypt.hash(req.body.password, 10);

    //storing user pass in db
    const updatedUser = await pool.query(`
        UPDATE users SET password = $1, reset_password_token = NULL, reset_password_expire = NULL 
        WHERE id = $2 RETURNING *`, 
        [hashedPassword, user.rows[0].id]
    );

    //remove password before sending token
    delete updatedUser.rows[0].password;

    //login user after reset
    sendToken(updatedUser.rows[0], 200, "Password reset successfully", res);
});

//update password
export const updatePassword = catchAsyncErrors(async(req, res, next) => {
    const {currentPassword, newPassword, confirmNewPassword} = req.body;

    console.log(currentPassword, newPassword, confirmNewPassword);

    if(!currentPassword || !newPassword || !confirmNewPassword){
        return next(new ErrorHandler("Please provide all required fields", 400));
    }

    //matching password in db 
    const isPasswordMatch = await bcrypt.compare(
        currentPassword, 
        req.user.password
    );

    //if password doesent match
    if(!isPasswordMatch){
        return next(new ErrorHandler("Current password is incorrect", 401));
    }

    //new and current password doesent match
    if(newPassword !==  confirmNewPassword){
        return next(new ErrorHandler("New passwords do not match", 400));
    }

    //if matches
    if(
        newPassword.length < 8 || 
        newPassword.length > 16 || 
        confirmNewPassword.length < 8 || 
        confirmNewPassword.length > 16
    ){
        return next(new ErrorHandler("Password must be between 8 and 16 characters", 400));
    }

    //hashing new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    //updating new password in db
    await pool.query("UPDATE users SET password = $1 WHERE id = $2",
        [hashedPassword, req.user.id]
    );

    res.status(200).json({
        success: true,
        message: "Password updated successfully"
    });
})

//update profile
export const updateProfile = catchAsyncErrors(async (req, res, next) => {
    const { name, email } = req.body;

    if (!name || !email) {
        return next(new ErrorHandler("Please provide name and email.", 400));
    }

    if(name.trim().length === 0 || email.trim().length === 0){
        return next(new ErrorHandler("Nmae and email connot be empty", 400));
    }

    let avatarData = {};
    if (req.files && req.files.avatar) {
      const { avatar } = req.files;

      if (req.user?.avatar?.public_id) {
        await cloudinary.uploader.destroy(req.user.avatar.public_id);
      }

      let newProfileImage;
      try {
        newProfileImage = await cloudinary.uploader.upload(
          avatar.tempFilePath,
          {
            folder: "Project1_avatars",
            width: 150,
            crop: "scale",
          }
        );

        console.log("Upload Success:", newProfileImage);
      } catch (err) {
        console.log("Cloudinary Error:", err);
        return next(new ErrorHandler("Image upload failed", 502));
      }

      avatarData = {
        public_id: newProfileImage.public_id, //from cloudinary
        url: newProfileImage.secure_url, //from cloudinary
      };
    }

    let user;
    if (Object.keys(avatarData).length === 0) {
    user = await pool.query(
        "UPDATE users SET name = $1, email = $2 WHERE id = $3 RETURNING *",
        [name, email, req.user.id]
    );
} else {
  user = await pool.query(
    `UPDATE users
     SET name = $1,
       email = $2,
       avatar = $3
     WHERE id = $4
     RETURNING *`,
    [name, email, avatarData, req.user.id]
  );
}

    res.status(200).json({
        success: true,
        message: "Profile updated successfully",
        user: user.rows[0],
    });
});