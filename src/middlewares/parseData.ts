import { Request, Response, NextFunction } from 'express';

export const parseData = (req: Request, res: Response, next: NextFunction) => {
    if (req.body && req.body.data) {
        try {
            req.body = JSON.parse(req.body.data);
        } catch (error) {
            return next(new Error('Invalid JSON format in data field'));
        }
    } else if (req.body && typeof req.body === 'object') {
        for (const key of Object.keys(req.body)) {
            if (typeof req.body[key] === 'string') {
                const val = req.body[key].trim();
                if ((val.startsWith('[') && val.endsWith(']')) || (val.startsWith('{') && val.endsWith('}'))) {
                    try {
                        req.body[key] = JSON.parse(val);
                    } catch {
                        // ignore if not valid JSON
                    }
                }
            }
        }
    }
    next();
};
