import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../shared/catchAsync';
import AppError from '../errors/AppError';
import { jwtUtils } from '../utils/jwtUtils';
import { envVeriables } from '../config/envConfig';

declare global {
    namespace Express {
        interface Request {
            user?: any;
        }
    }
}

export const checkAuthTemp = () => {
    return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const token =
            req.cookies['accessToken'] ||
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            throw new AppError(401, 'You are not authorized');
        }

        const result = jwtUtils.verifyToken(token, envVeriables.JWT_SECRET_KEY);

        if (!result.seccess || !result.data) {
            throw new AppError(401, 'Invalid or expired token');
        }

        // decoded payload: { id, email, role, username, iat, exp }
        req.user = result.data;
        next();
    });
};