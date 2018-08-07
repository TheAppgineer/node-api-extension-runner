// Copyright 2017, 2018 The Appgineer
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
var self;

/**
 * API Extension Runner Service
 * @class ApiExtensionRunner
 */
function ApiExtensionRunner(name, cb) {
    const fs = require('fs');

    fs.readFile('running.json', 'utf8', (err, data) => {
        if(!err && cb) {
            try {
                cb(JSON.parse(data));
            } catch (e) {
                console.error(e);
            }
        }
    });

    self = name;

    // Register process pid to report running state
    running[name] = {
        node : {
            pid: process.pid
        }
    }
}

/**
 * Starts an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 */
ApiExtensionRunner.prototype.start = function(name, cwd, module_dir, inherit_mode, cb) {
    let stdio;
    let args = [];

    if (Number.isInteger(inherit_mode)) {
        stdio = ['ignore', inherit_mode, inherit_mode, 'ipc'];
    } else {
        stdio = ['ignore', 'ignore', 'ignore', 'ipc'];
    }

    let options = {
        cwd: cwd,
        stdio: stdio
    };

    // Start node
    let fork = require('child_process').fork;
    let node = fork(module_dir, args, options);
    node.on('exit', (code, signal) => {
        if (running[name].node) {
            running[name].node = null;   // Terminated unexpectedly
        }
        if (cb) {
            cb(code, signal, running[name].user);
        }

        if (running[name].timer) {
            clearTimeout(running[name].timer);
            delete running[name].timer;
        }

        if (running[name].terminate_cb) {
            running[name].terminate_cb(code, signal);
            delete running[name].terminate_cb;
        }
    });
    running[name] = {
        node: node
    };
}

/**
 * Stops (user request) an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 */
ApiExtensionRunner.prototype.stop = function(name, cb) {
    _terminate_child(name, true, cb);
}

/**
 * Terminates (non-user request) an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 */
ApiExtensionRunner.prototype.terminate = function(name, cb) {
    _terminate_child(name, false, cb);
}

/**
 * Returns the status of an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 * @returns {('stopped'|'terminated'|'running')} - The status of the extension
 */
ApiExtensionRunner.prototype.get_status = function(name) {
    let node = (running[name] ? running[name].node : undefined);

    if (node) {
        // Check if the process is still running
        try {
            process.kill(node.pid, 0);
        } catch (e) {
            console.error('Child process already terminated:', node.pid);
            running[name].node = null;   // Terminated
            node = null;
        }
    }

    return (node ? 'running' : (node === null ? 'terminated' : 'stopped'));
}

ApiExtensionRunner.prototype.prepare_exit = function(cb) {
    // Clean up data of stopped extensions
    for (let name in running) {
        if (name == self || running[name].node === undefined) {
            delete running[name];
        }
    }

    // Write names of running extensions to file
    const fs = require('fs');
    fs.writeFile('running.json', JSON.stringify(Object.keys(running)), (err) => {
        // Terminate running extensions
        _terminate_all(cb);
    });
}

function _terminate_all(cb) {
    let pending = false;

    for (let name in running) {
        pending = _terminate_child(name, false, () => {
            for (let name in running) {
                if (running[name] && running[name].timer) {
                    return;
                }
            }

            if (cb) {
                cb();
            }
        });
    }

    if (!pending && cb) {
        cb();
    }
}

function _terminate_child(name, user, cb) {
    const result = (running[name] && running[name].node ? true : false);

    if (user && running[name] && running[name].node === null) {
        delete running[name].node;      // Stopped
    }

    if (result) {
        let pid = running[name].node.pid;

        if (user) {
            delete running[name].node;  // Stopped
        } else {
            running[name].node = null;  // Terminated
        }

        // Check if the process is still running
        try {
            process.kill(pid, 0);
            running[name].user = user;
            running[name].terminate_cb = cb;
            running[name].timer = setTimeout(process.kill, 5000, pid, 'SIGKILL');

            process.kill(pid, 'SIGTERM');
        } catch (e) {
            console.error('Child process already terminated:', pid);
        }
    } else if (cb) {
        cb();
    }

    return result;
}

exports = module.exports = ApiExtensionRunner;
