import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";

import httpStatus from "http-status";
import { FavoriteService } from "./favorite.service";

const addFavorite = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { businessId } = req.body;

  const result = await FavoriteService.addFavorite(userId, businessId);

  sendResponse(res, {
    statusCode: httpStatus.CREATED,
    success: true,
    message: "Business added to favorites successfully.",
    data: result,
  });
});

const getMyFavorites = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const result = await FavoriteService.getMyFavorites(userId, req.query);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Favorites retrieved successfully.",
    meta: result.meta,
    data: result.data,
  });
});

const removeFavorite = catchAsync(async (req: Request, res: Response) => {
  const userId = req.user.id;
  const { businessId } = req.params;

  const result = await FavoriteService.removeFavorite(userId, businessId as string);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Business removed from favorites successfully.",
    data: result,
  });
});

export const FavoriteController = {
  addFavorite,
  getMyFavorites,
  removeFavorite,
};
