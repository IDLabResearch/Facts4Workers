
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var fs = require('fs');
var _ = require('lodash');
var RESTdesc = require('./RESTdesc');
var serveIndex = require('serve-index');
var S = require('string');
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

var api1 = fs.readFileSync('n3/api1.n3', 'utf-8');
var api2 = fs.readFileSync('n3/api2.n3', 'utf-8');
var input = fs.readFileSync('n3/in.n3', 'utf-8');

var goal = fs.readFileSync('n3/goal.n3', 'utf-8');

app.get('/', function (req, res)
{
    res.redirect('/demo');
});

app.get('/demo', function (req, res)
{
    res.render('index', { title: 'F4W demo', message: 'F4W demo'});
});

app.get('/demo/start', function (req, res)
{
    res.render('start');
});

app.get('/demo/doMeasurement', function (req, res)
{
    res.render('doMeasurement');
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
    var rest = new RESTdesc([api1, api2, input], goal);
    if (req.body.eye)
    {
        if (req.body.json)
            mapInput(req.body.json, req.body.eye);
        if (req.body.eye.data)
            for (var i = 0; i < req.body.eye.data.length; ++i)
                rest.addInput(req.body.eye.data[i]);
    }
    handleNext(rest, req, res);
});

function mapInput (json, eye)
{
    if (!eye['http:resp'] || !eye['http:resp']['http:body'])
        throw "Response body not found.";

    var map = {};
    var body = eye['http:resp']['http:body'];
    mapInputRecurisve(json, body, map);

    // TODO: I think it is guaranteed that the only changes will be in data[0]
    if (eye.data)
        for (var i = 0; i < eye.data.length; ++i)
            for (var key in map)
                eye.data[i] = S(eye.data[i]).replaceAll(key, map[key]).toString();
}

function mapInputRecurisve (json, response, map)
{
    // TODO: should replace json values with n3 representation

    // TODO: look into this later
    if (_.isString(response))
    {
        // TODO: really hardcoded here, should generalize (again)
        return map[response] = '"' + json.replace(/"/g, '\\"') + '"';
    }

    for (var key in response)
    {
        if (json[key] === undefined)
            throw "Missing JSON input key: " + key;
        if (_.isString(json[key]))
            map[response[key]] = '"' + json[key] + '"';
        else if (_.isNumber(json[key]))
            // TODO: handle decimals
            //map[response[key]] = N3.Util.createLiteral(json[key], '<http://www.w3.org/2001/XMLSchema#decimal>');
            map[response[key]] = json[key];
        else
            mapInputRecurisve(json[key], response[key], map);
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

        // data contains a string representation of the EYE response, we want to add all the other known data to that
        data.data = (data.data || []).concat(rest.data);

        if (data === 'DONE')
            res.format({ json:function () { res.send({status: 'DONE', output: output, proofs: rest.proofs}); } });
        else if (url.indexOf('http://askTheWorker/') >= 0)
        {
            // remove pre part of URI
            data['http:requestURI'] = url.substring('http://askTheWorker/'.length);

            // TODO: really ugly hardcoded fix for now
            // TODO: please don't judge me, I'm sorry
            if (body && body['partList'])
                body['partList'] = JSON.parse(body['partList'].replace(/\\"/g, '"'));

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

            // TODO: should not be necessary
            if (body)
            {
                if (body.geometrical_dimension)
                {
                    body.geometrical_dimension[0] = parseFloat(body.geometrical_dimension[0]);
                    body.geometrical_dimension[1] = parseFloat(body.geometrical_dimension[1]);
                }
                if (body.machine_parameters)
                {
                    body.machine_parameters[0] = parseFloat(body.machine_parameters[0]);
                    body.machine_parameters[1] = parseFloat(body.machine_parameters[1]);
                    body.machine_parameters[2] = parseFloat(body.machine_parameters[2]);
                    body.machine_parameters[3] = parseFloat(body.machine_parameters[3]);
                }
                if (body.tolerances)
                {
                    body.tolerances[0].min = parseFloat(body.tolerances[0].min);
                    body.tolerances[0].max = parseFloat(body.tolerances[0].max);
                    body.tolerances[1].min = parseFloat(body.tolerances[1].min);
                    body.tolerances[1].max = parseFloat(body.tolerances[1].max);
                }
            }

            // TODO: currently hardcoded on JSON
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

                        // TODO: hardcoded
                        if (_.isArray(json))
                            json = JSON.stringify(json);

                        output += 'Response: \n';
                        output += JSON.stringify(json, null, 4);
                        output += '\n';

                        mapInput(json, data);
                        rest.setInput(data.data);
                        handleNext(rest, req, res, output, count+1);
                    }
                    else
                        console.error(error, body);
                }
            );
        }
    });
}

app.listen(port);