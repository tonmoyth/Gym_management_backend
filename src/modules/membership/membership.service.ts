import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";
import { BookingStatus, PlanStatus, PaymentStatus, StaffPermissionRole } from "../../generated/prisma/enums";
import { paymentService } from "../Payment/payment.service";
import { pushJob } from "../../utils/redisQueue";
import { verifyBusinessAccess } from "../../utils/businessAccess";

const createMembership = async (userId: string, planId: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!memberProfile) throw new AppError(404, "Member profile not found");

  const plan = await prisma.membershipPlan.findUnique({
    where: { id: planId },
    include: { business: true }
  });
  if (!plan) throw new AppError(404, "Membership plan not found");
  if (plan.status === PlanStatus.ARCHIVED) throw new AppError(400, "This plan is no longer available");

  if (plan.business.status === "SUSPENDED") {
    throw new AppError(403, "This business is currently suspended");
  }

  const existingMembership = await prisma.membership.findFirst({
    where: {
      memberId: memberProfile.id,
      businessId: plan.businessId,
      status: { in: [BookingStatus.PENDING_APPROVAL, BookingStatus.ACTIVE] },
    },
  });

  if (existingMembership) {
    throw new AppError(400, "You already have an active or pending membership for this business");
  }

  const membership = await prisma.membership.create({
    data: {
      memberId: memberProfile.id,
      businessId: plan.businessId,
      planId: plan.id,
      status: BookingStatus.PENDING_APPROVAL,
    },
  });

  return { membership, paymentRequired: true };
};

const getMyMemberships = async (userId: string, queryParams: any) => {
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!memberProfile) throw new AppError(404, "Member profile not found");

  const queryBuilder = new QueryBuilder(prisma.membership, queryParams, {
    filterableFields: ["status", "businessId", "planId"],
    searchableFields: [],
  })
    .where({ memberId: memberProfile.id })
    .filter()
    .sort()
    .paginate()
    .include({
      plan: true,
      business: true,
    });

  const result = await queryBuilder.execute();
  return result;
};

const getMembershipById = async (userId: string, id: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!memberProfile) throw new AppError(404, "Member profile not found");

  const membership = await prisma.membership.findFirst({
    where: {
      id,
      memberId: memberProfile.id,
    },
    include: {
      plan: true,
      business: true,
      payments: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!membership) {
    throw new AppError(404, "Membership not found or does not belong to you");
  }

  return membership;
};

const upgradeMembership = async (userId: string, id: string, newPlanId: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!memberProfile) throw new AppError(404, "Member profile not found");

  const membership = await prisma.membership.findFirst({
    where: { id, memberId: memberProfile.id },
  });
  if (!membership) throw new AppError(404, "Membership not found or unauthorized");

  if (membership.status !== BookingStatus.ACTIVE) {
    throw new AppError(400, "Only active memberships can be upgraded/downgraded");
  }

  if (membership.planId === newPlanId) {
    throw new AppError(400, "New plan must be different from current plan");
  }

  const newPlan = await prisma.membershipPlan.findUnique({ where: { id: newPlanId } });
  if (!newPlan) throw new AppError(404, "New plan not found");
  if (newPlan.status === PlanStatus.ARCHIVED) throw new AppError(400, "New plan is not available");
  if (newPlan.businessId !== membership.businessId) {
    throw new AppError(400, "New plan must belong to the same business");
  }

  // Schedule the plan change
  const scheduledDate = membership.endDate || new Date();

  const updatedMembership = await prisma.membership.update({
    where: { id },
    data: {
      scheduledPlanId: newPlan.id,
      scheduledPlanDate: scheduledDate,
    },
  });

  return updatedMembership;
};

const cancelMembership = async (userId: string, id: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!memberProfile) throw new AppError(404, "Member profile not found");

  const membership = await prisma.membership.findFirst({
    where: { id, memberId: memberProfile.id },
  });
  if (!membership) throw new AppError(404, "Membership not found or unauthorized");

  if (membership.status === BookingStatus.CANCELLED) {
    throw new AppError(400, "Membership is already cancelled");
  }

  const updatedMembership = await prisma.membership.update({
    where: { id },
    data: {
      status: BookingStatus.CANCELLED,
    },
  });

  return updatedMembership;
};

const approveMembership = async (ownerId: string, membershipId: string) => {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: {
      business: true,
      plan: true,
      member: { include: { user: true } }
    },
  });

  if (!membership) throw new AppError(404, "Membership not found");
  await verifyBusinessAccess(membership.businessId, ownerId, [
    StaffPermissionRole.MEMBER_MANAGER,
    StaffPermissionRole.FULL,
  ]);
  if (membership.status !== BookingStatus.PENDING_APPROVAL) throw new AppError(400, "Membership is not pending approval");

  const payment = await prisma.payment.findFirst({
    where: { membershipId: membership.id },
    orderBy: { createdAt: 'desc' }
  });

  if (payment && payment.status === PaymentStatus.REFUNDED) {
    throw new AppError(400, "Cannot approve membership with a refunded payment");
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + (membership.plan.durationDays || 30));

  const updatedMembership = await prisma.$transaction(async (tx) => {
    // If payment is pending (manual bKash/Nagad/Bank), owner verification & approval marks it as SUCCESS
    if (payment && payment.status === PaymentStatus.PENDING) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.SUCCESS },
      });
    }

    return await tx.membership.update({
      where: { id: membershipId },
      data: {
        status: BookingStatus.ACTIVE,
        startDate,
        endDate,
        approvedAt: new Date(),
      },
    });
  });

  await pushJob('notification_queue', {
    eventType: 'MEMBERSHIP_APPROVED',
    userId: membership.member.user?.id,
    userEmail: membership.member.user?.email,
    userName: membership.member.user?.fullName || "Member",
    membershipId: membership.id,
    businessId: membership.businessId,
    businessName: membership.business.name,
    planName: membership.plan.name,
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  return updatedMembership;
};

const rejectMembership = async (ownerId: string, membershipId: string, reason?: string) => {
  const membership = await prisma.membership.findUnique({
    where: { id: membershipId },
    include: {
      business: true,
      plan: true,
      member: { include: { user: true } }
    },
  });

  if (!membership) throw new AppError(404, "Membership not found");
  await verifyBusinessAccess(membership.businessId, ownerId, [
    StaffPermissionRole.MEMBER_MANAGER,
    StaffPermissionRole.FULL,
  ]);
  if (membership.status !== BookingStatus.PENDING_APPROVAL) throw new AppError(400, "Membership is not pending approval");

  let actualRefundStatus = 'NOT_APPLICABLE';

  const payment = await prisma.payment.findFirst({
    where: { membershipId: membership.id, status: PaymentStatus.SUCCESS },
    orderBy: { createdAt: 'desc' }
  });

  if (payment) {
    try {
      await paymentService.processRefund(payment.id);
      actualRefundStatus = 'REFUNDED';
    } catch (err: any) {
      console.error('Refund initiation failed during rejection:', err);
      actualRefundStatus = 'REFUND_FAILED';
    }
  } else {
    // If payment was pending manual verification, mark as FAILED upon rejection
    const pendingPayment = await prisma.payment.findFirst({
      where: { membershipId: membership.id, status: PaymentStatus.PENDING },
      orderBy: { createdAt: 'desc' }
    });
    if (pendingPayment) {
      await prisma.payment.update({
        where: { id: pendingPayment.id },
        data: { status: PaymentStatus.FAILED },
      });
    }
  }

  const updatedMembership = await prisma.membership.update({
    where: { id: membershipId },
    data: {
      status: BookingStatus.REJECTED,
      rejectedAt: new Date(),
      rejectionReason: reason,
    },
  });

  await pushJob('notification_queue', {
    eventType: 'MEMBERSHIP_REJECTED',
    userId: membership.member.user?.id,
    userEmail: membership.member.user?.email,
    userName: membership.member.user?.fullName || "Member",
    membershipId: membership.id,
    businessId: membership.businessId,
    businessName: membership.business.name,
    planName: membership.plan.name,
    refundStatus: actualRefundStatus
  });

  return { membership: updatedMembership, refund: { status: actualRefundStatus } };
};

const getBusinessMemberships = async (
  ownerId: string,
  businessId: string,
  query?: Record<string, any>
) => {
  await verifyBusinessAccess(businessId, ownerId, [
    StaffPermissionRole.FRONT_DESK,
    StaffPermissionRole.MEMBER_MANAGER,
    StaffPermissionRole.FULL,
  ]);

  const whereCondition: any = { businessId };
  if (query?.status) {
    whereCondition.status = query.status;
  }

  const memberships = await prisma.membership.findMany({
    where: whereCondition,
    include: {
      member: {
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              email: true,
              profileImage: true,
            },
          },
          attendanceLogs: {
            where: { businessId },
            select: {
              id: true,
              attendanceTime: true,
              attendanceType: true,
              verifyMethod: true,
            },
            orderBy: { attendanceTime: 'desc' },
          },
        },
      },
      plan: {
        select: {
          id: true,
          name: true,
          price: true,
          durationDays: true,
        },
      },
      payments: {
        select: {
          id: true,
          gateway: true,
          gatewayTransactionId: true,
          amount: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formatted = memberships.map((m) => {
    const checkIns = m.member.attendanceLogs?.filter((l) => l.attendanceType === 'CHECK_IN') || [];
    const lastLog = m.member.attendanceLogs?.[0];
    return {
      id: m.id,
      membershipId: m.id,
      memberId: m.memberId,
      userId: m.member.user?.id,
      name: m.member.user?.fullName || 'Athlete',
      email: m.member.user?.email || '',
      profilePhoto: m.member.user?.profileImage || null,
      status: m.status,
      startDate: m.startDate,
      endDate: m.endDate,
      requestedAt: m.requestedAt,
      approvedAt: m.approvedAt,
      plan: m.plan
        ? {
            id: m.plan.id,
            name: m.plan.name,
            price: m.plan.price ? m.plan.price.toString() : '0.00',
            durationDays: m.plan.durationDays,
          }
        : null,
      payment: m.payments?.[0] || null,
      totalCheckIns: checkIns.length,
      lastSeen: lastLog?.attendanceTime || null,
      attendanceHistory: m.member.attendanceLogs || [],
    };
  });

  return formatted;
};

export const membershipService = {
  createMembership,
  getMyMemberships,
  getMembershipById,
  upgradeMembership,
  cancelMembership,
  approveMembership,
  rejectMembership,
  getBusinessMemberships,
};
