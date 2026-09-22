/**
 * One-off migration script: parse each legacy courses/*.html page's body
 * with a real HTML parser and serialize it into a real .tsx page component
 * (no dangerouslySetInnerHTML). Run from the repo root:
 *
 *   npx tsx scripts/migrate-pages.ts
 *
 * Safe to re-run: it always regenerates from the courses/ source files, and
 * never reads its own previous output.
 *
 * Why a real HTML parser (parse5) instead of regex: the source content has
 * ~3,500 literal `{`/`}` characters (Go/Ruby/Perl code samples) and over a
 * thousand HTML entities (&lt; &gt; &amp; &nbsp;). Getting JSX escaping
 * right for that volume by hand or via regex risks silently corrupting
 * exact, compiler-verified code snippets — a real parser + AST walk makes
 * the escaping mechanical and exhaustive instead of best-effort.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import * as posixPath from 'node:path/posix';
import { fileURLToPath } from 'node:url';
import { parseFragment, defaultTreeAdapter } from 'parse5';
import type { DefaultTreeAdapterMap } from 'parse5';

type AnyNode = DefaultTreeAdapterMap['childNode'];
type ElementNode = DefaultTreeAdapterMap['element'];
type TextNode = DefaultTreeAdapterMap['textNode'];

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(__dirname);
const COURSES = join(ROOT, 'courses');
const APP = join(ROOT, 'app');

interface PageDef {
  src: string; // courses/-relative source .html path
  route: string; // "" for root, else "go-course/instalment" etc — also the app/ output dir
  theme: 'theme-index' | 'theme-go' | 'theme-ruby' | 'theme-perl';
  inheritTitle?: boolean; // let the root layout's default title stand instead of setting one
}

const PAGES: PageDef[] = [
  { src: 'index.html', route: '', theme: 'theme-index', inheritTitle: true },
  { src: 'overview.html', route: 'overview', theme: 'theme-index' },
  { src: 'go-course/instalment.html', route: 'go-course/instalment', theme: 'theme-go' },
  { src: 'go-course/milestones/1-4.html', route: 'go-course/milestones/1-4', theme: 'theme-go' },
  { src: 'go-course/milestones/5-8.html', route: 'go-course/milestones/5-8', theme: 'theme-go' },
  { src: 'go-course/milestones/9-12.html', route: 'go-course/milestones/9-12', theme: 'theme-go' },
  { src: 'go-course/milestones/end.html', route: 'go-course/milestones/end', theme: 'theme-go' },
  { src: 'ruby-course/instalment.html', route: 'ruby-course/instalment', theme: 'theme-ruby' },
  { src: 'ruby-course/milestones/1-4.html', route: 'ruby-course/milestones/1-4', theme: 'theme-ruby' },
  { src: 'ruby-course/milestones/5-8.html', route: 'ruby-course/milestones/5-8', theme: 'theme-ruby' },
  { src: 'ruby-course/milestones/9-12.html', route: 'ruby-course/milestones/9-12', theme: 'theme-ruby' },
  { src: 'ruby-course/milestones/end.html', route: 'ruby-course/milestones/end', theme: 'theme-ruby' },
  { src: 'perl-course/instalment.html', route: 'perl-course/instalment', theme: 'theme-perl' },
  { src: 'perl-course/milestones/1-4.html', route: 'perl-course/milestones/1-4', theme: 'theme-perl' },
  { src: 'perl-course/milestones/5-8.html', route: 'perl-course/milestones/5-8', theme: 'theme-perl' },
  { src: 'perl-course/milestones/9-12.html', route: 'perl-course/milestones/9-12', theme: 'theme-perl' },
  { src: 'perl-course/milestones/end.html', route: 'perl-course/milestones/end', theme: 'theme-perl' },
];

// Old courses/-relative source path -> new absolute Next.js route. Resolving
// hrefs to absolute routes up front (rather than trying to carry the old
// relative ../ paths over) sidesteps a real bug from the previous pass:
// trailingSlash routing makes every page its own directory (route/index.html),
// one level deeper than the old flat .html file was, silently breaking any
// ../ count copied from the old site.
const ROUTE_BY_SRC = new Map(PAGES.map((p) => [p.src, p.route ? `/${p.route}/` : '/']));

const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

// The only attributes present anywhere in courses/**/*.html body content
// (verified by inventory before writing this script): class, href, src,
// alt, width, style, align, aria-label. This map is intentionally narrow —
// an unrecognized attribute should fail loudly (see serializeElement)
// rather than pass through possibly-wrong.
const ATTR_NAME_MAP: Record<string, string> = {
  class: 'className',
  href: 'href',
  src: 'src',
  alt: 'alt',
  width: 'width',
  style: 'style',
  align: 'align', // special-cased away below (align="center" -> className "text-center")
  'aria-label': 'aria-label',
};

function isInternalHref(href: string): boolean {
  return !(href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:'));
}

function resolveHref(srcRel: string, href: string): string {
  if (!isInternalHref(href)) {
    return href;
  }
  const srcDir = posixPath.dirname(srcRel);
  const resolved = posixPath.normalize(posixPath.join(srcDir, href));
  const route = ROUTE_BY_SRC.get(resolved);
  if (!route) {
    throw new Error(
      `${srcRel}: href="${href}" resolves to "${resolved}", which isn't a known page. ` +
        `Add it to PAGES, or if it's not meant to be a page link, special-case it.`
    );
  }
  return route;
}

// Set while serializing a page whenever an internal <a> gets rendered as
// <Link> (see serializeElement), so main() knows whether that page's
// generated file needs `import Link from 'next/link'`. Reset per page in
// main() — the script processes pages one at a time, synchronously.
let usesLinkInCurrentPage = false;

// Every <img src="..."> in course content is resolved into a real, bundler-
// processed import rather than a literal src string. A literal path (even a
// "genuinely relative" one, which is otherwise the right call for a static
// reference — see next.config.ts's comment) only resolves correctly from
// the *one* route depth it was hand-counted for; this site's course pages
// sit at several different depths (/, /go-course/instalment/,
// /go-course/milestones/9-12/, ...), and course content is meant to be
// copy-pasted between milestone files freely. An imported asset sidesteps
// depth entirely: Next's bundler emits a correctly basePath-prefixed,
// content-hashed URL regardless of which page imports it. Populated while
// serializing a page (see resolveImgImport) and reset per page in main().
let imageImportsInCurrentPage = new Map<string, string>(); // resolved abs path -> local var name

/**
 * Resolve an <img src="..."> from course content to a JS identifier that
 * main() will import at the top of the generated file (e.g. "img1", bound
 * to `courses/assets/expressions/left_to_right/thinking.png`). The source
 * value is resolved relative to the *source .html file's own directory* —
 * exactly how a browser would resolve it when previewing courses/*.html
 * directly (see CLAUDE.md's "Content editing workflow") — so authoring an
 * image reference in courses/ needs no awareness of the eventual route
 * depth at all. main() computes the actual import *path* afterward, from
 * this function's tracked absolute file path and the page's known output
 * directory (see importPathFor) — this function only has to hand out a
 * stable, deduplicated identifier for it.
 */
function resolveImgImport(srcRel: string, srcValue: string): string {
  const srcDir = posixPath.dirname(srcRel);
  const resolvedRel = posixPath.normalize(posixPath.join(srcDir, srcValue));
  const absPath = join(COURSES, resolvedRel);
  if (!existsSync(absPath)) {
    throw new Error(
      `${srcRel}: <img src="${srcValue}"> resolves to "${resolvedRel}", which doesn't exist under courses/.`
    );
  }

  const existing = imageImportsInCurrentPage.get(absPath);
  if (existing) return existing;

  const varName = `img${imageImportsInCurrentPage.size + 1}`;
  imageImportsInCurrentPage.set(absPath, varName);
  return varName;
}

/** Relative import path from a generated page.tsx's directory to a resolved asset file. */
function importPathFor(outDir: string, absAssetPath: string): string {
  // node:path's relative() returns platform-native separators; normalize to
  // POSIX for the generated source regardless of host OS, and make sure a
  // same-directory result (unlikely here, but cheap to handle) still reads
  // as a relative specifier rather than a bare module name.
  const posixRel = relative(outDir, absAssetPath).replace(/\\/g, '/');
  return posixRel.startsWith('.') ? posixRel : `./${posixRel}`;
}

/** Convert `margin-bottom:0` etc into a JS object literal source string for a style={{}} prop. */
function styleAttrToObjectLiteral(css: string): string {
  const entries = css
    .split(';')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((decl) => {
      const idx = decl.indexOf(':');
      if (idx === -1) throw new Error(`Unparseable style declaration: "${decl}"`);
      const prop = decl.slice(0, idx).trim();
      const value = decl.slice(idx + 1).trim();
      const camel = prop.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase());
      return `${camel}: ${JSON.stringify(value)}`;
    });
  return `{ ${entries.join(', ')} }`;
}

const JSX_TEXT_ESCAPES: Record<string, string> = {
  '{': "{'{'}",
  '}': "{'}'}",
  '<': "{'<'}",
  '>': "{'>'}",
};

/**
 * Escape the four JSX-significant characters in literal (non-expression)
 * JSX text — in a single pass over the original string. Sequential
 * `.replace()` calls would be wrong here: escaping "{" first inserts new
 * "{"/"}" characters into the result, which a later `.replace(/\}/, ...)`
 * would then re-match and corrupt.
 */
function escapeJsxText(text: string): string {
  return text.replace(/[{}<>]/g, (ch) => JSX_TEXT_ESCAPES[ch]);
}

function indent(depth: number): string {
  return '  '.repeat(depth);
}

// Tags whose content is inline/flow-level (they live inside running text,
// not as standalone blocks). Used to decide, per element, whether its
// children form a "flow run" that must be serialized with zero added
// whitespace (see childrenAreFlowContent below) — the fix for a real bug
// caught by comparing rendered text against the original site: block-style
// pretty-printing (indent + newline around every child) puts a newline
// between e.g. `</code>` and the word right after it, which JSX's compiler
// then treats as a line break and strips the leading space off the next
// line, silently fusing words together ("Statsare pointer-free" instead of
// "Stats are pointer-free").
const INLINE_TAGS = new Set(['a', 'code', 'strong', 'em', 'small', 'span', 'br']);

function isFlowNode(n: AnyNode): boolean {
  return (
    defaultTreeAdapter.isTextNode(n) ||
    defaultTreeAdapter.isCommentNode(n) ||
    (defaultTreeAdapter.isElementNode(n) && INLINE_TAGS.has((n as ElementNode).tagName))
  );
}

function childrenAreFlowContent(children: AnyNode[]): boolean {
  return children.every(isFlowNode);
}

/**
 * Serialize a parse5 node to JSX source.
 *
 * insidePreCode: when true (i.e. we're inside a <pre><code>...</code></pre>
 * text run), text is emitted as a JS string-literal expression instead of
 * literal JSX text. Required, not cosmetic: JSX's compiler collapses
 * whitespace/newlines in literal text between tags the same way HTML
 * collapses whitespace in normal flow text, which would silently mangle
 * every code sample's indentation and line breaks. A JS string literal is
 * exempt from that collapsing.
 *
 * tight: when true, this node is part of a flow-content run (see
 * childrenAreFlowContent) and must be emitted with *zero* added
 * indentation or newlines — i.e. exactly the adjacency it had in the
 * original HTML, character for character. This is what keeps
 * "<code>Foo</code> bar" from becoming two words glued together or a
 * spurious extra space.
 */
function serializeChildren(
  srcRel: string,
  nodes: AnyNode[],
  depth: number,
  insidePreCode: boolean,
  tight: boolean
): string {
  if (tight) {
    return nodes.map((n) => serializeNode(srcRel, n, depth, insidePreCode, true)).join('');
  }

  // Non-tight (block) context. A parent can mix flow-content children (text,
  // <code>, <strong>, ...) with a block-level child — e.g. a <li> whose
  // intro sentence is followed by a <pre> example. childrenAreFlowContent
  // only looks at the *whole* list, so a single block sibling used to force
  // every flow sibling into individual block treatment too: each one got
  // its own indent + trailing newline, even though it was really adjacent,
  // inline, running text. That injected newline sits directly before the
  // next flow sibling's text, and JSX's compiler drops it — and the space
  // after it — entirely, fusing words together ("Symptom:the" instead of
  // "Symptom: the"). The fix: partition into maximal runs of consecutive
  // flow-content nodes, serialize each run as one *tight* unit (exact
  // original adjacency, zero added whitespace inside the run), and treat
  // the run as a whole — not each node in it — as one block-level sibling
  // among the parent's other, non-flow children.
  const parts: string[] = [];
  let i = 0;
  while (i < nodes.length) {
    if (isFlowNode(nodes[i])) {
      let j = i + 1;
      while (j < nodes.length && isFlowNode(nodes[j])) j++;
      const runOut = nodes
        .slice(i, j)
        .map((n) => serializeNode(srcRel, n, depth, insidePreCode, true))
        .join('');
      // A run can be pure whitespace (e.g. source indentation between a
      // preceding block element and a following one) with no rendered
      // effect at all — drop it, exactly as a lone whitespace-only text
      // node would be dropped in this same non-tight context.
      if (runOut.trim().length > 0) {
        parts.push(`${indent(depth)}${runOut}\n`);
      }
      i = j;
    } else {
      parts.push(serializeNode(srcRel, nodes[i], depth, insidePreCode, false));
      i++;
    }
  }

  // If the last part rendered was inline text with no trailing newline
  // (e.g. "Mewlang"), put the parent's closing tag on its own line. Safe
  // because it's the *last* child — there's no following sibling in this
  // parent for a newline to wrongly join into.
  const out = parts.join('');
  if (out.length > 0 && !/\s$/.test(out)) {
    return out + '\n';
  }
  return out;
}

function serializeNode(
  srcRel: string,
  node: AnyNode,
  depth: number,
  insidePreCode: boolean,
  tight: boolean
): string {
  if (defaultTreeAdapter.isTextNode(node)) {
    const text = (node as TextNode).value;
    if (insidePreCode) {
      return `{${JSON.stringify(text)}}`;
    }
    if (/^\s*$/.test(text)) {
      if (!text) return '';
      // Whitespace-only text between flow siblings (e.g. a source
      // line-wrap between two inline elements) is a real, rendered
      // space — normalize it to exactly one, rather than dropping it
      // (which would fuse the words on either side) or passing raw tabs/
      // newlines through (harmless, but noisy in the generated source).
      // Whitespace-only text between block siblings is pure indentation
      // noise with no rendered effect at all — drop it.
      return tight ? ' ' : '';
    }
    // A non-whitespace-only text node can still carry a leading or trailing
    // run of whitespace that *contains a newline* — e.g. the source line
    // wraps right at an inline-tag boundary ("...behaves under\n<code>").
    // Left as literal newlines, JSX's own whitespace handling treats that
    // trailing run as a blank line and drops it *entirely* (not collapsed
    // to a space), silently fusing the word before it into the tag that
    // follows ("underCtrl-C"). HTML itself collapses any whitespace run —
    // newlines included — to a single rendered space in normal flow text,
    // so replacing every run with one literal space character before
    // escaping both matches real rendering and sidesteps JSX's collapsing
    // entirely (a lone space with no newline is never touched by it).
    return escapeJsxText(text.replace(/\s+/g, ' '));
  }
  if (defaultTreeAdapter.isCommentNode(node)) {
    return `{/* ${node.data.replace(/\*\//g, '* /')} */}`;
  }
  if (defaultTreeAdapter.isElementNode(node)) {
    return serializeElement(srcRel, node as ElementNode, depth, insidePreCode, tight);
  }
  throw new Error(`${srcRel}: unexpected node type ${(node as { nodeName: string }).nodeName}`);
}

function serializeElement(
  srcRel: string,
  el: ElementNode,
  depth: number,
  insidePreCode: boolean,
  tight: boolean
): string {
  const tag = el.tagName;
  const classNameParts: string[] = [];
  const propParts: string[] = [];

  // Internal links (anything that resolves to a page in PAGES, as opposed
  // to an external https:// link) render as next/link's <Link> instead of
  // a plain <a>. This is what makes them basePath-aware: the site deploys
  // to a GitHub Pages *project* subpath (cm-exe.github.io/mewlang/, not the
  // domain root), and Next only auto-prefixes its own asset pipeline and
  // next/link navigation with that subpath — a hardcoded <a href="/foo">
  // has no way to pick up the prefix and would 404 in production while
  // looking perfectly fine in dev.
  let outputTag = tag;
  if (tag === 'a') {
    const hrefAttr = el.attrs.find((a) => a.name === 'href');
    if (hrefAttr && isInternalHref(hrefAttr.value)) {
      outputTag = 'Link';
      usesLinkInCurrentPage = true;
    }
  }

  for (const attr of el.attrs) {
    const name = attr.name;
    if (!(name in ATTR_NAME_MAP)) {
      throw new Error(`${srcRel}: unrecognized attribute "${name}" on <${tag}> — add it to ATTR_NAME_MAP`);
    }
    if (name === 'align') {
      if (attr.value !== 'center') {
        throw new Error(`${srcRel}: unexpected align="${attr.value}" on <${tag}> (only "center" is handled)`);
      }
      classNameParts.push('text-center');
      continue;
    }
    if (name === 'class') {
      classNameParts.push(attr.value);
      continue;
    }
    if (name === 'style') {
      propParts.push(`style={${styleAttrToObjectLiteral(attr.value)}}`);
      continue;
    }
    if (name === 'href' && tag === 'a') {
      propParts.push(`href="${resolveHref(srcRel, attr.value)}"`);
      continue;
    }
    if (name === 'src' && tag === 'img') {
      const varName = resolveImgImport(srcRel, attr.value);
      propParts.push(`src={${varName}.src}`);
      continue;
    }
    const jsxName = ATTR_NAME_MAP[name];
    propParts.push(`${jsxName}=${JSON.stringify(attr.value)}`);
  }

  if (classNameParts.length) {
    propParts.unshift(`className="${classNameParts.join(' ')}"`);
  }

  const propsStr = propParts.length ? ' ' + propParts.join(' ') : '';

  if (VOID_ELEMENTS.has(tag)) {
    return tight ? `<${outputTag}${propsStr} />` : `${indent(depth)}<${outputTag}${propsStr} />\n`;
  }

  const children = defaultTreeAdapter.getChildNodes(el);
  const nowInsidePreCode = insidePreCode || tag === 'pre';

  if (children.length === 0) {
    return tight
      ? `<${outputTag}${propsStr}></${outputTag}>`
      : `${indent(depth)}<${outputTag}${propsStr}></${outputTag}>\n`;
  }

  // Whether *this element's own children* form a flow run is independent
  // of whether this element itself is being placed tightly among its own
  // siblings (the incoming `tight`) — e.g. a block-level <p> among other
  // block siblings still has flow-content children (text + <code> + text)
  // that must be serialized tight, even though the <p> itself gets its
  // usual indent/newline treatment relative to its siblings.
  const childrenTight = childrenAreFlowContent(children);
  const childDepth = childrenTight ? depth : depth + 1;
  const inner = serializeChildren(srcRel, children, childDepth, nowInsidePreCode, childrenTight);

  if (tight || childrenTight) {
    return tight
      ? `<${outputTag}${propsStr}>${inner}</${outputTag}>`
      : `${indent(depth)}<${outputTag}${propsStr}>${inner}</${outputTag}>\n`;
  }
  return `${indent(depth)}<${outputTag}${propsStr}>\n${inner}${indent(depth)}</${outputTag}>\n`;
}

function extractTag(raw: string, tag: 'title'): string {
  const m = new RegExp(`<${tag}>(.*?)</${tag}>`, 's').exec(raw);
  return m ? m[1].trim() : '';
}

function extractDescription(raw: string): string {
  const m = /<meta name="description"\s+content="(.*?)">/s.exec(raw) ??
    /<meta name="description" content="(.*?)">/s.exec(raw);
  return m ? m[1].replace(/\s+/g, ' ').trim() : '';
}

/** A short, stable label for a course-relative prev/next nav button. */
function shortLabel(route: string): string {
  if (route.endsWith('/instalment')) return 'Instalment';
  if (route.endsWith('/milestones/end')) return 'Wrap-up';
  const m = /\/milestones\/(\d+-\d+)$/.exec(route);
  if (m) return `Milestones ${m[1].replace('-', '–')}`;
  throw new Error(`shortLabel: route "${route}" doesn't match a known course-page shape`);
}

/**
 * Emit lib/course-nav.generated.ts: for every course-page route, its
 * previous/next sibling *within the same course only* (never crossing into
 * the course before or after it, and never including "/" or "/overview/",
 * which aren't part of any course) — mdBook-style chapter navigation.
 * Derived from PAGES' own array order, so a course's page order here always
 * matches the order the course itself is written in.
 */
function writeCourseNavData() {
  const courseKeyOf = (route: string) => /^([a-z]+)-course\//.exec(route)?.[1];

  const byCourse = new Map<string, PageDef[]>();
  for (const page of PAGES) {
    const key = courseKeyOf(page.route);
    if (!key) continue; // "/" and "/overview/" aren't part of any course
    if (!byCourse.has(key)) byCourse.set(key, []);
    byCourse.get(key)!.push(page);
  }

  const entries: string[] = [];
  for (const pages of byCourse.values()) {
    for (let i = 0; i < pages.length; i++) {
      const href = `/${pages[i].route}/`;
      const prev = i > 0 ? pages[i - 1] : undefined;
      const next = i < pages.length - 1 ? pages[i + 1] : undefined;
      const prevLit = prev ? `{ href: '/${prev.route}/', label: ${JSON.stringify(shortLabel(prev.route))} }` : 'null';
      const nextLit = next ? `{ href: '/${next.route}/', label: ${JSON.stringify(shortLabel(next.route))} }` : 'null';
      entries.push(`  ${JSON.stringify(href)}: { prev: ${prevLit}, next: ${nextLit} },`);
    }
  }

  const content =
    `// Generated by scripts/migrate-pages.ts from PAGES — do not hand-edit.\n` +
    `// Prev/next chapter within the *same course only*, mdBook-style. A route\n` +
    `// with no entry here (the landing page, /overview/, an unwritten course)\n` +
    `// simply has no prev/next nav — see components/CourseNav.tsx.\n\n` +
    `export interface CourseNavLink {\n  href: string;\n  label: string;\n}\n\n` +
    `export interface CourseNavEntry {\n  prev: CourseNavLink | null;\n  next: CourseNavLink | null;\n}\n\n` +
    `export const COURSE_NAV: Record<string, CourseNavEntry> = {\n${entries.join('\n')}\n};\n`;

  const outPath = join(ROOT, 'lib', 'course-nav.generated.ts');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, content, 'utf-8');
  console.log(`wrote ${outPath.replace(ROOT + '/', '')}`);
}

function main() {
  for (const page of PAGES) {
    const srcPath = join(COURSES, page.src);
    const raw = readFileSync(srcPath, 'utf-8');

    const title = extractTag(raw, 'title');
    const description = extractDescription(raw);

    const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(raw);
    if (!bodyMatch) throw new Error(`${page.src}: no <body>...</body> found`);
    const bodyHtml = bodyMatch[1].trim();

    const outDir = page.route ? join(APP, page.route) : APP;

    usesLinkInCurrentPage = false;
    imageImportsInCurrentPage = new Map();
    const fragment = parseFragment(bodyHtml);
    const children = defaultTreeAdapter.getChildNodes(fragment) as AnyNode[];
    const bodyJsx = serializeChildren(page.src, children, 3, false, false);

    const metadataLines: string[] = [];
    if (!page.inheritTitle) metadataLines.push(`  title: ${JSON.stringify(title)},`);
    if (description) metadataLines.push(`  description: ${JSON.stringify(description)},`);
    const metadataImport = metadataLines.length ? `import type { Metadata } from 'next';\n` : '';
    const linkImport = usesLinkInCurrentPage ? `import Link from 'next/link';\n` : '';
    // Deterministic order: imgN was assigned in first-encountered order
    // while serializing, so sorting by that same numeric suffix reproduces
    // it rather than depending on Map iteration order (which does happen to
    // match insertion order in JS, but sorting makes that non-obvious
    // dependency unnecessary to know about to trust the output).
    const imageImportLines = [...imageImportsInCurrentPage.entries()]
      .sort((a, b) => Number(a[1].slice(3)) - Number(b[1].slice(3)))
      .map(([absPath, varName]) => `import ${varName} from '${importPathFor(outDir, absPath)}';`)
      .join('\n');
    const imageImports = imageImportLines ? imageImportLines + '\n' : '';
    const importsBlock =
      metadataImport || linkImport || imageImports
        ? metadataImport + linkImport + imageImports + '\n'
        : '';
    const metadataBlock = metadataLines.length
      ? `export const metadata: Metadata = {\n${metadataLines.join('\n')}\n};\n\n`
      : '';

    const content =
      importsBlock +
      metadataBlock +
      'export default function Page() {\n' +
      '  return (\n' +
      `    <div className="${page.theme}">\n` +
      bodyJsx +
      '    </div>\n' +
      '  );\n' +
      '}\n';

    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'page.tsx');
    writeFileSync(outPath, content, 'utf-8');
    console.log(`wrote ${outPath.replace(ROOT + '/', '')}`);
  }

  writeCourseNavData();
}

main();
