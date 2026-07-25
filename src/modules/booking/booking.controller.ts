import { Request, Response } from 'express';
import { catchAsync } from '../../shared/catchAsync';
import { BookingService } from './booking.service';
import sendResponse from '../../utils/sendResponse';

const getPendingBookings = catchAsync(async (req: Request, res: Response) => {
    const businessId = req.params.businessId as string;
    const ownerId = req.user.id as string;
    const query = req.query as Record<string, unknown>;

    const result = await BookingService.getPendingBookings(businessId, ownerId, query);

    sendResponse(res, {
        statusCode: 200,
        success: true,
        message: 'Pending booking requests retrieved successfully.',
        meta: result.meta,
        data: result.data,
    });
});

export const BookingController = {
    getPendingBookings,
};
