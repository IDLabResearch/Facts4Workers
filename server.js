
var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');
var _ = require('lodash');
var RESTdesc = require('restdesc').RESTdesc;
var serveIndex = require('serve-index');
var fs = require('fs');

var args = require('minimist')(process.argv.slice(2));
if (args.h || args.help || args._.length > 0 || !_.isEmpty(_.omit(args, ['_', 'p', 'r'])))
{
    console.error('usage: node demo.js [-p port] [-r redis_url] [--help]');
    return process.exit((args.h || args.help) ? 0 : 1);
}
var port = args.p || 3000;

var cacheURL = args.r || 'redis://localhost:6379';

var app = express();
app.set('view engine', 'jade');

function relative (relativePath)
{
    return path.join(__dirname, relativePath);
}

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
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({   // to support URL-encoded bodies
    extended: true
}));

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
    'n3/HIR_offset/api.n3'
];

var input = rulePaths.map(relative);

var goals = {
    //'calibration': relative('n3/calibration/goal.n3'),
    //'thermolympics_operator': relative('n3/thermolympics_operator/goal.n3'),
    //'therolympics_teamleader': relative('n3/thermolympics_teamleader/goal.n3'),
    thermolympics_operator_new: relative('n3/thermolympics_operator_new/goal.n3'),
    thermolympics_teamleader_new: relative('n3/thermolympics_teamleader_new/goal.n3'),
    hir_offset: relative('n3/HIR_offset/goal.n3')
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

function handleNext (rest, req, res, count)
{
    count = count || 0;

    // TODO this is simply a check to make sure there is a problem in the demo causing us to accidently DOS an API.
    if (count >= 5)
        return res.format({ json:function () { res.send({status:'Too many automated API calls in a row. Aborting to prevent infinte loop.'}); } });

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
    var semanticsearch = require('semantic-search');
    var entries = JSON.parse(fs.readFileSync('data.json', 'utf8'));
    var synonyms = true;
    semanticsearch.clear_index(semanticsearch.IDX_NAME, function ()
    {
        semanticsearch.setup_index_synonyms(semanticsearch.IDX_NAME, function ()
        {
            semanticsearch.bulk_add(semanticsearch.IDX_NAME, entries, function ()
            {
                // need empty function to prevent error when connection is refused
            });
        });
    });
}
catch (e) {
    // if elasticsearch isn't running
    console.error(e);
}

app.get('/semantic-search/standard', function (req, res)
{
    console.log('wtf');
});
app.post('/semantic-search/standard', function (req, res)
{
    if (!synonyms)
        return res.status(200).end();
    semanticsearch.clear_index(semanticsearch.IDX_NAME, function ()
    {
        semanticsearch.setup_index(semanticsearch.IDX_NAME, function ()
        {
            semanticsearch.bulk_add(semanticsearch.IDX_NAME, entries, function ()
            {
                semanticsearch.flush(semanticsearch.IDX_NAME, function ()
                {
                    synonyms = false;
                    res.status(200).end();
                });
            });
        });
    });
});
app.post('/semantic-search/synonyms', function (req, res)
{
    if (synonyms)
        return res.status(200).end();
    semanticsearch.clear_index(semanticsearch.IDX_NAME, function ()
    {
        semanticsearch.setup_index_synonyms(semanticsearch.IDX_NAME, function ()
        {
            semanticsearch.bulk_add(semanticsearch.IDX_NAME, entries, function ()
            {
                semanticsearch.flush(semanticsearch.IDX_NAME, function ()
                {
                    synonyms = true;
                    res.status(200).end();
                });
            });
        });
    });
});
app.post('/semantic-search', function (req, res)
{
    var fields = req.body.fields || ['name', 'desc', 'comment'];
    var weights = req.body.weights || [1, 1, 1];
    var id = req.body.id;
    if (!id)
        res.status(400).json({ error: "Input ID required. (Format is { 'id': '9b79279f-419e-45e0-80df-46ac707ff84b', 'fields': ['name', 'desc'], 'weights': [2, 1]}) "});
    semanticsearch.more_like_this_extended(semanticsearch.IDX_NAME, id, fields, weights, function (error, response, body)
    {
        if (body.hits)
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