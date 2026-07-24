import { Request, Response, NextFunction } from 'express';

export const parseData = (req: Request, res: Response, next: NextFunction) => {
    if (req.body && req.body.data) {
        try {
            req.body = JSON.parse(req.body.data);
        } catch (error) {
            return next(new Error('Invalid JSON format in data field'));
        }
    }
    next();
};
