import express from "express";
import validateRequest from "../../middlewares/validateRequest";
import { ReviewValidations } from "./review.validation";
import { ReviewController } from "./review.controller";

const router = express.Router();

router.get(
  "/trainer/:trainerId",
  validateRequest(ReviewValidations.getTrainerReviewsValidation),
  ReviewController.getTrainerReviews
);

export const reviewRoutes = router;
