const Replica = require('@live-replica/replica');
const utils = require('./utils');
const PatcherProxy = require('@live-replica/proxy');

function elementUtilities(element) {
    return {
        __replicas: new Map(),

        attach(replica) {
            const data = replica.data;
            this.__replicas.set(data, replica);
            return data;
        },

        replicaByData(data) {

            if (!PatcherProxy.proxyProperties.has(data)) {
                return undefined;
            }

            const root = PatcherProxy.getRoot(data);
            const basePath = PatcherProxy.getPath(data);
            const replica = this.__replicas.get(root);

            return {replica, basePath};
        },

        watch(data, path, cb) {
            let replica = this.__replicas.get(data);

            let render = this.render;
            let property;
            ({path, property} = utils.extractBasePathAndProperty(path));

            if (path) {
                replica = replica.at(path);
            }
            replica.subscribe(function (patch, diff) {

                let lengthChanged = property === 'length' && (diff.hasAdditions || diff.hasDeletions);

                if (!lengthChanged && !patch[property]) { return; }

                if (cb) {
                    cb.call(element, patch, replica.get(property));
                }

                if (typeof render === 'function') {
                    render(patch, replica.get(property));
                }
            });
        },

        get ready() {
            return Promise.all(Array.from(this.__replicas.entries()).map(replica => replica.existance));
        },

        clearAll() {
            this.__replicas.entries().forEach(replica => {
                //replica
            });
        }
    };
}


module.exports = function PolymerBaseMixin(base) {
    return class extends base {

        constructor() {
            super();
            this.liveReplica = elementUtilities(this);
        }

        disconnectedCallback() {
            super.disconnectedCallback();
            this.liveReplica.clearAll();
        };
    };
};

