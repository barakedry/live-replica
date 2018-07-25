const Replica = require('@live-replica/replica');

function createDirective(replica, property) {

    const subscribersByPart = new WeakMap();

    const directive = (part) => {


        if (subscribersByPart.has(part)) {
            part.setValue(replica.get(property));
        } else {

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

function lr(replica, path) {
    if (!this.__replicaDirectivesCache) {
        this.__replicaDirectivesCache = new WeakMap();
    }

    const lastPart = path.lastIndexOf('.');
    let property;
    if (lastPart === -1) {
        property = path;

    } else {
        property = path.substr(lastPart + 1);
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

lr.get = function  (pathOrBaseReplica) {
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
};

module.exports = function LitHtmlMixin(base) {
    return class extends base {

        constructor() {
            super();
            this.lr = lr.bind(this);
            this.lr.get = lr.get.bind(this);
            // this.lr.watch = lr.watch.bind(this);
        }

        disconnectedCallback() {
            super.disconnectedCallback();
        };
    };
};
