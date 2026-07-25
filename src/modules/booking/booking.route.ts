import express from 'express';
import { BookingController } from './booking.controller';
import { checkAuth } from '../../middlewares/checkAuth';
import { USER_ROLE } from '../Business/business.constant';
import validateRequest from '../../middlewares/validateRequest';
import { z } from 'zod';

const router = express.Router();

const getPendingBookingsValidation = z.object({
    params: z.object({
        businessId: z.string().uuid({ message: 'Invalid businessId format' })
    })
});

router.get(
    '/:businessId/bookings/pending',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    validateRequest(getPendingBookingsValidation),
    BookingController.getPendingBookings
);

export const bookingRoutes = router;
