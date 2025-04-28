export default {
    verbose: true,
        moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
        moduleDirectories: ["node_modules", "src"],
        moduleNameMapper: {
        "\\.(css|less|scss)$": "identity-obj-proxy",
        "^@live-replica/(.+)$": "<rootDir>/packages/$1/src"
    },
    transformIgnorePatterns: ["/node_modules/lodash/"],
    transform: {
        '^.+\\.(js|jsx|ts|tsx|mjs)$': 'babel-jest',
    },
    collectCoverage: true,
    coverageThreshold: {
        global: {
            lines: 75
        },
    },
}
