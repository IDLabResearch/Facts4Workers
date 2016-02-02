
var assert = require('assert');
var _ = require('lodash');
var path = require('path');
var ValidCall = require('../../ValidCall');
var RESTdesc = require('../../RESTdesc');
var stubs = require('./THO_operator-stubs');

function callStub (callback)
{
    var url = this.getURL();
    if (!(url in stubs))
        throw 'Unsupported URL stub: ' + url;
    var result = stubs[url](this.getBody());
    callback(result);
}

function relative (relativePath)
{
    return path.join(path.join(__dirname, '../..'), relativePath);
}

describe('THO operator use case', function ()
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
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getOperatorID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 2 }, result, done);
        });
    });

    it ('asks for a machine ID', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getMachineID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 1 }, result, done);
        });
    });

    it ('asks for a part ID', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getPartID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 1 }, result, done);
        });
    });

    it ('asks for a defect ID', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getDefectID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 1 }, result, done);
        });
    });

    it ('asks for a solution ID', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getSolutionID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 3 }, result, done);
        });
    });

    it ('asks for a report', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getReport');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['solved', 'comment']);
            rest.handleUserResponse({ solved: false, comment: 'not solved!' }, result, done);
        });
    });

    it ('asks for a solution ID if the report failed', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getSolutionID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 3 }, result, done);
        });
    });

    it ('asks for a report again', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getReport');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['solved', 'comment']);
            rest.handleUserResponse({ solved: true, comment: 'not solved!' }, result, done);
        });
    });

    it ('updates the user that he is finished', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/YouAreDone');
            rest.handleUserResponse({}, result, done);
        });
    });

    it ('is finished', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['status'], 'DONE');
            done();
        });
    });

    it('can be rolled back to getSolutionID', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
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
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/getSolutionID');
            var contains = result['http:resp']['http:body']['contains'];
            assert.deepEqual(Object.keys(contains), ['id']);
            rest.handleUserResponse({ id: 1 }, result, done);
        });
    });

    it ('updates the user that he is unqualified', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
        rest.next(function (result)
        {
            assert.strictEqual(result['http:requestURI'], 'http://askTheWorker/SentToTeamLeader');
            rest.handleUserResponse({}, result, done);
        });
    });

    it ('is (really) finished', function (done)
    {
        var rest = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'), key);
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