/**
 * Created by joachimvh on 16/12/2015.
 */

var assert = require('assert');
var ValidCallGenerator = require('../ValidCallGenerator');
var _ = require('lodash');

describe('ValidCalls', function ()
{
    it('can handle multiple calls in a single proof', function ()
    {
        var n3 = 'PREFIX : <http://f4w.restdesc.org/demo#>\nPREFIX tmpl: <http://purl.org/restdesc/http-template#>\nPREFIX http: <http://www.w3.org/2011/http#>\n_:sk0 :validCall {_:sk11_1 http:methodName "GET". _:sk11_1 tmpl:requestURI ("https://mstate.tho.facts4.work/api/machines"). _:sk11_1 http:resp _:sk12_1. _:sk12_1 http:body _:sk13_2. _:sk13_2 a :machineList}. _:sk1 :validCall {_:sk0_1 http:methodName "GET". _:sk0_1 tmpl:requestURI ("http://skillp.tho.facts4.work/api/operator_skills/"). _:sk0_1 http:resp _:sk1_1. _:sk1_1 http:body _:sk2_2. _:sk2_2 a :operatorlist}.';
        var calls = ValidCallGenerator.N3toValidCalls(n3, 'http://f4w.restdesc.org/demo#');
        assert.equal(calls.length, 2);

        assert.strictEqual(calls[0].getURL(), 'https://mstate.tho.facts4.work/api/machines');
        assert(_.isString(calls[0].getResponse()));
        assert.deepEqual(ValidCallGenerator.N3ToValidCall(calls[0].toN3(), 'http://f4w.restdesc.org/demo#').jsonld, calls[0].jsonld);

        assert.strictEqual(calls[1].getURL(), 'http://skillp.tho.facts4.work/api/operator_skills/');
        assert(_.isString(calls[1].getResponse()));
        assert.deepEqual(ValidCallGenerator.N3ToValidCall(calls[1].toN3(), 'http://f4w.restdesc.org/demo#').jsonld, calls[1].jsonld);
    });

    it('can also handle single calls in a proof', function ()
    {
        var n3 = 'PREFIX : <http://f4w.restdesc.org/demo#>\nPREFIX tmpl: <http://purl.org/restdesc/http-template#>\nPREFIX http: <http://www.w3.org/2011/http#>\n_:sk1 :validCall {_:sk0_1 http:methodName "GET". _:sk0_1 tmpl:requestURI ("http://askTheWorker/getMachineID"). _:sk0_1 http:headers (_:sk1_1). _:sk1_1 http:fieldName "Content-Type". _:sk1_1 http:fieldValue "application/json". _:sk0_1 http:body {_:sk2_1 :message "On what machine are you working?". _:sk2_1 :sendList ()}. _:sk0_1 http:resp _:sk3_1. _:sk3_1 http:body _:sk4_1. _:sk4_1 :contains {_:sk5_1 :id _:sk6_2}. _:sk7_2 a :machine. _:sk7_2 :machineID _:sk6_2. :thereIsADefect :occurredOnMachine _:sk7_2}. ';
        var calls = ValidCallGenerator.N3toValidCalls(n3, 'http://f4w.restdesc.org/demo#');
        assert.equal(calls.length, 1);

        assert.strictEqual(calls[0].getURL(), 'http://askTheWorker/getMachineID');
        assert.deepEqual(calls[0].getBody(), { message: 'On what machine are you working?', sendList: []});
        var keys = Object.keys(calls[0].getResponse());
        assert.deepEqual(keys, ['id']);
    });
});