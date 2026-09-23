import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../courses/assets/expressions/left_to_right/thinking.png';
import img2 from '../../../courses/assets/expressions/left_to_right/laptop.png';

export const metadata: Metadata = {
  title: "Racket: Language Factory — Instalment",
  description: "Course 5 of 5: build a toolkit for creating small domain-specific languages, ending in real, working #lang implementations for finance, robotics and a capstone game language.",
};

export default function Page() {
  return (
    <div className="theme-racket">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 21 · Course 5 (Racket) · Parts 0–2</p>
          <h1>The language for building languages</h1>
          <p className="lede">
            <img className="mascot-left" src={img1.src} alt="The Mewlang cat, thinking with a paw to its chin" width="120" loading="lazy" />
            Every other course in this curriculum accepts its language's syntax as fixed and works within it. This one treats syntax as data you can compute with — and ends with a language of your own, checked at compile time, that <code>racket</code> runs exactly like it runs Racket itself.
          </p>
        </header>
        <h2><span className="num">Course 5 · Part 0</span>What are we building?</h2>
        <h3>The final result</h3>
        <p>A toolkit, <code>langfac</code>, for defining small domain-specific languages — and three real languages built with it. First, an interpreter for a tiny configuration language, built from ordinary functions. Then a finance DSL with its own validation and a small type checker, first as a macro-based extension of Racket, and finally as a genuine standalone language: files that begin <code>#lang finance</code> and run, with no quotation marks around "language" needed. A robot-control DSL follows, built as a reusable interpreter library rather than a one-off. The course closes by compiling that same finance language to Racket code directly, instead of interpreting it, and measuring the difference — and by building one final, capstone language for describing simple games, using every piece of the toolkit at once.</p>
        <pre className="plain"><code>{"$ cat budget.finance\n#lang finance\n\naccount checking balance: 2400.00\naccount savings  balance: 8000.00\n\nrule \"emergency fund\"\n  when savings.balance < 6 * monthly-expenses\n  alert \"top up savings\"\n\n$ racket budget.finance\nchecking: $2,400.00\nsavings:  $8,000.00\nrule \"emergency fund\": ok (savings covers 6.0x monthly expenses)\n"}</code></pre>
        <p>That file runs with the ordinary <code>racket</code> command — no special interpreter to invoke, no wrapper script. By Milestone 9, <code>#lang finance</code> is a real, first-class language exactly as far as the operating system, your editor, and Racket's own module system are concerned.</p>
        <h3>Why this project is interesting</h3>
        <p>Every course so far has, at some point, reached the edge of what its host language's syntax could express directly and built something to work around it: Ruby's course built an internal DSL — Ruby code that <em>reads</em> like a pipeline description, using blocks and method_missing to blur the line between data and executable code, but is still, underneath, ordinary Ruby method calls. Perl's course parsed text formats that were never Perl at all. This course asks a different, more radical question: <strong>what if the tool for describing "a language that reads like configuration, but is checked and compiled" were not a clever use of an existing language's syntax, but an actual, first-class mechanism the language gives you on purpose?</strong> Racket's answer is macros powerful enough to add real syntax, phase separation precise enough to run code at compile time safely, and a module system open enough that "a new <code>#lang</code>" is a supported, ordinary thing to build — not a hack, not a wrapper, not a subset of an existing parser bent sideways.</p>
        <h3>Why Racket in particular</h3>
        <p>Three properties, found together nowhere else in this curriculum.</p>
        <p><strong>Code is data, structurally, not just in spirit.</strong> A Racket program is, at the syntax level, a tree of parenthesized expressions — an s-expression — which is also exactly the shape Racket uses to represent <em>data</em>. <code>(+ 1 2)</code> is a valid piece of code and, quoted, a valid list containing the symbol <code>+</code> and two numbers. This is not a party trick: it is what makes it possible to write a program that manipulates other programs using the same list-processing tools you already know from Section 2.2, rather than a separate parser and AST library bolted on afterward.</p>
        <p><strong>Macros run at compile time, with hygiene guaranteed.</strong> A macro is a function from syntax to syntax, run by the compiler before your program executes, and Racket's macro system guarantees — checked by the language, not by convention — that a macro cannot accidentally capture a variable from the code that uses it, or vice versa. Ruby's <code>method_missing</code>-based DSLs, met in Course 2, run at ordinary run time and cannot add new syntax at all — a Ruby DSL is still legal Ruby, parsed by Ruby's one fixed grammar. A Racket macro can add genuinely new syntactic forms, checked before the program ever runs, and Milestone 5 shows exactly what "hygiene, guaranteed" is protecting you from by deliberately trying to break it.</p>
        <p><strong><code>#lang</code> is not a special case.</strong> Racket itself — the language you have been learning is called <code>#lang racket</code> — is implemented using the same mechanism this course teaches you to use for your own languages. There is no privileged, built-in-only way to make <code>#lang whatever</code> work that your own <code>#lang finance</code> cannot also use. By Milestone 9 you are not approximating a real language, you are building one, with the same standing as any other. </p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Be honest about the cost. Macros that generate other macros, phase separation, and a compile-time budget that behaves differently from your run-time budget are genuinely more to hold in your head than any other single concept in this curriculum — the difficulty table on the curriculum overview page rates Racket's syntax as easy and its concepts as the hardest of all five courses, and that rating is earned specifically by this material, not by anything superficial about parentheses. Where Go trades verbosity for a small, learnable core, Racket trades a genuinely steep middle section (Milestones 5–8) for a payoff — a real language of your own — that no other course in this curriculum offers at all.</p>
        </div>
        <h3>Architecture we are building toward</h3>
        <pre className="plain"><code>{"          text (a .finance or .robot file, or Racket-hosted DSL code)\n                              │\n                    ┌─────────────────┐\n                    │  Reader          │  turns raw text into syntax objects\n                    │  (Milestone 9)   │  (source locations attached)\n                    └────────┬─────────┘\n                              │  syntax objects (code AND data, same shape)\n                    ┌─────────────────┐\n                    │  Macros          │  syntax → syntax, at compile time\n                    │  (Milestones     │  (syntax-parse, syntax classes,\n                    │   5, 6, 7)        │   compile-time validation)\n                    └────────┬─────────┘\n                              │  expands into\n                    ┌─────────────────┐\n                    │  Interpreter, OR │  Milestones 4, 10: walk an AST\n                    │  Compiler        │  Milestone 11: macro-expand straight\n                    │  (Milestones      │   into executable Racket, no AST walk\n                    │   4, 10, 11)       │   at run time at all\n                    └────────┬─────────┘\n                              │\n                          a running program\n"}</code></pre>
        <p>Two genuinely different strategies for "make this DSL run," both built in this course, on purpose: <strong>interpretation</strong> (an AST, a function that walks it, an environment mapping names to values — Milestone 4's config language and Milestone 10's robot DSL) and <strong>macro-based compilation</strong> (the DSL's syntax expands directly into ordinary Racket code, which Racket's own compiler then optimises exactly as if you had hand-written it — Milestone 11). Neither is universally better; Milestone 11 measures the difference on the same finance language both ways.</p>
        <h3>The twelve milestones</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>#</th>
              <th>Milestone</th>
              <th>What it teaches</th>
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
        <h3>What you will know afterwards</h3>
        <p>Why "code is data" is a structural property of s-expressions and not a metaphor; how to write a macro that cannot accidentally capture or be captured, and why that guarantee is checked rather than a matter of discipline; the difference between run time and compile time well enough to know which one a given piece of code you write actually executes in; how an interpreter and a compiler answer the same "make this DSL run" question differently, with different costs; and what it actually takes, mechanically, to turn a language design into a <code>#lang</code> that <code>racket</code> itself will run.</p>
        <hr />
        <h2><span className="num">Course 5 · Part 1</span>Install and first program</h2>
        <h3>What Racket is</h3>
        <p>Racket is a descendant of Scheme — itself a dialect of Lisp — developed since the mid-1990s (originally as PLT Scheme) with language creation as an explicit, central design goal rather than a byproduct. This course was verified on <strong>Racket 8.7 [cs]</strong> — the <code>[cs]</code> marks the "Chez Scheme" backend, Racket's current default implementation strategy, compiling through Chez Scheme rather than Racket's older custom virtual machine.</p>
        <p>Racket is not "just Scheme" for this course's purposes, for one specific reason: its macro system (<code>syntax-parse</code>, syntax classes, module-level phase separation) and its <code>#lang</code> mechanism go considerably further than standard Scheme's <code>syntax-rules</code>, and that additional machinery — not the base language's parentheses — is this entire course's actual subject.</p>
        <h3>Installing</h3>
        <h5>Linux</h5>
        <pre className="plain"><code>{"sudo apt install racket        # Debian/Ubuntu — often slightly behind\n                                # the latest release; fine for this course\n# or the official installer, for the newest version:\n# https://download.racket-lang.org\n\nracket --version\n# Welcome to Racket v8.7 [cs].\n"}</code></pre>
        <h5>macOS</h5>
        <pre className="plain"><code>{"brew install --cask racket\n"}</code></pre>
        <h5>Windows</h5>
        <pre className="plain"><code>{":: the official installer from racket-lang.org is the straightforward path\nwinget install Racket.Racket\n"}</code></pre>
        <h3><code>raco</code>, Racket's tool</h3>
        <pre className="plain"><code>{"raco pkg install <name>   # install a package, like gem install or go get\nraco make file.rkt         # compile a file (and cache the result — makes\n                           # repeated runs faster, the same idea as Go's\n                           # build cache)\nraco test file.rkt         # run rackunit tests found in a module\nraco exe file.rkt           # produce a standalone executable\nraco demod file.rkt          # show a fully macro-expanded module — the\n                             # single most useful debugging tool once\n                             # Milestone 5 starts, because it shows you\n                             # exactly what your macro actually expanded to\n"}</code></pre>
        <p><code>raco demod</code> deserves to be called out this early even though nothing until Milestone 5 needs it: the entire back half of this course is macros transforming code into other code, and the single best debugging technique for "my macro did something I did not expect" is looking at exactly what it expanded into, rather than guessing.</p>
        <h3>DrRacket, and why this course still uses a plain text editor</h3>
        <p>DrRacket, bundled with every Racket install, is a full IDE built specifically for this language, with a genuinely excellent macro-stepper (Milestone 5 onward, <strong>Macro Stepper</strong> under the Languages menu shows a macro expanding one step at a time, visually) and syntax-aware structure editing. It is worth opening at least once for that stepper alone. This course's own examples are shown as plain <code>.rkt</code> files runnable from any editor plus <code>racket file.rkt</code> at a terminal, because that is the more transferable skill and the shape every milestone's code in this document takes — but "open this exact file in DrRacket and use the macro stepper" is a standing, implicit suggestion for anything in Milestones 5 through 8 that feels confusing on the page.</p>
        <h3>Hello, factory</h3>
        <pre><code>{"#lang racket\n\n(displayln \"hello, language factory\")\n"}</code></pre>
        <pre className="plain"><code>{"$ racket hello.rkt\nhello, language factory\n"}</code></pre>
        <h4>Every line, explained</h4>
        <ul>
          <li><strong><code>#lang racket</code></strong> is not a comment and not decoration — it is the single most important line in the file, and this whole course is, in a real sense, about what comes after the words <code>#lang</code>. It tells Racket's own module system which <em>language</em> the rest of the file is written in, which determines how the reader turns the following text into syntax, and which determines what identifiers like <code>displayln</code> even mean. By Milestone 9, your own files will start <code>#lang finance</code> instead, and this line is exactly what makes that meaningful rather than cosmetic.</li>
          <li><strong><code>(displayln "hello, language factory")</code></strong> is a function call: parenthesis, then the function, then its arguments, no commas, no special call syntax — this is the entirety of Racket's function-call grammar, and Section 2.1 explains why having only one call syntax at all is not a limitation.</li>
        </ul>
        <h4>A real script takes real arguments</h4>
        <p><code>racket file.rkt</code> is a bare invocation with no arguments — most of this course's own example scripts stay that way, deliberately, to keep the code on the page focused on whatever that milestone is actually teaching. A script meant to be run repeatedly from a shell, the way <code>budget.finance</code> will be from Milestone 9 onward, usually wants real command-line arguments instead of a hardcoded value, and <code>racket/cmdline</code> is the standard library for that — Racket's equivalent of Go's <code>flag</code> package or Python's <code>argparse</code>.</p>
        <pre><code>{"#lang racket\n(require racket/cmdline)\n\n(define name \"language factory\")\n\n(command-line\n #:program \"hello\"\n #:once-each\n [(\"-n\" \"--name\") n \"Who to greet\" (set! name n)]\n #:args () (void))\n\n(displayln (format \"hello, ~a\" name))\n"}</code></pre>
        <pre className="plain"><code>{"$ racket hello.rkt\nhello, language factory\n$ racket hello.rkt --name \"budget.finance reader\"\nhello, budget.finance reader\n$ racket hello.rkt --help\nusage: hello [ <option> ... ]\n\n<option> is one of\n\n  -n <n>, --name <n>\n     Who to greet\n  --help, -h\n     Show this help\n  --\n     Do not treat any remaining argument as a switch (at this level)\n"}</code></pre>
        <p><code>--help</code> is generated for you, from the same <code>#:once-each</code> clause that declares <code>--name</code> — the one-line description <code>"Who to greet"</code> is what shows up next to it, which is the same "declare it once, get the documentation for free" idea <code>syntax-parse</code>'s syntax classes bring to macros in Milestone 6, applied here to an ordinary script's flags instead.</p>
        <h3>The REPL</h3>
        <pre className="plain"><code>{"$ racket\nWelcome to Racket v8.7 [cs].\n> (+ 1 2)\n3\n> (define (square x) (* x x))\n> (square 5)\n25\n> (require racket/list)\n> (first '(a b c))\n'a\n"}</code></pre>
        <p><code>racket</code> with no file argument drops you into a REPL exactly like <code>erl</code> or <code>irb</code> — definitions and expressions typed directly, evaluated immediately. <code>(require racket/list)</code> pulls in one of Racket's many small, focused libraries; <code>racket</code> the language you get from <code>#lang racket</code> already includes a large, convenient standard set, and <code>#lang racket/base</code> — a smaller, faster-loading language this course's own toolkit code prefers once performance starts to matter in Milestone 11 — includes much less, requiring you to <code>require</code> things explicitly.</p>
        <h3>Documentation</h3>
        <pre className="plain"><code>{"$ raco docs                      # opens the full local documentation in a browser\n> (require racket/list)\n> ,doc first                       # inside the REPL: jump straight to a\n                                   # function's documentation entry\n"}</code></pre>
        <p>Racket's documentation (locally installed, searchable, and the same content as <a href="https://docs.racket-lang.org">docs.racket-lang.org</a>) is unusually thorough by the standards of this curriculum — every function's contract, every macro's grammar, and, critically for this course, a complete <em>guide</em> to macros (<code>raco docs</code>, then "Macros and Languages") that this course's Milestones 5 through 9 draw on directly rather than duplicate.</p>
        <h3>Project layout and testing, from day one</h3>
        <pre className="plain"><code>{"langfac/\n├── info.rkt              package metadata (like a gemspec or go.mod)\n├── main.rkt               re-exports the toolkit's public API\n├── interp/\n│   └── config.rkt           Milestone 4's config-language interpreter\n└── tests/\n    └── config-tests.rkt\n"}</code></pre>
        <pre><code>{"#lang racket\n(require rackunit)\n\n(check-equal? (+ 1 2) 3)\n(check-equal? (+ 1 2) 4)     ;; deliberately wrong, to see real failure output\n"}</code></pre>
        <pre className="plain"><code>{"$ raco test scratch.rkt\n--------------------\nFAILURE\nname:       check-equal?\nlocation:   scratch.rkt:5:0\nactual:     3\nexpected:   4\n--------------------\n1 success(es) 1 failure(s) 0 error(s) 0 test(s) skipped\n"}</code></pre>
        <p><code>rackunit</code> ships with Racket — no dependency to add. <code>raco test</code> finds every <code>check-*</code> call in a module (there is no separate "test function" naming convention to learn; any <code>check-equal?</code>, run at module load time, counts) and reports failures with the exact location, the actual value, and the expected one — deliberately shown failing once here, immediately, so the very first thing you see from this course's testing tool is what a real failure looks like.</p>
        <h3>Style and formatting</h3>
        <p>Racket ships no equivalent of <code>gofmt</code> — there is no single official formatter that every <code>.rkt</code> file is expected to already agree with, and no build step in this course's own <code>langfac</code> project runs one. Style here is convention-driven: the <a href="https://docs.racket-lang.org/style/">Racket Style Guide</a> (linked from <code>raco docs</code>) documents indentation, naming, and module-organisation conventions the community broadly follows, and DrRacket's own structural editor auto-indents new code to match them as you type, which is where most Racket programmers get consistent formatting in practice — by writing inside an editor that already knows the convention, rather than by running a separate formatting pass afterward. A third-party formatter, <code>fmt</code> (<code>raco pkg install fmt</code>, then <code>raco fmt file.rkt</code>), exists and is worth knowing about if a project wants an enforceable, CI-checkable formatting rule the way <code>gofmt -l</code> gives Go — but it is a community package, not part of the language distribution, and this course's own code was formatted by hand against the Style Guide's conventions rather than by running it.</p>
        <h4>Checkpoint</h4>
        <ol>
          <li>What does the <code>#lang</code> line at the top of a file actually determine?</li>
          <li>What is the difference between <code>#lang racket</code> and <code>#lang racket/base</code>, and why might a library prefer the smaller one?</li>
          <li>What does <code>raco demod</code> show you, and why is it specifically useful once you start writing macros?</li>
        </ol>
        <hr />
        <h2><span className="num">Course 5 · Part 2</span>Language crash course</h2>
        <h3>2.1 S-expressions: one grammar for everything</h3>
        <p>Every Racket expression is either an atom (a number, a string, a symbol, a boolean) or a parenthesized list whose first element says what to do with the rest. There is no operator precedence to memorise, no distinction between a function call's syntax and a special form's syntax at the level that matters for this course — <code>(+ 1 2)</code>, <code>(if a b c)</code>, and <code>(my-macro x y)</code> are, before anything decides otherwise, the identical shape: a list starting with an identifier.</p>
        <pre><code>{"> (+ 1 2 3)\n6\n> (+ 1 (* 2 3))\n7\n> '(+ 1 2)\n'(+ 1 2)\n> (eval '(+ 1 2))\n3\n"}</code></pre>
        <p>The quote (<code>'</code>) is the whole of Section 2.1's point made concrete: <code>(+ 1 2)</code> is code, evaluated immediately; <code>'(+ 1 2)</code> is the identical text, but quoted — told "do not evaluate this, hand it to me as data" — and what comes back is an ordinary three-element list, containing the symbol <code>+</code> and two numbers, inspectable and manipulable with the same list functions Section 2.2 covers. <code>eval</code> closes the loop: handed that list back, it runs it as code. Code and data are, literally, the same representation, and quoting is the switch between treating a given piece of text as one or the other.</p>
        <div className="cmp">
          <h5>A typical language vs. Racket</h5>
          <p>In Python or Ruby, "write a program that manipulates other programs" means parsing text into a bespoke AST representation (or, for Ruby's DSL course, hijacking method dispatch instead) — the data shape of "a program" and the data shape of "an ordinary list" are unrelated. In Racket, they are the same shape from the start, so list functions you already know — <code>map</code>, <code>filter</code>, pattern matching via <code>match</code> — are already, immediately, tools for working with code. This is not a claim that manipulating code is <em>easy</em> in Racket, only that it does not require a second, separate toolkit on top of the one you already have for lists.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 2.1</h5>
          <ol>
            <li>Write <code>operators</code>, taking a quoted arithmetic expression like <code>'(+ 1 (* 2 3))</code> and returning the list of every operator symbol it uses, in the order encountered — <code>(operators '(+ 1 (* 2 3)))</code> should give <code>'(+ *)</code>. Treat the expression purely as a list of lists; do not evaluate it.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 2.1 — open after trying</summary>
          <pre><code>{"(require racket/list)\n\n(define (operators expr)\n  (cond\n    [(not (list? expr)) '()]\n    [(empty? expr) '()]\n    [else (cons (first expr)\n                (append-map operators (rest expr)))]))"}</code></pre>
          <p>Nothing here is "code-manipulation" machinery distinct from ordinary list processing — <code>operators</code> is exactly the shape of function you would write to pull every first element out of a tree of plain lists, because a quoted expression <em>is</em> a tree of plain lists. Running it on a deeper expression, <code>(operators '(+ (* 2 3) (- 4 (* 5 6))))</code>, gives <code>'(+ * - *)</code> — the same function, unmodified, works on any depth of nesting.</p>
        </details>
        <h3>2.2 Lists, pairs, and higher-order functions</h3>
        <pre><code>{"> (define xs (list 1 2 3 4 5))\n> (map (lambda (x) (* x x)) xs)\n'(1 4 9 16 25)\n> (filter even? xs)\n'(2 4)\n> (foldl + 0 xs)\n15\n> (cons 0 xs)\n'(0 1 2 3 4 5)\n> (first xs)\n1\n> (rest xs)\n'(2 3 4 5)\n"}</code></pre>
        <p>A Racket list is, underneath, a chain of two-element <strong>pairs</strong> (<code>cons</code> cells) — <code>(cons 0 xs)</code> builds a new pair whose first half is <code>0</code> and whose second half is the existing list <code>xs</code>, and a "list" is precisely a chain of these ending in the empty list <code>'()</code>. <code>map</code>, <code>filter</code> and <code>foldl</code> need no introduction if Course 2's Ruby blocks or Course 1's Go closures are still fresh — the shape (a function, a collection, a new collection or a single accumulated value) is the same idea in a fourth syntax.</p>
        <div className="warn">
          <h5>A common mistake: assuming <code>map</code> pads or truncates mismatched lists</h5>
          <p>Some languages' equivalent of <code>map</code> over two collections silently stops at the shorter one, or pads the missing side with a default. Racket's does neither — it insists every list argument have exactly the same length, and raises rather than guessing what you meant:</p>
          <pre className="plain"><code>{"> (map + (list 1 2 3) (list 10 20))\nmap: all lists must have same size\n  first list length: 3\n  other list length: 2\n  procedure: #<procedure:+>\n"}</code></pre>
          <p>worth knowing before it happens by surprise in the middle of a longer pipeline, where the error points at <code>map</code> itself rather than at whichever earlier step actually produced the short list.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 2.2</h5>
          <ol>
            <li>Write <code>total-of</code>, taking a predicate and a list of numbers and returning the sum of only the numbers the predicate accepts — <code>(total-of positive? (list -5 10 -3 20 7))</code> should give <code>37</code> — by composing <code>filter</code> and <code>foldl</code> rather than writing a new recursive function.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 2.2 — open after trying</summary>
          <pre><code>{"(define (total-of pred xs) (foldl + 0 (filter pred xs)))"}</code></pre>
          <p><code>filter</code> then <code>foldl</code>, composed directly, rather than one hand-written loop doing both jobs at once — the same instinct Milestone 2 uses throughout the toolkit itself: a small higher-order function built from smaller ones is usually clearer than a bespoke loop that reimplements both from scratch.</p>
        </details>
        <h3>2.3 Recursion</h3>
        <pre><code>{"(define (sum-list xs)\n  (cond\n    [(empty? xs) 0]\n    [else (+ (first xs) (sum-list (rest xs)))]))\n\n(define (sum-tail xs [acc 0])\n  (cond\n    [(empty? xs) acc]\n    [else (sum-tail (rest xs) (+ acc (first xs)))]))\n"}</code></pre>
        <p><code>[acc 0]</code> in the parameter list is a default argument — <code>(sum-tail xs)</code> and <code>(sum-tail xs 10)</code> are both valid calls. Racket's compiler recognises and optimises tail calls, the same guarantee Erlang's course relied on for unbounded recursion depth, though in ordinary Racket code you will reach for <code>for</code>, <code>for/list</code>, and the higher-order functions from Section 2.2 far more often than hand-written recursion — they exist precisely so you do not have to write <code>sum-tail</code>-shaped functions by hand for every single loop.</p>
        <div className="exercise">
          <h5>Exercise 2.3</h5>
          <ol>
            <li>Write <code>deep-sum</code>, recursively summing every number in a list that may itself contain nested lists of numbers — <code>(deep-sum (list 1 (list 2 3) (list (list 4 5) 6)))</code> should give <code>21</code>.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 2.3 — open after trying</summary>
          <pre><code>{"(define (deep-sum xs)\n  (cond\n    [(empty? xs) 0]\n    [(list? (first xs)) (+ (deep-sum (first xs)) (deep-sum (rest xs)))]\n    [else (+ (first xs) (deep-sum (rest xs)))]))"}</code></pre>
          <p>Two separate recursive calls happen in the middle clause — one descending into the nested list, one continuing across the rest of the current list — which is the general shape any function walking a tree-of-lists rather than a flat list needs: recursion on the "down" direction and recursion on the "across" direction are genuinely two different calls, not one.</p>
        </details>
        <h3>2.4 <code>match</code>: pattern matching over any shape</h3>
        <pre><code>{"(define (describe v)\n  (match v\n    [(list a b) (format \"pair: ~a and ~a\" a b)]\n    [(? string?) \"a string\"]\n    [(? number? n) #:when (negative? n) \"a negative number\"]\n    [(? number?) \"a number\"]\n    [_ \"something else\"]))\n"}</code></pre>
        <pre className="plain"><code>{"> (describe (list 1 2))\n\"pair: 1 and 2\"\n> (describe \"hi\")\n\"a string\"\n> (describe -5)\n\"a negative number\"\n> (describe 5)\n\"a number\"\n"}</code></pre>
        <p><code>match</code> is Racket's general-purpose destructuring and dispatch tool, playing the same role Erlang's function clauses and guards played in Course 4 — a list shape, a predicate (<code>(? string?)</code>), a predicate with a bound name and a guard clause, and a wildcard, tried top to bottom. Milestone 3 extends this to match on <code>struct</code> shapes directly, and Milestone 4's interpreter is built almost entirely out of one large <code>match</code> over AST node types.</p>
        <div className="warn">
          <h5>A common mistake: assuming <code>match</code> is automatically total</h5>
          <p><code>describe</code> above, exactly as written, has no wildcard clause — every case is a specific shape or predicate, and nothing says "anything else." Hand it a value none of those four clauses recognises and it fails at run time, not at compile time, with no indication in advance from <code>match</code> itself that a case was left uncovered:</p>
          <pre className="plain"><code>{"> (describe 42)\nmatch: no matching clause for 42\n"}</code></pre>
          <p>worth treating as a genuine design decision rather than an oversight to always fix the same way: a trailing <code>[_ "something else"]</code> clause is right when "anything else" has one sensible answer, and leaving it out deliberately is right when reaching this <code>match</code> with an unrecognised value at all is itself a bug you want surfaced immediately — the same judgement call Milestone 4's <code>eval-expr</code> makes, on purpose, by having no wildcard clause either.</p>
        </div>
        <h3>2.5 Structs</h3>
        <pre><code>{"(struct point (x y) #:transparent)\n\n(define p (point 3 4))\n(point-x p)          ; 3\n(point? p)            ; #t\n(struct-copy point p [x 10])   ; point with x replaced, y unchanged\n"}</code></pre>
        <p><code>struct</code> declares a new data type with named fields, a constructor (<code>point</code> itself, callable), automatic accessors (<code>point-x</code>, <code>point-y</code>), and a predicate (<code>point?</code>) — all generated from one declaration, the same convenience Erlang's maps and Go's structs each provide differently. <code>#:transparent</code> matters specifically for this course: without it, two structurally-identical struct instances print opaquely and are not <code>equal?</code> to each other by value, which makes testing (Section 1's <code>check-equal?</code>) and debugging output far less useful — every struct in this course's own code is transparent unless there is a specific reason to hide its contents.</p>
        <div className="exercise">
          <h5>Exercise 2.5</h5>
          <ol>
            <li>Write <code>midpoint</code>, taking two <code>point</code>s and returning the <code>point</code> halfway between them — <code>(midpoint (point 0 0) (point 4 6))</code> should give a point equal, by <code>equal?</code>, to <code>(point 2 3)</code>.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 2.5 — open after trying</summary>
          <pre><code>{"(define (midpoint p1 p2)\n  (point (/ (+ (point-x p1) (point-x p2)) 2)\n         (/ (+ (point-y p1) (point-y p2)) 2)))"}</code></pre>
          <p><code>(equal? (midpoint (point 0 0) (point 4 6)) (point 2 3))</code> is <code>#t</code> precisely because <code>point</code> is <code>#:transparent</code> — two separately constructed <code>point</code>s with the same field values are <code>equal?</code> to each other, which is exactly what makes a test like this one meaningful to write at all rather than needing a field-by-field comparison.</p>
        </details>
        <h3>2.6 Contracts: specifications the runtime checks for you</h3>
        <pre><code>{"#lang racket\n(provide (contract-out\n  [account-balance (-> account? real?)]\n  [withdraw (-> account? (and/c real? positive?) account?)]))\n"}</code></pre>
        <pre className="plain"><code>{"> (withdraw checking -50)\nwithdraw: contract violation\n  expected: a number strictly greater than 0\n  given: -50\n  in: the 2nd argument of\n      (-> account? (and/c real? positive?) account?)\n  contract from: (module account)\n  blaming: (module account)\n   (assuming the contract is correct)\n  at: account.rkt:7:5\n"}</code></pre>
        <p>A contract on <code>provide</code> is an executable specification, checked automatically at the module boundary every time an outside caller uses the function — not a comment describing what should be true, a runtime check that catches exactly the class of "I called this with the wrong kind of value" bug. Notice how much of the report is about <em>where responsibility lies</em>, not just what went wrong: <code>expected</code> is stated in plain English rather than echoing the contract expression verbatim (<code>and/c real? positive?</code> becomes "a number strictly greater than 0"), and <code>blaming</code> names which module's code is at fault for the violation — for a contract this simple the caller is obviously to blame, but for a contract built from several composed pieces across several modules, knowing exactly which one to blame is often the entire value of the error message.</p>
        <div className="cmp">
          <h5>A typical language vs. Racket</h5>
          <p>JavaScript has no contract system at all — a function that requires a positive number either checks by hand with an <code>if</code> and throws, or, with TypeScript layered on top, gets a type annotation that is completely erased by the time the code actually runs, so a <code>-50</code> arriving from a JSON response or an <code>any</code>-typed boundary is caught nowhere at run time. C++ gets closer with <code>assert()</code>, but an assertion only reports that something failed and where — it cannot name which <em>module's</em> code is to blame, because C++ has no module boundary a contract could attach to in the first place. Racket's contracts sit deliberately in between: checked automatically, every single call, but only at the specific boundary where trust between two separately-authored pieces of code needs verifying — which is also the honest cost worth stating plainly: that per-call check is real run-time overhead a TypeScript annotation, erased at compile time, never pays at all.</p>
        </div>
        <div className="warn">
          <h5>A common mistake: assuming a contract protects a function's every caller</h5>
          <p>A <code>contract-out</code> contract only checks calls that cross the <em>module boundary</em> — an internal helper inside the same module that calls the contracted function directly bypasses the check entirely, because internal calls, by design, never touch <code>provide</code> at all:</p>
          <pre className="plain"><code>{";; acct.rkt\n(define (withdraw balance amt) (- balance amt))\n(define (withdraw-unchecked balance amt) (withdraw balance amt))  ; internal call, no check\n(provide (contract-out [withdraw (-> real? (and/c real? positive?) real?)])\n         withdraw-unchecked)\n"}</code></pre>
          <pre className="plain"><code>{"> (withdraw-unchecked 100 -50)   ; from another module -- contract never fires\n150\n> (withdraw 100 -50)              ; from another module -- contract fires\nwithdraw: contract violation\n  expected: a number strictly greater than 0\n"}</code></pre>
          <p>this is not a bug in <code>contract-out</code> — it is the entire point, stated in Milestone 3's own design section: internal code that already maintains its own invariants should not pay a contract-checking cost for calling itself. But it does mean a contract is not a substitute for validating an argument inside a function that other, uncontracted internal code also calls.</p>
        </div>
        <h3>2.7 A first taste of macros</h3>
        <p>You will not write a real macro until Milestone 5, but the shape is worth seeing once now:</p>
        <pre><code>{"(define-syntax-rule (my-unless condition body)\n  (if condition (void) body))\n\n(my-unless #f (displayln \"this prints\"))\n(my-unless #t (displayln \"this does not\"))\n"}</code></pre>
        <p><code>define-syntax-rule</code> declares a macro by pattern: wherever <code>(my-unless condition body)</code> appears in your code, the compiler replaces it, before your program runs, with <code>(if condition (void) body)</code>, substituting whatever you wrote for <code>condition</code> and <code>body</code>. Compare this to a function: a function receives already- evaluated <em>values</em>; a macro receives un-evaluated <em>syntax</em> and produces more syntax. That distinction — value at run time versus syntax at compile time — is the entire subject of Milestone 5 onward, and Section 2.1's "code is data" is precisely what makes writing the right-hand side of a macro feel like ordinary list manipulation rather than a separate skill.</p>
        <div className="cmp">
          <h5>A typical language vs. Racket</h5>
          <p>C and C++ have macros too — the preprocessor's <code>#define</code> — and it is worth being precise about exactly how different they are from what <code>define-syntax-rule</code> does above, because the word "macro" is doing very different work in each language. A C macro is <strong>textual substitution</strong>, performed by a separate pass before the compiler ever parses the result: <code>#define SQUARE(x) x * x</code> expands <code>SQUARE(a + b)</code> to the literal text <code>a + b * a + b</code>, silently wrong by ordinary operator precedence, because the preprocessor has no idea <code>x</code> was meant to be one self-contained expression — it does not parse C at all, only text. A Racket macro is <strong>syntax-to-syntax</strong>, operating on already-parsed syntax objects that know their own grouping, so <code>(my-unless (+ a b) ...)</code>'s <code>condition</code> is unambiguously the whole <code>(+ a b)</code> expression, never a fragment pasted into the wrong place. This is also exactly where hygiene (Milestone 5) matters: a C macro that introduces a local variable can collide with a caller's identically-named variable with no warning from the language at all, which is precisely the historical folklore "macros are dangerous" comes from — a hazard Racket's macro system was built specifically not to have.</p>
        </div>
        <h3>2.8 Errors and exceptions</h3>
        <pre><code>{"(define (safe-divide a b)\n  (with-handlers ([exn:fail? (lambda (e) (displayln (exn-message e)) #f)])\n    (/ a b)))\n"}</code></pre>
        <pre className="plain"><code>{"> (safe-divide 10 2)\n5\n> (safe-divide 10 0)\n/: division by zero\n#f\n"}</code></pre>
        <p><code>with-handlers</code> is Racket's <code>try</code>/<code>catch</code>, matching an exception predicate (<code>exn:fail?</code> catches ordinary errors; more specific predicates exist for narrower cases) to a handler function. <code>error</code> raises one: <code>(error 'my-function "bad input: ~a" val)</code> — the leading symbol names the raising context, which shows up in the message exactly as <code>eval-expr</code> did in the interpreter you will build in Milestone 4.</p>
        <div className="exercise">
          <h5>Exercise 2.8</h5>
          <ol>
            <li>Write <code>safe-first</code>, taking a list and a default value, returning the list's first element normally but the default instead of raising when the list is empty — <code>(safe-first (list 1 2 3) 'none)</code> should give <code>1</code>, and <code>(safe-first (list) 'none)</code> should give <code>'none</code>, not an error.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 2.8 — open after trying</summary>
          <pre><code>{"(define (safe-first xs default)\n  (with-handlers ([exn:fail? (lambda (e) default)])\n    (first xs)))"}</code></pre>
          <p>Catching <code>exn:fail?</code> here and simply returning <code>default</code> works because <code>first</code> on an empty list already raises exactly that kind of exception — <code>safe-first</code> does not need to check <code>(empty? xs)</code> itself first; it lets <code>first</code>'s own error do the checking and converts the failure into a value instead. This is a real trade-off, not a strictly better approach: checking <code>empty?</code> up front is more explicit about what is being guarded against, while catching the exception is shorter but would just as happily swallow a different, unrelated <code>exn:fail?</code> raised from somewhere else inside a more complex <code>xs</code> expression.</p>
        </details>
        <h3>2.9 Modules, <code>require</code>, and <code>provide</code></h3>
        <pre><code>{";; geometry.rkt\n#lang racket\n(provide point distance)   ;; only these are visible outside this module\n\n(struct point (x y) #:transparent)\n(define (distance p1 p2)\n  (sqrt (+ (sqr (- (point-x p2) (point-x p1)))\n           (sqr (- (point-y p2) (point-y p1))))))\n"}</code></pre>
        <pre><code>{";; main.rkt\n#lang racket\n(require \"geometry.rkt\")\n\n(distance (point 0 0) (point 3 4))   ; 5\n"}</code></pre>
        <p><code>provide</code> is Racket's export list, playing the same role as Erlang's <code>-export</code> or Go's capitalised names — anything not listed is private to the module. <code>(require "geometry.rkt")</code> with a quoted relative path pulls in a local file; <code>(require racket/list)</code> without quotes pulls in an installed collection or package. Every <code>langfac</code> module from Milestone 4 onward follows this shape: a focused module, an explicit, deliberately narrow <code>provide</code> list.</p>
        <h4>Part 2 checkpoint</h4>
        <ol>
          <li>What does quoting a piece of Racket code actually do, precisely?</li>
          <li>Why does <code>#:transparent</code> matter for testing a struct with <code>check-equal?</code>?</li>
          <li>What is the fundamental difference between what a function receives and what a macro receives?</li>
          <li>What does a contract on <code>provide</code> check, and when — at definition time, or at every call from outside the module?</li>
        </ol>
        <h3>What is next</h3>
        <p>
          <img className="mascot-left" src={img2.src} alt="The Mewlang cat, typing at a laptop" width="120" loading="lazy" />
          Milestone 1 turns the shell experiments above into a real <code>langfac</code> project. Milestones 2 and 3 build the data structures and validated boundaries the rest of the toolkit needs. Milestone 4 is where "code is data" stops being a slogan and becomes a working interpreter for a real, if small, language.
        </p>
        <footer className="end">
          <p>Instalment 21 of the five-course curriculum. Next: Racket Milestones 1–4, where the project is scaffolded for real and a small configuration language gets a working interpreter.</p>
        </footer>
         <Link className="button" href="/racket-course/milestones/1-4/">Continue</Link> 
      </div>
    </div>
  );
}
