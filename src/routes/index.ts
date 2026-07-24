import express from "express";
import { paymentRoutes } from "../modules/Payment/payment.route";
import { authRoutes } from "../modules/Auth/auth.route";
import { userRoutes } from "../modules/User/user.route";
import { businessRoutes } from "../modules/Business/business.route";

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
];

moduleRoutes.forEach((route) => router.use(route.path, route.route));

export default router;
