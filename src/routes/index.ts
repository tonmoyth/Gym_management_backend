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
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
