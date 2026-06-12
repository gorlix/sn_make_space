module.exports = {
  preset: 'react-native',
  passWithNoTests: true,
  // sn-plugin-lib is a native SDK with no JS implementation available off-device;
  // map it to a manual mock so unit/component tests can import app code without a device.
  moduleNameMapper: {
    '^sn-plugin-lib$': '<rootDir>/__mocks__/sn-plugin-lib.js',
  },
};
