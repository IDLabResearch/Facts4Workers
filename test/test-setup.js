
var path = require('path');
var url = require('url');
var assert = require('assert');
var nock = require('nock');

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
    relative('n3/thermolympics_operator_new/api.n3'),
    relative('n3/HIR_offset/api.n3')
];

TEST.goals = {
    operator: TEST.relative('n3/thermolympics_operator_new/goal.n3'),
    teamleader: TEST.relative('n3/thermolympics_teamleader_new/goal.n3'),
    offset: TEST.relative('n3/HIR_offset/goal.n3'),
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
        if (!(link in stubs[this.getMethod()]))
            throw new Error('Unsupported URL stub: ' + this.getMethod() + ' ' + link);
        var result = stubs[this.getMethod()][link](this.getBody());
        callback(null, result);
    };
};

function startNock (method, stubs)
{
    return nock(/.*/)
        .intercept(/.*/, method)
        .reply(200, function (uri, requestBody)
        {
            startNock(method, stubs);

            uri = 'https://' + this.req.headers.host + uri;

            var parsed = url.parse(uri, true);
            if (parsed.query.access_token)
            {
                assert.strictEqual(parsed.query.access_token, 'ACCESS');
                delete parsed.query.access_token;
                parsed.search = '';
                uri = url.format(parsed);
            }
            if (!(uri in stubs[method]))
                throw new Error('Unsupported URL stub: ' + method + ' ' + uri);
            return stubs[method][uri](requestBody);
        });
}
TEST.disableHTTP = function (stubs)
{
    startNock('GET', stubs);
    startNock('POST', stubs);
};
TEST.enableHTTP = function ()
{
    nock.cleanAll();
};

global.TEST = TEST;