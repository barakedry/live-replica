export default {
    verbose: true,
        moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
        moduleDirectories: ["node_modules", "src"],
        moduleNameMapper: {
        "\\.(css|less|scss)$": "identity-obj-proxy"
    },
    transformIgnorePatterns: ["/node_modules/lodash/"],
    testPathIgnorePatterns: [
        '/node_modules/',
        '/dist/',
        '\\.d\\.ts$'
    ],
    testMatch: [
        '**/__tests__/**/*.spec.ts',
        '**/__tests__/**/*.spec.js',
        '**/__tests__/**/*.test.ts',
        '**/__tests__/**/*.test.js'
    ],
    transform: {
        '^.+\\.(ts|tsx)$': 'ts-jest',
        '^.+\\.(js|jsx|mjs)$': 'babel-jest',
    },
    collectCoverage: true,
    coverageThreshold: {
        global: {
            lines: 75
        },
    },
}
