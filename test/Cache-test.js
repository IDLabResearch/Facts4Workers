/**
 * Created by joachimvh on 16/12/2015.
 */

var assert = require('assert');
var Cache = require('../Cache');

describe('cache', function ()
{
    var cache = new Cache('CACHETESTKEY');

    before(function (done) { cache.clear(done); });

    it('can add and remove items', function (done)
    {
        cache.push('a', function ()
        {
            cache.push('b', function ()
            {
                cache.list(function (error, list)
                {
                    assert.deepEqual(list, ['b', 'a']);
                    cache.pop(function (error, item)
                    {
                        assert.strictEqual(item, 'b');
                        cache.pop(function (error, item)
                        {
                            assert.strictEqual(item, 'a');
                            done();
                        });
                    });
                })
            });
        });
    });

    it('can add and remove items while manually opening and closing the connection', function (done)
    {
        var open = cache.open;
        cache.open(function ()
        {
            // update the function to make sure it never gets called again during this process
            cache.open = function(callback) {
                if (open.call(cache, callback))
                    throw new Error("Open function shouldn't be called again during a manual process.");
            };
            cache.push('a', function ()
            {
                cache.push('b', function ()
                {
                    cache.list(function (error, list)
                    {
                        assert.deepEqual(list, ['b', 'a']);
                        cache.pop(function (error, item)
                        {
                            assert.strictEqual(item, 'b');
                            cache.pop(function (error, item)
                            {
                                assert.strictEqual(item, 'a');
                                cache.open = open;
                                cache.close(done);
                            });
                        });
                    })
                });
            });
        });
    });

    after(function (done) { cache.clear(done); });
});