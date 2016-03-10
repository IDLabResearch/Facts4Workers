
var path = require('path');
var url = require('url');
var assert = require('assert');

function TEST ()
{}


function relative (relativePath)
{
    return path.join(path.join(__dirname, '..'), relativePath);
}

TEST.relative = relative;

TEST.files = [
    relative('n3/util.n3'),
    relative('n3/authorization/api.n3'),
    relative('n3/thermolympic/api.n3'),
    relative('n3/thermolympics_teamleader_new/api.n3'),
    relative('n3/thermolympics_operator_new/api.n3')
];

TEST.goals = {
    operator: TEST.relative('n3/thermolympics_operator_new/goal.n3'),
    teamleader: TEST.relative('n3/thermolympics_teamleader_new/goal.n3')
};

TEST.createStubFunction = function (stubs)
{
    return function (callback)
    {
        var link = this.getURL();
        var parsed = url.parse(link, true);
        if (parsed.query.access_token)
        {
            assert.strictEqual(parsed.query.access_token, 'ACCESS');
            delete parsed.query.access_token;
            parsed.search = '';
            link = url.format(parsed);
        }
        if (!(link in stubs))
            throw new Error('Unsupported URL stub: ' + link);
        var result = stubs[link](this.getBody());
        callback(null, result);
    };
};

global.TEST = TEST;