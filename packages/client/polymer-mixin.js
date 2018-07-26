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

function LiveReplicaPolymerMixin(base) {
    return class extends base {
        bindLomToProperty(replica, property, replicaPath, onReady, debug) {

            //return () => {};

            let unwatchers = [];

            const createWatcherForPropertyEffects = debouncer( () => {

                let paths = (this.__templateInfo.propertyEffects[property] || []).concat(this.__observeEffects[property] || []);
                let replicaPathsToTemplatePaths = {};

                for (let i = 0; i < paths.length; i++) {
                    let templatePath = paths[i].trigger.name;
                    
                    if (templatePath.indexOf(property) === 0) {

                        let observablePath = templatePath.substr(property.length + 1);
                        let lastDotIndex = observablePath.lastIndexOf('.');
                        let LomWatchPath = observablePath.substring(0, lastDotIndex);
                        let key = observablePath.substring(lastDotIndex + 1);

                        if (LomWatchPath) {
                            LomWatchPath = [replicaPath, LomWatchPath].join('.');
                        } else {
                            LomWatchPath = replicaPath;
                        }

                        if (LomWatchPath) {
                            if (!replicaPathsToTemplatePaths[LomWatchPath]) {
                                replicaPathsToTemplatePaths[LomWatchPath] = {};
                            }

                            replicaPathsToTemplatePaths[LomWatchPath][key] = templatePath;
                        }
                    }
                }

                let replicaPaths = Object.keys(replicaPathsToTemplatePaths);
                for (let i = 0; i < replicaPaths.length; i++) {
                    let path = replicaPaths[i];
                    let templatePaths = replicaPathsToTemplatePaths[path];
                    let watcher;

                    if (path) {
                        let isArray = {};
                        watcher = (diff) => {
                            let keys = Object.keys(diff);
                            for (let i = 0; i < keys.length; i++) {
                                if (templatePaths[keys[i]]) {
                                    const templatePath = templatePaths[keys[i]];
                                    if (!isArray.hasOwnProperty(templatePath) && this.get(templatePath)) {
                                        isArray[templatePath] = Array.isArray(this.get(templatePath));
                                    }

                                    if (isArray[templatePath]) {
                                        this.notifySplices(templatePath);
                                    } else {
                                        this.notifyPath(templatePath);
                                    }

                                }
                            }
                        };
                    }

                    let unsubscribe = replica.subscribe(path, watcher);
                    unwatchers.push(unsubscribe);
                }

                if (replicaPaths.length === 0 && !replicaPath) {
                    let unsubscribe = replica.subscribe((diff) => {
                        let keys = Object.keys(diff);
                        for (let i = 0; i < keys.length; i++) {
                            let key = keys[i];
                            this.notifyPath(property);
                        }
                    });
                    unwatchers.push(unsubscribe);
                }

            }, 5);

            Polymer.RenderStatus.afterNextRender(this, createWatcherForPropertyEffects);


            replica.get(replicaPath, (data) => {
                this[property] = data;
                if (onReady) {
                    onReady(this[property]);
                }
            });


            if (!this._replicaUnsubscribes) {
                this._replicaUnsubscribes = [];
            }


            function logCount() {
                let events = Object.keys(replica._events);
                let count = 0;
                events.forEach((en) => {
                    count += replica.listenerCount(en);
                });
                console.log('listeners', count);
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

        disconnectedCallback() {
            super.disconnectedCallback();
            if (this._replicaUnsubscribes) {
                this._replicaUnsubscribes.forEach((f) => {
                    f();
                    f.unsubscribed = true;
                });

                this._replicaUnsubscribes = [];
            }

        }
    }
}

module.exports = LiveReplicaPolymerMixin;