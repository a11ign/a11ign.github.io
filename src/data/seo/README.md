# Search and AI visibility pack (draft)

Files for the site root. Replace `www.a11ign.com` and the `lastmod` dates before publishing; regenerate `lastmod` on every build.

- `sitemap.xml`: every page, for Google and other search engines.
- `llms.txt`: a plain summary and page list for AI assistants and AI search (the llms.txt convention).
- `robots.txt`: allows everything and points to the sitemap. Decide whether you want to allow or block specific AI crawlers.

## Per page: title and description

| Page | Title tag | Meta description |
|---|---|---|
| `/` | Test accessibility the way a screen reader user hears it | a11ign runs a real screen reader (NVDA) over your pages and shows you the barriers it hits, with the exact words it said. Free and open source. |
| `/get-started` | Get started with a11ign | Add a11ign to your GitHub workflow, ask your AI agent to do it, or run it from the command line. |
| `/what-it-checks` | What a11ign checks and how it fits your tech stack | What a real screen reader catches that code checks miss, how a finding is decided, and how a11ign sits beside GitHub Actions, axe-core and your tests. |
| `/docs` | Documentation | Set up a11ign and see how it works: the GitHub Action guide, the evidence, security and how to contribute. |
| `/docs/github-action` | GitHub Action guide | The workflow file, the settings you will use, and what the GitHub Action gives back. |
| `/docs/how-we-know-it-works` | How we know a11ign works | How a11ign is tested, the numbers measured so far, and what is not proven yet. |
| `/docs/security` | Security | What a11ign does to a page, how to run it safely, and how to report a problem privately. |
| `/docs/contributing` | Contributing | Ways to help, how to run the checks, and the licence. |
| `/about` | About a11ign | Why a11ign exists, what we believe, how it is built and who is behind it. |
| `/faq` | Frequently asked questions | Answers on Windows, accounts and keys, scores, axe-core, privacy, licence and law. |
| `/contact` | Contact and support | Where to send questions, bugs, security reports and press enquiries. |
| `/privacy` | Privacy policy | What data this website handles. a11ign itself sends nothing anywhere. |
| `/cookies` | Cookie policy | This website sets no cookies. |
| `/terms` | Terms of use | The terms for using this website. |
| `/accessibility` | Accessibility statement | How accessible this website is and how to report a problem. |

## Also do

- One `<h1>` per page, set to the page title above; each page gets its own canonical URL.
- Add JSON-LD: `SoftwareApplication` on Home (free, open source, licence AGPL-3.0-or-later), `FAQPage` on the FAQ, `Article` on each resource and docs page, `BreadcrumbList` on docs.
- Serve real HTML for every page (no content that only appears after scripts run), because search and AI crawlers read the HTML.
- Keep each docs page as its own URL. Link between pages with plain links and descriptive link text.
- Add `og:title`, `og:description` and a social share image for each page.
- Self-host fonts. It is faster and means no request goes to Google.

Note: `/resources` is hidden at launch (no nav or footer link, left out of the sitemap and llms.txt) until there are enough posts. Add it back when the page has content.
