/**
 * Created by joachimvh on 3/12/2015.
 */

var _ = require('lodash');
var uuid = require('node-uuid');

// TODO: tbh, these are mostly functions of which I don't know where to put them yet
function Util() {}

Util.BASE = '#base';

Util.isLiteral = function (thingy)
{
    return _.isString(thingy) || _.isNumber(thingy) || _.isBoolean(thingy);
};

Util.isNonStringLiteral = function (thingy)
{
    return Util.isLiteral(thingy) && !_.isString(thingy);
};

Util.findFirstDeep = function (o, findKey)
{
    if (Util.isLiteral(o))
        return undefined;
    var result;
    if (_.isArray(o))
    {
        for (var i = 0; i < o.length; ++i)
        {
            result = Util.findFirstDeep(o[i], findKey);
            if (result)
                return result;
        }
        return undefined;
    }

    if (findKey in o)
        return o;

    for (var key in o)
    {
        result = Util.findFirstDeep(o[key], findKey);
        if (result)
            return result;
    }
    return undefined;
};

Util.mapJSON = function (json, template, map)
{
    map = map || {};

    // template currently corresponds to blank node name
    if (_.isString(template))
        return map[template] = json;

    if (_.isArray(template))
    {
        if (!_.isArray(json) || json.length !== template.length)
            throw 'Expecting array of length ' + template.length + ', got ' + JSON.stringify(json) + ' instead.';

        for (var i = 0; i < template.length; ++i)
            Util.mapJSON(json[i], template[i], map);

        return;
    }

    if (Util.isLiteral(json) || !json)
        throw 'Expecting an object matching ' + JSON.stringify(template) +', got ' + JSON.stringify(json) + ' instead.';

    for (var key in template)
    {
        if (!(key in json))
        {
            // TODO: workaround for demo
            if (key === 'computer')
            {
                Util.mapJSON(0, template[key], map);
                continue;
            }
            throw 'Key ' + key + ' missing in ' + JSON.stringify(json);
        }

        Util.mapJSON(json[key], template[key], map);
    }

    return map;
};

Util.JSONLDtoJSON = function (jsonld)
{
    // TODO: what about lang/datatype?
    if (Util.isLiteral(jsonld))
        return jsonld;

    if (_.isArray(jsonld))
        return jsonld.map(function (thingy) { return Util.JSONLDtoJSON(thingy); });

    var json = {};
    if (jsonld['tmpl:requestURI'])
    {
        var uriList = jsonld['tmpl:requestURI']['@list'];
        // handle AGFA tmpl:requestURI
        if (uriList.length > 1 && _.isArray(uriList[1]))
        {
            var uri = uriList[0];
            for (var j = 1; j < uriList.length; ++j)
                uri.replace('{' + uriList[j][0] + '}', uriList[j][1]);
            uriList = [uri];
        }
        json['http:requestURI'] = uriList.join('');
    }

    var keys = _.without(Object.keys(jsonld), '@context');
    for (var key in jsonld)
    {
        // already handled requestURI above
        if (key === '@context' || key === 'tmpl:requestURI')
            continue;

        if (key === '@graph')
        {
            var result = Util.JSONLDtoJSON(jsonld[key]);
            // will always be a list, but often with only 1 element
            if (result.length === 0)
                return {};
            if (result.length === 1)
                return result[0];
            return result;
        }

        if ((key === '@list' || key === '@graph' || key === '@id') && keys.length === 1)
            return Util.JSONLDtoJSON(jsonld[key]);

        // ignore URIs for now
        if (key === '@id')
            continue;

        // this might produce invalid URIs, but we don't care since the output is JSON, not JSON-lD
        var val = Util.JSONLDtoJSON(jsonld[key]);
        if (_.startsWith(key, Util.BASE + ':'))
            key = key.substr(Util.BASE.length+1);

        json[key] = val;
    }
    return json;
};

Util.JSONtoJSONLD = function (json)
{
    if (json === null)
        return { '@id': 'rdf:nil' };

    if (Util.isLiteral(json))
        return json;

    if (_.isArray(json))
        return { '@list': json.map(function (thingy) { return Util.JSONtoJSONLD(thingy); }) };

    var jsonld = {};
    for (var key in json)
        jsonld[Util.BASE + ':' + key] = Util.JSONtoJSONLD(json[key]);

    // represent all json objects as graphs ('@graph' always expects a list as value)
    return {'@graph': [jsonld]};
};

Util.replaceJSONLDblanks = function (jsonld, map)
{
    var jsonLDMap = {};
    for (var key in map)
        jsonLDMap[key] = Util.skolemizeJSONLD(Util.JSONtoJSONLD(map[key]));

    return Util._replaceJSONLDblanksRecursive(jsonld, jsonLDMap);
};

Util._replaceJSONLDblanksRecursive = function (jsonld, map)
{
    if (Util.isLiteral(jsonld))
        return jsonld;

    if (_.isArray(jsonld))
        return jsonld.map(function (thingy) { return Util._replaceJSONLDblanksRecursive(thingy, map); });

    // TODO: will this always be correct?
    if (jsonld['@id'] && (jsonld['@id'] in map)) // 0 can be a valid result so we should compare with undefined
    {
        var val = map[jsonld['@id']];
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
        if (_.endsWith(key, 'triedAndReported') || _.endsWith(key, 'requiredSkillsKnown'))
            replaced = 'yes';
        else
            replaced = Util._replaceJSONLDblanksRecursive(jsonld[key], map);
        if (key in map)
            key = map[key]; // there might be rare cases where the key also needs to be replaced
        result[key] = replaced;
    }
    return result;
};

// will add blank node for nodes that don't have an id yet
// if blankMap is given, will also replace all existing blank node names with skolemized versions
Util.skolemizeJSONLD = function (jsonld, blankMap, parentKey)
{
    if (Util.isNonStringLiteral(jsonld))
        return jsonld;

    if (_.isString(jsonld))
    {
        if (parentKey !== '@id' && parentKey !== '@type') // @type content fields are always URIs
            return jsonld;

        // TODO: is scoping correct?
        if (_.startsWith(jsonld, '_:') && blankMap)
        {
            if (!blankMap[jsonld])
                blankMap[jsonld] = Util.BASE + ':' + uuid.v4();
            return blankMap[jsonld];
        }

        return jsonld;
    }

    if (_.isArray(jsonld))
        return jsonld.map(function (child) { return Util.skolemizeJSONLD(child, blankMap, parentKey); }, this);

    var result = {};
    for (var key in jsonld)
    {
        var predicate = Util.skolemizeJSONLD(key, blankMap, '@id'); // treat predicates as though they are in a @id field
        result[predicate] = Util.skolemizeJSONLD(jsonld[key], blankMap, key);
    }

    // all these don't need to be skolemized for eye/n3, all the others are blank nodes
    if (!result['@id'] && !result['@graph'] && !result['@value'] && !result['@list'] && parentKey !== '@context')
        result['@id'] = Util.BASE + ':' + uuid.v4();

    return result;
};

module.exports = Util;