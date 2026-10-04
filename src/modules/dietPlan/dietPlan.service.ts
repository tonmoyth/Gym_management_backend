import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { pushJob } from "../../utils/redisQueue";

interface IMealFood {
  name: string;
  quantity: string;
}

interface IMeal {
  mealType: string;
  time: string;
  foods: IMealFood[];
}

interface ICreateDietPlanPayload {
  memberId: string;
  businessId: string;
  title: string;
  goal?: string;
  dailyCalories: number;
  startDate: Date;
  endDate?: Date;
  notes?: string;
  meals: IMeal[];
}

const createDietPlan = async (trainerUserId: string, payload: ICreateDietPlanPayload) => {
  const {
    memberId,
    businessId,
    title,
    goal,
    dailyCalories,
    startDate,
    endDate,
    notes,
    meals,
  } = payload;

  // 1. Trainer Profile
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId: trainerUserId },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  // 2. Member Profile
  let memberProfile = await prisma.memberProfile.findFirst({
    where: {
      OR: [
        { id: memberId },
        { userId: memberId }
      ]
    },
  });

  if (!memberProfile) {
    const user = await prisma.user.findUnique({ where: { id: memberId } });
    if (!user) {
      throw new AppError(404, "Member user not found.");
    }
    memberProfile = await prisma.memberProfile.create({
      data: { userId: user.id },
    });
  }

  // 3. Business
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError(404, "Business not found.");
  }

  // 4. Verify Trainer belongs to Business
  const trainerBusiness = await prisma.trainerBusiness.findUnique({
    where: {
      trainerId_businessId: {
        trainerId: trainerProfile.id,
        businessId: businessId,
      },
    },
  });

  if (!trainerBusiness) {
    throw new AppError(403, "Trainer is not assigned to this business.");
  }

  // 5. Verify Trainer is assigned to this Member (via class booking or active gym membership)
  const isAssigned =
    (await prisma.classBooking.findFirst({
      where: {
        memberId: memberProfile.id,
        classSchedule: {
          trainerId: trainerProfile.id,
          businessId: businessId,
        },
      },
    })) ||
    (await prisma.membership.findFirst({
      where: {
        memberId: memberProfile.id,
        businessId: businessId,
        status: "ACTIVE",
      },
    }));

  if (!isAssigned) {
    throw new AppError(403, "Trainer is not assigned to this member.");
  }

  // 6. Prisma Transaction
  const dietPlan = await prisma.$transaction(async (tx) => {
    // Check if there is an active diet plan for this trainer-member-business combination
    const existingPlan = await tx.dietPlan.findFirst({
      where: {
        trainerId: trainerProfile.id,
        memberId: memberProfile.id,
        businessId: businessId,
      },
    });

    const content = {
      title,
      goal,
      dailyCalories,
      macros: (payload as any).macros || (payload as any).content?.macros || null,
      startDate,
      endDate,
      notes,
      meals,
    };

    if (existingPlan) {
      return tx.dietPlan.update({
        where: { id: existingPlan.id },
        data: {
          content: content as any,
        },
      });
    }

    return tx.dietPlan.create({
      data: {
        trainerId: trainerProfile.id,
        memberId: memberProfile.id,
        businessId: businessId,
        content: content as any,
      },
    });
  });

  // 7. Publish Redis Event
  pushJob("notification_queue", {
    eventType: "DIET_PLAN_UPDATED",
    type: "DIET_PLAN",
    title: "Diet Plan Created",
    body: "Your trainer has created your diet plan.",
    memberId: memberProfile.id,
    trainerId: trainerProfile.id,
    businessId: businessId,
    dietPlanId: dietPlan.id,
  });

  return dietPlan;
};

const updateDietPlan = async (trainerUserId: string, dietPlanId: string, payload: Partial<ICreateDietPlanPayload>) => {
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId: trainerUserId },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  const existingPlan = await prisma.dietPlan.findUnique({
    where: { id: dietPlanId },
  });

  if (!existingPlan) {
    throw new AppError(404, "Diet plan not found.");
  }

  if (existingPlan.trainerId !== trainerProfile.id) {
    throw new AppError(403, "You do not have permission to update this diet plan.");
  }

  const updatedContent = {
    ...(existingPlan.content as object),
    ...payload,
  };

  const dietPlan = await prisma.dietPlan.update({
    where: { id: dietPlanId },
    data: {
      content: updatedContent as any,
    },
  });

  pushJob("notification_queue", {
    eventType: "DIET_PLAN_UPDATED",
    type: "DIET_PLAN",
    title: "Diet Plan Updated",
    body: "Your trainer has updated your diet plan.",
    memberId: dietPlan.memberId,
    trainerId: dietPlan.trainerId,
    businessId: dietPlan.businessId,
    dietPlanId: dietPlan.id,
  });

  return dietPlan;
};

const getMemberDietPlan = async (trainerUserId: string, memberId: string) => {
  // 1. Trainer Profile
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId: trainerUserId },
    include: { user: { select: { fullName: true } } },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  // Verify Member exists (to return better error if they don't)
  let memberProfile = await prisma.memberProfile.findFirst({
    where: {
      OR: [
        { id: memberId },
        { userId: memberId }
      ]
    },
    include: { user: { select: { fullName: true } } },
  });

  if (!memberProfile) {
    const user = await prisma.user.findUnique({ where: { id: memberId } });
    if (!user) {
      throw new AppError(404, "Member user not found.");
    }
    const newProfile = await prisma.memberProfile.create({
      data: { userId: user.id },
    });
    
    // Fetch it again to include the user relation
    memberProfile = await prisma.memberProfile.findUnique({
      where: { id: newProfile.id },
      include: { user: { select: { fullName: true } } },
    });

    if (!memberProfile) {
      throw new AppError(500, "Failed to fetch created member profile");
    }
  }

  // 2. Verify Assignment
  const isAssigned = await prisma.classBooking.findFirst({
    where: {
      memberId: memberProfile.id,
      classSchedule: {
        trainerId: trainerProfile.id,
      },
    },
  });

  if (!isAssigned) {
    throw new AppError(403, "Trainer is not assigned to this member.");
  }

  // 3. Find Active Diet Plan
  const dietPlan = await prisma.dietPlan.findFirst({
    where: {
      memberId: memberProfile.id,
      // The prompt asks for "latest ACTIVE diet plan".
      // Assuming "latest" means order by updatedAt desc.
      // If there's only one per trainer-member-business, this is fine.
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      trainer: { include: { user: { select: { fullName: true } } } },
      member: { include: { user: { select: { fullName: true } } } },
    },
  });

  if (!dietPlan) {
    throw new AppError(404, "Diet plan not found.");
  }

  const content = dietPlan.content as any;

  return {
    id: dietPlan.id,
    title: content.title || "",
    goal: content.goal || "",
    dailyCalories: content.dailyCalories || 0,
    startDate: content.startDate || "",
    endDate: content.endDate || "",
    notes: content.notes || "",
    meals: content.meals || [],
    trainer: {
      id: dietPlan.trainerId,
      name: dietPlan.trainer.user?.fullName || "",
    },
    member: {
      id: dietPlan.memberId,
      name: dietPlan.member.user?.fullName || "",
    },
    updatedAt: dietPlan.updatedAt,
  };
};

const getMyDietPlan = async (userId: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({
    where: { userId },
  });

  if (!memberProfile) {
    throw new AppError(404, "Member not found.");
  }

  const dietPlan = await prisma.dietPlan.findFirst({
    where: {
      memberId: memberProfile.id,
    },
    orderBy: {
      updatedAt: "desc",
    },
    include: {
      trainer: { include: { user: { select: { fullName: true } } } },
      member: { include: { user: { select: { fullName: true } } } },
    },
  });

  if (!dietPlan) {
    return null;
  }

  const content = dietPlan.content as any;

  return {
    id: dietPlan.id,
    title: content.title || "",
    goal: content.goal || "",
    dailyCalories: content.dailyCalories || 0,
    startDate: content.startDate || "",
    endDate: content.endDate || "",
    notes: content.notes || "",
    meals: content.meals || [],
    trainer: {
      id: dietPlan.trainerId,
      name: dietPlan.trainer.user?.fullName || "",
    },
    member: {
      id: dietPlan.memberId,
      name: dietPlan.member.user?.fullName || "",
    },
    updatedAt: dietPlan.updatedAt,
  };
};

const getAssignableMembers = async (trainerUserId: string, businessId?: string) => {
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId: trainerUserId },
    include: {
      businesses: {
        where: { isActive: true },
        select: {
          businessId: true,
          business: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  const activeBusinessIds = trainerProfile.businesses.map((b) => b.businessId);
  const targetBusinessIds = businessId
    ? activeBusinessIds.filter((id) => id === businessId)
    : activeBusinessIds;

  if (businessId && targetBusinessIds.length === 0) {
    throw new AppError(403, "Trainer is not assigned to this business.");
  }

  // 1. Members from class bookings for this trainer
  const classBookings = await prisma.classBooking.findMany({
    where: {
      classSchedule: {
        trainerId: trainerProfile.id,
        ...(targetBusinessIds.length > 0 ? { businessId: { in: targetBusinessIds } } : {}),
      },
    },
    select: {
      memberId: true,
      classSchedule: {
        select: {
          businessId: true,
          business: { select: { id: true, name: true } },
        },
      },
    },
  });

  // 2. Members with active memberships in these gyms
  const memberships = targetBusinessIds.length > 0
    ? await prisma.membership.findMany({
        where: {
          businessId: { in: targetBusinessIds },
          status: "ACTIVE",
        },
        select: {
          memberId: true,
          businessId: true,
          business: { select: { id: true, name: true } },
        },
      })
    : [];

  const memberBusinessMap = new Map<string, { memberId: string; businessId: string; businessName: string }>();

  for (const b of classBookings) {
    if (b.memberId && b.classSchedule?.businessId) {
      const key = `${b.memberId}_${b.classSchedule.businessId}`;
      if (!memberBusinessMap.has(key)) {
        memberBusinessMap.set(key, {
          memberId: b.memberId,
          businessId: b.classSchedule.businessId,
          businessName: b.classSchedule.business?.name || "Affiliated Gym",
        });
      }
    }
  }

  for (const m of memberships) {
    if (m.memberId && m.businessId) {
      const key = `${m.memberId}_${m.businessId}`;
      if (!memberBusinessMap.has(key)) {
        memberBusinessMap.set(key, {
          memberId: m.memberId,
          businessId: m.businessId,
          businessName: m.business?.name || "Affiliated Gym",
        });
      }
    }
  }

  const memberIds = Array.from(new Set(Array.from(memberBusinessMap.values()).map((v) => v.memberId)));

  if (memberIds.length === 0) {
    return [];
  }

  const memberProfiles = await prisma.memberProfile.findMany({
    where: { id: { in: memberIds } },
    select: {
      id: true,
      userId: true,
      user: {
        select: {
          id: true,
          fullName: true,
          email: true,
          profileImage: true,
        },
      },
    },
  });

  const memberMap = new Map(memberProfiles.map((mp) => [mp.id, mp]));

  const result = [];
  for (const item of memberBusinessMap.values()) {
    const mp = memberMap.get(item.memberId);
    if (mp && mp.user) {
      result.push({
        id: mp.id,
        userId: mp.userId,
        fullName: mp.user.fullName || "Member",
        email: mp.user.email,
        profileImage: mp.user.profileImage || null,
        businessId: item.businessId,
        businessName: item.businessName,
      });
    }
  }

  return result;
};

const getTrainerDietPlans = async (trainerUserId: string) => {
  const trainerProfile = await prisma.trainerProfile.findUnique({
    where: { userId: trainerUserId },
  });

  if (!trainerProfile) {
    throw new AppError(404, "Trainer profile not found.");
  }

  const dietPlans = await prisma.dietPlan.findMany({
    where: { trainerId: trainerProfile.id },
    orderBy: { updatedAt: "desc" },
    include: {
      member: {
        include: {
          user: {
            select: { fullName: true, email: true, profileImage: true },
          },
        },
      },
      business: {
        select: { id: true, name: true },
      },
    },
  });

  return dietPlans.map((dp) => {
    const content = (dp.content as any) || {};
    return {
      id: dp.id,
      memberId: dp.memberId,
      businessId: dp.businessId,
      businessName: dp.business?.name || "",
      memberName: dp.member?.user?.fullName || "Member",
      memberEmail: dp.member?.user?.email || "",
      memberImage: dp.member?.user?.profileImage || null,
      title: content.title || "Nutrition Plan",
      goal: content.goal || "",
      dailyCalories: content.dailyCalories || content.targetCalories || 0,
      macros: content.macros || null,
      startDate: content.startDate || "",
      endDate: content.endDate || "",
      notes: content.notes || content.guidelines || "",
      meals: content.meals || [],
      createdAt: dp.createdAt,
      updatedAt: dp.updatedAt,
    };
  });
};

export const DietPlanService = {
  createDietPlan,
  updateDietPlan,
  getMemberDietPlan,
  getMyDietPlan,
  getAssignableMembers,
  getTrainerDietPlans,
};
