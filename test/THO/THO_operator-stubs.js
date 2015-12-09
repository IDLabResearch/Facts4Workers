/**
 * Created by joachimvh on 9/12/2015.
 */

var stubs = {
    'http://mstate.tho.f4w.l0g.in/api/machines': machines,
    'http://skillp.tho.f4w.l0g.in/api/operator_skills/': operators,
    'http://skillp.tho.f4w.l0g.in/api/operator_skills/3': operator3,
    'http://defects.tho.f4w.l0g.in/api/defects?part_id=1': defects1
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
                 skills: { tool: 3, machine: 3, computer: 3 } } ];
}

function operator3 ()
{
    return { "id": 3,
             "name": "Bob Bones",
             "desc": "Oldest operator in town",
             "role": "Operator",
             "skills": { "tool": 3, "machine": 3, "computer": 3 } };
}

function defects1 ()
{
    return [{"id":1,"name":"Bad color","desc":"Color of the product has not the correct RAL value","part_id":"1","media_url":"http://machinesandparts.surge.sh/part1/part1_bad_color.jpg","comment":"Consider the color only of the lower vertex","taxonomy":null,"created_at":"2015-11-27T16:45:57.076Z"},{"id":2,"name":"Craked","desc":"The product present a large crack","part_id":"1","media_url":"http://machinesandparts.surge.sh/part1/part1_craked.jpg","comment":"Crack is critical only when dimension is larger than 2 mm2","taxonomy":null,"created_at":"2015-11-27T16:45:57.090Z"},{"id":3,"name":"Hole","desc":"Hole on the border of the product","part_id":"1","media_url":"http://machinesandparts.surge.sh/part1/part1_hole.jpg","comment":"The product has a hole on the side, critical when wider than 1 mm","taxonomy":null,"created_at":"2015-11-27T16:45:57.101Z"},{"id":4,"name":"Missing part","desc":"A part of the product is missing","part_id":"1","media_url":"http://machinesandparts.surge.sh/part1/part1_missing_part.jpg","comment":"Note the number of the figure of the die","taxonomy":null,"created_at":"2015-11-27T16:45:57.115Z"}];
}

module.exports = stubs;