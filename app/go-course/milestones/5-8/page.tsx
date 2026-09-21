import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Go Milestones 5–8 — Ownership, Trails, Shutdown, Chaos",
};

export default function Page() {
  return (
    <div className="theme-go">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 3 · Course 1 (Go) · Milestones 5–8</p>
          <h1>One goroutine owns the world, and everyone else asks it politely</h1>
          <p className="lede">The mutex disappears. Pheromone trails make the colony measurably smarter. Shutdown becomes
                something you can prove. Then we start breaking things on purpose and watch the supervisor put them
                back.</p>
        </header>
        <div className="note">
          <h5>Everything here was run</h5>
          <p>All code was compiled, vetted, race-tested and executed before it reached the page, and the numbers
                quoted are measurements from those runs, not estimates. Where my single-core sandbox distorts a result,
                I say so.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 5</span>The world becomes a goroutine</h2>
        <h3>Goal</h3>
        <p>Delete the mutex. One goroutine owns the world; ants send it messages and get answers back. Along the way the
            <code>Behaviour</code> interface changes shape in a way that turns out to matter enormously later.
        </p>
        <h3>Concepts</h3>
        <p>Ownership as a design principle, request/response over channels, per-client reply channels, buffered channels
            as leak prevention, the "ask the owner" pattern for reading state, and value types as messages.</p>
        <h3>Design</h3>
        <p>The failure of Milestone 4 was structural: many goroutines reaching into one mutable object. There are only
            three ways out of that, and it is worth seeing all three before picking one.</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Approach</th>
              <th>Idea</th>
              <th>Why not (here)</th>
            </tr>
            <tr>
              <td>Finer locks</td>
              <td>One mutex per cell or region</td>
              <td>262,144 locks, a mandatory global lock ordering, and a deadlock the first time a feature needs
                        two regions at once</td>
            </tr>
            <tr>
              <td>Lock-free</td>
              <td>Atomics and compare-and-swap on cells</td>
              <td>Works for counters, becomes research-grade difficulty the moment an operation touches two cells
                    </td>
            </tr>
            <tr>
              <td>Single owner</td>
              <td>One goroutine holds the data; everyone else sends messages</td>
              <td>This one. Serialises writes by construction, needs no lock discipline, and survives becoming a
                        network protocol</td>
            </tr>
          </tbody>
        </table>
        <p>The shape we are moving to:</p>
        <pre className="plain"><code>{"   ant 1 ──┐                              ┌──────────────────────┐\n   ant 2 ──┤                              │   serve() goroutine  │\n   ant 3 ──┼──►  reqs chan request  ──►   │                      │\n    ...    │                              │  OWNS: world, food,  │\n   ant N ──┘                              │  pheromone, counters │\n                                          └──────────┬───────────┘\n   each ant has its own                              │\n   reply channel (buffered 1)   ◄────────────────────┘\n                                   response sent to r.reply\n"}</code></pre>
        <p>Three decisions inside that picture deserve argument.</p>
        <p><strong>The reply channel belongs to the ant, not to the request.</strong> The obvious version allocates
            <code>make(chan response)</code> per request, which is one allocation and one garbage-collected object per
            ant per tick: at 50,000 ants that is millions of channels per second. Instead each ant creates one buffered
            channel at birth and reuses it forever. The buffer matters too, and not for speed: if the ant gives up
            waiting (a timeout, a cancelled context) and the owner later sends a reply, an <em>unbuffered</em> channel
            would block the owner permanently, wedging the entire simulation. A buffer of one means the owner always
            completes its send and moves on.
        </p>
        <p><strong>Messages carry values, never pointers.</strong> If a request contained <code>*Ant</code>, then the
            owner and the ant goroutine would both hold a pointer to the same struct, and we would be exactly back where
            Milestone 4 started, only with extra steps. Sending <code>pos world.Position</code> and
            <code>carrying bool</code> by value means the message <em>is</em> the shared state, and it is copied. This
            costs a few bytes and buys the property that the whole protocol could be serialised and sent over a socket
            without redesign. Milestone 12 does precisely that.
        </p>
        <p><strong>The ant perceives rather than reads.</strong> <code>Decide</code> currently takes
            <code>*world.World</code> and reads whatever it likes, which cannot work when the world lives in another
            goroutine. So the interface changes:
        </p>
        <pre className="plain"><code>{"before:  Decide(a *Ant, w *world.World, rng *rand.Rand) Action\nafter:   Decide(a *Ant, s Sense, rng *rand.Rand) Action\n"}</code></pre>
        <p>A <code>Sense</code> is a small pointer-free snapshot of what one ant can perceive from where it stands. This
            is a better model of an ant anyway (real ants have no global map) and it makes every behaviour trivially
            testable with a literal. Concurrency pushed us toward a design we would have wanted regardless, which
            happens more often than you would expect.</p>
        <h3>Implementation</h3>
        <h4>internal/sim/sense.go</h4>
        <pre><code>{"package sim\n\nimport \"github.com/yourname/antfarm/internal/world\"\n\n// Sense is everything one ant can perceive on one tick: its own position,\n// the nest it remembers, and what is in the eight cells around it. It is a\n// pointer-free value, so handing it to another goroutine is safe by\n// construction.\ntype Sense struct {\n\tPos      world.Position\n\tNest     world.Position\n\tFood     int        // food on the ant's own cell\n\tAdjacent [8]int     // food in each of the eight neighbours\n\tPher     [8]float64 // pheromone in each of the eight neighbours\n}\n\n// senseAt builds a Sense by reading the world. Only code that owns the\n// world may call it.\nfunc senseAt(w *world.World, pos world.Position) Sense {\n\ts := Sense{Pos: pos, Nest: w.Nest, Food: w.Food.At(pos)}\n\tfor i, d := range directions[:8] {\n\t\tn := pos.Add(d)\n\t\ts.Adjacent[i] = w.Food.At(n)\n\t\ts.Pher[i] = w.Pher.At(n)\n\t}\n\treturn s\n}\n"}</code></pre>
        <p><code>[8]int</code> is an array, not a slice, and that distinction is the entire point: an array is stored
            inline in the struct, so copying a <code>Sense</code> copies the data. A <code>[]int</code> would copy a
            pointer, and two goroutines would share the elements. <strong>When designing a message type, arrays are safe
                and slices are not.</strong> (The <code>Pher</code> field is for Milestone 6; it costs nothing to add
            now.)</p>
        <h4>internal/sim/engine.go — the messages</h4>
        <pre><code>{"type reqKind int\n\nconst (\n\treqSense reqKind = iota\n\treqAct\n\treqStats\n\treqEvaporate\n\treqLost\n)\n\n// request is a message from anyone to the world owner. Every field is a\n// value: no pointers cross the channel, so nothing is shared.\ntype request struct {\n\tkind     reqKind\n\tid       int\n\tpos      world.Position\n\tcarrying bool\n\tact      Action\n\treply    chan response\n}\n\n// response is the owner's answer, also pointer-free.\ntype response struct {\n\tsense Sense\n\tpos   world.Position\n\tok    bool\n\terr   error\n\tstats Stats\n}\n"}</code></pre>
        <p>One request type with a <code>kind</code> tag rather than five separate channels. Both designs are idiomatic;
            the tagged union is easier to extend and keeps ordering between different request kinds, which will matter
            when evaporation competes with ant traffic. The cost is a <code>switch</code> and some unused fields, which
            is Go's usual price for not having sum types.</p>
        <h4>The engine and its owner loop</h4>
        <pre><code>{"// Engine runs the colony as one owner goroutine plus one goroutine per ant.\n// No mutex appears anywhere in this file.\ntype Engine struct {\n\tcfg  Config\n\tb    Behaviour\n\treqs chan request\n\n\t// nest never changes after construction, so every goroutine may read it.\n\tnest world.Position\n\n\t// Owned exclusively by the serve goroutine. Nothing else may touch\n\t// these, which is why they need no synchronisation at all.\n\tworld         *world.World\n\trng           *rand.Rand\n\ttick          int\n\tdelivered     int\n\tcarrying      int\n\tfailedPickups int\n\tlost          int\n\n\t// Shared counters, written from many goroutines.\n\trestarts atomic.Int64\n\tdropped  atomic.Int64\n\ttimeouts atomic.Int64\n}\n\n// serve is the only goroutine allowed to read or write the world.\nfunc (e *Engine) serve(ctx context.Context) {\n\tfor {\n\t\tselect {\n\t\tcase <-ctx.Done():\n\t\t\treturn\n\t\tcase r := <-e.reqs:\n\t\t\te.handle(r)\n\t\t}\n\t}\n}\n\nfunc (e *Engine) handle(r request) {\n\tswitch r.kind {\n\tcase reqSense:\n\t\tr.reply <- response{sense: senseAt(e.world, r.pos)}\n\tcase reqAct:\n\t\tr.reply <- e.applyAction(r)\n\tcase reqStats:\n\t\tr.reply <- response{stats: e.statsNow()}\n\tcase reqEvaporate:\n\t\te.world.Pher.Evaporate(e.cfg.Evaporation)\n\t\te.tick++\n\tcase reqLost:\n\t\te.lost++\n\t\te.carrying--\n\t}\n}\n"}</code></pre>
        <p>Read the comments on the struct fields as if they were enforced, because they are the only enforcement there
            is. Go cannot express "this field may only be touched by that goroutine", so the convention is a comment
            plus discipline plus <code>go test -race</code> in CI. Grouping the owner-only fields together, with one
            comment covering the block, makes a violation visible in review.</p>
        <p><code>nest</code> is duplicated out of the world deliberately. It never changes after construction, so it is
            safe for anyone to read, and having it available outside the owner avoids a message round trip in the
            supervisor later. Immutable-after-construction is a third category alongside "owned" and "synchronised", and
            it is worth naming in comments when you use it.</p>
        <h4>Applying an action</h4>
        <pre><code>{"func (e *Engine) applyAction(r request) response {\n\tswitch r.act.Kind {\n\tcase ActMove:\n\t\tnp := e.world.Clamp(r.pos.Add(r.act.Dir))\n\t\tif r.carrying {\n\t\t\te.world.Pher.AddAt(np, e.cfg.Deposit, e.cfg.PherMax)\n\t\t}\n\t\treturn response{pos: np, ok: true}\n\n\tcase ActPickUp:\n\t\tif err := e.world.TakeFood(r.pos); err != nil {\n\t\t\te.failedPickups++\n\t\t\treturn response{pos: r.pos, err: err}\n\t\t}\n\t\te.carrying++\n\t\treturn response{pos: r.pos, ok: true}\n\n\tcase ActDrop:\n\t\tif r.pos != e.world.Nest {\n\t\t\treturn response{pos: r.pos, err: fmt.Errorf(\"ant %d drop away from nest: %w\", r.id, world.ErrNotCarrying)}\n\t\t}\n\t\te.world.Deliver()\n\t\te.carrying--\n\t\treturn response{pos: r.pos, ok: true}\n\t}\n\treturn response{pos: r.pos, ok: true}\n}\n"}</code></pre>
        <p>Note what the owner does <em>not</em> do: it never writes to an <code>Ant</code>. It computes the consequence
            and returns it. The ant updates itself. This keeps a clean rule that is easy to check by reading:
            <strong>the owner writes the world, each ant writes itself, and nothing writes both.</strong> </p>
        <p>The owner also validates. An ant that asks to drop food away from the nest gets an error rather than a
            delivery. A behaviour is untrusted input, in the same way a client request is untrusted input to a server,
            and for the same reason: in Milestone 8 those requests start arriving corrupted.</p>
        <h4>The ant side</h4>
        <pre><code>{"// antClient is one ant's private connection to the owner: its own reply\n// channel and its own random source, touched by no other goroutine.\ntype antClient struct {\n\te     *Engine\n\tant   *Ant\n\treply chan response\n\trng   *rand.Rand\n}\n\nfunc (c *antClient) roundTrip(ctx context.Context, r request) (response, error) {\n\t// A reply from a request we gave up on may still be sitting here.\n\t// Throw it away before asking again.\n\tselect {\n\tcase <-c.reply:\n\tdefault:\n\t}\n\n\tr.reply = c.reply\n\n\tselect {\n\tcase c.e.reqs <- r:\n\tcase <-ctx.Done():\n\t\treturn response{}, ctx.Err()\n\t}\n\n\ttimer := time.NewTimer(c.e.cfg.RequestTimeout)\n\tdefer timer.Stop()\n\n\tselect {\n\tcase resp := <-c.reply:\n\t\treturn resp, nil\n\tcase <-timer.C:\n\t\tc.e.timeouts.Add(1)\n\t\treturn response{}, ErrTimeout\n\tcase <-ctx.Done():\n\t\treturn response{}, ctx.Err()\n\t}\n}\n"}</code></pre>
        <p>This function is twenty lines and every one of them is load-bearing.</p>
        <ul>
          <li><strong>The drain at the top.</strong> <code>select {'{'} case {'<'}-c.reply: default: {'}'}</code> is a
                non-blocking receive: take a value if one is waiting, otherwise carry on immediately. Without it, a late
                reply to a timed-out request would be read as the answer to the <em>next</em> request, and the ant would
                act on stale information. This is a real distributed-systems bug in miniature, and it appears the moment
                you add timeouts to any request/response protocol.</li>
          <li><strong>The send is in a <code>select</code> with <code>ctx.Done()</code>.</strong> A plain
                <code>c.e.reqs {'<'}- r</code> blocks when the queue is full, and a blocked send ignores cancellation, so
                shutdown would hang until the owner drained. Every potentially-blocking channel operation in a
                long-lived goroutine should be paired with cancellation.
            </li>
          <li><strong><code>time.NewTimer</code> with <code>defer timer.Stop()</code>, not
                    <code>time.After</code>.</strong> <code>time.After</code> allocates a timer that stays alive until
                it fires, even if you stopped caring. In a loop running millions of times per second that is a slow
                memory leak. This is one of the most common performance defects in real Go services.</li>
          <li><strong>The timeout is not optional.</strong> Without it, an ant whose reply was dropped waits forever,
                and one wedged ant is invisible among 50,000. With it, the failure becomes a counter you can watch.</li>
        </ul>
        <h4>The ant's life</h4>
        <pre><code>{"// runAnt is the whole life of one ant: sense, decide, act, repeat.\nfunc (e *Engine) runAnt(ctx context.Context, a *Ant) {\n\tc := &antClient{\n\t\te:     e,\n\t\tant:   a,\n\t\treply: make(chan response, 1),\n\t\trng:   rand.New(rand.NewPCG(e.cfg.Seed, uint64(a.ID)+a.Generation<<32)),\n\t}\n\n\tfor {\n\t\tif ctx.Err() != nil {\n\t\t\treturn\n\t\t}\n\n\t\tsensed, err := c.roundTrip(ctx, request{kind: reqSense, id: a.ID, pos: a.Pos})\n\t\tif err != nil {\n\t\t\tif errors.Is(err, ErrTimeout) {\n\t\t\t\tcontinue // ask again\n\t\t\t}\n\t\t\treturn // context cancelled\n\t\t}\n\n\t\tact := e.b.Decide(a, sensed.sense, c.rng)\n\n\t\tdone, err := c.roundTrip(ctx, request{\n\t\t\tkind: reqAct, id: a.ID, pos: a.Pos, carrying: a.Carrying, act: act,\n\t\t})\n\t\tif err != nil {\n\t\t\tif errors.Is(err, ErrTimeout) {\n\t\t\t\tcontinue\n\t\t\t}\n\t\t\treturn\n\t\t}\n\t\tc.applyLocally(act, done)\n\t}\n}\n\n// applyLocally updates the ant's own state from the owner's answer. The ant\n// goroutine is the only writer of these fields.\nfunc (c *antClient) applyLocally(act Action, r response) {\n\tswitch act.Kind {\n\tcase ActMove:\n\t\tif r.ok {\n\t\t\tc.ant.Pos = r.pos\n\t\t\tc.ant.Energy--\n\t\t}\n\tcase ActPickUp:\n\t\tif r.ok {\n\t\t\tc.ant.Carrying = true\n\t\t}\n\tcase ActDrop:\n\t\tif r.ok {\n\t\t\tc.ant.Carrying = false\n\t\t}\n\t}\n}\n"}</code></pre>
        <p>Sense, decide, act. The decide step is the only part that runs outside the owner, and it is the only part
            that runs in parallel across ants. Remember that when we discuss performance in a moment.</p>
        <h4>Reading state: ask the owner</h4>
        <pre><code>{"// Stats asks the owner for a snapshot. Safe to call from any goroutine.\nfunc (e *Engine) Stats(ctx context.Context) (Stats, error) {\n\treply := make(chan response, 1)\n\tselect {\n\tcase e.reqs <- request{kind: reqStats, reply: reply}:\n\tcase <-ctx.Done():\n\t\treturn Stats{}, ctx.Err()\n\t}\n\ttimer := time.NewTimer(e.cfg.RequestTimeout)\n\tdefer timer.Stop()\n\tselect {\n\tcase r := <-reply:\n\t\treturn r.stats, nil\n\tcase <-timer.C:\n\t\treturn Stats{}, ErrTimeout\n\tcase <-ctx.Done():\n\t\treturn Stats{}, ctx.Err()\n\t}\n}\n"}</code></pre>
        <p>Compare with Milestone 4's solution, where <code>Stats</code> took a lock and we had to invent the
            <code>statsLocked</code> convention to avoid deadlocking against ourselves. Here the question "what if
            somebody calls Stats from inside the owner?" cannot arise, because the owner never calls <code>Stats</code>;
            it calls <code>statsNow</code>, which is an ordinary function on data it owns. Reentrancy stops being a
            hazard when there is no lock to re-enter.
        </p>
        <p>Here a fresh channel per call is fine, because <code>Stats</code> is called a few times a second, not a few
            million. Reuse is an optimisation, and optimisations belong where the traffic is.</p>
        <h3>Does it work, and is it faster?</h3>
        <pre className="plain"><code>{"$ go test -race -run TestEngine -count=1 ./internal/sim/\nok  \tgithub.com/yourname/antfarm/internal/sim\t1.965s\n"}</code></pre>
        <p>Correct, race-free, and no mutex in the package. Now the honest part.</p>
        <div className="warn">
          <h5>The single owner is still a serialisation point</h5>
          <p>Every world access in the colony passes through one goroutine, so world operations happen strictly one at
                a time, exactly as they did behind the single mutex. If you were expecting linear speedup from replacing
                the lock, you will not get it, and anyone claiming otherwise is describing a different program.</p>
          <p>What actually changed:</p>
          <ul>
            <li><strong><code>Decide</code> now runs in parallel</strong> across all ants, off the owner's
                    goroutine. In this project that computation is small; in a simulation where agents do real work
                    (pathfinding, learning, inference) it is most of the cost, and this structure parallelises all of
                    it.</li>
            <li><strong>The queue is now explicit.</strong> <code>reqs chan request</code> with a capacity is a
                    visible, measurable, tunable buffer. Under a mutex the queue exists too, inside the runtime, where
                    you cannot see its depth or apply a policy when it fills. Milestone 11 turns that visibility into
                    backpressure.</li>
            <li><strong>Failure became expressible.</strong> "Drop this message", "answer this one slowly", "stop
                    answering" are one line each at the owner. There is no way to express a dropped message in a mutex.
                </li>
            <li><strong>The protocol is now a protocol.</strong> Values in, values out, no shared memory. Milestone
                    12 moves the owner to another process and the ant code does not change.</li>
          </ul>
          <p>If raw throughput on one machine were the only goal, the right answer is neither locks nor a single
                owner: it is <em>sharding</em>, several owners each holding a region of the grid, which Milestone 11
                builds. The single owner is the design you should reach for first because it is obviously correct, and
                shard it only when measurement says you must.</p>
        </div>
        <div className="cmp">
          <h5>Shared state vs message passing</h5>
          <pre className="plain"><code>{"Shared state + locks              Single owner + messages\n────────────────────              ───────────────────────\nany goroutine may touch data      one goroutine may touch data\ncorrectness = lock discipline     correctness = structure\ninvisible queueing in the runtime an explicit channel you can measure\ndeadlock is a real risk           deadlock needs a request cycle\nreentrancy hazards                none: no lock to re-enter\ncannot express \"message lost\"     one line at the owner\ndoes not survive a network        already is a network protocol"}</code></pre>
          <p>Go supports both and takes no side. The proverb "share memory by communicating" is advice, not a rule,
                and the standard library uses mutexes heavily where they fit. What Go provides that most languages do
                not is that <em>both</em> options are first-class and cheap enough to choose between on the merits.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 5</h5>
          <p>Add a <code>reqTeleport</code> request that moves an ant to an arbitrary position, and expose it as
                <code>func (e *Engine) Teleport(ctx context.Context, id int, to world.Position) error</code> so an
                external caller (the future dashboard) can poke the simulation.
            </p>
          <p>Requirements: reject out-of-bounds targets with a useful error; the ant's own goroutine must end up
                agreeing with the owner about where it is; no new mutex; and a test that calls <code>Teleport</code>
                concurrently with a running colony and passes under <code>-race</code>.</p>
          <p>The interesting part is the second requirement. The owner does not write to ants, and the ant is asleep
                in its own loop. Think about who can change <code>a.Pos</code> and how the news reaches them.</p>
        </div>
        <details>
          <summary>Solution 5 — open after trying</summary>
          <p>The trap is to have <code>Teleport</code> write <code>a.Pos</code> directly. It compiles, and it is a
                data race against the ant's goroutine, which writes the same field in <code>applyLocally</code>.</p>
          <p>The clean answer is a <em>mailbox per ant</em>: the owner records a pending command, and the ant collects
                it on its next sense round trip. One extra field on <code>response</code>, no new synchronisation:</p>
          <pre><code>{"// in Engine, owner-only state:\n//     pending map[int]world.Position   // ant ID -> forced position\n\nfunc (e *Engine) handle(r request) {\n\tswitch r.kind {\n\tcase reqSense:\n\t\tresp := response{sense: senseAt(e.world, r.pos)}\n\t\tif to, ok := e.pending[r.id]; ok {\n\t\t\tdelete(e.pending, r.id)\n\t\t\tresp.teleport, resp.hasTeleport = to, true\n\t\t}\n\t\tr.reply <- resp\n\n\tcase reqTeleport:\n\t\tif !e.world.InBounds(r.pos) {\n\t\t\tr.reply <- response{err: &world.OutOfBoundsError{Pos: r.pos, W: e.cfg.Width, H: e.cfg.Height}}\n\t\t\treturn\n\t\t}\n\t\te.pending[r.id] = r.pos\n\t\tr.reply <- response{ok: true}\n\t}\n}\n"}</code></pre>
          <pre><code>{"// in runAnt, right after a successful sense:\nif sensed.hasTeleport {\n\ta.Pos = sensed.teleport\n\tcontinue // re-sense from the new position before deciding\n}\n"}</code></pre>
          <p>Three things to take from this:</p>
          <ul>
            <li>The <code>pending</code> map is owner-only state, so a map is perfectly safe here. The thing that
                    made maps dangerous in Milestone 4 was sharing, not maps.</li>
            <li>Commands flow <em>to</em> the ant by riding on a reply the ant was already going to ask for. No new
                    channel, no new goroutine, no polling. This is a standard trick in actor-style systems: piggyback
                    control messages on the existing conversation.</li>
            <li>The <code>continue</code> matters. Deciding on a <code>Sense</code> gathered at the old position
                    after teleporting would make the ant act on a view of somewhere it no longer is. Stale reads are the
                    recurring theme of this milestone.</li>
          </ul>
        </details>
        <h4>Experiment</h4>
        <p>Set <code>QueueSize</code> to <code>1</code> and run 2,000 ants. Then set it to <code>65536</code>. Watch
            delivered-per-second and the timeout counter. A tiny queue means senders block constantly, which is slow but
            self-limiting; a huge queue means nobody ever blocks, latency grows without bound, and ants time out on
            replies to requests that are still sitting in line. Neither extreme is good, and the middle is not obvious.
            That tension is what Milestone 11 is about.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 5</h5>
          <ul>
            <li><strong>An unbuffered reply channel.</strong> The owner blocks forever on
                    <code>r.reply {'<'}- resp</code> if the ant has stopped listening. The whole simulation freezes and
                    the stack dump shows every goroutine blocked on the same channel. Buffer of one, always.
                </li>
            <li><strong>Forgetting the stale-reply drain.</strong> Symptom: after the first timeout, an ant starts
                    behaving as if it is one step behind reality. Very hard to spot without the counter.</li>
            <li><strong>Putting a pointer in a message.</strong> Compiles, passes tests, races under load. If you
                    catch yourself writing <code>ant *Ant</code> in the request struct, stop.</li>
            <li><strong>Closing <code>reqs</code> to signal shutdown.</strong> Senders panic with "send on closed
                    channel", and there are thousands of them. Only close a channel when there is exactly one sender,
                    and here there are many. Cancel a context instead.</li>
            <li><strong>Calling <code>Stats</code> from inside <code>handle</code>.</strong> The owner would send
                    itself a request and wait for a reply it can only produce by returning. Instant, permanent,
                    self-inflicted deadlock. This is the message-passing equivalent of non-reentrant locks, and the same
                    discipline applies: internal code calls the internal function, not the public one.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why is the reply channel buffered, and what exactly breaks if it is not?</li>
          <li>Why does <code>Sense</code> use <code>[8]int</code> rather than <code>[]int</code>?</li>
          <li>Who is allowed to write <code>Ant.Pos</code>, and how would you catch a violation?</li>
          <li>The owner serialises world access just like the mutex did. Name three things we gained anyway.</li>
          <li>Why <code>time.NewTimer</code> plus <code>Stop</code> instead of <code>time.After</code> in
                <code>roundTrip</code>?
            </li>
          <li>What happens if an ant times out, then the owner replies, and the ant does not drain its channel?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 6</span>Pheromones, and a clock of its own</h2>
        <h3>Goal</h3>
        <p>Ants that find food lay a trail on the way home; searching ants are attracted to trails; trails evaporate.
            The colony gets measurably better at foraging, and we gain a second background goroutine with its own
            timing.</p>
        <h3>Concepts</h3>
        <p><code>time.Ticker</code> and periodic work, non-blocking sends as load shedding, weighted random choice,
            float grids, and why every positive feedback loop needs a cap and a decay.</p>
        <h3>Design</h3>
        <p>Ant colony optimisation in three rules:</p>
        <ol>
          <li>An ant carrying food deposits pheromone on each cell it walks over.</li>
          <li>A searching ant picks its next cell with probability proportional to <code>1 + bias × pheromone</code>.
            </li>
          <li>All pheromone decays by a constant factor on a fixed schedule.</li>
        </ol>
        <p>Rule 3 is not decoration. Without evaporation the grid saturates: every cell eventually reaches the cap, all
            weights become equal, and the trail carries no information. Worse, an early lucky path to an exhausted food
            source stays attractive forever. <strong>Evaporation is what makes the trail a memory of recent success
                rather than an accumulation of all history.</strong> Rule 2's <code>1 +</code> is the same idea from the
            other side: it guarantees an unmarked cell still has a chance, so the colony keeps exploring instead of
            collapsing onto the first path it finds. Positive feedback plus a decay plus a floor on exploration, and
            this is exactly the structure of many reinforcement algorithms.</p>
        <p>Where does evaporation run? It must mutate the grid, and only the owner may do that, so it becomes a third
            kind of client: a goroutine holding a ticker that sends <code>reqEvaporate</code> on a schedule.</p>
        <pre className="plain"><code>{"   ants ────────►┐\n                 │  reqs chan  ──►  serve()  (owns world)\n   evaporator ──►┤\n   Stats caller ►┘\n"}</code></pre>
        <h3>Implementation</h3>
        <h4>internal/world/pheromone.go</h4>
        <pre><code>{"// FloatGrid is a grid of float64 values, used for pheromone concentration.\ntype FloatGrid struct {\n\tW, H  int\n\tcells []float64\n}\n\n// AddAt deposits delta at p, capping the cell so a single trail cannot\n// dominate the whole grid.\nfunc (g *FloatGrid) AddAt(p Position, delta, max float64) {\n\tif !g.InBounds(p) {\n\t\treturn\n\t}\n\ti := p.Y*g.W + p.X\n\tg.cells[i] += delta\n\tif g.cells[i] > max {\n\t\tg.cells[i] = max\n\t}\n}\n\n// Evaporate multiplies every cell by factor (0 < factor < 1) and zeroes\n// values too small to matter, which keeps the grid sparse in practice.\nfunc (g *FloatGrid) Evaporate(factor float64) {\n\tfor i, v := range g.cells {\n\t\tv *= factor\n\t\tif v < 1e-4 {\n\t\t\tv = 0\n\t\t}\n\t\tg.cells[i] = v\n\t}\n}\n"}</code></pre>
        <p>The <code>1e-4</code> floor is worth a sentence. Multiplying by 0.95 forever produces ever-smaller denormal
            floats, which are both meaningless and, on some hardware, dramatically slower to compute with. Snapping to
            zero keeps the arithmetic fast and the data honest. Whenever you write an exponential decay, decide where it
            stops.</p>
        <p><code>Evaporate</code> is O(width × height), so on a 512×512 grid it touches 262,144 cells every time it
            runs. That is a real cost sitting on the owner's goroutine, blocking every ant behind it. Remember this when
            you profile in Milestone 11; the fix is either a coarser schedule or a lazy scheme that decays a cell when
            it is read, using the timestamp of its last update.</p>
        <h4>The evaporator goroutine</h4>
        <pre><code>{"// evaporate asks the owner to decay the pheromone grid on a fixed schedule.\nfunc (e *Engine) evaporate(ctx context.Context) {\n\tticker := time.NewTicker(e.cfg.EvaporateEvery)\n\tdefer ticker.Stop()\n\n\tfor {\n\t\tselect {\n\t\tcase <-ctx.Done():\n\t\t\treturn\n\t\tcase <-ticker.C:\n\t\t\tselect {\n\t\t\tcase e.reqs <- request{kind: reqEvaporate}:\n\t\t\tcase <-ctx.Done():\n\t\t\t\treturn\n\t\t\tdefault:\n\t\t\t\t// The owner is saturated. Skipping one evaporation is\n\t\t\t\t// better than stalling the clock behind the ants.\n\t\t\t}\n\t\t}\n\t}\n}\n"}</code></pre>
        <ul>
          <li><code>time.NewTicker</code> fires repeatedly; <code>time.NewTimer</code> fires once. A ticker that is
                never stopped keeps firing after you stop reading it, which pins the goroutine and leaks.
                <code>defer ticker.Stop()</code> is not optional.
            </li>
          <li>The inner <code>select</code> has three cases and the <code>default</code> is the interesting one. A
                <code>default</code> makes the send non-blocking: if the owner's queue is full, we skip this evaporation
                entirely rather than queueing behind ten thousand ant requests. That is <strong>load shedding</strong>,
                and it is the correct policy for periodic work whose value decays: a late evaporation is worth less than
                no evaporation, because by the time it runs the schedule has already slipped.
            </li>
          <li>Tickers drop ticks rather than queueing them if you are slow to receive, so the schedule degrades
                gracefully instead of accumulating a backlog. That is exactly the behaviour you want here and exactly
                the behaviour you do not want for, say, billing.</li>
        </ul>
        <h4>The trail-following behaviour</h4>
        <pre><code>{"// TrailFollower is Forager plus pheromones: when searching it biases its\n// steps toward neighbouring cells that other ants have marked.\ntype TrailFollower struct {\n\t// Bias is how strongly pheromone attracts. 0 is a random walk.\n\tBias float64\n}\n\nfunc (t TrailFollower) Decide(a *Ant, s Sense, rng *rand.Rand) Action {\n\tif a.Carrying {\n\t\tif s.Pos == s.Nest {\n\t\t\treturn Action{Kind: ActDrop}\n\t\t}\n\t\treturn Action{Kind: ActMove, Dir: stepToward(s.Pos, s.Nest)}\n\t}\n\tif s.Food > 0 {\n\t\treturn Action{Kind: ActPickUp}\n\t}\n\tif i, ok := bestAdjacentFood(s); ok {\n\t\treturn Action{Kind: ActMove, Dir: directions[i]}\n\t}\n\treturn Action{Kind: ActMove, Dir: t.weightedStep(s, rng)}\n}\n\n// weightedStep picks a neighbour with probability proportional to\n// 1 + Bias*pheromone, so an unmarked grid still produces a random walk.\nfunc (t TrailFollower) weightedStep(s Sense, rng *rand.Rand) world.Position {\n\tvar weights [8]float64\n\ttotal := 0.0\n\tfor i, p := range s.Pher {\n\t\tw := 1 + t.Bias*p\n\t\tweights[i] = w\n\t\ttotal += w\n\t}\n\n\tr := rng.Float64() * total\n\tfor i, w := range weights {\n\t\tr -= w\n\t\tif r <= 0 {\n\t\t\treturn directions[i]\n\t\t}\n\t}\n\treturn directions[rng.IntN(8)] // unreachable except for float rounding\n}\n"}</code></pre>
        <p>Weighted random selection by subtracting from a uniform sample in <code>[0, total)</code> is worth knowing:
            it needs no sorting, no allocation, and one pass. The final <code>return</code> after the loop looks like
            dead code and is not: floating-point rounding can leave <code>r</code> a hair above zero after subtracting
            every weight. Reviewers will ask about that line, so the comment is part of the code.</p>
        <p><code>TrailFollower</code> has a value receiver and one field, so it is copied into the interface rather than
            shared. Every ant reads the same <code>Bias</code> and nothing writes it. Compare with the
            <code>Scout</code> from Milestone 3, whose per-ant maps would have been a race: the difference is that this
            strategy keeps no per-ant state at all.
        </p>
        <p>Deposition lives at the owner, in <code>applyAction</code>, the three lines you already saw:</p>
        <pre><code>{"\tcase ActMove:\n\t\tnp := e.world.Clamp(r.pos.Add(r.act.Dir))\n\t\tif r.carrying {\n\t\t\te.world.Pher.AddAt(np, e.cfg.Deposit, e.cfg.PherMax)\n\t\t}\n\t\treturn response{pos: np, ok: true}\n"}</code></pre>
        <h3>Does it actually help?</h3>
        <p>Same seed, same world, same wall-clock budget, 300 ants on a 64×64 grid with six food sources of 200 units
            each:</p>
        <pre className="plain"><code>{"forager: delivered 323, pheromone left 1693\ntrail  : delivered 404, pheromone left 397\n"}</code></pre>
        <p>A 25% improvement in delivered food, measured rather than asserted. Two details in those numbers are more
            interesting than the headline.</p>
        <p>The <code>forager</code> run has <em>more</em> pheromone left at the end (1693 against 397) even though it
            ignores pheromone entirely. Deposition happens at the owner for any carrying ant, so both runs lay trails;
            only one reads them. The forager's trails accumulate because its ants take longer random-walk journeys and
            are more spread out, while the trail follower's ants concentrate on short paths that evaporation keeps
            trimmed. A metric moving in the direction you did not predict is usually the most informative thing on the
            screen.</p>
        <p>Second: this is a measurement of one seed on one machine over half a second, which is not a result, it is an
            anecdote. Before claiming pheromones help, you would run several seeds and compare distributions. That is
            Exercise 6.</p>
        <div className="exercise">
          <h5>Exercise 6</h5>
          <p>Turn the anecdote into evidence, then find where the benefit lives.</p>
          <ol>
            <li>Write a test that runs both behaviours over at least 10 seeds each and reports mean delivered food.
                    Fail only if the trail follower is not better on a clear majority of seeds. Think about why "better
                    on average" and "better on most seeds" are different claims and which one you want.</li>
            <li>Sweep <code>Bias</code> over 0, 1, 2, 4, 8, 16 and plot delivered food. There is an optimum, and
                    beyond it the colony gets worse. Explain why in terms of exploration and exploitation.</li>
            <li>Sweep <code>Evaporation</code> over 0.99, 0.95, 0.8, 0.5 with <code>Bias</code> fixed. Explain both
                    ends of the resulting curve.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 6 — open after trying</summary>
          <pre><code>{"func TestTrailBeatsRandomWalk(t *testing.T) {\n\tconst runs = 10\n\twins, forageTotal, trailTotal := 0, 0, 0\n\n\tfor seed := range uint64(runs) {\n\t\tcfg := Config{Width: 64, Height: 64, Ants: 300,\n\t\t\tFoodSources: 6, FoodPerSource: 200, Seed: seed}\n\n\t\ta := runFor(t, cfg, Forager{}, 300*time.Millisecond)\n\t\tb := runFor(t, cfg, TrailFollower{Bias: 4}, 300*time.Millisecond)\n\n\t\tforageTotal += a.Delivered\n\t\ttrailTotal += b.Delivered\n\t\tif b.Delivered > a.Delivered {\n\t\t\twins++\n\t\t}\n\t}\n\n\tt.Logf(\"forager mean %d, trail mean %d, trail won %d/%d\",\n\t\tforageTotal/runs, trailTotal/runs, wins, runs)\n\n\tif wins < runs*7/10 {\n\t\tt.Errorf(\"trail following won only %d of %d seeds\", wins, runs)\n\t}\n}\n"}</code></pre>
          <p><strong>Mean versus majority.</strong> A mean can be carried by one spectacular run: if the trail
                follower occasionally finds a rich source early and delivers ten times as much, the average looks
                wonderful while it loses most individual races. Counting wins asks "is this reliably better?", which is
                usually the question you care about. Reporting both, as the <code>t.Logf</code> does, costs nothing.</p>
          <p>Note also that this test is time-based, so it measures throughput on whatever machine runs it, and it
                will be flaky on a loaded CI box. A more rigorous version fixes the number of ticks rather than the wall
                clock, which is a good argument for keeping the sequential <code>Sim</code> from Milestone 3 around as a
                measurement harness. Deterministic experiments belong in a deterministic runner.</p>
          <p><strong>The bias sweep.</strong> You should see improvement up to roughly 4–8, then decline. Low bias is
                a random walk that ignores information. High bias makes the first trail overwhelmingly attractive, so
                every ant follows it, deposits more on it, and makes it more attractive still: the colony locks onto one
                path and stops exploring, and when that food source runs out it keeps walking the trail to an empty cell
                until evaporation erases it. This is the exploration/exploitation trade-off, and it is the same failure
                mode as a recommender system that only ever shows you what you already clicked.</p>
          <p><strong>The evaporation sweep.</strong> At 0.99 trails persist far too long, so stale paths to exhausted
                sources keep attracting ants. At 0.5 a trail is gone within a few ticks and cannot be reinforced fast
                enough to guide anyone, so you have paid for pheromones and got a random walk. The useful range is
                narrow and depends on how long a round trip takes, which is a hint that the parameter should really be
                expressed relative to journey time rather than as an absolute per-tick factor.</p>
        </details>
        <h4>Experiment</h4>
        <p>Set <code>PherMax</code> to a huge number (say 1e9) and run with <code>Bias: 4</code>. The first trail to
            form saturates, and because weights are proportional to concentration, the colony funnels every ant onto one
            path within seconds. Watch delivered food collapse. Then set <code>PherMax</code> to <code>1</code> and
            watch the trail carry almost no signal. Every positive feedback loop in a simulation needs a ceiling, and
            finding it experimentally teaches more than choosing it analytically.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 6</h5>
          <ul>
            <li><strong>Ticker never stopped.</strong> <code>time.NewTicker</code> without <code>defer Stop()</code>
                    leaks the ticker and its goroutine. The leak test in Milestone 7 catches it.</li>
            <li><strong>Blocking send from the evaporator.</strong> Without the <code>default</code>, evaporation
                    queues behind ant traffic, the schedule slips under load, and trails stop decaying exactly when the
                    colony is busiest.</li>
            <li><strong>Evaporating from the evaporator goroutine directly.</strong> It compiles. It is a data race
                    against the owner. The whole point of the message is that the mutation happens on the owner's
                    goroutine.</li>
            <li><strong>Forgetting the <code>1 +</code> in the weight.</strong> With weights equal to raw pheromone,
                    a fresh grid has total weight zero, every weight is zero, and the loop falls through to the fallback
                    on every single step. Symptom: the colony behaves randomly and no amount of bias tuning changes
                    anything.</li>
            <li><strong>Depositing on pickup instead of on the journey home.</strong> A single marked cell at the
                    food source is not a trail. The trail is the path, and it only exists because the ant marks every
                    step of the return.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why must pheromone evaporate? Give two distinct failure modes of a grid that never decays.</li>
          <li>Why does <code>weightedStep</code> add 1 to every weight?</li>
          <li>What does the <code>default</code> case in the evaporator's inner <code>select</code> do, and what
                policy does it encode?</li>
          <li>Both behaviours deposit pheromone. Why did the run that ignores trails end with more of it?</li>
          <li><code>Evaporate</code> is O(cells) and runs on the owner's goroutine. What does that imply at 512×512
                with a 20 ms period?</li>
          <li>Why is <code>TrailFollower</code> safe to share across 50,000 ants when <code>Scout</code> from
                Milestone 3 was not?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 7</span>Shutting down, provably</h2>
        <h3>Goal</h3>
        <p>Ctrl-C stops the colony cleanly: every ant finishes its current round trip, the final statistics are
            collected, background goroutines exit, and the process leaves nothing running. A test proves there are no
            leaks.</p>
        <h3>Concepts</h3>
        <p>Context trees and derived cancellation, <code>signal.NotifyContext</code>, shutdown ordering, the
            <code>WaitGroup</code> misuse that bites concurrent supervisors, and goroutine leak detection.
        </p>
        <h3>Design</h3>
        <p>"Just cancel everything" is wrong, and the reason is worth spelling out. The last thing <code>Run</code> does
            is collect final statistics, which requires sending a request to the owner and getting a reply. If the owner
            was cancelled along with everyone else, that request hangs until it times out and you get empty results. So
            shutdown has an order, and the order is the reverse of the dependency graph:</p>
        <pre className="plain"><code>{"  ctx cancelled (Ctrl-C, timeout, or the caller's choice)\n        │\n        ▼\n  1. supervisor stops          no new ants will be started\n        │\n        ▼\n  2. ants drain and exit       each finishes its current round trip\n        │\n        ▼\n  3. final Stats collected     the owner is still alive to answer\n        │\n        ▼\n  4. evaporator stops          nothing left that needs a clock\n        │\n        ▼\n  5. owner stops               last to go, because everyone needed it\n"}</code></pre>
        <p>This is why <code>Run</code> builds <em>three</em> contexts rather than passing one everywhere. The ants get
            the caller's context, so cancelling it stops them. The evaporator and the owner get their own contexts
            derived from <code>context.Background()</code>, so they outlive the ants and stop only when <code>Run</code>
            says so. A context is a cancellation scope, and "everything cancels at once" is a design decision, not a
            default you have to accept.</p>
        <h3>Implementation</h3>
        <pre><code>{"// Run starts the colony and blocks until ctx is cancelled, then shuts\n// everything down in order and returns the final snapshot.\nfunc (e *Engine) Run(ctx context.Context) (Stats, error) {\n\tserverCtx, stopServer := context.WithCancel(context.Background())\n\tvar serverWG sync.WaitGroup\n\tserverWG.Add(1)\n\tgo func() {\n\t\tdefer serverWG.Done()\n\t\te.serve(serverCtx)\n\t}()\n\n\tevapCtx, stopEvap := context.WithCancel(context.Background())\n\tvar evapWG sync.WaitGroup\n\tevapWG.Add(1)\n\tgo func() {\n\t\tdefer evapWG.Done()\n\t\te.evaporate(evapCtx)\n\t}()\n\n\te.ants = make([]*Ant, 0, e.cfg.Ants)\n\tfor i := range e.cfg.Ants {\n\t\te.ants = append(e.ants, &Ant{ID: i, Pos: e.nest, Energy: e.cfg.StartEnergy})\n\t}\n\n\tdeaths := make(chan *Ant, e.cfg.Ants)\n\tvar antWG sync.WaitGroup\n\n\tstart := func(a *Ant) {\n\t\tantWG.Add(1)\n\t\tgo func() {\n\t\t\tdefer antWG.Done()\n\t\t\te.superviseAnt(ctx, a, deaths)\n\t\t}()\n\t}\n\tfor _, a := range e.ants {\n\t\tstart(a)\n\t}\n\n\t// The supervisor is the only goroutine that may add more ants, so we\n\t// wait for it to finish before waiting on the ant group.\n\tsupervisorDone := make(chan struct{})\n\tgo func() {\n\t\tdefer close(supervisorDone)\n\t\tfor {\n\t\t\tselect {\n\t\t\tcase <-ctx.Done():\n\t\t\t\treturn\n\t\t\tcase a := <-deaths:\n\t\t\t\te.recycle(ctx, a)\n\t\t\t\tstart(a)\n\t\t\t}\n\t\t}\n\t}()\n\n\t<-ctx.Done()\n\t<-supervisorDone\n\tantWG.Wait()\n\n\tstats, err := e.Stats(context.Background())\n\n\tstopEvap()\n\tevapWG.Wait()\n\tstopServer()\n\tserverWG.Wait()\n\n\treturn stats, err\n}\n"}</code></pre>
        <h4>The three lines in the middle</h4>
        <pre><code>{"\t<-ctx.Done()\n\t<-supervisorDone\n\tantWG.Wait()\n"}</code></pre>
        <p>Those look redundant and are not. <code>sync.WaitGroup</code> has a documented rule that is easy to violate:
            <strong>calls to <code>Add</code> must not happen concurrently with <code>Wait</code> when the counter could
                be zero.</strong> Our supervisor calls <code>antWG.Add(1)</code> every time it restarts an ant. If
            <code>Run</code> called <code>antWG.Wait()</code> while the supervisor was still alive, and every ant
            happened to be dead at that instant, <code>Wait</code> could return while the supervisor was starting a
            fresh one, and we would shut down the owner from under a running ant. Waiting for the supervisor to exit
            first guarantees no further <code>Add</code> can occur. The Go runtime detects some violations with
            <code>panic: sync: WaitGroup misuse: Add called concurrently with Wait</code>, but not all of them, and a
            race here is a shutdown hang that reproduces once a week.
        </p>
        <p>Then <code>e.Stats(context.Background())</code> deliberately uses a fresh context. Passing the caller's
            cancelled <code>ctx</code> would return <code>context.Canceled</code> immediately and give you an empty
            snapshot. Reaching for <code>Background</code> during cleanup is a common and correct pattern; in production
            code you would normally give it a short timeout so cleanup cannot hang forever.</p>
        <h4>Catching Ctrl-C</h4>
        <pre><code>{"\t// Ctrl-C cancels the context; a second one kills the process outright.\n\tctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)\n\tdefer stop()\n\tctx, cancel := context.WithTimeout(ctx, duration)\n\tdefer cancel()\n"}</code></pre>
        <p><code>signal.NotifyContext</code> returns a context that cancels when one of the listed signals arrives. The
            nesting matters: the timeout context is derived from the signal context, so the run ends on whichever comes
            first, a signal or the deadline. That is context composition doing real work in four lines.</p>
        <p><code>defer stop()</code> restores the default signal handling, which is what makes a second Ctrl-C kill the
            process immediately. That is the behaviour users expect: the first interrupt asks nicely, the second
            insists. A program that swallows every interrupt while it "gracefully" shuts down is a program people learn
            to <code>kill -9</code>.</p>
        <h4>Proving there is no leak</h4>
        <pre><code>{"func TestNoGoroutineLeak(t *testing.T) {\n\tbefore := countGoroutines()\n\n\tcfg := Config{Width: 16, Height: 16, Ants: 100, FoodSources: 5, Seed: 3}\n\trunFor(t, cfg, Forager{}, 150*time.Millisecond)\n\n\t// Goroutines exit asynchronously; give them a moment before judging.\n\tfor range 50 {\n\t\tif countGoroutines() <= before+1 {\n\t\t\treturn\n\t\t}\n\t\ttime.Sleep(10 * time.Millisecond)\n\t}\n\tt.Errorf(\"goroutines leaked: before %d, after %d\", before, countGoroutines())\n}\n"}</code></pre>
        <pre className="plain"><code>{"=== RUN   TestNoGoroutineLeak\n--- PASS: TestNoGoroutineLeak (0.15s)\n"}</code></pre>
        <p>The retry loop is the part people get wrong. <code>runtime.NumGoroutine()</code> is a snapshot, and a
            goroutine that has been told to stop takes an unspecified moment to actually stop, so a single comparison
            immediately after <code>Run</code> returns is flaky in both directions. Polling with a deadline converts
            "eventually true" into a test that passes quickly when correct and fails reliably when not. The
            <code>+1</code> tolerance covers the testing framework's own bookkeeping.
        </p>
        <p><strong>A goroutine leak is Go's version of a memory leak</strong>, and it is worse in one respect: a leaked
            goroutine holds everything it references, so one leaked ant keeps its world, its channels and its buffers
            alive forever. In a long-running service the symptom is memory growth that no heap profile explains until
            you look at the goroutine profile. Write this test early, run it in CI, and reach for
            <code>go.uber.org/goleak</code> when you want the industrial version, which names the leaked stacks instead
            of just counting.
        </p>
        <div className="note">
          <h5>A note on <code>errgroup</code></h5>
          <p>Production Go frequently uses <code>golang.org/x/sync/errgroup</code>, which combines a
                <code>WaitGroup</code>, error propagation and context cancellation:
            </p>
          <pre className="plain"><code>{"g, ctx := errgroup.WithContext(ctx)\ng.Go(func() error { return e.serve(ctx) })\ng.Go(func() error { return e.evaporate(ctx) })\nerr := g.Wait()   // first non-nil error, and ctx is cancelled for the rest"}</code></pre>
          <p>It is genuinely good and you should know it. I have kept this project dependency-free so far, partly to
                avoid hiding behaviour behind a library before you have implemented it yourself, and partly because
                <code>errgroup</code>'s "cancel everyone on the first error" semantics are the opposite of what this
                shutdown sequence needs. Add it with <code>go get golang.org/x/sync</code> when you want it; it is the
                one external dependency I would not argue about.
            </p>
        </div>
        <div className="exercise">
          <h5>Exercise 7</h5>
          <p>Add a shutdown deadline. If the ants have not all exited within <code>cfg.ShutdownGrace</code> (default
                two seconds), <code>Run</code> should log how many are still running, collect statistics anyway, stop
                the owner, and return a non-nil error that the caller can distinguish from a normal stop. Requirements:
                no goroutine may be left blocked on a channel send; <code>errors.Is</code> must work against your new
                sentinel; the leak test must still pass in the happy path; and add a test that forces the slow path by
                setting a large <code>Chaos.SlowFor</code>.</p>
          <p>Hint: <code>antWG.Wait()</code> blocks and has no timeout. You cannot add one to a
                <code>WaitGroup</code>, so you need to convert "the group finished" into something <code>select</code>
                can wait on.
            </p>
        </div>
        <details>
          <summary>Solution 7 — open after trying</summary>
          <pre><code>{"var ErrShutdownTimeout = errors.New(\"ants did not stop before the deadline\")\n\n// waitChan converts a WaitGroup into a channel that closes when the group\n// reaches zero, so it can be used in a select.\nfunc waitChan(wg *sync.WaitGroup) <-chan struct{} {\n\tdone := make(chan struct{})\n\tgo func() {\n\t\twg.Wait()\n\t\tclose(done)\n\t}()\n\treturn done\n}\n"}</code></pre>
          <pre><code>{"\t<-ctx.Done()\n\t<-supervisorDone\n\n\tvar shutdownErr error\n\tselect {\n\tcase <-waitChan(&antWG):\n\t\t// clean stop\n\tcase <-time.After(e.cfg.ShutdownGrace):\n\t\tshutdownErr = fmt.Errorf(\"%w after %v\", ErrShutdownTimeout, e.cfg.ShutdownGrace)\n\t\tlog.Printf(\"antfarm: %v; collecting stats anyway\", shutdownErr)\n\t}\n\n\tstats, err := e.Stats(context.Background())\n\tif shutdownErr != nil {\n\t\terr = shutdownErr\n\t}\n\n\tstopEvap()\n\tevapWG.Wait()\n\tstopServer()\n\tserverWG.Wait()\n\treturn stats, err\n"}</code></pre>
          <p>The <code>waitChan</code> helper is the standard answer to "I need a <code>WaitGroup</code> in a
                <code>select</code>". Note that it starts a goroutine which survives until the group drains, so on the
                timeout path it outlives <code>Run</code>. That is acceptable here (it will exit when the stragglers do)
                but it is exactly the kind of thing your leak test will notice, which is why the exercise asks you to
                force the slow path deliberately.
            </p>
          <p>The deeper lesson: <strong>you cannot force a goroutine to stop.</strong> There is no
                <code>goroutine.Kill()</code> in Go, by design. If an ant is asleep inside
                <code>time.Sleep(10 * time.Second)</code>, nothing in the language will wake it, and the best you can do
                is stop waiting and record that you did. Every graceful shutdown in Go is therefore cooperative, with a
                deadline and a report, and "how do I kill a stuck worker?" has exactly one answer: you do not, you
                design so that workers check for cancellation often enough that they never get stuck. Erlang's answer to
                this question is <code>exit(Pid, kill)</code>, which is unconditional and immediate, and Course 4 will
                show what becomes possible when that primitive exists.
            </p>
        </details>
        <h4>Experiment</h4>
        <p>Comment out <code>defer ticker.Stop()</code> in the evaporator and run the leak test. Then restore it and
            remove the <code>{'<'}-supervisorDone</code> line, and run the whole suite with <code>-race -count=20</code>.
            The first is a reliable failure; the second is an intermittent one, which is a good demonstration of why
            concurrency bugs need repeated runs rather than a single green tick.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 7</h5>
          <ul>
            <li><strong>One context for everything.</strong> Final statistics come back empty because the owner died
                    with the ants.</li>
            <li><strong><code>WaitGroup.Add</code> racing with <code>Wait</code>.</strong> Symptom: rare shutdown
                    hangs or a runtime panic about WaitGroup misuse.</li>
            <li><strong>Calling <code>os.Exit</code> in a signal handler.</strong> Deferred functions do not run,
                    buffered output is lost, and the graceful path you wrote never executes.</li>
            <li><strong>Waiting on a <code>WaitGroup</code> whose goroutines are blocked on a full channel nobody is
                        draining.</strong> Classic shutdown deadlock: stop the consumer before the producers and
                    everything wedges.</li>
            <li><strong>Assuming <code>defer</code> runs on panic in another goroutine.</strong> It runs in the
                    panicking goroutine only. An unrecovered panic anywhere kills the whole process, deferred cleanup
                    elsewhere included.</li>
            <li><strong>Trusting <code>NumGoroutine</code> immediately.</strong> Poll with a deadline.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does the owner get a context derived from <code>Background</code> rather than the caller's context?
            </li>
          <li>What exactly goes wrong if <code>antWG.Wait()</code> runs while the supervisor is still alive?</li>
          <li>Why does <code>Stats</code> use a fresh context during shutdown?</li>
          <li>What does <code>defer stop()</code> after <code>signal.NotifyContext</code> buy the user?</li>
          <li>Why must the leak test poll instead of comparing once?</li>
          <li>An ant is inside <code>time.Sleep(30 * time.Second)</code> when you cancel. What are your options?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 8</span>Chaos: crashes, dropped messages, slow ants</h2>
        <h3>Goal</h3>
        <p>Break the colony on purpose and keep it running. Ants panic at random and a supervisor restarts them. The
            owner drops messages at random and clients time out and retry. Ants stall at random and the queue absorbs
            it. Every failure becomes a number you can watch.</p>
        <h3>Concepts</h3>
        <p><code>panic</code> and <code>recover</code> across goroutine boundaries, supervision built by hand, restart
            state and generations, accounting for work lost in a crash, at-least-once versus at-most-once delivery, and
            the way timeouts interact with throughput.</p>
        <h3>Design</h3>
        <p>Three failures, each modelling something real:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Injected</th>
              <th>Models</th>
              <th>Handled by</th>
            </tr>
            <tr>
              <td><code>crash=p</code></td>
              <td>A bug, an assertion failure, a nil dereference in one worker</td>
              <td>recover + supervisor restart</td>
            </tr>
            <tr>
              <td><code>drop=p</code></td>
              <td>A lost packet, a dropped RPC, a full queue upstream</td>
              <td>client timeout and retry</td>
            </tr>
            <tr>
              <td><code>slow=p</code></td>
              <td>A GC pause, a slow disk, a noisy neighbour</td>
              <td>queueing, and eventually backpressure</td>
            </tr>
          </tbody>
        </table>
        <p>Go's failure model has one fact you must design around: <strong>an unrecovered panic in any goroutine
                terminates the entire process.</strong> Not just that goroutine. There is no supervisor in the runtime,
            no isolation between goroutines, and no way for one goroutine to catch another's panic. <code>recover</code>
            works only inside a deferred function <em>in the panicking goroutine itself</em>.</p>
        <p>So supervision has to be built, and the shape is forced by that constraint:</p>
        <pre className="plain"><code>{"  start(a) ──► goroutine ──► superviseAnt(ctx, a, deaths)\n                                   │\n                                   │  defer func(){ recover() } ← must be here\n                                   ▼\n                              runAnt(...)   ← panics here\n                                   │\n                          panic unwinds to the deferred func\n                                   │\n                                   ▼\n                            deaths <- a          (a channel of dead ants)\n                                   │\n                                   ▼\n                        supervisor: recycle(a); start(a)\n"}</code></pre>
        <p>The supervisor is a goroutine reading a channel of casualties. That is the entire mechanism, and it is about
            fifteen lines. Keep the number in mind when Course 4 shows you what Erlang gives you for free.</p>
        <h3>Implementation</h3>
        <h4>Injecting the failures</h4>
        <pre><code>{"// Chaos describes the failures we inject on purpose.\ntype Chaos struct {\n\tCrashProb float64       // per ant, per tick\n\tDropProb  float64       // per message, at the owner\n\tSlowProb  float64       // per ant, per tick\n\tSlowFor   time.Duration // how long a slow tick sleeps\n}\n"}</code></pre>
        <p>In the ant loop, before each cycle:</p>
        <pre><code>{"\t\tif e.cfg.Chaos.CrashProb > 0 && c.rng.Float64() < e.cfg.Chaos.CrashProb {\n\t\t\tpanic(fmt.Sprintf(\"ant %d: simulated crash at %v\", a.ID, a.Pos))\n\t\t}\n\t\tif e.cfg.Chaos.SlowProb > 0 && c.rng.Float64() < e.cfg.Chaos.SlowProb {\n\t\t\ttime.Sleep(e.cfg.Chaos.SlowFor)\n\t\t}\n"}</code></pre>
        <p>And at the top of the owner's <code>handle</code>:</p>
        <pre><code>{"\t// Chaos: pretend the message never arrived. No reply is sent, so the\n\t// caller will time out. This is a dropped packet, simulated.\n\tif e.cfg.Chaos.DropProb > 0 && e.rng.Float64() < e.cfg.Chaos.DropProb {\n\t\te.dropped.Add(1)\n\t\treturn\n\t}\n"}</code></pre>
        <p>Chaos uses each goroutine's own random source, so it inherits the same seeding discipline as everything else
            and a chaotic run is as reproducible as a chaotic run can be. The probability checks are guarded by
            <code>{'>'} 0</code> so that a zero-chaos configuration does not pay for a random number on every tick, which
            matters in the hot loop.
        </p>
        <h4>Recovering and restarting</h4>
        <pre><code>{"// superviseAnt runs one ant and turns a panic into a restart request.\nfunc (e *Engine) superviseAnt(ctx context.Context, a *Ant, deaths chan<- *Ant) {\n\tdefer func() {\n\t\tr := recover()\n\t\tif r == nil {\n\t\t\treturn\n\t\t}\n\t\te.restarts.Add(1)\n\t\tselect {\n\t\tcase deaths <- a:\n\t\tcase <-ctx.Done():\n\t\t}\n\t}()\n\te.runAnt(ctx, a)\n}\n"}</code></pre>
        <ul>
          <li><code>recover()</code> returns <code>nil</code> when there was no panic, which is how the deferred
                function distinguishes a crash from a normal return. Calling <code>recover()</code> outside a deferred
                function does nothing at all, silently, and that is a common bug.</li>
          <li>The send to <code>deaths</code> is inside a <code>select</code> with <code>ctx.Done()</code>. During
                shutdown the supervisor has already exited, so an unguarded send would block forever and leak the
                goroutine on exactly the path where you are least likely to look.</li>
          <li><code>deaths chan{'<'}- *Ant</code> is a send-only channel in the signature. The compiler now guarantees
                this function cannot read from it. Direction annotations are free documentation that the compiler
                checks.</li>
          <li>We discard the panic value here. Production code logs it with <code>debug.Stack()</code>, because a
                recovered panic with no stack trace is a bug you will never find.</li>
        </ul>
        <div className="warn">
          <h5>recover is not exception handling, and using it like exception handling is a mistake</h5>
          <p>It is tempting to wrap every goroutine in a recover and call the system robust. What you have actually
                built is a system that continues running in a state its author never considered, with a corrupted
                invariant and no report. The Go community's position, which I think is right, is that
                <code>recover</code> is for two things: a process boundary where a crash must not take down unrelated
                work (an HTTP handler, a plugin, one ant), and turning a panic into an error at a library's public edge.
                Everywhere else, let it crash and fix the bug.
            </p>
          <p>The version here qualifies, barely, because an ant is a genuine isolation boundary and because we count
                and report every restart. Note what it still cannot do: if the <em>owner</em> goroutine panics, the
                process dies and nothing survives. That asymmetry (one shared component whose failure is fatal) is
                inherent to the single-owner design, and it is a real cost to weigh against everything the design bought
                us in Milestone 5.</p>
        </div>
        <h4>Accounting for lost work</h4>
        <pre><code>{"// recycle resets a crashed ant before it restarts. A crash loses whatever\n// the ant was carrying, and the colony has to account for that.\nfunc (e *Engine) recycle(ctx context.Context, a *Ant) {\n\tif a.Carrying {\n\t\tselect {\n\t\tcase e.reqs <- request{kind: reqLost}:\n\t\tcase <-ctx.Done():\n\t\t}\n\t}\n\ta.Carrying = false\n\ta.Pos = e.nest\n\ta.Energy = e.cfg.StartEnergy\n\ta.Generation++\n}\n"}</code></pre>
        <p>This function is the most interesting fifteen lines in the milestone, for a reason that is not obvious.</p>
        <p><strong>Who owns the ant here?</strong> The rule since Milestone 5 has been "the ant's own goroutine writes
            its fields, nobody else". Yet <code>recycle</code> runs on the supervisor's goroutine and writes four of
            them. That is legal, and it is legal for a specific reason: the ant's goroutine is <em>dead</em>. Ownership
            transferred at the moment the panic unwound, and it transfers back when <code>start(a)</code> launches the
            replacement. The send on <code>deaths</code> and the later <code>go</code> statement are both
            synchronisation events, so the Go memory model guarantees the supervisor sees the dead ant's final state and
            the new goroutine sees the supervisor's writes. Ownership that moves between goroutines, handed over by
            channel operations, is the mental model that makes this kind of code tractable, and it is the same idea Rust
            encodes in its type system.</p>
        <p><strong>The crash destroys a unit of food.</strong> The owner already counted that unit in
            <code>carrying</code> when the pickup succeeded. If we simply restarted the ant, the ledger would claim a
            unit is in transit that no ant is carrying, and the conservation test would drift. So the supervisor tells
            the owner: one unit lost. The test then checks
        </p>
        <pre className="plain"><code>{"delivered + on the ground + carried + lost == the food we started with"}</code></pre>
        <p>and passes under crash chaos. <strong>In-flight work disappears when a worker dies, and if your metrics do
                not model that, they will quietly lie to you.</strong> That lesson costs real companies real money, and
            here it costs one integer.</p>
        <p><code>Generation</code> increments so a restarted ant does not replay the same random sequence (the seed is
            <code>uint64(a.ID) + a.Generation{'<'}{'<'}32</code>). Without it, an ant that crashed would repeat its exact
            previous life, including the crash, at the same point. Deterministic chaos that always kills the same ant in
            the same place is not chaos.
        </p>
        <h3>Running it</h3>
        <pre className="plain"><code>{"$ go run ./cmd/antfarm -ants 2000 -grid 96x96 -food 8 -food-per-source 400 \\\n      -duration 3s -every 1s -chaos crash=0.0005,drop=0.001\ncolony: 2000 ants, 96x96 grid, 8 food sources of 400, behaviour trail, chaos {CrashProb:0.0005 DropProb:0.001 SlowProb:0 SlowFor:0s}\ntick 44    ants 2000  carrying 32   delivered 504   food left 2663  lost 1    restarts 186  dropped 735   timeouts 574   pher 850\ntick 93    ants 2000  carrying 17   delivered 787   food left 2394  lost 2    restarts 372  dropped 1513  timeouts 1372  pher 284\nfinal: tick 143   ants 2000  carrying 4    delivered 860   food left 2332  lost 4    restarts 571  dropped 2298  timeouts 2155  pher 1272\n"}</code></pre>
        <p>Real output. Two thousand ants, 571 crashes and restarts in three seconds, 2,298 dropped messages, and the
            colony delivered 860 units of food while all of that was happening. Four units were lost to crashes and the
            books balance.</p>
        <p>Look at <code>dropped 2298</code> against <code>timeouts 2155</code>. They should be nearly equal, since
            every dropped message costs its sender a timeout, and the small gap is messages dropped near the end whose
            senders were cancelled before their timers fired. When two counters that should track each other stop
            tracking each other, you have found something. Deliberately instrumenting both sides of a mechanism, rather
            than one, is what makes that possible.</p>
        <h3>The timeout trap</h3>
        <p>Here are two runs of the same configuration, differing only in drop probability, over the same wall-clock
            budget:</p>
        <pre className="plain"><code>{"drop = 0.02 : dropped 1601, timeouts 1400, delivered 327\ndrop = 0.25 : dropped 1608, timeouts 1400, delivered  13\n"}</code></pre>
        <p>Twelve times the message loss, but the <em>same</em> number of dropped messages, and delivered food collapsed
            by 96%. Read that again, because it is not intuitive.</p>
        <p>The explanation: with a 50 ms timeout, an ant that loses a message spends 50 ms doing nothing, which is
            hundreds of times longer than a successful round trip. At 2% loss the colony still spends most of its time
            working. At 25% loss, one message in four costs 50 ms, so almost all the time goes into waiting, total
            traffic falls through the floor, and the absolute number of dropped messages stays flat because there are so
            few messages left to drop.</p>
        <p><strong>The timeout, not the loss rate, is what destroyed throughput.</strong> This is a genuine and very
            common production failure: a service degrades slightly, clients time out, retries multiply the load, and the
            system collapses far faster than the original fault would suggest. The mitigations are all things this code
            does not do yet, and they are worth naming: exponential backoff so retries spread out, jitter so clients do
            not synchronise, a retry budget so a client gives up, and a circuit breaker so a failing dependency stops
            being called at all. Milestone 11 adds backpressure, which addresses the same disease from the other end.
        </p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>This milestone is where Go's limits show, and it would be dishonest to pretend otherwise.</p>
          <p>What Go did well: injecting chaos cost about twenty lines, the supervisor is small enough to read in one
                sitting, and because ants are goroutines rather than threads, 571 restarts in three seconds is
                unremarkable. Restarting 571 OS threads in three seconds would be a noticeable event.</p>
          <p>What Go made hard, all stemming from one design choice, that goroutines are not isolated:</p>
          <ul>
            <li>A panic anywhere kills the process unless someone remembered to recover in that exact goroutine.
                    Forget one and a stray nil dereference in an ant takes down the colony.</li>
            <li>There is no way to kill a stuck goroutine. Our slow-ant chaos sleeps politely; a real stuck worker
                    would sit there until the process exits.</li>
            <li>Restart policy is entirely hand-rolled. We have no backoff, no restart intensity limit, and no
                    escalation. An ant that panics immediately on start would spin in a restart loop at full CPU, and
                    nothing in the language would notice.</li>
            <li>State recovery is manual. We had to know that a crashed ant loses its cargo and remember to tell the
                    owner.</li>
          </ul>
          <p>Erlang answers all four at the language and runtime level: processes have isolated heaps so one cannot
                corrupt another, <code>exit(Pid, kill)</code> is unconditional, and supervisors come with restart
                strategies, intensity limits and escalation as configuration rather than code. If fault tolerance were
                the whole problem, Erlang would be the better tool, and Course 4 is going to make that case with the
                same project in miniature. Go's counter-argument is everything else: static typing, raw speed, a single
                deployable binary, and a profiler that will save you in Milestone 11. Most systems need some of both,
                which is why "which language is better" is the wrong question and "what is this language's failure
                model" is the right one.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 8</h5>
          <p>Our supervisor restarts an ant instantly, forever. That is the one restart policy OTP explicitly warns
                against. Implement a better one.</p>
          <p><strong>Requirements.</strong> Add exponential backoff with jitter (first restart after ~10 ms, doubling,
                capped at one second). Add a restart intensity limit: if more than <code>MaxRestarts</code> happen
                within <code>RestartWindow</code>, stop restarting, record the colony as degraded, and let
                <code>Run</code> return an error identifying it. Expose <code>Degraded bool</code> and
                <code>Alive int</code> on <code>Stats</code>.
            </p>
          <p><strong>Constraints.</strong> No mutex. Backoff must not block the supervisor, since one sleeping ant
                must not delay restarting the other 49,999. Shutdown must still be prompt: a pending backoff must not
                keep <code>Run</code> waiting.</p>
          <p><strong>Acceptance.</strong> A test with <code>CrashProb: 0.5</code> ends degraded rather than burning
                CPU; a test with <code>CrashProb: 0.001</code> does not end degraded; the leak test still passes; and
                the whole suite is clean under <code>-race -count=5</code>.</p>
          <p><strong>Hints.</strong> Where does the sleep go so that it does not block the supervisor? What does the
                restart counter need to be, given that only the supervisor touches it? How does a sleeping restart learn
                that shutdown has begun?</p>
        </div>
        <details>
          <summary>Solution 8 — open after trying</summary>
          <pre><code>{"var ErrColonyDegraded = errors.New(\"restart intensity exceeded; colony degraded\")\n\n// restartTracker is touched only by the supervisor goroutine, so it needs\n// no synchronisation.\ntype restartTracker struct {\n\ttimes  []time.Time\n\twindow time.Duration\n\tmax    int\n}\n\nfunc (r *restartTracker) record(now time.Time) (overloaded bool) {\n\tcutoff := now.Add(-r.window)\n\tkept := r.times[:0]           // reuse the backing array: no allocation\n\tfor _, t := range r.times {\n\t\tif t.After(cutoff) {\n\t\t\tkept = append(kept, t)\n\t\t}\n\t}\n\tr.times = append(kept, now)\n\treturn len(r.times) > r.max\n}\n"}</code></pre>
          <pre><code>{"\ttracker := &restartTracker{window: e.cfg.RestartWindow, max: e.cfg.MaxRestarts}\n\tdegraded := make(chan struct{})\n\n\tgo func() {\n\t\tdefer close(supervisorDone)\n\t\tfor {\n\t\t\tselect {\n\t\t\tcase <-ctx.Done():\n\t\t\t\treturn\n\t\t\tcase a := <-deaths:\n\t\t\t\tif tracker.record(time.Now()) {\n\t\t\t\t\te.degraded.Store(true)\n\t\t\t\t\tclose(degraded)      // tell Run; ants already running continue\n\t\t\t\t\treturn\n\t\t\t\t}\n\t\t\t\te.recycle(ctx, a)\n\t\t\t\tdelay := backoff(a.Generation, e.cfg.RestartBackoff, time.Second, e.superRNG)\n\n\t\t\t\t// The sleep happens in the restarting goroutine, not here,\n\t\t\t\t// so one slow restart cannot delay the others.\n\t\t\t\tantWG.Add(1)\n\t\t\t\tgo func(a *Ant) {\n\t\t\t\t\tdefer antWG.Done()\n\t\t\t\t\tselect {\n\t\t\t\t\tcase <-time.After(delay):\n\t\t\t\t\tcase <-ctx.Done():\n\t\t\t\t\t\treturn       // do not start an ant during shutdown\n\t\t\t\t\t}\n\t\t\t\t\te.superviseAnt(ctx, a, deaths)\n\t\t\t\t}(a)\n\t\t\t}\n\t\t}\n\t}()\n\nfunc backoff(generation uint64, base, max time.Duration, rng *rand.Rand) time.Duration {\n\td := base << min(generation, 20)          // doubling, saturating\n\tif d > max || d <= 0 {\n\t\td = max\n\t}\n\t// Full jitter: anywhere in [0, d). Prevents restart storms from\n\t// synchronising after a correlated failure.\n\treturn time.Duration(rng.Int64N(int64(d) + 1))\n}\n"}</code></pre>
          <p>Five things worth extracting from this solution.</p>
          <ul>
            <li><strong>The sleep moved into the restarting goroutine.</strong> Putting <code>time.Sleep</code> in
                    the supervisor's loop would serialise every restart behind every backoff, so one crash-looping ant
                    would delay the recovery of all the others. Whenever a supervisor waits, ask what it is not doing
                    while it waits.</li>
            <li><strong><code>antWG.Add(1)</code> happens in the supervisor, before the <code>go</code>.</strong>
                    Doing it inside the new goroutine would let <code>Run</code>'s <code>Wait</code> return between the
                    two, which is the same hazard the <code>supervisorDone</code> channel exists to prevent.</li>
            <li><strong>The tracker needs no lock</strong> because exactly one goroutine touches it. Compare with
                    the atomics used for <code>restarts</code> and <code>dropped</code>, which are written by many.
                    Choosing between "owned" and "atomic" by asking who writes it is the whole discipline.</li>
            <li><strong><code>kept := r.times[:0]</code></strong> is the standard Go filter-in-place idiom: reslice
                    to zero length, keep the capacity, append what survives. It reuses the backing array and allocates
                    nothing, and it works because <code>append</code> writes over elements the loop has already read.
                </li>
            <li><strong>Full jitter, not fixed backoff.</strong> If a thousand ants crash together (which correlated
                    failures do), fixed backoff makes all thousand retry at the same instant, and you get a thundering
                    herd forever. Randomising the whole interval spreads them out. This is AWS's published
                    recommendation and it is worth remembering as a default.</li>
          </ul>
          <p>Compare the total with OTP's <code>{'{'}one_for_one, MaxRestarts, Window{'}'}</code>, which is one line of
                configuration and also handles escalation to a parent supervisor, ordered restarts of dependent
                children, and shutdown protocols per child. We have written maybe seventy lines for a strictly weaker
                version. That is not an argument against Go; it is an argument for knowing what you are reimplementing.
            </p>
        </details>
        <h4>Experiment</h4>
        <p>Run with <code>-chaos slow=0.01,slowfor=200ms</code> and 5,000 ants, then watch the timeout counter. Slow
            ants are not failing, they are just late, yet they consume queue slots and reply channels the entire time.
            Now raise <code>slowfor</code> to two seconds while keeping <code>RequestTimeout</code> at 200 ms and watch
            the system spend its life timing out. The interaction between a client's patience and a server's latency is
            where most production incidents actually live, and you can explore the whole space here with two flags.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 8</h5>
          <ul>
            <li><strong><code>recover()</code> not inside a deferred function.</strong> Returns nil, does nothing,
                    and the panic proceeds to kill the process. It must be <code>defer func(){'{'} recover() {'}'}()</code>, not
                    a bare call.</li>
            <li><strong>Trying to recover another goroutine's panic.</strong> Impossible. Every goroutine that can
                    panic needs its own deferred recover.</li>
            <li><strong>Discarding the panic value.</strong> Log it with <code>debug.Stack()</code> or you will
                    never diagnose a real crash, only simulated ones.</li>
            <li><strong>Restarting without resetting state.</strong> An ant restarted mid-journey while
                    <code>Carrying</code> is still true will try to drop food it does not have and generate a stream of
                    errors.
                </li>
            <li><strong>Forgetting to account for in-flight work.</strong> The conservation test drifts and you
                    spend an hour blaming the random number generator.</li>
            <li><strong>An unguarded send to <code>deaths</code>.</strong> Leaks a goroutine on every crash that
                    happens during shutdown.</li>
            <li><strong>Making chaos non-reproducible</strong> by using the global <code>rand</code>. Then "it broke
                    once" is all you will ever know.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why must <code>recover</code> live in the same goroutine that panics, and what happens if you forget
                one?</li>
          <li>The supervisor writes <code>a.Pos</code> and <code>a.Carrying</code>, which the ant's own goroutine
                normally owns. Why is that not a data race?</li>
          <li>Why does the crashed ant's cargo need to be reported to the owner?</li>
          <li>What does <code>Generation</code> prevent?</li>
          <li>Loss went from 2% to 25% and delivered food fell by 96% while dropped messages stayed flat. Explain.
            </li>
          <li>Name three mitigations for retry-induced collapse that this code does not implement.</li>
          <li>What happens if the owner goroutine panics? What would it take to survive that?</li>
          <li>Why is <code>deaths chan{'<'}- *Ant</code> written with a direction in the signature?</li>
        </ol>
        <h3>Repository state after Milestone 8</h3>
        <pre className="plain"><code>{"antfarm/\n├── go.mod\n├── cmd/\n│   └── antfarm/\n│       └── main.go              flags, chaos parsing, signals, reporting\n└── internal/\n    ├── sim/\n    │   ├── ant.go               Ant, Action, ActionKind, Generation\n    │   ├── behaviour.go         Behaviour, Forager, TrailFollower, directions\n    │   ├── sense.go             Sense, senseAt\n    │   ├── engine.go            requests, serve, antClient, supervisor, Run\n    │   ├── sim.go               Config, Chaos, Stats, the sequential Sim\n    │   ├── concurrent.go        milestone 4's mutex versions, kept for comparison\n    │   ├── engine_test.go       conservation, stats-under-load, leaks, chaos\n    │   ├── sim_test.go          decide tables, determinism, benchmarks\n    │   └── concurrent_test.go   race reproduction, locked benchmarks\n    └── world/\n        ├── grid.go              Position, Grid\n        ├── pheromone.go         FloatGrid, deposit, evaporate\n        ├── world.go             World, food, nest, errors\n        └── grid_test.go         bounds, food errors\n"}</code></pre>
        <pre className="plain"><code>{"$ gofmt -l . && go vet ./... && go test -race ./...\nok  \tgithub.com/yourname/antfarm/internal/sim\t1.965s\nok  \tgithub.com/yourname/antfarm/internal/world\t0.003s\n$ git commit -am \"milestone 8: chaos injection and a hand-rolled supervisor\"\n"}</code></pre>
        <div className="note">
          <h5>Where the mutex went</h5>
          <p>Worth pausing on: <code>engine.go</code> is now the heart of the project and contains no mutex at all.
                The only synchronisation primitives in it are channels, a context, three atomic counters for
                cross-goroutine metrics, and one <code>WaitGroup</code> per lifecycle group. Every piece of mutable
                state has exactly one owner, and the comments say who. That is what the Milestone 4 detour bought.</p>
        </div>
        <footer className="end">
          <p>Instalment 3 of the five-course curriculum. Next: Milestones 9–12, where metrics get an HTTP endpoint and
                a profiler, the colony gets a live view you can watch in a browser, backpressure and sharding make it
                fast, and the world moves into a separate process that you can kill.</p>
        </footer>
        <a className="button" href="/go-course/milestones/9-12/">Continue</a>
      </div>
    </div>
  );
}
