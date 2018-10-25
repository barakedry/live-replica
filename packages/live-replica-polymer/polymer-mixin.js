const Replica = require('../replica');
const utils = require('./utils');
const PatcherProxy = require('../proxy');

function elementUtilities(element) {
    return {
        __unsubscribers: new WeakSet(),


        replicaByData(data) {

            if (!PatcherProxy.proxyProperties.has(data)) {
                return undefined;
            }

            const root = PatcherProxy.getRoot(data);
            const basePath = PatcherProxy.getPath(data);
            const replica = PatcherProxy.proxyProperties.get(root).patcher;

            return {replica, basePath};
        },

        watch(data, path, cb) {
            let { replica } = this.replicaByData(data);

            let render = this.render;
            let property;
            ({path, property} = utils.extractBasePathAndProperty(path));

            if (path) {
                replica = replica.at(path);
            }

            const unsubscribe = replica.subscribe(function (patch, diff) {

                let lengthChanged = property === 'length' && (diff.hasAdditions || diff.hasDeletions);

                if (!lengthChanged && !patch[property]) { return; }

                if (cb) {
                    cb.call(element, patch, replica.get(property));
                }

                if (typeof render === 'function') {
                    render(patch, replica.get(property));
                }
            });

            const unwatch = function () {
                this.__unsubscribers.delete(unsubscribe);
                unsubscribe();
            };

            this.__unsubscribers.add(unsubscribe);

            return unwatch;
        },

        clearAll() {
            // this.__replicas.forEach(replica => {
            // });
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
            this.liveReplica.clearAll();
            super.disconnectedCallback();
        };
    };
};

