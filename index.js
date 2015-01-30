// gulp-css-spriter: https://www.npmjs.com/package/gulp-css-spriter
// Sprite Sheet Generation from CSS source files.
//
// By: Eric Eastwood: EricEastwood.com
//
// Meta info looks like: `/* @meta {"spritesheet": {"include": false}} */`

var fs = require('fs-extra');
var path = require('path');

var Promise = require('bluebird');
var outputFile = Promise.promisify(fs.outputFile);
var stat = Promise.promisify(fs.stat);

var through = require('through2'); // https://www.npmjs.org/package/through2
var extend = require('extend'); // https://www.npmjs.org/package/extend
var gutil = require('gulp-util'); // https://www.npmjs.org/package/gulp-util

var css = require('css'); // https://www.npmjs.com/package/css
var spritesmith = require('spritesmith'); // https://www.npmjs.com/package/spritesmith
var spritesmithBuild = Promise.promisify(spritesmith);


var spriterUtil = require('./lib/spriter-util');
var getBackgroundImageDeclarations = require('./lib/get-background-image-declarations');
var transformChunksWithSpriteSheetData = require('./lib/transform-chunks-with-sprite-sheet-data');





// consts
const PLUGIN_NAME = 'gulp-css-spriter';


var spriter = function(options) {

	var defaults = {
		// ('implicit'|'explicit')
		'includeMode': 'implicit',
		// The path and file name of where we will save the sprite sheet
		'spriteSheet': 'spritesheet.png',
		// Because we don't know where you will end up saving the CSS file at this point in the pipe,
		// we need a litle help identifying where it will be.
		'pathToSpriteSheetFromCSS': 'spritesheet.png',
		// Same as the spritesmith callback `function(err, result)`
		// result.image: Binary string representation of image
		// result.coordinates: Object mapping filename to {x, y, width, height} of image
		// result.properties: Object with metadata about spritesheet {width, height}
		'spriteSheetBuildCallback': null,
		// If true, we ignore any images that are not found on disk
		// Note: this plugin will still emit an error if you do not verify that the images exist
		'silent': true,
		// Check to make sure each image declared in the CSS exists before passing it to the spriter.
		// Although silenced by default(`options.silent`), if an image is not found, an error is thrown.
		'shouldVerifyImagesExist': true,
		// Any option you pass in here, will be passed through to spritesmith
		// https://www.npmjs.com/package/spritesmith#-spritesmith-params-callback-
		'spritesmithOptions': {}
	};

	var settings = extend({}, defaults, options);

	// This is where we keep track of the declarations for each chunk and 
	// info on the chunk itself
	var chunkDataList = [];
	// Check to make sure all of the images exist(`options.shouldVerifyImagesExist`) before trying to sprite them
	var imagePromiseArray = [];

	var stream = through.obj(function(chunk, enc, cb) {
		// http://nodejs.org/docs/latest/api/stream.html#stream_transform_transform_chunk_encoding_callback
		//console.log('transform');

		// Each `chunk` is a vinyl file: https://www.npmjs.com/package/vinyl
		// chunk.cwd
		// chunk.base
		// chunk.path
		// chunk.contents


		if (chunk.isStream()) {
			self.emit('error', new gutil.PluginError(PLUGIN_NAME, 'Cannot operate on stream'));
		}
		else if (chunk.isBuffer()) {
			var contents = String(chunk.contents);

			var styles = css.parse(contents, {
				'silent': settings.silent
			});

			
			var chunkBackgroundImageDeclarations = getBackgroundImageDeclarations(styles, settings.includeMode);


			// Get a list of all of the images
			// We use an object for imageMap so we don't get any duplicates
			var imageMap = {};
			var backgroundURLMatchAllRegex = new RegExp(spriterUtil.backgroundURLRegex.source, "gi");
			chunkBackgroundImageDeclarations.forEach(function(declaration) {
				var backgroundImageMatch;
				while((backgroundImageMatch = backgroundURLMatchAllRegex.exec(declaration.value)) != null) {
					// javascript RegExp has a bug when the match has length 0
					if (backgroundImageMatch.index === backgroundURLMatchAllRegex.lastIndex) {
						// Avoid infinite recursion
						backgroundURLMatchAllRegex.lastIndex += 1;
					}
					// the match variable is an array that contains the matching groups
					var imagePath = path.join(path.dirname(chunk.path), backgroundImageMatch[2]);
					imageMap[imagePath] = true;
				}
			});

			// Add to the queue where we filter out any images that do not exist
			Object.keys(imageMap).forEach(function(imagePath) {
				var filePromise;
				if(settings.shouldVerifyImagesExist) {
					filePromise = stat(imagePath).then(function() {
						return {
							doesExist: true,
							path: imagePath
						};
					}, function() {
						return {
							doesExist: false,
							path: imagePath
						};
					});
				}
				else {
					filePromise = new Promise(function(resolve, reject) {
						resolve({
							path: imagePath
						});
					});
				}

				imagePromiseArray.push(filePromise);
			});


			// Keep track of each chunk and what declarations go with it
			// Because the positions/line numbers pertain to that chunk only
			chunkDataList.push({
				'vinylFile': chunk,
				'backgroundImageDeclarations': chunkBackgroundImageDeclarations
			});

		}


		// "call callback when the transform operation is complete."
		cb();

	}, function(cb) {
		// http://nodejs.org/docs/latest/api/stream.html#stream_transform_flush_callback
		//console.log('flush');
		var self = this;

		// Update the image list when all of the async checks have finished
		var imagesVerifiedPromise = Promise.all(imagePromiseArray).then(function(res) {
			var imageList = [];
			res.forEach(function(imageInfo) {
				if(imageInfo.doesExist === true || imageInfo.doesExist === undefined) {
					imageList.push(imageInfo.path);
				}
				else {
					// Tell them that we could not find the image
					var logMessage = 'Image could not be found:' + imageInfo.path;
					self.emit('log', logMessage);

					// Emit an error if necessary
					if(!settings.silent) {
						self.emit('error', new Error(logMessage));
					}
				}
			});

			return imageList;
		});


		// Start spriting once we know the true list of images that exist
		imagesVerifiedPromise.then(function(imageList) {

			// Generate the spritesheet
			var spritesmithOptions = extend({}, settings.spritesmithOptions, { src: imageList });
			
			var spriteSmithBuildPromise = spritesmithBuild(spritesmithOptions);

			spriteSmithBuildPromise.then(function(result) {

				var whenImageDealtWithPromise = new Promise(function(resolve, reject) {
					// Save out the spritesheet image
					if(settings.spriteSheet) {
						outputFile(settings.spriteSheet, result.image, 'binary').then(function(err) {
							if(err) {
								err.message = 'Spritesheet failed to save:\n' + err.message;
								self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
							} else {
								//console.log("The file was saved!");

								// Push all of the chunks back on the pipe
								var transformedChunkDataList = transformChunksWithSpriteSheetData(chunkDataList, result.coordinates, settings.pathToSpriteSheetFromCSS);
								transformedChunkDataList.forEach(function(chunkData) {
									var transformedChunk = chunkData.vinylFile;

									// Attach the spritesheet in case someone wants to use it down the pipe
									transformedChunk.spritesheet = result.image;

									self.push(transformedChunk);
								});


								// Call a callback from the settings the user can hook onto
								if(settings.spriteSheetBuildCallback) {
									settings.spriteSheetBuildCallback(err, result);
								}

							}

						}).done(function() {
							resolve();
						});
					}
					else {
						resolve();
					}
				});

				whenImageDealtWithPromise.done(function() {
					// "call callback when the flush operation is complete."
					cb();
				});

				
			}, function(err) {
				if(err) {
					err.message = 'Error creating sprite sheet image:\n' + err.message;
					self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
				}
			});


		});



		

	});

	// returning the file stream
	return stream;
};


module.exports = spriter;