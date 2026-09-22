import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../courses/assets/expressions/left_to_right/thinking.png';
import img2 from '../../courses/assets/expressions/left_to_right/walking.png';

export const metadata: Metadata = {
  title: "Five Languages, Five Projects — The Mewlang Curriculum",
  description: "The curriculum plan for all five Mewlang courses: how the material is delivered, prerequisites, recommended order, difficulty and time estimates, and the full milestone syllabus for Go, Ruby, Perl, Erlang and Racket.",
};

export default function Page() {
  return (
    <div className="theme-index">
      <div className="wrap">
        <header className="masthead">
          <h1>What kinds of problems does this language make unusually natural to solve?</h1>
          <p className="lede">
            <img className="mascot-left" src={img1.src} alt="The Mewlang cat, thinking about where to start" width="120" loading="lazy" />
            Five languages, five projects, one question asked five times. This page covers the whole curriculum plan: how it's delivered, prerequisites, recommended order, difficulty, and the full milestone syllabus for every course. Each course's actual material — installation, language crash course, and all twelve milestones — lives in its own instalment, linked at the bottom of this page.
          </p>
          <table className="index">
            <tbody>
              <tr>
                <td>Go</td>
                <td><strong>Digital Ant Colony.</strong> Thousands of independent agents, channels, failure injection, eventually a small distributed system.</td>
              </tr>
              <tr>
                <td>Ruby</td>
                <td><strong>Automation DSL.</strong> A pipeline language built out of blocks and metaprogramming that inspects and rewrites itself.</td>
              </tr>
              <tr>
                <td>Perl</td>
                <td><strong>Text Archaeologist.</strong> Ingest ugly heterogeneous data, extract entities, correlate events, build a searchable graph.</td>
              </tr>
              <tr>
                <td>Erlang</td>
                <td><strong>The Internet That Never Dies.</strong> Thousands of supervised processes that crash, restart, partition, and recover.</td>
              </tr>
              <tr>
                <td>Racket</td>
                <td><strong>Language Factory.</strong> A toolkit for defining small languages, ending in real <code>#lang</code> implementations. </td>
              </tr>
            </tbody>
          </table>
        </header>
        <div className="toc">
          <h5>What is on this page</h5>
          <ol>
            <li>How the curriculum is delivered</li>
            <li>Overview of the five courses</li>
            <li>Prerequisites</li>
            <li>Recommended order</li>
            <li>Difficulty and time estimates</li>
            <li>Detailed syllabus for each of the five courses</li>
          </ol>
          <p style={{ marginBottom: "0" }}>From here, each course starts with its own instalment: what we're building, installation and first program, then the language crash course, before the twelve milestones begin.</p>
        </div>
        <h2><span className="num">Section 1</span>How the curriculum is delivered</h2>
        <p>Written in full, these five courses are the size of a book. Delivering them as one document would mean losing exactly the parts that make them worth reading: the line-by-line explanations, the exercises, the debugging sections. So each course is split into instalments — this curriculum map, then five self-contained documents per course, each readable on its own. Every instalment ends with a button to the next one, so you can move through a whole course, or the whole curriculum, by clicking forward.</p>
        <p>The instalment sequence, and how far each course currently reaches:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Course</th>
              <th>Instalments</th>
              <th>Status</th>
            </tr>
            <tr>
              <td>Go — Digital Ant Colony</td>
              <td>Parts 0–2, Milestones 1–4, 5–8, 9–12, advanced phase & final challenge</td>
              <td>written</td>
            </tr>
            <tr>
              <td>Ruby — Programmable Automation DSL</td>
              <td>Parts 0–2, Milestones 1–4, 5–8, 9–12, advanced phase & final challenge</td>
              <td>written</td>
            </tr>
            <tr>
              <td>Perl — Text Archaeologist</td>
              <td>Parts 0–2, Milestones 1–4, 5–8, 9–12, advanced phase & final challenge</td>
              <td>Parts 0–2 through Milestones 5–8 written; Milestones 9–12 onward not yet</td>
            </tr>
            <tr>
              <td>Erlang — The Internet That Never Dies</td>
              <td>Parts 0–2, Milestones 1–4, 5–8, 9–12, advanced phase & final challenge</td>
              <td>not yet written</td>
            </tr>
            <tr>
              <td>Racket — Language Factory</td>
              <td>Parts 0–2, Milestones 1–4, 5–8, 9–12, advanced phase & final challenge</td>
              <td>not yet written</td>
            </tr>
          </tbody>
        </table>
        <p>Instalments are numbered continuously across the whole curriculum — each one says which number it is, and what's next, in a footer at the bottom. If you'd rather reorder the courses themselves — for example, taking Erlang immediately after Go so the two concurrency models sit side by side — nothing here enforces the numbered order; jump straight to that course's instalment from the links at the end of this page.</p>
        <h2><span className="num">Section 2</span>Overview of the five courses</h2>
        <p>Each course is built around one question that the language answers unusually well. The project exists to force you into that answer.</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Course</th>
              <th>The question the language answers</th>
              <th>What the project forces you to confront</th>
            </tr>
            <tr>
              <td>Go</td>
              <td>How do I write a program with tens of thousands of independent activities without drowning in locks?</td>
              <td>Shared mutable state between concurrent agents, and the discipline of passing ownership through channels instead.</td>
            </tr>
            <tr>
              <td>Ruby</td>
              <td>How do I make a configuration file executable, readable, and extensible by its users?</td>
              <td>The line between "data describing work" and "code performing work", and how blocks plus metaprogramming erase it.</td>
            </tr>
            <tr>
              <td>Perl</td>
              <td>How do I turn a pile of inconsistent, half-broken text into structured facts, fast, on the command line?</td>
              <td>Real-world data that violates every assumption your parser makes, at a scale where you cannot load it into memory.</td>
            </tr>
            <tr>
              <td>Erlang</td>
              <td>How do I build something that keeps working while parts of it are broken?</td>
              <td>Failure as a normal, expected, routinely-exercised code path rather than an exception to be prevented.</td>
            </tr>
            <tr>
              <td>Racket</td>
              <td>How do I build the language the problem wants, instead of encoding the problem in the language I have?</td>
              <td>The compile-time/run-time boundary, and the fact that syntax is data you can compute with.</td>
            </tr>
          </tbody>
        </table>
        <p>There is a deliberate pairing structure. Go and Erlang are both about concurrency and disagree profoundly about how to get it. Ruby and Racket are both about growing a language toward the problem and disagree about whether you do that at run time or compile time. Perl stands alone as the Unix-shaped view of computing: a program is a filter, text is the universal interface.</p>
        <h2><span className="num">Section 3</span>Prerequisites</h2>
        <h4>What you need to already know</h4>
        <ul>
          <li><strong>General programming.</strong> Variables, functions, recursion, data structures, complexity, why a hash map is fast. You have written a few thousand lines of something.</li>
          <li><strong>A terminal.</strong> <code>cd</code>, <code>ls</code>, pipes, redirection, environment variables, editing <code>PATH</code>. The Perl course leans on this heavily; the others assume it.</li>
          <li><strong>Git.</strong> Enough to commit per milestone, which I will ask you to do, because the diffs are part of the learning.</li>
          <li><strong>An editor you are fast in.</strong> Each course tells you how to wire up the language server. </li>
        </ul>
        <h4>What you do not need</h4>
        <p>Any prior exposure to these five languages, functional programming, actor models, compiler theory, or distributed systems. Every term gets defined when it first appears. Where a concept is genuinely hard (hygiene in macros, split-brain in distributed systems) it gets its own section rather than a parenthesis. </p>
        <h4>Machine and environment</h4>
        <ul>
          <li>Any machine from the last decade with about 10 GB free. The Go and Erlang projects spawn tens of thousands of lightweight tasks, which is a memory question rather than a CPU question, and 8 GB of RAM is plenty.</li>
          <li>macOS, Linux, or Windows. Commands are given for all three. On Windows, <strong>WSL2</strong> (Windows Subsystem for Linux) is strongly recommended for the Perl and Erlang courses, and optional for the rest. Native Windows instructions are included where they differ.</li>
          <li>Docker is optional throughout. The distributed stages of Go and Erlang work fine as multiple processes on one machine.</li>
        </ul>
        <h4>Time</h4>
        <p>Roughly 180–260 hours for all five if you do the exercises rather than reading past them. At six hours a week that is about a year. At fifteen it is about four months. Doing one course properly beats skimming five.</p>
        <h2><span className="num">Section 4</span>Recommended order</h2>
        <p>The courses are numbered as you listed them, but the order I recommend studying them in is different:</p>
        <pre className="plain"><code>{"  Go  ──────────►  Erlang  ──────────►  Ruby  ──────────►  Racket\n  (1)               (4)                  (2)                (5)\n   │                                                          \n   └── Perl (3) fits anywhere; it shares no concepts with the others\n"}</code></pre>
        <p>The reasoning:</p>
        <ul>
          <li><strong>Go first.</strong> Its syntax is the least surprising of the five, its tooling is the best, and its error messages are the kindest. You spend your energy on concurrency rather than on the language. </li>
          <li><strong>Erlang second, while Go is fresh.</strong> The moment you have hand-written a supervisor goroutine that restarts crashed ants, Erlang's supervision trees land as "oh, this is built in, and thought through far more carefully than mine". That contrast is worth a great deal and it fades if you wait a year.</li>
          <li><strong>Ruby third.</strong> After two courses of systems thinking, a course about expressiveness is a real change of gear. It also introduces DSL design at run time.</li>
          <li><strong>Racket fourth.</strong> Racket is the same ambition as the Ruby course pushed to its conclusion: the Ruby DSL is a library pretending to be a language, and Racket makes it an actual language. Having felt the limits of the Ruby approach makes macros feel necessary rather than clever.</li>
          <li><strong>Perl whenever.</strong> It depends on nothing and nothing depends on it. It is a good palate cleanser after Erlang, and a good warm-up if you want an easy start.</li>
        </ul>
        <p>If you would rather work strictly in the numbered order, nothing breaks. The Ruby-then-Racket connection is the only one I would try to preserve.</p>
        <h2><span className="num">Section 5</span>Difficulty and learning goals</h2>
        <p>Four different kinds of difficulty, rated 1 (easy) to 5 (hard), because they are not the same thing. A language can have easy syntax and a brutal conceptual model, or the reverse.</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Course</th>
              <th>Syntax</th>
              <th>Tooling</th>
              <th>Concepts</th>
              <th>Debugging</th>
              <th>Hours</th>
            </tr>
            <tr>
              <td>Go</td>
              <td>2</td>
              <td>1</td>
              <td>3</td>
              <td>3</td>
              <td>35–50</td>
            </tr>
            <tr>
              <td>Ruby</td>
              <td>2</td>
              <td>2</td>
              <td>3</td>
              <td>2</td>
              <td>30–45</td>
            </tr>
            <tr>
              <td>Perl</td>
              <td>4</td>
              <td>3</td>
              <td>2</td>
              <td>3</td>
              <td>30–45</td>
            </tr>
            <tr>
              <td>Erlang</td>
              <td>4</td>
              <td>3</td>
              <td>5</td>
              <td>4</td>
              <td>45–65</td>
            </tr>
            <tr>
              <td>Racket</td>
              <td>3</td>
              <td>2</td>
              <td>5</td>
              <td>3</td>
              <td>40–60</td>
            </tr>
          </tbody>
        </table>
        <p>Notes on the ratings. Go's concept score is entirely concurrency; the rest of the language is deliberately small. Perl's syntax score is high because of sigils and context, a rule that has no equivalent in most languages, and its debugging score is high because a typo can be silently valid. Erlang is hard on every axis at once: unfamiliar syntax, an unfamiliar build tool, and a model that asks you to unlearn defensive programming. Racket's syntax is trivial to read after an hour, and its concept score comes entirely from macros and phase separation.</p>
        <h4>Learning goals, stated as things you will be able to do</h4>
        <ul>
          <li><strong>Go:</strong> design a concurrent system where ownership of data is explicit; read a race detector report and fix the cause; shut a system down cleanly under load; profile and find the actual bottleneck.</li>
          <li><strong>Ruby:</strong> design an internal DSL that reads like a language, is testable, produces an inspectable intermediate representation, and can be extended by third parties without editing your source.</li>
          <li><strong>Perl:</strong> build a streaming data pipeline that survives malformed input, correlates records across sources, and runs as a well-behaved Unix citizen.</li>
          <li><strong>Erlang:</strong> design a supervision tree; choose restart strategies with reasons; reason about what happens during a network partition; observe a live system without stopping it.</li>
          <li><strong>Racket:</strong> implement an interpreter, then a compiler, for a small language; write hygienic macros with good error messages; ship a working <code>#lang</code>.</li>
        </ul>
        <h2><span className="num">Section 6</span>Detailed syllabi</h2>
        <p>Each course follows the same shape: Part 0 (what we are building), Part 1 (install and first program), Part 2 (language crash course), then twelve milestones, then an advanced phase, a final challenge, and a knowledge check. Below is the milestone plan for each.</p>
        <h3>Course 1 — Go: Digital Ant Colony</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>#</th>
              <th>Milestone</th>
              <th>Concepts introduced</th>
            </tr>
            <tr>
              <td>1</td>
              <td>One ant on a grid, ticking</td>
              <td>structs, methods, pointers, slices, CLI flags, package layout</td>
            </tr>
            <tr>
              <td>2</td>
              <td>A thousand ants, still sequential</td>
              <td>maps, deterministic randomness, table tests, benchmarks as a baseline</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Behaviour: forage, carry, return</td>
              <td>interfaces, state machines, errors and <code>errors.Is</code></td>
            </tr>
            <tr>
              <td>4</td>
              <td>Each ant becomes a goroutine</td>
              <td>goroutines, <code>WaitGroup</code>, the first real data race, <code>go test -race</code>, mutexes</td>
            </tr>
            <tr>
              <td>5</td>
              <td>Replace locks with channels</td>
              <td>channels, <code>select</code>, the world as a single owning goroutine, request/reply</td>
            </tr>
            <tr>
              <td>6</td>
              <td>Pheromones and evaporation</td>
              <td>tickers, fan-in, buffered channels, time in simulations</td>
            </tr>
            <tr>
              <td>7</td>
              <td>Graceful shutdown</td>
              <td><code>context</code>, signal handling, <code>errgroup</code>, goroutine-leak tests</td>
            </tr>
            <tr>
              <td>8</td>
              <td>Chaos: crashes, drops, slow ants</td>
              <td><code>panic</code>/<code>recover</code>, supervisor goroutines, timeouts, fault injection as config</td>
            </tr>
            <tr>
              <td>9</td>
              <td>Metrics and introspection</td>
              <td>atomics, <code>expvar</code>, an HTTP endpoint, <code>net/http/pprof</code></td>
            </tr>
            <tr>
              <td>10</td>
              <td>Live visualisation</td>
              <td>terminal rendering, a web view over server-sent events, decoupling render from simulation</td>
            </tr>
            <tr>
              <td>11</td>
              <td>Backpressure and performance</td>
              <td>worker pools, bounded queues, load shedding, escape analysis, allocation profiles</td>
            </tr>
            <tr>
              <td>12</td>
              <td>Multiple colony nodes over the network</td>
              <td>encoding, TCP servers, reconnection, partitions, chaos tests across processes</td>
            </tr>
          </tbody>
        </table>
        <h3>Course 2 — Ruby: Programmable Automation DSL</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>#</th>
              <th>Milestone</th>
              <th>Concepts introduced</th>
            </tr>
            <tr>
              <td>1</td>
              <td>A gem skeleton and a Step object</td>
              <td>objects, methods, <code>bundler</code>, project layout, <code>irb</code></td>
            </tr>
            <tr>
              <td>2</td>
              <td><code>pipeline "x" do ... end</code> that runs</td>
              <td>blocks, <code>yield</code>, procs and lambdas, the builder pattern</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Bare keywords inside the block</td>
              <td><code>instance_eval</code>, <code>self</code>, scope gates, the cost of a clean DSL</td>
            </tr>
            <tr>
              <td>4</td>
              <td>Build an AST instead of executing</td>
              <td>value objects, immutability by convention, separating description from execution</td>
            </tr>
            <tr>
              <td>5</td>
              <td>The execution engine</td>
              <td>the interpreter pattern, a context object, step results, logging</td>
            </tr>
            <tr>
              <td>6</td>
              <td>Failure handling: <code>when_failed</code>, retries</td>
              <td>exception classes, <code>ensure</code>, <code>retry</code>, designing recoverable steps</td>
            </tr>
            <tr>
              <td>7</td>
              <td>Steps registered dynamically</td>
              <td><code>define_method</code>, <code>method_missing</code>, <code>respond_to_missing?</code>, registries</td>
            </tr>
            <tr>
              <td>8</td>
              <td>Steps that do real work</td>
              <td>HTTP, file and SQLite outputs, pluggable summarisers, configuration</td>
            </tr>
            <tr>
              <td>9</td>
              <td>Testing a DSL</td>
              <td>RSpec, doubles, a test DSL for the DSL, contract tests for plugins</td>
            </tr>
            <tr>
              <td>10</td>
              <td>Self-inspection</td>
              <td>reflection, <code>to_h</code>, dry runs, graph rendering, instrumentation via module prepend </td>
            </tr>
            <tr>
              <td>11</td>
              <td>Pipelines that rewrite themselves</td>
              <td>AST transformation at run time, middleware, hooks, safety limits</td>
            </tr>
            <tr>
              <td>12</td>
              <td>Ship it as a gem</td>
              <td>gemspec, versioning, a CLI, YARD docs, publishing</td>
            </tr>
          </tbody>
        </table>
        <h3>Course 3 — Perl: Text Archaeologist</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>#</th>
              <th>Milestone</th>
              <th>Concepts introduced</th>
            </tr>
            <tr>
              <td>1</td>
              <td>A filter that reads standard input</td>
              <td>scalars, <code>strict</code>/<code>warnings</code>, <code>perldoc</code>, the diamond operator </td>
            </tr>
            <tr>
              <td>2</td>
              <td>Counting and summarising</td>
              <td>arrays, hashes, context (the rule with no equivalent elsewhere), sorting</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Parsing Apache and nginx logs</td>
              <td>regexes, named captures, anchors, greediness, <code>//x</code> readable patterns</td>
            </tr>
            <tr>
              <td>4</td>
              <td>A record model</td>
              <td>references, nested data, <code>Data::Dumper</code>, the arrow rule</td>
            </tr>
            <tr>
              <td>5</td>
              <td>Splitting into modules</td>
              <td>packages, <code>lib/</code>, <code>use</code>, <code>cpanm</code>, local::lib, dependency management</td>
            </tr>
            <tr>
              <td>6</td>
              <td>Pluggable format readers</td>
              <td>CSV, JSON and XML modules, dispatch tables, sniffing formats</td>
            </tr>
            <tr>
              <td>7</td>
              <td>Streaming a 10 GB file</td>
              <td>line-by-line processing, encodings, memory profiling, malformed-input policy</td>
            </tr>
            <tr>
              <td>8</td>
              <td>Entity extraction and normalisation</td>
              <td>IPs, timestamps, paths, identifiers; canonical forms; time zones</td>
            </tr>
            <tr>
              <td>9</td>
              <td>Correlation and sessionisation</td>
              <td>time windows, joins, SQLite via DBI, indexes</td>
            </tr>
            <tr>
              <td>10</td>
              <td>A real command-line tool</td>
              <td><code>Getopt::Long</code>, exit codes, signals, pipes, <code>--help</code>, composability</td>
            </tr>
            <tr>
              <td>11</td>
              <td>Testing and profiling</td>
              <td><code>Test2</code>, <code>prove</code>, fuzzing with corrupted input, <code>Devel::NYTProf</code>, optimisation </td>
            </tr>
            <tr>
              <td>12</td>
              <td>The knowledge graph</td>
              <td>graph storage, queries, forking for parallelism, plugin architecture, packaging</td>
            </tr>
          </tbody>
        </table>
        <h3>Course 4 — Erlang: The Internet That Never Dies</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>#</th>
              <th>Milestone</th>
              <th>Concepts introduced</th>
            </tr>
            <tr>
              <td>1</td>
              <td>The shell and a first module</td>
              <td><code>erl</code>, expressions, atoms, compiling, <code>rebar3</code></td>
            </tr>
            <tr>
              <td>2</td>
              <td>Functions over data</td>
              <td>pattern matching, immutability, lists/tuples/maps, recursion, tail calls, guards</td>
            </tr>
            <tr>
              <td>3</td>
              <td>A node as a raw process</td>
              <td><code>spawn</code>, <code>!</code>, <code>receive</code>, mailboxes, selective receive</td>
            </tr>
            <tr>
              <td>4</td>
              <td>Let it crash</td>
              <td>links, monitors, exit signals, <code>trap_exit</code>, why defensive code is discouraged</td>
            </tr>
            <tr>
              <td>5</td>
              <td>The node as a <code>gen_server</code></td>
              <td>OTP behaviours, <code>call</code> vs <code>cast</code>, state, timeouts</td>
            </tr>
            <tr>
              <td>6</td>
              <td>Supervision trees</td>
              <td>restart strategies, intensity limits, dynamic children, startup ordering</td>
            </tr>
            <tr>
              <td>7</td>
              <td>A network of a thousand nodes</td>
              <td>registries, <code>ETS</code>, process groups, routing, message loss</td>
            </tr>
            <tr>
              <td>8</td>
              <td>Chaos injection</td>
              <td>random crashes, slow handlers, malformed messages, memory pressure</td>
            </tr>
            <tr>
              <td>9</td>
              <td>Observability</td>
              <td>counters, <code>observer</code>, <code>recon</code>, tracing a live system safely</td>
            </tr>
            <tr>
              <td>10</td>
              <td>The live dashboard</td>
              <td>an HTTP server in Erlang, streaming updates, aggregation without slowing the system</td>
            </tr>
            <tr>
              <td>11</td>
              <td>Actually distributed</td>
              <td>multiple BEAM nodes, cookies, <code>net_kernel</code>, partitions, split brain</td>
            </tr>
            <tr>
              <td>12</td>
              <td>Releases and property tests</td>
              <td>EUnit, Common Test, PropEr, <code>relx</code> releases, upgrades</td>
            </tr>
          </tbody>
        </table>
        <h3>Course 5 — Racket: Language Factory</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>#</th>
              <th>Milestone</th>
              <th>Concepts introduced</th>
            </tr>
            <tr>
              <td>1</td>
              <td>Racket, DrRacket, and <code>raco</code></td>
              <td>s-expressions, definitions, modules, the REPL</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Functional groundwork</td>
              <td>lists, pairs, higher-order functions, recursion, <code>match</code></td>
            </tr>
            <tr>
              <td>3</td>
              <td>Structs and contracts</td>
              <td><code>struct</code>, contracts as executable specifications, error messages</td>
            </tr>
            <tr>
              <td>4</td>
              <td>An interpreter for a config language</td>
              <td>AST design, environments, evaluation, <code>quote</code> vs data</td>
            </tr>
            <tr>
              <td>5</td>
              <td>First macros</td>
              <td><code>define-syntax-rule</code>, hygiene demonstrated by breaking it</td>
            </tr>
            <tr>
              <td>6</td>
              <td>Real macros</td>
              <td><code>syntax-parse</code>, syntax classes, compile-time errors with source locations</td>
            </tr>
            <tr>
              <td>7</td>
              <td>The finance DSL</td>
              <td>validation passes, a small type checker, phase separation</td>
            </tr>
            <tr>
              <td>8</td>
              <td>The toolkit itself</td>
              <td>generating parsers, AST types and checkers from a specification</td>
            </tr>
            <tr>
              <td>9</td>
              <td>Your own <code>#lang</code></td>
              <td>readers, module languages, <code>#lang finance</code> files that run</td>
            </tr>
            <tr>
              <td>10</td>
              <td>The robot DSL</td>
              <td>effects, sequencing, a stepper, interpreters as libraries</td>
            </tr>
            <tr>
              <td>11</td>
              <td>Compiling instead of interpreting</td>
              <td>macro-based compilation, benchmarks against the interpreter</td>
            </tr>
            <tr>
              <td>12</td>
              <td>Tooling and the game DSL</td>
              <td><code>rackunit</code>, editor integration, packaging, the capstone language</td>
            </tr>
          </tbody>
        </table>
        <p>
          <img className="mascot-left" src={img2.src} alt="The Mewlang cat, walking off to start the first course" width="110" loading="lazy" />
          That's the whole curriculum. Go is first, so its instalment picks up next: what we're building (an ant colony that finds itself corrupting its own state the moment it goes concurrent, and the idiom that fixes it), installing the toolchain, and a full language crash course, before Milestone 1 begins.
        </p>
        <hr />
         <Link className="button" href="/go-course/instalment/">Next: Go instalment</Link> 
      </div>
    </div>
  );
}
