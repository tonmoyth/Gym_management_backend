import express from "express";
import { paymentRoutes } from "../modules/Payment/payment.route";
import { authRoutes } from "../modules/Auth/auth.route";
import { userRoutes } from "../modules/User/user.route";
import { businessRoutes } from "../modules/Business/business.route";
import { staffRoutes } from "../modules/staff/staff.route";
import { membershipPlanRoutes } from "../modules/membershipPlan/membershipPlan.route";
import { bookingRoutes } from "../modules/booking/booking.route";
import { jobPostRoutes } from "../modules/jobPost/jobPost.route";
import { trainerProfileRoutes } from "../modules/trainerProfile/trainerProfile.route";
import { specializationTagRoutes } from "../modules/specializationTag/specializationTag.route";
import { dietPlanRoutes } from "../modules/dietPlan/dietPlan.route";
import { memberProfileRoutes } from "../modules/memberProfile/memberProfile.route";
import { attendanceRoutes } from "../modules/attendance/attendance.route";
import { reportRoutes } from "../modules/report/report.route";
import { trainerPayoutRoutes } from "../modules/trainerPayout/trainerPayout.route";
import { announcementRoutes } from "../modules/announcement/announcement.route";
import { classScheduleRoutes } from "../modules/classSchedule/classSchedule.route";
import { equipmentRoutes } from "../modules/equipment/equipment.route";
import { memberReferralSettingRoutes } from "../modules/memberReferralSetting/memberReferralSetting.route";
import { subscriptionRoutes } from "../modules/subscription/subscription.route";
import { progressRoutes } from "../modules/progress/progress.route";
import { reviewRoutes } from "../modules/review/review.route";
import { notificationRoutes } from "../modules/notification/notification.route";
import { disputeRoutes } from "../modules/dispute/dispute.route";
import { payoutRoutes } from "../modules/payout/payout.route";
import { membershipRoutes } from "../modules/membership/membership.route";
import { classBookingRoutes } from "../modules/classSchedule/classBooking.route";
import { favoriteRoutes } from "../modules/favorite/favorite.route";
import { referralRoutes } from "../modules/referral/referral.route";
import { dashboardRoutes } from "../modules/super_admin/dashboard/dashboard.route";
import { businessManagementRoutes } from "../modules/super_admin/bussiness_management/businessManagement.route";
import { trainerMemberOversightRoutes } from "../modules/super_admin/trainer_member_oversight/trainerMemberOversight.route";
import { certificationVerificationRoutes } from "../modules/super_admin/certification_verification/certificationVerification.route";
import { subscriptionBillingControlRoutes } from "../modules/super_admin/subscription_billing_control/subscription.route";
import { paymentGatewayOversightRoutes } from "../modules/super_admin/payment_gateway_oversight/payment.route";
import { disputeRefundResolutionRoutes } from "../modules/super_admin/dispute_refund_resolution/dispute.route";
import { contentModerationRoutes } from "../modules/super_admin/content_moderation/content_moderation.route";
import { rolePermissionManagementRoutes } from "../modules/super_admin/role_permission_management/rolePermissionManagement.route";
import { auditLogsRoutes } from "../modules/super_admin/audit_logs/auditLogs.route";
import { platformReportsRoutes } from "../modules/super_admin/reports_export/reports.route";

const router = express.Router();

const moduleRoutes = [
    {
        path: "/",
        route: reportRoutes,
    },
    {
        path: "/",
        route: attendanceRoutes,
    },
    {
        path: "/auth",
        route: authRoutes,
    },
    {
        path: "/user",
        route: userRoutes,
    },
    {
        path: "/payment",
        route: paymentRoutes,
    },
    {
        path: "/businesses",
        route: businessRoutes,
    },
    {
        path: "/businesses",
        route: staffRoutes,
    },
    {
        path: "/businesses",
        route: trainerPayoutRoutes,
    },
    {
        path: "/businesses",
        route: announcementRoutes,
    },
    {
        path: "/businesses",
        route: classScheduleRoutes,
    },
    {
        path: "/businesses",
        route: equipmentRoutes,
    },
    {
        path: "/businesses",
        route: memberReferralSettingRoutes,
    },
    {
        path: "/businesses",
        route: membershipPlanRoutes,
    },
    {
        path: "/businesses",
        route: bookingRoutes,
    },
    {
        path: "/job-posts",
        route: jobPostRoutes,
    },
    {
        path: "/trainer-profile",
        route: trainerProfileRoutes,
    },
    {
        path: "/specialization-tags",
        route: specializationTagRoutes,
    },
    {
        path: "/diet-plans",
        route: dietPlanRoutes,
    },
    {
        path: "/members",
        route: memberProfileRoutes,
    },
    {
        path: "/subscription",
        route: subscriptionRoutes,
    },
    {
        path: "/progress",
        route: progressRoutes,
    },
    {
        path: "/reviews",
        route: reviewRoutes,
    },
    {
        path: "/notifications",
        route: notificationRoutes,
    },
    {
        path: "/disputes",
        route: disputeRoutes,
    },
    {
        path: "/payouts",
        route: payoutRoutes,
    },
    {
        path: "/memberships",
        route: membershipRoutes,
    },
    {
        path: "/classes",
        route: classBookingRoutes,
    },
    {
        path: "/favorites",
        route: favoriteRoutes,
    },
    {
        path: "/referrals",
        route: referralRoutes,
    },
    {
        path: "/admin/dashboard",
        route: dashboardRoutes,
    },
    {
        path: "/admin/businesses",
        route: businessManagementRoutes,
    },
    {
        path: "/admin/users",
        route: trainerMemberOversightRoutes,
    },
    {
        path: "/admin/certifications",
        route: certificationVerificationRoutes,
    },
    {
        path: "/admin/subscriptions",
        route: subscriptionBillingControlRoutes,
    },
    {
        path: "/admin/payments",
        route: paymentGatewayOversightRoutes,
    },
    {
        path: "/admin/disputes",
        route: disputeRefundResolutionRoutes,
    },
    {
        path: "/admin/moderation",
        route: contentModerationRoutes,
    },
    {
        path: "/admin/staff",
        route: rolePermissionManagementRoutes,
    },
    {
        path: "/admin/audit-logs",
        route: auditLogsRoutes,
    },
    {
        path: "/admin/reports",
        route: platformReportsRoutes,
    },
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
