/**
 * Created by joachimvh on 1/04/2015.
 */

var _ = require('lodash');
var fs = require('fs');
var EYEHandler = require('./EYEHandler');
var N3Parser = require('./N3Parser');
var JSONLDParser = require('./JSONLDParser');
var uuid = require('node-uuid');
var Cache = require('./Cache');

function RESTdesc (input, goal, cacheKey)
{
    this.input = input;
    this.goal = goal;
    this.cacheKey = cacheKey || uuid.v4();
    this.cache = new Cache(this.cacheKey);

    if (!_.isArray(this.input))
        this.input = [this.input];

    // TODO: more generic paths
    this.list = fs.readFileSync('n3/calibration/list.n3', 'utf-8');
    this.find = fs.readFileSync('n3/calibration/find_executable_calls.n3', 'utf-8');

    this.eye = null;

    // TODO: generalize
    this.prefix = 'http://f4w.restdesc.org/demo#';

    this.proofs = [];
}

// TODO: we can cache the cache in a list ...
// keys of map are blank nodes, values are their replacements
RESTdesc.prototype.fillInBlanks = function (map, callback)
{
    if (!map)
        return callback();

    this.cache.open();
    this.cache.pop(function (err, val)
    {
        var jsonld = this._replaceJSONLDblanks(JSON.parse(val), map);
        this.cache.push(JSON.stringify(this._skolemizeJSONLD(jsonld, {}))); // TODO: the fact that this skolemize is necessary means the body wasn't correct to begin with
        this.cache.close(callback); // it's really important to execute the callback after the push is finished or there is a race condition
    }.bind(this));
};

RESTdesc.prototype._replaceJSONLDblanks = function (jsonld, map, idMap)
{
    idMap = idMap || {};
    if (_.isString(jsonld) || _.isNumber(jsonld))
        return jsonld;

    if (_.isArray(jsonld))
        return jsonld.map(function (thingy) { return this._replaceJSONLDblanks(thingy, map, idMap); }.bind(this));

    // TODO: might have more complicated situations where this is incorrect
    if (jsonld['@id'] && map[jsonld['@id']] !== undefined) // 0 can be a valid result so we should compare with undefined
    {
        var id = jsonld['@id'];
        if (idMap[id])
            return idMap[id];
        var replaced = this._skolemizeJSONLD(this._JSONtoJSONLD(map[id]), {}); // need to do skolemization here to keep ids consistent
        // we actually check this again after the previous step because that step could have changed the values in idMap
        if (idMap[id])
            return idMap[id];
        idMap[id] = replaced;
        return idMap[id];
    }

    // TODO: technically keys should also be checked;
    var result = {};
    for (var key in jsonld)
        result[key] = this._replaceJSONLDblanks(jsonld[key], map, idMap);
    return result;
};

RESTdesc.prototype.next = function (callback)
{
    this.cache.list(function (err, data)
    {
        // TODO: how big of a performance hit is it to always convert the jsonld?
        var parser = new JSONLDParser();
        data = data.map(function (str) { return parser.parse(JSON.parse(str), this.prefix); }.bind(this));
        // create new eye handler every time so we know when to call destroy function
        this.eye = new EYEHandler();
        this.eye.call(this.input.concat(data), this.goal, true, true, false, function (proof) { this._handleProof(proof, callback); }.bind(this), this._error);
    }.bind(this));
};

RESTdesc.prototype._handleProof = function (proof, callback)
{
    this.proofs.push(proof);
    this.eye.call([proof, this.list], this.find, false, true, false, function (body) { this._handleNext(body, callback); }.bind(this), this._error);
};

RESTdesc.prototype._handleNext = function (next, callback)
{
    // TODO: strip unused prefixes?
    var n3Parser = new N3Parser();
    var jsonld = n3Parser.parse(next);
    var json = this._JSONLDtoJSON(jsonld);
    json = _.find(json, 'http:methodName');
    if (json && json['tmpl:requestURI'])
    {
        json['http:requestURI'] = json['tmpl:requestURI'].join('');
        delete json['tmpl:requestURI'];
    }

    if (!json || !json['http:requestURI'])
    {
        this.cache.clear();
        callback('DONE');
    }
    else
    {
        jsonld = this._skolemizeJSONLD(jsonld);
        this.cache.push(JSON.stringify(jsonld));
        var template = {'http:methodName':'GET', 'http:requestURI':'', 'http:body':{}, 'http:resp':{'http:body':{}}};
        json = _.assign(template, json);
        callback(json);
    }
};

RESTdesc.prototype._JSONLDtoJSON = function (jsonld)
{
    // TODO: what about lang/datatype?
    if (_.isString(jsonld) || _.isNumber(jsonld))
        return jsonld;

    // TODO: find out how to write this with bind and partialright
    if (_.isArray(jsonld))
        return jsonld.map(function (child) { return this._JSONLDtoJSON(child); }, this);

    var json = {};
    var keys = _.without(Object.keys(jsonld), '@context');
    for (var key in jsonld)
    {
        if (key === '@context')
            continue;

        if (key === '@graph')
        {
            var result = this._JSONLDtoJSON(jsonld[key]);
            // will always be a list, but often with only 1 element
            if (result.length === 0)
                return {};
            if (result.length === 1)
                return result[0];
            return result;
        }

        // TODO: special cases where graph/array/@id are subject
        if ((key === '@list' || key === '@graph' || key === '@id') && keys.length === 1)
            return this._JSONLDtoJSON(jsonld[key]);

        // ignore URIs for now
        if (key === '@id')
            continue;

        // this might produce invalid URIs, but we don't care since the output is JSON, not JSON-lD
        var val = this._JSONLDtoJSON(jsonld[key]);
        if (_.startsWith(key, this.prefix))
            key = key.substr(this.prefix.length);

        json[key] = val;
    }
    return json;
};

// this is only partial skolemization since we don't want to convert the nodes the user has to fill in.
RESTdesc.prototype._skolemizeJSONLD = function (jsonld, blankMap, context, parentKey)
{
    if (_.isNumber(jsonld))
        return jsonld;

    if (_.isString(jsonld))
    {
        if (parentKey !== '@id' && parentKey !== '@type') // @type content fields are always URIs
            return jsonld;

        var colonIdx = jsonld.indexOf(':');
        if (colonIdx >= 0)
        {
            var prefix = jsonld.substring(0, colonIdx);
            // TODO: scoping (.well-known URIs are assumed to be identical for the full input file)
            if (blankMap && (prefix === '_' || (context && context[prefix] && _.contains(context[prefix], '.well-known'))))
            {
                if (!blankMap[jsonld])
                    blankMap[jsonld] = this.prefix + uuid.v4();
                return blankMap[jsonld];
            }
        }
        return jsonld;
    }

    if (_.isArray(jsonld))
        return jsonld.map(function (child) { return this._skolemizeJSONLD(child, blankMap, context, parentKey); }, this);

    if (!context && jsonld['@context'])
        context = jsonld['@context'];

    var result = {};
    // TODO: skolemize predicates
    for (var key in jsonld)
    {
        var predicate = this._skolemizeJSONLD(key, blankMap, context, '@id'); // treat predicates as though they are in a @id field
        result[key] = this._skolemizeJSONLD(jsonld[key], blankMap, context, key);
    }

    // all these don't need to be skolemized for eye/n3, all the others are blank nodes
    if (!result['@id'] && !result['@graph'] && !result['@value'] && !result['@list'] && parentKey !== '@context')
        result['@id'] = this.prefix + uuid.v4();

    return result;
};

RESTdesc.prototype._JSONtoJSONLD = function (json)
{
    if (_.isString(json) || _.isNumber(json))
        return json;

    if (_.isArray(json))
        return { '@list': json.map(function (thingy) { return this._JSONtoJSONLD(thingy); }.bind(this)) };

    // TODO: might want to use different prefix for different APIs?
    var jsonld = {};
    for (var key in json)
        jsonld[this.prefix + key] = this._JSONtoJSONLD(json[key]);

    // represent all json objects as graphs ('@graph' always expects a list as value)
    return {'@graph': [jsonld]};
};

RESTdesc.prototype._error = function (error, content)
{
    console.error(error);
};

module.exports = RESTdesc;
