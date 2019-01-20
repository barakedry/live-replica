module.exports = {
    concatPath: function (path, suffix) {
        if (path && suffix) {
            return [path, suffix].join('.');
        }

        return path || suffix;
    },
    extractBasePathAndProperty(path = '') {
        const lastPart = path.lastIndexOf('.');
        if (lastPart === -1) {
            return {property: path, path: ''};
        }

        let property = path.substr(lastPart + 1);
        path = path.substr(0, lastPart);
        return {path, property};
    }
};