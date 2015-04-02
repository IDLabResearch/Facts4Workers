
var express = require('express');
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

var api1 = fs.readFileSync('n3/api1.n3');
var api2 = fs.readFileSync('n3/api2.n3');
var input = fs.readFileSync('n3/in.n3');
var list = fs.readFileSync('n3/list.n3');

var goal = fs.readFileSync('n3/goal.n3');
var find = fs.readFileSync('n3/find_executable_calls.n3');

var proof = fs.readFileSync('n3/proof.n3');

var eye = new EYEHandler();
var rest = new RESTdesc([api1, api2, input], goal);
//rest.next(function (data) { console.log(JSON.stringify(data, null, 4)); });

app.get('/', function(req, res)
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

    res.render('index', { title: 'F4W demo', message: 'Hello there!'});
});

app.listen(port);