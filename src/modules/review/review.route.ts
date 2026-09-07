import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { ReviewValidations } from "./review.validation";
import { ReviewController } from "./review.controller";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";

const router = express.Router();

router.get(
  "/trainer/:trainerId",
  validateRequest(ReviewValidations.getTrainerReviewsValidation),
  ReviewController.getTrainerReviews
);

router.post(
  "/",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  validateRequest(ReviewValidations.createReviewValidation),
  ReviewController.createReview
);

router.get(
  "/business/:businessId",
  validateRequest(ReviewValidations.getBusinessReviewsValidation),
  ReviewController.getBusinessReviews
);

export const reviewRoutes = router;
