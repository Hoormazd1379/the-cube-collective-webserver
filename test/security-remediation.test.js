'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const path = require('node:path');
const fs = require('node:fs');
const { Worker } = require('node:worker_threads');
const { createRequire } = require('node:module');
const http = require('node:http');
const { once } = require('node:events');
const semver = require('semver');

for (const probe of ['nanoid', 'brace-expansion-1', 'brace-expansion-2']) {
  test(`${probe}: hostile inputs terminate and normal generation/expansion survives`, async () => {
    const worker = new Worker(path.join(__dirname, 'fixtures/dependency-probe.cjs'), {
      workerData: probe
    });
    try {
      await new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${probe} exceeded 1500ms`)), 1500);
        const finish = (error) => {
          clearTimeout(timer);
          error ? reject(error) : resolve();
        };
        worker.once('message', message => finish(message === 'passed' ? null : new Error(message)));
        worker.once('error', finish);
        worker.once('exit', code => finish(new Error(`Probe exited before reporting: ${code}`)));
      });
    } finally {
      await worker.terminate();
    }
  });
}

test('immutable rejects overflowing List sizes instead of silently corrupting them', () => {
  const { List } = require('immutable');
  assert.throws(() => List([1, 2, 3]).setSize(2 ** 31), RangeError);
  assert.throws(() => List([1, 2, 3]).setSize(2 ** 32 + 5), RangeError);
  assert.deepEqual(List([1, 2, 3]).set(1, 4).toArray(), [1, 4, 3]);
});

test('remove unused node-sass and its vulnerable tar installation dependency', () => {
  const manifest = require('../package.json');
  assert.equal(manifest.devDependencies['node-sass'], undefined);
  const config = require('../webpack.config');
  const sassRule = config.module.rules.find(rule => rule.test.test('file.scss'));
  assert.equal(sassRule.use.at(-1).options.implementation, require('sass'));
  const lock = fs.readFileSync(path.join(__dirname, '../yarn.lock'), 'utf8');
  assert.doesNotMatch(lock, /^tar@/m);
});

test('all locked copies for the four security obligations meet patched floors', () => {
  const floors = {
    nanoid: { 3: '3.3.18' },
    'brace-expansion': { 1: '1.1.21', 2: '2.1.7' },
    'fast-uri': { 3: '3.1.8' },
    immutable: { 4: '4.3.9' },
    browserslist: { 4: '4.28.7' },
    'form-data': { 2: '2.5.6', 4: '4.0.6' },
    axios: { 0: '0.21.4', 1: '1.20.0' }, // Legacy auth's 0.x copy is explicitly deferred.
    express: { 4: '4.22.3' },
    'body-parser': { 1: '1.20.8' },
    postcss: { 8: '8.5.23' },
    'postcss-selector-parser': { 7: '7.1.6' },
    webpack: { 5: '5.104.1' },
    ws: { 8: '8.21.0' },
    'socket.io': { 4: '4.8.3' },
    lodash: { 4: '4.18.1' }
  };
  const lock = fs.readFileSync(path.join(__dirname, '../yarn.lock'), 'utf8');
  const found = new Set();
  for (const block of lock.split(/\n\n/)) {
    for (const [name, majors] of Object.entries(floors)) {
      if (!block.startsWith(`${name}@`) && !block.startsWith(`"${name}@`)) continue;
      const version = block.match(/\n  version "([^"]+)"/)[1];
      const floor = majors[semver.major(version)];
      assert.ok(floor, `Unreviewed major: ${name}@${version}`);
      assert.ok(semver.gte(version, floor), `${name}@${version} must be >= ${floor}`);
      found.add(name);
    }
  }
  assert.deepEqual([...found].sort(), Object.keys(floors).sort());
});

test('patched URI, browser targeting and legacy multipart consumers remain usable', () => {
  const uri = require('fast-uri');
  assert.equal(uri.parse('https://example.test/a?b=c').host, 'example.test');
  assert.equal(uri.resolve('https://example.test/a/', '../b'), 'https://example.test/b');
  assert.ok(require('browserslist')('defaults').length > 0);
  for (const consumer of ['axios', 'request']) {
    const fromConsumer = createRequire(require.resolve(consumer));
    const FormData = fromConsumer('form-data');
    const form = new FormData();
    form.append('field', 'value');
    assert.match(form.getHeaders()['content-type'], /^multipart\/form-data; boundary=/);
  }
});

test('Socket.IO consumer upgrade preserves real loopback event exchange', { timeout: 6000 }, async () => {
  const { Server } = require('socket.io');
  const clientFromViewer = createRequire(require.resolve('prismarine-viewer/package.json'));
  const { io } = clientFromViewer('socket.io-client');
  const server = http.createServer();
  const socketServer = new Server(server);
  let client;
  try {
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    socketServer.on('connection', socket => socket.on('echo', (value, ack) => ack(value)));
    client = io(`http://127.0.0.1:${server.address().port}`, {
      transports: ['websocket'], reconnection: false, timeout: 2000
    });
    await new Promise((resolve, reject) => {
      client.once('connect', resolve);
      client.once('connect_error', reject);
    });
    const answer = await new Promise((resolve, reject) => {
      client.timeout(2000).emit('echo', 'local security smoke', (error, value) => {
        error ? reject(error) : resolve(value);
      });
    });
    assert.equal(answer, 'local security smoke');
  } finally {
    client?.disconnect();
    await new Promise(resolve => socketServer.close(resolve));
    if (server.listening) await new Promise(resolve => server.close(resolve));
  }
});
