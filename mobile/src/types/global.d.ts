/**
 * React Native Global Type Declarations
 */

// React Native development flag
declare const __DEV__: boolean;

// Extend NodeJS global types for React Native
declare global {
  namespace NodeJS {
    interface Global {
      __DEV__: boolean;
    }
  }
}

export {};
