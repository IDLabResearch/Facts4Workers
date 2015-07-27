
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var fs = require('fs');
var _ = require('lodash');
var RESTdesc = require('./RESTdesc');
var serveIndex = require('serve-index');
var N3 = require('n3');

var args = require('minimist')(process.argv.slice(2));
if (!args.p || args.h || args.help)
{
    console.error('usage: node demo.js [-p port] [--help]');
    return process.exit(1);
}
var port = args.p;

var app = express();
app.set('view engine', 'jade');

// provide jquery file that can be used
app.set('views', process.cwd() + '/views');
app.use('/scripts/jquery.min.js', express.static(process.cwd() + '/node_modules/jquery/dist/jquery.min.js'));

// parse post data
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({   // to support URL-encoded bodies
    extended: true
}));

// allow acces to documentation pdf
app.use('/demo/documentation', express.static(process.cwd() + "/documentation/"));

// create index page of all our n3 files
app.use('/demo/n3', express.static(process.cwd() + "/n3"));
app.use('/demo/n3', serveIndex(__dirname + '/n3', {icons: true, view: 'details'}));

// TODO: more generic way to load all files?
var api1 = fs.readFileSync('n3/calibration/api1.n3', 'utf-8');
var api2 = fs.readFileSync('n3/calibration/api2.n3', 'utf-8');
var extra = fs.readFileSync('n3/calibration/extra-rules.n3', 'utf-8');

var goals = {
    'calibration': fs.readFileSync('n3/calibration/goal.n3', 'utf-8')
};

app.get('/', function (req, res)
{
    res.render('goals');
});

app.get('/demo', function (req, res)
{
    res.render('index', { title: 'F4W demo', message: 'F4W demo', goal: 'calibration'});
});

app.get('/demo/start', function (req, res)
{
    res.render('start');
});

app.get('/demo/doMeasurement', function (req, res)
{
    var params = JSON.parse(req.query.body).suggested_parameters;
    res.render('doMeasurement', {params: params});
});

app.post('/demo/eye', function (req, res)
{
    var input = req.body.input || "";
    var goal = req.body.goal || "";
    var rest = new RESTdesc(input, goal);
    handleNext(rest, req, res);
});

app.post('/demo/next', function (req, res)
{
    var goal = goals['calibration'];
    if (req.body && req.body.goal)
    {
        goal = goals[req.body.goal];
        if (!goal)
            return res.status(400).json({ error: 'Unknown goal ' + req.body.goal });
    }
    var cacheKey = null;
    var map = null;
    if (req.body.eye)
    {
        if (req.body.json)
            map = mapInput(req.body.json, req.body.eye);
        cacheKey = req.body.eye.data;
    }
    var rest = new RESTdesc([api1, api2, extra], goal, cacheKey);
    rest.fillInBlanks(map, function () { handleNext(rest, req, res); });

});

function mapInput (json, eye)
{
    if (!eye['http:resp'] || !eye['http:resp']['http:body'])
        throw "Response body not found.";

    var map = {};
    var body = eye['http:resp']['http:body']['contains'] || eye['http:resp']['http:body']; // skip 'contains' if it is present
    mapInputRecurisve(json, body, map);

    return map;
}

function mapInputRecurisve (json, response, map)
{
    if (_.isString(response))
        map[response] = json;
    else if (_.isArray(response))
    {
        if (!_.isArray(json) || json.length !== response.length)
            throw 'Expecting array of length ' + response.length + ', got ' + JSON.stringify(json) + ' instead.';

        for (var i = 0; i < response.length; ++i)
            mapInputRecurisve(json[i], response[i], map);
    }
    else
    {
        for (var key in response)
        {
            if (json[key] === undefined)
                throw "Missing JSON input key: " + key;
            mapInputRecurisve(json[key], response[key], map);
        }
    }
}

function handleNext (rest, req, res, output, count)
{
    output = output || "";
    count = count || 0;

    // TODO this is simply a check to make sure there is a problem in the demo causing us to accidently DOS an API.
    if (count >= 5)
        return res.format({ json:function () { res.send({status:'Too many automated API calls in a row. Aborting to prevent infinte loop.'}); } });

    rest.next(function (data)
    {
        var url = data['http:requestURI'];
        var body = data['http:body'];

        output += 'Reasoner result: \n';
        output += JSON.stringify(data, null, 4);
        output += '\n';

        // give cacheKey to user so they can send it back in the next step
        data.data = rest.cacheKey;

        if (data === 'DONE')
            res.format({ json:function () { res.send({status: 'DONE', output: output, proofs: rest.proofs}); } });
        else if (url.indexOf('http://askTheWorker/') >= 0)
        {
            // remove pre part of URI
            data['http:requestURI'] = url.substring('http://askTheWorker/'.length);

            // send data to client
            data.output = output;
            data.proofs = rest.proofs;
            res.format({ json:function () { res.send(data); } });
        }
        else
        {
            var requestParams = {
                url: url,
                method: data['http:methodName']
            };

            if (body)
                requestParams.json = body;

            output += 'Calling: ' + url + '\n';
            // do call ourselves
            request(requestParams,
                function (error, response, body)
                {
                    // TODO: error handling
                    if (!error && response.statusCode == 200)
                    {
                        var json = body;
                        if (_.isString(body))
                            json = JSON.parse(body);

                        output += 'Response: \n';
                        output += JSON.stringify(json, null, 4);
                        output += '\n';

                        // TODO: duplication
                        var map = mapInput(json, data);
                        rest.fillInBlanks(map, function () { handleNext(rest, req, res, output, count+1); });
                    }
                    else
                        console.error(error, body);
                }
            );
        }
    });
}

app.listen(port);