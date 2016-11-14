
var assert = require('assert');
var _ = require('lodash');
var RESTdesc = require('RESTdesc').RESTdesc;
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
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset_golden, key);
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
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset_golden, key);
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
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset_golden, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getMeasurements');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['golden_sample', 'measurements']);
            rest.handleUserResponse({golden_sample: false, measurements: [{id: 1, value: 6}, {id: 2, value: 8.2}]}, result, done);
        });
    });

    it ('shows the final result', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset_golden, key);
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
    
    it('is rolled back to measurement request', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.operator, key);
        rest.back(function ()
        {
            rest.back(function ()
            {
                // TODO: part of 'back' hack
                rest.lastBack = false;
                done();
            });
        });
    });
    
    it ('asks for measurements (golden)', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset_golden, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getMeasurements');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['golden_sample', 'measurements']);
            rest.handleUserResponse({golden_sample: true, measurements: [{id: 1, value: 6}, {id: 2, value: 8.2}]}, result, done);
        });
    });
    
    it ('shows the updated part result', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset_golden, key);
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
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.offset_golden, key);
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