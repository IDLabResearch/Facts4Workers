/**
 * Created by joachimvh on 1/04/2015.
 */

var spawn = require('child_process').spawn;
var ResourceCache = require('resourcecache');
var _ = require('lodash');

function EYEHandler () {}

// TODO: better way of passing all these parameters?
EYEHandler.prototype.call = function (data, query, proof, singleAnswer, newTriples, callback, errorCallback)
{
    var cache = new ResourceCache();
    var fileNames = [];
    var args = [];
    var queryName = null;
    var delayed = _.after(data.length + 1, function ()
    {
        args.push('--query');
        args.push(queryName);
        if (singleAnswer)
        {
            args.push('--tactic');
            args.push('single-answer');
        }

        if (!proof)
            args.push('--nope');

        // blame windows npm implementation
        // http://stackoverflow.com/questions/17516772/using-nodejss-spawn-causes-unknown-option-and-error-spawn-enoent-err
        var proc = spawn(process.platform === "win32" ? "eye.cmd" : "eye", args);
        var output = "";
        proc.stdout.on('data', function (data) {
            output += data;
        });
        proc.stderr.on('data', function (data) {
            // TODO: do we need to log this somewhere?
        });
        proc.on('close', function (code) {
            // TODO: check exit code?
            // already gets unlinked in destroy step
            //for (var i = 0; i < fileNames.length; ++i)
            //    self.cache.release(fileNames[i]);
            cache.destroy();
            callback(output);
        });
    });

    // TODO: error handling
    for (var i = 0; i < data.length; ++i){
        cache.cacheFromString(data[i], function (error, fileName)
        {
            args.push(fileName);
            fileNames.push(fileName);
            delayed();
        });
    }
    cache.cacheFromString(query, function (error, fileName)
    {
        queryName = fileName;
        fileNames.push(fileName);
        delayed();
    });
};

module.exports = EYEHandler;
