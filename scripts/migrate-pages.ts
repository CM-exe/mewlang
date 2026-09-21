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
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
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

function resolveHref(srcRel: string, href: string): string {
  if (href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:')) {
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

function childrenAreFlowContent(children: AnyNode[]): boolean {
  return children.every(
    (n) =>
      defaultTreeAdapter.isTextNode(n) ||
      defaultTreeAdapter.isCommentNode(n) ||
      (defaultTreeAdapter.isElementNode(n) && INLINE_TAGS.has((n as ElementNode).tagName))
  );
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
  const out = nodes.map((n) => serializeNode(srcRel, n, depth, insidePreCode, tight)).join('');
  if (tight) return out;
  // Non-tight (block) context: if the last child rendered was inline text
  // with no trailing newline (e.g. "Mewlang"), put the parent's closing
  // tag on its own line. Safe because it's the *last* child — there's no
  // following sibling in this parent for a newline to wrongly join into.
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
    return escapeJsxText(text);
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
    const jsxName = ATTR_NAME_MAP[name];
    propParts.push(`${jsxName}=${JSON.stringify(attr.value)}`);
  }

  if (classNameParts.length) {
    propParts.unshift(`className="${classNameParts.join(' ')}"`);
  }

  const propsStr = propParts.length ? ' ' + propParts.join(' ') : '';

  if (VOID_ELEMENTS.has(tag)) {
    return tight ? `<${tag}${propsStr} />` : `${indent(depth)}<${tag}${propsStr} />\n`;
  }

  const children = defaultTreeAdapter.getChildNodes(el);
  const nowInsidePreCode = insidePreCode || tag === 'pre';

  if (children.length === 0) {
    return tight ? `<${tag}${propsStr}></${tag}>` : `${indent(depth)}<${tag}${propsStr}></${tag}>\n`;
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
      ? `<${tag}${propsStr}>${inner}</${tag}>`
      : `${indent(depth)}<${tag}${propsStr}>${inner}</${tag}>\n`;
  }
  return `${indent(depth)}<${tag}${propsStr}>\n${inner}${indent(depth)}</${tag}>\n`;
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

function main() {
  for (const page of PAGES) {
    const srcPath = join(COURSES, page.src);
    const raw = readFileSync(srcPath, 'utf-8');

    const title = extractTag(raw, 'title');
    const description = extractDescription(raw);

    const bodyMatch = /<body>([\s\S]*)<\/body>/.exec(raw);
    if (!bodyMatch) throw new Error(`${page.src}: no <body>...</body> found`);
    const bodyHtml = bodyMatch[1].trim();

    const fragment = parseFragment(bodyHtml);
    const children = defaultTreeAdapter.getChildNodes(fragment) as AnyNode[];
    const bodyJsx = serializeChildren(page.src, children, 3, false, false);

    const metadataLines: string[] = [];
    if (!page.inheritTitle) metadataLines.push(`  title: ${JSON.stringify(title)},`);
    if (description) metadataLines.push(`  description: ${JSON.stringify(description)},`);
    const metadataBlock = metadataLines.length
      ? `import type { Metadata } from 'next';\n\nexport const metadata: Metadata = {\n${metadataLines.join('\n')}\n};\n\n`
      : '';

    const content =
      metadataBlock +
      'export default function Page() {\n' +
      '  return (\n' +
      `    <div className="${page.theme}">\n` +
      bodyJsx +
      '    </div>\n' +
      '  );\n' +
      '}\n';

    const outDir = page.route ? join(APP, page.route) : APP;
    mkdirSync(outDir, { recursive: true });
    const outPath = join(outDir, 'page.tsx');
    writeFileSync(outPath, content, 'utf-8');
    console.log(`wrote ${outPath.replace(ROOT + '/', '')}`);
  }
}

main();
