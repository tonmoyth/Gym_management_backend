import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import httpStatus from "http-status";
import { uploadToS3 } from "../../utils/s3Upload";
import fs from "fs";
import { userService } from "./user.service";

const getProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await userService.getProfile(userId);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile fetched successfully",
    data: result,
  });
});

const updateProfile = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const userData = req.body;
  const file = req.file;

  if (file) {
    const imageUrl = await uploadToS3(
      file.path,
      "users/profile",
      file.mimetype,
    );
    userData.profileImage = imageUrl;
    fs.unlink(file.path, (err: any) => {
      if (err) console.error("Temp file cleanup error:", err.message);
    });
  }

  const result = await userService.updateProfile(userId, userData);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Profile updated successfully",
    data: result,
  });
});

export const userController = {
  getProfile,
  updateProfile,
};
