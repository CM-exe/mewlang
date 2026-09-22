import type { Metadata } from 'next';
import Link from 'next/link';
import mascot from '../courses/assets/expressions/surprised.png';

export const metadata: Metadata = {
  title: 'Page not found',
};

export default function NotFound() {
  return (
    <div className="theme-index">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">404</p>
          <h1>This page wandered off</h1>
          <p className="lede">
            There is nothing at this address. It may have moved, or never existed — every course
            lives under its own instalment, reachable from the curriculum overview.
          </p>
        </header>
        <img
          src={mascot.src}
          alt="The Mewlang cat, startled"
          width={160}
          loading="lazy"
          className="mascot-center"
        />
        <p>
          <Link href="/" className="button">Back to Mewlang</Link>
        </p>
        <p>
          <Link href="/overview/">Or see the full curriculum →</Link>
        </p>
      </div>
    </div>
  );
}
