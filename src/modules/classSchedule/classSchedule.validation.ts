import { z } from "zod";

const createClassScheduleValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
  }),
  body: z.object({
    title: z.string({ message: "Title is required." }),
    description: z.string().optional(),
    daysOfWeek: z.array(z.string()).optional(),
    timeSlot: z.string().optional(),
    trainerId: z.string().uuid({ message: "Trainer ID must be a valid UUID." }).optional(),
    trainerIds: z.array(z.string().uuid({ message: "Trainer ID must be a valid UUID." })).optional(),
    startTime: z.string({ message: "Start time is required." }),
    endTime: z.string({ message: "End time is required." }),
    capacity: z.number({ message: "Capacity is required." }).int().positive({ message: "Capacity must be greater than 0." }),
  }),
});

const getClassSchedulesValidation = z.object({
  params: z.object({
    businessId: z.string({ message: "Business ID is required." }).uuid({ message: "Business ID must be a valid UUID." }),
  }),
  query: z.object({
    trainerId: z.string().uuid().optional(),
    date: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
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
    daysOfWeek: z.array(z.string()).optional(),
    timeSlot: z.string().optional(),
    trainerId: z.string().uuid({ message: "Trainer ID must be a valid UUID." }).nullable().optional(),
    trainerIds: z.array(z.string().uuid({ message: "Trainer ID must be a valid UUID." })).optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    startTimeStr: z.string().optional(),
    endTimeStr: z.string().optional(),
    capacity: z.number().int().positive({ message: "Capacity must be greater than 0." }).optional(),
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
