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
        <h3>2.2 Lists, pairs, and higher-order functions</h3>
        <pre><code>{"> (define xs (list 1 2 3 4 5))\n> (map (lambda (x) (* x x)) xs)\n'(1 4 9 16 25)\n> (filter even? xs)\n'(2 4)\n> (foldl + 0 xs)\n15\n> (cons 0 xs)\n'(0 1 2 3 4 5)\n> (first xs)\n1\n> (rest xs)\n'(2 3 4 5)\n"}</code></pre>
        <p>A Racket list is, underneath, a chain of two-element <strong>pairs</strong> (<code>cons</code> cells) — <code>(cons 0 xs)</code> builds a new pair whose first half is <code>0</code> and whose second half is the existing list <code>xs</code>, and a "list" is precisely a chain of these ending in the empty list <code>'()</code>. <code>map</code>, <code>filter</code> and <code>foldl</code> need no introduction if Course 2's Ruby blocks or Course 1's Go closures are still fresh — the shape (a function, a collection, a new collection or a single accumulated value) is the same idea in a fourth syntax.</p>
        <h3>2.3 Recursion</h3>
        <pre><code>{"(define (sum-list xs)\n  (cond\n    [(empty? xs) 0]\n    [else (+ (first xs) (sum-list (rest xs)))]))\n\n(define (sum-tail xs [acc 0])\n  (cond\n    [(empty? xs) acc]\n    [else (sum-tail (rest xs) (+ acc (first xs)))]))\n"}</code></pre>
        <p><code>[acc 0]</code> in the parameter list is a default argument — <code>(sum-tail xs)</code> and <code>(sum-tail xs 10)</code> are both valid calls. Racket's compiler recognises and optimises tail calls, the same guarantee Erlang's course relied on for unbounded recursion depth, though in ordinary Racket code you will reach for <code>for</code>, <code>for/list</code>, and the higher-order functions from Section 2.2 far more often than hand-written recursion — they exist precisely so you do not have to write <code>sum-tail</code>-shaped functions by hand for every single loop.</p>
        <h3>2.4 <code>match</code>: pattern matching over any shape</h3>
        <pre><code>{"(define (describe v)\n  (match v\n    [(list a b) (format \"pair: ~a and ~a\" a b)]\n    [(? string?) \"a string\"]\n    [(? number? n) #:when (negative? n) \"a negative number\"]\n    [(? number?) \"a number\"]\n    [_ \"something else\"]))\n"}</code></pre>
        <pre className="plain"><code>{"> (describe (list 1 2))\n\"pair: 1 and 2\"\n> (describe \"hi\")\n\"a string\"\n> (describe -5)\n\"a negative number\"\n> (describe 5)\n\"a number\"\n"}</code></pre>
        <p><code>match</code> is Racket's general-purpose destructuring and dispatch tool, playing the same role Erlang's function clauses and guards played in Course 4 — a list shape, a predicate (<code>(? string?)</code>), a predicate with a bound name and a guard clause, and a wildcard, tried top to bottom. Milestone 3 extends this to match on <code>struct</code> shapes directly, and Milestone 4's interpreter is built almost entirely out of one large <code>match</code> over AST node types.</p>
        <h3>2.5 Structs</h3>
        <pre><code>{"(struct point (x y) #:transparent)\n\n(define p (point 3 4))\n(point-x p)          ; 3\n(point? p)            ; #t\n(struct-copy point p [x 10])   ; point with x replaced, y unchanged\n"}</code></pre>
        <p><code>struct</code> declares a new data type with named fields, a constructor (<code>point</code> itself, callable), automatic accessors (<code>point-x</code>, <code>point-y</code>), and a predicate (<code>point?</code>) — all generated from one declaration, the same convenience Erlang's maps and Go's structs each provide differently. <code>#:transparent</code> matters specifically for this course: without it, two structurally-identical struct instances print opaquely and are not <code>equal?</code> to each other by value, which makes testing (Section 1's <code>check-equal?</code>) and debugging output far less useful — every struct in this course's own code is transparent unless there is a specific reason to hide its contents.</p>
        <h3>2.6 Contracts: specifications the runtime checks for you</h3>
        <pre><code>{"#lang racket\n(provide (contract-out\n  [account-balance (-> account? real?)]\n  [withdraw (-> account? (and/c real? positive?) account?)]))\n"}</code></pre>
        <pre className="plain"><code>{"> (withdraw checking -50)\nwithdraw: contract violation\n  expected: a number strictly greater than 0\n  given: -50\n  in: the 2nd argument of\n      (-> account? (and/c real? positive?) account?)\n  contract from: (module account)\n  blaming: (module account)\n   (assuming the contract is correct)\n  at: account.rkt:7:5\n"}</code></pre>
        <p>A contract on <code>provide</code> is an executable specification, checked automatically at the module boundary every time an outside caller uses the function — not a comment describing what should be true, a runtime check that catches exactly the class of "I called this with the wrong kind of value" bug. Notice how much of the report is about <em>where responsibility lies</em>, not just what went wrong: <code>expected</code> is stated in plain English rather than echoing the contract expression verbatim (<code>and/c real? positive?</code> becomes "a number strictly greater than 0"), and <code>blaming</code> names which module's code is at fault for the violation — for a contract this simple the caller is obviously to blame, but for a contract built from several composed pieces across several modules, knowing exactly which one to blame is often the entire value of the error message.</p>
        <h3>2.7 A first taste of macros</h3>
        <p>You will not write a real macro until Milestone 5, but the shape is worth seeing once now:</p>
        <pre><code>{"(define-syntax-rule (my-unless condition body)\n  (if condition (void) body))\n\n(my-unless #f (displayln \"this prints\"))\n(my-unless #t (displayln \"this does not\"))\n"}</code></pre>
        <p><code>define-syntax-rule</code> declares a macro by pattern: wherever <code>(my-unless condition body)</code> appears in your code, the compiler replaces it, before your program runs, with <code>(if condition (void) body)</code>, substituting whatever you wrote for <code>condition</code> and <code>body</code>. Compare this to a function: a function receives already- evaluated <em>values</em>; a macro receives un-evaluated <em>syntax</em> and produces more syntax. That distinction — value at run time versus syntax at compile time — is the entire subject of Milestone 5 onward, and Section 2.1's "code is data" is precisely what makes writing the right-hand side of a macro feel like ordinary list manipulation rather than a separate skill.</p>
        <h3>2.8 Errors and exceptions</h3>
        <pre><code>{"(define (safe-divide a b)\n  (with-handlers ([exn:fail? (lambda (e) (displayln (exn-message e)) #f)])\n    (/ a b)))\n"}</code></pre>
        <pre className="plain"><code>{"> (safe-divide 10 2)\n5\n> (safe-divide 10 0)\n/: division by zero\n#f\n"}</code></pre>
        <p><code>with-handlers</code> is Racket's <code>try</code>/<code>catch</code>, matching an exception predicate (<code>exn:fail?</code> catches ordinary errors; more specific predicates exist for narrower cases) to a handler function. <code>error</code> raises one: <code>(error 'my-function "bad input: ~a" val)</code> — the leading symbol names the raising context, which shows up in the message exactly as <code>eval-expr</code> did in the interpreter you will build in Milestone 4.</p>
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
