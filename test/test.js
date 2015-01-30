
var Promise = require('bluebird');

var chai = require('chai');
var expect = require('chai').expect;
var chaiAsPromised = require('chai-as-promised');
chai.use(chaiAsPromised);

var extend = require('extend');

var path = require('path');
var fs = require('fs');
var readFile = Promise.promisify(fs.readFile);

var gutil = require('gulp-util');

var css = require('css');


// The main gulp plugin to test
var spriter = require('../');

// Test out some individual components
var getBackgroundImageDeclarations = require('../lib/get-background-image-declarations');





describe('gulp-css-spriter', function() {
	it('should emit a buffer', function(done) {
		var spriterPromise = spriterTest({});

		mochaPromiseTest(spriterPromise, done, function(result) {
			// make sure it came out the same way it went in
			expect(result.isBuffer()).to.equal(true);
		});
	});

	it('should work with minified css', function(done) {
		var spriterPromise = spriteSheetBuildCallbackResultTest({
			'includeMode': 'implicit'
		}, 'test/test-css/background.min.css');

		mochaPromiseTest(spriterPromise, done, function(result) {
			expect((Object.keys((result || {}).coordinates) || []).length).to.equal(2);
		});
	});

	it('should not try to sprite external images', function(done) {
		var spriterPromise = spriteSheetBuildCallbackResultTest({}, 'test/test-css/external-image.css');

		mochaPromiseTest(spriterPromise, done, function(result) {
			expect((Object.keys((result || {}).coordinates) || []).length).to.equal(0);
		});
	});

	// All declarations will be included except those with explcit `includeMode` false meta data
	it('should work in implicit mode `options.includeMode`', function(done) {
		var spriterPromise = spriteSheetBuildCallbackResultTest({
			'includeMode': 'implicit'
		});

		mochaPromiseTest(spriterPromise, done, function(result) {
			expect((Object.keys((result || {}).coordinates) || []).length).to.equal(8);
		});
	});

	// Only declarations with explicit `includeMode` true meta data, will be sprited
	it('should work in explicit mode `options.includeMode`', function(done) {
		var spriterPromise = spriteSheetBuildCallbackResultTest({
			'includeMode': 'explicit'
		});

		mochaPromiseTest(spriterPromise, done, function(result) {
			expect((Object.keys((result || {}).coordinates) || []).length).to.equal(1);
		});
	});

	it('should throw error with non-existent file when `options.silent` is false', function() {
		var spriterPromise = spriterTest({
			'silent': false
		}, 'test/test-css/non-existent-image.css');

		return expect(spriterPromise).to.eventually.be.rejected;
	});


	it('should verify images `options.shouldVerifyImagesExist`', function() {

		// This should throw
		var spriterPromiseNoCheck = spriterTest({
			'shouldVerifyImagesExist': false
		}, 'test/test-css/non-existent-image.css');

		// This should pass because we verify first
		var spriterPromiseCheck = spriterTest({
			'shouldVerifyImagesExist': true
		}, 'test/test-css/non-existent-image.css');

		return Promise.all([
			expect(spriterPromiseNoCheck).to.eventually.be.rejected,
			expect(spriterPromiseCheck).to.eventually.be.fulfilled
		]);
	});

	it('should call `includeMode.spriteSheetBuildCallback` when done', function(done) {
		mochaPromiseTest(spriteSheetBuildCallbackResultTest({}), done, function(result) {
			// Make sure that callback passes in all of the properties we expect
			expect(result).to.have.property('image');
			expect(result).to.have.property('coordinates');
			expect(result).to.have.property('properties');
		});
	});

	it('should pass options through to spritesmith using `options.spritesmithOptions`', function(done) {
		// We make sure the spritesmith options were passed by using opposite-style stacking algorithms
		// and then comparing the width/height of both
		var testDifferentStackingPromise = Promise.all([
			buildCallbackWithAlgorithmPromise('top-down'),
			buildCallbackWithAlgorithmPromise('left-right')
		]);
		mochaPromiseTest(testDifferentStackingPromise, done, function(res) {
			var verticalStackingData = res[0];
			var horizontalStackingData = res[1];

			// Make sure the two proportions are different
			expect(verticalStackingData.properties.height).to.be.above(horizontalStackingData.properties.height);
			expect(horizontalStackingData.properties.width).to.be.above(verticalStackingData.properties.width);
		});

		function buildCallbackWithAlgorithmPromise(algorithm) {
			var extraSpriterOps = {
				spritesmithOptions: {
					algorithm: algorithm
				}
			};

			return spriteSheetBuildCallbackResultTest(extraSpriterOps);
		}

	});


	// Get a promise that resolves with the transformed file/chunks
	function spriterTest(spriterOptions, filePath) {
		spriterOptions = spriterOptions || {};
		filePath = filePath || 'test/test-css/overall.css';

		var whenSpriterDonePromise = new Promise(function(resolve, reject) {

			readFile(filePath).then(function(contents) {
				contents = String(contents);

				// create the fake file
				var fakeFile = new gutil.File({
					base: process.cwd(),
					cwd: process.cwd(),
					path: path.join(process.cwd(), filePath),
					contents: new Buffer(contents)
				});

				// Create a spriter plugin stream
				var mySpriter = spriter(spriterOptions);

				// wait for the file to come back out
				mySpriter.on('data', function(file) {
					resolve(file);
				});

				mySpriter.on('error', function(err) {
					reject(err);
				});

				mySpriter.on('end', function() {
					resolve();
				});
			
				// write the fake file to it
				mySpriter.write(fakeFile);
				mySpriter.end();

			}, function(err) {
				reject(err);
			});
		});

		return whenSpriterDonePromise;
	}

	// Get a promise representing the result of `options.spriteSheetBuildCallback`
	function spriteSheetBuildCallbackResultTest(opts, filePath) {
		return new Promise(function(resolve, reject) {
			var spriterOpts = extend({}, {
				spriteSheetBuildCallback: function(err, result) {
					if(err) {
						reject(err);
					}
					else {
						resolve(result);
					}
				}
			}, opts);

			spriterTest(spriterOpts, filePath).then(function(file) {
				// nothing
			}, function(err) {
				reject(err);
			});
		});
	}


});




describe('lib/getBackgroundImageDeclarations(...)', function() {
	
	it('should work with single background declarations', function(done) {
		testGetBackgroundImageDeclarationsFromFile(done, 'test/test-css/background.css', 2);
	});

	it('should work with single background-image declarations', function(done) {
		testGetBackgroundImageDeclarationsFromFile(done, 'test/test-css/background-image.css', 1);
	});

	it('should work with mulitple images defined in background(-image) declarations', function(done) {
		testGetBackgroundImageDeclarationsFromFile(done, 'test/test-css/multiple-backgrounds.css', 2);
	});

	it('should factor in the `include` meta data', function(done) {
		testGetBackgroundImageDeclarationsFromFile(done, 'test/test-css/meta-include.css', 1);
	});

	it('should work with minified css', function(done) {
		testGetBackgroundImageDeclarationsFromFile(done, 'test/test-css/background.min.css', 2);
	});


	function testGetBackgroundImageDeclarationsFromFile(done, filePath, numExpectedDeclarations) {
		mochaPromiseTest(readFile(filePath), done, function(contents) {
			contents = String(contents);

			var styles = css.parse(contents, {
				'silent': false
			});
			var imageDeclarations = getBackgroundImageDeclarations(styles);
	
			expect((imageDeclarations || []).length).to.equal(numExpectedDeclarations);
		});
	}
});





// Boilerplate for running a test with a async promise
function mochaPromiseTest(promise, done, cb) {
	promise.then(function() {
		try {
			if(cb) {
				cb.apply(null, arguments);
			}
			done();
		}
		catch(err) {
			done(err);
		}

	}, function(err) {
		done(err);
	});
}
