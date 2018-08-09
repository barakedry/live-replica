const path = require('path');

module.exports = {
    entry: './packages/client/index.js',
    // devtool: "eval",
    output: {
        filename: 'live-replica.js',
        path: path.resolve(__dirname, 'dist'),
        library: 'LiveReplica',
        libraryTarget: "var"
    },
    optimization: {
        minimize: false
    }
};