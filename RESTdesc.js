/**
 * Created by joachimvh on 1/04/2015.
 */

var _ = require('lodash');
var fs = require('fs');
var EYEHandler = require('./EYEHandler');
var N3 = require('n3');
var RDF_JSONConverter = require('./RDF_JSONConverter');

function RESTdesc (input, goal)
{
    this.input = input;
    this.goal = goal;

    if (!_.isArray(this.input))
        this.input = [this.input];

    this.list = fs.readFileSync('n3/list.n3', 'utf-8');
    this.find = fs.readFileSync('n3/find_executable_calls.n3', 'utf-8');
    this.findall = fs.readFileSync('n3/findallcalls.n3', 'utf-8');

    this.eye = new EYEHandler();
    // TODO: store with all new triple information
    //this.store = new N3.store();

    // TODO: generalize
    this.prefix = 'http://f4w.restdesc.org/demo#';

    // TODO: prettify
    this.data = [];


    //var parser = new N3.Parser();
    //var writer = new N3.Writer();
    //var triples = [];
    //parser.parse(this.input[2], function (error, triple, prefixes)
    //{
    //    if (triple)
    //        writer.addTriple(triple);
    //    else
    //    {
    //        writer.addPrefixes(prefixes);
    //        writer.end(function (error, result) { console.log(result); });
    //    }
    //});
}

RESTdesc.prototype.addInput = function (input)
{
    this.data.push(input);
};

RESTdesc.prototype.addJSON = function (json, root, callback)
{
    var converter = new RDF_JSONConverter({'': this.prefix});
    // TODO: prefixes
    // TODO: find out why this exact syntax is necessary
    // TODO: colon
    if (root[0] !== '_')
        root = ':' + root;
    this.addInput('@prefix : <http://f4w.restdesc.org/demo#>.\n ' + converter.JSONtoRDFstring(json, root));
    callback();
    //var triples = converter.JSONtoRDF(json, ':' + root);
    //var writer = N3.Writer({ prefixes: converter.prefixes, format: 'N-Triples' });
    //writer.addTriples(triples);
    //var self = this;
    //writer.end(function (error, result) { self.addInput(result); callback(); });
};

RESTdesc.prototype.next = function (callback)
{
    var self = this;
    this.eye.call(this.input.concat(this.data), this.goal, true, true, false, function (proof) { console.log(proof); self._handleProof(proof, callback); }, this._error);
    // TODO: use the new info. Still more a fan of deleting old output though.
    //this.eye.call(this.input, this.goal, false, false, true, function (proof) { console.log(proof); }, this._error, true);
};

RESTdesc.prototype._handleProof = function (proof, callback)
{
    var self = this;
    this.eye.call([proof, this.list], this.find, false, true, false, function (body) { console.log(body); self._handleNext(body, callback); }, this._error);
};

RESTdesc.prototype._handleNext = function (next, callback)
{
    var self = this;
    this.eye.parseBody(next, function (triples, prefixes)
    {
        var store = new N3.Store();
        store.addPrefixes(prefixes);
        store.addTriples(triples);
        var apis = store.find(null, 'tmpl:requestURI', null);
        if (apis.length === 0)
        {
            // TODO: done? what do?
            callback('DONE');
        }
        else
        {
            // TODO: more than 1 api possible? what do?
            var root = apis[0].subject;
            self.converter = new RDF_JSONConverter(prefixes);
            var json = self.converter.RDFtoJSON(store, root);
            json.data = [self.converter._RDFtoN3recursive(store)];

            // simplify JSON
            // TODO: more generic (prefix dependent now)
            if (json['tmpl:requestURI'])
            {
                json['http:requestURI'] = json['tmpl:requestURI'].join('');
                delete json['tmpl:requestURI'];
            }
            if (json['http:body'] === '')
                delete json['http:body'];
            callback(json);
        }
    });
};


RESTdesc.prototype._error = function (error, content)
{
    console.error(error);
};

module.exports = RESTdesc;
