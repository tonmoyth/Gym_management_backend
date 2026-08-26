import { prisma } from "../../lib/prisma";
import AppError from "../../errors/AppError";
import { QueryBuilder } from "../../utils/queryBuilder";
import { BookingStatus, PlanStatus, PaymentStatus } from "../../generated/prisma/enums";
import { paymentService } from "../Payment/payment.service";
import { pushJob } from "../../utils/redisQueue";

const createMembership = async (userId: string, planId: string) => {
  const memberProfile = await prisma.memberProfile.findUnique({ where: { userId } });
  if (!memberProfile) throw new AppError(404, "Member profile not found");

  const plan = await prisma.membershipPlan.findUnique({ where: { id: planId } });
  if (!plan) throw new AppError(404, "Membership plan not found");
  if (plan.status === PlanStatus.ARCHIVED) throw new AppError(400, "This plan is no longer available");

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
  if (membership.business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not have access to this business.");
  if (membership.status !== BookingStatus.PENDING_APPROVAL) throw new AppError(400, "Membership is not pending approval");

  const payment = await prisma.payment.findFirst({
    where: { membershipId: membership.id },
    orderBy: { createdAt: 'desc' }
  });
  
  if (payment && payment.status !== PaymentStatus.SUCCESS) {
      throw new AppError(400, "Payment must be successful to approve membership");
  }

  const startDate = new Date();
  const endDate = new Date();
  endDate.setDate(startDate.getDate() + (membership.plan.durationDays || 30));

  const updatedMembership = await prisma.membership.update({
    where: { id: membershipId },
    data: {
      status: BookingStatus.ACTIVE,
      startDate,
      endDate,
      approvedAt: new Date(),
    },
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
  if (membership.business.ownerId !== ownerId) throw new AppError(403, "Forbidden. You do not have access to this business.");
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

export const membershipService = {
  createMembership,
  getMyMemberships,
  getMembershipById,
  upgradeMembership,
  cancelMembership,
  approveMembership,
  rejectMembership,
};
