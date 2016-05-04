/**
 * Created by joachimvh on 6/07/2015.
 */

var redis = require('redis');
var _ = require('lodash');

var EXPIRATION = 24 * 60 * 60; // seconds

// TODO: fallback if there is no running redis instance? (for debugging?)

function Cache (errorFtn)
{
    this.errorFtn = errorFtn;
}

Cache.REDIS_URL = 'redis://localhost:6379';

Cache.prototype.open = function (callback)
{
    if (!this.client)
    {
        console.log(Cache.REDIS_URL);
        this.client = redis.createClient(Cache.REDIS_URL, {connect_timeout: 5000});
        if (this.errorFtn)
            this.client.on('error', this.errorFtn);
        // REALLY REALLY IMPORTANT, DO NOT FORGET OR GITLAB GETS DESTROYED WHEN THIS GETS DEPLOYED ON RESTDESC
        this.client.select(4, callback);
        return true;
    }
    if (callback)
        callback();
    return false;
};

Cache.prototype.close = function (callback)
{
    if (this.client)
    {
        this.client.quit(callback);
        this.client = null;
    }
    else if (callback)
        callback();
};

// handles the open/close for a single call if the connection doesn't need to be kept open
Cache.prototype._handleCall = function (/*f, args*/)
{
    var close = this.open();

    var f = arguments[0];
    var args = Array.prototype.slice.call(arguments, 1);
    var callback = args.length > 0 ? args[args.length-1] : null;

    // update the callback
    if (!callback || !_.isFunction(callback))
        args.push(null);
    args[args.length-1] = function ()
    {
        // necessary since we want the return value of this function, not the close function
        var returnVal = arguments;
        function returnArgs () { if (callback) callback.apply(null, returnVal); }
        close ? this.close(returnArgs) : returnArgs();
    }.bind(this);

    this.client[f].apply(this.client, args);
};

Cache.prototype.clear = function (key, callback)
{
    this._handleCall('del', key, callback);
};

Cache.prototype.push = function (key, val, callback)
{
    var close = this.open();
    var cache = this;
    if (!_.isArray(val))
        val = [val];
    push();
    function push ()
    {
        if (val.length > 0)
            cache._handleCall('lpush', key, val.pop(), push);
        else
            cache._handleCall('expire', key, EXPIRATION, function () { close ? cache.close(callback) : callback.call(); }.bind(this));
    }
};

Cache.prototype.pop = function (key, callback)
{
    this._handleCall('lpop', key, callback);
};

// callback: function (error, response)
Cache.prototype.list = function (key, callback)
{
    this._handleCall('lrange', key, 0, -1, callback);
};

Cache.prototype.length = function (key, callback)
{
    this._handleCall('llen', key, callback);
};

// TODO: should get rid of these when clearing cache...
Cache.prototype.setSingle = function (key, val, callback)
{
    var close = this.open();
    this._handleCall('set', key, val,
        function ()
        {
            // setex is not working? so doing this for now
            this._handleCall('expire', key, EXPIRATION, function () { close ? this.close(callback) : callback.call(); }.bind(this));
        }.bind(this));
};

Cache.prototype.popSingle = function (key, callback)
{
    var close = this.open();
    this._handleCall('get', key,
        function (err, val)
        {
            var callbackVal = function (err) { callback(err, val); };
            this._handleCall('del', key, function () { close ? this.close(callbackVal) : callbackVal(); }.bind(this));
        }.bind(this));
};

module.exports = Cache;