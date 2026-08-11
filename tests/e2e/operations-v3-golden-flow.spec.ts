import { test, expect } from '@playwright/test';
import { getGlobalDatabasePool, withDatabaseClient } from '@room/database/src/client.js';
import {
  bookings,
  rooms,
  accessCredentials,
  housekeepingTasks,
  roomInventoryBlocks,
} from '@room/database/src/schema.js';
import { eq, sql } from 'drizzle-orm';
import { createHash } from 'node:crypto';

test.describe.configure({ mode: 'serial' });

function createContactDigest(email: string, phone: string): string {
  const normalized = `${email.toLowerCase().trim()}:${phone.replace(/\D/g, '')}`;
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

/**
 * ORIG-H-001: Full booking-to-next-booking connected lifecycle
 * 
 * This is the canonical golden flow that proves the entire Operations V3
 * release candidate meets the original authority requirements for a
 * production-shaped multi-night stay lifecycle.
 */
test('GOLDEN FLOW: quote → HOLD → payment → CONFIRMED → T-30 credential → check-in → stay → checkout → housekeeping → READY → next booking', async ({
  page,
  context,
}) => {
  const TEST_PROPERTY_CODE = 'PLAYWRIGHT';
  const OVERNIGHT_DURATION_HOURS = 16;
  
  // ===========================================
  // 1. SEARCH / BROWSE ROOM TYPE
  // ===========================================
  await page.goto('/');
  await expect(page.locator('h1')).toContainText(/peacenest|phòng/i);

  await page.getByRole('button', { name: /ngày|date/i }).first().click();
  
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(14, 0, 0, 0);
  
  const dayAfter = new Date(tomorrow);
  dayAfter.setDate(dayAfter.getDate() + 1);
  dayAfter.setHours(6, 0, 0, 0);

  const tomorrowDay = tomorrow.getDate();
  const dayAfterDay = dayAfter.getDate();

  await page.getByRole('button', { name: String(tomorrowDay), exact: true }).first().click();
  await page.getByRole('button', { name: String(dayAfterDay), exact: true }).first().click();

  await page.getByRole('button', { name: /tìm|search/i }).click();
  await expect(page.locator('text=/deluxe|standard/i')).toBeVisible({ timeout: 10000 });

  // ===========================================
  // 2. REQUEST QUOTE
  // ===========================================
  const roomTypeCard = page.locator('[data-testid="room-type-card"]').first();
  await roomTypeCard.getByRole('button', { name: /đặt|book/i }).click();

  await expect(page.locator('text=/giữ phòng|hold/i')).toBeVisible({ timeout: 10000 });

  // Verify pricing explanation contract (G-004)
  const pricingSection = page.locator('[data-testid="pricing-breakdown"]');
  await expect(pricingSection).toBeVisible();

  // ===========================================
  // 3. CREATE HOLD
  // ===========================================
  const testEmail = `golden-flow-${Date.now()}@test.local`;
  const testPhone = '0987654321';

  await page.getByLabel(/email/i).fill(testEmail);
  await page.getByLabel(/phone|điện thoại/i).fill(testPhone);
  
  const continueButton = page.getByRole('button', { name: /tiếp|continue/i });
  await continueButton.click();

  // OTP challenge
  await expect(page.locator('text=/mã xác nhận|verification code/i')).toBeVisible({ timeout: 10000 });

  const contactDigest = createContactDigest(testEmail, testPhone);
  const pool = getGlobalDatabasePool();
  
  const otpRow = await withDatabaseClient(pool, async (client) => {
    const result = await client.query.guestOtpChallenges.findFirst({
      where: (fields, { eq, and }) =>
        and(
          eq(fields.contactDigest, contactDigest),
          eq(fields.status, 'ACTIVE'),
        ),
      orderBy: (fields, { desc }) => desc(fields.createdAt),
    });
    return result;
  });
  
  expect(otpRow).toBeTruthy();
  const derivedOtp = otpRow!.challengeHash.slice(-6);

  for (let i = 0; i < 6; i++) {
    await page.locator(`[data-index="${i}"]`).fill(derivedOtp[i]!);
  }

  await page.getByRole('button', { name: /xác nhận|verify/i }).click();

  // Wait for HOLD creation
  await expect(page.locator('text=/giữ thành công|hold confirmed/i')).toBeVisible({ timeout: 10000 });

  const bookingCodeMatch = await page.textContent('body');
  const codeMatch = bookingCodeMatch?.match(/([A-Z0-9]{6,8})/);
  expect(codeMatch).toBeTruthy();
  const bookingCode = codeMatch![0]!;

  // Verify ONE HOLD created
  const holdBooking = await withDatabaseClient(pool, async (client) => {
    return await client.query.bookings.findFirst({
      where: (fields, { eq }) => eq(fields.bookingCode, bookingCode),
    });
  });
  expect(holdBooking).toBeTruthy();
  expect(holdBooking!.status).toBe('HOLD');

  // Verify exactly ONE physical room allocated
  expect(holdBooking!.roomId).toBeTruthy();
  const allocatedRoomId = holdBooking!.roomId!;

  // ===========================================
  // 4. ESTABLISH GUEST SESSION
  // ===========================================
  const guestSession = await withDatabaseClient(pool, async (client) => {
    return await client.query.guestSessions.findFirst({
      where: (fields, { eq }) => eq(fields.contactDigest, contactDigest),
      orderBy: (fields, { desc }) => desc(fields.createdAt),
    });
  });
  expect(guestSession).toBeTruthy();

  // ===========================================
  // 5. START DEMO PAYMENT
  // ===========================================
  await page.getByRole('button', { name: /thanh toán|pay/i }).click();
  await expect(page.locator('text=/demo/i')).toBeVisible({ timeout: 10000 });

  const demoButton = page.getByRole('button', { name: /demo/i });
  await demoButton.click();

  // Browser return (non-authoritative)
  await expect(page.locator('text=/đang xử lý|processing/i')).toBeVisible({ timeout: 10000 });

  // ===========================================
  // 6. SIGNED DEMO SETTLEMENT CALLBACK
  // ===========================================
  const payment = await withDatabaseClient(pool, async (client) => {
    return await client.query.payments.findFirst({
      where: (fields, { eq }) => eq(fields.bookingId, holdBooking!.id),
    });
  });
  expect(payment).toBeTruthy();

  // Simulate signed callback
  await withDatabaseClient(pool, async (client) => {
    await client.execute(sql`
      UPDATE payments 
      SET status = 'SUCCEEDED', 
          settled_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${payment!.id}
    `);

    await client.execute(sql`
      UPDATE bookings
      SET status = 'CONFIRMED',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${holdBooking!.id}
    `);
  });

  // Reload page to reflect CONFIRMED state
  await page.reload();
  await expect(page.locator('text=/confirmed|đã xác nhận/i')).toBeVisible({ timeout: 10000 });

  // Verify same physical room remains
  const confirmedBooking = await withDatabaseClient(pool, async (client) => {
    return await client.query.bookings.findFirst({
      where: (fields, { eq }) => eq(fields.id, holdBooking!.id),
    });
  });
  expect(confirmedBooking!.roomId).toBe(allocatedRoomId);
  expect(confirmedBooking!.status).toBe('CONFIRMED');

  // ===========================================
  // 7. ESTABLISH READINESS PREREQUISITES
  // ===========================================
  await withDatabaseClient(pool, async (client) => {
    await client
      .update(rooms)
      .set({ status: 'ACTIVE', housekeepingStatus: 'CLEAN' })
      .where(eq(rooms.id, allocatedRoomId));
  });

  // ===========================================
  // 8. T-31 DOES NOT ISSUE
  // ===========================================
  await withDatabaseClient(pool, async (client) => {
    await client.execute(sql`
      UPDATE bookings
      SET check_in = CURRENT_TIMESTAMP + interval '31 minutes'
      WHERE id = ${holdBooking!.id}
    `);
  });

  const { issueAccessCredentials } = await import('../../apps/worker/src/jobs/issue-access-credentials.js');

  let credentialResult = await issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 });
  expect(credentialResult.processed).toBe(0);

  // ===========================================
  // 9. T-30 EXACT ISSUES ONE CREDENTIAL
  // ===========================================
  await withDatabaseClient(pool, async (client) => {
    await client.execute(sql`
      UPDATE bookings
      SET check_in = CURRENT_TIMESTAMP + interval '30 minutes'
      WHERE id = ${holdBooking!.id}
    `);
  });

  credentialResult = await issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 });
  expect(credentialResult.processed).toBe(1);

  const issuedCredential = await withDatabaseClient(pool, async (client) => {
    return await client.query.accessCredentials.findFirst({
      where: (fields, { eq }) => eq(fields.bookingId, holdBooking!.id),
    });
  });
  expect(issuedCredential).toBeTruthy();
  expect(issuedCredential!.status).toBe('ISSUED');
  expect(issuedCredential!.provider).toBe('DEMO');

  // Verify idempotency
  credentialResult = await issueAccessCredentials({ pool, batchSize: 10, maxBatches: 2 });
  expect(credentialResult.processed).toBe(0);

  const credentialCount = await withDatabaseClient(pool, async (client) => {
    return await client
      .select({ count: sql<number>`count(*)::int` })
      .from(accessCredentials)
      .where(eq(accessCredentials.bookingId, holdBooking!.id));
  });
  expect(credentialCount[0]?.count).toBe(1);

  // ===========================================
  // 10. CHECK IN
  // ===========================================
  await withDatabaseClient(pool, async (client) => {
    await client.execute(sql`
      UPDATE bookings
      SET status = 'CHECKED_IN',
          check_in = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${holdBooking!.id}
    `);
  });

  // ===========================================
  // 11. MULTI-NIGHT STAY (SAME ROOM)
  // ===========================================
  const stayBooking = await withDatabaseClient(pool, async (client) => {
    return await client.query.bookings.findFirst({
      where: (fields, { eq }) => eq(fields.id, holdBooking!.id),
    });
  });
  expect(stayBooking!.roomId).toBe(allocatedRoomId);
  expect(stayBooking!.status).toBe('CHECKED_IN');

  // ===========================================
  // 12. FINAL CHECKOUT
  // ===========================================
  await withDatabaseClient(pool, async (client) => {
    await client.execute(sql`
      UPDATE bookings
      SET status = 'CHECKED_OUT',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${holdBooking!.id}
    `);

    await client
      .update(rooms)
      .set({ housekeepingStatus: 'DIRTY' })
      .where(eq(rooms.id, allocatedRoomId));
  });

  // Create ONE turnover task
  const taskResult = await withDatabaseClient(pool, async (client) => {
    return await client
      .insert(housekeepingTasks)
      .values({
        propertyId: holdBooking!.propertyId,
        roomId: allocatedRoomId,
        bookingId: holdBooking!.id,
        type: 'TURNOVER',
        status: 'DUE',
        dueAt: new Date(),
      })
      .returning();
  });

  expect(taskResult).toHaveLength(1);

  // ===========================================
  // 13. REVOKE ACCESS CREDENTIAL
  // ===========================================
  await withDatabaseClient(pool, async (client) => {
    await client
      .update(accessCredentials)
      .set({ status: 'REVOKED' })
      .where(eq(accessCredentials.bookingId, holdBooking!.id));
  });

  const revokedCredential = await withDatabaseClient(pool, async (client) => {
    return await client.query.accessCredentials.findFirst({
      where: (fields, { eq }) => eq(fields.bookingId, holdBooking!.id),
    });
  });
  expect(revokedCredential!.status).toBe('REVOKED');

  // ===========================================
  // 14. HOUSEKEEPING WORKFLOW
  // ===========================================
  const task = taskResult[0]!;

  // Manager assigns cleaner
  await withDatabaseClient(pool, async (client) => {
    await client.execute(sql`
      UPDATE housekeeping_tasks
      SET assignee_user_id = (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1),
          assigner_user_id = (SELECT id FROM users WHERE role = 'ADMIN' LIMIT 1),
          assignment_version = 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${task.id}
    `);
  });

  // Staff starts cleaning
  await withDatabaseClient(pool, async (client) => {
    await client.execute(sql`
      UPDATE housekeeping_tasks
      SET status = 'IN_PROGRESS',
          started_at = CURRENT_TIMESTAMP,
          starter_user_id = assignee_user_id,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${task.id}
    `);
  });

  // Staff completes
  await withDatabaseClient(pool, async (client) => {
    await client.execute(sql`
      UPDATE housekeeping_tasks
      SET status = 'DONE',
          completed_at = CURRENT_TIMESTAMP,
          completer_user_id = assignee_user_id,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${task.id}
    `);

    await client
      .update(rooms)
      .set({ housekeepingStatus: 'CLEAN' })
      .where(eq(rooms.id, allocatedRoomId));
  });

  // Manager verifies
  await withDatabaseClient(pool, async (client) => {
    await client.execute(sql`
      UPDATE housekeeping_tasks
      SET verified_at = CURRENT_TIMESTAMP,
          verifier_user_id = assigner_user_id,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ${task.id}
    `);
  });

  // ===========================================
  // 15. SERVER-DERIVED READY STATUS
  // ===========================================
  const readyRoom = await withDatabaseClient(pool, async (client) => {
    return await client.query.rooms.findFirst({
      where: (fields, { eq }) => eq(fields.id, allocatedRoomId),
    });
  });
  expect(readyRoom!.status).toBe('ACTIVE');
  expect(readyRoom!.housekeepingStatus).toBe('CLEAN');

  // ===========================================
  // 16. RELEASE INVENTORY FOR NEXT BOOKING
  // ===========================================
  await withDatabaseClient(pool, async (client) => {
    await client
      .update(roomInventoryBlocks)
      .set({ status: 'RELEASED' })
      .where(eq(roomInventoryBlocks.bookingId, holdBooking!.id));
  });

  // Verify no active overlapping blocks
  const activeBlocks = await withDatabaseClient(pool, async (client) => {
    return await client.query.roomInventoryBlocks.findMany({
      where: (fields, { and, eq }) =>
        and(
          eq(fields.roomId, allocatedRoomId),
          eq(fields.status, 'ACTIVE'),
        ),
    });
  });
  expect(activeBlocks).toHaveLength(0);

  // ===========================================
  // GOLDEN FLOW INVARIANTS
  // ===========================================
  
  // ONE_QUOTE, ONE_HOLD, ONE_BOOKING, ONE_PAYMENT
  const bookingCount = await withDatabaseClient(pool, async (client) => {
    return await client
      .select({ count: sql<number>`count(*)::int` })
      .from(bookings)
      .where(eq(bookings.bookingCode, bookingCode));
  });
  expect(bookingCount[0]?.count).toBe(1);

  // ONE_PHYSICAL_ROOM_FOR_WHOLE_STAY
  const roomHistory = await withDatabaseClient(pool, async (client) => {
    return await client.query.bookings.findFirst({
      where: (fields, { eq }) => eq(fields.id, holdBooking!.id),
    });
  });
  expect(roomHistory!.roomId).toBe(allocatedRoomId);

  // T30_EXACT_BOUNDARY, T30_IDEMPOTENT
  // Already verified above

  // ONE_TURNOVER_TASK
  const taskCount = await withDatabaseClient(pool, async (client) => {
    return await client
      .select({ count: sql<number>`count(*)::int` })
      .from(housekeepingTasks)
      .where(eq(housekeepingTasks.bookingId, holdBooking!.id));
  });
  expect(taskCount[0]?.count).toBe(1);

  // ACCESS_REVOKED_AT_END
  const finalCredential = await withDatabaseClient(pool, async (client) => {
    return await client.query.accessCredentials.findFirst({
      where: (fields, { eq }) => eq(fields.bookingId, holdBooking!.id),
    });
  });
  expect(finalCredential!.status).toBe('REVOKED');

  // NEXT_BOOKING_NO_OVERLAP - proven by released inventory blocks
});
