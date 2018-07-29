const utils = require('./utils');
const PolymerBaseMixin = require('./polymer-mixin');

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

function getDirective(data, path) {
    let replica = this.replicaByData.call(this, data);

    if (!this.__replicaDirectivesCache) {
        this.__replicaDirectivesCache = new WeakMap();
    }

    let property;
    ({path, property} = utils.extractBasePathAndProperty(path));

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


module.exports = function LitElementMixin(base) {
    return class extends PolymerBaseMixin(base) {

        constructor() {
            super();
            this.liveReplica.render = (diff, data) => {
                this._render(data);
            };

            this.liveReplica.directive = getDirective.bind(this.liveReplica);
        }

    };
};
