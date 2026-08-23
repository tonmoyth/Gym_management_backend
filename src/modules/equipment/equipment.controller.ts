import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { EquipmentService } from "./equipment.service";

const createEquipment = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const ownerId = req.user.id;

  const result = await EquipmentService.createEquipment(ownerId, businessId as string, req.body);

  sendResponse(res, {
    statusCode: 201,
    success: true,
    message: "Equipment added successfully.",
    data: result,
  });
});

const getEquipmentList = catchAsync(async (req: Request, res: Response) => {
  const { businessId } = req.params;
  const ownerId = req.user.id;

  const result = await EquipmentService.getEquipmentList(ownerId, businessId as string, req.query);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Equipment inventory retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

const updateEquipment = catchAsync(async (req: Request, res: Response) => {
  const { businessId, id } = req.params;
  const ownerId = req.user.id;

  const result = await EquipmentService.updateEquipment(ownerId, businessId as string, id as string, req.body);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Equipment updated successfully.",
    data: result,
  });
});

const deleteEquipment = catchAsync(async (req: Request, res: Response) => {
  const { businessId, id } = req.params;
  const ownerId = req.user.id;

  const result = await EquipmentService.deleteEquipment(ownerId, businessId as string, id as string);

  sendResponse(res, {
    statusCode: 200,
    success: true,
    message: "Equipment removed successfully.",
    data: result,
  });
});

export const EquipmentController = {
  createEquipment,
  getEquipmentList,
  updateEquipment,
  deleteEquipment,
};
