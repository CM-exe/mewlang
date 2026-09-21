#!/usr/bin/env python3
"""One-off migration script: extract each legacy courses/*.html page's body
content into a Next.js app/**/page.js file. Run once from the repo root:

    python3 scripts/migrate_pages.py

Safe to re-run: it always regenerates from the courses/ source files, never
reads its own previous output.
"""
import json
import os
import posixpath
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
COURSES = os.path.join(ROOT, "courses")
APP = os.path.join(ROOT, "app")

# (source html relative to courses/, output dir relative to app/, theme class,
#  whether to let the page inherit the layout's default title)
PAGES = [
    ("index.html", "", "theme-index", True),
    ("overview.html", "overview", "theme-index", False),
    ("go-course/instalment.html", "go-course/instalment", "theme-go", False),
    ("go-course/milestones/1-4.html", "go-course/milestones/1-4", "theme-go", False),
    ("go-course/milestones/5-8.html", "go-course/milestones/5-8", "theme-go", False),
    ("go-course/milestones/9-12.html", "go-course/milestones/9-12", "theme-go", False),
    ("go-course/milestones/end.html", "go-course/milestones/end", "theme-go", False),
    ("ruby-course/instalment.html", "ruby-course/instalment", "theme-ruby", False),
    ("ruby-course/milestones/1-4.html", "ruby-course/milestones/1-4", "theme-ruby", False),
    ("ruby-course/milestones/5-8.html", "ruby-course/milestones/5-8", "theme-ruby", False),
    ("ruby-course/milestones/9-12.html", "ruby-course/milestones/9-12", "theme-ruby", False),
    ("ruby-course/milestones/end.html", "ruby-course/milestones/end", "theme-ruby", False),
    ("perl-course/instalment.html", "perl-course/instalment", "theme-perl", False),
    ("perl-course/milestones/1-4.html", "perl-course/milestones/1-4", "theme-perl", False),
    ("perl-course/milestones/5-8.html", "perl-course/milestones/5-8", "theme-perl", False),
]

# Map each old courses/-relative source path to its new absolute route.
# Absolute routes sidestep relative-path math entirely: with trailingSlash
# routing every page becomes its own "directory" (route/index.html), one
# level deeper than the old flat file was, which silently breaks any ../
# count carried over from the old site. Resolving to an absolute route up
# front avoids that class of bug.
ROUTE_BY_SRC = {src: ("/" + out + "/" if out else "/") for src, out, _, _ in PAGES}

HREF_RE = re.compile(r'href="([^"]+)"')


def make_rewrite_href(src_rel):
    src_dir = posixpath.dirname(src_rel)

    def rewrite_href(match):
        href = match.group(1)
        if href.startswith("http") or href.startswith("#") or href.startswith("mailto:"):
            return match.group(0)
        resolved = posixpath.normpath(posixpath.join(src_dir, href))
        if resolved not in ROUTE_BY_SRC:
            raise ValueError(
                f"{src_rel}: href={href!r} resolves to {resolved!r}, "
                "which isn't a known page (add it to PAGES, or is this a "
                "non-page href that shouldn't be rewritten?)"
            )
        return f'href="{ROUTE_BY_SRC[resolved]}"'

    return rewrite_href


def extract(path, src_rel):
    with open(path, encoding="utf-8") as f:
        raw = f.read()

    title_m = re.search(r"<title>(.*?)</title>", raw, re.S)
    title = title_m.group(1).strip() if title_m else ""

    desc_m = re.search(r'<meta name="description"\s+content="(.*?)">', raw, re.S)
    if not desc_m:
        desc_m = re.search(r'<meta name="description" content="(.*?)">', raw, re.S)
    description = re.sub(r"\s+", " ", desc_m.group(1)).strip() if desc_m else ""

    body_m = re.search(r"<body>(.*)</body>", raw, re.S)
    if not body_m:
        raise ValueError(f"no <body>...</body> found in {path}")
    body = body_m.group(1)
    body = HREF_RE.sub(make_rewrite_href(src_rel), body)
    body = body.strip("\n")

    return title, description, body


def main():
    for src_rel, out_rel, theme, inherit_title in PAGES:
        src_path = os.path.join(COURSES, src_rel)
        title, description, body = extract(src_path, src_rel)

        out_dir = os.path.join(APP, out_rel) if out_rel else APP
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "page.js")

        metadata_lines = []
        if not inherit_title:
            metadata_lines.append(f"  title: {json.dumps(title)},")
        if description:
            metadata_lines.append(f"  description: {json.dumps(description)},")
        metadata_block = ""
        if metadata_lines:
            metadata_block = (
                "export const metadata = {\n" + "\n".join(metadata_lines) + "\n};\n\n"
            )

        html_literal = json.dumps(body)

        content = (
            metadata_block
            + "export default function Page() {\n"
            + "  return (\n"
            + f'    <div className="{theme}" dangerouslySetInnerHTML={{{{ __html: {html_literal} }}}} />\n'
            + "  );\n"
            + "}\n"
        )

        with open(out_path, "w", encoding="utf-8") as f:
            f.write(content)
        print(f"wrote {os.path.relpath(out_path, ROOT)}")


if __name__ == "__main__":
    main()
