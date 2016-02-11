/**
 * Created by joachimvh on 3/12/2015.
 */

var _ = require('lodash');
var request = require('request');
var Util = require('./Util');
var N3Parser = require('./N3Parser');
var JSONLDParser = require('./JSONLDParser');

function ValidCall(jsonld)
{
    this.jsonld = jsonld;
}

// apparently 'toJSON' gets used by JSON.stringify
ValidCall.prototype.toJSON = function ()
{
    if (this.json)
        return this.json;

    var jsonld = _.cloneDeep(this.jsonld);
    // if the body is also referenced in the postcondition we might get some extra referenced data in the body we don't want the user to see
    // this can not happen with actual body contents since these are in a separate subgraph
    var resp = Util.findFirstDeep(jsonld, 'http:resp');
    if (resp && 'http:body' in resp['http:resp'])
    {
        var body = resp['http:resp']['http:body'];
        for (var key in body)
            if (key !== '@id' && key !== N3Parser.BASE + ':contains') // TODO: contains might be in its own ontology later
                delete body[key];
    }

    var json = Util.JSONLDtoJSON(jsonld);

    if (_.isArray(json))
        json = _.filter(json, 'http:methodName')[0];

    var template = {'http:methodName':'GET', 'http:requestURI':'', 'http:body':{}, 'http:resp':{'http:body':{}}};
    this.json = _.assign(template, json);

    return this.json;
};

ValidCall.prototype.toJSONLD = function ()
{
    return this.jsonld;
};

ValidCall.prototype.toN3 = function ()
{
    var parser = new JSONLDParser();
    return parser.toN3(this.jsonld);
};

ValidCall.prototype.getURL      = function () { return this.toJSON()['http:requestURI']; };
ValidCall.prototype.getMethod   = function () { return this.toJSON()['http:methodName']; };
ValidCall.prototype.getBody     = function () { return this.toJSON()['http:body']; };
ValidCall.prototype.getResponse = function () { return this.toJSON()['http:resp']['http:body']['contains'] || this.toJSON()['http:resp']['http:body']; };

ValidCall.prototype.call = function (callback)
{
    var url = this.getURL();
    var requestParams = {
        url: url,
        method: this.getMethod()
    };

    var body = this.getBody();
    if (body)
        requestParams.json = body;

    request(requestParams,
        function (error, response, body)
        {
            // TODO: error handling
            if (!error && response.statusCode < 400)
            {
                // TODO: hardcode fix for big list for now
                if (_.endsWith(url, '/events'))
                    body = body.slice(-20);
                callback(null, body);
            }
            else if (response && response.statusCode && response.url)
                callback(new Error('Status code ' + response.statusCode + ' when calling ' + response.url + ' (' + error.message + ')'));
            else
                callback(error);
        }
    );
};

ValidCall.prototype.handleResponse = function (response)
{
    var map = {};
    Util.mapJSON(response === undefined ? {} : response, this.getResponse(), map);
    this.jsonld = Util.replaceJSONLDblanks(this.jsonld, map);
    this.jsonld = Util.skolemizeJSONLD(this.jsonld, {});
    this.json = undefined; // need to unset JSON since JSONLD changed
};

module.exports = ValidCall;