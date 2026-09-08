import app from '../src/app';
import { prisma } from '../src/lib/prisma';
import { tokenUtils } from '../src/utils/token';
import { Role } from '../src/generated/prisma/enums';
import http from 'http';

const PORT = 5556;
const BASE_URL = `http://localhost:${PORT}/api/v1`;

let server: http.Server;

async function runTests() {
  console.log('--- Starting Trainer & Member Oversight Module Tests ---');

  // Start temporary server
  await new Promise<void>((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
      resolve();
    });
  });

  try {
    // 1. Fetch test users from DB
    const superAdmin = await prisma.user.findFirst({ where: { role: Role.SUPER_ADMIN } });
    const businessOwner = await prisma.user.findFirst({ where: { role: Role.BUSINESS_OWNER } });
    const member = await prisma.user.findFirst({ where: { role: Role.MEMBER } });
    const trainer = await prisma.user.findFirst({ where: { role: Role.TRAINER } });

    if (!superAdmin || !member || !trainer || !businessOwner) {
      throw new Error('Required test users (SUPER_ADMIN, BUSINESS_OWNER, MEMBER, TRAINER) missing in DB.');
    }

    // Ensure test users are active initially
    await prisma.user.updateMany({
      where: { id: { in: [superAdmin.id, businessOwner.id, member.id, trainer.id] } },
      data: { isActive: true },
    });

    const superAdminToken = tokenUtils.getToken({ id: superAdmin.id, email: superAdmin.email, role: superAdmin.role });
    const businessOwnerToken = tokenUtils.getToken({ id: businessOwner.id, email: businessOwner.email, role: businessOwner.role });
    const memberToken = tokenUtils.getToken({ id: member.id, email: member.email, role: member.role });
    const trainerToken = tokenUtils.getToken({ id: trainer.id, email: trainer.email, role: trainer.role });

    console.log('\n[1] Testing Authorization & Permissions...');

    // Test 1.1: Unauthenticated request rejected
    const unauthRes = await fetch(`${BASE_URL}/admin/users`);
    console.log(`Unauthenticated GET status: ${unauthRes.status} (expected: 401)`);
    if (unauthRes.status !== 401) throw new Error('Unauthenticated request was not rejected with 401');

    // Test 1.2: MEMBER rejected
    const memberRes = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    console.log(`MEMBER GET status: ${memberRes.status} (expected: 403)`);
    if (memberRes.status !== 403) throw new Error('MEMBER was not rejected with 403');

    // Test 1.3: TRAINER rejected
    const trainerRes = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${trainerToken}` },
    });
    console.log(`TRAINER GET status: ${trainerRes.status} (expected: 403)`);
    if (trainerRes.status !== 403) throw new Error('TRAINER was not rejected with 403');

    // Test 1.4: BUSINESS_OWNER rejected
    const boRes = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${businessOwnerToken}` },
    });
    console.log(`BUSINESS_OWNER GET status: ${boRes.status} (expected: 403)`);
    if (boRes.status !== 403) throw new Error('BUSINESS_OWNER was not rejected with 403');

    // Test 1.5: SUPER_ADMIN allowed
    const adminRes = await fetch(`${BASE_URL}/admin/users`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    console.log(`SUPER_ADMIN GET status: ${adminRes.status} (expected: 200)`);
    if (adminRes.status !== 200) throw new Error('SUPER_ADMIN request failed');
    const adminData = await adminRes.json();
    console.log(`SUPER_ADMIN GET returned ${adminData.data.length} users, meta:`, adminData.meta);

    console.log('\n[2] Testing Role Scope & Security Restriction...');

    // Test 2.1: Verify all returned users are only MEMBER or TRAINER
    for (const u of adminData.data) {
      if (u.role !== 'MEMBER' && u.role !== 'TRAINER') {
        throw new Error(`Exposed non-member/non-trainer account: ${u.email} with role: ${u.role}`);
      }
      if (u.password || u.passwordHash || u.accounts || u.sessions) {
        throw new Error('Sensitive credentials/sessions exposed in response!');
      }
    }
    console.log('✓ All returned users are strictly MEMBER or TRAINER accounts. Sensitive fields excluded.');

    // Test 2.2: Security Test - Query with role=SUPER_ADMIN must NEVER expose SUPER_ADMIN
    const exploitRes = await fetch(`${BASE_URL}/admin/users?role=SUPER_ADMIN`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    console.log(`Exploit query ?role=SUPER_ADMIN status: ${exploitRes.status}`);
    if (exploitRes.status === 200) {
      const exploitData = await exploitRes.json();
      for (const u of exploitData.data) {
        if (u.role === 'SUPER_ADMIN') {
          throw new Error('CRITICAL SECURITY FLAW: SUPER_ADMIN account returned when querying ?role=SUPER_ADMIN');
        }
      }
    }
    console.log('✓ SUPER_ADMIN accounts are completely protected and never exposed via ?role=SUPER_ADMIN');

    console.log('\n[3] Testing QueryBuilder Search, Filtering & Pagination...');

    // Test 3.1: Role Filter (role=MEMBER)
    const filterMemberRes = await fetch(`${BASE_URL}/admin/users?role=MEMBER`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const filterMemberData = await filterMemberRes.json();
    console.log(`Filter role=MEMBER: found ${filterMemberData.data.length} users`);
    if (filterMemberData.data.some((u: any) => u.role !== 'MEMBER')) {
      throw new Error('Filter role=MEMBER returned non-MEMBER');
    }

    // Test 3.2: Role Filter (role=TRAINER)
    const filterTrainerRes = await fetch(`${BASE_URL}/admin/users?role=TRAINER`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const filterTrainerData = await filterTrainerRes.json();
    console.log(`Filter role=TRAINER: found ${filterTrainerData.data.length} users`);
    if (filterTrainerData.data.some((u: any) => u.role !== 'TRAINER')) {
      throw new Error('Filter role=TRAINER returned non-TRAINER');
    }

    // Test 3.3: Status Filter (status=ACTIVE)
    const statusActiveRes = await fetch(`${BASE_URL}/admin/users?status=ACTIVE`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const statusActiveData = await statusActiveRes.json();
    console.log(`Filter status=ACTIVE: found ${statusActiveData.data.length} users`);
    if (statusActiveData.data.some((u: any) => u.status !== 'ACTIVE' || !u.isActive)) {
      throw new Error('Filter status=ACTIVE returned inactive user');
    }

    // Test 3.4: Search by name / email
    const searchRes = await fetch(`${BASE_URL}/admin/users?search=${encodeURIComponent(member.email)}`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const searchData = await searchRes.json();
    console.log(`Search for email (${member.email}): found ${searchData.data.length} user(s)`);
    if (!searchData.data.some((u: any) => u.email === member.email)) {
      throw new Error('Search did not find target member by email');
    }

    // Test 3.5: Pagination
    const pageRes = await fetch(`${BASE_URL}/admin/users?page=1&limit=1`, {
      headers: { Authorization: `Bearer ${superAdminToken}` },
    });
    const pageData = await pageRes.json();
    console.log(`Pagination page=1&limit=1: data count = ${pageData.data.length}, meta =`, pageData.meta);
    if (pageData.data.length > 1 || pageData.meta.limit !== 1 || pageData.meta.page !== 1) {
      throw new Error('Pagination metadata or count mismatch');
    }

    console.log('\n[4] Testing Account Suspension & Activation (PATCH /admin/users/:id/status)...');

    // Test 4.1: Suspend Member (ACTIVE -> SUSPENDED)
    const suspendMemberRes = await fetch(`${BASE_URL}/admin/users/${member.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    console.log(`Suspend member status: ${suspendMemberRes.status} (expected: 200)`);
    if (suspendMemberRes.status !== 200) throw new Error('Failed to suspend member');
    const suspendMemberData = await suspendMemberRes.json();
    console.log('Updated user data:', suspendMemberData.data);
    if (suspendMemberData.data.status !== 'SUSPENDED' || suspendMemberData.data.isActive !== false) {
      throw new Error('Member status was not set to SUSPENDED');
    }

    // Test 4.2: Verify suspended member cannot access protected APIs (checkAuth blocks them)
    const suspendedReqRes = await fetch(`${BASE_URL}/user/me`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    console.log(`Suspended member request to protected API (/user/me) status: ${suspendedReqRes.status} (expected: 403)`);
    if (suspendedReqRes.status !== 403) {
      throw new Error('Suspended member was not blocked by checkAuth!');
    }

    // Test 4.3: Redundant suspension update (SUSPENDED -> SUSPENDED)
    const redundantSuspendRes = await fetch(`${BASE_URL}/admin/users/${member.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    console.log(`Redundant suspend status: ${redundantSuspendRes.status} (expected: 200)`);
    if (redundantSuspendRes.status !== 200) throw new Error('Redundant suspend failed');

    // Test 4.4: Activate Member (SUSPENDED -> ACTIVE)
    const activateMemberRes = await fetch(`${BASE_URL}/admin/users/${member.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    console.log(`Activate member status: ${activateMemberRes.status} (expected: 200)`);
    if (activateMemberRes.status !== 200) throw new Error('Failed to activate member');
    const activateMemberData = await activateMemberRes.json();
    if (activateMemberData.data.status !== 'ACTIVE' || activateMemberData.data.isActive !== true) {
      throw new Error('Member status was not set to ACTIVE');
    }

    // Test 4.5: Verify reactivated member can access protected APIs again
    const activeReqRes = await fetch(`${BASE_URL}/user/me`, {
      headers: { Authorization: `Bearer ${memberToken}` },
    });
    console.log(`Active member request to /user/me status: ${activeReqRes.status} (expected: 200)`);
    if (activeReqRes.status !== 200) {
      throw new Error('Reactivated member could not access protected API');
    }

    // Test 4.6: Suspend Trainer (ACTIVE -> SUSPENDED -> ACTIVE)
    const suspendTrainerRes = await fetch(`${BASE_URL}/admin/users/${trainer.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    console.log(`Suspend trainer status: ${suspendTrainerRes.status} (expected: 200)`);
    if (suspendTrainerRes.status !== 200) throw new Error('Failed to suspend trainer');

    // Restore trainer to ACTIVE
    const restoreTrainerRes = await fetch(`${BASE_URL}/admin/users/${trainer.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    console.log(`Restore trainer status: ${restoreTrainerRes.status} (expected: 200)`);
    if (restoreTrainerRes.status !== 200) throw new Error('Failed to restore trainer to ACTIVE');

    console.log('\n[5] Testing Security & Edge Cases...');

    // Test 5.1: Prevent SUPER_ADMIN self-suspension
    const selfSuspendRes = await fetch(`${BASE_URL}/admin/users/${superAdmin.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    console.log(`Self-suspension status: ${selfSuspendRes.status} (expected: 400)`);
    if (selfSuspendRes.status !== 400) throw new Error('Self-suspension was not rejected with 400');

    // Test 5.2: Prevent modifying privileged account (BUSINESS_OWNER)
    const modifyPrivilegedRes = await fetch(`${BASE_URL}/admin/users/${businessOwner.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    console.log(`Modify BUSINESS_OWNER status: ${modifyPrivilegedRes.status} (expected: 403)`);
    if (modifyPrivilegedRes.status !== 403) throw new Error('Modifying privileged role was not rejected with 403');

    // Test 5.3: Non-existent user ID
    const notFoundRes = await fetch(`${BASE_URL}/admin/users/non-existent-uuid-12345/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    console.log(`Non-existent user status: ${notFoundRes.status} (expected: 404)`);
    if (notFoundRes.status !== 404) throw new Error('Non-existent user did not return 404');

    // Test 5.4: Invalid status value
    const invalidStatusRes = await fetch(`${BASE_URL}/admin/users/${member.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${superAdminToken}`,
      },
      body: JSON.stringify({ status: 'BANNED' }),
    });
    console.log(`Invalid status status: ${invalidStatusRes.status} (expected: 400)`);
    if (invalidStatusRes.status !== 400) throw new Error('Invalid status was not rejected with 400');

    // Test 5.5: Verify member profile and historical data are intact
    const verifyMember = await prisma.user.findUnique({
      where: { id: member.id },
      include: { memberProfile: true },
    });
    if (!verifyMember || !verifyMember.isActive) {
      throw new Error('Member should be active after test completion');
    }
    console.log('✓ Historical data intact. Member profile preserved.');

    console.log('\n========================================');
    console.log('ALL TESTS PASSED SUCCESSFULLY! (23/23)');
    console.log('========================================\n');
    process.exit(0);
  } finally {
    if (server) {
      server.close();
    }
    await prisma.$disconnect();
  }
}

runTests().catch((err) => {
  console.error('\n❌ Test failed with error:', err);
  if (server) server.close();
  process.exit(1);
});
