import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Go Parts 0–2 — The Digital Ant Colony, Setup, and the Language",
  description: "The curriculum plan for all five courses, then the first three parts of Course 1 (Go): what we are building, install and first program, and the language crash course.",
};

export default function Page() {
  return (
    <div className="theme-go">
      <div className="wrap">
        <h2><span className="num">Course 1 · Part 0</span>Go: what are we building?</h2>
        <h3>The final result</h3>
        <p>A program called <code>antfarm</code>. At the end of the course you will be able to run:</p>
        <pre className="plain"><code>{"$ antfarm run --ants 50000 --grid 512x512 --food 400 \\\n      --chaos crash=0.001,drop=0.02,slow=0.005 \\\n      --metrics :9090 --view web:8080\n\ncolony: 50000 ants, 512x512 grid, 400 food sources\ntick 1200 | alive 49863 | carrying 8214 | food delivered 31902\n           | restarts 137 | dropped msgs 4411 | p99 decide 412µs\n"}</code></pre>
        <p>while a browser tab shows the grid with pheromone trails intensifying along routes the colony has discovered,
            a Prometheus-style metrics endpoint exposes counters, and <code>go tool pprof</code> can attach to the
            running process and tell you where the CPU is going. In the final milestone the colony runs split across
            several operating-system processes that talk over TCP, and you can kill one of them and watch the rest
            continue.</p>
        <h3>Why this project is interesting</h3>
        <p>Ant colonies are the canonical example of emergent behaviour: no ant knows where the food is, no ant is in
            charge, and yet the colony reliably finds short paths to food. The algorithm behind it is real (ant colony
            optimisation is a genuine technique for routing and scheduling problems), and it happens to be an almost
            perfect Go exercise, because the natural implementation is thousands of independent activities exchanging
            small messages.</p>
        <p>It is also a trap, in a useful way. The obvious first implementation puts the world in a shared data
            structure and lets every ant touch it. That works until you add concurrency, at which point it corrupts
            itself in ways that only appear under load. Milestone 4 walks you into that bug deliberately, and Milestone
            5 walks you out of it using the idiom Go actually recommends. That sequence is the single most valuable
            thing in this course.</p>
        <h3>Why Go in particular</h3>
        <ul>
          <li><strong>Goroutines are cheap.</strong> A goroutine starts with about 2 KB of stack that grows on
                demand, so 50,000 of them is unremarkable. 50,000 operating-system threads would be roughly 50 GB
                of reserved stack and a scheduler in agony. This is what makes "one ant, one goroutine" a reasonable
                design rather than a joke.</li>
          <li><strong>Channels make ownership explicit.</strong> Sending a value on a channel is a statement about who
                is allowed to touch it next. That turns a concurrency question into a design question you can see in the
                code.</li>
          <li><strong>The race detector is built in.</strong> <code>go test -race</code> and <code>go run -race</code>
                instrument memory accesses and report exactly which two goroutines touched the same address without
                synchronisation, with both stack traces. Very few languages hand you this for free.</li>
          <li><strong>Profiling is built in.</strong> CPU, memory, blocking and mutex-contention profiles come from
                the standard library, with a viewer in the toolchain.</li>
          <li><strong>The static binary matters at the end.</strong> When we go multi-process, deploying is copying
                one file.</li>
        </ul>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Honestly: Erlang would be better at the fault-tolerance half of this project, and you will see why in
                Course 4. Erlang gives you supervision, isolated heaps, and true preemption; in Go, a panicking
                goroutine kills the whole process unless you catch it, and a goroutine stuck in a tight loop cannot be
                cancelled by force. In Milestone 8 you will hand-build a supervisor that Erlang would have given you.
            </p>
          <p>What Go wins on is the combination: it is fast, statically typed, trivially deployable, has excellent
                profiling, and its concurrency is cheap enough for this scale while remaining familiar enough that you
                can be productive in a week. Python's <code>asyncio</code> could express the structure but would be
                roughly two orders of magnitude slower at 50,000 agents; Rust would be faster and safer but would spend
                your attention on the borrow checker instead of on concurrency design; Java's virtual threads (Project
                Loom) are now genuinely comparable and would be a fair alternative.</p>
        </div>
        <h3>What is genuinely Go-specific here</h3>
        <p>Worth separating, so you know what transfers:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Transfers to other languages</th>
              <th>Specific to Go</th>
            </tr>
            <tr>
              <td>The idea that concurrency is a design problem about ownership</td>
              <td><code>select</code> with multiple channel cases and a <code>default</code></td>
            </tr>
            <tr>
              <td>Backpressure, bounded queues, load shedding</td>
              <td>Channel closing semantics and the "close means done" convention</td>
            </tr>
            <tr>
              <td>Supervision and restart strategies</td>
              <td><code>context.Context</code> as a cancellation value threaded through call chains</td>
            </tr>
            <tr>
              <td>Profiling methodology</td>
              <td>Implicit interface satisfaction and small interfaces</td>
            </tr>
            <tr>
              <td>Chaos testing</td>
              <td><code>defer</code>/<code>recover</code>, and the culture of returning errors rather than
                        throwing</td>
            </tr>
          </tbody>
        </table>
        <h3>Architecture we are building toward</h3>
        <pre className="plain"><code>{"                          ┌──────────────────────────┐\n                          │        cmd/antfarm       │  flags, config, wiring\n                          └────────────┬─────────────┘\n                                       │\n        ┌──────────────────────────────┼──────────────────────────────┐\n        │                              │                              │\n┌───────▼────────┐            ┌────────▼─────────┐          ┌─────────▼────────┐\n│   sim engine   │            │   observability  │          │      viewer      │\n│                │            │                  │          │                  │\n│  world owner   │◄─ queries ─┤  metrics, pprof, │          │  terminal / web  │\n│   goroutine    │            │  event log       │          │   (read-only)    │\n└───┬────────┬───┘            └──────────────────┘          └─────────▲────────┘\n    │        │                                                       │\n    │        └───────────── snapshots (channel, buffered) ───────────┘\n    │\n    │  requests: Move, Sense, PickUp, Drop, Deposit\n    │  replies:  per-request reply channel\n    │\n┌───▼──────────────────────────────────────────────────────────┐\n│   ant goroutines  (N = 1..50,000)                            │\n│                                                              │\n│   ant 1 ──┐                                                  │\n│   ant 2 ──┤                                                  │\n│    ...    ├──► requests channel ──► world owner ──► replies  │\n│   ant N ──┘                                                  │\n└───┬──────────────────────────────────────────────────────────┘\n    │\n┌───▼───────────┐     ┌────────────────┐     ┌──────────────────┐\n│  supervisor   │     │  pheromone     │     │  chaos injector  │\n│  (restarts    │     │  evaporator    │     │  (crash, drop,   │\n│   dead ants)  │     │  (ticker)      │     │   delay)         │\n└───────────────┘     └────────────────┘     └──────────────────┘\n"}</code></pre>
        <p>Do not worry about understanding this yet. It is here so that when Milestone 5 introduces "the world owner
            goroutine" you can see where it fits. The important structural idea, which you will earn rather than be
            told, is that <em>exactly one goroutine owns the world state</em>, and everyone else asks it questions.</p>
        <h3>What you will know afterwards</h3>
        <p>You will be able to explain, from having done it: why a mutex-per-cell design deadlocks and a single-owner
            design does not; what the race detector actually detects and what it misses; why an unbuffered channel send
            is a synchronisation point; how to cancel 50,000 goroutines in under a millisecond; how to tell an
            allocation problem from a contention problem in a profile; and what "backpressure" means in code rather than
            in a blog post.</p>
        <hr />
        <h2><span className="num">Course 1 · Part 1</span>Install and first program</h2>
        <h3>What the Go toolchain is</h3>
        <p>Go is a compiled, statically typed language with a garbage collector. "Compiled" means a program is
            translated ahead of time into machine code for your CPU and operating system, producing a single executable
            file with no runtime to install alongside it. "Statically typed" means the type of every variable is known
            at compile time and mismatches are compile errors. "Garbage collected" means you do not free memory by hand.
        </p>
        <p>Unusually, almost everything you need is one command, <code>go</code>. There is no separate package manager
            (no npm, no pip), no separate build system (no Make required), no separate formatter, no separate test
            runner. This is deliberate and it is one of the pleasant parts of the language.</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Task</th>
              <th>Command</th>
              <th>Equivalent elsewhere</th>
            </tr>
            <tr>
              <td>run</td>
              <td><code>go run ./cmd/antfarm</code></td>
              <td><code>python main.py</code></td>
            </tr>
            <tr>
              <td>build</td>
              <td><code>go build ./...</code></td>
              <td><code>make</code>, <code>cargo build</code></td>
            </tr>
            <tr>
              <td>dependencies</td>
              <td><code>go get</code>, <code>go mod tidy</code></td>
              <td><code>pip install</code>, <code>npm install</code></td>
            </tr>
            <tr>
              <td>test</td>
              <td><code>go test ./...</code></td>
              <td><code>pytest</code>, <code>jest</code></td>
            </tr>
            <tr>
              <td>format</td>
              <td><code>gofmt -w .</code></td>
              <td><code>black</code>, <code>prettier</code></td>
            </tr>
            <tr>
              <td>lint (built in)</td>
              <td><code>go vet ./...</code></td>
              <td><code>flake8</code>, <code>eslint</code></td>
            </tr>
            <tr>
              <td>docs</td>
              <td><code>go doc fmt.Println</code></td>
              <td><code>help()</code>, <code>man</code></td>
            </tr>
            <tr>
              <td>profile</td>
              <td><code>go tool pprof</code></td>
              <td><code>cProfile</code> plus a viewer</td>
            </tr>
          </tbody>
        </table>
        <h3>Installing</h3>
        <p>You want Go 1.22 or newer for this course, because we use a few features introduced there (ranging over
            integers, and the corrected loop-variable semantics). At the time of writing the current release is in the
            1.25/1.26 range; my knowledge of releases stops in mid-2026, so check <a href="https://go.dev/dl/">go.dev/dl</a> for what is current and prefer the newest stable version.</p>
        <h5>macOS</h5>
        <pre className="plain"><code>{"# Option A: Homebrew\nbrew install go\n\n# Option B: official package\n# download the .pkg from https://go.dev/dl/ and double-click it\n\ngo version    # should print something like: go version go1.25.1 darwin/arm64\n"}</code></pre>
        <h5>Linux</h5>
        <p>Distribution packages are often a year or more out of date, so install from the tarball:</p>
        <pre className="plain"><code>{"# adjust the version and architecture to match what go.dev/dl offers\ncurl -LO https://go.dev/dl/go1.25.1.linux-amd64.tar.gz\nsudo rm -rf /usr/local/go\nsudo tar -C /usr/local -xzf go1.25.1.linux-amd64.tar.gz\n\n# add to ~/.bashrc or ~/.zshrc, then restart the shell\nexport PATH=$PATH:/usr/local/go/bin\nexport PATH=$PATH:$(go env GOPATH)/bin\n\ngo version\n"}</code></pre>
        <p>The <code>rm -rf /usr/local/go</code> matters: the official instructions require removing the old
            installation rather than untarring over it, because leftover files from a previous version cause confusing
            errors.</p>
        <h5>Windows</h5>
        <pre className="plain"><code>{":: Option A (PowerShell or cmd)\nwinget install --id GoLang.Go\n\n:: Option B: download the .msi from https://go.dev/dl/ and run it\n\ngo version\n"}</code></pre>
        <p>The installer edits <code>PATH</code> for you, but you must open a <em>new</em> terminal window afterwards
            for that to take effect. If you plan to do the Perl and Erlang courses too, consider installing WSL2
            (<code>wsl --install</code> in an administrator PowerShell) and doing everything inside Linux instead; the
            Go experience is good either way, but the other two courses are noticeably smoother on Linux.</p>
        <h5>Checking the installation</h5>
        <pre className="plain"><code>{"go version        # the compiler version\ngo env GOPATH     # where downloaded modules and installed binaries live\ngo env GOROOT     # where Go itself is installed (you rarely touch this)\n"}</code></pre>
        <p><code>GOPATH</code> defaults to <code>~/go</code> on macOS and Linux and <code>%USERPROFILE%\go</code> on
            Windows. If you read an old tutorial saying your code must live inside <code>GOPATH</code>: that has not
            been true since 2019. With modules, your code lives wherever you like, and <code>GOPATH</code> is just a
            cache plus a bin directory.</p>
        <h3>Creating the project</h3>
        <pre className="plain"><code>{"mkdir antfarm\ncd antfarm\ngo mod init github.com/yourname/antfarm\n"}</code></pre>
        <p>That last command creates a file called <code>go.mod</code>:</p>
        <pre><code>{"module github.com/yourname/antfarm\n\ngo 1.25\n"}</code></pre>
        <p>Three things to understand here.</p>
        <p><strong>A module is a unit of versioning and dependency.</strong> It is roughly "one repository". The
            <code>go.mod</code> file records the module's own name, the minimum Go version, and every dependency with
            its exact version.
        </p>
        <p><strong>The module path is an identity, not a download instruction.</strong> <code>github.com/yourname/antfarm</code> is how other code refers to your packages. It looks like a URL
            because if you ever publish it, Go will fetch it from there. You do not need a GitHub repository to use this
            name, and nothing contacts the network because of it. Use your real username if you plan to publish;
            otherwise <code>example.com/antfarm</code> is fine.
        </p>
        <p><strong>There is no lockfile step.</strong> When you add a dependency, Go writes it to <code>go.mod</code>
            and records cryptographic hashes in <code>go.sum</code>. Both are committed to git.</p>
        <h3>Directory structure</h3>
        <p>Go has no enforced project layout, but there is a strong convention that you should follow because every Go
            programmer reads it instantly:</p>
        <pre className="plain"><code>{"antfarm/\n├── go.mod                  module definition\n├── go.sum                  dependency hashes (appears when you add deps)\n├── cmd/\n│   └── antfarm/\n│       └── main.go         the executable: flags, wiring, nothing clever\n├── internal/               importable only by this module\n│   ├── sim/                the simulation engine\n│   ├── world/             the grid, food, pheromones\n│   └── metrics/\n├── pkg/                    (optional) code you intend others to import\n└── README.md\n"}</code></pre>
        <p>Two rules worth knowing now:</p>
        <ul>
          <li><strong>A directory is a package.</strong> All <code>.go</code> files in one directory belong to the
                same package and can see each other's definitions without imports. Subdirectories are separate packages.
            </li>
          <li><strong><code>internal/</code> is enforced by the compiler.</strong> Any package under a directory named
                <code>internal</code> can only be imported by code rooted in the parent of that <code>internal</code>
                directory. This is not a convention, it is a compile error. It lets you have public-looking structure
                without committing to a public API.
            </li>
        </ul>
        <h3>Editor setup</h3>
        <p>Use <strong>gopls</strong>, the official Go language server. It gives completion, jump-to-definition, inline
            errors, and automatic import management.</p>
        <ul>
          <li><strong>VS Code:</strong> install the extension named "Go" (publisher: Go Team at Google). On first
                opening a <code>.go</code> file it offers to install tools; accept. Then enable format-on-save, which
                will also fix your imports as you type.</li>
          <li><strong>Neovim:</strong> <code>go install golang.org/x/tools/gopls@latest</code>, then configure
                <code>gopls</code> in your LSP setup.
            </li>
          <li><strong>GoLand:</strong> works out of the box, no language server needed.</li>
          <li><strong>Anything else:</strong> if it speaks LSP, install <code>gopls</code> the same way and point your
                editor at it.</li>
        </ul>
        <p>Turn on format-on-save now rather than later. Go has exactly one formatting style, produced by
            <code>gofmt</code>, and nobody argues about it. Indentation is <strong>tabs</strong>, which surprises people
            coming from Python or JavaScript. Let the tool do it.
        </p>
        <h3>Hello, colony</h3>
        <p>Create <code>cmd/antfarm/main.go</code>:</p>
        <pre><code>{"package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Hello, colony.\")\n}\n"}</code></pre>
        <p>Run it:</p>
        <pre className="plain"><code>{"$ go run ./cmd/antfarm\nHello, colony.\n"}</code></pre>
        <h4>Every line, explained</h4>
        <p><code>package main</code> — every Go file starts by declaring which package it belongs to. The name
            <code>main</code> is special: a package named <code>main</code> that contains a function named
            <code>main</code> is compiled into an executable program. Every other package name produces a library. Note
            that the package name here is unrelated to the directory name <code>antfarm</code>; the directory determines
            the import path, the <code>package</code> line determines the name. For <code>main</code> packages the
            directory name becomes the binary's name.
        </p>
        <p><code>import "fmt"</code> — brings in the standard library package <code>fmt</code> (short for "format"),
            which handles printing and string formatting. The quoted string is an <em>import path</em>. For standard
            library packages it is just the name; for external ones it is the full module path, for example
            <code>"github.com/spf13/cobra"</code>.
        </p>
        <p><code>func main() {'{'}</code> — declares a function called <code>main</code> taking no parameters and returning
            nothing. Go requires the opening brace on the same line as the declaration. This is not a style preference;
            the compiler inserts semicolons at line ends, so a brace on the next line produces a syntax error. In a
            <code>main</code> package, this function is where execution starts, and when it returns the program exits.
        </p>
        <p><code>fmt.Println("Hello, colony.")</code> — calls the <code>Println</code> function from the
            <code>fmt</code> package. The capital <strong>P</strong> is load-bearing: in Go, an identifier that starts
            with an uppercase letter is <em>exported</em> (visible to other packages), and lowercase means
            package-private. There is no <code>public</code> or <code>private</code> keyword. <code>Println</code>
            prints its arguments and appends a newline.
        </p>
        <div className="cmp">
          <h5>Different from what you are used to</h5>
          <ul>
            <li>Visibility is encoded in capitalisation, not keywords. Renaming a function from <code>Start</code>
                    to <code>start</code> changes its visibility.</li>
            <li>An unused import is a <em>compile error</em>, not a warning. So is an unused local variable. This
                    feels hostile for about a day and then you stop noticing, because your editor removes them
                    automatically.</li>
            <li>There are no semicolons in the source, but there are semicolons in the grammar; the lexer inserts
                    them. That is why brace placement is not negotiable.</li>
          </ul>
        </div>
        <h3>Building, testing, documenting</h3>
        <pre className="plain"><code>{"# compile and run in one step (binary goes to a temp dir)\ngo run ./cmd/antfarm\n\n# compile to a named file\ngo build -o bin/antfarm ./cmd/antfarm\n./bin/antfarm\n\n# compile and install into $(go env GOPATH)/bin, so it is on your PATH\ngo install ./cmd/antfarm\n\n# format every file in the tree\ngofmt -w .\n\n# the built-in correctness checker: finds real bugs, not style nits\ngo vet ./...\n\n# run all tests in all packages\ngo test ./...\n\n# read documentation without a browser\ngo doc fmt.Println\ngo doc -all strings | less\n"}</code></pre>
        <p>The <code>./...</code> pattern means "this directory and every package beneath it". You will type it
            constantly.</p>
        <p>For documentation, <a href="https://pkg.go.dev">pkg.go.dev</a> hosts rendered docs for the standard library
            and for every public module. <code>go doc</code> gives you the same content offline. <code>go help</code>
            and <code>go help mod</code> explain the toolchain itself.</p>
        <div className="exercise">
          <h5>Exercise 1.1</h5>
          <p>Modify the program so that it prints three lines: the Go version it was built with, the name of the
                operating system, and the number of CPU cores available. Then build it as a binary named
                <code>antfarm</code> in a <code>bin/</code> directory and run that binary.
            </p>
          <p>Hints: the <code>runtime</code> package has <code>Version()</code>, <code>GOOS</code>, and
                <code>NumCPU()</code>. Use <code>go doc runtime</code> to explore. Note that <code>GOOS</code> is a
                constant, not a function.
            </p>
        </div>
        <details>
          <summary>Solution 1.1 — open after trying</summary>
          <pre><code>{"package main\n\nimport (\n\t\"fmt\"\n\t\"runtime\"\n)\n\nfunc main() {\n\tfmt.Println(\"go version:\", runtime.Version())\n\tfmt.Println(\"os:        \", runtime.GOOS)\n\tfmt.Println(\"cpus:      \", runtime.NumCPU())\n}\n"}</code></pre>
          <pre className="plain"><code>{"$ go build -o bin/antfarm ./cmd/antfarm\n$ ./bin/antfarm\ngo version: go1.25.1\nos:         darwin\ncpus:       10\n"}</code></pre>
          <p>The grouped <code>import ( ... )</code> form is what <code>gofmt</code> produces once you have more than
                one import. <code>runtime.NumCPU()</code> is the number of cores visible to the process, which becomes
                relevant in Milestone 11 when we talk about parallelism versus concurrency.</p>
        </details>
        <div className="warn">
          <h5>Common first-day errors</h5>
          <ul>
            <li><code>go: cannot find main module</code> — you are not inside a directory containing
                    <code>go.mod</code>, or below one. Run <code>go mod init</code>.
                </li>
            <li><code>imported and not used: "runtime"</code> — remove the import, or use it. Not a warning.</li>
            <li><code>declared and not used: x</code> — same idea for local variables. Assigning to <code>_</code>
                    silences it deliberately: <code>_ = x</code>.</li>
            <li><code>syntax error: unexpected newline, expecting {'{'} after ...</code> — you put the opening brace on
                    its own line.</li>
            <li><code>package antfarm is not a main package</code> — you wrote <code>package antfarm</code> in a
                    file you are trying to run. Executables must say <code>package main</code>.</li>
            <li><code>go: command not found</code> after installing — your <code>PATH</code> does not include Go's
                    bin directory, or you did not restart the terminal.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>What makes a package produce an executable rather than a library?</li>
          <li>Where does the name <code>github.com/yourname/antfarm</code> come from and what is it used for?</li>
          <li>Why can code outside your module never import <code>yourmodule/internal/sim</code>?</li>
          <li>Your colleague's file has an import they are not using. Will it compile?</li>
          <li>What is the difference between <code>go build</code>, <code>go run</code>, and <code>go install</code>?
            </li>
        </ol>
        <hr />
        <h2><span className="num">Course 1 · Part 2</span>Language crash course</h2>
        <p>This part teaches only what the ant colony needs. Go is a small language and this is most of it, but I am
            deliberately skipping generics (until Milestone 11), reflection, struct tags, and embedding beyond one
            mention. Each concept follows the same rhythm: the idea, a small example, a line-by-line reading, and the
            mistakes people make. Exercises appear after every group of related concepts, with the solution folded away
            underneath.</p>
        <p>Work through this with a scratch project open. Make a directory <code>scratch</code>, run
            <code>go mod init scratch</code>, and put experiments in <code>main.go</code>. Type the examples rather than
            reading them.
        </p>
        <h3>2.1 Variables, types, and zero values</h3>
        <h5>The idea</h5>
        <p>Every variable has a type fixed at compile time. You can write the type explicitly, or let Go infer it from
            the initial value. A variable declared without a value is not undefined or null; it holds its type's
            <em>zero value</em>, which is a real, usable value.
        </p>
        <pre><code>{"package main\n\nimport \"fmt\"\n\nfunc main() {\n\tvar ticks int = 10          // explicit type, explicit value\n\tvar grid = \"512x512\"        // type inferred: string\n\tvar alive bool              // no value: zero value, which is false\n\tname := \"worker-7\"          // short declaration, only inside functions\n\n\tconst maxAnts = 50000       // compile-time constant\n\n\tfmt.Println(ticks, grid, alive, name, maxAnts)\n}\n"}</code></pre>
        <h5>Line by line</h5>
        <ul>
          <li><code>var ticks int = 10</code> — the full form. Reading order is name, then type, then value, which is
                backwards from C and Java and matches the way you say it out loud ("ticks is an int").</li>
          <li><code>var grid = "512x512"</code> — omit the type and it is inferred.</li>
          <li><code>var alive bool</code> — omit the value and you get the zero value. For <code>bool</code> that is
                <code>false</code>; for numbers <code>0</code>; for strings <code>""</code>; for pointers, slices, maps,
                channels, functions and interfaces it is <code>nil</code>. There is no uninitialised memory in Go and no
                <code>undefined</code>.
            </li>
          <li><code>name := "worker-7"</code> — the short declaration operator. It declares and assigns in one step,
                inferring the type. It only works inside a function, and it requires at least one variable on the left
                to be new.</li>
          <li><code>const maxAnts = 50000</code> — constants are computed at compile time and have no address. An
                untyped constant like this adapts to the context it is used in, so <code>maxAnts</code> can be used
                where an <code>int</code>, <code>int64</code>, or <code>float64</code> is wanted.</li>
        </ul>
        <div className="cmp">
          <h5>Typical language vs Go</h5>
          <p>In Python or JavaScript a "not yet set" variable is a distinct state you must check for
                (<code>None</code>, <code>undefined</code>). In Go the zero value is designed to be <em>useful</em>: a
                zero <code>sync.Mutex</code> is an unlocked mutex, a zero <code>bytes.Buffer</code> is an empty buffer
                ready to write to, a nil slice behaves like an empty slice for <code>len</code>, <code>range</code>, and
                <code>append</code>. When you design your own structs, you should aim for the same property. Our
                <code>Ant</code> struct will be designed so that its zero value is a valid, if boring, ant.
            </p>
        </div>
        <div className="warn">
          <h5>Mistakes</h5>
          <ul>
            <li>Using <code>:=</code> at package level. It does not work there; use <code>var</code>.</li>
            <li><code>no new variables on left side of :=</code> — you used <code>:=</code> when every variable
                    already exists. Use <code>=</code>.</li>
            <li>Shadowing: inside an <code>if</code> block, <code>err := f()</code> creates a <em>new</em> <code>err</code> that disappears at the closing brace, leaving the outer one untouched. This is the
                    single most common Go bug. <code>go vet</code> catches some cases; the <code>shadow</code> analyser
                    catches more.
                </li>
            <li>Mixing numeric types. Go does not implicitly convert. <code>var a int = 1; var b int64 = a</code> is
                    an error; you must write <code>int64(a)</code>.</li>
          </ul>
        </div>
        <h3>2.2 Functions, multiple returns, and defer</h3>
        <h5>The idea</h5>
        <p>Functions can return more than one value, and this is how Go handles errors: a function returns its result
            and an error side by side. <code>defer</code> schedules a call to run when the surrounding function returns,
            no matter how it returns.</p>
        <pre><code>{"func divide(a, b int) (int, error) {\n\tif b == 0 {\n\t\treturn 0, fmt.Errorf(\"divide %d by zero\", a)\n\t}\n\treturn a / b, nil\n}\n\nfunc report(name string) {\n\tdefer fmt.Println(\"done:\", name)   // runs last, whatever happens\n\tfmt.Println(\"start:\", name)\n\tif name == \"\" {\n\t\treturn                          // the deferred call still runs\n\t}\n\tfmt.Println(\"working:\", name)\n}\n"}</code></pre>
        <h5>Line by line</h5>
        <ul>
          <li><code>func divide(a, b int) (int, error)</code> — two parameters of the same type share one type
                annotation. The return types are in parentheses because there are two of them.</li>
          <li><code>fmt.Errorf(...)</code> — builds an error value with a formatted message. <code>%d</code>
                substitutes an integer, exactly like <code>printf</code>.</li>
          <li><code>return 0, nil</code> — you must return a value for every declared return, so the "unused" one gets
                a zero value. The convention is that when <code>error</code> is non-nil, the other results are
                meaningless.</li>
          <li><code>defer fmt.Println(...)</code> — the arguments are evaluated <em>now</em> but the call happens when
                <code>report</code> returns. Deferred calls run in last-in-first-out order. This is how Go does cleanup:
                <code>defer file.Close()</code>, <code>defer mu.Unlock()</code>, <code>defer cancel()</code>.
            </li>
        </ul>
        <div className="warn">
          <h5>Mistakes</h5>
          <ul>
            <li>Deferring inside a loop. The calls pile up until the function returns, so a loop over 10,000 files
                    holds 10,000 open handles. Move the body into its own function, or call <code>Close</code>
                    explicitly.</li>
            <li>Expecting deferred arguments to be evaluated late. <code>defer fmt.Println(i)</code> in a loop
                    prints the value of <code>i</code> at the moment of the <code>defer</code>, not at return time. Wrap
                    in a closure if you want late evaluation: <code>defer func(){'{'} fmt.Println(i) {'}'}()</code>.</li>
            <li>Ignoring the error return. <code>value, _ := divide(1, 0)</code> compiles happily and gives you
                    nonsense. <code>errcheck</code> and most linters flag this.</li>
          </ul>
        </div>
        <h3>2.3 Control flow: if, for, switch</h3>
        <h5>The idea</h5>
        <p>Go has one loop keyword, <code>for</code>, which covers every loop shape. <code>if</code> can declare a
            variable scoped to the statement. <code>switch</code> does not fall through by default.</p>
        <pre><code>{"// classic three-part loop\nfor i := 0; i < 5; i++ {\n\tfmt.Println(i)\n}\n\n// while loop\nn := 10\nfor n > 0 {\n\tn--\n}\n\n// infinite loop\nfor {\n\tbreak\n}\n\n// range over a slice: index and value\nants := []string{\"a1\", \"a2\", \"a3\"}\nfor i, name := range ants {\n\tfmt.Println(i, name)\n}\n\n// range over an integer (Go 1.22+)\nfor i := range 3 {\n\tfmt.Println(i)     // 0 1 2\n}\n\n// if with an initialiser: err exists only inside the if/else\nif q, err := divide(10, 2); err != nil {\n\tfmt.Println(\"failed:\", err)\n} else {\n\tfmt.Println(\"got\", q)\n}\n\n// switch on a value, no break needed\nswitch state {\ncase \"searching\":\n\tfmt.Println(\"looking for food\")\ncase \"carrying\", \"returning\":     // multiple values in one case\n\tfmt.Println(\"heading home\")\ndefault:\n\tfmt.Println(\"idle\")\n}\n\n// switch with no expression: a tidy if/else chain\nswitch {\ncase energy < 10:\n\tfmt.Println(\"starving\")\ncase energy < 50:\n\tfmt.Println(\"hungry\")\ndefault:\n\tfmt.Println(\"fine\")\n}\n"}</code></pre>
        <h5>Notes on the pieces</h5>
        <ul>
          <li>No parentheses around conditions, and braces are always required even for one-line bodies.</li>
          <li><code>for i, name := range ants</code> — <code>range</code> yields index and element for slices and
                arrays, key and value for maps, and values for channels. If you only want the index, write
                <code>for i := range ants</code>. If you only want the value, write
                <code>for _, name := range ants</code>, where <code>_</code> is the blank identifier meaning "discard
                this".
            </li>
          <li><code>if q, err := ...; err != nil</code> — the initialiser before the semicolon runs first, and any
                variables it declares are scoped to the whole <code>if</code>/<code>else</code> chain. This is the
                idiomatic way to handle errors without leaking names.</li>
          <li><code>switch</code> cases do not fall through. If you actually want fallthrough, there is a
                <code>fallthrough</code> keyword, which is rare.
            </li>
        </ul>
        <div className="warn">
          <h5>Mistakes</h5>
          <ul>
            <li>Writing <code>while</code>. It does not exist.</li>
            <li>Assuming <code>range</code> over a map has a stable order. It is deliberately randomised, to stop
                    you depending on it. Collect and sort the keys if order matters.</li>
            <li>Modifying the loop variable expecting it to affect the collection.
                    <code>for _, a := range ants {'{'} a.Energy = 0 {'}'}</code> mutates a copy when the element is a struct
                    value. Use <code>for i := range ants {'{'} ants[i].Energy = 0 {'}'}</code>.
                </li>
          </ul>
        </div>
        <div className="exercise">
          <h5>Exercise 2.A</h5>
          <p>Write a function <code>summary(values []int) (min int, max int, err error)</code> that returns the
                smallest and largest values in a slice, and an error if the slice is empty. Then write a
                <code>main</code> that calls it twice, once with data and once with an empty slice, printing both
                outcomes. Do not use any library beyond <code>fmt</code> and <code>errors</code>.
            </p>
        </div>
        <details>
          <summary>Solution 2.A — open after trying</summary>
          <pre><code>{"package main\n\nimport (\n\t\"errors\"\n\t\"fmt\"\n)\n\nvar ErrEmpty = errors.New(\"summary: empty slice\")\n\nfunc summary(values []int) (min int, max int, err error) {\n\tif len(values) == 0 {\n\t\treturn 0, 0, ErrEmpty\n\t}\n\tmin, max = values[0], values[0]\n\tfor _, v := range values[1:] {\n\t\tif v < min {\n\t\t\tmin = v\n\t\t}\n\t\tif v > max {\n\t\t\tmax = v\n\t\t}\n\t}\n\treturn min, max, nil\n}\n\nfunc main() {\n\tif lo, hi, err := summary([]int{4, 9, 1, 7}); err != nil {\n\t\tfmt.Println(\"error:\", err)\n\t} else {\n\t\tfmt.Println(\"min\", lo, \"max\", hi)\n\t}\n\n\tif _, _, err := summary(nil); err != nil {\n\t\tfmt.Println(\"error:\", err)   // error: summary: empty slice\n\t}\n}\n"}</code></pre>
          <p>Three things worth noticing. The return values are <em>named</em> in the signature, which documents them
                and lets you write a bare <code>return</code>; use this sparingly, since bare returns in long functions
                are hard to read. <code>values[1:]</code> is a slice expression meaning "from index 1 to the end". And
                <code>summary(nil)</code> works because a nil slice has length zero, which is the zero-value-is-useful
                principle in action.
            </p>
        </details>
        <h3>2.4 Slices</h3>
        <h5>The idea</h5>
        <p>A slice is Go's growable list. Under the hood it is a three-word value: a pointer to an underlying array, a
            length, and a capacity. Understanding that is not optional, because it explains the behaviour that surprises
            everyone.</p>
        <pre><code>{"positions := []int{10, 20, 30}      // literal, len 3, cap 3\npositions = append(positions, 40)   // append returns a NEW slice value\nfmt.Println(len(positions), cap(positions))\n\ngrid := make([]int, 0, 1000)        // len 0, capacity 1000: no reallocation\n                                    // for the first 1000 appends\n\nview := positions[1:3]              // len 2, shares memory with positions\nview[0] = 99                        // this modifies positions[1] too!\nfmt.Println(positions)              // [10 99 30 40]\n"}</code></pre>
        <h5>Line by line</h5>
        <ul>
          <li><code>[]int{'{'}10, 20, 30{'}'}</code> — a slice literal. <code>[]int</code> is the type "slice of int".
                (<code>[3]int</code>, with a number, is a fixed-size <em>array</em>, which is a different and much less
                used type.)</li>
          <li><code>append(positions, 40)</code> — appends and <em>returns the result</em>. If the underlying array
                has spare capacity it writes in place; if not, it allocates a bigger array and copies. Because it might
                reallocate, you must use the return value. <code>append(positions, 40)</code> on its own line is a bug
                that <code>go vet</code> will not always catch.</li>
          <li><code>make([]int, 0, 1000)</code> — <code>make</code> creates slices, maps, and channels. The arguments
                are type, length, capacity. Preallocating capacity when you know the size is the single easiest Go
                performance win, and we will use it for the ant list.</li>
          <li><code>positions[1:3]</code> — a <em>view</em>, not a copy. It shares the same backing array. Writing
                through the view is visible through the original. To copy, use <code>copy(dst, src)</code> or
                <code>slices.Clone</code>.
            </li>
        </ul>
        <div className="cmp">
          <h5>Typical language vs Go</h5>
          <p>Python's <code>list[1:3]</code> copies. Go's <code>slice[1:3]</code> aliases. That aliasing is the point:
                it makes subslicing free, which matters when you are scanning large buffers. It also means that passing
                a slice to a function lets that function modify your elements, even though the slice header itself is
                passed by value. "Slices are references" is the common shorthand, but the precise version is "slices are
                values containing a pointer", and the distinction shows up when a function appends to a slice you passed
                in.</p>
        </div>
        <div className="warn">
          <h5>Mistakes</h5>
          <ul>
            <li>Discarding <code>append</code>'s result. Always <code>s = append(s, x)</code>.</li>
            <li>Keeping a small slice of a huge array alive and wondering why memory never drops. The whole backing
                    array stays reachable. <code>slices.Clone</code> breaks the link.</li>
            <li>Appending to a shared slice from two goroutines. This is a data race, and Milestone 4 will show you
                    exactly what it looks like.</li>
            <li>Confusing <code>len</code> and <code>cap</code>. <code>len</code> is how many elements exist;
                    <code>cap</code> is how many fit before reallocation.
                </li>
          </ul>
        </div>
        <h3>2.5 Maps</h3>
        <h5>The idea</h5>
        <p>A hash table with typed keys and values. Reading a missing key gives the zero value rather than an error, and
            there is a special two-value form to tell "missing" from "present but zero".</p>
        <pre><code>{"pheromone := make(map[string]float64)\npheromone[\"12,7\"] = 0.8\n\nv := pheromone[\"99,99\"]              // 0, no error, no panic\nv, ok := pheromone[\"99,99\"]          // v = 0, ok = false\n\nif strength, ok := pheromone[\"12,7\"]; ok {\n\tfmt.Println(\"found\", strength)\n}\n\ndelete(pheromone, \"12,7\")\nfmt.Println(len(pheromone))\n\nfor cell, strength := range pheromone {   // order is randomised on purpose\n\tfmt.Println(cell, strength)\n}\n"}</code></pre>
        <h5>Notes</h5>
        <ul>
          <li><code>make(map[K]V)</code> creates an empty, usable map. A map declared with
                <code>var m map[string]int</code> is <strong>nil</strong>: reading from it is fine and returns zero
                values, but writing to it panics. This asymmetry catches everyone once.
            </li>
          <li>The <code>value, ok := m[key]</code> form is called the "comma ok" idiom and appears again with type
                assertions and channel receives.</li>
          <li>Keys must be comparable: numbers, strings, booleans, pointers, channels, interfaces, and structs or
                arrays of those. Slices, maps and functions cannot be keys.</li>
          <li>Maps are not safe for concurrent use. Concurrent reads are fine; a concurrent write with anything else
                causes the runtime to deliberately crash with <code>fatal error: concurrent map writes</code>. That
                crash is a feature, and you will meet it.</li>
        </ul>
        <h3>2.6 Structs, pointers, and methods</h3>
        <h5>The idea</h5>
        <p>A struct is a fixed collection of named fields. A pointer holds the address of a value. A method is a
            function with a receiver, which is the value it is attached to. Go has no classes and no inheritance.</p>
        <pre><code>{"type Position struct {\n\tX, Y int\n}\n\ntype Ant struct {\n\tID       int\n\tPos      Position\n\tEnergy   int\n\tCarrying bool\n}\n\n// value receiver: operates on a copy\nfunc (a Ant) Describe() string {\n\treturn fmt.Sprintf(\"ant %d at (%d,%d)\", a.ID, a.Pos.X, a.Pos.Y)\n}\n\n// pointer receiver: can modify the original\nfunc (a *Ant) Move(dx, dy int) {\n\ta.Pos.X += dx\n\ta.Pos.Y += dy\n\ta.Energy--\n}\n\nfunc main() {\n\ta := Ant{ID: 1, Pos: Position{X: 5, Y: 5}, Energy: 100}\n\ta.Move(1, 0)                 // Go automatically takes &a\n\tfmt.Println(a.Describe())    // ant 1 at (6,5)\n\n\tp := &a                      // p is a *Ant\n\tp.Move(0, 1)                 // no need to write (*p).Move\n\tfmt.Println(a.Pos)           // {6 6} — the original changed\n}\n"}</code></pre>
        <h5>Line by line</h5>
        <ul>
          <li><code>type Ant struct {'{'} ... {'}'}</code> — declares a new named type. Fields with uppercase names are
                visible outside the package.</li>
          <li><code>Ant{'{'}ID: 1, Pos: ...{'}'}</code> — a composite literal with field names. Always use field names; the
                positional form breaks when someone adds a field.</li>
          <li><code>func (a Ant) Describe() string</code> — the part in parentheses before the name is the
                <em>receiver</em>. Here it is a value, so <code>a</code> is a copy and modifications would be discarded.
            </li>
          <li><code>func (a *Ant) Move(...)</code> — a pointer receiver. <code>a</code> points at the original, so the
                mutation sticks. Note that you write <code>a.Pos.X</code>, not <code>(*a).Pos.X</code>; Go dereferences
                pointers automatically for field access and method calls.</li>
          <li><code>a.Move(1, 0)</code> where <code>a</code> is a value and <code>Move</code> needs a pointer — Go
                inserts <code>&a</code> for you, because <code>a</code> is addressable. This convenience has one
                important exception: values stored in a map are not addressable, so <code>ants["x"].Move(1,0)</code>
                will not compile. Store pointers in the map instead.</li>
        </ul>
        <p><strong>The rule for choosing a receiver:</strong> use a pointer receiver if the method modifies the
            receiver, or if the struct is large enough that copying it matters, or if any other method on the type needs
            a pointer. Mixing value and pointer receivers on one type is a smell. For <code>Ant</code>, which we will
            mutate constantly, everything will be a pointer receiver.</p>
        <div className="cmp">
          <h5>Typical language vs Go</h5>
          <p>There is no class, no constructor, no inheritance, no <code>this</code>. The conventional replacement for
                a constructor is a plain function named <code>New</code> or <code>NewAnt</code> that returns a value or
                pointer. The replacement for inheritance is <em>embedding</em> (putting one struct inside another
                without a field name, which promotes its methods) plus interfaces. Go's designers left inheritance out
                on purpose, and after a week you stop reaching for it.</p>
        </div>
        <h3>2.7 Interfaces</h3>
        <h5>The idea</h5>
        <p>An interface is a set of method signatures. A type satisfies an interface simply by having those methods.
            There is no <code>implements</code> keyword and no declaration of intent, which means you can define an
            interface <em>after</em> the fact, in the package that consumes it.</p>
        <pre><code>{"type Behaviour interface {\n\tDecide(a *Ant, w *World) Action\n\tName() string\n}\n\ntype Forager struct{}\n\nfunc (Forager) Name() string { return \"forager\" }\nfunc (Forager) Decide(a *Ant, w *World) Action {\n\tif a.Carrying {\n\t\treturn Action{Kind: ReturnHome}\n\t}\n\treturn Action{Kind: SearchFood}\n}\n\n// anything with Decide and Name can be passed here\nfunc step(b Behaviour, a *Ant, w *World) {\n\tact := b.Decide(a, w)\n\tw.Apply(a, act)\n}\n"}</code></pre>
        <h5>Notes</h5>
        <ul>
          <li><code>type Behaviour interface {'{'} ... {'}'}</code> — just method signatures. <code>Forager</code> never
                mentions <code>Behaviour</code>, yet satisfies it.</li>
          <li><code>func (Forager) Name() string</code> — the receiver has no name because the method does not use it.
                Legal and common for stateless implementations.</li>
          <li>An interface value is two words: the concrete type and a pointer to the data. A nil interface is
                different from an interface holding a nil pointer, which is a famous Go trap covered in Milestone 3.
            </li>
          <li><code>any</code> (an alias for <code>interface{'{'}{'}'}</code>) is the empty interface, satisfied by
                everything. Use it rarely.</li>
          <li>To recover the concrete type: <code>f, ok := b.(Forager)</code> is a type assertion, and a
                <code>switch v := x.(type)</code> is a type switch.
            </li>
        </ul>
        <div className="cmp">
          <h5>Typical language vs Go</h5>
          <p>In Java or C# an interface is a contract the implementer signs up to in advance, so the library author
                must anticipate your needs. In Go, the <em>consumer</em> defines the interface it needs, and existing
                types satisfy it retroactively. The cultural consequence is that idiomatic Go interfaces are tiny, often
                one method (<code>io.Reader</code>, <code>io.Writer</code>, <code>error</code>), and the proverb is
                "accept interfaces, return structs". We will follow that: our simulation accepts a
                <code>Behaviour</code>, and our constructors return concrete types.
            </p>
        </div>
        <div className="exercise">
          <h5>Exercise 2.B</h5>
          <p>Define a <code>Grid</code> struct holding width, height, and a one-dimensional <code>[]int</code> of
                cells. Give it a constructor <code>NewGrid(w, h int) *Grid</code>, an <code>At(x, y int) int</code>
                method, and a <code>Set(x, y, v int)</code> method. Cells outside the grid should be treated as
                <code>0</code> for <code>At</code> and ignored for <code>Set</code> rather than panicking. Explain to
                yourself why the cells are a flat slice instead of a slice of slices.
            </p>
        </div>
        <details>
          <summary>Solution 2.B — open after trying</summary>
          <pre><code>{"type Grid struct {\n\tW, H  int\n\tcells []int\n}\n\nfunc NewGrid(w, h int) *Grid {\n\treturn &Grid{W: w, H: h, cells: make([]int, w*h)}\n}\n\nfunc (g *Grid) inBounds(x, y int) bool {\n\treturn x >= 0 && y >= 0 && x < g.W && y < g.H\n}\n\nfunc (g *Grid) At(x, y int) int {\n\tif !g.inBounds(x, y) {\n\t\treturn 0\n\t}\n\treturn g.cells[y*g.W+x]\n}\n\nfunc (g *Grid) Set(x, y, v int) {\n\tif !g.inBounds(x, y) {\n\t\treturn\n\t}\n\tg.cells[y*g.W+x] = v\n}\n"}</code></pre>
          <p>Why flat: one allocation instead of <code>h+1</code>, contiguous memory so scanning a row is
                cache-friendly, and a single <code>copy</code> can snapshot the whole grid, which we will need when the
                viewer asks for a frame. <code>cells</code> is lowercase so that nothing outside the package can index
                it without bounds checking. <code>inBounds</code> is lowercase for the same reason: it is an internal
                helper.</p>
        </details>
        <h3>2.8 Errors</h3>
        <h5>The idea</h5>
        <p>An error is a value implementing one method. You return it, you check it, you wrap it with context as it
            travels up. Go has panics too, but they are for programmer mistakes and truly unrecoverable situations, not
            for control flow.</p>
        <pre><code>{"// the entire definition, from the standard library:\n// type error interface { Error() string }\n\nvar ErrNoFood = errors.New(\"no food available\")     // a sentinel error\n\nfunc (w *World) TakeFood(p Position) (int, error) {\n\tamount := w.food.At(p.X, p.Y)\n\tif amount == 0 {\n\t\treturn 0, fmt.Errorf(\"take at (%d,%d): %w\", p.X, p.Y, ErrNoFood)\n\t}\n\tw.food.Set(p.X, p.Y, amount-1)\n\treturn 1, nil\n}\n\nfunc forage(w *World, p Position) {\n\tgot, err := w.TakeFood(p)\n\tif errors.Is(err, ErrNoFood) {      // unwraps through %w\n\t\t// expected: move elsewhere\n\t\treturn\n\t}\n\tif err != nil {\n\t\tlog.Printf(\"unexpected: %v\", err)\n\t\treturn\n\t}\n\t_ = got\n}\n\n// a custom error type, when callers need structured detail\ntype OutOfBounds struct{ X, Y int }\n\nfunc (e *OutOfBounds) Error() string {\n\treturn fmt.Sprintf(\"position (%d,%d) is outside the grid\", e.X, e.Y)\n}\n\n// retrieving it:\nvar oob *OutOfBounds\nif errors.As(err, &oob) {\n\tfmt.Println(\"bad x was\", oob.X)\n}\n"}</code></pre>
        <h5>Notes</h5>
        <ul>
          <li><code>errors.New</code> creates a simple error. A package-level <code>Err...</code> variable is called a
                sentinel, and callers compare against it.</li>
          <li><code>%w</code> in <code>fmt.Errorf</code> <em>wraps</em>: the new error contains the old one, so
                context accumulates while identity is preserved. Use <code>%v</code> instead if you deliberately want to
                hide the cause.</li>
          <li><code>errors.Is(err, target)</code> walks the wrap chain comparing identity.
                <code>errors.As(err, &target)</code> walks it looking for a specific type. Never compare error
                <em>strings</em>.
            </li>
          <li><code>panic</code> unwinds the stack running deferred functions and then crashes the program, printing a
                stack trace. <code>recover</code>, called inside a deferred function, stops the unwinding. We will use
                exactly one <code>recover</code> in the whole project, in Milestone 8, at the top of each ant goroutine,
                and I will argue about whether that is a good idea.</li>
        </ul>
        <div className="cmp">
          <h5>Typical language vs Go</h5>
          <p>Exceptions are invisible in a function signature and travel silently through every frame. Go's errors are
                ordinary values, so the signature tells you what can fail, and the <code>if err != nil</code> blocks are
                explicit. The cost is verbosity, and it is real: around a third of the lines in a typical Go program are
                error handling. The benefit is that for a long-running simulation you can see every failure path in the
                code rather than discovering it in production. This is a genuine trade-off, not a clear win, and Rust's
                <code>?</code> operator arguably gets a better deal.
            </p>
        </div>
        <h3>2.9 Goroutines</h3>
        <h5>The idea</h5>
        <p>Put <code>go</code> in front of a function call and it runs concurrently. A goroutine is not an
            operating-system thread; it is a much cheaper thing that the Go runtime multiplexes onto a small pool of
            threads.</p>
        <pre><code>{"func main() {\n\tgo fmt.Println(\"from a goroutine\")     // may never print!\n\tfmt.Println(\"from main\")\n\ttime.Sleep(10 * time.Millisecond)      // crude, but proves the point\n}\n"}</code></pre>
        <p>Two facts to absorb immediately:</p>
        <ul>
          <li><strong>When <code>main</code> returns, the program exits</strong>, killing every goroutine still
                running, with no cleanup and no warning. Half of all beginner "my goroutine didn't run" reports are
                this.</li>
          <li><strong>Goroutine start order is not defined.</strong> The runtime schedules them; do not assume
                anything about ordering without synchronisation.</li>
        </ul>
        <p><code>time.Sleep</code> is never the answer. The real tool for "wait for a group of goroutines" is
            <code>sync.WaitGroup</code>:
        </p>
        <pre><code>{"var wg sync.WaitGroup\n\nfor i := range 5 {\n\twg.Add(1)                    // register one pending goroutine, BEFORE go\n\tgo func() {\n\t\tdefer wg.Done()          // signal completion, even on panic\n\t\tfmt.Println(\"ant\", i, \"reporting\")\n\t}()\n}\n\nwg.Wait()                        // blocks until the counter reaches zero\nfmt.Println(\"all ants reported\")\n"}</code></pre>
        <h5>Notes</h5>
        <ul>
          <li><code>wg.Add(1)</code> must happen before the <code>go</code> statement. If you put it inside the
                goroutine, <code>Wait</code> can return before the goroutine has even started.</li>
          <li><code>defer wg.Done()</code> as the first line of the goroutine guarantees the counter is decremented on
                every exit path.</li>
          <li>The closure captures <code>i</code>. <strong>Since Go 1.22 each loop iteration gets its own
                    <code>i</code></strong>, so this prints 0 through 4 in some order. In Go 1.21 and earlier the loop
                variable was shared and this printed "5" five times, which was the most notorious Go gotcha. Older
                tutorials pass <code>i</code> as an argument to work around it; that is still correct, just no longer
                necessary.</li>
          <li>Recent Go versions add <code>wg.Go(func(){'{'} ... {'}'})</code>, which does the <code>Add</code> and
                <code>Done</code> for you. If your compiler rejects it, your version is older; the classic form above
                always works.
            </li>
        </ul>
        <div className="cmp">
          <h5>Threads vs goroutines</h5>
          <pre className="plain"><code>{"Traditional threads                 Goroutines\n───────────────────                 ──────────\n~1-8 MB stack reserved each         ~2 KB stack, grows on demand\ncreated by the OS, expensive        created by the runtime, ~1µs\nscheduled by the OS kernel          scheduled by the Go runtime onto\n                                      GOMAXPROCS OS threads\nblocking syscall blocks a thread    runtime moves other goroutines to\n                                      another thread automatically\n10,000 is a lot                     1,000,000 is fine\nyou coordinate with locks           you coordinate with channels\n                                      (locks also available)"}</code></pre>
          <p>This is why "one goroutine per ant" is a sane architecture and "one thread per ant" is not. It is also
                why Go can afford a blocking programming style: a goroutine waiting on a channel or a network read costs
                almost nothing, so you write straight-line code instead of callbacks or async/await colouring.</p>
        </div>
        <h3>2.10 Channels</h3>
        <h5>The idea</h5>
        <p>A channel is a typed pipe that also synchronises. One goroutine sends, another receives, and the channel
            handles the handover safely. The slogan is: <em>do not communicate by sharing memory; share memory by
                communicating.</em></p>
        <pre><code>{"ch := make(chan int)            // unbuffered\nbuf := make(chan int, 100)      // buffered, holds 100 before blocking\n\ngo func() {\n\tch <- 42                    // send: blocks until someone receives\n}()\n\nv := <-ch                       // receive: blocks until someone sends\nfmt.Println(v)                  // 42\n\nclose(ch)                       // no more values will be sent\nv, ok := <-ch                   // ok is false once drained and closed\n\n// range over a channel until it is closed\nresults := make(chan string, 3)\ngo func() {\n\tdefer close(results)        // the sender closes, always\n\tresults <- \"found food\"\n\tresults <- \"laid pheromone\"\n}()\nfor msg := range results {\n\tfmt.Println(msg)\n}\n"}</code></pre>
        <h5>Semantics you must know</h5>
        <table className="grid">
          <tbody>
            <tr>
              <th>Operation</th>
              <th>nil channel</th>
              <th>open, empty/full</th>
              <th>closed</th>
            </tr>
            <tr>
              <td>send</td>
              <td>blocks forever</td>
              <td>blocks until space</td>
              <td><strong>panics</strong></td>
            </tr>
            <tr>
              <td>receive</td>
              <td>blocks forever</td>
              <td>blocks until value</td>
              <td>returns zero value immediately, <code>ok</code> false</td>
            </tr>
            <tr>
              <td>close</td>
              <td>panics</td>
              <td>succeeds</td>
              <td><strong>panics</strong></td>
            </tr>
          </tbody>
        </table>
        <ul>
          <li><strong>Unbuffered channels are a rendezvous.</strong> The send does not complete until a receiver takes
                the value. That makes an unbuffered send a synchronisation point between two goroutines, which is often
                what you want for correctness and sometimes a performance problem.</li>
          <li><strong>Buffered channels decouple</strong> sender and receiver up to the buffer size. The buffer size
                is a policy decision about how much lag you tolerate, and in Milestone 11 it becomes our backpressure
                knob.</li>
          <li><strong>Closing is a broadcast.</strong> Every receiver sees it. That makes a closed channel the
                standard "everyone stop now" signal, which is exactly how <code>context</code> works internally.</li>
          <li><strong>Only the sender closes</strong>, and only when there is exactly one sender, otherwise you risk
                the "send on closed channel" panic. With multiple senders, use a separate done channel or a
                <code>WaitGroup</code>.
            </li>
          <li>Channel direction can be part of a type: <code>func consume(in {'<'}-chan int)</code> accepts a
                receive-only channel and <code>func produce(out chan{'<'}- int)</code> a send-only one. The arrow points
                the way data flows. Use these in signatures; they document intent and the compiler enforces it.</li>
        </ul>
        <h3>2.11 select</h3>
        <h5>The idea</h5>
        <p><code>select</code> waits on several channel operations at once and proceeds with whichever is ready. It is
            the control structure that makes channels composable.</p>
        <pre><code>{"func worker(jobs <-chan int, done <-chan struct{}) {\n\ttimeout := time.After(5 * time.Second)\n\n\tfor {\n\t\tselect {\n\t\tcase job, ok := <-jobs:\n\t\t\tif !ok {\n\t\t\t\tfmt.Println(\"jobs channel closed\")\n\t\t\t\treturn\n\t\t\t}\n\t\t\tfmt.Println(\"working on\", job)\n\n\t\tcase <-done:\n\t\t\tfmt.Println(\"asked to stop\")\n\t\t\treturn\n\n\t\tcase <-timeout:\n\t\t\tfmt.Println(\"took too long\")\n\t\t\treturn\n\t\t}\n\t}\n}\n\n// non-blocking variants\nselect {\ncase v := <-ch:\n\tfmt.Println(\"got\", v)\ndefault:\n\tfmt.Println(\"nothing waiting\")     // never blocks\n}\n\nselect {\ncase out <- value:\n\t// sent\ndefault:\n\t// receiver is busy: drop the value rather than block.\n\t// This is load shedding, and it is a real strategy.\n}\n"}</code></pre>
        <h5>Notes</h5>
        <ul>
          <li>If several cases are ready, <code>select</code> picks one <strong>at random</strong>, which prevents
                starvation.</li>
          <li>With no <code>default</code>, <code>select</code> blocks until some case is ready. With a
                <code>default</code>, it never blocks.
            </li>
          <li><code>chan struct{'{'}{'}'}</code> is the idiomatic "signal only, no data" channel; an empty struct occupies
                zero bytes.</li>
          <li><code>time.After(d)</code> returns a channel that delivers a value after <code>d</code>. Convenient, but
                it allocates a timer each time through a hot loop, so in performance-sensitive loops use
                <code>time.NewTimer</code> and reset it.
            </li>
          <li>A <code>nil</code> channel in a <code>select</code> case blocks forever, so setting a channel variable
                to <code>nil</code> is how you dynamically disable a case. This trick appears in Milestone 11.</li>
        </ul>
        <h3>2.12 Mutexes and atomics</h3>
        <h5>The idea</h5>
        <p>Channels are not always the right answer. When several goroutines genuinely need to read and write one piece
            of shared state, a mutex is simpler and faster. Go provides both and expects you to choose.</p>
        <pre><code>{"type Counters struct {\n\tmu       sync.Mutex\n\tdelivered int\n\tbyAnt    map[int]int\n}\n\nfunc (c *Counters) Record(antID int) {\n\tc.mu.Lock()\n\tdefer c.mu.Unlock()\n\tc.delivered++\n\tc.byAnt[antID]++\n}\n\n// for a single number, an atomic is cheaper than a mutex\nvar ticks atomic.Int64\n\nfunc tick() {\n\tticks.Add(1)\n}\n\nfunc report() int64 {\n\treturn ticks.Load()\n}\n"}</code></pre>
        <h5>Notes</h5>
        <ul>
          <li>The zero value of <code>sync.Mutex</code> is an unlocked mutex, so no initialisation is needed. Put it
                next to the data it protects, and add a comment saying what it protects.</li>
          <li><code>defer c.mu.Unlock()</code> immediately after <code>Lock</code> is the safe habit. It costs a few
                nanoseconds and eliminates a class of bug.</li>
          <li>Never copy a struct containing a mutex after first use. <code>go vet</code> catches this and it is a
                genuine bug: the copy has its own independent lock. This is why methods on mutex-containing types take
                pointer receivers.</li>
          <li><code>sync.RWMutex</code> allows many concurrent readers or one writer. It is slower than
                <code>Mutex</code> under write-heavy load, so measure before assuming it helps.
            </li>
          <li><code>atomic.Int64</code>, <code>atomic.Bool</code> and friends are lock-free and appropriate for
                counters and flags, but they do not compose: two atomic operations are not one atomic operation.</li>
        </ul>
        <div className="why">
          <h5>Channels or mutexes?</h5>
          <p>The Go community's rule of thumb, from the standard library's own comments: use channels for passing
                ownership of data and coordinating the flow of work; use mutexes for protecting shared state with simple
                invariants, especially caches and counters. A mutex around a counter is clear and fast. A channel used
                as a lock is clever and slow. Our project uses channels for ant-to-world communication (ownership
                handover) and mutexes and atomics for the metrics package (shared counters). Both, deliberately.</p>
        </div>
        <h3>2.13 context</h3>
        <h5>The idea</h5>
        <p><code>context.Context</code> carries a cancellation signal and a deadline down through a call tree. Every
            long-running operation in modern Go accepts one as its first parameter. It is the standard answer to "how do
            I stop 50,000 goroutines at once".</p>
        <pre><code>{"func run(ctx context.Context, id int) error {\n\tticker := time.NewTicker(100 * time.Millisecond)\n\tdefer ticker.Stop()\n\n\tfor {\n\t\tselect {\n\t\tcase <-ctx.Done():                  // closed when cancelled\n\t\t\treturn ctx.Err()                // context.Canceled or DeadlineExceeded\n\t\tcase <-ticker.C:\n\t\t\t// do one unit of work\n\t\t}\n\t}\n}\n\nfunc main() {\n\tctx, cancel := context.WithCancel(context.Background())\n\tdefer cancel()                          // always; releases resources\n\n\tfor i := range 1000 {\n\t\tgo run(ctx, i)\n\t}\n\n\ttime.Sleep(time.Second)\n\tcancel()                                // all 1000 goroutines see this\n}\n"}</code></pre>
        <h5>Notes</h5>
        <ul>
          <li><code>context.Background()</code> is the empty root context, created in <code>main</code>.
                <code>context.TODO()</code> is the same thing with a note to yourself.
            </li>
          <li><code>WithCancel</code>, <code>WithTimeout</code>, and <code>WithDeadline</code> derive children.
                Cancelling a parent cancels every descendant. That tree structure is why one <code>cancel()</code> can
                stop a whole subsystem.</li>
          <li><code>ctx.Done()</code> returns a channel that is <em>closed</em> on cancellation. Closing is a
                broadcast, which is how one call reaches thousands of waiters instantly.</li>
          <li>Always <code>defer cancel()</code>, even for a timeout context that will expire on its own, or you leak
                a timer and a goroutine.</li>
          <li>Pass context as the first argument, named <code>ctx</code>. Do not store it in a struct. Do not pass
                <code>nil</code>.
            </li>
          <li>Cancellation is <strong>cooperative</strong>. A goroutine in a tight computational loop that never
                checks <code>ctx.Done()</code> will not stop. Go cannot kill a goroutine, and there is no equivalent of
                Erlang's <code>exit(Pid, kill)</code>. This limitation shapes Milestone 8.</li>
        </ul>
        <h3>2.14 Testing</h3>
        <h5>The idea</h5>
        <p>Testing is in the standard library and requires no dependencies. A test is a function named
            <code>TestXxx</code> taking <code>*testing.T</code>, in a file ending <code>_test.go</code>, in the same
            package as the code.
        </p>
        <p><code>internal/world/grid.go</code> with tests in <code>internal/world/grid_test.go</code>:</p>
        <pre><code>{"package world\n\nimport \"testing\"\n\nfunc TestGridSetAndAt(t *testing.T) {\n\tg := NewGrid(4, 3)\n\tg.Set(2, 1, 7)\n\n\tif got := g.At(2, 1); got != 7 {\n\t\tt.Errorf(\"At(2,1) = %d, want 7\", got)\n\t}\n}\n\n// table-driven tests: the dominant Go style\nfunc TestGridBounds(t *testing.T) {\n\tg := NewGrid(4, 3)\n\n\tcases := []struct {\n\t\tname string\n\t\tx, y int\n\t\twant int\n\t}{\n\t\t{\"inside\", 0, 0, 0},\n\t\t{\"negative x\", -1, 0, 0},\n\t\t{\"beyond width\", 4, 0, 0},\n\t\t{\"beyond height\", 0, 3, 0},\n\t}\n\n\tfor _, tc := range cases {\n\t\tt.Run(tc.name, func(t *testing.T) {\n\t\t\tif got := g.At(tc.x, tc.y); got != tc.want {\n\t\t\t\tt.Errorf(\"At(%d,%d) = %d, want %d\", tc.x, tc.y, got, tc.want)\n\t\t\t}\n\t\t})\n\t}\n}\n"}</code></pre>
        <pre className="plain"><code>{"go test ./...              # everything\ngo test -v ./internal/world # verbose, one line per test\ngo test -run TestGridBounds/negative ./internal/world   # one subtest\ngo test -race ./...        # with the race detector (slower, essential)\ngo test -cover ./...       # coverage percentage\ngo test -bench=. ./...     # run benchmarks\n"}</code></pre>
        <h5>Notes</h5>
        <ul>
          <li><code>t.Errorf</code> records a failure and continues; <code>t.Fatalf</code> records and stops that test
                immediately. Use <code>Fatalf</code> when continuing would panic.</li>
          <li>The message convention is <code>got X, want Y</code>. Follow it; every Go reviewer expects it.</li>
          <li><code>t.Run</code> creates subtests with their own names, which makes failures pinpoint-able and lets
                you run one case.</li>
          <li>Tests in package <code>world</code> can see unexported identifiers. A file declaring
                <code>package world_test</code> sees only the public API, which is a useful way to test that your API is
                usable.
            </li>
          <li>There is no built-in assertion library and none is expected. If you want one, <code>testify</code> is
                common, but plain <code>if</code> statements are the default and are fine.</li>
        </ul>
        <div className="exercise">
          <h5>Exercise 2.C — the capstone of Part 2</h5>
          <p>Write a small program that models a very simple version of what we are about to build. Requirements:</p>
          <ul>
            <li>A <code>Report</code> struct with an <code>AntID int</code> and a <code>Found bool</code>.</li>
            <li>A function <code>ant(ctx context.Context, id int, out chan{'<'}- Report)</code> that sends a report
                    every 50 ms until the context is cancelled, with <code>Found</code> true roughly one time in
                    four. It must return promptly on cancellation and must not block forever if nobody is reading
                    <code>out</code>.
                </li>
            <li>A <code>main</code> that starts 100 ants, collects reports for 500 ms, then cancels, waits for
                    every goroutine to finish, and prints the total number of reports and the number of finds.</li>
            <li>No data races: verify with <code>go run -race .</code>.</li>
          </ul>
          <p>Hints: one <code>select</code> in the ant with three cases; a <code>WaitGroup</code>; a buffered
                <code>out</code> channel plus a <code>default</code> case on the send if you want to avoid blocking; the
                collector goroutine should stop only after the channel is closed, and the channel should be closed only
                after all senders are done.
            </p>
        </div>
        <details>
          <summary>Solution 2.C — open after trying</summary>
          <pre><code>{"package main\n\nimport (\n\t\"context\"\n\t\"fmt\"\n\t\"math/rand\"\n\t\"sync\"\n\t\"time\"\n)\n\ntype Report struct {\n\tAntID int\n\tFound bool\n}\n\nfunc ant(ctx context.Context, id int, out chan<- Report) {\n\tticker := time.NewTicker(50 * time.Millisecond)\n\tdefer ticker.Stop()\n\n\tfor {\n\t\tselect {\n\t\tcase <-ctx.Done():\n\t\t\treturn\n\t\tcase <-ticker.C:\n\t\t\tr := Report{AntID: id, Found: rand.IntN(4) == 0}\n\t\t\tselect {\n\t\t\tcase out <- r:            // delivered\n\t\t\tcase <-ctx.Done():        // cancelled while waiting to send\n\t\t\t\treturn\n\t\t\tdefault:                  // collector is behind: drop it\n\t\t\t}\n\t\t}\n\t}\n}\n\nfunc main() {\n\tctx, cancel := context.WithCancel(context.Background())\n\tdefer cancel()\n\n\tout := make(chan Report, 1024)\n\n\tvar wg sync.WaitGroup\n\tfor i := range 100 {\n\t\twg.Add(1)\n\t\tgo func() {\n\t\t\tdefer wg.Done()\n\t\t\tant(ctx, i, out)\n\t\t}()\n\t}\n\n\t// close out only after every sender has returned\n\tgo func() {\n\t\twg.Wait()\n\t\tclose(out)\n\t}()\n\n\tvar total, finds int\n\tdone := time.After(500 * time.Millisecond)\n\ncollect:\n\tfor {\n\t\tselect {\n\t\tcase r, ok := <-out:\n\t\t\tif !ok {\n\t\t\t\tbreak collect\n\t\t\t}\n\t\t\ttotal++\n\t\t\tif r.Found {\n\t\t\t\tfinds++\n\t\t\t}\n\t\tcase <-done:\n\t\t\tcancel()          // tell the ants to stop; keep draining\n\t\t}\n\t}\n\n\tfmt.Printf(\"reports=%d finds=%d\\n\", total, finds)\n}\n"}</code></pre>
          <p>Points worth studying in this solution, because every one of them recurs in the real project:</p>
          <ul>
            <li><strong>The nested select on send.</strong> Sending on a channel can block, and a blocked send
                    ignores cancellation. Wrapping the send in its own <code>select</code> with <code>ctx.Done()</code>
                    and <code>default</code> makes it both cancellable and non-blocking.</li>
            <li><strong>Who closes.</strong> There are 100 senders, so no single sender may close. A separate
                    goroutine waits for all of them and closes afterwards. This is <em>the</em> standard fan-in shutdown
                    pattern.</li>
            <li><strong>The labelled break.</strong> <code>break</code> inside a <code>select</code> breaks the
                    <code>select</code>, not the enclosing <code>for</code>. You need a label, here
                    <code>collect:</code>, to leave the loop. This trips up everyone once.
                </li>
            <li><strong>Draining after cancel.</strong> After <code>cancel()</code>, the loop keeps receiving until
                    the channel closes, so no reports are lost and no sender is left blocked. Exiting immediately would
                    leak goroutines.</li>
            <li><code>rand.IntN</code> is the modern <code>math/rand/v2</code> spelling; on older Go it is
                    <code>rand.Intn</code> from <code>math/rand</code>.
                </li>
          </ul>
        </details>
        <h4>Part 2 checkpoint</h4>
        <ol>
          <li>Why does <code>append</code> return a value instead of modifying in place?</li>
          <li>You have <code>var m map[string]int</code>. Which of reading, writing, and <code>len</code> works?</li>
          <li>What is the difference between a nil channel and a closed channel when used in a <code>select</code>?
            </li>
          <li>Why must <code>wg.Add</code> be called before <code>go</code> rather than inside the goroutine?</li>
          <li>A function takes <code>ctx context.Context</code> but runs a tight arithmetic loop for ten seconds. Does
                <code>cancel()</code> stop it? Why not?
            </li>
          <li>Your struct has some methods with value receivers and some with pointer receivers. Name one concrete
                problem this causes.</li>
          <li>What is the difference between <code>errors.Is</code> and <code>errors.As</code>, and when does
                <code>==</code> on errors fail?
            </li>
        </ol>
        <div className="why">
          <h5>Why are we using this language here? (Part 2 summary)</h5>
          <p>Everything in this crash course exists in other languages. Go's contribution is not novelty, it is
                <em>proportion</em>: the language is small enough to hold in your head after a week, and the concurrency
                primitives are first-class rather than bolted on. You have now seen essentially all of Go except
                generics and reflection. Compare that to the fraction of C++ or Scala you would know after the same
                effort.
            </p>
          <p>The honest cost: verbosity in error handling, no sum types so "this is either A or B" is awkward, and a
                type system that will feel thin if you come from Haskell or Rust. For a simulation whose difficulty is
                concurrency rather than data modelling, that trade lands well.</p>
        </div>
        <hr />
        <h2><span className="num">Next</span>Where we go from here</h2>
        <p>The next instalment starts building. Milestone 1 creates the module properly, defines <code>World</code>,
            <code>Grid</code> and <code>Ant</code>, and runs a single ant through a deterministic tick loop with a
            seeded random source, a command-line flag or two, and the first real tests. It is intentionally not
            concurrent, because the whole point of Milestone 4 is to break it.
        </p>
        <p>Before then, two things worth doing:</p>
        <ol>
          <li>Finish exercise 2.C and run it under <code>-race</code>. If you have not seen race detector output yet,
                deliberately introduce a shared counter incremented by all 100 goroutines without synchronisation, and
                read what it tells you.</li>
          <li>Create the <code>antfarm</code> module and commit the empty skeleton. Milestone 1 assumes it exists.
            </li>
        </ol>
        <footer className="end">
          <p>Instalment 1 of the five-course curriculum. Next: Go Milestones 1–4.</p>
        </footer>
        <a className="button" href="/go-course/milestones/1-4/">Continue</a>
      </div>
    </div>
  );
}
