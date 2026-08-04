import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import validateRequest from "../../middlewares/validateRequest";
import { USER_ROLE } from "../Business/business.constant";
import { AnnouncementController } from "./announcement.controller";
import { AnnouncementValidations } from "./announcement.validation";

const router = express.Router();

router.post(
  "/:businessId/announcements",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(AnnouncementValidations.createAnnouncementValidation),
  AnnouncementController.createAnnouncement
);

router.get(
  "/:businessId/announcements",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER, USER_ROLE.TRAINER),
  validateRequest(AnnouncementValidations.getAnnouncementsValidation),
  AnnouncementController.getAnnouncements
);

export const announcementRoutes = router;
