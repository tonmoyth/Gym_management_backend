import { z } from "zod";

const createEquipmentValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
  }),
  body: z.object({
    name: z.string({ message: "Equipment name is required." }),
    quantity: z.number({ message: "Quantity is required." }).int().positive({ message: "Quantity must be a positive integer." }),
    condition: z.enum(["GOOD", "NEEDS_REPAIR", "OUT_OF_SERVICE"], {
      message: "Condition must be GOOD, NEEDS_REPAIR, or OUT_OF_SERVICE.",
    }),
    lastMaintenanceDate: z.string().datetime({ message: "Must be a valid ISO datetime string." }).optional(),
  }),
});

const getEquipmentValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
  }),
  query: z.object({
    condition: z.enum(["GOOD", "NEEDS_REPAIR", "OUT_OF_SERVICE"]).optional(),
    searchTerm: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

const updateEquipmentValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
    id: z.string({ message: "Equipment ID is required." }).uuid({ message: "Equipment ID must be a valid UUID." }),
  }),
  body: z.object({
    name: z.string().optional(),
    quantity: z.number().int().positive({ message: "Quantity must be a positive integer." }).optional(),
    condition: z.enum(["GOOD", "NEEDS_REPAIR", "OUT_OF_SERVICE"]).optional(),
    lastMaintenanceDate: z.string().datetime({ message: "Must be a valid ISO datetime string." }).optional().nullable(),
  }),
});

const deleteEquipmentValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
    id: z.string({ message: "Equipment ID is required." }).uuid({ message: "Equipment ID must be a valid UUID." }),
  }),
});

export const EquipmentValidations = {
  createEquipmentValidation,
  getEquipmentValidation,
  updateEquipmentValidation,
  deleteEquipmentValidation,
};
