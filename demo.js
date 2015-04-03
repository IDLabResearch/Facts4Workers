
var express = require('express');
var bodyParser = require('body-parser');
var request = require('request');
var fs = require('fs');
var N3 = require('n3');
var extend = require('util')._extend;
var _ = require('lodash');
var RDF_JSONConverter = require('./RDF_JSONConverter');
var EYEHandler = require('./EYEHandler');
var RESTdesc = require('./RESTdesc');

var args = require('minimist')(process.argv.slice(2));
if (!args.p || args.h || args.help)
{
    console.error('usage: node demo.js [-p port] [--help]');
    return process.exit(1);
}
var port = args.p;

var app = express();
app.set('view engine', 'jade');
app.set('views', process.cwd() + '/views');
app.use('/scripts/jquery.min.js', express.static(process.cwd() + '/node_modules/jquery/dist/jquery.min.js'));
//app.use(express.static(process.cwd() + '/public'));
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({   // to support URL-encoded bodies
    extended: true
}));

var api1 = fs.readFileSync('n3/api1.n3', 'utf-8');
var api2 = fs.readFileSync('n3/api2.n3', 'utf-8');
var input = fs.readFileSync('n3/in.n3', 'utf-8');
var list = fs.readFileSync('n3/list.n3', 'utf-8');

var goal = fs.readFileSync('n3/goal.n3', 'utf-8');
var find = fs.readFileSync('n3/find_executable_calls.n3', 'utf-8');

var eye = new EYEHandler();
//rest.next(function (data) { console.log(JSON.stringify(data, null, 4)); });

var output = "";

app.get('/demo', function (req, res)
{
    /*request.post
    (
        'http://eye.restdesc.org/',
        { form: { data: 'http://eulersharp.sourceforge.net/2003/03swap/socrates.n3', query: 'http://eulersharp.sourceforge.net/2003/03swap/socratesF.n3' } },
        function (error, response, body)
        {
            if (!error && response.statusCode == 200)
                console.log(body);
            res.sendfile('views/index.html');
            res.header("Content-Type", "text/plain");
            //res.format
            //({
            //    text:function () { res.send(body); } ,
            //    'default': function() { res.status(406).send('Not Acceptable'); }
            //});
        }
    );*/

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

app.get('/demo/output', function (req, res) {
    res.send(output);
});

app.post('/demo/next', function (req, res)
{
    output = "";
    var rest = new RESTdesc([api1, api2, input], goal);
    if (req.body.extra)
    {
        for (var i = 0; i < req.body.extra.length; ++i)
            rest.addInput(req.body.extra[i]);
    }
    if (req.body.json && req.body.root)
    {
        rest.addJSON(req.body.json, req.body.root, function ()
        {
            handleNext(rest, req, res);
        });
    }
    else
        handleNext(rest, req, res);
});

function handleNext (rest, req, res, prevURL)
{
    rest.next(function (data)
    {
        var url = data['http:requestURI'];
        var body = data['http:body'];

        // TODO this is simply a check to make sure there is a problem in the demo causing us to accidently DOS an API.
        if (url === prevURL)
            return res.format({ json:function () { res.send({status:'ERROR'}); } });

        output += 'Reasoner result: \n';
        output += JSON.stringify(data, null, 4);
        output += '\n';

        if (data === 'DONE')
            res.format({ json:function () { res.send({status:'DONE'}); } });
        else if (url.indexOf('http://askTheWorker') >= 0)
        {
            // send data to client
            data.extra = rest.extra;
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
                    if (!error && response.statusCode == 200)
                    {
                        var json = body;
                        if (_.isString(body))
                            json = JSON.parse(body);

                        output += 'Response: \n';
                        output += JSON.stringify(json, null, 4);
                        output += '\n';

                        // TODO: change so we just take the required params from the json
                        if (requestParams.method === 'GET')
                        {
                            if (json.geometrical_dimension)
                                delete json.geometrical_dimension;
                            if (json.result)
                                delete json.result;
                            if (json.suggested_parameters)
                                delete json.suggested_parameters;
                        }
                        if (json.tolerances)
                            json.tolerances = [[json.tolerances[0].min, json.tolerances[0].max], [json.tolerances[1].min, json.tolerances[1].max]];

                        //request.post('http://localhost:3000/next', {json:{root:data.root, json:json, extra:rest.extra}});

                        // do this so response gets handled correctly
                        rest.addJSON(json, data.root, function ()
                        {
                            //request.get('http://localhost:3000/next');
                            handleNext(rest, req, res, url);
                        });
                    }
                    else
                        console.error(error, body);
                }
            );
        }
    });
}

app.listen(port);