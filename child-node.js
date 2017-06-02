// Copyright 2017 The Appgineer
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

"use strict";

var running = {};

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
ApiExtensionRunner.prototype.start = function(name, extension_root) {
    let fork = require('child_process').fork;
    let options = {
        cwd: extension_root + name,
        stdio: [ 'ignore', 'ignore', 'ignore', 'ipc']
    };

    // Start node
    running[name] = fork('.', [], options, (err, stdout, stderr) => {
        if (err) {
            console.log(stdout);
        }
    });
}

/**
 * Stops an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 */
ApiExtensionRunner.prototype.stop = function(name) {
    let node = running[name];

    if (node) {
        node.kill();
    }
    delete running[name];
}

/**
 * Restarts an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 */
ApiExtensionRunner.prototype.restart = function(name) {
}

/**
 * Returns the status of an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 * @returns {('stopped'|'running')} - The current status of the extension
 */
ApiExtensionRunner.prototype.get_status = function(name) {
    return (running[name] ? 'running' : 'stopped');
}

exports = module.exports = ApiExtensionRunner;
