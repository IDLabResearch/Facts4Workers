
var assert = require('assert');
var _ = require('lodash');
var RESTdesc = require('restdesc').RESTdesc;
var stubs = require('./HIR-stubs');

describe('HIR offset use case', function ()
{
    var key = 'TESTKEY';
    var oldCall = null;
    before(function (done)
    {
        TEST.disableHTTP(stubs);
        new RESTdesc('redis://localhost:6379',[], '', key).clear(done);
    });

    it ('requires authorization', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset, key);
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
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset, key);
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
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getMeasurements');
            var body = result['http:resp']['http:body'];
            assert(_.startsWith(body, '_:'));
            rest.handleUserResponse([{id: 1, measurement: 6}, {id: 2, measurement: 8.2}], result, done);
        });
    });

    it ('shows final result', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/showCheckResult');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(contains, undefined);
            rest.handleUserResponse({}, result, done);
        });
    });

    it ('is finished', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset, key);
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
        TEST.enableHTTP();
        new RESTdesc('redis://localhost:6379',[], '', key).clear(done);
    });
});