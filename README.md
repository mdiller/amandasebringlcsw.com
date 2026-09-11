# Amanda Sebring, LCSW

Website designed by/for Amanda Sebring for her LCSW private practice.

Very much a WIP at the moment.

## Development

Built with [Eleventy](https://www.11ty.dev/) - page content lives in `src/`,
the shared header/nav/footer live in `src/_includes/base.njk`. Every page's
front matter (`layout: base.njk`) pulls that layout in, so adding a new page
is just a new `.njk` file in `src/`.

```
npm install
npm start      # dev server with live reload at http://localhost:8080
npm run build  # outputs the plain static site to _site/
```

Deploy by uploading the contents of `_site/` to any static host - there's no
server-side runtime required.

