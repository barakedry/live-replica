const lodash = require('lodash');
const path = require('path');
const fs = require('fs');
const util = require('util');

const LiveReplicaPatchDiff = require('@live-replica/patch-diff');

class LiveReplicaPersistence {
    constructor(replica, query) {

        if (!(replica instanceof LiveReplicaPatchDiff)) {
            throw new Error('TypeError the "replica" argument must be an instance of LiveReplica');
        }

        if (typeof query !== 'object') {
            throw new Error('TypeError the "query" argument must be an object');
        }

        this.replica = replica;
        this.query = query;
        this.debouncedPersist = lodash.debounce(this.presist.bind(this), 1000, {leading: true, maxWait: 10000});
    }

    // @protected abstract (should be overridden)
    async read(query) {

    }

    async update(data, query) {

    }

    async deleteRecord(data, query) {

    }


    // @ private
    // reads and update the replica
    async load() {
        const data = await this.read(this.query);
        this.replica.set(data);
        return data;
    }

    // save the current state
    async persist() {
        await this.update(this.replica.get(), this.query);
    }

    async persistOnChange(options = { removeOnDelete: false }) {

        let unwatch = this.replica.watch((diff) => {
            if (options.removeOnDelete && replica.options.deleteKeyword === diff) {
                this.deleteRecord(this.query);
            } else {
                this.debouncedPersist();
            }
        });

        // return stop watching
        return async () => {
            if (!unwatch) { return; }

            this.debouncedPersist().flush();
            unwatch();
            unwatch = null;
        }
    }
}


function filenameFromQuery({username, componentId}) {
    return `${username}.${componentId}.json`;
}

const read = util.promisify(fs.read);
const write = util.promisify(fs.write);
const unlink = util.promisify(fs.unlink);

class LiveReplicaFilePersistence extends LiveReplicaPersistence {

    async read() {
        const raw = await read(this.filePath, 'utf8');
        return JSON.parse(raw);
    }

    async update(data) {
        await write(this.filePath, JSON.stringify(data, 4, 4));
    }

    async deleteRecord(data, query) {
        await unlink(this.filePath, JSON.stringify(data, 4, 4));
    }

    constructor(directoryPath, replica, query, options = {filenameFromQuery, filename}) {

        if (typeof directoryPath !== 'string') {
            throw new Error(`TypeError the "directoryPath" argument must be a string`);
        }

        super(replica, query);

        if (options.filename) {
            this.filePath = path.join(directoryPath, options.filename);
        } else {
            this.filePath = path.join(directoryPath, options.filenameFromQuery(query));
        }

    }
}

class LiveReplicaMongoDbPersistence extends LiveReplicaPersistence {

    async read(query) {
        const record = await this.dbCollection.findOne(query);
        if (!record) {
            throw new Error(`no record found on mongodb for query ${JSON.stringify(query)}`)
        }
        return record.data;
    }

    async update(data, query) {
        const document = {...query, data};

        await this.dbCollection.updateOne(query, {$set: document});
    }

    async deleteRecord(data, query) {
        return await this.dbCollection.deleteOne(query);
    }

    constructor(dbCollection, replica, query) {
        super(replica, query);
        this.dbCollection = dbCollection;
    }
}

module.exports = {
    LiveReplicaPersistence,
    LiveReplicaFilePersistence,
    LiveReplicaMongoDbPersistence
};
