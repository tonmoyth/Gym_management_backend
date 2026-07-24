import express from "express";
import { paymentRoutes } from "../modules/Payment/payment.route";
import { authRoutes } from "../modules/Auth/auth.route";
import { userRoutes } from "../modules/User/user.route";
import { businessRoutes } from "../modules/Business/business.route";
import { staffRoutes } from "../modules/staff/staff.route";

const router = express.Router();

const moduleRoutes = [
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
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
