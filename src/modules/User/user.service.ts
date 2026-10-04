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
      permissions: true,
      createdAt: true,
      ownedBusinesses: {
        select: {
          id: true,
          name: true,
          status: true,
        },
        take: 1,
      },
      memberProfile: {
        select: {
          id: true,
        },
      },
      trainerProfile: {
        select: {
          id: true,
        },
      },
      staffRoles: {
        select: {
          id: true,
          businessId: true,
          permissionRole: true,
          business: {
            select: {
              id: true,
              name: true,
              status: true,
            },
          },
        },
        take: 1,
      },
    },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found or inactive");
  }

  const staffAssignment = user.staffRoles?.[0];
  const staffRole = staffAssignment?.permissionRole || null;
  const staffBusiness = staffAssignment?.business || null;

  const hasBusiness = Boolean(
    (user.ownedBusinesses && user.ownedBusinesses.length > 0) || staffBusiness
  );
  const isMemberOnboarded = Boolean(user.memberProfile);
  const isOnboarded =
    user.role === "BUSINESS_OWNER" || user.role === "STAFF"
      ? hasBusiness
      : user.role === "MEMBER"
      ? isMemberOnboarded
      : true;

  const isPlatformStaff =
    (user.role === "STAFF" || user.role === "ADMIN") &&
    (!user.staffRoles || user.staffRoles.length === 0);

  const { ownedBusinesses, memberProfile, trainerProfile, staffRoles, ...userRest } = user;

  return {
    user: {
      ...userRest,
      permissions: user.permissions || [],
      hasBusiness,
      isOnboarded,
      staffRole,
      staffBusiness,
      isPlatformStaff,
    },
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
