/**
 * Created by joachimvh on 18/06/2015.
 */

var _ = require('lodash');
var uuid = require('node-uuid');

function N3Parser () {}

// TODO: check up what reserved escapes are supposed to do http://www.w3.org/TR/turtle/#sec-escapes
// TODO: 32 bit unicode (use something like http://apps.timwhitlock.info/js/regex# ? or use xregexp with https://gist.github.com/slevithan/2630353 )
N3Parser._PN_CHARS_BASE = /[A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]/g;
N3Parser._PN_CHARS_U = new RegExp('(?:' + N3Parser._PN_CHARS_BASE.source + '|_)');
N3Parser._PN_CHARS = new RegExp('(?:' + N3Parser._PN_CHARS_U.source + '|' + /[-0-9\u00b7\u0300-\u036f\u203f-\u2040]/.source + ')');
N3Parser._PLX = /(?:%[0-9a-fA-F]{2})|(?:\\[-_~.!$&'()*+,;=/?#@%])/g;
// using _U instead of _BASE to also match blank nodes
N3Parser._prefix = new RegExp(
    N3Parser._PN_CHARS_U.source + '(?:(?:' + N3Parser._PN_CHARS.source + '|\\.)*' + N3Parser._PN_CHARS.source + ')?', 'g'
);
N3Parser._suffix = new RegExp(
    '(?:' + N3Parser._PN_CHARS_U.source + '|[:0-9]|' + N3Parser._PLX.source + ')' +
    '(?:(?:' + N3Parser._PN_CHARS.source + '|[.:]|' + N3Parser._PLX.source + ')*(?:' + N3Parser._PN_CHARS.source + '|:|' + N3Parser._PLX.source + '))?'
);
N3Parser._prefixIRI = new RegExp(
    '(?:' + N3Parser._prefix.source + ')?:' + N3Parser._suffix.source, 'g'
);
N3Parser._iriRegex = /<[^>]*>/g;
// TODO: lookbefore to check if there was no # (xregexp can support lookbefore if necessary), also do multiple runs so literals in-between 'disappear'
// TODO: can't do this since there might be a URI in the subject that contains a #
N3Parser._stringRegex = /("|')(\1\1)?(?:[^]*?[^\\])??(?:\\\\)*\2\1/g;
N3Parser._datatypeRegex = new RegExp(
    '\\^\\^(?:(?:' + N3Parser._iriRegex.source + ')|(?:' + N3Parser._prefixIRI.source + '))', 'g'
);
N3Parser._langRegex = /@[a-z]+(-[a-z0-9]+)*/g;
N3Parser._literalRegex = new RegExp(
    N3Parser._stringRegex.source +
    '((?:' + N3Parser._datatypeRegex.source + ')|(?:' + N3Parser._langRegex.source + '))?', 'g'
);
N3Parser._numericalRegex = /(?:[[{(.\s]|^)[-+]?(?:(?:(?:(?:[0-9]+\.?[0-9]*)|(?:\.[0-9]+))[eE][-+]?[0-9]+)|(?:[0-9]*(\.[0-9]+))|(?:[0-9]+))/g;
N3Parser._booleanRegex = /(?:true)|(?:false)/g;

// TODO: can't handle comments correctly yet
N3Parser.prototype.toJSONLD = function (n3String)
{
    // remove simple comments ('m' is necessary to treat \n as the end of a match instead of only using the end of the string)
    n3String = n3String.replace(/^\s*#.*$/gm, '');

    var replacementMap = {idx: 0};
    var valueMap = {};
    var literalMap = {};
    // TODO: do the regexes at the same time and use the first one (so we know if we have a comment or a literal)
    n3String = this._replaceMatches(n3String, N3Parser._literalRegex, replacementMap, literalMap, this._replaceStringLiteral.bind(this));
    n3String = this._replaceMatches(n3String, N3Parser._iriRegex, replacementMap, valueMap, this._replaceIRI.bind(this));
    n3String = this._replaceMatches(n3String, N3Parser._prefixIRI, replacementMap, valueMap, this._replaceIRI.bind(this));
    n3String = this._replaceMatches(n3String, N3Parser._numericalRegex, replacementMap, literalMap, function (match) { match.jsonld = parseFloat(match[0]); return match; });
    n3String = this._replaceMatches(n3String, N3Parser._booleanRegex, replacementMap, literalMap, function (match) { match.jsonld = match[0] === 'true'; return match; });

    var literalKeys = Object.keys(literalMap);

    // assume all remaining #'s belong to comments
    n3String = n3String.replace(/#.*$/gm, '');

    var tokens = n3String.split(/\s+|([;.,{}[\]()!^])|(<?=>?)/).filter(Boolean); // splits and removes empty elements
    var jsonld = this._statementsOptional(tokens);
    this._updatePathNodes(jsonld); // changes in place

    var unsafePrefixes = this._collectUnsafePrefixes(jsonld, valueMap);
    this._safeExpand(jsonld, valueMap, unsafePrefixes); // TODO: remove the offending prefix from context

    jsonld = this._simplification(jsonld, literalKeys);
    jsonld = this._revertMatches(jsonld, valueMap);
    jsonld = this._revertMatches(jsonld, literalMap, true);
    this._unFlatten(jsonld); // edits in place

    // default graph is not necessary if there is only 1 root node
    if (jsonld['@graph'] && jsonld['@graph'].length === 1 && _.every(jsonld, function (val, key) { return key === '@context' || key === '@graph'; }))
    {
        var child = jsonld['@graph'][0];
        delete jsonld['@graph'];
        jsonld = this._extend(jsonld, child);
    }

    return jsonld;
};

N3Parser.prototype._replaceMatches = function (string, regex, map, valueMap, callback)
{
    var matches = [];
    var match;
    regex.lastIndex = 0;
    while (match = regex.exec(string))
        matches.push(match);

    var stringParts = [];
    // we start in the back to make sure the indexes of the previous matches stay correct
    for (var i = matches.length-1; i >= 0; --i)
    {
        match = matches[i];

        // need to do check of first character since javascript doesn't have lookbehind regexes
        var pre = /^[[{(.\s]/;
        if (pre.exec(match[0]))
        {
            match[0] = match[0].substring(1);
            match.index++;
        }
        if (callback)
            match = callback(match);
        if (!map[match[0]])
        {
            map[match[0]] = '%' + ++map.idx;
            valueMap[map[match[0]]] = match.jsonld === undefined ? match[0] : match.jsonld; // 0 can be a correct value
        }

        stringParts.push(string.substr(match.index + match[0].length));
        stringParts.push(' ' + map[match[0]] + ' '); // extra whitespace helps in parsing
        string = string.substring(0, match.index);
    }
    stringParts.push(string);
    stringParts.reverse();

    return stringParts.join('');
};

N3Parser.prototype._replaceStringLiteral = function (match)
{
    N3Parser._stringRegex.lastIndex = 0;
    N3Parser._datatypeRegex.lastIndex = 0;
    N3Parser._langRegex.lastIndex = 0;

    var str = N3Parser._stringRegex.exec(match[0]);
    var type = N3Parser._datatypeRegex.exec(match[0]);
    var lang = N3Parser._langRegex.exec(match[0]);

    str = str[0].substring(1, str[0].length-1);
    // change triple quotes to single quotes
    if (str[1] === match[1])
        str = str.substring(2, str.length-2);
    str = this._numericEscape(this._stringEscape(str));

    type = type && type[0].substring(2);
    if (type && type[0] === '<')
        type = type.substring(1, type.length-1);
    lang = lang && lang[0].substring(1);

    match.jsonld = str;
    if (type)
        match.jsonld = { '@value': str, '@type': type};
    if (lang)
        match.jsonld = { '@value': str, '@language': lang};
    return match;
};

N3Parser.prototype._replaceIRI = function (match)
{
    var iri = match[0];
    if (iri[0] === '<')
        iri = { iri: this._numericEscape(iri.substring(1, iri.length-1)), prefixed: false };
    else
        iri = { iri: iri, prefixed: true };
    match.jsonld = iri;
    return match;
};

// http://www.w3.org/TR/turtle/#sec-escapes
N3Parser.prototype._stringEscape = function (str)
{
    var regex = /((?:\\\\)*)\\([tbnrf"'\\])/g;
    return str.replace(regex, function (match, p1, p2)
    {
        var slashes = p1.substr(0, p1.length/2);
        var c;
        switch (p2)
        {
            case 't': c = '\t'; break;
            case 'b': c = '\b'; break;
            case 'n': c = '\n'; break;
            case 'r': c = '\r'; break;
            case 'f': c = '\f'; break;
            case '"':
            case "'":
            case '\\': c = p2; break;
            default: c = '';
        }
        return slashes + c;
    });
};

N3Parser.prototype._numericEscape = function (str)
{
    var regex = /\\[uU]([A-fa-f0-9]{4,6})/g;
    return str.replace(regex, function (match, unicode)
    {
        return String.fromCharCode(unicode);
    });
};

// TODO: reserved escape

N3Parser.prototype._safeExpand = function (jsonld, invertedIRIMap, unsafePrefixes, context)
{
    context = context || {};
    if (_.isString(jsonld))
    {
        if ((jsonld in invertedIRIMap) && invertedIRIMap[jsonld].prefixed)
        {
            var iri = invertedIRIMap[jsonld].iri;
            var colonIdx = iri.indexOf(':');
            if (colonIdx >= 0)
            {
                var prefix = iri.substring(0, colonIdx);
                var suffix = iri.substring(colonIdx+1);
                if (unsafePrefixes[prefix] && context[prefix])
                {
                    invertedIRIMap[jsonld].prefixed = false;
                    invertedIRIMap[jsonld].iri = invertedIRIMap[context[prefix]].iri + suffix;
                }
            }
        }
        return;
    }

    if (_.isArray(jsonld))
        return jsonld.map(function (thingy) { return this._safeExpand(thingy, invertedIRIMap, unsafePrefixes, context); }, this);

    if (_.isObject(jsonld))
    {
        // TODO: actually need to merge with nested context here, but we never generate that anyway...
        if (jsonld['@context'])
            context = jsonld['@context'];
        for (var key in jsonld)
        {
            if (key === '@context')
                continue;
            this._safeExpand(key, invertedIRIMap, unsafePrefixes, context);
            this._safeExpand(jsonld[key], invertedIRIMap, unsafePrefixes, context);
        }
        if (jsonld['@context'])
        {
            for (var prefix in unsafePrefixes)
                delete jsonld['@context'][prefix];
            if (Object.keys(jsonld['@context']).length === 0)
                delete jsonld['@context'];
        }
    }
};

N3Parser.prototype._collectUnsafePrefixes = function (jsonld, invertedIRIMap, context)
{
    context = context || {};
    if (_.isString(jsonld))
    {
        if ((jsonld in invertedIRIMap) && !invertedIRIMap[jsonld].prefixed)
        {
            var iri = invertedIRIMap[jsonld].iri;
            for (var prefix in context)
            {
                if (iri.substring(0, prefix.length+1) === prefix + ':' && iri.substring(0, prefix.length+3) !== prefix + '://')
                    return _.object([prefix],[true]);
            }
        }
        return {};
    }

    if (_.isArray(jsonld))
        return _.extend.apply(_, jsonld.map(function (thingy) { return this._collectUnsafePrefixes(thingy, invertedIRIMap, context); }, this));

    if (_.isObject(jsonld))
    {
        // TODO: actually need to merge with nested context here, but we never generate that anyway...
        if (jsonld['@context'])
            context = jsonld['@context'];
        var unsafe = [{}];
        for (var key in jsonld)
        {
            if (key === '@context')
                continue;
            unsafe.push(this._collectUnsafePrefixes(key, invertedIRIMap, context));
            unsafe.push(this._collectUnsafePrefixes(jsonld[key], invertedIRIMap, context));
        }
        return _.extend.apply(_, unsafe);
    }

    return {};
};

N3Parser.prototype._revertMatches = function (jsonld, invertedMap, literals, baseURI)
{
    baseURI = baseURI || 'http://www.example.org/';
    if (_.isString(jsonld))
    {
        // jsonld doesn't put colons in front of uri's that have the base prefix
        if (jsonld[0] === '%' && invertedMap[jsonld] !== undefined)
        {
            var v = invertedMap[jsonld];
            // current solution to not confuse JSONLDParser ( the URI #lemma1 gets encoded as { '@id': '#lemma1' }, at that point there is no way to know if we need to add the base prefix or not )
            if (v.prefixed && v.iri[0] === ':')
                v.iri = baseURI + v.iri.substring(1);
            if (v.iri)
                v = v.iri;
            return v;
        }
        return jsonld;
    }

    if (_.isArray(jsonld))
        return jsonld.map(function (thingy) { return this._revertMatches(thingy, invertedMap, literals, baseURI); }, this);

    if (jsonld['@context'] && jsonld['@context']['@vocab'])
    {
        baseURI = invertedMap[jsonld['@context']['@vocab']].iri;
        delete jsonld['@context']['@vocab']; // we need to delete @vocab since it is incorrect to take it into account, just used it to temporarily store the base uri
        if (Object.keys(jsonld['@context']).length === 0)
            delete jsonld['@context']
    }

    var result = {};
    for (var key in jsonld)
    {
        var val = this._revertMatches(jsonld[key], invertedMap, literals, baseURI);
        key = this._revertMatches(key, invertedMap, literals, baseURI);
        // convert subject literals (last check to not convert blank nodes)
        if (key === '@id' && literals && val !== jsonld[key])
        {
            if (_.isString(val))
                result['@value'] = val;
            else if (_.isObject(val) && '@value' in val)
                _.extend(result, val);
            else
                result[key] = val;
        }
        else
            result[key] = val;
    }
    return result;
};

N3Parser.prototype._updatePathNodes = function (jsonld, parent)
{

    var self = this;
    if (_.isString(jsonld))
        return false;

    var parentChanged = false;
    var changed = true;
    while (changed)
    {
        changed = false;
        if (_.isArray(jsonld))
            changed = _.some(jsonld, function (child) { return self._updatePathNodes(child, jsonld); });

        for (var key in jsonld)
        {
            if (key === '..')
            {
                this._extend(parent, jsonld[key], true);
                parentChanged = true;
                delete jsonld['..'];
            }
            else
                changed = this._updatePathNodes(jsonld[key], jsonld) || changed;
        }
    }

    return parentChanged;
};

N3Parser.prototype._simplification = function (jsonld, literalKeys, orderedList)
{
    if (_.isString(jsonld))
        return jsonld;
    if (_.isArray(jsonld))
    {
        var simplified = jsonld.map(function (thingy) { return this._simplification(thingy, literalKeys) }, this);
        // Don't merge items in ordered lists! Different semantics.
        if (!orderedList)
        {
            // merge objects with same @id
            var idMap = {};
            var rest = [];
            for (var i = 0; i < simplified.length; ++i)
            {
                var obj = simplified[i];
                if (obj['@id'] && _.isString(obj['@id']))
                    idMap[obj['@id']] = _.extend(idMap[obj['@id']] || {}, obj);
                else
                    rest.push(obj);
            }
            simplified = _.values(idMap).concat(rest);
        }
        return simplified;
    }

    if (jsonld['@id'] && Object.keys(jsonld).length === 1 && _.contains(literalKeys, jsonld['@id']))
        return jsonld['@id'];

    var result = {};
    for (var v in jsonld)
    {
        result[v] = this._simplification(jsonld[v], literalKeys, v === '@list');
        if (_.isArray(result[v]) && result[v].length === 1 && v !== '@list' && v !== '@graph')
            result[v] = result[v][0];
    }

    if (result['@type'])
    {
        if (result['@type']['@id'] && Object.keys(result['@type']).length === 1)
            result['@type'] = result['@type']['@id'];
        else if (_.isArray(result['@type']))
            result['@type'] = result['@type'].map(function (type)
            {
                if (type['@id'] && Object.keys(type).length === 1)
                  return type['@id'];
                return type;
            });
    }

    return result;
};

// TODO: does this still belong in this class?
N3Parser.prototype._unFlatten = function (jsonld)
{
    if (!jsonld['@graph'])
        return jsonld;

    var roots = {};

    for (var i = 0; i < jsonld['@graph'].length; ++i)
    {
        var node = jsonld['@graph'][i];
        if (node['@id'])
            roots[node['@id']] = node;
    }

    // don't use jsonld itself or you will get a stack overflow
    var references = this._findReferences(jsonld['@graph'], roots);
    for (var key in roots)
    {
        var colonIdx = key.indexOf(':');
        var prefix = colonIdx >= 0 ? key.substring(0, colonIdx) : null;

        if (references[key])
        {
            if (references[key].length === 1 && references[key][0] && !this._deepContains(roots[key], references[key][0]))
            {
                _.extend(references[key][0], roots[key]); // we actually want lodash extend functionality here to not duplicate things like @id
                //if (prefix && prefix === '_')
                    //delete references[key][0]['@id']; // deleting the id's for now so JSONLDParser gives nicer N3 output
                jsonld['@graph'] = _.without(jsonld['@graph'], roots[key]);
            }
        }
        else if (prefix && prefix === '_')
        {
            //delete roots[key]['@id']; // deleting the id's for now so JSONLDParser gives nicer N3 output
        }
    }
    return jsonld;
};

// necessary to handle circular references
N3Parser.prototype._deepContains = function (collection, element)
{
    if (_.isString(collection) || _.isNumber(collection) || _.isBoolean(collection))
        return collection === element;

    if (collection === element)
        return true;

    return _.some(collection, function (thingy) { return this._deepContains(thingy, element); }.bind(this));
};

N3Parser.prototype._findReferences = function (jsonld, roots)
{
    if (_.isString(jsonld))
        return {};

    var self = this;
    if (_.isArray(jsonld))
        return jsonld.reduce(function (prev, val) { return self._extend(prev, self._findReferences(val, roots)); }, {});

    // make sure we don't accidently merge graphs
    if (jsonld['@graph'])
    {
        // unflatten the subgraph, but don't combine it with the given roots
        jsonld['@graph'] = this._unFlatten(jsonld)['@graph'];
        return {};
    }

    var result = {};
    var id = jsonld['@id'];
    if (id && roots[id] && jsonld !== roots[id])
        result[id] = [jsonld];

    for (var key in jsonld)
    {
        result = this._extend(result, this._findReferences(jsonld[key], roots));
        if (roots[key])
            result = this._extend(result, _.object([key], [[undefined]])); // we need to count predicates also for correctness, but won't replace them
    }

    return result;
};

N3Parser.prototype._extend = function (objectA, objectB, inPlace)
{
    if (_.isString(objectA) && _.isString(objectB))
        return [objectA, objectB];

    if (_.isArray(objectA) !== _.isArray(objectB))
    {
        objectA = _.isArray(objectA) ? objectA : [objectA];
        objectB = _.isArray(objectB) ? objectB : [objectB];
    }

    if (_.isArray(objectA) && _.isArray(objectB))
    {
        if (inPlace)
        {
            for (var i = 0; i < objectB.length; ++i)
                objectA.push(objectB[i]);
            return objectA;
        }
        else
            return objectA.concat(objectB);
    }

    // 2 objects
    var result = inPlace ? objectA : {};
    var keys = _.union(Object.keys(objectA), Object.keys(objectB));
    for (var i = 0; i < keys.length; ++i)
    {
        var key = keys[i];
        if (objectA[key] !== undefined && objectB[key] !== undefined)
            result[key] = this._extend(objectA[key], objectB[key]);
        else if (objectA[key] !== undefined)
            result[key] = objectA[key];
        else if (objectB[key] !== undefined)
            result[key] = objectB[key];
    }
    return result;
};

N3Parser.prototype._statementsOptional = function (tokens)
{
    if (tokens.length === 0)
        return {};

    var dotExpected = tokens[0] !== 'PREFIX' && tokens[0] !== 'BASE';
    var statement = this._statement(tokens);

    if (dotExpected)
    {
        var dot = tokens.shift();
        if (dot !== '.')
            throw "Error: expected '.' but got " + dot; // TODO: better error reporting would be nice
    }

    return this._extend(statement, this._statementsOptional(tokens));
};


N3Parser.prototype._statement = function (tokens)
{
    if (tokens[0] === '@base' || tokens[0] === 'BASE' || tokens[0] === '@prefix' || tokens[0] === 'PREFIX' || tokens[0] === '@keywords')
        return this._declaration(tokens);

    if (tokens[0] === '@forAll' || tokens[0] === 'forAll' || tokens[0] === '@forSome' || tokens[0] === 'forSome')
        return this._quantification(tokens);

    return this._simpleStatement(tokens);
};

// TODO: uri validation and so on? (just run it through an n3 validator first?)
N3Parser.prototype._declaration = function (tokens)
{
    var declaration = tokens.shift(); // TODO: handle incorrect array lengths

    if (declaration === '@base' || declaration.toUpperCase() === 'BASE')
    {
        var uri = tokens.shift();
        return { '@context': { '@base': uri}};
    }
    else if (declaration === '@prefix' || declaration.toUpperCase() === 'PREFIX')
    {
        var prefix = tokens.shift();
        var uri = tokens.shift();
        // note that this @vocab needs to be deleted at a later stage since it is actually incorrect here (would allow for incorrect assumptions)
        if (prefix === ':')
            return { '@context': { '@vocab': uri}};
        else
        {
            var key = prefix.slice(0, -1);
            var extension = { '@context': {}};
            extension['@context'][key] = uri;
            return extension;
        }
    }
    // TODO: use this later on
    else if (declaration === '@keywords')
    {
        var keywords = [];
        while (tokens[0] !== '.')
        {
            keywords.push(tokens[0].shift());
            if (tokens[0] === ',')
                tokens[0].shift();
        }
    }
};

N3Parser.prototype._quantification = function (tokens)
{
    var quantifier = tokens.shift();
    if (quantifier[0] !== '@')
        quantifier = '@' + quantifier;
    var symbols = [];
    while (tokens[0] !== '.')
    {
        symbols.push(tokens[0].shift());
        if (tokens[0] === ',')
            tokens[0].shift();
    }
    var jsonld = {};
    jsonld[quantifier] = symbols;
    return {'@graph': [jsonld]};
};

N3Parser.prototype._simpleStatement = function (tokens)
{
    var subject = this._subject(tokens);
    var propertylist = this._propertylist(tokens);
    return {'@graph': [this._extend(subject, propertylist)]};
};

N3Parser.prototype._subject = function (tokens)
{
    return this._expression(tokens);
};

N3Parser.prototype._expression = function (tokens)
{
    var pathitem = this._pathitem(tokens); // x
    pathitem = _.isString(pathitem) ? { '@id': pathitem} : pathitem;
    if (tokens[0] === '!')
    {
        // x!p means [ is p of x ]
        tokens.shift(); // '!'
        var p = this._expression(tokens);
        return this._combinePredicateObjects({'@reverse': p}, [pathitem]);
    }
    else if (tokens[0] === '^')
    {
        // x^p means [ p x ]
        tokens.shift(); // '^'
        var p = this._expression(tokens);
        return this._combinePredicateObjects(p, [pathitem]);
    }
    return pathitem;
};

N3Parser.prototype._pathitem = function (tokens)
{
    if (tokens[0] === '{')
    {
        tokens.shift(); // {
        var result = this._formulacontent(tokens);
        tokens.shift(); // }
        return result;
    }
    else if (tokens[0] === '[')
    {
        tokens.shift(); // [
        var result = this._propertylist(tokens);
        tokens.shift(); // ]
        return result;
    }
    else if (tokens[0] === '(')
    {
        tokens.shift(); // (
        var result = this._pathlist(tokens);
        tokens.shift(); // )
        return result;
    }
    else
        return tokens.shift();
};

N3Parser.prototype._pathlist = function (tokens)
{
    var list = [];
    while (tokens[0] !== ')')
        list.push(this._expression(tokens));
    return {'@list': list};
};

N3Parser.prototype._formulacontent = function (tokens)
{
    var content = {};
    // handle empty formulas
    if (tokens[0] === '}')
        return { '@graph': []};
    while (tokens[0] !== '}')
    {
        // difference with statements_optional: this one doesn't necessarily end with a dot
        content = this._extend(content, this._statement(tokens));
        if (tokens[0] === '.') // note that the dot should always be here except for the last statement
            tokens.shift();
    }
    return content;
};

N3Parser.prototype._propertylist = function (tokens)
{
    if (tokens.length === 0 || tokens[0] === ']' || tokens[0] === '.' || tokens[0] === '}' || tokens[0] === ')')
        return {};

    var predicate = this._predicate(tokens);

    var objects = [this._object(tokens)];
    while (tokens[0] === ',')
    {
        tokens.shift();
        objects.push(this._object(tokens));
    }
    var jsonld = this._combinePredicateObjects(predicate, objects);
    if (tokens[0] === ';')
    {
        tokens.shift();
        jsonld = this._extend(jsonld, this._propertylist(tokens));
    }
    return jsonld;
};

N3Parser.prototype._combinePredicateObjects = function (predicate, objects, nestLevel)
{
    // simple URIs get converted to { @id: URI}, this needs to be changed for predicates
    if (!_.isString(predicate))
    {
        var keys = Object.keys(predicate);
        if (keys.length === 1 && keys[0] === '@id')
            predicate = predicate['@id'];
    }

    nestLevel = nestLevel || 0;
    var jsonld = {};
    if (predicate['@reverse'])
        jsonld['@reverse'] = this._combinePredicateObjects(predicate['@reverse'], objects, nestLevel+1);
    else if (!_.isString(predicate))
    {
        var blank = '_:b_' + uuid.v4();
        // this tells the final parser to move this part up a level
        if (Object.keys(predicate).length > 0)
        {
            jsonld['..'] = [this._extend({'@id':blank}, predicate)];
            for (var i = 0; i < nestLevel; ++i)
                jsonld['..'] = {'..':jsonld['..']};
        }
        jsonld[blank] = objects;
    }
    else
        jsonld[predicate] = objects;
    return jsonld;
};

N3Parser.prototype._predicate = function (tokens)
{
    if (tokens[0] === '@has')
    {
        tokens.shift(); // @has
        return this._expression(tokens);
    }
    else if (tokens[0] === '@is')
    {
        tokens.shift(); // @is
        var pred = this._expression(tokens);
        tokens.shift(); // @of
        return {'@reverse': pred};
    }
    else if (tokens[0] === '@a' || tokens[0] === 'a')
    {
        tokens.shift(); // @a
        return '@type';
    }
    else if (tokens[0] === '=')
    {
        tokens.shift(); // =
        return 'http://www.w3.org/2002/07/owl#equivalentTo';
    }
    else if (tokens[0] === '=>')
    {
        tokens.shift(); // =>
        return 'http://www.w3.org/2000/10/swap/log#implies';
    }
    else if (tokens[0] === '<=')
    {
        tokens.shift(); // <=
        return {'@reverse': 'http://www.w3.org/2000/10/swap/log#implies'};
    }
    else
        return this._expression(tokens);
};

N3Parser.prototype._object = function (tokens)
{
    return this._expression(tokens);
};


module.exports = N3Parser;

// :a :b :c.a:a :b :c.
// :a :b :5.E3:a :b :c.
//var parser = new N3Parser();
//var jsonld = parser.toJSONLD('() {() () ()} ().');
//var jsonld = parser.toJSONLD('@prefix : <http://f4w.restdesc.org/demo#>. @prefix tmpl: <http://purl.org/restdesc/http-template#> . @prefix http: <http://www.w3.org/2011/http#> ._:sk15_1 http:methodName "POST". _:sk15_1 tmpl:requestURI ("http://defects.tho.f4w.l0g.in/api/reports"). _:sk15_1 http:body {_:sk16_1 :event_id 174 .   _:sk16_1 :operator_id 3 .   _:sk16_1 :solution_id 3 .   _:sk16_1 :success false.   _:sk16_1 :comment "solved!"}. :firstTry :triedAndReported _:sk17_1. :firstTry :tryNewSolution true.');
//var jsonld = parser.toJSONLD('"a"^^<xsd:int> :a _:a.');
//var jsonld = parser.toJSONLD(':a :tolerances ( {[ :min :min1; :max :max1 ]} {[ :min :min2; :max :max2 ]} ).');
//var jsonld = parser.toJSONLD('{ :a }.');
//var jsonld = parser.toJSONLD(':a :b 0, 1.');
//var jsonld = parser.toJSONLD(':toJSONLDa :b :c. :c :b :a.');
//var jsonld = parser.toJSONLD('# comment " test \n <http://test#stuff> :b "str#ing". :a :b """line 1\n#line2\nline3""". # comment about this thing');
//var jsonld = parser.toJSONLD(':a :b "a\n\rb\\"c"@nl-de.');
//var jsonld = parser.toJSONLD(':Plato :says { :Socrates :is :mortal }.');
//var jsonld = parser.toJSONLD('{ :Plato :is :immortal } :says { :Socrates :is { :person :is :mortal } . :Donald a :Duck }.');
//var jsonld = parser.toJSONLD('[:a :b]^<test> [:c :d]!<test2> [:e :f]!<test3>.');
//var jsonld = parser.toJSONLD('[:a :b] :c [:e :f].');
//var jsonld = parser.toJSONLD(':a :b 5.E3.a:a :b :c.');
//var jsonld = parser.toJSONLD('@prefix gr: <http://purl.org/goodrelations/v1#> . <http://www.acme.com/#store> a gr:Location; gr:hasOpeningHoursSpecification [ a gr:OpeningHoursSpecification; gr:opens "08:00:00"; gr:closes "20:00:00"; gr:hasOpeningHoursDayOfWeek gr:Friday, gr:Monday, gr:Thursday, gr:Tuesday, gr:Wednesday ]; gr:name "Hepp\'s Happy Burger Restaurant" .');
//var jsonld = parser.toJSONLD('@prefix ex:<http://ex.org/>. <:a> <ex:b> ex:c.');
//console.log(JSON.stringify(jsonld, null, 4));

//var fs = require('fs');
//var data = fs.readFileSync('n3/secondUseCase/proof.n3', 'utf8');
//var jsonld = parser.parse(data);

//var JSONLDParser = require('./JSONLDParser');
//var jp = new JSONLDParser();
//console.log(jp.toN3(jsonld, 'http://www.example.org/'));