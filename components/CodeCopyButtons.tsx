'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

// Runs on every page, mounted once from the root layout (same pattern as
// FloatingMenu/CourseNav). Copy buttons are injected client-side rather than
// baked into the migrated .tsx output by scripts/migrate-pages.ts: every
// <pre> on the site — hundreds of them, across 27 generated pages — needs
// the exact same behavior, so one runtime pass here is both simpler and
// impossible to drift from the generated markup the way hand-adding a
// button per <pre> in the migration script would be.
async function copyText(text: string): Promise<boolean> {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the execCommand fallback below (e.g. permission
      // denied, or a non-secure-context edge case the Clipboard API rejects).
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  let ok = false;
  try {
    ok = document.execCommand('copy');
  } catch {
    ok = false;
  }
  textarea.remove();
  return ok;
}

const LABEL_IDLE = 'Copy';
const LABEL_DONE = 'Copied';
const LABEL_FAILED = 'Failed';
const RESET_DELAY_MS = 1500;

export default function CodeCopyButtons() {
  const pathname = usePathname();

  useEffect(() => {
    // <pre> holds the exact text to copy (code samples are emitted as JS
    // string literals by the migration script specifically to preserve
    // whitespace verbatim — see CLAUDE.md — so pre.textContent is already
    // the right content, entities and all, with no cleanup needed).
    const wrappers: HTMLDivElement[] = [];

    document.querySelectorAll<HTMLPreElement>('pre').forEach((pre) => {
      const parent = pre.parentElement;
      if (!parent) return;

      const wrapper = document.createElement('div');
      wrapper.className = 'code-block-wrapper';
      parent.insertBefore(wrapper, pre);
      wrapper.appendChild(pre);

      const code = pre.textContent ?? '';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'copy-btn';
      button.textContent = LABEL_IDLE;
      button.setAttribute('aria-label', 'Copy code to clipboard');

      let resetTimer: ReturnType<typeof setTimeout> | undefined;
      button.addEventListener('click', () => {
        void copyText(code).then((ok) => {
          button.textContent = ok ? LABEL_DONE : LABEL_FAILED;
          button.classList.toggle('copy-btn-done', ok);
          clearTimeout(resetTimer);
          resetTimer = setTimeout(() => {
            button.textContent = LABEL_IDLE;
            button.classList.remove('copy-btn-done');
          }, RESET_DELAY_MS);
        });
      });

      wrapper.appendChild(button);
      wrappers.push(wrapper);
    });

    // Unwrap on every re-run (route change, or React Strict Mode's dev-only
    // double-invoke) rather than guarding with a "already processed" marker
    // — that keeps this idempotent without needing to track state across
    // effect runs: each run tears down exactly the wrappers it created.
    return () => {
      wrappers.forEach((wrapper) => {
        const pre = wrapper.querySelector('pre');
        if (pre && wrapper.parentElement) {
          wrapper.parentElement.insertBefore(pre, wrapper);
        }
        wrapper.remove();
      });
    };
  }, [pathname]);

  return null;
}
