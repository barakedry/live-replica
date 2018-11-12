const utils = require('./utils');
const PolymerBaseMixin = require('./polymer-mixin');

Object.byPath = function(object, path) {
    path = path.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
    path = path.replace(/^\./, '');           // strip a leading dot
    let a = path.split('.');
    for (let i = 0, n = a.length; i < n; ++i) {
        let k = a[i];
        if (k in object) {
            object = object[k];
        } else {
            return;
        }
    }
    return object;
};

function createDirective(replica, property, format = val => val) {

    const subscribersByPart = new Map();
    const directive = (part) => {
        // recalling the directive
        if (subscribersByPart.has(part)) {
            part.setValue(format(replica.get(property)));
        } else {

            const unsub = replica.subscribe((diff) => {
                if (diff[property] !== undefined) {
                    part.setValue(format(replica.get(property)));
                    part.commit();
                }
            });

            subscribersByPart.set(part, unsub);
        }
    };

    directive.__litDirective = true;
    directive.kill = () => {
        subscribersByPart.forEach((unsub, part) => {
            unsub();
            subscribersByPart.delete(part);
        });
        delete directive.kill;
    };
    return LitElementMixin.directive(directive);
}

function getDirective(data, path, format = val => val) {

    if (typeof data !== 'object') {
        throw new Error('live-replica lit-element directive data must be of type object');
    }

    let {replica, basePath} = this.replicaByData.call(this, data);

    if (!replica) {
        const drv = function staticDirective(part) {
            part.setValue(format(Object.byPath(data, path) || ''))
        };
        drv.__litDirective = true;

        return LitElementMixin.directive(drv);
    }

    if (!this.__replicaDirectivesCache) {
        this.__replicaDirectivesCache = new Map();
    }

    let property;

    ({path, property} = utils.extractBasePathAndProperty(utils.concatPath(basePath, path)));

    if (path) {
        replica = replica.at(path);
    }

    let replicasDirectives = this.__replicaDirectivesCache.get(replica);
    if (!replicasDirectives) {
        replicasDirectives = {};
        this.__replicaDirectivesCache.set(replica, replicasDirectives);
    }

    if (!replicasDirectives[property]) {
        replicasDirectives[property] = createDirective(replica, property, format);
    }

    return replicasDirectives[property];
}

function cleanDirectives() {
    if (!this.__replicaDirectivesCache) { return; }

    this.__replicaDirectivesCache.forEach((directives, replica) => {
        const pathes = Object.keys(directives);
        pathes.forEach((path) => {
            if (directives[path].kill) {
                directives[path].kill();
            }

            delete directives[path];
        });

        this.__replicaDirectivesCache.delete(replica);
    });
}

function getBinder(replicaOrProxy) {
    return (path, format = val => val) => { // used as tagging
        return this.directive(replicaOrProxy, path[0], format);
    }
}

function LitElementMixin(base) {
    return class extends PolymerBaseMixin(base) {
        constructor() {
            super();

            this.liveReplica.render = (diff, data) => {
                this.requestUpdate();
            };


            this.liveReplica.directive = getDirective.bind(this.liveReplica);
            this.liveReplica.binder = getBinder.bind(this.liveReplica);
            this.liveReplica.cleanDirectives = cleanDirectives.bind(this.liveReplica);
        }

        disconnectedCallback() {
            this.liveReplica.cleanDirectives();
            super.disconnectedCallback();
        }
    };
}

LitElementMixin.setupLitHtmlDirective = function (Directive) {
    this.directive = Directive
};

module.exports = LitElementMixin;