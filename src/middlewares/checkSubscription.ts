import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import AppError from '../errors/AppError';
import { catchAsync } from '../shared/catchAsync';
import {
  BusinessStatus,
  BusinessSubscriptionStatus,
  NotificationType,
  Role,
} from '../generated/prisma/enums';
import { NotificationService } from '../utils/notification.service';

declare global {
  namespace Express {
    interface Request {
      business?: any;
      subscription?: any;
    }
  }
}

/**
 * Middleware ensuring that a Business Owner (or Business Staff) possesses an ACTIVE business
 * and an ACTIVE, non-expired SaaS subscription before accessing gym management capabilities.
 *
 * Super Admin bypasses this check.
 * Subscriptions expiring or expired are updated dynamically to EXPIRED in real time.
 */
export const checkSubscription = () => {
  return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      throw new AppError(401, 'You are not authorized');
    }

    // 1. SUPER_ADMIN has platform-wide unrestricted access
    if (user.role === Role.SUPER_ADMIN) {
      return next();
    }

    // 2. Only enforce on BUSINESS_OWNER or STAFF trying to access business management
    if (user.role !== Role.BUSINESS_OWNER && user.role !== Role.STAFF) {
      return next();
    }

    if (user.role === Role.BUSINESS_OWNER) {
      const ownedBusiness = await prisma.business.findUnique({
        where: { ownerId: user.id },
        include: {
          businessSubscription: true,
        },
      });

      if (!ownedBusiness) {
        throw new AppError(
          404,
          'Business profile not found. Please complete business setup first.'
        );
      }

      // Check Business Platform Approval Status
      if (ownedBusiness.status === BusinessStatus.PENDING_APPROVAL) {
        throw new AppError(
          403,
          'Your business is pending approval. Please select a subscription plan and complete payment verification to activate your gym.'
        );
      }

      if (ownedBusiness.status === BusinessStatus.REJECTED) {
        throw new AppError(
          403,
          'Your business application has been rejected. Please contact support.'
        );
      }

      if (ownedBusiness.status === BusinessStatus.SUSPENDED) {
        throw new AppError(
          403,
          'Your business has been suspended. Please contact support.'
        );
      }

      if (ownedBusiness.status !== BusinessStatus.ACTIVE) {
        throw new AppError(
          403,
          `Business is not active (Current status: ${ownedBusiness.status}).`
        );
      }

      // Check SaaS Subscription Status
      const sub = ownedBusiness.businessSubscription;
      if (!sub) {
        throw new AppError(
          403,
          'No SaaS subscription found for this gym. Please select a subscription plan and make payment.'
        );
      }

      if (sub.status === BusinessSubscriptionStatus.PENDING) {
        throw new AppError(
          403,
          'Your subscription payment is currently pending admin verification. Gym management access will be unlocked upon approval.'
        );
      }

      if (sub.status === BusinessSubscriptionStatus.CANCELLED) {
        throw new AppError(
          403,
          'Your gym subscription has been cancelled. Please renew your subscription to continue managing your gym.'
        );
      }

      const now = new Date();

      // Real-time expiration enforcement (not relying solely on background schedulers)
      if (sub.status === BusinessSubscriptionStatus.ACTIVE) {
        if (sub.endDate && new Date(sub.endDate) < now) {
          // Dynamically transition stored status to EXPIRED
          await prisma.businessSubscription.update({
            where: { id: sub.id },
            data: { status: BusinessSubscriptionStatus.EXPIRED },
          });

          // In-app Notification
          try {
            await NotificationService.createNotification(
              user.id,
              'SaaS Subscription Expired ⚠️',
              'Your SaaS subscription has expired. Please renew to continue managing your gym.',
              NotificationType.SYSTEM,
              { businessId: ownedBusiness.id, status: 'EXPIRED' }
            );
          } catch (e: any) {
            console.error('Failed to notify expired subscription:', e.message);
          }

          throw new AppError(
            403,
            'Your SaaS subscription has expired. Please renew to continue managing your gym.'
          );
        }
      } else if (sub.status === BusinessSubscriptionStatus.EXPIRED) {
        throw new AppError(
          403,
          'Your SaaS subscription has expired. Please renew to continue managing your gym.'
        );
      }

      req.business = ownedBusiness;
      req.subscription = sub;
      req.businessId = ownedBusiness.id;
      return next();
    }

    // 4. For STAFF, check the staff's associated business
    if (user.role === Role.STAFF) {
      const requestedBusinessId =
        req.params.businessId ||
        req.query.businessId ||
        (req.headers['x-business-id'] as string) ||
        req.body?.businessId;

      if (!requestedBusinessId) {
        return next();
      }

      const business = await prisma.business.findUnique({
        where: { id: String(requestedBusinessId) },
        include: { businessSubscription: true },
      });

      if (!business || business.status !== BusinessStatus.ACTIVE) {
        throw new AppError(403, 'The gym facility is not currently active.');
      }

      const sub = business.businessSubscription;
      if (!sub || sub.status !== BusinessSubscriptionStatus.ACTIVE) {
        throw new AppError(
          403,
          'The gym facility does not have an active subscription.'
        );
      }

      if (sub.endDate && new Date(sub.endDate) < new Date()) {
        throw new AppError(
          403,
          'The gym facility SaaS subscription has expired.'
        );
      }

      req.business = business;
      req.subscription = sub;
      return next();
    }

    next();
  });
};
