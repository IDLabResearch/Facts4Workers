/**
 * Created by joachimvh on 1/04/2015.
 */

var spawn = require('child_process').spawn;
var ResourceCache = require('resourcecache');
var _ = require('lodash');

function EYEHandler () {}

// TODO: a lot of these files can be loaded from disk instead of generating temp files every time
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
        args.push('--no-qvars');

        args.push('--no-skolem');
        args.push('http://f4w.restdesc.org/demo/.well-known/genid/');

        // blame windows npm implementation
        // http://stackoverflow.com/questions/17516772/using-nodejss-spawn-causes-unknown-option-and-error-spawn-enoent-err
        var proc = spawn(process.platform === "win32" ? "eye.cmd" : "eye", args);
        var output = "";
        proc.stdout.on('data', function (data) {
            output += data.toString();
            //console.log(data.toString());
        });
        proc.stderr.on('data', function (data) {
            //console.error(data.toString());
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
