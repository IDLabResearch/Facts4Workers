
var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var _ = require('lodash');
var RESTdesc = require('restdesc').RESTdesc;
var serveIndex = require('serve-index');
var fs = require('fs');
var stream = require('logrotate-stream');

var args = require('minimist')(process.argv.slice(2));
if (args.h || args.help || args._.length > 0 || !_.isEmpty(_.omit(args, ['_', 'p', 'r', 'unsafe'])))
{
    console.error('usage: node demo.js [-p port] [-r redis_url] [--unsafe] [--help]');
    return process.exit((args.h || args.help) ? 0 : 1);
}
var port = args.p || 3000;

// this is obviously not a really good idea
if (args.unsafe)
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

var cacheURL = args.r || 'redis://localhost:6379';

var app = express();
app.set('view engine', 'jade');

function relative (relativePath)
{
    return path.join(__dirname, relativePath);
}

// parse JSON configs to N3
try
{
    fs.writeFileSync(relative('n3/imported.n3'), '@prefix : <http://f4w.restdesc.org/imported#> .\n\n');
    var files = fs.readdirSync(relative('n3'));
    for (var i = 0; i < files.length; ++i)
    {
        var fileName = files[i];
        if (fileName.endsWith('.json'))
        {
            var json = JSON.parse(fs.readFileSync(relative('n3/' + fileName)));
            for (var key in json)
            {
                var subject = '<http://f4w.restdesc.org/imported#' + key.replace(/[>\\ ]/g, ' ') +'>';
                fs.appendFileSync(relative('n3/imported.n3'), subject + ' :url ' + '"' + json[key] + '" .\n');
            }
        }
    }
}
catch (e) { console.error(e); }

// CORS
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, Content-Type, Accept");
    next();
});

// provide jquery file that can be used
app.set('views', relative('views'));
app.use('/scripts/jquery.min.js', express.static(relative('node_modules/jquery/dist/jquery.min.js')));

// parse post data
// http://stackoverflow.com/questions/18710225/node-js-get-raw-request-body-using-express
var rawBodySaver = function (req, res, buf, encoding) {
    if (buf && buf.length)
        req.rawBody = buf.toString(encoding || 'utf8');
};
app.use(bodyParser.json({ verify: rawBodySaver }));       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({                           // to support URL-encoded bodies
    verify:rawBodySaver,
    extended: true
}));
app.use(bodyParser.raw({ verify: rawBodySaver, type: '*/*' }));

// TODO: allow logging settings to change
var logStream = stream({ file: './test.log', size: '100k', keep: 3 });
function logResponse(req, res){
    logStream.write('CONNECT: ' + req.connection.remoteAddress + ' ' + (new Date().toLocaleString()) + ' "' + req.method + ' ' + req.url + '" ' + res.statusCode + '\n');
    logStream.write('REQUEST HEADERS: ' + JSON.stringify(req.headers) + '\n');
    logStream.write('REQUEST BODY: ' + req.rawBody + '\n');
    logStream.write('RESPONSE HEADERS: ' + JSON.stringify(res._headers) + '\n');
    logStream.write('RESPONSE BODY: ' + res.rawBody + '\n');
    logStream.write('\n');
}

// store send data in body
app.use(function (req, res, next) {
    var send = res.send;
    res.send = function (string) {
        var body = string instanceof Buffer ? string.toString() : string;
        res.rawBody = body;
        app.DEBUG_DATA = body;
        send.call(this, body);
        logResponse(req, res);
    };
    next();
});

// only accept these content types (http://stackoverflow.com/questions/23190659/expressjs-limit-acceptable-content-types)
var RE_CONTYPE = /^application\/(?:x-www-form-urlencoded|json)(?:[\s;]|$)/i;
app.use(function(req, res, next) {
    if (req.method === 'POST' && !RE_CONTYPE.test(req.headers['content-type']))
        return res.status(406).send('Only accepting JSON and URL-encoded bodies.');
    next();
});

// allow acces to documentation pdf
app.use('/demo/documentation', express.static(relative('documentation')));

// create index page of all our n3 files
app.use('/demo/n3', express.static(relative('n3'))); // allow access to the N3 files
app.use('/demo/n3', serveIndex(relative('n3'), {icons: true, view: 'details'})); // allow access to the N3 folders

// TODO: more generic way to load all files?
var rulePaths = [
    'n3/util.n3',
    'n3/imported.n3',
    //'n3/calibration/api1.n3',
    //'n3/calibration/api2.n3',
    //'n3/calibration/extra-rules.n3',
    //'n3/thermolympics_operator/api.n3',
    //'n3/thermolympics_teamleader/api.n3',
    //'n3/thermolympics_teamleader/extra-rules.n3',
    'n3/authorization/api.n3',
    'n3/thermolympic/api.n3',
    'n3/thermolympics_operator_new/api.n3',
    'n3/thermolympics_teamleader_new/api.n3',
    'n3/HIR_offset/api.n3',
    'n3/HIR_offset_golden/api.n3'
];

var input = rulePaths.map(relative);

var goals = {
    //'calibration': relative('n3/calibration/goal.n3'),
    //'thermolympics_operator': relative('n3/thermolympics_operator/goal.n3'),
    //'therolympics_teamleader': relative('n3/thermolympics_teamleader/goal.n3'),
    thermolympics_operator_new: relative('n3/thermolympics_operator_new/goal.n3'),
    thermolympics_teamleader_new: relative('n3/thermolympics_teamleader_new/goal.n3'),
    hir_offset: relative('n3/HIR_offset/goal.n3'),
    hir_offset_golden: relative('n3/HIR_offset_golden/goal.n3')
};

app.get('/', function (req, res)
{
    res.render('goals');
});

app.post('/clear', function (req, res)
{
    if (!req.body || !req.body.data)
        return res.status(400).json({ error: 'Expected a JSON object with a "data" field.'});
    var rest = new RESTdesc(cacheURL, null, null, req.body.data);
    rest.clear(function ()
    {
        res.sendStatus(200);
    });
});

app.post('/back', function (req, res)
{
    if (!req.body || !req.body.data)
        return res.status(400).json({ error: 'Expected a JSON object with a "data" field.'});
    var rest = new RESTdesc(cacheURL, null, null, req.body.data);
    rest.back(function ()
    {
        res.sendStatus(200);
    });
});

app.get('/demo', function (req, res)
{
    res.render('index', { title: 'F4W demo', message: 'F4W demo', goal: req.query.goal || 'calibration'});
});

// CALIBRATION
app.get('/demo/start', function (req, res)
{
    res.render('start');
});
app.get('/demo/doMeasurement', function (req, res)
{
    var params = JSON.parse(req.query.body).suggested_parameters;
    res.render('doMeasurement', {params: params});
});

// THERMOLYMPICS_OPERATOR
app.get('/demo/getPartID', function (req, res)
{
    res.render('start'); // re-use
});
app.get('/demo/getReport', function (req, res)
{
    res.render('getReport');
});

// THERMOLYMPICS_TEAMLEADER
app.get('/demo/getDefect', function (req, res)
{
    res.render('getDefect');
});
app.get('/demo/getSolution', function (req, res)
{
    res.render('getSolution');
});

app.post('/eye', function (req, res)
{
    var input = req.body.input || "";
    var goal = req.body.goal || "";
    var rest = new RESTdesc(cacheURL, input, goal);
    handleNext(rest, req, res);
});

app.post('/debug', function (req, res)
{
    if (_.isString(app.DEBUG_DATA))
        app.DEBUG_DATA = JSON.parse(app.DEBUG_DATA);

    var body = req.body;
    if (body.reset)
    {
        if (app.DEBUG_DATA)
            new RESTdesc(null, null, null, app.DEBUG_DATA.data).clear();
        app.DEBUG_DATA = undefined;
    }

    req.body.eye = app.DEBUG_DATA;

    next(req, res);
});

function errorToJSON (error)
{
    //return _.pick(error, Object.getOwnPropertyNames(error));
    return error.message;
}

app.post('/next', next);
function next (req, res)
{
    if (!req.body || !req.body.goal)
        return res.status(400).json({ error: 'Expected an input body containing at least the goal.'});

    var goal = goals[req.body.goal.toLowerCase()];
    if (!goal)
        return res.status(400).json({ error: 'Unknown goal ' + req.body.goal });

    var cacheKey = null;
    if (req.body.eye)
        cacheKey = req.body.eye.data;

    try
    {
        var rest = new RESTdesc(cacheURL, input, goal, cacheKey);
        rest.handleUserResponse(
            req.body.json,
            req.body.eye,
            function (error)
            {
                if (error)
                    res.status(400).json({ error: errorToJSON(error) });
                else
                    handleNext(rest, req, res);
            }
        );
    }
    catch (e)
    {
        // shit happens
        return res.status(500).json({ error: errorToJSON(e) });
    }
}

function handleNext (rest, req, res)
{
    rest.next(function (error, data)
    {
        if (error)
            return res.status(500).json({ error: errorToJSON(error) });

        var url = data['http:requestURI'];
        var body = data['http:body'];

        // give cacheKey to user so they can send it back in the next step
        data.data = rest.cacheKey;

        if (data.status === 'DONE')
            res.format({json:function () { res.send(data); }});
        else if (url.indexOf('http://askTheWorker/') >= 0)
        {
            // remove pre part of URI
            data['http:requestURI'] = url.substring('http://askTheWorker/'.length);

            // send data to client
            res.format({ json:function () { res.send(data); } });
        }
        else
        {
            res.status(500).json({ error: "This shouldn't happen."});
        }
    });
}

// TODO: semantic search stuff, totally should clean up
try
{
    var SemanticSearch = require('semantic-search');
    var normalSearch = new SemanticSearch('http://localhost:9200', 'defect');
    var synonymSearch = new SemanticSearch('http://localhost:9200', 'defect_synonyms');
    var entries = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    update_index(normalSearch, false, function ()
    {
        // need empty function to prevent error when connection is refused
    });
    update_index(synonymSearch, true, function ()
    {
        // need empty function to prevent error when connection is refused
    });
}
catch (e)
{
    // if elasticsearch isn't running
    console.error(e);
}

function update_index (search, synonyms, callback)
{
    search.delete_index(function ()
    {
        if (synonyms)
            search.setup_index_synonyms(bulk_add);
        else
            search.setup_index(bulk_add);
    });

    function bulk_add()
    {
        search.bulk_add(entries, function ()
        {
            search.flush(callback);
        });
    }
}

app.post('/semantic-search', function (req, res)
{
    var fields = req.body.fields || ['name', 'desc', 'comment'];
    // var weights = req.body.weights || [1, 1, 1];
    var doc = req.body.doc;
    var synonyms = req.body.synonyms;
    if (!doc)
        res.status(400).json({ error: "Input doc required. (Format is { 'doc': { 'name': ...}, 'fields': ['name', 'desc'], 'weights': [2, 1], 'synonyms': false}) "});
    var search = synonyms ? synonymSearch : normalSearch;
    //search.more_like_this_extended(doc, fields, weights, function (error, response, body)
    search.more_like_this_doc(doc, function (error, response, body)
    {
        if (error)
            res.status(500).json(error);
        else if (body.hits)
            res.json(body.hits.hits);
        else
            res.json(body);
    });
});
app.get('/semantic-search-demo', function (req, res)
{
    res.render('semantic-search', {entries: entries, fields: ['name', 'desc', 'comment']});
});
app.get('/semantic-search-demo/entries', function (req, res)
{
    res.json(entries);
});

app.listen(port);