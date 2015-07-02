/**
 * Created by joachimvh on 1/04/2015.
 */

var _ = require('lodash');
var fs = require('fs');
var EYEHandler = require('./EYEHandler');
var N3 = require('n3');
var RDF_JSONConverter = require('./RDF_JSONConverter');
var N3Parser = require('./N3Parser');
var JSONLDParser = require('./JSONLDParser');

function RESTdesc (input, goal)
{
    this.input = input;
    this.goal = goal;

    if (!_.isArray(this.input))
        this.input = [this.input];

    this.list = fs.readFileSync('n3/list.n3', 'utf-8');
    this.find = fs.readFileSync('n3/find_executable_calls.n3', 'utf-8');
    this.findall = fs.readFileSync('n3/findallcalls.n3', 'utf-8');

    this.eye = null;
    // TODO: store with all new triple information
    //this.store = new N3.store();

    // TODO: generalize
    this.prefix = 'http://f4w.restdesc.org/demo#';

    // TODO: prettify
    this.data = [];

    this.proofs = [];
}

RESTdesc.prototype.addInput = function (input)
{
    this.data.push(input);
};

RESTdesc.prototype.setInput = function (input)
{
    this.data = [].concat(input);
};

RESTdesc.prototype.next = function (callback)
{
    // create new eye handler every time so we know when to call destroy function
    this.eye = new EYEHandler();
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
    var n3Parser = new N3Parser();
    var jsonldParser = new JSONLDParser();
    var jsonld = n3Parser.parse(next);
    var json = this._JSONLDtoJSON(jsonld);
    json = _.find(json, 'http:methodName');
    if (json && json['tmpl:requestURI'])
    {
        json['http:requestURI'] = json['tmpl:requestURI'].join('');
        delete json['tmpl:requestURI'];
    }
    // TODO: skolemize JSONLD

    var self = this;
    this.eye.parseBody(next, function (triples, prefixes)
    {
        self.eye.destroy(); // clean up cache

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
            // TODO: might be 'clearer' to convert the json back to N3 instead?
            // store an n3 version that can be used to send to EYE, not using 'next' because we need skolemization
            json.data = [self.converter._RDFtoN3recursive(store)];
            //json.data = [next];

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
RESTdesc.prototype._simplifyURIs = function (json)
{
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

RESTdesc.prototype._JSONLDtoJSON = function (jsonld, baseURI)
{
    // TODO: what about lang/datatype?
    if (_.isString(jsonld) || _.isNumber(jsonld))
        return jsonld;

    if (_.isArray(jsonld))
        return jsonld.map(function (child) { return this._JSONLDtoJSON(child, baseURI); }, this);

    // TODO: another vocab dependency
    if (jsonld['@context'] && jsonld['@context']['@vocab'])
        baseURI = jsonld['@context']['@vocab'];

    var json = {};
    var keys = _.without(Object.keys(jsonld), '@context');
    for (var key in jsonld)
    {
        if (key === '@context')
            continue;

        // TODO: special cases where graph/array/@id are subject
        if ((key === '@list' || key === '@graph' || key === '@id') && keys.length === 1)
            return this._JSONLDtoJSON(jsonld[key], baseURI);

        var val = this._JSONLDtoJSON(jsonld[key], baseURI);
        if (baseURI && _.startsWith(key, baseURI))
            key = key.substr(baseURI.length);
        json[key] = val;
    }
    return json;
};


RESTdesc.prototype._error = function (error, content)
{
    console.error(error);
};

module.exports = RESTdesc;
