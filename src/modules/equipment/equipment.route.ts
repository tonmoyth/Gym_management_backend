import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import validateRequest from "../../middlewares/validateRequest";
import { USER_ROLE } from "../Business/business.constant";
import { EquipmentController } from "./equipment.controller";
import { EquipmentValidations } from "./equipment.validation";

const router = express.Router();

router.post(
  "/:businessId/equipment",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(EquipmentValidations.createEquipmentValidation),
  EquipmentController.createEquipment
);

router.get(
  "/:businessId/equipment",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(EquipmentValidations.getEquipmentValidation),
  EquipmentController.getEquipmentList
);

router.patch(
  "/:businessId/equipment/:id",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(EquipmentValidations.updateEquipmentValidation),
  EquipmentController.updateEquipment
);

router.delete(
  "/:businessId/equipment/:id",
  // @ts-ignore
  checkAuth(USER_ROLE.BUSINESS_OWNER),
  validateRequest(EquipmentValidations.deleteEquipmentValidation),
  EquipmentController.deleteEquipment
);

export const equipmentRoutes = router;
