'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import logo from '../courses/assets/logo-mewlang.png';

interface CourseLink {
  href: string;
  label: string;
}

interface SoonLink {
  label: string;
  soon: true;
}

const LINKS: Array<CourseLink | SoonLink> = [
  { href: '/overview/', label: 'Overview' },
  { href: '/go-course/instalment/', label: 'Go' },
  { href: '/ruby-course/instalment/', label: 'Ruby' },
  { href: '/perl-course/instalment/', label: 'Perl' },
  { href: '/erlang-course/instalment/', label: 'Erlang' },
  { href: '/racket-course/instalment/', label: 'Racket' },
];

function isSoon(link: CourseLink | SoonLink): link is SoonLink {
  return 'soon' in link;
}

export default function FloatingMenu() {
  const pathname = usePathname();
  const [themeClass, setThemeClass] = useState('');
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    // The six links don't fit a narrow viewport, so .floating-menu scrolls
    // horizontally (see its overflow-x-auto) — without this, the active
    // course's highlighted pill can sit entirely past the visible right
    // edge with nothing to show it's there at all (confirmed: on a 375px
    // viewport, /racket-course/'s active tab renders fully off-screen at
    // scrollLeft 0). 'nearest' only moves the nav's own scrollLeft, the
    // minimum needed to bring it fully into view — it won't fight a user
    // who's already scrolled it themselves to look at a different item.
    const active = navRef.current?.querySelector<HTMLElement>('[data-active="true"]');
    active?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' });
  }, [pathname]);

  useEffect(() => {
    const updateThemeClass = () => {
      const themeElement = Array.from(document.body.querySelectorAll<HTMLElement>('*')).find(
        (element) =>
          element !== document.querySelector('.floating-menu') &&
          Array.from(element.classList).some((className) => className.startsWith('theme-'))
      );
      const nextThemeClass = themeElement
        ? Array.from(themeElement.classList).find((className) => className.startsWith('theme-')) ?? ''
        : '';

      setThemeClass(nextThemeClass);
    };

    updateThemeClass();
    const observer = new MutationObserver(updateThemeClass);
    observer.observe(document.body, { attributes: true, childList: true, subtree: true });

    return () => observer.disconnect();
  }, []);

  return (
    <nav ref={navRef} className={`floating-menu ${themeClass}`} aria-label="Site navigation">
      <Link href="/" className="floating-menu-brand" data-active={pathname === '/'}>
        <img src={logo.src} alt="" width={22} height={22} loading="lazy" className="floating-menu-logo" />
        Mewlang
      </Link>
      <ul className="floating-menu-links">
        {LINKS.map((link) =>
          isSoon(link) ? (
            <li key={link.label}>
              <span className="soon">{link.label}</span>
            </li>
          ) : (
            <li key={link.href}>
              <Link
                href={link.href}
                data-active={pathname.startsWith('/' + link.href.split('/')[1] + '/')}
              >
                {link.label}
              </Link>
            </li>
          )
        )}
      </ul>
    </nav>
  );
}
