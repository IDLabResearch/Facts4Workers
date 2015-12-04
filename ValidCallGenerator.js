/**
 * Created by joachimvh on 4/12/2015.
 */

var _ = require('lodash');
var N3Parser = require('./N3Parser');
var ValidCall = require('./ValidCall');

// TODO: something more generic

function ValidCallGenerator() {}

ValidCallGenerator.N3toValidCalls = function (n3, baseURI)
{
    var parser = new N3Parser();
    var jsonld = parser.parse(n3);
    // TODO: validCall might be in its own ontology eventually
    var calls;
    if (jsonld[baseURI + 'validCall'])
        calls = [jsonld[baseURI + 'validCall']];
    else
        calls = _.map(jsonld['@graph'], function (validCall) { return validCall[baseURI + 'validCall']; });
    calls = _.map(calls, function (call)
    {
        call['@context'] = jsonld['@context'];
        return new ValidCall(call, baseURI);
    });

    return calls;
};

// TODO: might need more generic function that can determine what is needed
ValidCallGenerator.N3ToValidCall = function (n3, baseURI)
{
    var parser = new N3Parser(n3);
    var jsonld = parser.parse(n3);
    return new ValidCall(jsonld, baseURI);
};

module.exports = ValidCallGenerator;