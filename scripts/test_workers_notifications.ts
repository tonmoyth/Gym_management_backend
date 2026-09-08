import { prisma } from '../src/lib/prisma';
import { redis } from '../src/config/redis';
import { BusinessManagementService } from '../src/modules/super_admin/bussiness_management/businessManagement.service';
import { TrainerMemberOversightService } from '../src/modules/super_admin/trainer_member_oversight/trainerMemberOversight.service';
import { startNotificationWorker } from '../src/workers/notificationWorker';
import { BusinessStatus, Role, NotificationType } from '../src/generated/prisma/enums';

async function runWorkerTests() {
  console.log('--- Testing Redis Workers for Notifications & Emails ---');

  // Start notification worker in this process
  startNotificationWorker();

  // Find test users
  const superAdmin = await prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } });
  const member = await prisma.user.findFirst({ where: { role: Role.MEMBER } });

  if (!superAdmin || !member) {
    throw new Error('Required test users missing in DB.');
  }

  // Create or find a test business owner and business
  let testOwner = await prisma.user.findUnique({ where: { email: 'worker_test_owner@example.com' } });
  if (!testOwner) {
    testOwner = await prisma.user.create({
      data: {
        email: 'worker_test_owner@example.com',
        fullName: 'Worker Test Owner',
        role: Role.BUSINESS_OWNER,
        isActive: true,
      },
    });
  }

  // Clean up any old test business
  await prisma.business.deleteMany({ where: { ownerId: testOwner.id } });

  // Create a pending business
  const testBusiness = await prisma.business.create({
    data: {
      name: 'Worker Test Gym',
      ownerId: testOwner.id,
      address: '123 Fitness Street',
      status: BusinessStatus.PENDING_APPROVAL,
    },
  });

  console.log(`Created test business ${testBusiness.id} with status PENDING_APPROVAL`);

  // 1. Test approveBusiness
  console.log('\n[1] Testing approveBusiness notification & worker processing...');
  const beforeApproveCount = await prisma.notification.count({ where: { userId: testOwner.id } });
  await BusinessManagementService.approveBusiness(testBusiness.id, superAdmin.id);

  // Wait a moment for the worker to pop the job from Redis and insert notification into DB
  let approvedNotificationFound = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const notif = await prisma.notification.findFirst({
      where: {
        userId: testOwner.id,
        type: NotificationType.SYSTEM,
        title: { contains: 'Business Approved' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (notif) {
      console.log('✓ Found in-app notification created by worker:', notif.title, '-', notif.body);
      approvedNotificationFound = true;
      break;
    }
  }
  if (!approvedNotificationFound) {
    throw new Error('Notification for approveBusiness was not created by worker!');
  }

  // 2. Test suspendBusiness
  console.log('\n[2] Testing suspendBusiness notification & worker processing...');
  await BusinessManagementService.suspendBusiness(testBusiness.id, superAdmin.id, 'Routine compliance review');

  let suspendedBizNotifFound = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const notif = await prisma.notification.findFirst({
      where: {
        userId: testOwner.id,
        type: NotificationType.SYSTEM,
        title: { contains: 'Business Suspended' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (notif) {
      console.log('✓ Found in-app notification created by worker:', notif.title, '-', notif.body);
      suspendedBizNotifFound = true;
      break;
    }
  }
  if (!suspendedBizNotifFound) {
    throw new Error('Notification for suspendBusiness was not created by worker!');
  }

  // 3. Test rejectBusiness
  console.log('\n[3] Testing rejectBusiness notification & worker processing...');
  await prisma.business.update({
    where: { id: testBusiness.id },
    data: { status: BusinessStatus.PENDING_APPROVAL },
  });

  await BusinessManagementService.rejectBusiness(testBusiness.id, superAdmin.id, 'Incomplete documentation');

  let rejectedBizNotifFound = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const notif = await prisma.notification.findFirst({
      where: {
        userId: testOwner.id,
        type: NotificationType.SYSTEM,
        title: { contains: 'Business Application' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (notif) {
      console.log('✓ Found in-app notification created by worker:', notif.title, '-', notif.body);
      rejectedBizNotifFound = true;
      break;
    }
  }
  if (!rejectedBizNotifFound) {
    throw new Error('Notification for rejectBusiness was not created by worker!');
  }

  // 4. Test updateAccountStatus (suspend account)
  console.log('\n[4] Testing updateAccountStatus SUSPENDED notification & worker processing...');
  await TrainerMemberOversightService.updateAccountStatus(member.id, superAdmin.id, 'SUSPENDED');

  let accountSuspendedNotifFound = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const notif = await prisma.notification.findFirst({
      where: {
        userId: member.id,
        type: NotificationType.SYSTEM,
        title: { contains: 'Account Suspended' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (notif) {
      console.log('✓ Found in-app notification created by worker:', notif.title, '-', notif.body);
      accountSuspendedNotifFound = true;
      break;
    }
  }
  if (!accountSuspendedNotifFound) {
    throw new Error('Notification for ACCOUNT_SUSPENDED was not created by worker!');
  }

  // 5. Test updateAccountStatus (activate account)
  console.log('\n[5] Testing updateAccountStatus ACTIVE notification & worker processing...');
  await TrainerMemberOversightService.updateAccountStatus(member.id, superAdmin.id, 'ACTIVE');

  let accountActivatedNotifFound = false;
  for (let i = 0; i < 15; i++) {
    await new Promise((r) => setTimeout(r, 500));
    const notif = await prisma.notification.findFirst({
      where: {
        userId: member.id,
        type: NotificationType.SYSTEM,
        title: { contains: 'Account Activated' },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (notif) {
      console.log('✓ Found in-app notification created by worker:', notif.title, '-', notif.body);
      accountActivatedNotifFound = true;
      break;
    }
  }
  if (!accountActivatedNotifFound) {
    throw new Error('Notification for ACCOUNT_ACTIVATED was not created by worker!');
  }

  // Clean up test data
  console.log('\n[Cleanup] Cleaning up test data...');
  await prisma.business.deleteMany({ where: { ownerId: testOwner.id } });
  await prisma.notification.deleteMany({ where: { userId: testOwner.id } });
  await prisma.user.delete({ where: { id: testOwner.id } });

  console.log('\n========================================');
  console.log('ALL WORKER NOTIFICATION TESTS PASSED! 🎉');
  console.log('========================================\n');
  process.exit(0);
}

runWorkerTests().catch((err) => {
  console.error('❌ Test failed with error:', err);
  process.exit(1);
});
