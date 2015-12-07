
var assert = require('assert');
var _ = require('lodash');
var RESTdesc = require('../RESTdesc');
var path = require('path');

function relative (relativePath)
{
    return path.join(__dirname, relativePath);
}

describe('RESTdesc', function ()
{
    var restdesc = new RESTdesc([relative('n3/thermolympics_operator_new/api.n3')], relative('n3/thermolympics_operator_new/goal.n3'));
});