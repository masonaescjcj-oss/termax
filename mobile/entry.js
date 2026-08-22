// Entry point: load polyfills FIRST, then load the app.
// This file must have NO import statements so nothing gets hoisted.
require('./polyfills');
require('./index');
