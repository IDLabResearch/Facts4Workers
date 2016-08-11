
var assert = require('assert');
var _ = require('lodash');
var RESTdesc = require('RESTdesc').RESTdesc;
var stubs = require('./THO-stubs');

// TODO: check if request body is also correct
describe('THO teamleader use case', function ()
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
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
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

    it ('asks for an operator ID', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getOperatorID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: '1d09d800-4936-4d49-9ab7-d006663d185b' }, result, done);
        });
    });

    it ('asks for a machine ID (choose f57438f4)', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getMachineID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 'f57438f4-ccfc-4c5d-a0ac-0c7008d4bf3f' }, result, done);
        });
    });

    it ('returns all events to the user', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/events');
            var contains = result['http:resp']['http:body']['contains'];
            assert.strictEqual(contains, undefined);
            rest.handleUserResponse(undefined, result, done);
        });
    });

    it ('is finished', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['status'], 'DONE');
            done();
        });
    });

    it('can be rolled back to get a new machine ID', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
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

    it ('asks for a machine ID (choose d8b20647)', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getMachineID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 'd8b20647-d578-46b2-a32a-479d440f438a' }, result, done);
        });
    });

    it ('returns all events to the user again', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/events');
            var contains = result['http:resp']['http:body']['contains'];
            assert.strictEqual(contains, undefined);
            rest.handleUserResponse(undefined, result, done);
        });
    });

    it ('asks for a solution', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getSolutionID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 333 }, result, done);
        });
    });

    it ('asks for a report', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getReport');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['success', 'comment']);
            rest.handleUserResponse({ success: false, comment: 'not solved!' }, result, done);
        });
    });

    it ('asks for a new solution if the previous one failed', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getSolutionID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 334 }, result, done);
        });
    });

    it ('asks for a new report', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getReport');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['success', 'comment']);
            rest.handleUserResponse({ success: true, comment: 'solved!' }, result, done);
        });
    });

    it ('is really finished', function (done)
    {
        var rest = new RESTdesc('redis://localhost:6379',TEST.files, TEST.goals.teamleader, key);
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