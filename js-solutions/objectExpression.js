"use strict"

/* ===== ERRORS SECTION ===== */

let ParseError = function(message) {
    this.message = message;
}

ParseError.prototype = Object.create(Error.prototype);
ParseError.prototype.constructor = ParseError;
ParseError.prototype.name = "ParseError";

let createError = function(name, message) {
    const error = function(...args) {
        ParseError.call(this, message(...args));
    }
    error.prototype = Object.create(ParseError.prototype);
    error.prototype.constructor = error;
    error.prototype.name = name;
    return error;
}

const InvalidOperationError = createError(
    "InvalidOperationError", (pos, operation) => {
        `Invalid operation at position ${pos}: ${operation}`
    }
);

const InvalidTokenError = createError(
    "InvalidTokenError", (pos, expected, found) => {
        `Invalid token at position ${pos}: expected ${expected}, but found ${found}`
    }
);

const InvalidVariableNameError = createError(
    "InvalidVariableNameError", (invalidName) => {
        `${invalidName} is not a valid variable name`
    }
);

const MissingBrackerError = createError(
    "MissingBracketError", (pos, found) => {
        `There must be closing bracket (')'), but found ${found} at pos ${pos}`
    }
);

const NumberFormatError = createError( 
    "NumberFormatError", (pos, found) => {
        `Expected whitespace or brackets, but found ${found} at pos ${pos}`
    }
);

const UnexpectedCharacterError = createError(
    "UneexpectedCharacterError", (pos) => {
        `Unexpected character at pos ${pos}`
    }
);

const EmptyExpressionError = createError(
    "EmptyExpressionError", () => "String must contain an non-empty arithmetic expression"
);

/* ===== OPERATIONS SECTION ===== */

let AbstractOperation = function(...args) {
    this.args = args;
}

AbstractOperation.prototype.evaluate = function(x, y, z) {
    return this.operate(...this.args.map(argument => argument.evaluate(x, y, z)));
}

AbstractOperation.prototype.diff = function(name) {
    return this.differentiate(name, ...this.args);
}

AbstractOperation.prototype.toString = function() {
    return this.args.map(argument => argument.toString()).join(' ') + " " + this.symbol;
}

AbstractOperation.prototype.prefix = function() {
    return "(" + this.symbol + " " + this.args.map(argument => argument.prefix()).join(' ') + ")";
}

let createOperation = function(symbol, func, differentiate) {
    const operation = function(...args) {
        AbstractOperation.call(this, ...args);
    }
    operation.prototype = Object.create(AbstractOperation.prototype);
    operation.prototype.symbol = symbol;
    operation.prototype.operate = func;
    operation.prototype.differentiate = differentiate;
    return operation;
}

const Add = createOperation(
    "+",
    (a, b) => a + b,
    (v, a, b) => new Add(a.diff(v), b.diff(v))
);

const Subtract = createOperation(
    "-",
    (a, b) => a - b,
    (v, a, b) => new Subtract(a.diff(v), b.diff(v))
);

const Multiply = createOperation(
    "*",
    (a, b) => a * b,
    (v, a, b) => new Add(new Multiply(a.diff(v), b), new Multiply(a, b.diff(v)))
);

const Divide = createOperation(
    "/",
    (a, b) => a / b,
    (v, a, b) => new Divide(
        new Subtract(new Multiply(a.diff(v), b), new Multiply(a, b.diff(v))),
        new Multiply(b, b)
    )
);

const Negate = createOperation(
    "negate",
    (a) => -a,
    (v, a) => new Negate(a.diff(v))
);

let ONE = new Const(1);
let ZERO = new Const(0);

function Const(value) {
    this.value = value;
    this.evaluate = function(x, y, z) {
        return this.value;
    };

    this.toString = function() {
        return this.value + "";
    };

    this.diff = function(name) {
        return ZERO; // :NOTE: new
    }

    this.prefix = function() {
        return this.value + "";
    }

    this.postfix = function() {
        return this.value;
    }
}

let variables = ["x", "y", "z"];

function Variable(name) {
    this.name = name;

    this.evaluate = function(x, y, z) {
        return (arguments[variables.indexOf(name)]);
    };

    this.toString = function() {
        return this.name;
    };

    this.diff = function(x) {   
        if (x === name) {
            return ONE;
        } else {
            return ZERO;
        }
    }

    this.prefix = function() {
        return this.name;
    }

    this.postfix = function() {
        return this.name;
    }
}

const sumrecN = function(len) {
    let op = createOperation(
        "sumrec",
        (...args) => args.reduce((partialSum, a) => partialSum + (1.0 / a), 0),
        (v, ...args) => args.reduce((partialSum, a) => new Add(
            partialSum,
            new Divide(
                new Const(1),
                a
            )
        ), new Const(0)).diff(v)
    )
    op.prototype.symbol = "sumrec" + len;
    return op;
}

// :NOTE: копипаста с sumrecN
const hmeanN = function(len) {
    let op = createOperation(
        "hmean", 
        (...args) => len / args.reduce((partialSum, a) => partialSum + (1.0 / a), 0),
        (v, ...args) => new Divide(
            new Const(len),
            args.reduce((partialSum, a) => new Add(
                partialSum,
                new Divide(
                    new Const(1),
                    a
                )
            ), new Const(0))
        ).diff(v)
    )
    op.prototype.symbol = "hmean" + len;
    return op;
}
// :NOTE: хочется записать объявление всех Sumrec* в одну строку
let Sumrec2 = sumrecN(2);

let Sumrec3 = sumrecN(3);

let Sumrec4 = sumrecN(4);

let Sumrec5 = sumrecN(5);

let HMean2 = hmeanN(2);

let HMean3 = hmeanN(3);

let HMean4 = hmeanN(4);

let HMean5 = hmeanN(5);

let operations = {
    "+": [Add, 2], "-": [Subtract, 2],
    "*": [Multiply, 2], "/": [Divide, 2],
    "negate": [Negate, 1],
    "sumrec2": [Sumrec2, 2], "sumrec3": [Sumrec3, 3], 
    "sumrec4": [Sumrec4, 4], "sumrec5": [Sumrec5, 5],
    "hmean2": [HMean2, 2], "hmean3": [HMean3, 3], 
    "hmean4": [HMean4, 4], "hmean5": [HMean5, 5]
};

/* ===== TOKENIZER SECTION ===== */

let getToken = (expression, pos, checker) => {
    let word = expression[pos];
    pos++;
    while (pos < expression.length && checker(expression[pos])) {
        word += expression[pos++];
    }
    return [word, pos];
}

let tokenize = (expression) => {
    let pos = 0;
    let tokens = [];
    while (pos < expression.length) {
        let currentChar = expression[pos];
        if (currentChar === '(') {
            tokens.push({
                "type": "LEFTBRACKET",
                "value": "("
            });
            pos++;
        }
        else if (currentChar === ')') {
            tokens.push({
                "type": "RIGHTBRACKET",
                "value": ")"
            });
            pos++;
        }
        else if (currentChar === '*') {
            tokens.push({
                "type": "OPERATION",
                "value": Multiply
            });
            pos++;
        }
        else if (currentChar === '/') {
            tokens.push({
                "type": "OPERATION",
                "value": Divide
            });
            pos++;
        }
        else if (currentChar === '+') {
            tokens.push({
                "type": "OPERATION",
                "value": Add
            });
            pos++;
        }
        else if (currentChar === '-') {
            tokens.push({
                "type": "OPERATION",
                "value": Subtract
            });
            pos++;
        }
        else if (currentChar.match(/[a-z]/i)) {
            let word = expression[pos];
            pos++;
            while (pos < expression.length && expression[pos].match(/[a-z]/i)) {
                word += expression[pos++];
            }
            if (!(word in operations)) {
                if (variables.includes(word)) {
                    tokens.push({
                        "type": "VARIABLE",
                        "value": word
                    });
                }
                else {
                    console.log(`Error at ${pos}, with word ${word}`);
                    throw new InvalidOperationError(pos - word.length, word);
                }
            }
            else {
                tokens.push({
                    "type": "OPERATION",
                    "value": (word) => {
                        switch (word) {
                            case '*':
                                return Multiply;
                            case '/':
                                return Divide;
                            case '-':
                                return Subtract;
                            case '+':
                                return Add;
                            case 'negate':
                                return Negate;
                            
                        }
                    }
                });
            }
        }
        else if (currentChar === ' ') {
            pos++;
        }
        else if (!isNaN(currentChar)) {
            let word = expression[pos];
            pos++;
            while (pos < expression.length && !isNaN(expression[pos])) {
                word += expression[pos++];
            }
            // if (pos + 1 < expression.length && !(expression[pos + 1] in [' ', '(', ')'])) {
            //     throw new NumberFormatError(pos + 1, expression[pos + 1]);
            // }
            tokens.push({
                "type": "NUMBER",
                "value": parseInt(word)
            });
        }
        else {
            throw new UnexpectedCharacterError(pos);
        }
    }
    return tokens;
}

/* ===== PARSE SECTION ===== */

let parse = (expression) => {
    let stack = [];
    let tokens = expression.trim().split(/\s+/);
    for (let token of tokens) {
        if (token in operations) {
            let operation = operations[token][0];
            let argc = operations[token][1];
            let args = stack.splice(stack.length - argc);
            let result = new operation(...args);
            stack.push(result);
        } else {
            if (!isNaN(token)) {
                stack.push(new Const(parseInt(token)));
            }
            // :NOTE: переменных ограниченное количество и их надо проверять
            else {
                stack.push(new Variable(token));
            }
        }
    }
    return stack.pop();
};

let Parser = function(expression) {
    this.pos = 0;
    this.expression = expression;
    this.tokens = tokenize(this.expression);
    this.back = (shift) => this.pos -= shift;
    this.take = () => this.tokens[this.pos++];
}

const parsePrefPost = (prefpos) => (expression) => {
    if (expression.trim().length === 0) {
        throw new EmptyExpressionError();
    }

    const expressionParser = new Parser(expression);

    let expr = (token) => {
        if (token.type === "LEFTBRACKET") {
            let res = pOperation();
            token = expressionParser.take();
            if (token.type !== "RIGHTBRACKET") {
                throw new MissingBrackerError(expressionParser.pos, token);
            }
            return res;
        }
        else {
            if (token.type === "VARIABLE") {
                return new Variable(token.value);
            }
            else if (token.type === "NUMBER") {
                return new Const(token.value);
            }
        }
    }

    let pOperation = () => {
        let currentOperation;
        if (prefpos === 0) { // prefix
            currentOperation = expressionParser.take();
        }
        let args = [];
        for (; expressionParser.pos < expressionParser.tokens.length; ) {
            let token = expressionParser.take();
            if (token.type === "RIGHTBRACKET") {
                expressionParser.back(1);
                break;
            }
            if (token.type === "OPERATION") {
                break;
            }
            args.push(expr(token));
        }

        if (prefpos === 1) { // postfix
            currentOperation = expressionParser.take();
        }

        if (currentOperation.type !== "OPERATION") {
            throw new InvalidOperationError(expressionParser.pos, currentOperation);
        }

        let op = currentOperation.value;
        return new op(...args);
    }

    const result = expr(expressionParser.take());
    if (expressionParser.pos < expressionParser.tokens.length) {
        throw new UnexpectedCharacterError(expressionParser.pos); 
    }

    return result;
}

const parsePrefix = parsePrefPost(0);
const parsePostfix = parsePrefPost(1);
