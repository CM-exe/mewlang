import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Ruby Milestones 9–12 — Testing, Inspection, Rewriting, Shipping",
};

export default function Page() {
  return (
    <div className="theme-ruby">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 9 · Course 2 (Ruby) · Milestones 9–12</p>
          <h1>Testing a language, drawing it, rewriting it, and putting it in a box</h1>
          <p className="lede">The gem ships testing helpers for its own users, learns to explain and diagram itself, gains
                the ability to rewrite pipelines into new ones, and becomes a command you can install.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Ruby 3.2.3. The suite finishes at 34 tests and 94 assertions, all passing, and every CLI transcript below
                is real output from <code>exe/automation</code>. Two new bugs are documented, one of which is the
                Milestone 6 shadowing trap catching me a second time in my own test file.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 9</span>Testing, including testing other people's
            pipelines</h2>
        <h3>Goal</h3>
        <p>Ship an <code>Automation::Testing</code> module so that anyone using the gem can test their pipelines and
            plugins without inventing their own scaffolding. Then use it to test our own.</p>
        <h3>Concepts</h3>
        <p>Spies rather than mocks, isolated registries, assertions that speak the domain's language, testing shape
            without execution, and making slow behaviour (retries, backoff) fast in tests.</p>
        <h3>Design</h3>
        <p>A DSL has a testing problem its users hit immediately: to test a pipeline you must either run the real steps
            (slow, networked, destructive) or stub them, and stubbing requires knowing how your registry works. If you
            do not answer that question, every user invents a different answer and most of them will be wrong.</p>
        <p>So testing support is a feature of the gem, not of the gem's test suite. Three pieces:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Piece</th>
              <th>Job</th>
            </tr>
            <tr>
              <td><code>Recorder</code></td>
              <td>A step implementation that remembers its calls and returns what you told it to</td>
            </tr>
            <tr>
              <td><code>test_registry</code> and <code>stub_step</code></td>
              <td>Isolation: one registry per test, no global state to reset</td>
            </tr>
            <tr>
              <td>Assertions</td>
              <td><code>assert_steps</code>, <code>assert_run_failed</code> and friends, so failures read usefully
                </td>
            </tr>
          </tbody>
        </table>
        <p>Note the choice of <strong>spy over mock</strong>. A mock asserts expectations up front ("you will be called
            once with these arguments") and fails inside the code under test, producing confusing backtraces. A spy
            records what happened and lets you assert afterwards, in the test, where the failure message belongs. For a
            pipeline, where the interesting question is usually "what did the third step actually receive", the spy wins
            easily.</p>
        <h3>Implementation</h3>
        <pre><code>{"    # Recorder is a step implementation that remembers how it was called\n    # and returns whatever you told it to.\n    class Recorder\n      attr_reader :calls\n\n      def initialize(result = nil, &block)\n        @result = result\n        @block = block\n        @calls = []\n      end\n\n      def call(input, *args, **options)\n        @calls << { input: input, args: args, options: options }\n        @block ? @block.call(input, *args, **options) : @result\n      end\n\n      def called? = !@calls.empty?\n      def call_count = @calls.size\n      def last_input = @calls.last&.fetch(:input)\n      def last_options = @calls.last&.fetch(:options)\n    end\n"}</code></pre>
        <p>Twenty lines and no dependency on a mocking library. It works because the registry accepts <em>anything with
                <code>#call</code></em>, a decision made back in Milestone 1 that keeps paying.</p>
        <pre><code>{"    def test_registry = @test_registry ||= Registry.new\n\n    def stub_step(name, result = nil, spec: nil, &block)\n      recorder = Recorder.new(result, &block)\n      test_registry.register(name, recorder, spec: spec)\n      recorder\n    end\n\n    def build_pipeline(name = \"test\", strict: true, &block)\n      Automation.define(name, registry: test_registry, strict: strict, &block)\n    end\n\n    def assert_run_failed(result, step: nil, error: nil)\n      refute result.ok?, \"expected the run to fail, but it succeeded\"\n      assert_equal step.to_sym, result.failed_step.name if step\n      assert_kind_of error, unwrap(result.error) if error\n      result\n    end\n"}</code></pre>
        <p><code>@test_registry ||= Registry.new</code> gives every test its own registry, created on first use and
            discarded with the test instance. <strong>No global state means no teardown and no order
                dependence</strong>, which is worth more than any amount of careful cleanup code.</p>
        <h3>What a user's test looks like</h3>
        <pre><code>{"class TestingHelpersTest < Minitest::Test\n  include Automation::Testing\n\n  def test_stubs_record_how_they_were_called\n    fetch = stub_step(:fetch, [{ title: \"one\" }])\n    # NOT `upcase = ...`: a local variable of that name would shadow the\n    # verb inside the DSL block and the step would silently disappear.\n    upcaser = stub_step(:upcase) { |records| records.map { |r| r.merge(title: r[:title].upcase) } }\n\n    pipeline = build_pipeline(\"t\") do\n      fetch from: \"somewhere\"\n      upcase\n    end\n\n    result = assert_run_ok(run_pipeline(pipeline))\n\n    assert fetch.called?\n    assert_equal({ from: \"somewhere\" }, fetch.last_options)\n    assert_equal [{ title: \"ONE\" }], result.payload\n    assert_equal [{ title: \"one\" }], upcaser.last_input\n  end\n\n  def test_assertions_about_shape_need_no_execution\n    stub_step(:fetch)\n    stub_step(:save_to)\n\n    pipeline = build_pipeline(\"t\") do\n      fetch from: \"x\"\n      save_to collection: \"papers\"\n    end\n\n    assert_steps %i[fetch save_to], pipeline\n    assert_step_options({ collection: \"papers\" }, pipeline, :save_to)\n    assert_pipeline_valid pipeline\n  end\n\n  def test_retry_behaviour_is_testable_without_waiting\n    attempts = 0\n    stub_step(:flaky) do\n      attempts += 1\n      raise IOError, \"nope\" if attempts < 3\n\n      \"ok after #{attempts}\"\n    end\n\n    pipeline = build_pipeline(\"t\") do\n      retry_on IOError, times: 5, backoff: :none\n      flaky\n    end\n\n    result = assert_run_ok(run_pipeline(pipeline))\n    assert_equal \"ok after 3\", result.payload\n    assert_equal 3, result.results.first.attempts\n  end\nend\n"}</code></pre>
        <p><code>backoff: :none</code> is why <code>RetryPolicy</code> has a <code>backoff</code> field instead of a
            hard-coded schedule. A retry test that sleeps is a test people delete. Making slow behaviour configurable is
            a testability decision you make when you design the feature, not afterwards.</p>
        <p><code>test_assertions_about_shape_need_no_execution</code> is the one to copy into your own projects: it
            checks the pipeline is well-formed without running a thing, which is only possible because building produces
            data.</p>
        <div className="warn">
          <h5>The shadowing bug, a second time, in my own test</h5>
          <p>My first version of the first test read:</p>
          <pre className="bad"><code>{"upcase = stub_step(:upcase) { |records| ... }\n\npipeline = build_pipeline(\"t\") do\n  fetch from: \"somewhere\"\n  upcase                        # the local variable, not the verb\nend"}</code></pre>
          <p>The test failed with <code>Expected: [{'{'}:title={'>'}"ONE"{'}'}], Actual: [{'{'}:title={'>'}"one"{'}'}]</code>. The
                pipeline had one step instead of two, because <code>upcase</code> resolved to the local variable holding
                the Recorder, and evaluating a variable adds no step.</p>
          <p>I documented this exact hazard in Milestone 6 and then walked into it again ten minutes later, which
                tells you how easy it is. Two conclusions. First, the naming convention matters: name the spy
                <code>upcaser</code>, <code>fetch_spy</code>, anything that is not the verb. Second, and more usefully,
                <strong>this is a design smell in the DSL, not only in the test</strong>. A language where an identifier
                can silently mean either a verb or a variable will bite your users. If I were shipping this seriously,
                <code>build_pipeline</code> would compare the resulting step list against the verbs mentioned in the
                block source, or at minimum the documentation would carry a warning with this example in it.</p>
        </div>
        <div className="warn">
          <h5>A duck-typing bug the helpers exposed</h5>
          <p>Adding <code>Recorder</code> broke four tests with
                <code>undefined method 'parameters' for #{'<'}Recorder{'>'}</code>. The validator from Milestone 4 assumed
                every callable answers <code>parameters</code>, which is true of Procs, lambdas and Methods, and false
                of an arbitrary object that merely has <code>#call</code>.</p>
          <pre><code>{"    # Anything with #call is a valid step, but only some of those things\n    # can be asked about their arguments. Procs and Methods answer\n    # #parameters directly; an arbitrary object is asked about its #call;\n    # anything else opts out of checking rather than crashing the validator.\n    def parameters_of(impl)\n      return impl.parameters if impl.respond_to?(:parameters)\n      return impl.method(:call).parameters if impl.respond_to?(:method)\n\n      nil\n    end"}</code></pre>
          <p>The lesson is general: <strong>if you accept a duck, check every feather you use.</strong> We advertised
                "anything responding to <code>#call</code>" and then quietly required a second method.
                <code>impl.method(:call).parameters</code> is the correct general answer, and returning <code>nil</code>
                to mean "cannot check" is better than raising, because a validator that crashes on an unusual step is
                worse than one that declines to judge it.</p>
          <p>While investigating I also found a latent hazard in Milestone 7's builder-class cache, which was keyed on
                <code>registry.object_id</code>. Object ids are <em>recycled</em> after garbage collection, so two
                different registries can share one and the cache can hand out the wrong verbs. The cache now lives on
                the registry itself. <strong><code>object_id</code> is not a durable identity</strong>, in Ruby or
                anywhere else with a moving or reusing allocator.</p>
        </div>
        <div className="cmp">
          <h5>The same test in RSpec</h5>
          <pre className="plain"><code>{"RSpec.describe \"research pipeline\" do\n  include Automation::Testing\n\n  let(:fetch) { stub_step(:fetch, [{ title: \"one\" }]) }\n\n  subject(:pipeline) do\n    build_pipeline(\"research\") { fetch from: \"somewhere\" }\n  end\n\n  it \"passes the options through\" do\n    fetch                                   # force the let to run\n    expect(run_pipeline(pipeline)).to be_ok\n    expect(fetch.last_options).to eq(from: \"somewhere\")\n  end\nend"}</code></pre>
          <p>The helpers work in both because they are plain methods in a module, which is the right way to ship test
                support: no dependency on a framework, no <code>RSpec.configure</code> in your gem.</p>
          <p>One RSpec-specific hazard worth knowing: <code>let</code> is lazy, so a spy defined in a <code>let</code>
                is not registered until something references it, and a pipeline built before that reference will not see
                the step. Minitest's eager <code>setup</code> has the opposite trade-off. Neither is wrong; both
                surprise people once.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 9</h5>
          <p>Ship a <strong>plugin contract test</strong>: a module a third-party plugin author includes to check
                their plugin behaves like a good citizen. It should verify that the plugin declares a
                <code>step_name</code>, that every required option is genuinely required (constructing without it and
                calling raises or the validator complains), that <code>call</code> with an empty input does not raise,
                that building a pipeline containing it executes nothing, and that it does not mutate its input.</p>
          <p>Requirements: the author writes only <code>def plugin_class = MyPlugin</code> and
                <code>def valid_options = {'{'}from: "x"{'}'}</code>. Include a test that your own <code>Steps::Filter</code>
                passes it, and one that a deliberately bad plugin fails it.</p>
        </div>
        <details>
          <summary>Solution 9 — open after trying</summary>
          <pre><code>{"module Automation\n  module Testing\n    # Include this in a test case, define plugin_class and valid_options,\n    # and your plugin is checked against the contract every step must meet.\n    module PluginContract\n      include Automation::Testing\n\n      def test_declares_a_step_name\n        assert_kind_of Symbol, plugin_class.step_name\n        refute_empty plugin_class.step_name.to_s\n      end\n\n      def test_every_required_option_is_enforced\n        required = plugin_class.options_spec.select { |_, m| m[:required] }.keys\n\n        required.each do |key|\n          plugin_class.register!(test_registry)\n          pipeline = build_pipeline(\"t\", strict: false) do\n            public_send(plugin_class.step_name, **valid_options.except(key))\n          end\n          assert_pipeline_invalid pipeline, matching: /#{key}/\n        end\n      end\n\n      def test_handles_empty_input_without_raising\n        plugin_class.call([], **valid_options)\n      rescue StandardError => e\n        flunk \"#{plugin_class} raised on empty input: #{e.class}: #{e.message}\"\n      end\n\n      def test_does_not_mutate_its_input\n        input = [{ title: \"a\" }, { title: \"b\" }].freeze\n        copy = Marshal.load(Marshal.dump(input))\n\n        plugin_class.call(input, **valid_options)\n\n        assert_equal copy, input, \"#{plugin_class} modified the records it was given\"\n      end\n\n      def test_building_a_pipeline_with_it_executes_nothing\n        plugin_class.register!(test_registry)\n        calls = 0\n        plugin_class.singleton_class.prepend(Module.new do\n          define_method(:call) { |*a, **o| calls += 1; super(*a, **o) }\n        end)\n\n        build_pipeline(\"t\") { public_send(plugin_class.step_name, **valid_options) }\n\n        assert_equal 0, calls\n      end\n    end\n  end\nend\n\nclass FilterContractTest < Minitest::Test\n  include Automation::Testing::PluginContract\n\n  def plugin_class = Automation::Steps::Filter\n  def valid_options = { field: :topic, matching: \"AI\" }\nend\n"}</code></pre>
          <p>Four things this exercise teaches beyond the code.</p>
          <ul>
            <li><strong>A contract test is a specification you can execute.</strong> Everything a plugin must do is
                    written once, checked automatically, and available to people who have never read your source. This
                    is how a plugin ecosystem stays coherent without a maintainer policing it.</li>
            <li><strong>The immutability check is the valuable one.</strong> A step that mutates the records it is
                    given breaks the next author's pipeline in a way that is very hard to trace, and no amount of
                    documentation prevents it. Freezing the input in the test and comparing a deep copy catches it
                    mechanically.</li>
            <li><strong><code>public_send(plugin_class.step_name, ...)</code></strong> is how a test calls a verb
                    whose name it does not know until run time. Inside the DSL block that is exactly what the generated
                    methods make possible.</li>
            <li><strong>The anonymous module prepended in the last test</strong> is the counting trick from
                    Milestone 7, used as a test instrument. Note it permanently modifies the class for the rest of the
                    process, which is acceptable in a test suite and would not be in production code.</li>
          </ul>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does the gem ship testing helpers rather than keeping them in its own test directory?</li>
          <li>What is the difference between a spy and a mock, and why does a spy suit pipelines?</li>
          <li>Why does each test get its own registry?</li>
          <li>Why is <code>backoff</code> a configurable field rather than a fixed schedule?</li>
          <li>What went wrong when the validator met a <code>Recorder</code>, and what is the general rule?</li>
          <li>Why is <code>object_id</code> a bad cache key?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 10</span>Pipelines that describe themselves</h2>
        <h3>Goal</h3>
        <p>Three functions of the AST and nothing else: <code>explain</code> for humans, <code>to_mermaid</code> for
            documentation, and <code>diff</code> for change review.</p>
        <h3>Concepts</h3>
        <p>Reflection over your own data structures, generating diagrams as text, and value equality doing the work of a
            diff algorithm.</p>
        <h3>Implementation</h3>
        <pre><code>{"    def explain(pipeline, registry: Automation.registry)\n      lines = [\"#{pipeline.name} (#{pipeline.location})\"]\n\n      pipeline.steps.each_with_index do |step, i|\n        known = registry.registered?(step.name)\n        marker = known ? \" \" : \"?\"\n        lines << format(\"  %s%-2d %-40s %s\", marker, i + 1, step.to_s, step.location)\n\n        doc = known ? registry.entry(step.name).doc : \"UNKNOWN STEP\"\n        lines << \"        #{doc}\" if doc\n      end\n\n      pipeline.handlers.each do |handler|\n        detail = handler.kind == :retry_on ? handler.callable.to_s : \"a block\"\n        lines << format(\"  * %-42s %s\", \"#{handler.kind}: #{detail}\", handler.location)\n      end\n\n      lines.join(\"\\n\")\n    end\n"}</code></pre>
        <pre className="plain"><code>{"$ automation explain examples/research.rb\nresearch (research.rb:5)\n   1  fetch(from: \"https://example.invalid/papers.json\", limit: 20) research.rb:7\n        Fetch a JSON array of records from an HTTP endpoint.\n   2  filter(field: :topic, matching: \"AI\")    research.rb:8\n        Keep records whose field matches a value or pattern.\n   3  summarize(field: :abstract, max_words: 40) research.rb:9\n        Summarise a field of each record into :summary.\n   4  save_to(collection: \"knowledge_base\")    research.rb:10\n        Append records to a collection in the knowledge base.\n  * retry_on: retry Automation::HttpError up to 3x (exponential) research.rb:6\n  * when_failed: a block                       research.rb:12\n"}</code></pre>
        <p>Every piece of that output was declared somewhere else for another reason: the step names and options by the
            DSL, the locations by <code>caller_locations</code> in Milestone 4, the documentation by the
            <code>doc</code> class macro in Milestone 7, the retry description by <code>RetryPolicy#to_s</code> in
            Milestone 6. <strong>Nothing here is a feature; it is a report over decisions already made.</strong> That is
            what people mean when they say a good data model pays for itself.</p>
        <h4>Drawing itself</h4>
        <pre><code>{"    # Mermaid is renderable by GitHub, GitLab and most documentation tools,\n    # so a pipeline can draw itself into a README.\n    def to_mermaid(pipeline)\n      lines = [\"flowchart TD\", \"  start([#{pipeline.name}])\"]\n      previous = \"start\"\n\n      pipeline.steps.each_with_index do |step, i|\n        id = \"s#{i}\"\n        label = [step.name, *step.options.map { |k, v| \"#{k}=#{v}\" }].join(\"<br/>\")\n        lines << \"  #{id}[\\\"#{label}\\\"]\"\n        lines << \"  #{previous} --> #{id}\"\n        previous = id\n      end\n\n      lines << \"  #{previous} --> done([done])\"\n      ...\n    end\n"}</code></pre>
        <pre className="plain"><code>{"flowchart TD\n  start([research])\n  s0[\"fetch<br/>from=arxiv<br/>since=7d\"]\n  start --> s0\n  s1[\"filter<br/>topic=AI\"]\n  s0 --> s1\n"}</code></pre>
        <p>Generating Mermaid rather than an image means the output is text: diffable, greppable, renderable by GitHub
            without a build step, and editable by someone who does not have your gem installed. When you need a diagram
            from a program, emitting a text format that something else renders is almost always better than emitting
            pixels.</p>
        <h4>Diffing, for free</h4>
        <pre><code>{"    def diff(before, after)\n      before_by_name = before.steps.group_by(&:name)\n      after_by_name = after.steps.group_by(&:name)\n\n      added = after.steps.reject { |s| before_by_name.key?(s.name) }\n      removed = before.steps.reject { |s| after_by_name.key?(s.name) }\n\n      changed = before.steps.filter_map do |old|\n        new = after_by_name[old.name]&.first\n        next if new.nil?\n        next if old.args == new.args && old.options == new.options\n\n        [old, new]\n      end\n      ...\n    end\n"}</code></pre>
        <pre className="plain"><code>{"+ deduplicate()\n- filter(topic: \"AI\")\n~ summarize(max_words: 200)  ->  summarize(max_words: 80)\n"}</code></pre>
        <p>This works because <code>StepNode</code> is a <code>Data</code>, so <code>old.options == new.options</code>
            compares contents. Had the nodes been ordinary objects without value equality, every comparison would be
            identity and every step would look changed. <strong>The diff is three lines of logic and one line of data
                modelling done four milestones earlier.</strong></p>
        <p>Note what this deliberately is not: a real diff algorithm. It matches steps by name, so a pipeline with two
            <code>fetch</code> steps will confuse it, and it reports reordering as a boolean rather than as moves. For a
            change-review tool that is fine; if you needed better, the right move is a proper sequence alignment (the
            same algorithm <code>git diff</code> uses), not more special cases.</p>
        <div className="exercise">
          <h5>Exercise 10</h5>
          <ol>
            <li><strong>Handle duplicates.</strong> Make <code>diff</code> correct for pipelines containing two
                    steps with the same name. Decide whether to match by position, by options, or by a stable identity
                    you add to <code>StepNode</code>, and write down why.</li>
            <li><strong>A review command.</strong> Add <code>automation diff FILE PIPELINE --against REF</code> that
                    loads the pipeline from a git revision (<code>git show REF:FILE</code>) and prints the diff. Exit
                    non-zero when anything changed, so it can be a CI check.</li>
            <li><strong>Cost annotations.</strong> Let a plugin declare <code>cost :network</code> or
                    <code>cost :expensive</code>, and have <code>explain</code> summarise how many network calls a
                    pipeline will make before it runs.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 10 — open after trying</summary>
          <p><strong>1.</strong> The honest answer is to give each step a stable identity at build time:</p>
          <pre><code>{"StepNode = Data.define(:id, :name, :args, :options, :location)\n# id: \"#{name}@#{location}\", assigned by the builder\n"}</code></pre>
          <p>Matching by position breaks the moment someone inserts a step at the top; matching by options means a
                step whose options changed looks like an add plus a remove, which is exactly what a diff should avoid
                saying. An identity derived from the source location is stable across edits elsewhere in the file and is
                already available. The cost is that a rewritten step needs a new id, and you must decide whether
                <code>set_options</code> preserves it (it should) while <code>replace</code> does not.</p>
          <p>This is the same problem React solves with <code>key</code> props and that database migrations solve with
                explicit identifiers, and the answer is always the same: <strong>if you want to diff a sequence, put
                    identity in the elements rather than inferring it.</strong></p>
          <p><strong>2.</strong> The interesting part is loading two versions of the same pipeline into one process.
                Since <code>Automation.define</code> registers by name, loading the old version overwrites the new one.
                Fix it by loading each into its own registry and pipeline table, or more simply by shelling out to a
                subprocess that prints <code>to_h</code> as JSON and comparing the data:</p>
          <pre className="plain"><code>{"old_json = `git show #{ref}:#{file} | automation --format json explain -`\n"}</code></pre>
          <p>Preferring data over shared process state is the theme of the whole course, and it applies to your own
                tooling too.</p>
          <p><strong>3.</strong> <code>cost :network</code> is one more class macro storing metadata, and
                <code>explain</code> counting it is four lines. The valuable part is what it enables: a policy
                (Milestone 11) that refuses to define a pipeline making more than N network calls without an explicit
                <code>retry_on</code>, which is the kind of rule that is impossible to enforce with a YAML file and
                trivial with an inspectable AST.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Where does every piece of the <code>explain</code> output originally come from?</li>
          <li>Why emit Mermaid text rather than an image?</li>
          <li>Why does the diff work without a diff algorithm?</li>
          <li>What breaks the diff, and what is the standard fix for that class of problem?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 11</span>Pipelines that rewrite themselves</h2>
        <h3>Goal</h3>
        <p>A rewrite API that produces new pipelines from old ones, organisation-wide policies applied to every pipeline
            as it is defined, and a pipeline that improves its own successor based on measurements of its last run.</p>
        <h3>Concepts</h3>
        <p>Transformation as a pure function, a second small DSL layered on the first, safety limits on generated
            structure, and the difference between modifying a running program and producing its replacement.</p>
        <h3>Design</h3>
        <p>"Dynamically modifiable pipelines" can mean two very different things, and the distinction matters more than
            the implementation.</p>
        <table className="grid">
          <tbody>
            <tr>
              <th></th>
              <th>Mutate the running pipeline</th>
              <th>Produce a successor</th>
            </tr>
            <tr>
              <td>Consistency</td>
              <td>A run can change under its own feet</td>
              <td>Each run has one fixed definition</td>
            </tr>
            <tr>
              <td>Reproducibility</td>
              <td>Logs describe something that no longer exists</td>
              <td>Every version is a value you can keep</td>
            </tr>
            <tr>
              <td>Failure</td>
              <td>A bad transformation corrupts a live run</td>
              <td>A bad transformation is discarded</td>
            </tr>
            <tr>
              <td>Complexity</td>
              <td>Runner must handle steps appearing mid-run</td>
              <td>None: the runner never learns about it</td>
            </tr>
          </tbody>
        </table>
        <p>We take the second, and it is not a compromise. <strong>Everything people actually want from self-modifying
                pipelines (adaptive optimisation, feature flags, A/B variants, policy enforcement) is achievable by
                generating a new pipeline value</strong>, and the one thing it rules out (a step rewriting the steps
            after it while they are in flight) is a debugging nightmare nobody should want.</p>
        <h3>Implementation</h3>
        <pre><code>{"  # Rewrite is a tiny DSL for describing changes to a pipeline. It collects\n  # operations and applies them to produce a NEW pipeline; the original is\n  # never touched, so a transformation that goes wrong costs nothing.\n  class Rewrite\n    MAX_STEPS = 500\n\n    def step(name, *args, **options)\n      AST::StepNode.new(name: name.to_sym, args: args.freeze,\n                        options: options.freeze, location: \"(rewritten)\")\n    end\n\n    def insert_before(name, node) = record { |steps| insert_at(steps, name, node, 0) }\n    def insert_after(name, node)  = record { |steps| insert_at(steps, name, node, 1) }\n    def append(node)              = record { |steps| steps + [node] }\n    def prepend(node)             = record { |steps| [node] + steps }\n    def remove(name)              = record { |steps| steps.reject { |s| s.name == name.to_sym } }\n\n    def replace(name, node)\n      record { |steps| steps.map { |s| s.name == name.to_sym ? node : s } }\n    end\n\n    def set_options(name, **options)\n      record do |steps|\n        steps.map { |s| s.name == name.to_sym ? s.with(options: s.options.merge(options).freeze) : s }\n      end\n    end\n\n    def apply\n      steps = @operations.reduce(@pipeline.steps) { |acc, op| op.call(acc) }\n\n      if steps.size > MAX_STEPS\n        raise Error, \"rewrite produced #{steps.size} steps, over the limit of #{MAX_STEPS}\"\n      end\n\n      @pipeline.with_steps(steps)\n    end\n  end\n"}</code></pre>
        <p>Each operation is a lambda from a step list to a step list, collected rather than applied immediately, and
            then folded in <code>apply</code>. That buys two things: nothing happens until <code>apply</code>, so a
            rewrite can be inspected or abandoned; and the fold means a failed operation halfway through leaves the
            original untouched, because we were never mutating it.</p>
        <p><code>MAX_STEPS</code> is the boring safety feature that matters. A policy with a bug can append a step every
            time it runs, and without a limit the first symptom is memory exhaustion. Any code that generates structure
            needs a bound on the structure it generates.</p>
        <pre><code>{"  module AST\n    PipelineNode.class_eval do\n      # pipeline.rewrite { insert_before :summarize, step(:deduplicate) }\n      def rewrite(&block)\n        rewriter = Rewrite.new(self)\n        rewriter.instance_eval(&block)\n        rewriter.apply\n      end\n    end\n  end\n"}</code></pre>
        <p><code>class_eval</code> reopens the generated <code>Data</code> class to add a method, which is the
            class-reopening that Ruby is famous for, used here on a class we own. And <code>instance_eval</code> appears
            a second time, making a second DSL: the vocabulary inside a <code>rewrite</code> block is
            <code>insert_before</code>, <code>remove</code>, <code>step</code>. Once you have the technique, layering
            little languages becomes routine, which is a large part of why Ruby codebases look the way they do.</p>
        <h4>It works, and the original is untouched</h4>
        <pre className="plain"><code>{"--- rewriting: a new pipeline, the original untouched ---\n[:fetch, :filter, :summarize, :save_to]\n[:fetch, :deduplicate, :summarize, :save_to]\n+ deduplicate()\n- filter(topic: \"AI\")\n~ summarize(max_words: 200)  ->  summarize(max_words: 80)\n\n--- a rewrite that cannot happen leaves everything alone ---\nrefused: no step named :nonexistent in research\n[:fetch, :filter, :summarize, :save_to]\n"}</code></pre>
        <h4>Policies: rules for every pipeline</h4>
        <pre><code>{"  # Policies are rules applied to every pipeline as it is defined: the\n  # place for organisation-wide requirements (\"always log\", \"never fetch\n  # without a timeout\") that individual authors should not have to repeat.\n  module Policies\n    def apply(pipeline)\n      all.reduce(pipeline) do |acc, (name, rule)|\n        result = rule.call(acc)\n        unless result.is_a?(AST::PipelineNode)\n          raise Error, \"policy #{name} returned #{result.class}, expected a PipelineNode\"\n        end\n\n        result\n      end\n    end\n  end\n"}</code></pre>
        <pre><code>{"Automation::Policies.register(:always_log_first) do |pl|\n  pl.step_names.first == :log_start ? pl : pl.rewrite { prepend step(:log_start) }\nend\n\nAutomation::Policies.register(:cap_summaries) do |pl|\n  pl.find(:summarize) ? pl.rewrite { set_options :summarize, max_words: 50 } : pl\nend\n"}</code></pre>
        <pre className="plain"><code>{"[:log_start, :fetch, :summarize]\n{:max_words=>50}\n"}</code></pre>
        <p>A user wrote <code>max_words: 5000</code> and got 50, and never asked for a logging step but has one. This is
            genuinely powerful and genuinely dangerous, so two observations.</p>
        <p>First, <strong>the idempotence check in <code>always_log_first</code> is not optional</strong>. Without
            <code>pl.step_names.first == :log_start ?</code>, every re-application prepends another step, and since
            policies run on every <code>define</code>, a pipeline rewritten and re-registered grows without bound.
            <code>MAX_STEPS</code> would eventually stop it, which is a crash rather than an answer. A policy should be
            a function whose second application changes nothing.</p>
        <p>Second, <strong>a policy that silently changes what a user wrote is a debugging trap.</strong> <code>explain</code> mitigates it (the injected step shows a location of <code>(rewritten)</code>), and a
            serious version would record which policy made each change and print that. Governance you cannot see is
            governance people fight.</p>
        <h4>A pipeline that improves its successor</h4>
        <pre><code>{"result = Automation.run(measured)\n\nslow = result.results.select { |r| r.seconds > 0.01 }.map { |r| r.step.name }\nsuccessor = slow.reduce(measured) do |acc, name|\n  acc.rewrite { insert_before name, step(:cache, for: name) }\nend\n"}</code></pre>
        <pre className="plain"><code>{"slow steps: [:slow_step]\n[:log_start, :fetch, :cache, :slow_step]\n{:for=>:slow_step}\n"}</code></pre>
        <p>The run produced measurements; the measurements produced a transformation; the transformation produced a new
            pipeline. Nothing was mutated, the original <code>measured</code> is still valid and still describes the run
            that happened, and the successor can be inspected, diffed, reviewed, persisted or thrown away.</p>
        <p>That loop (<em>observe, decide, generate a new version</em>) is the honest form of "a program that modifies
            itself", and it is the form used by query planners, JIT compilers and autoscalers. The fantasy version,
            where code edits itself in place while running, is not what any of those systems actually do.</p>
        <div className="exercise">
          <h5>Exercise 11</h5>
          <ol>
            <li><strong>Fixpoint and idempotence.</strong> Apply policies repeatedly until the pipeline stops
                    changing, with a limit of, say, 10 rounds. If the limit is hit, raise an error naming the policies
                    that are still changing things. Then add a test that a deliberately non-idempotent policy is caught
                    rather than looping.</li>
            <li><strong>Provenance.</strong> Record which policy or rewrite introduced each step, and show it in
                    <code>explain</code> as <code>(added by :always_log_first)</code>.</li>
            <li><strong>Opt out.</strong> Let a pipeline declare <code>skip_policy :cap_summaries</code>, and decide
                    (and document) whether policies should be skippable at all.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 11 — open after trying</summary>
          <pre><code>{"    MAX_ROUNDS = 10\n\n    def apply(pipeline)\n      MAX_ROUNDS.times do\n        after = all.reduce(pipeline) { |acc, (name, rule)| check(name, rule.call(acc)) }\n        return after if after == pipeline   # value equality: a fixpoint\n\n        pipeline = after\n      end\n\n      culprits = all.reject { |_, rule| rule.call(pipeline) == pipeline }.keys\n      raise Error, \"policies did not settle after #{MAX_ROUNDS} rounds; \" \\\n                   \"not idempotent: #{culprits.join(', ')}\"\n    end\n"}</code></pre>
          <p><strong><code>after == pipeline</code> is the whole trick</strong>, and it only works because the AST is
                made of <code>Data</code> objects with value equality. A fixpoint loop over mutable objects would need a
                hand-written comparison, and would probably get it wrong.</p>
          <p>Naming the culprits in the error is what turns a frustrating message into a fixable one: applying each
                policy once more and reporting which ones still change something identifies the offender exactly.</p>
          <p><strong>Provenance</strong> means adding a field to <code>StepNode</code> (<code>added_by</code>,
                defaulting to <code>nil</code>) and having <code>Rewrite</code> stamp it. The interesting decision is
                that <code>Rewrite</code> does not know the policy's name, so <code>Policies.apply</code> must pass it
                in, which means <code>rewrite</code> needs an optional <code>source:</code> argument. That ripple is
                typical: provenance is cheap to add at the start and awkward to retrofit, which is an argument for
                putting it in from the beginning of any system that transforms user input.</p>
          <p><strong>Opting out</strong> deserves a real answer rather than a feature. If policies exist to enforce
                organisational requirements (audit logging, rate limits, cost caps), a per-pipeline opt-out defeats
                them, and the correct design is that opting out is itself a policy decision: a list of exemptions held
                by whoever owns the policy, not a keyword any author can write. If policies exist merely as helpful
                defaults, an opt-out is fine. <strong>Deciding which kind you have is the design work; the code either
                    way is five lines.</strong></p>
        </details>
        <h4>Common mistakes in Milestone 11</h4>
        <div className="warn">
          <ul>
            <li><strong>Non-idempotent policies.</strong> Steps multiply on every define.</li>
            <li><strong>Mutating the step array</strong> inside a rewrite operation instead of returning a new one.
                    <code>FrozenError</code> if you froze, silent corruption if you did not.</li>
            <li><strong>No bound on generated structure.</strong> Add the limit before you need it.</li>
            <li><strong>Rewriting during a run.</strong> Generate a successor instead.</li>
            <li><strong>Invisible transformations.</strong> If <code>explain</code> cannot show that a policy
                    changed something, users will assume the tool is broken.</li>
            <li><strong>Policies that return something other than a pipeline.</strong> Check the type and say which
                    policy misbehaved; a <code>NoMethodError</code> three frames away is not a useful report.</li>
          </ul>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 12</span>Shipping it</h2>
        <h3>Goal</h3>
        <p>A gemspec with no runtime dependencies, an <code>automation</code> command with four subcommands and honest
            exit codes, a documented trust boundary between Ruby pipeline files and JSON ones, and the release
            mechanics.</p>
        <h3>Concepts</h3>
        <p>Gem packaging, <code>OptionParser</code>, exit codes as an interface, and keeping a CLI thin enough that the
            library remains the product.</p>
        <h3>The gemspec</h3>
        <pre><code>{"Gem::Specification.new do |spec|\n  spec.name = \"automation\"\n  spec.version = Automation::VERSION\n  spec.summary = \"A Ruby DSL for describing, inspecting and running automation pipelines.\"\n  spec.homepage = \"https://github.com/yourname/automation\"\n  spec.license = \"MIT\"\n  spec.required_ruby_version = \">= 3.2.0\"\n\n  spec.metadata[\"source_code_uri\"] = spec.homepage\n  spec.metadata[\"changelog_uri\"] = \"#{spec.homepage}/blob/main/CHANGELOG.md\"\n  spec.metadata[\"rubygems_mfa_required\"] = \"true\"\n\n  spec.files = Dir[\"lib/**/*.rb\", \"exe/*\", \"README.md\", \"CHANGELOG.md\", \"LICENSE.txt\"]\n  spec.bindir = \"exe\"\n  spec.executables = [\"automation\"]\n  spec.require_paths = [\"lib\"]\n\n  # No runtime dependencies on purpose: everything used here ships with Ruby.\nend\n"}</code></pre>
        <ul>
          <li><strong><code>required_ruby_version</code> is not decoration.</strong> We use <code>Data.define</code>
                (3.2) and endless methods (3.0), so an older Ruby fails with a syntax error at load time rather than a
                clear message. Declaring the floor means <code>gem install</code> refuses politely.</li>
          <li><strong><code>rubygems_mfa_required</code></strong> makes it impossible to publish a version of your gem
                without two-factor authentication. Supply-chain attacks on package registries are routine; this is one
                line.</li>
          <li><strong><code>changelog_uri</code></strong> puts a Changelog link on the RubyGems page, which is the
                difference between users being able to evaluate an upgrade and not.</li>
          <li><strong>Zero runtime dependencies</strong> is a feature worth defending. Every dependency is a version
                constraint your users must satisfy and a security surface you inherit. We needed HTTP, JSON, a store,
                option parsing, spell-checking and a test framework, and Ruby's standard library has all of them.</li>
        </ul>
        <h3>The CLI</h3>
        <pre><code>{"  class CLI\n    COMMANDS = {\n      \"run\" => :cmd_run,\n      \"explain\" => :cmd_explain,\n      \"graph\" => :cmd_graph,\n      \"list\" => :cmd_list\n    }.freeze\n\n    def call(argv)\n      options = { dry_run: false, safe: false, vars: {}, verbose: false }\n      parser = build_parser(options)\n      parser.parse!(argv)\n\n      command = COMMANDS[argv.shift]\n      return usage(parser) unless command\n\n      file = argv.shift\n      return usage(parser, \"a pipeline file is required\") unless file\n\n      load_pipelines(file, options)\n      send(command, argv.shift, options)\n    rescue Automation::InvalidPipeline => e\n      warn e.message\n      1\n    rescue Automation::Error => e\n      warn \"automation: #{e.message}\"\n      1\n    end\n"}</code></pre>
        <p>Points worth copying into your own CLIs:</p>
        <ul>
          <li><strong>Every method returns an exit code</strong> and <code>exit</code> happens exactly once, at the
                bottom of the file. That makes the whole CLI testable by calling
                <code>CLI.new.call(%w[run file.rb])</code> and asserting on the integer.</li>
          <li><strong>Errors go to <code>$stderr</code> via <code>warn</code>, results to
                    <code>$stdout</code>.</strong> Then <code>automation explain x.rb | less</code> works and error
                messages are not swallowed by a pipe.</li>
          <li><strong>Exit codes are an interface:</strong> 0 success, 1 the pipeline failed, 2 you invoked me
                wrongly. A CI job depends on this distinction.</li>
          <li><strong>A dispatch Hash beats a <code>case</code></strong> here because it doubles as the list of valid
                commands for the usage message.</li>
          <li><strong><code>OptionParser</code> ships with Ruby</strong> and is enough. Thor and dry-cli are nicer for
                large tools and are dependencies.</li>
        </ul>
        <div className="warn">
          <h5>A bug worth showing: two methods called <code>run</code></h5>
          <p>My first version named the entry point <code>run(argv)</code> and the subcommand handler
                <code>run(name, options)</code>. The second definition silently replaced the first, and the delegation I
                had written to paper over it produced:</p>
          <pre className="bad"><code>{"exe/automation:42:in `run': super: no superclass method `run' for #<Automation::CLI>"}</code></pre>
          <p>Ruby lets you redefine a method with no warning at all, and the resulting error appears somewhere
                unrelated. The fix was a dispatch table and <code>cmd_</code> prefixes, which is what the code above
                shows. The general habit: <strong>when two things in one class want the same name, that is information
                    about the design</strong>, not an inconvenience to route around.</p>
        </div>
        <h3>The trust boundary, made concrete</h3>
        <pre><code>{"  # Load a pipeline file. Ordinary Ruby, so it can do anything Ruby can do:\n  # only run files you trust. Use load_data for anything else.\n  def self.load_file(path)\n    before = pipelines.keys\n    Kernel.load(File.expand_path(path))\n    pipelines.keys - before\n  end\n\n  # The safe path: pipelines as data, no code executed.\n  def self.load_data(path)\n    require \"json\"\n    data = JSON.parse(File.read(path), symbolize_names: true)\n    Array(data[:pipelines] || [data]).map { |h| from_h(h).tap { |pl| pipelines[pl.name] = pl } }\n  end\n"}</code></pre>
        <p>Two loaders, two comments, one flag. <code>automation run pipeline.rb</code> executes Ruby;
            <code>automation run --safe pipeline.json</code> does not. Both produce the same AST and run through the
            same engine, which is the payoff for having made the AST the centre of the system.</p>
        <pre className="plain"><code>{"$ automation run --safe examples/research.json\nresearch_safe: FAILED (1 steps)\n  ✗ fetch(from: \"http://127.0.0.1:9/papers.json\") Automation::HttpError: ...connection refused\n"}</code></pre>
        <p>The failure is the point: the JSON pipeline really ran, through the real steps, and failed at the network
            rather than at the parser.</p>
        <h3>Every command, working</h3>
        <pre className="plain"><code>{"$ automation list examples/research.rb\nresearch             4 steps    research.rb:5\n\n$ automation run examples/research.rb --dry-run\nresearch: ok (4 steps)\n  ✓ fetch(from: \"https://example.invalid/papers.json\", limit: 20) 0.0ms\n  ✓ filter(field: :topic, matching: \"AI\") 0.0ms\n  ✓ summarize(field: :abstract, max_words: 40) 0.0ms\n  ✓ save_to(collection: \"knowledge_base\") 0.0ms\n\n$ automation run examples/research.rb\nfetch: GET https://example.invalid/papers.json returned transport: Failed to open TCP\n       connection to example.invalid:443 (getaddrinfo: Name or service not known)\nresearch: FAILED (1 steps)\n  ✗ fetch(...) Automation::HttpError: ... after 3 attempts\n$ echo $?\n1\n"}</code></pre>
        <p>Three attempts (the <code>retry_on</code> in the file), the <code>when_failed</code> handler's warning on
            stderr, the result on stdout, exit code 1.</p>
        <h3>Releasing</h3>
        <pre className="plain"><code>{"$ bundle exec rake test           # everything green\n$ bundle exec rubocop             # clean\n$ # bump lib/automation/version.rb, write the CHANGELOG entry\n$ git commit -am \"v0.1.0\" && git tag v0.1.0\n$ bundle exec rake release        # builds, tags, pushes to RubyGems\n"}</code></pre>
        <p><code>rake release</code> comes from bundler's gem tasks and does the whole sequence, refusing if the working
            tree is dirty. Two conventions worth following: <strong>the version constant is the single source of
                truth</strong> (the gemspec reads it, so they cannot disagree), and <strong>the CHANGELOG entry is
                written before the release, not after</strong>, because "what changed" is much easier to answer while
            you remember.</p>
        <p>Semantic versioning for a DSL gem deserves a thought. Your public API is not only your Ruby methods: it is
            <em>the verbs, their options and their behaviour</em>. Renaming a step option is a breaking change even
            though no Ruby method signature changed. Being explicit about that in your README saves an argument later.
        </p>
        <div className="exercise">
          <h5>Exercise 12</h5>
          <ol>
            <li><strong>Test the CLI.</strong> Write an integration test that calls
                    <code>Automation::CLI.new.call(...)</code> with captured stdout and stderr, asserting output and
                    exit codes for: a successful dry run, a validation failure (exit 1), and a bad invocation (exit 2).
                    Use <code>capture_io</code>, which minitest provides.</li>
            <li><strong>Machine-readable output.</strong> Add <code>--format json</code> so <code>run</code> and
                    <code>explain</code> emit JSON for CI consumption. Decide what the schema is and version it.</li>
            <li><strong>A generator.</strong> Add <code>automation init</code> writing a starter pipeline file and a
                    plugin skeleton, then verify that the generated files pass <code>automation explain</code> and the
                    plugin contract test from Exercise 9.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 12 — open after trying</summary>
          <pre><code>{"class CLITest < Minitest::Test\n  def setup\n    Automation.pipelines.clear\n    @file = File.expand_path(\"../examples/research.rb\", __dir__)\n  end\n\n  def test_dry_run_succeeds_and_prints_every_step\n    out, err = capture_io do\n      assert_equal 0, Automation::CLI.new.call([\"run\", @file, \"--dry-run\"])\n    end\n\n    assert_match(/research: ok \\(4 steps\\)/, out)\n    assert_match(/✓ fetch/, out)\n    assert_empty err\n  end\n\n  def test_a_bad_invocation_is_exit_two\n    _out, err = capture_io do\n      assert_equal 2, Automation::CLI.new.call([\"frobnicate\", @file])\n    end\n\n    assert_match(/usage: automation/, err)\n  end\n\n  def test_an_unknown_pipeline_name_is_exit_one\n    _out, err = capture_io do\n      assert_equal 1, Automation::CLI.new.call([\"explain\", @file, \"nope\"])\n    end\n\n    assert_match(/no pipeline named \"nope\"/, err)\n  end\nend\n"}</code></pre>
          <p>Three things this makes possible that testing by shelling out does not: it runs in-process so coverage
                tools see it, it is fast enough to run on every save, and it fails with a real backtrace instead of
                "expected exit 0, got 1".</p>
          <p>The reason it works is the CLI design: <code>call</code> returns an integer and never calls
                <code>exit</code>. <strong>Push side effects to the edges</strong> (one <code>exit</code> at the bottom
                of the executable, one place that writes to streams) and the rest becomes ordinary testable code. That
                principle is language-independent and it is the single most valuable thing in this milestone.</p>
          <p>For part 2, the key decision is that JSON output must be <em>stable</em>: include a
                <code>"schema": 1</code> field from the first release, because the moment a CI job parses your output,
                the format is an API. Nothing is more annoying than a tool that reorders its JSON keys between patch
                versions.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does the CLI return exit codes rather than calling <code>exit</code> directly?</li>
          <li>What do the three exit codes mean, and who consumes them?</li>
          <li>Why does the gemspec read the version from a constant instead of writing it twice?</li>
          <li>What does <code>rubygems_mfa_required</code> protect against?</li>
          <li>For a DSL gem, what counts as a breaking change?</li>
          <li>What is the practical difference between <code>load_file</code> and <code>load_data</code>?</li>
        </ol>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Milestone 11 is the last strong Ruby argument in this course. Two DSLs in one system (one for describing
                pipelines, one for rewriting them), both built from <code>instance_eval</code> and both under thirty
                lines, with value objects giving fixpoint detection for free. Writing that in a static language means a
                builder API, an explicit visitor, and generated equality; Ruby lets it stay small enough that a reader
                can hold it all at once.</p>
          <p>Milestones 9, 10 and 12 are Ruby being solid rather than special. The testing helpers rely on duck typing
                being real, which is nice; the inspector is plain data transformation; the CLI and gemspec are
                conventional and pleasant. A Python or TypeScript version of these three would look similar and be about
                as good.</p>
          <p>Course-wide honesty: the total bug count I hit while writing these twelve milestones is six, and every
                one of them was a dynamic-language failure. A shadowed local eating a verb (twice), an exception chain
                that was never recorded, a prepended method whose <code>self</code> I mistook, instance variables
                vanishing inside <code>instance_eval</code>, a duck that lacked a feather I used, and a method silently
                redefined by a second definition of the same name. None would have compiled in Go. All were caught by
                tests, in seconds, and the fixes were small. <strong>That trade, more errors caught later but caught
                    cheaply, with far more expressive power in exchange, is what choosing Ruby actually means.</strong> </p>
        </div>
        <h3>Repository state after Milestone 12</h3>
        <pre className="plain"><code>{"automation/\n├── automation.gemspec        no runtime dependencies\n├── Rakefile                  rake test, rake build, rake release\n├── CHANGELOG.md              keep-a-changelog, written before release\n├── exe/automation            run | explain | graph | list\n├── examples/\n│   ├── research.rb           a Ruby pipeline (executes code)\n│   └── research.json         the same shape as data (executes none)\n├── lib/automation/\n│   ├── errors, registry, plugin, steps            the vocabulary\n│   ├── ast, define, validator, transform          the language\n│   ├── context, middleware, retry_policy, runner  the engine\n│   ├── inspector                                  explain, mermaid, diff\n│   ├── config, http, store, summarizers           the adapters\n│   └── testing                                    helpers for your users\n└── test/                     34 tests, 94 assertions\n"}</code></pre>
        <pre className="plain"><code>{"$ rake test\n34 runs, 94 assertions, 0 failures, 0 errors, 0 skips\n"}</code></pre>
        <footer className="end">
          <p>Instalment 9 of the five-course curriculum. Next, and last for Ruby: the advanced phase (refinements,
                lazy enumerators, Ractors, contract testing, performance), the final challenge with acceptance criteria
                and a withheld solution, the full knowledge check, and the README, portfolio and interview material.
                Then Course 3 begins: Perl, and the text archaeologist.</p>
        </footer>
        <Link className="button" href="/ruby-course/milestones/end/">Continue</Link>
      </div>
    </div>
  );
}
