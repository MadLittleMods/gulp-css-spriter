
var extend = require('extend'); // https://www.npmjs.org/package/extend

var spriterUtil = require('./spriter-util');
var getMetaInfoForDeclaration = require('./get-meta-info-for-declaration');



function getBackgroundImageDeclarations(styles, includeMode) {
	includeMode = includeMode || 'implicit';
	
	// First get all of the background image declarations
	var chunkBackgroundImageDeclarations = getAllBackgroundImageDeclarations(styles);

	// Filter out any declartion with the `include: false` meta
	chunkBackgroundImageDeclarations = chunkBackgroundImageDeclarations.filter(function(declaration) {
		var metaIncludeValue = (declaration.meta && declaration.meta.spritesheet && declaration.meta.spritesheet.include);
		var shouldIncludeBecauseImplicit = includeMode === 'implicit' && (metaIncludeValue === undefined || metaIncludeValue);
		var shouldIncludeBecauseExplicit = includeMode === 'explicit' && metaIncludeValue;
		var shouldInclude = shouldIncludeBecauseImplicit || shouldIncludeBecauseExplicit;

		// Only return declartions that shouldn't be skipped
		return shouldInclude;
	});

	return chunkBackgroundImageDeclarations;
}



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





module.exports = getBackgroundImageDeclarations;