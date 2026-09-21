import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Ruby Parts 0–2 — The Automation DSL, Setup, and the Language",
};

export default function Page() {
  return (
    <div className="theme-ruby">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 6 · Course 2 (Ruby) · Parts 0–2</p>
          <h1>A configuration file that is secretly a program</h1>
          <p className="lede">Go was about making concurrency visible. Ruby is about making the shape of a problem
                visible, by growing the language toward it until the solution reads like a description of itself.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Every Ruby example below was executed on Ruby 3.2.3 and the outputs are copied from those runs. The
                <code>gem</code> and <code>bundler</code> commands in Part 1 are standard, but my sandbox has no access
                to rubygems.org, so those specific commands are the one thing here I could not run. Everything else you
                can trust literally.</p>
        </div>
        <h2><span className="num">Course 2 · Part 0</span>What are we building?</h2>
        <h3>The final result</h3>
        <p>A gem called <code>automation</code>. By the end of the course, someone who has never seen your source can
            write this file:</p>
        <pre><code>{"Automation.define do\n  pipeline \"research\" do\n    fetch      \"papers\", from: \"arxiv:cs.AI\", since: \"7d\"\n    filter     topic: \"AI\", min_citations: 5\n    summarize  with: :local_model, max_words: 200\n    save_to    \"knowledge_base\"\n\n    retry_on Timeout::Error, times: 3, backoff: :exponential\n\n    when_failed do |error, step|\n      notify \"me\", subject: \"#{step.name} failed: #{error.message}\"\n    end\n  end\nend\n"}</code></pre>
        <p>and then drive it from Ruby or the command line:</p>
        <pre className="plain"><code>{"$ automation run research --dry-run\nresearch (4 steps, 1 failure handler)\n  ✓ fetch      papers from=arxiv:cs.AI since=7d      [dry run: would fetch ~40 items]\n  ✓ filter     topic=AI min_citations=5              [dry run: would keep ~12 items]\n  ✓ summarize  with=local_model max_words=200        [dry run: 12 summaries]\n  ✓ save_to    knowledge_base                        [dry run: would write 12 records]\n\n$ automation run research\nresearch: 4 steps, 12 items, 3.2s, saved to knowledge_base\n"}</code></pre>
        <p>But the interesting part is not that it runs. It is that the pipeline is a <em>data structure the program can
                examine and change while it is running</em>:</p>
        <pre><code>{"pipeline = Automation[\"research\"]\n\npipeline.to_h          # => a plain Hash: the whole pipeline as data\npipeline.steps.map(&:name)                    # => [:fetch, :filter, :summarize, :save_to]\npipeline.insert_before(:summarize, :deduplicate)\npipeline.around(:summarize) { |step, input| time_it(step) { step.call(input) } }\npipeline.validate!     # => raises with the line number of the offending step\n\nAutomation.register(:deduplicate) do |items, **opts|\n  items.uniq { |item| item[:title].downcase }\nend\n"}</code></pre>
        <p>A user of your gem adds a new verb to your language by calling <code>register</code>. No parser change, no
            code generation, no editing your source. That is the payoff, and it is what "the Ruby program should feel
            almost like a separate programming language" means in practice.</p>
        <h3>Why this project is interesting</h3>
        <p>Every team eventually writes a YAML file that wants to be a program. It starts as six keys; then someone
            needs a conditional, so you invent <code>if:</code>; then a loop, so you invent <code>for_each:</code>; then
            variables, so you invent <code>${'{'}{'}'}</code>; and within two years you have implemented a bad programming
            language with no debugger, no tests and error messages that say <code>line 340: unexpected key</code>.
            GitHub Actions, Kubernetes manifests, Ansible playbooks and CI configs are all at various stages of this
            journey.</p>
        <p>Ruby offers a different deal: <strong>start with a real programming language and make it look like
                configuration.</strong> Your users get loops, conditionals, variables, functions and a debugger for
            free, because they were there all along. The cost, which we will take seriously, is that a config file that
            is a program can do anything a program can do.</p>
        <h3>Why Ruby in particular</h3>
        <ul>
          <li><strong>Blocks are syntax, not objects you construct.</strong> <code>pipeline "research" do ... end</code> is ordinary method call syntax. Python's nearest equivalent
                needs a decorator, a <code>with</code> statement, or a lambda with different indentation rules;
                JavaScript needs <code>() ={'>'} {'{'}{'}'}</code> and a comma. The visual noise difference is small per line and
                decisive over a whole file.</li>
          <li><strong><code>instance_eval</code> changes what <code>self</code> means inside a block.</strong> That
                single feature is why you can write <code>fetch "papers"</code> instead of
                <code>config.fetch("papers")</code> or <code>p.fetch("papers")</code>. It is the difference between a
                builder API and something that reads like a language.</li>
          <li><strong>Method calls need no parentheses</strong>, so <code>filter topic: "AI"</code> is a method call
                that looks like a declaration.</li>
          <li><strong>Hash arguments without braces</strong> at the end of an argument list:
                <code>topic: "AI", min_citations: 5</code> is one Hash, and it reads like named fields.</li>
          <li><strong><code>method_missing</code> and <code>define_method</code></strong> let the set of available
                verbs be decided at run time, which is what makes plugins possible without a plugin framework.</li>
          <li><strong>Everything is open.</strong> Classes can be reopened, methods redefined, modules injected into
                an ancestor chain. Powerful and dangerous in exactly equal measure.</li>
        </ul>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Honestly, for the front end of this project Ruby is close to unmatched, and it is the reason Rails,
                RSpec, Rake, Chef, Puppet, Homebrew, Vagrant and Fastlane all exist in Ruby rather than elsewhere. A
                generation of tools with a DSL at the front chose Ruby for exactly the features above.</p>
          <p>Where Ruby is <em>not</em> the answer, and we will say so at the time:</p>
          <ul>
            <li><strong>If the pipelines come from untrusted users</strong>, an executable DSL is remote code
                    execution with extra steps, and a restricted data format (YAML, JSON, a real parser) is the correct
                    choice. We will build a data-only mode for this reason.</li>
            <li><strong>If you want errors before the program runs</strong>, Ruby cannot help much: a typo in a step
                    name is discovered when that line executes, which may be twenty minutes into a pipeline. Racket's
                    macros do this work at compile time with source locations, which is Course 5, and the contrast is
                    the sharpest in the whole curriculum.</li>
            <li><strong>If the work is CPU-bound</strong>, Ruby is slow and its default interpreter has a global VM
                    lock. Our steps are I/O-bound (HTTP, disk, model calls) so this barely matters, but it would matter
                    if summarising meant running the model yourself.</li>
            <li><strong>Python</strong> can get perhaps 80% of the way with decorators and context managers, and has
                    better data and ML libraries. If your steps are mostly pandas, use Python and accept a clumsier
                    front end.</li>
          </ul>
        </div>
        <h3>Architecture we are building toward</h3>
        <pre className="plain"><code>{"   user's pipeline file  (ordinary Ruby, looks like configuration)\n              │\n              │  blocks + instance_eval\n              ▼\n   ┌────────────────────┐\n   │   DSL surface      │   Automation.define, pipeline, step verbs\n   │   (Builder)        │   knows nothing about how steps run\n   └─────────┬──────────┘\n             │  builds, never executes\n             ▼\n   ┌────────────────────┐\n   │   AST              │   immutable Data nodes:\n   │   Pipeline/Step/   │   Pipeline(name, steps, handlers)\n   │   Handler          │   Step(name, args, options, source_location)\n   └─────────┬──────────┘\n             │\n             ├──────────────► Validator      unknown steps, bad options,\n             │                               reported with file:line\n             ├──────────────► Inspector      to_h, to_dot, dry run, diff\n             │\n             ▼\n   ┌────────────────────┐\n   │   Runner           │   walks the AST, threads a Context through,\n   │   (interpreter)    │   applies middleware, handles failure\n   └─────────┬──────────┘\n             │  looks up by name\n             ▼\n   ┌────────────────────┐        ┌──────────────────────────────┐\n   │   Step registry    │───────►│  Step implementations         │\n   │   (plugins)        │        │  fetch, filter, summarize,    │\n   └────────────────────┘        │  save_to, notify, user gems   │\n                                 └──────────────┬───────────────┘\n                                                ▼\n                                 adapters: HTTP, filesystem, SQLite,\n                                           summariser, notifier\n"}</code></pre>
        <p>The single most important line in that diagram is "builds, never executes". The DSL's only job is to turn a
            block into an AST. Everything else operates on the AST. That separation is what makes dry runs, validation,
            visualisation, instrumentation, self-modification and testing possible, and a DSL that executes as it parses
            can have none of them.</p>
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
              <td>A gem skeleton and a Step object</td>
              <td>objects, methods, bundler, project layout, irb</td>
            </tr>
            <tr>
              <td>2</td>
              <td><code>pipeline "x" do ... end</code> that runs</td>
              <td>blocks, yield, procs and lambdas, the builder pattern</td>
            </tr>
            <tr>
              <td>3</td>
              <td>Bare verbs inside the block</td>
              <td><code>instance_eval</code>, self, scope gates, what a clean DSL costs</td>
            </tr>
            <tr>
              <td>4</td>
              <td>Build an AST instead of executing</td>
              <td>immutable value objects, separating description from action</td>
            </tr>
            <tr>
              <td>5</td>
              <td>The execution engine</td>
              <td>the interpreter pattern, a Context, step results, logging</td>
            </tr>
            <tr>
              <td>6</td>
              <td><code>when_failed</code>, retries, timeouts</td>
              <td>exception hierarchies, ensure, retry, recoverable design</td>
            </tr>
            <tr>
              <td>7</td>
              <td>Steps registered at run time</td>
              <td><code>define_method</code>, <code>method_missing</code>, <code>respond_to_missing?</code></td>
            </tr>
            <tr>
              <td>8</td>
              <td>Steps that do real work</td>
              <td>HTTP, files, SQLite, pluggable summarisers, configuration</td>
            </tr>
            <tr>
              <td>9</td>
              <td>Testing a DSL</td>
              <td>minitest and RSpec, doubles, a DSL for testing the DSL</td>
            </tr>
            <tr>
              <td>10</td>
              <td>Self-inspection</td>
              <td>reflection, <code>to_h</code>, dry runs, graph output, instrumentation</td>
            </tr>
            <tr>
              <td>11</td>
              <td>Pipelines that rewrite themselves</td>
              <td>AST transformation at run time, middleware, safety limits</td>
            </tr>
            <tr>
              <td>12</td>
              <td>Ship it as a gem</td>
              <td>gemspec, semantic versioning, a CLI, docs, publishing</td>
            </tr>
          </tbody>
        </table>
        <h3>What you will know afterwards</h3>
        <p>How to design an internal DSL that reads like a language and remains debuggable; why the AST is the
            load-bearing idea rather than the clever syntax; how Ruby's object model actually works (singleton classes,
            ancestor chains, method lookup) rather than as folklore; when metaprogramming is the right tool and the
            specific ways it makes code unmaintainable; and how to package and publish a gem other people can extend.
        </p>
        <hr />
        <h2><span className="num">Course 2 · Part 1</span>Install and first program</h2>
        <h3>What Ruby is</h3>
        <p>Ruby is a dynamically typed, garbage-collected, object-oriented language that runs on an interpreter. Unlike
            Go, nothing is compiled ahead of time and there is no type checking before execution: a misspelled method
            name is discovered when that line runs. In exchange you get a language where a program can inspect and
            modify itself while running, which is the entire basis of this project.</p>
        <p>"Dynamically typed" here means types belong to values, not to variables, and are checked when an operation
            happens. "Object-oriented" in Ruby is stronger than in most languages: <em>everything</em> is an object,
            including integers, <code>nil</code>, classes themselves, and blocks of code once you capture them.</p>
        <p>The standard implementation is CRuby (also called MRI). Alternatives exist (JRuby on the JVM, TruffleRuby)
            and none of them matter for this course.</p>
        <h3>Installing</h3>
        <p>You want Ruby 3.2 or newer, because we use <code>Data.define</code> which arrived in 3.2. Ruby releases on
            Christmas Day each year; as of my knowledge the current release is 3.4 and 3.5 is likely out by now.
            Anything from 3.2 up works for everything here. I verified this instalment on 3.2.3.</p>
        <p><strong>Do not use the Ruby your operating system ships with.</strong> macOS's system Ruby is old and partly
            restricted; Linux distribution packages lag; both make you use <code>sudo</code> to install gems, which is a
            mess you will regret. Use a version manager: it installs Rubies in your home directory, lets you have
            several, and lets a project pin one with a <code>.ruby-version</code> file.</p>
        <h5>macOS and Linux (recommended: mise, or rbenv)</h5>
        <pre className="plain"><code>{"# mise (formerly rtx): fast, handles many languages, my default suggestion\ncurl https://mise.run | sh\nmise use --global ruby@3.4\nruby -v\n\n# or rbenv, the long-established option\nbrew install rbenv ruby-build          # macOS\n# (on Linux: git clone rbenv and ruby-build, or use your package manager)\nrbenv install 3.4.1\nrbenv global 3.4.1\necho 'eval \"$(rbenv init - bash)\"' >> ~/.bashrc   # or zsh\n"}</code></pre>
        <p>On Linux you also need build tools for gems with C extensions (which SQLite and others use):</p>
        <pre className="plain"><code>{"sudo apt install build-essential libssl-dev libyaml-dev zlib1g-dev libffi-dev  # Debian/Ubuntu\nsudo dnf install gcc make openssl-devel libyaml-devel zlib-devel libffi-devel  # Fedora\n"}</code></pre>
        <h5>Windows</h5>
        <pre className="plain"><code>{":: RubyInstaller with the DevKit, via winget\nwinget install RubyInstaller.Ruby.3.4\n\n:: then, when prompted, run the MSYS2 setup (option 3) so native gems build\nridk install\n"}</code></pre>
        <p>Native Windows Ruby works well these days. That said, Ruby's culture is deeply Unix-shaped (file paths,
            shelling out, signals, gems that assume a POSIX environment), and if you are also doing the Perl and Erlang
            courses, WSL2 will save you more time overall than it costs to set up.</p>
        <h5>Verify</h5>
        <pre className="plain"><code>{"$ ruby -v\nruby 3.2.3 (2024-01-18 revision 52bb2ac0a6) [x86_64-linux-gnu]\n$ gem -v\n3.4.20\n$ irb -v\n"}</code></pre>
        <h3>The toolchain</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>Tool</th>
              <th>What it does</th>
              <th>Go equivalent</th>
            </tr>
            <tr>
              <td><code>ruby</code></td>
              <td>Runs a file</td>
              <td><code>go run</code></td>
            </tr>
            <tr>
              <td><code>irb</code></td>
              <td>Interactive shell; your main exploration tool</td>
              <td>(none)</td>
            </tr>
            <tr>
              <td><code>gem</code></td>
              <td>Installs packages</td>
              <td><code>go get</code></td>
            </tr>
            <tr>
              <td><code>bundler</code></td>
              <td>Resolves and locks a project's dependency set</td>
              <td><code>go.mod</code>/<code>go.sum</code></td>
            </tr>
            <tr>
              <td><code>rake</code></td>
              <td>Task runner (build, test, release)</td>
              <td><code>make</code></td>
            </tr>
            <tr>
              <td><code>rubocop</code></td>
              <td>Linter and formatter</td>
              <td><code>gofmt</code> + <code>go vet</code></td>
            </tr>
            <tr>
              <td><code>minitest</code> / <code>rspec</code></td>
              <td>Testing; minitest ships with Ruby</td>
              <td><code>go test</code></td>
            </tr>
            <tr>
              <td><code>ri</code></td>
              <td>Offline documentation</td>
              <td><code>go doc</code></td>
            </tr>
          </tbody>
        </table>
        <p>Note what is different from Go: <strong>bundler is not built in</strong> (it ships with modern Ruby but is a
            separate tool), <strong>there is no standard formatter</strong> that everyone agrees on, and <strong>testing
                has two mainstream frameworks</strong>. Ruby's ecosystem has more choice and less consensus than Go's,
            which is either freedom or fragmentation depending on your temperament.</p>
        <h3>Creating the project</h3>
        <p>Bundler generates a gem skeleton, which is the right starting point even though we will not publish for
            eleven milestones:</p>
        <pre className="plain"><code>{"$ gem install bundler                     # usually already present\n$ bundle gem automation --test=minitest --no-coc --no-mit\nCreating gem 'automation'...\n      create  automation/Gemfile\n      create  automation/lib/automation.rb\n      create  automation/lib/automation/version.rb\n      create  automation/test/test_automation.rb\n      create  automation/automation.gemspec\n      create  automation/Rakefile\n      create  automation/README.md\n      ...\n$ cd automation\n$ bundle install\n"}</code></pre>
        <p>(Use <code>--test=rspec</code> if you prefer RSpec. I will use minitest in the examples because it ships with
            Ruby and needs no installation, and I will show the RSpec equivalent in Milestone 9 where testing gets
            serious.)</p>
        <pre className="plain"><code>{"automation/\n├── Gemfile                     development dependencies\n├── Gemfile.lock                the resolved versions (commit this)\n├── automation.gemspec          the package definition\n├── Rakefile                    tasks: rake test, rake build, rake release\n├── bin/\n│   ├── setup                   one-command development setup\n│   └── console                 irb with your gem already loaded\n├── lib/\n│   ├── automation.rb           the entry point everything requires\n│   └── automation/\n│       └── version.rb          VERSION constant, read by the gemspec\n└── test/\n    ├── test_helper.rb\n    └── test_automation.rb\n"}</code></pre>
        <p>Three conventions here are enforced by tooling rather than by taste:</p>
        <ul>
          <li><strong><code>lib/</code> is the load path.</strong> When your gem is installed, <code>lib/</code> is
                added to <code>$LOAD_PATH</code>, so <code>require "automation"</code> finds
                <code>lib/automation.rb</code>. A file at <code>lib/automation/runner.rb</code> is required as
                <code>require "automation/runner"</code>.</li>
          <li><strong>File paths mirror module nesting.</strong> <code>Automation::Runner</code> lives in
                <code>lib/automation/runner.rb</code>. Nothing forces this, and every Ruby programmer will assume it.
            </li>
          <li><strong><code>Gemfile</code> versus <code>gemspec</code>.</strong> The gemspec declares what your
                <em>library</em> needs from its users; the Gemfile declares what your <em>development</em> needs. For a
                gem, the Gemfile usually just says <code>gemspec</code>, meaning "read the gemspec", plus
                development-only tools.</li>
        </ul>
        <h3>Editor setup</h3>
        <ul>
          <li><strong>VS Code:</strong> install the "Ruby LSP" extension by Shopify. It provides completion,
                go-to-definition, inline documentation and formatting.</li>
          <li><strong>Neovim / others:</strong> <code>gem install ruby-lsp</code> and point your LSP client at it.
            </li>
          <li><strong>RubyMine:</strong> works out of the box and has the best static understanding of Ruby available,
                which matters more in a dynamic language than in a static one.</li>
        </ul>
        <p>Set up RuboCop early (<code>bundle add rubocop --group development</code>) and run it with
            <code>bundle exec rubocop -a</code> to autocorrect. It is opinionated and configurable via
            <code>.rubocop.yml</code>; unlike gofmt, you will end up tuning it, and the tuning is a team decision rather
            than a universal one.</p>
        <div className="warn">
          <h5>Expect less from your editor than in Go</h5>
          <p>In a dynamic language, "go to definition" is a guess. When we start defining methods at run time with
                <code>define_method</code> and <code>method_missing</code>, your editor will not know those methods
                exist, and neither will your linter. That is a real and permanent cost of the techniques this course
                teaches, and Milestone 7 discusses how to mitigate it (documenting dynamic methods,
                <code>respond_to_missing?</code>, and knowing when a plain <code>define_method</code> beats a clever
                <code>method_missing</code>).</p>
        </div>
        <h3>Hello, pipeline</h3>
        <p>Put this in <code>hello.rb</code> anywhere:</p>
        <pre><code>{"# frozen_string_literal: true\n\nmodule Automation\n  VERSION = \"0.0.1\"\n\n  def self.greet(name = \"world\")\n    \"hello, #{name} (automation #{VERSION})\"\n  end\nend\n\nputs Automation.greet\nputs Automation.greet(\"pipelines\")\n"}</code></pre>
        <pre className="plain"><code>{"$ ruby hello.rb\nhello, world (automation 0.0.1)\nhello, pipelines (automation 0.0.1)\n"}</code></pre>
        <h4>Every line, explained</h4>
        <p><code># frozen_string_literal: true</code> — a <em>magic comment</em>, read by the interpreter rather than
            ignored. It makes every string literal in this file frozen (immutable), which saves memory (identical
            literals are shared) and prevents a class of bug where one part of the program mutates a string another part
            is holding. Put it at the top of every file you write. It has one surprising consequence you will meet in
            Part 2.</p>
        <p><code>module Automation</code> — a module is a namespace and a bag of methods. Unlike a class, it cannot be
            instantiated. Top-level constant names must be capitalised; <code>Automation::Runner</code> is how you refer
            to something nested inside.</p>
        <p><code>VERSION = "0.0.1"</code> — a constant, by virtue of the capital letter. Ruby will warn if you reassign
            it but will not stop you, which tells you something about the language's attitude: it gives you guidance,
            not guarantees.</p>
        <p><code>def self.greet(name = "world")</code> — defines a method on the module itself rather than on instances,
            so you call it as <code>Automation.greet</code>. The <code>self.</code> prefix is how Ruby spells what other
            languages call <code>static</code>. <code>name = "world"</code> is a default argument.</p>
        <p><code>"hello, #{'{'}name{'}'} ..."</code> — string interpolation. <code>#{'{'}{'}'}</code> evaluates any Ruby expression and
            calls <code>to_s</code> on the result. Only double-quoted strings interpolate; single-quoted ones are
            literal.</p>
        <p><strong>There is no <code>return</code>.</strong> A Ruby method returns the value of its last expression.
            Explicit <code>return</code> exists and is used for early exits, but writing it at the end of a method marks
            you as a visitor from another language.</p>
        <p><code>puts</code> — a method from <code>Kernel</code>, which is mixed into every object, so it is callable
            anywhere without a receiver. It prints with a newline. Its cousins: <code>print</code> (no newline),
            <code>p</code> (prints <code>inspect</code>, the debugging representation, and returns its argument), and
            <code>pp</code> (pretty-prints nested structures). <strong><code>p</code> is the one you will use most while
                developing.</strong></p>
        <h3>irb, your most important tool</h3>
        <pre className="plain"><code>{"$ irb\nirb(main):001> require_relative \"hello\"\n=> true\nirb(main):002> Automation.greet(\"irb\")\n=> \"hello, irb (automation 0.0.1)\"\nirb(main):003> Automation.methods(false)\n=> [:greet]\nirb(main):004> \"hello\".methods.size\n=> 187\nirb(main):005> 5.class.ancestors\n=> [Integer, Numeric, Comparable, Object, Kernel, BasicObject]\n"}</code></pre>
        <p>Go development is edit-compile-run. Ruby development is a conversation: you keep an <code>irb</code> session
            open, load your code, poke at objects, and ask them what they can do. <code>obj.methods</code>,
            <code>obj.class</code>, <code>obj.instance_variables</code> and <code>Klass.ancestors</code> are how you
            learn an unfamiliar library, often faster than reading its documentation. Inside your project,
            <code>bin/console</code> starts irb with the gem already loaded.</p>
        <p>Documentation: <code>ri Array#map</code> in a terminal, <code>rubydoc.info</code> for gems, and
            <code>ruby-doc.org</code> for the core library. In irb, <code>help "Array#map"</code> works too.</p>
        <h3>Running and testing</h3>
        <pre className="plain"><code>{"ruby lib/automation.rb            # run a file\nbundle exec rake test             # run the test suite\nruby -Ilib test/test_step.rb      # run one test file directly\nruby -Ilib test/test_step.rb -n test_value_equality   # one test\nbundle exec rubocop -a            # lint and autocorrect\nbin/console                       # irb with your gem loaded\n"}</code></pre>
        <p><code>bundle exec</code> runs a command with exactly the gem versions your <code>Gemfile.lock</code> pins.
            Without it you get whatever is installed globally, which is how "works on my machine" happens in Ruby. Get
            into the habit.</p>
        <p>A first test, in <code>test/test_step.rb</code>:</p>
        <pre><code>{"require \"minitest/autorun\"\n\nclass Step\n  attr_reader :name, :options\n\n  def initialize(name, **options)\n    @name = name.to_sym\n    @options = options.freeze\n  end\n\n  def ==(other)\n    other.is_a?(Step) && name == other.name && options == other.options\n  end\nend\n\nclass StepTest < Minitest::Test\n  def setup\n    @step = Step.new(\"fetch\", source: \"arxiv\")\n  end\n\n  def test_name_is_always_a_symbol\n    assert_equal :fetch, @step.name\n    assert_equal :fetch, Step.new(:fetch).name\n  end\n\n  def test_options_are_frozen\n    assert @step.options.frozen?, \"options should be frozen\"\n    assert_raises(FrozenError) { @step.options[:source] = \"elsewhere\" }\n  end\n\n  def test_value_equality\n    assert_equal Step.new(:fetch, source: \"arxiv\"), @step\n    refute_equal Step.new(:fetch, source: \"other\"), @step\n  end\nend\n"}</code></pre>
        <pre className="plain"><code>{"$ ruby test/test_step.rb\nRun options: --seed 27134\n\n# Running:\n...\n\nFinished in 0.001256s, 2388.1814 runs/s, 4776.3627 assertions/s.\n3 runs, 6 assertions, 0 failures, 0 errors, 0 skips\n"}</code></pre>
        <p>That is real output. Points to notice: <code>setup</code> runs before every test method; test methods must
            start with <code>test_</code>; the argument order is <code>assert_equal expected, actual</code> (getting it
            backwards produces confusing failure messages); and <code>assert_raises</code> takes a block, which is your
            first glimpse of how much of Ruby's design rests on blocks.</p>
        <div className="exercise">
          <h5>Exercise 1</h5>
          <p>Create the gem skeleton with <code>bundle gem automation</code>. Then add a module method
                <code>Automation.env</code> that returns a Hash describing the runtime: Ruby version, platform, the
                gem's own version, and whether <code>$PROGRAM_NAME</code> suggests it is running under a test. Print it
                nicely from a script. Then write a test asserting the Hash has exactly the keys you expect.</p>
          <p>Hints: <code>RUBY_VERSION</code>, <code>RUBY_PLATFORM</code> and <code>$PROGRAM_NAME</code> are globals;
                <code>Hash#keys</code>; <code>assert_equal</code> on sorted arrays of symbols.</p>
        </div>
        <details>
          <summary>Solution 1 — open after trying</summary>
          <pre><code>{"# lib/automation.rb\n# frozen_string_literal: true\n\nrequire_relative \"automation/version\"\n\nmodule Automation\n  def self.env\n    {\n      ruby: RUBY_VERSION,\n      platform: RUBY_PLATFORM,\n      automation: VERSION,\n      testing: $PROGRAM_NAME.include?(\"test\")\n    }\n  end\nend\n"}</code></pre>
          <pre><code>{"# test/test_env.rb\nrequire \"minitest/autorun\"\nrequire \"automation\"\n\nclass EnvTest < Minitest::Test\n  def test_env_has_expected_keys\n    assert_equal %i[automation platform ruby testing], Automation.env.keys.sort\n  end\n\n  def test_ruby_version_is_a_string\n    assert_kind_of String, Automation.env[:ruby]\n    assert_match(/\\A\\d+\\.\\d+/, Automation.env[:ruby])\n  end\nend\n"}</code></pre>
          <p>Three details worth absorbing. <code>%i[a b c]</code> is shorthand for an array of symbols, and its
                sibling <code>%w[a b c]</code> makes an array of strings; both appear constantly in real Ruby.
                <code>require_relative</code> is for files inside your own project (resolved relative to the current
                file) while <code>require</code> searches the load path and is for gems and standard library. And
                <code>assert_kind_of</code> rather than <code>assert_equal String, x.class</code>, because the former
                accepts subclasses, which is usually what you mean.</p>
        </details>
        <div className="warn">
          <h5>Common first-day errors</h5>
          <ul>
            <li><code>cannot load such file -- automation (LoadError)</code> — <code>lib/</code> is not on the load
                    path. Run with <code>ruby -Ilib ...</code>, or use <code>require_relative</code>, or run through
                    <code>rake</code>/<code>bundle exec</code>, which set it up for you.</li>
            <li><code>undefined method 'greet' for Automation:Module</code> — you wrote <code>def greet</code>
                    instead of <code>def self.greet</code>, so it is an instance method on a module that has no
                    instances.</li>
            <li><code>uninitialized constant Automation::Runner</code> — the file defining it was never required.
                    Ruby does not autoload by convention (Rails adds that); you must <code>require</code> it.</li>
            <li><code>can't modify frozen String</code> — the magic comment is doing its job. Use
                    <code>+"literal"</code> or <code>String.new</code> or, better, stop mutating strings.</li>
            <li><code>syntax error, unexpected end-of-input</code> — a missing <code>end</code>. Ruby cannot tell
                    you where you meant to put it, only where the file ran out. Consistent indentation and a good editor
                    are the defence.</li>
            <li>Using <code>sudo gem install</code>. If you need sudo, your Ruby installation is wrong. Fix the
                    version manager instead.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why should you not use the system Ruby?</li>
          <li>What is the difference between <code>require</code> and <code>require_relative</code>?</li>
          <li>What does <code>bundle exec</code> protect you from?</li>
          <li>Where must <code>Automation::Runner</code> live, and what enforces that?</li>
          <li>What does the <code>frozen_string_literal</code> magic comment do, and why would you want it?</li>
          <li>What is the difference between <code>puts</code>, <code>print</code>, <code>p</code> and
                <code>pp</code>?</li>
        </ol>
        <hr />
        <h2><span className="num">Course 2 · Part 2</span>Language crash course</h2>
        <p>Only what the DSL needs, which turns out to be most of Ruby's object model and none of its web frameworks.
            Every output below is copied from an actual run. Keep an <code>irb</code> session open and type the
            examples.</p>
        <h3>2.1 Everything is an object, and everything is a method call</h3>
        <pre><code>{"p 5.class, \"x\".class, nil.class, (1..3).class, :sym.class, Integer.class\np 1.+(2), 5.between?(1, 10), nil.to_a, nil.to_s.empty?\n"}</code></pre>
        <pre className="plain"><code>{"Integer\nString\nNilClass\nRange\nSymbol\nClass\n3\ntrue\n[]\ntrue\n"}</code></pre>
        <ul>
          <li><code>5.class</code> is <code>Integer</code>: numbers are objects with methods. There are no primitives.
            </li>
          <li><code>nil.class</code> is <code>NilClass</code>, and <code>nil</code> is a real object you can call
                methods on. <code>nil.to_a</code> gives <code>[]</code>, <code>nil.to_s</code> gives <code>""</code>.
                This is why Ruby code has fewer nil checks than you would expect.</li>
          <li><code>Integer.class</code> is <code>Class</code>: <strong>classes are objects too</strong>, instances of
                <code>Class</code>. That fact is what makes <code>define_method</code> and the rest of Milestone 7
                possible.</li>
          <li><code>1.+(2)</code> works because <code>+</code> is a method. Operators are ordinary methods with
                special syntax, which means you can define <code>+</code>, <code>==</code>, <code>{'<'}={'>'}</code> and
                <code>[]</code> on your own types.</li>
        </ul>
        <div className="cmp">
          <h5>Typical language vs Ruby</h5>
          <p>In Java, <code>int</code> is not an object and <code>5.toString()</code> is a syntax error. In Python,
                <code>5</code> is an object but <code>+</code> dispatches through <code>__add__</code> and classes are
                instances of <code>type</code> in a way you mostly ignore. Ruby has no exceptions to the rule, which
                sounds like trivia until you realise that "send a message to an object" being the <em>only</em>
                mechanism is what lets you intercept all of it. A DSL in Ruby is, at bottom, a set of objects that
                respond interestingly to messages.</p>
        </div>
        <h3>2.2 Symbols, strings, and frozen literals</h3>
        <pre><code>{"a, b = \"name\", \"name\"\np a.equal?(b), a == b, a.frozen?\np :name.equal?(:name), :name.to_s, \"name\".to_sym\n"}</code></pre>
        <pre className="plain"><code>{"false      # two separate String objects (in a file without the magic comment)\ntrue       # with the same contents\nfalse\ntrue       # :name is always the same object\n\"name\"\n:name\n"}</code></pre>
        <p>A <strong>symbol</strong> is an interned, immutable name. <code>:fetch</code> written twice is the same
            object; <code>"fetch"</code> written twice is two objects. Use symbols for identifiers (method names, hash
            keys, step names, states) and strings for text (messages, content, user data). Our DSL will normalise every
            step name to a symbol, which is why <code>Step.new("fetch").name</code> returned <code>:fetch</code>
            earlier.</p>
        <div className="warn">
          <h5>The frozen-literal surprise</h5>
          <p>Run the same snippet in a file that starts with <code># frozen_string_literal: true</code> and the first
                line prints <strong>true</strong>: identical frozen literals are deduplicated into one object. So
                <code>equal?</code> (object identity) gives different answers depending on a comment at the top of the
                file. This is worth knowing before it confuses you at 2am. The lesson is not to avoid the magic comment;
                it is to use <code>==</code> for comparisons and <code>equal?</code> essentially never.</p>
        </div>
        <h3>2.3 Truthiness</h3>
        <pre><code>{"p [0, \"\", [], nil, false].map { |v| v ? \"truthy\" : \"falsy\" }\n"}</code></pre>
        <pre className="plain"><code>{"[\"truthy\", \"truthy\", \"truthy\", \"falsy\", \"falsy\"]\n"}</code></pre>
        <p><strong>Only <code>nil</code> and <code>false</code> are falsy.</strong> Zero is true. The empty string is
            true. The empty array is true. Coming from Python or JavaScript this is the single most likely source of a
            wrong conditional in your first week, and it cuts both ways: <code>if items</code> does not check for
            emptiness, it checks for existence. Write <code>if items.empty?</code> when you mean empty.</p>
        <p>Two idioms that follow:</p>
        <pre><code>{"@steps ||= []              # assign only if currently nil or false\nname = opts[:name] || \"unnamed\"\ncount = config&.limit      # safe navigation: nil if config is nil, no NoMethodError\n"}</code></pre>
        <h3>2.4 Methods and their arguments</h3>
        <pre><code>{"def describe(name, *rest, retries: 3, **opts)\n  \"#{name} retries=#{retries} rest=#{rest.inspect} opts=#{opts.inspect}\"\nend\n\nputs describe(\"fetch\", retries: 5, timeout: 2)\n\ndef double(x) = x * 2          # endless method (Ruby 3.0+)\np double(21)\n"}</code></pre>
        <pre className="plain"><code>{"fetch retries=5 rest=[] opts={:timeout=>2}\n42\n"}</code></pre>
        <ul>
          <li><code>*rest</code> collects extra positional arguments into an Array (a "splat").</li>
          <li><code>retries: 3</code> is a keyword argument with a default. Since Ruby 3.0, keyword arguments are
                genuinely separate from positional Hashes, which fixed a decade of subtle bugs.</li>
          <li><code>**opts</code> collects unrecognised keyword arguments into a Hash (a "double splat"). <strong>This
                    is the feature that makes our DSL's <code>filter topic: "AI", min_citations: 5</code> work</strong>:
                any options a step wants, without declaring them.</li>
          <li><code>def double(x) = x * 2</code> is an endless method, good for one-liners.</li>
          <li>Parameter order is fixed: required, optional, splat, keyword, double splat, block. Writing
                <code>def f(a, retries: 3, *rest)</code> is a <em>syntax error</em>, which I confirmed by making exactly
                that mistake while preparing this instalment.</li>
        </ul>
        <p>Naming conventions that Ruby programmers treat as meaning, not decoration:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Form</th>
              <th>Means</th>
              <th>Example</th>
            </tr>
            <tr>
              <td><code>name?</code></td>
              <td>Returns a boolean</td>
              <td><code>empty?</code>, <code>valid?</code></td>
            </tr>
            <tr>
              <td><code>name!</code></td>
              <td>Dangerous: mutates, or raises where the plain version does not</td>
              <td><code>sort!</code>, <code>validate!</code></td>
            </tr>
            <tr>
              <td><code>name=</code></td>
              <td>A setter, called as <code>obj.name = x</code></td>
              <td><code>attr_writer</code> generates these</td>
            </tr>
            <tr>
              <td><code>snake_case</code></td>
              <td>Methods and variables</td>
              <td><code>save_to</code></td>
            </tr>
            <tr>
              <td><code>CamelCase</code></td>
              <td>Classes and modules</td>
              <td><code>StepRegistry</code></td>
            </tr>
            <tr>
              <td><code>SCREAMING</code></td>
              <td>Constants</td>
              <td><code>VERSION</code></td>
            </tr>
          </tbody>
        </table>
        <h3>2.5 Arrays, hashes, and iterating</h3>
        <pre><code>{"steps = %w[fetch filter summarize save]\np steps.map(&:upcase)\np steps.select { |s| s.length > 4 }\np steps.each_with_index.map { |s, i| \"#{i}:#{s}\" }\np steps.reduce(\"\") { |acc, s| acc + s[0] }\n\nconfig = { topic: \"AI\", limit: 10 }\np config[:topic], config[:missing], config.fetch(:limit), config.key?(:topic)\n\nnested = { pipeline: { steps: [{ name: \"fetch\" }] } }\np nested.dig(:pipeline, :steps, 0, :name)\np steps.each_with_object({}) { |s, h| h[s.to_sym] = s.length }\n"}</code></pre>
        <pre className="plain"><code>{"[\"FETCH\", \"FILTER\", \"SUMMARIZE\", \"SAVE\"]\n[\"fetch\", \"filter\", \"summarize\"]\n[\"0:fetch\", \"1:filter\", \"2:summarize\", \"3:save\"]\n\"ffss\"\n\"AI\"\nnil\n10\ntrue\n\"fetch\"\n{:fetch=>5, :filter=>6, :summarize=>9, :save=>4}\n"}</code></pre>
        <ul>
          <li><code>%w[...]</code> builds an array of strings without quotes or commas.</li>
          <li><code>&:upcase</code> is shorthand for <code>{'{'} |s| s.upcase {'}'}</code>. The <code>&</code>
                converts a Symbol into a block by calling <code>to_proc</code> on it, which is a small piece of
                metaprogramming you use daily without noticing.</li>
          <li><code>config[:missing]</code> returns <code>nil</code>; <code>config.fetch(:missing)</code> raises
                <code>KeyError</code>. <strong>Use <code>fetch</code> for things that must be present</strong>: a
                <code>nil</code> that travels three layers before exploding is much harder to debug than an immediate
                <code>KeyError</code>.</li>
          <li><code>dig</code> walks nested structures and returns <code>nil</code> rather than raising when a level
                is missing.</li>
          <li><code>each_with_object({'{'}{'}'})</code> is the idiomatic "build a collection while iterating"; the object is
                passed to each iteration and returned at the end. <code>reduce</code> is its cousin where the
                accumulator is the block's return value, which is why the <code>reduce</code> above works but is easy to
                get wrong.</li>
        </ul>
        <div className="cmp">
          <h5>Typical language vs Ruby</h5>
          <p>Python has one iteration protocol and a handful of builtins (<code>map</code>, <code>filter</code>,
                comprehensions). Ruby has <code>Enumerable</code>, a module with about sixty methods, mixed into
                anything that defines <code>each</code>. That means <code>group_by</code>, <code>partition</code>,
                <code>each_slice</code>, <code>tally</code>, <code>sum</code>, <code>min_by</code>,
                <code>flat_map</code>, <code>zip</code>, <code>lazy</code> and more are available on your own classes
                the moment you define <code>each</code> and include the module. Learning <code>Enumerable</code> is the
                single highest-value hour you can spend on Ruby's standard library.</p>
        </div>
        <h3>2.6 Blocks</h3>
        <p>A block is a chunk of code attached to a method call. It is not an argument in the ordinary sense: every Ruby
            method can take one, and the method decides whether to use it.</p>
        <pre><code>{"def each_step\n  return to_enum(:each_step) unless block_given?\n  yield \"fetch\"\n  yield \"filter\"\n  :done\nend\n\neach_step { |s| print s, \" \" }\np each_step.to_a\n\ndef with_logging(name, &block)\n  puts \"start #{name}\"\n  result = block.call\n  puts \"end #{name}\"\n  result\nend\n\np with_logging(\"run\") { 40 + 2 }\n"}</code></pre>
        <pre className="plain"><code>{"fetch filter \n[\"fetch\", \"filter\"]\nstart run\nend run\n42\n"}</code></pre>
        <ul>
          <li><code>yield</code> calls the block. It is the cheapest way to accept one and needs no parameter.</li>
          <li><code>block_given?</code> asks whether a block was passed. Returning <code>to_enum</code> when there is
                no block is the standard trick that makes your method work both as <code>each_step {'{'} ... {'}'}</code> and as
                <code>each_step.to_a</code>, exactly like the built-in collections.</li>
          <li><code>&block</code> in the parameter list captures the block as a <code>Proc</code> object you can
                store, pass on, or call later. <strong>This is how our DSL will keep a failure handler for
                    later.</strong></li>
          <li>A block returns the value of its last expression, and <code>yield</code> evaluates to it.</li>
          <li>Style: <code>{'{'} {'}'}</code> for single-line blocks, <code>do ... end</code> for multi-line. They differ in
                precedence in rare cases, but the real reason is readability, and a DSL always uses
                <code>do ... end</code>.</li>
        </ul>
        <p><strong>Why blocks matter more in Ruby than closures do elsewhere.</strong> Because every method can take
            exactly one block with no ceremony, Ruby programmers habitually write methods that take a chunk of
            behaviour: <code>File.open(path) {'{'} |f| ... {'}'}</code> closes the file afterwards,
            <code>transaction {'{'} ... {'}'}</code> commits or rolls back, <code>assert_raises(E) {'{'} ... {'}'}</code> checks an
            expectation. The pattern is "the method controls the resource, the block supplies the intent", and our whole
            DSL is one enormous application of it.</p>
        <h3>2.7 Procs and lambdas</h3>
        <pre><code>{"pr = proc   { |a, b| [a, b] }\nla = ->(a, b) { [a, b] }\n\np pr.call(1), pr.call(1, 2, 3), pr.lambda?, la.lambda?\nbegin\n  la.call(1)\nrescue ArgumentError => e\n  puts \"lambda strict: #{e.message}\"\nend\n\ndef returns_from_lambda\n  l = -> { return :from_lambda }\n  l.call\n  :from_method\nend\n\ndef returns_from_proc\n  pr = proc { return :from_proc }\n  pr.call\n  :from_method\nend\n\np returns_from_lambda, returns_from_proc\n"}</code></pre>
        <pre className="plain"><code>{"[1, nil]\n[1, 2]\nfalse\ntrue\nlambda strict: wrong number of arguments (given 1, expected 2)\n:from_method\n:from_proc\n"}</code></pre>
        <p>Two differences, and the second one is the dangerous one:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th></th>
              <th>Proc</th>
              <th>Lambda</th>
            </tr>
            <tr>
              <td>Arity</td>
              <td>Lenient: missing args become nil, extra ones are dropped</td>
              <td>Strict: wrong count raises <code>ArgumentError</code></td>
            </tr>
            <tr>
              <td><code>return</code></td>
              <td>Returns from the <em>enclosing method</em></td>
              <td>Returns from the lambda only</td>
            </tr>
            <tr>
              <td>Syntax</td>
              <td><code>proc {'{'} {'}'}</code>, or a block captured with <code>&</code></td>
              <td><code>-{'>'}(x) {'{'} {'}'}</code> or <code>lambda {'{'} {'}'}</code></td>
            </tr>
          </tbody>
        </table>
        <p>Look at the output again: <code>returns_from_proc</code> returned <code>:from_proc</code>, meaning the
            <code>return</code> inside the proc terminated the whole method and the last line never ran. The lambda
            version returned <code>:from_method</code>, because its <code>return</code> only left the lambda. <strong>A
                block captured with <code>&block</code> is a Proc</strong>, so a user's
            <code>when_failed do ... return ... end</code> could return from surprising places. Prefer lambdas when you
            store user code and call it later, and we will.</p>
        <div className="exercise">
          <h5>Exercise 2.A</h5>
          <p>Write a method <code>retrying(times:, on: StandardError)</code> that takes a block, calls it, and retries
                up to <code>times</code> attempts if the block raises an exception of the given class, re-raising if it
                never succeeds. It should return the block's value on success, and it should be usable as:</p>
          <pre className="plain"><code>{"result = retrying(times: 3) { flaky_call }"}</code></pre>
          <p>Then extend it to yield the attempt number to the block, so the block can behave differently on a retry.
                Test it with a counter that fails the first two times.</p>
        </div>
        <details>
          <summary>Solution 2.A — open after trying</summary>
          <pre><code>{"def retrying(times:, on: StandardError)\n  attempt = 0\n  begin\n    attempt += 1\n    yield attempt\n  rescue on => e\n    retry if attempt < times\n    raise\n  end\nend\n\nattempts = 0\nvalue = retrying(times: 3) do |n|\n  attempts += 1\n  raise IOError, \"flaky\" if n < 3\n  \"succeeded on attempt #{n}\"\nend\n\np value, attempts\n# => \"succeeded on attempt 3\"\n# => 3\n"}</code></pre>
          <p>Four things in eleven lines. <code>retry</code> is a keyword that re-runs the <code>begin</code> block
                from the top; no loop needed, and no other mainstream language has it. A bare <code>raise</code> inside
                a <code>rescue</code> re-raises the current exception with its original backtrace, which is what you
                want; <code>raise e</code> also works but loses nothing only because Ruby is kind. <code>on:</code>
                defaults to <code>StandardError</code> rather than <code>Exception</code>, because
                <code>Exception</code> includes <code>SignalException</code> and <code>Interrupt</code>, so rescuing it
                swallows Ctrl-C. And <code>yield attempt</code> passes a value to the block, which the caller may
                ignore: blocks are lenient about arity, so <code>retrying(times: 3) {'{'} flaky {'}'}</code> still works.</p>
          <p>This method is, almost unchanged, what Milestone 6 puts behind <code>retry_on</code>.</p>
        </details>
        <h3>2.8 Classes</h3>
        <pre><code>{"class Step\n  attr_reader :name, :options\n\n  def initialize(name, **options)\n    @name = name.to_sym\n    @options = options.freeze\n  end\n\n  def to_s = \"#{@name}(#{@options.inspect})\"\n  def ==(other) = other.is_a?(Step) && name == other.name && options == other.options\n  def call(input) = raise(NotImplementedError, \"#{self.class} must implement #call\")\nend\n\ns = Step.new(\"fetch\", source: \"arxiv\")\nputs s\np s == Step.new(:fetch, source: \"arxiv\"), s.options.frozen?\n"}</code></pre>
        <pre className="plain"><code>{"fetch({:source=>\"arxiv\"})\ntrue\ntrue\n"}</code></pre>
        <ul>
          <li><code>@name</code> is an instance variable. It springs into existence on assignment, is <code>nil</code>
                if never assigned, and is private to the object: there is no way to read it from outside without a
                method.</li>
          <li><code>attr_reader :name</code> generates a method <code>name</code> that returns <code>@name</code>. Its
                siblings are <code>attr_writer</code> and <code>attr_accessor</code>. <strong><code>attr_reader</code>
                    is itself a method call</strong>, executed when the class body runs, that defines methods. Class
                bodies are ordinary code, which is the foundation of everything in Milestone 7.</li>
          <li><code>initialize</code> is the constructor, called by <code>Step.new</code>.</li>
          <li>Defining <code>==</code> gives you value equality. Define <code>hash</code> and <code>eql?</code> too if
                instances will be hash keys or need <code>uniq</code>.</li>
          <li><code>raise(NotImplementedError, ...)</code> in a base method is Ruby's abstract method: there is no
                <code>abstract</code> keyword, and this is the convention.</li>
          <li><code>self.class</code> gives an object its own class, so the error message names the actual subclass.
            </li>
        </ul>
        <div className="cmp">
          <h5>Typical language vs Ruby</h5>
          <p>There is no <code>new</code> keyword (<code>new</code> is a method on the class object), no field
                declarations (instance variables appear when assigned), no access modifiers on state (all instance
                variables are private, always), and no compile-time interface. Visibility applies only to methods, via
                <code>private</code> and <code>protected</code>, and <code>private</code> is itself a method call that
                switches a mode for the rest of the class body.</p>
        </div>
        <h3>2.9 Modules: namespaces and mixins</h3>
        <pre><code>{"module Loggable\n  def log(msg) = puts(\"[#{self.class.name}] #{msg}\")\nend\n\nmodule Registry\n  def register(name) = (@registered ||= []) << name\n  def registered = @registered || []\nend\n\nclass Pipeline\n  include Loggable     # instance methods\n  extend  Registry     # class methods\nend\n\nPipeline.new.log(\"hello\")\nPipeline.register(:fetch)\nPipeline.register(:save)\np Pipeline.registered, Pipeline.ancestors.first(4), Pipeline.include?(Loggable)\n"}</code></pre>
        <pre className="plain"><code>{"[Pipeline] hello\n[:fetch, :save]\n[Pipeline, Loggable, Object, Kernel]\ntrue\n"}</code></pre>
        <p><strong><code>include</code> adds instance methods; <code>extend</code> adds methods to the object doing the
                extending</strong>, which for a class means class methods. That one sentence resolves most Ruby module
            confusion.</p>
        <p><code>ancestors</code> shows the method lookup chain: Ruby searches <code>Pipeline</code>, then
            <code>Loggable</code>, then <code>Object</code>, then <code>Kernel</code>, then <code>BasicObject</code>,
            and calls the first matching method. There is no multiple inheritance, but a class can include many modules,
            and they stack in the chain. This is worth remembering as the honest answer to "does Ruby have multiple
            inheritance": no, it has a linearised chain you can inject into, which gets you the useful part without the
            diamond problem.</p>
        <pre><code>{"module Automation\n  VERSION = \"0.1.0\"\n\n  class Error < StandardError; end\n\n  class StepError < Error\n    def initialize(step, cause) = super(\"step #{step} failed: #{cause}\")\n  end\nend\n\np Automation::VERSION, Automation::StepError.ancestors.first(3)\n"}</code></pre>
        <pre className="plain"><code>{"\"0.1.0\"\n[Automation::StepError, Automation::Error, StandardError]\n"}</code></pre>
        <p>Every gem should define one base error class inside its namespace and inherit all its others from it, so a
            user can write <code>rescue Automation::Error</code> and catch everything you raise without catching
            everything in the world. This is the Ruby equivalent of Go's sentinel error hierarchy and it is not optional
            in a library.</p>
        <h3>2.10 self, and the trick the whole DSL rests on</h3>
        <pre><code>{"class Builder\n  def initialize = @steps = []\n  def fetch(what) = @steps << [:fetch, what]\n  def steps = @steps\n\n  def build(&block)\n    instance_eval(&block)   # self inside the block becomes this builder\n    @steps\n  end\nend\n\np Builder.new.build { fetch \"papers\" }\np Builder.new.instance_eval { self.class }\np Builder.new.instance_exec(3) { |n| n * 2 }\n"}</code></pre>
        <pre className="plain"><code>{"[[:fetch, \"papers\"]]\nBuilder\n6\n"}</code></pre>
        <p>Look carefully at the first line of output. The block <code>{'{'} fetch "papers" {'}'}</code> was written at the top
            level of the file, where no method called <code>fetch</code> exists. It worked because
            <code>instance_eval</code> evaluated the block with <code>self</code> set to the builder, so the bare call
            <code>fetch "papers"</code> was sent to the builder.</p>
        <p><strong>This is the whole trick.</strong> Every Ruby DSL you have ever seen (RSpec's
            <code>describe</code>/<code>it</code>, Rake's <code>task</code>, a Gemfile's <code>gem</code>, Sinatra's
            <code>get</code>) is this: a block, evaluated with <code>self</code> pointing at an object that responds to
            the vocabulary. Milestone 3 does it properly, including the significant problems it causes, which are: the
            block can no longer see the caller's private methods, method names silently collide, and typos become
            confusing <code>NoMethodError</code>s rather than <code>NameError</code>s.</p>
        <p><code>instance_exec</code> is the same thing but passes arguments to the block. Both are the sharpest tools
            in Ruby, and both are how you cut yourself.</p>
        <h3>2.11 Exceptions</h3>
        <pre><code>{"attempts = 0\nbegin\n  attempts += 1\n  raise Automation::StepError.new(:fetch, \"timeout\") if attempts < 3\n  puts \"succeeded on attempt #{attempts}\"\nrescue Automation::Error => e\n  retry if attempts < 3\n  puts \"giving up: #{e.message}\"\nensure\n  puts \"ensure always runs (attempts=#{attempts})\"\nend\n\ndef risky\n  yield\nrescue ZeroDivisionError => e\n  raise Automation::StepError.new(:divide, e.message)\nend\n\nbegin\n  risky { 1 / 0 }\nrescue Automation::StepError => e\n  puts \"#{e.class}: #{e.message} / cause: #{e.cause.class}\"\nend\n"}</code></pre>
        <pre className="plain"><code>{"succeeded on attempt 3\nensure always runs (attempts=3)\nAutomation::StepError: step divide failed: divided by 0 / cause: ZeroDivisionError\n"}</code></pre>
        <ul>
          <li><code>rescue SomeError ={'>'} e</code> catches that class <em>and its subclasses</em>, which is why the
                error hierarchy matters.</li>
          <li><code>retry</code> restarts the <code>begin</code> block. Always bound it with a counter, or you have
                written an infinite loop with extra steps.</li>
          <li><code>ensure</code> runs on every path: success, exception, even an early <code>return</code>. It is
                Ruby's <code>defer</code>.</li>
          <li><strong><code>e.cause</code> is set automatically</strong> when you raise inside a <code>rescue</code>:
                Ruby remembers the original. This is Go's <code>%w</code> wrapping, for free, with no effort from you.
            </li>
          <li>A method body is an implicit <code>begin</code>, so <code>def risky ... rescue ... end</code> needs no
                explicit block.</li>
          <li><strong>Rescue <code>StandardError</code>, never <code>Exception</code>.</strong> A bare
                <code>rescue ={'>'} e</code> means <code>StandardError</code>, which is correct. Writing
                <code>rescue Exception</code> catches <code>Interrupt</code> and <code>SystemExit</code>, so your
                program ignores Ctrl-C and cannot be killed politely.</li>
        </ul>
        <h3>2.12 Reflection and the beginnings of metaprogramming</h3>
        <pre><code>{"class Ghost\n  def initialize = @calls = []\n\n  def method_missing(name, *args, &blk)\n    return super unless name.to_s.start_with?(\"step_\")\n    @calls << [name, args]\n    self\n  end\n\n  def respond_to_missing?(name, include_private = false)\n    name.to_s.start_with?(\"step_\") || super\n  end\n\n  def calls = @calls\nend\n\ng = Ghost.new\ng.step_fetch(\"papers\").step_save(\"kb\")\np g.calls, g.respond_to?(:step_anything), g.respond_to?(:nope)\ng.nope   # => NoMethodError\n"}</code></pre>
        <pre className="plain"><code>{"[[:step_fetch, [\"papers\"]], [:step_save, [\"kb\"]]]\ntrue\nfalse\nNoMethodError: undefined method `nope' for #<Ghost:0x00...\n"}</code></pre>
        <p><code>method_missing</code> is called when an object receives a message it has no method for. Three rules
            make the difference between a useful ghost and an unmaintainable one:</p>
        <ol>
          <li><strong>Handle only what you mean to, and <code>super</code> for the rest.</strong> The
                <code>return super unless</code> line is what preserves the normal <code>NoMethodError</code> for
                genuine typos. Without it, every misspelling silently succeeds and your users debug ghosts.</li>
          <li><strong>Always define <code>respond_to_missing?</code> alongside it.</strong> Otherwise
                <code>respond_to?</code> lies, and so do <code>method()</code>, duck-typing checks and every tool that
                introspects your object. Notice the output: <code>respond_to?(:step_anything)</code> is
                <code>true</code> because we defined it.</li>
          <li><strong>Returning <code>self</code> makes calls chainable</strong>, which is how
                <code>g.step_fetch(...).step_save(...)</code> works.</li>
        </ol>
        <pre><code>{"class Dynamic\n  %i[fetch filter save].each do |name|\n    define_method(name) { |arg = nil| \"called #{name} with #{arg.inspect}\" }\n  end\nend\n\nd = Dynamic.new\np d.fetch(\"x\"), d.public_send(:filter, 2), Dynamic.instance_methods(false).sort\n"}</code></pre>
        <pre className="plain"><code>{"\"called fetch with \\\"x\\\"\"\n\"called filter with 2\"\n[:fetch, :filter, :save]\n"}</code></pre>
        <p><code>define_method</code> defines a real method from a block, at run time. Compare the two approaches,
            because Milestone 7 chooses between them constantly:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th></th>
              <th><code>define_method</code></th>
              <th><code>method_missing</code></th>
            </tr>
            <tr>
              <td>Method really exists</td>
              <td>Yes: shows in <code>methods</code>, <code>respond_to?</code>, documentation tools</td>
              <td>No: must fake it all</td>
            </tr>
            <tr>
              <td>Speed</td>
              <td>Normal method dispatch</td>
              <td>Slower: only runs after lookup fails</td>
            </tr>
            <tr>
              <td>Needs the names in advance</td>
              <td>Yes</td>
              <td>No</td>
            </tr>
            <tr>
              <td>Verdict</td>
              <td><strong>Prefer this</strong></td>
              <td>Only when the set is genuinely open</td>
            </tr>
          </tbody>
        </table>
        <p><code>send</code> calls a method by name, including private ones; <code>public_send</code> respects
            visibility and is what you should use when the name comes from user input or a registry.</p>
        <h3>2.13 Value objects with Data</h3>
        <pre><code>{"StepNode = Data.define(:name, :options)\n\nn = StepNode.new(name: :fetch, options: { source: \"arxiv\" })\np n, n.name, n.frozen?\np n.with(name: :refetch)\nn.instance_variable_set(:@name, :hacked)   # => FrozenError\n"}</code></pre>
        <pre className="plain"><code>{"#<data StepNode name=:fetch, options={:source=>\"arxiv\"}>\n:fetch\ntrue\n#<data StepNode name=:refetch, options={:source=>\"arxiv\"}>\nFrozenError: can't modify frozen StepNode: #<data Ste...\n"}</code></pre>
        <p><code>Data</code> (Ruby 3.2+) creates an immutable value class with readers, value equality, a decent
            <code>inspect</code>, and <code>with</code> for making modified copies. <strong>This is exactly what our AST
                nodes need</strong>, and it arrives with no boilerplate. Its mutable older sibling is
            <code>Struct</code>, which allows positional construction and assignment; prefer <code>Data</code> for
            anything representing a description rather than a state.</p>
        <p>Immutability in the AST is not aesthetic. In Milestone 11 pipelines rewrite themselves, and "rewrite" will
            mean "produce a new pipeline from the old one" rather than "mutate in place". That makes the old version
            still valid, makes diffs possible, and makes a failed transformation harmless.</p>
        <div className="exercise">
          <h5>Exercise 2.B — the capstone of Part 2</h5>
          <p>Build a miniature of the whole project in about sixty lines. Requirements:</p>
          <ul>
            <li>A <code>StepNode = Data.define(:name, :options)</code>.</li>
            <li>A <code>Builder</code> that collects step nodes and whose <code>method_missing</code> turns
                    <em>any</em> bare verb into a step, so <code>fetch "papers", from: "arxiv"</code> and
                    <code>summarize max_words: 50</code> both work. Include <code>respond_to_missing?</code>.</li>
            <li>A module method <code>Mini.pipeline(name, &block)</code> that evaluates the block against a
                    builder and returns a frozen <code>PipelineNode = Data.define(:name, :steps)</code>.</li>
            <li>A <code>Runner</code> that walks the steps and calls a handler registered by name in a Hash,
                    threading the result of each step into the next. Unknown step names must raise a clear error naming
                    the step and listing the known ones.</li>
            <li>Tests: that the AST is built correctly without anything executing, that running threads values
                    through, and that an unknown step raises.</li>
          </ul>
          <p>The one design rule: <strong>building must not execute anything.</strong> You should be able to build a
                pipeline whose steps are all unregistered and only get an error when you run it.</p>
        </div>
        <details>
          <summary>Solution 2.B — open after trying</summary>
          <pre><code>{"# frozen_string_literal: true\n\nmodule Mini\n  class Error < StandardError; end\n\n  class UnknownStep < Error\n    def initialize(name, known)\n      super(\"unknown step #{name.inspect}; known steps: #{known.sort.join(', ')}\")\n    end\n  end\n\n  StepNode     = Data.define(:name, :options)\n  PipelineNode = Data.define(:name, :steps)\n\n  # Builder only collects. It never runs anything, which is what makes\n  # dry runs, validation and rewriting possible later.\n  class Builder\n    attr_reader :steps\n\n    def initialize\n      @steps = []\n    end\n\n    def method_missing(name, *args, **options, &_block)\n      @steps << StepNode.new(name: name, options: options.merge(args: args))\n      self\n    end\n\n    def respond_to_missing?(_name, _include_private = false) = true\n  end\n\n  def self.pipeline(name, &block)\n    builder = Builder.new\n    builder.instance_eval(&block)\n    PipelineNode.new(name: name.to_sym, steps: builder.steps.freeze).freeze\n  end\n\n  class Runner\n    def initialize(handlers) = @handlers = handlers\n\n    def run(pipeline, input = nil)\n      pipeline.steps.reduce(input) do |acc, step|\n        handler = @handlers.fetch(step.name) { raise UnknownStep.new(step.name, @handlers.keys) }\n        handler.call(acc, **step.options)\n      end\n    end\n  end\nend\n"}</code></pre>
          <pre><code>{"pipeline = Mini.pipeline(\"research\") do\n  fetch \"papers\", from: \"arxiv\"\n  filter topic: \"AI\"\n  summarize max_words: 50\nend\n\np pipeline.steps.map(&:name)\n# => [:fetch, :filter, :summarize]\n\nhandlers = {\n  fetch:     ->(_input, args:, **) { [\"paper about #{args.first}\", \"paper about cats\"] },\n  filter:    ->(items, topic:, **) { items.grep(/#{topic}/i) },\n  summarize: ->(items, max_words:, **) { items.map { |i| i[0, max_words] } }\n}\n\np Mini::Runner.new(handlers).run(pipeline)\n# => [\"paper about papers\"]\n\nMini::Runner.new({}).run(pipeline)\n# => Mini::UnknownStep: unknown step :fetch; known steps:\n"}</code></pre>
          <p>Notes on the choices, several of which are the same choices the real project makes.</p>
          <ul>
            <li><strong><code>method_missing</code> returning <code>self</code>,</strong> and accepting
                    <code>*args, **options</code> so both positional and keyword forms work. Folding <code>args</code>
                    into the options Hash is a shortcut; the real version keeps them separate, because the validator
                    needs to check them differently.</li>
            <li><strong><code>respond_to_missing?</code> returning <code>true</code> unconditionally</strong> is
                    honest here (the builder really does accept anything) and is exactly what you must <em>not</em> do
                    in the real project, where the registry knows which verbs exist and a typo should be caught.</li>
            <li><strong><code>Hash#fetch</code> with a block</strong> raises your own error rather than
                    <code>KeyError</code>, and the message lists the known steps. Error messages that tell the user what
                    they could have written instead are the difference between a DSL people like and one they tolerate.
                </li>
            <li><strong><code>reduce</code> threads the accumulator</strong> through the steps, which is the entire
                    interpreter in one line. Milestone 5 expands it into a Runner with a Context, logging and
                    middleware, but the shape does not change.</li>
            <li><strong>Everything is frozen.</strong> Try adding a step to a built pipeline and you get a
                    <code>FrozenError</code> immediately rather than a mysterious mutation later.</li>
          </ul>
          <p>If you built something close to this, you have already written the skeleton of Milestones 1 through 5,
                and the rest of the course is about making each piece real: proper errors with source locations, a
                registry that validates, failure handling, plugins, inspection and packaging.</p>
        </details>
        <div className="warn">
          <h5>Common mistakes in Part 2</h5>
          <ul>
            <li><strong>Assuming <code>0</code> or <code>""</code> is falsy.</strong> They are not. Only
                    <code>nil</code> and <code>false</code>.</li>
            <li><strong>Using <code>return</code> at the end of a method.</strong> Harmless, but it marks you as a
                    tourist. Worse: <code>return</code> inside a proc exits the enclosing method.</li>
            <li><strong><code>hash[:key]</code> where you meant <code>hash.fetch(:key)</code>.</strong> The
                    <code>nil</code> travels and explodes far from the cause.</li>
            <li><strong>Mutating a string literal in a file with the frozen magic comment.</strong> Use
                    <code>dup</code> or, better, build new strings.</li>
            <li><strong><code>method_missing</code> without <code>respond_to_missing?</code>,</strong> or without
                    <code>super</code> for unhandled names. Both make objects that lie about themselves.</li>
            <li><strong><code>rescue Exception</code>.</strong> Now Ctrl-C does not work.</li>
            <li><strong>Forgetting that class bodies are executable code.</strong> <code>attr_reader</code>,
                    <code>include</code> and <code>private</code> are method calls that run when the class is defined,
                    not declarations.</li>
            <li><strong>Argument order errors:</strong> splat must precede keyword arguments, and
                    <code>assert_equal</code> takes expected first.</li>
          </ul>
        </div>
        <h4>Part 2 checkpoint</h4>
        <ol>
          <li>Why is <code>Integer.class</code> equal to <code>Class</code>, and why does that matter for a DSL?</li>
          <li>When would you use a Symbol rather than a String?</li>
          <li>Which values are falsy in Ruby? Name two idioms that depend on the answer.</li>
          <li>What does <code>&:upcase</code> do, mechanically?</li>
          <li>Give two differences between a proc and a lambda, and say which one you would store as a user-supplied
                callback.</li>
          <li>What is the difference between <code>include</code> and <code>extend</code>?</li>
          <li>What does <code>instance_eval</code> change, and why is that the foundation of Ruby DSLs?</li>
          <li>What two methods must you always define together, and what breaks if you do not?</li>
          <li>When is <code>define_method</code> better than <code>method_missing</code>?</li>
          <li>Why should the AST nodes be immutable?</li>
        </ol>
        <div className="why">
          <h5>Why are we using this language here? (Part 2 summary)</h5>
          <p>You have now seen the four features that make the rest of this course possible: blocks as syntax,
                <code>instance_eval</code> to redirect <code>self</code>, <code>method_missing</code> and
                <code>define_method</code> to decide the vocabulary at run time, and class bodies being ordinary
                executable code. No other mainstream language has all four, and it is why an entire generation of
                infrastructure tools put a Ruby DSL at the front.</p>
          <p>The honest cost, which you have also seen: none of this is checked before it runs. A typo in a step name,
                a proc whose <code>return</code> escapes, a <code>method_missing</code> that swallows a mistake, a
                monkey-patched method that changes behaviour three files away. Go's compiler would have caught most of
                the corresponding mistakes. Ruby gives you expressiveness and hands you the responsibility for
                correctness, which is why the testing milestone in this course is not optional and why Milestone 4's
                decision to build an inspectable AST matters so much: it is how we claw back some of what the compiler
                would have given us.</p>
        </div>
        <h3>What is next</h3>
        <p>Milestone 1 sets up the real gem, defines <code>Step</code> and <code>Registry</code> properly, and gets a
            test suite running. Milestone 2 introduces blocks as the DSL surface with an explicit builder argument, so
            you can see what <code>instance_eval</code> buys before we use it. Milestone 3 makes the switch and pays the
            price. By Milestone 5 you will have an interpreter.</p>
        <p>Before then, two things worth doing:</p>
        <ol>
          <li>Finish Exercise 2.B. The next instalment assumes you have felt the shape of it.</li>
          <li>Run <code>bundle gem automation</code> and commit the skeleton, and spend ten minutes in
                <code>irb</code> calling <code>.methods</code> on things. Ruby rewards poking at it in a way that
                compiled languages do not.</li>
        </ol>
        <footer className="end">
          <p>Instalment 6 of the five-course curriculum. Next: Ruby Milestones 1–4, where the gem gets real, blocks
                become a DSL, <code>instance_eval</code> earns and costs, and the whole thing turns into an AST.</p>
        </footer>
        <a className="button" href="/ruby-course/milestones/1-4/">Continue</a>
      </div>
    </div>
  );
}
