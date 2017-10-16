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
function ApiExtensionRunner(cb) {
    process.on('SIGTERM', _terminate);
    process.on('SIGINT', _terminate);

    let fs = require('fs');
    fs.readFile('running.json', 'utf8', function(err, data) {
        if(!err && cb) {
            try {
                cb(JSON.parse(data));
            } catch (e) {
                console.error(e);
            }
        }
    });
}

/**
 * Starts an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 */
ApiExtensionRunner.prototype.start = function(name, cwd, module_dir, inherit_mode, cb) {
    let stdio;
    let args = [];

    if (inherit_mode == 'ignore') {
        stdio = ['ignore', 'ignore', 'ignore', 'ipc'];
    } else {
        stdio = ['ignore', 'inherit', 'inherit', 'ipc'];

        args.push(inherit_mode);            // Pass option to child
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
        cwd: cwd,
        module_dir: module_dir,
        inherit_mode: inherit_mode,
        monitor_cb: cb,
        node: node
    };
}

/**
 * Restarts an extension identified by name
 *
 * @param {String} name - The name of the extension according to its package.json file
 */
ApiExtensionRunner.prototype.restart = function(name, cb) {
    _terminate_child(name, false, (code, signal) => {
        const node = running[name];

        ApiExtensionRunner.prototype.start.call(this, name, node.cwd, node.module_dir,
                                                node.inherit_mode, node.monitor_cb);

        if (cb) {
            cb();
        }
    });
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
 * @returns {('stopped'|'running')} - The current status of the extension
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
        if (running[name].node === undefined) {
            delete running[name];
        }
    }

    // Write names of running extensions to file
    let fs = require('fs');
    fs.writeFile('running.json', JSON.stringify(Object.keys(running)), function(err) {
        // Terminate running extensions
        _terminate_all(cb);
    });
}

function _terminate() {
    ApiExtensionRunner.prototype.prepare_exit.call(this, () => {
        process.exit(0);
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

    if (user && running[name].node === null) {
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
