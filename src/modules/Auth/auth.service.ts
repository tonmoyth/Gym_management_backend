import { auth } from "../../lib/auth";
import { prisma } from "../../lib/prisma";
import { deleteFromS3 } from "../../utils/s3Upload";
import { IUserLogin, IUserRegistration } from "./auth.interface";
import AppError from "../../errors/AppError";
import httpStatus from "http-status";

const signUpEmail = async (userData: IUserRegistration) => {
  // Check if email already exists
  const existingEmail = await prisma.user.findUnique({
    where: {
      email: userData.email,
    },
  });

  if (existingEmail) {
    throw new AppError(httpStatus.CONFLICT, "Email already exists");
  }

  // Call Better Auth signUpEmail
  const result = await auth.api.signUpEmail({
    body: {
      email: userData.email,
      password: userData.password,
      name: userData.fullName,
      role: userData.role,
    },
  });

  return result;
};

const loginUser = async (payload: IUserLogin) => {
  const userResponse = await auth.api.signInEmail({
    body: {
      email: payload.email,
      password: payload.password,
    },
  });

  if (!userResponse || !userResponse.user) {
    throw new AppError(httpStatus.UNAUTHORIZED, "Invalid email or password");
  }

  return userResponse;
};

const logoutUser = async (headers: Headers, userId?: string) => {
  try {
    await auth.api.signOut({ headers });
  } catch (err) {
    // Ignore potential Better Auth errors
  }
};

const forgotPassword = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (user.isActive === false) {
    throw new AppError(httpStatus.FORBIDDEN, "Account is inactive");
  }

  const result = await auth.api.requestPasswordResetEmailOTP({
    body: {
      email,
    },
  });

  return result;
};

const resetPassword = async (payload: any) => {
  const { email, otp, newPassword } = payload;

  await auth.api.resetPasswordEmailOTP({
    body: {
      email,
      otp,
      password: newPassword,
    },
  });

  // Find user to delete sessions
  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (user) {
    await prisma.session.deleteMany({
      where: {
        userId: user.id,
      },
    });
  }
};

const sendVerificationOTP = async (email: string) => {
  await auth.api.sendVerificationOTP({
    body: {
      email: email.toLowerCase(),
      type: "email-verification",
    },
  });
};

const verifyEmailOTP = async (email: string, otp: string) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.isActive) {
    throw new AppError(httpStatus.FORBIDDEN, "Account is inactive");
  }

  if (user.isVerified && user.emailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already verified");
  }

  try {
    await auth.api.verifyEmailOTP({
      body: {
        email: email.toLowerCase(),
        otp,
      },
    });
  } catch (error: any) {
    throw new AppError(
      httpStatus.BAD_REQUEST,
      error.message || "Invalid or expired OTP",
    );
  }

  // Update User table after successful verification
  const updatedUser = await prisma.user.update({
    where: { email: email.toLowerCase() },
    data: {
      isVerified: true,
      emailVerified: true,
    },
  });

  return updatedUser;
};

const resendVerificationOTP = async (email: string) => {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  if (!user.isActive) {
    throw new AppError(httpStatus.FORBIDDEN, "Account is inactive");
  }

  if (user.isVerified && user.emailVerified) {
    throw new AppError(httpStatus.BAD_REQUEST, "User is already verified");
  }

  // Spam prevention: check if there's a verification request for this email in the last 60 seconds
  const lastVerification = await prisma.verification.findFirst({
    where: {
      identifier: email.toLowerCase(),
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  if (lastVerification) {
    const lastRequestTime = new Date(
      lastVerification.updatedAt || lastVerification.createdAt,
    ).getTime();
    const timeSinceLastOtp = Date.now() - lastRequestTime;
    const cooldownMs = 60 * 1000; // 60 seconds cooldown

    if (timeSinceLastOtp < cooldownMs) {
      const secondsRemaining = Math.ceil(
        (cooldownMs - timeSinceLastOtp) / 1000,
      );
      throw new AppError(
        httpStatus.TOO_MANY_REQUESTS,
        `Please wait ${secondsRemaining} seconds before requesting a new OTP.`,
      );
    }
  }

  await auth.api.sendVerificationOTP({
    body: {
      email: email.toLowerCase(),
      type: "email-verification",
    },
  });
};

const deleteAccount = async (userId: string) => {
  // 1. Find user to validate existence
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      memberProfile: true, // Needed to resolve MemberReferral restrictions
    }
  });

  if (!user) {
    throw new AppError(httpStatus.NOT_FOUND, "User not found");
  }

  // 3. Perform database deletions in transaction
  await prisma.$transaction(async (tx: any) => {
    // Delete Better Auth Sessions & Accounts
    await tx.session.deleteMany({ where: { userId } });
    await tx.account.deleteMany({ where: { userId } });

    // ---------------------------------------------------------
    // CRITICAL: Handle `onDelete: Restrict` constraints explicitly
    // ---------------------------------------------------------
    
    // Delete ProgressLogs logged by this user
    await tx.progressLog.deleteMany({ where: { loggedByUserId: userId } });
    
    // Delete Payments made by this user
    await tx.payment.deleteMany({ where: { payerUserId: userId } });
    
    // Delete MemberReferrals where this user was referred
    await tx.memberReferral.deleteMany({ where: { referredUserId: userId } });
    
    // Delete ChatMessages sent by this user
    await tx.chatMessage.deleteMany({ where: { senderId: userId } });
    
    // Delete BusinessReferrals referred by this user
    await tx.businessReferral.deleteMany({ where: { referrerOwnerId: userId } });

    // Delete MemberReferrals made by this user's MemberProfile
    if (user.memberProfile) {
       await tx.memberReferral.deleteMany({ where: { referrerMemberId: user.memberProfile.id } });
    }

    // Now it is safe to delete the User. 
    // All other relations (Business, MemberProfile, TrainerProfile, etc.) 
    // are configured with `onDelete: Cascade` and will be automatically cleaned up.
    await tx.user.delete({ where: { id: userId } });
  });

  // 4. Delete media from S3 (User Profile Image)
  // Note: If you need to clean up S3 files belonging to their businesses, 
  // you would query them before deletion and add them to this array.
  const s3Deletions: Promise<void>[] = [];

  if (user.profileImage) {
    s3Deletions.push(deleteFromS3(user.profileImage));
  }

  // Await all S3 deletions
  await Promise.allSettled(s3Deletions);
};

export const userService = {
  signUpEmail,
  loginUser,
  logoutUser,
  forgotPassword,
  resetPassword,
  sendVerificationOTP,
  verifyEmailOTP,
  resendVerificationOTP,
  deleteAccount,
};
