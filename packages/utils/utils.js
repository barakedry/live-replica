export const Utils = {
    isValid: function (val) {
        // val === val for cases val is NaN value
        return val === val;
    },
    concatPath: function (path, suffix) {
        if (path && suffix) {
            return [path, suffix].join('.');
        }

        return path || suffix;
    },
    pushKeyToPath: function (path = '', key = '', isIndex = !isNaN(key)) {

        if (isIndex) {
            return `${path}[${key}]`;
        } else {
            return this.concatPath(path, key);
        }
    },

    pathParts: function pathParts(path) {
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

                    let num = '';
                    i++;
                    char = path[i]
                    while (char !== ']' && i < len) {
                        num = `${num}${char}`;
                        i++;
                        char = path[i];
                    }

                    parts.push(Number(num));
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
    },

    splitPathAndLastKey: function(fullPath) {
        let key, path, index;
        const dotIndex = fullPath.lastIndexOf('.');
        const bracketIndex = fullPath.lastIndexOf('[');
        if (dotIndex > bracketIndex) {
            key = fullPath.substring(dotIndex + 1);
            path = fullPath.substring(0, dotIndex);
        } else {
            key = fullPath.substring(bracketIndex + 1, fullPath.length -1);
            path = fullPath.substring(0, bracketIndex);
            index = Number(key);
        }

        return  {path, key, index};
    },

    lastPathKey: function(path) {
        const dotIndex = path.lastIndexOf('.');
        const bracketIndex = path.lastIndexOf('[');
        if (dotIndex > bracketIndex) {
            return path.substring(dotIndex + 1);
        } else {
            return Number(path.substring(bracketIndex + 1, path.length -1));
        }
    },

    parentPath(path) {
        const dotIndex = path.lastIndexOf('.');
        const bracketIndex = path.lastIndexOf('[');
        if (dotIndex > bracketIndex) {
            return path.substring(0, dotIndex);
        }
        return path.substring(0, bracketIndex);
    },

    wrapByPath: function wrapByPath(value, path) {

        let levels,
            wrapper,
            curr,
            i,
            len;

        if (!path) {
            return value;
        }

        levels = this.pathParts(path);
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
    },

    hasSamePrototype: function (obj1, obj2) {
        return (typeof obj1 === 'object' && obj1 !== null) && Object.getPrototypeOf(obj1) === Object.getPrototypeOf(obj2);
    },

    once(fn) {
        let lastResult, called = false;
        return function (...args) {
            if (called) { return lastResult; }

            lastResult = fn.call(this, ...args);
            fn = null;
            called = true;
            return lastResult
        }
    },

    createWrapperWithLastKey(path) {
        const {path: basePath, key, index} = this.splitPathAndLastKey(path);
        let lastKey, wrapper, wrapperInner;

        if (index !== undefined) {
            lastKey = index;
        } else {
            lastKey = key;
        }
        if (basePath) {

            const parts = Utils.pathParts(basePath);

            let nextKeyType = typeof parts[0];
            if (nextKeyType === 'number') {
                wrapper = [];
            } else {
                wrapper = {};
            }

            wrapperInner = wrapper;
            parts.forEach((part, index) => {
                const nextKey = index + 1 < parts.length ? parts[index + 1] : lastKey;
                wrapperInner[part] = typeof nextKey === 'number' ? [] : {};
                wrapperInner = wrapperInner[part];
            });

        } else {
            wrapper = index !== undefined ? [] : {};
            wrapperInner = wrapper;
        }

        return {wrapper, wrapperInner, lastKey}
    },

    SERIALIZED_FUNCTION: 'function()'
};