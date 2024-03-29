import {directive} from 'lit/directive.js';
import {AsyncDirective} from 'lit-html/async-directive.js';
import {noChange} from 'lit';
import {replicaByData, extractBasePathAndProperty, concatPath} from "./utils.js";
import { isProxy, getPatchDiff, Replica } from '@live-replica/client';

export class LiveReplicaDirective extends AsyncDirective {
    // When the observable changes, unsubscribe to the old one and
    // subscribe to the new one

    render(dataOrReplica, relativePath, transformer = (v) => v) {
        if (this.replica && this.replica === dataOrReplica && relativePath === this.path) {
            return transformer(this.__lastVal);
        }

        if (this.isConnected)  {
            this.subscribe(dataOrReplica, relativePath, transformer);
        }

        return noChange;
    }

    subscribe(dataOrReplica, relativePath, transformer) {
        this.unsubscribe?.();

        if (!relativePath || typeof relativePath !== 'string') {
            throw new Error('live directive requires a path string');
        }

        this.replica = dataOrReplica;
        this.path = relativePath;

        let replica;
        if (dataOrReplica instanceof Replica) {
            replica = dataOrReplica;
        } if (isProxy(dataOrReplica)) {
            replica = getPatchDiff(dataOrReplica);
        } else {
            throw new Error('LiveReplicaDirective can only be used with a LiveReplica Proxy or Replica instance');
        }

        let property, path;
        if (relativePath) {
            ({path, property} = extractBasePathAndProperty(relativePath));

            if (path) {
                replica = replica.at(path);
            }
        }

        this.baseObject = replica.get();
        this.property = property;
        this.unsubscribe = replica.subscribe('', (diff) => {

            if (diff[property] === replica.options.deleteKeyword) {
                this.setValue(transformer(undefined));
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
                this.setValue(transformer(value));
            }

        });
    }

    // When the directive is disconnected from the DOM, unsubscribe to ensure
    // the directive instance can be garbage collected
    disconnected() {
        this.unsubscribe?.();
        delete this.unsubscribe;
        delete this.baseObject;
        delete this.property;
        delete this.replica;
        delete this.path;
    }
    // If the subtree the directive is in was disconneted and subsequently
    // re-connected, re-subscribe to make the directive operable again
    reconnected() {
        this.subscribe(this.replica, this.path);
    }
}
export const live = directive(LiveReplicaDirective);
