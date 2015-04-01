/**
 * Created by joachimvh on 1/04/2015.
 */

var N3 = require('N3');
var request = require('request');

function EYEHandler (serverURL)
{
    this.serverURL = serverURL || 'http://eye.restdesc.org/'
}

EYEHandler.prototype.call = function (data, query, proof, callback, errorCallback)
{
    var self = this;
    request(
        {
            url: this.serverURL,
            method: 'POST',
            qs: {nope: !proof, quickAnswer:true}, // TODO: probably not always quickAnswer (single-answer?)
            form: { data: data, query: query}
        },
        function (error, response, body)
        {
            if (!error && response.statusCode == 200)
                callback(body);
            else
                errorCallback && errorCallback(error, response);
        }
    );
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
            triples.push(triple);
        else
            callback(triples, prefixes);
        if (error) console.error(error);
    });
};

module.exports = EYEHandler;