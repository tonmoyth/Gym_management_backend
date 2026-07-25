import express from "express";
import { JobPostController } from "./jobPost.controller";
import { JobPostValidations } from "./jobPost.validation";
import validateRequest from "../../middlewares/validateRequest";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";

const router = express.Router();

router.post(
  "/",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(JobPostValidations.createJobPostValidation),
  JobPostController.createJobPost,
);

router.patch(
  "/:id/close",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(JobPostValidations.closeJobPostValidation),
  JobPostController.closeJobPost,
);

router.get(
  "/:id/applicants",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(JobPostValidations.getJobPostApplicantsValidation),
  JobPostController.getJobPostApplicants,
);

export const jobPostRoutes = router;
