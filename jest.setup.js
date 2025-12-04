// Jest setup for testing
// Note: @testing-library/jest-dom removed due to React 19 compatibility
// Basic Jest matchers are still available

// Mock Parse SDK for tests
global.Parse = {
    Object: {
        extend: jest.fn(() => ({
            get: jest.fn(),
            set: jest.fn(),
            save: jest.fn(),
        })),
    },
    Query: jest.fn(),
    User: {
        current: jest.fn(),
    },
    Error: {
        VALIDATION_ERROR: 142,
        OPERATION_FORBIDDEN: 119,
    },
}
