/**
 * Created by joachimvh on 6/07/2015.
 */

var redis = require('redis');
var _ = require('lodash');

var EXPIRATION = 24 * 60 * 60; // seconds

// TODO: fallback if there is no running redis instance? (for debugging?)

function Cache (key)
{
    this.key = key;
}


Cache.prototype.open = function (callback)
{
    if (!this.client)
    {
        this.client = redis.createClient();
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
        function returnArgs () { callback.apply(null, returnVal); }
        close ? this.close(returnArgs) : returnArgs();
    }.bind(this);

    this.client[f].apply(this.client, args);
};

Cache.prototype.clear = function (callback)
{
    this._handleCall('del', this.key, callback);
};

Cache.prototype.push = function (val, callback)
{
    var close = this.open();
    this._handleCall('lpush', this.key, val,
        function ()
        {
            // reset expiration value if new data is added
            this._handleCall('expire', this.key, EXPIRATION,
                function ()
                {
                    close ? this.close(callback) : callback.call();
                }.bind(this));
        }.bind(this));
};

Cache.prototype.pop = function (callback)
{
    this._handleCall('lpop', this.key, callback);
};

// callback: function (error, response)
Cache.prototype.list = function (callback)
{
    this._handleCall('lrange', this.key, 0, -1, callback);
};

module.exports = Cache;