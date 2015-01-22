
var extend = require('extend'); // https://www.npmjs.org/package/extend

var spriterUtil = require('./spriter-util');
var getMetaInfoForDeclaration = require('./get-meta-info-for-declaration');




function getAllBackgroundImageDeclarations(styles) {
	// Get all the declarations that have background `url()` declarations
	var backgroundImageDeclarations = [];
	styles.stylesheet.rules.forEach(function(rule) {
		if(rule.type === 'rule') {
			rule.declarations.forEach(function(declaration, declarationIndex) {
				// background-image always has a url
				if(declaration.property === 'background-image') {
					backgroundImageDeclarations.push(attachInfoToDeclaration(rule, declarationIndex));
				}
				// Background is a shorthand property so make sure `url()` is in there
				else if(declaration.property === 'background') {
					var hasImageValue = spriterUtil.backgroundURLRegex.test(declaration.value);

					if(hasImageValue) {
						backgroundImageDeclarations.push(attachInfoToDeclaration(rule, declarationIndex));
					}
				}
			});
		}
	});

	return backgroundImageDeclarations;
}


function attachInfoToDeclaration(rule, declarationIndex)
{
	if(rule) {
		// Clone the declartion to keep it immutable
		var declaration = extend(true, {}, rule.declarations[declarationIndex]);

		var declarationMetaInfo = getMetaInfoForDeclaration(rule, declarationIndex);

		// Add the meta into to the declaration
		// Check for null or undefined
		if(declaration.meta == null) {
			declaration.meta = {};
		}
		extend(declaration.meta, declarationMetaInfo);

		return declaration;
	}

	return null;
}



module.exports = getAllBackgroundImageDeclarations;