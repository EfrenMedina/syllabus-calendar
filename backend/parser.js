const { PDFParse } = require('pdf-parse');

async function parse(filePath) {
	const parser = new PDFParse({ url: filePath });

	const result = await parser.getText();
	return result.text;
}

 module.exports = parse