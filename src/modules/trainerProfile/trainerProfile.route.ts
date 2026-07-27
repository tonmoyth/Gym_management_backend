import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";
import { upload } from "../../middlewares/upload";
import { parseData } from "../../middlewares/parseData";
import validateRequest from "../../middlewares/validateRequest";
import { TrainerProfileValidations } from "./trainerProfile.validation";
import { TrainerProfileController } from "./trainerProfile.controller";

const router = express.Router();

router.post(
  "/me",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "certificationFiles", maxCount: 10 },
  ]),
  parseData,
  validateRequest(TrainerProfileValidations.upsertTrainerProfileValidation),
  TrainerProfileController.upsertTrainerProfile,
);
router.get(
  "/me",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  TrainerProfileController.getOwnTrainerProfile,
);

export const trainerProfileRoutes = router;
