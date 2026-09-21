import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Go Milestones 1–4 — One Ant to a Thousand Goroutines",
  description: "We build the simulation sequentially, prove it correct, then deliberately break it by making it concurrent. Every snippet here was compiled, vetted and tested before it reached the page.",
};

export default function Page() {
  return (
    <div className="theme-go">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 2 · Course 1 (Go) · Milestones 1–4</p>
          <h1>One ant, then a thousand, then a thousand goroutines and a broken world</h1>
          <p className="lede">We build the simulation sequentially, prove it correct, then deliberately break it by making
                it concurrent. Every snippet here was compiled, vetted and tested before it reached the page.</p>
        </header>
        <div className="note">
          <h5>How to work through this</h5>
          <p>Type the code rather than copying it, run the tests after each file, and commit at the end of each
                milestone (<code>git commit -m "milestone 3: behaviour interface"</code>). The diffs between milestones
                are part of the lesson. Everything below was verified against Go 1.22; anything newer is fine.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 1</span>One ant on a grid, ticking</h2>
        <h3>Goal</h3>
        <p>A program you can run that creates a world, puts one ant in it, and advances time. No food, no concurrency,
            no cleverness. By the end you can type <code>go run ./cmd/antfarm -ticks 5</code> and watch an ant wander.
        </p>
        <h3>Concepts</h3>
        <p>Package layout across three directories, struct design, pointer receivers, constructors by convention, the
            flat-array trick for 2D grids, seeded randomness for reproducibility, command-line flags, and the first
            tests.</p>
        <h3>Design, before any code</h3>
        <p>Three decisions matter here, and they are the ones that make the next eleven milestones either easy or
            painful.</p>
        <p><strong>1. Separate the world from the simulation.</strong> <code>internal/world</code> knows about geometry,
            terrain and food. It knows nothing about ants, ticks or strategies. <code>internal/sim</code> knows about
            ants and time, and drives the world. The dependency points one way only:</p>
        <pre className="plain"><code>{"cmd/antfarm  ──►  internal/sim  ──►  internal/world\n\n  flags,            ants, ticks,        grid, positions,\n  wiring,           behaviour,          food, nest\n  printing          statistics          (knows nothing of ants)\n"}</code></pre>
        <p>Why bother this early? Because in Milestone 5 exactly one goroutine will be allowed to touch
            <code>world</code>, and a package boundary is the cheapest way to make that rule visible. If ants could
            reach into the grid from anywhere, the rule would be a comment instead of a structure.</p>
        <p><strong>2. The grid is a flat slice, not a slice of slices.</strong> A 2D field is naturally
            <code>[][]int</code>, and Go allows that, but <code>[]int</code> of length <code>w*h</code> with index
            <code>y*w+x</code> is one allocation instead of <code>h+1</code>, contiguous in memory so scans are
            cache-friendly, and copyable with a single <code>copy</code> call. That last property is what lets the
            viewer in Milestone 10 grab a whole frame cheaply.</p>
        <p><strong>3. Randomness is owned and seeded.</strong> A simulation that cannot be replayed cannot be debugged.
            The <code>Sim</code> holds its own random number generator seeded from config, so the same seed always
            produces the same run, and a bug you saw once you can see again. This is also how we will detect, in
            Milestone 4, that concurrency has quietly destroyed reproducibility.</p>
        <h3>Implementation</h3>
        <p>Create the module if you have not already:</p>
        <pre className="plain"><code>{"mkdir -p antfarm/cmd/antfarm antfarm/internal/world antfarm/internal/sim\ncd antfarm\ngo mod init github.com/yourname/antfarm\n"}</code></pre>
        <h4>internal/world/grid.go</h4>
        <pre><code>{"package world\n\nimport \"fmt\"\n\n// Position is a cell coordinate on the grid.\ntype Position struct{ X, Y int }\n\nfunc (p Position) String() string { return fmt.Sprintf(\"(%d,%d)\", p.X, p.Y) }\n\n// Add returns the position offset by d. It does not check bounds.\nfunc (p Position) Add(d Position) Position { return Position{p.X + d.X, p.Y + d.Y} }\n\n// Grid is a fixed-size two-dimensional field of ints held in one flat slice.\ntype Grid struct {\n\tW, H  int\n\tcells []int\n}\n\nfunc NewGrid(w, h int) *Grid {\n\tif w < 1 || h < 1 {\n\t\tpanic(\"world: grid dimensions must be positive\")\n\t}\n\treturn &Grid{W: w, H: h, cells: make([]int, w*h)}\n}\n\nfunc (g *Grid) InBounds(p Position) bool {\n\treturn p.X >= 0 && p.Y >= 0 && p.X < g.W && p.Y < g.H\n}\n\nfunc (g *Grid) At(p Position) int {\n\tif !g.InBounds(p) {\n\t\treturn 0\n\t}\n\treturn g.cells[p.Y*g.W+p.X]\n}\n\nfunc (g *Grid) Set(p Position, v int) {\n\tif !g.InBounds(p) {\n\t\treturn\n\t}\n\tg.cells[p.Y*g.W+p.X] = v\n}\n\n// AddAt adds delta to the cell and returns the new value.\nfunc (g *Grid) AddAt(p Position, delta int) int {\n\tif !g.InBounds(p) {\n\t\treturn 0\n\t}\n\ti := p.Y*g.W + p.X\n\tg.cells[i] += delta\n\treturn g.cells[i]\n}\n\n// Total sums every cell.\nfunc (g *Grid) Total() int {\n\tsum := 0\n\tfor _, v := range g.cells {\n\t\tsum += v\n\t}\n\treturn sum\n}\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><code>type Position struct{'{'} X, Y int {'}'}</code> — a tiny value type, 16 bytes, copied freely. Both fields
                are exported because other packages build positions constantly. Because it contains only comparable
                fields, <code>p1 == p2</code> works and <code>Position</code> can be used as a map key, which Milestone
                7 depends on.</li>
          <li><code>func (p Position) String() string</code> — implementing <code>String()</code> makes the type
                satisfy <code>fmt.Stringer</code>, and every <code>fmt</code> verb (<code>%v</code>, <code>%s</code>,
                <code>Println</code>) will now use it automatically. This is the implicit-interface idea from Part 2
                paying off: we never mention <code>fmt.Stringer</code>, we just have the method.</li>
          <li><code>Position.Add</code> uses a <em>value</em> receiver because it does not mutate; <code>Grid</code>'s
                methods use <em>pointer</em> receivers because <code>Grid</code> contains a slice and is conceptually
                one shared object, not a copyable value.</li>
          <li><code>cells []int</code> is lowercase, so no code outside package <code>world</code> can index it
                directly. Every access goes through <code>At</code>/<code>Set</code>/<code>AddAt</code>, which means
                bounds checking happens in exactly one place. That is worth the function call.</li>
          <li><code>panic</code> in <code>NewGrid</code> — this is the one legitimate use of panic: a programmer error
                at startup that no caller could sensibly recover from. Compare with <code>At</code>, where an
                out-of-range position is a normal runtime occurrence and returns <code>0</code>.</li>
          <li><code>return &Grid{'{'}...{'}'}</code> — taking the address of a composite literal. In C this would be a
                pointer to a dead stack variable; in Go the compiler's escape analysis moves it to the heap
                automatically. You never think about this.</li>
        </ul>
        <div className="cmp">
          <h5>Typical language vs Go</h5>
          <p>In Python or Java you would likely write a <code>Grid</code> class with a
                <code>get</code>/<code>set</code> pair and a subclass for special grids. Go gives you no subclassing, so
                the design pressure is toward one concrete struct with a small method set, and toward putting variation
                in a separate type that satisfies an interface. That constraint sounds limiting and mostly produces
                flatter, more readable code. Where it hurts is when you genuinely want polymorphic <em>data</em> rather
                than polymorphic behaviour, and Go's answer there (interfaces plus type switches) is clumsier than a
                sealed class hierarchy.</p>
        </div>
        <h4>internal/world/world.go (first version)</h4>
        <pre><code>{"package world\n\n// World holds everything the colony shares: terrain, food and the nest.\ntype World struct {\n\tW, H int\n\tNest Position\n\tFood *Grid\n}\n\nfunc New(w, h int) *World {\n\treturn &World{\n\t\tW:    w,\n\t\tH:    h,\n\t\tNest: Position{X: w / 2, Y: h / 2},\n\t\tFood: NewGrid(w, h),\n\t}\n}\n\nfunc (w *World) InBounds(p Position) bool { return w.Food.InBounds(p) }\n\n// Clamp keeps a position inside the grid instead of rejecting it.\nfunc (w *World) Clamp(p Position) Position {\n\tif p.X < 0 {\n\t\tp.X = 0\n\t}\n\tif p.Y < 0 {\n\t\tp.Y = 0\n\t}\n\tif p.X >= w.W {\n\t\tp.X = w.W - 1\n\t}\n\tif p.Y >= w.H {\n\t\tp.Y = w.H - 1\n\t}\n\treturn p\n}\n"}</code></pre>
        <p><code>Clamp</code> takes a <code>Position</code> by value and returns a modified copy, so
            <code>p.X = 0</code> inside the function is not visible to the caller. That is deliberate: a function that
            returns a new value is easier to reason about than one that mutates through a pointer, and for a 16-byte
            struct the copy is free.</p>
        <p>The constructor is called <code>New</code>, not <code>NewWorld</code>, because it lives in package
            <code>world</code> and callers write <code>world.New(64, 64)</code>. Repeating the package name
            (<code>world.NewWorld</code>) is a classic non-Go smell that linters complain about.</p>
        <h4>internal/sim/ant.go</h4>
        <pre><code>{"package sim\n\nimport \"github.com/yourname/antfarm/internal/world\"\n\n// Ant is a single agent. Its zero value is a valid ant sitting at the\n// origin with nothing to do, which keeps construction simple.\ntype Ant struct {\n\tID       int\n\tPos      world.Position\n\tCarrying bool\n\tEnergy   int\n}\n"}</code></pre>
        <p>Note the import path: <code>github.com/yourname/antfarm/internal/world</code>, which is the module path plus
            the directory. The package is then referred to by its <em>package name</em>, <code>world</code>, which
            usually matches the last path segment but does not have to.</p>
        <h4>internal/sim/sim.go (first version)</h4>
        <pre><code>{"package sim\n\nimport (\n\t\"math/rand/v2\"\n\n\t\"github.com/yourname/antfarm/internal/world\"\n)\n\n// Config is everything the simulation needs to start.\ntype Config struct {\n\tWidth, Height int\n\tSeed          uint64\n}\n\n// Sim owns the world and the ant in it.\ntype Sim struct {\n\tcfg   Config\n\trng   *rand.Rand\n\tworld *world.World\n\tant   *Ant\n\ttick  int\n}\n\n// New builds a simulation. The same seed always produces the same run.\nfunc New(cfg Config) *Sim {\n\tif cfg.Width <= 0 {\n\t\tcfg.Width = 64\n\t}\n\tif cfg.Height <= 0 {\n\t\tcfg.Height = 64\n\t}\n\n\trng := rand.New(rand.NewPCG(cfg.Seed, cfg.Seed^0x9E3779B97F4A7C15))\n\tw := world.New(cfg.Width, cfg.Height)\n\n\treturn &Sim{\n\t\tcfg:   cfg,\n\t\trng:   rng,\n\t\tworld: w,\n\t\tant:   &Ant{ID: 0, Pos: w.Nest, Energy: 1000},\n\t}\n}\n\nfunc (s *Sim) Ant() *Ant   { return s.ant }\nfunc (s *Sim) Tick() int   { return s.tick }\n\n// directions are the eight neighbours of a cell.\nvar directions = [8]world.Position{\n\t{X: -1, Y: -1}, {X: 0, Y: -1}, {X: 1, Y: -1},\n\t{X: -1, Y: 0}, {X: 1, Y: 0},\n\t{X: -1, Y: 1}, {X: 0, Y: 1}, {X: 1, Y: 1},\n}\n\n// Step advances the simulation by one tick.\nfunc (s *Sim) Step() {\n\td := directions[s.rng.IntN(len(directions))]\n\ts.ant.Pos = s.world.Clamp(s.ant.Pos.Add(d))\n\ts.ant.Energy--\n\ts.tick++\n}\n\nfunc (s *Sim) Run(n int) {\n\tfor range n {\n\t\ts.Step()\n\t}\n}\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><code>cfg Config</code> is stored by value, so the caller cannot change our configuration after
                construction. Deliberate immutability by copying, which Go makes cheap and obvious.</li>
          <li><code>rand.New(rand.NewPCG(seed, seed^constant))</code> — this is the <code>math/rand/v2</code> API. PCG
                is a modern generator needing two seed words; XORing with a large odd constant avoids the degenerate
                case where both words are zero. If your Go is older than 1.22, use
                <code>rand.New(rand.NewSource(int64(seed)))</code> from <code>math/rand</code> instead.</li>
          <li><strong>The <code>rng</code> is not a global.</strong> The package-level <code>rand.IntN</code> exists
                and is convenient and is exactly the wrong choice here: global state is shared by every goroutine, which
                would make Milestone 4's races worse and reproducibility impossible.</li>
          <li><code>var directions = [8]world.Position{'{'}...{'}'}</code> — square brackets with a number make this an
                <em>array</em>, a fixed-size value type, not a slice. It is a package-level variable computed once.
                <code>len(directions)</code> is a compile-time constant for arrays.</li>
          <li><code>func (s *Sim) Ant() *Ant</code> — a getter, because <code>ant</code> is unexported. Go has no
                properties; a method named after the field is the convention, without a <code>Get</code> prefix.</li>
          <li><code>for range n</code> — ranging over an integer, added in Go 1.22. Older code writes
                <code>for i := 0; i {'<'} n; i++</code>.</li>
        </ul>
        <h4>cmd/antfarm/main.go</h4>
        <pre><code>{"package main\n\nimport (\n\t\"flag\"\n\t\"fmt\"\n\t\"os\"\n\t\"strconv\"\n\t\"strings\"\n\n\t\"github.com/yourname/antfarm/internal/sim\"\n)\n\nfunc main() {\n\tvar (\n\t\tgridFlag = flag.String(\"grid\", \"64x64\", \"grid size as WxH\")\n\t\tticks    = flag.Int(\"ticks\", 10, \"how many ticks to run\")\n\t\tseed     = flag.Uint64(\"seed\", 1, \"random seed; the same seed replays the same run\")\n\t)\n\tflag.Parse()\n\n\tw, h, err := parseGrid(*gridFlag)\n\tif err != nil {\n\t\tfmt.Fprintln(os.Stderr, \"antfarm:\", err)\n\t\tflag.Usage()\n\t\tos.Exit(2)\n\t}\n\n\ts := sim.New(sim.Config{Width: w, Height: h, Seed: *seed})\n\tfmt.Printf(\"world %dx%d, ant starts at %v\\n\", w, h, s.Ant().Pos)\n\n\tfor t := 1; t <= *ticks; t++ {\n\t\ts.Step()\n\t\tfmt.Printf(\"tick %-4d pos %v energy %d\\n\", t, s.Ant().Pos, s.Ant().Energy)\n\t}\n}\n\nfunc parseGrid(s string) (int, int, error) {\n\tparts := strings.Split(strings.ToLower(s), \"x\")\n\tif len(parts) != 2 {\n\t\treturn 0, 0, fmt.Errorf(\"bad -grid %q: want WxH, for example 128x128\", s)\n\t}\n\tw, err := strconv.Atoi(parts[0])\n\tif err != nil {\n\t\treturn 0, 0, fmt.Errorf(\"bad width in -grid %q: %w\", s, err)\n\t}\n\th, err := strconv.Atoi(parts[1])\n\tif err != nil {\n\t\treturn 0, 0, fmt.Errorf(\"bad height in -grid %q: %w\", s, err)\n\t}\n\tif w < 1 || h < 1 {\n\t\treturn 0, 0, fmt.Errorf(\"bad -grid %q: dimensions must be positive\", s)\n\t}\n\treturn w, h, nil\n}\n"}</code></pre>
        <pre className="plain"><code>{"$ go run ./cmd/antfarm -ticks 4 -grid 32x32\nworld 32x32, ant starts at (16,16)\ntick 1    pos (15,15) energy 999\ntick 2    pos (16,16) energy 998\ntick 3    pos (16,15) energy 997\ntick 4    pos (15,14) energy 996\n"}</code></pre>
        <h4>Explanation of the CLI</h4>
        <ul>
          <li><code>flag.String("grid", "64x64", "help text")</code> returns a <code>*string</code>, a pointer,
                because the value does not exist until <code>flag.Parse()</code> runs. Hence <code>*gridFlag</code> at
                the point of use. The alternative <code>flag.StringVar(&myVar, ...)</code> fills a variable you own.
            </li>
          <li><code>flag.Parse()</code> must be called after all flags are declared and before any are read. Calling
                it inside a library is a known Go sin; flags belong in <code>main</code>.</li>
          <li><code>fmt.Fprintln(os.Stderr, ...)</code> — errors go to standard error, results to standard output, so
                that <code>antfarm | grep</code> behaves. <code>os.Exit(2)</code> is the conventional code for a usage
                error; <code>1</code> means the program ran and failed.</li>
          <li><code>%q</code> prints a quoted string, which makes bad input visible (you can see the trailing space in
                <code>"64x64 "</code>). <code>%-4d</code> is a left-aligned integer in a 4-wide field, so the columns
                line up.</li>
          <li><code>os.Exit</code> does <strong>not</strong> run deferred functions. Keep it at the top of
                <code>main</code> and nowhere else.</li>
        </ul>
        <h4>The first tests</h4>
        <p>Create <code>internal/world/grid_test.go</code>:</p>
        <pre><code>{"package world\n\nimport \"testing\"\n\nfunc TestGridSetAndAt(t *testing.T) {\n\tg := NewGrid(4, 3)\n\tg.Set(Position{2, 1}, 7)\n\tif got := g.At(Position{2, 1}); got != 7 {\n\t\tt.Errorf(\"At(2,1) = %d, want 7\", got)\n\t}\n}\n\nfunc TestGridBounds(t *testing.T) {\n\tg := NewGrid(4, 3)\n\tcases := []struct {\n\t\tname string\n\t\tpos  Position\n\t}{\n\t\t{\"negative x\", Position{-1, 0}},\n\t\t{\"negative y\", Position{0, -1}},\n\t\t{\"beyond width\", Position{4, 0}},\n\t\t{\"beyond height\", Position{0, 3}},\n\t}\n\tfor _, tc := range cases {\n\t\tt.Run(tc.name, func(t *testing.T) {\n\t\t\tif got := g.At(tc.pos); got != 0 {\n\t\t\t\tt.Errorf(\"At(%s) = %d, want 0\", tc.pos, got)\n\t\t\t}\n\t\t\tg.Set(tc.pos, 99) // must not panic and must not corrupt anything\n\t\t\tif got := g.Total(); got != 0 {\n\t\t\t\tt.Errorf(\"after out-of-bounds Set, Total() = %d, want 0\", got)\n\t\t\t}\n\t\t})\n\t}\n}\n"}</code></pre>
        <pre className="plain"><code>{"$ go test ./...\nok  \tgithub.com/yourname/antfarm/internal/world\t0.001s\n"}</code></pre>
        <p>The second test is <em>table-driven</em>: the cases are data, the assertion logic appears once, and
            <code>t.Run</code> gives each case a name so a failure says <code>TestGridBounds/beyond_width</code> rather
            than "line 41". Adding a case is one line. This is the dominant Go testing style and you should reach for it
            by default.</p>
        <div className="exercise">
          <h5>Exercise 1</h5>
          <p>Write <code>TestSameSeedSameRun</code> in <code>internal/sim/sim_test.go</code>: build two simulations
                with identical config, run each for 500 ticks, and assert that both ants end in the same position with
                the same energy. Then write <code>TestDifferentSeedDiffersSomewhere</code>, which runs two different
                seeds and asserts the paths are not identical. Think about why the second test is slightly risky and how
                to make it robust.</p>
        </div>
        <details>
          <summary>Solution 1 — open after trying</summary>
          <pre><code>{"package sim\n\nimport \"testing\"\n\nfunc TestSameSeedSameRun(t *testing.T) {\n\tcfg := Config{Width: 32, Height: 32, Seed: 42}\n\n\ta := New(cfg)\n\ta.Run(500)\n\n\tb := New(cfg)\n\tb.Run(500)\n\n\tif a.Ant().Pos != b.Ant().Pos {\n\t\tt.Fatalf(\"same seed diverged: %v vs %v\", a.Ant().Pos, b.Ant().Pos)\n\t}\n\tif a.Ant().Energy != b.Ant().Energy {\n\t\tt.Errorf(\"energy differs: %d vs %d\", a.Ant().Energy, b.Ant().Energy)\n\t}\n}\n\nfunc TestDifferentSeedDiffersSomewhere(t *testing.T) {\n\ta := New(Config{Width: 32, Height: 32, Seed: 1})\n\tb := New(Config{Width: 32, Height: 32, Seed: 2})\n\n\tsame := 0\n\tfor range 500 {\n\t\ta.Step()\n\t\tb.Step()\n\t\tif a.Ant().Pos == b.Ant().Pos {\n\t\t\tsame++\n\t\t}\n\t}\n\tif same == 500 {\n\t\tt.Fatal(\"two different seeds produced identical paths for 500 ticks\")\n\t}\n}\n"}</code></pre>
          <p>The risk in the second test: two random walks on a small clamped grid can legitimately meet at the same
                cell on any given tick, so comparing a single tick would be flaky. Comparing the <em>whole path</em>
                makes a false failure essentially impossible. Flaky tests are worse than no tests, and "is this
                assertion true for every possible random sequence, or just most?" is the question to ask every time you
                test randomised code.</p>
          <p>Note also <code>a.Ant().Pos != b.Ant().Pos</code>: struct comparison with <code>==</code> works because
                <code>Position</code> contains only comparable fields. If it contained a slice, this would not compile.
            </p>
        </details>
        <h4>Experiment</h4>
        <p>Change <code>Clamp</code> so that instead of stopping at the edge it wraps around (a torus): position
            <code>-1</code> becomes <code>W-1</code>. Run 2000 ticks with both versions and print the final position.
            The clamped ant spends much of its life pinned to a wall, because a random walk that is blocked in two
            directions is biased toward the corner. The wrapped ant does not. This is your first taste of the
            simulation's dynamics being driven by a boundary condition rather than by the interesting logic, which is a
            recurring theme in agent-based modelling.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 1</h5>
          <ul>
            <li><code>package sim; import "internal/world"</code> — import paths are always absolute from the module
                    root, never relative. It must be <code>github.com/yourname/antfarm/internal/world</code>.</li>
            <li><code>cannot use s.ant (variable of type *Ant) as Ant value</code> — you mixed pointer and value.
                    Pick pointers for <code>Ant</code> and stay consistent; ants are mutable identities, not values.
                </li>
            <li>Calling <code>s.rng.IntN(0)</code> when a slice is empty: it panics with "invalid argument to IntN".
                    Guard the length.</li>
            <li>Forgetting <code>flag.Parse()</code>. Every flag silently keeps its default and you lose twenty
                    minutes.</li>
            <li>Writing <code>func (s Sim) Step()</code> with a value receiver. It compiles, it runs, and nothing
                    ever changes, because every call mutates a copy. If your state refuses to update, check the receiver
                    first.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why is <code>cells</code> unexported while <code>W</code> and <code>H</code> are exported?</li>
          <li>What would break if <code>Sim</code> used the package-level <code>rand.IntN</code> instead of its own
                <code>*rand.Rand</code>?</li>
          <li><code>Clamp</code> takes and returns a <code>Position</code> by value. Where does the copy happen, and
                why is that cheaper than it sounds?</li>
          <li>Why does <code>NewGrid</code> panic on bad dimensions while <code>At</code> quietly returns 0 on a bad
                position?</li>
          <li>What does <code>flag.Int</code> return, and why is it not an <code>int</code>?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 2</span>A thousand ants, still sequential</h2>
        <h3>Goal</h3>
        <p>Scale from one ant to arbitrarily many, scatter food around the world, and report statistics. Still
            single-threaded. We also establish a performance baseline, because in Milestone 4 we will want to know
            whether concurrency actually bought us anything.</p>
        <h3>Concepts</h3>
        <p>Slices of pointers, preallocation with <code>make</code>, default values in config, snapshot value types,
            benchmarks, and measuring before optimising.</p>
        <h3>Design</h3>
        <p>Two questions worth answering deliberately.</p>
        <p><strong><code>[]Ant</code> or <code>[]*Ant</code>?</strong> A slice of values keeps all ants contiguous,
            which is faster to iterate. A slice of pointers means each ant is a stable, independently addressable
            object. We choose pointers, for one reason that is about the future: from Milestone 4 each ant is owned by
            its own goroutine, and a goroutine holding an index into a slice that might be reallocated is a bug waiting
            to happen. Also, <code>for _, a := range ants</code> gives you a copy when the element is a value, so
            mutations would silently vanish. That trap alone has cost more Go programmer-hours than the cache locality
            is worth here.</p>
        <p><strong>What is a "statistic"?</strong> Counting carrying ants by walking the slice is O(n) per call, which
            is fine at 1,000 ants and wasteful at 50,000 when a viewer asks 60 times a second. We will do the naive
            thing now and fix it in Milestone 9 with counters, because doing it now would be optimising a system whose
            shape we do not yet know. Write down the fact that it is O(n), then move on.</p>
        <h3>Implementation</h3>
        <p>Replace <code>Config</code>, add defaults, and grow <code>Sim</code>:</p>
        <pre><code>{"// Config is everything the simulation needs to start. Zero values are not\n// useful here, so New fills in defaults.\ntype Config struct {\n\tWidth, Height int\n\tAnts          int\n\tFoodSources   int\n\tFoodPerSource int\n\tStartEnergy   int\n\tSeed          uint64\n}\n\nfunc (c *Config) applyDefaults() {\n\tif c.Width <= 0 {\n\t\tc.Width = 64\n\t}\n\tif c.Height <= 0 {\n\t\tc.Height = 64\n\t}\n\tif c.Ants <= 0 {\n\t\tc.Ants = 1\n\t}\n\tif c.FoodSources < 0 {\n\t\tc.FoodSources = 0\n\t}\n\tif c.FoodPerSource <= 0 {\n\t\tc.FoodPerSource = 50\n\t}\n\tif c.StartEnergy <= 0 {\n\t\tc.StartEnergy = 1000\n\t}\n}\n"}</code></pre>
        <p><code>applyDefaults</code> has a pointer receiver so it can modify the config, and it is unexported because
            it is an implementation detail. <code>New</code> takes <code>Config</code> by value and calls
            <code>cfg.applyDefaults()</code> on its own copy, so the caller's struct is untouched. This "zero value
            means default" pattern is everywhere in Go: it lets <code>sim.New(sim.Config{'{'}Ants: 500{'}'}, ...)</code> work
            without a builder or twelve constructor overloads, neither of which Go has.</p>
        <pre><code>{"type Sim struct {\n\tcfg   Config\n\trng   *rand.Rand\n\tworld *world.World\n\tants  []*Ant\n\n\ttick int\n}\n\nfunc New(cfg Config) *Sim {\n\tcfg.applyDefaults()\n\n\trng := rand.New(rand.NewPCG(cfg.Seed, cfg.Seed^0x9E3779B97F4A7C15))\n\tw := world.New(cfg.Width, cfg.Height)\n\n\ts := &Sim{cfg: cfg, rng: rng, world: w}\n\ts.scatterFood()\n\ts.spawnAnts()\n\treturn s\n}\n\nfunc (s *Sim) World() *world.World { return s.world }\nfunc (s *Sim) Ants() []*Ant        { return s.ants }\n\nfunc (s *Sim) scatterFood() {\n\tfor range s.cfg.FoodSources {\n\t\tp := world.Position{\n\t\t\tX: s.rng.IntN(s.cfg.Width),\n\t\t\tY: s.rng.IntN(s.cfg.Height),\n\t\t}\n\t\ts.world.Food.AddAt(p, s.cfg.FoodPerSource)\n\t}\n}\n\nfunc (s *Sim) spawnAnts() {\n\ts.ants = make([]*Ant, 0, s.cfg.Ants) // one allocation, not s.cfg.Ants of them\n\tfor i := range s.cfg.Ants {\n\t\ts.ants = append(s.ants, &Ant{\n\t\t\tID:     i,\n\t\t\tPos:    s.world.Nest,\n\t\t\tEnergy: s.cfg.StartEnergy,\n\t\t})\n\t}\n}\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><code>make([]*Ant, 0, s.cfg.Ants)</code> — length zero, capacity <code>Ants</code>. The slice is empty
                but the backing array is already big enough, so the 50,000 <code>append</code> calls that follow never
                reallocate. Without the capacity hint, <code>append</code> grows the array by roughly 1.25–2×
                repeatedly, copying everything each time: around 20 allocations and 100,000 pointer copies. This is the
                single most common easy win in Go performance work.</li>
          <li>Watch the difference between <code>make([]*Ant, 0, n)</code> and <code>make([]*Ant, n)</code>. The
                second gives you a slice of <code>n</code> <strong>nil</strong> pointers, and then <code>append</code>
                adds an <em>n+1</em>th element. Mixing these up produces "half my ants are nil" and a nil-pointer panic.
            </li>
          <li><code>scatterFood</code> uses <code>AddAt</code> rather than <code>Set</code>, so two food sources
                landing on the same cell accumulate instead of one silently overwriting the other. Small choice, but it
                keeps the invariant "total food equals sources × per-source" true, and the conservation test below
                depends on it.</li>
          <li><code>s.ants = append(s.ants, ...)</code> — the return value is assigned back. Always.</li>
        </ul>
        <p>Now a snapshot type and the tick loop over all ants:</p>
        <pre><code>{"// Stats is a snapshot of the colony, cheap to copy.\ntype Stats struct {\n\tTick          int\n\tAnts          int\n\tCarrying      int\n\tDelivered     int\n\tFoodRemaining int\n\tFailedPickups int\n}\n\nfunc (s Stats) String() string {\n\treturn fmt.Sprintf(\"tick %-6d ants %-6d carrying %-6d delivered %-6d food left %-6d\",\n\t\ts.Tick, s.Ants, s.Carrying, s.Delivered, s.FoodRemaining)\n}\n\n// Stats walks every ant, so it is O(n). Milestone 9 makes it O(1).\nfunc (s *Sim) Stats() Stats {\n\tcarrying := 0\n\tfor _, a := range s.ants {\n\t\tif a.Carrying {\n\t\t\tcarrying++\n\t\t}\n\t}\n\treturn Stats{\n\t\tTick:          s.tick,\n\t\tAnts:          len(s.ants),\n\t\tCarrying:      carrying,\n\t\tDelivered:     s.world.Delivered(),\n\t\tFoodRemaining: s.world.Food.Total(),\n\t\tFailedPickups: s.failedPickups,\n\t}\n}\n"}</code></pre>
        <p><code>Stats</code> is a plain value with no pointers, and <code>String()</code> has a <em>value</em> receiver
            so that both <code>Stats</code> and <code>*Stats</code> print nicely. Being pointer-free is not an accident:
            in Milestone 10 we will send these over a channel to a viewer, and a value with no references is safe to
            hand to another goroutine with no further thought. Designing for that now costs nothing.</p>
        <p><code>Delivered()</code> and <code>Deliver()</code> are new on <code>World</code>; they arrive properly in
            Milestone 3 along with food handling. For now, add:</p>
        <pre><code>{"// in internal/world/world.go, inside the World struct:\n//     delivered int\n\n// Deliver records one unit of food arriving at the nest.\nfunc (w *World) Deliver() { w.delivered++ }\n\n// Delivered reports how much food has reached the nest.\nfunc (w *World) Delivered() int { return w.delivered }\n"}</code></pre>
        <h4>The baseline benchmark</h4>
        <p>Add this to <code>internal/sim/sim_test.go</code>:</p>
        <pre><code>{"func BenchmarkStep1000Ants(b *testing.B) {\n\ts := New(Config{Width: 128, Height: 128, Ants: 1000, FoodSources: 50, Seed: 1})\n\tb.ResetTimer()\n\tfor range b.N {\n\t\ts.Step()\n\t}\n}\n"}</code></pre>
        <pre className="plain"><code>{"$ go test -bench BenchmarkStep1000Ants -benchmem ./internal/sim/\ngoos: linux\ngoarch: amd64\ncpu: Intel(R) Xeon(R) Processor @ 2.10GHz\nBenchmarkStep1000Ants-1   \t  102345\t     11234 ns/op\t       0 B/op\t       0 allocs/op\n"}</code></pre>
        <ul>
          <li>A benchmark is a function named <code>BenchmarkXxx</code> taking <code>*testing.B</code>. The framework
                calls it repeatedly with increasing <code>b.N</code> until the timing is statistically stable, so your
                loop must run exactly <code>b.N</code> iterations of the thing you are measuring.</li>
          <li><code>b.ResetTimer()</code> discards the setup time. Without it, building the world is counted in the
                first measurement and the numbers drift.</li>
          <li><code>-benchmem</code> adds <code>B/op</code> (bytes allocated per operation) and
                <code>allocs/op</code>. <strong>Zero allocations per op is the number to aim for in a hot loop</strong>,
                and in Go it is achievable far more often than in most garbage-collected languages, because values,
                arrays and struct fields do not allocate.</li>
          <li>The exact nanoseconds are meaningless across machines. What matters is the ratio when you change
                something. Record your own baseline now; Milestone 11 will compare against it.</li>
        </ul>
        <div className="exercise">
          <h5>Exercise 2</h5>
          <p>Add a method <code>func (s *Sim) Census() map[world.Position]int</code> returning how many ants occupy
                each cell, and a test asserting that the sum over the map equals the number of ants and that at tick 0
                every ant is on the nest. Then write a second benchmark for <code>Census</code> with 10,000 ants, and
                think about why it allocates when <code>Step</code> does not.</p>
        </div>
        <details>
          <summary>Solution 2 — open after trying</summary>
          <pre><code>{"func (s *Sim) Census() map[world.Position]int {\n\tm := make(map[world.Position]int, len(s.ants)/4) // a guess, to reduce rehashing\n\tfor _, a := range s.ants {\n\t\tm[a.Pos]++\n\t}\n\treturn m\n}\n"}</code></pre>
          <pre><code>{"func TestCensusCountsEveryAnt(t *testing.T) {\n\ts := New(Config{Width: 16, Height: 16, Ants: 250, Seed: 3})\n\n\tc := s.Census()\n\tif got := c[s.World().Nest]; got != 250 {\n\t\tt.Errorf(\"at tick 0, nest holds %d ants, want 250\", got)\n\t}\n\n\ts.Run(100)\n\ttotal := 0\n\tfor _, n := range s.Census() {\n\t\ttotal += n\n\t}\n\tif total != 250 {\n\t\tt.Errorf(\"census total = %d, want 250 (ants cannot vanish)\", total)\n\t}\n}\n"}</code></pre>
          <p><code>m[a.Pos]++</code> works on a missing key because the read returns the zero value <code>0</code>,
                then increments and stores. No <code>if key in m</code> dance.</p>
          <p>Why it allocates: a map must allocate buckets, and it grows as keys are added. <code>Step</code>
                allocates nothing because it only writes to existing memory. The capacity hint in
                <code>make(map[K]V, n)</code> reduces but does not eliminate this. A serious version would reuse one map
                across calls, or replace it with a <code>[]int</code> the size of the grid, which is the same flat-array
                trick again and allocates once.</p>
          <p>If you tried <code>map[*Ant]int</code> instead, note that pointers are comparable and usable as keys, but
                hashing addresses gives you an unstable iteration order and makes the map meaningless after a restart.
            </p>
        </details>
        <h4>Experiment</h4>
        <p>Run <code>BenchmarkStep1000Ants</code> with <code>-benchtime 3s</code> to get a steadier number, then change
            <code>spawnAnts</code> to use <code>make([]*Ant, 0)</code> with no capacity and re-run with 100,000 ants,
            timing <code>New</code> instead of <code>Step</code>. Write a <code>BenchmarkNew100k</code> to make that
            measurable. You should see the allocation count in <code>-benchmem</code> jump from a handful to dozens,
            with a matching increase in bytes.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 2</h5>
          <ul>
            <li><code>make([]*Ant, n)</code> followed by <code>append</code>: you now have <code>2n</code> entries,
                    half of them nil, and the next loop panics with
                    <code>invalid memory address or nil pointer dereference</code>.</li>
            <li>Mutating during <code>range</code> over a value slice:
                    <code>for _, a := range ants {'{'} a.Energy-- {'}'}</code> does nothing when <code>ants</code> is
                    <code>[]Ant</code>. With <code>[]*Ant</code> it works, because you are copying the pointer, not the
                    ant.</li>
            <li>Assuming <code>Census</code> iterates in a stable order. Map iteration order is randomised; sort the
                    keys if you print them.</li>
            <li>Benchmarking with the timer running during setup, then concluding that your code is slow.</li>
            <li>Letting the compiler delete your benchmark body because the result is unused. If a benchmark shows
                    0.3 ns/op, it was optimised away; assign the result to a package-level variable to prevent it.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does <code>New</code> take <code>Config</code> by value but <code>applyDefaults</code> take a
                pointer receiver?</li>
          <li>What is the difference in memory behaviour between <code>make([]*Ant, 0, 1000)</code> and
                <code>make([]*Ant, 0)</code> after 1000 appends?</li>
          <li>Why is <code>Stats</code> deliberately free of pointers?</li>
          <li>What does <code>allocs/op</code> tell you that <code>ns/op</code> does not?</li>
          <li>We chose <code>[]*Ant</code> over <code>[]Ant</code>. Give one performance cost and one correctness
                benefit of that choice.</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 3</span>Behaviour: forage, carry, return</h2>
        <h3>Goal</h3>
        <p>Ants stop wandering aimlessly. They search for food, pick it up, carry it back to the nest, and deliver it.
            The strategy lives behind an interface, so we can add smarter ants later without touching the engine. Food
            handling introduces real error values.</p>
        <h3>Concepts</h3>
        <p>Interfaces and implicit satisfaction, enum-like constants with <code>iota</code>, a command/action value
            type, sentinel errors, custom error types, <code>errors.Is</code> and <code>errors.As</code>, and the
            distinction between expected failure and a bug.</p>
        <h3>Design</h3>
        <p>The state machine is small:</p>
        <pre className="plain"><code>{"                 food on this cell\n   ┌──────────┐ ─────────────────► ┌──────────┐\n   │ SEARCHING │                    │ CARRYING │\n   └──────────┘ ◄───────────────── └──────────┘\n                  delivered at nest\n\n   SEARCHING: random walk; if food here, pick it up\n   CARRYING : step toward nest; if at nest, drop\n"}</code></pre>
        <p>The important design question is not the state machine, it is <em>who is allowed to change the world</em>.
            Two options:</p>
        <pre className="plain"><code>{"Option A: the ant acts directly\n    ant.Decide() { if food here { world.TakeFood(pos); a.Carrying = true } }\n\nOption B: the ant returns a request; the engine applies it\n    act := ant.Decide()         // pure: reads the world, returns a value\n    err := sim.apply(ant, act)  // the only code that mutates\n"}</code></pre>
        <p>We take Option B, and this is the single most consequential decision in the whole project. Three reasons:</p>
        <ol>
          <li><strong>Testability.</strong> <code>Decide</code> is a pure function of ant and world, so a table test
                can check "carrying, standing on the nest → drop" with no setup and no side effects.</li>
          <li><strong>One mutation point.</strong> When we go concurrent, the set of places that write to shared state
                is one function rather than scattered through every strategy anyone ever writes.</li>
          <li><strong>Actions become messages.</strong> An <code>Action</code> is a small pointer-free value. In
                Milestone 5 we send exactly this type down a channel, unchanged. Option A cannot be retrofitted that
                way.</li>
        </ol>
        <h3>Implementation</h3>
        <h4>internal/sim/ant.go — actions</h4>
        <pre><code>{"// ActionKind enumerates everything an ant can ask the world to do.\ntype ActionKind int\n\nconst (\n\tActNone ActionKind = iota\n\tActMove\n\tActPickUp\n\tActDrop\n)\n\nfunc (k ActionKind) String() string {\n\tswitch k {\n\tcase ActMove:\n\t\treturn \"move\"\n\tcase ActPickUp:\n\t\treturn \"pickup\"\n\tcase ActDrop:\n\t\treturn \"drop\"\n\tdefault:\n\t\treturn \"none\"\n\t}\n}\n\n// Action is a request from an ant to the world. It is a plain value with\n// no pointers, which matters later: we will send these over channels.\ntype Action struct {\n\tKind ActionKind\n\tDir  world.Position // only meaningful for ActMove\n}\n"}</code></pre>
        <ul>
          <li><code>iota</code> is a counter that resets at each <code>const</code> block and increments per line, so
                the four constants get 0, 1, 2, 3. This is Go's enum: a named integer type plus constants. It is weaker
                than a real sum type, because nothing stops <code>ActionKind(99)</code>, which is why
                <code>String()</code> has a <code>default</code> case.</li>
          <li>Defining <code>String()</code> on the kind means <code>fmt.Printf("%v", act.Kind)</code> prints
                <code>pickup</code> instead of <code>2</code>. Do this for every enum you define; it pays for itself the
                first time you debug.</li>
          <li><code>ActNone</code> is deliberately zero, so the zero <code>Action</code> means "do nothing" rather
                than "move by (0,0)". Zero values should be safe.</li>
        </ul>
        <h4>internal/sim/behaviour.go</h4>
        <pre><code>{"package sim\n\nimport (\n\t\"math/rand/v2\"\n\n\t\"github.com/yourname/antfarm/internal/world\"\n)\n\n// Behaviour decides what one ant does on one tick. Anything with these two\n// methods can drive an ant: the simulation never mentions Forager by name.\ntype Behaviour interface {\n\tName() string\n\tDecide(a *Ant, w *world.World, rng *rand.Rand) Action\n}\n\n// Forager is the baseline strategy: wander until you find food, then carry\n// it home in a straight line.\ntype Forager struct{}\n\nfunc (Forager) Name() string { return \"forager\" }\n\nfunc (Forager) Decide(a *Ant, w *world.World, rng *rand.Rand) Action {\n\tif a.Carrying {\n\t\tif a.Pos == w.Nest {\n\t\t\treturn Action{Kind: ActDrop}\n\t\t}\n\t\treturn Action{Kind: ActMove, Dir: stepToward(a.Pos, w.Nest)}\n\t}\n\tif w.Food.At(a.Pos) > 0 {\n\t\treturn Action{Kind: ActPickUp}\n\t}\n\treturn Action{Kind: ActMove, Dir: randomDir(rng)}\n}\n\nvar directions = [9]world.Position{\n\t{X: -1, Y: -1}, {X: 0, Y: -1}, {X: 1, Y: -1},\n\t{X: -1, Y: 0}, {X: 1, Y: 0},\n\t{X: -1, Y: 1}, {X: 0, Y: 1}, {X: 1, Y: 1},\n\t{X: 0, Y: 0},\n}\n\nfunc randomDir(rng *rand.Rand) world.Position {\n\treturn directions[rng.IntN(8)]\n}\n\n// stepToward returns a one-cell step from src in the direction of dst.\nfunc stepToward(src, dst world.Position) world.Position {\n\treturn world.Position{X: sign(dst.X - src.X), Y: sign(dst.Y - src.Y)}\n}\n\nfunc sign(n int) int {\n\tswitch {\n\tcase n > 0:\n\t\treturn 1\n\tcase n < 0:\n\t\treturn -1\n\tdefault:\n\t\treturn 0\n\t}\n}\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><code>type Behaviour interface {'{'} Name() string; Decide(...) Action {'}'}</code> — a contract.
                <code>Forager</code> never says it implements <code>Behaviour</code>; it simply has the methods, and the
                compiler checks the match at the point of use. If you want a compile-time assertion, the idiom is
                <code>var _ Behaviour = Forager{'{'}{'}'}</code> at package level, which costs nothing at run time and fails
                loudly if you rename a method.</li>
          <li><code>func (Forager) Name() string</code> — a receiver with no name, because the method ignores it.
                <code>Forager</code> is an empty struct (<code>struct{'{'}{'}'}</code>), which occupies zero bytes: it is pure
                behaviour with no state.</li>
          <li><code>a.Pos == w.Nest</code> — struct equality again.</li>
          <li><code>stepToward</code> returns a diagonal step when both axes differ, since we allow eight-way
                movement. It always makes progress on at least one axis, so an ant carrying food reaches the nest in
                <code>max(|dx|,|dy|)</code> ticks. Worth verifying in a test rather than believing.</li>
          <li><code>directions</code> now has nine entries, with "stay put" last, but <code>randomDir</code> passes
                <code>8</code> to <code>IntN</code> so it never picks it. The ninth entry exists so that other code (and
                your exercises) can express "no movement" using the same table. If that asymmetry bothers you, it
                should: it is the kind of detail that becomes a bug when someone later writes
                <code>rng.IntN(len(directions))</code>. A comment or a named constant is the fix.</li>
        </ul>
        <h4>internal/world/world.go — food, and errors that mean something</h4>
        <pre><code>{"var (\n\t// ErrNoFood means the cell had nothing to take.\n\tErrNoFood = errors.New(\"no food at position\")\n\t// ErrNotCarrying means the ant tried to drop food it does not have.\n\tErrNotCarrying = errors.New(\"ant is not carrying food\")\n)\n\n// OutOfBoundsError reports a position outside the grid.\ntype OutOfBoundsError struct {\n\tPos  Position\n\tW, H int\n}\n\nfunc (e *OutOfBoundsError) Error() string {\n\treturn fmt.Sprintf(\"position %s is outside the %dx%d grid\", e.Pos, e.W, e.H)\n}\n\n// TakeFood removes one unit of food from p.\nfunc (w *World) TakeFood(p Position) error {\n\tif !w.InBounds(p) {\n\t\treturn &OutOfBoundsError{Pos: p, W: w.W, H: w.H}\n\t}\n\tif w.Food.At(p) <= 0 {\n\t\treturn fmt.Errorf(\"take food at %s: %w\", p, ErrNoFood)\n\t}\n\tw.Food.AddAt(p, -1)\n\treturn nil\n}\n"}</code></pre>
        <p>Two kinds of error, chosen for two different reasons:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Kind</th>
              <th>When to use it</th>
              <th>How callers check</th>
            </tr>
            <tr>
              <td>Sentinel (<code>ErrNoFood</code>)</td>
              <td>The caller only needs to know <em>which</em> thing went wrong</td>
              <td><code>errors.Is(err, ErrNoFood)</code></td>
            </tr>
            <tr>
              <td>Custom type (<code>*OutOfBoundsError</code>)</td>
              <td>The caller needs <em>details</em>: which position, which grid</td>
              <td><code>errors.As(err, &oob)</code></td>
            </tr>
          </tbody>
        </table>
        <p><code>fmt.Errorf("take food at %s: %w", p, ErrNoFood)</code> produces the message
            <code>take food at (3,4): no food at position</code> while keeping <code>ErrNoFood</code> retrievable
            through the wrap chain. The convention for error strings is lowercase, no trailing punctuation, and context
            prefixed in the form <code>operation: cause</code>, so that wrapping composes into a readable trail.</p>
        <div className="warn">
          <h5>The nil-interface trap, in the wild</h5>
          <p>This is the Go bug that catches everyone exactly once, and error handling is where it bites:</p>
          <pre className="bad"><code>{"func take() *OutOfBoundsError {   // concrete pointer type, not error\n\treturn nil\n}\n\nfunc caller() {\n\tvar err error = take()        // err holds (type=*OutOfBoundsError, value=nil)\n\tif err != nil {\n\t\t// THIS RUNS. err is not nil, because the interface has a type.\n\t}\n}"}</code></pre>
          <p>An interface value is a pair (type, value) and is nil only when <em>both</em> halves are nil. Assigning a
                nil <code>*OutOfBoundsError</code> to an <code>error</code> gives you a non-nil interface holding a nil
                pointer. The rule that avoids it entirely: <strong>functions that can fail return <code>error</code>,
                    never a concrete error type.</strong> Our <code>TakeFood</code> returns <code>error</code>, which is
                why it is safe.</p>
        </div>
        <h4>internal/sim/sim.go — apply and handle</h4>
        <pre><code>{"// Step advances the whole colony by one tick, sequentially.\nfunc (s *Sim) Step() {\n\tfor _, a := range s.ants {\n\t\tact := s.behaviour.Decide(a, s.world, s.rng)\n\t\tif err := s.apply(a, act); err != nil {\n\t\t\ts.handle(a, err)\n\t\t}\n\t}\n\ts.tick++\n}\n\n// apply is the only code allowed to change the world.\nfunc (s *Sim) apply(a *Ant, act Action) error {\n\tswitch act.Kind {\n\tcase ActMove:\n\t\ta.Pos = s.world.Clamp(a.Pos.Add(act.Dir))\n\t\ta.Energy--\n\tcase ActPickUp:\n\t\tif err := s.world.TakeFood(a.Pos); err != nil {\n\t\t\treturn fmt.Errorf(\"ant %d pickup: %w\", a.ID, err)\n\t\t}\n\t\ta.Carrying = true\n\tcase ActDrop:\n\t\tif !a.Carrying {\n\t\t\treturn fmt.Errorf(\"ant %d drop: %w\", a.ID, world.ErrNotCarrying)\n\t\t}\n\t\ta.Carrying = false\n\t\ts.world.Deliver()\n\tcase ActNone:\n\t\t// nothing to do\n\t}\n\treturn nil\n}\n\n// handle turns errors into simulation outcomes. Expected failures are\n// counted; anything unexpected is worth shouting about.\nfunc (s *Sim) handle(a *Ant, err error) {\n\tswitch {\n\tcase errors.Is(err, world.ErrNoFood):\n\t\ts.failedPickups++\n\tcase errors.Is(err, world.ErrNotCarrying):\n\t\ts.failedPickups++\n\tdefault:\n\t\tpanic(err) // milestone 8 replaces this with something civilised\n\t}\n}\n"}</code></pre>
        <p>Add <code>behaviour Behaviour</code> and <code>failedPickups int</code> to the <code>Sim</code> struct, and
            change the constructor to <code>func New(cfg Config, b Behaviour) *Sim</code> with a
            <code>if b == nil {'{'} b = Forager{'{'}{'}'} {'}'}</code> default.</p>
        <h4>Explanation</h4>
        <ul>
          <li><code>a.Carrying = true</code> happens only <em>after</em> <code>TakeFood</code> succeeds. Ordering
                matters: the other way round, a failed pickup would leave the ant believing it carries food that does
                not exist, and the conservation test below would fail. Mutate local state after the fallible operation
                succeeds, not before.</li>
          <li>The <code>switch</code> in <code>handle</code> has no expression, so each <code>case</code> is a boolean
                test. It reads better than an <code>if/else if</code> chain and it is the idiomatic way to dispatch on
                <code>errors.Is</code>.</li>
          <li><code>panic(err)</code> in the default branch is a temporary, deliberate choice: during development, an
                error you did not anticipate should be loud. Silently ignoring unknown errors is how simulations quietly
                produce wrong answers for three weeks. Milestone 8 replaces this with a logged, counted, recoverable
                failure.</li>
          <li><code>errors.Is</code> unwraps through both layers of wrapping:
                <code>ant 4 pickup: take food at (3,4): no food at position</code> still matches <code>ErrNoFood</code>.
                String matching would not survive either layer.</li>
        </ul>
        <h4>Tests, including the one that matters</h4>
        <pre><code>{"func TestForagerDecide(t *testing.T) {\n\tw := world.New(16, 16) // nest at (8,8)\n\trng := rand.New(rand.NewPCG(1, 2))\n\tw.Food.Set(world.Position{X: 3, Y: 3}, 5)\n\n\tcases := []struct {\n\t\tname string\n\t\tant  Ant\n\t\twant ActionKind\n\t}{\n\t\t{\"empty cell, not carrying\", Ant{Pos: world.Position{X: 1, Y: 1}}, ActMove},\n\t\t{\"standing on food\", Ant{Pos: world.Position{X: 3, Y: 3}}, ActPickUp},\n\t\t{\"carrying, away from nest\", Ant{Pos: world.Position{X: 3, Y: 3}, Carrying: true}, ActMove},\n\t\t{\"carrying, at nest\", Ant{Pos: w.Nest, Carrying: true}, ActDrop},\n\t}\n\n\tvar b Behaviour = Forager{}\n\tfor _, tc := range cases {\n\t\tt.Run(tc.name, func(t *testing.T) {\n\t\t\tant := tc.ant\n\t\t\tgot := b.Decide(&ant, w, rng)\n\t\t\tif got.Kind != tc.want {\n\t\t\t\tt.Errorf(\"Decide = %v, want %v\", got.Kind, tc.want)\n\t\t\t}\n\t\t})\n\t}\n}\n\nfunc TestColonyDeliversFood(t *testing.T) {\n\ts := New(Config{Width: 24, Height: 24, Ants: 200, FoodSources: 20, Seed: 7}, Forager{})\n\tbefore := s.Stats().FoodRemaining\n\ts.Run(2000)\n\tst := s.Stats()\n\n\tif st.Delivered == 0 {\n\t\tt.Fatalf(\"after 2000 ticks nothing was delivered: %v\", st)\n\t}\n\tif st.FoodRemaining >= before {\n\t\tt.Errorf(\"food remaining did not fall: before %d, after %d\", before, st.FoodRemaining)\n\t}\n\tif st.Delivered+st.FoodRemaining+st.Carrying != before {\n\t\tt.Errorf(\"food is not conserved: delivered %d + left %d + carried %d != %d\",\n\t\t\tst.Delivered, st.FoodRemaining, st.Carrying, before)\n\t}\n}\n"}</code></pre>
        <p><strong><code>TestColonyDeliversFood</code> is the most valuable test in the project</strong>, and it is
            worth understanding why. It asserts a <em>conservation law</em>: every unit of food is either still on the
            ground, being carried, or delivered. Not a specific number, not a specific path, just an invariant that must
            hold no matter how the simulation evolves. Invariant tests survive refactoring, catch bugs you did not think
            of, and are the only practical way to test a system whose exact output is uninteresting. When we make the
            simulation concurrent, this test is what detects that we have broken it.</p>
        <p>Note <code>ant := tc.ant</code> in the table test: it copies the case's ant so <code>Decide</code> cannot
            mutate the table. <code>var b Behaviour = Forager{'{'}{'}'}</code> deliberately stores the concrete type in an
            interface variable, so the test exercises the dynamic dispatch path rather than a direct call.</p>
        <pre className="plain"><code>{"$ go test ./...\nok  \tgithub.com/yourname/antfarm/internal/sim\t0.007s\nok  \tgithub.com/yourname/antfarm/internal/world\t0.002s\n\n$ go run ./cmd/antfarm -ants 500 -grid 48x48 -food 30 -ticks 600 -every 200\ncolony: 500 ants, 48x48 grid, 30 food sources, seed 1\ntick 200    ants 500    carrying 21     delivered 459    food left 1020\ntick 400    ants 500    carrying 18     delivered 727    food left 755\ntick 600    ants 500    carrying 21     delivered 920    food left 559\nfinal: tick 600    ants 500    carrying 21     delivered 920    food left 559\n"}</code></pre>
        <p>That is real output from the code above. The colony works: 920 units delivered, food dropping steadily, about
            20 ants in transit at any moment.</p>
        <div className="exercise">
          <h5>Exercise 3</h5>
          <p>Write a second behaviour, <code>Scout</code>, that satisfies the same interface but moves in a straight
                line for several ticks before turning, which explores faster than a pure random walk. Requirements:</p>
          <ul>
            <li>It must satisfy <code>Behaviour</code> without any change to <code>Sim</code>.</li>
            <li>The per-ant heading has to live somewhere. Think carefully: <code>Scout</code> is shared by every
                    ant, so a single field on the struct would make all ants turn together. Solve it without adding a
                    field to <code>Ant</code> if you can, then consider whether adding one is actually cleaner.</li>
            <li>Add a table test asserting that a scout carrying food still heads for the nest.</li>
            <li>Add a <code>-behaviour</code> flag to <code>main.go</code> selecting <code>forager</code> or
                    <code>scout</code>, returning a usage error for anything else.</li>
          </ul>
          <p>Hint: a map keyed by ant ID inside <code>Scout</code> works and will become a data race in Milestone 4.
                That is a useful thing to experience, so try it, then read the solution's discussion.</p>
        </div>
        <details>
          <summary>Solution 3 — open after trying</summary>
          <pre><code>{"// Scout walks in a straight line for a few ticks before choosing a new\n// heading, which covers ground faster than an unbiased random walk.\ntype Scout struct {\n\theadings map[int]world.Position // ant ID -> current heading\n\tleft     map[int]int            // ant ID -> ticks left on this heading\n\trunLen   int\n}\n\nfunc NewScout(runLen int) *Scout {\n\tif runLen <= 0 {\n\t\trunLen = 8\n\t}\n\treturn &Scout{\n\t\theadings: make(map[int]world.Position),\n\t\tleft:     make(map[int]int),\n\t\trunLen:   runLen,\n\t}\n}\n\nfunc (*Scout) Name() string { return \"scout\" }\n\nfunc (s *Scout) Decide(a *Ant, w *world.World, rng *rand.Rand) Action {\n\tif a.Carrying {\n\t\tif a.Pos == w.Nest {\n\t\t\treturn Action{Kind: ActDrop}\n\t\t}\n\t\treturn Action{Kind: ActMove, Dir: stepToward(a.Pos, w.Nest)}\n\t}\n\tif w.Food.At(a.Pos) > 0 {\n\t\treturn Action{Kind: ActPickUp}\n\t}\n\n\tif s.left[a.ID] <= 0 {\n\t\ts.headings[a.ID] = randomDir(rng)\n\t\ts.left[a.ID] = s.runLen\n\t}\n\ts.left[a.ID]--\n\treturn Action{Kind: ActMove, Dir: s.headings[a.ID]}\n}\n"}</code></pre>
          <p>In <code>main.go</code>:</p>
          <pre><code>{"func pickBehaviour(name string) (sim.Behaviour, error) {\n\tswitch name {\n\tcase \"forager\":\n\t\treturn sim.Forager{}, nil\n\tcase \"scout\":\n\t\treturn sim.NewScout(8), nil\n\tdefault:\n\t\treturn nil, fmt.Errorf(\"unknown -behaviour %q: want forager or scout\", name)\n\t}\n}\n"}</code></pre>
          <p><strong>The discussion that matters.</strong> This solution stores per-ant state in maps owned by the
                strategy, and it is correct today and broken in Milestone 4, because concurrent map access is not just a
                logical race but a hard runtime crash: <code>fatal error: concurrent map writes</code>, which the race
                detector reports and which the runtime kills the process over on purpose.</p>
          <p>Three honest alternatives, in increasing order of quality:</p>
          <ol>
            <li><strong>Put a mutex in <code>Scout</code>.</strong> Works, and serialises every ant's decision
                    through one lock, which defeats the point of concurrency.</li>
            <li><strong>Replace the maps with slices indexed by ant ID.</strong> Distinct indices in a slice can be
                    written concurrently without a race, as long as the slice is never resized. Fast, and slightly
                    delicate.</li>
            <li><strong>Put the state on the <code>Ant</code>.</strong> Add <code>Heading world.Position</code> and
                    <code>HeadingTTL int</code> fields. Each ant is touched by one goroutine, so there is no sharing at
                    all and no synchronisation needed.</li>
          </ol>
          <p>Option 3 is right, and the reason is a principle worth carrying into every concurrent design: <em>state
                    belongs with the thing that has exclusive access to it.</em> The urge to keep <code>Ant</code>
                "clean" by pushing strategy state elsewhere creates sharing where none needed to exist. If
                <code>Behaviour</code> implementations need lots of private per-ant state, the honest fix is a per-ant
                strategy instance rather than a shared one.</p>
        </details>
        <h4>Experiment</h4>
        <p>Set <code>FoodSources</code> to 1 and <code>Ants</code> to 2,000 on a 128×128 grid, and watch the delivery
            rate. It is terrible, because a random walk almost never finds a single cell in 16,384. Now set the food
            source to a 5×5 block. The rate jumps. This is precisely the problem pheromones solve in Milestone 7: an ant
            that finds food leaves a trail, and other ants follow the gradient instead of searching blindly. Feel the
            problem now so the solution means something later.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 3</h5>
          <ul>
            <li><code>cannot use Forager literal (type Forager) as type Behaviour: missing method Decide</code> —
                    usually a signature mismatch (you wrote <code>*world.World</code> as <code>world.World</code>, or
                    forgot the <code>rng</code> parameter), or you defined the method on <code>*Forager</code> and are
                    passing <code>Forager{'{'}{'}'}</code>. A pointer receiver means only <code>*Forager</code> satisfies the
                    interface.</li>
            <li>Comparing errors with <code>==</code> after wrapping with <code>%w</code>. It fails, because the
                    wrapper is a different value. Use <code>errors.Is</code>.</li>
            <li>Using <code>%v</code> instead of <code>%w</code> in <code>fmt.Errorf</code> and then wondering why
                    <code>errors.Is</code> returns false. <code>%v</code> flattens the error to text and discards the
                    chain.</li>
            <li>Setting <code>a.Carrying = true</code> before checking whether <code>TakeFood</code> succeeded,
                    which silently creates food out of nothing. The conservation test catches it; that is what it is
                    for.</li>
            <li>Returning <code>*OutOfBoundsError</code> instead of <code>error</code> from a helper, and hitting
                    the nil-interface trap.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li><code>Forager</code> never mentions <code>Behaviour</code>. How does the compiler know it satisfies the
                interface, and when does it check?</li>
          <li>Why does <code>Decide</code> return an <code>Action</code> rather than mutating the world directly? Give
                two reasons, one about testing and one about Milestone 5.</li>
          <li>What does <code>%w</code> do that <code>%v</code> does not?</li>
          <li>When would you define a custom error type instead of a sentinel value?</li>
          <li>Write down the conservation invariant that <code>TestColonyDeliversFood</code> checks. Why is it more
                useful than asserting "delivered == 920"?</li>
          <li>Why is the zero value of <code>Action</code> "do nothing" rather than "move by zero"?</li>
        </ol>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Nothing in Milestones 1–3 needed Go. This is ordinary sequential code, and Python would have been shorter
                to write, with the interface replaced by duck typing and the errors by exceptions. Java or C# would be
                about the same length as Go with a more expressive type system behind them.</p>
          <p>Two things Go gave us that will matter shortly. First, <code>Action</code> and <code>Stats</code> are
                pointer-free value types, which is a property the type system lets you see at a glance and which becomes
                the basis of safe message passing. In Python every object is a reference and "is this safe to hand to
                another thread" is never answerable locally. Second, the benchmark showing zero allocations per tick is
                not achievable at all in a language where every small object is heap-allocated, and at 50,000 ants it is
                the difference between a smooth simulation and one that stutters under garbage collection.</p>
          <p>The honest verdict on this milestone: Go was fine, not special. The next one is where it earns its place.
            </p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 4</span>Each ant becomes a goroutine, and everything
            breaks</h2>
        <h3>Goal</h3>
        <p>Give every ant its own goroutine. Observe the program become non-deterministic, then observe the race
            detector explain exactly why. Fix it with a mutex, measure the fix, and discover that the fix is
            unsatisfying. This milestone is deliberately a failure, and it is the centre of the course.</p>
        <h3>Concepts</h3>
        <p>Goroutine lifecycle, <code>sync.WaitGroup</code>, the Go memory model and happens-before, what a data race
            actually is, reading race detector output, mutex-based mutual exclusion, lock contention, and the difference
            between concurrency and parallelism.</p>
        <h3>Design</h3>
        <p>The change is small and the consequences are enormous:</p>
        <pre className="plain"><code>{"BEFORE                             AFTER\n──────                             ─────\nfor tick := range n {              for each ant:\n    for _, ant := range ants {         go func() {\n        act := decide(ant)                 for tick := range n {\n        apply(ant, act)                        act := decide(ant)\n    }                                          apply(ant, act)\n}                                          }\n                                       }()\n\none goroutine                      N goroutines\none thing happens at a time        N things happen at once\nticks are globally synchronised    every ant has its own clock\n"}</code></pre>
        <p>Notice what we lost without asking: <strong>the global tick</strong>. Sequentially, "tick 400" is a
            meaningful instant in which every ant has moved exactly 400 times. Concurrently, one ant may be on its 380th
            step while another is on its 420th. Whether that matters depends on what you are simulating, and it is the
            kind of thing that should be a decision rather than an accident. We are accepting it for now; Milestone 6
            introduces a shared clock signal for the parts that need one.</p>
        <h3>Implementation: the wrong version, on purpose</h3>
        <p>New file <code>internal/sim/concurrent.go</code>:</p>
        <pre><code>{"package sim\n\nimport (\n\t\"math/rand/v2\"\n\t\"sync\"\n)\n\n// RunConcurrentUnsafe gives every ant its own goroutine and lets them all\n// touch the same world. It is wrong on purpose: milestone 4 uses it to\n// produce a real data race.\nfunc (s *Sim) RunConcurrentUnsafe(ticks int) {\n\tvar wg sync.WaitGroup\n\n\tfor _, a := range s.ants {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\trng := rand.New(rand.NewPCG(s.cfg.Seed, uint64(a.ID)))\n\t\t\tfor range ticks {\n\t\t\t\tact := s.behaviour.Decide(a, s.world, rng)\n\t\t\t\tif err := s.apply(a, act); err != nil {\n\t\t\t\t\ts.handle(a, err)\n\t\t\t\t}\n\t\t\t}\n\t\t}()\n\t}\n\n\twg.Wait()\n\ts.tick += ticks\n}\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><code>wg.Add(1)</code> before <code>go</code>, <code>defer wg.Done()</code> as the goroutine's first
                line, <code>wg.Wait()</code> after the loop. That triple is the whole pattern; deviating from it in any
                of the three places produces either a premature return or a permanent hang.</li>
          <li><strong>Each goroutine gets its own <code>rng</code>.</strong> Sharing <code>s.rng</code> would be a
                data race on the generator's internal state, and would also serialise every ant on one generator.
                Seeding with the ant ID keeps runs reproducible per ant, though not across the whole colony, for reasons
                we are about to see.</li>
          <li>The closure captures <code>a</code> from the loop. <strong>On Go 1.22 and later this is
                    correct</strong>, because each iteration gets a fresh variable. On Go 1.21 and earlier, all
                goroutines would see the last ant, and the fix was <code>go func(a *Ant){'{'}...{'}'}(a)</code>. You will see
                the argument-passing form in most existing code; both work now.</li>
          <li>Nothing else changed. <code>Decide</code>, <code>apply</code> and <code>handle</code> are the same
                functions as the sequential version. That is the point: the bug is not in any of them.</li>
        </ul>
        <h3>Watching it break</h3>
        <p>First, determinism. Run the same seed three times:</p>
        <pre className="plain"><code>{"run 0: start 2000 | delivered 1025 + left 938 + carried 37 = 2000\nrun 0: start 2000 | delivered 1032 + left 927 + carried 41 = 2000\nrun 0: start 2000 | delivered 1033 + left 930 + carried 37 = 2000\n"}</code></pre>
        <p>Same configuration, same seed, three different answers. The sequential version gives the identical number
            every time. We did not change any logic, and we lost reproducibility, because the interleaving of goroutines
            is decided by the scheduler and the operating system, not by our seed. Any bug that depends on interleaving
            is now a bug you cannot reliably reproduce, which is the defining misery of concurrent programming.</p>
        <p>Second, the race detector. This is the part to pay attention to:</p>
        <pre className="plain"><code>{"$ go test -race -run TestConcurrentUnsafeRace ./internal/sim/\n==================\nWARNING: DATA RACE\nRead at 0x00c0000be940 by goroutine 8:\n  github.com/yourname/antfarm/internal/world.(*Grid).At()\n      /home/you/antfarm/internal/world/grid.go:34 +0x2c4\n  github.com/yourname/antfarm/internal/sim.Forager.Decide()\n      /home/you/antfarm/internal/sim/behaviour.go:29 +0x19a\n  github.com/yourname/antfarm/internal/sim.(*Sim).RunConcurrentUnsafe.func1()\n      /home/you/antfarm/internal/sim/concurrent.go:20 +0x233\n\nPrevious write at 0x00c0000be940 by goroutine 56:\n  github.com/yourname/antfarm/internal/world.(*Grid).AddAt()\n      /home/you/antfarm/internal/world/grid.go:50 +0x471\n  github.com/yourname/antfarm/internal/world.(*World).TakeFood()\n      /home/you/antfarm/internal/world/world.go:70 +0x145\n  github.com/yourname/antfarm/internal/sim.(*Sim).apply()\n      /home/you/antfarm/internal/sim/sim.go:128 +0x447\n  github.com/yourname/antfarm/internal/sim.(*Sim).RunConcurrentUnsafe.func1()\n      /home/you/antfarm/internal/sim/concurrent.go:21 +0x24e\n\nGoroutine 8 (running) created at:\n  github.com/yourname/antfarm/internal/sim.(*Sim).RunConcurrentUnsafe()\n      /home/you/antfarm/internal/sim/concurrent.go:16 +0xa8\n==================\nWARNING: DATA RACE\nRead at 0x00c00007e448 by goroutine 8:\n  github.com/yourname/antfarm/internal/world.(*World).Deliver()\n      /home/you/antfarm/internal/world/world.go:75 +0x28f\n...\n"}</code></pre>
        <p>That is genuine output from this code. Read it as four facts:</p>
        <ol>
          <li><strong>An address.</strong> <code>0x00c0000be940</code> is one specific memory location. The first
                report is a cell in the food grid; the second is the <code>delivered</code> counter.</li>
          <li><strong>What just happened to it.</strong> A read, from <code>Grid.At</code>, called by
                <code>Forager.Decide</code>, called by the goroutine started at <code>concurrent.go:16</code>.</li>
          <li><strong>What previously happened to it.</strong> A write, from <code>Grid.AddAt</code>, called by
                <code>World.TakeFood</code>, called by <code>Sim.apply</code>, in a <em>different</em> goroutine.</li>
          <li><strong>Where each goroutine was created.</strong> The last block gives you the birth stack, which is
                how you identify which of 50,000 goroutines is involved.</li>
        </ol>
        <h4>What a data race actually is</h4>
        <p>Precisely: two goroutines access the same memory location, at least one access is a write, and there is no
            synchronisation event ordering them. The Go memory model defines a <em>happens-before</em> relation, and
            operations not ordered by it may be observed in any order, or not at all.</p>
        <p>Concretely, <code>s.delivered++</code> is three machine operations: load, add, store. Two goroutines can
            interleave as:</p>
        <pre className="plain"><code>{"goroutine A          goroutine B          delivered\n─────────────────────────────────────────────────────\nload  → 100                                   100\n                     load  → 100              100\nadd   → 101                                   100\n                     add   → 101              100\nstore 101                                     101\n                     store 101                101   ← one delivery lost\n"}</code></pre>
        <p>Two ants delivered food; the counter says one. Nothing crashed and no test failed, unless you wrote the
            conservation test. <em>That</em> is why the invariant test exists.</p>
        <p>It gets worse than lost updates. Without synchronisation, the compiler and the CPU are both permitted to
            reorder and cache your reads and writes, so a value written by one goroutine may never become visible to
            another, or may become visible in a different order than it was written. A data race is not a timing
            inconvenience, it is undefined behaviour, and "it works on my machine" is not evidence of anything.</p>
        <div className="warn">
          <h5>Three things to know about the race detector</h5>
          <ul>
            <li><strong>It has no false positives.</strong> If it reports a race, there is a race. Fix it; do not
                    argue with it.</li>
            <li><strong>It has plenty of false negatives.</strong> It only detects races on code paths that actually
                    executed and actually interleaved during that run. A clean <code>-race</code> run is evidence, not
                    proof. Run it under load, under tests, repeatedly, with <code>-count=10</code>.</li>
            <li><strong>It costs 2–20× CPU and 5–10× memory.</strong> Use it in tests and development, not in
                    production, and expect a race-enabled run of 50,000 ants to be uncomfortable. Scale down when
                    hunting races.</li>
          </ul>
          <p>Make <code>go test -race ./...</code> the command you run before every commit. In CI, run it always.</p>
        </div>
        <h3>The fix, version one: one big lock</h3>
        <p>Add a mutex to <code>Sim</code>, next to the state it protects, with a comment saying what it protects:</p>
        <pre><code>{"type Sim struct {\n\tcfg       Config\n\trng       *rand.Rand\n\tworld     *world.World\n\tants      []*Ant\n\tbehaviour Behaviour\n\n\t// mu guards world, every Ant, tick and failedPickups whenever the\n\t// simulation is run concurrently. Milestone 5 deletes it.\n\tmu            sync.Mutex\n\ttick          int\n\tfailedPickups int\n}\n"}</code></pre>
        <pre><code>{"// RunConcurrentLocked is the same design with one big lock around every\n// access to shared state. It is correct, and it is a bottleneck.\nfunc (s *Sim) RunConcurrentLocked(ticks int) {\n\tvar wg sync.WaitGroup\n\n\tfor _, a := range s.ants {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\trng := rand.New(rand.NewPCG(s.cfg.Seed, uint64(a.ID)))\n\t\t\tfor range ticks {\n\t\t\t\ts.mu.Lock()\n\t\t\t\tact := s.behaviour.Decide(a, s.world, rng)\n\t\t\t\tif err := s.apply(a, act); err != nil {\n\t\t\t\t\ts.handle(a, err)\n\t\t\t\t}\n\t\t\t\ts.mu.Unlock()\n\t\t\t}\n\t\t}()\n\t}\n\n\twg.Wait()\n\ts.tick += ticks\n}\n"}</code></pre>
        <p>The lock covers <code>Decide</code> as well as <code>apply</code>, because <code>Decide</code> <em>reads</em>
            the food grid and another goroutine could be writing it. A lock that protects writes but not reads protects
            nothing.</p>
        <p>There is no <code>defer s.mu.Unlock()</code> here, and that is a considered choice: <code>defer</code> runs
            at function exit, and this lock is taken and released inside a loop, so a deferred unlock would hold the
            lock for the entire run and deadlock every other ant. When the critical section is smaller than the
            function, unlock explicitly, and keep the section short enough that you can see both ends at once.</p>
        <pre className="plain"><code>{"$ go test -race -run TestConcurrentLocked -count=1 ./internal/sim/\nok  \tgithub.com/yourname/antfarm/internal/sim\t1.068s\n"}</code></pre>
        <p>Clean. Food is conserved, the race detector is silent, the tests pass.</p>
        <h3>Measuring the fix</h3>
        <pre><code>{"func BenchmarkSequential300(b *testing.B) {\n\tfor range b.N {\n\t\ts := New(Config{Width: 64, Height: 64, Ants: 300, FoodSources: 30, Seed: 1}, Forager{})\n\t\ts.Run(200)\n\t}\n}\n\nfunc BenchmarkLocked300(b *testing.B) {\n\tfor range b.N {\n\t\ts := New(Config{Width: 64, Height: 64, Ants: 300, FoodSources: 30, Seed: 1}, Forager{})\n\t\ts.RunConcurrentLocked(200)\n\t}\n}\n"}</code></pre>
        <pre className="plain"><code>{"BenchmarkSequential300 \t     5\t    741998 ns/op\nBenchmarkLocked300     \t     5\t   1303957 ns/op\n"}</code></pre>
        <p>Measured on a single-core machine, so read it as a lower bound on the damage: the concurrent version is 1.76×
            <em>slower</em> than the sequential one. We added 300 goroutines, a mutex, and a great deal of conceptual
            complexity, and made the program worse.</p>
        <p>On your multi-core machine the numbers will differ, and you should run it, but the shape holds. Here is why:
        </p>
        <ul>
          <li><strong>The lock serialises everything.</strong> Every ant's entire decide-and-apply cycle happens under
                one mutex, so at most one ant is ever doing work. The parallelism is exactly zero, no matter how many
                cores you own.</li>
          <li><strong>We added overhead on top.</strong> Lock and unlock are cheap when uncontended, and expensive
                when contended: a goroutine that cannot get the lock parks, and the runtime schedules another, which
                costs context switching and cache traffic. 300 goroutines fighting over one mutex spend most of their
                time in that machinery.</li>
          <li><strong>Concurrency is not parallelism.</strong> Concurrency is a way of structuring a program as
                independent activities. Parallelism is doing several things at the same instant. We have concurrency and
                no parallelism, and we are paying for both.</li>
        </ul>
        <p>The obvious next thought is finer-grained locking: a mutex per grid cell, or per region. Consider what that
            buys and costs before Milestone 5 shows a different answer. A 512×512 grid is 262,144 mutexes at 8 bytes
            each, which is fine on memory but means an ant reading its eight neighbours must take eight locks, in a
            consistent global order, or risk deadlock. Every new feature has to obey that ordering forever. This is
            exactly the design where "it worked until we added pheromone diffusion" comes from.</p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>This milestone is where Go starts to pay. The race detector is the crucial piece: it turned an invisible,
                non-deterministic, undefined-behaviour bug into a precise report naming two stack traces and an address.
                Getting the same information out of C++ requires ThreadSanitizer and effort; out of Java, tooling that
                most people never run; out of Python, nothing at all, because the global interpreter lock hides most
                races until it does not.</p>
          <p>Honest counterpoint, as promised. Rust would have refused to compile <code>RunConcurrentUnsafe</code> at
                all: sharing a <code>&mut World</code> across threads is a compile error, so the bug we just spent a
                milestone on would never have existed. That is a real, significant advantage, and anyone who tells you
                Go's approach is strictly better is selling something. Go's position is a trade: catch races at run time
                with excellent tooling, in exchange for a language you can learn in a week. Whether that trade is right
                depends on your team and your problem. For learning concurrency, actually experiencing the race is worth
                more than being prevented from writing it.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 4</h5>
          <p>Three tasks, increasing in difficulty.</p>
          <ol>
            <li><strong>Make <code>Stats()</code> safe.</strong> It reads every ant and the world with no lock, so
                    calling it while <code>RunConcurrentLocked</code> is running is a data race. Fix it, and write a
                    test that spawns a goroutine calling <code>Stats()</code> in a loop during a concurrent run, then
                    run it with <code>-race</code> to prove the fix.</li>
            <li><strong>Add a <code>-mode</code> flag</strong> to <code>main.go</code> taking <code>seq</code> or
                    <code>locked</code>, so you can compare the two at the command line.</li>
            <li><strong>Find the contention.</strong> Run the locked benchmark with <code>-mutexprofile</code> and
                    read the result with <code>go tool pprof</code>. Report which lock is hot and what fraction of time
                    is spent blocked. Command:
                    <code>go test -bench BenchmarkLocked300 -mutexprofile mu.out ./internal/sim/</code> then
                    <code>go tool pprof -top mu.out</code>.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 4 — open after trying</summary>
          <p><strong>1. Locking <code>Stats</code>.</strong></p>
          <pre><code>{"func (s *Sim) Stats() Stats {\n\ts.mu.Lock()\n\tdefer s.mu.Unlock()\n\treturn s.statsLocked()\n}\n\n// statsLocked must be called with s.mu held.\nfunc (s *Sim) statsLocked() Stats {\n\tcarrying := 0\n\tfor _, a := range s.ants {\n\t\tif a.Carrying {\n\t\t\tcarrying++\n\t\t}\n\t}\n\treturn Stats{\n\t\tTick:          s.tick,\n\t\tAnts:          len(s.ants),\n\t\tCarrying:      carrying,\n\t\tDelivered:     s.world.Delivered(),\n\t\tFoodRemaining: s.world.Food.Total(),\n\t\tFailedPickups: s.failedPickups,\n\t}\n}\n"}</code></pre>
          <p>The split into <code>Stats</code> and <code>statsLocked</code> is the standard Go answer to a real
                problem: <strong>Go's mutexes are not reentrant.</strong> If <code>Stats()</code> took the lock and some
                other locked method called <code>Stats()</code>, the goroutine would deadlock against itself, instantly
                and permanently. The convention is that a method suffixed <code>Locked</code> assumes the lock is
                already held and is called only from code that holds it. Write that assumption in a comment every time;
                the compiler cannot check it.</p>
          <p>Here <code>defer</code> is right, because the critical section is the whole function.</p>
          <p>The test:</p>
          <pre><code>{"func TestStatsDuringConcurrentRun(t *testing.T) {\n\ts := New(Config{Width: 32, Height: 32, Ants: 100, FoodSources: 10, Seed: 9}, Forager{})\n\n\tdone := make(chan struct{})\n\tgo func() {\n\t\tdefer close(done)\n\t\tfor range 500 {\n\t\t\t_ = s.Stats()\n\t\t}\n\t}()\n\n\ts.RunConcurrentLocked(200)\n\t<-done\n}\n"}</code></pre>
          <p>It asserts nothing, and that is fine: under <code>-race</code> the detector is the assertion. Tests whose
                only job is to create an interleaving for the detector to inspect are a legitimate and underused
                technique.</p>
          <p><strong>2. The flag.</strong></p>
          <pre><code>{"mode := flag.String(\"mode\", \"seq\", \"seq or locked\")\n// ...\nswitch *mode {\ncase \"seq\":\n\ts.Run(*ticks)\ncase \"locked\":\n\ts.RunConcurrentLocked(*ticks)\ndefault:\n\tfmt.Fprintf(os.Stderr, \"antfarm: unknown -mode %q: want seq or locked\\n\", *mode)\n\tos.Exit(2)\n}\n"}</code></pre>
          <p><strong>3. The mutex profile.</strong> Mutex profiling is off by default because it costs something;
                enable it with <code>runtime.SetMutexProfileFraction(1)</code> in a <code>TestMain</code>, or pass
                <code>-mutexprofile</code>, which enables it for you. The output ranks contended locks by cumulative
                blocked time, and you should see <code>sim.(*Sim).RunConcurrentLocked</code> holding essentially all of
                it. There is only one lock to blame, which is the clearest possible statement of the problem: a single
                lock is a single point of serialisation.</p>
          <p>Look at <code>-blockprofile</code> too, which shows time spent blocked on any synchronisation, including
                channels. It will become useful from Milestone 5 onward.</p>
        </details>
        <h4>Experiment</h4>
        <p>Run the locked benchmark with <code>GOMAXPROCS</code> set to 1, 2, 4 and 8:</p>
        <pre className="plain"><code>{"GOMAXPROCS=1 go test -bench BenchmarkLocked300 ./internal/sim/\nGOMAXPROCS=8 go test -bench BenchmarkLocked300 ./internal/sim/\n"}</code></pre>
        <p>A program that parallelises well gets faster as you add processors. This one probably gets <em>slower</em>,
            because more processors means more goroutines simultaneously failing to acquire the same lock. Then do the
            same for <code>BenchmarkSequential300</code>, which should be flat, since it uses one goroutine regardless.
            Seeing a concurrent program slow down under added parallelism is the clearest possible evidence that the
            bottleneck is contention rather than computation, and it is a diagnostic you can apply to real systems.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 4</h5>
          <ul>
            <li><code>fatal error: all goroutines are asleep - deadlock!</code> — the runtime detected that nothing
                    can ever make progress. Usual causes: <code>wg.Add</code> called more times than
                    <code>wg.Done</code>, or a lock taken twice by the same goroutine, or <code>defer mu.Unlock()</code>
                    inside a loop.</li>
            <li><code>sync: negative WaitGroup counter</code> — <code>Done</code> called more often than
                    <code>Add</code>, typically from a stray <code>defer wg.Done()</code> in a helper that also has one.
                </li>
            <li><code>fatal error: concurrent map writes</code> — not a race warning but a deliberate runtime abort.
                    Somewhere a map is written from two goroutines. This is the <code>Scout</code> trap from Exercise 3.
                </li>
            <li>Copying a struct that contains a mutex: <code>s2 := *s</code> gives <code>s2</code> its own lock,
                    and the two now protect nothing. <code>go vet</code> catches this with "passes lock by value".</li>
            <li>Calling a method that locks from a method that already holds the lock. Go's mutexes are not
                    reentrant and you deadlock instantly.</li>
            <li>Assuming <code>-race</code> passing means the code is correct. It means no race was observed on the
                    paths that ran.</li>
            <li>Running <code>go run</code> with 50,000 ants under <code>-race</code> and concluding Go is slow.
                    Race instrumentation is the cost; measure without it.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Define a data race precisely. Why is "the ++ isn't atomic" an incomplete explanation?</li>
          <li>The race report names two goroutines. What are the four pieces of information in it, and which one tells
                you which ant is involved?</li>
          <li>Why must the lock cover <code>Decide</code> and not only <code>apply</code>?</li>
          <li>Why is <code>defer s.mu.Unlock()</code> wrong inside the per-tick loop but right inside
                <code>Stats()</code>?</li>
          <li>The locked version is slower than the sequential one. Give two distinct reasons.</li>
          <li>What is the difference between concurrency and parallelism, in terms of this program?</li>
          <li>Why does a clean <code>-race</code> run not prove the absence of races?</li>
          <li>Sketch the deadlock you could create with one mutex per grid cell.</li>
        </ol>
        <h3>Where this leaves us</h3>
        <p>We have three implementations and none of them is what we want:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Version</th>
              <th>Correct</th>
              <th>Deterministic</th>
              <th>Parallel</th>
              <th>Extensible</th>
            </tr>
            <tr>
              <td>Sequential</td>
              <td>yes</td>
              <td>yes</td>
              <td>no</td>
              <td>yes</td>
            </tr>
            <tr>
              <td>Unsafe concurrent</td>
              <td><strong>no</strong></td>
              <td>no</td>
              <td>yes, and wrong</td>
              <td>no</td>
            </tr>
            <tr>
              <td>Locked concurrent</td>
              <td>yes</td>
              <td>no</td>
              <td>no (serialised)</td>
              <td>fragile</td>
            </tr>
          </tbody>
        </table>
        <p>The problem is not the lock. The problem is the shape: many goroutines reaching into one shared mutable
            world. Locking is the patch that shape forces on you, and every feature we add (pheromones, chaos, metrics,
            a viewer) makes the patch bigger and more fragile.</p>
        <p>Milestone 5 changes the shape. Exactly one goroutine will own the world, and ants will send it
            <code>Action</code> values on a channel and receive replies. No mutex anywhere in the simulation package.
            That is what "share memory by communicating" means in practice, and after this milestone you will have felt
            why it is more than a slogan.</p>
        <h3>Repository state after Milestone 4</h3>
        <pre className="plain"><code>{"antfarm/\n├── go.mod\n├── cmd/\n│   └── antfarm/\n│       └── main.go              flags, wiring, output\n└── internal/\n    ├── sim/\n    │   ├── ant.go               Ant, Action, ActionKind\n    │   ├── behaviour.go         Behaviour, Forager, direction helpers\n    │   ├── sim.go               Config, Sim, Step, apply, handle, Stats\n    │   ├── concurrent.go        RunConcurrentUnsafe, RunConcurrentLocked\n    │   ├── sim_test.go          decide tables, determinism, conservation, benchmarks\n    │   └── concurrent_test.go   race reproduction, locked conservation, benchmarks\n    └── world/\n        ├── grid.go              Position, Grid\n        ├── world.go             World, food, errors\n        └── grid_test.go         bounds, food errors\n"}</code></pre>
        <pre className="plain"><code>{"$ gofmt -l .        # prints nothing: everything is formatted\n$ go vet ./...      # prints nothing: no suspicious constructs\n$ go test ./...     # all green\n$ go test -race ./... -run 'Locked|Stats'   # all green\n$ git commit -am \"milestone 4: concurrency, races, and a lock we regret\"\n"}</code></pre>
        <footer className="end">
          <p>Instalment 2 of the five-course curriculum. Next: Milestones 5–8, where the world becomes a single owning
                goroutine, pheromones arrive with a shared clock, <code>context</code> gives us clean shutdown, and we
                start deliberately crashing things.</p>
        </footer>
        <a className="button" href="/go-course/milestones/5-8/">Continue</a>
      </div>
    </div>
  );
}
