/* Mocked page/action checks. Never contacts the real backend or dispatches a unit. */
const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const { mockApi, login, sizes, checkPageWidth } = require('./check-responsive.cjs');

async function layouts(page, name) {
  for (const [width, height] of sizes) {
    await page.setViewportSize({ width, height });
    await page.waitForTimeout(100);
    await checkPageWidth(page, `${name} ${width}x${height}`);
  }
  assert.equal(await page.getByLabel('Go back', { exact: true }).filter({ visible: true }).count(), 0, `${name}: custom header has no duplicate native back`);
  console.log(`PASS ${name} at seven sizes`);
}

async function account(browser, role, fixture) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, geolocation: { latitude: -28.745, longitude: 24.77 }, permissions: ['geolocation'] });
  page.setDefaultTimeout(12000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await mockApi(page, role);
  await page.route('**/api/**', fixture);
  await login(page);
  return { page, errors };
}

async function payment(browser) {
  let cards = [], creates = 0, deletes = 0, ratings = 0;
  const { page, errors } = await account(browser, 'RIDER', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path === '/api/users/me/payment-methods') {
      if (req.method() === 'POST') {
        const data = req.postDataJSON();
        assert.equal(data.cardNumber, undefined);
        assert.equal(data.cvv, undefined);
        cards.push(data); creates++;
      }
      await route.fulfill({ json: cards });
    } else if (path.startsWith('/api/users/me/payment-methods/') && req.method() === 'DELETE') {
      cards = []; deletes++;
      await route.fulfill({ json: cards });
    } else if (/\/rides\/\d+\/rating$/.test(path)) { ratings++; await route.fulfill({ json: {} }); }
    else if (path === '/api/users/me/payment-method') await route.fulfill({ json: {} });
    else await route.fallback();
  });
  try {
    await page.getByTestId('rider-bottom-nav').getByRole('tab', { name: 'History', exact: true }).click();
    await page.getByText('Rate ride', { exact: true }).filter({ visible: true }).first().click();
    await page.getByLabel('4 star rating', { exact: true }).waitFor();
    await layouts(page, 'Rate driver');
    await page.getByLabel('4 star rating', { exact: true }).click();
    await page.getByText('Submit rating', { exact: true }).filter({ visible: true }).click();
    await page.getByTestId('rider-bottom-nav').waitFor();
    assert.equal(ratings, 1);
    await page.getByTestId('rider-bottom-nav').getByRole('tab', { name: 'Profile', exact: true }).click();
    await page.getByText('Saved cards', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Payment Methods', { exact: true }).filter({ visible: true }).waitFor();
    await layouts(page, 'Payment methods');
    await page.getByText('Add card', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Save card', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Enter the name shown on the card.', { exact: true }).filter({ visible: true }).waitFor();
    await page.getByPlaceholder('Full name', { exact: true }).fill('Layout Test');
    await page.getByPlaceholder('1234 5678 9012 3456').fill('4111111111111111');
    await page.getByPlaceholder('MM/YY').fill('1230');
    await page.getByPlaceholder('123', { exact: true }).fill('123');
    await page.getByText('Save card', { exact: true }).filter({ visible: true }).click();
    await page.getByLabel('Delete Visa ending in 1111').waitFor();
    await page.waitForTimeout(400);
    assert.equal(creates, 1);
    await page.getByText('Cash', { exact: true }).filter({ visible: true }).click();
    await page.getByLabel('Delete Visa ending in 1111').click();
    await page.getByRole('button', { name: 'Cancel', exact: true }).click();
    assert.equal(deletes, 0);
    await page.getByLabel('Delete Visa ending in 1111').click();
    await page.getByText('Delete', { exact: true }).filter({ visible: true }).click();
    await page.getByText('No saved card yet', { exact: true }).filter({ visible: true }).waitFor();
    assert.equal(deletes, 1);
    assert.deepEqual(errors, []);
    console.log('PASS card validation, save, cash selection and cancel/confirm deletion in landscape');
  } finally { await page.close(); }
}

function wav() {
  const samples = 8000 * 8, buffer = Buffer.alloc(44 + samples * 2);
  buffer.write('RIFF'); buffer.writeUInt32LE(buffer.length - 8, 4); buffer.write('WAVEfmt ', 8);
  buffer.writeUInt32LE(16, 16); buffer.writeUInt16LE(1, 20); buffer.writeUInt16LE(1, 22);
  buffer.writeUInt32LE(8000, 24); buffer.writeUInt32LE(16000, 28); buffer.writeUInt16LE(2, 32); buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36); buffer.writeUInt32LE(samples * 2, 40);
  return buffer;
}

async function admin(browser) {
  let saved = 0, audioRequests = 0, monitoringRequests = 0;
  const incidents = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, referenceNumber: `INC-${i + 1}`, typeLabel: 'Safety incident', status: 'INVESTIGATING', rideReference: 'RIDE-101', createdAt: '2026-10-04T10:00:00', hasAudio: true, recordingDuration: 8 }));
  const { page, errors } = await account(browser, 'ADMIN', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path === '/api/admin/settings') {
      if (req.method() === 'PUT') saved++;
      await route.fulfill({ json: req.method() === 'PUT' ? req.postDataJSON() : { universityName: 'Test University' } });
    } else if (path === '/api/admin/rides/monitoring') { monitoringRequests++; await route.fulfill({ json: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, status: 'STARTED', riderName: 'Student with a longer name', driverName: 'Driver with a longer name', pickupLocation: 'University main entrance', destination: 'Student accommodation' })) }); }
    else if (path === '/api/admin/incidents') await route.fulfill({ json: incidents });
    else if (/\/admin\/incidents\/\d+$/.test(path)) await route.fulfill({ json: incidents.find(incident => incident.id === Number(path.split('/').at(-1))) });
    else if (path.endsWith('/audio')) {
      assert.equal(req.headers().authorization, 'Bearer layout-test-token'); audioRequests++;
      await route.fulfill({ contentType: 'audio/wav', body: wav() });
    } else await route.fallback();
  });
  try {
    await page.getByText('Settings', { exact: true }).filter({ visible: true }).click();
    await page.getByLabel('University Name', { exact: true }).waitFor();
    await layouts(page, 'University settings');
    await page.getByLabel('University Name', { exact: true }).fill('Updated Test University');
    await page.getByLabel('Back to admin dashboard', { exact: true }).click();
    await page.getByText('Stay', { exact: true }).filter({ visible: true }).click();
    assert.equal(await page.getByLabel('University Name', { exact: true }).inputValue(), 'Updated Test University');
    await page.getByText('Save Settings', { exact: true }).filter({ visible: true }).click();
    await page.getByText('University settings were updated successfully.', { exact: true }).filter({ visible: true }).waitFor();
    await page.getByRole('button', { name: 'Dismiss notification', exact: true }).click();
    assert.equal(saved, 1);
    await page.getByLabel('University Name', { exact: true }).fill('Discard me');
    await page.getByLabel('Back to admin dashboard', { exact: true }).click();
    await page.getByText('Leave', { exact: true }).filter({ visible: true }).click();
    await page.getByText('User Management', { exact: true }).filter({ visible: true }).click();
    await page.getByPlaceholder('Search users...').waitFor();
    await layouts(page, 'User management');
    await page.getByPlaceholder('Search users...').fill('Responsive');
    await page.getByText('Next', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Previous', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Back', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Ride Monitoring', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Track Live', { exact: true }).filter({ visible: true }).first().waitFor();
    await layouts(page, 'Ride monitoring');
    await page.getByText('Track Live', { exact: true }).filter({ visible: true }).nth(1).click();
    await page.getByText('Next', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Previous', { exact: true }).filter({ visible: true }).click();
    await page.getByLabel('Refresh current rides', { exact: true }).click();
    await page.waitForTimeout(200);
    assert.ok(monitoringRequests >= 2);
    await page.getByText('Back', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Incident Reports', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Audio', { exact: true }).filter({ visible: true }).first().waitFor();
    await layouts(page, 'Incident reports');
    await page.getByText('Next', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Previous', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Audio', { exact: true }).filter({ visible: true }).first().click();
    await page.getByText('Play', { exact: true }).filter({ visible: true }).waitFor();
    await layouts(page, 'Audio recordings');
    await page.getByText('Play', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Pause', { exact: true }).filter({ visible: true }).waitFor();
    await page.getByText('Pause', { exact: true }).filter({ visible: true }).click();
    const download = page.waitForEvent('download');
    await page.getByText('Download', { exact: true }).filter({ visible: true }).click();
    assert.match((await download).suggestedFilename(), /^recording-INC-\d+\.wav$/);
    assert.equal(audioRequests, 2);
    await page.getByLabel('Back from recording').click();
    assert.deepEqual(errors, []);
    console.log('PASS settings save/stay/leave, notification dismiss, incident pagination, authenticated audio play/pause/download');
  } finally { await page.close(); }
}

async function security(browser) {
  let dispatched = 0;
  const alerts = Array.from({ length: 8 }, (_, i) => ({ id: i + 1, reference: `SOS-${i + 1}`, riderName: 'Student with a longer name', driverName: 'Driver name', status: 'ACTIVE', createdAt: '2026-10-04T10:00:00', gpsLat: -28.745, gpsLng: 24.77, hasAudio: false }));
  const { page, errors } = await account(browser, 'SECURITY', async route => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/security/rides') await route.fulfill({ json: Array.from({ length: 8 }, (_, i) => ({ id: i + 1, status: 'STARTED', riderName: 'Student with a longer name', driverName: 'Driver with a longer name', pickupLocation: 'University main entrance', destination: 'Student accommodation' })) });
    else if (path === '/api/security/sos') await route.fulfill({ json: { active: alerts, resolved: alerts.map(a => ({ ...a, status: 'RESOLVED' })) } });
    else if (path.endsWith('/dispatch')) { dispatched++; await route.fulfill({ json: { message: 'Mock dispatch confirmed' } }); }
    else await route.fallback();
  });
  try {
    const dock = page.locator('[data-testid="security-bottom-nav"]:visible');
    await dock.getByText('Active Rides', { exact: true }).click();
    await page.getByText('Contact', { exact: true }).filter({ visible: true }).waitFor();
    await layouts(page, 'Security active rides');
    await page.getByText('Contact', { exact: true }).filter({ visible: true }).click();
    await page.getByText('No driver phone number is available for the active rides.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await page.getByText('Center Map', { exact: true }).filter({ visible: true }).click();
    await dock.getByText('SOS Alerts', { exact: true }).click();
    await page.getByText('Dispatch', { exact: true }).filter({ visible: true }).first().waitFor();
    for (const [width, height] of sizes) {
      await page.setViewportSize({ width, height });
      await checkPageWidth(page, 'Populated SOS alerts');
      const box = await dock.boundingBox();
      assert.ok(Math.abs(box.y + box.height - height) <= 1, 'Eight active alerts cannot displace security dock');
    }
    await page.getByText('Dispatch', { exact: true }).filter({ visible: true }).first().click();
    await page.getByText('Mock dispatch confirmed', { exact: true }).filter({ visible: true }).waitFor();
    assert.equal(dispatched, 1);
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await page.getByText('Audio', { exact: true }).filter({ visible: true }).first().click();
    await page.getByText('Audio is not available yet. Finish the SOS recording and refresh the list.', { exact: true }).filter({ visible: true }).waitFor();
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await page.getByText('View All SOS', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Next', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Previous', { exact: true }).filter({ visible: true }).click();
    await checkPageWidth(page, 'Resolved SOS landscape');
    assert.deepEqual(errors, []);
    console.log('PASS populated SOS dock at seven sizes, mocked dispatch, missing audio feedback, resolved pagination');
  } finally { await page.close(); }
}

async function driver(browser) {
  const request = { id: '101', riderName: 'Test Student', riderInitials: 'TS', riderRating: 4.5, pickup: 'University main entrance', destination: 'Student accommodation', fare: 'R45.50', pickupLat: -28.745, pickupLng: 24.77, destLat: -28.75, destLng: 24.76 };
  let ride = { id: 101, status: 'ARRIVED', riderName: request.riderName, pickupLocation: request.pickup, destination: request.destination, fare: 45.5, pickupLat: request.pickupLat, pickupLng: request.pickupLng, destLat: request.destLat, destLng: request.destLng };
  const statuses = [], messages = [];
  let accepted = 0, rated = 0;
  const { page, errors } = await account(browser, 'DRIVER', async route => {
    const req = route.request(), path = new URL(req.url()).pathname;
    if (path === '/api/driver/requests') await route.fulfill({ json: [request] });
    else if (path === '/api/driver/requests/101') await route.fulfill({ json: request });
    else if (path === '/api/driver/requests/101/accept') { accepted++; await route.fulfill({ json: ride }); }
    else if (path === '/api/driver/rides/101') await route.fulfill({ json: ride });
    else if (path === '/api/driver/rides/101/status') {
      ride = { ...ride, status: req.postDataJSON().status }; statuses.push(ride.status);
      await route.fulfill({ json: ride });
    } else if (path === '/api/rides/101/messages') {
      if (req.method() === 'POST') messages.push({ id: messages.length + 1, senderId: 1, message: req.postDataJSON().message, createdAt: '2026-10-04T10:00:00' });
      await route.fulfill({ json: req.method() === 'POST' ? messages.at(-1) : messages });
    } else if (path === '/api/rides/101/rider-rating') { rated++; await route.fulfill({ json: {} }); }
    else await route.fallback();
  });
  try {
    await page.getByText('View Request', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Accept Ride', { exact: true }).filter({ visible: true }).waitFor();
    await layouts(page, 'Ride request details');
    await page.getByText('Accept Ride', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Start Trip', { exact: true }).filter({ visible: true }).waitFor();
    assert.equal(accepted, 1);
    await layouts(page, 'Driver active ride');
    await page.getByLabel('Call rider', { exact: true }).click();
    await page.getByText('The rider has not provided a phone number. Use Message instead.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Dismiss notification' }).click();
    await page.getByLabel('Message rider', { exact: true }).click();
    await page.getByPlaceholder('Type a message').fill('Fixture-only message');
    await page.getByLabel('Send message', { exact: true }).click();
    await page.getByText('Fixture-only message', { exact: true }).waitFor();
    await page.getByLabel('Close messages', { exact: true }).click();
    assert.equal(messages.length, 1);
    await page.getByText('Start Trip', { exact: true }).filter({ visible: true }).click();
    await page.getByText('Complete Trip', { exact: true }).filter({ visible: true }).click();
    await page.getByLabel('Rate rider 4 out of 5', { exact: true }).click();
    await page.getByText('Submit rating', { exact: true }).filter({ visible: true }).click();
    await page.locator('[data-testid="driver-bottom-nav"]:visible').waitFor();
    assert.deepEqual(statuses, ['STARTED', 'COMPLETED']);
    assert.equal(rated, 1);
    assert.deepEqual(errors, []);
    console.log('PASS mocked accept, missing phone feedback, chat send/close, start/complete and rider rating in landscape');
  } finally { await page.close(); }
}

async function main() {
  const browser = await chromium.launch({ headless: true, executablePath: chromium.executablePath() });
  try {
    for (const [name, check] of Object.entries({ payment, admin, security, driver })) {
      if (!process.argv[2] || process.argv[2] === name) await check(browser);
    }
  }
  finally { await browser.close(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
