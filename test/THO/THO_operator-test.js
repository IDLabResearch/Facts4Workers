
var assert = require('assert');
var _ = require('lodash');
var proxyquire = require('proxyquire');
var path = require('path');
var ValidCall = require('../../ValidCall');
var stubs = require('./THO_operator-stubs');

ValidCall.prototype.call = function (callback)
{
    var url = this.getURL();
    if (!(url in stubs))
        throw 'Unsupported URL stub: ' + url;
    var result = stubs[url](this.getBody());
    callback(result);
};

var RESTdesc = proxyquire('../../RESTdesc', { 'ValidCall': ValidCall});

function relative (relativePath)
{
    return path.join(path.join(__dirname, '../..'), relativePath);
}

describe('THO operator use case', function ()
{
    var key = 'TESTKEY';
    before(function (done)
    {
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
            result.data = rest.cacheKey;
            rest.handleUserResponse({ "id": 3 }, result, done);
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
            result.data = rest.cacheKey;
            rest.handleUserResponse({ "id": 1 }, result, done);
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
            result.data = rest.cacheKey;
            rest.handleUserResponse({ "id": 1 }, result, done);
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
            result.data = rest.cacheKey;
            rest.handleUserResponse({ "id": 1 }, result, done);
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
            result.data = rest.cacheKey;
            rest.handleUserResponse({ "id": 3 }, result, done);
        });
    });

    after(function (done)
    {
        new RESTdesc([], '', key).clear(done);
    });
});