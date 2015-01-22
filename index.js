// gulp-css-spriter: https://www.npmjs.com/package/gulp-css-spriter
// Sprite Sheet Generation from CSS source files.
//
// By: Eric Eastwood: EricEastwood.com
//
// Meta info looks like: `/* @meta {"spritesheet": {"include": false}} */`

var fs = require('fs-extra');
var path = require('path');

var Promise = require('promise');
var outputFile = Promise.denodeify(fs.outputFile);

var through = require('through2'); // https://www.npmjs.org/package/through2
var extend = require('extend'); // https://www.npmjs.org/package/extend
var gutil = require('gulp-util'); // https://www.npmjs.org/package/gulp-util

var css = require('css'); // https://www.npmjs.com/package/css
var spritesmith = require('spritesmith'); // https://www.npmjs.com/package/spritesmith


var spriterUtil = require('./lib/spriter-util');
var getAllBackgroundImageDeclarations = require('./lib/get-all-background-image-declarations');
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
		// Any option you pass in here, will be passed through to spritesmith
		// https://www.npmjs.com/package/spritesmith#-spritesmith-params-callback-
		'spritesmithOptions': {}
	};

	var settings = extend({}, defaults, options);

	// This is where we keep track of the declarations for each chunk and 
	// info on the chunk itself
	var chunkDataList = [];
	// Since we only want a unique list of images, use a object
	var imageList = {};

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
				'silent': false
			});

			var chunkBackgroundImageDeclarations = getAllBackgroundImageDeclarations(styles);

			// Filter out any declartion with the `include: false` meta
			chunkBackgroundImageDeclarations = chunkBackgroundImageDeclarations.filter(function(declaration) {
				var metaIncludeValue = (declaration.meta && declaration.meta.spritesheet && declaration.meta.spritesheet.include);
				var shouldIncludeBecauseImplicit = settings.includeMode === 'implicit' && (metaIncludeValue === undefined || metaIncludeValue);
				var shouldIncludeBecauseExplicit = settings.includeMode === 'explicit' && metaIncludeValue;
				var shouldInclude = shouldIncludeBecauseImplicit || shouldIncludeBecauseExplicit;

				// Only return declartions that shouldn't be skipped
				return shouldInclude;
			});


			// Get a list of all of the images
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
					//console.log(backgroundImageMatch[1]);
					imageList[path.join(path.dirname(chunk.path), backgroundImageMatch[2])] = true;
				}
			});



			// Keep track of each chunk and what declarations go with it
			// Because the positions/line numbers pertain to that chunk only
			chunkDataList.push({
				'vinylFile': chunk,
				'backgroundImageDeclarations': chunkBackgroundImageDeclarations
			});

		}


		return cb();

	}, function(cb) {
		// http://nodejs.org/docs/latest/api/stream.html#stream_transform_flush_callback
		//console.log('flush');
		var self = this;

		// Generate the spritesheet
		var spritesmithOptions = extend({}, settings.spritesmithOptions, { src: Object.keys(imageList) });
		spritesmith(spritesmithOptions, function handleResult(err, result) {

			if (err) {
				err.message = 'Error creating sprite sheet image:\n' + err.message;
				self.emit('error', new gutil.PluginError(PLUGIN_NAME, err));
			}

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

			
		});



		

	});

	// returning the file stream
	return stream;
};


module.exports = spriter;