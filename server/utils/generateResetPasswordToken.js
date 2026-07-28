import crypto from "crypto";

export const generateResetPasswordToken = () => {
  //geneate a secure random token
  const resetToken = crypto.randomBytes(20).toString("hex");

  //hash the token before storing it in database
  const hashedToken = crypto
    .createHash("sha256")
    .update(resetToken)
    .digest("hex");

  //token expires in 15 minutes
  const resetPasswordExpireTime = Date.now() + 15 * 60 * 1000;

  return { resetToken, hashedToken, resetPasswordExpireTime };
};
