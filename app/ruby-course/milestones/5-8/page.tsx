import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Ruby Milestones 5–8 — The Engine, Failure, Plugins, Real Work",
};

export default function Page() {
  return (
    <div className="theme-ruby">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 8 · Course 2 (Ruby) · Milestones 5–8</p>
          <h1>An engine, a theory of failure, plugins, and something that actually fetches</h1>
          <p className="lede">The AST gets an interpreter with middleware, failures become a design rather than a rescue,
                third parties get to add verbs, and the steps start talking to a real socket and a real store.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>All code was run on Ruby 3.2.3. The suite is now 28 tests and 74 assertions, all passing, including tests
                that start a real HTTP server on a real socket. Three of the bugs described below are ones I actually
                hit while writing this, kept because each one teaches something the working code cannot.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 5</span>The execution engine</h2>
        <h3>Goal</h3>
        <p>Replace the one-line <code>reduce</code> with a real interpreter: a context that flows through the pipeline,
            a result object recording what happened to every step, and a middleware chain so cross-cutting concerns
            (logging, timing, dry runs, retries) are not hard-coded into the runner.</p>
        <h3>Concepts</h3>
        <p>Immutable context objects, the middleware pattern built by folding lambdas, returning results instead of
            raising, and keeping a library free of logging dependencies.</p>
        <h3>Design</h3>
        <p>Three decisions worth arguing about before any code.</p>
        <p><strong>1. What flows between steps?</strong> Milestone 2 passed the bare return value, which meant a step
            could not know the pipeline's name, whether this was a dry run, or what earlier steps had learned. So we
            introduce a <code>Context</code>: payload plus run metadata. It is immutable, and a step "changes" it by
            producing a new one.</p>
        <p><strong>2. Does a failure raise or return?</strong> Both, but the default is to return. A
            <code>RunResult</code> that says <code>ok: false</code> and carries every step's outcome is much more useful
            to a CLI, a dashboard or a test than an exception, because a failed run still has partial results worth
            showing. <code>run!</code> exists for callers who prefer the exception.</p>
        <p><strong>3. Where do logging, timing and dry runs live?</strong> Not in the runner. Each is a
            <em>middleware</em>: a callable wrapping each step, exactly like Rack. This is the difference between a
            runner you can extend and one you have to edit.</p>
        <pre className="plain"><code>{"  Runner#run\n     │\n     ├── Validator (milestone 4)\n     │\n     └── for each step:\n            Logging ─► DryRun ─► Timing ─► [Retry] ─► registry.fetch(step).call\n            └──────────── the chain, built once ─────────────┘\n\n  each step produces a StepResult; the run produces a RunResult"}</code></pre>
        <h3>Implementation</h3>
        <h4>The context</h4>
        <pre><code>{"  # Context is what flows between steps. It carries the payload plus\n  # everything the runner and the steps need to know about the run, and it\n  # is immutable: a step produces a new context rather than editing one.\n  Context = Data.define(:payload, :pipeline, :step_index, :dry_run, :vars, :log) do\n    def self.start(pipeline:, payload: nil, dry_run: false, log: Log.null, vars: {})\n      new(payload: payload, pipeline: pipeline, step_index: 0,\n          dry_run: dry_run, vars: vars.freeze, log: log)\n    end\n\n    def current_step = pipeline.steps[step_index]\n    def advance(value) = with(payload: value, step_index: step_index + 1)\n    def set(key, value) = with(vars: vars.merge(key => value).freeze)\n    def dry_run? = dry_run\n  end\n"}</code></pre>
        <ul>
          <li><code>def self.start</code> inside a <code>Data.define</code> block is a class method on the generated
                class. The block is a class body, so <code>def self.x</code> works exactly as it would anywhere else.
            </li>
          <li><code>advance</code> and <code>set</code> both return <em>new</em> contexts via <code>with</code>.
                Nothing is mutated, so a middleware that keeps a reference to the context it saw cannot be surprised
                later.</li>
          <li><code>dry_run?</code> exists because <code>Data</code> generates <code>dry_run</code> but Ruby
                convention wants a question mark on a boolean reader. Adding the alias costs one line and makes every
                call site read properly.</li>
        </ul>
        <h4>The middleware chain, and the fold that builds it</h4>
        <pre><code>{"  module Middleware\n    Logging = lambda do |step, context, nxt|\n      context.log.info(\"-> #{step} at #{step.location}\")\n      nxt.call(step, context)\n    end\n\n    DryRun = lambda do |step, context, nxt|\n      if context.dry_run?\n        context.log.info(\"would run #{step}\")\n        context.payload\n      else\n        nxt.call(step, context)\n      end\n    end\n\n    Timing = lambda do |step, context, nxt|\n      started = Process.clock_gettime(Process::CLOCK_MONOTONIC)\n      value = nxt.call(step, context)\n      elapsed = Process.clock_gettime(Process::CLOCK_MONOTONIC) - started\n      context.log.info(format(\"%s took %.1fms\", step.name, elapsed * 1000))\n      value\n    end\n\n    # Build folds the middleware list into one callable, innermost last.\n    def self.build(list, &innermost)\n      list.reverse.reduce(innermost) do |nxt, layer|\n        ->(step, context) { layer.call(step, context, nxt) }\n      end\n    end\n  end\n"}</code></pre>
        <p><code>Middleware.build</code> is four lines and repays reading slowly, because the same fold appears in Rack,
            in Rails' middleware stack, in Plug, and in Express.</p>
        <ol>
          <li>Start with the innermost behaviour (the block: actually run the step).</li>
          <li>Walk the middleware list <strong>backwards</strong>.</li>
          <li>For each layer, produce a new two-argument lambda that calls that layer, handing it the chain built so
                far as its <code>nxt</code>.</li>
          <li>The final value is a single callable that, when invoked, threads through every layer in the original
                order.</li>
        </ol>
        <p>The reversal is the part people get wrong. Folding forwards would run the list inside-out, so your logging
            middleware would report after the step instead of before it. If you ever need to convince yourself, build
            the chain with two layers that print on the way in and on the way out, and watch the nesting.</p>
        <p>Each middleware is a plain <code>lambda</code>, not a class, because the contract is one method. A lambda is
            also strict about arity, so passing a two-argument one is an immediate <code>ArgumentError</code> rather
            than a confusing <code>nil</code>.</p>
        <p><strong>Note what <code>DryRun</code> does:</strong> it returns <code>context.payload</code> without calling
            <code>nxt</code>, which short-circuits everything inside it, including the actual step. A middleware that
            can decline to continue is what makes caching, authorisation and dry runs possible in the same mechanism.
        </p>
        <h4>The runner</h4>
        <pre><code>{"    def run(pipeline, payload = nil, dry_run: false, vars: {})\n      Validator.new(@registry).validate!(pipeline) if @validate\n\n      context = Context.start(pipeline: pipeline, payload: payload,\n                              dry_run: dry_run, log: @log, vars: vars)\n      counter = AttemptCounter.new\n      chain = build_chain(pipeline, counter)\n      results = []\n\n      pipeline.steps.each_with_index do |step, index|\n        step_context = context.with(step_index: index)\n        counter.reset\n        started = now\n\n        begin\n          value = chain.call(step, step_context)\n          results << StepResult.new(step: step, status: :ok, value: value, error: nil,\n                                    attempts: counter.count, seconds: now - started)\n          context = step_context.advance(value)\n        rescue StandardError => e\n          error = e.is_a?(Error) ? e : StepFailed.new(step, e)\n          results << StepResult.new(step: step, status: :failed, value: nil, error: error,\n                                    attempts: counter.count, seconds: now - started)\n          handle_failure(pipeline, error, step, context)\n          run_always(pipeline, context)\n          return RunResult.new(pipeline: pipeline, ok: false, results: results.freeze,\n                               payload: nil, error: error)\n        end\n      end\n\n      run_always(pipeline, context)\n      RunResult.new(pipeline: pipeline, ok: true, results: results.freeze,\n                    payload: context.payload, error: nil)\n    end\n"}</code></pre>
        <ul>
          <li><code>Process.clock_gettime(Process::CLOCK_MONOTONIC)</code> rather than <code>Time.now</code>. A
                monotonic clock cannot go backwards when NTP adjusts the system time, which is the correct tool for
                measuring durations in any language.</li>
          <li>The chain is built <strong>once per run</strong>, not per step. Middleware composition is not free, and
                doing it in the loop would be a silly cost.</li>
          <li><code>e.is_a?(Error) ? e : StepFailed.new(step, e)</code> — our own errors pass through unwrapped,
                foreign errors get wrapped with the step that caused them. We will revisit whether that is the right
                call in Milestone 8, where it produces a mildly surprising result in a test.</li>
        </ul>
        <h4>The logger we did not take from a gem</h4>
        <pre><code>{"  # A deliberately tiny logger so the gem has no logging dependency and\n  # tests can assert on lines. Anything responding to #info/#warn/#error\n  # can be used instead, including Ruby's Logger.\n  class Log\n    def self.null = new(nil)\n    def self.to_io(io) = new(io)\n\n    def initialize(io) = @io = io\n\n    def info(msg)  = write(\"INFO \", msg)\n    def warn(msg)  = write(\"WARN \", msg)\n    def error(msg) = write(\"ERROR\", msg)\n\n    private\n\n    def write(level, msg)\n      return if @io.nil?\n\n      @io.puts(\"#{level} #{msg}\")\n    end\n  end\n"}</code></pre>
        <p>Twelve lines instead of a dependency, and the important one is <code>Log.null</code>: an object that
            satisfies the interface and does nothing. <strong>The null object pattern is how you avoid
                <code>if @log</code> scattered through a codebase</strong>, and it is why the runner can call
            <code>context.log.info</code> unconditionally. A library that forces a logging framework on its users is a
            library people wrap to make it quiet.</p>
        <h3>Running it</h3>
        <pre className="plain"><code>{"--- a real run ---\nINFO  -> fetch(\"papers\", from: \"arxiv\") at demo5.rb:10\nINFO  fetch took 0.0ms\nINFO  -> dedupe() at demo5.rb:11\nINFO  dedupe took 0.0ms\nINFO  -> summarize(max_words: 2) at demo5.rb:12\nINFO  summarize took 0.0ms\nresearch: ok (3 steps)\n  ✓ fetch(\"papers\", from: \"arxiv\") 0.0ms\n  ✓ dedupe() 0.0ms\n  ✓ summarize(max_words: 2) 0.0ms\n[\"papers: alpha\", \"papers: beta\"]\n\n--- the same pipeline as a dry run: nothing executes ---\nINFO  -> fetch(\"papers\", from: \"arxiv\") at demo5.rb:10\nINFO  would run fetch(\"papers\", from: \"arxiv\")\nINFO  -> dedupe() at demo5.rb:11\nINFO  would run dedupe()\n...\n"}</code></pre>
        <p>The log lines carry <code>demo5.rb:10</code>, the user's own file and line, which is the Milestone 4 source
            locations paying a second dividend. When a pipeline misbehaves in production, the log points at the line
            that wrote the step.</p>
        <div className="exercise">
          <h5>Exercise 5</h5>
          <p>Write a <code>Memoize</code> middleware that skips a step when it has already been run with the same
                input during this process, returning the cached value. Then add <code>Runner#use(middleware)</code> so
                users can add their own.</p>
          <p>Requirements: the cache key must include the step name, its options and the input; a dry run must never
                populate the cache; the cache must be per-Runner, not global; and there must be a way to see cache hits
                in the log. Write a test proving a second run does not call the underlying step.</p>
          <p>Think carefully about the key. What happens if the input is a 50,000-element array, or an object that
                does not define <code>hash</code>?</p>
        </div>
        <details>
          <summary>Solution 5 — open after trying</summary>
          <pre><code>{"class Runner\n  def use(middleware)\n    @middleware = @middleware + [middleware]\n    self\n  end\nend\n\nmodule Middleware\n  # Memoize skips a step whose (name, options, input) it has seen before.\n  class Memoize\n    def initialize = @cache = {}\n\n    def call(step, context, nxt)\n      return nxt.call(step, context) if context.dry_run?\n\n      key = cache_key(step, context.payload)\n      if @cache.key?(key)\n        context.log.info(\"cache hit for #{step.name}\")\n        return @cache[key]\n      end\n\n      @cache[key] = nxt.call(step, context)\n    end\n\n    def size = @cache.size\n\n    private\n\n    def cache_key(step, payload)\n      [step.name, step.args, step.options, digest(payload)]\n    end\n\n    # Hash a large payload rather than keeping it alive in the key.\n    def digest(payload)\n      Digest::SHA256.hexdigest(Marshal.dump(payload))\n    rescue TypeError\n      # Not everything is marshalable (procs, IO objects, sockets).\n      # Refusing to cache is always safe; guessing is not.\n      :uncacheable\n    end\n  end\nend\n"}</code></pre>
          <p>Four things this exercise is really about.</p>
          <ul>
            <li><strong>A middleware can be an object, not just a lambda.</strong> Anything with
                    <code>#call(step, context, nxt)</code> works, and an object is what you need when the middleware has
                    state. The duck-typed contract pays off again.</li>
            <li><strong>Keys must not hold the payload alive.</strong> Using the array itself as a Hash key keeps
                    every input in memory for the process lifetime, which is a memory leak wearing a cache costume.
                    Hashing the content fixes the retention; note that it also costs a full serialisation, so for large
                    inputs the "optimisation" may be slower than the step.</li>
            <li><strong><code>:uncacheable</code> as a fallback is the important line.</strong> <code>Marshal.dump</code> raises on procs, IO objects and anything with a singleton class, which in
                    this project includes a payload containing a <code>Store</code>. Rescuing and declining to cache is
                    correct; rescuing and using <code>object_id</code> as the key would produce a cache that returns the
                    wrong answer, which is much worse than no cache.</li>
            <li><strong><code>use</code> returns <code>self</code> and rebuilds the array rather than
                        mutating</strong> the frozen default constant. <code>DEFAULT_MIDDLEWARE</code> is frozen
                    precisely so this mistake raises instead of corrupting every future Runner.</li>
          </ul>
          <p>One honest caveat on the design: memoizing steps assumes they are pure, and <code>save_to</code>
                certainly is not. A production version would let a step declare <code>cacheable false</code>, which is
                another thing the plugin metadata of Milestone 7 makes easy.</p>
        </details>
        <h4>Experiment</h4>
        <p>Reverse the middleware order in <code>DEFAULT_MIDDLEWARE</code> so it reads
            <code>[Timing, DryRun, Logging]</code> and run a dry run. Timing now wraps the dry-run short circuit, so you
            get timings for steps that never ran, and the logging line never appears at all because <code>DryRun</code>
            returns before reaching it. Middleware order is semantics, not style, and this is the cheapest possible way
            to feel that.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 5</h5>
          <ul>
            <li><strong>Folding the middleware list forwards.</strong> The chain runs inside-out and nothing behaves
                    as written.</li>
            <li><strong>Forgetting to call <code>nxt</code></strong> in a middleware that was supposed to be
                    transparent. The step silently never runs, and the pipeline still reports success.</li>
            <li><strong>Mutating the context</strong> instead of using <code>with</code>. With <code>Data</code> you
                    get a <code>FrozenError</code>; with a plain class you get action at a distance.</li>
            <li><strong>Using <code>Time.now</code> for durations.</strong> Use the monotonic clock.</li>
            <li><strong>Building the chain inside the step loop.</strong> Works, wastes time proportional to steps ×
                    middleware.</li>
            <li><strong>Taking a logging gem as a dependency.</strong> A twelve-line null-object logger and a
                    documented interface serve your users better.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does <code>Middleware.build</code> reverse the list before folding?</li>
          <li>What can a middleware do that a callback list cannot?</li>
          <li>Why does <code>run</code> return a result rather than raising, and when would you want
                <code>run!</code>?</li>
          <li>What is the null object pattern and where does it appear here?</li>
          <li>Why is the context immutable, given that we reassign it in the loop anyway?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 6</span>Failure as a design, not a rescue</h2>
        <h3>Goal</h3>
        <p><code>retry_on</code> with backoff, <code>when_failed</code> handlers that receive the real error, and
            <code>always</code> for cleanup. All declared in the DSL, all inspectable before running.</p>
        <h3>Concepts</h3>
        <p>Retry as middleware, policies as data, exception chaining and the limits of <code>cause</code>, and handlers
            that must not be able to break the run.</p>
        <h3>Design</h3>
        <p>The retry logic could live in the runner as an <code>if</code>. Making it middleware instead means it
            composes with everything else, can be turned off by not adding it, and can be replaced by a user with a
            smarter one. And the <em>policy</em> is separate from the <em>mechanism</em>:</p>
        <pre><code>{"  RetryPolicy = Data.define(:errors, :times, :backoff, :base_delay) do\n    def self.build(errors, times: 3, backoff: :exponential, base_delay: 0.01)\n      errors = Array(errors)\n      errors = [StandardError] if errors.empty?\n      errors.each do |klass|\n        unless klass.is_a?(Class) && klass <= Exception\n          raise ArgumentError, \"retry_on expects exception classes, got #{klass.inspect}\"\n        end\n      end\n      new(errors: errors.freeze, times: times, backoff: backoff, base_delay: base_delay)\n    end\n\n    def delay_for(attempt)\n      case backoff\n      when :none        then 0\n      when :linear      then base_delay * attempt\n      when :exponential then base_delay * (2**(attempt - 1))\n      else raise ArgumentError, \"unknown backoff #{backoff.inspect}\"\n      end\n    end\n\n    def to_s = \"retry #{errors.join(', ')} up to #{times}x (#{backoff})\"\n  end\n"}</code></pre>
        <ul>
          <li><code>klass {'<'}= Exception</code> uses <code>Module#{'<'}=</code>, which answers "is this class the same
                as or a subclass of". It is the correct way to ask, and it catches the common mistake of writing
                <code>retry_on :timeout</code> or <code>retry_on "IOError"</code> at <em>build</em> time with a clear
                message.</li>
          <li>The policy is a value, so <code>pipeline.retry_policy.to_s</code> works without running anything:
                <code>"retry IOError up to 4x (exponential)"</code>. Being able to ask a pipeline about its failure
                behaviour is exactly the kind of thing the AST exists for.</li>
          <li><code>base_delay</code> is configurable mainly so tests can use 10 ms instead of a second. A retry
                policy you cannot speed up is a retry policy your test suite will not exercise.</li>
        </ul>
        <h4>The retry middleware</h4>
        <pre><code>{"    def self.retrying(policy, counter)\n      lambda do |step, context, nxt|\n        attempt = 0\n        begin\n          attempt += 1\n          counter.count = attempt\n          nxt.call(step, context)\n        rescue *policy.errors => e\n          raise if attempt >= policy.times\n\n          delay = policy.delay_for(attempt)\n          context.log.warn(\"#{step.name} failed (#{e.class}), retry #{attempt}/#{policy.times - 1} in #{delay}s\")\n          sleep(delay)\n          retry\n        end\n      end\n    end\n"}</code></pre>
        <p><code>rescue *policy.errors</code> splats an array of exception classes into the rescue clause, which is how
            you make the caught set dynamic. <code>retry</code> restarts the <code>begin</code> block, so no loop is
            needed.</p>
        <div className="note">
          <h5>The one mutable object in the system</h5>
          <p>The <code>counter</code> exists because the middleware knows how many attempts happened and the runner is
                the one building the <code>StepResult</code>. Everything else here is immutable, and threading the count
                back through a frozen context is impossible by construction.</p>
          <pre className="plain"><code>{"class AttemptCounter\n  attr_accessor :count\n  def initialize = @count = 1\n  def reset = @count = 1\nend"}</code></pre>
          <p>When an immutable design needs one channel for information flowing backwards, the honest move is a small,
                explicitly scoped mutable object with a name that says what it is, rather than making the whole context
                mutable "just in case". It is reset before each step and read immediately after, so its lifetime is one
                step.</p>
        </div>
        <h3>Two bugs I hit writing this</h3>
        <div className="warn">
          <h5>Bug 1: a local variable silently shadowed a DSL verb</h5>
          <pre className="bad"><code>{"flaky = Automation.define(\"flaky\") do\n  retry_on IOError, times: 4\n  flaky                       # <- intended: the step named :flaky\nend"}</code></pre>
          <p>The pipeline came out with <strong>zero steps</strong>. The reason is a Ruby parsing rule with no
                equivalent in most languages: <em>once the parser has seen an assignment to a name, that name is a local
                    variable for the rest of the scope</em>, even before the assignment executes. Inside the block,
                <code>flaky</code> resolved to the (still <code>nil</code>) local variable rather than to a method call,
                so no message was ever sent to the builder.</p>
          <p>Three ways to avoid it, in order of preference: name the variable differently
                (<code>flaky_pipeline</code>); write the verb with explicit parentheses (<code>flaky()</code>), which
                forces a method call; or write it with an explicit receiver. This is a permanent hazard of bare-word
                DSLs, and it is worth a line in your gem's documentation, because the failure is completely silent.</p>
        </div>
        <div className="warn">
          <h5>Bug 2: <code>cause</code> is only set when you actually raise</h5>
          <p>The failure handler was receiving our wrapper instead of the real error, producing this:</p>
          <pre className="bad"><code>{"notified: explode failed with step explode failed: the summariser is down (RuntimeError)"}</code></pre>
          <p>The handler is called with <code>error.cause || error</code>, and <code>cause</code> was
                <code>nil</code>. Ruby sets <code>cause</code> automatically when an exception is
                <strong>raised</strong> inside a <code>rescue</code> block, and our runner <em>constructs</em> <code>StepFailed.new(step, e)</code> without raising it. Constructing is not raising, so no chain was
                recorded.</p>
          <p>The fix is to stop relying on a mechanism that only works on one path:</p>
          <pre><code>{"  class StepFailed < Error\n    attr_reader :step, :original\n\n    # `cause` is only set by Ruby when you raise inside a rescue, and we\n    # often build this object without raising it, so we keep the original\n    # ourselves.\n    def initialize(step, original)\n      @step = step\n      @original = original\n      super(\"step #{step.name} failed: #{original.message} (#{original.class})\")\n    end\n  end"}</code></pre>
          <p>The general lesson is worth more than the fix: when your library wraps exceptions, keep the original in a
                field you control. Implicit chaining is a convenience for code that raises immediately, not a substitute
                for explicit data.</p>
        </div>
        <h4>Handlers that cannot break the run</h4>
        <pre><code>{"    def handle_failure(pipeline, error, step, context)\n      handler = pipeline.handler(:when_failed)\n      return unless handler\n\n      handler.callable.call(error.respond_to?(:original) ? error.original : error, step)\n    rescue StandardError => e\n      context.log.error(\"when_failed handler itself raised #{e.class}: #{e.message}\")\n    end\n"}</code></pre>
        <p>A <code>when_failed</code> handler is user code, running at the worst possible moment, and it frequently does
            something that can fail (send an email, post to Slack). If it raises and we do not catch it, the user sees
            the notifier's error instead of the actual failure, which is the single most annoying bug class in
            error-handling code. Catch it, log it, and preserve the original failure. The same applies to
            <code>always</code>.</p>
        <h3>Running it</h3>
        <pre className="plain"><code>{"--- retries, with backoff ---\n\"retry IOError up to 4x (exponential)\"\nINFO  -> flaky() at demo5.rb:39\nWARN  flaky failed (IOError), retry 1/3 in 0.01s\nWARN  flaky failed (IOError), retry 2/3 in 0.02s\nINFO  flaky took 30.4ms\nflaky: ok (1 steps)\n  ✓ flaky() 30.4ms after 3 attempts\n\"worked on attempt 3\"\n\n--- failure: handlers run, the result is returned not raised ---\n  notified: explode failed with the summariser is down\n  cleanup ran, payload=nil\nguarded: FAILED (1 steps)\n  ✗ explode() Automation::StepFailed: step explode failed: the summariser is down (RuntimeError)\nfalse\n:explode\nAutomation::StepFailed\n"}</code></pre>
        <p>Exponential backoff visible in the delays (0.01 then 0.02), the attempt count carried into the result, the
            handler receiving the original <code>RuntimeError</code> rather than our wrapper, <code>always</code>
            running after the failure, and the run returning rather than raising.</p>
        <div className="exercise">
          <h5>Exercise 6</h5>
          <ol>
            <li><strong>Per-step retry.</strong> Allow a step to override the pipeline policy:
                    <code>fetch from: url, retry: {'{'} times: 5, backoff: :linear {'}'}</code>. The <code>retry:</code> key
                    must not be passed on to the step implementation.</li>
            <li><strong>Continue on error.</strong> Add <code>continue_on_error</code> to the DSL so a failed step
                    records its failure and the pipeline proceeds with <code>nil</code> as the payload. The
                    <code>RunResult</code> must report <code>ok: false</code> while still containing every step's
                    result.</li>
            <li><strong>Timeouts.</strong> Add <code>timeout: 2</code> per step. Research
                    <code>Timeout.timeout</code> before using it, and write down in a comment why it is dangerous.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 6 — open after trying</summary>
          <p><strong>1. Per-step retry.</strong> The cleanest place is the step node, not the options passed through.
                Strip the key when building:</p>
          <pre><code>{"    def __add_step__(verb, args, options)\n      retry_spec = options.delete(:retry)\n      policy = retry_spec && ::Automation::RetryPolicy.build(\n        retry_spec[:errors] || [], **retry_spec.except(:errors)\n      )\n      @steps << ::Automation::AST::StepNode.new(\n        name: verb, args: args.freeze, options: options.freeze,\n        retry_policy: policy, location: __where__\n      )\n      self\n    end\n"}</code></pre>
          <p>Then the runner builds a chain per step rather than per run, using the step's policy if present and the
                pipeline's otherwise. Note the cost: chains are no longer built once, so either cache them by policy or
                accept the allocation. Caching by policy value is easy precisely because <code>RetryPolicy</code> is a
                <code>Data</code> with value equality.</p>
          <p><strong>2. Continue on error.</strong> Add a handler node of kind <code>:continue_on_error</code>, and in
                the runner's rescue:</p>
          <pre><code>{"          if pipeline.handler(:continue_on_error)\n            context = step_context.advance(nil)\n            next\n          end\n"}</code></pre>
          <p>with the failure still recorded in <code>results</code> and <code>ok</code> computed at the end as
                <code>results.none? {'{'} |r| r.status == :failed {'}'}</code>. The subtlety is that later steps now receive
                <code>nil</code>, so this feature is only safe for pipelines whose steps tolerate it. A better design
                lets each step declare whether it can start from nothing, which is again plugin metadata.</p>
          <p><strong>3. Timeouts, and why they are dangerous.</strong></p>
          <pre><code>{"    # Timeout.timeout raises inside whatever the step happens to be doing,\n    # at an arbitrary point. If that point is inside a file write, an open\n    # socket handshake, or an `ensure` that is releasing a lock, you can be\n    # left with corrupted state that no rescue can repair. Use it only for\n    # work you can safely abandon, and prefer a library's own timeout\n    # (Net::HTTP's open_timeout/read_timeout) whenever one exists.\n    Timeouts = lambda do |step, context, nxt|\n      seconds = step.options[:timeout]\n      next nxt.call(step, context) unless seconds\n\n      Timeout.timeout(seconds, Automation::StepTimeout) { nxt.call(step, context) }\n    end\n"}</code></pre>
          <p>This is the Ruby version of a lesson from the Go course: you cannot safely stop arbitrary code from the
                outside. Go's answer is cooperative cancellation via <code>context</code>; Ruby's <code>Timeout</code>
                is the opposite and injects an exception at an arbitrary instruction boundary. Our HTTP client takes the
                right approach instead, by passing <code>open_timeout</code> and <code>read_timeout</code> down to
                <code>Net::HTTP</code>, where the library knows which points are safe.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why is the retry policy a <code>Data</code> object rather than three keyword arguments to the runner?
            </li>
          <li>What does <code>rescue *policy.errors</code> do?</li>
          <li>When does Ruby set <code>Exception#cause</code>, and why did that not help us?</li>
          <li>Why must a <code>when_failed</code> handler's own exception be caught?</li>
          <li>Explain the zero-step pipeline bug in one sentence.</li>
          <li>Why is <code>Timeout.timeout</code> a last resort?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 7</span>Plugins, and preferring real methods to ghosts
        </h2>
        <h3>Goal</h3>
        <p>Third parties add verbs by writing a class. Those verbs become <em>real methods</em> on the DSL builder
            rather than <code>method_missing</code> ghosts, which lets us catch typos at build time with a spelling
            suggestion and a line number.</p>
        <h3>Concepts</h3>
        <p>Class macros built with <code>define_method</code>, the <code>inherited</code> hook, registry metadata,
            generating methods per registry generation, <code>Module#prepend</code> for instrumentation, and
            <code>did_you_mean</code>.</p>
        <h3>Design</h3>
        <p>A block is the right way to register a two-line step. It is the wrong way to register one with five
            documented options, defaults, and a docstring. So plugins get a class:</p>
        <pre><code>{"  class Plugin\n    class << self\n      def option(name, required: false, default: nil, doc: nil)\n        name = name.to_sym\n        options_spec[name] = { required: required, default: default, doc: doc }\n\n        # A real method, generated once, that reads this option.\n        define_method(name) { @options.fetch(name, default) }\n        name\n      end\n\n      def options_spec = @options_spec ||= {}\n\n      # Subclasses start with their own spec, seeded from the parent's, so\n      # inheritance works the way people expect.\n      def inherited(subclass)\n        super\n        subclass.instance_variable_set(:@options_spec, options_spec.dup)\n      end\n\n      def register!(registry = Automation.registry)\n        registry.register(step_name, self, spec: options_spec, doc: @doc)\n      end\n\n      # The registry calls this. It builds an instance per invocation, so a\n      # step may hold state during one call without leaking between runs.\n      def call(input, *args, **options)\n        new(options).call(input, *args)\n      end\n    end\n  end\n"}</code></pre>
        <p>Which makes a plugin read like this:</p>
        <pre><code>{"class Summarize < Automation::Plugin\n  step_name :summarize\n  doc \"Shorten each item to a few words.\"\n\n  option :max_words, default: 10, doc: \"how many words to keep\"\n  option :suffix,    default: \"...\", doc: \"appended to truncated items\"\n\n  def call(items)\n    items.map do |item|\n      words = item.split\n      words.size > max_words ? words.first(max_words).join(\" \") + suffix : item\n    end\n  end\nend\nSummarize.register!\n"}</code></pre>
        <p><strong><code>option</code> does two things at once</strong>, and that duality is the whole class-macro
            pattern: it records metadata the validator and the documentation generator can read, and it defines an
            instance method so <code>max_words</code> works inside <code>call</code>. This is how
            <code>attr_accessor</code>, Rails' <code>validates</code>, RSpec's <code>let</code> and ActiveRecord's
            associations all work. Once you have written one, the entire Ruby ecosystem becomes less mysterious.</p>
        <pre className="plain"><code>{"p Automation.registry.spec_for(:summarize).keys   # => [:max_words, :suffix]\np Summarize.instance_methods(false).sort          # => [:call, :max_words, :suffix]\n"}</code></pre>
        <p>The readers really exist. They are not ghosts, they appear in <code>instance_methods</code>, and an editor or
            documentation tool can see them.</p>
        <ul>
          <li><code>class {'<'}{'<'} self</code> opens the singleton class, so everything inside defines class methods.
                It is the idiomatic way to write several of them together.</li>
          <li><code>inherited</code> is a hook Ruby calls when a class is subclassed. Copying the parent's spec there
                is what makes <code>class Fetch {'<'} BaseFetch</code> inherit options. <strong>Always call
                    <code>super</code> in a hook</strong>: someone else's library may have its own
                <code>inherited</code> in the chain, and omitting <code>super</code> silently breaks them.</li>
          <li><code>Plugin.call</code> constructs a fresh instance per invocation, so a step can use instance
                variables freely during one call without leaking between runs. Cheap, and it removes a whole class of
                bug.</li>
        </ul>
        <h4>The validator gets better information</h4>
        <pre><code>{"      spec = @registry.spec_for(step.name)\n      return problems_from_spec(step, spec) if spec\n\n      params = @registry.fetch(step.name).parameters\n      missing_keywords(step, params) + unknown_keywords(step, params)\n"}</code></pre>
        <p>Milestone 4's validator reflected on a callable's <code>parameters</code>, which works for lambdas and fails
            for class-based steps whose <code>call</code> takes <code>**options</code>. Now a declared spec is used when
            present and reflection is the fallback. <strong>Declared metadata beats inferred metadata whenever it
                exists</strong>, and offering both means neither kind of step author is penalised.</p>
        <h4>Real verb methods instead of method_missing</h4>
        <pre><code>{"  # Real methods beat method_missing: they are faster, they show up in\n  # instance_methods, and anything they do NOT catch is a typo we can\n  # report immediately. We build one subclass per registry generation.\n  def self.builder_class_for(registry)\n    @builder_classes ||= {}\n    cached = @builder_classes[registry.object_id]\n    return cached[:class] if cached && cached[:generation] == registry.generation\n\n    klass = Class.new(ASTBuilder)\n    registry.known.each do |verb|\n      klass.send(:define_method, verb) do |*args, **options, &_block|\n        __add_step__(verb, args, options)\n      end\n    end\n\n    @builder_classes[registry.object_id] = { class: klass, generation: registry.generation }\n    klass\n  end\n"}</code></pre>
        <p><code>Class.new(ASTBuilder)</code> creates an anonymous subclass at run time; classes are objects, so this is
            an ordinary constructor call. Every registered verb gets a real method on it, and the class is cached until
            the registry changes, which is what the <code>generation</code> counter on the registry tracks.</p>
        <p>Now <code>method_missing</code> only sees names that are <em>not</em> steps, which turns it from a catch-all
            into a precise error detector:</p>
        <pre><code>{"    def method_missing(verb, *args, **options, &block)\n      return @outer.__send__(verb, *args, **options, &block) if @outer.respond_to?(verb, true)\n\n      # Not a registered step (those are real methods now) and not\n      # something the caller can answer: in strict mode this is a typo.\n      if @strict\n        ::Kernel.raise ::Automation::UnknownStep.new(\n          verb, @registry.known, location: __where__(2), suggestion: __suggest__(verb)\n        )\n      end\n\n      __add_step__(verb, args, options)\n    end\n\n    def __suggest__(verb)\n      ::DidYouMean::SpellChecker.new(dictionary: @registry.known.map(&:to_s))\n                                .correct(verb.to_s).first\n    end\n"}</code></pre>
        <pre className="plain"><code>{"--- a typo is caught while building, with a suggestion ---\ndemo7.rb:49: unknown step :summarise; did you mean summarize? (known: fetch, summarize)\n"}</code></pre>
        <p>File, line, the mistake, and the fix, at build time, from a dynamic language. <code>DidYouMean</code> ships
            with Ruby (it is what produces "did you mean?" on ordinary <code>NoMethodError</code>s) and its
            <code>SpellChecker</code> is a public class you can point at any dictionary.</p>
        <p><code>strict: false</code> remains available and is what the data-only path and the validator tests use:
            build anything, check later. Two modes, one for authoring and one for tooling.</p>
        <div className="cmp">
          <h5>define_method vs method_missing, revisited with evidence</h5>
          <table className="grid">
            <tbody>
              <tr>
                <th></th>
                <th>Generated methods</th>
                <th><code>method_missing</code></th>
              </tr>
              <tr>
                <td>Appears in <code>instance_methods</code></td>
                <td>Yes</td>
                <td>No</td>
              </tr>
              <tr>
                <td>Typo detection</td>
                <td>Immediate, with suggestion</td>
                <td>Impossible: everything is accepted</td>
              </tr>
              <tr>
                <td>Dispatch cost</td>
                <td>Normal</td>
                <td>Full failed lookup first</td>
              </tr>
              <tr>
                <td>Needs names in advance</td>
                <td>Yes, at build time</td>
                <td>No</td>
              </tr>
              <tr>
                <td>Where we use it</td>
                <td>All registered steps</td>
                <td>Only the fallback: delegation and typo reporting</td>
              </tr>
            </tbody>
          </table>
          <p>The combination is the point. Generate what you know; keep <code>method_missing</code> for the genuinely
                open cases and for turning the unknown into a good error message rather than a silent acceptance.</p>
        </div>
        <h4>Instrumenting a plugin you do not own</h4>
        <pre><code>{"module CountCalls\n  def self.counts = @counts ||= Hash.new(0)\n\n  def call(input, *args, **options)\n    CountCalls.counts[step_name] += 1   # self is the class here, not an instance\n    super\n  end\nend\nSummarize.singleton_class.prepend(CountCalls)\n"}</code></pre>
        <pre className="plain"><code>{"[true, true, true]\n{:summarize=>3}\n"}</code></pre>
        <p><code>prepend</code> inserts a module <em>before</em> the class in the ancestor chain, so
            <code>CountCalls#call</code> runs first and <code>super</code> continues to the original. Prepending to
            <code>singleton_class</code> targets the class method. This is how modern Ruby does monkey-patching: instead
            of reopening a class and aliasing the old method away (the <code>alias_method_chain</code> era), you prepend
            a module and call <code>super</code>, which composes cleanly with other people doing the same thing.</p>
        <div className="warn">
          <h5>A third bug I hit: the silent failed run</h5>
          <p>My first version of that module wrote <code>self.class.step_name</code>. Inside a method prepended to the
                <em>singleton</em> class, <code>self</code> is the class itself, so <code>self.class</code> is
                <code>Class</code>, which has no <code>step_name</code>, and every invocation raised
                <code>NoMethodError</code>.</p>
          <p>The counter printed <code>{'{'}{'}'}</code> and nothing else looked wrong, because the runner had dutifully
                turned each failure into a <code>RunResult</code> with <code>ok: false</code> that my demo never
                checked. <strong>Returning results instead of raising is the right design and it has this cost</strong>:
                an ignored result is an ignored error. The fix in the demo was to print
                <code>results.map(&:ok?)</code>, and the fix in real code is to make ignoring a result awkward,
                either by using <code>run!</code> at the top level or by having your CLI exit non-zero on
                <code>ok == false</code>.</p>
        </div>
        <h4>The registry documents itself</h4>
        <pre className="plain"><code>{"  fetch      from* since=\"1d\"\n  summarize  max_words=10 suffix=\"...\"    Shorten each item to a few words.\n"}</code></pre>
        <p>Generated by walking <code>registry.known</code> and reading each entry's spec and doc. Twelve lines of code,
            and it is the beginning of <code>automation --help</code>, of a generated reference page, and of editor
            completion data. <strong>Metadata you declare once can be used by things you have not written yet</strong>,
            which is the entire argument for the plugin class over a block.</p>
        <div className="exercise">
          <h5>Exercise 7</h5>
          <ol>
            <li><strong>Types.</strong> Add <code>option :max_words, type: Integer</code> and have the validator
                    report a type mismatch at build time, with the same file and line treatment.</li>
            <li><strong>Loading.</strong> Implement <code>Automation.load_plugins(dir)</code> that requires every
                    <code>.rb</code> in a directory and registers any <code>Automation::Plugin</code> subclass it finds.
                    Handle a plugin file that raises on load without taking down the process, and report which file
                    failed.</li>
            <li><strong>Deprecation.</strong> Add <code>deprecated_option :old_name, use: :new_name</code> that
                    accepts the old key, warns once per process with the caller's location, and forwards the value.</li>
          </ol>
          <p>For part 2, look at <code>ObjectSpace</code> or at the <code>inherited</code> hook and decide which you
                prefer, then write down why.</p>
        </div>
        <details>
          <summary>Solution 7 — open after trying</summary>
          <p><strong>1. Types.</strong> One extra key in the spec and one extra check:</p>
          <pre><code>{"      def problems_from_spec(step, spec)\n        type_errors = step.options.filter_map do |key, value|\n          expected = spec.dig(key, :type)\n          next if expected.nil? || value.is_a?(expected)\n\n          \"#{step.location}: step #{step.name} option #{key.inspect} \" \\\n            \"should be #{expected}, got #{value.class}\"\n        end\n        # ... plus the missing/unknown checks\n      end\n"}</code></pre>
          <p><code>filter_map</code> (Ruby 2.7+) maps and drops <code>nil</code>s in one pass, which is exactly the
                shape of "collect the problems". Note that <code>value.is_a?(expected)</code> handles subclasses
                correctly, so <code>type: Numeric</code> accepts an Integer.</p>
          <p><strong>2. Loading.</strong> The <code>inherited</code> hook is the better answer:</p>
          <pre><code>{"  class Plugin\n    def self.inherited(subclass)\n      super\n      subclass.instance_variable_set(:@options_spec, options_spec.dup)\n      Automation.plugin_classes << subclass\n    end\n  end\n\n  def self.load_plugins(dir, registry: self.registry)\n    before = plugin_classes.size\n    failures = {}\n\n    Dir.glob(File.join(dir, \"*.rb\")).sort.each do |file|\n      require File.expand_path(file)\n    rescue ScriptError, StandardError => e\n      failures[file] = e          # one bad plugin must not stop the rest\n    end\n\n    plugin_classes.drop(before).each { |klass| klass.register!(registry) }\n    failures\n  end\n"}</code></pre>
          <p>Why the hook rather than <code>ObjectSpace.each_object(Class)</code>: the hook is exact, cheap and
                ordered, while <code>ObjectSpace</code> walks every class in the process, is slow, and is not available
                on all Ruby implementations (JRuby restricts it). Reaching for <code>ObjectSpace</code> is usually a
                sign that you missed a hook.</p>
          <p>Two details that matter more than they look. <code>rescue</code> catches <code>ScriptError</code> as well
                as <code>StandardError</code>, because a plugin with a syntax error raises <code>SyntaxError</code>,
                which is <em>not</em> a <code>StandardError</code> and would otherwise escape. And returning the
                failures rather than logging them lets the CLI decide whether a broken plugin is fatal.</p>
          <p><strong>3. Deprecation.</strong></p>
          <pre><code>{"      def deprecated_option(old, use:)\n        option(old)\n        define_method(old) do\n          unless self.class.warned_about?(old)\n            warn \"#{caller_locations(1, 1).first}: option #{old} is deprecated, use #{use}\"\n          end\n          @options.fetch(old) { send(use) }\n        end\n      end\n"}</code></pre>
          <p>"Warn once per process" needs somewhere to record what has been warned about, and the class object is the
                natural place. Including the caller's location in the message is what turns a deprecation warning from
                noise into something a user can act on, and it is the same <code>caller_locations</code> technique as
                Milestone 4.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>What two things does the <code>option</code> class macro do, and why both?</li>
          <li>Why must <code>inherited</code> call <code>super</code>?</li>
          <li>How does the builder know when its generated methods are stale?</li>
          <li>Why does <code>method_missing</code> now produce better errors than it did in Milestone 3?</li>
          <li>What does <code>prepend</code> do that reopening the class and aliasing does not?</li>
          <li>Why does the validator prefer a declared spec over reflection?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 8</span>Real work: HTTP, a store, and tests that mean
            something</h2>
        <h3>Goal</h3>
        <p>The four shipped steps do real work. <code>fetch</code> makes an HTTP request, <code>save_to</code> writes to
            a persistent store, <code>summarize</code> calls a pluggable summariser, and every one of them is tested
            against real behaviour rather than a mock of our own code.</p>
        <h3>Concepts</h3>
        <p>Configuration as an explicit frozen object, adapters as a seam, mapping transport failures onto one error
            class, and testing with a real server instead of a stub.</p>
        <h3>Design</h3>
        <p><strong>Config is read once and frozen.</strong> A step that reads <code>ENV</code> itself cannot be tested
            twice with different settings, and in a library it is worse: your users cannot configure you without setting
            global state.</p>
        <pre><code>{"  Config = Data.define(:http_timeout, :user_agent, :max_redirects, :store_path, :summarizer) do\n    def self.from_env(env = ENV, **overrides)\n      new(\n        http_timeout: Float(overrides[:http_timeout] || env.fetch(\"AUTOMATION_HTTP_TIMEOUT\", 5)),\n        user_agent: overrides[:user_agent] || env.fetch(\"AUTOMATION_USER_AGENT\", \"automation/#{VERSION}\"),\n        max_redirects: Integer(overrides[:max_redirects] || env.fetch(\"AUTOMATION_MAX_REDIRECTS\", 3)),\n        store_path: overrides[:store_path] || env.fetch(\"AUTOMATION_STORE\", \"knowledge_base.pstore\"),\n        summarizer: overrides[:summarizer] || Summarizers::Truncate\n      ).freeze\n    end\n  end\n"}</code></pre>
        <p><code>env = ENV</code> as a parameter is the small move that makes this testable: a test passes a Hash.
            <code>Float(...)</code> and <code>Integer(...)</code> are the strict conversion methods, which raise on
            garbage rather than returning <code>0</code> like <code>to_i</code> does. <code>"abc".to_i</code> is
            <code>0</code>, and a timeout of zero seconds discovered in production is a bad afternoon.</p>
        <h4>The HTTP adapter, and why it collapses errors</h4>
        <pre><code>{"    def request(uri, config)\n      Net::HTTP.start(uri.host, uri.port,\n                      use_ssl: uri.scheme == \"https\",\n                      open_timeout: config.http_timeout,\n                      read_timeout: config.http_timeout) do |http|\n        http.request(Net::HTTP::Get.new(uri, \"User-Agent\" => config.user_agent))\n      end\n    rescue Errno::ECONNREFUSED, Net::OpenTimeout, Net::ReadTimeout, SocketError => e\n      # Map every transport failure onto one class, so retry_on has\n      # something simple to match.\n      raise HttpError.new(uri.to_s, \"transport\", e.message)\n    end\n"}</code></pre>
        <p>Net::HTTP can raise at least a dozen different exceptions from unrelated hierarchies:
            <code>Errno::ECONNREFUSED</code>, <code>SocketError</code>, <code>Net::OpenTimeout</code>,
            <code>OpenSSL::SSL::SSLError</code> and more. Asking your users to write
            <code>retry_on Errno::ECONNREFUSED, SocketError, Net::OpenTimeout, ...</code> is asking them to maintain a
            list that will be wrong. <strong>An adapter's job is to present one coherent failure model</strong>, so we
            map the lot onto <code>HttpError</code> and users write <code>retry_on Automation::HttpError</code>.</p>
        <p>Also note <code>open_timeout</code> and <code>read_timeout</code> passed to the library rather than wrapping
            the call in <code>Timeout.timeout</code>. The library knows where it is safe to give up; a generic timeout
            does not.</p>
        <h4>The store</h4>
        <pre><code>{"  # Store is the knowledge base. PStore ships with Ruby, is transactional,\n  # and needs no native extension, which makes it a good default. For\n  # anything with concurrent writers or queries, swap in SQLite behind this\n  # same three-method interface.\n  class Store\n    def initialize(path)\n      @pstore = PStore.new(path, true) # true: thread-safe\n    end\n\n    def put(collection, records)\n      @pstore.transaction do\n        existing = @pstore[collection] || []\n        @pstore[collection] = existing + Array(records)\n      end\n      Array(records).size\n    end\n\n    def all(collection)\n      @pstore.transaction(true) { @pstore[collection] || [] } # true: read-only\n    end\n  end\n"}</code></pre>
        <p><code>PStore</code> is a standard-library key-value store with transactions, backed by <code>Marshal</code>.
            It costs nothing to depend on, it is genuinely transactional, and the three-method interface means replacing
            it with SQLite later touches one file. That is the point of an adapter: <strong>choose the boring
                dependency, behind a seam.</strong></p>
        <p>Its real limits, which belong in your README rather than in a surprise: the whole collection is read and
            written on every transaction, so it does not scale past a few megabytes, and there are no queries.</p>
        <h4>The summariser contract</h4>
        <pre><code>{"  # A summarizer is anything responding to #call(text, max_words:). Keeping\n  # it that small means a local model, an API client, or a stub in a test\n  # are all interchangeable.\n  module Summarizers\n    Truncate = lambda do |text, max_words:|\n      words = text.to_s.split\n      words.size <= max_words ? text.to_s : \"#{words.first(max_words).join(' ')}…\"\n    end\n\n    FirstSentence = lambda do |text, max_words:|\n      sentence = text.to_s.split(/(?<=[.!?])\\s/).first.to_s\n      Truncate.call(sentence.empty? ? text : sentence, max_words: max_words)\n    end\n  end\n"}</code></pre>
        <p>Two lambdas and a documented signature, instead of an abstract base class. Anyone can pass their own,
            including one that calls a language model. The regex uses a lookbehind <code>(?{'<'}=[.!?])</code> to split
            <em>after</em> sentence-ending punctuation while keeping it, which is a technique Course 3 will use rather
            more aggressively.</p>
        <h3>Testing against a real server</h3>
        <pre><code>{"# FakeServer is a real HTTP server on a real socket, which is usually a\n# better test double than stubbing Net::HTTP: it exercises the client code\n# rather than replacing it.\nclass FakeServer\n  attr_reader :port, :requests\n\n  def initialize(status: \"200 OK\", body: \"[]\", content_type: \"application/json\")\n    @server = TCPServer.new(\"127.0.0.1\", 0)\n    @port = @server.addr[1]\n    @requests = []\n    @thread = Thread.new { serve(status, body, content_type) }\n  end\n\n  def url(path = \"/\") = \"http://127.0.0.1:#{port}#{path}\"\nend\n"}</code></pre>
        <p><code>TCPServer.new("127.0.0.1", 0)</code> asks the kernel for any free port, and
            <code>@server.addr[1]</code> reports which one it chose. That is the trick that makes socket-based tests
            safe to run in parallel and on any machine: never hard-code a port.</p>
        <p>Why a real server rather than stubbing <code>Net::HTTP</code>: a stub tests that you called the method you
            think you called. A real socket tests the URL you built, the headers you sent, the redirect you followed,
            the timeout you set and the error you mapped. It costs about thirty lines and catches an entire category of
            bug that mocks are structurally unable to see.</p>
        <pre><code>{"  def test_the_user_agent_is_sent\n    url = @server.url   # @server would resolve on the builder, not on us\n    run_it(pipeline { fetch from: url })\n    assert_match(%r{User-Agent: automation/}, @server.requests.first)\n  end\n\n  def test_an_http_error_becomes_a_step_failure_with_the_status\n    server = FakeServer.new(status: \"503 Service Unavailable\", body: \"down for maintenance\")\n    result = run_it(pipeline { fetch from: server.url })\n\n    refute result.ok?\n    # Our own errors are not wrapped in StepFailed; the step they came from\n    # is still recoverable from the result.\n    assert_kind_of Automation::HttpError, result.error\n    assert_equal \"503\", result.error.status\n    assert_equal :fetch, result.failed_step.name\n  ensure\n    server.stop\n  end\n\n  def test_retry_on_transport_errors_eventually_gives_up\n    dead = \"http://127.0.0.1:1/unreachable\"\n    started = Process.clock_gettime(Process::CLOCK_MONOTONIC)\n\n    result = run_it(pipeline do\n      retry_on Automation::HttpError, times: 3, backoff: :linear, base_delay: 0.01\n      fetch from: dead\n    end)\n\n    refute result.ok?\n    assert_equal 3, result.results.first.attempts\n    assert_operator Process.clock_gettime(Process::CLOCK_MONOTONIC) - started, :<, 2\n  end\n\n  def test_dry_run_touches_no_network\n    server = FakeServer.new(body: \"[]\")\n    run_it(pipeline { fetch from: server.url }, dry_run: true)\n\n    assert_empty server.requests\n  ensure\n    server.stop\n  end\n"}</code></pre>
        <p><code>test_dry_run_touches_no_network</code> is my favourite test in the project. The claim "dry run does not
            execute anything" is easy to assert weakly (the payload is unchanged) and hard to assert convincingly.
            Checking that the server received <strong>zero requests</strong> is proof rather than evidence, and it would
            survive a refactor that moved the dry-run check somewhere wrong.</p>
        <p>The retry test asserts a time bound as well as the attempt count, because a retry policy with the wrong units
            (seconds instead of milliseconds) passes every correctness assertion and makes your suite take three
            minutes.</p>
        <div className="warn">
          <h5>The fourth bug: instance variables do not survive <code>instance_eval</code></h5>
          <p>Three of those tests failed the first time with <code>undefined method 'url' for nil:NilClass</code>. The
                cause:</p>
          <pre className="bad"><code>{"run_it(pipeline { fetch from: @server.url })   # @server is nil here"}</code></pre>
          <p>Inside the DSL block, <code>self</code> is the builder, so <code>@server</code> reads the
                <em>builder's</em> instance variable, which does not exist and is therefore <code>nil</code>. Recall the
                rules from Milestone 3, now complete:</p>
          <table className="grid">
            <tbody>
              <tr>
                <th>Inside an <code>instance_eval</code> block</th>
                <th>Works?</th>
                <th>Why</th>
              </tr>
              <tr>
                <td>Local variables</td>
                <td>Yes</td>
                <td>The block is a closure over its defining scope</td>
              </tr>
              <tr>
                <td>Method calls on the caller</td>
                <td>Only via our delegation</td>
                <td><code>self</code> changed</td>
              </tr>
              <tr>
                <td>Instance variables</td>
                <td><strong>No</strong></td>
                <td><code>@x</code> always means "on <code>self</code>", and <code>self</code> changed</td>
              </tr>
              <tr>
                <td>Constants</td>
                <td>Yes</td>
                <td>Resolved lexically, not through <code>self</code></td>
              </tr>
            </tbody>
          </table>
          <p>Instance variables are the nastiest of the four because they fail silently: Ruby returns <code>nil</code>
                for an unset one rather than raising. The fix is to bind what you need to a local before the block
                (<code>url = @server.url</code>), and the deeper point is that this is a permanent tax your users will
                pay too. Document it.</p>
        </div>
        <h3>End to end</h3>
        <pre className="plain"><code>{"--- real run ---\nresearch: ok (4 steps)\n  ✓ fetch(from: \"http://127.0.0.1:36755/papers.json\") 2.4ms\n  ✓ filter(field: :topic, matching: \"AI\") 0.0ms\n  ✓ summarize(field: :abstract, max_words: 8) 0.0ms\n  ✓ save_to(collection: \"papers\") 0.2ms\n[{:title=>\"Scaling laws for neural language models\",\n  :topic=>\"AI\",\n  :abstract=>\"We study empirical scaling laws for language model performance on the cross-entropy loss.\",\n  :summary=>\"We study empirical scaling laws for language model…\"}]\n\nstored: 1 record(s) in the knowledge base\n"}</code></pre>
        <p>Real HTTP over a real socket, a real filter, a pluggable summariser, and a record on disk, driven by this:
        </p>
        <pre><code>{"  research = Automation.define(\"research\") do\n    retry_on Automation::HttpError, times: 3, backoff: :exponential, base_delay: 0.05\n    fetch from: url\n    filter field: :topic, matching: \"AI\"\n    summarize field: :abstract, max_words: 8\n    save_to collection: \"papers\"\n    when_failed { |error, step| warn \"  ! #{step.name}: #{error.message}\" }\n  end\n"}</code></pre>
        <p>That is the Part 0 sketch, working, eight milestones in.</p>
        <div className="exercise">
          <h5>Exercise 8</h5>
          <ol>
            <li><strong>Pagination.</strong> Extend <code>fetch</code> to follow
                    <code>Link: {'<'}...{'>'}; rel="next"</code> headers up to a configurable page limit, accumulating
                    records. Test it with a fake server that serves two pages.</li>
            <li><strong>A second store.</strong> Write <code>Automation::JSONStore</code> with the same three
                    methods, backed by a JSON file. Then write a <em>shared contract test</em> that runs the same
                    assertions against both stores, and run it for each.</li>
            <li><strong>Idempotent saves.</strong> Give <code>save_to</code> a <code>key:</code> option naming a
                    field, so re-running a pipeline updates existing records instead of appending duplicates. Prove it
                    with a test that runs the same pipeline twice and asserts the count.</li>
          </ol>
          <p>Part 2 is the one to spend time on: a contract test is how you keep two implementations honest, and it is
                a technique most people meet far too late.</p>
        </div>
        <details>
          <summary>Solution 8 — open after trying</summary>
          <p><strong>2. The shared contract test</strong>, in minitest, using a module of tests included by two small
                classes:</p>
          <pre><code>{"# test/store_contract.rb\nmodule StoreContract\n  def test_put_then_all_returns_the_records\n    @store.put(\"papers\", [{ id: 1 }, { id: 2 }])\n    assert_equal [{ id: 1 }, { id: 2 }], @store.all(\"papers\")\n  end\n\n  def test_put_appends_rather_than_replacing\n    @store.put(\"papers\", { id: 1 })\n    @store.put(\"papers\", { id: 2 })\n    assert_equal 2, @store.count(\"papers\")\n  end\n\n  def test_unknown_collection_is_empty_not_an_error\n    assert_equal [], @store.all(\"nothing_here\")\n  end\n\n  def test_records_survive_a_new_instance\n    @store.put(\"papers\", { id: 1 })\n    assert_equal 1, reopen.count(\"papers\")\n  end\nend\n\nclass PStoreTest < Minitest::Test\n  include StoreContract\n\n  def setup\n    @dir = Dir.mktmpdir\n    @store = Automation::Store.new(File.join(@dir, \"kb.pstore\"))\n  end\n\n  def reopen = Automation::Store.new(File.join(@dir, \"kb.pstore\"))\n  def teardown = FileUtils.remove_entry(@dir)\nend\n\nclass JSONStoreTest < Minitest::Test\n  include StoreContract\n\n  def setup\n    @dir = Dir.mktmpdir\n    @store = Automation::JSONStore.new(File.join(@dir, \"kb.json\"))\n  end\n\n  def reopen = Automation::JSONStore.new(File.join(@dir, \"kb.json\"))\n  def teardown = FileUtils.remove_entry(@dir)\nend\n"}</code></pre>
          <p>A module of test methods, included into several test classes, each of which supplies the setup: that is
                the whole technique, and it is why Ruby's mixins matter for testing as much as for production code.
                (RSpec spells it <code>shared_examples</code>, which is the same idea with more syntax.)</p>
          <p>The fourth test is the one that will actually catch a difference. <code>PStore</code> writes on every
                transaction; a naive <code>JSONStore</code> that keeps records in memory and writes in an
                <code>at_exit</code> hook passes the first three tests and fails this one. <strong>A contract test is
                    valuable in proportion to how much it tests behaviour the implementations could plausibly disagree
                    about.</strong></p>
          <p>One trap worth knowing: <code>JSON.parse</code> returns string keys, while <code>PStore</code>
                round-trips symbols through <code>Marshal</code>. So the contract exposes a genuine incompatibility, and
                you must decide the contract (probably: symbol keys, with
                <code>JSON.parse(..., symbolize_names: true)</code>) rather than letting each store do what is
                convenient. Discovering that disagreement before your users do is the entire point.</p>
        </details>
        <h4>Common mistakes in Milestone 8</h4>
        <div className="warn">
          <ul>
            <li><strong>Reading <code>ENV</code> inside a step.</strong> Untestable, unconfigurable, invisible.</li>
            <li><strong><code>to_i</code> on configuration.</strong> <code>"abc".to_i</code> is <code>0</code>; use
                    <code>Integer()</code> and <code>Float()</code>.</li>
            <li><strong>Letting library exceptions escape your adapter.</strong> Your users should not have to know
                    that you use Net::HTTP.</li>
            <li><strong>Wrapping a request in <code>Timeout.timeout</code></strong> instead of using the library's
                    own timeouts.</li>
            <li><strong>Hard-coding a port in a test.</strong> Use port 0 and ask what you got.</li>
            <li><strong>Stubbing your own HTTP client</strong> and concluding that your HTTP client works.</li>
            <li><strong>Using instance variables inside a DSL block.</strong> Silently <code>nil</code>.</li>
            <li><strong>Forgetting that the store swallows a failure</strong> when the run result is never checked.
                </li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does <code>Config.from_env</code> take <code>env</code> as a parameter?</li>
          <li>Why map every transport failure onto <code>HttpError</code>?</li>
          <li>What does <code>TCPServer.new("127.0.0.1", 0)</code> do, and why 0?</li>
          <li>Why is "the fake server received zero requests" a better dry-run assertion than "the payload is
                unchanged"?</li>
          <li>Which four kinds of name behave differently inside an <code>instance_eval</code> block?</li>
          <li>What would you change to replace PStore with SQLite, and what would you not change?</li>
        </ol>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Milestone 7 is the clearest case yet: <code>option :max_words, default: 10</code> declares metadata and
                generates a reader in one line, and the same declaration then drives validation, documentation and
                editor-facing introspection. In a static language you would either write the metadata twice (annotations
                plus fields) or generate code from a schema. The class-macro pattern is Ruby at its best, and once you
                can write one you can read Rails.</p>
          <p>Milestone 8 is where Ruby is merely adequate. The HTTP client is fine, <code>PStore</code> is a
                reasonable default with real limits, and none of this is better than what Python, Go or Java would give
                you. The gem's dependency-free standard library is genuinely pleasant; the performance is not a
                consideration here only because every step is I/O-bound.</p>
          <p>And the bug tally for these four milestones is the honest scoreboard: a silently shadowed verb, an
                exception chain that was never recorded, a prepended method whose <code>self</code> was not what I
                assumed, and three tests broken by instance variables inside <code>instance_eval</code>. Every one of
                them is a dynamic-language failure that a compiler would have caught or made impossible. The DSL is
                worth it; the tests are what make it safe to be worth it.</p>
        </div>
        <h3>Repository state after Milestone 8</h3>
        <pre className="plain"><code>{"automation/\n├── lib/automation/\n│   ├── errors.rb        Error, UnknownStep (with suggestions), StepFailed, InvalidPipeline\n│   ├── registry.rb      Entry metadata, generation counter\n│   ├── plugin.rb        class macros: step_name, option, doc, register!\n│   ├── steps.rb         Fetch, Filter, Summarize, SaveTo\n│   ├── ast.rb           StepNode, HandlerNode, PipelineNode\n│   ├── define.rb        ASTBuilder, generated verbs, strict mode, from_h\n│   ├── validator.rb     declared specs, reflection fallback, file:line\n│   ├── context.rb       Context, StepResult, Log\n│   ├── middleware.rb    Logging, DryRun, Timing, retrying, build\n│   ├── retry_policy.rb  RetryPolicy, AttemptCounter\n│   ├── runner.rb        RunResult, Runner, run!\n│   ├── config.rb        Config.from_env\n│   ├── http.rb          HTTP.get/get_json, HttpError\n│   ├── store.rb         PStore-backed knowledge base\n│   └── summarizers.rb   Truncate, FirstSentence\n└── test/\n    ├── test_step.rb, test_registry.rb, test_define.rb,\n    ├── test_validator.rb    build-time strictness and validation rules\n    └── test_steps.rb        FakeServer, end to end, retries, dry run, store\n"}</code></pre>
        <pre className="plain"><code>{"$ ruby -Ilib -Itest test/all.rb\n28 runs, 74 assertions, 0 failures, 0 errors, 0 skips\n$ git commit -am \"milestone 8: real adapters, config, and tests against a real socket\"\n"}</code></pre>
        <footer className="end">
          <p>Instalment 8 of the five-course curriculum. Next: Ruby Milestones 9–12, where testing gets its own DSL,
                pipelines learn to inspect and describe themselves, they start rewriting themselves at run time, and the
                whole thing ships as a gem with a CLI.</p>
        </footer>
        <Link className="button" href="/ruby-course/milestones/9-12/">Continue</Link>
      </div>
    </div>
  );
}
