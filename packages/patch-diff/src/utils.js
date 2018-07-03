/**
 * Created by barakedry on 6/19/15.
 */
'use strict';

let Utils = {
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
    wrapByPath: function wrapByPath(value, path) {

        let levels,
            wrapper,
            curr,
            i,
            len;

        if (!path) {
            return value;
        }

        levels = path.split('.');
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
        return typeof obj1 === 'object' && Object.getPrototypeOf(obj1) === Object.getPrototypeOf(obj2);
    },

    SERIALIZABLE_FUNCTION: {
        toJSON: function () {
            return 'function()';
        }
    }
};

module.exports = Utils;
