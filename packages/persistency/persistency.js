import _debounce from 'lodash/debounce';
import path from 'node:path';
import fs from 'node:fs';
import { util } from  'node:util';
import { PatchDiff } from '../patch-diff/index.js';


const structuredClone = obj => {
    return v8.deserialize(v8.serialize(obj));
};

class LiveReplicaPersistence {
    constructor(replica, key) {
        if (!(replica instanceof PatchDiff)) {
            throw new TypeError('the "replica" argument must be an instance of LiveReplica');
        }

        this.replica = replica;
        this.key = key;
        this.debouncedPersist = _debounce(() => this.persist(), 1500, {leading: true, maxWait: 10000});
    }

    // @protected abstract (should be overridden)
    async read(key) {

    }

    async update(data, key) {

    }

    async deleteRecord(data, key) {

    }


    // @ public
    // reads and update the replica
    async load() {
        const data = await this.read(this.key);
        this.replica.set(data);
        return data;
    }

    // save the current state
    async persist() {
        const data = this.replica.get();

        if (data) {
            const clone = structuredClone(data);
            await this.update(clone, this.key);
        }
    }

    persistOnChange(options = { removeOnDelete: false }) {

        let unwatch = this.replica.subscribe((diff) => {
            if (options.removeOnDelete && replica.options.deleteKeyword === diff) {
                this.deleteRecord(this.key);
            } else {
                this.debouncedPersist();
            }
        });

        // return stop watching
        return () => {
            if (!unwatch) { return; }

            this.debouncedPersist.flush();
            unwatch();
            unwatch = null;
        }
    }
}

const read = util.promisify(fs.readFile);
const write = util.promisify(fs.writeFile);
const unlink = util.promisify(fs.unlink);

class LiveReplicaFilePersistence extends LiveReplicaPersistence {

    async read(filepath) {
        const raw = await read(filepath, 'utf8');
        return JSON.parse(raw);
    }

    async update(data, filepath) {
        await write(filepath, JSON.stringify(data, 4, 4));
    }

    async deleteRecord(data, filepath) {
        await unlink(filepath, JSON.stringify(data, 4, 4));
    }

}

class LiveReplicaMongoDbPersistence extends LiveReplicaPersistence {

    constructor(replica, query, dbCollection) {
        super(replica, query);
        this.dbCollection = dbCollection;
    }

    async read(query) {
        const record = await this.dbCollection.findOne(query);
        if (!record) {
            throw new TypeError(`no record found on mongodb for query ${JSON.stringify(query)}`);
        }
        return record.data;
    }

    async update(data, query) {
        const document = {...query, data};

        await this.dbCollection.updateOne(query, {$set: document}, {upsert: true});
    }

    async deleteRecord(data, query) {
        return await this.dbCollection.deleteOne(query);
    }

}

module.exports = {
    LiveReplicaPersistence,
    LiveReplicaFilePersistence,
    LiveReplicaMongoDbPersistence
};
