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
            if (!_.isObject(val))
                return _.extend(_.omit(jsonld, '@id'), { '@id': val });
            return _.extend(_.omit(jsonld, '@id'), val);
        }
    }

    var result = {};
    for (var key in jsonld)
    {
        var replaced;
        // TODO: super hardcoding for demo
        if (/triedAndReported$/.test(key) || /requiredSkillsKnown$/.test(key))
            replaced = "yes";
        else
            replaced = this._replaceJSONLDblanks(jsonld[key], map, idMap);
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
    if (_.isString(jsonld) || _.isNumber(jsonld) || _.isBoolean(jsonld))
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
    if (_.isNumber(jsonld) || _.isBoolean(jsonld))
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
    // TODO: can we just check on not being an object?
    if (_.isString(json) || _.isNumber(json) || _.isBoolean(json))
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

//var DUMMY = JSON.parse('{ "@context": { "log": "http://www.w3.org/2000/10/swap/log#", "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdfs": "http://www.w3.org/2000/01/rdf-schema#", "owl": "http://www.w3.org/2002/07/owl#", "list": "http://www.w3.org/2000/10/swap/list#", "e": "http://eulersharp.sourceforge.net/2003/03swap/log-rules#", "r": "http://www.w3.org/2000/10/swap/reason#", "tmpl": "http://purl.org/restdesc/http-template#", "http": "http://www.w3.org/2011/http#", "out": "http://f4w.restdesc.org/demo/.well-known/genid/f3ed8675-47ce-42f1-ac89-9082b146b6db#", "math": "http://www.w3.org/2000/10/swap/math#" }, "@graph": [ { "@id": "_:sk7_1", "http:methodName": "GET", "tmpl:requestURI": { "@list": [ "http://askTheWorker/getMachineID" ] }, "http:headers": { "@list": [ { "@id": "_:sk8_1", "http:fieldName": "Content-Type", "http:fieldValue": "application/json" } ] }, "http:body": { "@graph": [ { "@id": "_:sk9_1", "http://f4w.restdesc.org/demo#message": "On what machine are you working?", "http://f4w.restdesc.org/demo#sendList": { "@list": [ { "@graph": [ { "@id": "http://f4w.restdesc.org/demo#bb7dffb3-68fa-4aff-947b-49e9f57cdbea", "http://f4w.restdesc.org/demo#id": 2, "http://f4w.restdesc.org/demo#name": "Turning Machine", "http://f4w.restdesc.org/demo#desc": "MoriSeki TurninMachine", "http://f4w.restdesc.org/demo#state": 3, "http://f4w.restdesc.org/demo#optional": { "@id": "true" } } ] }, { "@graph": [ { "@id": "http://f4w.restdesc.org/demo#0412964f-be33-48c3-9823-780c0802eb37", "http://f4w.restdesc.org/demo#id": 1, "http://f4w.restdesc.org/demo#name": "Cooling machine", "http://f4w.restdesc.org/demo#desc": "Machine used for cooling purposes", "http://f4w.restdesc.org/demo#state": 3, "http://f4w.restdesc.org/demo#optional": { "@id": "true" } } ] } ] } } ] }, "http:resp": { "@id": "_:sk10_1", "http:body": { "@id": "_:sk11_1", "http://f4w.restdesc.org/demo#contains": { "@graph": [ { "@id": "_:sk12_1", "http://f4w.restdesc.org/demo#id": { "@id": "_:sk13_3" } } ] } } } }, { "@id": "http://f4w.restdesc.org/demo#thereIsADefect", "http://f4w.restdesc.org/demo#occurredOnMachine": { "@id": "_:sk13_3", "@type": "http://f4w.restdesc.org/demo#machine" } } ]}');
//var DUMMY = JSON.parse('{ "@context": { "log": "http://www.w3.org/2000/10/swap/log#", "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#", "rdfs": "http://www.w3.org/2000/01/rdf-schema#", "owl": "http://www.w3.org/2002/07/owl#", "list": "http://www.w3.org/2000/10/swap/list#", "e": "http://eulersharp.sourceforge.net/2003/03swap/log-rules#", "r": "http://www.w3.org/2000/10/swap/reason#", "tmpl": "http://purl.org/restdesc/http-template#", "http": "http://www.w3.org/2011/http#", "out": "http://f4w.restdesc.org/demo/.well-known/genid/f3ed8675-47ce-42f1-ac89-9082b146b6db#", "math": "http://www.w3.org/2000/10/swap/math#" }, "@graph": [ { "@id": "_:sk15_1", "http:methodName": "POST", "tmpl:requestURI": { "@list": [ "http://defects.tho.f4w.l0g.in/api/reports" ] }, "http:body": { "@graph": [ { "@id": "_:sk16_1", "http://f4w.restdesc.org/demo#event_id": 160, "http://f4w.restdesc.org/demo#operator_id": 3, "http://f4w.restdesc.org/demo#solution_id": 3, "http://f4w.restdesc.org/demo#success": { "@id": "_:sk13_3" }, "http://f4w.restdesc.org/demo#comment": "solved!" } ] } }, { "@id": "http://f4w.restdesc.org/demo#firstTry", "http://f4w.restdesc.org/demo#triedAndReported": { "@id": "_:sk17_3" } } ]}');
//var DUMMY = JSON.parse('{"@context":{"log":"http://www.w3.org/2000/10/swap/log#","rdf":"http://www.w3.org/1999/02/22-rdf-syntax-ns#","rdfs":"http://www.w3.org/2000/01/rdf-schema#","owl":"http://www.w3.org/2002/07/owl#","list":"http://www.w3.org/2000/10/swap/list#","e":"http://eulersharp.sourceforge.net/2003/03swap/log-rules#","r":"http://www.w3.org/2000/10/swap/reason#","tmpl":"http://purl.org/restdesc/http-template#","http":"http://www.w3.org/2011/http#","out":"http://f4w.restdesc.org/demo/.well-known/genid/f3ed8675-47ce-42f1-ac89-9082b146b6db#","math":"http://www.w3.org/2000/10/swap/math#","string":"http://www.w3.org/2000/10/swap/string#"},"@graph":[{"@id":"_:sk15_1","http:methodName":"POST","tmpl:requestURI":{"@list":["http://defects.tho.f4w.l0g.in/api/reports"]},"http:body":{"@graph":[{"@id":"_:sk16_1","http://f4w.restdesc.org/demo#event_id":172,"http://f4w.restdesc.org/demo#operator_id":3,"http://f4w.restdesc.org/demo#solution_id":3,"http://f4w.restdesc.org/demo#success":{"@id":"false"},"http://f4w.restdesc.org/demo#comment":"solved!"}]}},{"@id":"http://f4w.restdesc.org/demo#firstTry","http://f4w.restdesc.org/demo#triedAndReported":{"@id":"_:sk17_1"},"http://f4w.restdesc.org/demo#tryNewSolution":{"@id":"true"}}]}');
//var DUMMY = JSON.parse('{"@context":{"tmpl":"http://purl.org/restdesc/http-template#","http":"http://www.w3.org/2011/http#"},"@graph":[{"@id":"_:sk15_1","http:methodName":"POST","tmpl:requestURI":{"@list":["http://defects.tho.f4w.l0g.in/api/reports"]},"http:body":{"@graph":[{"@id":"_:sk16_1","http://f4w.restdesc.org/demo#event_id":174,"http://f4w.restdesc.org/demo#operator_id":3,"http://f4w.restdesc.org/demo#solution_id":3,"http://f4w.restdesc.org/demo#success":false,"http://f4w.restdesc.org/demo#comment":"solved!"}]}},{"@id":"http://f4w.restdesc.org/demo#firstTry","http://f4w.restdesc.org/demo#triedAndReported":{"@id":"_:sk17_1"},"http://f4w.restdesc.org/demo#tryNewSolution":true}]}');
//var rest = new RESTdesc(null, null, 0);
//var result = rest._skolemizeJSONLD(rest._replaceJSONLDblanks(DUMMY, { '_:sk90_5': false, '_:sk91_2': 'solved!' }), {});
//console.log(JSON.stringify(result, null, 2));
//var parser = new JSONLDParser(2);
//var n3 = parser.parse(result, rest.prefix);
//console.log(n3);