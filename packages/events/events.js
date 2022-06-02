export class EventEmitter {
    listeners = {};
    maxListeners = 10;

    setMaxListeners(num) { this.maxListeners = num; }

    on(event, cb) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }

        if (this.listeners[event].length >= this.maxListeners) {
            console.warn(`EventEmitter, possible memory leak. number listeners of event ${event} exceeds ${this.maxListeners}`);
        }

        this.listeners[event].push(cb);

        return () => this.off(event, cb);
    }

    off(event, cb) {
        if (!this.listeners[event]) return;

        const index = this.listeners[event].indexOf(cb);
        if (index !== -1) {
            this.listeners[event].splice(index, 1);
        }

        if (this.listeners[event].length === 0) {
            delete this.listeners[event];
        }
    }

    removeAllListeners(event) {
        delete this.listeners[event];
    }

    listenersOf(event) {
        return this.listeners[event] ? [...this.listeners[event]] : [];
    }

    listenerCount(event) {
        return this.listeners[event]?.length || 0;
    }

    once(event, cb) {
        const off = this.on(event, (...args) => {
            off();
            cb.call(this, ...args);
        });
    }

    emit(event, ...args) {
        this.listeners[event]?.forEach(listener => listener.call(this, ...args));
    }
}

EventEmitter.prototype.addEventListener = EventEmitter.prototype.on;
EventEmitter.prototype.addListener = EventEmitter.prototype.on;
EventEmitter.prototype.removeEventListener = EventEmitter.prototype.off;
EventEmitter.prototype.removeListener = EventEmitter.prototype.off;