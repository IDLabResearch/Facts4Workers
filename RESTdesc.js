/**
 * Created by joachimvh on 1/04/2015.
 */

var _ = require('lodash');
var EYEHandler = require('./EYEHandler');
var uuid = require('node-uuid');
var Cache = require('./Cache');
var path = require('path');
var ValidCallGenerator = require('./ValidCallGenerator');

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
    this.baseURI = 'http://f4w.restdesc.org/demo#';

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
    if (json === undefined)
        return callback();

    this.cache.open();
    this.cache.pop(function (err, val)
    {
        if (!val)
            return this.cache.close(callback); // no data (yet)
        var call = ValidCallGenerator.N3ToValidCall(val, this.baseURI);
        call.handleResponse(response);
        this.cache.push(
            call.toN3(),
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
    var calls = ValidCallGenerator.N3toValidCalls(next, this.baseURI);

    if (calls.length === 0)
        return callback({ status: 'DONE' });

    // TODO: what if there are multiple askTheWorker calls, or mixed in with other calls? (that one's easier)
    // TODO: (best would be to call normal APIs while waiting for user, can be dangerous)
    // TODO: just send the entire N3 string to the user instead?

    calls = _.groupBy(calls, function (call)
    {
        if (_.startsWith(call.getURL(), 'http://askTheWorker/'))
            return 'user';
        return 'api';
    });

    calls.user = calls.user || [];
    calls.api = calls.api || [];

    if (calls.user.length > 1)
        throw 'Multiple parallel user calls not supported yet.';

    if (calls.user.length > 0 && calls.api.length === 0)
    {
        this.cache.push(calls.user[0].toN3());
        return callback(calls.user[0].toJSON());
    }

    var delay = _.after(calls.api.length, function ()
    {
        if (calls.user.length > 0)
        {
            this.cache.push(calls.user[0].toN3());
            callback(calls.user[0].toJSON());
        }
        else
            this.next(callback);
    }.bind(this));

    var cache = this.cache;
    for (var i = 0; i < calls.api.length; ++i)
    {
        var call = calls.api[i];
        call.call(function (response)
        {
            this.handleResponse(response);
            cache.push(this.toN3(), delay);
        }.bind(call));
    }
};

RESTdesc.prototype._error = function (error, content)
{
    console.error(error);
};

module.exports = RESTdesc;