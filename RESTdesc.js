/**
 * Created by joachimvh on 1/04/2015.
 */

var _ = require('lodash');
var EYEHandler = require('./EYEHandler');
var uuid = require('node-uuid');
var Cache = require('./Cache');
var path = require('path');
var ValidCallGenerator = require('./ValidCallGenerator');

RESTdesc.instances = {};

function RESTdesc (dataPaths, goalPath, cacheKey)
{
    this.dataPaths = dataPaths;
    this.goalPath = goalPath;
    this.cacheKey = cacheKey || uuid.v4();
    this.queueKey = this.cacheKey + '_queue';

    // TODO: might be a problem if we have multiple servers but that's a problem for later
    if (RESTdesc.instances[this.cacheKey])
    {
        var restdesc = RESTdesc.instances[this.cacheKey];
        restdesc.dataPaths = dataPaths;
        restdesc.goalPath = goalPath;
        return restdesc;
    }

    RESTdesc.instances[this.cacheKey] = this;
    this.cache = new Cache(this.cacheKey);

    if (!_.isArray(this.dataPaths))
        this.dataPaths = [this.dataPaths];

    this.list = path.join(__dirname, 'n3/list.n3');
    this.findPath = path.join(__dirname, 'n3/find_executable_calls.n3');

    this.eye = null;

    this.running = false;
    this.callback = undefined;
}

RESTdesc.prototype.clear = function (callback)
{
    // TODO: clear single IDs
    // TODO: prettify list of commands like this
    this.cache.open(function ()
    {
        this.cache.clear(this.cacheKey, function ()
        {
            this.cache.clear(this.queueKey, function ()
            {
                this.cache.close(callback);
            }.bind(this))
        }.bind(this))
    }.bind(this));
};

// TODO: probably should also clear queue here
RESTdesc.prototype.back = function (callback, _recursive)
{
    // remove items from the cache until it is empty or we find the previous askTheWorker call
    // the last item is the 'current' askTheWorker call, so that one always needs to be popped before we can go searching
    if (!_recursive)
        this.cache.open();

    this.cache.pop(this.cacheKey, function (err, val)
    {
        // if val is null the list is empty
        if (!val || _.includes(val, 'askTheWorker'))
            return this.cache.close(callback);

        this.back(callback, true);
    }.bind(this));
};

RESTdesc.prototype.handleUserResponse = function (response, json, callback)
{
    if (json === undefined || !json.callID)
        return callback();

    this.cache.open();
    this.cache.popSingle(json.callID, function (err, val) {
        // TODO: fixed problem but not completely correct...
        if (!val)
            // return this.cache.close(function () { callback(new Error('Unable to find callID ' + json.callID)); });
            return callback();
        var call = ValidCallGenerator.N3ToValidCall(val);
        var error = undefined;
        try { call.handleResponse(response); }
        catch (e) { error = e; }
        this.cache.push(
            this.cacheKey,
            call.toN3(),
            // it's really important to execute the callback after the push is finished or there is a race condition
            function () { this.cache.close(function () { callback(error); }); }.bind(this)
        );
    }.bind(this));
};

RESTdesc.prototype.next = function (callback)
{
    this.cache.queueLength(this.queueKey, function (err, length)
    {
        if (length > 0)
        {
            if (this.callback) // maybe the callback already got a response earlier and doesn't need another one
            {
                // put this outside of popQueue to prevent race condition
                callback = this.callback;
                this.callback = undefined;
                this.cache.popQueue(this.queueKey, function (err, val)
                {
                    var call = ValidCallGenerator.N3ToValidCall(val);
                    var json = call.toJSON();
                    json.callID = uuid.v4();
                    this.cache.setSingle(json.callID, call.toN3(), function () { callback(null, json); }.bind(this));
                }.bind(this));
            }
            // else: just an API ending
        }
        else
        {
            if (callback)
                this.callback = callback;
            if (!this.running && this.callback)
            {
                this.running = true;
                this.cache.list(this.cacheKey, function (err, data)
                {
                    this.eye = new EYEHandler();
                    this.eye.call(this.dataPaths, data, this.goalPath, true, true, function (error, proof) { if (error) this._stop(); else this._handleProof(proof); }.bind(this));
                }.bind(this));
            }
            else if (!this.running)
                delete RESTdesc.instances[this.cacheKey];
        }
    }.bind(this));
};

RESTdesc.prototype._handleProof = function (proof)
{
    this.eye.call([this.list], [proof], this.findPath, false, false, function (error, body) { if (error) this._stop(); else this._handleNext(body); }.bind(this));
};

RESTdesc.prototype._handleNext = function (next)
{
    var calls = [];
    try { calls = ValidCallGenerator.N3toValidCalls(next); }
    catch (error) { return this._stop(error); }

    if (calls.length === 0)
        return this._stop(null, { status: 'DONE' });

    calls = _.groupBy(calls, function (call)
    {
        if (_.startsWith(call.getURL(), 'http://askTheWorker/'))
            return 'user';
        return 'api';
    });

    calls.user = calls.user || [];
    calls.api = calls.api || [];

    // TODO: can't do this, not stateless...
    if (calls.user.length > 0)
        this.cache.addToQueue(this.queueKey, _.invokeMap(calls.user, 'toN3'), function () { this.next(); }.bind(this));

    this.running = calls.api.length > 0;

    var delay = _.after(calls.api.length, function () { this.running = false; this.next(); }.bind(this));

    // TODO: one of the API responses might already lead to a user request...
    var self = this;
    for (var i = 0; i < calls.api.length; ++i)
    {
        var call = calls.api[i];
        call.call(function (error, response)
        {
            try { this.handleResponse(response); } // 'this' references call now
            catch (e) { error = e; }
            if (error)
                return self._stop(error);

            self.cache.push(self.cacheKey, this.toN3(), delay);
        }.bind(call));
    }
};

RESTdesc.prototype._stop = function (error, response)
{
    this.running = false;
    var callback = this.callback;
    this.callback = undefined;
    if (callback)
        callback(error, response);
};

module.exports = RESTdesc;