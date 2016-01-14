/**
 * Created by joachimvh on 4/12/2015.
 */

var _ = require('lodash');
var N3Parser = require('./N3Parser');
var ValidCall = require('./ValidCall');

// TODO: something more generic

function ValidCallGenerator() {}

ValidCallGenerator.N3toValidCalls = function (n3)
{
    var parser = new N3Parser();
    var jsonld = parser.toJSONLD(n3);
    // TODO: validCall might be in its own ontology eventually
    var calls;
    if (jsonld[N3Parser.BASE + ':validCall'])
        calls = [jsonld[N3Parser.BASE + ':validCall']];
    else
        calls = _.map(jsonld['@graph'], function (validCall) { return validCall[N3Parser.BASE + ':validCall']; });
    calls = _.map(calls, function (call)
    {
        if (call['@graph'].length === 1)
            call = call['@graph'][0];
        call['@context'] = jsonld['@context'];
        return new ValidCall(call);
    });

    return calls;
};

// TODO: might need more generic function that can determine what is needed
ValidCallGenerator.N3ToValidCall = function (n3)
{
    var parser = new N3Parser(n3);
    var jsonld = parser.toJSONLD(n3);
    return new ValidCall(jsonld);
};

module.exports = ValidCallGenerator;