"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Utils = exports.SERIALIZED_FUNCTION = void 0;
exports.concatPath = concatPath;
exports.isValid = isValid;
exports.pushKeyToPath = pushKeyToPath;
exports.pathParts = pathParts;
exports.splitPathAndLastKey = splitPathAndLastKey;
exports.lastPathKey = lastPathKey;
exports.firstKey = firstKey;
exports.parentPath = parentPath;
exports.wrapByPath = wrapByPath;
exports.hasSamePrototype = hasSamePrototype;
exports.once = once;
exports.createWrapperWithLastKey = createWrapperWithLastKey;
exports.fixNumericParts = fixNumericParts;
exports.pickWithKeys = pickWithKeys;
function concatPath(path, suffix) {
    if (path && suffix) {
        return [path, suffix].join('.');
    }
    return path || suffix;
}
function isValid(val) {
    // val === val for cases val is NaN value
    return val === val;
}
function pushKeyToPath(path = '', key = '', isIndex = !isNaN(Number(key))) {
    if (isIndex) {
        return `${path}[${key}]`;
    }
    else {
        return concatPath(path, key);
    }
}
function pathParts(path) {
    const parts = [];
    let part = '';
    let i = 0;
    const len = path.length;
    while (i < len) {
        let char = path[i];
        switch (char) {
            case '[': {
                if (part !== '') {
                    parts.push(part);
                    part = '';
                }
                i++;
                char = path[i];
                // key
                if (char === '"') {
                    i++;
                    char = path[i];
                    let key = '';
                    while (char !== '"' && i < len) {
                        key += char;
                        i++;
                        char = path[i];
                    }
                    parts.push(key);
                    i++; // skip closing "
                    i++; // skip closing ]
                    // number
                }
                else {
                    let num = '';
                    while (char !== ']' && i < len) {
                        num = `${num}${char}`;
                        i++;
                        char = path[i];
                    }
                    parts.push(Number(num));
                }
                part = '';
                break;
            }
            case '.': {
                if (part !== '') {
                    parts.push(part);
                    part = '';
                }
                break;
            }
            default: {
                part += char;
            }
        }
        i++;
    }
    if (part !== '') {
        parts.push(part);
    }
    return parts;
}
function splitPathAndLastKey(fullPath) {
    let key, path, index;
    const dotIndex = fullPath.lastIndexOf('.');
    const stringBracketIndex = fullPath.lastIndexOf('["');
    const bracketIndex = fullPath.lastIndexOf('[');
    if (dotIndex === -1 && bracketIndex === -1) {
        return { path: '', key: fullPath };
    }
    if (dotIndex > bracketIndex) {
        key = fullPath.substring(dotIndex + 1);
        path = fullPath.substring(0, dotIndex);
    }
    else if (stringBracketIndex >= bracketIndex) {
        key = fullPath.substring(stringBracketIndex + 2, fullPath.length - 2);
        path = fullPath.substring(0, stringBracketIndex);
    }
    else {
        key = fullPath.substring(bracketIndex + 1, fullPath.length - 1);
        path = fullPath.substring(0, bracketIndex);
        index = Number(key);
    }
    return { path, key, index };
}
function lastPathKey(path) {
    const dotIndex = path.lastIndexOf('.');
    const stringBracketIndex = path.lastIndexOf('["');
    const bracketIndex = path.lastIndexOf('[');
    if (dotIndex > bracketIndex) {
        return path.substring(dotIndex + 1);
    }
    else if (stringBracketIndex > bracketIndex) {
        return path.substring(stringBracketIndex + 2, path.length - 2);
    }
    else {
        return Number(path.substring(bracketIndex + 1, path.length - 1));
    }
}
function firstKey(path) {
    const dotIndex = path.indexOf('.');
    const bracketIndex = path.indexOf('[');
    const stringBracketIndex = path.indexOf('["');
    if (dotIndex === -1 && bracketIndex === -1 && stringBracketIndex === -1) {
        return path;
    }
    if (bracketIndex === -1 && stringBracketIndex === -1) {
        return path.substring(0, dotIndex);
    }
    else if (dotIndex === -1 && stringBracketIndex === -1) {
        return path.substring(0, bracketIndex);
    }
    else if (dotIndex === -1 && bracketIndex === -1) {
        return path.substring(0, stringBracketIndex);
    }
    else {
        return path.substring(0, Math.min(...[dotIndex, bracketIndex, stringBracketIndex].filter(i => i !== -1)));
    }
}
function parentPath(path) {
    const dotIndex = path.lastIndexOf('.');
    const stringBracketIndex = path.lastIndexOf('["');
    const bracketIndex = path.lastIndexOf('[');
    if (dotIndex > bracketIndex) {
        return path.substring(0, dotIndex);
    }
    else if (stringBracketIndex > bracketIndex) {
        return path.substring(0, stringBracketIndex);
    }
    return path.substring(0, bracketIndex);
}
function wrapByPath(value, path) {
    let levels, wrapper, curr, i, len;
    if (!path) {
        return value;
    }
    levels = pathParts(path);
    len = levels.length;
    i = 0;
    wrapper = {};
    curr = wrapper;
    while (i < (len - 1)) {
        // @ts-expect-error: curr may be implicitly any and index signature is missing
        curr[levels[i]] = {};
        // @ts-expect-error: curr may be implicitly any
        curr = curr[levels[i]];
        i++;
    }
    // @ts-expect-error: curr may be implicitly any and index signature is missing
    curr[levels[i]] = value;
    return wrapper;
}
function hasSamePrototype(obj1, obj2) {
    return (typeof obj1 === 'object' && obj1 !== null) && Object.getPrototypeOf(obj1) === Object.getPrototypeOf(obj2);
}
function once(fn) {
    let lastResult, called = false;
    return function (...args) {
        if (called) {
            return lastResult;
        }
        lastResult = fn.call(this, ...args);
        fn = null;
        called = true;
        return lastResult;
    };
}
function createWrapperWithLastKey(path) {
    const { path: basePath, key, index } = splitPathAndLastKey(path);
    let lastKey, 
    // @ts-expect-error: wrapperInner may be implicitly any
    wrapperInner;
    const wrapper = {};
    if (!isNaN(Number(index))) {
        // @ts-expect-error: index may be undefined
        lastKey = index;
    }
    else {
        lastKey = key;
    }
    if (!basePath) {
        wrapperInner = wrapper;
    }
    else {
        const parts = exports.Utils.pathParts(basePath);
        wrapperInner = wrapper;
        parts.forEach((part, index) => {
            const nextKey = index + 1 < parts.length ? parts[index + 1] : lastKey;
            // @ts-expect-error: wrapperInner may be implicitly any
            wrapperInner[part] = {};
            // @ts-expect-error: wrapperInner may be implicitly any
            wrapperInner = wrapperInner[part];
        });
    }
    return { wrapper, wrapperInner, lastKey };
}
function fixNumericParts(path) {
    const parts = path.split('.');
    const result = [];
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part.match(/^\d+$/)) {
            // If the part is a number, replace with square brackets notation
            if (i > 0) {
                result[i - 1] = result[i - 1] + `[${part}]`;
            }
            else {
                result.push(`[${part}]`);
            }
        }
        else {
            result.push(part);
        }
    }
    return result.join('.');
}
function pickWithKeys(obj, keys, allowEmptyObject = false) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    const result = {};
    keys.forEach(key => {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            result[key] = obj[key];
        }
    });
    if (!allowEmptyObject && Object.keys(result).length === 0) {
        return undefined;
    }
    return result;
}
exports.SERIALIZED_FUNCTION = 'function()';
exports.Utils = {
    isValid,
    concatPath,
    pushKeyToPath,
    pathParts,
    splitPathAndLastKey,
    lastPathKey,
    firstKey,
    parentPath,
    wrapByPath,
    hasSamePrototype,
    once,
    createWrapperWithLastKey,
    fixNumericParts,
    pickWithKeys,
    SERIALIZED_FUNCTION: exports.SERIALIZED_FUNCTION
};
//# sourceMappingURL=utils.js.map