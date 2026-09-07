import express from "express";
import { checkAuth } from "../../middlewares/checkAuth";
import { USER_ROLE } from "../Business/business.constant";
import validateRequest from "../../middlewares/validateRequest";
import { FavoriteValidations } from "./favorite.validation";
import { FavoriteController } from "./favorite.controller";

const router = express.Router();

router.post(
  "/",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  validateRequest(FavoriteValidations.addFavoriteValidation),
  FavoriteController.addFavorite
);

router.get(
  "/",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  validateRequest(FavoriteValidations.getMyFavoritesValidation),
  FavoriteController.getMyFavorites
);

router.delete(
  "/:businessId",
  // @ts-ignore
  checkAuth(USER_ROLE.MEMBER),
  validateRequest(FavoriteValidations.removeFavoriteValidation),
  FavoriteController.removeFavorite
);

export const favoriteRoutes = router;
