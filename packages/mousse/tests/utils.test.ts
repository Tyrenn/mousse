import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { joinUri, parseQueryString } from 'mousse';
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
