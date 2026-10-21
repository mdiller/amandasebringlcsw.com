module.exports = function (eleventyConfig) {
	// Static assets that don't need any templating - copied as-is into the output.
	eleventyConfig.addPassthroughCopy("src/images");
	// (style.css is a template, src/style.css.njk, so it can embed the build id too.)

	eleventyConfig.addShortcode("year", () => `${new Date().getFullYear()}`);

	// Cache busting: every build gets a new id, appended as ?v=<id> to the CSS/image URLs.
	// Browsers treat them as new files after each deploy instead of reusing a cached copy.
	const buildId = Date.now();
	eleventyConfig.addGlobalData("buildId", buildId);
	eleventyConfig.addFilter("bust", (path) => `${path}?v=${buildId}`);

	return {
		dir: {
			input: "src",
			output: "_site",
			includes: "_includes"
		}
	};
};
