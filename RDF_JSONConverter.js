/**
 * Created by joachimvh on 31/03/2015.
 */

var n3 = require('n3');
var _ = require('lodash');

function RDF_JSONConverter (prefix)
{
    this.prefixes = {'': prefix, 'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'};
    this.blankidx = 1;
}

RDF_JSONConverter.prototype.JSONtoRDF = function (json, root)
{
    return this._JSONtoRDFrecursive(json, root);
};

function flatten (arrays)
{
    return [].concat.apply([], arrays);
}

RDF_JSONConverter.prototype._extendPrefix = function (element)
{
    return n3.Util.expandPrefixedName(element, this.prefixes);
};

RDF_JSONConverter.prototype._JSONtoRDFrecursive = function (json, subject, predicate)
{
    var results = [];
    var partial = {subject: subject, predicate: predicate};
    if (_.isString(json) || _.isNumber(json))
    {
        // TODO: predicate === null error
        partial.object = n3.Util.createLiteral(json);
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

RDF_JSONConverter.prototype._RDFtoJSONrecursive = function (store, root)
{
    if (n3.Util.isLiteral(root))
        return this._convertElement(root);

    var self = this;
    var arrayCheck = store.find(root, 'rdf:first', null);
    if (arrayCheck.length > 0)
        return this._traverseArray(store, root).map(function (element) { return self._RDFtoJSONrecursive(store, element); });

    var result = {};
    var matches = store.find(root, null, null);
    for (var i = 0; i < matches.length; ++i)
    {
        var key = this._convertElement(matches[i].predicate);
        var object = matches[i].object;
        result[key] = self._RDFtoJSONrecursive(store, object);
    }
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
    if (n3.Util.isIRI(element))
        return element.replace(this.prefix[''], '');
    if (n3.Util.isLiteral(element))
        return n3.Util.getLiteralValue(element);
    return element;
};