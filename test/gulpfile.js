// Manual way to run/try the plugin

// Include gulp
var gulp = require('gulp');
var es = require('event-stream');

var spriter = require('../');


gulp.task('sprite', function() {

	// './test-css/minimal-for-bare-testing.css'
	return gulp.src('./test-css/overall.css')
		.pipe(spriter({
			'includeMode': 'implicit',
			'spriteSheet': './dist/images/spritesheet.png',
			'pathToSpriteSheetFromCSS': '../images/spritesheet.png'
		}))
		.pipe(es.wait(function(err, body) {
			console.log(arguments);
		}));
});


// Default Task
gulp.task('default', ['sprite']);