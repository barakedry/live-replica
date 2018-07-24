const Replica = require('@live-replica/replica');

module.exports = function LitHtmlMixin(base) {
    return class extends base {

        liveReplica(pathOrBaseReplica) {
            let replica;
            if (typeof pathOrBaseReplica === 'string') {
                replica = new Replica(pathOrBaseReplica);
            } else {
                replica = pathOrBaseReplica;
            }

            if (!this.__replicas) {
                this.__replicas = [];
            }

            this.__replicas.push(replica);

            return replica;
        }

        disconnectedCallback() {
            super.disconnectedCallback();
            if (this.__replicas) {
                this.__replicas.forEach((replica) => {
                    replica.disconnect();
                });
            }
        };

        $LR (replica, path) {

            if (!this.__replicaDirectivesCache) {
                this.__replicaDirectivesCache = new WeakSet();
            }

            const lastPart = path.lastIndexOf('.');
            let r, property;
            if (lastPart === -1) {
                property = path;
                r = replica;

                if (this.__replicaDirectivesCache.has(replica)) {
                    this.__replicaDirectivesCache.has(replica)
                }

            } else {
                property = path.substr(lastPart);
                path = path.substr(0, lastPart);
                r = replica.at(path);
            }






            const directive = (part)  => {
                r.subscribe((diff) => {
                    if (diff[property]) {
                        part.setValue(r.get(property));
                    }
                });
            };

            directive.__litDirective = true;

            return directive;
        }

    };
};
