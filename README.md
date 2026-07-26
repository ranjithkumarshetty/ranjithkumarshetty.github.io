# ranjithkumarshetty.github.io

Personal web-site: <https://ranjithkumarshetty.github.io>

Served straight from `master` by GitHub Pages. No build step, no generator, no
dependencies — every page is hand-written HTML that runs as-is in a browser.

## Layout

```
index.html                  the profile page (self-contained: CSS inlined, SVG icons)
content/images/2014/Oct/    the photo (self.jpg) — the dated path looks odd but is kept
                            stable, it is already a public URL and the og:image target
favicon.ico                 browsers ask for /favicon.ico whatever the page declares,
                            so one sits at the root to answer them
projects/                   leisure projects, one self-contained directory each
  jungle-addition/          a jungle-trail addition game for young children
.nojekyll                   serve the files verbatim; nothing here needs Jekyll
```

Adding another project means adding a directory under `projects/` and one more
`.project` card in the "Weekend tinkering" section of `index.html`.

## projects/jungle-addition

An addition game for a five-year-old: twenty stops along a jungle trail, five
kinds of question, animal friends and badges to collect.

- **No server, no accounts, no network calls.** Progress lives in the browser's
  own `localStorage` under the key `jungleAddition.v1`; the game itself sends
  nothing anywhere. Read-aloud goes through the browser's own speech synthesis,
  and prefers a voice marked as on-device where the device offers one.
- **Browser storage is per-browser and not forever.** Progress does not follow
  the child to another device or another browser, and Safari clears storage for
  a site after roughly a week without a visit. Where storage is unavailable at
  all — private browsing, for instance — the game falls back to memory and
  progress lasts until the tab is closed.
- **Save and restore.** Because of the above, the grown-up corner can download
  the save as a small JSON file and pour it back in later, or onto another
  device. The file is read locally by the browser; it is never uploaded.
- **No dependencies and no build step.** Plain `<script>` tags in load order,
  one stylesheet, emoji and inline SVG instead of image files.
- Grown-ups get a stats panel, save/restore, and a progress reset behind a long
  press on the leaf in the corner.

### Tests

The logic suite runs in a browser and headless from the same source file:

```
open projects/jungle-addition/tests.html          # in a browser
node projects/jungle-addition/tools/run-tests.js  # headless, no dependencies
```

`tools/bundle.js` inlines the whole app into a single `jungle-addition.html`
that works offline from `file://` — handy for AirDropping to a tablet. That
output is a build artifact and is gitignored: the sources beside it are what
gets published, so a stale copy is never served.
