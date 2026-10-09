# Social previews (#30)

Every public EN/DE page, including calendar series, has its own 1200×630 PNG
under `/social/<lang>/…`. Cards use the approved `assets/logo.png`, the Latin
VseGiri brand, the localized SEO section title and the repository's fonts.
Open Graph and Twitter titles/descriptions match the page's search metadata;
the shared URL is its clean canonical, without calculator state or filters.

The ordinary Node build copies the checked-in PNGs unchanged. It needs no new
dependencies. The optional asset-authoring command is:

```sh
# Authoring environment only: Pillow and fontTools[woff] (including Brotli).
node scripts/social-cards.mjs
npm run check
```

Run it when adding a page or changing a card's title, language label, brand,
domain or logo. Inspect the resulting PNGs before committing. The manifest and
regression tests detect missing cards and stale card copy. They also check the
published PNG structure/dimensions and the metadata of every generated page.
The renderer fails rather than silently clipping an unsupported long title.

Card appearance is fixed and independent of browser theme. This feature only
adds head metadata and public images; it does not change the page body, CSS,
interactive tools, calendar data, feeds or redirects. Social platforms cache
previews; an existing shared link may need a refresh in the platform's own
debugger after deployment.
