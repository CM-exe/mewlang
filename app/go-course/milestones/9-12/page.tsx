import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Go Milestones 9–12 — Metrics, Viewing, Speed, Distribution",
};

export default function Page() {
  return (
    <div className="theme-go">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 4 · Course 1 (Go) · Milestones 9–12</p>
          <h1>Watching it, speeding it up, and moving the world to another machine</h1>
          <p className="lede">The colony gets metrics, a profiler, a live picture in your browser, a rewrite guided by an
                actual profile, and finally a world that lives in a separate process you can kill while ants are talking
                to it.</p>
        </header>
        <div className="note">
          <h5>Same rules as before</h5>
          <p>Every snippet compiled, vetted, race-tested and run. Every number measured. The container has one core,
                so parallel speedups are understated and I say so where it matters. The finished project is 2,961 lines
                of Go.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 9</span>Metrics, and a profiler you can attach to a
            running colony</h2>
        <h3>Goal</h3>
        <p>Counters, gauges and latency histograms for everything the colony does, exposed over HTTP in a format a
            scraper understands, with <code>pprof</code> mounted alongside so you can profile a live process without
            restarting it.</p>
        <h3>Concepts</h3>
        <p>Atomic counters versus owner-owned counters, cheap histograms without allocation, the Prometheus text format,
            <code>net/http</code> servers and graceful shutdown, mounting <code>net/http/pprof</code> deliberately, and
            reading a CPU profile.</p>
        <h3>Design</h3>
        <p>We already have two kinds of counter, and the distinction is worth making explicit before adding twenty more.
        </p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Kind</th>
              <th>Written by</th>
              <th>Implementation</th>
              <th>Example</th>
            </tr>
            <tr>
              <td>Ledger</td>
              <td>Only the owner goroutine</td>
              <td>A plain <code>int</code> field</td>
              <td><code>delivered</code>, <code>carrying</code>, <code>lost</code></td>
            </tr>
            <tr>
              <td>Metric</td>
              <td>Any goroutine</td>
              <td><code>atomic.Int64</code></td>
              <td>timeouts, restarts, round-trip latency</td>
            </tr>
          </tbody>
        </table>
        <p>The ledger must be exactly right, because the conservation invariant depends on it, and it is cheap to keep
            right because one goroutine owns it. Metrics are written from everywhere and need to be approximately right
            and very cheap. Do not merge these two ideas: a ledger behind atomics invites someone to read two counters
            that were never consistent with each other, and a metric behind the owner adds a message round trip to every
            observation.</p>
        <p>For histograms, the naive approach (keep every observation, sort, take a percentile) allocates unboundedly
            and is useless in a hot path. The standard answer is bucketing, and there is a trick that makes it nearly
            free: use powers of two as bucket boundaries, and find the bucket with a single bit operation.</p>
        <h3>Implementation</h3>
        <h4>internal/metrics/metrics.go</h4>
        <pre><code>{"// Counter is a monotonically increasing number.\ntype Counter struct{ v atomic.Int64 }\n\nfunc (c *Counter) Inc()         { c.v.Add(1) }\nfunc (c *Counter) Add(n int64)  { c.v.Add(n) }\nfunc (c *Counter) Value() int64 { return c.v.Load() }\n\n// Gauge is a number that goes up and down.\ntype Gauge struct{ v atomic.Int64 }\n\nfunc (g *Gauge) Set(n int64)  { g.v.Store(n) }\nfunc (g *Gauge) Value() int64 { return g.v.Load() }\n"}</code></pre>
        <p>Wrapping <code>atomic.Int64</code> in a named type with two methods looks like pointless ceremony until you
            notice what it prevents: nobody can accidentally read a counter with <code>=</code> instead of
            <code>.Load()</code>, and the type name documents whether a number is expected to go down.
            <code>go vet</code> also refuses to let you copy a struct containing an atomic, which catches a whole class
            of "my metrics stopped moving" bugs.</p>
        <pre><code>{"// Histogram records durations in power-of-two microsecond buckets. Bucket i\n// holds observations in [2^(i-1), 2^i) microseconds, which covers 1µs to\n// about 4 seconds in 24 buckets for the cost of one atomic add per\n// observation and no allocation at all.\ntype Histogram struct {\n\tbuckets [24]atomic.Int64\n\tcount   atomic.Int64\n\tsumUS   atomic.Int64\n}\n\nfunc (h *Histogram) Observe(d time.Duration) {\n\tus := d.Microseconds()\n\tif us < 0 {\n\t\tus = 0\n\t}\n\th.count.Add(1)\n\th.sumUS.Add(us)\n\th.buckets[bucketFor(us)].Add(1)\n}\n\nfunc bucketFor(us int64) int {\n\tif us <= 0 {\n\t\treturn 0\n\t}\n\t// bits.Len64 gives the position of the highest set bit, which is\n\t// floor(log2)+1: exactly the bucket index we want.\n\ti := bits.Len64(uint64(us))\n\tif i > 23 {\n\t\ti = 23\n\t}\n\treturn i\n}\n"}</code></pre>
        <p><code>math/bits.Len64</code> compiles to a single CPU instruction on every architecture Go supports. So one
            observation is three atomic adds and one instruction, with no branching on bucket boundaries, no allocation,
            and no lock. The whole histogram is 26 machine words and can live inline in a struct.</p>
        <pre><code>{"// Quantile returns the upper edge of the bucket holding the qth quantile.\n// It is approximate by construction: the answer is only ever accurate to a\n// factor of two, which is usually enough to tell \"fine\" from \"on fire\".\nfunc (h *Histogram) Quantile(q float64) time.Duration {\n\ttotal := h.count.Load()\n\tif total == 0 {\n\t\treturn 0\n\t}\n\ttarget := int64(q * float64(total))\n\tseen := int64(0)\n\tfor i := range h.buckets {\n\t\tseen += h.buckets[i].Load()\n\t\tif seen >= target {\n\t\t\treturn time.Duration(int64(1)<<uint(i)) * time.Microsecond\n\t\t}\n\t}\n\treturn time.Duration(int64(1)<<23) * time.Microsecond\n}\n"}</code></pre>
        <p>Be honest in the doc comment about accuracy. A p99 of "8 ms" here means "somewhere between 4 and 8 ms", and
            that is fine for alerting and useless for a latency SLO quoted to three decimal places. Real systems use HDR
            histograms or t-digests when they need better; the point of showing the cheap version is that you now know
            what the expensive ones are buying.</p>
        <p>Note also that <code>Quantile</code> reads 24 atomics one at a time while other goroutines are writing, so
            the snapshot it returns never existed at any single instant. For a monitoring endpoint that is completely
            acceptable and worth knowing.</p>
        <h4>The metric set, and why it is a struct rather than a map</h4>
        <pre><code>{"// Set is every metric the colony publishes. Named fields rather than a map\n// of strings: the compiler checks the names and no lookup happens in the\n// hot path.\ntype Set struct {\n\tDelivered     Counter\n\tFailedPickups Counter\n\tLost          Counter\n\tRestarts      Counter\n\tDropped       Counter\n\tTimeouts      Counter\n\tRequests      Counter\n\n\tAntsAlive  Gauge\n\tQueueDepth Gauge\n\n\tRoundTrip Histogram\n\tDecide    Histogram\n}\n"}</code></pre>
        <p>Most metrics libraries hand you <code>counter("antfarm_requests_total").Inc()</code>, which needs a map
            lookup, a string hash and usually a mutex or a sharded cache on every observation. A struct of named fields
            costs a pointer offset, is checked by the compiler, and shows up in your editor's autocomplete. You lose
            dynamic metric names, which for an application (as opposed to a library) you rarely want anyway.</p>
        <h4>Exposition</h4>
        <pre><code>{"// WriteProm renders the set in the Prometheus text exposition format, which\n// is simple enough to produce by hand and is what most scrapers speak.\nfunc (s *Set) WriteProm(w io.Writer) {\n\tcounter := func(name, help string, c *Counter) {\n\t\tfmt.Fprintf(w, \"# HELP %s %s\\n# TYPE %s counter\\n%s %d\\n\", name, help, name, name, c.Value())\n\t}\n\t...\n\tcounter(\"antfarm_food_delivered_total\", \"Food units delivered to the nest.\", &s.Delivered)\n\tgauge(\"antfarm_ants_alive\", \"Ants currently running.\", &s.AntsAlive)\n\thist(\"antfarm_round_trip\", &s.RoundTrip)\n}\n"}</code></pre>
        <p>Local closures as helpers inside a function is a very Go thing to do. They capture <code>w</code>, they are
            not visible outside, and they turn eleven repetitive blocks into eleven readable lines. The naming
            convention is worth copying: <code>_total</code> suffix for counters, base units (seconds, bytes) rather
            than milliseconds, and a <code># HELP</code> line that says what the number means.</p>
        <h4>Mounting pprof, carefully</h4>
        <pre><code>{"// Handler builds the observability endpoints. We mount pprof explicitly\n// rather than relying on its init() registering itself on the default mux,\n// because exposing profiles by accident is a real security problem.\nfunc (s *Set) Handler() http.Handler {\n\tmux := http.NewServeMux()\n\n\tmux.HandleFunc(\"GET /healthz\", func(w http.ResponseWriter, r *http.Request) {\n\t\tfmt.Fprintln(w, \"ok\")\n\t})\n\n\tmux.HandleFunc(\"GET /metrics\", func(w http.ResponseWriter, r *http.Request) {\n\t\tw.Header().Set(\"Content-Type\", \"text/plain; version=0.0.4; charset=utf-8\")\n\t\ts.WriteProm(w)\n\t})\n\n\tmux.HandleFunc(\"GET /debug/pprof/\", pprof.Index)\n\tmux.HandleFunc(\"GET /debug/pprof/cmdline\", pprof.Cmdline)\n\tmux.HandleFunc(\"GET /debug/pprof/profile\", pprof.Profile)\n\tmux.HandleFunc(\"GET /debug/pprof/symbol\", pprof.Symbol)\n\tmux.HandleFunc(\"GET /debug/pprof/trace\", pprof.Trace)\n\n\treturn mux\n}\n"}</code></pre>
        <div className="warn">
          <h5>The pprof import is a trap worth knowing</h5>
          <p>Almost every Go tutorial tells you to write <code>import _ "net/http/pprof"</code>. The underscore means
                "import for side effects only", and the side effect is that the package's <code>init()</code> registers
                its handlers on <code>http.DefaultServeMux</code>. If anything in your program then serves
                <code>DefaultServeMux</code> on a public port, you have published heap profiles, goroutine stacks,
                command-line arguments and a CPU profiler to the internet. This has caused real incidents.</p>
          <p>Mounting the handlers yourself on your own mux, as above, makes the exposure a deliberate decision. In
                production you would bind this listener to localhost or an internal interface and reach it through a
                tunnel.</p>
          <p>Note the Go 1.22 method patterns: <code>"GET /metrics"</code> matches only GET requests, and
                <code>"GET /debug/pprof/"</code> with a trailing slash is a subtree match. Before 1.22 you checked
                <code>r.Method</code> by hand.</p>
        </div>
        <h4>Wiring it in</h4>
        <p>The engine gets an embedded <code>metrics.Set</code>, and the interesting instrumentation is two lines in the
            request path:</p>
        <pre><code>{"func (e *Engine) handle(r request) {\n\te.M.Requests.Inc()\n\te.M.QueueDepth.Set(int64(len(e.reqs)))\n\t...\n}\n"}</code></pre>
        <p><code>len()</code> on a channel returns how many values are buffered in it right now. It is a genuinely
            useful gauge (queue depth is the single best early warning that a consumer is falling behind) and it is a
            terrible basis for logic, because by the time you act on it the number has changed. Measure with it, never
            branch on it.</p>
        <pre><code>{"func (c *antClient) roundTrip(ctx context.Context, r request) (response, error) {\n\tstart := time.Now()\n\tdefer func() { c.e.M.RoundTrip.Observe(time.Since(start)) }()\n\t...\n}\n"}</code></pre>
        <p>And the HTTP server in <code>main.go</code>, with the shutdown discipline from Milestone 7:</p>
        <pre><code>{"// serve starts an HTTP server and returns a function that shuts it down\n// without dropping in-flight requests.\nfunc serve(addr string, h http.Handler, name string) func() {\n\tsrv := &http.Server{\n\t\tAddr:              addr,\n\t\tHandler:           h,\n\t\tReadHeaderTimeout: 5 * time.Second, // never accept a slow-loris header\n\t}\n\tgo func() {\n\t\tif err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {\n\t\t\tlog.Printf(\"antfarm: %s server: %v\", name, err)\n\t\t}\n\t}()\n\treturn func() {\n\t\tctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)\n\t\tdefer cancel()\n\t\tif err := srv.Shutdown(ctx); err != nil {\n\t\t\tlog.Printf(\"antfarm: %s server shutdown: %v\", name, err)\n\t\t}\n\t}\n}\n"}</code></pre>
        <p><code>ListenAndServe</code> always returns a non-nil error, and it returns <code>http.ErrServerClosed</code>
            when you shut it down on purpose, so the <code>errors.Is</code> check is how you avoid logging a scary
            message during a clean exit. <code>srv.Shutdown</code> stops accepting, waits for in-flight handlers, and
            respects the context as a deadline. <code>ReadHeaderTimeout</code> is there because the zero-value
            <code>http.Server</code> has no timeouts at all, which means one slow client can hold a connection open
            indefinitely.</p>
        <h3>What it looks like</h3>
        <pre className="plain"><code>{"$ antfarm -ants 1500 -grid 96x96 -food 8 -food-per-source 400 \\\n      -duration 6s -metrics 127.0.0.1:9090 -view 127.0.0.1:8080 \\\n      -chaos crash=0.0005,drop=0.002\ncolony: 1500 ants, 96x96 grid, 8 food sources of 400, behaviour trail, chaos {...}\nmetrics: http://127.0.0.1:9090/metrics  pprof: http://127.0.0.1:9090/debug/pprof/\nview:    http://127.0.0.1:8080/\n\n$ curl -s 127.0.0.1:9090/metrics\n# HELP antfarm_food_delivered_total Food units delivered to the nest.\n# TYPE antfarm_food_delivered_total counter\nantfarm_food_delivered_total 955\n# HELP antfarm_ant_restarts_total Ants restarted after a crash.\n# TYPE antfarm_ant_restarts_total counter\nantfarm_ant_restarts_total 792\n# HELP antfarm_messages_dropped_total Requests discarded by chaos injection.\n# TYPE antfarm_messages_dropped_total counter\nantfarm_messages_dropped_total 6141\n# HELP antfarm_request_timeouts_total Requests that never got a reply.\n# TYPE antfarm_request_timeouts_total counter\nantfarm_request_timeouts_total 5865\n# HELP antfarm_requests_total Requests handled by the world owner.\n# TYPE antfarm_requests_total counter\nantfarm_requests_total 3034578\n# HELP antfarm_ants_alive Ants currently running.\n# TYPE antfarm_ants_alive gauge\nantfarm_ants_alive 1500\n# HELP antfarm_queue_depth Requests waiting for the world owner.\n# TYPE antfarm_queue_depth gauge\nantfarm_queue_depth 0\n# TYPE antfarm_round_trip_seconds summary\nantfarm_round_trip_seconds{quantile=\"0.5\"} 0.000002\nantfarm_round_trip_seconds{quantile=\"0.9\"} 0.001024\nantfarm_round_trip_seconds{quantile=\"0.99\"} 0.008192\nantfarm_round_trip_seconds_count 3033172\n"}</code></pre>
        <p>Three million requests in about four seconds, and look at the latency distribution: a median of 2 µs, a
            p90 of 1 ms, a p99 of 8 ms. That is a spread of four thousand to one between the typical case and
            the bad case, and it is the signature of a queue. When the owner is free your request is answered
            immediately; when 1,500 ants arrive at once you wait behind them. <strong>Averages would have hidden this
                completely</strong>: the mean here is around 100 µs, a number that describes nobody's experience.
            Always look at the tail.</p>
        <h3>Profiling a live process</h3>
        <pre className="plain"><code>{"$ curl -o cpu.prof \"127.0.0.1:9090/debug/pprof/profile?seconds=10\"\n$ go tool pprof -top -nodecount=14 cpu.prof\nFile: antfarm\nType: cpu\nDuration: 10.10s, Total samples = 9970ms (98.69%)\n      flat  flat%   sum%        cum   cum%\n    1030ms 10.33% 10.33%     3230ms 32.40%  runtime.selectgo\n    1000ms 10.03% 20.36%     1000ms 10.03%  runtime.nanotime (partial-inline)\n     820ms  8.22% 28.59%      820ms  8.22%  runtime.lock2\n     720ms  7.22% 35.81%      790ms  7.92%  runtime.unlock2\n     560ms  5.62% 41.42%      560ms  5.62%  time.Now\n     350ms  3.51% 44.93%      520ms  5.22%  runtime.casgstatus\n     320ms  3.21% 48.14%      320ms  3.21%  runtime.duffcopy\n     220ms  2.21% 50.35%      800ms  8.02%  runtime.sellock\n     200ms  2.01% 54.56%     6120ms 61.38%  sim.(*Engine).runAnt\n     180ms  1.81% 56.37%      770ms  7.72%  runtime.mallocgc\n     120ms  1.20% 60.68%      450ms  4.51%  sim.(*antClient).roundTrip.func1\n"}</code></pre>
        <p>That is a real profile of our real program, and it is damning in the most useful way. Read the columns first:
            <strong>flat</strong> is time spent in that function itself, <strong>cum</strong> is time in it plus
            everything it called. So <code>runAnt</code> has 2% flat and 61% cumulative: it does nothing itself and
            everything beneath it.</p>
        <p>Now read the names. <code>selectgo</code> (32% cumulative) is the runtime implementing <code>select</code>.
            <code>lock2</code>, <code>unlock2</code> and <code>sellock</code> are the locks the runtime uses <em>inside
                channels</em>. <code>nanotime</code> and <code>time.Now</code> together are 15%. <code>casgstatus</code>
            is goroutine state transitions, which is scheduling. Add it up: <strong>the overwhelming majority of the CPU
                is channel machinery, timers and scheduling, and almost none of it is ant simulation.</strong></p>
        <p>Not one line of <code>Decide</code>, <code>senseAt</code> or <code>applyAction</code> appears in the top
            fourteen. Our program is not computing; it is communicating about computing.</p>
        <div className="note">
          <h5>Our own instrumentation is in the profile</h5>
          <p><code>time.Now</code> at 5.6% flat, plus a large share of <code>nanotime</code>'s 10%, is substantially
                the <code>RoundTrip</code> histogram we added twenty minutes ago: two clock reads per round trip, three
                million round trips. Observability is not free, and measuring at microsecond granularity in a path that
                takes microseconds is measuring the measurement.</p>
          <p>This is not an argument against instrumenting. It is an argument for knowing the cost and sampling when
                it is too high: observe one round trip in every hundred and multiply, which loses nothing statistically
                and cuts the overhead by 99%. Exercise 9 asks you to do it.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 9</h5>
          <ol>
            <li><strong>Sample the histogram.</strong> Observe roughly 1 in 100 round trips instead of all of them,
                    without a lock and without a per-goroutine counter that a race detector would object to. Re-run the
                    profile and confirm <code>time.Now</code> has fallen. Then answer: what does sampling do to
                    <code>_count</code>, and how should the exposition handle that?</li>
            <li><strong>Add a heap profile to your reading.</strong> <code>curl -o heap.prof 127.0.0.1:9090/debug/pprof/heap</code>, then
                    <code>go tool pprof -top heap.prof</code>. Identify the largest allocation site in the colony and
                    explain why it exists.</li>
            <li><strong>Read the goroutine profile</strong> with
                    <code>curl "127.0.0.1:9090/debug/pprof/goroutine?debug=1"</code> and find the line where 1,500 ants
                    are blocked. This is the single most useful debugging technique in Go and it takes ten seconds.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 9 — open after trying</summary>
          <p><strong>1. Sampling.</strong> The cheapest correct approach is a shared atomic counter and modulo:</p>
          <pre><code>{"type SampledHistogram struct {\n\tHistogram\n\tn    atomic.Int64\n\trate int64 // observe one in every rate\n}\n\nfunc (h *SampledHistogram) Maybe(start time.Time) {\n\tif h.n.Add(1)%h.rate != 0 {\n\t\treturn\n\t}\n\th.Observe(time.Since(start))\n}\n"}</code></pre>
          <p>But note the trap: the caller still has to call <code>time.Now()</code> to produce <code>start</code>, so
                the expensive part happens anyway. The version that actually saves time decides <em>before</em> reading
                the clock, which means the sampling decision must happen at the top of <code>roundTrip</code>:</p>
          <pre><code>{"\tvar start time.Time\n\tsampled := c.e.M.RoundTrip.Should()     // one atomic add, no clock\n\tif sampled {\n\t\tstart = time.Now()\n\t}\n\tdefer func() {\n\t\tif sampled {\n\t\t\tc.e.M.RoundTrip.Observe(time.Since(start))\n\t\t}\n\t}()\n"}</code></pre>
          <p>This is a small but perfect example of why you profile rather than guess: the obvious refactor moves no
                work at all, because the cost was in the clock read, not in the histogram.</p>
          <p><code>_count</code> now undercounts by a factor of <code>rate</code>, so either multiply it on the way
                out (and document that it is estimated) or publish the raw request counter separately and let the
                dashboard divide. Silently exposing a sampled count as though it were exact is how dashboards start
                lying.</p>
          <p><strong>2. Heap profile.</strong> The largest live allocation is the grids: a 128×128 <code>[]int</code>
                plus a <code>[]float64</code>, allocated once. The largest <em>rate</em> of allocation is the frame
                snapshots from Milestone 10, which build three slices per frame. Everything in the ant path allocates
                nothing, which is what <code>0 allocs/op</code> in the Milestone 2 benchmark predicted.</p>
          <p><strong>3. Goroutine profile.</strong> You will see something like
                <code>1500 @ ... sim.(*antClient).roundTrip</code> followed by <code>runtime.selectgo</code>, which
                tells you where they are parked and, with <code>debug=2</code>, how long they have been there. When a Go
                service hangs in production, this endpoint is almost always how you find out why, and it works on a
                process that is otherwise unresponsive.</p>
        </details>
        <h4>Common mistakes in Milestone 9</h4>
        <div className="warn">
          <ul>
            <li><strong><code>import _ "net/http/pprof"</code> plus a public <code>DefaultServeMux</code>.</strong>
                    Profiles on the internet.</li>
            <li><strong>A metric per ant ID.</strong> Cardinality explosion: 50,000 time series, a scraper in
                    distress, and a bill. Aggregate.</li>
            <li><strong>Copying a struct containing an atomic or a <code>Counter</code>.</strong> The copy has its
                    own value and stops tracking. <code>go vet</code> catches it.</li>
            <li><strong>Branching on <code>len(ch)</code>.</strong> It is stale the instant you read it. Fine to
                    publish, wrong to decide with.</li>
            <li><strong>An <code>http.Server</code> with no timeouts.</strong> The zero value has none, which is a
                    denial-of-service waiting to happen.</li>
            <li><strong>Averaging latency.</strong> The mean of a queueing distribution describes nobody.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why keep the ledger as plain ints owned by one goroutine when atomics are available?</li>
          <li>How does <code>bits.Len64</code> produce a histogram bucket, and why is that cheap?</li>
          <li>Your p99 reads 8 ms. What do you actually know about the 99th percentile?</li>
          <li>What is the danger in <code>import _ "net/http/pprof"</code>?</li>
          <li>In the profile, <code>runAnt</code> is 2% flat and 61% cumulative. Explain both numbers.</li>
          <li>Why did adding a latency histogram show up as <code>time.Now</code> in the profile, and what would you
                do about it?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 10</span>A live picture, in the terminal and the browser
        </h2>
        <h3>Goal</h3>
        <p>See the colony. An ANSI-redrawn terminal view for a quick look, and a browser page fed by server-sent events
            for a good one. Neither may ever slow the simulation down.</p>
        <h3>Concepts</h3>
        <p>Aggregating at the source, snapshot values as an interface between subsystems, ANSI escape codes, server-sent
            events, <code>http.Flusher</code>, request contexts as the client's lifetime, and dropping frames as a
            policy.</p>
        <h3>Design</h3>
        <p>The naive viewer asks for the whole world and draws it. At 512×512 with pheromone that is half a megabyte per
            frame, serialised to JSON, sixty times a second, and all of it built on the owner's goroutine while 50,000
            ants wait. The viewer would become the bottleneck of the simulation it is supposed to observe.</p>
        <p>So the rule is: <strong>aggregate at the source</strong>. The owner builds a small, fixed-size
            <code>Frame</code>, downsampled to whatever resolution the client asked for, and that is all that ever
            leaves the simulation.</p>
        <pre className="plain"><code>{"owner goroutine                  viewer(s)\n───────────────                  ─────────\nholds 512x512 grids    ──►  Frame: 96x96 buckets, ~3 slices\nbuilds one Frame            terminal renderer  → ANSI text\nper request                 SSE handler        → JSON over HTTP\n                            (either, both, or none)\n"}</code></pre>
        <p>A second rule follows from the first: <strong>the viewer may never block the simulation</strong>. If a frame
            cannot be produced in time, the viewer skips it. A dropped frame is invisible to a human; a stalled colony
            is not.</p>
        <h3>Implementation</h3>
        <h4>The frame</h4>
        <pre><code>{"// Frame is a downsampled picture of the colony, built by the owner and\n// small enough to send many times a second. Aggregating at the source\n// rather than shipping the whole grid is what keeps the viewer cheap.\ntype Frame struct {\n\tCols int       `json:\"cols\"`\n\tRows int       `json:\"rows\"`\n\tFood []int     `json:\"food\"` // Cols*Rows, summed per block\n\tPher []float64 `json:\"pher\"` // Cols*Rows, summed per block\n\tAnts []int     `json:\"ants\"` // Cols*Rows, ants per block\n\tNest [2]int    `json:\"nest\"`\n\tStats Stats    `json:\"stats\"`\n}\n\nfunc (e *Engine) frameNow(cols int) Frame {\n\tif cols <= 0 || cols > e.cfg.Width {\n\t\tcols = min(64, e.cfg.Width)\n\t}\n\trows := max(1, e.cfg.Height*cols/e.cfg.Width)\n\n\tf := Frame{ /* ... allocate cols*rows slices ... */ }\n\n\tfor y := range e.cfg.Height {\n\t\tfor x := range e.cfg.Width {\n\t\t\tp := world.Position{X: x, Y: y}\n\t\t\tfood, pher := e.world.Food.At(p), e.world.Pher.At(p)\n\t\t\tif food == 0 && pher == 0 {\n\t\t\t\tcontinue\n\t\t\t}\n\t\t\ti := (y*rows/e.cfg.Height)*cols + x*cols/e.cfg.Width\n\t\t\tf.Food[i] += food\n\t\t\tf.Pher[i] += pher\n\t\t}\n\t}\n\tfor _, p := range e.positions {\n\t\tf.Ants[(p.Y*rows/e.cfg.Height)*cols+p.X*cols/e.cfg.Width]++\n\t}\n\tf.Stats = e.statsNow()\n\treturn f\n}\n"}</code></pre>
        <p>Two things to notice.</p>
        <p>The struct tags (<code>`json:"cols"`</code>) control JSON field names. They are a string literal attached to
            a field, read by <code>encoding/json</code> through reflection at run time. <code>go vet</code> checks them
            for you, which is how I caught a duplicate tag while writing this:
            <code>struct field Rows repeats json tag "cols"</code>. A typo in a string that silently produces the wrong
            wire format is exactly the kind of thing that should be checked, and it is.</p>
        <p>The <code>continue</code> on empty cells is not micro-optimisation, it is the difference between scanning and
            doing work: most of a colony's grid is empty most of the time, so the loop touches 262,144 cells but does
            arithmetic on very few. The scan itself is the remaining cost, and Exercise 10 asks what to do about it.</p>
        <p><strong>Where do ant positions come from?</strong> The owner does not own ants, so it cannot read their
            positions. But it sees every move request, so it can remember them:</p>
        <pre><code>{"\tcase ActMove:\n\t\tnp := e.world.Clamp(r.pos.Add(r.act.Dir))\n\t\tif r.id >= 0 && r.id < len(e.positions) {\n\t\t\te.positions[r.id] = np\n\t\t}\n"}</code></pre>
        <p>A slice indexed by ant ID, written only by the owner. The viewer gets ant positions with no extra messages
            and no synchronisation, because the information was already flowing past. <em>Deriving a view from a message
                stream you already have</em> is the cheapest kind of observability, and it generalises: event sourcing
            is this idea taken seriously.</p>
        <h4>The terminal renderer</h4>
        <pre><code>{"// shades map a density to a character, densest last.\nvar shades = []rune{' ', '.', ':', '-', '=', '+', '*', '#', '%', '@'}\n\n// Terminal redraws the colony in place using ANSI escape codes.\nfunc Terminal(ctx context.Context, w io.Writer, e *sim.Engine, cols int, every time.Duration) error {\n\tticker := time.NewTicker(every)\n\tdefer ticker.Stop()\n\n\tfmt.Fprint(w, \"\\x1b[?25l\")       // hide the cursor\n\tdefer fmt.Fprint(w, \"\\x1b[?25h\") // and always put it back\n\n\tfor {\n\t\tselect {\n\t\tcase <-ctx.Done():\n\t\t\treturn nil\n\t\tcase <-ticker.C:\n\t\t\tf, err := e.Frame(ctx, cols)\n\t\t\tif err != nil {\n\t\t\t\tcontinue // a dropped frame is not worth stopping for\n\t\t\t}\n\t\t\tfmt.Fprint(w, \"\\x1b[H\\x1b[2J\") // home, then clear\n\t\t\tfmt.Fprint(w, Render(f))\n\t\t}\n\t}\n}\n"}</code></pre>
        <p>ANSI escape codes are a tiny language your terminal speaks: <code>\x1b</code> is the escape character,
            <code>[H</code> moves the cursor to the top left, <code>[2J</code> clears the screen, <code>[?25l</code> and
            <code>[?25h</code> hide and show the cursor. No library needed for this much. The <code>defer</code> that
            restores the cursor matters: a program that exits with the cursor hidden leaves the user's terminal broken,
            and "put back what you changed" applies to terminals as much as to files.</p>
        <p><code>Render</code> is a separate pure function taking a <code>Frame</code> and returning a
            <code>string</code>, so it can be tested without a terminal, a simulation or a goroutine. Splitting "produce
            the bytes" from "write the bytes to a live device" is a habit worth having; it also makes the renderer
            reusable by the web view if you ever want an ASCII mode.</p>
        <pre><code>{"func Render(f sim.Frame) string {\n\tvar b strings.Builder\n\tb.Grow(f.Rows*(f.Cols+1) + 256)\n\t...\n}\n"}</code></pre>
        <p><code>strings.Builder</code> with <code>Grow</code> is the right way to assemble a string in Go: building
            with <code>s += ...</code> in a loop is O(n²) because strings are immutable and every concatenation copies.
            <code>Grow</code> pre-sizes the buffer so the builder never reallocates.</p>
        <h4>Server-sent events</h4>
        <p>For the browser we need a push channel. The options are WebSockets (bidirectional, needs a library or a
            hand-rolled handshake), long polling (awkward), or server-sent events (one-way, plain HTTP, built into every
            browser as <code>EventSource</code>, about fifteen lines of server code). We only push, so SSE wins easily.
        </p>
        <pre><code>{"func stream(w http.ResponseWriter, r *http.Request, e *sim.Engine, cols int, every time.Duration) {\n\tflusher, ok := w.(http.Flusher)\n\tif !ok {\n\t\thttp.Error(w, \"streaming unsupported\", http.StatusInternalServerError)\n\t\treturn\n\t}\n\tw.Header().Set(\"Content-Type\", \"text/event-stream\")\n\tw.Header().Set(\"Cache-Control\", \"no-cache\")\n\n\t// r.Context() is cancelled when the browser tab closes, which is how\n\t// this goroutine learns to stop.\n\tctx, cancel := context.WithCancel(r.Context())\n\tdefer cancel()\n\n\tticker := time.NewTicker(every)\n\tdefer ticker.Stop()\n\n\tenc := json.NewEncoder(w)\n\tfor {\n\t\tselect {\n\t\tcase <-ctx.Done():\n\t\t\treturn\n\t\tcase <-ticker.C:\n\t\t\tf, err := e.Frame(ctx, cols)\n\t\t\tif err != nil {\n\t\t\t\tcontinue // drop this frame rather than stall the simulation\n\t\t\t}\n\t\t\tfmt.Fprint(w, \"data: \")\n\t\t\tif err := enc.Encode(f); err != nil {\n\t\t\t\treturn\n\t\t\t}\n\t\t\tfmt.Fprint(w, \"\\n\")\n\t\t\tflusher.Flush()\n\t\t}\n\t}\n}\n"}</code></pre>
        <ul>
          <li><strong>The SSE wire format</strong> is the whole protocol: <code>data: </code> then a payload then a
                blank line. <code>json.Encoder.Encode</code> conveniently appends a newline, so the extra
                <code>Fprint(w, "\n")</code> completes the pair.</li>
          <li><strong><code>w.(http.Flusher)</code></strong> is a type assertion: <code>http.ResponseWriter</code> is
                an interface, and the concrete value behind it may or may not support flushing. Without
                <code>Flush</code>, Go buffers the response and the browser receives nothing until the handler returns,
                which for a stream is never. This is the classic SSE bug.</li>
          <li><strong><code>r.Context()</code> is cancelled when the client disconnects.</strong> That is how this
                goroutine finds out the tab was closed. Without it, every closed tab would leave a goroutine ticking
                forever, and a page that the user opens and closes fifty times leaks fifty goroutines.</li>
          <li><strong>The <code>continue</code> on error</strong> is the "never block the simulation" rule. If
                <code>Frame</code> times out because the owner is saturated, we skip that frame and try again in 100 ms.
            </li>
        </ul>
        <p>The browser client is 25 lines of dependency-free JavaScript in a Go string constant: an
            <code>EventSource</code>, a <code>canvas</code>, and a loop writing RGBA pixels straight into an
            <code>ImageData</code>. Ants go in the red channel, food in green, pheromone in blue and a little green, and
            the canvas is scaled up with <code>image-rendering: pixelated</code>. No build step, no framework, and the
            binary still has nothing to ship alongside it.</p>
        <div className="exercise">
          <h5>Exercise 10</h5>
          <ol>
            <li><strong>Frame budget.</strong> Measure how long <code>frameNow</code> takes at 512×512 by adding a
                    histogram, then serve two browser tabs at 60 fps and watch the round-trip p99 for ants. Quantify the
                    harm the viewer does.</li>
            <li><strong>Fix it two ways.</strong> First: have the owner build a frame at most every N milliseconds
                    and hand the same cached <code>Frame</code> to every client that asks in between. Second: keep
                    running per-block totals updated incrementally as food and pheromone change, so building a frame is
                    a copy rather than a scan. Compare the complexity of the two.</li>
            <li><strong>Add a control.</strong> A POST endpoint that pauses and resumes the colony. The interesting
                    question is where "paused" lives: the owner, the ants, or somewhere else.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 10 — open after trying</summary>
          <p><strong>1.</strong> Expect several milliseconds per frame at 512×512, because the scan is a quarter of a
                million cells. Two clients at 60 fps is 120 scans per second, which can consume a large fraction of the
                owner's time, and you will see the ant round-trip p99 climb. The viewer, added to observe the system,
                has changed the system.</p>
          <p><strong>2a. Caching.</strong> Roughly ten lines: keep <code>lastFrame Frame</code> and
                <code>lastFrameAt time.Time</code> in the owner, and serve the cached copy if it is fresh enough. It
                decouples client count from cost entirely, which is the whole problem, and it is the right first fix.
            </p>
          <pre><code>{"\tcase reqFrame:\n\t\tif time.Since(e.lastFrameAt) < e.cfg.FrameInterval {\n\t\t\tr.reply <- response{frame: e.lastFrame}\n\t\t\treturn\n\t\t}\n\t\te.lastFrame = e.frameNow(r.id)\n\t\te.lastFrameAt = time.Now()\n\t\tr.reply <- response{frame: e.lastFrame}\n"}</code></pre>
          <p>One subtlety: the cached <code>Frame</code> contains slices, and now several goroutines hold copies of
                the struct pointing at the same backing arrays. Since nothing mutates a frame after it is built, that is
                safe, but it is safe by convention rather than by construction, and it deserves a comment. If a client
                ever wanted to modify a frame in place, this would become a race.</p>
          <p><strong>2b. Incremental totals.</strong> Keep <code>blockFood []int</code> and
                <code>blockPher []float64</code> updated in <code>applyAction</code>, so the frame is a
                <code>copy</code> of two small slices. Frame cost becomes proportional to the frame, not the world. The
                price: every mutation site must remember to update the totals, the block mapping is now duplicated in
                two places, and any bug produces a view that drifts slowly away from reality. This is the classic
                denormalisation trade, and the honest answer for this project is to cache first and only denormalise if
                the profile still says so.</p>
          <p><strong>3. Pause.</strong> The tempting place is a <code>paused atomic.Bool</code> that every ant checks,
                which works and spreads the concept over 50,000 goroutines. The tidier answer is a single
                <code>paused</code> flag owned by the owner: when paused, it stops answering <code>reqSense</code> and
                <code>reqAct</code> and just buffers, so ants block naturally in their round trips with no new code at
                all. It also gives you the right semantics for free (a paused colony's clients are waiting, not
                spinning) and pausing becomes a property of the world rather than an agreement among ants. Watch out for
                one thing: ants will start timing out, so pausing should also suppress the timeout counter, or your
                metrics will report an incident every time someone hits the button.</p>
        </details>
        <h4>Common mistakes in Milestone 10</h4>
        <div className="warn">
          <ul>
            <li><strong>Forgetting <code>Flush()</code>.</strong> The stream appears dead; the browser shows nothing
                    forever.</li>
            <li><strong>Ignoring <code>r.Context()</code>.</strong> A goroutine per closed tab, leaked permanently.
                </li>
            <li><strong>Writing to a <code>ResponseWriter</code> from two goroutines.</strong> It is not safe for
                    concurrent use. One handler, one writer.</li>
            <li><strong>Sending the full grid.</strong> The viewer becomes the bottleneck.</li>
            <li><strong>Blocking the owner on a slow client.</strong> Never let a TCP connection's backpressure
                    reach your simulation loop; drop frames instead.</li>
            <li><strong>Leaving the terminal cursor hidden</strong> or the screen in an escape mode on exit.</li>
            <li><strong>Building strings with <code>+=</code> in the render loop.</strong> Quadratic.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does the owner downsample instead of returning the grid?</li>
          <li>How does the owner know where the ants are, given that it does not own them?</li>
          <li>What does <code>http.Flusher</code> do and what happens without it?</li>
          <li>How does an SSE handler learn that the browser tab closed?</li>
          <li>Why is <code>Render</code> a separate pure function?</li>
          <li>The viewer must never block the simulation. Where in the code is that policy expressed?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 11</span>Making it fast, guided by the profile</h2>
        <h3>Goal</h3>
        <p>Take the profile from Milestone 9 seriously and rewrite the hot path. Sensing becomes a lock-free read with
            no message at all, moves and drops become one-way messages, and writes are sharded across several owners.
            Then measure honestly.</p>
        <h3>Concepts</h3>
        <p>Atomics for concurrent reads with single-owner writes, fixed-point arithmetic because Go has no atomic float,
            one-way messages, sharding by region, closing channels to drain them, and a genuine correctness bug found by
            a conservation test.</p>
        <h3>Design</h3>
        <p>The profile said: channel operations, timers and scheduling dominate; simulation logic is invisible. So the
            optimisation strategy writes itself. <em>Do fewer channel operations.</em> Where do they come from?</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Operation</th>
              <th>Frequency</th>
              <th>Messages</th>
              <th>Could it be fewer?</th>
            </tr>
            <tr>
              <td>Sense</td>
              <td>every tick, every ant</td>
              <td>2 (request + reply)</td>
              <td>Yes: reads can be atomic</td>
            </tr>
            <tr>
              <td>Move</td>
              <td>~95% of ticks</td>
              <td>2</td>
              <td>Yes: the new position is computable locally; only the pheromone deposit needs the world</td>
            </tr>
            <tr>
              <td>Pickup</td>
              <td>rare</td>
              <td>2</td>
              <td>No: only the owner can decide who gets the last unit</td>
            </tr>
            <tr>
              <td>Drop</td>
              <td>rare</td>
              <td>2</td>
              <td>Mostly: the ant knows it is at the nest</td>
            </tr>
          </tbody>
        </table>
        <p>So roughly 99% of the traffic is sensing and moving, and both can largely be eliminated. Three changes:</p>
        <ol>
          <li><strong>Reads become atomic loads.</strong> If every grid cell is an <code>atomic.Int64</code>, any
                goroutine may read it race-free at any time with no message. Writes stay single-owner, so there is no
                compare-and-swap loop and no contention between writers.</li>
          <li><strong>Moves and drops become one-way messages.</strong> No reply channel, no waiting, no timer. The
                ant computes its own new position and fires a deposit at the world if it is carrying.</li>
          <li><strong>Writes are sharded.</strong> N goroutines, each owning a horizontal band of rows. An operation
                goes to the shard that owns its row. There is no longer a single serialisation point.</li>
        </ol>
        <pre className="plain"><code>{"Milestone 5 engine                    Milestone 11 engine\n──────────────────                    ───────────────────\nsense  → message → owner → reply      sense  → atomic loads (no message)\nmove   → message → owner → reply      move   → local compute\n                                             + one-way deposit if carrying\npickup → message → owner → reply      pickup → message → shard → reply\ndrop   → message → owner → reply      drop   → one-way message → shard\n\n1 owner, ~2 msgs/tick/ant             N shards, ~0.05 msgs/tick/ant"}</code></pre>
        <div className="warn">
          <h5>This trades safety for speed, deliberately</h5>
          <p>The single-owner design had a property we are giving up: every world access was validated by one
                authority that saw everything in order. Now an ant computes its own position, so a buggy behaviour can
                put itself somewhere impossible; a drop is fire-and-forget, so nobody tells the ant it was rejected. We
                keep validation exactly where correctness demands it (a pickup still needs an authoritative answer about
                who got the unit) and drop it where the ant can be trusted.</p>
          <p>Do this <em>after</em> a profile, never before. The Milestone 5 engine is the one I would ship if 3
                million requests a second were enough, and it is the one to write first in any new system.</p>
        </div>
        <h3>Implementation</h3>
        <h4>The atomic grid, and the missing atomic float</h4>
        <pre><code>{"// pherScale turns float concentrations into fixed-point integers. Go has no\n// atomic float64, so we store thousandths and convert on read.\nconst pherScale = 1000\n\n// AtomicGrid is a grid that any goroutine may read without synchronisation\n// and that only the owner of a row band may write. Reads use atomic loads,\n// so they are race-free; writes stay single-owner, so no compare-and-swap\n// loop is needed.\ntype AtomicGrid struct {\n\tW, H  int\n\tcells []atomic.Int64\n}\n\nfunc (g *AtomicGrid) At(p Position) int64 {\n\tif !g.InBounds(p) {\n\t\treturn 0\n\t}\n\treturn g.cells[p.Y*g.W+p.X].Load()\n}\n\nfunc (g *AtomicGrid) AtFloat(p Position) float64 {\n\treturn float64(g.At(p)) / pherScale\n}\n\n// TakeOne removes a unit if there is one, reporting whether it succeeded.\nfunc (g *AtomicGrid) TakeOne(p Position) bool {\n\tif !g.InBounds(p) {\n\t\treturn false\n\t}\n\tc := &g.cells[p.Y*g.W+p.X]\n\tif c.Load() <= 0 {\n\t\treturn false\n\t}\n\tc.Add(-1)\n\treturn true\n}\n"}</code></pre>
        <p><strong>Go has no atomic float64</strong>, and the reason is that the atomic instructions operate on
            integers. The standard workaround is fixed point: store thousandths as an integer and divide on read. You
            give up range and precision (a pheromone of 0.0004 is zero here) and gain a data type that
            <code>atomic.Int64</code> can hold. The alternative, <code>math.Float64bits</code> with a CAS loop, gives
            you exact floats at the cost of a retry loop; fixed point is simpler and good enough for a concentration.
        </p>
        <p><code>TakeOne</code> is load-then-add rather than a compare-and-swap loop, and that is safe <em>only</em>
            because a single shard owns every write to this row. Two writers would race between the <code>Load</code>
            and the <code>Add</code> and could both take the last unit, driving the cell negative. The race detector
            would not catch it, because both operations are atomic; the food conservation test would. <strong>Atomics
                prevent torn reads and writes, not logical races.</strong> Write the ownership rule in a comment on the
            type, as this code does, because nothing else enforces it.</p>
        <h4>Shards</h4>
        <pre><code>{"// shardFor maps a row to the goroutine that owns it.\nfunc (e *FastEngine) shardFor(p world.Position) chan writeOp {\n\ti := p.Y * len(e.shard) / e.cfg.Height\n\t...\n\treturn e.shard[i]\n}\n\n// runShard owns one band of rows: it is the only writer of those cells.\nfunc (e *FastEngine) runShard(ctx context.Context, i int) {\n\tlo, hi := e.bandOf(i)\n\tticker := time.NewTicker(e.cfg.EvaporateEvery)\n\tdefer ticker.Stop()\n\n\tfor {\n\t\tselect {\n\t\tcase <-ctx.Done():\n\t\t\treturn\n\t\tcase <-ticker.C:\n\t\t\te.pher.EvaporateBand(lo, hi, e.cfg.Evaporation)\n\t\tcase op, open := <-e.shard[i]:\n\t\t\tif !open {\n\t\t\t\treturn // every ant has stopped and the queue is drained\n\t\t\t}\n\t\t\tswitch op.kind {\n\t\t\tcase opDeposit:\n\t\t\t\te.pher.AddFloat(op.pos, e.cfg.Deposit, e.cfg.PherMax)\n\t\t\tcase opPickUp:\n\t\t\t\top.reply <- e.food.TakeOne(op.pos)\n\t\t\tcase opDrop:\n\t\t\t\te.M.Delivered.Inc()\n\t\t\t}\n\t\t}\n\t}\n}\n"}</code></pre>
        <p>Each shard now also evaporates its own band, which turns Milestone 6's single O(cells) pass on one goroutine
            into N parallel passes of O(cells/N). The horizontal-band split is chosen because ants move locally: an ant
            spends most of its life in one or two bands, so cross-shard traffic is low. A hash of the position would
            spread load perfectly and destroy that locality.</p>
        <p>The sense path now needs no shard at all:</p>
        <pre><code>{"// senseFast reads the world directly. No message, no reply, no waiting.\nfunc (e *FastEngine) senseFast(pos world.Position) Sense {\n\ts := Sense{Pos: pos, Nest: e.nest, Food: int(e.food.At(pos))}\n\tfor i, d := range directions[:8] {\n\t\tn := pos.Add(d)\n\t\ts.Adjacent[i] = int(e.food.At(n))\n\t\ts.Pher[i] = e.pher.AtFloat(n)\n\t}\n\treturn s\n}\n"}</code></pre>
        <p>Seventeen atomic loads and a struct return. Measured: <strong>29 nanoseconds</strong>, against a median of 2
            µs for the message-based version. Roughly seventy times faster for the single most frequent operation in the
            program.</p>
        <h4>Fire and forget, with shedding</h4>
        <pre><code>{"// send is fire-and-forget with load shedding: if the owning shard is\n// saturated, the deposit is dropped rather than stalling the ant.\nfunc (e *FastEngine) send(ctx context.Context, op writeOp) {\n\tselect {\n\tcase e.shardFor(op.pos) <- op:\n\tcase <-ctx.Done():\n\tdefault:\n\t\te.M.Dropped.Inc()\n\t}\n}\n"}</code></pre>
        <p>This is backpressure policy expressed in four lines, and the choice it encodes is: <em>a lost pheromone
                deposit is better than a stalled ant</em>. That is correct for pheromone, which is statistical and
            evaporates anyway, and it would be catastrophic for the pickup path, which is why pickups do not use this
            function. <strong>Shedding policy is per-message-type, not per-system</strong>, and deciding it message by
            message is the whole discipline.</p>
        <h3>The bug the conservation test found</h3>
        <p>The first version passed <code>-race</code> cleanly and failed this:</p>
        <pre className="plain"><code>{"--- FAIL: TestFastEngineConservesFood (0.74s)\n    fast_test.go:22: food not conserved: 359 != 500\n        (ants 500 carrying 182 delivered 81 food left 96)\n"}</code></pre>
        <p>141 units of food had ceased to exist. No race, no panic, no error in any log. Instrumenting the ledger
            showed 336 successful pickups, 216 drops, 90 ants carrying: 30 units taken from the ground that no ant held
            and nobody delivered.</p>
        <p>The cause was two shutdown bugs, both of them the kind that only appear at the boundary:</p>
        <pre className="bad"><code>{"\t// BUG 1: when ctx is cancelled while we wait for the pickup answer,\n\t// select may choose Done even though the reply is ready. The shard\n\t// already took the food. We just threw it away.\n\tselect {\n\tcase ok := <-reply:\n\t\ta.Carrying = ok\n\tcase <-ctx.Done():\n\t\treturn\n\t}\n"}</code></pre>
        <p>Remember that <code>select</code> picks randomly among ready cases. At cancellation time, a couple of dozen
            ants were mid-pickup; for each, the world had already removed a unit of food, and half of them discarded the
            answer. The fix is to insist on collecting an answer you have already paid for:</p>
        <pre><code>{"\t\tcase <-ctx.Done():\n\t\t\t// The shard may already have taken a unit on our behalf.\n\t\t\t// Collect the answer anyway, or that food vanishes from\n\t\t\t// the ledger.\n\t\t\ttimer := time.NewTimer(e.cfg.RequestTimeout)\n\t\t\tdefer timer.Stop()\n\t\t\tselect {\n\t\t\tcase ok := <-reply:\n\t\t\t\ta.Carrying = ok\n\t\t\tcase <-timer.C:\n\t\t\t\te.M.Lost.Inc()\n\t\t\t}\n\t\t\treturn\n"}</code></pre>
        <p>Bug two was queued drops being discarded when the shards were cancelled with work still in their channels.
            The fix uses the one safe way to close a channel:</p>
        <pre><code>{"\t<-ctx.Done()\n\tantWG.Wait() // every sender has stopped, so closing is now safe\n\tfor i := range e.shard {\n\t\tclose(e.shard[i])\n\t}\n\tshardWG.Wait()\n"}</code></pre>
        <p>Closing a channel that senders might still use panics, which is why Milestone 5 forbade it. Here it is not
            only safe but exactly right, because <code>antWG.Wait()</code> has already established that every sender has
            stopped. A closed channel keeps delivering its buffered values before reporting closed, so
            <code>op, open := {'<'}-ch</code> drains the queue and <em>then</em> exits.
            <strong>Close-after-senders-finish is the idiomatic way to say "process everything remaining, then
                stop".</strong></p>
        <p>Two lessons worth more than the speedup. First, <strong>a race detector cannot find a logic bug</strong>:
            every operation here was properly synchronised and the program was still wrong. Invariant tests find what
            sanitisers cannot. Second, <strong>shutdown is where work gets lost</strong>, in this project and in every
            queueing system, because that is the one moment when the pipeline is asked to stop while it is still full.
        </p>
        <h3>Measuring</h3>
        <p>Food delivered in a fixed two-second window, same seed, same world, single-owner engine versus sharded:</p>
        <pre className="plain"><code>{"  500 ants: owner   827 delivered | sharded  1180 delivered | 1.4x\n 2000 ants: owner   811 delivered | sharded  1458 delivered | 1.8x\n\n(an earlier run on a quieter machine: 1.4x and 2.9x)\n"}</code></pre>
        <p>Be careful about what this shows. <strong>My container has one core</strong>, so none of this gain comes from
            parallelism; it is all reduced overhead, which is exactly what the profile predicted. On a multi-core
            machine you should see considerably more, because sharded writes and parallel evaporation can then genuinely
            run at the same time. Run it yourself and compare with <code>GOMAXPROCS</code> set to 1, 2, 4 and 8; unlike
            the Milestone 4 mutex version, this one should improve rather than degrade.</p>
        <p>Notice also that the gain grows with the number of ants (1.4× at 500, 1.8–2.9× at 2,000). That is the
            signature of removing a serialisation point: with few clients the owner was never the bottleneck, so
            removing it changes little.</p>
        <div className="exercise">
          <h5>Exercise 11</h5>
          <ol>
            <li><strong>Find the new bottleneck.</strong> Profile the sharded engine and report what dominates now.
                    Predict before you look, then check.</li>
            <li><strong>Escape analysis.</strong> Run
                    <code>go build -gcflags='-m' ./internal/sim/ 2{'>'}&1 | grep escapes</code> and find one
                    allocation in the ant path. Explain why it escapes to the heap and whether you can prevent it.</li>
            <li><strong>Shard count sweep.</strong> Measure throughput with 1, 2, 4, 8, 16 and 64 shards on your
                    machine. There is an optimum, and it is not "as many as possible". Explain both sides of the curve.
                </li>
            <li><strong>Cross-shard cost.</strong> Add a counter for operations sent to a shard that does not own
                    the ant's current band, then compare horizontal bands against a hash of the position. Confirm or
                    refute the locality argument with data.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 11 — open after trying</summary>
          <p><strong>1.</strong> With sensing free and most messages gone, the profile shifts to <code>Decide</code>
                (which is now genuinely a large share, since it is the only real computation left), the random number
                generator inside <code>weightedStep</code>, and <code>EvaporateBand</code>. That is a healthy profile:
                the program is finally spending its time on the simulation. The next optimisation would be algorithmic
                (lazy evaporation with timestamps instead of periodic sweeps), not mechanical.</p>
          <p><strong>2.</strong> <code>reply := make(chan bool, 1)</code> in the pickup path escapes, because the
                shard goroutine keeps a reference to it. It is allocated once per ant, not per operation, so it is not
                worth removing. Escape analysis output is dense; the useful discipline is to read it once per project
                and learn which patterns in <em>your</em> code allocate. The general rule in Go: a value escapes if its
                address outlives the function, which includes being stored in an interface, sent on a channel, or
                captured by a goroutine.</p>
          <p><strong>3.</strong> Too few shards and you are back to a serialisation point. Too many and you get: more
                goroutines than cores (so scheduling overhead with no parallelism gain), thinner bands (so more
                cross-band traffic as ants wander across boundaries), and N evaporation tickers firing independently.
                The optimum is usually close to <code>GOMAXPROCS</code>, which is why that is a sensible default, and
                the flat region around it is usually wide.</p>
          <p><strong>4.</strong> With bands, cross-shard traffic is low precisely because ants move one cell at a
                time; you should measure a small percentage. With a hash, essentially every operation crosses. The
                interesting part is that throughput may not differ much on a single machine, because a channel send
                costs the same either way. It matters enormously once shards live on different machines and a
                cross-shard operation becomes a network hop. <strong>Locality is cheap insurance that only pays out when
                    you distribute</strong>, which is precisely Milestone 12.</p>
        </details>
        <h4>Common mistakes in Milestone 11</h4>
        <div className="warn">
          <ul>
            <li><strong>Optimising before profiling.</strong> Everything in this milestone was chosen by reading the
                    profile. Guesses would have targeted <code>Decide</code>, which was never the problem.</li>
            <li><strong>Two writers to an atomic cell with load-then-add.</strong> Atomic operations, non-atomic
                    sequence, silent corruption.</li>
            <li><strong>Assuming <code>-race</code> proves correctness.</strong> It found nothing here; the
                    conservation test found everything.</li>
            <li><strong>Closing a channel with senders still alive.</strong> Panic. Close only after a
                    <code>WaitGroup</code> proves they are done.</li>
            <li><strong>Discarding a reply during shutdown.</strong> The work was already performed; throwing the
                    answer away loses it.</li>
            <li><strong>Sharding by hash</strong> when your workload has locality.</li>
            <li><strong>Reporting speedups from a machine with one core</strong> without saying so.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why can reads be atomic while writes stay single-owner, and what breaks if two goroutines write?</li>
          <li>Why fixed point instead of <code>float64</code> for pheromone?</li>
          <li>Which operations kept their reply, and what is the rule for deciding?</li>
          <li>Why does horizontal banding beat hashing for this workload?</li>
          <li>Explain why <code>select</code>'s random choice caused food to disappear at shutdown.</li>
          <li>When is closing a channel the right shutdown signal, and when is it a panic?</li>
          <li>The speedup grew with ant count. What does that tell you about what was removed?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 12</span>The world moves to another process</h2>
        <h3>Goal</h3>
        <p>Run the world in one process and ants in another, talking over TCP. Kill the world, watch the ants wait and
            reconnect, and see what the network costs.</p>
        <h3>Concepts</h3>
        <p>Interfaces as the seam between local and remote, <code>encoding/gob</code>, one goroutine per connection,
            connection ownership and why the client is not thread-safe, socket deadlines as the network form of a
            timeout, reconnection with jittered backoff, and a shutdown bug that only a network can give you.</p>
        <h3>Design</h3>
        <p>This is the milestone that Milestone 5 was secretly building toward. Because the local protocol was already
            values in and values out, the change is mostly mechanical: give it a name as an interface, implement that
            interface twice.</p>
        <pre><code>{"// WorldService is everything an ant needs from the world. Both the local\n// engine and the network client implement it, which is what lets an ant run\n// unchanged against a world in another process.\ntype WorldService interface {\n\tSense(pos world.Position) (Sense, error)\n\tAct(id int, pos world.Position, carrying bool, act Action) (ActResult, error)\n}\n"}</code></pre>
        <p>Two methods. The local engine satisfies it with atomic reads and channel sends; the network client satisfies
            it with gob over a socket. Notice that both methods return an <code>error</code>, including the local one
            where nothing can fail. <strong>Designing the interface for the failing implementation is what makes the
                seam work</strong>: had <code>Sense</code> returned only a <code>Sense</code>, the remote version could
            not have reported a broken connection without panicking or lying.</p>
        <pre className="plain"><code>{"  process A: ants                        process B: the world\n  ───────────────                        ────────────────────\n  ant goroutine ─► netsim.Client ──TCP──► netsim.Server ─► FastEngine\n       ▲               (one per ant)         (one goroutine      (shards)\n       │                                      per connection)\n  same loop as milestone 5\n"}</code></pre>
        <h3>Implementation</h3>
        <h4>The wire format</h4>
        <pre><code>{"// Req and Resp are the wire format. They contain only values, which is\n// exactly why the local protocol from milestone 5 could become a network\n// protocol without redesign.\ntype Req struct {\n\tKind     Kind\n\tID       int\n\tPos      world.Position\n\tCarrying bool\n\tAct      sim.Action\n}\n\ntype Resp struct {\n\tSense sim.Sense\n\tPos   world.Position\n\tNest  world.Position\n\tOK    bool\n\tErr   string // errors do not survive gob; send the text\n}\n"}</code></pre>
        <p><code>encoding/gob</code> is Go's native binary serialisation: self-describing, type-safe between Go
            programs, and requiring no schema file or code generation. It is a good fit here and a poor fit for anything
            that must interoperate with another language, where you would reach for protobuf or JSON. <code>gob</code>
            sends type descriptions once per connection and then compact values, so a long-lived connection is
            efficient.</p>
        <p><strong>Errors do not travel.</strong> <code>error</code> is an interface, and gob can only encode concrete
            types it has been told about, so an <code>error</code> field would fail to encode or arrive as something
            unusable. Sending the message as a string and reconstructing an error on the far side is the simple,
            standard answer. The cost is that <code>errors.Is</code> no longer works across the wire, which is a real
            loss: a remote <code>ErrNoFood</code> arrives as an unrelated error with the same text. Production protocols
            solve this with numeric error codes, which is worth knowing as the reason gRPC has a status enum.</p>
        <h4>The server</h4>
        <pre><code>{"// Server exposes a sim.WorldService over TCP. Each connection gets one\n// goroutine, which is the standard Go server shape and costs almost nothing\n// because goroutines are cheap.\nfunc (s *Server) handle(conn net.Conn) {\n\tdefer conn.Close()\n\n\tdec := gob.NewDecoder(conn)\n\tenc := gob.NewEncoder(conn)\n\n\tfor {\n\t\tvar req Req\n\t\tif err := dec.Decode(&req); err != nil {\n\t\t\tif !errors.Is(err, io.EOF) && !errors.Is(err, net.ErrClosed) {\n\t\t\t\tlog.Printf(\"netsim: decode: %v\", err)\n\t\t\t}\n\t\t\treturn\n\t\t}\n\n\t\tresp := s.dispatch(req)\n\t\tif err := enc.Encode(resp); err != nil {\n\t\t\treturn // the client went away; drop the connection\n\t\t}\n\t}\n}\n"}</code></pre>
        <p>Blocking reads in a dedicated goroutine per connection is the whole Go server model, and it is the clearest
            demonstration of why cheap goroutines matter: this code reads like a single-threaded program from 1995 and
            scales to tens of thousands of connections. In a language with expensive threads you would be writing an
            event loop, a state machine per connection, and callbacks. Node, Python and Rust all have async machinery
            precisely to get back to code that looks like this.</p>
        <p>One <code>gob.Decoder</code> per connection, created once and reused: a gob stream is stateful, because type
            descriptions are sent once, so creating a new decoder per message would be both wrong and slow.</p>
        <h4>The bug the network gave me</h4>
        <p>My first version of <code>Close</code> was the obvious one:</p>
        <pre className="bad"><code>{"func (s *Server) Close() {\n\ts.ln.Close()   // stop accepting\n\ts.wg.Wait()    // wait for the connection goroutines\n}\n"}</code></pre>
        <p>The test suite hung until I killed it after 300 seconds. Closing the listener stops new connections and does
            nothing whatsoever to existing ones: each connection goroutine was parked in
            <code>dec.Decode(&req)</code>, waiting for a request from a client that was still connected and simply
            not talking. <code>wg.Wait()</code> waited forever.</p>
        <pre><code>{"// Close stops accepting, hangs up on every client, and waits for the\n// connection goroutines. Closing the listener alone is not enough: a\n// goroutine blocked in Decode on a live connection never notices, and\n// Close would wait forever.\nfunc (s *Server) Close() {\n\tif s.ln != nil {\n\t\ts.ln.Close()\n\t}\n\ts.mu.Lock()\n\ts.closing = true\n\tfor conn := range s.conns {\n\t\tconn.Close() // unblocks the goroutine parked in Decode\n\t}\n\ts.mu.Unlock()\n\n\ts.wg.Wait()\n}\n"}</code></pre>
        <p>The fix requires a registry of live connections, and that registry is <strong>the one place in this entire
                project where a mutex is the right tool</strong>:</p>
        <pre><code>{"\t// mu guards conns. A connection registry is exactly the kind of small\n\t// shared map a mutex is right for: no ownership to transfer, just a set\n\t// that several goroutines add to and one goroutine walks at shutdown.\n\tmu      sync.Mutex\n\tconns   map[net.Conn]struct{}\n\tclosing bool\n"}</code></pre>
        <p>There is no ownership to hand over and no flow of work, just a set that accept-time adds to, connection-exit
            removes from, and shutdown iterates. A channel-based version would be strictly worse. This is what the
            Milestone 5 comparison meant by "use mutexes for shared state with simple invariants": the mutex is not a
            failure of the message-passing design, it is the right tool for a different job. The <code>closing</code>
            flag closes the race where a connection is accepted after shutdown began.</p>
        <p><strong>The general lesson is bigger than the fix.</strong> Cancelling a goroutine blocked on network I/O
            requires closing the connection or setting a deadline; a context alone does nothing, because the blocking
            call is in the kernel. This is the same fact as Milestone 7's "you cannot kill a goroutine", wearing
            different clothes.</p>
        <h4>The client, and why it is not thread-safe</h4>
        <pre><code>{"// Client is a sim.WorldService backed by a TCP connection. It is NOT safe\n// for concurrent use: the protocol is one request and one response in\n// order, so each client belongs to exactly one goroutine. That restriction\n// is the price of not putting request IDs on the wire.\n"}</code></pre>
        <p>Say this in the doc comment, because the compiler cannot. A stream protocol with no request IDs matches
            replies to requests by <em>order</em>, so two goroutines sharing a client would interleave their writes and
            each read the other's answer. The alternatives are a mutex around the whole round trip (correct, and it
            serialises every ant on one connection) or request IDs plus a demultiplexing reader goroutine (what gRPC
            does, and what Exercise 12 asks for). One connection per ant is the simplest thing that works, and it is
            what we do.</p>
        <pre><code>{"func (c *Client) roundTrip(req Req) (Resp, error) {\n\tif err := c.connect(); err != nil {\n\t\treturn Resp{}, err\n\t}\n\t// A deadline on the socket is the network equivalent of the timeout we\n\t// put on the local channel in milestone 5.\n\tc.conn.SetDeadline(time.Now().Add(2 * time.Second))\n\n\tif err := c.enc.Encode(req); err != nil {\n\t\tc.drop()\n\t\treturn Resp{}, fmt.Errorf(\"%w: send: %v\", ErrDisconnected, err)\n\t}\n\tvar resp Resp\n\tif err := c.dec.Decode(&resp); err != nil {\n\t\tc.drop()\n\t\treturn Resp{}, fmt.Errorf(\"%w: receive: %v\", ErrDisconnected, err)\n\t}\n\tif resp.Err != \"\" {\n\t\treturn resp, errors.New(resp.Err)\n\t}\n\treturn resp, nil\n}\n"}</code></pre>
        <p>Any I/O error drops the connection rather than trying to continue on it, because a gob stream that has lost
            sync cannot be repaired: the decoder's type state and the byte stream no longer agree. Reconnecting is
            cheap; resynchronising is impossible. Wrapping with <code>%w</code> keeps
            <code>errors.Is(err, ErrDisconnected)</code> working, which is how the ant distinguishes "the world is gone,
            wait and retry" from "the world said no".</p>
        <pre><code>{"// Backoff reports how long to wait before the next reconnection attempt,\n// with full jitter so a thousand ants do not reconnect in lockstep.\nfunc (c *Client) Backoff() time.Duration {\n\td := 10 * time.Millisecond << min(c.attempts, 6)\n\treturn time.Duration(c.rng.Int64N(int64(d) + 1))\n}\n"}</code></pre>
        <p>Same reasoning as the supervisor backoff in Milestone 8, and now it matters more: when a server restarts,
            every client discovers it at the same instant, and unjittered retries would arrive as a synchronised wave
            that knocks it over again.</p>
        <h4>The ant, almost unchanged</h4>
        <pre><code>{"\tfor ctx.Err() == nil {\n\t\tsensed, err := c.Sense(a.Pos)\n\t\tif err != nil {\n\t\t\tif errors.Is(err, ErrDisconnected) {\n\t\t\t\tselect {\n\t\t\t\tcase <-time.After(c.Backoff()):\n\t\t\t\tcase <-ctx.Done():\n\t\t\t\t}\n\t\t\t\tcontinue\n\t\t\t}\n\t\t\treturn\n\t\t}\n\n\t\tact := b.Decide(a, sensed, rng)\n\t\tres, err := c.Act(a.ID, a.Pos, a.Carrying, act)\n\t\t...\n\t}\n"}</code></pre>
        <p>Sense, decide, act. Identical in structure to Milestone 5, with <code>ErrTimeout</code> handling replaced by
            <code>ErrDisconnected</code> handling. The behaviour code (<code>TrailFollower</code>) is byte-for-byte the
            same file that ran locally, because it only ever saw a <code>Sense</code>.</p>
        <h3>Running it</h3>
        <pre className="plain"><code>{"$ go test -race ./internal/netsim/\n=== RUN   TestColonyOverTheWire\n    net_test.go:94: delivered over TCP: 39, food left 458\n--- PASS: TestColonyOverTheWire (0.71s)\n=== RUN   TestClientSurvivesServerRestart\n--- PASS: TestClientSurvivesServerRestart (0.00s)\nPASS\n"}</code></pre>
        <p>Forty remote ants foraging through forty TCP connections, delivering food to a world in a different object
            graph, race-clean. The second test kills the server mid-session, confirms the client reports
            <code>ErrDisconnected</code>, restarts the world at the same address, and confirms the client reconnects on
            its next attempt with no special handling.</p>
        <h3>What the network costs</h3>
        <pre className="plain"><code>{"sense latency: local 29ns, over loopback TCP 10.667µs (368x)\n"}</code></pre>
        <p>That is the number to carry out of this course. <strong>The same operation is 368 times slower over a
                loopback socket than in memory</strong>, and loopback is the best case: no switch, no cable, no
            congestion, no packet loss. Across a data centre add 200 µs or more; across a continent, 50 ms and up, which
            is five million times the local cost.</p>
        <p>This is why "just make it a microservice" is a performance decision and not only an architectural one. Our
            sharded local engine does about 30 million senses per second per core; over loopback, about 100,000.
            Distribution buys you fault isolation, independent deployment and horizontal scale, and it costs you three
            orders of magnitude on every interaction you move across the boundary. The design question is always the
            same: <em>which interactions cross?</em> Here, the honest answer is that sensing should never cross a
            network at all, and a real distributed colony would replicate a read-only copy of the local grid to each ant
            process and only send mutations over the wire. That is a cache with a coherence protocol, and now you are
            writing a distributed system in earnest.</p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Go's case is strongest in this milestone and in Milestone 9. The standard library alone gave us a TCP
                server, binary serialisation, an HTTP server, a metrics endpoint, a profiler you can attach to a live
                process, and a test framework, with zero third-party dependencies in the entire project. The deployable
                artifact is one static binary. The concurrency model made "one goroutine per connection" the obvious and
                correct design rather than a scalability problem.</p>
          <p>Honest counterweights. <code>gob</code> is Go-only, so this protocol cannot be consumed by anything else
                without rewriting the serialisation. Our hand-rolled protocol has no request IDs, no multiplexing, no
                flow control, no TLS and no authentication, all of which gRPC gives you for a schema file and a code
                generator, and a production system should use it rather than this. And the 368× penalty is not a Go
                number, it is a physics number: no language makes a socket as fast as a memory read.</p>
          <p>The thing Go deserves credit for is that the distance between "single-process simulation" and
                "distributed system" turned out to be one interface and about 250 lines, because the design forced by
                cheap goroutines and channels in Milestone 5 was already the right shape.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 12</h5>
          <p><strong>Multiplex the connection.</strong> One TCP connection per ant does not scale to 50,000 ants: you
                run out of file descriptors and the server drowns in connection goroutines. Rewrite the client so that
                many ants share one connection.</p>
          <p><strong>Requirements.</strong> Add a request ID to <code>Req</code> and <code>Resp</code>. One writer
                goroutine and one reader goroutine per connection; the reader routes each response to the waiting
                caller. Callers still see the same blocking <code>Sense</code>/<code>Act</code> API. A caller whose
                context is cancelled must not leak its slot. The server may answer out of order.</p>
          <p><strong>Constraints.</strong> No goroutine per in-flight request beyond the caller's own. Bounded memory
                even if the server stops answering. <code>-race</code> clean with 1,000 ants on one connection.</p>
          <p><strong>Hints.</strong> What data structure maps IDs to waiting callers, and what protects it? What is
                the reply channel's buffer size, and why does that answer matter more here than it did in Milestone 5?
                What must happen to the map entry if the caller gives up?</p>
        </div>
        <details>
          <summary>Solution 12 — open after trying</summary>
          <pre><code>{"type MuxClient struct {\n\tconn net.Conn\n\tenc  *gob.Encoder\n\n\tmu      sync.Mutex              // guards nextID and pending\n\tnextID  uint64\n\tpending map[uint64]chan Resp\n\n\twriteMu sync.Mutex              // one writer at a time on the socket\n}\n\nfunc (c *MuxClient) roundTrip(ctx context.Context, req Req) (Resp, error) {\n\tc.mu.Lock()\n\tc.nextID++\n\tid := c.nextID\n\tch := make(chan Resp, 1)        // buffered: the reader must never block\n\tc.pending[id] = ch\n\tc.mu.Unlock()\n\n\tdefer func() {                  // always reclaim the slot\n\t\tc.mu.Lock()\n\t\tdelete(c.pending, id)\n\t\tc.mu.Unlock()\n\t}()\n\n\treq.ID = id\n\tc.writeMu.Lock()\n\terr := c.enc.Encode(req)\n\tc.writeMu.Unlock()\n\tif err != nil {\n\t\treturn Resp{}, fmt.Errorf(\"%w: send: %v\", ErrDisconnected, err)\n\t}\n\n\tselect {\n\tcase resp := <-ch:\n\t\treturn resp, nil\n\tcase <-ctx.Done():\n\t\treturn Resp{}, ctx.Err()\n\t}\n}\n\n// readLoop is the only goroutine that reads the socket.\nfunc (c *MuxClient) readLoop() {\n\tfor {\n\t\tvar resp Resp\n\t\tif err := c.dec.Decode(&resp); err != nil {\n\t\t\tc.failAll(err)\n\t\t\treturn\n\t\t}\n\t\tc.mu.Lock()\n\t\tch, ok := c.pending[resp.ID]\n\t\tc.mu.Unlock()\n\t\tif ok {\n\t\t\tch <- resp              // never blocks: buffer 1, one send only\n\t\t}\n\t\t// unknown ID: the caller gave up. Dropping the response is correct.\n\t}\n}\n"}</code></pre>
          <p>Answers to the hints, which are the actual content of this exercise.</p>
          <ul>
            <li><strong>A map plus a mutex.</strong> Channels are for handing over work; this is a lookup table, and
                    a mutex is right. Same reasoning as the server's connection registry.</li>
            <li><strong>Buffer 1 on every reply channel, and this is not optional.</strong> The reader goroutine
                    serves every caller on the connection. If it ever blocks sending to one abandoned caller, every
                    other ant on that connection stops forever. Buffer 1 plus exactly one send guarantees it never
                    blocks. This is the same rule as Milestone 5, but the blast radius is now the whole connection
                    instead of one ant.</li>
            <li><strong>The <code>defer</code> that deletes the entry</strong> is what keeps memory bounded: without
                    it, every cancelled request leaks a map entry and a channel forever, and a server that stops
                    responding would take the client down with it.</li>
            <li><strong>Two mutexes, deliberately.</strong> <code>writeMu</code> serialises socket writes (a gob
                    encoder is not safe for concurrent use, and interleaved frames would corrupt the stream);
                    <code>mu</code> guards the map. Using one mutex for both would make every request wait for the
                    socket write of every other. When lock contention appears, splitting locks by what they protect is
                    the first thing to try.</li>
            <li><strong><code>failAll</code></strong> on read error must close or signal every pending channel, or a
                    thousand ants block forever on a dead connection.</li>
          </ul>
          <p>You have now implemented, in about eighty lines, the core of what HTTP/2, gRPC and every other
                multiplexed RPC protocol does. That is the right way to understand those systems: not as magic, but as
                this, plus flow control, plus TLS, plus a schema.</p>
        </details>
        <h4>Common mistakes in Milestone 12</h4>
        <div className="warn">
          <ul>
            <li><strong>Closing the listener and expecting connections to end.</strong> They do not. Track and close
                    them, or use deadlines.</li>
            <li><strong>Sharing one <code>gob.Encoder</code> across goroutines without a mutex.</strong> Interleaved
                    frames, corrupt stream, baffling decode errors.</li>
            <li><strong>Creating a new encoder or decoder per message.</strong> Gob streams are stateful; this
                    breaks or slows everything.</li>
            <li><strong>Putting an <code>error</code> in a gob struct.</strong> It will not encode. Send a string or
                    a code.</li>
            <li><strong>No deadlines on sockets.</strong> A hung peer parks a goroutine forever, and no context will
                    free it.</li>
            <li><strong>Retrying on the same broken connection.</strong> A desynchronised gob stream cannot recover;
                    reconnect.</li>
            <li><strong>Unjittered reconnect backoff.</strong> A thundering herd every time the server restarts.
                </li>
            <li><strong>Assuming the local timing still holds.</strong> Something that took 29 ns now takes 10 µs.
                </li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does <code>WorldService.Sense</code> return an error even though the local implementation cannot
                fail?</li>
          <li>Why is the client documented as unsafe for concurrent use, and what would make it safe?</li>
          <li>Why did <code>Close</code> hang, and why is a mutex the right fix rather than a channel?</li>
          <li>Why must a broken gob stream be reconnected rather than retried?</li>
          <li>What happens to <code>errors.Is(err, world.ErrNoFood)</code> across the network, and what do real
                protocols do about it?</li>
          <li>Loopback made one operation 368× slower. What does that imply for which operations should cross a
                process boundary?</li>
          <li>A context cannot cancel a goroutine blocked in <code>Decode</code>. What can?</li>
        </ol>
        <h3>Repository state after Milestone 12</h3>
        <pre className="plain"><code>{"antfarm/                                     2,961 lines of Go, no dependencies\n├── go.mod\n├── cmd/antfarm/main.go          flags, chaos parsing, signals, servers, wiring\n└── internal/\n    ├── sim/\n    │   ├── ant.go               Ant, Action, ActionKind, Generation\n    │   ├── behaviour.go         Behaviour, Forager, TrailFollower\n    │   ├── sense.go             Sense, senseAt\n    │   ├── engine.go            single-owner engine, supervisor, Frame, Run\n    │   ├── fast.go              sharded engine, WorldService, atomic sensing\n    │   ├── sim.go               Config, Chaos, Stats, the sequential Sim\n    │   ├── concurrent.go        milestone 4's mutex versions, kept for contrast\n    │   └── *_test.go            conservation, leaks, chaos, throughput, races\n    ├── world/\n    │   ├── grid.go              Position, Grid\n    │   ├── pheromone.go         FloatGrid\n    │   ├── atomicgrid.go        AtomicGrid, fixed-point pheromone\n    │   └── world.go             World, food, nest, errors\n    ├── metrics/\n    │   ├── metrics.go           Counter, Gauge, Histogram, Prometheus output\n    │   └── http.go              /metrics, /healthz, /debug/pprof\n    ├── view/\n    │   ├── terminal.go          ANSI renderer\n    │   ├── web.go               SSE stream\n    │   └── page.go              the embedded browser client\n    └── netsim/\n        ├── proto.go             Req, Resp\n        ├── server.go            TCP + gob server, connection registry\n        ├── client.go            reconnecting client, jittered backoff\n        └── net_test.go          colony over TCP, survives a server restart\n"}</code></pre>
        <pre className="plain"><code>{"$ gofmt -l . && go vet ./... && go test -race ./...\nok  \tgithub.com/yourname/antfarm/internal/netsim\t0.705s\nok  \tgithub.com/yourname/antfarm/internal/sim\t12.426s\nok  \tgithub.com/yourname/antfarm/internal/world\t0.001s\n$ git commit -am \"milestone 12: the world moves to another process\"\n"}</code></pre>
        <footer className="end">
          <p>Instalment 4 of the five-course curriculum. Next, and last for Go: the advanced phase, the final
                challenge with acceptance criteria and a withheld solution, the full knowledge check (20 conceptual, 10
                code-reading, 5 debugging, 5 implementation questions plus one substantial challenge), the README and
                GitHub description, portfolio notes and interview questions. Then Course 2 begins.</p>
        </footer>
        <Link className="button" href="/go-course/milestones/end/">Continue</Link>
      </div>
    </div>
  );
}
