import { z } from "zod";

export const userRegisterSchema = z.object({
  body: z.object({
    fullName: z
      .string({
        message: "Full name is required",
      })
      .optional(),
    email: z
      .string({
        message: "Email is required",
      })
      .email(),
    password: z
      .string({
        message: "Password is required",
      })
      .min(6),
    role: z.enum(["BUSINESS_OWNER", "SUPER_ADMIN", "MEMBER", "TRAINER"], {
      message: "Role is required",
    }),
  }),
});

export const userLoginSchema = z.object({
  body: z.object({
    email: z
      .string({
        message: "Email is required",
      })
      .email(),
    password: z
      .string({
        message: "Password is required",
      })
      .min(6),
  }),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        message: "Email is required",
      })
      .email(),
  }),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    email: z
      .string({
        message: "Email is required",
      })
      .email(),
    otp: z.string({
      message: "OTP is required",
    }),
    newPassword: z
      .string({
        message: "New password is required",
      })
      .min(6),
  }),
});


export const updateProfileSchema = z.object({
  body: z.object({
    fullName: z.string().optional(),
  }),
});

export const verifyEmailSchema = z.object({
  body: z.object({
    email: z
      .string({
        message: "Email is required",
      })
      .email(),
    otp: z.string({
      message: "OTP is required",
    }),
  }),
});

export const resendVerificationOtpSchema = z.object({
  body: z.object({
    email: z
      .string({
        message: "Email is required",
      })
      .email(),
  }),
});

export const updateUserProfileSchema = z.object({
  body: z.object({
    fullName: z.string().min(1).max(100).optional(),
    bio: z.string().max(300).optional(),
  }),
});
