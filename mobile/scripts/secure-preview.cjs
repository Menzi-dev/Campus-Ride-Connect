// Same-origin proxy for the Expo web app and Spring API. Supply TLS_KEY and
// TLS_CERT for LAN HTTPS, or run behind a trusted HTTPS tunnel on port 8084.
const http = require('node:http');
const https = require('node:https');
const fs = require('node:fs');
const path = require('node:path');

function targetFor(url) {
  return /^\/(api|uploads)(\/|\?|$)/.test(url || '') ? 8080 : 8081;
}
function proxy(req, res) {
  if (new URL(req.url, 'http://localhost').pathname === '/phone') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
    res.end(fs.readFileSync(path.join(__dirname, 'phone-preview.html')));
    return;
  }
  const port = targetFor(req.url);
  const headers = { ...req.headers, host: `localhost:${port}` };
  // The proxy is the browser's API origin. The internal hop uses localhost.
  if (headers.origin) headers.origin = `http://localhost:${port}`;
  const upstream = http.request({ hostname: '127.0.0.1', port,
    path: req.url, method: req.method, headers }, response => {
    const responseHeaders = { ...response.headers };
    delete responseHeaders['access-control-allow-origin'];
    res.writeHead(response.statusCode, responseHeaders);
    response.pipe(res);
  });
  upstream.on('error', () => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' });
    res.end('App or backend is unavailable. Keep both servers running.');
  });
  req.on('aborted', () => upstream.destroy());
  req.pipe(upstream);
}
const tls = process.env.TLS_KEY && process.env.TLS_CERT;
const server = tls ? https.createServer({
  key: fs.readFileSync(process.env.TLS_KEY),
  cert: fs.readFileSync(process.env.TLS_CERT),
}, proxy) : http.createServer(proxy);
server.on('upgrade', (req, socket, head) => {
  const port = targetFor(req.url);
  const upstream = http.request({ hostname: '127.0.0.1', port,
    path: req.url, headers: { ...req.headers, host: `localhost:${port}` } });
  upstream.on('upgrade', (response, remote, remoteHead) => {
    socket.write(`HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`);
    for (let i = 0; i < response.rawHeaders.length; i += 2)
      socket.write(`${response.rawHeaders[i]}: ${response.rawHeaders[i + 1]}\r\n`);
    socket.write('\r\n');
    if (remoteHead.length) socket.write(remoteHead);
    if (head.length) remote.write(head);
    remote.pipe(socket).pipe(remote);
    socket.on('error', () => remote.destroy());
    remote.on('error', () => socket.destroy());
  });
  upstream.on('error', () => socket.destroy());
  upstream.end();
});
server.listen(Number(process.env.SECURE_PREVIEW_PORT || 8084), '0.0.0.0', () => {
  console.log(`Preview proxy listening on port ${server.address().port} (${tls ? 'HTTPS' : 'HTTP; HTTPS tunnel required'})`);
});
