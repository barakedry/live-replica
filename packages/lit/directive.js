import {directive} from 'lit/directive.js';
import {AsyncDirective} from 'lit-html/async-directive.js';
import {noChange} from 'lit';

function replicaByData(data) {
    if (LiveReplica.Proxy.proxyProperties.has(data)) {
        const root = LiveReplica.Proxy.getRoot(data);
        const basePath = LiveReplica.Proxy.getPath(data);
        const replica = LiveReplica.Proxy.proxyProperties.get(root).patcher;

        return {replica, basePath};
    } else if (data instanceof LiveReplica.Replica) {
        return {replica: data, basePath: ''};
    }
}

function concatPath(path, suffix) {
    if (path && suffix) {
        return [path, suffix].join('.');
    }

    return path || suffix;
}

function extractBasePathAndProperty(path = '') {
    const lastPart = path.lastIndexOf('.');
    if (lastPart === -1) {
        return {property: path, path: ''};
    }

    let property = path.substr(lastPart + 1);
    path = path.substr(0, lastPart);
    return {path, property};
}

class LiveReplicaDirective extends AsyncDirective {
    // When the observable changes, unsubscribe to the old one and
    // subscribe to the new one

    render(dataOrReplica, relativePath) {
        if (this.replica && this.replica === dataOrReplica && relativePath === this.path) {
            return noChange;
        }

        this.subscribe(dataOrReplica, relativePath);
    }

    subscribe(dataOrReplica, relativePath) {

        if (this.unsubscribe) {
            console.warn('!unsubsribing', this.path , relativePath);
        }
        this.unsubscribe?.();

        this.replica = dataOrReplica;
        this.path = relativePath;

        console.warn('SUBBING', this.path , dataOrReplica);

        let { replica, basePath } = replicaByData(dataOrReplica);
        let property;

        let path = concatPath(basePath, relativePath);

        ({path, property} = extractBasePathAndProperty(path));

        if (path) {
            replica = replica.at(path);
        }

        this.baseObject = replica.get();
        this.property = property;
        this.unsubscribe = replica.subscribe('', (diff) => {

            if (diff[property] === replica.options.deleteKeyword) {
                this.setValue(undefined);
                this.baseObject = undefined;
                this.__lastVal = undefined;
            } else if (diff[property] !== undefined) {
                const value = this.baseObject ? this.baseObject[property] : replica.get(property);

                // force full reading next time
                if (value === undefined) {
                    this.baseObject = undefined;
                } else {
                    this.baseObject = replica.get();
                }

                this.__lastVal = value;
                this.setValue(value);
            }

        });
    }

    // When the directive is disconnected from the DOM, unsubscribe to ensure
    // the directive instance can be garbage collected
    disconnected() {
        console.warn('disconnected', this.path);
        this.unsubscribe?.();
        delete this.unsubscribe;
        delete this.replica;
        delete this.path;
        delete this.baseObject;
        delete this.property;
    }
    // If the subtree the directive is in was disconneted and subsequently
    // re-connected, re-subscribe to make the directive operable again
    reconnected() {
        this.subscribe(this.replica, this.path);
    }
}
export const live = directive(LiveReplicaDirective);