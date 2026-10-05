/* Normal Home ride completion; synthetic API responses only. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { mockApi, login, checkPageWidth } = require('./check-responsive.cjs');

async function check(browser, withComment) {
  const page = await browser.newPage({ viewport: { width: 618, height: 980 }, geolocation: { latitude: -28.745, longitude: 24.77 }, permissions: ['geolocation'] });
  page.setDefaultNavigationTimeout(120000);
  const errors = [], submissions = [];
  let statusPolls = 0;
  page.on('pageerror', error => errors.push(error.message));
  await mockApi(page);
  const ride = { id: 123, status: 'STARTED', pickupLocation: 'Campus', destination: 'Accommodation', pickupLat: -28.745, pickupLng: 24.77, destLat: -28.75, destLng: 24.76, fare: 10, driver: { id: 2, fullName: 'Khum', rating: 4.4, vehicleMake: 'Test', vehicleModel: 'Car', licencePlate: 'TEST', phone: '' } };
  await page.route('**/api/**', async route => {
    const req = route.request(), endpoint = new URL(req.url()).pathname;
    if (endpoint === '/api/rides/request') await route.fulfill({ json: ride });
    else if (endpoint === '/api/rides/123/payment') await route.fulfill({ json: ride });
    else if (endpoint === '/api/rides/123/status') await route.fulfill({ json: { ...ride, status: ++statusPolls === 1 ? 'STARTED' : 'COMPLETED' } });
    else if (endpoint === '/api/rides/123/rating') {
      submissions.push(req.postDataJSON());
      await route.fulfill(withComment && submissions.length === 1
        ? { status: 500, json: { error: 'Fixture submission failed. Please retry.' } }
        : { json: {} });
    } else await route.fallback();
  });
  try {
    await login(page);
    await page.getByTestId('rider-bottom-nav').waitFor();
    await page.getByText('Search for a place...', { exact: true }).click();
    await page.getByText('Library Complex', { exact: true }).click();
    await page.getByText('Request Ride', { exact: true }).click();
    await page.getByText('Proceed with cash', { exact: true }).click();
    await page.getByText('Rate our driver', { exact: true }).filter({ visible: true }).click();
    const input = page.getByRole('textbox', { name: 'Add a comment (optional)' });
    const submit = page.getByRole('button', { name: 'Submit rating', exact: true });
    await input.waitFor();
    await page.getByTestId('ride-rating-comment').waitFor();
    assert.equal(await submit.isDisabled(), true, 'Stars are required; comment alone cannot submit');
    await page.getByText('How was your ride with Khum?', { exact: true }).waitFor();
    if (withComment) {
      await page.waitForTimeout(2800);
      await page.screenshot({ path: path.join(__dirname, '../.expo/normal-ride-rating.png') });
    }
    for (const [width, height] of [[320, 568], [768, 1024], [568, 320]]) {
      await page.setViewportSize({ width, height });
      await checkPageWidth(page, 'Normal-ride rating');
      await submit.scrollIntoViewIfNeeded();
      const box = await submit.boundingBox();
      assert.ok(box.y >= 0 && box.y + box.height <= height, 'Submit stays reachable');
    }
    if (withComment) await input.fill('  Friendly driver and a comfortable ride.  ');
    await page.getByRole('button', { name: '4 star rating', exact: true }).click();
    await submit.click();
    if (withComment) {
      await page.getByText('Fixture submission failed. Please retry.', { exact: true }).waitFor();
      assert.equal(await input.inputValue(), '  Friendly driver and a comfortable ride.  ');
      await submit.click();
    }
    await page.getByText('Thank you for rating!', { exact: true }).waitFor();
    await page.getByTestId('rider-bottom-nav').waitFor();
    assert.equal(submissions.length, withComment ? 2 : 1);
    submissions.forEach(body => assert.deepEqual(body, withComment
      ? { rating: 4, comment: 'Friendly driver and a comfortable ride.' }
      : { rating: 4 }));
    assert.deepEqual(errors, []);
    console.log(`PASS normal Home ride rating ${withComment ? 'with trimmed comment and retry' : 'without comment'}, responsive actions and return to Home`);
  } catch (error) {
    await page.screenshot({ path: path.join(__dirname, '../.expo/normal-rating-failure.png') });
    console.error(await page.locator('body').innerText());
    throw error;
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  try { await check(browser, true); await check(browser, false); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
