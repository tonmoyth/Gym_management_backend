import express from "express";
import { SpecializationTagController } from "./specializationTag.controller";
import validateRequest from "../../middlewares/validateRequest";
import { SpecializationTagValidations } from "./specializationTag.validation";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";

const router = express.Router();

router.get(
    "/",
    SpecializationTagController.getAllSpecializationTags
);

router.post(
    "/",
    // @ts-ignore
    checkAuth(USER_ROLE.SUPER_ADMIN, USER_ROLE.BUSINESS_OWNER, USER_ROLE.STAFF),
    validateRequest(SpecializationTagValidations.createSpecializationTagSchema),
    SpecializationTagController.createSpecializationTag
);

export const specializationTagRoutes = router;
