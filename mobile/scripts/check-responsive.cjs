/* Run against a local Expo web server. API fixtures keep checks independent of real accounts. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');

const sizes = [
  [320, 568], [390, 844], [768, 1024], [1024, 768], [1280, 800], [844, 390], [568, 320],
];
const user = { id: 1, fullName: 'Responsive Layout Student', email: 'layout@example.test', role: 'RIDER', yearOfStudy: 2, faceVerified: true };
const rides = Array.from({ length: 8 }, (_, i) => ({
  id: i + 1, driverId: 2, driverName: 'Driver with a longer name', status: 'COMPLETED',
  pickupLocation: 'Sol Plaatje University campus main entrance', destination: 'Kimberley city centre student accommodation',
  fare: 45.5, createdAt: '2026-10-04T10:00:00', riderRating: i % 2 ? 4 : null,
}));

async function mockApi(page, role = 'RIDER') {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const account = { ...user, role };
    const data = path === '/api/auth/login' ? { token: 'layout-test-token', user: account }
      : path === '/api/users/me' ? account
      : path.endsWith('/status') ? { approved: true }
      : path.endsWith('/history') ? rides
      : path === '/api/driver/stats' ? { todayRides: 4, earnings: 180, rating: 4.5, totalRides: 12, online: true }
      : path === '/api/driver/earnings' ? { months: [{ month: '2026-10', amount: 123456.75, rides: 200 }], thisWeek: { amount: 1500, rides: 35 }, total: 123456.75 }
      : path === '/api/admin/dashboard/stats' ? { totalUsers: 1200, totalDrivers: 25, ridesToday: 80, pendingApprovals: 0, activeSOS: 0, safetyScorePercent: 100 }
      : path === '/api/admin/users' ? Array.from({ length: 6 }, (_, i) => ({ ...account, id: i + 1, status: 'ACTIVE' }))
      : path === '/api/rides/active' ? null : [];
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(data) });
  });
  await page.route(/https:\/\/.*(?:tile\.openstreetmap|nominatim|overpass|router\.project-osrm)/, (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ elements: [], routes: [], address: {} }) }));
}

async function login(page) {
  await page.goto(process.env.APP_URL || 'http://localhost:8083');
  await page.locator('input[type="email"]').waitFor();
  await page.locator('input[type="email"]').fill(user.email);
  await page.locator('input[type="password"]').fill('layout-test-password');
  await page.getByText('Sign In', { exact: true }).click();
}

async function checkPageWidth(page, label) {
  const overflow = await page.getByTestId('app-page-area').evaluate((area) => {
    return [...area.querySelectorAll('div')]
      .filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.clientHeight > 0 && el.scrollWidth > el.clientWidth + 2)
      .map((el) => ({ width: el.clientWidth, scrollWidth: el.scrollWidth }));
  });
  assert.deepEqual(overflow, [], `${label}: no horizontal content overflow`);
}

async function checkOtherRoles(browser) {
  for (const role of ['DRIVER', 'SECURITY', 'ADMIN']) {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mockApi(page, role);
    await login(page);
    const dockId = role === 'DRIVER' ? 'driver-bottom-nav' : 'security-bottom-nav';
    const activeDock = page.locator(`[data-testid="${dockId}"]:visible`);
    if (role === 'ADMIN') await page.getByText('Total Users', { exact: true }).waitFor();
    else await activeDock.waitFor();
    for (const [width, height] of [[320, 568], [768, 1024], [1024, 768], [568, 320]]) {
      await page.setViewportSize({ width, height });
      const tabs = role === 'DRIVER' ? ['Home', 'Earnings', 'History', 'Profile'] : role === 'SECURITY' ? ['Dashboard', 'Active Rides', 'SOS Alerts'] : ['Dashboard'];
      for (const tab of tabs) {
        if (role !== 'ADMIN') await activeDock.getByText(tab, { exact: true }).click();
        await page.waitForTimeout(600);
        await checkPageWidth(page, `${role} ${tab} ${width}x${height}`);
        if (role !== 'ADMIN') {
          const dock = await activeDock.boundingBox();
          assert.ok(Math.abs(dock.y + dock.height - height) <= 1, `${role} ${tab}: dock stays at bottom`);
        }
        console.log(`PASS ${width}x${height} ${role} ${tab}`);
      }
    }
    if (role === 'ADMIN') {
      await page.getByText('User Management', { exact: true }).click();
      await page.waitForTimeout(600);
      await checkPageWidth(page, 'User Management at 568x320');
      const next = page.getByText('Next', { exact: true });
      await next.waitFor();
      assert.ok((await next.boundingBox()).y < 320, 'User pagination remains visible');
      console.log('PASS User Management landscape');
      await page.getByText('Suspend Account', { exact: true }).first().click();
      const cancel = page.getByText('Cancel', { exact: true });
      await cancel.scrollIntoViewIfNeeded();
      const cancelBox = await cancel.boundingBox();
      assert.ok(cancelBox.y >= 0 && cancelBox.y + cancelBox.height <= 320, 'User confirmation actions fit landscape');
      await cancel.click();
    }
    assert.deepEqual(errors, [], `${role}: no runtime errors`);
    await page.close();
  }
}

async function checkAuth(browser) {
  const page = await browser.newPage();
  await page.goto(process.env.APP_URL || 'http://localhost:8083');
  await page.locator('input[type="email"]').waitFor();
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await checkPageWidth(page, `Login ${width}x${height}`);
  }
  await page.getByText('Forgot password?', { exact: true }).click();
  await page.getByText('Close', { exact: true }).click();
  console.log('PASS Password recovery sheet landscape');
  await page.getByText('Create Account', { exact: true }).click();
  await page.getByText('Join CampusConnect today', { exact: true }).waitFor();
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await checkPageWidth(page, `Create Account ${width}x${height}`);
  }
  console.log('PASS Login and registration at seven sizes');
  await page.close();
}

async function geometry(page) {
  return page.evaluate(() => {
    const nav = document.querySelector('[data-testid="rider-bottom-nav"]');
    const area = document.querySelector('[data-testid="app-page-area"]');
    const rect = nav.getBoundingClientRect();
    const pageRect = area.getBoundingClientRect();
    const scrolls = [...area.querySelectorAll('div')].filter((el) => /auto|scroll/.test(getComputedStyle(el).overflowY) && el.clientHeight > 0);
    return {
      nav: { top: rect.top, bottom: rect.bottom, height: rect.height, left: rect.left, right: rect.right },
      pageBottom: pageRect.bottom, pageHeight: pageRect.height,
      viewportHeight: innerHeight, documentWidth: document.documentElement.scrollWidth, viewportWidth: innerWidth,
      overflowing: scrolls.filter((el) => el.scrollWidth > el.clientWidth + 2).map((el) => ({ width: el.clientWidth, scrollWidth: el.scrollWidth })),
      scrolls: scrolls.length,
    };
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 }, geolocation: { latitude: -28.745, longitude: 24.77 }, permissions: ['geolocation'] });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await mockApi(page);
    await login(page);
    const nav = page.getByTestId('rider-bottom-nav');
    await nav.waitFor();
    await nav.evaluate((el) => { window.__layoutDock = el; });

    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      for (const tab of ['Home', 'History', 'Schedule', 'Profile']) {
        await nav.getByRole('tab', { name: tab, exact: true }).click();
        await page.waitForTimeout(350);
        assert.equal(await nav.count(), 1, 'Exactly one rider dock');
        assert.equal(await nav.evaluate((el) => window.__layoutDock === el), true, 'Dock survives tab navigation');
        const before = await geometry(page);
        assert.ok(Math.abs(before.nav.bottom - height) <= 1, `${tab} dock reaches viewport bottom at ${width}x${height}`);
        assert.ok(before.pageHeight > 0 && before.pageBottom <= before.nav.top + 1, `${tab} content fits above dock`);
        assert.ok(before.documentWidth <= width + 1, `${tab} document does not scroll horizontally`);
        assert.deepEqual(before.overflowing, [], `${tab} scroll content does not overflow horizontally at ${width}x${height}`);
        assert.ok(before.scrolls > 0, `${tab} content is scrollable`);
        await page.getByTestId('app-page-area').evaluate((area) => {
          for (const el of area.querySelectorAll('div')) {
            if (/auto|scroll/.test(getComputedStyle(el).overflowY)) el.scrollTop = el.scrollHeight;
          }
        });
        const after = await geometry(page);
        assert.deepEqual(after.nav, before.nav, `${tab} scrolling cannot move the dock`);
        console.log(`PASS ${width}x${height} ${tab}`);
      }
    }
    assert.deepEqual(errors, [], 'No browser runtime errors');
    console.log('Passed 28 rider layout checks, including rotation, navigation and scrolling.');
    await page.getByText('Edit', { exact: true }).click();
    const save = page.getByText('Save', { exact: true });
    await save.scrollIntoViewIfNeeded();
    const saveBox = await save.boundingBox();
    assert.ok(saveBox.y >= 0 && saveBox.y + saveBox.height <= 320, 'Profile dialog actions are reachable in landscape');
    await page.getByText('Cancel', { exact: true }).click();
    console.log('PASS Profile edit dialog landscape');
    if (process.argv.includes('--screenshots')) {
      const path = require('node:path');
      const output = path.resolve(__dirname, '../.expo/responsive-checks');
      require('node:fs').mkdirSync(output, { recursive: true });
      for (const [width, height, tab] of [[320, 568, 'Profile'], [768, 1024, 'Home']]) {
        await page.setViewportSize({ width, height });
        await nav.getByRole('tab', { name: tab, exact: true }).click();
        await page.waitForTimeout(350);
        await page.screenshot({ path: path.join(output, `${width}x${height}-${tab.toLowerCase()}.png`) });
      }
    }
    await checkOtherRoles(browser);
    await checkAuth(browser);
  } finally {
    await browser.close();
  }
}

module.exports = { mockApi, login, sizes, checkPageWidth };
if (require.main === module) {
  main().catch((error) => { console.error(error); process.exitCode = 1; });
}
