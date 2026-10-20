'use strict';

// Run hostile inputs off the test runner's thread; the parent imposes a deadline.
const assert = require('node:assert/strict');
const { parentPort, workerData } = require('node:worker_threads');
const { createRequire } = require('node:module');

switch (workerData) {
  case 'nanoid': {
    const { nanoid, customAlphabet } = require('nanoid/non-secure');
    for (const generate of [nanoid, customAlphabet('abc', 8)]) {
      try {
        assert.equal(generate(-1), '');
      } catch (error) {
        if (!(error instanceof RangeError)) throw error;
      }
      assert.equal(generate(8).length, 8);
    }
    break;
  }
  case 'brace-expansion-1':
  case 'brace-expansion-2': {
    const consumer = workerData.endsWith('1') ? 'minimatch' : 'filelist';
    const fromConsumer = createRequire(require.resolve(consumer));
    const fromMinimatch = consumer === 'minimatch' ? fromConsumer :
      createRequire(fromConsumer.resolve('minimatch'));
    const expand = fromMinimatch('brace-expansion');
    const hostile = 'a' + Array(30).fill('{}').join(',');
    assert.ok(Array.isArray(expand(hostile)));
    assert.deepEqual(expand('file{1..3}.{css,js}'), [
      'file1.css', 'file1.js', 'file2.css', 'file2.js', 'file3.css', 'file3.js'
    ]);
    break;
  }
  default:
    throw new Error(`Unknown probe: ${workerData}`);
}
parentPort.postMessage('passed');
