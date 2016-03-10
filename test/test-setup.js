
var path = require('path');

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

global.TEST = TEST;