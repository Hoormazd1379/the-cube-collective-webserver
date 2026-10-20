'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const proxyaddr = require('proxy-addr');
const { createRequire } = require('node:module');
const http = require('node:http');

test('patched multipart dependencies preserve Axios and request form uploads', async () => {
  const server = http.createServer((req, res) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ contentType: req.headers['content-type'], body }));
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const url = `http://127.0.0.1:${server.address().port}/upload`;
  try {
    const axios = require('axios');
    const requireFromAxios = createRequire(require.resolve('axios'));
    const FormData = requireFromAxios('form-data');
    const form = new FormData();
    form.append('message', 'axios upload');
    const response = await axios.post(url, form, {
      headers: form.getHeaders(), proxy: false, timeout: 2000
    });
    assert.match(response.data.contentType, /^multipart\/form-data; boundary=/);
    assert.match(response.data.body, /name="message"/);
    assert.match(response.data.body, /axios upload/);

    const request = require('request');
    const legacy = await new Promise((resolve, reject) => {
      request.post({ url, proxy: null, timeout: 2000,
        formData: { message: 'request upload' } }, (error, response, body) => {
        if (error) return reject(error);
        try {
          assert.equal(response.statusCode, 200);
          resolve(JSON.parse(body));
        } catch (parseError) { reject(parseError); }
      });
    });
    assert.match(legacy.contentType, /^multipart\/form-data; boundary=/);
    assert.match(legacy.body, /name="message"/);
    assert.match(legacy.body, /request upload/);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test('GHSA-fjxv-7rqg-78g4: Axios multipart boundaries do not use Math.random', () => {
  const requireFromAxios = createRequire(require.resolve('axios'));
  const FormData = requireFromAxios('form-data');
  const originalRandom = Math.random;
  let first;
  let second;
  try {
    Math.random = () => 0.5;
    first = new FormData().getBoundary();
    second = new FormData().getBoundary();
  } finally {
    Math.random = originalRandom;
  }
  assert.notEqual(first, second, 'Attacker-predictable Math.random must not fix multipart boundaries');
});

test('GHSA-fjxv-7rqg-78g4: request multipart boundaries do not use Math.random', () => {
  const requireFromRequest = createRequire(require.resolve('request'));
  const FormData = requireFromRequest('form-data');
  const originalRandom = Math.random;
  let first;
  let second;
  try {
    Math.random = () => 0.5;
    first = new FormData().getBoundary();
    second = new FormData().getBoundary();
  } finally {
    Math.random = originalRandom;
  }
  assert.notEqual(first, second, 'Legacy request must also use unpredictable multipart boundaries');
});

test('GHSA-jqcg-44mw-7w3h: short IPv6 trust prefixes do not trust IPv4 clients', () => {
  const request = {
    socket: { remoteAddress: '203.0.113.10' },
    headers: { 'x-forwarded-for': '198.51.100.42' }
  };
  for (const trust of ['::ffff:10.0.0.0/8', '::/1']) {
    assert.equal(proxyaddr(request, trust), '203.0.113.10', trust);
  }
  for (const trust of ['10.0.0.0/8', '::ffff:10.0.0.0/104']) {
    assert.equal(proxyaddr.compile(trust)('10.1.2.3'), true, trust);
    assert.equal(proxyaddr.compile(trust)('203.0.113.10'), false, trust);
  }
});
