import {directive, AsyncDirective} from `lit`;

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

    render(replica, fullPath) {
        this.replica = replica;
        this.path = fullPath;
        this.subscribe(replica, fullPath);
    }

    subscribe(replica, fullPath) {
        this.unsubscribe?.();
        const {path , property} = extractBasePathAndProperty(fullPath);

        let baseObject = replica.get(path);
        this.unsubscribe = replica.subscribe(path, (diff) => {

            if (diff[property] === replica.options.deleteKeyword) {
                this.setValue(undefined);
                baseObject = undefined;
            } else if (diff[property] !== undefined) {
                const value = baseObject ? baseObject[property] : replica.get(fullPath);

                // force full reading next time
                if (value === undefined) {
                    baseObject = undefined;
                } else {
                    baseObject = replica.get(path);
                }

                part.setValue(value);
            }

        });
    }

    // When the directive is disconnected from the DOM, unsubscribe to ensure
    // the directive instance can be garbage collected
    disconnected() {
        this.unsubscribe?.();
        delete this.unsubscribe;
    }
    // If the subtree the directive is in was disconneted and subsequently
    // re-connected, re-subscribe to make the directive operable again
    reconnected() {
        this.subscribe(this.replica, this.path);
    }
}
export const live = directive(LiveReplicaDirective);