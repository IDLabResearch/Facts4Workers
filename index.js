
var express = require('express');
var request = require('request');
var fs = require('fs');
var n3 = require('n3');
var extend = require('util')._extend;
var _ = require('lodash');

var app = express();
app.set('view engine', 'jade');
app.set('views', process.cwd() + '/views');
app.use('/scripts/jquery.min.js', express.static(process.cwd() + '/node_modules/jquery/dist/jquery.min.js'));
//app.use(express.static(process.cwd() + '/public'));

// content-type application/x-www-form-urlencoded
// http://eye.restdesc.org/?data=http://eulersharp.sourceforge.net/2003/03swap/socrates.n3&query=http://eulersharp.sourceforge.net/2003/03swap/socratesF.n3

var json = {
    "id": 1,
        "operator": "Gianni",
        "part_number": "A123",
        "machine_parameters": [
        1200.2345,
        0.0021,
        13.7,
        270
    ],
        "tolerances": [
        {
            "min": 134.3,
            "max": 134.35
        },
        {
            "min": 0.37,
            "max": 0.4
        }
    ],
        "geometrical_dimension": [
        134.23,
        0.35
    ],
        "result": "recalibrate",
        "suggested_parameters": [
        1200.3295,
        0.0030499999999999885,
        13.735,
        270.00035
    ]
};

var data = '@prefix log: <http://www.w3.org/2000/10/swap/log#>.\n' +
           '@prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.\n' +
           '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.\n' +
           '@prefix : <http://www.agfa.com/w3c/euler/socrates#>.\n' +
           ':Socrates a _:Man.\n' +
           '_:Man rdfs:subClassOf :Mortal.\n' +
           '{?A rdfs:subClassOf ?B. ?S a ?A} => {?S a ?B}.';
var query = '@prefix log: <http://www.w3.org/2000/10/swap/log#>.\n' +
            '@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#>.\n' +
            '@prefix q: <http://www.w3.org/2004/ql#>.\n' +
            '@prefix : <http://www.agfa.com/w3c/euler/socrates#>.\n' +
            '{?WHO a ?WHAT} => {?WHO a ?WHAT}.';

var api = fs.readFileSync('n3/api2.n3');
var calls = fs.readFileSync('n3/calls.n3');
var input = fs.readFileSync('n3/in.n3');
var list = fs.readFileSync('n3/list.n3');

var goal = fs.readFileSync('n3/goal.n3');
var find = fs.readFileSync('n3/find_executable_calls.n3');
var findall = fs.readFileSync('n3/findallcalls.n3');

var proof = fs.readFileSync('n3/proof.n3');

app.get('/', function(req, res)
{
    /*request.post
    (
        'http://eye.restdesc.org/',
        { form: { data: 'http://eulersharp.sourceforge.net/2003/03swap/socrates.n3', query: 'http://eulersharp.sourceforge.net/2003/03swap/socratesF.n3' } },
        function (error, response, body)
        {
            if (!error && response.statusCode == 200)
                console.log(body);
            res.sendfile('views/index.html');
            res.header("Content-Type", "text/plain");
            //res.format
            //({
            //    text:function () { res.send(body); } ,
            //    'default': function() { res.status(406).send('Not Acceptable'); }
            //});
        }
    );*/

    res.render('index', { title: 'Hey', message: 'Hello there!'});
});

app.get('/eye', function (req,res)
{
    callEYE([proof, list], find, false, function (body)
    {
        var parser = n3.Parser();
        //parser.parse(body, function (error, triple, prefixes)
        //{
        //    console.log(triple);
        //    if (error) console.error(error);
        //});
        parseBody(body);
        res.format({ text:function () { res.send(body); } });
    },
    console.log);
});

function callEYE (data, query, proof, callback, errorCallback)
{
    request(
        {
            url: 'http://eye.restdesc.org/',
            method: 'POST',
            qs: {nope: !proof},
            form: { data: data, query: query}
        },
        function (error, response, body)
        {
            if (!error && response.statusCode == 200)
                callback(body);
            else
                errorCallback && errorCallback(error, response);
        }
    );
}

var graphidx = 1;
function parseBody (body)
{
    var splits = body.split('\n');
    var idx = 0;
    var newSplits = [];
    while (idx < splits.length)
    {
        var split = splits[idx];
        // TODO: \{
        if (split.indexOf('{') >= 0)
        {
            while (split.indexOf('}') < 0 && idx < splits.length)
            {
                ++idx;
               split += splits[idx];
            }

            var pos = split.indexOf('{');
            var graph = ':graph' + graphidx++;
            // TODO: -1: remove final dot
            split = split.substring(0, pos) + ' ' + graph + '. \n' + 'GRAPH ' + graph + ' ' + split.substring(pos, split.length-1);
        }
        newSplits.push(split);
        ++idx;
    }
    body = newSplits.join('\n');
    console.log(body);

    var parser = n3.Parser();
    parser.parse(body, function (error, triple, prefixes)
    {
        console.log(triple);
        if (error) console.error(error);
    });
}

function isLiteral (s)
{
    // isArray check because arrays of size 1 are apparently literals...
    //return !isArray(s) && (typeof s === 'string' || s.constructor === String || !isNaN(s));
    return _.isString(s) || _.isNumber(s);
}

function isArray (a)
{
    return _.isArray(a);
}

function cloneAndExtend (obj, extension)
{
    var copy = extend({}, obj);
    return extend(copy, extension);
}

function flatten (arrays)
{
    return [].concat.apply([], arrays);
}

var blankidx = 1;
var prefixes = {'': 'http://best_example_ever#', 'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'};
var prefixFn = _.partialRight(n3.Util.expandPrefixedName, prefixes);
var triples = jsonToTriples(json, prefixFn, prefixFn(':calibration'));
//console.log(triples);
var store = new n3.Store();
store.addPrefixes(prefixes);
store.addTriples(triples);
//store.addTriple({ subject: '_:blank4', predicate: 'rdf:first', object: n3.Util.createLiteral(270.5) });
//console.log(store.find(null, null, null));
var convertFn = _.partialRight(convertElement, prefixes['']);
console.log(triplesToJson(store, ':calibration', convertFn));
function jsonToTriples (json, prefixFn, subject, predicate)
{
    var results = [];
    var partial = {subject: subject, predicate: predicate};
    if (isLiteral(json))
    {
        // TODO: predicate === null error
        return [cloneAndExtend(partial, {object: n3.Util.createLiteral(json)})];
    }
    else if (isArray(json))
    {
        var blankList = '_:blank' + blankidx++;
        if (predicate)
        {
            partial.object = blankList;
            results.push(partial);
        }
        if (json.length <= 1)
            results.push({subject: blankList, predicate: prefixFn('rdf:rest'), object: prefixFn('rdf:nil')});
        if (json.length > 0)
            results.push(jsonToTriples(json.shift(), prefixFn, blankList, prefixFn('rdf:first')));
        // size-1 due to shift ^
        if (json.length > 0)
            results.push(jsonToTriples(json, prefixFn, blankList, prefixFn('rdf:rest')));
        return flatten(results);
    }
    else
    {
        if (predicate)
        {
            subject = '_:blank' + blankidx++;
            partial.object = subject;
            results.push(partial);
        }
        var keys = Object.keys(json);
        return results.concat(flatten(keys.map(function (key)
        {
            return jsonToTriples(json[key], prefixFn, subject, prefixFn(':' + key));
        })));
    }
}

function triplesToJson (store, root, convertFn)
{
    if (n3.Util.isLiteral(root))
        return convertFn(root);

    var arrayCheck = store.find(root, 'rdf:first', null);
    if (arrayCheck.length > 0)
        return traverseArray(store, root).map(function (element) { return triplesToJson(store, element, convertFn); });

    var result = {};
    var matches = store.find(root, null, null);
    for (var i = 0; i < matches.length; ++i)
    {
        var key = convertFn(matches[i].predicate);
        var object = matches[i].object;
        result[key] = triplesToJson(store, object, convertFn);
    }
    return result;
}

function traverseArray (store, root)
{
    var first = store.find(root, 'rdf:first', null)[0].object;
    var rest = store.find(root, 'rdf:rest', null)[0].object;
    var results = [first];
    if (rest !== 'http://www.w3.org/1999/02/22-rdf-syntax-ns#nil')
        results = results.concat(traverseArray(store, rest));
    return results;
}

function convertElement (element, prefix)
{
    if (n3.Util.isIRI(element))
        return element.replace(prefix, '');
    if (n3.Util.isLiteral(element))
        return n3.Util.getLiteralValue(element);
    return element;
}

//app.listen(3000);