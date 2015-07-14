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

    this.list = fs.readFileSync('n3/list.n3', 'utf-8');
    this.find = fs.readFileSync('n3/find_executable_calls.n3', 'utf-8');
    this.findall = fs.readFileSync('n3/findallcalls.n3', 'utf-8');

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
        this.cache.push(JSON.stringify(jsonld));
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
    if (jsonld['@id'] && map[jsonld['@id']])
    {
        var id = jsonld['@id'];
        if (idMap[id])
            return idMap[id];
        var replaced = this._skolemizeJSONLD(this._JSONtoJSONLD(map[id])); // need to do skolemization here to keep ids consistent
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
        data = data.map(function (str) { return parser.parse(JSON.parse(str)); });
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
        var jsonldParser = new JSONLDParser();
        //var n3 = jsonldParser.parse(jsonld); // don'y use 'next' since we need skolemization
        this.cache.push(JSON.stringify(jsonld));
        var template = {'http:methodName':'GET', 'http:requestURI':'', 'http:body':{}, 'http:resp':{'http:body':{}}};
        json = _.assign(template, json);
        callback(json);
    }
};

RESTdesc.prototype._JSONLDtoJSON = function (jsonld, baseURI)
{
    // TODO: what about lang/datatype?
    if (_.isString(jsonld) || _.isNumber(jsonld))
        return jsonld;

    // TODO: find out how to write this with bind and partialright
    if (_.isArray(jsonld))
        return jsonld.map(function (child) { return this._JSONLDtoJSON(child, baseURI); }, this);

    // TODO: another vocab dependency
    if (jsonld['@context'] && jsonld['@context']['@vocab'])
        baseURI = jsonld['@context']['@vocab'];

    var json = {};
    var keys = _.without(Object.keys(jsonld), '@context');
    for (var key in jsonld)
    {
        if (key === '@context')
            continue;

        if (key === '@graph')
        {
            var result = this._JSONLDtoJSON(jsonld[key], baseURI);
            // will always be a list, but often with only 1 element
            if (result.length === 0)
                return {};
            if (result.length === 1)
                return result[0];
            return result;
        }

        // TODO: special cases where graph/array/@id are subject
        if ((key === '@list' || key === '@graph' || key === '@id') && keys.length === 1)
            return this._JSONLDtoJSON(jsonld[key], baseURI);

        // ignore URIs for now
        if (key === '@id')
            continue;

        // TODO: what if uri still contains colons? maybe this isn't necessary anyway
        var val = this._JSONLDtoJSON(jsonld[key], baseURI);
        if (baseURI && _.startsWith(key, baseURI))
            key = key.substr(baseURI.length);

        if (key === 'tolerances' && _.isArray(val) && val.length === 2 && _.isArray(val[0])) // TODO: should definitely also not be necessary
            val = [{min: val[0][0], max: val[0][1]}, {min: val[1][0], max: val[1][1]}];

        json[key] = val;
    }
    return json;
};

// this is only partial skolemization since we don't want to convert the nodes the user has to fill in.
RESTdesc.prototype._skolemizeJSONLD = function (jsonld, blankMap)
{
    if (_.isNumber(jsonld))
        return jsonld;

    if (_.isString(jsonld))
    {
        // TODO: funny thing, what if we have a string literal that starts with _: ? need to know object key...
        if (blankMap && _.startsWith(jsonld, '_:'))
        {
            if (!blankMap[jsonld])
                blankMap[jsonld] = this.prefix + uuid.v4();
            return blankMap[jsonld];
        }
        return jsonld;
    }

    if (_.isArray(jsonld))
        return jsonld.map(function (child) { return this._skolemizeJSONLD(child, blankMap); }, this);

    var result = {};
    // TODO: skolemize predicates
    for (var key in jsonld)
    {
        // don't skolemize in the context
        if (key === '@context')
            result[key] = jsonld[key];
        else
            result[key] = this._skolemizeJSONLD(jsonld[key], blankMap);
    }

    // all these don't need to be skolemized for eye/n3
    if (!result['@id'] && !result['@graph'] && !result['@value'] && !result['@list'])
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
