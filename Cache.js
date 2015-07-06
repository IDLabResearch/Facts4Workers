/**
 * Created by joachimvh on 6/07/2015.
 */

var redis = require("redis");

var EXPIRATION = 24 * 60 * 60; // seconds

function Cache (key)
{
    this.key = key;
}


Cache.prototype.open = function ()
{
    if (!this.client)
    {
        this.client = redis.createClient();
        // REALLY REALLY IMPORTANT, DO NOT FORGET OR GITLAB GETS DESTROYED
        this.client.select(4);
    }
};

Cache.prototype.close = function ()
{
    if (this.client)
    {
        this.client.quit();
        this.client = null;
    }
};

// handles the open/close for a single call if the connection doesn't need to be kept open
Cache.prototype._handleCall = function (/*f, args*/)
{
    var close = !this.client;
    this.open();

    var f = arguments[0];
    this.client[f].apply(this.client, Array.prototype.slice.call(arguments, 1));

    if (close)
        this.close();
};

Cache.prototype.clear = function ()
{
    this._handleCall('del', this.key);
};

Cache.prototype.add = function (val)
{
    this.open();
    this._handleCall('sadd', this.key, val);
    this._handleCall('expire', this.key, EXPIRATION); // reset expiration value if new data is added
    this.close();
};

// callback: function (error, response)
Cache.prototype.list = function (callback)
{
    this._handleCall('smembers', this.key, callback);
};