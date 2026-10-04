import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";
import validateRequest from "../../middlewares/validateRequest";
import { ProgressValidations } from "./progress.validation";
import { ProgressController } from "./progress.controller";
import { Role } from "../../generated/prisma/client";

const router = express.Router();

router.post(
  "/",
  // @ts-ignore
  checkAuth(Role.TRAINER),
  validateRequest(ProgressValidations.createProgressValidation),
  ProgressController.createProgress
);

router.get(
  "/trainer/me",
  // @ts-ignore
  checkAuth(Role.TRAINER),
  ProgressController.getTrainerLoggedProgress
);

router.get(
  "/member/:memberId",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  validateRequest(ProgressValidations.getProgressHistoryValidation),
  ProgressController.getMemberProgressHistory
);

router.get(
  "/me",
  // @ts-ignore
  checkAuth(Role.MEMBER),
  validateRequest(ProgressValidations.getMyProgressValidation),
  ProgressController.getMyProgress
);

export const progressRoutes = router;
