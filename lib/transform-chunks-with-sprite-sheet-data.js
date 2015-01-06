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

		resultantChunkData.backgroundImageDeclarations.forEach(function(declaration) {
			//console.log(declaration.position);

			// Replace the url with the spritesheet url
			var declarationText = lines[declaration.position.start.line-1].slice(declaration.position.start.column-1, declaration.position.end.column);
			// There could be multiple background images per declartion,
			// so we will keep a list and join it and add it ater.
			var coordList = [];
			declarationText = declarationText.replace(backgroundURLMatchAllRegex, function(match, p1, p2, p3, offset, string) {
				var declarationImagePath = p2;

				var coords = coordinateMap[path.join(path.dirname(resultantChunkData.vinylFile.path), declarationImagePath)];
				coordList.push("-" + coords.x + "px -" + coords.y + "px");
				//console.log(declarationImagePath, coords);

				var newBackgroundDeclaration = p1 + pathToSpriteSheetFromCSS + p3;
				return newBackgroundDeclaration;
			});
			declarationText += " background-position: " + coordList.join(', ') + ";";

			lines[declaration.position.start.line-1] = replaceStringBetween(
				lines[declaration.position.start.line-1],
				declaration.position.start.column-1,
				declaration.position.end.column,
				declarationText
			);
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