/**
 * Created by joachimvh on 9/12/2015.
 */

var assert = require('assert');
var _ = require('lodash');

var stubs = {
    'http://mstate.tho.f4w.l0g.in/api/machines': machines,
    'http://machinesandparts.surge.sh/api/parts.json': parts,
    'http://skillp.tho.f4w.l0g.in/api/operator_skills/': operators,
    'http://skillp.tho.f4w.l0g.in/api/operator_skills/2': operator2,
    'http://defects.tho.f4w.l0g.in/api/defects?part_id=1': defects1,
    'http://defects.tho.f4w.l0g.in/api/solutions?defect_id=1': solutions1,
    'http://mstate.tho.f4w.l0g.in/api/machines/1/events': postEvent1,
    'http://defects.tho.f4w.l0g.in/api/solutions/1': solution1,
    'http://defects.tho.f4w.l0g.in/api/solutions/3': solution3,
    'http://defects.tho.f4w.l0g.in/api/reports': postReport
};

function machines ()
{
    return [ { id: 2,
                 name: 'Turning Machine',
                 desc: 'MoriSeki TurninMachine',
                 state: 3,
                 optional: { media_url: 'http://machinesandparts.surge.sh/machines/red_machine.jpg' } },
             { id: 1,
                 name: 'Cooling machine',
                 desc: 'Machine used for cooling purposes',
                 state: 1,
                 optional: { media_url: 'http://machinesandparts.surge.sh/machines/grey_machine.jpg' } } ];
}

function parts ()
{
    return [
        {
            id: 1,
            name: "Pinion",
            image_url: "http://machinesandparts.surge.sh/part1/part1_ok.jpg"
        },
        {
            id: 2,
            name: "Carter",
            image_url: "http://machinesandparts.surge.sh/part2/part2_ok.jpg"
        },
        {
            id: 3,
            name: "Handle",
            image_url: "http://machinesandparts.surge.sh/part3/part3_ok.jpg"
        },
        {
            id: 4,
            name: "Flange",
            image_url: "http://machinesandparts.surge.sh/part4/part4_ok.jpg"
        }
    ]
}

function operators ()
{
    return [ { id: 1,
        name: 'Johnny Jones',
        desc: 'Good old Jimmy\'s brother, expert at nothing',
        role: 'Operator',
        skills: { tool: 1, machine: 1 } },
             { id: 2,
                 name: 'Abram Abes',
                 desc: 'Jack of all trades, master of none',
                 role: 'Operator',
                 skills: { tool: 1, machine: 2, computer: 1 } },
             { id: 3,
                 name: 'Bob Bones',
                 desc: 'Oldest operator in town',
                 role: 'Operator',
                 skills: { tool: 3, machine: 3, computer: 3 } },
             { id: 4,
                 name: 'Carl Cheese',
                 desc: 'The old Carl',
                 role: 'Team Leader',
                 skills: { tool: 3, machine: 3, computer: 3 } } ];
}

function operator2 ()
{
    return { id: 2,
               name: 'Abram Abes',
               desc: 'Jack of all trades, master of none',
               role: 'Operator',
               skills: { tool: 1, machine: 2, computer: 1 } };
}

function defects1 ()
{
    return [ { id: 1,
                 name: "Bad color",
                 desc: "Color of the product has not the correct RAL value",
                 part_id: "1",
                 media_url: "http://machinesandparts.surge.sh/part1/part1_bad_color.jpg",
                 comment: "Consider the color only of the lower vertex",
                 taxonomy: null, created_at: "2015-11-27T16:45:57.076Z" },
             { id: 2,
                 name: "Craked",
                 desc: "The product present a large crack",
                 part_id: "1",
                 media_url: "http://machinesandparts.surge.sh/part1/part1_craked.jpg",
                 comment: "Crack is critical only when dimension is larger than 2 mm2",
                 taxonomy: null,
                 created_at:"2015-11-27T16:45:57.090Z" },
             { id: 3,
                 name: "Hole",
                 desc: "Hole on the border of the product",
                 part_id: "1",
                 media_url: "http://machinesandparts.surge.sh/part1/part1_hole.jpg",
                 comment: "The product has a hole on the side, critical when wider than 1 mm",
                 taxonomy: null,
                 created_at: "2015-11-27T16:45:57.101Z" },
             { id: 4,
                 name: "Missing part",
                 desc: "A part of the product is missing",
                 part_id: "1",
                 media_url: "http://machinesandparts.surge.sh/part1/part1_missing_part.jpg",
                 comment: "Note the number of the figure of the die",
                 taxonomy:null,
                 created_at: "2015-11-27T16:45:57.115Z" } ];
}

function solutions1 ()
{
    return [ { id: 1,
                 name: "replace color feeder",
                 desc: "do this, fix that, clean all",
                 defect_id: 1,
                 comment: "check product expiry date",
                 skill: { tool: 2, machine: 1 } },
             { id: 2,
                 name: "clean product feeder",
                 desc: "do this, fix that, clean all",
                 defect_id: 1,
                 comment: "use_XXX for cleaning",
                 skill: { tool: 2, machine: 1 } },
             { id: 3,
                 name: "change die",
                 desc: "do this, fix that, clean all",
                 defect_id: 1,
                 comment: "replace screws",
                 skill: { tool: 1, machine: 2 } } ];
}

function postEvent1 (body)
{
    var stop = {name:"Stop the machine",desc:"Stoping the machine after a defect was spotted!",machine_state:"4",operator_id:2,optional:{defect_id:1}};
    var start = {desc:"Starting the machine after a solution was successfully applied!",machine_state: "1",name:"Starting the machine",operator_id:2};
    var teamleader = {name:"waiting_for_teamleader",desc:"Stoping the machine. Problem has to be fixed by the team leader.",machine_state:"3",operator_id:2,optional:{defect_id:1,stopped_for_defect_event_id:123}};
    if (body.machine_state === '1')
        assert.deepEqual(body, start);
    else if (body.machine_state === '3')
        assert.deepEqual(body, teamleader);
    else if (body.machine_state === '4')
        assert.deepEqual(body, stop);
    return { id: 123 };
}

function solution1 ()
{
    return { id: 1,
        name: "replace color feeder",
        desc: "do this, fix that, clean all",
        defect_id: 1,
        comment: "check product expiry date",
        skill: { tool: 2, machine: 1 } };
}

function solution3 ()
{
    return { id: 3,
               name: "change die",
               desc: "do this, fix that, clean all",
               defect_id: 1,
               comment: "replace screws",
               skill: { tool: 1, machine: 2 } };
}

function postReport (body)
{
    assert.strictEqual(body.event_id, 123);
    assert.strictEqual(body.operator_id, 2);
    assert.strictEqual(body.solution_id, 3);
    assert(_.isBoolean(body.success));
    return {};
}

module.exports = stubs;