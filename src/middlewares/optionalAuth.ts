import { Request, Response, NextFunction } from 'express';
import { catchAsync } from '../shared/catchAsync';
import { prisma } from '../lib/prisma';
import { jwtUtils } from '../utils/jwtUtils';
import { envVeriables } from '../config/envConfig';

export const optionalAuth = () => {
    return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
        const token =
            req.cookies['accessToken'] ||
            req.headers.authorization?.split(' ')[1];

        if (!token) {
            return next();
        }

        const result = jwtUtils.verifyToken(token, envVeriables.JWT_SECRET_KEY);

        if (!result.seccess || !result.data) {
            return next();
        }

        const decoded = result.data as { email: string; [key: string]: any };
        const email = decoded.email;

        if (!email) {
            return next();
        }

        const user = await prisma.user.findUnique({
            where: { email },
        });

        if (user) {
            req.user = user;
        }
        
        next();
    });
};
