
var assert = require('assert');
var _ = require('lodash');
var ValidCall = require('../../ValidCall');
var RESTdesc = require('../../RESTdesc');
var stubs = require('./HIR-stubs');

describe('HIR offset use case', function ()
{
    var key = 'TESTKEY';
    var oldCall = null;
    before(function (done)
    {
        oldCall = ValidCall.prototype.call;
        ValidCall.prototype.call = TEST.createStubFunction(stubs);
        new RESTdesc([], '', key).clear(done);
    });

    it ('requires authorization', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.offset, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/authorization');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['username', 'password']);
            rest.handleUserResponse({ username: 'iminds', password: 'iminds' }, result, done);
        });
    });

    it ('asks for a part ID', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.offset, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getPartID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: '5b015ac5-fd14-488c-b387-2d8d7b5d4989' }, result, done);
        });
    });

    it ('asks for measurements', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.offset, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getMeasurements');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['dimensions']);
            rest.handleUserResponse({dimensions: [{id: 1, measurement: 6}]}, result, done);
        });
    });

    it ('shows final result', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.offset, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/showCheckResult');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(contains, undefined);
            rest.handleUserResponse({dimensions: [{id: 1, measurement: 6}]}, result, done);
        });
    });

    it ('is finished', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.offset, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['status'], 'DONE');
            done();
        });
    });

    after(function (done)
    {
        new RESTdesc([], '', key).clear(done);
        ValidCall.prototype.call = oldCall;
    });
});