'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const http = require('node:http');
const { once } = require('node:events');
const { createRequire } = require('node:module');
const authRequire = createRequire(require.resolve('@xboxreplay/xboxlive-auth'));
const legacyAxiosRequire = createRequire(authRequire.resolve('axios'));
const modernAxiosRequire = createRequire(require.resolve('axios'));

for (const [consumer, load] of [['legacy auth Axios', legacyAxiosRequire], ['direct Axios', modernAxiosRequire]]) {
  for (const arrayHeaders of [true, false]) {
    test(`${consumer}: cross-origin redirects strip ${arrayHeaders ? 'array-form' : 'regex-metacharacter'} credentials`, { timeout: 5000 }, async () => {
      const collector = http.createServer((req, res) => res.end(JSON.stringify(req.headers)));
      const redirector = http.createServer((req, res) => {
        req.resume();
        res.writeHead(302, { Location: `http://127.0.0.1:${collector.address().port}/target` });
        res.end();
      });
      try {
        collector.listen(0, '127.0.0.1');
        await once(collector, 'listening');
        redirector.listen(0, '127.0.0.1');
        await once(redirector, 'listening');
        const headers = {
          Host: `127.0.0.1:${redirector.address().port}`,
          Authorization: 'Bearer test-only',
          Cookie: 'session=test-only',
          'Proxy-Authorization': 'Basic test-only',
          'X-Api^Key': 'test-only',
          'X-Token|Secret': 'test-only',
          'X-Control': 'preserved'
        };
        const received = await new Promise((resolve, reject) => {
          const req = load('follow-redirects').http.request({
            hostname: '127.0.0.1', port: redirector.address().port, path: '/',
            headers: arrayHeaders ? Object.entries(headers).flat() : headers,
            sensitiveHeaders: ['X-Api^Key', 'X-Token|Secret']
          }, res => {
            let body = '';
            res.on('data', chunk => { body += chunk; });
            res.on('error', reject);
            res.on('end', () => { try { resolve(JSON.parse(body)); } catch (error) { reject(error); } });
          });
          req.on('error', reject);
          req.setTimeout(2000, () => req.destroy(new Error('Loopback request timed out')));
          req.end();
        });
        assert.equal(received['x-control'], 'preserved');
        for (const name of ['authorization', 'cookie', 'proxy-authorization', 'x-api^key', 'x-token|secret']) {
          assert.equal(received[name], undefined, `${name} leaked to redirect target`);
        }
        assert.equal(received.host, `127.0.0.1:${collector.address().port}`);
      } finally {
        redirector.closeAllConnections();
        collector.closeAllConnections();
        await Promise.all([new Promise(resolve => redirector.close(resolve)), new Promise(resolve => collector.close(resolve))]);
      }
    });
  }
}
