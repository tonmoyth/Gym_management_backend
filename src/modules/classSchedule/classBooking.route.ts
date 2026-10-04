import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";
import validateRequest from "../../middlewares/validateRequest";
import { z } from "zod";
import { ClassBookingController } from "./classBooking.controller";

const router = express.Router();

const classIdParamValidation = z.object({
  params: z.object({
    id: z.string({ message: "ID is required." }).uuid({ message: "ID must be a valid UUID." }),
  }),
});

router.get(
  "/my-bookings",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  ClassBookingController.getMyBookings
);

router.post(
  "/:id/book",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  validateRequest(classIdParamValidation),
  ClassBookingController.bookClass
);

router.patch(
  "/:id/cancel",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  validateRequest(classIdParamValidation),
  ClassBookingController.cancelBooking
);

export const classBookingRoutes = router;
