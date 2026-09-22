import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/right_to_left/glasses.png';
import img2 from '../../../../courses/assets/expressions/left_to_right/looking_bad.png';
import img3 from '../../../../courses/assets/expressions/right_to_left/thinking.png';
import img4 from '../../../../courses/assets/expressions/left_to_right/paw.png';
import img5 from '../../../../courses/assets/expressions/right_to_left/happy.png';
import img6 from '../../../../courses/assets/expressions/back.png';

export const metadata: Metadata = {
  title: "Go: Advanced Phase, Final Challenge, Knowledge Check",
};

export default function Page() {
  return (
    <div className="theme-go">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 5 · Course 1 (Go) · Advanced phase and finish</p>
          <h1>What an experienced Go programmer does next, and whether you can now explain any of it</h1>
          <p className="lede">Six advanced topics with working code, one substantial final challenge with its solution withheld, a knowledge check of forty-one questions, and everything you need to put this on GitHub and defend it in an interview.</p>
        </header>
        <h2><span className="num">Part A</span>The advanced phase</h2>
        <p>
          <img className="mascot-right" src={img1.src} alt="The Mewlang cat, wearing glasses, looking confident" width="120" />
          The colony works. These six topics are what you would reach for if this were a system you had to operate rather than a system you had to finish. Each is short, each has code you can drop in, and each names what to measure afterwards.
        </p>
        <h3>A1 · Worker pools and bounded concurrency</h3>
        <p>"One goroutine per ant" is right because ants are the unit of simulation. "One goroutine per unit of work" is wrong for most other things: parsing 50,000 files, calling an API for each of 10,000 records, or replaying a chaos schedule. Unbounded goroutines mean unbounded memory, unbounded file descriptors, and a remote service you have accidentally attacked.</p>
        <p>The Go idiom for a bound is a buffered channel used as a counting semaphore. A slot in the buffer is a permit.</p>
        <pre><code>{"// Pool runs at most n tasks at once. The semaphore is a buffered channel:\n// each slot in the buffer is a permit.\ntype Pool struct {\n\tsem chan struct{}\n\twg  sync.WaitGroup\n}\n\nfunc NewPool(n int) *Pool { return &Pool{sem: make(chan struct{}, n)} }\n\n// Go blocks until a permit is free, which is where backpressure happens.\nfunc (p *Pool) Go(ctx context.Context, f func()) error {\n\tselect {\n\tcase p.sem <- struct{}{}:\n\tcase <-ctx.Done():\n\t\treturn ctx.Err()\n\t}\n\tp.wg.Add(1)\n\tgo func() {\n\t\tdefer p.wg.Done()\n\t\tdefer func() { <-p.sem }()\n\t\tf()\n\t}()\n\treturn nil\n}\n\nfunc (p *Pool) Wait() { p.wg.Wait() }\n"}</code></pre>
        <p>Three details that separate this from the versions you find on blogs. The acquire is a <code>select</code> with <code>ctx.Done()</code>, so a saturated pool can still be shut down. The release is a <code>defer</code> inside the goroutine, so a panicking task still returns its permit. And <code>Go</code> blocks rather than queueing, which means the <em>caller</em> feels the backpressure and stops producing work: a queue you cannot see is a queue that grows until you run out of memory.</p>
        <p>With generics, the same idea becomes a reusable parallel map:</p>
        <pre><code>{"// MapConcurrent applies f to every element with bounded concurrency and\n// returns results in input order. Generics make it reusable; the result\n// slice is preallocated so workers write disjoint indices with no lock.\nfunc MapConcurrent[T, R any](ctx context.Context, in []T, workers int,\n\tf func(context.Context, T) (R, error)) ([]R, error) {\n\n\tout := make([]R, len(in))\n\terrs := make([]error, len(in))\n\n\tpool := NewPool(workers)\n\tfor i, v := range in {\n\t\tif err := pool.Go(ctx, func() {\n\t\t\tout[i], errs[i] = f(ctx, v)\n\t\t}); err != nil {\n\t\t\tbreak\n\t\t}\n\t}\n\tpool.Wait()\n\n\tfor _, err := range errs {\n\t\tif err != nil {\n\t\t\treturn out, err\n\t\t}\n\t}\n\treturn out, ctx.Err()\n}\n"}</code></pre>
        <p><code>[T, R any]</code> declares two type parameters; <code>any</code> is the constraint meaning "any type at all". The important trick is not the generics, it is that <strong>writing to distinct indices of a preallocated slice from many goroutines is race-free</strong>. Each index is a separate memory location and the slice header never changes, so no synchronisation is needed. Appending to a shared slice would be a race; this is not. That distinction is worth internalising, because it turns a whole class of "collect the results" problems into lock-free code.</p>
        <p><strong>What to measure:</strong> throughput against worker count, and the memory high-water mark with and without the bound. The optimum worker count for CPU work is around <code>GOMAXPROCS</code>; for I/O-bound work it is much higher and should be found empirically.</p>
        <h3>A2 · A taxonomy of backpressure</h3>
        <p>You have now implemented three of these four without naming them. Naming them is what lets you choose deliberately.</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Policy</th>
              <th>Code shape</th>
              <th>Use when</th>
              <th>In the colony</th>
            </tr>
            <tr>
              <td>Block</td>
              <td><code>ch {'<'}- v</code></td>
              <td>The producer can usefully slow down</td>
              <td>Ant requests to the owner</td>
            </tr>
            <tr>
              <td>Shed</td>
              <td><code>select</code> with <code>default</code></td>
              <td>The message is optional or stale-able</td>
              <td>Pheromone deposits, evaporation ticks</td>
            </tr>
            <tr>
              <td>Time out</td>
              <td><code>select</code> with a timer</td>
              <td>Waiting longer has no value</td>
              <td>Round trips, frame requests</td>
            </tr>
            <tr>
              <td>Reject</td>
              <td>Return an error at admission</td>
              <td>You must protect a downstream</td>
              <td>Not implemented; see below</td>
            </tr>
          </tbody>
        </table>
        <p>The one you have not built is admission control: refusing work at the front door so that accepted work still completes on time. It is the difference between a system that degrades and a system that collapses, and the shape is three lines:</p>
        <pre><code>{"\tif depth := len(e.reqs); depth > e.cfg.QueueSize*3/4 {\n\t\te.M.Rejected.Inc()\n\t\treturn response{err: ErrOverloaded}   // fail fast, do not queue\n\t}\n"}</code></pre>
        <p>The counter-intuitive part is that rejecting 10% of requests instantly can leave the other 90% faster than accepting 100% and serving them all slowly, because queueing delay compounds. When every request waits 8 ms behind a queue, clients time out and retry, which adds load, which lengthens the queue. Little's Law states it precisely: for a stable system, <em>average queue length = arrival rate × average time in system</em>. You cannot choose all three, so choose which one you will control.</p>
        <p><strong>What to measure:</strong> queue depth as a time series (not an average), latency percentiles at several arrival rates, and the point where p99 latency turns sharply upward. That knee is your capacity, and it is always lower than the throughput number you can quote.</p>
        <h3>A3 · Testing concurrency like you mean it</h3>
        <p>Five techniques, in increasing order of how much they will surprise you.</p>
        <p><strong>1. Run tests repeatedly under the race detector.</strong> <code>go test -race -count=20 ./...</code> in CI. A single pass proves almost nothing about interleaving, and twenty passes cost seconds.</p>
        <p><strong>2. Keep a deterministic oracle.</strong> This is why the sequential <code>Sim</code> from Milestone 3 was never deleted. It is slow, boring and exactly reproducible, which makes it the reference implementation: given the same seed and the same number of ticks, the concurrent engine should agree with it on invariants (food conserved, no negative cells, ants inside the grid) even though it cannot agree on exact positions. <strong>A slow, obviously-correct implementation is a testing asset, not dead code.</strong></p>
        <p><strong>3. Test invariants, not outputs.</strong> Every genuine bug in this project was caught by conservation, not by an expected value. Concurrent systems have no expected output; they have properties that must hold.</p>
        <p><strong>4. Fuzz the behaviours.</strong> A <code>Behaviour</code> is untrusted input to the engine, so fuzz it:</p>
        <pre><code>{"func FuzzApplyAction(f *testing.F) {\n\tf.Add(5, 5, 1, 0, uint8(1))\n\tf.Fuzz(func(t *testing.T, x, y, dx, dy int, kind uint8) {\n\t\te := NewEngine(Config{Width: 16, Height: 16, Ants: 1}, Forager{})\n\t\tact := Action{Kind: ActionKind(kind % 4), Dir: world.Position{X: dx, Y: dy}}\n\t\t// The engine must never panic, whatever an ant asks for.\n\t\te.applyAction(request{id: 0, pos: world.Position{X: x, Y: y}, act: act})\n\t})\n}\n"}</code></pre>
        <p>Run with <code>go test -fuzz FuzzApplyAction</code>. The fuzzer mutates inputs, keeps anything that reaches new code paths, and writes failing cases to <code>testdata/fuzz/</code> where they become permanent regression tests. It found nothing in my version because every grid access is bounds-checked, which is precisely the kind of "nothing" you want evidence for.</p>
        <p><strong>5. Detect leaks explicitly.</strong> Our poll-and-compare test is the homemade version; <code>go.uber.org/goleak</code> is the real one and reports the leaked stacks. Add it to <code>TestMain</code> and every test in the package is covered at once.</p>
        <div className="note">
          <h5>Virtual time</h5>
          <p>Recent Go versions add <code>testing/synctest</code>, which runs a test in a bubble with a fake clock: <code>time.Sleep(time.Hour)</code> returns instantly, and the bubble waits until every goroutine in it is blocked before advancing time. That turns "run for 300 ms and hope" tests, which this project has several of, into deterministic ones that finish in microseconds. It arrived as an experiment behind <code>GOEXPERIMENT=synctest</code> and has been stabilising since; check whether your toolchain has it before designing around it, and if it does, rewriting the timing-dependent tests here is an excellent exercise.</p>
        </div>
        <h3>A4 · Deterministic chaos</h3>
        <p>Milestone 8's chaos rolls dice inside each ant, which makes a failing run unreproducible in the one way that matters: you cannot replay it. The fix is to decide the failures up front.</p>
        <pre><code>{"// Schedule is a precomputed list of failures. Because it is built once from\n// a seed, a chaotic run replays exactly, which is the difference between a\n// bug you can fix and a bug you can only describe.\ntype Schedule struct {\n\tfaults []Fault\n\tnext   int\n}\n\nfunc BuildSchedule(seed uint64, ticks, ants int, ratePerTick float64) *Schedule {\n\trng := rand.New(rand.NewPCG(seed, 0xA5A5))\n\tvar faults []Fault\n\tfor t := range ticks {\n\t\tif rng.Float64() >= ratePerTick {\n\t\t\tcontinue\n\t\t}\n\t\tfaults = append(faults, Fault{\n\t\t\tTick:  t,\n\t\t\tAntID: rng.IntN(ants),\n\t\t\tKind:  FaultKind(rng.IntN(3)),\n\t\t})\n\t}\n\treturn &Schedule{faults: faults}\n}\n\n// Due reports the faults scheduled at or before tick t. Called only by the\n// owner goroutine, so it needs no synchronisation and no allocation.\nfunc (s *Schedule) Due(t int) []Fault {\n\tstart := s.next\n\tfor s.next < len(s.faults) && s.faults[s.next].Tick <= t {\n\t\ts.next++\n\t}\n\treturn s.faults[start:s.next]\n}\n"}</code></pre>
        <p>Now a failing CI run reports "seed 8841, 400 ticks" and you reproduce it exactly on your laptop. The schedule can also be written to a file and checked in next to the bug it exposed.</p>
        <p>This is one step short of what the state of the art does. FoundationDB and TigerBeetle run their entire system inside a deterministic simulator where time, scheduling, disk and network are all controlled by one seed, so <em>every</em> interleaving is reproducible and the fuzzer can search the space of schedules. That is a large engineering investment and it is why those systems are unusually trustworthy. Knowing it exists changes what you consider possible.</p>
        <p><strong>What to measure:</strong> that the same seed produces byte-identical failure output twice. If it does not, you still have a source of nondeterminism you have not captured.</p>
        <h3>A5 · Structured logs and the execution tracer</h3>
        <p>Counters tell you a rate; logs tell you a story. Go 1.21 added <code>log/slog</code> to the standard library, so structured logging no longer needs a dependency:</p>
        <pre><code>{"\tlogger := slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{\n\t\tLevel: slog.LevelInfo,\n\t}))\n\tslog.SetDefault(logger)\n\n\tslog.Info(\"colony started\", \"ants\", cfg.Ants, \"grid\", cfg.Width, \"seed\", cfg.Seed)\n\n\t// A logger carrying context, created once per ant rather than per line.\n\tlog := slog.With(\"ant\", a.ID, \"gen\", a.Generation)\n\tlog.Warn(\"restarting after crash\", \"pos\", a.Pos.String(), \"carrying\", a.Carrying)\n"}</code></pre>
        <p>Key-value pairs rather than formatted strings, so a log aggregator can filter on <code>ant=4471</code> without regular expressions. Two rules for a system like this one: <strong>never log per tick</strong> (three million requests a second will produce more log volume than simulation), and <strong>sample or aggregate anything that can happen per ant</strong>. A log line costs microseconds; a counter costs nanoseconds. Log the exceptional, count the routine.</p>
        <p>Then there is the tool almost nobody uses and everybody should:</p>
        <pre className="plain"><code>{"$ curl -o trace.out \"127.0.0.1:9090/debug/pprof/trace?seconds=5\"\n$ go tool trace trace.out\n"}</code></pre>
        <p>This opens a browser view of what every goroutine did, when, on which processor, including scheduler latency, garbage collection pauses, syscall blocking and network waits. Where <code>pprof</code> tells you <em>where</em> time went, the tracer tells you <em>why</em> a goroutine was not running. For this project the interesting view is "Synchronization blocking profile", which shows the ants queued behind the owner as a wall of parked goroutines. No other mainstream language ships anything this good with the runtime.</p>
        <h3>A6 · Shipping it</h3>
        <pre className="plain"><code>{"# a stamped, stripped, static binary\ngo build -trimpath -ldflags \"-s -w -X main.version=$(git describe --tags --always)\" \\\n   -o bin/antfarm ./cmd/antfarm\n\n# cross-compile: no toolchain to install, no container needed\nGOOS=linux GOARCH=arm64 go build -o bin/antfarm-linux-arm64 ./cmd/antfarm\n"}</code></pre>
        <p><code>-trimpath</code> removes your home directory from the binary, <code>-s -w</code> strip debug information (halving the size, at the cost of readable panic traces: keep them if you value stack traces more than megabytes), and <code>-X</code> sets a string variable at link time, which is the standard way to embed a version. Cross-compilation needs nothing installed, which is genuinely unusual and is why so much infrastructure tooling is written in Go.</p>
        <pre className="plain"><code>{"FROM golang:1.25 AS build\nWORKDIR /src\nCOPY . .\nRUN CGO_ENABLED=0 go build -trimpath -ldflags \"-s -w\" -o /antfarm ./cmd/antfarm\n\nFROM gcr.io/distroless/static-debian12\nCOPY --from=build /antfarm /antfarm\nEXPOSE 8080 9090\nUSER 65534:65534\nENTRYPOINT [\"/antfarm\"]\n"}</code></pre>
        <p><code>CGO_ENABLED=0</code> produces a binary with no libc dependency, which is what makes the final image a few megabytes with no operating system in it. Distroless (or <code>scratch</code>) means no shell, no package manager and nothing for an attacker to pivot into.</p>
        <div className="warn">
          <h5>The container CPU trap</h5>
          <p>
            <img className="mascot-left" src={img2.src} alt="The Mewlang cat, giving an unimpressed side-eye" width="120" />
            Go sets <code>GOMAXPROCS</code> from the number of CPUs it can see, and in a container that is the number of host cores, not your CPU limit. A binary limited to 0.5 cores on a 64-core host will happily create 64 scheduler threads and spend its life being throttled. Set <code>GOMAXPROCS</code> explicitly from your limit, or use <code>go.uber.org/automaxprocs</code>, which reads the cgroup quota at startup. This is one of the most common and least-known causes of "our Go service is mysteriously slow in Kubernetes". 
          </p>
          <p>Similarly, Go's garbage collector targets a heap multiple, not a memory limit, so a container can be OOM-killed while the GC is being patient. <code>GOMEMLIMIT</code> (Go 1.19+) gives it a soft ceiling; set it to about 90% of the container limit.</p>
        </div>
        <hr />
        <h2><span className="num">Part B</span>The final challenge</h2>
        <p>
          <img className="mascot-right" src={img3.src} alt="The Mewlang cat, thinking, paw to chin" width="120" />
          Everything up to here had a solution a few paragraphs later. This one does not, and you should spend real time on it before opening the last section. It is deliberately at the edge of what you can now do, and it is the kind of thing that makes a portfolio project memorable.
        </p>
        <h3>Migrating ants across a sharded, failing world</h3>
        <p>Milestone 12 put the whole world in one remote process. Now split it: <strong>K world processes, each owning a region of the grid, with ants that walk from one region into another.</strong></p>
        <h4>Requirements</h4>
        <ol>
          <li>Run K world nodes (start with 3), each owning a contiguous band of rows, configured statically at startup. Each exposes the Milestone 12 protocol for its own region.</li>
          <li>Run an ant process with N ants. Each ant talks to whichever node owns the region it currently occupies. </li>
          <li>When an ant's move crosses a region boundary, its state (<code>ID</code>, <code>Carrying</code>, <code>Energy</code>, <code>Generation</code>) must migrate to the new node's ant table. <strong>Exactly once.</strong> An ant may never exist on two nodes, and may never disappear.</li>
          <li>Nodes fail. Kill any node at any moment, including mid-migration, and the colony must continue: ants in the dead region wait, ants elsewhere keep working, and a restarted node rejoins.</li>
          <li>Detect failure with heartbeats. A node that has not been heard from within a configurable window is marked unavailable; ants that would enter its region bounce back instead.</li>
          <li>Observability: per-node ant count, migrations per second, in-flight handoffs, failed handoffs, duplicate-suppression hits, and node up/down state, all on the existing <code>/metrics</code> endpoint. </li>
        </ol>
        <h4>Constraints</h4>
        <ul>
          <li>No external dependencies. No etcd, no Redis, no message broker. Standard library only.</li>
          <li>No global lock and no single coordinator process. The nodes talk to each other directly.</li>
          <li>Handoff must be safe under message loss, message duplication and node death at any step. Assume the network can drop, delay and duplicate, but not corrupt.</li>
          <li>Bounded memory: no structure may grow without limit, including whatever you use to suppress duplicates. </li>
        </ul>
        <h4>Acceptance criteria</h4>
        <ol>
          <li><strong>Conservation under chaos.</strong> A 60-second run with 3 nodes, 1,000 ants, one node killed and restarted every 10 seconds, ends with: food delivered + food on the ground + food carried + food lost equal to the starting total, where "lost" is explicitly accounted rather than unexplained.</li>
          <li><strong>No duplicates.</strong> At the end, the union of all node ant tables contains each ant ID exactly once. Assert it in a test.</li>
          <li><strong>Liveness.</strong> Food delivered during the chaotic run is at least 50% of a clean run of the same length. A system that survives by doing nothing does not pass.</li>
          <li><strong>Clean tooling.</strong> <code>go test -race -count=5 ./...</code> passes, the leak test still passes, and <code>go vet</code> is silent.</li>
          <li><strong>Documented protocol.</strong> A <code>docs/handoff.md</code> with a message diagram and a table of every failure point and what happens there.</li>
        </ol>
        <h4>Hints, in increasing order of how much they give away</h4>
        <ul>
          <li>The hard part is not moving the ant. It is that "send the ant and delete it locally" has no safe ordering: delete first and a lost message loses the ant; send first and a lost acknowledgement duplicates it.</li>
          <li>You cannot make a network message exactly-once. You can make it at-least-once and make the <em>receiver</em> idempotent, which is indistinguishable from exactly-once to everyone downstream. What does the receiver need to remember, and for how long?</li>
          <li>Think of an ant as having exactly one owner at a time, and the handoff as transferring a lease. What state does the sender need between "I no longer own it" and "they confirmed they do"?</li>
          <li>The bounded-memory constraint is about the deduplication table. Migration IDs must be forgettable eventually. What makes it safe to forget one?</li>
          <li>Heartbeats give you failure <em>detection</em>, not failure <em>knowledge</em>. A node you cannot reach may be alive and reachable by someone else. What does your design do if two nodes disagree about whether a third is up?</li>
        </ul>
        <p>Attempt it before reading on. Even a partial implementation with an honest failure analysis is worth more than the section below.</p>
        <details>
          <summary>Solution — only look after trying</summary>
          <h4>The protocol</h4>
          <p>A two-phase handoff with an idempotency key, which is the standard answer and worth being able to derive rather than recall.</p>
          <pre className="plain"><code>{"  Node A (source)                        Node B (destination)\n  ───────────────                        ───────────────────\n  ant crosses boundary\n  mid := uuid()\n  state := freeze(ant)      ─ HANDOFF(mid, ant) ─►\n  mark ant \"migrating\"                           if seen(mid): reply ACK (dedupe)\n  (still owned by A, frozen)                     else: insert ant, remember mid\n                            ◄──── ACK(mid) ─────  reply ACK\n  delete ant locally\n  remember mid until B's\n  ack-of-ack window closes\n\n  retry HANDOFF until ACK (at-least-once)\n  B suppresses duplicates by mid (idempotent)\n"}</code></pre>
          <p>The states an ant can be in, from the source node's point of view:</p>
          <table className="grid">
            <tbody>
              <tr>
                <th>State</th>
                <th>Meaning</th>
                <th>May act?</th>
              </tr>
              <tr>
                <td><code>owned</code></td>
                <td>Normal. This node answers for it.</td>
                <td>yes</td>
              </tr>
              <tr>
                <td><code>migrating</code></td>
                <td>HANDOFF sent, no ACK yet. Still ours, frozen.</td>
                <td>no</td>
              </tr>
              <tr>
                <td><code>gone</code></td>
                <td>ACK received. Deleted; <code>mid</code> retained briefly.</td>
                <td>no</td>
              </tr>
            </tbody>
          </table>
          <p><strong>Freezing during <code>migrating</code> is what makes this safe.</strong> The ant exists on exactly one node at all times: either A still owns it (frozen, so it cannot change), or B owns it. There is no window in which both may act on it, and none in which neither exists.</p>
          <h4>Code sketch</h4>
          <pre><code>{"type MigrationID struct {\n\tFrom uint64 // node ID, so IDs from different nodes cannot collide\n\tSeq  uint64 // monotonic per node\n}\n\ntype handoff struct {\n\tID    MigrationID\n\tAnt   sim.Ant\n\tTick  uint64 // source node's logical clock, for the dedupe window\n}\n\n// receive is idempotent: the same handoff delivered ten times inserts one\n// ant and sends ten acks.\nfunc (n *Node) receive(h handoff) ack {\n\tn.mu.Lock()\n\tdefer n.mu.Unlock()\n\n\tif _, dup := n.seen[h.ID]; dup {\n\t\tn.M.DedupeHits.Inc()\n\t\treturn ack{ID: h.ID, OK: true}   // re-acknowledge, do not re-insert\n\t}\n\tn.seen[h.ID] = h.Tick\n\tn.ants[h.Ant.ID] = &h.Ant\n\tn.M.Migrations.Inc()\n\treturn ack{ID: h.ID, OK: true}\n}\n\n// send retries until acknowledged or the destination is declared down.\nfunc (n *Node) send(ctx context.Context, to NodeID, a *sim.Ant) error {\n\th := handoff{ID: n.nextMigrationID(), Ant: *a, Tick: n.tick.Load()}\n\tn.markMigrating(a.ID)\n\n\tfor attempt := 0; ; attempt++ {\n\t\tif !n.membership.Up(to) {\n\t\t\tn.unmarkMigrating(a.ID)      // bounce: keep the ant here\n\t\t\tn.M.FailedHandoffs.Inc()\n\t\t\treturn ErrDestinationDown\n\t\t}\n\t\tif _, err := n.peer(to).Handoff(ctx, h); err == nil {\n\t\t\tn.delete(a.ID)               // only now is it safe to forget\n\t\t\treturn nil\n\t\t}\n\t\tselect {\n\t\tcase <-time.After(backoff(attempt)):\n\t\tcase <-ctx.Done():\n\t\t\tn.unmarkMigrating(a.ID)\n\t\t\treturn ctx.Err()\n\t\t}\n\t}\n}\n"}</code></pre>
          <p><strong>Bounding the dedupe table.</strong> <code>seen</code> cannot grow forever. Each entry carries the source's tick, and a source node includes its "oldest unacknowledged migration" in every heartbeat. Once B knows A has no outstanding migrations older than tick T, every <code>mid</code> from A with a tick below T can never be retried, so B forgets it. That is a low-water-mark garbage collection, the same mechanism distributed logs use to truncate, and it is the honest answer to "for how long?": until the sender proves it will never ask again.</p>
          <h4>Failure analysis, which is the actual deliverable</h4>
          <table className="grid">
            <tbody>
              <tr>
                <th>Crash point</th>
                <th>Outcome</th>
                <th>Why it is safe</th>
              </tr>
              <tr>
                <td>A dies before sending</td>
                <td>Ant is lost with A's state</td>
                <td>Accounted: on restart, A's ants are gone and the ledger records them as lost. No duplicate.</td>
              </tr>
              <tr>
                <td>HANDOFF lost in flight</td>
                <td>A retries</td>
                <td>B never saw it; the retry is the first delivery.</td>
              </tr>
              <tr>
                <td>B dies after inserting, before ACK</td>
                <td>A retries; B (restarted, empty) inserts again</td>
                <td>One copy. A's original was frozen and is deleted on the eventual ACK.</td>
              </tr>
              <tr>
                <td>ACK lost</td>
                <td>A retries; B dedupes and re-acks</td>
                <td>Idempotent receiver. One copy.</td>
              </tr>
              <tr>
                <td>A dies after ACK, before deleting</td>
                <td>A restarts without the ant (state was in memory)</td>
                <td>One copy, on B. With persistence you would need the <code>gone</code> marker on disk.</td>
              </tr>
              <tr>
                <td>B declared down (wrongly)</td>
                <td>A unfreezes the ant and keeps it</td>
                <td>Safe: A never released ownership. The ant bounces off the boundary.</td>
              </tr>
              <tr>
                <td>B declared down after ACK</td>
                <td>Ant is on B, unreachable</td>
                <td>Ant is idle until B returns. Not lost, not duplicated, just unavailable.</td>
              </tr>
            </tbody>
          </table>
          <h4>What is still wrong with this, and you should say so in your README</h4>
          <ul>
            <li><strong>There is no consensus, so there can be split brain.</strong> Two nodes can disagree about whether a third is up, because failure detection is only a timeout. If A thinks B is down and bounces an ant while B thinks it owns one it received, you can get a duplicate. Our design narrows this by making ownership transfer strictly sequential per ant, but it does not eliminate it. The real fix is a consensus-backed ownership table (Raft), which is a large project in its own right and is what etcd exists to be.</li>
            <li><strong>State is in memory</strong>, so a node crash loses its ants by design. That is acceptable here because we account for it, and unacceptable in a system where the entities are customer orders. </li>
            <li><strong>Region assignment is static.</strong> No rebalancing, no node joining with a new range. Consistent hashing plus a range-transfer protocol is the next step, and it is the same handoff problem at a larger granularity.</li>
            <li><strong>The failure detector is a timeout</strong>, which cannot distinguish a slow node from a dead one. This is not a flaw in the implementation, it is the FLP impossibility result showing up in your code: in an asynchronous network you cannot reliably detect failure, so every practical system chooses a timeout and accepts being wrong sometimes.</li>
          </ul>
          <p>If you can explain that last bullet in an interview, you are ahead of most candidates with "distributed systems" on their CV. And notice how much of this Erlang gives you as library code: monitors are a failure detector, <code>global</code> is a distributed registry, and the partition question has a documented, arguable answer. That is Course 4.</p>
        </details>
        <hr />
        <h2><span className="num">Part C</span>Knowledge check</h2>
        <h3>C1 · Twenty conceptual questions</h3>
        <ol className="qs">
          <li>Define a data race precisely, in terms of the Go memory model. Why is "two goroutines write at once" an incomplete definition?</li>
          <li>The race detector has no false positives but many false negatives. Explain both halves.</li>
          <li>Why is an unbuffered channel send a synchronisation point, and what does that guarantee about memory written before it?</li>
          <li>When is closing a channel the correct shutdown signal, and when is it a panic waiting to happen?</li>
          <li>Why can a nil channel in a <code>select</code> be useful rather than a bug?</li>
          <li>Explain why <code>select</code> chooses randomly among ready cases, and give a concrete bug that behaviour caused in this project.</li>
          <li>Contrast a mutex-protected world with a single owner goroutine. Name two things the owner gives you that the mutex cannot, and one thing it does not give you.</li>
          <li>Why must <code>wg.Add</code> not run concurrently with <code>wg.Wait</code>, and how did this project guarantee that?</li>
          <li>Cancellation in Go is cooperative. What follows from that for a goroutine in a tight loop, and for one blocked on a socket read?</li>
          <li>Why does a <code>context</code> need to be passed as a parameter rather than stored in a struct?</li>
          <li>An interface value holding a nil pointer is not nil. Explain the representation that makes this true and the coding rule that avoids it.</li>
          <li>When should a method use a pointer receiver, and what goes wrong with a map of struct values?</li>
          <li>Why does <code>append</code> return a slice, and what is the classic aliasing bug?</li>
          <li>Why is writing to distinct indices of a preallocated slice from many goroutines safe, while appending to a shared slice is not?</li>
          <li>Compare <code>panic</code>/<code>recover</code> with exceptions. Where is <code>recover</code> legitimate, and why is a recover in every goroutine a bad idea?</li>
          <li>Explain why an unrecovered panic in one goroutine kills the process, and what that implies for supervision design.</li>
          <li>Give three distinct backpressure policies, the code shape of each, and a message type in this project suited to each.</li>
          <li>Why did raising message loss from 2% to 25% cut throughput by 96% while the absolute number of dropped messages stayed flat?</li>
          <li>Go has no atomic float64. Give two workarounds and the trade-off of each.</li>
          <li>The same operation measured 29 ns locally and 10.7 µs over loopback TCP. What does that ratio imply for how you choose service boundaries?</li>
        </ol>
        <details>
          <summary>Answers to C1</summary>
          <ol className="qs">
            <li>Two goroutines access the same memory location, at least one access is a write, and the accesses are not ordered by a happens-before relation. "At once" is wrong because the problem is the <em>absence of ordering</em>, not simultaneity: on one core, with no synchronisation, the compiler and CPU may still reorder or cache the accesses, so a write may never become visible.</li>
            <li>No false positives: it instruments actual memory accesses and reports only pairs it observed to be unordered, so a report is always a real bug. False negatives: it only sees code paths that ran and interleavings that happened, so a clean run is evidence, not proof. Hence <code>-count=20</code> and running it under load.</li>
            <li>The send completes only when a receiver takes the value, so the two goroutines rendezvous. The memory model guarantees that everything the sender wrote before the send happens-before everything the receiver does after the receive, which is why passing a pointer through a channel safely transfers ownership.</li>
            <li>Correct when there is exactly one sender (or a <code>WaitGroup</code> proves all senders have finished), because a closed channel broadcasts to every receiver and drains its buffer first. A panic waiting to happen when other goroutines may still send: "send on closed channel" is unrecoverable and, with thousands of senders, unavoidable. Use context cancellation instead.</li>
            <li>A receive from a nil channel blocks forever, so a nil case in a <code>select</code> is simply never ready. Setting a channel variable to nil is therefore the idiomatic way to disable one case of a select dynamically, for instance to stop reading input while a buffer is full.</li>
            <li>Random choice prevents starvation: with priority ordering, a busy channel would monopolise the select. The bug: at shutdown, an ant waiting for a pickup reply had both <code>reply</code> and <code>ctx.Done()</code> ready, chose <code>Done</code> half the time, and discarded a unit of food the world had already removed from the grid.</li>
            <li>The owner gives you: failure you can express (dropping a message is one line, impossible with a mutex), and a protocol of values that becomes a network protocol unchanged. It does not give you parallelism: world access is still serialised, exactly as under the lock. It also removes reentrancy hazards and lock ordering entirely.</li>
            <li>Because <code>Wait</code> may return the moment the counter hits zero, and a concurrent <code>Add</code> could then start work after shutdown has been declared. This project made the supervisor the only goroutine that calls <code>Add</code> after startup, and waited for the supervisor to exit (<code>{'<'}-supervisorDone</code>) before calling <code>Wait</code>.</li>
            <li>A tight loop that never checks <code>ctx.Done()</code> never stops; you cannot kill it, so the only fix is to write loops that check. A goroutine blocked in a socket read is blocked in the kernel, where a context is invisible; you must close the connection or set a deadline. Both are the same fact: there is no <code>goroutine.Kill()</code>.</li>
            <li>Because a context is scoped to an operation, not to an object. Storing it hides the lifetime, makes a struct unusable for two concurrent operations with different deadlines, and prevents the caller from controlling cancellation. The convention is the first parameter, named <code>ctx</code>.</li>
            <li>An interface value is a pair (dynamic type, value pointer) and is nil only if both halves are nil. Assigning a nil <code>*MyError</code> to an <code>error</code> leaves the type half set. Rule: functions that can fail return <code>error</code>, never a concrete error type.</li>
            <li>Pointer receiver when the method mutates, when the struct is large, or when any other method on the type needs one (consistency). Map values are not addressable, so <code>m["k"].Mutate()</code> does not compile for a pointer-receiver method; store pointers in the map, or read-modify-write the whole value.</li>
            <li>Because it may reallocate: if capacity is exhausted it allocates a larger array and copies, so the original slice header is stale. The aliasing bug: <code>b := a[1:3]; b = append(b, x)</code> writes into <code>a[3]</code> when capacity allows, silently modifying <code>a</code>.</li>
            <li>Distinct indices are distinct memory locations and the slice header never changes, so there is no shared mutable state. <code>append</code> writes the length and possibly reallocates the backing array, which is shared state, so concurrent appends race on the header and can lose elements.</li>
            <li>Exceptions are invisible in signatures and travel through every frame; Go errors are values in the signature. <code>recover</code> is legitimate at a genuine isolation boundary (one request, one plugin, one ant) and when converting a panic to an error at a library's edge. Recovering everywhere produces a program that keeps running with invariants already broken, which is worse than crashing. </li>
            <li>Goroutines share one address space and one runtime; there is no isolation to contain a panic, so the runtime's only safe option is to terminate. Consequence: supervision must be built by hand, every goroutine that can panic needs its own deferred recover, and a panic in a shared component (our owner goroutine) is fatal to everything.</li>
            <li>Block (<code>ch {'<'}- v</code>) for ant requests, where slowing the producer is correct. Shed (<code>select</code> with <code>default</code>) for pheromone deposits and evaporation ticks, where a lost message is cheap. Time out (<code>select</code> with a timer) for round trips, where waiting longer has no value. A fourth, reject at admission, protects a downstream by failing fast.</li>
            <li>Because the cost was the timeout, not the loss. Each lost message cost the ant a 50 ms wait, hundreds of times a successful round trip, so at 25% loss almost all wall-clock time went into waiting. Total traffic collapsed, and 25% of a tiny number of messages is about the same as 2% of a large one.</li>
            <li>Fixed point in an <code>atomic.Int64</code> (simple, loses range and precision) or <code>math.Float64bits</code> with a compare-and-swap loop (exact, needs a retry loop and is slower under contention). A third option is to not share the float at all and give each shard its own.</li>
            <li>That crossing a process boundary costs roughly three orders of magnitude even in the best case, so the boundary must be drawn where interactions are rare and coarse. Splitting a service along a chatty interface converts a fast program into a slow distributed one; the correct move is usually to move data to the computation (replication, caching) rather than to send fine-grained requests.</li>
          </ol>
        </details>
        <h3>C2 · Ten code-reading questions</h3>
        <p>Predict the output or behaviour of each, then check. All ten were run to confirm the answers.</p>
        <pre><code>{"// 1\na := []int{1, 2, 3, 4, 5}\nb := a[1:3]\nb = append(b, 99)\nfmt.Println(a, len(b), cap(b))\n\n// 2\nfunc() {\n\tfor i := range 3 {\n\t\tdefer fmt.Print(i, \" \")\n\t}\n}()\n\n// 3\nvar m map[string]int\nfmt.Println(m[\"x\"], len(m), m == nil)\n// and then: m[\"x\"] = 1\n\n// 4\nvar nilCh chan int\nselect {\ncase <-nilCh:\n\tfmt.Println(\"received\")\ndefault:\n\tfmt.Println(\"default\")\n}\n\n// 5\nch := make(chan int, 2)\nch <- 7\nclose(ch)\nv1, ok1 := <-ch\nv2, ok2 := <-ch\nfmt.Println(v1, ok1, v2, ok2)\n\n// 6\ntype OOB struct{ X int }\nfunc (e *OOB) Error() string { return \"oob\" }\nfunc find() *OOB { return nil }\n\nvar err error = find()\nfmt.Println(err == nil, find() == nil)\n\n// 7\ntype Ant struct{ Energy int }\nfunc (a Ant) Drain() { a.Energy = 0 }\n\nant := Ant{Energy: 100}\nant.Drain()\nfmt.Println(ant.Energy)\n\n// 8\ndone := make(chan int, 3)\nfor i := range 3 {\n\tgo func() { done <- i }()\n}\nsum := 0\nfor range 3 {\n\tsum += <-done\n}\nfmt.Println(sum)\n\n// 9\ntype P struct{ X, Y int }\nseen := map[P]int{{1, 2}: 5}\nfmt.Println(P{1, 2} == P{1, 2}, seen[P{1, 2}], seen[P{9, 9}])\n\n// 10\nvar wg sync.WaitGroup\nfor i := range 3 {\n\tgo func() {\n\t\twg.Add(1)\n\t\tdefer wg.Done()\n\t\twork(i)\n\t}()\n}\nwg.Wait()\nfmt.Println(\"done\")\n"}</code></pre>
        <details>
          <summary>Answers to C2</summary>
          <pre className="plain"><code>{"1.  [1 2 3 99 5] 3 4\n2.  2 1 0\n3.  0 0 true      then: panic: assignment to entry in nil map\n4.  default\n5.  7 true 0 false\n6.  false true\n7.  100\n8.  3\n9.  true 5 0\n10. prints \"done\" immediately, usually before any work runs\n"}</code></pre>
          <ol className="qs">
            <li><code>b</code> has length 2 and capacity 4 (from index 1 to the end of the backing array), so <code>append</code> writes in place into <code>a[3]</code>. The classic aliasing bug.</li>
            <li>Deferred calls run last-in-first-out, and their <em>arguments are evaluated at defer time</em>, so the values are 0, 1, 2 printed in reverse.</li>
            <li>Reading a nil map is fine and returns the zero value; <code>len</code> is 0; it compares equal to nil. Writing panics. This asymmetry catches everyone once.</li>
            <li>A receive from a nil channel blocks forever, so that case is never ready and <code>default</code> runs. Without the <code>default</code> this would deadlock.</li>
            <li>A closed channel yields its buffered values first (<code>7, true</code>) and then the zero value with <code>ok</code> false, forever.</li>
            <li><code>err</code> holds (type <code>*OOB</code>, value nil), so it is not nil; the direct pointer comparison is. The nil-interface trap.</li>
            <li>A value receiver operates on a copy. <code>Drain</code> zeroes the copy and the original is untouched. If your state refuses to change, check the receiver first.</li>
            <li>On Go 1.22+, each iteration has its own <code>i</code>, so the goroutines send 0, 1 and 2 in some order and the sum is 3. On Go 1.21 and earlier this printed 6 or another value, because all three closures shared one variable that had usually reached 3.</li>
            <li>Structs of comparable fields are comparable with <code>==</code> and usable as map keys. A missing key returns the zero value.</li>
            <li>The bug: <code>wg.Add(1)</code> runs inside the goroutine, so <code>Wait</code> very likely sees a counter of zero and returns before anything has started. <code>Add</code> must be called before <code>go</code>. This one is not "what does it print" so much as "why is this wrong", which is the more useful question.</li>
          </ol>
        </details>
        <h3>C3 · Five debugging exercises</h3>
        <p>Each gives a symptom and a suspect. Diagnose before opening the answer.</p>
        <ol className="qs">
          <li>
            <strong>Symptom:</strong> the simulation freezes after a few seconds. Every goroutine profile line shows ants blocked in <code>roundTrip</code>, and the owner goroutine shows blocked in <code>handle</code> at a channel send. Nothing crashes; the process sits at 0% CPU forever. 
            <pre className="bad"><code>{"c := &antClient{reply: make(chan response)}   // note: unbuffered"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> <code>fatal error: concurrent map writes</code>, roughly once every twenty runs, always under load, never under a debugger. 
            <pre className="bad"><code>{"type Scout struct{ headings map[int]world.Position }\n\nfunc (s *Scout) Decide(a *Ant, sn Sense, rng *rand.Rand) Action {\n\tif _, ok := s.headings[a.ID]; !ok {\n\t\ts.headings[a.ID] = randomDir(rng)\n\t}\n\treturn Action{Kind: ActMove, Dir: s.headings[a.ID]}\n}"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> memory grows steadily at about 40 MB per minute. The heap profile shows nothing large; <code>runtime.NumGoroutine()</code> climbs from 1,500 to 40,000 over ten minutes. 
            <pre className="bad"><code>{"func (e *Engine) evaporate(ctx context.Context) {\n\tfor {\n\t\tselect {\n\t\tcase <-ctx.Done():\n\t\t\treturn\n\t\tcase <-time.After(e.cfg.EvaporateEvery):\n\t\t\te.reqs <- request{kind: reqEvaporate}\n\t\t}\n\t}\n}"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> the conservation test fails intermittently with food <em>increasing</em>. Race detector clean. Only happens with chaos enabled. 
            <pre className="bad"><code>{"\tcase ActPickUp:\n\t\ta.Carrying = true\n\t\tif err := e.world.TakeFood(r.pos); err != nil {\n\t\t\treturn response{err: err}\n\t\t}\n\t\treturn response{ok: true}"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> after adding a second metrics endpoint, all counters read zero on the new one while the old one works. 
            <pre className="bad"><code>{"func startSecond(m metrics.Set) func() {      // note: by value\n\treturn serve(\":9091\", m.Handler(), \"metrics2\")\n}"}</code></pre>
          </li>
        </ol>
        <details>
          <summary>Answers to C3</summary>
          <ol className="qs">
            <li><strong>Unbuffered reply channel plus an abandoned request.</strong> An ant timed out and moved on; the owner then blocked forever trying to deliver the reply, and with the owner stuck every other ant blocks on its request. One missing buffer size deadlocks the entire program. The fix is <code>make(chan response, 1)</code>. Diagnostic route: the goroutine profile showing the <em>owner</em> blocked on a send is the giveaway, because the owner should never be blocked.</li>
            <li><strong>Shared strategy state.</strong> Every ant goroutine calls <code>Decide</code> on the same <code>*Scout</code>, so all of them write one map. This is not a data race the detector merely warns about; the runtime deliberately aborts the process on concurrent map writes. It is load-dependent because two writes must land in the same window. Fixes, best last: a mutex (serialises every decision), a slice indexed by ant ID (fast, fragile), or per-ant fields on <code>Ant</code> (no sharing at all).</li>
            <li><strong><code>time.After</code> in a loop.</strong> Each call allocates a timer that stays alive until it fires, and the goroutine count climb is the tell. Here the deeper problem is the unguarded send: when the owner is saturated, this goroutine blocks, and the next tick's timer is created anyway. Replace with one <code>time.NewTicker</code> plus <code>defer ticker.Stop()</code>, and make the send non-blocking.</li>
            <li><strong>State mutated before the fallible operation succeeded.</strong> The ant is marked as carrying and then the pickup fails, so it later delivers food that never existed. Chaos makes failures common enough to see. The rule: mutate local state <em>after</em> the operation that can fail returns successfully. The conservation invariant is what turns this from a silent wrong answer into a test failure.</li>
            <li><strong>A metric set copied by value.</strong> <code>metrics.Set</code> contains atomics, so passing it by value copies the counters; the new handler reports its own frozen zeros. <code>go vet</code> catches this as "passes lock by value" for <code>sync</code> types and, in recent versions, for <code>atomic</code> types too. Pass <code>*metrics.Set</code>.</li>
          </ol>
        </details>
        <h3>C4 · Five implementation exercises</h3>
        <ol className="qs">
          <li><strong>Deterministic replay.</strong> Add a recording mode that writes every nondeterministic decision (chaos events, RNG draws that matter, scheduling-visible ordering) to a file, and a replay mode that reproduces a run exactly from it. Acceptance: a chaotic run that fails the conservation test replays and fails identically ten times out of ten.</li>
          <li><strong>Region-aware behaviour.</strong> Implement a <code>Behaviour</code> that maintains a small per-ant memory of where food was found (last three positions, on the <code>Ant</code> struct) and biases search toward those areas when pheromone is absent. Measure whether it beats <code>TrailFollower</code> over ten seeds, and report both mean and win count.</li>
          <li><strong>Adaptive evaporation.</strong> Make the evaporation rate a function of colony state: faster when delivery rate is falling (trails are stale), slower when it is rising. Acceptance: it must beat the best fixed rate you found in Milestone 6's sweep on at least seven of ten seeds.</li>
          <li><strong>A multiplexed client.</strong> Exercise 12 from the last instalment: request IDs, one reader goroutine, many ants per connection, bounded memory, <code>-race</code> clean with 1,000 ants on one connection.</li>
          <li><strong>Snapshot and restore.</strong> Serialise the entire world and colony to a file and restore it, such that a restored run continues identically to one that was never interrupted (with chaos off). Acceptance: run 5 seconds, snapshot, run 5 more; versus run 10 seconds. Identical final statistics.</li>
        </ol>
        <h3>C5 · One substantial challenge</h3>
        <p>Distinct from the final challenge in Part B, and smaller, but not easy.</p>
        <p><strong>Build a scheduling fuzzer.</strong> Make the interleaving itself a controlled variable. Introduce a <code>Scheduler</code> abstraction that every goroutine in <code>internal/sim</code> consults at yield points (before a send, after a receive, around each tick), which in test mode advances goroutines in an order chosen by a seed. Then write a test that runs 10,000 seeds against the conservation invariant and reports any seed that breaks it.</p>
        <p>Requirements: production mode must compile to zero overhead (the scheduler calls must be inlinable no-ops, verified with <code>-gcflags=-m</code>); the fuzzer must find the "select chose Done and discarded the reply" bug from Milestone 11 when you reintroduce it; and a failing seed must be replayable. Hints: an interface with two implementations, one of which has empty methods; the real difficulty is not the scheduler but finding the right yield points, and the answer is "wherever the program's behaviour could depend on ordering".</p>
        <h3>C6 · You should now be able to explain</h3>
        <ul>
          <li>
            <img className="mascot-left" src={img4.src} alt="The Mewlang cat, raising a paw for a high-five" width="120" />
            The Go memory model in terms of happens-before, and how channel operations and mutexes create it.
          </li>
          <li>Why goroutines are cheap and what the runtime does when one blocks.</li>
          <li>Channel semantics in full: buffered, unbuffered, nil, closed, directional.</li>
          <li><code>select</code>, including random choice, <code>default</code>, and disabling a case with nil.</li>
          <li>Context trees, derived cancellation, and why cancellation is cooperative.</li>
          <li>The difference between concurrency and parallelism, with evidence from your own benchmarks.</li>
          <li>Ownership as a design tool: owned, shared-with-a-lock, atomic, and immutable-after-construction.</li>
          <li>Interfaces, implicit satisfaction, the nil-interface trap, and "accept interfaces, return structs".</li>
          <li>Error values, wrapping, <code>errors.Is</code>/<code>As</code>, and when a custom type beats a sentinel. </li>
          <li>Why panics are process-fatal, and what supervision therefore costs in Go.</li>
          <li>Backpressure policies and how to choose one per message type.</li>
          <li>How to read a CPU profile, a heap profile and a goroutine profile, and what each answers.</li>
          <li>Why timeouts amplify failure, and the standard mitigations.</li>
          <li>The cost of a process boundary, in nanoseconds you have measured yourself.</li>
          <li>Why exactly-once delivery is impossible and how at-least-once plus idempotency substitutes for it.</li>
        </ul>
        <h3>C7 · You should now be able to implement</h3>
        <ul>
          <li>A concurrent simulation with per-agent goroutines and no data races.</li>
          <li>A single-owner service with a request/response protocol over channels.</li>
          <li>Graceful, ordered shutdown with contexts and <code>WaitGroup</code>s, proven leak-free by a test.</li>
          <li>A supervisor with restart backoff, jitter and an intensity limit.</li>
          <li>Fault injection as a configurable subsystem, with a deterministic schedule.</li>
          <li>Lock-free counters and a bucketed latency histogram.</li>
          <li>A Prometheus-format metrics endpoint with pprof mounted safely.</li>
          <li>A server-sent-events stream that never blocks its producer.</li>
          <li>Sharded state with atomic reads and single-owner writes.</li>
          <li>A TCP server with one goroutine per connection, a connection registry and correct shutdown.</li>
          <li>A reconnecting client with jittered backoff and socket deadlines.</li>
          <li>Table-driven tests, benchmarks, fuzz targets and invariant tests.</li>
        </ul>
        <hr />
        <h2><span className="num">Part D</span>Shipping it: README, portfolio, interview</h2>
        <h3>D1 · README draft</h3>
        <pre className="plain"><code>{"# antfarm\n\nA concurrent ant-colony simulation used as a laboratory for Go concurrency,\nfault tolerance and observability. Thousands of ants, each an independent\ngoroutine, forage for food and lay pheromone trails in a world owned by a\nsingle goroutine. Failures are injected on purpose; everything is measured.\n\nNo third-party dependencies. Standard library only.\n\n## What it does\n\n- Each ant runs in its own goroutine and communicates by message passing.\n- Exactly one goroutine owns the world; there is no mutex in the engine.\n- Ants lay pheromone trails on the way home, which measurably improves\n  foraging (~25% more food delivered than a random walk, same seed and budget).\n- Chaos injection: random crashes, dropped messages and slow workers, with a\n  supervisor that restarts crashed ants and accounts for their lost cargo.\n- Prometheus-format metrics, pprof, a terminal renderer and a browser view\n  fed by server-sent events.\n- A sharded engine with atomic reads that is 1.4-2.9x faster than the\n  single-owner engine on a single core.\n- The world can run in a separate process; ants reconnect when it restarts.\n\n## Quick start\n\n    go run ./cmd/antfarm -ants 2000 -grid 128x128 -food 10 -duration 10s \\\n        -metrics :9090 -view :8080\n\nThen open http://localhost:8080 for the live view and\nhttp://localhost:9090/metrics for the counters.\n\n    go run ./cmd/antfarm -term -ants 500        # terminal renderer\n    go run ./cmd/antfarm -chaos crash=0.001,drop=0.02,slow=0.005\n\n## Flags\n\n    -grid WxH              world size (default 64x64)\n    -ants N                number of ants\n    -food N                number of food sources\n    -food-per-source N     units per source\n    -behaviour forager|trail\n    -seed N                same seed replays the same run\n    -duration D            how long to run\n    -chaos k=v,...         crash, drop, slow, slowfor\n    -metrics addr          serve /metrics and /debug/pprof\n    -view addr             serve the browser view\n    -term                  draw in the terminal\n\n## Architecture\n\n    cmd/antfarm     flags, wiring, signals, HTTP servers\n    internal/sim    ants, behaviours, engines, chaos, supervision\n    internal/world  grids, food, pheromone, atomic grid\n    internal/metrics counters, histograms, exposition, pprof\n    internal/view   terminal renderer, SSE stream, browser client\n    internal/netsim gob-over-TCP server and reconnecting client\n\nTwo engines are kept deliberately:\n\n- `Engine` (single owner) is the correct, readable design. Read this first.\n- `FastEngine` (sharded, atomic reads) is the profile-driven rewrite.\n\nThe mutex-based version from the concurrency milestone is also kept, in\n`concurrent.go`, because the point of this project is the comparison.\n\n## Testing\n\n    go test ./...                 # everything\n    go test -race -count=5 ./...  # what CI runs\n    go test -bench . ./...        # benchmarks\n\nTests are invariant-based: the central one asserts that food is conserved\n(delivered + on the ground + carried + lost equals the starting total) under\nconcurrency, chaos and shutdown. It has caught every real bug in this project.\n\n## Measurements\n\nAll on one core, Go 1.22:\n\n| Thing                             | Result                    |\n|-----------------------------------|---------------------------|\n| Sense, in-process (atomic reads)  | 29 ns                     |\n| Sense, over loopback TCP          | 10.7 µs (368x)            |\n| Round trip p50 / p99, 1500 ants   | 2 µs / 8 ms               |\n| Requests handled, 4 s run         | 3,034,578                 |\n| Trail following vs random walk    | +25% food delivered       |\n| Sharded vs single owner           | 1.4-2.9x throughput       |\n\n## Known limitations\n\n- Ant state is in memory; a crashed process loses it by design.\n- The network protocol has no request IDs, so one connection serves one ant.\n- The distributed mode has no consensus, so a partition can split ownership.\n\n## Licence\n\nMIT\n"}</code></pre>
        <p>Three things that README does deliberately. It <strong>leads with measurements</strong> rather than adjectives. It <strong>keeps the "worse" implementations and explains why</strong>, which signals that the comparison was the point. And it has a <strong>known limitations section</strong>, which is the single strongest credibility signal a portfolio project can carry: it says you understand your own design well enough to know where it ends.</p>
        <h3>D2 · GitHub project description</h3>
        <blockquote>A concurrent ant-colony simulation in Go, used as a laboratory for message passing, supervision, chaos injection and observability. Thousands of goroutines, no mutex in the engine, everything measured. </blockquote>
        <p>Topics: <code>go</code>, <code>golang</code>, <code>concurrency</code>, <code>goroutines</code>, <code>channels</code>, <code>simulation</code>, <code>agent-based-model</code>, <code>chaos-engineering</code>, <code>observability</code>, <code>distributed-systems</code>, <code>pprof</code>, <code>ant-colony-optimization</code>.</p>
        <h3>D3 · Performance considerations</h3>
        <ul>
          <li><strong>Sensing dominates traffic.</strong> Two-thirds of all messages were sense requests; eliminating them with atomic reads was worth more than every other optimisation combined.</li>
          <li><strong>The owner is a serialisation point by design.</strong> Throughput ceiling is one goroutine's worth of world operations. Shard when measurement says so, not before.</li>
          <li><strong>Preallocate everything sized by config.</strong> <code>make([]*Ant, 0, n)</code> versus growth is roughly twenty allocations and a hundred thousand copies at 50,000 ants.</li>
          <li><strong>Zero allocations in the tick path</strong> is achievable and worth protecting with a <code>-benchmem</code> test.</li>
          <li><strong>Instrumentation is not free:</strong> two <code>time.Now()</code> calls per round trip cost about 15% of CPU at three million round trips per second. Sample.</li>
          <li><strong>Queue capacity is a latency policy.</strong> Small queues block producers, large queues hide latency until clients time out. Publish depth; alert on it.</li>
          <li><strong>Set <code>GOMAXPROCS</code> and <code>GOMEMLIMIT</code> in containers.</strong></li>
        </ul>
        <h3>D4 · Security considerations</h3>
        <ul>
          <li><strong>pprof is a remote information disclosure surface.</strong> Heap dumps can contain user data, <code>cmdline</code> leaks arguments, and <code>profile</code> lets anyone impose CPU load. Mount it explicitly (never via <code>DefaultServeMux</code>), bind it to localhost, and reach it through a tunnel.</li>
          <li><strong>The gob protocol is unauthenticated and unencrypted.</strong> Anyone who can reach the port can command the world. Add TLS with <code>crypto/tls</code> and a shared credential before this leaves a laptop; gob will also happily decode adversarial input, so treat the port as trusted-network-only.</li>
          <li><strong>Unbounded decoding is a denial-of-service vector.</strong> A hostile client can announce a huge structure and make the server allocate. Cap message size with an <code>io.LimitReader</code> around the connection.</li>
          <li><strong>Every HTTP server needs timeouts.</strong> The zero-value <code>http.Server</code> has none; a slow client can hold connections indefinitely. <code>ReadHeaderTimeout</code> at minimum.</li>
          <li><strong>The browser view echoes nothing user-supplied</strong> today. If you add a name or a label, remember that <code>fmt.Fprint</code> into HTML is an injection; use <code>html/template</code>, which escapes by context.</li>
          <li><strong>Resource limits are policy.</strong> <code>-ants 100000000</code> will exhaust memory. Validate flags, and cap what a remote caller can request (the frame <code>cols</code> parameter comes from a query string).</li>
        </ul>
        <h3>D5 · What to put in your portfolio</h3>
        <p>Do not present this as "an ant simulation". Present it as what it is: <strong>a study of one concurrency problem solved four ways, with measurements</strong>. The narrative that makes it interesting is the sequence of failures.</p>
        <ol>
          <li>Naive shared state, broken, with the race detector output as evidence.</li>
          <li>A mutex: correct, and 1.76× <em>slower</em> than single-threaded. Show the benchmark.</li>
          <li>A single owner goroutine: no locks, failure becomes expressible, still serialised, and honest about that.</li>
          <li>Profile-driven sharding with atomic reads: 1.4–2.9× faster, and a conservation bug at shutdown that the race detector could not see.</li>
          <li>The same protocol over TCP, unchanged, and the 368× latency cost of the boundary.</li>
        </ol>
        <p>Keep a <code>docs/</code> folder with the profile output, the benchmark table and one architecture diagram. Screenshot the browser view for the README. A reviewer who spends ninety seconds on your repository should come away knowing you can measure, not just build.</p>
        <p>What to cut if you want it tighter: the terminal renderer (charming, not load-bearing) and the sequential <code>Sim</code>, unless you keep it explicitly as a test oracle and say so.</p>
        <h3>D6 · Interview questions someone could ask, and what a good answer contains</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>Question</th>
              <th>What a strong answer includes</th>
            </tr>
            <tr>
              <td>Walk me through the concurrency design.</td>
              <td>Ownership as the organising idea: who owns what, why the world has exactly one owner, and where you kept a mutex anyway (the connection registry) and why that was right.</td>
            </tr>
            <tr>
              <td>Why not just use a mutex?</td>
              <td>You did, you measured it, it was slower than sequential, and you can say why: total serialisation plus scheduling overhead. Then the structural reasons the owner won.</td>
            </tr>
            <tr>
              <td>How do you know it is correct?</td>
              <td>Conservation invariants under race, chaos and shutdown; <code>-race -count</code> in CI; a deterministic sequential oracle; the two bugs the invariant caught that the race detector could not. </td>
            </tr>
            <tr>
              <td>Tell me about a bug you found.</td>
              <td>The shutdown food loss: <code>select</code> chose <code>ctx.Done()</code> over a ready reply, discarding work the world had already performed. Include how you found it (invariant test, then ledger instrumentation) and the fix.</td>
            </tr>
            <tr>
              <td>How did you make it faster?</td>
              <td>Profile first. Quote what dominated (<code>selectgo</code>, channel locks, timers) and note that simulation code was not in the top fourteen. Then the three changes and the measured result, with the single-core caveat stated.</td>
            </tr>
            <tr>
              <td>What happens when a worker crashes?</td>
              <td>Recover in the same goroutine, report to a supervisor over a channel, reset state, restart with backoff and jitter, and <em>account for in-flight work</em>. The last part is what separates a real answer from a tutorial answer.</td>
            </tr>
            <tr>
              <td>How would you make this production-ready?</td>
              <td>Admission control, restart intensity limits, TLS and auth on the wire, message size caps, <code>GOMAXPROCS</code>/<code>GOMEMLIMIT</code>, structured logs, alerting on queue depth and p99, and persistence for the state you currently lose.</td>
            </tr>
            <tr>
              <td>Exactly-once delivery: how?</td>
              <td>You cannot. At-least-once plus an idempotent receiver, with a dedupe key and a bounded window for forgetting it. Explain the low-water-mark garbage collection.</td>
            </tr>
            <tr>
              <td>When would you not use Go for this?</td>
              <td>Erlang if fault tolerance were the whole problem (isolated heaps, forced kill, supervision as configuration); Rust if the race had to be impossible rather than detectable. Name what Go wins on: tooling, deployment, and time to competence.</td>
            </tr>
            <tr>
              <td>What would you do differently?</td>
              <td>Start with the owner design rather than arriving at it; build the deterministic chaos schedule before the random one; design the metric set before the counters accumulated ad hoc; and put request IDs on the wire from the start.</td>
            </tr>
          </tbody>
        </table>
        <h3>D7 · Extensions worth building</h3>
        <ul>
          <li><strong>Multiple colonies</strong> competing for the same food, with territorial pheromone. The interesting part is that the world owner now arbitrates conflict.</li>
          <li><strong>Evolution:</strong> behaviour parameters (bias, run length) inherited with mutation, selected by delivery rate. You have the measurement harness already.</li>
          <li><strong>Obstacles and a real pathfinding baseline</strong> to compare emergent trails against A*. Quantifies how good the colony actually is.</li>
          <li><strong>A WebAssembly build</strong> (<code>GOOS=js GOARCH=wasm</code>) so the simulation runs in the browser with no server.</li>
          <li><strong>The deterministic simulator</strong> from C5, which is the most educationally valuable of these by a distance.</li>
        </ul>
        <hr />
        <h2><span className="num">Course 1 complete</span>What you built</h2>
        <p>
          <img className="mascot-right" src={img5.src} alt="The Mewlang cat, beaming with delight" width="120" />
          2,961 lines of dependency-free Go across six packages, four engine designs with measurements comparing them, a supervisor, a chaos subsystem, a metrics and profiling endpoint, two viewers, and a network protocol that survives its server being killed. More importantly: a habit of measuring before optimising, and of testing invariants rather than outputs.
        </p>
        <p>The central question of this curriculum was <em>what kinds of problems does this language make unusually natural to solve?</em> Go's answer, stated as precisely as this project allows: <strong>problems with many independent activities that need to communicate, where you want the concurrency to be visible in the code, the failures to be detectable at run time, and the result to be a single binary you can deploy and profile in production.</strong> Not the fastest, not the safest, not the most expressive. The one where a competent team can build a correct concurrent system quickly and then find out what it is actually doing.</p>
        <p>Next instalment begins Course 2: Ruby, and the automation DSL. The change of gear is total. Nothing will be about throughput; everything will be about expressiveness, and the first question will be why a configuration file should be a program.</p>
        <footer className="end">
          <p>
            <img className="mascot-center" src={img6.src} alt="The Mewlang cat, seen from behind, walking off" width="150" />
            Instalment 5 of the five-course curriculum, and the end of Course 1. Next: Ruby Parts 0–2 (what we are building, installation and tooling, the language crash course), then twelve milestones building a self-inspecting automation DSL.
          </p>
        </footer>
         <Link className="button" href="/ruby-course/instalment/">Next: Ruby instalment</Link> 
      </div>
    </div>
  );
}
