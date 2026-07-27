import express from "express";
import { SpecializationTagController } from "./specializationTag.controller";
import validateRequest from "../../middlewares/validateRequest";
import { SpecializationTagValidations } from "./specializationTag.validation";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";

const router = express.Router();

router.post(
    "/",
    // @ts-ignore
    checkAuth(USER_ROLE.SUPER_ADMIN),
    validateRequest(SpecializationTagValidations.createSpecializationTagSchema),
    SpecializationTagController.createSpecializationTag
);

export const specializationTagRoutes = router;
