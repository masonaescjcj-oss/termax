// This file MUST run before any other module is loaded.
// It contains no `import` statements to prevent Metro from hoisting anything.
// Only `require()` calls are used here.

// 1. Initialize React Native core globals (window, self, process, etc.)
require('react-native/Libraries/Core/InitializeCore');

// 2. FormData polyfill (not set by InitializeCore)
var fdModule = require('react-native/Libraries/Network/FormData');
var fdClass = fdModule.default || fdModule;
Object.defineProperty(global, 'FormData', {
  value: fdClass,
  writable: true,
  configurable: true,
  enumerable: true,
});

// 3. Blob polyfill (not set by InitializeCore)
var blobModule = require('react-native/Libraries/Blob/Blob');
var blobClass = blobModule.default || blobModule;
Object.defineProperty(global, 'Blob', {
  value: blobClass,
  writable: true,
  configurable: true,
  enumerable: true,
});

// 4. fetch, Headers, Request, Response polyfills
// whatwg-fetch sets these on global when required
require('whatwg-fetch');

// 5. WebSocket polyfill
var wsModule = require('react-native/Libraries/WebSocket/WebSocket');
var wsClass = wsModule.default || wsModule;
if (typeof global.WebSocket === 'undefined') {
  Object.defineProperty(global, 'WebSocket', {
    value: wsClass,
    writable: true,
    configurable: true,
    enumerable: true,
  });
}
