import { z } from "zod";

const addFavoriteValidation = z.object({
  body: z.object({
    businessId: z.string().uuid("Invalid Business ID UUID"),
  }).strict(),
});

const getMyFavoritesValidation = z.object({
  query: z.object({
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
    searchTerm: z.string().optional(),
  }).passthrough(),
});

const removeFavoriteValidation = z.object({
  params: z.object({
    businessId: z.string().uuid("Invalid Business ID UUID"),
  }).strict(),
});

export const FavoriteValidations = {
  addFavoriteValidation,
  getMyFavoritesValidation,
  removeFavoriteValidation,
};
