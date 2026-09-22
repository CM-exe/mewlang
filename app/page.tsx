import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  description: "Learn programming languages by building things that make each language worth learning.",
};

export default function Page() {
  return (
    <div className="theme-index">
      <header className="text-center">
        <img src="assets/logo-mewlang.png" alt="Mewlang logo" width="220" />
        <h1>Mewlang</h1>
        <p><strong>Learn programming languages by building things that make each language worth learning.</strong></p>
        <nav className="menu" aria-label="Course navigation"> <Link href="/overview/">Curriculum overview</Link> <Link href="/go-course/instalment/">Go</Link> <Link href="/ruby-course/instalment/">Ruby</Link> <Link href="/perl-course/instalment/">Perl</Link> <span className="soon">Erlang <small>(coming soon)</small></span> <span className="soon">Racket <small>(coming soon)</small></span> </nav>
      </header>
      <main>
        <p>Mewlang is a hands-on programming-language learning project built around one idea:</p>
        <blockquote><strong>Don't just learn a language. Discover what it makes possible.</strong></blockquote>
        <p>Instead of following syntax tutorials or building the same CRUD application in every language, Mewlang explores programming languages through projects designed around their unique strengths, philosophies, and programming models.</p>
        <h2>🧠 The idea</h2>
        <p>Every programming language has something interesting about it.</p>
        <ul>
          <li><strong>Go</strong> makes concurrent systems approachable.</li>
          <li><strong>Ruby</strong> makes metaprogramming and expressive DSLs feel natural.</li>
          <li><strong>Perl</strong> turns text processing into a superpower.</li>
          <li><strong>Erlang</strong> treats massive concurrency and failure as fundamental design problems.</li>
          <li><strong>Racket</strong> makes creating programming languages surprisingly accessible.</li>
        </ul>
        <p>Mewlang uses projects to make those differences tangible.</p>
        <h2>🐾 Projects</h2>
        <section>
          <h3>🐜 Go — Digital Ant Colony</h3>
          <p>Build a large concurrent simulation where thousands of autonomous ants search for food, communicate, leave pheromone trails, and recover from failures.</p>
          <p><strong>Explore:</strong> Goroutines, channels, concurrency, synchronization, context cancellation, worker pools, race detection, fault injection, and distributed systems.</p>
          <blockquote>What happens when concurrency becomes the natural way to model the world?</blockquote>
          <p className="start"><Link href="/go-course/instalment/">Start the Go course →</Link></p>
          <h3>🐱 Ruby — Programmable Automation DSL</h3>
          <p>Build a Ruby-based automation framework where pipelines can be written almost like a programming language:</p>
          <pre><code>{"pipeline \"research\" do\n\tfetch \"papers\"\n\tfilter topic: \"AI\"\n\tsummarize\n\tsave_to \"knowledge_base\"\nend"}</code></pre>
          <p><strong>Explore:</strong> Blocks, Procs, lambdas, objects, reflection, <code>method_missing</code>, dynamic methods, metaprogramming, DSL design, and runtime introspection.</p>
          <blockquote>What if your application could become its own language?</blockquote>
          <p className="start"><Link href="/ruby-course/instalment/">Start the Ruby course →</Link></p>
          <h3>🕵️ Perl — Text Archaeologist</h3>
          <p>Build a data-forensics tool capable of digging through messy real-world text and extracting useful structure.</p>
          <p><strong>Process:</strong> Logs, CSV, JSON, XML, source code, configuration files, malformed data, and arbitrary text.</p>
          <p><strong>Explore:</strong> Regular expressions, text transformation, file processing, streams, references, Unix pipelines, CLI applications, CPAN, parsing, and data processing.</p>
          <blockquote>What happens when text manipulation is the core of the language?</blockquote>
          <p className="start"><Link href="/perl-course/instalment/">Start the Perl course →</Link></p>
          <h3>🐉 Erlang — The Internet That Never Dies</h3>
          <p>Build a simulated distributed network containing thousands of nodes that communicate, crash, restart, disconnect, and recover automatically.</p>
          <p><strong>Explore:</strong> Processes, message passing, pattern matching, <code>receive</code>, links, monitors, OTP, <code>gen_server</code>, supervision trees, distributed systems, and fault tolerance.</p>
          <p>Eventually, deliberately destroy parts of the network and watch it recover.</p>
          <blockquote>What if failure wasn't an exception, but a normal operating condition?</blockquote>
          <p className="start soon">Course pages coming soon.</p>
          <h3>🧪 Racket — Language Factory</h3>
          <p>Build a toolkit for creating small domain-specific programming languages for finance, robots, configuration, and games.</p>
          <p><strong>Explore:</strong> Functional programming, higher-order functions, structs, macros, syntax objects, hygienic macros, parsers, ASTs, interpreters, compilers, <code>#lang</code>, and language-oriented programming.</p>
          <blockquote>What if learning a programming language meant learning how to create one?</blockquote>
          <p className="start soon">Course pages coming soon.</p>
        </section>
        <h2>🎯 Philosophy</h2>
        <ol>
          <li><strong>Learn by building</strong> — Every language is learned through a substantial project.</li>
          <li><strong>Exploit the language</strong> — Use features that make the language distinctive.</li>
          <li><strong>Understand the “why”</strong> — The goal is to understand why someone would choose this language.</li>
          <li><strong>Compare programming models</strong> — The same problem can look completely different depending on the language.</li>
          <li><strong>Build real software</strong> — Include tests, error handling, documentation, CLI interfaces, logging, configuration, performance considerations, and debugging.</li>
        </ol>
        <h2>🗺️ Learning Path</h2>
        <pre><code>{"                    🐱 MEWLANG\n\t\t\t\t\t\t\t\t\t\t\t\t│\n\t\t\t\t┌───────────────┼───────────────┐\n\t\t\t\t│               │               │\n\t\tConcurrency     Expressiveness    Data\n\t\t\t\t│               │               │\n\t\t\t Go              Ruby            Perl\n\t\t\t\t│\n\t\t\t\t├───────────────┐\n\t\t\t\t│               │\n\t Fault Tolerance   Language Design\n\t\t\t\t│               │\n\t\t\tErlang          Racket"}</code></pre>
        <p>Each project explores a different way of thinking about software.</p>
        <h2>🛠️ What you'll learn</h2>
        <p>Imperative, functional, and object-oriented programming; metaprogramming; domain-specific languages; concurrency; actor systems; distributed systems; fault tolerance; parsing; compilers; interpreters; type systems; Unix philosophy; testing; debugging; and performance engineering.</p>
        <p>More importantly, you'll learn how <strong>programming language design influences software architecture</strong>.</p>
        <h2>🚀 Getting started</h2>
        <p>Choose a language and start with its project. You don't need to know the language beforehand.</p>
        <pre><code>{"Language basics\n\t\t\t↓\nTiny exercises\n\t\t\t↓\nSmall prototype\n\t\t\t↓\nProject milestone\n\t\t\t↓\nMore language features\n\t\t\t↓\nAdvanced architecture\n\t\t\t↓\nFinal challenge"}</code></pre>
        <p>The objective isn't to memorize syntax, but to reach the point where you can think: <strong>“This language would be interesting for this.”</strong></p>
        <p><Link className="button" href="/overview/">Read the full curriculum →</Link></p>
        <h2>🧩 Why “Mewlang”?</h2>
        <p>Because programming languages are weird creatures. Some are good at concurrency, some manipulate text beautifully, some reshape the language itself, some survive failure, and some make types do incredible things.</p>
        <p>Different languages. Different powers. Different ways of thinking.</p>
        <h2>📌 Project Status</h2>
        <p>Mewlang is an educational project and an ongoing exploration of programming languages. New languages and projects can be added over time.</p>
        <p><strong>Potential future explorations:</strong> OCaml, Haskell, Clojure, Zig, Smalltalk, Crystal, Nim, and F#.</p>
        <h2>⭐ The goal</h2>
        <p>Mewlang isn't about finding the <strong>best</strong> programming language. It's about discovering that there isn't one universal way to think about software.</p>
        <p><strong>Learn the language.</strong><br /><strong>Build something weird.</strong><br /><strong>Break it.</strong><br /><strong>Understand why it works.</strong><br /><strong>Then learn another language and see the problem differently.</strong></p>
      </main>
      <footer className="text-center">
        <h2>🐱 Welcome to Mewlang.</h2>
      </footer>
    </div>
  );
}
