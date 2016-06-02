/**
 * Created by joachimvh on 13/05/2016.
 */

var assert = require('assert');
var _ = require('lodash');
var ValidCall = require('../../node_modules/RESTdesc/ValidCall'); // totally not a dirty hack at all
var RESTdesc = require('restdesc').RESTdesc;
var stubs = require('./HIR-stubs');
var request = require('request');


describe('HIR offset use case with HTTP calls', function ()
{
    var key = 'TESTKEY';
    var oldCall = null;
    var output = { data: key };
    var requestParams = {
        url: 'http://localhost:3000/next',
        method: 'POST',
        json: { goal: 'HIR_Offset', eye: output}
    };
    before(function (done)
    {
        oldCall = ValidCall.prototype.call;
        ValidCall.prototype.call = TEST.createStubFunction(stubs);
        new RESTdesc('redis://localhost:6379', [], '', key).clear(done);
    });

    it('start process', function (done)
    {
        request(requestParams, function (error, response, body)
        {
            output = body;
            // TODO: assert stuff
            done();
        });
    });

    it('answer authorization', function (done)
    {
        console.log(output);
        requestParams.json.eye = output;
        requestParams.json.json = { username: 'iminds', password: 'iminds'};
        request(requestParams, function (error, response, body)
        {
            output = body;
            // TODO: assert stuff
            console.log(body);
            done();
        });
    });

    it('answer getPartID', function (done)
    {
        console.log(output);
        requestParams.json.eye = output;
        requestParams.json.json = { id: '5b015ac5-fd14-488c-b387-2d8d7b5d4989' };
        request(requestParams, function (error, response, body)
        {
            output = body;
            // TODO: assert stuff
            done();
        });
    });

    it('go back', function (done)
    {
        console.log(output);
        var backParams = {
            url: 'http://localhost:3000/back',
            method: 'POST',
            json: output
        };
        request(backParams, function (error, response, body)
        {
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
            // TODO: assert stuff
            done();
        });
    });

    it('answer measurements', function (done)
    {
        console.log(output);
        requestParams.json.eye = output;
        requestParams.json.json = [{'id': 1, 'measurement': 5.1}, {'id': 2, 'measurement': 2.8}];
        request(requestParams, function (error, response, body)
        {
            output = body;
            // TODO: assert stuff
            done();
        });
    });

    after(function (done)
    {
        new RESTdesc('redis://localhost:6379', [], '', key).clear(done);
        ValidCall.prototype.call = oldCall;
    });
});