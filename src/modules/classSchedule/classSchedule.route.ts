import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import validateRequest from "../../middlewares/validateRequest";
import { USER_ROLE } from "../Business/business.constant";
import { ClassScheduleController } from "./classSchedule.controller";
import { ClassScheduleValidations } from "./classSchedule.validation";

const router = express.Router();

router.post(
  "/:businessId/classes",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(ClassScheduleValidations.createClassScheduleValidation),
  ClassScheduleController.createClassSchedule
);

router.get(
  "/:businessId/classes",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER, USER_ROLE.MEMBER, USER_ROLE.TRAINER),
  validateRequest(ClassScheduleValidations.getClassSchedulesValidation),
  ClassScheduleController.getClassSchedules
);

router.patch(
  "/:businessId/classes/:id",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(ClassScheduleValidations.updateClassScheduleValidation),
  ClassScheduleController.updateClassSchedule
);

router.delete(
  "/:businessId/classes/:id",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(ClassScheduleValidations.deleteClassScheduleValidation),
  ClassScheduleController.cancelClassSchedule
);

export const classScheduleRoutes = router;
