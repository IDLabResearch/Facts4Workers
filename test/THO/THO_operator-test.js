
var assert = require('assert');
var _ = require('lodash');
var ValidCall = require('../../ValidCall');
var RESTdesc = require('../../RESTdesc');
var stubs = require('./THO_operator-stubs');

describe('THO operator use case', function ()
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
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
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
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getOperatorID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 'fe25bbc1-4e4e-4da4-99f7-6a673c53e237' }, result, done);
        });
    });

    it ('asks for a machine ID', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
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

    it ('asks for a part ID', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getPartID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 1 }, result, done);
        });
    });

    it ('asks for a defect ID', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getDefectID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: '0324aa5e-9136-4888-85c7-9027a66121ab' }, result, done);
        });
    });

    it ('asks for a solution ID', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getSolutionID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: '9519490e-5fb8-401b-b864-339c8b16dc56' }, result, done);
        });
    });

    it ('asks for a report', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
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

    it ('asks for a solution ID if the report failed', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getSolutionID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: '9519490e-5fb8-401b-b864-339c8b16dc56' }, result, done);
        });
    });

    it ('asks for a report again', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getReport');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['success', 'comment']);
            rest.handleUserResponse({ success: true, comment: 'not solved!' }, result, done);
        });
    });

    it ('updates the user that he is finished', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/YouAreDone');
            rest.handleUserResponse({}, result, done);
        });
    });

    it ('is finished', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['status'], 'DONE');
            done();
        });
    });

    it('can be rolled back to getSolutionID', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.back(function ()
        {
            rest.back(function ()
            {
                rest.back(function ()
                {
                    done();
                });
            });
        });
    });

    it('asks for a solution ID (again)', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getSolutionID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 'e314e5ab-9860-4c4c-8830-83dc84d5c307' }, result, done);
        });
    });

    it ('updates the user that he is unqualified', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
        rest.next(function (error, result)
        {
            if (error)
                throw error;
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/SentToTeamLeader');
            rest.handleUserResponse({}, result, done);
        });
    });

    it ('is (really) finished', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.operator, key);
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