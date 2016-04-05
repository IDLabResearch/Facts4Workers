var assert = require('assert');

var stubs = {
    GET : {
        'https://offsug.hir.facts4.work/api/v1/parts': parts,
        'https://offsug.hir.facts4.work/api/v1/parts/5b015ac5-fd14-488c-b387-2d8d7b5d4989': part,
        'https://offsug.hir.facts4.work/api/v1/offsets?part_id=5b015ac5-fd14-488c-b387-2d8d7b5d4989&dimension_id=1&value=6': offset
    },
    POST: {
        'https://auth.facts4.work/oauth/token': oauth
    }
};

function oauth (body)
{
    assert.strictEqual(body.username, 'iminds');
    assert.strictEqual(body.password, 'iminds');

    return {
        "access_token" : "ACCESS",
        "token_type"   : "bearer",
        "expires_in"   : 4785,
        "refresh_token": "REFRESH",
        "created_at"   : 123456
    };
}

function offset ()
{
    return {
        "type": "X",
        "value": -0.3,
        "suggestion": "critical"
    };
}

function part ()
{
    return parts()[0];
}

function parts ()
{
    return [
        {
            "id"         : "5b015ac5-fd14-488c-b387-2d8d7b5d4989",
            "name"       : "part1",
            "description": "part1 description",
            "media_url"  : "http://offsug.hir.facts4.work/parts/part1.pdf",
            "optional"   : null,
            "dimensions" : [
                {
                    "id"            : 1,
                    "type"          : "length",
                    "value"         : 17.0,
                    "tolerance_low" : -0.2,
                    "tolerance_high": 0.2
                },
                {
                    "id"            : 2,
                    "type"          : "length",
                    "value"         : 214.8,
                    "tolerance_low" : -0.2,
                    "tolerance_high": 0.2
                },
                {
                    "id"            : 3,
                    "type"          : "length",
                    "value"         : 278.0,
                    "tolerance_low" : -0.2,
                    "tolerance_high": 0.2
                },
                {
                    "id"            : 4,
                    "type"          : "length",
                    "value"         : 318.1,
                    "tolerance_low" : -0.5,
                    "tolerance_high": 0.5
                },
                {
                    "id"            : 5,
                    "type"          : "diameter",
                    "value"         : 14.0,
                    "tolerance_low" : -0.018,
                    "tolerance_high": 0.0
                },
                {
                    "id"            : 6,
                    "type"          : "diameter",
                    "value"         : 22.0,
                    "tolerance_low" : -0.033,
                    "tolerance_high": 0.0
                },
                {
                    "id"            : 7,
                    "type"          : "diameter",
                    "value"         : 25.0,
                    "tolerance_low" : 0.002,
                    "tolerance_high": 0.015
                },
                {
                    "id"            : 8,
                    "type"          : "diameter",
                    "value"         : 32.0,
                    "tolerance_low" : -0.025,
                    "tolerance_high": 0.0
                },
                {
                    "id"            : 9,
                    "type"          : "diameter",
                    "value"         : 74.4,
                    "tolerance_low" : -0.037,
                    "tolerance_high": 0.037
                },
                {
                    "id"            : 10,
                    "type"          : "diameter",
                    "value"         : 25.0,
                    "tolerance_low" : 0.002,
                    "tolerance_high": 0.015
                },
                {
                    "id"            : 11,
                    "type"          : "length",
                    "value"         : 174.0,
                    "tolerance_low" : -0.01,
                    "tolerance_high": 0.01
                },
                {
                    "id"            : 12,
                    "type"          : "length",
                    "value"         : 103.1,
                    "tolerance_low" : -0.01,
                    "tolerance_high": 0.01
                }
            ]
        },
        {
            "id"         : "82cba875-e8c2-447f-9d62-2ec288e75119",
            "name"       : "part2",
            "description": "part2 description",
            "media_url"  : "http://offsug.hir.facts4.work/parts/part2.pdf",
            "optional"   : null,
            "dimensions" : [
                {
                    "id"            : 1,
                    "type"          : "length",
                    "value"         : 176.0,
                    "tolerance_low" : -0.1,
                    "tolerance_high": 0.1
                },
                {
                    "id"            : 2,
                    "type"          : "length",
                    "value"         : 320.3,
                    "tolerance_low" : -0.4,
                    "tolerance_high": 0.4
                },
                {
                    "id"            : 3,
                    "type"          : "diameter",
                    "value"         : 14.0,
                    "tolerance_low" : -0.018,
                    "tolerance_high": 0.0
                },
                {
                    "id"            : 4,
                    "type"          : "diameter",
                    "value"         : 22.0,
                    "tolerance_low" : -0.023,
                    "tolerance_high": -0.005
                },
                {
                    "id"            : 5,
                    "type"          : "length",
                    "value"         : 14.0,
                    "tolerance_low" : -0.1,
                    "tolerance_high": 0.1
                },
                {
                    "id"            : 6,
                    "type"          : "length",
                    "value"         : 208.8,
                    "tolerance_low" : -0.4,
                    "tolerance_high": 0.4
                },
                {
                    "id"            : 7,
                    "type"          : "diameter",
                    "value"         : 25.0,
                    "tolerance_low" : 0.002,
                    "tolerance_high": 0.015
                },
                {
                    "id"            : 8,
                    "type"          : "diameter",
                    "value"         : 40.0,
                    "tolerance_low" : -0.03,
                    "tolerance_high": 0.0
                },
                {
                    "id"            : 9,
                    "type"          : "diameter",
                    "value"         : 78.4,
                    "tolerance_low" : -0.041,
                    "tolerance_high": 0.041
                },
                {
                    "id"            : 10,
                    "type"          : "diameter",
                    "value"         : 25.0,
                    "tolerance_low" : 0.003,
                    "tolerance_high": 0.017
                },
                {
                    "id"            : 11,
                    "type"          : "length",
                    "value"         : 193.0,
                    "tolerance_low" : -0.02,
                    "tolerance_high": 0.02
                },
                {
                    "id"            : 12,
                    "type"          : "length",
                    "value"         : 94.3,
                    "tolerance_low" : -0.01,
                    "tolerance_high": 0.01
                }
            ]
        }
    ];
}

module.exports = stubs;