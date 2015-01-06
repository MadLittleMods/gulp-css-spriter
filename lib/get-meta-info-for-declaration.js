

var extend = require('extend'); // https://www.npmjs.org/package/extend


function getMetaInfoForDeclaration(rule, declarationIndex) {
	var resultantMetaData = {};

	if(declarationIndex > 0 && declarationIndex < rule.declarations.length) {
		var mainDeclaration = rule.declarations[declarationIndex];
		if(mainDeclaration) {

			// Meta data can exist before or on the same line as the declaration.
			// Both Meta blocks are valid for the background property
			// ex.
			// /* @meta {"spritesheet": {"include": false}} */
			// background: url('../images/aenean-purple.png'); /* @meta {"sprite": {"skip": true}} */
			var beforeDeclaration = rule.declarations[declarationIndex-1];
			var afterDeclaration = rule.declarations[declarationIndex+1];


			if(beforeDeclaration) {
				// The before declaration should be valid no matter what (even if multiple lines above)
				// The parse function does all the nice checking for us
				extend(resultantMetaData, parseCommentDecarationForMeta(beforeDeclaration));
			}

			if(afterDeclaration) {
				//console.log(mainDeclaration);
				//console.log(afterDeclaration);
				//console.log(afterDeclaration.position.start.line, mainDeclaration.position.start.line);
				// Make sure that the comment starts on the same line as the main declaration
				if(afterDeclaration.position.start.line == mainDeclaration.position.start.line) {
					extend(resultantMetaData, parseCommentDecarationForMeta(afterDeclaration));
				}
			}
		}
	}


	function parseCommentDecarationForMeta(declaration) {
		if(declaration.type == "comment")
		{
			//console.log(declaration);

			var metaMatches = declaration.comment.match(/@meta\s*({.*?}(?!}))/);

			if(metaMatches) {
				var parsedMeta = {};
				try {
					parsedMeta = JSON.parse(metaMatches[1]);
				}
				catch(e) {
					//console.warn('Meta info was found but failed was not valid JSON');
				}

				return parsedMeta;
			}
		}
	}


	return resultantMetaData;
}



module.exports = getMetaInfoForDeclaration;