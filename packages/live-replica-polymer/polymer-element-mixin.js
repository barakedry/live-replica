const PolymerBaseMixin = require('./polymer-mixin');
const utils = require('./utils');
function debouncer(fn, time) {
    let debounceClearer;

    return function () {
        let args = arguments;
        if (debounceClearer) {
            clearTimeout(debounceClearer);
            debounceClearer = 0;
        }

        debounceClearer = setTimeout(() => {
            fn.apply(this, args);
            debounceClearer = 0;
        }, time);
    }
}

function createAttachToProperty(element) {

    return function attachToProperty(property, replica) {

        const data = this.attach(replica);

        let unwatchers = [];

        const createWatcherForPropertyEffects = debouncer( () => {

            let paths = (element.__templateInfo.propertyEffects[property] || []).concat((element.__observeEffects && element.__observeEffects[property]) || []);
            let replicaPathsToTemplatePaths = {};

            for (let i = 0; i < paths.length; i++) {
                let templatePath = paths[i].trigger.name;

                if (templatePath.indexOf(property) === 0) {

                    let observablePath = templatePath.substr(property.length + 1);

                    let {path: replicaWatchPath, property: key} = utils.extractBasePathAndProperty(observablePath);

                    if (replicaWatchPath || key) {
                        if (!replicaPathsToTemplatePaths[replicaWatchPath]) {
                            replicaPathsToTemplatePaths[replicaWatchPath] = {};
                        }

                        replicaPathsToTemplatePaths[replicaWatchPath][key] = templatePath;
                    }
                }
            }

            let replicaPaths = Object.keys(replicaPathsToTemplatePaths);
            for (let i = 0; i < replicaPaths.length; i++) {
                let path = replicaPaths[i];
                let templatePaths = replicaPathsToTemplatePaths[path];
                let watcher;

                let isArray = {};
                watcher = (diff) => {
                    let keys = Object.keys(diff);
                    for (let i = 0; i < keys.length; i++) {
                        if (templatePaths[keys[i]]) {
                            const templatePath = templatePaths[keys[i]];
                            if (!isArray.hasOwnProperty(templatePath) && element.get(templatePath)) {
                                isArray[templatePath] = Array.isArray(element.get(templatePath));
                            }

                            if (isArray[templatePath]) {
                                element.notifySplices(templatePath);
                            } else {
                                element.notifyPath(templatePath);
                            }

                        }
                    }
                };

                let unsubscribe = replica.subscribe(path, watcher);
                unwatchers.push(unsubscribe);
            }

            if (replicaPaths.length === 0 && !replicaPath) {
                let unsubscribe = replica.subscribe((diff) => {
                    let keys = Object.keys(diff);
                    for (let i = 0; i < keys.length; i++) {
                        let key = keys[i];
                        element.notifyPath(property);
                    }
                });
                unwatchers.push(unsubscribe);
            }

        }, 5);

        //afterNextRender(element, createWatcherForPropertyEffects);
        createWatcherForPropertyEffects();
        element[property] = data;

        if (!this._replicaUnsubscribes) {
            this._replicaUnsubscribes = [];
        }

        const unsub = () => {
            unwatchers.forEach(function(f){ f(); });
            unwatchers = [];
            let i = this._replicaUnsubscribes.indexOf(unsub);
            this._replicaUnsubscribes.splice(i ,1);
        };

        this._replicaUnsubscribes.push(unsub);

        return unsub;
    }


}

module.exports = function PolymerElementMixin(base) {
    return class extends PolymerBaseMixin(base) {

        constructor() {
            super();
            const element = this;
            this.liveReplica.attachToProperty = createAttachToProperty(element);
        }

        disconnectedCallback() {
            super.disconnectedCallback();
            if (this.liveReplica._replicaUnsubscribes) {
                this.liveReplica._replicaUnsubscribes.forEach((f) => {
                    f();
                    f.unsubscribed = true;
                });

                this.liveReplica._replicaUnsubscribes = [];
            }
        }

    };
};
