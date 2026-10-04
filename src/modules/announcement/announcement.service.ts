import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";
import { pushJob } from "../../utils/redisQueue";

interface ICreateAnnouncementPayload {
  title: string;
  content?: string;
  body?: string;
  targetAudience?: "MEMBERS" | "TRAINERS" | "BOTH";
  audience?: "MEMBERS" | "TRAINERS" | "BOTH";
}

const createAnnouncement = async (
  ownerId: string,
  businessId: string,
  payload: ICreateAnnouncementPayload
) => {
  // Verify Business & Ownership
  const business = await prisma.business.findUnique({
    where: { id: businessId },
  });

  if (!business) {
    throw new AppError(404, "Business not found.");
  }

  if (business.ownerId !== ownerId) {
    throw new AppError(403, "Forbidden. You do not own this business.");
  }

  const messageBody = payload.body || payload.content;
  const targetAudience = (payload.audience || payload.targetAudience) as "MEMBERS" | "TRAINERS" | "BOTH";

  if (!messageBody) {
    throw new AppError(400, "Content or body is required.");
  }

  if (!targetAudience) {
    throw new AppError(400, "Target audience must be MEMBERS, TRAINERS, or BOTH.");
  }

  // Create Announcement
  const announcement = await prisma.announcement.create({
    data: {
      businessId,
      title: payload.title,
      body: messageBody,
      audience: targetAudience,
    },
  });

  // Publish Redis Event for Notification & Email
  pushJob("notification_queue", {
    eventType: "BUSINESS_ANNOUNCEMENT_CREATED",
    type: "ANNOUNCEMENT",
    title: announcement.title,
    body: announcement.body,
    businessId: business.id,
    businessName: business.name,
    announcementId: announcement.id,
    targetAudience: announcement.audience,
  });

  return {
    id: announcement.id,
    businessId: announcement.businessId,
    title: announcement.title,
    body: announcement.body,
    content: announcement.body,
    audience: announcement.audience,
    targetAudience: announcement.audience,
    createdAt: announcement.createdAt,
  };
};

const getAnnouncements = async (
  userId: string,
  role: string,
  businessId: string,
  query: any
) => {
  // Authorization Verification based on Role
  let allowedAudiences: ("MEMBERS" | "TRAINERS" | "BOTH")[] = ["BOTH"];

  if (
    role === "BUSINESS_OWNER" ||
    role === "SUPER_ADMIN" ||
    role === "ADMIN" ||
    role === "STAFF"
  ) {
    if (role === "BUSINESS_OWNER") {
      const business = await prisma.business.findUnique({
        where: { id: businessId },
      });
      if (!business) {
        throw new AppError(404, "Business not found.");
      }
      if (business.ownerId !== userId) {
        throw new AppError(403, "Forbidden. You do not own this business.");
      }
    } else if (role === "STAFF") {
      const staff = await prisma.businessStaff.findUnique({
        where: {
          businessId_userId: {
            businessId,
            userId,
          },
        },
      });
      if (!staff) {
        throw new AppError(403, "Forbidden. You are not staff in this business.");
      }
    }
    // Business owners and staff can view all announcements for the business
    allowedAudiences = ["MEMBERS", "TRAINERS", "BOTH"];
  } else if (role === "MEMBER") {
    const activeMembership = await prisma.membership.findFirst({
      where: {
        member: { userId },
        businessId,
        status: "ACTIVE",
      },
    });

    if (!activeMembership) {
      throw new AppError(403, "Forbidden. You do not have an active membership in this business.");
    }
    allowedAudiences.push("MEMBERS");
  } else if (role === "TRAINER") {
    const assignedTrainer = await prisma.trainerBusiness.findFirst({
      where: {
        trainer: { userId },
        businessId,
      },
    });

    if (!assignedTrainer) {
      throw new AppError(403, "Forbidden. You are not assigned to this business.");
    }
    allowedAudiences.push("TRAINERS");
  } else {
    throw new AppError(403, "Forbidden. Invalid role for accessing announcements.");
  }

  // If query specifies targetAudience or audience, validate it against allowed ones
  const requestedAudience = (query.targetAudience || query.audience) as
    | "MEMBERS"
    | "TRAINERS"
    | "BOTH"
    | undefined;

  const additionalFilters: any = { businessId };

  if (requestedAudience) {
    if (!allowedAudiences.includes(requestedAudience)) {
      // Return empty results if they request an audience they shouldn't see
      return { meta: { page: 1, limit: 10, total: 0, totalPages: 0 }, data: [] };
    }
    additionalFilters.audience = requestedAudience;
  } else {
    // If no specific audience requested, show all allowed
    additionalFilters.audience = { in: allowedAudiences };
  }

  if (query.createdAt) {
    additionalFilters.createdAt = query.createdAt;
  }

  // Initialize Query Builder
  const queryBuilder = new QueryBuilder(
    prisma.announcement,
    query,
    {
      searchableFields: ["title", "body"],
    }
  )
    .search()
    .filter()
    .where(additionalFilters)
    .sort()
    .paginate();

  const [total, result] = await Promise.all([
    queryBuilder.count(),
    queryBuilder.execute(),
  ]);

  const formattedData = result.data.map((announcement: any) => ({
    id: announcement.id,
    businessId: announcement.businessId,
    title: announcement.title,
    body: announcement.body,
    content: announcement.body,
    audience: announcement.audience,
    targetAudience: announcement.audience,
    createdAt: announcement.createdAt,
  }));

  return {
    meta: {
      page: Number(query.page) || 1,
      limit: Number(query.limit) || 10,
      total,
      totalPages: Math.ceil(total / (Number(query.limit) || 10)),
    },
    data: formattedData,
  };
};

export const AnnouncementService = {
  createAnnouncement,
  getAnnouncements,
};
