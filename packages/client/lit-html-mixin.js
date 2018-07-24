const Replica = require('@live-replica/replica');

function createDirective(replica, property) {

    const subscribersByPart = new WeakSet();

    const directive = (part) => {

        if (!subscribersByPart.has(part)) {

            const unsub = replica.subscribe((diff) => {
                if (diff[property]) {
                    part.setValue(replica.get(property));
                }
            });

            subscribersByPart.set(part, unsub);
        }
    };
    directive.__litDirective = true;
    return directive;
}

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
            let property;
            if (lastPart === -1) {
                property = path;

            } else {
                property = path.substr(lastPart);
                path = path.substr(0, lastPart);
                replica = replica.at(path);
            }

            let replicasDirectives = this.__replicaDirectivesCache.get(replica);
            if (!replicasDirectives) {
                replicasDirectives = {};
                this.__replicaDirectivesCache.set(replica, replicasDirectives);
            }

            if (!replicasDirectives[property]) {
                replicasDirectives[property] = createDirective(replica, property);
            }

            return replicasDirectives[property];
        }

    };
};
