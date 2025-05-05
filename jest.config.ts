export default {
    verbose: true,
        moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
        moduleDirectories: ["node_modules", "src"],
        moduleNameMapper: {
        "\\.(css|less|scss)$": "identity-obj-proxy"
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
