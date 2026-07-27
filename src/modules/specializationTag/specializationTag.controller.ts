import { Request, Response } from "express";
import { catchAsync } from "../../shared/catchAsync";
import sendResponse from "../../utils/sendResponse";
import { SpecializationTagService } from "./specializationTag.service";

const createSpecializationTag = catchAsync(async (req: Request, res: Response) => {
    const result = await SpecializationTagService.createSpecializationTag(req.body);

    sendResponse(res, {
        statusCode: 201,
        success: true,
        message: "Specialization tag created successfully.",
        data: result,
    });
});

export const SpecializationTagController = {
    createSpecializationTag,
};
