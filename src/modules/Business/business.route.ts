import express from 'express';
import { BusinessController } from './business.controller';
import validateRequest from '../../middlewares/validateRequest';
import { BusinessValidations } from './business.validation';
import { checkAuth } from '../../middlewares/checkAuth';
import { upload } from '../../middlewares/upload';
import { parseData } from '../../middlewares/parseData';
import { USER_ROLE } from './business.constant';

const router = express.Router();

router.post(
    '/',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    validateRequest(BusinessValidations.createBusinessValidation),
    BusinessController.createBusiness
);

router.get(
    '/',
    validateRequest(BusinessValidations.getBusinessesValidation),
    BusinessController.getBusinesses
);

router.get(
    '/me',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    BusinessController.getMyBusiness
);

router.get(
    '/:id/dashboard',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    BusinessController.getBusinessDashboard
);

router.get(
    '/:id',
    validateRequest(BusinessValidations.getBusinessValidation),
    BusinessController.getBusiness
);

router.patch(
    '/:id',
    // @ts-ignore
    checkAuth(USER_ROLE.BUSINESS_OWNER),
    upload.fields([
        { name: "logo", maxCount: 1 },
        { name: "photos", maxCount: 20 }
    ]),
    parseData,
    validateRequest(BusinessValidations.updateBusinessValidation),
    BusinessController.updateBusiness
);

export const businessRoutes = router;
