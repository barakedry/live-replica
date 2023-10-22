export default {
    verbose: true,
        moduleFileExtensions: ["js", "jsx", "ts", "tsx"],
        moduleDirectories: ["node_modules", "src"],
        moduleNameMapper: {
        "\\.(css|less|scss)$": "identity-obj-proxy"
    },
    "transformIgnorePatterns": ["/node_modules/lodash/"],
        transform: {
        "^.+\\.(js|jsx)$": "babel-jest",
    }
}