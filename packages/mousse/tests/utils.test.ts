import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { joinUri, parseQueryString, normalizeIp, compileTrustProxy } from '@tyren/mousse';
import { matchPattern, definedProps } from '../dist/utils.js';

describe('joinUri', () => {
	test('joins with a single slash', () => {
		assert.equal(joinUri('/users', '/list'), '/users/list');
		assert.equal(joinUri('/users/', '/list'), '/users/list');
		assert.equal(joinUri('/users', 'list'), '/users/list');
	});

	test('empty parent keeps the child rooted', () => {
		assert.equal(joinUri('', '/list'), '/list');
	});

	test('a mounted root route answers on the mount point itself', () => {
		assert.equal(joinUri('/users', '/'), '/users');
		assert.equal(joinUri('/users', ''), '/users');
		assert.equal(joinUri('', '/'), '/');
	});
});

describe('parseQueryString', () => {
	test('parses simple pairs', () => {
		assert.deepEqual(parseQueryString('a=1&b=2'), {a : '1', b : '2'});
	});

	test('repeated keys become arrays', () => {
		assert.deepEqual(parseQueryString('t=x&t=y'), {t : ['x', 'y']});
	});

	test('[] suffix is stripped', () => {
		assert.deepEqual(parseQueryString('tags[]=x&tags[]=y'), {tags : ['x', 'y']});
	});

	test('+ decodes to space, key without value becomes empty string', () => {
		assert.deepEqual(parseQueryString('q=hello+world&flag'), {q : 'hello world', flag : ''});
	});

	test('only the first = splits, values keep theirs', () => {
		assert.deepEqual(parseQueryString('eq=a=b'), {eq : 'a=b'});
	});

	test('invalid percent-encoding falls back to the raw string', () => {
		assert.deepEqual(parseQueryString('a=%ZZ'), {a : '%ZZ'});
	});
});

describe('matchPattern', () => {
	test('matches on segment boundaries only', () => {
		assert.equal(matchPattern('/user', '/user'), true);
		assert.equal(matchPattern('/user', '/user/me'), true);
		assert.equal(matchPattern('/user', '/users'), false);
	});

	test('empty pattern matches everything', () => {
		assert.equal(matchPattern('', '/anything'), true);
		assert.equal(matchPattern(undefined, '/anything'), true);
	});
});

describe('definedProps', () => {
	test('drops undefined properties, keeps falsy defined ones', () => {
		assert.deepEqual(definedProps({a : 1, b : undefined, c : null, d : 0}), {a : 1, c : null, d : 0});
	});
});

describe('normalizeIp', () => {
	test('IPv4-mapped addresses become dotted IPv4', () => {
		assert.equal(normalizeIp('0000:0000:0000:0000:0000:ffff:7f00:0001'), '127.0.0.1');
	});

	test('IPv6 is compressed', () => {
		assert.equal(normalizeIp('0000:0000:0000:0000:0000:0000:0000:0001'), '::1');
		assert.equal(normalizeIp('2001:0db8:0000:0000:0000:0000:0000:0001'), '2001:db8::1');
		assert.equal(normalizeIp('2001:0db8:0001:0002:0003:0004:0005:0006'), '2001:db8:1:2:3:4:5:6');
	});

	test('dotted IPv4 is kept', () => {
		assert.equal(normalizeIp('10.0.0.1'), '10.0.0.1');
	});
});

describe('compileTrustProxy', () => {
	test('nothing trusted by default', () => {
		assert.equal(compileTrustProxy()('127.0.0.1'), false);
		assert.equal(compileTrustProxy(false)('127.0.0.1'), false);
	});

	test('true trusts everything', () => {
		assert.equal(compileTrustProxy(true)('8.8.8.8'), true);
	});

	test('addresses, CIDR ranges and aliases', () => {
		const trust = compileTrustProxy(['10.0.0.0/8', '203.0.113.7', 'loopback', 'fd00::/8']);
		assert.equal(trust('10.1.2.3'), true);
		assert.equal(trust('203.0.113.7'), true);
		assert.equal(trust('203.0.113.8'), false);
		assert.equal(trust('127.0.0.1'), true);
		assert.equal(trust('::1'), true);
		assert.equal(trust('fd12::1'), true);
		assert.equal(trust('not-an-ip'), false);
	});

	test('invalid entries throw at compile time', () => {
		assert.throws(() => compileTrustProxy(['nope']), /Invalid trustProxy entry/);
	});
});
