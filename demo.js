
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var path = require('path');
var _ = require('lodash');//
var RESTdesc = require('./RESTdesc');
var serveIndex = require('serve-index');

var args = require('minimist')(process.argv.slice(2));
if (!args.p || args.h || args.help)
{
    console.error('usage: node demo.js [-p port] [--help]');
    return process.exit((args.h || args.help) ? 0 : 1);
}
var port = args.p;

var app = express();
app.set('view engine', 'jade');

function relative (relativePath)
{
    return path.join(__dirname, relativePath);
}

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
    'n3/thermolympics_operator_new/api.n3',
    'n3/thermolympics_teamleader_new/api.n3'
];

var input = rulePaths.map(relative);

var goals = {
    //'calibration': relative('n3/calibration/goal.n3'),
    //'thermolympics_operator': relative('n3/thermolympics_operator/goal.n3'),
    //'therolympics_teamleader': relative('n3/thermolympics_teamleader/goal.n3'),
    'thermolympics_operator_new': relative('n3/thermolympics_operator_new/goal.n3'),
    'thermolympics_teamleader_new': relative('n3/thermolympics_teamleader_new/goal.n3')
};

app.get('/', function (req, res)
{
    res.render('goals');
});

app.post('/clear', function (req, res)
{
    if (!req.body || !req.body.data)
        return res.status(400).json({ error: 'Expected a JSON object with a "data" field.'});
    var rest = new RESTdesc(null, null, req.body.data);
    rest.clear(function ()
    {
        res.sendStatus(200);
    });
});

app.post('/back', function (req, res)
{
    if (!req.body || !req.body.data)
        return res.status(400).json({ error: 'Expected a JSON object with a "data" field.'});
    var rest = new RESTdesc(null, null, req.body.data);
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
    var rest = new RESTdesc(input, goal);
    handleNext(rest, req, res);
});

app.post('/next', next);
function next (req, res)
{
    if (!req.body || !req.body.goal)
        return res.status(400).json({ error: 'Expected an input body containing at least the goal.'});

    var goal = goals[req.body.goal];
    if (!goal)
        return res.status(400).json({ error: 'Unknown goal ' + req.body.goal });

    var cacheKey = null;
    if (req.body.eye)
        cacheKey = req.body.eye.data;

    var rest = new RESTdesc(input, goal, cacheKey);
    rest.handleUserResponse(req.body.json, req.body.eye, function () { handleNext(rest, req, res); });
}

function handleNext (rest, req, res, count)
{
    count = count || 0;

    // TODO this is simply a check to make sure there is a problem in the demo causing us to accidently DOS an API.
    if (count >= 5)
        return res.format({ json:function () { res.send({status:'Too many automated API calls in a row. Aborting to prevent infinte loop.'}); } });

    rest.next(function (data)
    {
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
            throw "Normal API calls shouldn't reach this point anymore";
        }
    });
}

app.listen(port);