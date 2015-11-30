/**
 * Created by joachimvh on 30/06/2015.
 */

var _ = require('lodash');
var format = require('util').format;
var N3Parser = require('./N3Parser');

function JSONLDParser (indent)
{
    this.indent = indent;
}

JSONLDParser.suffixTest = new RegExp('^' + N3Parser._suffix.source + '$');

// TODO: currently only focusing on JSON-LD that can be generated with N3Parser.js

JSONLDParser.prototype.parse = function (jsonld, baseURI)
{
    var ignoreGraph = _.every(jsonld, function (val, key) { return key === '@context' || key === '@graph'; });
    var graphList = [];
    var id = this._parse(jsonld, baseURI, null, graphList, true, ignoreGraph);
    if (graphList.length > 0)
        return graphList.join('');
    else
        return format('%s .', id); // TODO: will this ever happen?
};

JSONLDParser.prototype._parse = function (jsonld, baseURI, context, graphList, root, ignoreGraph)
{
    // TODO: language/datatype
    if (_.isNumber(jsonld) || _.isBoolean(jsonld))
        return jsonld;

    if (_.isString(jsonld))
        jsonld = {'@value': jsonld};
    if (jsonld['@value'])
        return this._valueFix(jsonld, context);

    if (Object.keys(jsonld).length === 0)
        return '[]';

    context = context || {'_':'_'};
    // TODO: what if there is context without a graph?
    if (jsonld['@context'])
    {
        context = _.extend({}, context);
        for (var key in jsonld['@context'])
        {
            var val = jsonld['@context'][key];
            graphList.push(format('PREFIX %s: <%s>\n', key, val));
            context[key] = val;
        }
    }
    if (root && !context[''] && baseURI)
    {
        graphList.push(format('PREFIX : <%s>\n', baseURI));
        context[''] = baseURI;
        baseURI = undefined; // we only need to set it once
    }
    // TODO: if id is already filled in this is probably an error if there is a new value
    var id = jsonld['@id'] && this._URIfix(jsonld['@id'], context);
    if (jsonld['@graph'])
    {
        var localList = [];
        var childIDs = jsonld['@graph'].map(function (child) { return this._parse(child, baseURI, context, localList, true); }, this);
        if (ignoreGraph)
            id = localList.join('\n');
        else if (localList.length === 0)
            id = '{ }';
        else
            id = format('{ %s }', this._shiftStrings(localList, 2, true).join('\n'));
    }

    if (jsonld['@list'])
    {
        var children = jsonld['@list'].map(function (child) { return this._parse(child, baseURI, context, graphList);}, this);
        if (children.length === 0)
            id = '( )';
        else
            id = format('( %s )', this._shiftStrings(children, 2, true).join('\n'));
    }

    // TODO: context is being ignored here
    if (jsonld['@forAll'])
        return format('@forAll %s .', jsonld['@forAll'].map(function (child) { return this._parse(child, baseURI, context, graphList);}, this).join(' , '));
    if (jsonld['@forSome'])
        return format('@forSome %s .', jsonld['@forAll'].map(function (child) { return this._parse(child, baseURI, context, graphList);}, this).join(' , '));

    // TODO: @reverse (can only happen in specific cases when coming from parser)
    // TODO: handle blank nodes generated for special predicates
    var predicateObjectList = [];
    for (var key in jsonld)
    {
        if (key !== '@id' && key !== '@graph' && key !== '@context' && key !== '@list')
        {
            var val = jsonld[key];
            var predicate = this._URIfix(key, context);
            if (key === '@type')
                predicate = 'a';
            else if (predicate === 'log:implies')
                predicate = '=>';

            if (!_.isArray(val))
                val = [val];

            var objects = [];
            for (var i = 0; i < val.length; ++i)
            {
                var object;
                // special case since these don't use @id blocks
                if (predicate === 'a')
                    object = val[i];
                else
                    object = this._parse(val[i], baseURI, context, graphList);
                if (predicate === 'a')
                    object = this._URIfix(object, context);
                objects.push(object);
            }
            predicateObjectList.push(format('%s %s', predicate, this._shiftStrings(objects, this._lastWidth(predicate) + 1, true).join(' ,\n')));
        }
    }

    if (id)
    {
        if (predicateObjectList.length > 0)
            graphList.push(format('%s %s .', id, this._shiftStrings(predicateObjectList, this._lastWidth(id) + 1, true).join(' ;\n')));
        else if (root)
        {
            // special case for the graph in the root, since the last element will already have the dot
            if (ignoreGraph)
                graphList.push(id);
            else
                graphList.push(format('%s .', id));
        }
    }
    else
    {
        id = format('[ %s ]', this._shiftStrings(predicateObjectList, 2, true).join(' ;\n'));
        if (root)
            graphList.push(format('%s .', id));
    }

    return id;
};

JSONLDParser.prototype._valueFix = function (jsonld, context)
{
    if (!jsonld['@value'])
        throw "Expected an object with a '@value' key.";

    var result = JSON.stringify(jsonld['@value']); // format('"%s"', jsonld['@value']);
    // won't have triple quote strings since JSON converts newlines to \n
    if (jsonld['@language'])
        result = format('%s@%s', result, jsonld['@language']);
    if (jsonld['@type'])
        result = format('%s^^%s', result, this._URIfix(jsonld['@type'], context));
    return result;
};

JSONLDParser.prototype._URIfix = function (id, context)
{
    // literal as subject...
    if (_.isObject(id) && id['@value'])
        return this._valueFix(id, context);

    if (id[0] === '?' || _.isNumber(id))
        return id + '';
    // TODO: really really ugly fix again
    if (id[0] === '@' && id[1] === '@')
        return '"' + id.substring(2) + '"';
    var colonIdx = id.indexOf(':');
    if (colonIdx >= 0)
    {
        var prefix = id.substring(0, colonIdx);
        var suffix = id.substring(colonIdx+1);
        if ((context[prefix] || prefix === '_') && suffix.substr(0, 2) !== '//')
            return format('%s:%s', prefix, suffix);
    }
    for (var prefix in context)
    {
        var namespace = context[prefix];
        if (_.startsWith(id, namespace))
        {
            var suffix = id.substring(namespace.length);
            if (JSONLDParser.suffixTest.test(suffix))
                return format('%s:%s', prefix, suffix);
        }
    }

    return format('<%s>', id);
};

JSONLDParser.prototype._shiftStrings = function (parts, level, ignoreFirst)
{
    if (!this.indent)
        return parts;

    return parts.map(function (part, idx)
    {
        return this._shiftStringBlock(part, level, ignoreFirst && idx === 0);
    }.bind(this));
};

JSONLDParser.prototype._shiftStringBlock = function (block, level, ignoreFirst)
{
    if (!_.isString(block))
        return block;
    var parts = block.split('\n');
    var pad = _.repeat(' ', level);
    return (ignoreFirst ? '' : pad) + parts.join('\n' + pad);
};

JSONLDParser.prototype._blockWidth = function (block)
{
    return _.max(block.split('\n'), 'length').length;
};

JSONLDParser.prototype._lastWidth = function (block)
{
    var parts = block.split('\n');
    return parts[parts.length-1].length;
};

module.exports = JSONLDParser;