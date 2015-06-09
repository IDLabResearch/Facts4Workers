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

    this.proofs = [];

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

RESTdesc.prototype.setInput = function (input)
{
    this.data = [].concat(input);
};

RESTdesc.prototype.addJSON = function (json, body, callback)
{
    var converter = new RDF_JSONConverter({'': this.prefix});
    // TODO: prefixes
    // TODO: find out why this exact syntax is necessary
    // TODO: colon
    //if (root[0] !== '_')
    //    root = ':' + root;
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
    this.eye.call(this.input.concat(this.data), this.goal, true, true, false, function (proof) { self._handleProof(proof, callback); }, this._error);
    // TODO: use the new info. Still more a fan of deleting old output though.
    //this.eye.call(this.input, this.goal, false, false, true, function (proof) { console.log(proof); }, this._error, true);
};

RESTdesc.prototype._handleProof = function (proof, callback)
{
    var self = this;
    this.proofs.push(proof);
    this.eye.call([proof, this.list], this.find, false, true, false, function (body) { self._handleNext(body, callback); }, this._error);
};

RESTdesc.prototype._handleNext = function (next, callback)
{
    var self = this;
    this.eye.parseBody(next, function (triples, prefixes)
    {
        var store = new N3.Store();
        store.addPrefixes(prefixes);
        store.addTriples(triples);
        var methods = store.find(null, 'http:methodName', null);
        if (methods.length === 0)
        {
            // TODO: done? what do?
            callback('DONE');
        }
        else
        {
            // TODO: more than 1 api possible? what do?
            var root = methods[0].subject;
            self.converter = new RDF_JSONConverter(prefixes);
            var json = self.converter.RDFtoJSON(store, root);
            // store an n3 version that can be used to send to EYE
            json.data = [self.converter._RDFtoN3recursive(store)];

            // simplify JSON
            // TODO: more generic (prefix dependent now)
            self._simplifyURIs(json);
            // TODO: don't remove this (and check for other missing fields)
            // TODO: http:methodName, http:requestURI, http:body, http:resp (http:body),
            var template = {'http:methodName': 'GET', 'http:requestURI': '', 'http:body': {}, 'http:resp': {'http:body': {}}};
            json = _.assign(template, json);
            callback(json);
        }
    });
};

// TODO: I think I'm being inconsistent here, is this the first time I actually edit the JSON in place instead of generating a new one?
RESTdesc.prototype._simplifyURIs = function (json) {
    var self = this;
    // TODO: this is the 15th time I use these 3 checks (and do similar things with them), should generalize this
    if (_.isString(json))
        return json;

    if (_.isArray(json))
        return json.forEach(function (subjson) { self._simplifyURIs(subjson); });

    if (json['tmpl:requestURI'])
    {
        json['http:requestURI'] = _.isArray(json['tmpl:requestURI']) ? json['tmpl:requestURI'].join('') : json['tmpl:requestURI'];
        delete json['tmpl:requestURI'];
    }

    for (var key in json)
        self._simplifyURIs(json[key]);
};


RESTdesc.prototype._error = function (error, content)
{
    console.error(error);
};

module.exports = RESTdesc;
