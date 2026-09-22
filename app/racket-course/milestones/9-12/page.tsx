import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/left_to_right/happy.png';
import img2 from '../../../../courses/assets/expressions/right_to_left/paw.png';

export const metadata: Metadata = {
  title: "Racket Milestones 9–12 — Your Own #lang, the Robot DSL, Compiling, Tooling",
};

export default function Page() {
  return (
    <div className="theme-racket">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 24 · Course 5 (Racket) · Milestones 9–12</p>
          <h1><code>#lang finance</code> becomes real, a second DSL ships as a library, and compiling beats interpreting by 32×</h1>
          <p className="lede">The finance language stops being "Racket with extra forms" and becomes a genuine <code>#lang</code>. A robot-control DSL ships as a reusable interpreter. The same finance language, compiled instead of interpreted, measured against itself. Then real tests, real tooling, and a capstone game language.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Racket 8.7 [cs]. Milestone 9's <code>#lang finance</code> is genuinely installed as a linked collection and genuinely runs a <code>.finance</code> file with <code>racket budget.finance</code> — including three real bugs hit and fixed while building it, documented below exactly as found. Milestone 11's benchmark numbers are real, from an actual timed run.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 9</span>Your own <code>#lang</code></h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-left" src={img1.src} alt="The Mewlang cat, happy and celebrating" width="120" loading="lazy" />
          Turn the finance language from Milestone 7 — usable so far only as macros inside an ordinary <code>#lang racket</code> file — into a genuine <code>#lang finance</code>, so that a file starting with those two words, and nothing else Racket-specific, runs directly.
        </p>
        <h3>Concepts</h3>
        <p>Readers, module languages, <code>#%module-begin</code>, and the specific, slightly surprising module-path convention <code>#lang <em>name</em></code> actually follows.</p>
        <h3>Design</h3>
        <p>Three pieces. A <strong>language module</strong> (what Milestone 7 already built: the forms <code>account</code> and <code>rule</code> mean). A <strong>reader</strong>, turning raw <code>.finance</code> text into syntax objects the language module can expand. And a <strong>module-begin wrapper</strong>, controlling what happens to a whole file's worth of top-level forms — in this course's finance language, printing every account's balance after every top-level form has run.</p>
        <h3>Implementation</h3>
        <pre><code>{";; finance/main.rkt — the language: what account and rule mean\n#lang racket\n(provide (rename-out [my-module-begin #%module-begin])\n         (except-out (all-from-out racket) #%module-begin)\n         account rule display-accounts)\n\n(require (for-syntax racket/base syntax/parse))\n\n(struct acc (name type balance) #:transparent)\n(define all-accounts (make-hash))\n\n(define-syntax (account stx)\n  (syntax-parse stx\n    [(_ name:id type:id balance:number)\n     #:fail-unless (memq (syntax-e #'type) '(checking savings credit))\n                   (format \"unknown account type: ~a\" (syntax-e #'type))\n     #'(hash-set! all-accounts 'name (acc 'name 'type balance))]))\n\n(define-syntax (rule stx)\n  (syntax-parse stx\n    [(_ label:str cond:expr msg:str)\n     #'(unless cond (printf \"rule ~a: ALERT: ~a\\n\" label msg))]))\n\n(define (display-accounts)\n  (for ([(k v) (in-hash all-accounts)])\n    (printf \"~a: $~a\\n\" k (acc-balance v))))\n\n(define-syntax-rule (my-module-begin form ...)\n  (#%module-begin form ... (display-accounts)))\n"}</code></pre>
        <pre><code>{";; finance/lang/reader.rkt — MUST live at exactly this path, in a \"lang\"\n;; subdirectory; this is not a naming preference, it is the convention\n;; #lang finance itself relies on to find the reader at all (see below)\n#lang s-exp syntax/module-reader\nfinance/main\n"}</code></pre>
        <pre className="plain"><code>{";; budget.finance\n#lang finance\n(account checking checking 2400.00)\n(account savings savings 8000.00)\n(rule \"min-balance\" (> 2400.00 100) \"checking too low\")\n"}</code></pre>
        <h4>Verified: a real file, running with no wrapper, no special invocation</h4>
        <pre className="plain"><code>{"$ racket budget.finance\nsavings: $8000.0\nchecking: $2400.0\n"}</code></pre>
        <p>That is the whole payoff of this milestone and, in a real sense, of this entire course: <code>racket</code> — the ordinary command, the one you have been using since the instalment's first "hello, factory" — ran a file it had never seen a form named <code>account</code> or <code>rule</code> in before, correctly, because <code>#lang finance</code> at the top told it exactly where to find out what those words mean. </p>
        <div className="warn">
          <h5>Three real bugs, in the order they were actually found</h5>
          <p><strong>1. <code>finance/main</code> as a module path failed with "collection not found."</strong> A module path like <code>finance/main</code> (no quotes) is a <em>collection-relative</em> path, searched for among Racket's installed collections — it means nothing until <code>finance</code> is actually registered as one. Before that registration exists, referring to your own in-progress language by its eventual collection name simply does not resolve. The fix is registering it (below), not changing the path.</p>
          <p><strong>2. <code>#lang finance</code> itself failed, even after fixing (1), with "collection not found: finance/lang."</strong> This is the genuinely non-obvious convention: writing <code>#lang <em>name</em></code> at the top of a file does not look for <code><em>name</em>/reader.rkt</code> — it specifically looks for <code><em>name</em>/lang/reader.rkt</code>, a <code>lang</code> subdirectory, always. The more flexible <code>#lang reader "path/to/reader.rkt"</code> form (used to test the reader before the package registration existed) has no such requirement, which is exactly why it is the easier form to develop against before committing to the final directory layout.</p>
          <p><strong>3. <code>(provide (all-from-out racket) ...)</code> failed with "identifier already provided as a different binding."</strong> Re-exporting everything from <code>racket</code> for the DSL's users to have ordinary arithmetic (<code>{'>'}</code>, <code>+</code>, and so on) available inside <code>rule</code> conditions collided with the module's own renamed <code>#%module-begin</code> — <code>racket</code> already exports a <code>#%module-begin</code> of its own, and re-exporting both under the same name is a conflict. <code>(except-out (all-from-out racket) #%module-begin)</code> is the fix: take everything from <code>racket</code> except the one binding this module deliberately overrides.</p>
          <p>None of these three are exotic — they are the ordinary shape of "building a language surfaces a convention you did not know existed" that this milestone exists to walk you through once, with the exact error message each one actually produces, so meeting any of them again is recognition rather than a cold start.</p>
        </div>
        <h4>Registering the collection</h4>
        <pre className="plain"><code>{"finance/\n├── info.rkt          (define collection \"finance\")\n├── main.rkt\n└── lang/\n    └── reader.rkt\n\n$ raco pkg install --link -n finance ./finance\n===> ... --- compiling collections ---\n===> 5 making: <pkgs>/finance\n"}</code></pre>
        <p><code>--link</code> registers the directory itself as the collection's source, rather than copying it — genuinely the right choice while a language is still under active development, since edits to <code>main.rkt</code> take effect on the next run without reinstalling anything.</p>
        <div className="exercise">
          <h5>Exercise 9</h5>
          <ol>
            <li>Add a <code>transfer</code> form — <code>(transfer checking savings 500.00)</code> — moving money between two already-declared accounts, checked at compile time (Milestone 7's pattern) that both account names were actually declared earlier in the file.</li>
            <li>Confirm the specific bug: comment out the <code>(except-out (all-from-out racket) #%module-begin)</code> exclusion, reproduce the "already provided" error yourself, and read the error message closely enough to explain, in your own words, why it names <code>#%module-begin</code> specifically rather than some other identifier.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 9 — open after trying</summary>
          <p>The compile-time account-tracking set from Milestone 7's own Exercise 7 solution is exactly the mechanism <code>transfer</code>'s validation needs — a <code>begin-for-syntax</code> parameter populated as each <code>account</code> form expands, consulted by <code>transfer</code>'s <code>#:fail-unless</code> the same way <code>account</code>'s own type check works. This is the clearest evidence yet that Exercise 8's "promote this to the toolkit" instinct was correct — every new form this language grows wants the same "was this name already declared" check.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>What three pieces does turning a set of macros into a real <code>#lang</code> require?</li>
          <li>Why does <code>#lang finance</code> specifically require a <code>lang/</code> subdirectory, where <code>#lang reader "path"</code> does not?</li>
          <li>Why did re-exporting <code>(all-from-out racket)</code> conflict with the renamed <code>#%module-begin</code>, precisely?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 10</span>The robot DSL</h2>
        <h3>Goal</h3>
        <p>Build a second, genuinely different language — a robot-control DSL with movement, sequencing, and a <em>stepper</em> that can pause between instructions — as a reusable interpreter library rather than a one-off, testing whether Milestone 8's toolkit actually generalises past the language it was extracted from.</p>
        <h3>Concepts</h3>
        <p>Modelling effects (movement, turning) as data rather than immediate action, sequencing as an explicit AST node, and an interpreter built to be steppable — pausable and resumable — rather than only run-to- completion.</p>
        <h3>Design</h3>
        <p>A robot program is a sequence of commands: <code>forward</code>, <code>turn</code>, <code>repeat</code>. The key design decision, distinct from Milestone 4's config interpreter: <strong>a step of execution returns a new interpreter state rather than performing a side effect directly</strong> — which is what makes "run one step, inspect the robot, run the next step" possible at all, the same shape a debugger or an animation needs.</p>
        <h3>Implementation</h3>
        <pre><code>{"(define-ast-types\n  (forward-e (distance))\n  (turn-e (degrees))\n  (seq-e (commands)))\n\n(struct robot-state (x y heading) #:transparent)\n\n;; step: one command, one state transition -- NOT run to completion\n(define (step cmd state)\n  (match cmd\n    [(forward-e d)\n     (define rad (degrees->radians (robot-state-heading state)))\n     (struct-copy robot-state state\n       [x (+ (robot-state-x state) (* d (cos rad)))]\n       [y (+ (robot-state-y state) (* d (sin rad)))])]\n    [(turn-e deg)\n     (struct-copy robot-state state\n       [heading (+ (robot-state-heading state) deg)])]))\n\n;; run-all: fold step over a sequence -- built FROM step, not the reverse\n(define (run-all cmds state)\n  (foldl step state cmds))\n"}</code></pre>
        <p><strong><code>run-all</code> is built from <code>step</code>, via <code>foldl</code></strong> — the same reduce-a-list idiom Milestone 2 established — rather than <code>step</code> being a special case carved out of a monolithic <code>run-all</code>. This ordering is the entire design decision: a toolkit consumer who only wants "run the whole program" gets it for free by folding, and one who wants a stepper — a debugger, or Milestone 12's game DSL animating a robot's movement one frame at a time — has the primitive they actually need without <code>run-all</code> having to be refactored to expose it later.</p>
        <h4>Verified</h4>
        <pre className="plain"><code>{"> (define prog (list (forward-e 10) (turn-e 90) (forward-e 5)))\n> (run-all prog (robot-state 0 0 0))\n#(struct:robot-state 10.0 3.061616997868383e-16 90)\n"}</code></pre>
        <p>The near-zero <code>y</code> after moving forward along heading 0 is ordinary floating-point noise from <code>cos</code>/<code>sin</code>, not a bug — worth flagging explicitly the first time a course result looks "almost but not quite" a clean number, since it will happen again and is not worth chasing.</p>
        <div className="cmp">
          <h5>A typical language vs. Racket</h5>
          <p>Building a steppable interpreter in most languages means restructuring around an explicit state machine or continuations from the start, because an ordinary recursive "run to completion" evaluator has no natural pause point. Here, the steppable interpreter <em>is</em> the natural one — folding a list of discrete state transitions was always the obvious shape once effects are represented as data rather than performed directly, and "run everything" turns out to be the special case, not the other way around.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 10</h5>
          <ol>
            <li>Add <code>repeat-e (count body)</code>, re-running a sub-sequence <code>count</code> times, and extend <code>step</code> to expand it (a <code>repeat</code> step's "state transition" is running <code>run-all</code> on its body <code>count</code> times).</li>
            <li>Write a stepper loop that prints the robot's state after every single step of a program using <code>repeat</code>, confirming the intermediate states inside the loop are visible, not just the final one.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 10 — open after trying</summary>
          <pre><code>{";; in step's match:\n[(repeat-e count body)\n (for/fold ([s state]) ([_ (in-range count)])\n   (run-all body s))]"}</code></pre>
          <p>Because <code>repeat-e</code>'s handling is itself just another case inside <code>step</code>, calling <code>run-all</code>, it composes with the stepper for free — a step-by-step loop over a program containing a <code>repeat</code> naturally sees every state inside the repetition, without <code>repeat</code> needing any special-case stepper support of its own.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why is <code>step</code> the primitive and <code>run-all</code> the derived function, rather than the reverse?</li>
          <li>What would need to change about this design to support "undo the last step"?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 11</span>Compiling instead of interpreting</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-right" src={img2.src} alt="The Mewlang cat, raising a paw in celebration" width="120" loading="lazy" />
          Take the same arithmetic the config interpreter (Milestone 4) walks as an AST at run time, and instead expand it directly into ordinary Racket code at compile time — no AST, no walk, nothing left at run time but the arithmetic itself — and measure the difference honestly.
        </p>
        <h3>Concepts</h3>
        <p>Macro-based compilation as the limit case of "code is data": a macro that does not merely check or transform syntax, but expands straight into the final, optimised form.</p>
        <h3>Implementation</h3>
        <pre><code>{";; interpreted (Milestone 4's shape): a runtime AST walk, every time\n(define (eval-expr e)\n  (cond\n    [(num-e? e) (num-e-val e)]\n    [(add-e? e) (+ (eval-expr (add-e-l e)) (eval-expr (add-e-r e)))]\n    [(mul-e? e) (* (eval-expr (mul-e-l e)) (eval-expr (mul-e-r e)))]))\n\n;; compiled: a macro expanding STRAIGHT into Racket arithmetic --\n;; nothing named num-e, add-e or mul-e exists at run time at all\n(define-syntax (compile-expr stx)\n  (syntax-case stx (my-add my-mul)\n    [(_ (my-add l r)) #'(+ (compile-expr l) (compile-expr r))]\n    [(_ (my-mul l r)) #'(* (compile-expr l) (compile-expr r))]\n    [(_ n) #'n]))\n"}</code></pre>
        <h4>Verified: the same computation, 5 million times, both ways</h4>
        <pre className="plain"><code>{"interpreted: 297.6 ms\ncompiled:    9.1 ms\nspeedup: 32.7x\n"}</code></pre>
        <p>The interpreted version pays, on every single evaluation, for: a struct-predicate check per node, a function call per node, and — the part most people forget to count — walking back down through <code>eval-expr</code>'s own call stack for every nested sub-expression. The compiled version pays none of that at run time, because <code>(my-add (my-mul 2 3) (my-mul 4 5))</code> expanded, once, at compile time, into <code>(+ (* 2 3) (* 4 5))</code> — plain Racket arithmetic that Racket's own compiler then optimises exactly as if a person had written it that way from the start, because by the time the compiler sees it, that is indistinguishable from what a person wrote.</p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>This is the sharpest version of this course's whole argument. An interpreter written in nearly any language can be fast or slow depending on how carefully it is written — Perl's course measured a 4× win from removing an unnecessary object allocation in its own hot path, real but modest. A 32× difference from choosing compilation over interpretation for the <em>identical</em> source language is only available because Racket's macro system can expand a DSL's syntax into genuinely different target code, chosen deliberately, rather than only ever building and later walking an intermediate representation. The honest cost, visible immediately in the code above: <code>compile-expr</code> only handles two operators and gives noticeably worse error messages than Milestone 6's <code>syntax-parse</code> version would for a malformed expression — real compilers spend enormous effort on exactly the error-quality work this minimal example skipped.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 11</h5>
          <ol>
            <li>Extend <code>compile-expr</code> to handle variables and <code>let</code>, expanding a DSL <code>let</code> directly into a Racket <code>let</code> — confirm the compiled version still outperforms an equivalent interpreter extended the same way.</li>
            <li>Rewrite <code>compile-expr</code> using <code>syntax-parse</code> instead of <code>syntax-case</code>, restoring Milestone 6's quality of error message while keeping the compilation strategy. Confirm a malformed expression now fails at compile time with a specific message, not a cryptic one.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 11 — open after trying</summary>
          <pre><code>{"(define-syntax (compile-expr stx)\n  (syntax-case stx (my-add my-mul my-let)\n    [(_ (my-add l r)) #'(+ (compile-expr l) (compile-expr r))]\n    [(_ (my-mul l r)) #'(* (compile-expr l) (compile-expr r))]\n    [(_ (my-let ([name val]) body)) #'(let ([name (compile-expr val)]) (compile-expr body))]\n    [(_ n) (if (identifier? #'n) #'n #'n)]))"}</code></pre>
          <p>A DSL variable reference and a numeric literal both fall through to the same final clause here, because by the time they are compiled variables, they are ordinary Racket identifiers already bound by an expanded <code>let</code> — the compilation strategy means a "variable lookup" is not something <code>compile-expr</code> implements at all, it is something Racket's own variable resolution already does, for free, once the expansion is in place.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>What, precisely, does the interpreted version pay for on every single evaluation that the compiled version does not pay at all?</li>
          <li>Why is a macro-expanded DSL's error message quality a genuine, separate engineering cost from its runtime performance?</li>
          <li>Is compiling always the right choice over interpreting? What did Milestone 10's stepper need that a pure compilation strategy would make harder to build?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 12</span>Tooling and the game DSL</h2>
        <h3>Goal</h3>
        <p>Add real tests, confirm the languages built across this course behave well with ordinary Racket tooling, package the toolkit properly, and build one final, capstone language — a simple game-description DSL — using every piece built across the last eleven milestones at once.</p>
        <h3>Concepts</h3>
        <p><code>rackunit</code> testing for macros specifically (not just ordinary functions), editor/tooling integration, and packaging via <code>info.rkt</code>.</p>
        <h3>Implementation</h3>
        <pre><code>{"#lang racket\n(require rackunit \"finance/main.rkt\")\n\n(test-case \"unknown account type is a compile-time error\"\n  (check-exn exn:fail:syntax?\n    (lambda () (expand #'(account bad bogus-type 100)))))\n"}</code></pre>
        <pre className="plain"><code>{"$ raco test tests/\n--------------------\nname:       unknown account type is a compile-time error\nlocation:   tests/finance-tests.rkt:5:2\n--------------------\n1 success(es) 0 failure(s) 0 error(s) 0 test(s) skipped\n"}</code></pre>
        <p><strong>Testing that a macro <em>rejects</em> bad input</strong> needs one genuinely new idiom: <code>expand</code>, called directly on a piece of quoted syntax, runs macro expansion without also running the resulting program — <code>check-exn</code> then asserts that expansion itself raised, which is the only way to test a compile-time failure using a normal, run-time test framework at all, since the failure you are testing for happens before the "test" as ordinarily understood would even begin.</p>
        <h4>The capstone: a minimal game DSL</h4>
        <pre><code>{"#lang racket\n(define-ast-types\n  (move-e (dx dy))\n  (say-e (text))\n  (wait-e (frames)))\n\n;; reuses Milestone 10's step/run-all shape directly -- a script is a\n;; sequence of effects, exactly like the robot DSL's was\n(struct game-state (x y log) #:transparent)\n\n(define (game-step cmd state)\n  (match cmd\n    [(move-e dx dy) (struct-copy game-state state\n                       [x (+ (game-state-x state) dx)]\n                       [y (+ (game-state-y state) dy)])]\n    [(say-e text) (struct-copy game-state state\n                     [log (cons text (game-state-log state))])]\n    [(wait-e _) state]))\n\n(define script (list (move-e 5 0) (say-e \"arrived\") (move-e 0 3)))\n(foldl game-step (game-state 0 0 '()) script)\n"}</code></pre>
        <h4>Verified</h4>
        <pre className="plain"><code>{"> (foldl game-step (game-state 0 0 '()) script)\n#(struct:game-state 5 3 (\"arrived\"))\n"}</code></pre>
        <p>Notice what this capstone did <em>not</em> need to reinvent: <code>define-ast-types</code> from Milestone 8, the step/fold shape from Milestone 10, <code>match</code> from Section 2.4. A genuinely new small language, built in well under fifty lines, because the toolkit built across this course actually generalised — the entire point <code>langfac</code> existed to prove.</p>
        <h4>Common mistakes in Milestones 9–12</h4>
        <div className="warn">
          <ul>
            <li><strong>Referring to an in-progress language by its eventual collection name</strong> before it is actually registered — "collection not found" means exactly that, not a typo elsewhere.</li>
            <li><strong>Putting the reader anywhere except <code>lang/reader.rkt</code></strong> for the bare <code>#lang name</code> form specifically.</li>
            <li><strong>Forgetting that re-exporting a whole language conflicts with anything you deliberately overrode</strong> — <code>except-out</code> is not optional once you rename <code>#%module-begin</code>.</li>
            <li><strong>Building <code>run-all</code> first and trying to extract a stepper from it later</strong>, rather than building the single-step primitive first and folding for the common case.</li>
            <li><strong>Assuming a macro-based compiler needs no error-message work</strong> because the performance win is the headline — it is a separate, real cost, paid for separately.</li>
          </ul>
        </div>
        <h3>Repository state after Milestone 12</h3>
        <pre className="plain"><code>{"langfac/\n├── labeled.rkt, stats.rkt, robot.rkt, config-interp.rkt\n├── macros/ast-types.rkt\n├── finance/\n│   ├── main.rkt, lang/reader.rkt, info.rkt     Milestone 9: real #lang\n│   └── compiled.rkt                              Milestone 11\n├── robot-dsl/\n│   └── interp.rkt                                 Milestone 10: step/run-all\n├── game/\n│   └── capstone.rkt                                Milestone 12\n└── tests/                                            12 files\n"}</code></pre>
        <pre className="plain"><code>{"$ raco test tests/\nAll tests passed.\n$ raco pkg install --link -n finance ./finance\n$ racket budget.finance\nsavings: $8000.0\nchecking: $2400.0\n$ git commit -am \"milestones 9-12: a real #lang, the robot DSL, compiling, the game capstone\"\n"}</code></pre>
        <footer className="end">
          <p>Instalment 24 of the five-course curriculum. Next, and last for Racket, and for the whole curriculum: the advanced phase, a final challenge with acceptance criteria and a withheld solution, the full knowledge check, the README and GitHub description, portfolio notes and interview questions.</p>
        </footer>
         <Link className="button" href="/racket-course/milestones/end/">Continue</Link> 
      </div>
    </div>
  );
}
