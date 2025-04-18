export function concatPath(path: string, suffix: string): string {
    if (path && suffix) {
        return `${path}.${suffix}`;
    }

    return path || suffix;
}

export function isValid(val: any) {
    // val === val for cases val is NaN value
    return val === val;
}

export function pushKeyToPath(path = '', key = '', isIndex = !isNaN(Number(key))) {
    if (isIndex) {
        return `${path}[${key}]`;
    } else {
        return concatPath(path, key);
    }
}

export function pathParts(path: string) {
    const parts: (string | number)[] = [];
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
                char = path[i]

                // key
                if (char === '"') {
                    i++;
                    char = path[i];
                    let key = '';
                    while (char !== '"' && i < len) {
                        key += char
                        i++;
                        char = path[i];
                    }
                    parts.push(key);
                    i++; // skip closing "
                    i++; // skip closing ]
                    // number
                } else {
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

export function splitPathAndLastKey(fullPath: string) {
    let key: string, path: string, index: number | undefined = undefined;
    const dotIndex = fullPath.lastIndexOf('.');
    const stringBracketIndex = fullPath.lastIndexOf('["');
    const bracketIndex = fullPath.lastIndexOf('[');

    if (dotIndex === -1 && bracketIndex === -1) {
        return {path: '', key: fullPath};
    }

    if (dotIndex > bracketIndex) {
        key = fullPath.substring(dotIndex + 1);
        path = fullPath.substring(0, dotIndex);
    } else if (stringBracketIndex >= bracketIndex) {
        key = fullPath.substring(stringBracketIndex + 2, fullPath.length -2);
        path = fullPath.substring(0, stringBracketIndex);
    } else {
        key = fullPath.substring(bracketIndex + 1, fullPath.length -1);
        path = fullPath.substring(0, bracketIndex);
        index = Number(key);
    }

    return  { path, key, index };
}

export function lastPathKey(path: string): string {
    const dotIndex = path.lastIndexOf('.');
    const stringBracketIndex = path.lastIndexOf('["');
    const bracketIndex = path.lastIndexOf('[');

    if (dotIndex > bracketIndex) {
        return path.substring(dotIndex + 1);
    } else if (stringBracketIndex > bracketIndex) {
        return path.substring(stringBracketIndex + 2, path.length -2);
    } else {
        return Number(path.substring(bracketIndex + 1, path.length -1)).toString();
    }
}

export function firstKey(path: string): string {
    const dotIndex = path.indexOf('.');
    const bracketIndex = path.indexOf('[');
    const stringBracketIndex = path.indexOf('["');

    if (dotIndex === -1 && bracketIndex === -1 && stringBracketIndex === -1) {
        return path;
    }

    if (bracketIndex === -1 && stringBracketIndex === -1) {
        return path.substring(0, dotIndex);
    } else if (dotIndex === -1 && stringBracketIndex === -1) {
        return path.substring(0, bracketIndex);
    } else if (dotIndex === -1 && bracketIndex === -1) {
        return path.substring(0, stringBracketIndex);
    } else {
        return path.substring(0, Math.min(...[dotIndex, bracketIndex, stringBracketIndex].filter( i => i !== -1)));
    }
}

export function parentPath(path: string) {
    const dotIndex = path.lastIndexOf('.');
    const stringBracketIndex = path.lastIndexOf('["');
    const bracketIndex = path.lastIndexOf('[');

    if (dotIndex > bracketIndex) {
        return path.substring(0, dotIndex);
    } else if (stringBracketIndex > bracketIndex) {
        return path.substring(0, stringBracketIndex);
    }

    return path.substring(0, bracketIndex);
}

export function wrapByPath(value: any, path: string) {
    let levels: (string | number)[],
        wrapper: Record<string, any>,
        curr: Record<string, any>,
        i: number,
        len: number;

    if (!path) {
        return value;
    }

    levels = pathParts(path);
    len = levels.length;
    i = 0;
    wrapper = {};
    curr = wrapper;

    while (i < (len - 1)) {
        curr[levels[i]] = {};
        curr = curr[levels[i]];
        i++;
    }

    curr[levels[i]] = value;

    return wrapper;
}

export function hasSamePrototype(obj1: any, obj2: any) {
    return (typeof obj1 === 'object' && obj1 !== null) && Object.getPrototypeOf(obj1) === Object.getPrototypeOf(obj2);
}

export function once(fn: (...args: any[]) => any) {
    let lastResult: any, called = false;
    return function (...args: any[]) {
        if (called) { return lastResult; }

        lastResult = fn.call(
            // @ts-expect-error
            this,
            ...args
        );
        // @ts-expect-error
        fn = null;
        called = true;
        return lastResult
    }
}

export function createWrapperWithLastKey(path: string) {
    const {path: basePath, key, index} = splitPathAndLastKey(path);
    let lastKey: string | number, wrapperInner: Record<string, any>;

    const wrapper = {};

    if (!isNaN(index!)) {
        lastKey = index!;
    } else {
        lastKey = key;
    }

    if (!basePath) {
        wrapperInner = wrapper;
    } else {

        const parts = Utils.pathParts(basePath);

        let nextKeyType = typeof parts[0];

        wrapperInner = wrapper;
        parts.forEach((part, index) => {
            const nextKey = index + 1 < parts.length ? parts[index + 1] : lastKey;
            wrapperInner[part] = {};
            wrapperInner = wrapperInner[part];
        });

    }

    return {wrapper, wrapperInner, lastKey}
}

export function fixNumericParts(path: string) {
    const parts = path.split('.');
    const result: string[] = [];

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];

        if (part.match(/^\d+$/)) {
            // If the part is a number, replace with square brackets notation
            if (i > 0) {
                result[i - 1] = result[i - 1] + `[${part}]`;
            } else {
                result.push(`[${part}]`);
            }

        } else {
            result.push(part);
        }
    }

    return result.join('.');
}

export function pickWithKeys(obj: Record<string, any>, keys: string[], allowEmptyObject = false) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const result: Record<string, any> = {};
    keys.forEach((key) => {
        if (obj.hasOwnProperty(key)) {
            result[key] = obj[key];
        }
    });

    if (!allowEmptyObject && Object.keys(result).length === 0) {
        return undefined;
    }

    return result;
}

export const SERIALIZED_FUNCTION = 'function()';

export const Utils = {
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
    SERIALIZED_FUNCTION
};