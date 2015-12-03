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

RESTdesc.prototype.handleUserResponse = function (response, json, callback)
{
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
        this.eye = new EYEHandler();
        this.eye.call(this.dataPaths, data, this.goalPath, true, true, function (proof) { this._handleProof(proof, callback); }.bind(this), this._error);
    }.bind(this));
};

RESTdesc.prototype._handleProof = function (proof, callback)
{
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
};

RESTdesc.prototype._error = function (error, content)
{
    console.error(error);
};

module.exports = RESTdesc;