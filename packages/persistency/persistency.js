import _debounce from 'lodash-es/debounce.js';
import fs from 'node:fs';
import util from  'node:util';
import v8 from  'node:v8';
import { PatchDiff } from '../patch-diff/index.js';


const structuredClone = obj => {
    return v8.deserialize(v8.serialize(obj));
};

export class LiveReplicaPersistence {
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

export class LiveReplicaFilePersistence extends LiveReplicaPersistence {

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

export class LiveReplicaMongoDbPersistence extends LiveReplicaPersistence {

    constructor(replica, query, dbCollection, initialDocument = query,  dataKey = 'data') {
        super(replica, query);
        this.dataKey = dataKey;
        this.dbCollection = dbCollection;
        this.document = initialDocument;
    }

    async beforeRead(query) { return query; }
    async afterRead(document) { return document; }
    async beforeUpdate(document) { return document; }


    async read(query) {
        query = await this.beforeRead(query);

        const document = await this.dbCollection.findOne(query);
        if (!document) {
            throw new TypeError(`no record found on mongodb for query ${JSON.stringify(query)}`);
        }

        this.document = await this.afterRead(document);
        return this.document[this.dataKey];
    }

    async update(data, query) {
        //const document = {...query, data};

        let document = {
            ...this.document,
            [this.dataKey]: data
        }

        document = await this.beforeUpdate(document);
        this.document = document;
        await this.dbCollection.updateOne(query, {$set: document}, {upsert: true});
    }

    async deleteRecord(data, query) {
        return await this.dbCollection.deleteOne(query);
    }

}
