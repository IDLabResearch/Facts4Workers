/**
 * Created by joachimvh on 18/06/2015.
 */

var _ = require('lodash');

function N3Parser ()
{

}

N3Parser._PN_CHARS_BASE = /[A-Z_a-z\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u0370-\u037d\u037f-\u1fff\u200c-\u200d\u2070-\u218f\u2c00-\u2fef\u3001-\ud7ff\uf900-\ufdcf\ufdf0-\ufffd]/g;
N3Parser._PN_CHARS_U = new RegExp('(?:' + N3Parser._PN_CHARS_BASE.source + '|_)');
N3Parser._PN_CHARS = new RegExp('(?:' + N3Parser._PN_CHARS_U.source + '|' + /[-0-9\u00b7\u0300-\u036f\u203f-\u2040]/.source + ')');
N3Parser._PLX = /(?:%[0-9a-fA-F]{2})|(?:\\[-_~.!$&'()*+,;=/?#@%])/g;
N3Parser._prefix = new RegExp(
    N3Parser._PN_CHARS_BASE.source + '(?:(?:' + N3Parser._PN_CHARS.source + '|\.)*' + N3Parser._PN_CHARS.source + ')?', 'g'
);
N3Parser._postfix = new RegExp(
    '(?:' + N3Parser._PN_CHARS_U.source + '|[:0-9]|' + N3Parser._PLX.source + ')' +
    '(?:(?:' + N3Parser._PN_CHARS.source + '|[.:]|' + N3Parser._PLX.source + ')*(?:' + N3Parser._PN_CHARS.source + '|[:]|' + N3Parser._PLX.source + '))?'
);
N3Parser._prefixIRI = new RegExp(
    '(?:' + N3Parser._prefix.source + ')?:' + N3Parser._postfix.source, 'g'
);
N3Parser._iriRegex = /<[^>]*>/g;
N3Parser._stringRegex = /("|')(\1\1)?(?:[^]*?[^\\])??(?:\\\\)*\2\1/g;
N3Parser._datatypeRegex = new RegExp(
    '\\^\\^(?:(?:' + N3Parser._iriRegex.source + ')|(?:' + N3Parser._prefixIRI.source + '))', 'g'
);
N3Parser._langRegex = /@[a-z]+(-[a-z0-9]+)*/g;
N3Parser._literalRegex = new RegExp(
    N3Parser._stringRegex.source +
    '((' + N3Parser._datatypeRegex.source + ')|(' + N3Parser._langRegex.source + '))?', 'g'
);
N3Parser._numericalRegex = /[-+]?(?:(?:(?:(?:[0-9]+\.?[0-9]*)|(?:\.[0-9]+))[eE][-+]?[0-9]+)|(?:[0-9]*(\.[0-9]+))|(?:[0-9]+))(?=\s*[.})])/g;

N3Parser.prototype.parse = function (n3String)
{
    var replacementMap = {idx: 0};
    var valueMap = {};
    n3String = this._replaceMatches(n3String, N3Parser._literalRegex, replacementMap, valueMap, this._replaceStringLiteral);
    n3String = this._replaceMatches(n3String, N3Parser._numericalRegex, replacementMap, valueMap, parseFloat);
    var literalKeys = Object.keys(valueMap);
    n3String = this._replaceMatches(n3String, N3Parser._iriRegex, replacementMap, valueMap, this._replaceIRI);
    n3String = this._replaceMatches(n3String, N3Parser._prefixIRI, replacementMap, valueMap, this._replaceIRI);
    console.log(n3String);

    var tokens = n3String.split(/\s+|([;.,{}[\]()])|(<?=>?)/).filter(Boolean); // splits and removes empty elements
    var jsonld = this._statementsOptional(tokens);
    this._updatePathNodes(jsonld); // changes in place

    // default graph is not always necessary to indicate
    if (jsonld['@graph'] && jsonld['@graph'].length === 1)
    {
        var child = jsonld['@graph'][0];
        delete jsonld['@graph'];
        jsonld = this._extend(jsonld, child);
    }

    jsonld = this._simplification(jsonld, literalKeys);
    jsonld = this._revertMatches(jsonld, valueMap);
    console.log(JSON.stringify(jsonld, null, 4));
};

N3Parser.prototype._replaceMatches = function (string, regex, map, valueMap, callback)
{
    var matches = [];
    var match;
    regex.lastIndex = 0;
    while (match = regex.exec(string))
        matches.push({idx:match.index, length:match[0].length});

    var stringParts = [];
    for (var i = matches.length-1; i >= 0; --i)
    {
        match = matches[i];

        var matchString = string.substr(match.idx, match.length);
        if (callback)
            callback(matchString);
        if (!map[matchString])
        {
            map[matchString] = '#' + ++map.idx;
            valueMap[map[matchString]] = callback ? callback(matchString) : matchString;
        }

        stringParts.push(string.substr(match.idx + match.length));
        stringParts.push(' ' + map[matchString] + ' '); // extra whitespace helps in parsing
        string = string.substring(0, match.idx);
    }
    stringParts.push(string);
    stringParts.reverse();

    return stringParts.join('');
};

N3Parser.prototype._replaceStringLiteral = function (literal)
{
    N3Parser._stringRegex.lastIndex = 0;
    N3Parser._datatypeRegex.lastIndex = 0;
    N3Parser._langRegex.lastIndex = 0;

    var str = N3Parser._stringRegex.exec(literal);
    var type = N3Parser._datatypeRegex.exec(literal);
    var lang = N3Parser._langRegex.exec(literal);

    str = str[0].substring(1, str[0].length-1);
    type = type && type[0].substring(2);
    if (type && type[0] === '<')
        type = type.substring(1, type.length-1);
    lang = lang && lang[0].substring(1);

    if (type)
        return { '@value': str, '@type': type};
    if (lang)
        return { '@value': str, '@language': lang};
    return str;
};


N3Parser.prototype._replaceIRI = function (iri)
{
    if (iri[0] === '<')
        iri = iri.substring(1, iri.length-1);
    return iri;
};

N3Parser.prototype._revertMatches = function (jsonld, invertedMap)
{
    if (_.isString(jsonld))
        return jsonld[0] === '#' ? invertedMap[jsonld] : jsonld;

    if (_.isArray(jsonld))
        return jsonld.map(function (thingy) { return this._revertMatches(thingy, invertedMap); }, this);

    var result = {};
    for (var key in jsonld)
    {
        var val = this._revertMatches(jsonld[key], invertedMap);
        key = this._revertMatches(key, invertedMap);
        result[key] = val;
    }
    return result;
};

N3Parser.prototype._updatePathNodes = function (jsonld)
{
    var self = this;
    if (_.isString(jsonld))
        return [];
    if (_.isArray(jsonld))
    {
        var pathNodes = _.filter(jsonld.map(function (thingy) { return self._updatePathNodes(thingy) }), 'length');
        for (var i = 0; i < pathNodes.length; ++i)
            this._extend(jsonld, pathNodes[i], true);
    }

    for (var key in jsonld)
    {
        var pathNodes = this._updatePathNodes(jsonld[key]);
        for (var i = 0; i < pathNodes.length; ++i)
            this._extend(jsonld, pathNodes[i], true);
    }

    var result = jsonld['..'] || [];
    delete jsonld['..'];

    return result;
};

N3Parser.prototype._simplification = function (jsonld, literalKeys)
{

    if (_.isString(jsonld))
        return jsonld;
    if (_.isArray(jsonld))
        return jsonld.map(function (thingy) { return this._simplification(thingy, literalKeys) }, this);

    if (jsonld['@id'] && Object.keys(jsonld).length === 1 && _.contains(literalKeys, jsonld['@id']))
        return jsonld['@id'];

    var result = {};
    for (var v in jsonld)
    {
        result[v] = this._simplification(jsonld[v], literalKeys);
        if (_.isArray(result[v]) && result[v].length === 1)
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
        if (objectA[key] && objectB[key])
            result[key] = this._extend(objectA[key], objectB[key]);
        else if (objectA[key])
            result[key] = objectA[key];
        else if (objectB[key])
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

    if (tokens[0] === '@forAll' || tokens[0] === '@forSome')
        return this._quantification(tokens);

    return this._simpleStatement(tokens);
};

// TODO: uri validation and so on? (just run it through an n3 validator first?)
N3Parser.prototype._declaration = function (tokens)
{
    var declaration = tokens.shift(); // TODO: handle incorrect array lengths

    if (declaration === '@base' || declaration === 'BASE')
    {
        var uri = results.tokens.shift();
        return { '@context': { '@base': uri}};
    }
    else if (declaration === '@prefix' || declaration === 'PREFIX')
    {
        var prefix = tokens.shift();
        var uri = tokens.shift();
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
    // TODO: problem because there is a big difference between predicates and the rest?
    // TODO: should check out what the parser does with this
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

// TODO: how do you do named graphs in N3?
N3Parser.prototype._formulacontent = function (tokens)
{
    var content = {};
    var start = true;
    while (tokens[0] !== '}')
    {
        if (!start)
            tokens.shift(); // '.'
        // difference with statements_optional: this one doesn't end with a dot
        content = this._extend(content, this._statement(tokens));
        start = false;
    }
    return content;
};

N3Parser.prototype._propertylist = function (tokens)
{
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

N3Parser.prototype._combinePredicateObjects = function (predicate, objects)
{
    // simple URIs get converted to { @id: URI}, this needs to be changed for predicates
    if (!_.isString(predicate))
    {
        var keys = Object.keys(predicate);
        if (keys.length === 1 && keys[0] === '@id')
            predicate = predicate['@id'];
    }

    var jsonld = {};
    // TODO: what if reversed predicate is an object
    if (predicate['@reverse'])
    {
        jsonld['@reverse'] = {};
        jsonld['@reverse'][predicate['@reverse']] = objects;
    }
    else if (!_.isString(predicate))
    {
        // TODO: generate unique blank node id
        var blank = 'TODO1';
        // TODO: can we have a reverse problem here?
        // this tells the final parser to move this part up a level?
        jsonld['..'] = [this._extend({'@id': blank}, predicate)];
        jsonld[blank] = objects;
    }
    else
        jsonld[predicate] = objects;
    return jsonld;
};

// TODO: what to do with predicates with empty prefix?
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

var parser = new N3Parser();
//parser.parse(':Plato :says { :Socrates :is :mortal }.');
//parser.parse(':Plato [:A :b] :Socrates.');
parser.parse(':a :b 5.E3:a :b :c.');
//parser.parse('@prefix gr: <http://purl.org/goodrelations/v1#> . <http://www.acme.com/#store> a gr:Location; gr:hasOpeningHoursSpecification [ a gr:OpeningHoursSpecification; gr:opens "08:00:00"; gr:closes "20:00:00"; gr:hasOpeningHoursDayOfWeek gr:Friday, gr:Monday, gr:Thursday, gr:Tuesday, gr:Wednesday ]; gr:name "Hepp\'s Happy Burger Restaurant" .');