import { z } from 'zod';

const createBusinessBodySchema = z.object({
    name: z.string({ message: 'Name is required' }).trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters'),
    description: z.string().trim().optional(),
    address: z.string({ message: 'Address is required' }).trim().min(5, 'Address must be at least 5 characters'),
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
    amenities: z.array(z.string().trim()),
    photos: z.array(z.string().url('Invalid URL format').trim()).optional()
}).refine(data => {
    const hasLat = data.latitude !== undefined && data.latitude !== null;
    const hasLng = data.longitude !== undefined && data.longitude !== null;
    return hasLat === hasLng;
}, {
    message: 'Both latitude and longitude must be provided together',
    path: ['latitude']
});

export const createBusinessValidation = z.object({
    body: createBusinessBodySchema
});

const getBusinessesValidation = z.object({
    query: z.object({
        searchTerm: z.string().optional(),
        page: z.string().optional(),
        limit: z.string().optional(),
        sortBy: z.string().optional(),
        sortOrder: z.string().optional(),
        fields: z.string().optional(),
        amenities: z.string().optional(),
        latitude: z.string().refine((val) => {
            const num = parseFloat(val);
            return !isNaN(num) && num >= -90 && num <= 90;
        }, { message: 'Latitude must be a valid number between -90 and 90' }).optional(),
        longitude: z.string().refine((val) => {
            const num = parseFloat(val);
            return !isNaN(num) && num >= -180 && num <= 180;
        }, { message: 'Longitude must be a valid number between -180 and 180' }).optional(),
        radius: z.string().refine((val) => {
            const num = parseFloat(val);
            return !isNaN(num) && num > 0;
        }, { message: 'Radius must be a positive number' }).optional()
    })
    .superRefine((data, ctx) => {
        const hasLat = data.latitude !== undefined;
        const hasLng = data.longitude !== undefined;
        const hasRadius = data.radius !== undefined;

        if (hasLat && !hasLng) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Longitude is required when latitude is provided',
                path: ['longitude']
            });
        }
        if (hasLng && !hasLat) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Latitude is required when longitude is provided',
                path: ['latitude']
            });
        }
        if (hasRadius && (!hasLat || !hasLng)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Coordinates (latitude and longitude) are required when radius is provided',
                path: ['radius']
            });
        }
    })
});

const getBusinessValidation = z.object({
    params: z.object({
        id: z.string().uuid({ message: 'Invalid Business ID' })
    })
});

const updateBusinessValidation = z.object({
    params: z.object({
        id: z.string().uuid({ message: 'Invalid Business ID' })
    }),
    body: z.object({
        name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100, 'Name must be at most 100 characters').optional(),
        description: z.string().trim().optional(),
        email: z.string().email('Invalid email address').trim().optional(),
        phone: z.string().trim().optional(),
        whatsapp: z.string().trim().optional(),
        address: z.string().trim().min(5, 'Address must be at least 5 characters').optional(),
        latitude: z.number().min(-90).max(90).optional(),
        longitude: z.number().min(-180).max(180).optional(),
        amenities: z.array(z.string().trim()).optional(),
        // Immutable fields, we allow them in schema but ignore them in service to satisfy 'Ignore these fields if client sends them'
        id: z.any().optional(),
        ownerId: z.any().optional(),
        status: z.any().optional(),
        createdAt: z.any().optional(),
        updatedAt: z.any().optional()
    }).strict().superRefine((data, ctx) => {
        const hasLat = data.latitude !== undefined;
        const hasLng = data.longitude !== undefined;

        if (hasLat && !hasLng) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Longitude is required when latitude is provided',
                path: ['longitude']
            });
        }
        if (hasLng && !hasLat) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Latitude is required when longitude is provided',
                path: ['latitude']
            });
        }
    })
});

export const BusinessValidations = {
    createBusinessValidation,
    getBusinessesValidation,
    getBusinessValidation,
    updateBusinessValidation
};
