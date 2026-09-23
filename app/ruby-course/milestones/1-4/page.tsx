import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/left_to_right/laptop.png';
import img2 from '../../../../courses/assets/expressions/right_to_left/looking_bad_top.png';
import img3 from '../../../../courses/assets/expressions/front.png';
import img4 from '../../../../courses/assets/expressions/left_to_right/thinking.png';
import img5 from '../../../../courses/assets/expressions/right_to_left/looking_bad.png';
import img6 from '../../../../courses/assets/expressions/left_to_right/glasses.png';
import img7 from '../../../../courses/assets/expressions/left_to_right/stretching.png';

export const metadata: Metadata = {
  title: "Ruby Milestones 1–4 — From Objects to an AST",
};

export default function Page() {
  return (
    <div className="theme-ruby">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 7 · Course 2 (Ruby) · Milestones 1–4</p>
          <h1>A gem, then a block, then a language, then a data structure</h1>
          <p className="lede">We build the DSL surface twice: once with an explicit builder so you can see what it costs, then with <code>instance_eval</code> so you can see what it buys. Then we throw away the idea that building should run anything.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>All code was run on Ruby 3.2.3 and every output block below is copied from that run. The final suite is 20 tests and 50 assertions, all passing. The failure demonstrations in Milestone 3 are real program output, not illustrations.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 1</span>The gem, a Step, and a Registry</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-left" src={img1.src} alt="The Mewlang cat, typing on a laptop" width="120" loading="lazy" />
          A working gem skeleton with three ideas in it: a <code>Step</code> that describes work, a <code>Registry</code> that knows how to perform it, and an error hierarchy that a user can rescue. No DSL yet.
        </p>
        <h3>Concepts</h3>
        <p>Classes and <code>attr_reader</code>, freezing for immutability, value equality with <code>==</code>/<code>eql?</code>/<code>hash</code>, duck typing with <code>respond_to?</code>, <code>Hash#fetch</code> with a block, error class hierarchies, and minitest.</p>
        <h3>Design</h3>
        <p>The central separation, which the whole course rests on: <strong>a Step says <em>what</em>, the Registry says <em>how</em>.</strong> A step named <code>:fetch</code> with options <code>{'{'}from: "arxiv"{'}'}</code> is a description. Whether that means an HTTP call, a fixture file, or a no-op in a dry run is the registry's business. Once those are separate, testing a pipeline stops requiring a network, and users can add verbs without touching your code.</p>
        <p>The second decision is that a Step is <strong>frozen on construction</strong>. Ruby lets you mutate almost anything, and a description that changes between validation and execution is a bug you cannot reproduce. Freezing is how you opt out.</p>
        <h3>Implementation</h3>
        <h4>lib/automation/errors.rb</h4>
        <pre><code>{"# frozen_string_literal: true\n\nmodule Automation\n  # Every error this gem raises inherits from Error, so a user can write\n  # `rescue Automation::Error` and catch everything we throw without\n  # catching everything in the world.\n  class Error < StandardError; end\n\n  # Raised when a pipeline references a step nobody registered.\n  class UnknownStep < Error\n    attr_reader :name, :known\n\n    def initialize(name, known, location: nil)\n      @name = name\n      @known = known\n      message = +\"unknown step #{name.inspect}\"\n      message << \" at #{location}\" if location\n      message << \"; known steps: #{known.sort.join(', ')}\" unless known.empty?\n      message << \"; no steps are registered\" if known.empty?\n      super(message)\n    end\n  end\n\n  # Raised when a step implementation fails. Keeps the original as #cause.\n  class StepFailed < Error\n    attr_reader :step\n\n    def initialize(step, cause)\n      @step = step\n      super(\"step #{step.name} failed: #{cause.message} (#{cause.class})\")\n    end\n  end\nend\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><strong>One base class, everything under it.</strong> This is not politeness, it is the only way a user can write a correct <code>rescue</code>. A library that raises bare <code>RuntimeError</code> forces its users to rescue everything or nothing.</li>
          <li><code>+"unknown step ..."</code> — the unary plus returns an unfrozen copy of a frozen string literal. Without it, the <code>{'<'}{'<'}</code> on the next line raises <code>FrozenError</code>, because of the magic comment at the top of the file. This is the frozen-literal rule from Part 2 arriving in real code. </li>
          <li><strong>The error carries data, not just a message.</strong> <code>attr_reader :name, :known</code> means a caller can react programmatically (suggest a correction, list alternatives) rather than parsing your English. Go's <code>errors.As</code> exists for exactly this; in Ruby you get it by rescuing the class.</li>
          <li><code>super(message)</code> passes the constructed message up to <code>StandardError#initialize</code>. Forgetting this gives you an exception whose message is the class name, which is a common and baffling bug.</li>
        </ul>
        <h4>lib/automation/step.rb</h4>
        <pre><code>{"module Automation\n  # Step is one instruction in a pipeline: a name, positional arguments and\n  # options. It describes work; it does not perform it.\n  class Step\n    attr_reader :name, :args, :options\n\n    def initialize(name, *args, **options)\n      @name = name.to_sym\n      @args = args.freeze\n      @options = options.freeze\n      freeze\n    end\n\n    def to_s\n      parts = args.map(&:inspect) + options.map { |k, v| \"#{k}: #{v.inspect}\" }\n      \"#{name}(#{parts.join(', ')})\"\n    end\n\n    def ==(other)\n      other.is_a?(Step) && name == other.name &&\n        args == other.args && options == other.options\n    end\n    alias eql? ==\n\n    def hash = [self.class, name, args, options].hash\n  end\nend\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><code>name.to_sym</code> normalises at the boundary, so <code>"fetch"</code> and <code>:fetch</code> are the same step forever after. Do this once, at construction, and never think about it again.</li>
          <li><code>freeze</code> as the last line of <code>initialize</code> makes the object immutable. Note that freezing is <em>shallow</em>: it stops <code>@name = ...</code>, but the Hash in <code>@options</code> needs its own <code>freeze</code>, which is why both appear.</li>
          <li><code>==</code>, <code>eql?</code> and <code>hash</code> are three different things and you need all three. <code>==</code> is general equality; <code>eql?</code> is what Hash uses for key lookup; <code>hash</code> must return the same integer for objects that are <code>eql?</code>. Defining <code>==</code> alone means <code>[a, b].uniq</code> silently keeps duplicates.</li>
          <li><code>alias eql? ==</code> is a keyword, not a method call, and takes bare method names.</li>
          <li><code>to_s</code> is written to reproduce the DSL syntax, so error messages and logs read like the user's own file. It is worth spending five minutes on, and the test below pins it.</li>
        </ul>
        <h4>lib/automation/registry.rb</h4>
        <pre><code>{"module Automation\n  # Registry maps step names to implementations. An implementation is\n  # anything that responds to #call: a lambda, a method object, or an\n  # instance of a class you wrote.\n  class Registry\n    def initialize\n      @steps = {}\n    end\n\n    def register(name, callable = nil, &block)\n      impl = callable || block\n      raise ArgumentError, \"register(#{name.inspect}) needs a callable or a block\" if impl.nil?\n      unless impl.respond_to?(:call)\n        raise ArgumentError, \"step #{name.inspect} must respond to #call, got #{impl.class}\"\n      end\n\n      @steps[name.to_sym] = impl\n      self\n    end\n\n    def fetch(name, location: nil)\n      @steps.fetch(name.to_sym) { raise UnknownStep.new(name, known, location: location) }\n    end\n\n    def registered?(name) = @steps.key?(name.to_sym)\n    def known = @steps.keys\n  end\nend\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><code>callable = nil, &block</code> accepts both <code>register(:fetch) {'{'} ... {'}'}</code> and <code>register(:fetch, MyStep.new)</code>. <code>impl = callable || block</code> takes whichever arrived, and <code>||</code> works because <code>nil</code> is falsy.</li>
          <li><strong><code>respond_to?(:call)</code> is the duck-typing check</strong>, and it is the right one. We do not require a base class or a module. A lambda, a method object (<code>method(:foo)</code>), a class instance with <code>#call</code>, and a curried proc all qualify. Ruby libraries that demand you inherit from their base class are usually a design smell.</li>
          <li><code>@steps.fetch(name) {'{'} raise ... {'}'}</code> — <code>fetch</code> with a block calls the block when the key is missing, so we raise <em>our</em> error with a useful message instead of a bare <code>KeyError</code>. This one line is most of what makes a DSL pleasant to use.</li>
          <li><code>register</code> returns <code>self</code> so calls can chain.</li>
        </ul>
        <h4>The tests</h4>
        <pre><code>{"class StepTest < Minitest::Test\n  def setup\n    @step = Automation::Step.new(\"fetch\", \"papers\", from: \"arxiv\")\n  end\n\n  def test_name_is_always_a_symbol\n    assert_equal :fetch, @step.name\n    assert_equal :fetch, Automation::Step.new(:fetch).name\n  end\n\n  def test_is_frozen_all_the_way_down\n    assert @step.frozen?\n    assert @step.options.frozen?\n    assert_raises(FrozenError) { @step.options[:from] = \"elsewhere\" }\n  end\n\n  def test_value_equality_and_hashing\n    twin = Automation::Step.new(:fetch, \"papers\", from: \"arxiv\")\n    assert_equal twin, @step\n    assert_equal 1, [@step, twin].uniq.size\n    refute_equal Automation::Step.new(:fetch, \"papers\", from: \"other\"), @step\n  end\n\n  def test_to_s_reads_like_the_dsl\n    assert_equal 'fetch(\"papers\", from: \"arxiv\")', @step.to_s\n  end\nend\n"}</code></pre>
        <pre className="plain"><code>{"$ ruby -Ilib -Itest test/test_step.rb\n4 runs, 9 assertions, 0 failures, 0 errors, 0 skips\n"}</code></pre>
        <p>Note <code>[@step, twin].uniq.size</code>: that assertion is the one that fails if you define <code>==</code> and forget <code>hash</code>. Tests that pin the <em>consequences</em> of a protocol, rather than the protocol itself, catch more.</p>
        <div className="exercise">
          <h5>Exercise 1</h5>
          <p>Make <code>Registry</code> enumerable and inspectable:</p>
          <ul>
            <li>Add <code>each</code> yielding <code>[name, implementation]</code> pairs, and <code>include Enumerable</code>. Then confirm that <code>registry.map</code>, <code>registry.count</code>, <code>registry.sort_by</code> and <code>registry.group_by</code> all work without writing them.</li>
            <li>Add <code>Registry#describe(name)</code> returning a human-readable signature of a registered step, derived from the implementation itself, so <code>describe(:fetch)</code> prints which options it requires and which it accepts.</li>
          </ul>
          <p>Hint for the second part: every callable in Ruby answers <code>parameters</code>. Try <code>-{'>'}(a, b:, c: 1) {'{'}{'}'}.parameters</code> in irb before writing any code.</p>
        </div>
        <details>
          <summary>Solution 1 — open after trying</summary>
          <pre><code>{"class Registry\n  include Enumerable\n\n  def each(&block)\n    return to_enum(:each) unless block_given?\n\n    @steps.each(&block)\n    self\n  end\n\n  def describe(name)\n    impl = fetch(name)\n    required = impl.parameters.select { |type, _| type == :keyreq }.map(&:last)\n    optional = impl.parameters.select { |type, _| type == :key }.map(&:last)\n    rest     = impl.parameters.any? { |type, _| type == :keyrest }\n\n    parts = []\n    parts << \"requires: #{required.join(', ')}\" unless required.empty?\n    parts << \"accepts: #{optional.join(', ')}\"  unless optional.empty?\n    parts << \"accepts any options\"              if rest\n    \"#{name}(#{parts.join('; ')})\"\n  end\nend\n"}</code></pre>
          <pre className="plain"><code>{"registry.register(:fetch) { |_input, what, from:, since: \"1d\"| }\nregistry.describe(:fetch)\n# => \"fetch(requires: from; accepts: since)\"\n\nregistry.count                      # => 1\nregistry.map { |name, _| name }     # => [:fetch]\nregistry.sort_by { |name, _| name } # => [[:fetch, #<Proc...>]]\n"}</code></pre>
          <p>Two things worth keeping from this.</p>
          <p><strong><code>Enumerable</code> is free power.</strong> Define <code>each</code>, include the module, and about sixty methods appear. This is Ruby's answer to interfaces: instead of implementing a big contract, you implement one method and a module implements the contract in terms of it. The Go equivalent would be writing <code>Map</code>, <code>Filter</code>, <code>GroupBy</code> and the rest yourself for every type.</p>
          <p><strong><code>parameters</code> is the reflection that Milestone 4 turns into a validator.</strong> It reports an array of <code>[kind, name]</code> pairs, where the kinds are <code>:req</code>, <code>:opt</code>, <code>:rest</code>, <code>:key</code>, <code>:keyreq</code>, <code>:keyrest</code> and <code>:block</code>. A language that can ask a function what arguments it wants can check a call before making it, which is how we will get compile-time-ish errors out of a dynamic language.</p>
        </details>
        <h4>Experiment</h4>
        <p>Remove <code>freeze</code> from <code>Step#initialize</code> and run the suite: one test fails with a clear message. Now remove only the <code>.freeze</code> on <code>@options</code> and run again: the object is frozen but its Hash is not, so <code>@step.options[:from] = "x"</code> succeeds. That is shallow freezing, and it is the reason <code>Data</code> in Milestone 4 is worth having, since it freezes what it holds.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 1</h5>
          <ul>
            <li>
              <img className="mascot-right" src={img2.src} alt="The Mewlang cat, giving an annoyed side-eye from above" width="120" loading="lazy" />
              <strong>Defining <code>==</code> without <code>hash</code> and <code>eql?</code>.</strong> Everything looks fine until <code>uniq</code>, <code>group_by</code> or a Hash key behaves strangely.
            </li>
            <li><strong>Forgetting <code>super</code> in a custom exception's <code>initialize</code>.</strong> The message silently becomes the class name.</li>
            <li><strong>Mutating a frozen string literal</strong> in a file with the magic comment. Use <code>+"..."</code> or build with interpolation.</li>
            <li><strong>Requiring a base class instead of <code>respond_to?(:call)</code>.</strong> It makes your gem hostile to lambdas and to anyone else's objects.</li>
            <li><strong>Using <code>[]</code> where you need <code>fetch</code>.</strong> A <code>nil</code> implementation produces <code>NoMethodError: undefined method 'call' for nil</code> three frames away from the cause.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does <code>Step</code> freeze both itself and its options Hash?</li>
          <li>What breaks if you define <code>==</code> but not <code>hash</code>?</li>
          <li>Why does <code>Registry#register</code> check <code>respond_to?(:call)</code> rather than the class? </li>
          <li>What does <code>Hash#fetch</code> with a block do that <code>Hash#[]</code> does not?</li>
          <li>Why must every error in a gem inherit from one base class?</li>
        </ol>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>
            <img className="mascot-center" src={img3.src} alt="The Mewlang cat, facing forward" width="120" loading="lazy" />
            Nothing in Milestone 1 needs Ruby specifically. <code>Registry#register</code> accepting "anything that responds to <code>#call</code>" is duck typing, and it is genuinely convenient: a lambda, a <code>Method</code> object and a plain object all work with zero adapter code. But the same design is one interface declaration away in Go, and a Python <code>Protocol</code> gets you the same check with static tooling behind it. What this milestone actually shows off is smaller and more concrete: <code>Data.define</code>-adjacent value semantics done by hand (<code>==</code>, <code>eql?</code>, <code>hash</code>, <code>freeze</code>) are four separate decisions in Ruby that a case class or a Go struct with a generated comparator would bundle for you automatically.
          </p>
          <p>The honest cost showed up immediately: forgetting <code>hash</code> while defining <code>==</code> breaks <code>uniq</code> and Hash lookups with no warning at write time, only at use time, and only if a test happens to exercise it. Milestone 4's <code>Data.define</code> makes this whole category of mistake impossible by generating all three together — which is itself an admission that hand-rolled value equality in Ruby is a trap worth avoiding once a better tool exists.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 2</span>Blocks: the DSL with its receiver showing</h2>
        <h3>Goal</h3>
        <p><code>Automation.pipeline("research") do |p| ... end</code> builds a runnable pipeline. The builder is an explicit block parameter, which is deliberately one step short of the DSL we want, because the difference between this and Milestone 3 is the entire lesson.</p>
        <h3>Concepts</h3>
        <p><code>yield</code> and block parameters, <code>reduce</code> as an interpreter, exception wrapping with automatic <code>cause</code>, and the difference between a build-time and a run-time error.</p>
        <h3>Design</h3>
        <p>
          <img className="mascot-left" src={img4.src} alt="The Mewlang cat, thinking with a paw to its chin" width="120" loading="lazy" />
          Three objects, each with one job:
        </p>
        <pre className="plain"><code>{"  Automation.pipeline(name) { |p| ... }\n        │\n        ├─ creates a Builder, hands it to the block\n        │\n        ├─ Builder#step collects Step descriptions\n        │\n        └─ Builder#to_pipeline produces a frozen Pipeline\n\n  Pipeline#run  →  reduce over the steps, looking each one up\n"}</code></pre>
        <p>The interpreter is one line, and it is worth seeing before it gets dressed up: a pipeline is a fold. Each step takes the previous step's output and returns the next input. That single decision (values flow through, nothing is shared) is what makes steps composable and testable, and it is the same reasoning that made Go's <code>Action</code> a pointer-free value.</p>
        <h3>Implementation</h3>
        <pre><code>{"module Automation\n  class Pipeline\n    attr_reader :name, :steps\n\n    def initialize(name, steps, registry: Automation.registry)\n      @name = name.to_sym\n      @steps = steps.freeze\n      @registry = registry\n      freeze\n    end\n\n    def run(input = nil)\n      @steps.reduce(input) { |acc, step| perform(step, acc) }\n    end\n\n    private\n\n    def perform(step, input)\n      impl = @registry.fetch(step.name)\n      impl.call(input, *step.args, **step.options)\n    rescue StandardError => e\n      raise e if e.is_a?(Error)\n      raise StepFailed.new(step, e)\n    end\n  end\n\n  class Builder\n    def initialize(name)\n      @name = name\n      @steps = []\n    end\n\n    def step(name, *args, **options)\n      @steps << Step.new(name, *args, **options)\n      self\n    end\n\n    def to_pipeline(registry:) = Pipeline.new(@name, @steps, registry: registry)\n  end\n\n  def self.pipeline(name, registry: self.registry)\n    builder = Builder.new(name)\n    yield builder\n    builder.to_pipeline(registry: registry)\n  end\nend\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><code>yield builder</code> calls the block with the builder as its parameter. The block's return value is discarded: what matters is the mutations it made to the builder. That is the builder pattern, and it is the only DSL technique in this milestone.</li>
          <li><code>impl.call(input, *step.args, **step.options)</code> — the splat and double splat <em>expand</em> here, the mirror image of how they collected in <code>Step#initialize</code>. So a step registered as <code>{'{'} |input, what, from:| {'}'}</code> receives the accumulated value, then the positional arguments, then the keywords.</li>
          <li><code>rescue StandardError ={'>'} e</code> inside a method with no <code>begin</code>: a method body is an implicit <code>begin</code> block.</li>
          <li><code>raise e if e.is_a?(Error)</code> lets our own errors pass through unwrapped. Without it, <code>UnknownStep</code> would be re-wrapped as <code>StepFailed</code> and the user would see a confusing double message. Deciding what <em>not</em> to wrap is half of good error handling.</li>
          <li><code>raise StepFailed.new(step, e)</code> inside a <code>rescue</code> sets <code>e.cause</code> automatically to the original exception. Ruby maintains that chain for you; there is no <code>%w</code> to remember.</li>
        </ul>
        <h3>Running it</h3>
        <pre><code>{"Automation.register(:fetch) do |_input, source, from:|\n  puts \"  fetching #{source} from #{from}\"\n  [\"Attention Is All You Need (AI)\", \"Cats sleep a lot (biology)\", \"Scaling laws (AI)\"]\nend\n\nAutomation.register(:filter)    { |items, topic:| items.select { |i| i.include?(topic) } }\nAutomation.register(:summarize) { |items, max_words:| items.map { |i| i.split.first(max_words).join(\" \") + \"...\" } }\n\nresearch = Automation.pipeline(\"research\") do |p|\n  p.step :fetch, \"papers\", from: \"arxiv\"\n  p.step :filter, topic: \"AI\"\n  p.step :summarize, max_words: 3\nend\n\nputs research\np research.steps.map(&:to_s)\np research.run\n"}</code></pre>
        <pre className="plain"><code>{"research (3 steps)\n[\"fetch(\\\"papers\\\", from: \\\"arxiv\\\")\", \"filter(topic: \\\"AI\\\")\", \"summarize(max_words: 3)\"]\n  fetching papers from arxiv\n[\"Attention Is All...\", \"Scaling laws (AI)...\"]\n"}</code></pre>
        <p>Two failure paths, also real output:</p>
        <pre className="plain"><code>{"--- an unregistered step fails at run time, not build time ---\nbuilt fine: broken (1 steps)\nrun failed: unknown step :summarise; known steps: fetch, filter, summarize\n\n--- a failing step is wrapped, with the cause preserved ---\nAutomation::StepFailed: step explode failed: divided by 0 (ZeroDivisionError)\ncause: ZeroDivisionError\n"}</code></pre>
        <p>Read the first one carefully, because it is the flaw that drives Milestone 4. <strong>A pipeline containing a typo builds successfully and fails only when that step executes.</strong> If <code>:summarise</code> were the fourth step of an hour-long job, you would find out in an hour. Go would have caught this at compile time. We will catch it with a validator, which is Ruby's equivalent: not free, but available.</p>
        <div className="cmp">
          <h5>Ordinary configuration vs an executable builder</h5>
          <pre className="plain"><code>{"YAML                              Ruby builder\n────                              ────────────\nsteps:                            Automation.pipeline(\"research\") do |p|\n  - name: fetch                     p.step :fetch, \"papers\", from: \"arxiv\"\n    from: arxiv                     p.step :filter, topic: \"AI\"\n  - name: filter                  end\n    topic: AI\n\nstatic, safe to parse            executable, arbitrary code\nneeds a schema to validate       can validate with reflection\nno loops, no variables           3.times { |i| p.step :fetch, page: i }\nno editor support for values     completion, refactoring, debugger\nerrors: \"line 7: bad key\"        errors: a Ruby backtrace"}</code></pre>
          <p>The builder already wins on power and loses on safety. Neither difference has anything to do with how it looks; those come next.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 2</h5>
          <p>Give <code>Pipeline</code> composition. Implement <code>Pipeline#|</code> (the pipe operator) so that <code>fetching | processing</code> returns a new pipeline whose steps are the concatenation of both, with a name derived from the two. Then implement <code>Pipeline#+</code> as an alias, and <code>Pipeline#repeat(n)</code> returning a pipeline whose steps are repeated <em>n</em> times.</p>
          <p>Constraints: the originals must not change; both pipelines must use the same registry or you should raise a clear error; and <code>(a | b) | c</code> must equal <code>a | (b | c)</code> in steps. Write tests for all three.</p>
        </div>
        <details>
          <summary>Solution 2 — open after trying</summary>
          <pre><code>{"class Pipeline\n  def |(other)\n    unless other.is_a?(Pipeline)\n      raise ArgumentError, \"cannot compose a Pipeline with #{other.class}\"\n    end\n    if registry_of(other) != @registry\n      raise Error, \"cannot compose pipelines using different registries\"\n    end\n\n    Pipeline.new(:\"#{name}_#{other.name}\", steps + other.steps, registry: @registry)\n  end\n  alias + |\n\n  def repeat(times)\n    raise ArgumentError, \"times must be positive\" unless times.positive?\n\n    Pipeline.new(:\"#{name}_x#{times}\", steps * times, registry: @registry)\n  end\n\n  protected\n\n  # protected, not private: readable by other Pipelines, not by outsiders.\n  def registry_of(other) = other.instance_variable_get(:@registry)\nend\n"}</code></pre>
          <pre className="plain"><code>{"combined = fetching | processing\ncombined.steps.map(&:name)   # => [:fetch, :filter, :summarize]\nfetching.steps.map(&:name)   # => [:fetch]   (unchanged)\n"}</code></pre>
          <p>Three Ruby-specific points hide in those fifteen lines.</p>
          <p><strong>Operators are methods.</strong> <code>def |(other)</code> defines what <code>a | b</code> means. The list of overloadable operators is long (<code>+ - * / % ** == {'<'}={'>'} [] []= {'<'}{'<'} & | ^ ! =~</code>), and the discipline is to define one only when the meaning is obvious to a reader who has not seen your code. "Pipe two pipelines together" qualifies; almost nothing else in this project would.</p>
          <p><strong><code>alias + |</code></strong> makes both spellings the same method. Aliases are resolved at definition time, so redefining <code>|</code> later does not change <code>+</code>, which surprises people.</p>
          <p><strong><code>protected</code> is the rarely-used third visibility.</strong> A <code>protected</code> method can be called with an explicit receiver, but only from inside the same class. That is exactly what comparing two pipelines needs, and it is the one situation where <code>protected</code> is the right answer rather than a confusion. (Using <code>instance_variable_get</code> at all is a little impolite; a cleaner design exposes <code>attr_reader :registry</code> and accepts that users can see it.)</p>
          <p><code>steps * times</code> works because <code>Array#*</code> with an integer repeats the array, which is a nice example of Ruby's core library being unusually generous.</p>
        </details>
        <h4>Experiment</h4>
        <p>Register a step that returns <code>nil</code> and put it in the middle of a pipeline. Then watch the next step receive <code>nil</code> and fail with something unhelpful like <code>undefined method 'select' for nil</code>. The fold is unforgiving: every step must return something the next one can use. This is the argument for the <code>Context</code> object that Milestone 5 introduces, where the value flowing through is a structured thing with a payload and metadata rather than a bare return value.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 2</h5>
          <ul>
            <li><strong>Forgetting the block parameter:</strong> <code>Automation.pipeline("x") {'{'} step :fetch {'}'}</code> raises <code>NoMethodError</code> because <code>step</code> is not defined on the top-level object. That error is exactly what Milestone 3 removes.</li>
            <li><strong><code>reduce</code> without returning the accumulator.</strong> A step whose last expression is <code>puts</code> returns <code>nil</code> and poisons the rest of the fold.</li>
            <li><strong>Rescuing <code>StandardError</code> and swallowing your own errors,</strong> producing double-wrapped messages.</li>
            <li><strong>Calling <code>impl.call(input, step.options)</code></strong> without the double splat, which passes the Hash as a positional argument. Since Ruby 3.0 these are strictly different and the error message (<code>wrong number of arguments</code>) does not say why.</li>
            <li><strong>Freezing the pipeline but not the steps array,</strong> so a caller can append to it afterwards.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>What does <code>yield builder</code> do, and what happens to the block's return value?</li>
          <li>Explain <code>impl.call(input, *step.args, **step.options)</code> in terms of how <code>Step</code> collected them.</li>
          <li>Why does <code>perform</code> re-raise errors that are already <code>Automation::Error</code>?</li>
          <li>Where does <code>e.cause</code> come from, and what is the Go equivalent?</li>
          <li>Why is a typo in a step name not caught until run time?</li>
        </ol>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p><code>yield builder</code> is the whole trick in this milestone, and it is smaller than it looks: a block that receives an object and calls methods on it is one line of Ruby, and the same builder pattern exists in Go (a function taking a <code>*Builder</code>), in Java (a fluent builder class) and everywhere else. Nothing here required a dynamic language yet — Milestone 3 is where that changes.</p>
          <p>What this milestone is honest about instead is the price of choosing "return a result" over "raise an exception". A <code>Pipeline#run</code> that returns bare values, with no result wrapper, makes a failed step indistinguishable from a step that legitimately returned <code>nil</code>. We pay for that simplicity later, in Milestone 5, with a whole <code>RunResult</code> type built specifically to stop conflating the two. A language feature this milestone leans on without remarking on it: <code>rescue StandardError ={'>'} e</code> inside a bare method body works because a method definition is an implicit <code>begin</code> block — convenient here, and one more thing a reader coming from a language with explicit <code>try</code> blocks has to learn once and then never think about again.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 3</span>instance_eval: what it buys, and what it costs </h2>
        <h3>Goal</h3>
        <p>Remove the receiver, so the block reads as a language:</p>
        <pre className="plain"><code>{"Automation.define_pipeline(\"research\") do\n  fetch \"papers\", from: \"arxiv\"\n  filter topic: \"AI\"\n  summarize max_words: 3\nend"}</code></pre>
        <p>Then find the three ways this breaks, watch each one break for real, and fix them.</p>
        <h3>Concepts</h3>
        <p><code>instance_eval</code>, <code>self</code> and the implicit receiver, <code>method_missing</code> with <code>respond_to_missing?</code>, <code>BasicObject</code>, and delegating to the caller via <code>block.binding.receiver</code>.</p>
        <h3>Design</h3>
        <p>The mechanism is one line: <code>builder.instance_eval(&block)</code> runs the block with <code>self</code> set to the builder, so <code>fetch "papers"</code> is a message to the builder. The builder has no <code>fetch</code> method, so <code>method_missing</code> catches it and records a step.</p>
        <p>That is the whole of the good news. The bad news has three parts, and every Ruby DSL author meets all three: </p>
        <ol>
          <li><strong>Your caller's methods vanish.</strong> <code>self</code> is now the builder, so a helper method on the object where the block was written is no longer reachable.</li>
          <li><strong>Object's own methods shadow your verbs.</strong> A builder is an Object, so it already responds to <code>format</code>, <code>print</code>, <code>select</code>, <code>method</code>, <code>hash</code>, <code>display</code>, <code>test</code> and about fifty others. <code>method_missing</code> never fires for those, so a step with a colliding name silently does something else.</li>
          <li><strong>Typos become steps.</strong> If <code>method_missing</code> accepts everything, a misspelling is recorded as a perfectly valid step that fails much later.</li>
        </ol>
        <p>Let us watch all three happen.</p>
        <h3>The naive version, and its failures</h3>
        <pre><code>{"class NaiveDSL\n  def initialize(name)\n    @name = name\n    @steps = []\n  end\n\n  def method_missing(verb, *args, **options, &_block)\n    @steps << Step.new(verb, *args, **options)\n    self\n  end\n\n  def respond_to_missing?(_verb, _include_private = false) = true\n\n  def steps = @steps\nend\n"}</code></pre>
        <h4>Failure 1: the caller's helper is captured as a step</h4>
        <pre><code>{"class Report\n  def initialize(topic) = @topic = topic\n  def default_topic = @topic          # a helper on the OUTER object\n\n  def naive\n    dsl = Automation::NaiveDSL.new(\"r\")\n    dsl.instance_eval do\n      filter topic: default_topic     # self is the builder now\n    end\n    dsl.steps\n  end\nend\n\np Report.new(\"AI\").naive.map(&:to_s)\n"}</code></pre>
        <pre className="plain"><code>{"[\"default_topic()\", \"filter(topic: #<Automation::NaiveDSL:0x00007f754b7183c0 @name=\\\"r\\\",\n @steps=[#<Automation::Step:0x00007f754b718118 @name=:default_topic, ...>]>)\"]\n"}</code></pre>
        <p>Look at what happened. <code>default_topic</code> was not a <code>NoMethodError</code>; it was captured by <code>method_missing</code> and became a <em>step</em> called <code>default_topic</code>. Then, because <code>method_missing</code> returns <code>self</code>, its return value was the builder, which got passed as the <code>topic:</code> option of the next step. The user asked for one step and got two, one of which contains a builder as data.</p>
        <p>
          <img className="mascot-right" src={img5.src} alt="The Mewlang cat, giving an unimpressed side-eye" width="120" loading="lazy" />
          <strong>This is the worst kind of bug</strong>: no exception, no warning, a plausible-looking result, and a failure that surfaces somewhere else entirely. It is the price of <code>method_missing</code> accepting everything.
        </p>
        <h4>Failure 2: a step name that collides with an Object method</h4>
        <pre><code>{"Automation.register(:format) { |items| items.map(&:upcase) }\n\nnaive = Automation::NaiveDSL.new(\"collide\")\nnaive.instance_eval { format \"%s\", \"x\" }    # Kernel#format wins, silently\np naive.steps.map(&:to_s)\n"}</code></pre>
        <pre className="plain"><code>{"[]\n"}</code></pre>
        <p>No step at all. <code>Kernel#format</code> exists on every object, so the method was found and <code>method_missing</code> never ran. The user's <code>format</code> step vanished without a trace. Every name on <code>Object</code> is a landmine: <code>p</code>, <code>print</code>, <code>puts</code>, <code>select</code>, <code>test</code>, <code>method</code>, <code>display</code>, <code>hash</code>, <code>send</code>, <code>class</code>, <code>freeze</code>, <code>trust</code>, <code>then</code>, <code>tap</code>.</p>
        <h3>The version we keep</h3>
        <pre><code>{"  # DSLBuilder is the version we keep. Two changes from NaiveDSL:\n  #\n  #   1. It inherits from BasicObject, which has almost no methods, so a\n  #      step named `format` or `print` is not silently swallowed by\n  #      Object's own methods.\n  #   2. It remembers the object the block was written in, and forwards\n  #      anything that is not a registered step back to it, so helper\n  #      methods from the caller still work inside the block.\n  class DSLBuilder < BasicObject\n    def initialize(name, outer, registry)\n      @name = name\n      @outer = outer\n      @registry = registry\n      @steps = []\n    end\n\n    def method_missing(verb, *args, **options, &block)\n      if !@registry.registered?(verb) && @outer.respond_to?(verb, true)\n        return @outer.__send__(verb, *args, **options, &block)\n      end\n\n      @steps << ::Automation::Step.new(verb, *args, **options)\n      self\n    end\n\n    def respond_to_missing?(verb, include_private = false)\n      @registry.registered?(verb) || @outer.respond_to?(verb, include_private)\n    end\n\n    # Deliberately ugly names: anything readable might collide with a step.\n    def __steps__ = @steps\n  end\n\n  def self.define_pipeline(name, registry: self.registry, &block)\n    raise ArgumentError, \"define_pipeline needs a block\" unless block\n\n    outer = block.binding.receiver\n    builder = DSLBuilder.new(name, outer, registry)\n    builder.instance_eval(&block)\n    Pipeline.new(name, builder.__steps__, registry: registry)\n  end\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><strong><code>{'<'} BasicObject</code></strong> is the fix for collisions. <code>BasicObject</code> has about eight methods (<code>__send__</code>, <code>__id__</code>, <code>equal?</code>, <code>instance_eval</code>, <code>instance_exec</code>, <code>method_missing</code> and a couple more), so nearly every name falls through to <code>method_missing</code>. The cost: no <code>puts</code>, no <code>raise</code>, no constant lookup, which is why the code says <code>::Automation::Step</code> with a leading <code>::</code> and <code>::Kernel.caller_locations</code> later. Those leading colons are not style; without them the constant is not found.</li>
          <li><strong><code>block.binding.receiver</code></strong> is the fix for vanished helpers. Every block carries a <code>Binding</code>: the environment where it was written, including <code>self</code>. <code>receiver</code> gives us that original <code>self</code>, so we can forward anything we do not recognise back to it. This is how a block written inside a <code>Report</code> can still call the report's methods.</li>
          <li><strong>The order of the check matters.</strong> <code>!@registry.registered?(verb) && @outer.respond_to?(verb, true)</code> means a registered step always wins, and only unrecognised names are forwarded. Reverse it and a user whose class happens to define <code>filter</code> would find their DSL silently broken.</li>
          <li><code>respond_to?(verb, true)</code> — the second argument includes private methods. Helper methods in a class are often private, and top-level <code>def</code>s are private methods on <code>Object</code>, so without the <code>true</code> the forwarding misses most of what people actually write.</li>
          <li><code>__send__</code> rather than <code>send</code>, and <code>__steps__</code> rather than <code>steps</code>: in a <code>BasicObject</code>-derived DSL every ordinary name is a name your users might want as a verb. The double underscores are the convention for "this is plumbing, please do not name a step this".</li>
        </ul>
        <h3>Both fixes, working</h3>
        <pre className="plain"><code>{"--- 1. bare verbs, no receiver ---\n[\"fetch(\\\"papers\\\", from: \\\"arxiv\\\")\", \"filter(topic: \\\"arxiv\\\")\", \"summarize(max_words: 2)\"]\n[\"papers from\"]\n\n--- 2. local variables still work (the block is a closure) ---\n[\"fetch(\\\"papers\\\", from: \\\"arxiv:cs.AI\\\")\", \"summarize(max_words: 2)\"]\n\n--- 3. the caller's own methods: broken, then fixed by delegation ---\n[\"default_topic()\", \"filter(topic: #<Automation::NaiveDSL...>)\"]      # naive\n[\"filter(topic: \\\"AI\\\")\"]                                              # delegating\n\n--- 4. a step whose name collides with an Object method ---\n[]                                                                    # naive\n[\"format()\"]                                                          # BasicObject\n"}</code></pre>
        <p>Section 2 of that output is worth a moment: <code>instance_eval</code> changes <code>self</code>, but the block is still a <strong>closure</strong>, so local variables from the enclosing scope (<code>source</code>, <code>limit</code>) remain visible. Methods and locals behave differently, and knowing which is which is most of understanding Ruby scope.</p>
        <p>And because the block is ordinary Ruby, control flow comes free:</p>
        <pre><code>{"pipeline = Automation.define(\"x\") do\n  puts \"  (puts works inside the block: forwarded to the outer self)\"\n  3.times { |i| summarize index: i }\nend\n\np pipeline.step_names\np pipeline.steps.map { |s| s.options[:index] }\n"}</code></pre>
        <pre className="plain"><code>{"  (puts works inside the block: forwarded to the outer self)\n[:summarize, :summarize, :summarize]\n[0, 1, 2]\n"}</code></pre>
        <p>Three steps generated by a loop. <strong>That is the whole argument for an executable DSL over a data format</strong>, in four lines: no <code>for_each:</code> key to invent, no template language, no escaping rules. Your users already know how to write a loop.</p>
        <div className="cmp">
          <h5>The three ways to write a Ruby DSL</h5>
          <table className="grid">
            <tbody>
              <tr>
                <th></th>
                <th>Explicit builder<br /><code>do |p| p.step ... end</code></th>
                <th><code>instance_eval</code><br /><code>do fetch ... end</code></th>
                <th>Hybrid<br /><code>do |p| ... end</code> with both</th>
              </tr>
              <tr>
                <td>Reads like a language</td>
                <td>No</td>
                <td>Yes</td>
                <td>Partly</td>
              </tr>
              <tr>
                <td>Caller's methods work</td>
                <td>Yes, always</td>
                <td>Only with delegation</td>
                <td>Yes</td>
              </tr>
              <tr>
                <td>Name collisions</td>
                <td>Impossible</td>
                <td>Real; needs BasicObject</td>
                <td>Impossible</td>
              </tr>
              <tr>
                <td>Typos</td>
                <td><code>NoMethodError</code> on the builder</td>
                <td>Become steps unless checked</td>
                <td>NoMethodError</td>
              </tr>
              <tr>
                <td>Editor support</td>
                <td>Some</td>
                <td>None</td>
                <td>Some</td>
              </tr>
              <tr>
                <td>Used by</td>
                <td>Many libraries</td>
                <td>RSpec, Rake, Sinatra, Gemfile</td>
                <td>Rails routing, some gems</td>
              </tr>
            </tbody>
          </table>
          <p>The hybrid deserves a mention: <code>instance_exec(builder, &block)</code> sets <code>self</code> <em>and</em> passes the builder, so users who want the explicit form can have it and everyone else can omit it. If your DSL is for a library other people extend, this is often the kindest choice. We take the pure <code>instance_eval</code> route because the course is about seeing the technique clearly.</p>
        </div>
        <div className="warn">
          <h5>Is <code>block.binding.receiver</code> too clever?</h5>
          <p>A fair objection. It reaches into the caller's environment without being asked, which is exactly the sort of thing that makes Ruby codebases hard to reason about. The conservative alternative is to require the caller to hand you the context: <code>Automation.define("x", context: self) do ... end</code>. It is uglier and it is honest.</p>
          <p>My judgement is that the binding trick earns its keep here because the alternative is the failure in Section 3, which is silent and severe. But notice what it is doing: your DSL now behaves differently depending on where the block was written, which is genuinely harder to explain than "steps are methods on a builder". Every metaprogramming decision in this course has this shape, and the discipline is to ask "what would I have to explain to a new maintainer?" before reaching for the clever thing.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 3</h5>
          <p>Add nesting. Support a <code>group</code> verb that takes a name and a block, so a pipeline can be organised:</p>
          <pre className="plain"><code>{"Automation.define_pipeline(\"research\") do\n  fetch \"papers\", from: \"arxiv\"\n\n  group \"cleaning\" do\n    deduplicate\n    normalize case: :lower\n  end\n\n  summarize max_words: 200\nend"}</code></pre>
          <p>Requirements: groups may nest to any depth; <code>pipeline.steps</code> should still be able to produce a flat list for execution; the group name must be recorded so error messages can say <code>research/cleaning/normalize</code>; and delegation to the caller must still work inside a nested block. Write a test with two levels of nesting.</p>
          <p>Hint: what object should the inner block be evaluated against, and how does it get the same <code>outer</code>?</p>
        </div>
        <details>
          <summary>Solution 3 — open after trying</summary>
          <pre><code>{"class DSLBuilder < BasicObject\n  def initialize(name, outer, registry, path = [])\n    @name = name\n    @outer = outer\n    @registry = registry\n    @path = path\n    @steps = []\n  end\n\n  def group(group_name, &block)\n    # A nested builder: same outer, same registry, deeper path.\n    nested = DSLBuilder.new(group_name, @outer, @registry, @path + [group_name.to_s])\n    nested.instance_eval(&block)\n    @steps.concat(nested.__steps__)\n    self\n  end\n\n  def method_missing(verb, *args, **options, &block)\n    if !@registry.registered?(verb) && @outer.respond_to?(verb, true)\n      return @outer.__send__(verb, *args, **options, &block)\n    end\n\n    @steps << ::Automation::Step.new(\n      verb, *args, **options.merge(__path__: (@path + [verb.to_s]).join(\"/\"))\n    )\n    self\n  end\nend\n"}</code></pre>
          <p>The essential move is that <code>group</code> creates <em>another builder of the same class</em> and evaluates the inner block against it, then merges the results. Nesting an interpreter is almost always "make another one of yourself with different context", and you will do the identical thing in Racket in Course 5 and in the Perl parser in Course 3.</p>
          <p>Two design choices worth arguing about.</p>
          <p><strong>Flattening in <code>group</code> versus keeping a tree.</strong> This solution flattens immediately, which keeps <code>run</code> unchanged and loses structure. Keeping a tree (a <code>GroupNode</code> whose children are steps or groups) preserves the shape for visualisation and lets you later say "retry this whole group", at the cost of a runner that must walk recursively. Milestone 4's AST is the right place to make that choice, and for a real tool I would keep the tree.</p>
          <p><strong>Smuggling <code>__path__</code> into the options Hash</strong> is a hack: it pollutes the data the step receives, and a step with <code>**opts</code> will see it. The clean version puts the path on the node itself, which is what the AST does in the next milestone. Recognising that a piece of metadata does not belong in the payload is the thought that produces Milestone 4.</p>
        </details>
        <h4>Experiment</h4>
        <p>Make <code>DSLBuilder</code> inherit from <code>Object</code> instead of <code>BasicObject</code> and register a step called <code>:p</code> or <code>:test</code>. Then try to use it. Then change it back and note the <code>::</code> prefixes you suddenly need. Finally, run <code>BasicObject.instance_methods.sort</code> and <code>Object.instance_methods.size</code> in irb and compare: 8 methods against 58 or so. That difference is the entire cost and benefit.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 3</h5>
          <ul>
            <li><strong><code>method_missing</code> without <code>respond_to_missing?</code>.</strong> Your object lies about itself, and any library that checks <code>respond_to?</code> before calling will skip you.</li>
            <li><strong><code>method_missing</code> that never calls <code>super</code></strong> in a context where typos matter. In a DSL builder, accepting everything is a deliberate choice that must be paired with validation (Milestone 4), not an accident.</li>
            <li><strong>Forgetting <code>::</code> on constants inside a <code>BasicObject</code>.</strong> The error, <code>uninitialized constant Automation::DSLBuilder::Step</code>, is a confusing way of saying "constant lookup does not work the way you assumed".</li>
            <li><strong>Assuming <code>instance_eval</code> hides local variables.</strong> It does not; blocks are closures. Only <code>self</code> changes.</li>
            <li><strong>Using <code>instance_eval</code> where a plain block parameter would do.</strong> If your DSL has three verbs and is used once per project, the explicit builder is better code. Reach for the trick when the file will be read a hundred times.</li>
            <li><strong>Naming plumbing methods readably.</strong> <code>steps</code>, <code>name</code> and <code>run</code> on a DSL builder are names your users will want for their own verbs.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>What exactly does <code>instance_eval</code> change, and what does it leave alone?</li>
          <li>Why did <code>default_topic</code> become a step in the naive version, and why is that worse than an exception?</li>
          <li>Why did the <code>format</code> step disappear entirely, and what fixes it?</li>
          <li>What is a <code>Binding</code>, and what does <code>block.binding.receiver</code> give you?</li>
          <li>Why does the registry check come first in <code>method_missing</code>?</li>
          <li>Give one situation where the explicit builder is the better design.</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 4</span>Stop executing. Build a data structure.</h2>
        <h3>Goal</h3>
        <p>The DSL produces an immutable AST that records where every step was written. A validator checks the whole pipeline against the registry <em>before</em> anything runs, reporting problems with file and line. A pipeline can be converted to plain data and back, which gives us a safe mode for untrusted input.</p>
        <h3>Concepts</h3>
        <p><code>Data.define</code> for AST nodes, <code>caller_locations</code> for source tracking, reflection on <code>parameters</code> to check arguments, immutable transformation, and serialisation as a security boundary.</p>
        <h3>Design</h3>
        <p>Milestone 2's <code>Pipeline</code> mixes three responsibilities: it describes the steps, it holds the registry, and it runs. Separating them gives us four things we cannot otherwise have:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Capability</th>
              <th>Needs</th>
            </tr>
            <tr>
              <td>Dry run: show what would happen</td>
              <td>A description that can be walked without executing</td>
            </tr>
            <tr>
              <td>Validation with file:line</td>
              <td>Source locations captured at build time</td>
            </tr>
            <tr>
              <td>Self-modification (Milestone 11)</td>
              <td>A value you can transform into a new value</td>
            </tr>
            <tr>
              <td>A safe mode for untrusted pipelines</td>
              <td>A representation that is pure data, with no code in it</td>
            </tr>
          </tbody>
        </table>
        <p>So the AST becomes the centre of the system, and everything else is a function over it:</p>
        <pre className="plain"><code>{"   block ──► ASTBuilder ──► PipelineNode ──┬──► Validator  ──► problems\n                            (frozen Data)  ├──► Runner     ──► results\n                                           ├──► to_h       ──► plain data\n                                           └──► transforms ──► a NEW PipelineNode\n   data  ──► from_h ────────►┘  (no code executed, ever)\n"}</code></pre>
        <h3>Implementation</h3>
        <h4>lib/automation/ast.rb</h4>
        <pre><code>{"module Automation\n  # The AST. Every node is a Data object: immutable, value-compared, and\n  # carrying the source location it came from so errors can point at the\n  # user's file rather than at ours.\n  module AST\n    StepNode = Data.define(:name, :args, :options, :location) do\n      def to_s\n        parts = args.map(&:inspect) + options.map { |k, v| \"#{k}: #{v.inspect}\" }\n        \"#{name}(#{parts.join(', ')})\"\n      end\n\n      def to_h = { name: name, args: args, options: options, location: location }\n    end\n\n    HandlerNode = Data.define(:kind, :callable, :location)\n\n    PipelineNode = Data.define(:name, :steps, :handlers, :location) do\n      def step_names = steps.map(&:name)\n      def find(name) = steps.find { |s| s.name == name.to_sym }\n      def handler(kind) = handlers.find { |h| h.kind == kind }\n\n      def to_h\n        { name: name, location: location,\n          steps: steps.map(&:to_h), handlers: handlers.map(&:kind) }\n      end\n\n      # Returns a NEW pipeline: transformations never mutate.\n      def with_steps(new_steps) = with(steps: new_steps.freeze)\n\n      def insert_before(name, node)\n        index = steps.index { |s| s.name == name.to_sym }\n        raise Error, \"no step named #{name.inspect} in #{self.name}\" if index.nil?\n\n        with_steps(steps.dup.insert(index, node))\n      end\n    end\n  end\nend\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><code>Data.define(:name, :args, :options, :location)</code> creates a class with readers, keyword construction, value equality, <code>hash</code>, a readable <code>inspect</code> and frozen instances. Compare with the hand-written <code>Step</code> in Milestone 1: same guarantees, a quarter of the code, and no chance of forgetting <code>hash</code>.</li>
          <li><strong>The block passed to <code>Data.define</code> is a class body.</strong> Methods defined in it become instance methods of the new class. This is the same "class bodies are executable code" idea from Part 2, used as an API.</li>
          <li><code>with(steps: ...)</code> comes free with <code>Data</code>: it produces a copy with some fields changed. Every transformation in this project is built from it, and none of them mutate.</li>
          <li><code>insert_before</code> returns a new pipeline. The original is still valid, still frozen, still safe to hold. That matters when Milestone 11 lets pipelines rewrite themselves mid-run: a transformation that goes wrong damages nothing.</li>
        </ul>
        <h4>Capturing source locations</h4>
        <pre><code>{"    def method_missing(verb, *args, **options, &block)\n      if !@registry.registered?(verb) && @outer.respond_to?(verb, true)\n        return @outer.__send__(verb, *args, **options, &block)\n      end\n\n      @steps << ::Automation::AST::StepNode.new(\n        name: verb, args: args.freeze, options: options.freeze, location: __where__\n      )\n      self\n    end\n\n    private\n\n    # Two frames up: method_missing -> the user's line.\n    def __where__\n      frame = ::Kernel.caller_locations(2, 1).first\n      \"#{::File.basename(frame.path)}:#{frame.lineno}\"\n    end\n"}</code></pre>
        <p><code>caller_locations(start, length)</code> returns frames from the call stack as objects with <code>path</code>, <code>lineno</code> and <code>label</code>. Counting the frames is fiddly and worth doing by experiment: frame 1 is <code>method_missing</code> itself, frame 2 is the line in the user's block that triggered it. Get it wrong and every step reports the same location inside your own library, which looks plausible and is useless.</p>
        <p><strong>This is the single highest-value feature in the milestone.</strong> A DSL that can say <code>demo4.rb:29: unknown step :summarise</code> feels like a compiler. A DSL that says <code>NoMethodError in automation/runner.rb:31</code> feels like a leaky abstraction. The difference is six lines.</p>
        <h4>The validator, using reflection as a type check</h4>
        <pre><code>{"  class Validator\n    def initialize(registry)\n      @registry = registry\n    end\n\n    def problems(pipeline)\n      pipeline.steps.flat_map { |step| problems_for(step) }\n    end\n\n    def validate!(pipeline)\n      found = problems(pipeline)\n      raise InvalidPipeline, found unless found.empty?\n\n      pipeline\n    end\n\n    private\n\n    def problems_for(step)\n      unless @registry.registered?(step.name)\n        return [\"#{step.location}: unknown step #{step.name.inspect} \" \\\n                \"(known: #{@registry.known.sort.join(', ')})\"]\n      end\n\n      params = @registry.fetch(step.name).parameters\n      missing_keywords(step, params) + unknown_keywords(step, params)\n    end\n\n    def missing_keywords(step, params)\n      required = params.select { |type, _| type == :keyreq }.map(&:last)\n      (required - step.options.keys).map do |key|\n        \"#{step.location}: step #{step.name} is missing required option #{key.inspect}\"\n      end\n    end\n\n    def unknown_keywords(step, params)\n      return [] if params.any? { |type, _| type == :keyrest } # accepts **rest\n\n      allowed = params.select { |type, _| %i[key keyreq].include?(type) }.map(&:last)\n      (step.options.keys - allowed).map do |key|\n        hint = allowed.empty? ? \"it takes no options\" : \"it accepts: #{allowed.join(', ')}\"\n        \"#{step.location}: step #{step.name} got unknown option #{key.inspect}; #{hint}\"\n      end\n    end\n  end\n"}</code></pre>
        <p>This is the part that answers Part 0's honest criticism. Ruby cannot check your program before it runs, but a program can check <em>itself</em>, because every callable can be asked what arguments it wants. <code>parameters</code> returns pairs like <code>[[:opt, :items], [:keyreq, :topic], [:key, :since]]</code>, and from that you can derive: which options are required, which are permitted, and whether the step accepts anything at all via <code>**rest</code>.</p>
        <p>Details that make it usable rather than merely correct:</p>
        <ul>
          <li><strong>Collect every problem, do not stop at the first.</strong> <code>flat_map</code> over all steps and raise once with the whole list. A validator that reports one error per run is a validator people run once and then ignore.</li>
          <li><strong>Every message names a location and suggests an alternative.</strong> "unknown option <code>:limit</code>; it accepts: topic" is actionable; "invalid options" is not.</li>
          <li><strong>The <code>keyrest</code> escape hatch is deliberate.</strong> A step written as <code>{'{'} |input, **opts| {'}'}</code> opts out of checking, which is the right behaviour for genuinely open-ended steps and a useful pressure toward declaring your options.</li>
          <li><code>InvalidPipeline</code> carries <code>problems</code> as data, so a CLI can format them differently from a test.</li>
        </ul>
        <h3>What it looks like</h3>
        <pre className="plain"><code>{"--- the pipeline is data ---\nresearch (4 steps, 0 handlers)\n[:fetch, :filter, :summarize, :save_to]\n{:name=>:research,\n :location=>\"demo4.rb:11\",\n :steps=>\n  [{:name=>:fetch, :args=>[\"papers\"], :options=>{:from=>\"arxiv\"}, :location=>\"demo4.rb:12\"},\n   {:name=>:filter, :args=>[], :options=>{:topic=>\"arxiv\"}, :location=>\"demo4.rb:13\"},\n   {:name=>:summarize, :args=>[], :options=>{:max_words=>3}, :location=>\"demo4.rb:14\"},\n   {:name=>:save_to, :args=>[\"knowledge_base\"], :options=>{}, :location=>\"demo4.rb:15\"}],\n :handlers=>[]}\n\n--- nothing has executed yet; now it runs ---\n  saved 1 items to knowledge_base\n[\"papers from arxiv\"]\n\n--- validation catches mistakes before anything runs ---\npipeline is invalid:\n  - demo4.rb:28: step fetch is missing required option :from\n  - demo4.rb:29: unknown step :summarise (known: fetch, filter, save_to, summarize)\n  - demo4.rb:30: step filter got unknown option :limit; it accepts: topic\n\n--- building executes nothing, even for steps that would explode ---\nbuilt a pipeline containing :explode and nothing happened\n\n--- when_failed runs the user's handler ---\n  handler: explode failed with boom\n\n--- transformations return new pipelines ---\n[:fetch, :filter, :summarize, :save_to]\n[:fetch, :filter, :deduplicate, :summarize, :save_to]\n\n--- the data-only path: no code, no eval ---\n[:fetch, :summarize]\n[\"papers from\"]\n"}</code></pre>
        <p>Three errors, each with the user's own file and line, reported together, before a single step ran. Compare that with Milestone 2, where the same pipeline would have fetched successfully and then failed on the typo. <strong>That is what the AST bought.</strong></p>
        <h4>The safe mode</h4>
        <pre><code>{"  # The safe path: build the same AST from plain data, with no code\n  # execution at all. This is what you expose to untrusted input.\n  def self.from_h(hash)\n    steps = hash.fetch(:steps, []).map do |s|\n      AST::StepNode.new(\n        name: s.fetch(:name).to_sym,\n        args: (s[:args] || []).freeze,\n        options: (s[:options] || {}).transform_keys(&:to_sym).freeze,\n        location: s[:location] || \"(data)\"\n      )\n    end\n    AST::PipelineNode.new(\n      name: hash.fetch(:name).to_sym, steps: steps.freeze,\n      handlers: [].freeze, location: hash[:location] || \"(data)\"\n    ).freeze\n  end\n"}</code></pre>
        <div className="warn">
          <h5>An executable DSL is remote code execution</h5>
          <p>Say it plainly, because it is the most important practical fact about this technique. <code>Automation.define</code> takes a block of Ruby, so a pipeline file can open sockets, read <code>~/.ssh</code>, or delete things. If pipelines are written by your own team and live in your own repository, that is fine and no different from any other code. If pipelines arrive from a web form, a customer, or a plugin marketplace, <strong>you must not <code>eval</code> them</strong>.</p>
          <p><code>from_h</code> is the answer: the same AST, built from JSON or YAML, containing no callables. The registry decides what any given step name can do, so an untrusted pipeline can only compose verbs you chose to expose. Ruby's <code>$SAFE</code> is gone (removed in 3.0) and never worked well; there is no sandbox. The boundary has to be "which representations can contain code", and this is where you draw it. </p>
          <p>Two further precautions for the untrusted path: cap the number of steps, and do not allow <code>handlers</code>, since a handler <em>is</em> a block.</p>
        </div>
        <h4>The tests that matter</h4>
        <pre><code>{"  def test_building_executes_nothing\n    ran = false\n    @registry.register(:side_effect) { ran = true }\n\n    Automation.define(\"dangerous\", registry: @registry) { side_effect }\n\n    refute ran, \"building a pipeline must not run any step\"\n  end\n\n  def test_every_step_records_where_it_was_written\n    pipeline = Automation.define(\"located\", registry: @registry) do\n      fetch \"papers\", from: \"arxiv\"\n    end\n\n    assert_match(/test_define\\.rb:\\d+/, pipeline.find(:fetch).location)\n  end\n\n  def test_transformations_return_a_new_pipeline\n    pipeline = Automation.define(\"t\", registry: @registry) { summarize }\n    node = Automation::AST::StepNode.new(name: :fetch, args: [], options: {}, location: \"(test)\")\n\n    extended = pipeline.insert_before(:summarize, node)\n\n    assert_equal %i[summarize], pipeline.step_names, \"the original must not change\"\n    assert_equal %i[fetch summarize], extended.step_names\n  end\n\n  def test_caller_methods_are_forwarded_not_captured_as_steps\n    pipeline = Automation.define(\"delegating\", registry: @registry) do\n      summarize max_words: helper_value\n    end\n\n    assert_equal 7, pipeline.find(:summarize).options[:max_words]\n    assert_equal %i[summarize], pipeline.step_names\n  end\n\n  def helper_value = 7\n"}</code></pre>
        <pre className="plain"><code>{"$ ruby -Ilib -Itest test/all.rb\n....................\n\n20 runs, 50 assertions, 0 failures, 0 errors, 0 skips\n"}</code></pre>
        <p><code>test_building_executes_nothing</code> is the invariant test of this course, the equivalent of Go's food conservation. It is two lines and it pins the architectural decision everything else depends on. If someone later "optimises" the builder by executing a step eagerly, this test is what stops them.</p>
        <p>Note also <code>test_caller_methods_are_forwarded_not_captured_as_steps</code>: it is the naive-version failure from Milestone 3, turned into a regression test. <strong>Every bug you find by hand should become a test before you fix it</strong>, and a DSL's failures are especially worth pinning because they are silent.</p>
        <div className="exercise">
          <h5>Exercise 4</h5>
          <p>Make <code>to_h</code> and <code>from_h</code> a lossless round trip, and prove it.</p>
          <ul>
            <li><strong>Round trip:</strong> for any pipeline without handlers, <code>Automation.from_h(pipeline.to_h) == pipeline</code> must be true. Find out what currently breaks it (there is at least one thing) and fix it.</li>
            <li><strong>JSON:</strong> add <code>to_json</code> and <code>Automation.from_json</code>. Symbols do not survive JSON, so decide how to handle that and document the decision.</li>
            <li><strong>Hardening:</strong> make <code>from_h</code> reject input that is not safe: more than <code>max_steps</code> steps, step names that are not simple identifiers, and option values that are not strings, numbers, booleans, arrays or hashes of those. Raise a specific error naming the offending step.</li>
            <li><strong>Prove it</strong> with a test that round-trips three different pipelines and a test for each rejection.</li>
          </ul>
          <p>Hint for the first part: compare <code>pipeline.to_h</code> with what <code>from_h</code> reconstructs, field by field, in irb. The mismatch is small and instructive.</p>
        </div>
        <details>
          <summary>Solution 4 — open after trying</summary>
          <p><strong>What breaks the round trip.</strong> <code>to_h</code> preserves <code>location</code> (say <code>"demo.rb:12"</code>) but <code>from_h</code> is usually given data with no location and substitutes <code>"(data)"</code>, so the nodes differ. <code>Data</code> compares every field, including that one. Two defensible fixes: keep the original location when present (round trip preserves provenance), or exclude location from equality by comparing a normalised form. I prefer the first, with an explicit method for the second:</p>
          <pre><code>{"PipelineNode = Data.define(:name, :steps, :handlers, :location) do\n  # Equality ignoring provenance, for round-trip tests and diffs.\n  def same_shape?(other)\n    other.is_a?(PipelineNode) &&\n      name == other.name &&\n      steps.map { |s| [s.name, s.args, s.options] } ==\n        other.steps.map { |s| [s.name, s.args, s.options] }\n  end\nend\n"}</code></pre>
          <p><strong>JSON and symbols.</strong> JSON has no symbol type, so <code>:fetch</code> becomes <code>"fetch"</code> and comes back as a String. Rather than guessing, convert at the boundary: <code>from_h</code> already calls <code>to_sym</code> on names and <code>transform_keys(&:to_sym)</code> on options. Document that option <em>values</em> stay strings, because converting them would be lossy in the other direction (a step legitimately wanting the string <code>"lower"</code> cannot be distinguished from one wanting <code>:lower</code>). If a step wants a symbol, it should convert it itself.</p>
          <pre><code>{"def self.from_json(text, max_steps: 100)\n  from_h(JSON.parse(text, symbolize_names: true), max_steps: max_steps)\nend\n"}</code></pre>
          <p><strong>Hardening.</strong> The core of it:</p>
          <pre><code>{"SAFE_NAME = /\\A[a-z_][a-z0-9_]*\\z/\nSAFE_SCALARS = [String, Integer, Float, TrueClass, FalseClass, NilClass].freeze\n\ndef self.from_h(hash, max_steps: 100)\n  raw = hash.fetch(:steps, [])\n  raise UnsafePipeline, \"too many steps: #{raw.size} > #{max_steps}\" if raw.size > max_steps\n  raise UnsafePipeline, \"handlers are not allowed in data pipelines\" if hash[:handlers]&.any?\n\n  steps = raw.map do |s|\n    name = s.fetch(:name).to_s\n    unless name.match?(SAFE_NAME)\n      raise UnsafePipeline, \"step name #{name.inspect} is not a plain identifier\"\n    end\n    (s[:options] || {}).each do |key, value|\n      unless safe_value?(value)\n        raise UnsafePipeline, \"step #{name}: option #{key} has unsupported value #{value.class}\"\n      end\n    end\n    # ... build the StepNode\n  end\n  # ...\nend\n\ndef self.safe_value?(value)\n  case value\n  when *SAFE_SCALARS then true\n  when ::Array then value.all? { |v| safe_value?(v) }\n  when ::Hash  then value.all? { |k, v| safe_value?(k) && safe_value?(v) }\n  else false\n  end\nend\n"}</code></pre>
          <p>Three things worth noticing about the hardening.</p>
          <ul>
            <li><strong>Allow-list, never deny-list.</strong> <code>safe_value?</code> lists what is permitted and rejects everything else. A deny-list ("reject Procs and Methods") fails the moment someone finds a type you did not think of, and someone always does.</li>
            <li><strong>The recursion in <code>safe_value?</code></strong> is what stops a nested Hash from smuggling a callable three levels down. Validators that check only the top level are a recurring source of real vulnerabilities.</li>
            <li><strong>A step limit is not paranoia.</strong> Without it, a 10-million-step pipeline is a denial of service that costs the attacker one HTTP request. Every parser of untrusted input needs a size bound, and this is ours.</li>
          </ul>
          <p>Finally, note that <code>from_h</code> being safe depends entirely on <em>the registry containing only safe steps</em>. If someone registers <code>:shell</code>, the data path executes shell commands as designed. Safety here is a property of the whole system, not of one method, and saying so in your README is part of the job.</p>
        </details>
        <h4>Experiment</h4>
        <p>Change <code>caller_locations(2, 1)</code> to <code>caller_locations(1, 1)</code> and look at what the locations become: every step now reports a line inside <code>define.rb</code>. Then try <code>3</code> and watch them all point at the line that called <code>Automation.define</code>. Getting this right is pure experiment, and it is worth doing once so that you know how to fix it in your own libraries.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 4</h5>
          <ul>
            <li><strong>Counting stack frames wrong,</strong> so every error points inside your gem. Always test with a regex like <code>/test_define\.rb:\d+/</code>.</li>
            <li><strong>Validating one problem at a time.</strong> Collect them all; <code>flat_map</code> exists for this.</li>
            <li><strong>Mutating the AST in a transformation.</strong> <code>steps {'<'}{'<'} node</code> raises <code>FrozenError</code> if you froze properly, and silently corrupts shared state if you did not. </li>
            <li><strong>Forgetting that <code>Data</code> compares every field.</strong> Including <code>location</code>, which is why the round trip in Exercise 4 fails first time.</li>
            <li><strong>Treating <code>from_h</code> as safe without bounding it.</strong> Unbounded size, arbitrary names and nested values are all attack surface.</li>
            <li><strong>Putting metadata in the options Hash</strong> instead of on the node, which leaks plumbing into the data your steps receive.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Name four capabilities that only exist because building and running are separate.</li>
          <li>What does <code>Data.define</code> give you that the hand-written <code>Step</code> class did not?</li>
          <li>How does the validator know which options a step accepts?</li>
          <li>Why does <code>caller_locations(2, 1)</code> use 2?</li>
          <li>Why does a step declared with <code>**opts</code> skip option checking, and is that a bug?</li>
          <li>What makes <code>from_h</code> safe for untrusted input, and what would make it unsafe again?</li>
          <li>Why must <code>insert_before</code> return a new pipeline rather than mutating?</li>
        </ol>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>
            <img className="mascot-left" src={img6.src} alt="The Mewlang cat, wearing glasses, looking confident" width="120" loading="lazy" />
            Milestone 3 is the strongest case for Ruby in this curriculum. Four lines of <code>instance_eval</code> plus <code>method_missing</code> turned a builder API into something that reads like a language, and the loop example (<code>3.times {'{'} summarize index: i {'}'}</code> producing three steps) shows what you get that a data format cannot offer at any price.
          </p>
          <p>Milestone 4 is the honest correction. Everything we built there (source locations, a validator, an allow-list for untrusted input, a test asserting that building does not execute) is work that a compiled language would either give you free or make unnecessary. Racket, in Course 5, will do this <em>at compile time</em>: a typo in a step name becomes an error before the program runs, with the source location handled by the macro system rather than by counting stack frames. That comparison is the reason these two courses are adjacent in my recommended order.</p>
          <p>The fair summary: Ruby lets you build the front end of a language in an afternoon, and then asks you to rebuild, by hand and at run time, the parts of a compiler you actually needed.</p>
        </div>
        <h3>Repository state after Milestone 4</h3>
        <pre className="plain"><code>{"automation/\n├── Gemfile, automation.gemspec, Rakefile, README.md\n├── lib/\n│   ├── automation.rb            requires, global registry, register/reset\n│   └── automation/\n│       ├── version.rb\n│       ├── errors.rb            Error, UnknownStep, StepFailed, InvalidPipeline\n│       ├── step.rb              milestone 1's frozen value object\n│       ├── registry.rb          name -> callable, with useful failures\n│       ├── pipeline.rb          milestone 2: builder + reduce interpreter\n│       ├── dsl.rb               milestone 3: NaiveDSL and DSLBuilder\n│       ├── ast.rb               StepNode, HandlerNode, PipelineNode (Data)\n│       ├── define.rb            ASTBuilder, Automation.define, from_h\n│       ├── validator.rb         problems with file:line\n│       └── runner.rb            a minimal interpreter over the AST\n└── test/\n    ├── test_helper.rb\n    ├── test_step.rb             value semantics, freezing\n    ├── test_registry.rb         duck typing, useful errors\n    ├── test_define.rb           locations, immutability, nothing executes\n    └── test_validator.rb        every validation rule\n"}</code></pre>
        <pre className="plain"><code>{"$ ruby -Ilib -Itest test/all.rb\n20 runs, 50 assertions, 0 failures, 0 errors, 0 skips\n$ git commit -am \"milestone 4: an AST, source locations, and a validator\"\n"}</code></pre>
        <p>Note that <code>pipeline.rb</code> and <code>dsl.rb</code> are still there. Keep them: they are the Milestone 2 and 3 designs, they still pass their tests, and a reader of your repository can follow the same progression you did. Deleting the earlier versions is throwing away the argument.</p>
        <footer className="end">
          <p>
            <img className="mascot-center" src={img7.src} alt="The Mewlang cat, stretching and relaxed" width="150" loading="lazy" />
            Instalment 7 of the five-course curriculum. Next: Ruby Milestones 5–8, where the runner grows a context and middleware, failures get retries and handlers that actually work, plugins arrive via <code>define_method</code> and <code>method_missing</code>, and the steps start doing real work against HTTP, the filesystem and SQLite.
          </p>
        </footer>
         <Link className="button" href="/ruby-course/milestones/5-8/">Continue</Link> 
      </div>
    </div>
  );
}
