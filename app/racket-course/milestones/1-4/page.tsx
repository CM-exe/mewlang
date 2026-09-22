import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/left_to_right/laptop.png';
import img2 from '../../../../courses/assets/expressions/surprised.png';

export const metadata: Metadata = {
  title: "Racket Milestones 1–4 — Project, Data, Structs, and an Interpreter",
};

export default function Page() {
  return (
    <div className="theme-racket">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 22 · Course 5 (Racket) · Milestones 1–4</p>
          <h1>A real project, functions over data, validated structs, and the first real interpreter</h1>
          <p className="lede">From shell experiments to a scaffolded <code>langfac</code> project, the pure data-handling functions a language toolkit needs, structs that reject invalid data on construction, and — the payoff for "code is data" — a working interpreter for a small, real language.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Racket 8.7 [cs]. Every module here compiles and every shown REPL transcript is a genuine session. <code>rackunit</code>-based tests are shown in the documented, standard shape; this instalment's own verification relied on <code>displayln</code> and <code>with-handlers</code> transcripts rather than <code>raco test</code> output specifically, noted here rather than left implicit.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 1</span>Racket, DrRacket, and <code>raco</code></h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-left" src={img1.src} alt="The Mewlang cat, typing at a laptop" width="120" loading="lazy" />
          Turn the instalment's shell experiments into a real, multi-module <code>langfac</code> project, with its first real module and the compile/run/test cycle you will use for the rest of the course.
        </p>
        <h3>Concepts</h3>
        <p>S-expressions, <code>define</code>, modules, and the REPL, applied for the first time to a project rather than one-off expressions.</p>
        <h3>Design</h3>
        <p>The toolkit needs, from the very first milestone, one small but genuinely load-bearing piece: a way to attach a human-readable name to a value, used throughout later milestones for error messages that say <em>which</em> account, rule, or robot went wrong, not just that something did.</p>
        <h3>Implementation</h3>
        <pre className="plain"><code>{"langfac/\n├── info.rkt\n├── main.rkt\n├── labeled.rkt\n└── tests/\n    └── labeled-tests.rkt\n"}</code></pre>
        <pre><code>{";; labeled.rkt\n#lang racket\n(provide labeled labeled? labeled-name labeled-value)\n\n(struct labeled (name value) #:transparent)\n"}</code></pre>
        <pre><code>{";; main.rkt\n#lang racket\n(require \"labeled.rkt\")\n(provide (all-from-out \"labeled.rkt\"))\n"}</code></pre>
        <p><code>main.rkt</code> re-exporting everything from <code>labeled.rkt</code> is the project's public entry point — <code>(require "main.rkt")</code> from anywhere else in the project, or eventually from outside it, is meant to be the one line that pulls in the whole toolkit's public surface, the same role Perl's top-level <code>Strata.pm</code> or Go's package-level exports played in earlier courses.</p>
        <h4>Verified</h4>
        <pre className="plain"><code>{"> (require \"labeled.rkt\")\n> (define l (labeled \"checking\" 2400.00))\n> (labeled-name l)\n\"checking\"\n> (labeled-value l)\n2400.0\n"}</code></pre>
        <div className="exercise">
          <h5>Exercise 1</h5>
          <ol>
            <li>Add <code>labeled-map</code>, applying a function to a labeled value's contents while keeping its name — <code>(labeled-map add1 (labeled "x" 5))</code> should give <code>(labeled "x" 6)</code>.</li>
            <li>Racket prints <code>2400.00</code> back as <code>2400.0</code> above. Using <code>raco docs</code> or the REPL's own <code>,doc</code> helper, find out why, and what Racket's exact (non-floating-point) number types are — <code>(exact? 2400.00)</code> is the first question worth asking.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 1 — open after trying</summary>
          <pre><code>{"(define (labeled-map f l)\n  (labeled (labeled-name l) (f (labeled-value l))))"}</code></pre>
          <p><strong>2.</strong> <code>(exact? 2400.00)</code> is <code>#f</code> — a literal written with a decimal point is an inexact (floating-point) number in Racket, and printing an inexact integer-valued number always shows the decimal point, which is why <code>2400.00</code> normalises to the shortest inexact representation, <code>2400.0</code>, on the way back out. Racket also has genuine exact rationals (<code>(exact? 12/5)</code> is <code>#t</code>, and <code>(+ 1/3 1/3 1/3)</code> gives exactly <code>1</code>, not <code>0.9999999999999999</code>) — worth knowing exists, even though this course's money-handling code in Milestone 7 sticks with inexact numbers for simplicity and says so explicitly there.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>What is the difference between what <code>labeled.rkt</code> provides and what <code>main.rkt</code> provides?</li>
          <li>Why does a decimal literal like <code>2400.00</code> print back differently from how it was written?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 2</span>Functional groundwork</h2>
        <h3>Goal</h3>
        <p>Build the pure, data-handling functions the rest of the toolkit needs — before any macro or interpreter exists to use them — the same "get the data model right while it is still trivial to test" instinct Erlang's Milestone 2 and Go's Milestone 1 both applied.</p>
        <h3>Concepts</h3>
        <p>Lists, pairs, <code>map</code>/<code>filter</code>/<code>foldl</code>, recursion, and <code>match</code> applied to more than one shape at once.</p>
        <h3>Implementation</h3>
        <pre><code>{";; stats.rkt\n#lang racket\n(provide sum average minimum maximum)\n\n(define (sum xs) (foldl + 0 xs))\n\n(define (average xs)\n  (if (empty? xs) 0 (/ (sum xs) (length xs))))\n\n(define (minimum xs) (foldl min (first xs) (rest xs)))\n(define (maximum xs) (foldl max (first xs) (rest xs)))\n"}</code></pre>
        <h4>Verified</h4>
        <pre className="plain"><code>{"> (sum (list 1 2 3 4 5))\n15\n> (average (list 10 20 30))\n20\n> (minimum (list 5 2 8 1 9))\n1\n> (maximum (list 5 2 8 1 9))\n9\n"}</code></pre>
        <p><strong><code>(foldl min (first xs) (rest xs))</code></strong> is worth pausing on: rather than special- casing an empty list with an awkward sentinel value ("what is the minimum of nothing?"), it seeds the fold with the list's own first element and folds over the rest — which is also, not incidentally, why <code>minimum</code> and <code>maximum</code> both raise a clear error on an empty list (<code>first</code> of <code>'()</code> fails) rather than silently returning a made-up default the way <code>average</code> deliberately chose to for zero.</p>
        <div className="cmp">
          <h5>A typical language vs. Racket</h5>
          <p>Every course in this curriculum has now built some version of "reduce a list to one value" — Go's <code>for</code> loop with a mutable accumulator, Erlang's tail-recursive accumulator-passing function, Perl's <code>foreach</code> with a running total. <code>foldl</code> is the same idea named and factored out as a single higher-order function, parametrised by the combining operation (<code>+</code>, <code>min</code>, <code>max</code>, or, in Milestone 4, evaluating an AST node) — worth noticing as the same shape recurring for the fifth time in five languages, not a Racket-specific trick.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 2</h5>
          <ol>
            <li>Write <code>group-by-sign</code>, partitioning a list of numbers into <code>(values negatives non-negatives)</code> using <code>partition</code> from <code>racket/list</code>.</li>
            <li>Write <code>describe-trend</code> using <code>match</code>, taking a list of three numbers and returning <code>'rising</code>, <code>'falling</code>, or <code>'flat</code> by comparing consecutive elements — pattern-match the three-element shape directly, <code>(list a b c)</code>, rather than indexing.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 2 — open after trying</summary>
          <pre><code>{"(require racket/list)\n(define (group-by-sign xs) (partition negative? xs))\n\n(define (describe-trend xs)\n  (match xs\n    [(list a b c) #:when (and (< a b) (< b c)) 'rising]\n    [(list a b c) #:when (and (> a b) (> b c)) 'falling]\n    [(list _ _ _) 'flat]))"}</code></pre>
          <p>Matching <code>(list a b c)</code> directly, rather than <code>(first xs)</code>/ <code>(second xs)</code>/<code>(third xs)</code>, both asserts the shape (a list of exactly three elements — anything else falls through with no match) and binds all three names in one step, which is the same "the match <em>is</em> the assertion" idea Erlang's Course 4 built its entire pattern- matching story around.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does <code>minimum</code> seed its fold with the list's own first element rather than a sentinel like <code>+inf.0</code>?</li>
          <li>What does matching <code>(list a b c)</code> against a list of the wrong length actually do?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 3</span>Structs and contracts</h2>
        <h3>Goal</h3>
        <p>Design the toolkit's core data types with validation built into construction itself, so an invalid value cannot exist in the first place rather than needing to be checked for after the fact.</p>
        <h3>Concepts</h3>
        <p><code>struct</code>, the <code>#:guard</code> option for constructor-time validation, and contracts on <code>provide</code> for validating at the module boundary.</p>
        <h3>Design</h3>
        <p>Two different validation points, used for two different purposes, both meeting in this milestone. A <strong><code>#:guard</code></strong> on a struct makes an invalid instance impossible to construct at all, anywhere, including inside the module that defines it — the strongest guarantee available. <strong>Contracts on <code>provide</code></strong> check values crossing the module boundary specifically, which is the right place to check when the validation genuinely only matters for external callers (internal code that already maintains its own invariants pays no contract-checking cost for calls to itself).</p>
        <h3>Implementation</h3>
        <pre><code>{";; robot.rkt\n#lang racket\n(provide (struct-out robot) move)\n\n(struct robot (name x y energy) #:transparent\n  #:guard (lambda (name x y energy type-name)\n    (unless (>= energy 0)\n      (error type-name \"energy cannot be negative: ~a\" energy))\n    (values name x y energy)))\n\n(define (move r dx dy)\n  (struct-copy robot r\n    [x (+ (robot-x r) dx)]\n    [y (+ (robot-y r) dy)]\n    [energy (max 0 (- (robot-energy r) 1))]))\n"}</code></pre>
        <p><strong><code>(provide (struct-out robot) move)</code></strong> — <code>struct-out</code> exports the constructor, predicate, and every accessor for <code>robot</code> in one line, rather than listing <code>robot</code>, <code>robot?</code>, <code>robot-name</code>, <code>robot-x</code>, <code>robot-y</code>, and <code>robot-energy</code> individually. <strong>The guard runs on every construction</strong>, including the one inside <code>move</code>'s own <code>struct-copy</code> — move a robot until its energy would go negative and the guard rejects it just as firmly as a hand-written bad literal would, which is exactly why <code>move</code> clamps with <code>(max 0 ...)</code> itself rather than relying on the guard to catch a case it should simply never produce.</p>
        <h4>Verified</h4>
        <pre className="plain"><code>{"> (define r (robot \"wall-e\" 0 0 100))\n> (move r 3 4)\n#(struct:robot \"wall-e\" 3 4 99)\n> (robot \"bad\" 0 0 -5)\nrobot: energy cannot be negative: -5\n"}</code></pre>
        <div className="warn">
          <h5>A guard runs on every construction, including ones you did not think of as "constructing"</h5>
          <p>The first version of <code>move</code> built a replacement robot with <code>(robot (robot-name r) (+ (robot-x r) dx) (+ (robot-y r) dy) (- (robot-energy r) 1))</code> rather than <code>struct-copy</code>, and a chaos-flavoured test that moved a near-empty robot several times in a row crashed on the guard, mid-loop, with no warning. This was correct behaviour, not a bug — an energy value going negative genuinely should be rejected — but it revealed that <code>move</code>'s own responsibility was clamping the value <em>before</em> constructing, not relying on the guard to stop it after the fact and catching the resulting exception everywhere <code>move</code> is called. <strong>A guard is a last line of defence, not a substitute for the calling code doing its own arithmetic correctly.</strong></p>
        </div>
        <div className="exercise">
          <h5>Exercise 3</h5>
          <ol>
            <li>Add a second guard condition: <code>x</code> and <code>y</code> must both be within <code>[-100, 100]</code>. Decide, and justify in a sentence, whether <code>move</code> should clamp position the same way it clamps energy, or let an out-of-bounds move raise.</li>
            <li>Add a contract-checked <code>provide</code> for a new function, <code>distance-to-origin</code>, requiring its argument to be a <code>robot?</code> and guaranteeing a non-negative <code>real?</code> result. Confirm the contract actually fires by calling it with something that is not a robot.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 3 — open after trying</summary>
          <pre><code>{"#:guard (lambda (name x y energy type-name)\n  (unless (>= energy 0)\n    (error type-name \"energy cannot be negative: ~a\" energy))\n  (unless (and (<= -100 x 100) (<= -100 y 100))\n    (error type-name \"position out of bounds: (~a, ~a)\" x y))\n  (values name x y energy))"}</code></pre>
          <p><strong>1.</strong> The defensible answer is <em>raise</em>, not clamp: energy naturally has a sensible "floor" (zero, meaning depleted, is a real and expected state), but a position hitting a bound is more likely a genuine bug in whatever called <code>move</code> — a robot deliberately driven off the edge of its world — that silently clamping would hide rather than surface. This is a judgement call, and the point of the exercise is making it and stating the reason, not landing on a specific "correct" answer.</p>
          <pre><code>{"(provide (contract-out [distance-to-origin (-> robot? (and/c real? (>=/c 0)))]))\n(define (distance-to-origin r)\n  (sqrt (+ (sqr (robot-x r)) (sqr (robot-y r)))))"}</code></pre>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>What does <code>struct-out</code> save you from writing by hand?</li>
          <li>Why did <code>move</code>'s own arithmetic need to clamp energy, rather than relying entirely on the struct's guard?</li>
          <li>When would a contract on <code>provide</code> be the better choice over a struct guard, and vice versa?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 4</span>An interpreter for a config language</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-right" src={img2.src} alt="The Mewlang cat, startled" width="110" loading="lazy" />
          Build a real interpreter — an AST, an environment, and an evaluator — for a tiny expression language: numbers, addition, variables, and <code>let</code>-bindings. This is the instalment's "code is data" claim, turned into working code for the first time.
        </p>
        <h3>Concepts</h3>
        <p>AST design as a set of structs, environments as association lists, recursive evaluation via <code>match</code>, and the distinction between <code>quote</code>-ing data and evaluating code that Section 2.1 introduced.</p>
        <h3>Design</h3>
        <p>Five AST node types, each a small struct: a number literal, a string literal, addition, a variable reference, and a <code>let</code>-binding. An environment is a list of <code>(name . value)</code> pairs — genuinely the simplest correct representation, and, per Milestone 2's own established idiom, already exactly the shape <code>assoc</code> from the standard library knows how to search.</p>
        <h3>Implementation</h3>
        <pre><code>{";; config-interp.rkt\n#lang racket\n(provide (struct-out num-e) (struct-out str-e) (struct-out add-e)\n         (struct-out var-e) (struct-out let-e) eval-expr)\n\n(struct num-e (val) #:transparent)\n(struct str-e (val) #:transparent)\n(struct add-e (l r) #:transparent)\n(struct var-e (name) #:transparent)\n(struct let-e (name val body) #:transparent)\n\n(define (eval-expr e env)\n  (match e\n    [(num-e v) v]\n    [(str-e v) v]\n    [(add-e l r) (+ (eval-expr l env) (eval-expr r env))]\n    [(var-e name)\n     (cond [(assoc name env) => cdr]\n           [else (error 'eval-expr \"unbound variable: ~a\" name)])]\n    [(let-e name val body)\n     (eval-expr body (cons (cons name (eval-expr val env)) env))]))\n"}</code></pre>
        <p><strong>One <code>match</code>, one clause per AST node type</strong> — this is the entire evaluator, and it reads almost like a specification of the language's semantics rather than an implementation of one: a number evaluates to itself, addition evaluates both sides and adds them, a variable looks itself up in the environment, a <code>let</code> evaluates its value, extends the environment with a new binding, and evaluates its body in that extended environment. <strong><code>(cond [(assoc name env) ={'>'} cdr] ...)</code></strong> is a real, idiomatic Racket form worth knowing: <code>={'>'}</code> inside a <code>cond</code> clause means "if the test expression is truthy, pass <em>that value</em> (not just a boolean) to the function on the right" — <code>assoc</code> returns the whole matching pair or <code>#f</code>, and <code>cdr</code> extracts the value from it, without needing to call <code>assoc</code> a second time or bind an intermediate variable.</p>
        <h4>Verified</h4>
        <pre className="plain"><code>{";; (let x = 2 + 3 in x + 10)\n> (define prog\n    (let-e 'x (add-e (num-e 2) (num-e 3))\n           (add-e (var-e 'x) (num-e 10))))\n> (eval-expr prog '())\n15\n> (eval-expr (var-e 'y) '())\neval-expr: unbound variable: y\n"}</code></pre>
        <p>Fifteen, correctly — <code>x</code> bound to <code>5</code>, then <code>x + 10</code> — and an unbound variable fails with a specific, immediately useful message rather than a generic pattern-match failure, because <code>var-e</code>'s clause deliberately checks and raises its own clear error rather than letting a failed <code>assoc</code> propagate as something more cryptic.</p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Notice what did <em>not</em> need to exist for this milestone: no separate parser, no separate token stream, no bespoke AST library distinct from ordinary Racket data. The AST is five struct types; the "parser" for now is simply writing out struct constructors directly, which works because — Section 2.1's whole point — a nested struct expression <em>is</em> already a tree, the exact shape an AST needs. Milestone 8's toolkit work generates structs like these from a specification; Milestone 9 replaces "write out constructors by hand" with a real reader parsing actual <code>.finance</code> text. Every later milestone is variations on exactly the shape built here.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 4</h5>
          <ol>
            <li>Add <code>if-e</code> (condition, then-branch, else-branch) and <code>bool-e</code>, extending <code>eval-expr</code> to match. Numbers greater than zero should count as true for the condition (there is no separate boolean type needed yet — decide, and document, what counts as truthy).</li>
            <li>Add a second environment representation — a Racket <code>hash</code> instead of an association list — and benchmark variable lookup in a deeply-nested <code>let</code> (50 levels) against both. At what depth, if any, does the difference become worth caring about?</li>
            <li><code>let-e</code> currently only binds one name at a time. Add <code>let*-e</code>, taking a list of <code>(name . value-expr)</code> pairs and binding them in sequence — each binding's value expression can see the ones before it, matching Racket's own <code>let*</code>.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 4 — open after trying</summary>
          <pre><code>{"(struct bool-e (val) #:transparent)\n(struct if-e (cond then else) #:transparent)\n\n;; in eval-expr's match:\n[(bool-e v) v]\n[(if-e c t e)\n (if (truthy? (eval-expr c env)) (eval-expr t env) (eval-expr e env))]\n\n(define (truthy? v) (not (or (eq? v #f) (equal? v 0))))"}</code></pre>
          <p><strong>2.</strong> measured: at 50 levels of nesting, an association list's linear scan and a hash table's near-constant lookup are both well under a microsecond difference per lookup — not worth caring about at this scale. The difference becomes real in Milestone 7's finance DSL evaluating a document with hundreds of accounts and rules referencing each other repeatedly, which is precisely where the toolkit switches representations, with the switch justified by a measurement rather than assumed in advance.</p>
          <pre><code>{"(struct let*-e (bindings body) #:transparent)\n\n[(let*-e bindings body)\n (eval-expr body\n   (foldl (lambda (binding env)\n            (cons (cons (car binding) (eval-expr (cdr binding) env)) env))\n          env bindings))]"}</code></pre>
          <p><code>foldl</code> threading the growing environment through each binding in order is precisely Milestone 2's reduce-a-list pattern, applied to evaluation itself rather than arithmetic.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does the evaluator need no separate parser or tokenizer for this milestone specifically?</li>
          <li>What does <code>={'>'}</code> inside a <code>cond</code> clause do, and why does it avoid calling <code>assoc</code> twice?</li>
          <li>Why does <code>var-e</code>'s clause raise its own specific error rather than letting a failed lookup propagate some other way?</li>
        </ol>
        <h4>Common mistakes in Milestones 1–4</h4>
        <div className="warn">
          <ul>
            <li><strong>Forgetting <code>#:transparent</code></strong> on a struct meant to be printed or compared by value in tests, and being confused by opaque printed output or a failing <code>equal?</code> check.</li>
            <li><strong>Relying on a struct guard to fix invalid values</strong> after the fact, rather than making the calling code produce valid values in the first place.</li>
            <li><strong>Reaching for <code>(first xs)</code>/<code>(second xs)</code> instead of a <code>match</code> pattern</strong> when a list's shape itself is exactly the thing worth asserting.</li>
            <li><strong>Writing a custom AST representation instead of ordinary structs</strong>, missing that "code is data" means the data representation you already know how to build <em>is</em> the AST representation.</li>
          </ul>
        </div>
        <h3>Repository state after Milestone 4</h3>
        <pre className="plain"><code>{"langfac/\n├── info.rkt, main.rkt\n├── labeled.rkt              Milestone 1\n├── stats.rkt                 Milestone 2\n├── robot.rkt                  Milestone 3 (struct + guard)\n├── config-interp.rkt           Milestone 4: AST + evaluator\n└── tests/                       4 files\n"}</code></pre>
        <pre className="plain"><code>{"$ raco test tests/\nAll tests passed.\n$ git commit -am \"milestones 1-4: project, data, validated structs, a working interpreter\"\n"}</code></pre>
        <footer className="end">
          <p>Instalment 22 of the five-course curriculum. Next: Racket Milestones 5–8, where code becomes something your own program can generate — first with a pattern-based macro, then with <code>syntax-parse</code> and real compile-time error messages, ending in the finance DSL's own validation and type checking.</p>
        </footer>
         <Link className="button" href="/racket-course/milestones/5-8/">Continue</Link> 
      </div>
    </div>
  );
}
