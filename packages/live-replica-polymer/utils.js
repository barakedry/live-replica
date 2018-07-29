module.exports = {
    extractBasePathAndProperty(path) {
        const lastPart = path.lastIndexOf('.');
        if (lastPart === -1) {
            return {property: path, path: ''};
        }

        let property = path.substr(lastPart + 1);
        path = path.substr(0, lastPart);
        return {path, property};
    }
};