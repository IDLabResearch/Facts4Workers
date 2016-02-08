/**
 * Created by joachimvh on 25/01/2016.
 */

var assert = require('assert');
var _ = require('lodash');


var stubs = {
    'http://skillp.tho.f4w.l0g.in/api/operator_skills/': operators,
    'http://mstate.tho.f4w.l0g.in/api/machines': machines,
    'http://mstate.tho.f4w.l0g.in/api/machines/1/last_event': last_event1,
    'http://mstate.tho.f4w.l0g.in/api/machines/2/last_event': last_event2,
    'http://mstate.tho.f4w.l0g.in/api/machines/1/events': events,
    'http://defects.tho.f4w.l0g.in/api/defects/1': defect1,
    'http://machinesandparts.surge.sh/api/parts.json': parts,
    'http://defects.tho.f4w.l0g.in/api/solutions?defect_id=1': solutions1,
    'http://defects.tho.f4w.l0g.in/api/reports?event_id=307': reports307,
    'http://defects.tho.f4w.l0g.in/api/reports': reports,
    'http://mstate.tho.f4w.l0g.in/api/machines/2/events/': events2
};


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

function last_event1 ()
{
    return { id: 308,
        name: "not waiting for teamleader",
        desc: "Something else",
        machine_state: 1,
        machine: 1,
        operator: "1",
        optional: { defect_id: "1" } };
}

function last_event2 ()
{
    return { id: 308,
             name: "waiting_for_teamleader",
             desc: "Stoping the machine. Problem has to be fixed by the team leader.",
             machine_state: 3,
             machine: 2,
             operator: 1,
             optional: { defect_id: 1, stopped_for_defect_event_id:307 } };
}

function events ()
{
    return [last_event1()];
}

function defect1 ()
{
    return { id: 1,
             name: "Bad color",
             desc: "Color of the product has not the correct RAL value",
             part_id: "1",
             media_url: "http://machinesandparts.surge.sh/part1/part1_bad_color.jpg",
             comment: "Consider the color only of the lower vertex",
             taxonomy: null,
             created_at: "2015-11-27T16:45:57.076Z"
    };
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

function reports307 ()
{
    return [ { id: 666,
               event_id: "307",
               solution_id: 3,
               operator_id: "3",
               success: false,
               comment: "not solved!" } ];
}

function reports (report)
{
    if (!report.success)
        assert.deepEqual(report, { event_id: 307, operator_id: 2, solution_id: 333, success: false, comment: 'not solved!' });
    else
        assert.deepEqual(report, { event_id: 307, operator_id: 2, solution_id: 334, success: true, comment: 'solved!' });
    return { id: 999 };
}

function events2 (status)
{
    assert.deepEqual(status, { name: 'Teamleader maintenance finished.', desc: 'Machine fixed.', machine_state: 4, operator_id: 2 });
}

module.exports = stubs;