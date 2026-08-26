import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { Role } from "../../generated/prisma/enums";
import validateRequest from "../../middlewares/validateRequest";

import { membershipValidation } from "./membership.validation";
import { membershipController } from "./membership.controller";

const router = express.Router();

router.post(
  "/",
  checkAuth(), // Expects Role.MEMBER but currently checkAuth doesn't take role params natively in this project, just verifies user.
  validateRequest(membershipValidation.createMembershipSchema),
  membershipController.createMembership
);

router.get(
  "/me",
  checkAuth(),
  membershipController.getMyMemberships
);

router.get(
  "/:id",
  checkAuth(),
  membershipController.getMembershipById
);

router.patch(
  "/:id/upgrade",
  checkAuth(),
  validateRequest(membershipValidation.upgradeMembershipSchema),
  membershipController.upgradeMembership
);

router.patch(
  "/:id/cancel",
  checkAuth(),
  validateRequest(membershipValidation.cancelMembershipSchema),
  membershipController.cancelMembership
);

router.patch(
  "/:id/approve",
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(membershipValidation.approveMembershipSchema),
  membershipController.approveMembership
);

router.patch(
  "/:id/reject",
  checkAuth(Role.BUSINESS_OWNER),
  validateRequest(membershipValidation.rejectMembershipSchema),
  membershipController.rejectMembership
);

export const membershipRoutes = router;
