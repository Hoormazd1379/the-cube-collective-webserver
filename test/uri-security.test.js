'use strict';

const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const test = require('node:test');

// Resolve from real consumers, not only the potentially unrelated hoisted copy.
const root = createRequire(require.resolve('../package.json'));
const from = (consumer, name) => createRequire(consumer.resolve(`${name}/package.json`));
const webpack = from(root, 'webpack');
const consumers = [
  ['root Ajv', from(root, 'ajv')],
  ['root schema-utils Ajv', from(from(root, 'schema-utils'), 'ajv')],
  ['webpack schema-utils Ajv', from(from(webpack, 'schema-utils'), 'ajv')],
  ['webpack ajv-formats Ajv', from(from(from(webpack, 'schema-utils'), 'ajv-formats'), 'ajv')],
  ['terser schema-utils Ajv', from(from(from(webpack, 'terser-webpack-plugin'), 'schema-utils'), 'ajv')]
];

for (const [name, consumer] of consumers) {
  const uri = consumer('fast-uri');

  test(`${name}: GHSA-w74x-v6f9-j3xg does not activate encoded schemes`, () => {
    for (const input of ['%6Aavascript:alert(1)', '%u006Aavascript:alert(1)']) {
      assert.notEqual(uri.parse(input).scheme, 'javascript');
      assert.ok(!uri.normalize(input).startsWith('javascript:'));
      assert.throws(() => uri.resolve('https://a.example/', input), /scheme is malformed/);
    }
    assert.equal(uri.equal('%68ttp://a/', 'http://a/'), false);
  });

  test(`${name}: GHSA-wjr9-j795-jxcr rejects ambiguous hosts`, () => {
    for (const input of ['http://a@b@evil.example/', 'http://exa\tmple.com/',
      'http://exa\rmple.com/', 'http://exa\nmple.com/']) {
      assert.ok(uri.parse(input).error, `Expected host validation error for ${JSON.stringify(input)}`);
    }
    assert.equal(uri.parse('https://example.com/').host, 'example.com');
    assert.ok(!uri.parse('https://example.com/').error);
  });

  test(`${name}: GHSA-333x-w4r6-6crp suffix output cannot activate a scheme`, () => {
    for (const scheme of ['javascript', 'data', 'vbscript']) {
      const output = uri.serialize({ scheme: 'https', path: `${scheme}:alert(1)` }, { reference: 'suffix' });
      assert.equal(uri.parse(output).scheme, undefined, output);
    }
  });

  test(`${name}: GHSA-xhq7-xmqj-769h normalization preserves relative resolution`, () => {
    const base = 'https://example.com/dir/doc';
    for (const ref of ['a/../b', '../x']) {
      assert.equal(uri.resolve(base, uri.normalize(ref)), uri.resolve(base, ref));
    }
  });
}
