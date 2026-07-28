// utils/jwtToken.js
import jwt from "jsonwebtoken";

export const sendToken = (user, statusCode, message, res) => {
    // Generate JWT
    const token = jwt.sign(
        { id: user.id },
        process.env.JWT_SECRET,
        {
            expiresIn: process.env.JWT_EXPIRES_IN,
        }
    );

    // Cookie Options
    const options = {
        expires: new Date(
            Date.now() + Number(process.env.COOKIE_MAX_AGE)
        ),
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: process.env.NODE_ENV === "production" ? "None" : "Lax",
    };

    res
        .status(statusCode)
        .cookie("token", token, options)
        .json({
            success: true,
            token,
            user,
            message,
        });
};
