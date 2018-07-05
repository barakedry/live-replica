const path = require('path');

module.exports = {
    entry: './packages/client/index.js',
    output: {
        filename: 'live-replica.js',
        path: path.resolve(__dirname, 'dist')
    }
};