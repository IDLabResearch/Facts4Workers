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
var path = require('path');

function RESTdesc (dataPaths, goalPath, cacheKey)
{
    this.dataPaths = dataPaths;
    this.goalPath = goalPath;
    this.cacheKey = cacheKey || uuid.v4();
    this.cache = new Cache(this.cacheKey);

    if (!_.isArray(this.dataPaths))
        this.dataPaths = [this.dataPaths];

    this.list = path.join(__dirname, 'n3/list.n3');
    this.findPath = path.join(__dirname, 'n3/find_executable_calls.n3');

    this.eye = null;

    // TODO: generalize
    this.prefix = 'http://f4w.restdesc.org/demo#';

    this.proofs = [];
}

RESTdesc.prototype.clear = function ()
{
    this.cache.clear();
};

RESTdesc.prototype.back = function (callback, _recursive)
{
    // remove items from the cache until it is empty or we find the previous askTheWorker call
    // the last item is the 'current' askTheWorker call, so that one always needs to be popped before we can go searching
    if (!_recursive)
        this.cache.open();

    this.cache.pop(function (err, val)
    {
        if (!_recursive)
            return this.back(callback, true);

        // if val is null the list is empty
        if (!val || _.contains(val, 'askTheWorker'))
            return this.cache.close(callback);

        this.back(callback, true);
    }.bind(this));
};

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
        this.cache.push(
            JSON.stringify(this._skolemizeJSONLD(jsonld, {})), // skolemize is necessary because the body will contain '.well-known' URIs which also need to be replaced
            function ()
            {
                this.cache.close(callback); // it's really important to execute the callback after the push is finished or there is a race condition
            }.bind(this)
        );

    }.bind(this));
};

RESTdesc.prototype._replaceNode = function (id, map, idMap)
{
    if (map[id] === undefined)
        return id;
    if (idMap[id] !== undefined)
        return idMap[id];
    var replaced = this._skolemizeJSONLD(this._JSONtoJSONLD(map[id]), idMap); // need to do skolemization here to keep ids consistent
    // we actually check this again after the previous step because that step could have changed the values in idMap
    if (idMap[id] !== undefined)
        return idMap[id];
    idMap[id] = replaced;
    return idMap[id];
};

RESTdesc.prototype._replaceJSONLDblanks = function (jsonld, map, idMap)
{
    idMap = idMap || {};
    if (_.isString(jsonld) || _.isNumber(jsonld))
        return jsonld;

    if (_.isArray(jsonld))
        return jsonld.map(function (thingy) { return this._replaceJSONLDblanks(thingy, map, idMap); }.bind(this));

    // TODO: will this always be correct?
    if (jsonld['@id'] && map[jsonld['@id']] !== undefined) // 0 can be a valid result so we should compare with undefined
    {
        var val = this._replaceNode(jsonld['@id'], map, idMap);
        if (Object.keys(jsonld).length === 1)
            return val;
        else
        {
            // this is a special case, there are already predicates with the input as a subject
            // we have to find what is the best way to inject this
            // TODO: currently only works for lists, extend this for literals/URIs/etc.
            // TODO: can give problems with nested values too?
            return _.extend(_.omit(jsonld, '@id'), val);
        }
    }

    var result = {};
    for (var key in jsonld)
    {
        var replaced = this._replaceJSONLDblanks(jsonld[key], map, idMap);
        key = this._replaceNode(key, map, idMap); // there might be rare cases where the id also needs to be replaced
        result[key] = replaced;
    }
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
        this.eye.call(this.dataPaths, data, this.goalPath, true, true, function (proof) { this._handleProof(proof, callback); }.bind(this), this._error);
    }.bind(this));
};

RESTdesc.prototype._handleProof = function (proof, callback)
{
    this.proofs.push(proof);
    // TODO: singleAnswer true to prevent problems atm, should be changed for parallelization
    this.eye.call([this.list], [proof], this.findPath, false, true, function (body) { this._handleNext(body, callback); }.bind(this), this._error);
};

// TODO: what if the result contains multiple possible APIs
RESTdesc.prototype._handleNext = function (next, callback)
{
    var n3Parser = new N3Parser();
    var jsonld = n3Parser.parse(next);
    // TODO: should move the JSONLD to JSON part somewhere else, closer to demo.js, that way we can take the Content-Type better into account
    var json = this._JSONLDtoJSON(jsonld);
    // if there are multiple elements, find the one corresponding to the request
    if (_.isArray(json))
        json = _.filter(json, 'http:methodName');
    else
        json = [json];
    for (var i = 0; i < json.length; ++i)
    {
        var subJSON = json[i];
        if (subJSON['tmpl:requestURI'])
        {
            var uriList = subJSON['tmpl:requestURI'];
            // handle AGFA tmpl:requestURI
            if (uriList.length > 1 && _.isArray(uriList[1]))
            {
                var uri = uriList[0];
                for (var j = 1; j < uriList.length; ++j)
                    uri.replace('{' + uriList[j][0] + '}', uriList[j][1]);
                uriList = [uri];
            }
            subJSON['http:requestURI'] = uriList.join('');
            delete subJSON['tmpl:requestURI'];
        }
    }

    // TODO: currently only taking 1 API, still need to do parallellization
    json = json.length === 0 ? {} : json[0];

    if (!json || !json['http:requestURI'])
    {
        callback({ status: 'DONE' });
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

    if (_.isArray(jsonld))
        return jsonld.map(this._JSONLDtoJSON.bind(this));

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

        // TODO: this is already interpreting the content so shouldn't actually happen here (but later we lose the blank nodes)
        if (key === 'http:body' && Object.keys(jsonld[key]).length > 1 && jsonld[key]['@id'] && !jsonld[key]['http://f4w.restdesc.org/demo#contains'])
            return { 'http:body': jsonld[key]['@id'] };

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
    for (var key in jsonld)
    {
        var predicate = this._skolemizeJSONLD(key, blankMap, context, '@id'); // treat predicates as though they are in a @id field
        result[predicate] = this._skolemizeJSONLD(jsonld[key], blankMap, context, key);
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
        return { '@list': json.map(this._JSONtoJSONLD.bind(this)) };

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
