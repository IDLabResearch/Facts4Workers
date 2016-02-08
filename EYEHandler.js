/**
 * Created by joachimvh on 1/04/2015.
 */

var spawn = require('child_process').spawn;
var ResourceCache = require('resourcecache');
var _ = require('lodash');

function EYEHandler () {}

// TODO: better way of passing all these parameters?
EYEHandler.prototype.call = function (dataPaths, data, queryPath, proof, singleAnswer, callback)
{
    var cache = new ResourceCache();
    var args = [].concat(dataPaths);
    var execute = function ()
    {
        args.push('--query');
        args.push(queryPath);
        if (singleAnswer)
        {
            args.push('--tactic');
            args.push('single-answer');
            args.push('--tactic');
            args.push('existing-path');
        }

        if (!proof)
            args.push('--nope');
        //args.push('--no-qvars');
        //
        //args.push('--no-skolem');
        //args.push('http://f4w.restdesc.org/demo/.well-known/genid/');

        // blame windows npm implementation
        // http://stackoverflow.com/questions/17516772/using-nodejss-spawn-causes-unknown-option-and-error-spawn-enoent-err
        var proc = spawn(process.platform === "win32" ? "eye.cmd" : "eye", args);
        var output = "";
        var errorOutput = "";
        proc.stdout.on('data', function (data) {
            output += data.toString();
            //console.log(data.toString());
        });
        proc.stderr.on('data', function (data) {
            errorOutput += data;
            //console.error(data.toString());
        });
        proc.on('close', function (code) {
            // TODO: check exit code?
            var error = null;
            if (code !== 0)
                error = new Error('EYE error\n' + errorOutput);
            cache.destroy();
            callback(error, output);
        });
    };

    if (data.length === 0)
        execute();
    else
    {
        // TODO: error handling
        var count = 0;
        var errorObj = null;
        for (var i = 0; i < data.length; ++i)
        {
            cache.cacheFromString(data[i], function (error, fileName)
            {
                if (error)
                    errorObj = error;
                args.push(fileName);
                if (++count >= data.length)
                {
                    if (errorObj)
                    {
                        cache.destroy();
                        callback(errorObj, null);
                    }
                    else
                        execute();
                }
            });
        }
    }
};

module.exports = EYEHandler;
