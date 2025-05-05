"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replicaByData = replicaByData;
exports.concatPath = concatPath;
exports.extractBasePathAndProperty = extractBasePathAndProperty;
// @ts-nocheck
const client_1 = require("../client");
function replicaByData(data) {
    if ((0, client_1.isProxy)(data)) {
        const patcher = (0, client_1.getPatchDiff)(data);
        // const root = PatcherProxy.getRoot(data);
        // const basePath = PatcherProxy.getPath(data);
        // const replica = PatcherProxy.proxyProperties.get(root).patcher;
        return { replica: patcher.root, basePath: patcher._path };
    }
    else if (data instanceof client_1.Replica) {
        return { replica: data, basePath: '' };
    }
}
function concatPath(path, suffix) {
    if (path && suffix) {
        return [path, suffix].join('.');
    }
    return path || suffix;
}
function extractBasePathAndProperty(path = '') {
    const lastPart = path.lastIndexOf('.');
    if (lastPart === -1) {
        return { property: path, path: '' };
    }
    let property = path.substr(lastPart + 1);
    path = path.substr(0, lastPart);
    return { path, property };
}
//# sourceMappingURL=utils.js.map