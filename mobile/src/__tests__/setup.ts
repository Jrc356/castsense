/**
 * Jest test setup file for mobile
 */

// Set test environment
process.env.NODE_ENV = 'test';

// Mock react-native modules
jest.mock('react-native', () => ({
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios || obj.default)
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 }))
  },
  StyleSheet: {
    create: jest.fn((styles) => styles)
  }
}));

// Mock Skia
jest.mock('@shopify/react-native-skia', () => ({
  Canvas: 'Canvas',
  Path: 'Path',
  Group: 'Group',
  Paint: 'Paint',
  useFont: jest.fn(),
  usePaint: jest.fn()
}));
