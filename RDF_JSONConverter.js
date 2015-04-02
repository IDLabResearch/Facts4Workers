/**
 * Created by joachimvh on 31/03/2015.
 */

var N3 = require('n3');
var _ = require('lodash');

function RDF_JSONConverter (prefixes)
{
    this.prefixes = prefixes;
    prefixes['rdf'] = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
    this.blankidx = 1;
}

RDF_JSONConverter.prototype.JSONtoRDF = function (json, root)
{
    return this._JSONtoRDFrecursive(json, this._extendPrefix(root));
};

function flatten (arrays)
{
    return [].concat.apply([], arrays);
}

RDF_JSONConverter.prototype._extendPrefix = function (element)
{
    return N3.Util.expandPrefixedName(element, this.prefixes);
};

RDF_JSONConverter.prototype._JSONtoRDFrecursive = function (json, subject, predicate)
{
    var results = [];
    var partial = {subject: subject, predicate: predicate};
    if (_.isString(json) || _.isNumber(json))
    {
        // TODO: predicate === null error
        partial.object = N3.Util.createLiteral(json);
        return [partial];
    }
    else if (_.isArray(json))
    {
        var blankList = '_:blank' + this.blankidx++;
        if (predicate)
        {
            partial.object = blankList;
            results.push(partial);
        }
        if (json.length <= 1)
            results.push({subject: blankList, predicate: this._extendPrefix('rdf:rest'), object: this._extendPrefix('rdf:nil')});
        if (json.length > 0)
            results.push(this._JSONtoRDFrecursive(json.shift(), blankList, this._extendPrefix('rdf:first')));
        // size-1 due to shift ^
        if (json.length > 0)
            results.push(this._JSONtoRDFrecursive(json, blankList, this._extendPrefix('rdf:rest')));
        return flatten(results);
    }
    else
    {
        if (predicate)
        {
            subject = '_:blank' + this.blankidx++;
            partial.object = subject;
            results.push(partial);
        }
        var keys = Object.keys(json);
        var self = this;
        return results.concat(flatten(keys.map(function (key)
        {
            return self._JSONtoRDFrecursive(json[key],  subject, self._extendPrefix(':' + key));
        })));
    }
};

RDF_JSONConverter.prototype.RDFtoJSON = function (store, root)
{
    return this._RDFtoJSONrecursive(store, root);
};

RDF_JSONConverter.prototype._RDFtoJSONrecursive = function (store, root, graph)
{
    if (N3.Util.isLiteral(root))
        return this._convertElement(root);

    var self = this;
    var arrayCheck = store.find(root, 'rdf:first', null, graph);
    if (arrayCheck.length > 0)
        return this._traverseArray(store, root).map(function (element) { return self._RDFtoJSONrecursive(store, element, graph); });

    var result = {};
    var matches = store.find(root, null, null, graph);
    for (var i = 0; i < matches.length; ++i)
    {
        var key = this._convertElement(matches[i].predicate);
        if (key === 'TODO') // TODO: should not be necessary
            return '';
        var object = matches[i].object;
        result[key] = self._RDFtoJSONrecursive(store, object, graph);
        if (key === 'tolerances' && _.isArray(result[key]) && result[key].length === 2 && _.isArray(result[key][0])) // TODO: should definitely also not be necessary
            result[key] = [{min: result[key][0][0], max: result[key][0][1]}, {min: result[key][0][0], max: result[key][0][1]}];
    }

    var graphEntries = store.find(null, null, null, root);
    // TODO: how to visualize subgraph stuff? not really correct for now but maybe enough? assume no matches yet
    // TODO: assume single subject ...
    if (graphEntries.length > 0)
    {
        result = this._RDFtoJSONrecursive(store, graphEntries[0].subject, graphEntries[0].graph);
        result['rdf:subject'] = this._convertElement(graphEntries[0].subject);
    }

    // simple URI without db entries
    if (Object.keys(result).length === 0)
        return this._convertElement(root);

    return result;
};

RDF_JSONConverter.prototype._traverseArray = function (store, root)
{
    var first = store.find(root, 'rdf:first', null)[0].object;
    var rest = store.find(root, 'rdf:rest', null)[0].object;
    var results = [first];
    if (rest !== 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')
        results = results.concat(this._traverseArray(store, rest));
    return results;
};

RDF_JSONConverter.prototype._convertElement = function (element)
{
    if (N3.Util.isIRI(element))
    {
        for (prefix in this.prefixes)
        {
            if (element.indexOf(this.prefixes[prefix]) === 0)
            {
                element = element.substring(this.prefixes[prefix].length);
                if (prefix.length > 0)
                    element = prefix + ':' + element;
            }
        }
    }
    if (N3.Util.isLiteral(element))
        return N3.Util.getLiteralValue(element);
    return element;
};

module.exports = RDF_JSONConverter;
