"use strict";

/**
 * API Extension Runner Service
 * @class ApiExtensionRunner
 */
function ApiExtensionRunner() {
}

/**
 * Starts an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 */
ApiExtensionRunner.prototype.start = function(name) {
}


/**
 * Stops an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 */
ApiExtensionRunner.prototype.stop = function(name) {
}


/**
 * Returns the status of an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 * @returns {('stopped'|'running')} - The current status of the extension
 */
ApiExtensionRunner.prototype.get_status = function(name) {
}

exports = module.exports = ApiExtensionRunner;
