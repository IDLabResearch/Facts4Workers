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
var ValidCall = require('./ValidCall');

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

    this.calls = [];
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
RESTdesc.prototype.fillInBlanks = function (response, json, callback)
{
    // TODO: should delete this function eventually
    this.cache.open();
    this.cache.pop(function (err, val)
    {
        if (!val)
            return this.cache.close(callback); // no data (yet)
        var parser = new N3Parser(val);
        var jsonld = parser.parse(val);
        var call = new ValidCall(jsonld, this.prefix);
        call.handleResponse(response);
        this.cache.push(
            call.asN3(),
            // it's really important to execute the callback after the push is finished or there is a race condition
            function () { this.cache.close(callback); }.bind(this)
        );
    }.bind(this));
};

RESTdesc.prototype.next = function (callback)
{
    if (this.calls.length > 0)
        return callback(this.calls.splice(0, 1)[0]);

    this.cache.list(function (err, data)
    {
        // TODO: how big of a performance hit is it to always convert the jsonld?
        //var parser = new JSONLDParser();
        //data = data.map(function (str) { return parser.parse(JSON.parse(str), this.prefix); }.bind(this));
        // create new eye handler every time so we know when to call destroy function
        this.eye = new EYEHandler();
        this.eye.call(this.dataPaths, data, this.goalPath, true, true, function (proof) { this._handleProof(proof, callback); }.bind(this), this._error);
    }.bind(this));
};

RESTdesc.prototype._handleProof = function (proof, callback)
{
    // TODO: singleAnswer true to prevent problems atm, should be changed for parallelization
    this.eye.call([this.list], [proof], this.findPath, false, false, function (body) { this._handleNext(body, callback); }.bind(this), this._error);
};

RESTdesc.prototype._handleNext = function (next, callback)
{
    var n3Parser = new N3Parser();
    var jsonld = n3Parser.parse(next);
    // TODO: validCall might be in its own ontology eventually
    var calls;
    if (jsonld[this.prefix + 'validCall'])
        calls = [jsonld[this.prefix + 'validCall']];
    else
        calls = _.map(jsonld['@graph'], function (validCall) { return validCall[this.prefix + 'validCall']; }.bind(this));
    calls = _.map(calls, function (call) { call['@context'] = jsonld['@context']; return new ValidCall(call, this.prefix); }.bind(this));

    if (calls.length === 0)
        return callback({ status: 'DONE' });

    // TODO: what if there are multiple askTheWorker calls, or mixed in with other calls? (that one's easier) (best would be to call normal APIs while waiting for user, can be dangerous)

    if (calls.length === 1 && _.startsWith(calls[0].getURL(), 'http://askTheWorker/'))
    {
        this.cache.push(calls[0].asN3());
        return callback(calls[0].asJSON());
    }

    var delay = _.after(calls.length, function ()
    {
        this.next(callback);
    }.bind(this));

    var cache = this.cache;
    for (var i = 0; i < calls.length; ++i)
    {
        var call = calls[i];
        call.call(function (response)
        {
            this.handleResponse(response);
            cache.push(this.asN3(), delay);
        }.bind(call));
    }

    // this.cache.push(JSON.stringify(step.jsonld), function () { callback(json); });
};

RESTdesc.prototype._error = function (error, content)
{
    console.error(error);
};

module.exports = RESTdesc;

//var jsonld = {"@context":{"log":"http://www.w3.org/2000/10/swap/log#","rdf":"http://www.w3.org/1999/02/22-rdf-syntax-ns#","rdfs":"http://www.w3.org/2000/01/rdf-schema#","owl":"http://www.w3.org/2002/07/owl#","list":"http://www.w3.org/2000/10/swap/list#","e":"http://eulersharp.sourceforge.net/2003/03swap/log-rules#","r":"http://www.w3.org/2000/10/swap/reason#","tmpl":"http://purl.org/restdesc/http-template#","http":"http://www.w3.org/2011/http#","out":"http://f4w.restdesc.org/demo/.well-known/genid/f3ed8675-47ce-42f1-ac89-9082b146b6db#","math":"http://www.w3.org/2000/10/swap/math#","string":"http://www.w3.org/2000/10/swap/string#"},"@graph":[{"@id":"_:sk84_1","http:methodName":"GET","tmpl:requestURI":{"@list":["http://mstate.tho.f4w.l0g.in/api/machines/",1,"/last_event"]},"http:resp":{"@id":"_:sk85_1","http:body":{"@id":"_:sk86_1","http://f4w.restdesc.org/demo#contains":{"@graph":[{"@id":"_:sk87_1","http://f4w.restdesc.org/demo#id":{"@id":"_:sk88_1"},"http://f4w.restdesc.org/demo#optional":{"@id":"_:sk89_1"}}]}}}},{"@id":"http://f4w.restdesc.org/demo#2a915060-abb7-48bc-86d7-425611f98a31","http://f4w.restdesc.org/demo#event":{"@id":"_:sk90_1","http://f4w.restdesc.org/demo#id":{"@id":"_:sk88_1"},"http://f4w.restdesc.org/demo#optional":{"@id":"_:sk89_1"}}}]};
//var rest = new RESTdesc(null, null, 0);
//var result = rest._replaceJSONLDblanks(jsonld, { '_:sk88_1': 178, '_:sk89_1': null });
//console.log(JSON.stringify(result, null, 2));
//var parser = new JSONLDParser(2);
//var n3 = parser.parse(result, rest.prefix);
//console.log(n3);