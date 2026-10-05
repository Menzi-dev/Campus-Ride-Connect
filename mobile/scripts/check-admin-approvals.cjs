/* Synthetic API fixtures: no real registration or approval requests. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { mockApi, login, checkPageWidth } = require('./check-responsive.cjs');

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  const page = await browser.newPage({ viewport: { width: 768, height: 1024 } });
  const errors = [], decisions = [];
  let pending = [], rejectAttempts = 0, approvedDrivers = 0;
  page.on('pageerror', error => errors.push(error.message));
  await mockApi(page, 'ADMIN');
  await page.clock.install();
  await page.route('**/api/admin/**', async route => {
    const endpoint = new URL(route.request().url()).pathname;
    if (endpoint === '/api/admin/dashboard/stats') await route.fulfill({ json: { totalUsers: 2, totalDrivers: approvedDrivers, ridesToday: 0, pendingApprovals: pending.length, activeSOS: 0, safetyScorePercent: 100 } });
    else if (endpoint === '/api/admin/driver-approvals/pending') await route.fulfill({ json: pending });
    else if (route.request().method() === 'POST') {
      decisions.push(endpoint);
      if (endpoint.endsWith('/reject') && ++rejectAttempts === 1) await route.fulfill({ status: 500, json: { error: 'Fixture decision failed' } });
      else {
        if (endpoint.endsWith('/approve')) approvedDrivers++;
        pending = [];
        await route.fulfill({ json: { status: endpoint.endsWith('/approve') ? 'APPROVED' : 'REJECTED' } });
      }
    } else await route.fallback();
  });
  try {
    await login(page);
    await page.getByText('All caught up!', { exact: true }).waitFor();
    for (const [id, name, decision] of [['201', 'New Driver Registration', 'Approve'], ['202', 'Second Driver Registration', 'Reject']]) {
      pending = [{ id, fullName: name, email: `${id}@example.test`, studentNumber: '20260001', licencePlate: 'NEW123', vehicleMake: 'Toyota', vehicleYear: 2024, submittedAt: new Date().toISOString(), status: 'PENDING', role: 'DRIVER' }];
      await page.clock.fastForward(15000);
      await page.getByText(name, { exact: true }).waitFor();
      for (const [width, height] of [[320, 568], [768, 1024]]) {
        await page.setViewportSize({ width, height });
        await checkPageWidth(page, 'Admin pending approvals');
      }
      await page.getByText(decision, { exact: true }).click();
      if (decision === 'Reject') {
        await page.getByText('Fixture decision failed', { exact: true }).waitFor();
        await page.getByText(name, { exact: true }).waitFor();
        await page.getByText(decision, { exact: true }).click();
      }
      await page.getByText('All caught up!', { exact: true }).waitFor();
    }
    assert.deepEqual(decisions, ['/api/admin/driver-approvals/201/approve', '/api/admin/driver-approvals/202/reject', '/api/admin/driver-approvals/202/reject']);
    assert.deepEqual(errors, []);
    console.log('PASS new registrations appear automatically; approve, reject and retry update the queue; phone and tablet layouts fit');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
