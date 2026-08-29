import { z } from "zod";

const createClassScheduleValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
  }),
  body: z.object({
    title: z.string({ message: "Title is required." }),
    description: z.string().optional(),
    trainerId: z.string({ message: "Trainer ID is required." }).uuid({ message: "Trainer ID must be a valid UUID." }),
    startTime: z.string({ message: "Start time is required." }).datetime({ message: "Start time must be a valid ISO datetime." }),
    endTime: z.string({ message: "End time is required." }).datetime({ message: "End time must be a valid ISO datetime." }),
    capacity: z.number({ message: "Capacity is required." }).int().positive({ message: "Capacity must be greater than 0." }),
  }).refine(data => new Date(data.startTime) < new Date(data.endTime), {
    message: "End time must be after start time.",
    path: ["endTime"],
  }),
});

const getClassSchedulesValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
  }),
  query: z.object({
    trainerId: z.string().uuid().optional(),
    date: z.string().optional(),
    from: z.string().datetime().optional(),
    to: z.string().datetime().optional(),
    status: z.string().optional(),
    searchTerm: z.string().optional(),
    page: z.string().optional(),
    limit: z.string().optional(),
    sortBy: z.string().optional(),
    sortOrder: z.enum(["asc", "desc"]).optional(),
  }),
});

const updateClassScheduleValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
    id: z.string({ message: "Class ID is required." }).uuid({ message: "Class ID must be a valid UUID." }),
  }),
  body: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    trainerId: z.string().uuid({ message: "Trainer ID must be a valid UUID." }).optional(),
    startTime: z.string().datetime({ message: "Start time must be a valid ISO datetime." }).optional(),
    endTime: z.string().datetime({ message: "End time must be a valid ISO datetime." }).optional(),
    capacity: z.number().int().positive({ message: "Capacity must be greater than 0." }).optional(),
  }).refine(data => {
    if (data.startTime && data.endTime) {
      return new Date(data.startTime) < new Date(data.endTime);
    }
    return true;
  }, {
    message: "End time must be after start time.",
    path: ["endTime"],
  }),
});

const deleteClassScheduleValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
  }),
});

const getClassScheduleDetailsValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
    id: z.string({ message: "Class ID is required." }).uuid({ message: "Class ID must be a valid UUID." }),
  }),
});

export const ClassScheduleValidations = {
  createClassScheduleValidation,
  getClassSchedulesValidation,
  getClassScheduleDetailsValidation,
  updateClassScheduleValidation,
  deleteClassScheduleValidation,
};
