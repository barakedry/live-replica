"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.live = exports.LiveReplicaDirective = void 0;
// @ts-nocheck
const directive_js_1 = require("lit/directive.js");
const async_directive_js_1 = require("lit-html/async-directive.js");
const lit_1 = require("lit");
const utils_js_1 = require("./utils.js");
const client_1 = require("@live-replica/client");
class LiveReplicaDirective extends async_directive_js_1.AsyncDirective {
    // When the observable changes, unsubscribe to the old one and
    // subscribe to the new one
    render(dataOrReplica, relativePath, transformer = (v) => v) {
        if (this.replica && this.replica === dataOrReplica && relativePath === this.path) {
            return transformer(this.__lastVal);
        }
        if (this.isConnected) {
            this.subscribe(dataOrReplica, relativePath, transformer);
        }
        return lit_1.noChange;
    }
    subscribe(dataOrReplica, relativePath, transformer) {
        this.unsubscribe?.();
        if (!relativePath || typeof relativePath !== 'string') {
            throw new Error('live directive requires a path string');
        }
        this.replica = dataOrReplica;
        this.path = relativePath;
        let replica;
        if (dataOrReplica instanceof client_1.Replica) {
            replica = dataOrReplica;
        }
        if ((0, client_1.isProxy)(dataOrReplica)) {
            replica = (0, client_1.getPatchDiff)(dataOrReplica);
        }
        else {
            throw new Error('LiveReplicaDirective can only be used with a LiveReplica Proxy or Replica instance');
        }
        let property, path;
        if (relativePath) {
            ({ path, property } = (0, utils_js_1.extractBasePathAndProperty)(relativePath));
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
            }
            else if (diff[property] !== undefined) {
                const value = this.baseObject ? this.baseObject[property] : replica.get(property);
                // force full reading next time
                if (value === undefined) {
                    this.baseObject = undefined;
                }
                else {
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
exports.LiveReplicaDirective = LiveReplicaDirective;
exports.live = (0, directive_js_1.directive)(LiveReplicaDirective);
//# sourceMappingURL=directive.js.map