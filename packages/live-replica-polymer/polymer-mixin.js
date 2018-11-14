const Replica = require('../replica');
const utils = require('./utils');
const PatcherProxy = require('../proxy');

function elementUtilities(element) {
    return {
        __unsubscribers: new WeakSet(),

        replicaByData(data) {
            if (PatcherProxy.proxyProperties.has(data)) {
                const root = PatcherProxy.getRoot(data);
                const basePath = PatcherProxy.getPath(data);
                const replica = PatcherProxy.proxyProperties.get(root).patcher;

                return {replica, basePath};
            } else if (data instanceof Replica) {
                return {replica: data, basePath: ''};
            }
        },

        watch(data, path, cb) {
            let { replica, basePath } = this.replicaByData(data);

            let render = this.render;
            let property;
            ({path, property} = utils.extractBasePathAndProperty(path));

            path = utils.concatPath(basePath, path);
            if (path) {
                replica = replica.at(path);
            }

            const unsubscribe = replica.subscribe(function (patch, diff) {

                let lengthChanged = property === 'length' && (diff.hasAdditions || diff.hasDeletions);

                if (!lengthChanged && !patch[property]) { return; }

                let doRender = true;

                if (cb) {
                    const cbReturn = cb.call(element, patch, diff, replica.get(property));
                    if (cbReturn === false) {
                        doRender = false;
                    }
                }

                if (typeof render === 'function' && doRender) {
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

