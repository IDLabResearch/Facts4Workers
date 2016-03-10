/**
 * Created by joachimvh on 9/12/2015.
 */

var assert = require('assert');
var _ = require('lodash');

var stubs = {
    GET : {
        'https://mstate.tho.facts4.work/api/machines'                                                 : machines,
        'https://machinesandparts.surge.sh/api/parts.json'                                            : parts,
        'https://skillp.tho.facts4.work/api/operator_skills'                                          : operators,
        'https://skillp.tho.facts4.work/api/operator_skills/fe25bbc1-4e4e-4da4-99f7-6a673c53e237'     : operatorFe25bbc1,
        'https://defects.tho.facts4.work/api/defects?part_id=1'                                       : defects1,
        'https://defects.tho.facts4.work/api/solutions?defect_id=0324aa5e-9136-4888-85c7-9027a66121ab': solutions0324005e,
        'https://defects.tho.facts4.work/api/solutions/e314e5ab-9860-4c4c-8830-83dc84d5c307'          : solutione314e5ab,
        'https://defects.tho.facts4.work/api/solutions/9519490e-5fb8-401b-b864-339c8b16dc56'          : solution9519490e,

        'https://mstate.tho.facts4.work/api/machines/f57438f4-ccfc-4c5d-a0ac-0c7008d4bf3f/last_event': last_eventf57438f4,
        'https://mstate.tho.facts4.work/api/machines/d8b20647-d578-46b2-a32a-479d440f438a/last_event': last_eventd8b20647,
        'https://mstate.tho.facts4.work/api/machines/f57438f4-ccfc-4c5d-a0ac-0c7008d4bf3f/events'    : eventsd8b20647,
        'https://mstate.tho.facts4.work/api/machines/d8b20647-d578-46b2-a32a-479d440f438a/events'    : eventsd8b20647,
        'https://defects.tho.facts4.work/api/defects/0324aa5e-9136-4888-85c7-9027a66121ab'           : defect0324aa5e,
        'https://defects.tho.facts4.work/api/reports?event_id=307'                                   : event307
    },
    POST: {
        'https://auth.facts4.work/oauth/token'                                                   : oauth,
        'https://mstate.tho.facts4.work/api/machines/f57438f4-ccfc-4c5d-a0ac-0c7008d4bf3f/events': postEventf57438f4,
        'https://mstate.tho.facts4.work/api/machines/d8b20647-d578-46b2-a32a-479d440f438a/events': postEventf57438f4,
        'https://defects.tho.facts4.work/api/reports'                                            : postReport
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

function machines ()
{
    return [
        {
            "id"      : "f57438f4-ccfc-4c5d-a0ac-0c7008d4bf3f",
            "name"    : "Cooling machine",
            "desc"    : "Machine used for cooling purposes",
            "state"   : "fb71a95f-8068-4b92-964c-9b5720efda54",
            "optional": { "media_url": "http://machinesandparts.surge.sh/machines/grey_machine.jpg" }
        },
        {
            "id"      : "d8b20647-d578-46b2-a32a-479d440f438a",
            "name"    : "Turning Machine",
            "desc"    : "MoriSeki TurninMachine",
            "state"   : "3abbbd8c-bf6a-42c0-a096-2087d4b8e4a8",
            "optional": { "media_url": "http://machinesandparts.surge.sh/machines/red_machine.jpg" }
        },
        {
            "id"      : "1af1f849-0b98-4611-a5b3-09ad03f2c561",
            "name"    : "Heating machine",
            "desc"    : "Machine used for heating purposes",
            "state"   : "5e41b90e-77b6-4810-99ff-9df87d709801",
            "optional": { "media_url": "http://machinesandparts.surge.sh/machines/green_machine.jpg" }
        },
        {
            "id"      : "9f3c5ac1-8ca5-4c55-8ed3-dcfcf0c684d2",
            "name"    : "Sliding machine",
            "desc"    : "Machine used for sliding purposes",
            "state"   : "fb71a95f-8068-4b92-964c-9b5720efda54",
            "optional": { "media_url": "http://machinesandparts.surge.sh/machines/grey_machine.jpg" }
        }
    ];
}

function parts ()
{
    return [
        {
            id       : 1,
            name     : "Pinion",
            image_url: "http://machinesandparts.surge.sh/part1/part1_ok.jpg"
        },
        {
            id       : 2,
            name     : "Carter",
            image_url: "http://machinesandparts.surge.sh/part2/part2_ok.jpg"
        },
        {
            id       : 3,
            name     : "Handle",
            image_url: "http://machinesandparts.surge.sh/part3/part3_ok.jpg"
        },
        {
            id       : 4,
            name     : "Flange",
            image_url: "http://machinesandparts.surge.sh/part4/part4_ok.jpg"
        }
    ]
}

function operators ()
{
    return [
        {
            "id"    : "3df5bf9e-114f-445e-b60b-e63247701a11",
            "name"  : "Carla",
            "desc"  : "",
            "role"  : "Operator",
            "skills": {
                "tool"   : 1,
                "machine": 1
            }
        },
        {
            "id"    : "fe25bbc1-4e4e-4da4-99f7-6a673c53e237",
            "name"  : "Jose",
            "desc"  : "",
            "role"  : "Quality Manager",
            "skills": {
                "tool"    : 1,
                "machine" : 2,
                "computer": 1
            }
        },
        {

            "id"    : "1d09d800-4936-4d49-9ab7-d006663d185b",
            "name"  : "Eduardo",
            "desc"  : "",
            "role"  : "Team Leader",
            "skills": {
                "tool"    : 3,
                "machine" : 3,
                "computer": 3
            }
        }];
}

function operatorFe25bbc1 ()
{
    return {
        "id"    : "fe25bbc1-4e4e-4da4-99f7-6a673c53e237",
        "name"  : "Jose",
        "desc"  : "",
        "role"  : "Quality Manager",
        "skills": {
            "tool"    : 1,
            "machine" : 2,
            "computer": 1
        }
    };
}

function defects1 ()
{
    return [
        {
            "id"       : "0324aa5e-9136-4888-85c7-9027a66121ab",
            "name"     : "Bad color",
            "desc"     : "Color of the product has not the correct RAL value",
            "part_id"  : "1",
            "media_url": "http://machinesandparts.surge.sh/part1/part1_bad_color.jpg",
            "comment"  : "Consider the color only of the lower vertex",
            "taxonomy" : null
        },
        {
            "id"       : "3cfa15c3-4a65-4e4a-9c14-0da25244002d",
            "name"     : "Craked",
            "desc"     : "The product present a large crack",
            "part_id"  : "1",
            "media_url": "http://machinesandparts.surge.sh/part1/part1_craked.jpg",
            "comment"  : "Crack is critical only when dimension is larger than 2 mm2",
            "taxonomy" : null
        },
        {
            "id"       : "6be07e98-a553-4f6f-a7c0-f8d9ea831a6a",
            "name"     : "Hole",
            "desc"     : "Hole on the border of the product",
            "part_id"  : "1",
            "media_url": "http://machinesandparts.surge.sh/part1/part1_hole.jpg",
            "comment"  : "The product has a hole on the side, critical when wider than 1 mm",
            "taxonomy" : null
        },
        {
            "id"       : "3f4a744b-f262-491c-8c83-6ca0512a14d7",
            "name"     : "Missing part",
            "desc"     : "A part of the product is missing",
            "part_id"  : "1",
            "media_url": "http://machinesandparts.surge.sh/part1/part1_missing_part.jpg",
            "comment"  : "Note the number of the figure of the die",
            "taxonomy" : null
        }
    ];
}

function solutions0324005e ()
{
    return [
        {
            "id"           : "e314e5ab-9860-4c4c-8830-83dc84d5c307",
            "name"         : "replace color feeder",
            "desc"         : "do this, fix that, clean all",
            "defect_id"    : "0324aa5e-9136-4888-85c7-9027a66121ab",
            "comment"      : "check product expiry date",
            "skill"        : {
                "tool"   : 2,
                "machine": 1
            },
            "succcess_rate": 0.0,
            "rating"       : 95
        },
        {
            "id"           : "abebd570-04cb-4eab-a893-d6bd425ca6c2",
            "name"         : "clean product feeder",
            "desc"         : "do this, fix that, clean all",
            "defect_id"    : "0324aa5e-9136-4888-85c7-9027a66121ab",
            "comment"      : "use_XXX for cleaning",
            "skill"        : {
                "tool"   : 2,
                "machine": 1
            },
            "succcess_rate": 0.0,
            "rating"       : 93
        },
        {
            "id"           : "9519490e-5fb8-401b-b864-339c8b16dc56",
            "name"         : "change die",
            "desc"         : "do this, fix that, clean all",
            "defect_id"    : "0324aa5e-9136-4888-85c7-9027a66121ab",
            "comment"      : "replace screws",
            "skill"        : {
                "tool"   : 1,
                "machine": 2
            },
            "succcess_rate": 0.0,
            "rating"       : 87
        }
    ];
}

function postEventf57438f4 (body)
{
    var stop = { name: "Stop the machine", desc: "Stoping the machine after a defect was spotted!", machine_state: "4", operator_id: 2, optional: { defect_id: 1 } };
    var start = { desc: "Starting the machine after a solution was successfully applied!", machine_state: "1", name: "Starting the machine", operator_id: 2 };
    var teamleader = { name: "waiting_for_teamleader", desc: "Stoping the machine. Problem has to be fixed by the team leader.", machine_state: "3", operator_id: 2, optional: { defect_id: 1, stopped_for_defect_event_id: 123 } };
    if (body.machine_state === '1')
        assert.deepEqual(body, start);
    else if (body.machine_state === '3')
        assert.deepEqual(body, teamleader);
    else if (body.machine_state === '4')
        assert.deepEqual(body, stop);
    return { id: 123 };
}

function solutione314e5ab ()
{
    return {
        id       : 1,
        name     : "replace color feeder",
        desc     : "do this, fix that, clean all",
        defect_id: 1,
        comment  : "check product expiry date",
        skill    : { tool: 2, machine: 1 }
    };
}

function solution9519490e ()
{
    return {
        id       : 3,
        name     : "change die",
        desc     : "do this, fix that, clean all",
        defect_id: 1,
        comment  : "replace screws",
        skill    : { tool: 1, machine: 2 }
    };
}

function postReport (body)
{
    //assert.strictEqual(body.event_id, 123);
    //assert.strictEqual(body.operator_id, 'fe25bbc1-4e4e-4da4-99f7-6a673c53e237');
    //assert.strictEqual(body.solution_id, '9519490e-5fb8-401b-b864-339c8b16dc56');
    assert(_.isBoolean(body.success));
    return {
        "id"         : "6285c08b-2a75-4172-9739-a0a06dae9f37",
        "event_id"   : "042a12fc-f082-434c-8499-07ea8f3fdde3",
        "solution_id": "9519490e-5fb8-401b-b864-339c8b16dc56",
        "operator_id": "33c1168b-bae6-4963-accf-047f034b3430",
        "success"    : false,
        "comment"    : "not solved!",
        "created_at" : "2016-03-10T10:44:58.749Z"
    };
}

function last_eventf57438f4 ()
{
    return {
        id           : 308,
        name         : "not waiting for teamleader",
        desc         : "Something else",
        machine_state: "fb71a95f-8068-4b92-964c-9b5720efda54",
        machine      : "f57438f4-ccfc-4c5d-a0ac-0c7008d4bf3f",
        operator     : "3df5bf9e-114f-445e-b60b-e63247701a11",
        optional     : { defect_id: "0324aa5e-9136-4888-85c7-9027a66121ab" }
    };
}

function last_eventd8b20647 ()
{
    return {
        id           : 308,
        name         : "waiting for teamleader",
        desc         : "Something else",
        machine_state: "3abbbd8c-bf6a-42c0-a096-2087d4b8e4a8",
        machine      : "d8b20647-d578-46b2-a32a-479d440f438a",
        operator     : "3df5bf9e-114f-445e-b60b-e63247701a11",
        optional     : { defect_id: "0324aa5e-9136-4888-85c7-9027a66121ab", "stopped_for_defect_event_id": 307 }
    };
}

function eventsd8b20647 ()
{
    var events = [];
    for (var i = 0; i < 100; ++i)
        events.push(last_eventd8b20647());
    return events;
}

function defect0324aa5e ()
{
    return {
        "id"       : "0324aa5e-9136-4888-85c7-9027a66121ab",
        "name"     : "Bad color",
        "desc"     : "Color of the product has not the correct RAL value",
        "part_id"  : "1",
        "media_url": "http://machinesandparts.surge.sh/part1/part1_bad_color.jpg",
        "comment"  : "Consider the color only of the lower vertex",
        "taxonomy" : null
    }
}

function event307 ()
{
    return last_eventf57438f4();
}

module.exports = stubs;