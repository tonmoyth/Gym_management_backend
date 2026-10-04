import { prisma } from '../../../lib/prisma';
import { NotificationType, Role } from '../../../generated/prisma/enums';
import { NotificationService } from '../../../utils/notification.service';

interface ICreateAnnouncementPayload {
  title: string;
  body: string;
  targetRole?: 'ALL' | 'BUSINESS_OWNER' | 'TRAINER' | 'MEMBER';
}

const createAnnouncement = async (
  payload: ICreateAnnouncementPayload,
  superAdminId: string
) => {
  const { title, body, targetRole = 'ALL' } = payload;

  // 1. Determine target users
  const whereCondition: any = { isActive: true };
  if (targetRole && targetRole !== 'ALL') {
    whereCondition.role = targetRole as Role;
  } else {
    // Deliver to all primary system roles
    whereCondition.role = {
      in: [Role.BUSINESS_OWNER, Role.TRAINER, Role.MEMBER, Role.STAFF]
    };
  }

  const targetUsers = await prisma.user.findMany({
    where: whereCondition,
    select: { id: true, email: true }
  });

  const userIds = targetUsers.map((u) => u.id);

  // 2. Bulk create in-app notifications
  if (userIds.length > 0) {
    await NotificationService.createBulkNotifications(
      userIds,
      title,
      body,
      NotificationType.ANNOUNCEMENT,
      { isSystemAnnouncement: true, targetRole }
    );
  }

  // 3. Record in auditLog for persistent history
  const auditLog = await prisma.auditLog.create({
    data: {
      actorId: superAdminId,
      action: 'SYSTEM_ANNOUNCEMENT_CREATED',
      resource: 'ANNOUNCEMENT',
      details: `System-wide announcement sent: "${title}" to target audience ${targetRole} (${userIds.length} recipients)`,
      metadata: {
        title,
        body,
        targetRole,
        recipientCount: userIds.length,
      }
    },
    include: {
      actor: {
        select: {
          fullName: true,
          email: true
        }
      }
    }
  });

  return {
    id: auditLog.id,
    title,
    body,
    targetRole,
    recipientCount: userIds.length,
    createdBy: auditLog.actor?.fullName || 'Super Admin',
    createdAt: auditLog.createdAt,
  };
};

const getAnnouncements = async (query: any) => {
  const page = Number(query.page) || 1;
  const limit = Number(query.limit) || 20;
  const skip = (page - 1) * limit;

  const whereConditions: any = {
    action: 'SYSTEM_ANNOUNCEMENT_CREATED'
  };

  const [total, logs] = await Promise.all([
    prisma.auditLog.count({ where: whereConditions }),
    prisma.auditLog.findMany({
      where: whereConditions,
      include: {
        actor: {
          select: {
            fullName: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    })
  ]);

  const data = logs.map((log) => {
    const meta = (log.metadata as any) || {};
    return {
      id: log.id,
      title: meta.title || log.details || 'System Announcement',
      body: meta.body || log.details || '',
      targetRole: meta.targetRole || 'ALL',
      recipientCount: meta.recipientCount ?? 0,
      createdBy: log.actor?.fullName || 'Super Admin',
      createdAt: log.createdAt,
    };
  });

  return {
    meta: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    },
    data
  };
};

export const SystemAnnouncementService = {
  createAnnouncement,
  getAnnouncements,
};
