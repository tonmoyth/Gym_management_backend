import express from "express";
import { userController } from "./auth.controller";
import { upload } from "../../middlewares/upload";
import validateRequest from "../../middlewares/validateRequest";
import {
  userRegisterSchema,
  userLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
  resendVerificationOtpSchema,
  updateUserProfileSchema,
} from "./auth.validation";
import { checkAuth } from "../../middlewares/checkAuth";

const router = express.Router();

router.post(
  "/register",
  // upload.single("profileImage"),
  // (req, res, next) => {
  //     if (req.body.data) {
  //         req.body = JSON.parse(req.body.data);
  //     }
  //     next();
  // },
  validateRequest(userRegisterSchema),
  userController.registerUser,
);

router.post(
  "/login",
  validateRequest(userLoginSchema),
  userController.loginUser,
);

router.post("/logout", checkAuth(), userController.logoutUser);

router.post(
  "/forgot-password",
  validateRequest(forgotPasswordSchema),
  userController.forgotPassword,
);

router.post(
  "/reset-password",
  validateRequest(resetPasswordSchema),
  userController.resetPassword,
);

router.post(
  "/verify-email",
  validateRequest(verifyEmailSchema),
  userController.verifyEmailOTP,
);

router.post(
  "/resend-verification-otp",
  validateRequest(resendVerificationOtpSchema),
  userController.resendVerificationOTP,
);

router.delete("/delete-account", checkAuth(), userController.deleteAccount);

export const authRoutes = router;
