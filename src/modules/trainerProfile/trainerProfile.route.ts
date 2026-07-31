import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";
import { upload } from "../../middlewares/upload";
import { parseData } from "../../middlewares/parseData";
import validateRequest from "../../middlewares/validateRequest";
import { TrainerProfileValidations } from "./trainerProfile.validation";
import { TrainerProfileController } from "./trainerProfile.controller";

const router = express.Router();

router.get(
    '/:businessId/trainers/me/dashboard',
    // @ts-ignore
    checkAuth(USER_ROLE.TRAINER),
    validateRequest(TrainerProfileValidations.getBusinessTrainerDashboardValidation),
    TrainerProfileController.getBusinessTrainerDashboard
);

router.post(
  "/me",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  upload.fields([
    { name: "profilePhoto", maxCount: 1 },
    { name: "certificationFiles", maxCount: 10 },
  ]),
  parseData,
  validateRequest(TrainerProfileValidations.createTrainerProfileValidation),
  TrainerProfileController.createTrainerProfile,
);

router.get(
  "/me",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  TrainerProfileController.getOwnTrainerProfile,
);

router.put(
  "/specializations",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  validateRequest(TrainerProfileValidations.setSpecializationsValidation),
  TrainerProfileController.setOwnSpecializations,
);

router.post(
  "/certifications",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  upload.single("credentialFile"),
  parseData,
  validateRequest(TrainerProfileValidations.uploadCertificationValidation),
  TrainerProfileController.uploadCertification,
);


router.get(
  "/certifications/me",
  // @ts-ignore
  checkAuth(USER_ROLE.TRAINER),
  TrainerProfileController.getOwnCertifications,
);


router.get(
  "/",
  TrainerProfileController.getAllTrainers,
);

router.get(
  "/:id",
  validateRequest(TrainerProfileValidations.getPublicTrainerProfileValidation),
  TrainerProfileController.getPublicTrainerProfile,
);

export const trainerProfileRoutes = router;
