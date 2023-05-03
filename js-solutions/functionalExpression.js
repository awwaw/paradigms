let cnst = (value) => () => value;

const variables = ["x", "y", "z"];
let variable = (name) => (...args) => args[variables.indexOf(name)];

let operate = (f) => (...args) => (...values) => {
    let arg = args.map((element) => element(...values));
    return arg.reduce((a, b) => f(a, b));
}

let negate = (expr) => (...args) => operate((value) => -value)(...args);

let add = (...args) => operate((a, b) => a + b)(...args);
let subtract = (...args) => operate((a, b) => a - b)(...args);
let multiply = (...args) => operate((a, b) => a * b)(...args);
let divide = (...args) => operate((a, b) => a / b)(...args);

let one = cnst(1);

let two = cnst(2);

let compare = (f) => (a, b) => f(a, b) < 0;

let comparatorMx = (a, b) => a - b;
let comparatorMn = (a, b) => b - a;

let max = (a, b) => compare(comparatorMx)(a, b) ? b : a;
let min = (a, b) => compare(comparatorMn)(a, b) ? b : a;

let minmax = (array, which) => (...values) => {
    let result = array.reduce((a, b) => cnst(which(a(...values), b(...values))));
    return result(...values);
}

let indexOf = (array, mnmx) => (...values) => {
    let vals = array.map((element) => element(...values));
    let result = minmax(array, mnmx)(...values);
    return vals.indexOf(result);
}

let argMin3 = (a, b, c) => (...values) => indexOf([a, b, c], min)(...values);

let argMin5 = (a, b, c, d, e) => (...values) => indexOf([a, b, c, d, e], min)(...values);

let argMax3 = (a, b, c) => (...values) => indexOf([a, b, c], max)(...values);

let argMax5 = (a, b, c, d, e) => (...values) => indexOf([a, b, c, d, e], max)(...values);

let operations = {"+": [add, 2], "-": [subtract, 2], "*": [multiply, 2], "/": [divide, 2],
                 "negate": [negate, 1], "argMin3": [argMin3, 3], "argMax3": [argMax3, 3],
                 "argMin5": [argMin5, 5], "argMax5": [argMax5, 5]};
let constants = {"one": one, "two": two};

let isNumber = (char) => {
    if (typeof char !== 'string') {
        return false;
    }

    if (char.trim() === '') {
        return false;
    }

    return !isNaN(char);
}

let parse = (expression) => {
    let stack = [];
    let tokens = expression.trim().split(/\s+/);
    for (let token of tokens) {
        if (token in constants) {
            stack.push(constants[token]);
        }
        else if (token in operations) {
            let operation = operations[token][0];
            let argc = operations[token][1];
            // :NOTE: splice
            let args = stack.splice(stack.length - argc);
            let result = operation(...args);
            stack.push(result);
        }
        else {
            if (isNumber(token)) {
                stack.push(cnst(parseInt(token)));
            }
            else {
                stack.push(variable(token));
            }
        }
    }
    return stack.pop();
}
