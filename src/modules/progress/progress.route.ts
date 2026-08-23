import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";
import validateRequest from "../../middlewares/validateRequest";
import { ProgressValidations } from "./progress.validation";
import { ProgressController } from "./progress.controller";

const router = express.Router();

router.post(
  "/",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  validateRequest(ProgressValidations.createProgressValidation),
  ProgressController.createProgress
);

router.get(
  "/member/:memberId",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  validateRequest(ProgressValidations.getProgressHistoryValidation),
  ProgressController.getMemberProgressHistory
);

export const progressRoutes = router;
