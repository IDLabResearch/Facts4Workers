/**
 * Created by joachimvh on 29/02/2016.
 */

var _ = require('lodash');
var N3Parser = require('./N3Parser');
var JSONLDParser = require('./JSONLDParser');
var Util = require('./Util');

function ErrorData (data)
{
    if (!data)
        this.jsonld = {
            '@context': {
                rest: 'http://f4w.restdesc.org/demo#',
                prov: 'http://www.w3.org/ns/prov#',
                http: 'http://www.w3.org/2011/http#'
            },
            '@graph': []
        }; // TODO: do we need a special class to interact with JSON-LD?
    else if (_.isString(data))
    {
        var parser = new N3Parser();
        this.jsonld = parser.toJSONLD(data);
    }
    else
        this.jsonld = data;
}

ErrorData.prototype.toJSONLD = function ()
{
    return this.jsonld;
};

ErrorData.prototype.toN3 = function ()
{
    var parser = new JSONLDParser();
    return parser.toN3(this.jsonld);
};

ErrorData.prototype.addError = function (statusCode, url)
{
    // TODO: follow http ontology more strictly?
    var entry = {
        '@type': 'rest:Error',
        'http:statusCodeNumber': statusCode,
        'http:requestURI': url,
        'prov:atTime': Math.floor(Date.now() / 1000) // seconds instead of milliseconds
    };
    this.jsonld['@graph'].push(entry);
    this.jsonld = Util.skolemizeJSONLD(this.jsonld, {}); // need to generate URI for the new blank node
};