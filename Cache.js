/**
 * Created by joachimvh on 6/07/2015.
 */

var redis = require("redis");

var EXPIRATION = 24 * 60 * 60; // seconds

// TODO: fallback if there is no running redis instance? (for debugging?)
// TODO: use hash containing jsonld and link to list? (would make the whole skolemization thingy more consistent also)
// TODO: even better: simply store the JSONLD instead of the N3!

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
    return false;
};

Cache.prototype.close = function (callback)
{
    if (this.client)
    {
        this.client.quit(callback);
        this.client = null;
    }
};

// handles the open/close for a single call if the connection doesn't need to be kept open
Cache.prototype._handleCall = function (/*f, args*/)
{
    var close = this.open();

    var f = arguments[0];
    this.client[f].apply(this.client, Array.prototype.slice.call(arguments, 1));

    if (close)
        this.close();
};

Cache.prototype.clear = function ()
{
    this._handleCall('del', this.key);
};

Cache.prototype.push = function (val, callback)
{
    var close = this.open();
    this._handleCall('lpush', this.key, val);
    this._handleCall('expire', this.key, EXPIRATION, callback); // reset expiration value if new data is added
    if (close)
        this.close();
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