/**
 * Created by joachimvh on 1/04/2015.
 */

var N3 = require('n3');
var request = require('request');

// TODO: use direct EYE call instead of HTTP interface
function EYEHandler (serverURL)
{
    this.serverURL = serverURL || 'http://eye.restdesc.org/'
}

// TODO: better way of passing all these parameters
EYEHandler.prototype.call = function (data, query, proof, quickAnswer, newTriples, callback, errorCallback)
{
    var form = { data : data};
    if (!newTriples)
        form['query'] = query;

    quickAnswer = quickAnswer && !newTriples;

    request(
        {
            url: this.serverURL,
            method: 'POST',
            qs: {nope: !proof, quickAnswer: quickAnswer, 'pass': newTriples}, // TODO: probably not always quickAnswer (single-answer?)
            form: form
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
