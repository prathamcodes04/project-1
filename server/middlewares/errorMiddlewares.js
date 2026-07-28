//global error handler

//custom error class
class ErrorHandler extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
  }
}

export const errorMiddleware = (err, req, res, next) => {
  //default values
  err.message = err.message || "Internal server error";
  err.statusCode = err.statusCode || 500;

  //duplicate key
  if (err.code === 23505) {
    const message = `Duplicate field value entered`;
    err = new ErrorHandler(message, 400);
  }

  //jwt invalid
  if (err.name === "JsonWebTokenError") {
    const message = "JSON Web Token invalid, try again";
    err = new ErrorHandler(message, 400);
  }

  //jwt expired
  if (err.name === "TokenExpiredError") {
    const message = "JONS Web Token has expired, try again";
    err = new ErrorHandler(message, 400);
  }

  //validation errors - mutliple to one error message
  const errorMessage = err.errors
    ? Object.values(err.errors)
        .map((err) => err.message)
        .join(" ")
    : err.message;

  return res.status(err.statusCode).json({
    success: false,
    message: errorMessage,
  });
};

export default ErrorHandler;
