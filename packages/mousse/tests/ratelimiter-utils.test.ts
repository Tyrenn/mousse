import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { ipKey } from '@tyren/mousse';
import { formatDuration, parseTimeWindow } from '../dist/utils.js';

describe('parseTimeWindow', () => {
	test('numbers are milliseconds', () => {
		assert.equal(parseTimeWindow(1500), 1500);
	});

	test('strings carry a unit', () => {
		assert.equal(parseTimeWindow('500ms'), 500);
		assert.equal(parseTimeWindow('10s'), 10000);
		assert.equal(parseTimeWindow('1 minute'), 60000);
		assert.equal(parseTimeWindow('2 hours'), 7200000);
		assert.equal(parseTimeWindow('1 DAY'), 86400000);
		assert.equal(parseTimeWindow('1500'), 1500);
	});

	test('invalid values throw', () => {
		for(const value of ['', 'soon', '1 fortnight', '-1s', 0, -5, NaN, Infinity])
			assert.throws(() => parseTimeWindow(value), /Invalid rate limit time window/);
	});
});

describe('formatDuration', () => {
	test('uses the largest unit, rounded up', () => {
		assert.equal(formatDuration(0), '1 second');
		assert.equal(formatDuration(1000), '1 second');
		assert.equal(formatDuration(30000), '30 seconds');
		assert.equal(formatDuration(60000), '1 minute');
		assert.equal(formatDuration(61000), '2 minutes');
		assert.equal(formatDuration(3600000), '1 hour');
		assert.equal(formatDuration(172800000), '2 days');
	});
});

describe('ipKey', () => {
	test('IPv4 is kept', () => {
		assert.equal(ipKey('203.0.113.7'), '203.0.113.7');
	});

	test('IPv4-mapped addresses become IPv4', () => {
		assert.equal(ipKey('::ffff:203.0.113.7'), '203.0.113.7');
		assert.equal(ipKey('::ffff:cb00:7107'), '203.0.113.7');
	});

	test('IPv6 addresses of a /64 share a key, whatever their notation', () => {
		const key = ipKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd');
		assert.equal(key, '2001:db8:1:2:0:0:0:0/64');
		assert.equal(ipKey('2001:DB8:1:2::1'), key);
		assert.notEqual(ipKey('2001:db8:1:3::1'), key);
	});

	test('the subnet is configurable, down to the bit', () => {
		assert.equal(ipKey('2001:db8:1:2::1', 128), '2001:db8:1:2:0:0:0:1/128');
		assert.equal(ipKey('2001:db8:ffff::', 40), '2001:db8:ff00:0:0:0:0:0/40');
		assert.equal(ipKey('2001:db8::1', 0), '0:0:0:0:0:0:0:0/0');
	});

	test('zone indexes are dropped, anything else is left alone', () => {
		assert.equal(ipKey('fe80::1%eth0'), 'fe80:0:0:0:0:0:0:0/64');
		assert.equal(ipKey('Unknown'), 'unknown');
	});
});
