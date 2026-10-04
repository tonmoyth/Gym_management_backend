import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

const validateRequest = (schema: ZodSchema) => {
    return async (req: Request, res: Response, next: NextFunction) => {
        try {
            const parsed: any = await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
                cookies: req.cookies,
            });
            if (parsed && parsed.body !== undefined) {
                req.body = parsed.body;
            }
            next();
        } catch (error: any) {
            next(error);
        }
    };
};

export default validateRequest;
