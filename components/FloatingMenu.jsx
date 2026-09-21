'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/overview/', label: 'Overview' },
  { href: '/go-course/instalment/', label: 'Go' },
  { href: '/ruby-course/instalment/', label: 'Ruby' },
  { href: '/perl-course/instalment/', label: 'Perl' },
  { label: 'Erlang', soon: true },
  { label: 'Racket', soon: true },
];

export default function FloatingMenu() {
  const pathname = usePathname();

  return (
    <nav className="floating-menu" aria-label="Site navigation">
      <Link href="/" className="floating-menu-brand" data-active={pathname === '/'}>
        🐱 Mewlang
      </Link>
      <ul className="floating-menu-links">
        {LINKS.map((link) =>
          link.soon ? (
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
