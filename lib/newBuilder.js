var fs = require('fs');
var path = require('path');
var async = require('async');
var requirejs = require('component-require');
var strtojs = require('string-to-js');

var buildTypes = require('./buildTypes.js');
var helpers = require('./helpers.js');

// Localize helper functions
var resolveComponentDir = helpers.resolveComponentDir;



function Timer() {
	this.startTime = new Date();
}


Timer.prototype.getTime = function () {
	var currentTime = new Date();
	return currentTime - this.startTime;
};


/**
 * 
 * @param {type} dir
 * @param {type} parent
 * @returns {Builder}
 */
function Builder(dir, parent, options) {
	var timer = new Timer();
	this.logger.info('Initialising component builder: ', dir);

	options = options || {};

	this.dir = path.resolve(dir);
	this.rootPath = (parent) ? parent.rootPath : options.rootPath || dir;
	this.parent = parent;

	this.globalLookupPaths = (parent) ? parent.globalLookupPaths : [];

	this._dev = false;
	this._config = null;
	this._deps = (parent) ? parent._deps : null;

	this._cache = (parent) ? parent._cache : {};

	this.logger.info('Initialised component builder: ', dir, timer.getTime() + 'ms');
	delete timer;
}


/**
 * 
 */
Builder.prototype.build = function (cb) {
	var self = this;

	// First we resolve dependencies to avoid race conditions for the below parallel executions.
	self.resolveDependencies(function (error) {
		if (error) {
			return cb(error);
		}

		async.parallel([
			function (callback) {
				self.buildType('scripts', callback);
			},
			function (callback) {
				self.buildType('styles', callback);
			},
			function (callback) {
				self.buildType('images', callback);
			},
			function (callback) {
				self.buildType('fonts', callback);
			},
			function (callback) {
				self.buildType('files', callback);
			},
		], function (error) {
			if (error) {
				return cb(error);
			}

			return cb(null, {
				js: self._cache.scripts,
				css: self._cache.styles,
				images: self._cache.images,
				fonts: self._cache.fonts,
				files: self._cache.files,
				require: requirejs
			});
		});
	});
}


/**
 * 
 * @param {type} cb
 * @returns {unresolved}
 */
Builder.prototype.buildType = function (type, cb) {
	var self = this;
	var dataString = '';

	if (!self.parent && self._cache[type])  {
		return cb(null, self._cache[type]);
	}

	self.logger.info('Building "' + type + '" for component: ', self.dir);

	self.resolveDependencies(function (error, dependencies) {
		if (error) {
			return cb (error);
		}

		var depDirs = (!self.parent) ? Object.keys(dependencies) : [];
		async.forEach(depDirs, function (depDir, depCb) {
			dependencies[depDir].buildType(type, function (error, data) {
				if (error) {
					return depCb(error);
				}

				if (data) {
					dataString += '\n' + data;
				}

				return depCb();
			});
		}, function (error) {
			if (error) {
				return cb(error);
			}

			var typeBuilder = buildTypes[type];
			typeBuilder(self, function (error, data) {
				if (error) {
					return cb(error);
				}

				if (data) {
					dataString += '\n' + data;
				}

				if (!self.parent) {
					self._cache[type] = dataString;
				}

				return cb(null, dataString);
			});
		});
	});
};


/**
 * 
 */
Builder.prototype.resolveDependencies = function (cb) {
	var self = this;

	// If this is the root component and it has the private _deps object, return it
	if (!self.parent && self._deps) {
		return cb(null, self._deps);
	}

	self.getConfig(function (error, config) {
		if (error) {
			return cb (error);
		}

		// Ensure private _deps object is initialized
		self._deps = self._deps || {};

		// Localize config values, and ensure initialized
		var deps = config.dependencies || {};
		var devDeps = (self._dev) ? config.development : {};
		var localDeps = config.local || [];
		var localPaths = config.paths || [];
		var lookupPaths = self.globalLookupPaths.concat(localPaths);

		// Scan dependencies recursively adn get all dependency compononents, this is done in series
		// to prevent race conditions
		async.parallel([
			function (depsCb) {
				async.forEach(Object.keys(deps), function (depName, depCb) {
					resolveComponentDir(depName, lookupPaths, self.dir, function (error, depDir) {
						if (error) {
							return depCb(error);
						}

						if (self._deps[depDir]) {
							return depCb();
						}

						self._deps[depDir] = new Builder(depDir, self);
						self._deps[depDir].resolveDependencies(function (error) {
							return depCb(error);
						});
					});
				}, depsCb);
			},
			function (devDepsCb) {
				async.forEach(Object.keys(devDeps), function (depName, depCb) {
					resolveComponentDir(depName, lookupPaths, self.dir, function (error, depDir) {
						if (error) {
							return depCb(error);
						}

						if (self._deps[depDir]) {
							return depCb();
						}

						self._deps[depDir] = new Builder(depDir, self);
						self._deps[depDir].resolveDependencies(function (error) {
							return depCb(error);
						});
					});
				}, devDepsCb);
			},
			function (localDepsCb) {
				async.forEach(localDeps, function (depName, depCb) {
					resolveComponentDir(depName, lookupPaths, self.dir, function (error, depDir) {
						if (error) {
							return depCb(error);
						}

						if (self._deps[depDir]) {
							return depCb();
						}

						self._deps[depDir] = new Builder(depDir, self);
						self._deps[depDir].resolveDependencies(function (error) {
							return depCb(error);
						});
					});
				}, localDepsCb);
			}
		], function (error) {
			if (error) {
				return cb(error);
			}

			return cb(null, self._deps);
		});
	});
};


/**
 * 
 */
Builder.prototype.getConfig = function (cb) {
	var self = this;

	if (self._config) {
		return cb(null, self._config);
	}

	fs.readFile(path.join(self.dir, 'component.json'), null, function (error, data) {
		if (error) {
			return cb(error);
		}

		// parse the json data
		var config = JSON.parse(data);

		// TODO: add linting to the outcome

		self._config = config;
		return cb(null, self._config);
	});
}


/**
 * 
 * @type type
 */
Builder.prototype.logger = {
	info: console.info,
	warning: console.warn,
	error: console.error
};


/**
 * 
 * @param {type} info
 * @param {type} warning
 * @param {type} error
 * @returns {undefined}
 */
Builder.prototype.bindLoggers = function (info, warning, error) {
	this.logger.info = info || this.logger.info;
	this.logger.warning = warning || this.logger.warning;
	this.logger.error = error || this.logger.error;
};


/**
 * 
 */
Builder.prototype.addGlobalRelativeLookup = function (lookupPaths) {
	this.globalLookupPaths = this.globalLookupPaths.concat(lookupPaths);
};


//
module.exports = Builder;