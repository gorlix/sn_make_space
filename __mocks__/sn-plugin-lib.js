/**
 * Manual Jest mock for the native `sn-plugin-lib` SDK.
 *
 * The real module talks to the Supernote PluginHost native runtime, which does
 * not exist in a Node/Jest environment. This stub exposes the API surface the
 * plugin uses so app code can be imported and unit-tested off-device. Each async
 * method resolves a successful `APIResponse` by default; tests override per case
 * with `jest.spyOn(...).mockResolvedValue(...)`.
 */

const ok = result => Promise.resolve({success: true, result});

const PluginManager = {
  init: jest.fn(),
  registerButton: jest.fn(),
  registerButtonListener: jest.fn(() => ({remove: jest.fn()})),
  registerLangListener: jest.fn(() => ({remove: jest.fn()})),
  closePluginView: jest.fn(() => ok(true)),
  showPluginView: jest.fn(() => ok(true)),
  getDeviceType: jest.fn(() => ok('A5X')),
};

const PluginCommAPI = {
  getCurrentFilePath: jest.fn(() => ok('/storage/emulated/0/Note/demo.note')),
  getCurrentPageNum: jest.fn(() => ok(0)),
  lassoElements: jest.fn(() => ok(true)),
  setLassoBoxState: jest.fn(() => ok(true)),
  getLassoElements: jest.fn(() => ok([])),
  reloadFile: jest.fn(() => ok(true)),
};

const PluginFileAPI = {
  getPageSize: jest.fn(() => ok({width: 1404, height: 1872})),
  generateNotePng: jest.fn(() => ok(true)),
};

const PointUtils = {
  androidPoint2Emr: jest.fn(p => p),
  emrPoint2Android: jest.fn(p => p),
};

module.exports = {
  PluginManager,
  PluginCommAPI,
  PluginFileAPI,
  PointUtils,
};
