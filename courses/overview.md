# What kinds of problems does this language make unusually natural to solve?

Five languages, five projects, one question asked five times. This document covers the whole curriculum plan, then begins Course 1 (Go) with installation and the language crash course.

|        |                                                                                                                              |
|--------|------------------------------------------------------------------------------------------------------------------------------|
| Go     | **Digital Ant Colony.** Thousands of independent agents, channels, failure injection, eventually a small distributed system. |
| Ruby   | **Automation DSL.** A pipeline language built out of blocks and metaprogramming that inspects and rewrites itself.           |
| Perl   | **Text Archaeologist.** Ingest ugly heterogeneous data, extract entities, correlate events, build a searchable graph.        |
| Erlang | **The Internet That Never Dies.** Thousands of supervised processes that crash, restart, partition, and recover.             |
| Racket | **Language Factory.** A toolkit for defining small languages, ending in real `#lang` implementations.                        |

##### What is in this instalment

1. How the curriculum is delivered
2. Overview of the five courses
3. Prerequisites
4. Recommended order
5. Difficulty and time estimates
6. Detailed syllabus for each of the five courses
7. **Course 1 (Go), Part 0** — what we are building
8. **Course 1 (Go), Part 1** — install and first program
9. **Course 1 (Go), Part 2** — language crash course

The next instalment picks up at Go Milestone 1 and runs through the milestones with full code.

## Section 1How the curriculum is delivered

Written in full, these five courses are the size of a book. Compressing them into one response would mean deleting exactly the parts you asked for: the line-by-line explanations, the exercises, the debugging sections. So it comes in instalments, each one a self-contained document you can read on its own.

The planned sequence of instalments:

| Instalment   | Contents                                                                                  |
|--------------|-------------------------------------------------------------------------------------------|
| 1 (this one) | Curriculum map, prerequisites, order, all five syllabi, Go Parts 0–2                      |
| 2            | Go Milestones 1–4: one ant, many ants, behaviour, goroutines and the first data race      |
| 3            | Go Milestones 5–8: channels, world-as-owner, pheromones, shutdown, failure injection      |
| 4            | Go Milestones 9–12: metrics, visualisation, backpressure and profiling, distributed nodes |
| 5            | Go advanced phase, final challenge, knowledge check, README and portfolio material        |
| 6+           | Course 2 (Ruby), same structure, then Perl, Erlang, Racket                                |

Say *continue* when you want the next one. If you would rather reorder (for example, take Erlang immediately after Go so the two concurrency models sit side by side), say so and the sequence changes.

## Section 2Overview of the five courses

Each course is built around one question that the language answers unusually well. The project exists to force you into that answer.

| Course | The question the language answers                                                                        | What the project forces you to confront                                                                            |
|--------|----------------------------------------------------------------------------------------------------------|--------------------------------------------------------------------------------------------------------------------|
| Go     | How do I write a program with tens of thousands of independent activities without drowning in locks?     | Shared mutable state between concurrent agents, and the discipline of passing ownership through channels instead.  |
| Ruby   | How do I make a configuration file executable, readable, and extensible by its users?                    | The line between "data describing work" and "code performing work", and how blocks plus metaprogramming erase it.  |
| Perl   | How do I turn a pile of inconsistent, half-broken text into structured facts, fast, on the command line? | Real-world data that violates every assumption your parser makes, at a scale where you cannot load it into memory. |
| Erlang | How do I build something that keeps working while parts of it are broken?                                | Failure as a normal, expected, routinely-exercised code path rather than an exception to be prevented.             |
| Racket | How do I build the language the problem wants, instead of encoding the problem in the language I have?   | The compile-time/run-time boundary, and the fact that syntax is data you can compute with.                         |

There is a deliberate pairing structure. Go and Erlang are both about concurrency and disagree profoundly about how to get it. Ruby and Racket are both about growing a language toward the problem and disagree about whether you do that at run time or compile time. Perl stands alone as the Unix-shaped view of computing: a program is a filter, text is the universal interface.

## Section 3Prerequisites

#### What you need to already know

- **General programming.** Variables, functions, recursion, data structures, complexity, why a hash map is fast. You have written a few thousand lines of something.
- **A terminal.** `cd`, `ls`, pipes, redirection, environment variables, editing `PATH`. The Perl course leans on this heavily; the others assume it.
- **Git.** Enough to commit per milestone, which I will ask you to do, because the diffs are part of the learning.
- **An editor you are fast in.** Each course tells you how to wire up the language server.

#### What you do not need

Any prior exposure to these five languages, functional programming, actor models, compiler theory, or distributed systems. Every term gets defined when it first appears. Where a concept is genuinely hard (hygiene in macros, split-brain in distributed systems) it gets its own section rather than a parenthesis.

#### Machine and environment

- Any machine from the last decade with about 10 GB free. The Go and Erlang projects spawn tens of thousands of lightweight tasks, which is a memory question rather than a CPU question, and 8 GB of RAM is plenty.
- macOS, Linux, or Windows. Commands are given for all three. On Windows, **WSL2** (Windows Subsystem for Linux) is strongly recommended for the Perl and Erlang courses, and optional for the rest. Native Windows instructions are included where they differ.
- Docker is optional throughout. The distributed stages of Go and Erlang work fine as multiple processes on one machine.

#### Time

Roughly 180–260 hours for all five if you do the exercises rather than reading past them. At six hours a week that is about a year. At fifteen it is about four months. Doing one course properly beats skimming five.

## Section 4Recommended order

The courses are numbered as you listed them, but the order I recommend studying them in is different:

```
  Go  ──────────►  Erlang  ──────────►  Ruby  ──────────►  Racket
  (1)               (4)                  (2)                (5)
   │                                                          
   └── Perl (3) fits anywhere; it shares no concepts with the others
```

The reasoning:

- **Go first.** Its syntax is the least surprising of the five, its tooling is the best, and its error messages are the kindest. You spend your energy on concurrency rather than on the language.
- **Erlang second, while Go is fresh.** The moment you have hand-written a supervisor goroutine that restarts crashed ants, Erlang's supervision trees land as "oh, this is built in, and thought through far more carefully than mine". That contrast is worth a great deal and it fades if you wait a year.
- **Ruby third.** After two courses of systems thinking, a course about expressiveness is a real change of gear. It also introduces DSL design at run time.
- **Racket fourth.** Racket is the same ambition as the Ruby course pushed to its conclusion: the Ruby DSL is a library pretending to be a language, and Racket makes it an actual language. Having felt the limits of the Ruby approach makes macros feel necessary rather than clever.
- **Perl whenever.** It depends on nothing and nothing depends on it. It is a good palate cleanser after Erlang, and a good warm-up if you want an easy start.

If you would rather work strictly in the numbered order, nothing breaks. The Ruby-then-Racket connection is the only one I would try to preserve.

## Section 5Difficulty and learning goals

Four different kinds of difficulty, rated 1 (easy) to 5 (hard), because they are not the same thing. A language can have easy syntax and a brutal conceptual model, or the reverse.

| Course | Syntax | Tooling | Concepts | Debugging | Hours |
|--------|--------|---------|----------|-----------|-------|
| Go     | 2      | 1       | 3        | 3         | 35–50 |
| Ruby   | 2      | 2       | 3        | 2         | 30–45 |
| Perl   | 4      | 3       | 2        | 3         | 30–45 |
| Erlang | 4      | 3       | 5        | 4         | 45–65 |
| Racket | 3      | 2       | 5        | 3         | 40–60 |

Notes on the ratings. Go's concept score is entirely concurrency; the rest of the language is deliberately small. Perl's syntax score is high because of sigils and context, a rule that has no equivalent in most languages, and its debugging score is high because a typo can be silently valid. Erlang is hard on every axis at once: unfamiliar syntax, an unfamiliar build tool, and a model that asks you to unlearn defensive programming. Racket's syntax is trivial to read after an hour, and its concept score comes entirely from macros and phase separation.

#### Learning goals, stated as things you will be able to do

- **Go:** design a concurrent system where ownership of data is explicit; read a race detector report and fix the cause; shut a system down cleanly under load; profile and find the actual bottleneck.
- **Ruby:** design an internal DSL that reads like a language, is testable, produces an inspectable intermediate representation, and can be extended by third parties without editing your source.
- **Perl:** build a streaming data pipeline that survives malformed input, correlates records across sources, and runs as a well-behaved Unix citizen.
- **Erlang:** design a supervision tree; choose restart strategies with reasons; reason about what happens during a network partition; observe a live system without stopping it.
- **Racket:** implement an interpreter, then a compiler, for a small language; write hygienic macros with good error messages; ship a working `#lang`.

## Section 6Detailed syllabi

Each course follows the same shape: Part 0 (what we are building), Part 1 (install and first program), Part 2 (language crash course), then twelve milestones, then an advanced phase, a final challenge, and a knowledge check. Below is the milestone plan for each.

### Course 1 — Go: Digital Ant Colony

| \# | Milestone                              | Concepts introduced                                                                       |
|----|----------------------------------------|-------------------------------------------------------------------------------------------|
| 1  | One ant on a grid, ticking             | structs, methods, pointers, slices, CLI flags, package layout                             |
| 2  | A thousand ants, still sequential      | maps, deterministic randomness, table tests, benchmarks as a baseline                     |
| 3  | Behaviour: forage, carry, return       | interfaces, state machines, errors and `errors.Is`                                        |
| 4  | Each ant becomes a goroutine           | goroutines, `WaitGroup`, the first real data race, `go test -race`, mutexes               |
| 5  | Replace locks with channels            | channels, `select`, the world as a single owning goroutine, request/reply                 |
| 6  | Pheromones and evaporation             | tickers, fan-in, buffered channels, time in simulations                                   |
| 7  | Graceful shutdown                      | `context`, signal handling, `errgroup`, goroutine-leak tests                              |
| 8  | Chaos: crashes, drops, slow ants       | `panic`/`recover`, supervisor goroutines, timeouts, fault injection as config             |
| 9  | Metrics and introspection              | atomics, `expvar`, an HTTP endpoint, `net/http/pprof`                                     |
| 10 | Live visualisation                     | terminal rendering, a web view over server-sent events, decoupling render from simulation |
| 11 | Backpressure and performance           | worker pools, bounded queues, load shedding, escape analysis, allocation profiles         |
| 12 | Multiple colony nodes over the network | encoding, TCP servers, reconnection, partitions, chaos tests across processes             |

### Course 2 — Ruby: Programmable Automation DSL

| \# | Milestone                                | Concepts introduced                                                               |
|----|------------------------------------------|-----------------------------------------------------------------------------------|
| 1  | A gem skeleton and a Step object         | objects, methods, `bundler`, project layout, `irb`                                |
| 2  | `pipeline "x" do ... end` that runs      | blocks, `yield`, procs and lambdas, the builder pattern                           |
| 3  | Bare keywords inside the block           | `instance_eval`, `self`, scope gates, the cost of a clean DSL                     |
| 4  | Build an AST instead of executing        | value objects, immutability by convention, separating description from execution  |
| 5  | The execution engine                     | the interpreter pattern, a context object, step results, logging                  |
| 6  | Failure handling: `when_failed`, retries | exception classes, `ensure`, `retry`, designing recoverable steps                 |
| 7  | Steps registered dynamically             | `define_method`, `method_missing`, `respond_to_missing?`, registries              |
| 8  | Steps that do real work                  | HTTP, file and SQLite outputs, pluggable summarisers, configuration               |
| 9  | Testing a DSL                            | RSpec, doubles, a test DSL for the DSL, contract tests for plugins                |
| 10 | Self-inspection                          | reflection, `to_h`, dry runs, graph rendering, instrumentation via module prepend |
| 11 | Pipelines that rewrite themselves        | AST transformation at run time, middleware, hooks, safety limits                  |
| 12 | Ship it as a gem                         | gemspec, versioning, a CLI, YARD docs, publishing                                 |

### Course 3 — Perl: Text Archaeologist

| \# | Milestone                           | Concepts introduced                                                             |
|----|-------------------------------------|---------------------------------------------------------------------------------|
| 1  | A filter that reads standard input  | scalars, `strict`/`warnings`, `perldoc`, the diamond operator                   |
| 2  | Counting and summarising            | arrays, hashes, context (the rule with no equivalent elsewhere), sorting        |
| 3  | Parsing Apache and nginx logs       | regexes, named captures, anchors, greediness, `//x` readable patterns           |
| 4  | A record model                      | references, nested data, `Data::Dumper`, the arrow rule                         |
| 5  | Splitting into modules              | packages, `lib/`, `use`, `cpanm`, local::lib, dependency management             |
| 6  | Pluggable format readers            | CSV, JSON and XML modules, dispatch tables, sniffing formats                    |
| 7  | Streaming a 10 GB file              | line-by-line processing, encodings, memory profiling, malformed-input policy    |
| 8  | Entity extraction and normalisation | IPs, timestamps, paths, identifiers; canonical forms; time zones                |
| 9  | Correlation and sessionisation      | time windows, joins, SQLite via DBI, indexes                                    |
| 10 | A real command-line tool            | `Getopt::Long`, exit codes, signals, pipes, `--help`, composability             |
| 11 | Testing and profiling               | `Test2`, `prove`, fuzzing with corrupted input, `Devel::NYTProf`, optimisation  |
| 12 | The knowledge graph                 | graph storage, queries, forking for parallelism, plugin architecture, packaging |

### Course 4 — Erlang: The Internet That Never Dies

| \# | Milestone                     | Concepts introduced                                                                 |
|----|-------------------------------|-------------------------------------------------------------------------------------|
| 1  | The shell and a first module  | `erl`, expressions, atoms, compiling, `rebar3`                                      |
| 2  | Functions over data           | pattern matching, immutability, lists/tuples/maps, recursion, tail calls, guards    |
| 3  | A node as a raw process       | `spawn`, `!`, `receive`, mailboxes, selective receive                               |
| 4  | Let it crash                  | links, monitors, exit signals, `trap_exit`, why defensive code is discouraged       |
| 5  | The node as a `gen_server`    | OTP behaviours, `call` vs `cast`, state, timeouts                                   |
| 6  | Supervision trees             | restart strategies, intensity limits, dynamic children, startup ordering            |
| 7  | A network of a thousand nodes | registries, `ETS`, process groups, routing, message loss                            |
| 8  | Chaos injection               | random crashes, slow handlers, malformed messages, memory pressure                  |
| 9  | Observability                 | counters, `observer`, `recon`, tracing a live system safely                         |
| 10 | The live dashboard            | an HTTP server in Erlang, streaming updates, aggregation without slowing the system |
| 11 | Actually distributed          | multiple BEAM nodes, cookies, `net_kernel`, partitions, split brain                 |
| 12 | Releases and property tests   | EUnit, Common Test, PropEr, `relx` releases, upgrades                               |

### Course 5 — Racket: Language Factory

| \# | Milestone                            | Concepts introduced                                                       |
|----|--------------------------------------|---------------------------------------------------------------------------|
| 1  | Racket, DrRacket, and `raco`         | s-expressions, definitions, modules, the REPL                             |
| 2  | Functional groundwork                | lists, pairs, higher-order functions, recursion, `match`                  |
| 3  | Structs and contracts                | `struct`, contracts as executable specifications, error messages          |
| 4  | An interpreter for a config language | AST design, environments, evaluation, `quote` vs data                     |
| 5  | First macros                         | `define-syntax-rule`, hygiene demonstrated by breaking it                 |
| 6  | Real macros                          | `syntax-parse`, syntax classes, compile-time errors with source locations |
| 7  | The finance DSL                      | validation passes, a small type checker, phase separation                 |
| 8  | The toolkit itself                   | generating parsers, AST types and checkers from a specification           |
| 9  | Your own `#lang`                     | readers, module languages, `#lang finance` files that run                 |
| 10 | The robot DSL                        | effects, sequencing, a stepper, interpreters as libraries                 |
| 11 | Compiling instead of interpreting    | macro-based compilation, benchmarks against the interpreter               |
| 12 | Tooling and the game DSL             | `rackunit`, editor integration, packaging, the capstone language          |

* * *

## Course 1 · Part 0Go: what are we building?

### The final result

A program called `antfarm`. At the end of the course you will be able to run:

```
$ antfarm run --ants 50000 --grid 512x512 --food 400 \
      --chaos crash=0.001,drop=0.02,slow=0.005 \
      --metrics :9090 --view web:8080

colony: 50000 ants, 512x512 grid, 400 food sources
tick 1200 | alive 49863 | carrying 8214 | food delivered 31902
           | restarts 137 | dropped msgs 4411 | p99 decide 412µs
```

while a browser tab shows the grid with pheromone trails intensifying along routes the colony has discovered, a Prometheus-style metrics endpoint exposes counters, and `go tool pprof` can attach to the running process and tell you where the CPU is going. In the final milestone the colony runs split across several operating-system processes that talk over TCP, and you can kill one of them and watch the rest continue.

### Why this project is interesting

Ant colonies are the canonical example of emergent behaviour: no ant knows where the food is, no ant is in charge, and yet the colony reliably finds short paths to food. The algorithm behind it is real (ant colony optimisation is a genuine technique for routing and scheduling problems), and it happens to be an almost perfect Go exercise, because the natural implementation is thousands of independent activities exchanging small messages.

It is also a trap, in a useful way. The obvious first implementation puts the world in a shared data structure and lets every ant touch it. That works until you add concurrency, at which point it corrupts itself in ways that only appear under load. Milestone 4 walks you into that bug deliberately, and Milestone 5 walks you out of it using the idiom Go actually recommends. That sequence is the single most valuable thing in this course.

### Why Go in particular

- **Goroutines are cheap.** A goroutine starts with about 2 KB of stack that grows on demand, so 50,000 of them is unremarkable. 50,000 operating-system threads would be roughly 50 GB of reserved stack and a scheduler in agony. This is what makes "one ant, one goroutine" a reasonable design rather than a joke.
- **Channels make ownership explicit.** Sending a value on a channel is a statement about who is allowed to touch it next. That turns a concurrency question into a design question you can see in the code.
- **The race detector is built in.** `go test -race` and `go run -race` instrument memory accesses and report exactly which two goroutines touched the same address without synchronisation, with both stack traces. Very few languages hand you this for free.
- **Profiling is built in.** CPU, memory, blocking and mutex-contention profiles come from the standard library, with a viewer in the toolchain.
- **The static binary matters at the end.** When we go multi-process, deploying is copying one file.

##### Why are we using this language here?

Honestly: Erlang would be better at the fault-tolerance half of this project, and you will see why in Course 4. Erlang gives you supervision, isolated heaps, and true preemption; in Go, a panicking goroutine kills the whole process unless you catch it, and a goroutine stuck in a tight loop cannot be cancelled by force. In Milestone 8 you will hand-build a supervisor that Erlang would have given you.

What Go wins on is the combination: it is fast, statically typed, trivially deployable, has excellent profiling, and its concurrency is cheap enough for this scale while remaining familiar enough that you can be productive in a week. Python's `asyncio` could express the structure but would be roughly two orders of magnitude slower at 50,000 agents; Rust would be faster and safer but would spend your attention on the borrow checker instead of on concurrency design; Java's virtual threads (Project Loom) are now genuinely comparable and would be a fair alternative.

### What is genuinely Go-specific here

Worth separating, so you know what transfers:

| Transfers to other languages                                  | Specific to Go                                                              |
|---------------------------------------------------------------|-----------------------------------------------------------------------------|
| The idea that concurrency is a design problem about ownership | `select` with multiple channel cases and a `default`                        |
| Backpressure, bounded queues, load shedding                   | Channel closing semantics and the "close means done" convention             |
| Supervision and restart strategies                            | `context.Context` as a cancellation value threaded through call chains      |
| Profiling methodology                                         | Implicit interface satisfaction and small interfaces                        |
| Chaos testing                                                 | `defer`/`recover`, and the culture of returning errors rather than throwing |

### Architecture we are building toward

```
                          ┌──────────────────────────┐
                          │        cmd/antfarm       │  flags, config, wiring
                          └────────────┬─────────────┘
                                       │
        ┌──────────────────────────────┼──────────────────────────────┐
        │                              │                              │
┌───────▼────────┐            ┌────────▼─────────┐          ┌─────────▼────────┐
│   sim engine   │            │   observability  │          │      viewer      │
│                │            │                  │          │                  │
│  world owner   │◄─ queries ─┤  metrics, pprof, │          │  terminal / web  │
│   goroutine    │            │  event log       │          │   (read-only)    │
└───┬────────┬───┘            └──────────────────┘          └─────────▲────────┘
    │        │                                                       │
    │        └───────────── snapshots (channel, buffered) ───────────┘
    │
    │  requests: Move, Sense, PickUp, Drop, Deposit
    │  replies:  per-request reply channel
    │
┌───▼──────────────────────────────────────────────────────────┐
│   ant goroutines  (N = 1..50,000)                            │
│                                                              │
│   ant 1 ──┐                                                  │
│   ant 2 ──┤                                                  │
│    ...    ├──► requests channel ──► world owner ──► replies  │
│   ant N ──┘                                                  │
└───┬──────────────────────────────────────────────────────────┘
    │
┌───▼───────────┐     ┌────────────────┐     ┌──────────────────┐
│  supervisor   │     │  pheromone     │     │  chaos injector  │
│  (restarts    │     │  evaporator    │     │  (crash, drop,   │
│   dead ants)  │     │  (ticker)      │     │   delay)         │
└───────────────┘     └────────────────┘     └──────────────────┘
```

Do not worry about understanding this yet. It is here so that when Milestone 5 introduces "the world owner goroutine" you can see where it fits. The important structural idea, which you will earn rather than be told, is that *exactly one goroutine owns the world state*, and everyone else asks it questions.

### What you will know afterwards

You will be able to explain, from having done it: why a mutex-per-cell design deadlocks and a single-owner design does not; what the race detector actually detects and what it misses; why an unbuffered channel send is a synchronisation point; how to cancel 50,000 goroutines in under a millisecond; how to tell an allocation problem from a contention problem in a profile; and what "backpressure" means in code rather than in a blog post.

* * *