var fs = require('fs');
var path = require('path');
var async = require('async');


/**
 * 
 */
var normalizeComponentName = exports.normalizeComponentName = function (name) {
	return name.replace('/', '-');
}


/**
 * 
 */
exports.resolveComponentDir = function (componentName, lookupPaths, parentDir, cb) {
	async.forEach(lookupPaths, function (lookupPath, callback) {
		var checkPath = path.join(lookupPath, normalizeComponentName(componentName));
		var absolutePath = path.resolve(parentDir, checkPath);

		fs.exists(path.join(absolutePath, 'component.json'), function (exists) {
			if (!exists) {
				return callback();
			}

			return cb(null, absolutePath);
		});
	}, function () {
		var errorMessage = 'Could not resolve directory for component "' + componentName + '" found in ' + path.join(parentDir, 'component.json');
		var error = new Error(errorMessage);
		return cb(error);
	});
};