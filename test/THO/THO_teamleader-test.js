
var assert = require('assert');
var _ = require('lodash');
var ValidCall = require('../../ValidCall');
var RESTdesc = require('../../RESTdesc');
var stubs = require('./THO_teamleader-stubs');

function callStub (callback)
{
    var url = this.getURL();
    if (!(url in stubs))
        throw 'Unsupported URL stub: ' + url;
    var result = stubs[url](this.getBody());
    callback(result);
}

describe('THO teamleader use case', function ()
{
    var key = 'TESTKEY';
    var oldCall = null;
    before(function (done)
    {
        oldCall = ValidCall.prototype.call;
        ValidCall.prototype.call = callStub;
        new RESTdesc([], '', key).clear(done);
    });

    it ('asks for an operator ID', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.teamleader, key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getOperatorID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 2 }, result, done);
        });
    });

    it ('asks for a machine ID (choose 1)', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.teamleader, key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getMachineID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 1 }, result, done);
        });
    });

    it ('returns all events to the user', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.teamleader, key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/events');
            var contains = result['http:resp']['http:body']['contains'];
            assert.strictEqual(contains, undefined);
            rest.handleUserResponse(undefined, result, done);
        });
    });

    it ('is finished', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.teamleader, key);
        rest.next(function (result)
        {
            assert.strictEqual(result['status'], 'DONE');
            done();
        });
    });

    it('can be rolled back to get a new machine ID', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.teamleader, key);
        rest.back(function ()
        {
            rest.back(function ()
            {
                done();
            });
        });
    });

    it ('asks for a machine ID (choose 2)', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.teamleader, key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getMachineID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 2 }, result, done);
        });
    });

    it ('informs the user of the solutions and the attempts', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.teamleader, key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/solutionsReports');
            var contains = result['http:resp']['http:body']['contains'];
            assert.strictEqual(contains, undefined);
            rest.handleUserResponse(undefined, result, done);
        });
    });

    it ('asks for a new report', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.teamleader, key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getReport');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['solution_id', 'success', 'comment']);
            rest.handleUserResponse({ solution_id: 333, success: false, comment: 'not solved!' }, result, done);
        });
    });

    it ('asks for a new report if the previous one failed', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.teamleader, key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getReport');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['solution_id', 'success', 'comment']);
            rest.handleUserResponse({ solution_id: 334, success: true, comment: 'solved!' }, result, done);
        });
    });

    it ('is really finished', function (done)
    {
        var rest = new RESTdesc(TEST.files, TEST.goals.teamleader, key);
        rest.next(function (result)
        {
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