import AppError from "../../errors/AppError";
import { prisma } from "../../lib/prisma";
import httpStatus from "http-status";

import { deleteFromS3 } from "../../utils/s3Upload";

const getProfile = async (userId: string) => {
  // 1. Fetch user info
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      fullName: true,
      email: true,
      profileImage: true,
      role: true,
      isVerified: true,
      createdAt: true,
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found or inactive");
  }

  return {
    user,
  };
};

const updateProfile = async (userId: string, payload: any) => {
  // Remove fields that shouldn't be updated
  const { email, role, isVerified, password, ...updateData } = payload;

  // Check if user exists and is active
  const user = await prisma.user.findUnique({
    where: { id: userId, isActive: true },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found or inactive");
  }

  // If new profileImage is provided, delete the old one
  if (
    updateData.profileImage &&
    user.profileImage &&
    updateData.profileImage !== user.profileImage
  ) {
    await deleteFromS3(user.profileImage);
  }

  // Perform the update
  const updatedUser = await prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true,
      fullName: true,
      email: true,
      profileImage: true,
      isVerified: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return updatedUser;
};

export const userService = {
  getProfile,
  updateProfile,
};
