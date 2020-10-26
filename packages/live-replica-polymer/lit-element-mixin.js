const Replica = require('../replica');
const utils = require('./utils');
const PatcherProxy = require('../proxy');

const defferedDisconnections = new WeakMap();

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

function createDirective(replica, path, property) {

    const subscribersByPart = new Map();
    const fullPath = utils.concatPath(path, property);
    let baseObject = replica.get(path);

    const directive = (part) => {
        // recalling the directive
        if (subscribersByPart.has(part)) {
            part.setValue(replica.get(fullPath));
        } else {

            const unsub = replica.subscribe(path, (diff) => {
                if (diff[property] === replica.options.deleteKeyword) {
                    part.setValue(undefined);
                    baseObject = undefined;
                    part.commit();
                } else if (diff[property] !== undefined) {
                    const value = baseObject ? baseObject[property] : replica.get(fullPath);

                    // force full reading next time
                    if (value === undefined) {
                        baseObject = undefined;
                    } else {
                        baseObject = replica.get(path);
                    }

                    part.setValue(value);
                    part.commit();
                }
            });

            subscribersByPart.set(part, unsub);
        }
    };

    directive.kill = () => {
        subscribersByPart.forEach((unsub, part) => {
            unsub();
            part.setValue(undefined);
            part.commit();
            subscribersByPart.delete(part);
            baseObject = undefined;
        });
        delete directive.kill;
    };
    return directive;

}


class LiveReplicaElementUtilities {
    constructor(element) {
        this.__unsubscribers = new Set();
        this.__replicaDirectivesCache = new Map();
        this.element = element;
    }

    replicaByData(data) {
        if (PatcherProxy.proxyProperties.has(data)) {
            const root = PatcherProxy.getRoot(data);
            const basePath = PatcherProxy.getPath(data);
            const replica = PatcherProxy.proxyProperties.get(root).patcher;

            return {replica, basePath};
        } else if (data instanceof Replica) {
            return {replica: data, basePath: ''};
        }
    }

    watch(data, path, cb) {
        const { element } = this;
        let { replica, basePath } = this.replicaByData(data);
        let property;
        ({path, property} = utils.extractBasePathAndProperty(path));

        path = utils.concatPath(basePath, path);
        if (path) {
            replica = replica.at(path);
        }

        const unsubscribe = replica.subscribe(function (patch, diff) {

            let lengthChanged = property === 'length' && (diff.hasAdditions || diff.hasDeletions);

            if (!lengthChanged && (property && !patch[property])) { return; }

            let doRender = true;

            if (cb) {
                const cbReturn = cb.call(element, patch, diff, replica.get(property));
                if (cbReturn === false) {
                    doRender = false;
                }
            }

            if (doRender && typeof element.requestUpdate === 'function') {
                element.requestUpdate();
            }
        });

        const unwatch = () => {
            this.__unsubscribers.delete(unwatch);
            console.log('unsubscribed', path);
            unsubscribe();
        };

        this.__unsubscribers.add(unwatch);

        return unwatch;
    }

    cleanup() {
        this.cleanDirectives();
        this.__unsubscribers.forEach(unsubscribe => unsubscribe());
        this.__unsubscribers.clear();
        delete this.element;
    }

    directive(data, path) {

        if (typeof data !== 'object') {
            throw new Error('live-replica lit-element directive data must be of type object');
        }

        let {replica, basePath} = this.replicaByData.call(this, data);

        if (!replica) {
            return function staticDirective(part) {
                part.setValue(Object.byPath(data, path) || '');
            };
        }

        let property;
        const fullPath = utils.concatPath(basePath, path);

        let replicasDirectives = this.__replicaDirectivesCache.get(replica);
        if (!replicasDirectives) {
            replicasDirectives = {};
            this.__replicaDirectivesCache.set(replica, replicasDirectives);
        }

        ({path, property} = utils.extractBasePathAndProperty(fullPath));


        if (!replicasDirectives[fullPath]) {
            replicasDirectives[fullPath] = createDirective(replica, path, property);
        }

        return replicasDirectives[fullPath];
    }

    cleanDirectives() {
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
}

function LitElementMixin(base) {
    return class LitElementMixinClass extends base {
        constructor() {
            super();
            const liveReplicaUtils = new LiveReplicaElementUtilities(this);

            //this.liveReplica.directive = LitElementMixin.directive(getDirective.bind(this.liveReplica));
            //this.liveReplica.binder = getBinder.bind(this.liveReplica);
            //this.liveReplica.cleanDirectives = cleanDirectives.bind(this.liveReplica);

            const directivesWrappers = new WeakMap();
            liveReplicaUtils.binder = function getBinder(replicaOrProxy) {
                if (!directivesWrappers.has(replicaOrProxy)) {
                    directivesWrappers.set(replicaOrProxy, LitElementMixin.directive((path) => { // used as tagging
                        return liveReplicaUtils.directive(replicaOrProxy, path[0]);
                    }));
                }


                return directivesWrappers.get(replicaOrProxy);
            };

            this.liveReplica = liveReplicaUtils;
        }

        connectedCallback() {
            super.connectedCallback();
            if (defferedDisconnections.has(this)) {
                clearTimeout(defferedDisconnections.get(this));
                defferedDisconnections.delete(this);
            }
        }

        disconnectedCallback() {
            defferedDisconnections.set(this, setTimeout(() => {
                this.liveReplica.cleanup();
                delete this.liveReplica;
            }, 0));

            super.disconnectedCallback();
        }
    };
}

LitElementMixin.setupLitHtmlDirective = function (Directive) {
    this.directive = Directive
};

module.exports = LitElementMixin;
