import { Request, Response } from "express";
import "multer";
import { catchAsync } from "../../shared/catchAsync";
import { userService } from "./auth.service";
import fs from "fs";
import { uploadToS3 } from "../../utils/s3Upload";
import { tokenUtils } from "../../utils/token";
import { cookieUtil } from "../../utils/cookie";
import sendResponse from "../../utils/sendResponse";
import httpStatus from "http-status";

const registerUser = catchAsync(async (req: Request, res: Response) => {
  const userData = req.body;
  const file = req.file;

  // if (file) {
  //     const imageUrl = await uploadToS3(file.path, 'users/profile', file.mimetype);
  //     userData.profileImage = imageUrl;
  //     fs.unlink(file.path, (err: any) => {
  //         if (err) console.error("Temp file cleanup error:", err.message);
  //     });
  // }

  const result = await userService.signUpEmail(userData);

  const { user } = result;

  const jwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  // const accessToken = tokenUtils.getToken(jwtPayload);

  // const refreshToken = tokenUtils.getRefreshToken(jwtPayload);

  // Set tokens in cookies
  // tokenUtils.setTokenCookie(res, accessToken);
  // tokenUtils.setRefreshTokenCookie(res, refreshToken);
  // tokenUtils.setBetterAuthSession(res, token);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "User registered successfully and OTP sent to email",
    data: result,
    // token: accessToken,
  });
});

const loginUser = catchAsync(async (req: Request, res: Response) => {
  const result = await userService.loginUser(req.body);
  const { user, token } = result;

  const jwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = tokenUtils.getToken(jwtPayload);
  const refreshToken = tokenUtils.getRefreshToken(jwtPayload);

  // Set tokens in cookies
  tokenUtils.setTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged in successfully",
    data: user,
    token: accessToken,
    refreshToken,
    // sessionToken: token,
  });
});

const logoutUser = catchAsync(async (req: Request, res: Response) => {
  // Call service to invalidate Better Auth session and clear FCM token
  await userService.logoutUser(req.headers as unknown as Headers, req.user?.id);

  // Clear authentication cookies
  cookieUtil.clearCookie(res, "accessToken", { path: "/" });
  cookieUtil.clearCookie(res, "refreshToken", { path: "/" });
  cookieUtil.clearCookie(res, "better-auth.session_token", { path: "/" });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User logged out successfully",
    data: null,
  });
});

const forgotPassword = catchAsync(async (req: Request, res: Response) => {
  const { email } = req.body;
  await userService.forgotPassword(email);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "OTP sent successfully",
    data: null,
  });
});

const resetPassword = catchAsync(async (req: Request, res: Response) => {
  await userService.resetPassword(req.body);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Password reset successfully",
    data: null,
  });
});

const verifyEmailOTP = catchAsync(async (req: Request, res: Response) => {
  const { email, otp } = req.body;

  const user = await userService.verifyEmailOTP(email, otp);

  const jwtPayload = {
    id: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = tokenUtils.getToken(jwtPayload);
  const refreshToken = tokenUtils.getRefreshToken(jwtPayload);

  // Set token in cookies
  tokenUtils.setTokenCookie(res, accessToken);
  tokenUtils.setRefreshTokenCookie(res, refreshToken);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Email verified successfully",
    data: user,
    token: accessToken,
    refreshToken,
  });
});

const resendVerificationOTP = catchAsync(
  async (req: Request, res: Response) => {
    const { email } = req.body;
    await userService.resendVerificationOTP(email);

    sendResponse(res, {
      statusCode: httpStatus.OK,
      success: true,
      message: "Verification OTP sent successfully",
      data: null,
    });
  },
);

const deleteAccount = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;

  // Delete user from database and S3
  await userService.deleteAccount(userId);

  // Call service to invalidate Better Auth session
  await userService.logoutUser(req.headers as unknown as Headers);

  // Clear authentication cookies
  cookieUtil.clearCookie(res, "accessToken", { path: "/" });
  cookieUtil.clearCookie(res, "refreshToken", { path: "/" });
  cookieUtil.clearCookie(res, "better-auth.session_token", { path: "/" });

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Account deleted successfully",
    data: null,
  });
});

export const userController = {
  registerUser,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword,
  verifyEmailOTP,
  resendVerificationOTP,
  deleteAccount,
};
