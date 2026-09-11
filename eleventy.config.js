module.exports = function (eleventyConfig) {
	// Static assets that don't need any templating - copied as-is into the output.
	eleventyConfig.addPassthroughCopy("src/images");
	eleventyConfig.addPassthroughCopy("src/style.css");

	eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

	return {
		dir: {
			input: "src",
			output: "_site",
			includes: "_includes"
		}
	};
};
