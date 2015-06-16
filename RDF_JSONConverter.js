/**
 * Created by joachimvh on 31/03/2015.
 */

var N3 = require('n3');
var _ = require('lodash');
var uuid = require('node-uuid');

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

RDF_JSONConverter.prototype._RDFtoN3recursive = function (store)
{
    var i, key, triple, subject, predicate;
    // TODO: no graph support or blank predicates
    // TODO: maybe too much overlap with toJSON
    // TODO: can be shorter with prefixes

    var self = this;
    var subjects = {};

    var all = store.find();
    for (i = 0; i < all.length; ++i)
    {
        triple = all[i];
        if (!subjects[triple.subject])
            subjects[triple.subject] = {};
        subject = subjects[triple.subject];
        if (!subject[triple.predicate])
            subject[triple.predicate] = [];
        predicate = subject[triple.predicate];
        predicate.push(triple.object);
    }

    var done = false;
    while (!done)
    {
        done = true;
        for (key in subjects)
        {
            subject = subjects[key];
            if (_.isArray(subject))
                continue;

            done = !handleElement(store, key);
            if (!done)
                break;
        }
    }

    fillInTheBlanks();
    convertURIs();

    // TODO: hardcoded prefixes
    var prefixes = ['', 'http', 'tmpl'];

    var output = '';
    for (i = 0; i < prefixes.length; ++i)
        output += '@prefix ' + prefixes[i] + ': <' + self.prefixes[prefixes[i]] + '>. '

    for (key in subjects)
        output += toString(subjects[key], key) + ' ';

    return output;

    function handleElement (store, subjectURI)
    {
        if (N3.Util.isLiteral(subjectURI))
            return false;

        if (handleArrayElement(store, subjectURI))
            return true;

        return handleBlankNodes(store, subjectURI);
    }

    function handleArrayElement (store, subjectURI)
    {
        var subject = subjects[subjectURI];
        if (_.isArray(subject))
            return false;
        var firsts = subject['http://www.w3.org/1999/02/22-rdf-syntax-ns#first'];
        if (!firsts)
            return false;
        if (firsts.length > 1)
            throw "Invalid format: 2 rdf:first objects for 1 subject";

        if (subjects[firsts[0]])
            handleElement(store, firsts[0]);
        var array = [subjects[firsts[0]] || firsts[0]];
        // TODO: wrong if a blank node appears in multiple arrays
        if (!N3.Util.isIRI(firsts[0]))
            delete subjects[firsts[0]];
        var rests = subject['http://www.w3.org/1999/02/22-rdf-syntax-ns#rest'];
        if (rests)
        {
            if (rests.length > 1)
                throw "Invalid format: 2 rdf:rest objects for 1 subject";
            if (rests.length > 0)
            {
                var rest = subjects[rests[0]];
                if (rest)
                {
                    if (!_.isArray(rest))
                    {
                        handleArrayElement(store, rests[0]);
                        rest = subjects[rests[0]];
                    }
                    array = array.concat(rest);
                    delete subjects[rests[0]];
                }
            }
        }
        subjects[subjectURI] = array;
        return true;
    }

    function handleBlankNodes (store, subjectURI)
    {
        var subject = subjects[subjectURI];

        var changed = false;

        for (var predicate in subject)
        {
            for (var i = 0; i < subject[predicate].length; ++i)
            {
                var object = subject[predicate][i];
                // TODO: only change if object is an array currently since everything else needs to be ground!!!
                if (_.isString(object) && N3.Util.isBlank(object) && subjects[object] && store.find(null, null, object).length === 1 && _.isArray(subjects[object]))
                {
                    handleElement(store, object);
                    subject[predicate][i] = subjects[object];
                    delete subjects[object];
                    changed = true;
                }
            }
        }

        return changed;
    }

    // any root nodes that are still blank need to be updated
    function fillInTheBlanks ()
    {
        for (var key in subjects)
        {
            if (N3.Util.isBlank(key))
                replaceRecursive(subjects, key, ':' + uuid.v4() + '_' + key.substring(2));
        }
        return subjects;
    }

    function replaceRecursive (thingy, old, replacement)
    {
        if (_.isString(thingy))
            return (thingy === old) ? replacement : thingy;

        if (_.isArray(thingy))
            return thingy.map(function (subthingy) { return replaceRecursive(subthingy, old, replacement); });

        for (var key in thingy)
        {
            thingy[key] = replaceRecursive(thingy[key], old, replacement);
            if (key === old)
            {
                thingy[replacement] = thingy[key];
                delete thingy[key];
            }
        }
        return thingy;
    }

    function convertURIs (thingy)
    {
        thingy = thingy || subjects;
        if (_.isString(thingy))
            if (N3.Util.isIRI(thingy))
                return self.convertElement(thingy, false);
            else
                return thingy;

        if (_.isArray(thingy))
            return thingy.map(function (subthingy) { return convertURIs(subthingy); });

        for (var key in thingy)
        {
            var conversion = self.convertElement(key, false);
            thingy[conversion] = convertURIs(thingy[key]);
            if (conversion !== key)
                delete thingy[key];
        }

        return thingy;
    }

    function toString (subject, uri)
    {
        if (_.isString(subject))
            return subject;

        if (_.isArray(subject))
        {
            for (var i = 0; i < subject.length; ++i)
                subject[i] = toString(subject[i], null);
            return '( ' + subject.join(' ') + ' )';
        }

        // TODO: pretty string
        var strings = [];
        for (var key in subject)
        {
            //strings.push(key + ' ' + toString(subject[key], null));
            for (var j = 0; j < subject[key].length; ++j)
                strings.push(key + ' ' + toString(subject[key][j], null) );
        }

        var output = strings.join('; ');
        if (uri)
            output = uri + ' ' + output + '.';
        else
            output = '[ ' + output + ' ]';

        return output;
    }
};

RDF_JSONConverter.prototype._removeFromStoreGeneric = function (store, subject, predicate, object, graph)
{
    var matches = store.find(subject, predicate, object, graph);
    for (var i = 0; i < matches.length; ++i)
        store.removeTriple(matches[i]);
};

RDF_JSONConverter.prototype.RDFtoJSON = function (store, root)
{
    return this._RDFtoJSONrecursive(store, root);
};

RDF_JSONConverter.prototype._RDFtoJSONrecursive = function (store, root, graph)
{
    if (N3.Util.isLiteral(root))
        return this.convertElement(root, true);

    var self = this;
    var arrayCheck = store.find(root, 'rdf:first', null, graph);
    if (arrayCheck.length > 0)
        return this._traverseArray(store, root).map(function (element) { return self._RDFtoJSONrecursive(store, element, graph); });

    var result = {};
    var matches = store.find(root, null, null, graph);
    for (var i = 0; i < matches.length; ++i)
    {
        var key = this.convertElement(matches[i].predicate, true);
        if (key === 'TODO') // TODO: should not be necessary
            return '';
        var object = matches[i].object;
        result[key] = self._RDFtoJSONrecursive(store, object, graph);
        if (key === 'tolerances' && _.isArray(result[key]) && result[key].length === 2 && _.isArray(result[key][0])) // TODO: should definitely also not be necessary
            result[key] = [{min: result[key][0][0], max: result[key][0][1]}, {min: result[key][1][0], max: result[key][1][1]}];
    }

    var graphEntries = store.find(null, null, null, root);
    // TODO: how to visualize subgraph stuff? not really correct for now but maybe enough? assume no matches yet
    // TODO: assume single subject ...
    if (graphEntries.length > 0)
    {
        result = this._RDFtoJSONrecursive(store, graphEntries[0].subject, graphEntries[0].graph);
        result['rdf:subject'] = this.convertElement(graphEntries[0].subject, true);
    }

    // simple URI without db entries
    if (Object.keys(result).length === 0)
        return this.convertElement(root, true);

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

RDF_JSONConverter.prototype.convertElement = function (element, simplifyBase)
{
    if (N3.Util.isIRI(element))
    {
        for (prefix in this.prefixes)
        {
            if (element.indexOf(this.prefixes[prefix]) === 0)
            {
                element = element.substring(this.prefixes[prefix].length);
                if (prefix.length > 0 || !simplifyBase)
                    element = prefix + ':' + element;
            }
        }
    }
    if (N3.Util.isLiteral(element))
    {
        // TODO: better way to compare datatype uri
        if (N3.Util.getLiteralType(element) === '<http://www.w3.org/2001/XMLSchema#integer>' || N3.Util.getLiteralType(element) === '<http://www.w3.org/2001/XMLSchema#decimal>')
            return parseFloat(N3.Util.getLiteralValue(element));
        return N3.Util.getLiteralValue(element);
    }
    return element;
};

module.exports = RDF_JSONConverter;
