var fs = require('fs');
var path = require('path');
var async = require('async');


/**
 * 
 */
function registerWrapper(fileName, javascript){
    return 'require.register("' + fileName + '", function(exports, require, module){\n' + javascript + '\n});';
}


/**
 * 
 */
exports.scripts = function (builder, cb) {
	builder.getConfig(function (error, config) {
		if (error) {
			return cb(error);
		}

		var dataString = '';
		var templates = config.templates || [];
		var scripts = config.scripts || [];

		async.parallel([
			function (callback) {
				async.forEach(templates, function (template, templateCb) {
					var fileName = path.join(builder.dir, template);
					var relativeFileName = path.relative(builder.rootPath, fileName);

					fs.readFile(fileName, null, function (error, data) {
						if (error) {
							return templateCb(error);
						}

						dataString += registerWrapper(relativeFileName, data);
						return templateCb();
					});
				}, callback);
			},
			function (callback) {
				async.forEach(scripts, function (script, scriptCb) {
					var fileName = path.join(builder.dir, script);
					var relativeFileName = path.relative(builder.rootPath, fileName);

					fs.readFile(fileName, null, function (error, data) {
						if (error) {
							return scriptCb(error);
						}

						dataString += registerWrapper(relativeFileName, data);
						return scriptCb();
					});
				}, callback);
			}
		], function (error) {
			if (error) {
				return cb(error);
			}

			return cb(null, dataString);
		});
	});
}


/**
 * 
 */
exports.styles = function (builder, cb) {
	builder.getConfig(function (error, config) {
		if (error) {
			return cb(error);
		}

		return cb(null, '');
	});
}


/**
 * 
 */
exports.images = function (builder, cb) {
	builder.getConfig(function (error, config) {
		if (error) {
			return cb(error);
		}

		return cb(null, '');
	});
}


/**
 * 
 */
exports.fonts = function (builder, cb) {
	builder.getConfig(function (error, config) {
		if (error) {
			return cb(error);
		}

		return cb(null, '');
	});
}


/**
 * 
 */
exports.files = function (builder, cb) {
	builder.getConfig(function (error, config) {
		if (error) {
			return cb(error);
		}

		return cb(null, '');
	});
}