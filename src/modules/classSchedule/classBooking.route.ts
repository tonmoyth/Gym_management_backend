import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";
import validateRequest from "../../middlewares/validateRequest";
import { ClassBookingController } from "./classBooking.controller";
import { z } from "zod";

const router = express.Router();

const bookClassValidation = z.object({
  params: z.object({
    id: z.string({ message: "Class ID is required." }).uuid({ message: "Class ID must be a valid UUID." }),
  }),
});

router.post(
  "/:id/book",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  validateRequest(bookClassValidation),
  ClassBookingController.bookClass
);

export const classBookingRoutes = router;
