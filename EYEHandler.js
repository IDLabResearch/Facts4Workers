/**
 * Created by joachimvh on 1/04/2015.
 */

var N3 = require('n3');
var request = require('request');
var spawn = require('child_process').spawn;
var ResourceCache = require('resourcecache');
var _ = require('lodash');

function EYEHandler ()
{
    this.cache = new ResourceCache();
}

EYEHandler.prototype.destroy = function ()
{
    this.cache.destroy();
};

// TODO: better way of passing all these parameters?
EYEHandler.prototype.call = function (data, query, proof, singleAnswer, newTriples, callback, errorCallback)
{
    var fileNames = [];
    var args = [];
    var queryName = null;
    var self = this;
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
            for (var i = 0; i < fileNames.length; ++i)
                self.cache.release(fileNames[i]);
            callback(output);
        });
    });

    // TODO: error handling
    for (var i = 0; i < data.length; ++i){
        this.cache.cacheFromString(data[i], function (error, fileName)
        {
            args.push(fileName);
            fileNames.push(fileName);
            delayed();
        });
    }
    this.cache.cacheFromString(query, function (error, fileName)
    {
        queryName = fileName;
        fileNames.push(fileName);
        delayed();
    });
};

// N3 to TriG
EYEHandler.prototype.parseBody = function (body, callback)
{
    //var graphidx = 1;
    //var splits = body.split('\n');
    //var idx = 0;
    //var newSplits = [];
    //while (idx < splits.length)
    //{
    //    var split = splits[idx];
    //    // TODO: \{
    //    if (split.indexOf('{') >= 0)
    //    {
    //        while (split.indexOf('}') < 0 && idx < splits.length)
    //        {
    //            ++idx;
    //            split += splits[idx];
    //        }
    //
    //        var pos = split.indexOf('{');
    //        var graph = ':graph' + graphidx++;
    //        // TODO: -1: remove final dot
    //        split = split.substring(0, pos) + ' ' + graph + '. \n' + 'GRAPH ' + graph + ' ' + split.substring(pos, split.length-1);
    //    }
    //    newSplits.push(split);
    //    ++idx;
    //}
    //body = newSplits.join('\n');

    var parser = N3.Parser();
    var triples = [];
    parser.parse(body, function (error, triple, prefixes)
    {
        if (triple)
        {
            // TODO: fix for N3 parser removing quote escapes
            // TODO: is wrong with language tags
            if (triple.object[0] === '"')
            {
                var last = triple.object.lastIndexOf('"');
                triple.object = '"' + triple.object.substring(1, last).replace(/"/g, '\\"') + triple.object.substring(last);
            }

            // TODO: another hotfix, should be removed when we switch parser/writer to an extension of N3.js
            if (N3.Util.isLiteral(triple.object) && N3.Util.getLiteralType(triple.object) === 'http://www.w3.org/2001/XMLSchema#integer')
                triple.object = '"' + N3.Util.getLiteralValue(triple.object) + '"' + '^^<http://www.w3.org/2001/XMLSchema#integer>';
            if (N3.Util.isLiteral(triple.object) && N3.Util.getLiteralType(triple.object) === 'http://www.w3.org/2001/XMLSchema#decimal')
                triple.object = '"' + N3.Util.getLiteralValue(triple.object) + '"' + '^^<http://www.w3.org/2001/XMLSchema#decimal>';
            triples.push(triple);
        }
        else
            callback(triples, prefixes);
        if (error) console.error(error);
    });
};

module.exports = EYEHandler;
