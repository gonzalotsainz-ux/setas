import { test } from 'node:test';
import assert from 'node:assert/strict';
import { elegirMotor } from '../js/fotos.js';

test('elegirMotor: OffscreenCanvas con convertToBlob → offscreen', () => {
  class OC { convertToBlob() {} }
  assert.equal(elegirMotor({ OffscreenCanvas: OC, document: { createElement() {} } }), 'offscreen');
});
test('elegirMotor: sin convertToBlob o sin OffscreenCanvas → canvas normal', () => {
  class OC {}
  assert.equal(elegirMotor({ OffscreenCanvas: OC, document: { createElement() {} } }), 'canvas');
  assert.equal(elegirMotor({ document: { createElement() {} } }), 'canvas');
});
test('elegirMotor: sin ninguno → null', () => {
  assert.equal(elegirMotor({}), null);
});
