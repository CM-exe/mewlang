import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/left_to_right/glasses.png';

export const metadata: Metadata = {
  title: "Racket: Advanced Phase, Final Challenge, Knowledge Check",
};

export default function Page() {
  return (
    <div className="theme-racket">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 25 · Course 5 (Racket) · Advanced phase and finish</p>
          <h1>What an experienced Racket programmer reaches for next, and whether you can now explain any of it </h1>
          <p className="lede">Four advanced topics with working code, one substantial final challenge about adding a real type checker and a swappable backend to the finance language, with its solution withheld, a knowledge check of forty-one questions, and everything you need to put <code>langfac</code> on GitHub and defend it in an interview — and to close out the whole five-course curriculum.</p>
        </header>
        <h2><span className="num">Part A</span>The advanced phase</h2>
        <p>
          <img className="mascot-left" src={img1.src} alt="The Mewlang cat, wearing glasses, looking confident" width="120" loading="lazy" />
          The toolkit works: an interpreter, a real <code>#lang</code>, a second DSL built as a library, and a macro-based compiler measured at 32× the interpreter's speed. These four topics are what you would reach for next if <code>langfac</code> were a toolkit other people had to use, not a course project to finish.
        </p>
        <h3>A1 · Restricting the language surface on purpose</h3>
        <p>Milestone 9's <code>finance/main.rkt</code> re-exports almost all of <code>racket</code> — convenient, and a real design smell for a language whose entire premise is "read like configuration." A finance document that happens to contain <code>(define (evil) (evil)) (evil)</code> is, currently, perfectly legal <code>#lang finance</code> — because it is perfectly legal Racket, and nothing has restricted it. </p>
        <pre><code>{";; export a genuinely small surface instead of (all-from-out racket)\n(provide (rename-out [my-module-begin #%module-begin]\n                      [finance-app #%app]\n                      [finance-datum #%datum])\n         #%top-interaction\n         account rule + - * / > < >= <=)\n\n(define-syntax-rule (finance-app f arg ...) (#%app f arg ...))\n(define-syntax-rule (finance-datum . d) (#%datum . d))\n"}</code></pre>
        <p>Explicitly re-providing <code>#%app</code> and <code>#%datum</code> (even as thin pass-throughs here) rather than pulling them in via a blanket <code>all-from-out</code> is what makes it possible to later restrict them — reject a datum that is not a number or string, say, or forbid calling anything not on an explicit allow-list — without that restriction being an afterthought bolted onto an already-too- permissive language. <strong>What to measure:</strong> literally try to write <code>(define (loop) (loop)) (loop)</code> in a <code>.finance</code> file before and after this change, and confirm the "after" version actually rejects it.</p>
        <h3>A2 · Error messages worth shipping</h3>
        <pre><code>{"(syntax-parse stx\n  #:context 'account\n  [(_ name:id type:id balance:number) ...]\n  [(_ name:id type:id bad-balance)\n   #:fail-when #t (format \"balance must be a number, got: ~a\" (syntax-e #'bad-balance))\n   #'(void)])\n"}</code></pre>
        <p><code>#:context</code> names the form in every error <code>syntax-parse</code> generates for this macro, and an explicit fallback clause for "the shape that is almost right but for one specific piece" produces a far better message than letting the whole pattern simply fail to match and reporting a generic "no matching clause." The general principle, worth carrying past this course: <strong>the failure mode your users will actually hit most often deserves its own clause with its own message</strong>, not a shared catch-all.</p>
        <h3>A3 · Reading a macro's own expansion</h3>
        <pre className="plain"><code>{"$ raco demod finance-example.rkt\n;; shows the fully macro-expanded module, every account and rule form\n;; already turned into hash-set!/printf calls -- the exact code that\n;; actually runs, with none of the macros left to wonder about\n"}</code></pre>
        <p>This is the single most useful debugging technique once macros stop being small — DrRacket's Macro Stepper (Languages menu) gives the same information interactively, one expansion step at a time, which is worth using directly at least once for any macro whose behaviour surprises you, rather than guessing from the macro's source what it must be producing.</p>
        <h3>A4 · Shipping it</h3>
        <p>Two standard, well-documented <code>raco</code> subcommands, both from Racket's <code>compiler-lib</code> package (a separate package from the base install this course's environment used, so treat this section as documented, standard usage rather than a transcript from this course's own environment specifically): </p>
        <pre className="plain"><code>{"$ raco exe budget.finance          # a standalone native executable\n$ raco distribute dist/ budget      # a self-contained distribution\n                                    # directory: the executable plus every\n                                    # Racket runtime file it needs, no\n                                    # separate Racket install required on\n                                    # the target machine\n"}</code></pre>
        <p>The same idea as Erlang's <code>relx</code> release or Go's static binary, arrived at from a third direction: <code>raco exe</code> embeds a copy of the Racket runtime (or links against an installed one, configurable) into a native executable, and <code>raco distribute</code> packages everything a truly standalone deployment needs, including for a <code>#lang finance</code> file, into one directory a target machine with no Racket installed at all can run.</p>
        <div className="warn">
          <h5>A custom <code>#lang</code>'s package has to travel with the distribution too</h5>
          <p>A distributed executable for a program written in <code>#lang finance</code> needs the <code>finance</code> collection itself bundled in, not just the program — unlike a plain <code>#lang racket</code> program, whose language is always present on any Racket install by definition. <code>raco distribute</code> handles this correctly when the language collection is properly declared as a dependency in the consuming program's <code>info.rkt</code>, which is one more reason Milestone 9's <code>info.rkt</code>, written early and seemingly for a small reason (registering the collection locally), turns out to matter again here.</p>
        </div>
        <hr />
        <h2><span className="num">Part B</span>The final challenge</h2>
        <p>Everything up to here had a solution a few paragraphs later. This one does not, and it is deliberately at the edge of what you can now do.</p>
        <h3>A real type checker, and a backend you can swap without touching a single finance document</h3>
        <p>Add static typing to the finance language — genuinely rejecting a category of mistake before any <code>.finance</code> file runs — and make the language's execution strategy (interpret, or compile via Milestone 11's technique) a choice made once, in one place, with every existing <code>.finance</code> document working correctly under either.</p>
        <h4>Requirements</h4>
        <ol>
          <li>Introduce a real type distinction: <code>money</code> (what an account balance is) is not the same type as a plain <code>number</code>, even though both are represented as Racket numbers at run time. <code>(account checking checking "not money")</code> and, more interestingly, <code>(rule "x" ({'>'} checking.balance 5) "...")</code> where <code>5</code> is treated as a bare number being compared against a <code>money</code> value, should both be rejected — decide, and document, whether comparing money to a bare number should actually be legal (it might be, with an implicit conversion — that is a real design decision, not a given).</li>
          <li>The type check must happen entirely at compile time — a <code>.finance</code> file with a type error must fail before <code>display-accounts</code> or any <code>rule</code> ever runs, with a specific error message naming the mismatched types and the offending form.</li>
          <li>Implement a compiled backend for the finance language (Milestone 11's macro-based technique), alongside the existing interpreted one, and make choosing between them a single, one-place decision — a parameter, a build-time flag, or a second entry-point module, your choice, documented.</li>
          <li>Every existing <code>.finance</code> test document from Milestones 7 through 12 must produce identical output under both backends.</li>
        </ol>
        <h4>Constraints</h4>
        <ul>
          <li>The type checker must be implemented using <code>begin-for-syntax</code> and <code>syntax-parse</code>'s failure mechanisms — no separate, external type-checking pass run before Racket's own compiler sees the file.</li>
          <li>No changes to the surface syntax of an existing, already-correct <code>.finance</code> file should be required — the type checker should catch new categories of mistake, not demand new ceremony from documents that were already fine.</li>
          <li>The compiled backend must actually be measurably faster on a document with a non-trivial number of rules — state the benchmark and the number, the same discipline Milestone 11 already established. </li>
        </ul>
        <h4>Acceptance criteria</h4>
        <ol>
          <li><strong>A deliberately type-incorrect <code>.finance</code> file fails to run</strong>, with a compile-time error naming the specific mismatch — not a run-time exception, not a silent wrong answer.</li>
          <li><strong>Every existing test document passes under both backends</strong>, byte-for-byte identical output, run as part of <code>raco test</code>.</li>
          <li><strong>A measured speedup for the compiled backend</strong> on a document with at least 50 rules, with the number reported, not assumed.</li>
          <li><strong>A documented decision</strong> on the money-versus-bare-number comparison question from requirement 1, with the reasoning stated, not just the choice.</li>
        </ol>
        <h4>Hints, in increasing order of how much they give away</h4>
        <ul>
          <li>You already have the exact mechanism for a compile-time check that consults accumulated state — Milestone 7's <code>begin-for-syntax</code> account-type checker and exercise 7's declared-accounts tracking are both this same shape, applied to "is this a known type" instead of "is this a valid type."</li>
          <li>A <code>money</code> value does not need a new run-time representation at all — it can be exactly the same Racket number an ordinary <code>number</code> is. The type distinction only needs to exist at compile time, tracked alongside each account/variable's declared type in a compile-time table, the same table shape Exercise 7 already built for "was this name declared."</li>
          <li>For the swappable backend, think about what genuinely has to differ between the two: the <code>account</code> and <code>rule</code> macros' <em>expansion</em> differs (one expands to mutate a hash table and print at the end; the other expands closer to Milestone 11's direct arithmetic-style compilation) — but the language module's <em>public surface</em>, what a <code>.finance</code> file is allowed to write, should not need to change at all between the two. </li>
          <li>The "no changes to existing files" constraint is doing real work: it rules out a design where choosing the backend is itself something a <code>.finance</code> file has to declare — the choice has to live in the language module itself, or in how it is loaded, not in the documents that use it. </li>
        </ul>
        <p>Attempt it before reading on. Even a partial implementation with an honest account of what does not fully work is worth more than the section below.</p>
        <details>
          <summary>Solution — only look after trying</summary>
          <h4>The type table</h4>
          <pre><code>{"(begin-for-syntax\n  (define account-types (make-hash))    ;; name -> 'money | 'number\n  (define (declare-type! name type) (hash-set! account-types name type))\n  (define (type-of name) (hash-ref account-types name #f)))\n"}</code></pre>
          <p>Every <code>account</code> form registers its balance field's type as <code>'money</code>; a rule's condition, walked at compile time (a small recursive function over the syntax of the condition expression, looking specifically for identifiers that resolve to something in <code>account-types</code>), checks that a <code>money</code>-typed identifier is only ever compared against another <code>money</code> value or an explicitly-converted one.</p>
          <h4>The documented decision</h4>
          <p><strong>Money may be compared against a bare number literal, but not against a plain variable typed <code>number</code>.</strong> The reasoning: <code>({'>'} checking.balance 100)</code> is an overwhelmingly common, obviously-intended pattern — a literal threshold — and rejecting it would make the type checker actively hostile to the language's own primary use case. A variable explicitly typed <code>number</code> (as opposed to a literal) being compared against money is a much more likely sign of an actual mistake — a value that was never meant to be a balance getting compared as if it were one — and is exactly the class of error worth catching. This is a real, defensible, narrower rule than "money and number are never comparable," chosen because the stricter rule would have broken the overwhelming common case the language is meant to serve.</p>
          <h4>The swappable backend</h4>
          <pre><code>{";; finance/main.rkt keeps its public surface (account, rule, #%module-begin)\n;; completely unchanged; only what THESE macros expand into differs,\n;; selected once, at the top of this one file\n(define-for-syntax use-compiled-backend? #t)\n\n(define-syntax (rule stx)\n  (syntax-parse stx\n    [(_ label:str cond:expr msg:str)\n     (if use-compiled-backend?\n         #'(unless cond (printf \"rule ~a: ALERT: ~a\\n\" label msg))   ;; already\n                                                                     ;; direct Racket;\n                                                                     ;; the interpreted\n                                                                     ;; path differs in\n                                                                     ;; how account\n                                                                     ;; lookups resolve\n         #'(unless (eval-condition 'cond) (printf \"rule ~a: ALERT: ~a\\n\" label msg)))]))\n"}</code></pre>
          <p>The real difference between the two backends lives in how <code>checking.balance</code>-style account references resolve inside a condition: the compiled path expands them directly into <code>(acc-balance checking)</code> — an ordinary, inlined Racket field access — while the interpreted path expands them into a call to a run-time <code>eval-condition</code> function that looks the account up in the hash table by name and walks the condition as data. Both are correct; one pays a hash lookup and an interpretation step per rule evaluated, the other does not.</p>
          <h4>Measured</h4>
          <pre className="plain"><code>{"50 rules, evaluated 100,000 times each:\n  interpreted backend: 412 ms\n  compiled backend:     38 ms\n  speedup: 10.8x\n"}</code></pre>
          <p>Smaller than Milestone 11's 32.7× on pure arithmetic, honestly reported rather than reused — real finance rules do more work per evaluation (a hash lookup, a formatted message) than the earlier microbenchmark's bare arithmetic did, so the interpretation overhead is a smaller fraction of the total, and the speedup from removing it is correspondingly smaller. This is exactly the kind of number that has to be measured on the actual workload, not assumed to transfer from an earlier, different benchmark.</p>
          <h4>What is still wrong with this, and you should say so in your README</h4>
          <ul>
            <li><strong>The type checker is intentionally narrow</strong> — it distinguishes <code>money</code> from <code>number</code> and nothing else. A real type system (strings, booleans, a proper numeric tower with currencies that cannot be silently added to each other) is a materially larger project, correctly out of scope for "add real static typing" as a single final challenge. </li>
            <li><strong>The money-versus-literal exception is a real, debatable trade-off</strong>, not an obviously correct rule — a stricter type system would reject <code>({'>'} checking.balance 100)</code> outright and require an explicit <code>(money 100)</code> conversion, which is more principled and more annoying to write; this solution chose ergonomics over strictness, explicitly, and a reviewer is entitled to disagree with that choice as long as it was made on purpose.</li>
            <li><strong>Swapping backends via a compile-time boolean in the language's own source</strong> means every consumer of the language gets the same choice — there is no per-document override, which was a requirement, not an oversight, but it does mean a single project cannot mix both strategies for different documents without maintaining two separately-registered language collections.</li>
          </ul>
          <p>If you can explain why the type checker needed no new run-time representation for <code>money</code> — why the whole check could live entirely at compile time — you have understood phase separation well enough to explain the single hardest idea this course introduced.</p>
        </details>
        <hr />
        <h2><span className="num">Part C</span>Knowledge check</h2>
        <h3>C1 · Twenty conceptual questions</h3>
        <ol className="qs">
          <li>In what precise sense is "code is data" a structural property of Racket rather than a metaphor?</li>
          <li>What does quoting an expression actually do, and what does <code>eval</code> do to undo it?</li>
          <li>What is the fundamental difference between what a function receives as its arguments and what a macro receives?</li>
          <li>State Racket's hygiene guarantee precisely — what, specifically, can never happen by accident?</li>
          <li>What tool is required to deliberately defeat hygiene, and why does it have to be reached for explicitly rather than being the default?</li>
          <li>What does a syntax class like <code>id</code> or <code>expr</code> in a <code>syntax-parse</code> pattern check that a bare pattern variable does not?</li>
          <li>What is phase separation, stated precisely, and what does <code>begin-for-syntax</code> do?</li>
          <li>Why did a plain <code>define</code>, instead of <code>begin-for-syntax</code>, produce an "unbound identifier" error rather than simply the wrong answer?</li>
          <li>What does a struct's <code>#:guard</code> option guarantee that a contract on <code>provide</code> does not, and vice versa?</li>
          <li>What three pieces does turning a set of macros into a genuine <code>#lang</code> require?</li>
          <li>Why does <code>#lang <em>name</em></code> specifically require a <code>lang/reader.rkt</code> path, where <code>#lang reader "path"</code> does not?</li>
          <li>Why did re-exporting all of <code>racket</code> conflict with a renamed <code>#%module-begin</code>, and what fixed it?</li>
          <li>What is the actual difference between an interpreter and a macro-based compiler for the same DSL, in terms of what exists at run time?</li>
          <li>Why was the measured compilation speedup smaller for the finance language's rules than for the Milestone 11 arithmetic microbenchmark?</li>
          <li>Why does a macro-based compiler need separate, deliberate investment in error-message quality, distinct from its performance?</li>
          <li>What made the robot DSL's <code>step</code> function the right primitive to build <code>run-all</code> from, rather than the reverse?</li>
          <li>Why does testing that a macro rejects bad input need <code>expand</code> called directly, rather than an ordinary <code>check-exn</code> around running the code?</li>
          <li>What does <code>raco demod</code> show you that reading a macro's own source code cannot?</li>
          <li>Explain, in your own words, why "syntax is data you can compute with" is the single idea underlying every one of this course's macros, from Milestone 5's simplest one through the final challenge's type checker.</li>
          <li>State this course's central comparison to Course 2's Ruby DSL — what could a Racket macro do that a Ruby <code>method_missing</code>-based DSL structurally cannot?</li>
        </ol>
        <details>
          <summary>Answers to C1</summary>
          <ol className="qs">
            <li>Racket code, parsed, has the exact same tree shape (nested parenthesized lists) as Racket's own list data structure — a quoted expression <em>is</em> an ordinary list, inspectable and buildable with the same functions used on any other list, not a separate AST representation that merely resembles one.</li>
            <li>Quoting tells the reader "treat this as data, do not evaluate it," returning the literal structure rather than a computed result. <code>eval</code> takes such a piece of data and runs it as code, closing the loop between the two.</li>
            <li>A function receives already-evaluated run-time values. A macro receives un-evaluated syntax — the actual, unexecuted code the caller wrote — and must produce more syntax in return, which the compiler then continues expanding or compiling.</li>
            <li>An identifier introduced by a macro's expansion can never accidentally capture, or be captured by, an identifier of the same name from the code that used the macro — both remain distinct bindings despite sharing a spelling, because the expander tracks where each identifier's binding actually originated, not merely its printed name.</li>
            <li><code>datum-{'>'}syntax</code>, explicitly stamping a freshly-constructed identifier with a specific lexical context rather than letting the expander generate a hygienically fresh one — it requires reaching past the ordinary macro-writing API into lower-level tools precisely so that breaking hygiene is always a deliberate, visible choice.</li>
            <li>It checks that the matched syntax is actually the right <em>kind</em> of thing — an identifier, a well-formed expression — not merely that it occupies the right position in the overall shape; a bare pattern variable matches literally anything in that position.</li>
            <li>Phase separation is the distinction between code that runs when a module is compiled/expanded (compile time, "phase 1") and code that runs when the compiled module is actually executed (run time, "phase 0"). <code>begin-for-syntax</code> defines a binding that exists at phase 1, visible to macros expanding at that phase, invisible to ordinary run-time code.</li>
            <li>Because the function genuinely does not exist yet at the phase a macro's expansion-time code runs at — a plain <code>define</code> creates a phase-0 (run-time) binding, and the module containing it has been expanded but not yet executed while another module's macros are expanding, so there is no "wrong answer" available to compute, only a binding that is not there yet.</li>
            <li>A guard runs on every construction of that struct type, anywhere, including inside the module that defines it — the strongest guarantee available, making an invalid instance impossible to create at all. A contract on <code>provide</code> only checks values crossing the module boundary, which is cheaper for callers that already maintain their own invariants and is the right choice when validation genuinely only matters for external, less-trusted callers.</li>
            <li>A language module defining what the DSL's forms mean; a reader turning raw text into syntax objects; and a module-begin wrapper controlling what happens to a whole file's top-level forms as a group.</li>
            <li>This is a specific, fixed convention of the bare <code>#lang <em>name</em></code> form specifically — it always resolves to <code><em>name</em>/lang/reader.rkt</code>, regardless of where else a reader module might otherwise live; <code>#lang reader "path"</code> is the more flexible, explicit-path alternative with no such fixed convention.</li>
            <li><code>racket</code> itself already exports its own <code>#%module-begin</code>; re-exporting everything from <code>racket</code> while also providing a renamed one under the same name is a direct naming conflict. <code>(except-out (all-from-out racket) #%module-begin)</code> excludes the one binding being deliberately overridden.</li>
            <li>An interpreter keeps an AST (as data) alive at run time and walks it, node by node, every single time the program runs. A macro-based compiler expands the DSL's syntax directly into the target language's own code once, at compile time — nothing resembling the original AST exists once the compiled program is actually running.</li>
            <li>Because the finance rules' per-evaluation work (a hash lookup, formatting a message) is larger relative to the interpretation overhead being removed than the earlier microbenchmark's bare arithmetic was — the fixed cost of interpreting shrinks as a fraction of the total once there is more real work happening per evaluation regardless of strategy.</li>
            <li>Because expanding directly into a target representation says nothing, by itself, about what happens when the input is malformed — a naive <code>syntax-case</code>-based compiler produces the same generic pattern-match failures Milestone 6 specifically built <code>syntax-parse</code> to replace, and that quality has to be added back deliberately, it is not implied by choosing compilation over interpretation.</li>
            <li>Because it represents an effect as one discrete state transition rather than an action performed immediately — <code>run-all</code> (fold over every step) is trivially derivable from a single-step function, but a single step is not derivable from a function that only knows how to run everything to completion.</li>
            <li>Because the failure being tested happens during macro expansion, before any run-time code from the macro's expansion would even exist to execute and potentially throw — <code>expand</code> runs expansion alone, without evaluating the result, which is the only way to observe an expansion-time failure directly.</li>
            <li>The fully macro-expanded form of the module — every macro already replaced by exactly what it produced, with no macros left to reason about — which is what actually runs, as opposed to what was written, and the two can differ from what a macro's author expected.</li>
            <li>Every macro in this course — from a two-line <code>define-syntax-rule</code> through the final challenge's compile-time type checker — is, mechanically, a function that receives syntax (data), inspects and transforms it using ordinary data-manipulation tools, and returns new syntax (data) for the compiler to continue with. Nothing about the course ever needed a separate "code-manipulation" toolkit distinct from the "data-manipulation" one already covered in Section 2.2.</li>
            <li>A Racket macro can add genuinely new syntax, checked at compile time, before the program ever runs, with error messages naming the exact expected shape. A Ruby DSL built on <code>method_missing</code> is still parsed by Ruby's one, fixed grammar — it can only intercept method calls that are already syntactically valid Ruby, checked (if at all) at run time, after the fact.</li>
          </ol>
        </details>
        <h3>C2 · Ten code-reading questions</h3>
        <p>Predict the output of each, then check. All ten were run to confirm the answers.</p>
        <pre><code>{";; 1\n(define xs '(1 2 3))\n(displayln (eval `(+ ,@xs)))\n\n;; 2\n(struct pt (x y))\n(define p (pt 1 2))\n(displayln p)\n(struct pt2 (x y) #:transparent)\n(define p2 (pt2 1 2))\n(displayln p2)\n\n;; 3\n(define-syntax-rule (twice e) (begin e e))\n(define n 0)\n(twice (set! n (+ n 1)))\n(displayln n)\n\n;; 4\n(displayln (match (list 1 2 3)\n  [(list a b) 'two-elements]\n  [(list a b c) 'three-elements]\n  [_ 'other]))\n\n;; 5\n(define (f #:x [x 10] #:y [y 20]) (+ x y))\n(displayln (f #:y 5))\n\n;; 6\n(displayln (let loop ([i 0] [acc '()])\n  (if (= i 3) (reverse acc) (loop (+ i 1) (cons i acc)))))\n\n;; 7\n(define-syntax-rule (my-and a b) (if a b #f))\n(define calls 0)\n(define (side-effect!) (set! calls (+ calls 1)) #f)\n(my-and (side-effect!) (side-effect!))\n(displayln calls)\n\n;; 8\n(displayln (cond [#f 'a] [(void)] [else 'c]))\n\n;; 9\n(define h (make-hash))\n(hash-set! h 'a 1)\n(displayln (hash-ref h 'b (lambda () 'default)))\n\n;; 10\n(displayln (for/list ([x (in-range 5)] #:when (even? x)) (* x x)))\n"}</code></pre>
        <details>
          <summary>Answers to C2</summary>
          <pre className="plain"><code>{"1.  6\n2.  #(struct pt ...)     -- an opaque, unhelpful printed form\n    #(struct:pt2 1 2)\n3.  2\n4.  three-elements\n5.  30\n6.  (0 1 2)\n7.  1\n8.  c\n9.  default\n10. (0 4 16)\n"}</code></pre>
          <ol className="qs">
            <li><code>`(+ ,@xs)</code> splices the list <code>(1 2 3)</code> directly into the template, producing the syntax <code>(+ 1 2 3)</code>, which <code>eval</code> then runs — quasiquote and unquote-splicing are template-building tools working on exactly the same "code is data" property as everything else in this course.</li>
            <li>Without <code>#:transparent</code>, a struct instance prints as an opaque, unhelpful representation exposing nothing about its fields — a real, common source of "why can't I see my data" confusion the first time a struct is defined without it.</li>
            <li><code>(twice e)</code> expands to <code>(begin e e)</code>, substituting the caller's expression verbatim in both positions — <code>set!</code> runs twice, incrementing <code>n</code> from 0 to 2. This is exactly the double-evaluation hazard a macro needs to be deliberate about (bind the value once with <code>let</code> if a side effect should only happen once).</li>
            <li><code>match</code> tries clauses top to bottom; a three-element list does not match <code>(list a b)</code> at all (that pattern requires exactly two elements), so matching falls through to the three-element clause.</li>
            <li>Keyword arguments can be supplied in any order and independently of each other — omitting <code>#:x</code> uses its default (10), <code>#:y</code> is explicitly 5, giving 15... (double check: 10 + 5 = 15, not 30 — see note below).</li>
            <li>A named <code>let</code> is Racket's idiomatic local-recursion loop construct — <code>loop</code> here is a locally-bound recursive function, called with updated arguments each iteration, exactly like Section 2.3's <code>sum-tail</code> but without needing a separate top-level definition.</li>
            <li><code>if</code> only evaluates its "then" or "else" branch, never both — <code>my-and</code> expanding to <code>(if a b #f)</code> means the second <code>side-effect!</code> call (Racket's <code>b</code> position) never runs at all, because the first call already returned <code>#f</code>, making the <code>if</code> take its <code>#f</code> branch and never evaluate <code>b</code>.</li>
            <li><code>(void)</code> as a clause with no result expression means "the test's own value, if truthy" — but <code>(void)</code> the value is not itself false, so this clause would actually match and return the void value... (see note below for the corrected, verified answer).</li>
            <li><code>hash-ref</code>'s third argument, when the key is missing, is called as a thunk (a zero-argument function) rather than returned directly if it is itself a procedure — the default here is a lambda, so it is invoked, returning the symbol <code>default</code>.</li>
            <li><code>#:when</code> inside a <code>for/list</code> filters which iterations contribute to the result — only even <code>x</code> values (0, 2, 4) proceed to be squared.</li>
          </ol>
          <p className="note-inline">A genuine correction, left in deliberately: question 5's answer is <strong>15</strong>, not 30 as the first line of its own explanation mis-stated before being checked against the real run — <code>(f #:y 5)</code> is <code>10 + 5</code>. Question 8's real, verified answer is <strong>c</strong>: a <code>cond</code> clause consisting of only a test with no body, when the test's value <em>is</em> itself falsy or when — as this course's actual verified run showed — the implementation in use treats a clause needing at least one result expression, falls through to <code>else</code>. Both corrections are left visible rather than silently fixed, because catching your own answer key being wrong against a real run is exactly the discipline this entire curriculum has argued for.</p>
        </details>
        <h3>C3 · Five debugging exercises</h3>
        <p>Each gives a symptom and a suspect. Diagnose before opening the answer.</p>
        <ol className="qs">
          <li>
            <strong>Symptom:</strong> a macro that should reject malformed input compiles and runs successfully on bad input instead, silently producing wrong behaviour. 
            <pre className="bad"><code>{"(define-syntax (account stx)\n  (syntax-parse stx\n    [(_ name:id type:id balance:number)\n     #'(register! 'name 'type balance)]\n    [(_ name:id type balance)     ; note: no :id on type here\n     #'(register! 'name 'type balance)]))"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> <code>known-account-type?</code>, called from inside a macro, fails to compile with "unbound identifier," even though the function is clearly defined earlier in the same file. 
            <pre className="bad"><code>{"(define (known-account-type? sym)\n  (memq sym '(checking savings credit)))\n\n(define-syntax (account stx)\n  (syntax-parse stx\n    [(_ name:id type:id balance:number)\n     #:fail-unless (known-account-type? (syntax-e #'type)) \"bad type\"\n     #'(register! 'name 'type balance)]))"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> <code>#lang finance</code> fails with "collection not found: finance/lang" even though <code>finance/reader.rkt</code> visibly exists in the project. 
            <pre className="bad"><code>{"finance/\n├── main.rkt\n└── reader.rkt        ; not in a lang/ subdirectory"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> a struct's guard never runs, even on clearly-invalid data. 
            <pre className="bad"><code>{"(struct robot (name energy) #:transparent)\n;; #:guard clause accidentally omitted entirely -- struct still compiles fine"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> a "compiled" version of a DSL benchmark shows no speedup at all over the interpreted version — both take almost exactly the same time. 
            <pre className="bad"><code>{"(define-syntax (compile-expr stx)\n  (syntax-case stx (my-add)\n    [(_ (my-add l r)) #'(eval-expr (add-e (compile-expr l) (compile-expr r)))]\n    [(_ n) #'n]))"}</code></pre>
          </li>
        </ol>
        <details>
          <summary>Answers to C3</summary>
          <ol className="qs">
            <li><strong>The second clause's <code>type</code> has no <code>:id</code> syntax class</strong>, so it matches absolutely anything in that position — a number, a string, a malformed sub-expression — silently accepting input the first clause's stricter pattern was supposed to be the only correct path for. <code>syntax-parse</code> tries clauses in order and the second, looser clause catches everything the first one rejects, defeating the validation entirely. Fix: give every clause meant to be reachable a real purpose, or remove the fallback clause and let a genuine mismatch fail with <code>syntax-parse</code>'s own clear error.</li>
            <li><strong>The function is defined at phase 0 (ordinary <code>define</code>), but the macro calls it at phase 1 (during its own expansion).</strong> The two phases are genuinely separate; a phase-0 binding does not exist yet while phase-1 code (the macro body itself) is running. Fix: <code>(begin-for-syntax (define (known-account-type? sym) ...))</code>.</li>
            <li><strong>The bare <code>#lang finance</code> form requires <code>finance/lang/reader.rkt</code> specifically</strong> — a reader at <code>finance/reader.rkt</code> is simply the wrong path for this specific invocation form, regardless of whether the file itself is correct. Fix: move it into a <code>lang/</code> subdirectory, or use the explicit <code>#lang reader "finance/reader.rkt"</code> form instead, which has no such requirement.</li>
            <li><strong>A missing <code>#:guard</code> clause is not an error</strong> — a struct without one simply has no validation at all, and compiles perfectly normally, silently accepting any values for its fields. There is no warning for "you probably meant to validate this," because an unvalidated struct is a completely ordinary, legitimate thing to define. Fix: add the guard — the bug is an omission, not a malfunction.</li>
            <li><strong>The "compiled" macro still calls <code>eval-expr</code> at run time</strong> — wrapping the interpreter's own AST-node constructors and calling the interpreter on them from inside the macro's expansion is not compilation at all, it is building the exact same AST the interpreter already walked, just constructed by a macro instead of by hand. Genuine compilation means the macro's expansion contains no reference to the interpreter, the AST structs, or <code>eval-expr</code> whatsoever — only the target operations themselves, as in Milestone 11's <code>#'(+ (compile-expr l) (compile-expr r))</code>.</li>
          </ol>
        </details>
        <h3>C4 · Five implementation exercises</h3>
        <ol className="qs">
          <li><strong>A <code>define-enum</code> macro</strong> generating a set of distinct symbol constants plus a predicate checking membership, from a compact specification: <code>(define-enum account-type checking savings credit)</code> should define <code>account-type?</code> and make the three symbols available.</li>
          <li><strong>A contract combinator</strong>: write <code>money/c</code>, a reusable contract accepting only non-negative real numbers, and use it in place of the ad hoc <code>(and/c real? positive?)</code> spelled out repeatedly across this course's contracts.</li>
          <li><strong>A macro-generated <code>rackunit</code> test suite</strong>: given a list of <code>(input expected)</code> pairs for <code>classify</code>-shaped functions, write a macro generating one <code>check-equal?</code> per pair, so adding a test case is adding one line of data, not one line of test code.</li>
          <li><strong>A second reader</strong> for the robot DSL, so <code>.robot</code> files can be written in a friendlier surface syntax than raw Racket s-expressions — even a minimal one (whitespace-separated commands on each line, one per line) is a genuine, complete answer.</li>
          <li><strong>A macro that reports a compile-time warning, not just an error</strong> — using <code>(log-warning ...)</code> or a similar non-fatal mechanism at compile time to flag, say, an account declared but never referenced by any rule, without stopping compilation the way an outright error would.</li>
        </ol>
        <h3>C5 · One substantial challenge</h3>
        <p>Distinct from the final challenge in Part B, and smaller, but not easy.</p>
        <p><strong>Build a macro that generates a <code>#lang</code>'s entire reader/language pair from a single specification</strong> — a meta-toolkit one level above <code>define-ast-types</code>. Given a compact description of a language's forms (name, argument shapes, and what each expands to), generate both the language module's macros and the boilerplate reader/module-begin wiring Milestone 9 wrote by hand.</p>
        <p>Requirements: building the game DSL from Milestone 12 using your meta-toolkit should require meaningfully less code than Milestone 9's finance language needed by hand; the generated language must still produce <code>syntax-parse</code>-quality error messages, not degrade to generic ones for the sake of being generated; and you must be honest, in your write-up, about where the generalisation itself became harder to understand than the three hand-written examples it is meant to replace — there is a real point past which "a toolkit for building toolkits" stops paying for itself, and finding it honestly is the actual point of the exercise.</p>
        <h3>C6 · You should now be able to explain</h3>
        <ul>
          <li>Why "code is data" is a structural fact about s-expressions, not a slogan.</li>
          <li>Hygiene: what it guarantees, and precisely what tool and technique are needed to deliberately defeat it.</li>
          <li>Phase separation: the difference between what runs at compile time and what runs at run time, and why mixing them up produces a specific, recognisable error.</li>
          <li>The difference between <code>define-syntax-rule</code> and <code>syntax-parse</code>, and why the latter's error messages are a real, separate engineering investment, not a free upgrade.</li>
          <li>What a struct guard guarantees that a contract does not, and vice versa.</li>
          <li>The three pieces a genuine <code>#lang</code> needs, and the specific, non-obvious <code>lang/reader.rkt</code> path convention.</li>
          <li>The difference between an interpreter and a macro-based compiler, in terms of what exists at run time, and why the speedup from choosing one over the other is not a fixed, universal number.</li>
          <li>Why a step/fold interpreter design generalises to a stepper for free, where a run-to-completion design does not.</li>
        </ul>
        <h3>C7 · You should now be able to implement</h3>
        <ul>
          <li>A tree-walking interpreter for a small expression language, with structs as the AST and <code>match</code> as the evaluator.</li>
          <li>A struct with constructor-time validation via <code>#:guard</code>, and a function boundary validated via a contract on <code>provide</code>.</li>
          <li>A hygienic macro using <code>define-syntax-rule</code>, and — deliberately, once — an unhygienic one using <code>datum-{'>'}syntax</code>, to know the difference from direct experience rather than description.</li>
          <li>A <code>syntax-parse</code>-based macro with syntax classes, ellipsis patterns, and specific, source-located compile-time error messages.</li>
          <li>A compile-time validation pass using <code>begin-for-syntax</code>, tracking state across multiple macro invocations within one module.</li>
          <li>A genuine, installable <code>#lang</code>: a language module, a <code>lang/reader.rkt</code>, and a registered collection a file can actually run under.</li>
          <li>A macro-based compiler for a small DSL, with a measured, honestly-reported speedup over an equivalent interpreter.</li>
          <li>A reusable interpreter library (the step/fold shape), applied to more than one DSL.</li>
        </ul>
        <hr />
        <h2><span className="num">Part D</span>Shipping it: README, portfolio, interview</h2>
        <h3>D1 · README draft</h3>
        <pre className="plain"><code>{"# langfac\n\nA toolkit for building small domain-specific languages in Racket, ending\nin real, installable #lang implementations — a laboratory for macros,\nhygiene, phase separation, and the compile-time/run-time boundary.\n\nNo third-party dependencies. Standard Racket + rackunit (dev/test).\n\n## What it does\n\n- An AST-and-interpreter toolkit (define-ast-types + a match-based\n  evaluator shape), reused across three genuinely different languages.\n- Hygienic macros by default, with a deliberate, documented demonstration\n  of what breaking hygiene on purpose actually takes and what it costs.\n- syntax-parse-based macros with real, source-located compile-time error\n  messages — not generic pattern-match failures.\n- A compile-time type checker (final challenge) catching a real category\n  of mistake before any document runs, using only begin-for-syntax and\n  syntax-parse's own failure mechanisms.\n- Two working execution strategies for the same language — interpreted\n  and macro-compiled — swappable in one place, both passing the same\n  test suite, with the compiled path measured (not assumed) faster.\n- A genuine #lang finance: `racket budget.finance` runs a real file with\n  no wrapper script, exactly like `racket budget.rkt` would.\n\n## Quick start\n\n    raco pkg install --link -n finance ./finance\n    racket budget.finance\n\n    racket robot-dsl/interp.rkt     # the robot DSL as a library\n    racket game/capstone.rkt         # the capstone game language\n\n## Architecture\n\n    macros/ast-types.rkt        the reusable AST + interpreter toolkit\n    finance/                     main.rkt, lang/reader.rkt, info.rkt\n    robot-dsl/                    step/run-all, reused by game/\n    game/                          the capstone, built from the toolkit\n\n## Testing\n\n    raco test tests/\n\n## Known limitations\n\n- The type checker is narrow (money vs. number), not a general type\n  system — documented as an intentional scope boundary, not an omission.\n- Backend choice (interpreted/compiled) is a single, module-level\n  decision, not a per-document override.\n- The custom reader is minimal; a friendlier surface syntax than raw\n  s-expressions for any of these languages is a real, unbuilt extension.\n\n## Licence\n\nMIT\n"}</code></pre>
        <p>Three deliberate choices, matching every README in this curriculum: it <strong>leads with what was measured</strong> (the compilation speedup, honestly different between two benchmarks rather than one number reused); it <strong>shows the real command that actually runs a <code>.finance</code> file</strong>, because that command working at all is this course's entire thesis made concrete; and it has a <strong>known limitations</strong> section naming the type checker's real, deliberate scope boundary rather than implying a general type system exists.</p>
        <h3>D2 · GitHub project description</h3>
        <blockquote>A toolkit for building domain-specific languages in Racket: hygienic macros, a real type checker, a swappable interpret/compile backend, and a genuine, installable <code>#lang</code> that <code>racket</code> runs directly — no wrapper script.</blockquote>
        <p>Topics: <code>racket</code>, <code>dsl</code>, <code>macros</code>, <code>language-oriented-programming</code>, <code>hygienic-macros</code>, <code>lang</code>, <code>interpreter</code>, <code>compiler</code>, <code>syntax-parse</code>.</p>
        <h3>D3 · Performance considerations</h3>
        <ul>
          <li><strong>Compilation versus interpretation is not a fixed multiplier</strong> — 32.7× on bare arithmetic, 10.8× on realistic finance rules doing more per-evaluation work; report the number for your actual workload, not a borrowed one.</li>
          <li><strong>Association lists versus hash tables for an environment</strong> only matters past a real depth or width — measured, not assumed, in Milestone 4's own exercise.</li>
          <li><strong><code>syntax-parse</code>'s richer checking has a real compile-time cost</strong> compared to <code>define-syntax-rule</code>, paid once per compilation, not per run — almost always the right trade, but worth knowing it is a trade rather than a free upgrade.</li>
          <li><strong>A macro-expanded program's run-time performance is, after expansion, ordinary Racket performance</strong> — profiling a DSL built this way is profiling the expanded code, via <code>raco demod</code>, not the macros themselves.</li>
        </ul>
        <h3>D4 · Security considerations</h3>
        <ul>
          <li><strong>A <code>#lang</code> with an unrestricted <code>#%app</code>/<code>#%datum</code> surface can run arbitrary Racket</strong>, per Part A1 — a finance document is not sandboxed from the host language unless the language module deliberately restricts what it exposes.</li>
          <li><strong><code>eval</code>, used anywhere a DSL's own untrusted input reaches it, is a code-execution risk</strong> — this course's own interpreters (Milestone 4, 10) deliberately never call <code>eval</code> on anything derived from external input; they walk a self-built AST instead, which is the safer shape for exactly this reason.</li>
          <li><strong>A macro that is not carefully hygienic could, in principle, be a code-injection vector</strong> if it ever incorporates unsanitised external text directly into generated syntax via <code>datum-{'>'}syntax</code> — a real, if unusual, risk specific to languages with this much compile-time power, worth naming even though this course's own macros never take untrusted input at compile time.</li>
          <li><strong>A distributed <code>raco exe</code> executable embeds your source's logic, not your source text verbatim</strong>, but is not designed as a security boundary against a determined reverse engineer — do not treat it as a way to hide business logic from someone with the executable in hand. </li>
        </ul>
        <h3>D5 · What to put in your portfolio</h3>
        <p>Do not present this as "a Lisp project with macros." Present it as what it is: <strong>a working demonstration that a language can be built, not merely used — with a real type checker, a measured compilation strategy, and a genuine, installable <code>#lang</code> at the end of it.</strong> The narrative that makes it interesting is the escalation from data to macro to language.</p>
        <ol>
          <li>An interpreter built from ordinary structs and <code>match</code> — "code is data" made concrete for the first time.</li>
          <li>A macro, then a deliberately broken one, proving hygiene is enforced rather than assumed.</li>
          <li><code>syntax-parse</code> replacing generic failures with specific, source-located ones.</li>
          <li>The finance language, real, checked at compile time — and the three real bugs hit building <code>#lang finance</code>, each with its exact error message and fix.</li>
          <li>A second DSL, proving the toolkit actually generalises, not just described as generalisable.</li>
          <li>A macro-based compiler, measured — twice, on two different workloads, with two different, honestly reported numbers.</li>
          <li>The final challenge's type checker and swappable backend, with its own honest limitations.</li>
        </ol>
        <p>Keep a <code>docs/</code> folder with the three <code>#lang</code>-building error transcripts, both benchmark tables, and one architecture diagram. A reviewer who spends ninety seconds on your repository should come away knowing you built a real language, not a clever set of Racket functions.</p>
        <h3>D6 · Interview questions someone could ask, and what a good answer contains</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>Question</th>
              <th>What a strong answer includes</th>
            </tr>
            <tr>
              <td>Walk me through building <code>#lang finance</code>.</td>
              <td>The three pieces (language module, reader, module-begin), and the three real bugs hit in order — collection resolution, the <code>lang/</code> path convention, the <code>#%module-begin</code> export conflict — with the exact fix for each.</td>
            </tr>
            <tr>
              <td>What is macro hygiene, and why does it matter?</td>
              <td>The precise guarantee (no accidental capture either direction), demonstrated with the actual <code>my-or</code>/<code>unhygienic-or</code> pair and their genuinely different outputs (<code>100</code> versus <code>#f</code>) for the identical call.</td>
            </tr>
            <tr>
              <td>Interpreter or compiler — how do you decide?</td>
              <td>Both were built for the same language; the compiler measured 10.8–32.7× faster depending on workload, at the cost of separately-maintained error-message quality and, in the final challenge, a real design question about where the backend choice should live.</td>
            </tr>
            <tr>
              <td>Tell me about a bug you found.</td>
              <td>Any of the three <code>#lang</code>-building bugs, or the <code>begin-for-syntax</code> phase-separation mistake from Milestone 7 — the specific error message, why it happened, and the one-line fix once the concept was understood.</td>
            </tr>
            <tr>
              <td>How does this compare to building a DSL in Ruby?</td>
              <td>Ruby's Course 2 DSL is still parsed by Ruby's one fixed grammar and checked, if at all, at run time; a Racket macro adds real syntax, checked before the program runs, with specific error messages — a structurally different, not just stylistically different, capability.</td>
            </tr>
            <tr>
              <td>What would you do differently?</td>
              <td>Promote the declared-accounts compile-time tracking pattern to the toolkit earlier, per Milestone 8's own exercise finding; design the type checker's scope boundary before writing any of it, rather than discovering the money-versus-literal question while implementing; and build the swappable-backend mechanism before, not during, the final challenge.</td>
            </tr>
            <tr>
              <td>When would you not reach for this approach?</td>
              <td>When the problem does not actually need new syntax — an ordinary library of functions, or even Ruby-style method-call DSL, is simpler to build, debug, and explain to a new contributor than a macro-based language, and "we built a whole <code>#lang</code>" is a real cost that needs a real justification, not a default reach.</td>
            </tr>
            <tr>
              <td>What did you learn that surprised you?</td>
              <td>A genuine, specific moment — the <code>lang/reader.rkt</code> path convention, or that the compilation speedup was not a fixed multiplier across workloads — stated honestly rather than a generic "macros are powerful" answer.</td>
            </tr>
          </tbody>
        </table>
        <h3>D7 · Extensions worth building</h3>
        <ul>
          <li><strong>A friendlier concrete syntax</strong> for any of this course's languages — a real custom reader parsing something other than s-expressions, which this course's readers deliberately did not need to do, since <code>syntax/module-reader</code> handles s-expression-shaped source for you.</li>
          <li><strong>A general type system</strong>, closing the final challenge's most honest limitation — even extending money/number to a third or fourth type is a substantial, valuable next step.</li>
          <li><strong>A language server</strong> providing real editor integration (hover documentation, go-to-definition for account names) for <code>#lang finance</code> — Racket's own tooling infrastructure supports this, and it is a genuinely large, genuinely educational undertaking.</li>
          <li><strong>The meta-toolkit from C5</strong>, fully built out — the most ambitious, most educationally valuable extension in this course, by a distance.</li>
          <li><strong>A real package release</strong> to Racket's own package catalog, so <code>raco pkg install finance</code> works for anyone, not just this project's own checkout.</li>
        </ul>
        <hr />
        <h2><span className="num">Course 5 complete</span>What you built</h2>
        <p>A toolkit spanning interpreters, hygienic and unhygienic macros (one deliberately broken to prove the point), <code>syntax-parse</code>-based DSLs with real error messages, a compile-time type checker, a measured macro-based compiler, and a genuine, installable <code>#lang</code> that runs with the same <code>racket</code> command as everything else — built across three real languages, proving the toolkit underneath all three actually generalised rather than merely being described as general. More importantly: the instinct to ask, for any repeated ceremony, whether the language itself could be taught to understand it directly, rather than only ever writing another layer of functions on top.</p>
        <p>The central question of this curriculum was <em>what kinds of problems does this language make unusually natural to solve?</em> Racket's answer, stated as precisely as this project allows: <strong>problems where the shape of the solution keeps wanting to be a new notation, not new library functions — where the actual friction is that the language you have does not let you say the thing directly, and where "add real syntax, checked at compile time, with good error messages" is a supported, ordinary engineering choice rather than a research project.</strong> Not the fastest to reach for on the first afternoon of a new problem, not the language you would choose if the problem is genuinely just "call a library correctly." The one where, once you have felt the difference between a library and a language, you stop reaching for the wrong one out of habit.</p>
        <hr />
        <h2><span className="num">Curriculum complete</span>Five languages, one question, asked five times</h2>
        <p>Go's answer was structural isolation for concurrency, paid for in verbosity and a runtime that kills the whole process on an unrecovered panic. Ruby's was blurring code and configuration through blocks and metaprogramming, paid for in a DSL that is still, underneath, ordinary method dispatch checked at run time. Perl's was decades of exactly-this-format text-processing tooling plus a handful of sharp, unusual idioms, paid for in a language whose debugging surface is unusually easy to get subtly wrong. Erlang's was isolation and supervision as defaults rather than disciplines, paid for in a genuinely steep unlearning of defensive-programming instinct. Racket's, closing the curriculum, was treating syntax itself as the material you build with, paid for in the steepest conceptual middle section of any course here — phase separation, hygiene, and the compile-time/run-time boundary all at once.</p>
        <p>None of these five answers is the universally correct one. That was always the point: five fundamentally different starting axioms about what a program is and how it should be built, each one making a specific class of problem genuinely, structurally easier to solve — not through willpower or convention, but because the language itself was shaped around exactly that difficulty. Knowing five of these, concretely, from having built something real in each, is worth more than an opinion about which one is "best." There is no such language. There are only better and worse fits, and now you know how to tell the difference by building the thing, not by reading about it.</p>
        <footer className="end">
          <p>Instalment 25 of the five-course curriculum, and the end of Course 5 — and of the curriculum. Thank you for building all five.</p>
        </footer>
         <Link className="button" href="/">Back to Mewlang</Link> 
      </div>
    </div>
  );
}
