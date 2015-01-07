var path = require('path');
var extend = require('extend'); // https://www.npmjs.org/package/extend

var spriterUtil = require('./spriter-util');


function transformChunksWithSpriteSheetData(chunkDatas, coordinateMap, pathToSpriteSheetFromCSS) {
	// You can pass in a single chunk or array of chunks
	var chunkDataList = chunkDatas instanceof Array ? chunkDatas : [chunkDatas];

	var resultantChunkList = [];

	var backgroundURLMatchAllRegex = new RegExp(spriterUtil.backgroundURLRegex.source, "gi");
	chunkDataList.forEach(function(chunkData) {

		// Keep everything immutable as possible
		var resultantChunkData = extend(true, {}, chunkData);

		var contents = String(resultantChunkData.vinylFile.contents);

		var lines = contents.split(/\n/);

		// The current column offset of each line compared to what the `coordinateMap` says
		// This is so the find-replace does not mess up after many iterations on the same line
		var currentColumnPositionOffsetMap = {};

		resultantChunkData.backgroundImageDeclarations.forEach(function(declaration) {
			//console.log(declaration.value, declaration.position);

			// zero-index these values for nice array lookup
			var declarationStartLine = declaration.position.start.line-1;
			var declarationEndLine = declaration.position.end.line-1;
			var declarationStartColumn = declaration.position.start.column-1 + (currentColumnPositionOffsetMap[declarationStartLine] || 0);
			var declarationEndColumn = declaration.position.end.column-1 + (currentColumnPositionOffsetMap[declarationStartLine] || 0);

			// Replace the url with the spritesheet url
			var declarationText = lines[declarationStartLine].slice(declarationStartColumn, declarationEndColumn+1);
			// There could be multiple background images per declartion,
			// so we will keep a list and join it and add it later.
			var coordList = [];
			declarationText = declarationText.replace(backgroundURLMatchAllRegex, function(match, p1, p2, p3, offset, string) {
				var declarationImagePath = p2;

				// Make sure we are not matching the spritesheet itself. Who knows what the user tried to do
				if(declarationImagePath != pathToSpriteSheetFromCSS) {
					var coords = coordinateMap[path.join(path.dirname(resultantChunkData.vinylFile.path), declarationImagePath)];
					//console.log('cap:', declarationImagePath, coords);

					// Make sure there are coords for this image in the sprite sheet, otherwise we won't include it
					if(coords) {
						coordList.push("-" + coords.x + "px -" + coords.y + "px");

						var newBackgroundDeclaration = p1 + pathToSpriteSheetFromCSS + p3;
						return newBackgroundDeclaration;
					}
				}

				return match;
			});
			if(coordList.length > 0) {
				declarationText += " background-position: " + coordList.join(', ') + ";";
			}

			lines[declarationStartLine] = replaceStringBetween(
				lines[declarationStartLine],
				declarationStartColumn,
				declarationEndColumn+1,
				declarationText
			);


			// Add the length difference between the old declaration and new declaration
			// This is so the find-replace does not mess up after many iterations on the same line
			var oldDeclarationLength = declarationEndColumn-declarationStartColumn+1;
			currentColumnPositionOffsetMap[declarationStartLine] = (currentColumnPositionOffsetMap[declarationStartLine] || 0) + (declarationText.length - oldDeclarationLength);
		});

		var updatedContents = lines.join('\n');

		resultantChunkData.vinylFile.contents = new Buffer(updatedContents);
		resultantChunkList.push(resultantChunkData);

	});

	return resultantChunkList;
}



function replaceStringBetween(string, start, end, newString) {
	return string.substring(0, start) + newString + string.substring(end);
}



module.exports = transformChunksWithSpriteSheetData;