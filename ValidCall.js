/**
 * Created by joachimvh on 3/12/2015.
 */

var _ = require('lodash');
var request = require('request');
var Util = require('./Util');
var N3Parser = require('./N3Parser');
var JSONLDParser = require('./JSONLDParser');

function ValidCall(jsonld, baseURI)
{
    this.jsonld = jsonld;
    this.baseURI = baseURI;
}

// apparently 'toJSON' gets used by JSON.stringify
ValidCall.prototype.asJSON = function ()
{
    if (this.json)
        return this.json;
    var json = Util.JSONLDtoJSON(this.jsonld, this.baseURI);

    if (_.isArray(json))
        json = _.filter(json, 'http:methodName')[0];

    var template = {'http:methodName':'GET', 'http:requestURI':'', 'http:body':{}, 'http:resp':{'http:body':{}}};
    this.json = _.assign(template, json);

    return this.json;
};

ValidCall.prototype.asJSONLD = function ()
{
    return this.jsonld;
};

ValidCall.prototype.asN3 = function ()
{
    var parser = new JSONLDParser();
    return parser.parse(this.jsonld, this.baseURI);
};

ValidCall.prototype.getURL = function () { return this.asJSON()['http:requestURI']; };
ValidCall.prototype.getMethod = function () { return this.asJSON()['http:methodName']; };
ValidCall.prototype.getBody = function () { return this.asJSON()['http:body']; };
ValidCall.prototype.getResponse = function () { return this.asJSON()['http:resp']['http:body']['contains'] || this.asJSON()['http:resp']['http:body']; };

ValidCall.prototype.call = function (callback)
{
    var json = this.asJSON();
    var requestParams = {
        url: this.getURL(),
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
                // handle response
                callback(body);
            }
            else
            {
                throw error;
            }
        }
    );
};

ValidCall.prototype.handleResponse = function (response)
{
    var map = {};
    Util.mapJSON(response === undefined ? {} : response, this.getResponse(), map);
    this.jsonld = Util.replaceJSONLDblanks(this.jsonld, map, this.baseURI);
    this.jsonld = Util.skolemizeJSONLD(this.jsonld, this.baseURI, {}); // TODO: try to remember why skolemizeJSONLD acts differently if you give it a blankmap
    this.json = undefined; // need to unset JSON since JSONLD changed
};

module.exports = ValidCall;