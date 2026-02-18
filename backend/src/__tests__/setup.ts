/**
 * Jest test setup file
 */

// Type for the mock logger
interface MockLogger {
  info: jest.Mock;
  warn: jest.Mock;
  error: jest.Mock;
  debug: jest.Mock;
  trace: jest.Mock;
  fatal: jest.Mock;
  child: jest.Mock<MockLogger>;
}

// Create mock logger factory
const createMockLogger = (): MockLogger => {
  const logger: MockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    trace: jest.fn(),
    fatal: jest.fn(),
    child: jest.fn()
  };
  logger.child.mockReturnValue(logger);
  return logger;
};

// Suppress pino logger output during tests
jest.mock('pino', () => {
  return jest.fn(() => createMockLogger());
});

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.MAX_ZONES = '3';
process.env.VALIDATION_STRICT_MODE = 'false';
