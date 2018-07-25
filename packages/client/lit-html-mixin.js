const Replica = require('@live-replica/replica');

function extractBasePathAndProperty(path) {
    const lastPart = path.lastIndexOf('.');
    if (lastPart === -1) {
        return {property: path, path: ''};
    }

    let property = path.substr(lastPart + 1);
    path = path.substr(0, lastPart);
    return {path, property};
}


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

    let property;
    ({path, property} = extractBasePathAndProperty(path));

    if (path) {
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
        this.__replicas = new Map();
    }

    const data = replica.data;
    this.__replicas.set(data, replica);
    return data;
};

lr.replicaByData = function (data) {
    return this.__replicas.get(data);
};

lr.watch = function (data, path, cb) {
    let property;
    let element = this;
    ({path, property} = extractBasePathAndProperty(path));
    const replica = this.__replicas.get(data);
    replica.subscribe(function (diff) {
        if (cb) {
            cb.call(element, diff);
        }
        element._render();
    });
};

module.exports = function LitHtmlMixin(base) {
    return class extends base {

        constructor() {
            super();
            this.lr = lr.bind(this);
            this.lr.get = lr.get.bind(this);
            this.lr.watch = lr.watch.bind(this);
            this.lr.replicaByData = lr.replicaByData.bind(this);
        }

        disconnectedCallback() {
            super.disconnectedCallback();
        };
    };
};
