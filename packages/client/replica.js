/**
 * Created by barakedry on 28/04/2018.
 */
'use strict';
import PatchDiff from '@live-replica/patch-diff';

class Replica extends PatchDiff {

    constructor(remotePath, options = {}) {
        super();
        this.remotePath = remotePath;
    }

    connect(connection) {

    }

    disconnect() {

    }
}