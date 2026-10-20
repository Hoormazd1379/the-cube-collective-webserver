'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const root = path.resolve(__dirname, '..');

test('deployment install does not include unsupported native node-sass', () => {
  const manifest = require('../package.json');
  for (const field of ['dependencies', 'devDependencies', 'optionalDependencies']) {
    assert.equal(manifest[field]?.['node-sass'], undefined, `${field} must not install node-sass`);
  }
  const lockfile = fs.readFileSync(path.join(root, 'yarn.lock'), 'utf8');
  assert.doesNotMatch(lockfile, /(?:^|\n)node-sass@/, 'frozen installs must not retain node-sass');
});

test('webpack continues to select the existing Dart Sass implementation', () => {
  const config = require('../webpack.config');
  const loaders = config.module.rules.flatMap(rule => Array.isArray(rule.use) ? rule.use : []);
  const sassLoader = loaders.find(loader => loader.loader === 'sass-loader');
  assert.ok(sassLoader, 'webpack must compile the SCSS entry points');
  assert.equal(sassLoader.options.implementation, require('sass'));
});
