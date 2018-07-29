const Replica = require('@live-replica/replica');
const utils = require('./utils');

function elementUtilities(element) {
    return {
        __replicas: new Map(),

        attach(pathOrBaseReplica) {
            let replica;
            if (typeof pathOrBaseReplica === 'string') {
                replica = new Replica(pathOrBaseReplica);
            } else {
                replica = pathOrBaseReplica;
            }

            const data = replica.data;
            this.__replicas.set(data, replica);
            return data;
        },

        replicaByData(data) {
            return this.__replicas.get(data);
        },

        watch(data, path, cb) {
            let replica = this.__replicas.get(data);
            let render = this.render;
            let property;
            ({path, property} = utils.extractBasePathAndProperty(path));

            if (path) {
                replica = replica.at(path);
            }
            replica.subscribe(function (diff) {
                if (cb) {
                    cb.call(element, diff);
                }

                if (typeof render === 'function') {
                    render(diff);
                }
            });
        },

        clearAll() {

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

