/**
 * Created by joachimvh on 13/05/2016.
 */

var assert = require('assert');
var _ = require('lodash');
var RESTdesc = require('restdesc').RESTdesc;
var request = require('request');

function assertContains(output)
{
    assert(output['http:resp']);
    assert(output['http:resp']['http:body']);
    assert(output['http:resp']['http:body']['contains']);
}

describe('HIR offset use case with HTTP calls', function ()
{
    var key = 'TESTKEY';
    var output = { data: key };
    var requestParams = {
        url: 'http://localhost:3000/next',
        method: 'POST',
        json: { goal: 'HIR_Offset', eye: output}
    };
    before(function (done)
    {
        new RESTdesc('redis://localhost:6379', [], '', key).clear(done);
    });

    it('start process', function (done)
    {
        request(requestParams, function (error, response, body)
        {
            output = body;
            assert.strictEqual(output['http:requestURI'], 'authorization');
            assertContains(output);
            assert.deepEqual(Object.keys(output['http:resp']['http:body']['contains']).sort(), ['password', 'username']);
            done();
        });
    });

    it('answer authorization', function (done)
    {
        requestParams.json.eye = output;
        requestParams.json.json = { username: 'iminds', password: 'iminds'};
        request(requestParams, function (error, response, body)
        {
            output = body;
            assert.strictEqual(output['http:requestURI'], 'getPartID');
            assert(output['http:body']);
            assert(_.isArray(output['http:body']['parts']));
            assertContains(output);
            assert.deepEqual(Object.keys(output['http:resp']['http:body']['contains']).sort(), ['id']);
            done();
        });
    });

    it('answer getPartID', function (done)
    {
        requestParams.json.eye = output;
        requestParams.json.json = { id: '5b015ac5-fd14-488c-b387-2d8d7b5d4989' };
        request(requestParams, function (error, response, body)
        {
            output = body;
            assert.strictEqual(output['http:requestURI'], 'getMeasurements');
            assert(output['http:body']);
            assert(_.isObject(output['http:body']['partdetails']));
            assert.deepEqual(Object.keys(output['http:body']['partdetails']).sort(), ['description', 'dimensions', 'id', 'media_url', 'name', 'optional']);
            assert(_.isArray(output['http:body']['partdetails']['dimensions']));
            assert(output['http:resp']);
            assert(output['http:resp']['http:body']);
            assert(_.isString(output['http:resp']['http:body']));
            done();
        });
    });

    it('go back', function (done)
    {
        var backParams = {
            url: 'http://localhost:3000/back',
            method: 'POST',
            json: output
        };
        request(backParams, function (error, response, body)
        {
            assert.equal(response.statusCode, 200);
            done();
        });
    });

    it('request current call after back', function (done)
    {
        requestParams.json.eye = output;
        //requestParams.json.json = [{'id': 1, 'measurement': 5.1}, {'id': 2, 'measurement': 2.8}];
        request(requestParams, function (error, response, body)
        {
            output = body;
            assert.strictEqual(output['http:requestURI'], 'getPartID');
            assert(output['http:body']);
            assert(_.isArray(output['http:body']['parts']));
            assertContains(output);
            assert.deepEqual(Object.keys(output['http:resp']['http:body']['contains']).sort(), ['id']);
            done();
        });
    });

    it('answer getPartID again', function (done)
    {
        requestParams.json.eye = output;
        requestParams.json.json = { id: '5b015ac5-fd14-488c-b387-2d8d7b5d4989' };
        request(requestParams, function (error, response, body)
        {
            output = body;
            assert.strictEqual(output['http:requestURI'], 'getMeasurements');
            assert(output['http:body']);
            assert(_.isObject(output['http:body']['partdetails']));
            assert.deepEqual(Object.keys(output['http:body']['partdetails']).sort(), ['description', 'dimensions', 'id', 'media_url', 'name', 'optional']);
            assert(_.isArray(output['http:body']['partdetails']['dimensions']));
            assert(output['http:resp']);
            assert(output['http:resp']['http:body']);
            assert(_.isString(output['http:resp']['http:body']));
            done();
        });
    });

    it('answer measurements', function (done)
    {
        requestParams.json.eye = output;
        requestParams.json.json = [{'id': 1, 'measurement': 5.1}, {'id': 2, 'measurement': 2.8}];
        request(requestParams, function (error, response, body)
        {
            output = body;
            assert.strictEqual(output['http:requestURI'], 'showCheckResult');
            assert(output['http:body']);
            assert(_.isArray(output['http:body']['results']));
            assert(output['http:resp']);
            assert.deepEqual(output['http:resp']['http:body'], {});
            done();
        });
    });

    after(function (done)
    {
        new RESTdesc('redis://localhost:6379', [], '', key).clear(done);
    });
});