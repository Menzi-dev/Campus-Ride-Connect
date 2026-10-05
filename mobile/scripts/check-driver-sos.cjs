/* Synthetic alerts and microphone bytes only; all API requests are intercepted. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { mockApi, login, checkPageWidth } = require('./check-responsive.cjs');

async function check(browser, microphoneDenied = false, gpsDenied = false, finishMode = 'return', pendingPermission = false) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, permissions: ['geolocation'], geolocation: { latitude: -28.745, longitude: 24.77 } });
  page.setDefaultNavigationTimeout(120000);
  const errors = [], alerts = [], uploads = [];
  let failures = 0;
  page.on('pageerror', error => errors.push(error.message));
  await mockApi(page, 'DRIVER');
  await page.clock.install();
  await page.addInitScript(({ microphoneDenied, gpsDenied, pendingPermission }) => {
    window.fixtureStoppedTracks = 0;
    window.fixtureEmittedChunks = 0;
    const microphone = { getTracks: () => [{ stop: () => { window.fixtureStoppedTracks++; } }] };
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: async () => {
      if (pendingPermission) return new Promise(resolve => { window.fixtureAllowMicrophone = () => resolve(microphone); });
      if (microphoneDenied) throw new DOMException('Fixture microphone denied', 'NotAllowedError');
      return microphone;
    } } });
    class FixtureRecorder {
      static isTypeSupported(type) { return type.includes('webm'); }
      constructor() { this.state = 'inactive'; this.mimeType = 'audio/webm'; }
      start() { this.state = 'recording'; this.timer = setInterval(() => this.emit(), 1000); }
      emit() { window.fixtureEmittedChunks++; this.ondataavailable?.({ data: new Blob(['synthetic-evidence'], { type: this.mimeType }) }); }
      stop() { clearInterval(this.timer); this.emit(); this.state = 'inactive'; queueMicrotask(() => this.onstop?.()); }
    }
    window.MediaRecorder = FixtureRecorder;
    if (gpsDenied) Object.defineProperty(navigator.geolocation, 'getCurrentPosition', { configurable: true, value: (_success, failure) => failure({ code: 1, message: 'Fixture location denied' }) });
  }, { microphoneDenied, gpsDenied, pendingPermission });
  const request = { id: '101', riderName: 'Fixture Rider', riderInitials: 'FR', riderRating: 4.5, pickup: 'University main entrance', destination: 'Accommodation', fare: 'R45.50', pickupLat: -28.745, pickupLng: 24.77, destLat: -28.75, destLng: 24.76 };
  const ride = { ...request, id: 101, status: 'ARRIVED', pickupLocation: request.pickup };
  await page.route('**/api/**', async route => {
    const req = route.request(), endpoint = new URL(req.url()).pathname;
    if (endpoint === '/api/driver/requests') await route.fulfill({ json: [request] });
    else if (endpoint === '/api/driver/requests/101') await route.fulfill({ json: request });
    else if (endpoint === '/api/driver/requests/101/accept' || endpoint === '/api/driver/rides/101') await route.fulfill({ json: ride });
    else if (endpoint === '/api/rides/101/sos') {
      alerts.push(req.postDataJSON());
      // Ensure sending failures stay on the confirmation screen and can be retried.
      if (!microphoneDenied && ++failures === 1) await route.fulfill({ status: 500, json: { error: 'Fixture SOS failure' } });
      else await route.fulfill({ json: { alertId: 501, rideId: 101, status: 'DISPATCHED' } });
    } else if (endpoint === '/api/rides/101/sos/501/audio') {
      uploads.push({ body: req.postDataBuffer().toString(), auth: req.headers().authorization });
      await route.fulfill({ json: { alertId: 501 } });
    } else await route.fallback();
  });
  try {
    await login(page);
    await page.getByText('View Request', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Accept Ride', { exact: true }).filter({ visible: true }).click();
    const sosButton = page.getByRole('button', { name: 'Activate SOS alert', exact: true });
    await sosButton.waitFor();
    for (const [width, height] of [[320, 568], [768, 1024], [568, 320], [390, 844]]) {
      await page.setViewportSize({ width, height });
      await checkPageWidth(page, 'Driver active ride with SOS');
      const button = await sosButton.boundingBox();
      assert.equal(button.width, 44);
      assert.equal(button.height, 44);
      assert.ok(button.x + button.width <= width);
    }
    if (!microphoneDenied) await page.screenshot({ path: path.join(__dirname, '../.expo/driver-active-sos.png') });
    await sosButton.click();
    await page.getByRole('button', { name: 'Cancel SOS', exact: true }).click();
    assert.equal(alerts.length, 0, 'Opening/cancelling must not send an alert');
    await sosButton.click();
    const send = page.getByRole('button', { name: 'Yes, Send SOS Alert', exact: true });
    await page.setViewportSize({ width: 568, height: 320 });
    await send.scrollIntoViewIfNeeded();
    await send.click();
    if (!microphoneDenied) {
      await page.getByText('Fixture SOS failure', { exact: true }).waitFor();
      await send.click();
    }
    await page.getByText('SOS Activated', { exact: true }).waitFor();
    const back = page.getByRole('button', { name: "I'm Safe — Back to ride", exact: true });
    await back.scrollIntoViewIfNeeded();
    const box = await back.boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= 320, 'SOS action remains reachable in landscape');
    await page.setViewportSize({ width: 390, height: 844 });
    if (gpsDenied) await page.getByText('Live location unavailable', { exact: true }).waitFor();
    else await page.getByText('-28.745000, 24.770000', { exact: true }).waitFor();
    if (pendingPermission) {
      await page.getByText('Starting audio recording...', { exact: true }).waitFor();
    } else if (microphoneDenied) {
      await page.getByText('Campus Security has been alerted. Microphone access is unavailable, so audio could not be recorded.', { exact: true }).waitFor();
      assert.equal(uploads.length, 0);
    } else {
      await page.getByText('Recording in progress...', { exact: true }).first().waitFor();
      await page.waitForResponse(response => response.url().endsWith('/sos/501/audio'));
      assert.ok(uploads.length >= 1, 'Evidence uploads while recording');
      await page.screenshot({ path: path.join(__dirname, '../.expo/driver-sos-activated.png') });
      if (finishMode === 'limit') {
        await page.clock.runFor(60000);
        await page.getByText('01:00', { exact: true }).waitFor();
        await page.getByText('Audio evidence saved for Campus Security.', { exact: true }).waitFor();
        assert.ok(await page.evaluate(() => window.fixtureStoppedTracks > 0), 'The 60-second limit releases the microphone');
      }
    }
    await back.click();
    await sosButton.waitFor();
    if (pendingPermission) {
      await page.evaluate(() => window.fixtureAllowMicrophone());
      await page.waitForFunction(() => window.fixtureStoppedTracks > 0);
      assert.equal(uploads.length, 0, 'Late microphone permission must not restart recording after closing');
    }
    assert.equal(alerts.length, microphoneDenied ? 1 : 2);
    alerts.forEach(body => assert.deepEqual(body, gpsDenied ? {} : { gpsLat: -28.745, gpsLng: 24.77 }));
    if (!microphoneDenied) {
      assert.ok(await page.evaluate(() => window.fixtureStoppedTracks > 0), 'Microphone is released on return');
      assert.equal(uploads.reduce((sum, upload) => sum + (upload.body.match(/synthetic-evidence/g) || []).length, 0), await page.evaluate(() => window.fixtureEmittedChunks), 'Every evidence chunk is uploaded once, without duplicates or loss');
      uploads.forEach(upload => {
        assert.equal(upload.auth, 'Bearer layout-test-token');
        assert.ok(upload.body.includes('synthetic-evidence'));
        assert.ok(upload.body.includes('name="duration"'));
      });
    }
    await sosButton.click();
    await send.waitFor();
    await page.getByRole('button', { name: 'Cancel SOS', exact: true }).click();
    assert.deepEqual(errors, []);
    console.log(`PASS driver SOS placement, cancel/retry, GPS ${gpsDenied ? 'denied' : 'sent'}, microphone ${microphoneDenied ? 'denied without losing alert' : 'streaming/released'}, responsive confirmation and ${finishMode}`);
  } finally { await page.close(); }
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  try { await check(browser); await check(browser, true, true); await check(browser, false, false, 'limit'); await check(browser, false, false, 'pending permission', true); }
  finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
