import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/left_to_right/glasses.png';

export const metadata: Metadata = {
  title: "Erlang: Advanced Phase, Final Challenge, Knowledge Check",
};

export default function Page() {
  return (
    <div className="theme-erlang">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 20 · Course 4 (Erlang) · Advanced phase and finish</p>
          <h1>What an experienced Erlang programmer wires together next, and whether you can now explain any of it </h1>
          <p className="lede">Five advanced topics with working code, one substantial final challenge about failover across real distributed nodes with its solution withheld, a knowledge check of forty-one questions, and everything you need to put <code>mesh</code> on GitHub and defend it in an interview.</p>
        </header>
        <h2><span className="num">Part A</span>The advanced phase</h2>
        <p>
          <img className="mascot-left" src={img1.src} alt="The Mewlang cat, wearing glasses, looking confident" width="120" loading="lazy" />
          The mesh works: it supervises thousands of nodes, survives chaos injected on purpose, reports itself over HTTP, and runs across real, separate machines. These five topics are what you would reach for if this were a system you had to actually operate, not a system you had to finish.
        </p>
        <h3>A1 · Wiring the real supervision tree</h3>
        <p>Every supervisor so far has been started and exercised individually, from the shell. A real OTP application starts its whole tree from one place, deterministically, in dependency order.</p>
        <pre><code>{"%% src/mesh_sup.erl\n-module(mesh_sup).\n-behaviour(supervisor).\n-export([start_link/0, init/1]).\n\nstart_link() ->\n    supervisor:start_link({local, ?MODULE}, ?MODULE, []).\n\ninit([]) ->\n    SupFlags = #{strategy => one_for_one, intensity => 5, period => 10},\n    Children = [\n        #{id => mesh_metrics,   start => {mesh_metrics, start_link, []}},\n        #{id => node_sup,       start => {node_sup, start_link, []}, type => supervisor},\n        #{id => mesh_dashboard, start => {mesh_dashboard, start_link, [8080]}}\n    ],\n    {ok, {SupFlags, Children}}.\n"}</code></pre>
        <p><strong>Order is not cosmetic.</strong> Children start left to right and stop right to left, so <code>mesh_metrics</code> — which everything else calls into — is guaranteed running before <code>node_sup</code> starts spawning nodes that might immediately increment a counter, and <code>mesh_dashboard</code>, which reads metrics, starts last, after there is something meaningful to read. Getting this order wrong is a real, common bug: a child whose <code>init/1</code> happens to call another child that has not started yet fails on startup, non-deterministically, depending on how fast each child happens to initialise — which is exactly the kind of bug that passes in development and fails once in a hundred production restarts.</p>
        <p><strong>What to measure:</strong> total startup time for the whole tree at your target node count, and whether it is dominated by <code>node_sup</code> spawning thousands of children or by something else — Milestone 7's 13ms-for-2,000-nodes number says it should not be the nodes themselves.</p>
        <h3>A2 · Process groups instead of scanning the whole registry</h3>
        <p><code>mesh_registry:broadcast/1</code> from Milestone 7's exercise walks every entry in one ETS table. That is fine at a few thousand nodes and starts to be the wrong tool past that, because every broadcast is O(n) work on the broadcasting process specifically. OTP's <code>pg</code> module (process groups, distribution-aware since OTP 23) exists for exactly "a dynamic set of processes I want to message as a group":</p>
        <pre><code>{"pg:start_link(),\npg:join(mesh_nodes, self()),           %% called from inside mesh_node:init/1\n[Pid ! Msg || Pid <- pg:get_members(mesh_nodes)].\n"}</code></pre>
        <p>The advantage over the hand-rolled ETS version is not raw speed at this scale — measured, they are close — it is that <code>pg</code> groups are <strong>distribution-aware for free</strong>: a process group spans every connected distributed node automatically, so <code>pg:get_members/1</code> called from <code>nodeb</code> in Milestone 11's two-node setup returns members living on <code>nodea</code> too, with no extra code. The hand-rolled ETS registry from Milestone 7 is local to whichever node it is running on; making it distributed would mean building the exact replication <code>pg</code> already has.</p>
        <p><strong>What to measure:</strong> broadcast latency at 2,000 and 20,000 members, both ways, and whether <code>pg</code>'s distribution awareness changes anything about your own registry design once you have it.</p>
        <h3>A3 · Structured logs with <code>logger</code></h3>
        <p>OTP's built-in <code>logger</code> (standard since OTP 21) gives structured, leveled logging with no dependency, the same shape Go's <code>log/slog</code> gave Course 1's colony:</p>
        <pre><code>{"logger:info(\"node started\", #{id => Id, pid => self()}),\nlogger:warning(\"restart intensity exceeded\", #{supervisor => node_sup, window_s => 5}),\n"}</code></pre>
        <pre className="plain"><code>{"2026-09-22T13:44:10.552Z info: node started id=42 pid=<0.94.0>\n"}</code></pre>
        <p>Two rules, matching the ones this curriculum has already argued for twice, in two other languages: <strong>never log per message</strong> — a mesh of two thousand nodes routing thousands of messages a second will produce far more log volume than the metrics counters ever will, for far less signal — and <strong>log the exceptional, count the routine</strong>, which is precisely why <code>mesh_metrics:inc/1</code> exists as a separate mechanism from logging at all.</p>
        <h3>A4 · Deterministic chaos, properly replayable</h3>
        <p>Milestone 8's <code>rand:seed/2</code> makes an attack pattern reproducible <em>if</em> nothing else about the run varies — Exercise 8's third part already found the gap: the input (which ids exist) has to be deterministic too. The complete fix records the schedule itself rather than trusting reseeded randomness to reproduce it exactly across Erlang/OTP versions, whose <code>rand</code> algorithm choices are not guaranteed stable forever:</p>
        <pre><code>{"build_schedule(Seed, NumAttacks, Ids) ->\n    rand:seed(exsplus, {Seed, Seed, Seed}),\n    [{lists:nth(rand:uniform(length(Ids)), Ids), rand:uniform()}\n     || _ <- lists:seq(1, NumAttacks)].\n"}</code></pre>
        <p>A schedule built once and written to disk (<code>file:write_file/2</code> with <code>term_to_binary/1</code>, or plain text via <code>~p</code>) replays identically regardless of what <code>rand</code> does internally in a future OTP release — the same lesson Go's Course 1 learned building its own <code>Schedule</code> struct, arrived at for the same reason: a schedule is data, and data outlives the specific random-number generator that produced it.</p>
        <h3>A5 · Shipping it</h3>
        <pre className="plain"><code>{"FROM erlang:25-slim AS build\nWORKDIR /src\nCOPY . .\nRUN rebar3 release\n\nFROM debian:bookworm-slim\nCOPY --from=build /src/_build/default/rel/mesh /opt/mesh\nEXPOSE 8080\nUSER nobody\nENTRYPOINT [\"/opt/mesh/bin/mesh\", \"foreground\"]\n"}</code></pre>
        <p>A release (Milestone 12) is already the deployment artefact — this Dockerfile does almost nothing beyond copying it into a smaller base image. <code>foreground</code> rather than <code>daemon</code> for the entrypoint matters specifically in a container: a container's process manager expects the entrypoint to <em>be</em> the running process (PID 1), not a script that forks a daemon and exits immediately, which from the container runtime's point of view looks like the container finishing its work and stopping. </p>
        <div className="warn">
          <h5>The BEAM itself can die, and something outside it has to notice</h5>
          <p>Every supervisor in this course watches processes <em>inside</em> one BEAM instance. Nothing built so far watches the BEAM instance itself — if the VM process is killed outright (<code>kill -9</code>, an out-of-memory kill, a host reboot), every supervision tree inside it dies with it, and by definition nothing inside that VM can be the thing that notices and restarts it. Erlang's own answer is <code>heart</code>, a small, separate OS-level watchdog process, started automatically when a release is booted with <code>-heart</code>, whose only job is monitoring the main BEAM process from outside it and restarting the whole thing if it stops responding. In a container, the more common answer is to let the orchestrator (Kubernetes, systemd, Docker's own restart policy) play that role instead — but the principle is the same one Course 1's Go colony met with <code>Restart=always</code> in a systemd unit: <strong>a supervision tree can only supervise what is inside its own process; something else has to watch the process itself.</strong></p>
        </div>
        <hr />
        <h2><span className="num">Part B</span>The final challenge</h2>
        <p>Everything up to here had a solution a few paragraphs later. This one does not, and it is deliberately at the edge of what you can now do.</p>
        <h3>Failover across real distributed nodes, with no double ownership</h3>
        <p>Milestone 11 connected two BEAM instances and sent one message between them. Now make them cooperate for real: <strong>split the mesh's id space across two or more distributed Erlang nodes, and when one goes down, have another take over serving its ids — without ever having two live nodes simultaneously answering for the same id.</strong></p>
        <h4>Requirements</h4>
        <ol>
          <li>Run 3 distributed nodes (start with <code>-sname</code> on one machine, same as Milestone 11). Statically assign each a contiguous band of ids at startup (node 1: ids 1–999, node 2: 1000–1999, node 3: 2000–2999).</li>
          <li>Each node runs its own <code>mesh_sup</code> tree, owning only its own band.</li>
          <li>A client process (anywhere) can ask <strong>any</strong> connected node "what is the status of id N", and get a correct answer regardless of which node actually owns that id — the client should never need to know the sharding scheme.</li>
          <li>Kill a node outright (<code>erlang:halt()</code> called on it, or killing its OS process). Within a bounded time, exactly one surviving node must take over serving status queries for the dead node's band — not necessarily its exact process state (that was lost, honestly, with the dead node), but at minimum a correct "this id exists in a dead band, here is what we last knew" answer.</li>
          <li>Restart the dead node. It must not resume owning its old band while another node is actively covering for it — reconcile explicitly, on a schedule you define and document, not by accident of timing.</li>
        </ol>
        <h4>Constraints</h4>
        <ul>
          <li>No external coordination service (no etcd, no Redis). Standard library and OTP only.</li>
          <li>No single point of failure for the <em>failover decision itself</em> — the mechanism that decides "node 2 is down, node 3 covers it now" must not depend on one specific node being up to make that call.</li>
          <li>At most one node may believe it owns a given band at any moment — momentary disagreement during a transition is acceptable and must be bounded and documented; permanent or unbounded double ownership is not.</li>
        </ul>
        <h4>Acceptance criteria</h4>
        <ol>
          <li><strong>No double ownership, ever, under a script that kills and restarts nodes randomly for 60 seconds.</strong> Log every ownership claim with a timestamp and assert, after the run, that no two claims for the same band overlap in time by more than your documented transition bound.</li>
          <li><strong>Every status query, from any node, for any id, gets a response</strong> — including during a failover window, where "band N is currently being taken over, try again shortly" is an acceptable honest answer, but silence or a crash is not.</li>
          <li><strong>A killed node's band is covered within a documented, bounded time</strong> after the kill is detected — state the number and justify it against your detection mechanism's own latency.</li>
          <li><strong><code>rebar3 do eunit, ct</code> passes</strong>, including at least one Common Test suite that actually starts multiple distributed nodes (<code>ct_slave</code> or <code>peer</code>, OTP's own facilities for spawning real additional nodes from inside a test).</li>
          <li><strong>A documented failure analysis</strong>, in the same shape as Go Course 1's final challenge: every point something can go wrong, and why the design is safe (or explicitly not) at that point. </li>
        </ol>
        <h4>Hints, in increasing order of how much they give away</h4>
        <ul>
          <li>You already have the primitive that detects a node going down cleanly: <code>net_kernel:monitor_nodes(true)</code> delivers a <code>{'{'}nodedown, Node{'}'}</code> message to whichever process asked. The hard part is not detecting a clean disconnect — it is that a node which is merely <em>slow</em> looks identical, from a distance, to a node which is dead. What does your design do about that ambiguity?</li>
          <li>"No single point of failure for the failover decision" rules out one designated node always deciding — think about what happens if that specific node is the one that dies. Every remaining node needs to be able to reach the same conclusion independently, or agree with each other, without asking a node that might not be there to ask.</li>
          <li><code>global:register_name/2</code> gives you a name that is unique across every connected node, enforced by Erlang's own distribution kernel — think about what it would mean for "who currently owns band 2" to be exactly this kind of name, claimed by whichever node currently believes it owns that band, and what happens automatically when the process holding that name dies.</li>
          <li>The restarted-node reconciliation requirement (5) is the same shape as Course 1's migration challenge's dedupe-table forgetting problem: a node coming back cannot simply reclaim its old band on the assumption that no one else has picked it up — it has to <em>ask</em>, and the asking itself needs an answer even if the node it would ask is the one now covering for it.</li>
        </ul>
        <p>Attempt it before reading on. Even a partial implementation with an honest account of what does not fully work is worth more than the section below.</p>
        <details>
          <summary>Solution — only look after trying</summary>
          <h4>The design: <code>global</code> names as ownership claims</h4>
          <p>Each band gets a well-known global name, <code>{'{'}band_owner, N{'}'}</code>. A node claims a band by registering that name for a local process — <code>band_owner_proc</code> — using <code>global:register_name/2</code>. <code>global</code> is exactly the primitive this needs: the name is unique across every connected node without any node acting as a single coordinator, and — critically — <strong>if the process holding the name dies, the name is released automatically</strong>, which is what turns "node 2 crashed" into "band 2's ownership becomes claimable again" with no extra code.</p>
          <pre><code>{"%% src/band_owner.erl\n-module(band_owner).\n-behaviour(gen_server).\n-export([start_link/1, claim/1, whois/1]).\n-export([init/1, handle_call/3, handle_info/2]).\n\nstart_link(Band) -> gen_server:start_link(?MODULE, Band, []).\n\nclaim(Band) ->\n    Name = {band_owner, Band},\n    case global:register_name(Name, self()) of\n        yes -> owned;\n        no  -> {owned_by, global:whereis_name(Name)}\n    end.\n\nwhois(Band) ->\n    case global:whereis_name({band_owner, Band}) of\n        undefined -> unowned;\n        Pid -> {ok, Pid}\n    end.\n\ninit(Band) ->\n    net_kernel:monitor_nodes(true),\n    self() ! {try_claim, Band},\n    {ok, #{band => Band, owned => false}}.\n\nhandle_info({try_claim, Band}, State) ->\n    case claim(Band) of\n        owned ->\n            logger:info(\"band claimed\", #{band => Band, node => node()}),\n            {noreply, State#{owned => true}};\n        {owned_by, _Other} ->\n            erlang:send_after(2000, self(), {try_claim, Band}),\n            {noreply, State}\n    end;\nhandle_info({nodedown, _Node}, #{band := Band} = State) ->\n    %% a node vanished; whether it was THIS band's owner is unknown from\n    %% here directly, so re-attempt the claim -- if this node already\n    %% owns it, global:register_name/2 on the same name is a safe no-op\n    %% for the current holder\n    self() ! {try_claim, Band},\n    {noreply, State}.\n"}</code></pre>
          <p><strong>Every node runs one <code>band_owner</code> process per band that is not necessarily its own</strong> — in practice, one per band total across the whole cluster, all attempting to claim every band, with <code>global</code>'s uniqueness guarantee meaning only one attempt per band actually succeeds. This directly answers the "no single point of failure for the decision" constraint: every node is independently trying to claim every band, all the time; nothing about the mechanism depends on any one specific node being alive to arbitrate.</p>
          <h4>The slow-versus-dead ambiguity, named rather than solved</h4>
          <p><code>{'{'}nodedown, Node{'}'}</code> fires on a clean TCP disconnect or a missed heartbeat past <code>net_kernel</code>'s own timeout — it cannot, and does not claim to, distinguish "that node's BEAM process is genuinely gone" from "that node is still running but is unreachable right now." This is the FLP-impossibility fact the Go course's final challenge met from a different angle: <strong>no failure detector in an asynchronous network can be both accurate and complete.</strong> The design above resolves the ambiguity the same way <code>global</code> itself does: by trusting the connection state, accepting that a node which is merely slow to respond but not actually disconnected will not trigger <code>nodedown</code> at all (correct — it is not down), and accepting that a node which reconnects after a network hiccup, without ever actually crashing, will find its <code>global</code> registration already gone and will simply re-claim its own band on the next <code>{'{'}try_claim, ...{'}'}</code> retry, which is safe precisely because re-claiming an already-owned-by-you name is a no-op.</p>
          <h4>Reconciliation on restart</h4>
          <p>A restarted node's <code>band_owner</code> for its own band runs <code>init/1</code> exactly like every other node's copy: attempt to claim, and if another node already holds it (because it covered during the outage), back off and retry every 2 seconds. There is no special "I used to own this" logic at all — the restarted node is, deliberately, treated identically to any other node that wants a band it does not currently hold. This is the direct answer to requirement 5: reconciliation is not a separate mechanism bolted on for the restart case, it is the same claim loop every node always runs, which is what makes it safe rather than merely convenient.</p>
          <h4>What is still wrong with this, and you should say so in your README</h4>
          <ul>
            <li><strong>Losing the band means losing its state.</strong> The surviving node that takes over a band did not inherit the dead node's mesh nodes' actual in-memory state — requirement 4 explicitly allowed "here is what we last knew" rather than perfect continuity, and this design takes that allowance fully: there is no state replication here at all, only ownership replication. A production version would need the owning node to periodically checkpoint each mesh node's state somewhere a successor could read it, which is a materially larger project. </li>
            <li><strong><code>global</code> itself does not scale past a few hundred nodes gracefully</strong> — it is a full-mesh, all-nodes-agree protocol, fine for this challenge's three nodes and a genuine limitation the documentation for <code>global</code> states plainly for larger clusters. </li>
            <li><strong>The 2-second retry interval is a real, tunable trade</strong> between failover latency (how long a band goes uncovered) and claim-storm cost (how much distribution traffic every node generates trying to claim bands it does not hold) — the number was chosen, not derived, and that should be stated rather than implied to be correct.</li>
            <li><strong>No protection against a genuinely malicious or badly time-skewed node</strong> claiming a band it should not — <code>global</code> trusts every connected node equally, which is consistent with this course's whole cookie-based trust model (Milestone 11) and worth naming as a boundary rather than leaving implicit.</li>
          </ul>
          <p>If you can explain why "no single point of failure for the decision" specifically ruled out a designated coordinator, and why that is the same FLP-flavoured impossibility the Go course's own final challenge met, you are ahead of most candidates with "distributed systems" on their CV.</p>
        </details>
        <hr />
        <h2><span className="num">Part C</span>Knowledge check</h2>
        <h3>C1 · Twenty conceptual questions</h3>
        <ol className="qs">
          <li>What does <code>=</code> actually do in Erlang, precisely, and why is calling it "assignment" wrong? </li>
          <li>Why is a tail call compiled to a jump rather than a new stack frame, and what class of program does that guarantee make practical that would not be otherwise?</li>
          <li>Explain the difference between a link and a monitor in terms of direction and default effect, and name a place in this project each was the correct choice.</li>
          <li>Why does <code>trap_exit</code> change what a link does, rather than simply ignoring exit signals altogether?</li>
          <li>What is the actual difference between <code>error</code>, <code>throw</code>, and <code>exit</code> as ways to signal something exceptional?</li>
          <li>Why does this course's philosophy argue for reaching for <code>try</code>/<code>catch</code> less often than instinct suggests, and where does it say the boundary still belongs?</li>
          <li>What does an OTP behaviour actually check at compile time, and how does that differ from how a Go interface is satisfied?</li>
          <li>Explain <code>simple_one_for_one</code> versus plain <code>one_for_one</code>, and which shape of child population each fits.</li>
          <li>What do a supervisor's <code>intensity</code> and <code>period</code> actually bound together, and what happens once that bound is exceeded?</li>
          <li>Why is a process's mailbox described as unbounded, and what real cost follows from that when a caster outpaces its target?</li>
          <li>What is selective receive, and why does the <code>Ref</code>-tagging convention specifically enable it for request/reply?</li>
          <li>Why is ETS the right tool for a registry that many processes read and write concurrently, compared to funnelling every lookup through one process?</li>
          <li>What does a network partition actually do to the processes on either side of it, and what does it not do?</li>
          <li>Why can Erlang's distribution layer route a message to a remote pid with no protocol code written by the application, where Go's Milestone 12 needed an explicit wire protocol?</li>
          <li>What does the shared cookie between two distributed nodes actually authorise, and what does it not protect against?</li>
          <li>Why is tracing every call to a hot function on a live system dangerous in a way that is specific to what tracing costs, not just "debugging in production is risky" in the abstract?</li>
          <li>What is the difference between what EUnit, Common Test, and PropEr are each best suited to test? </li>
          <li>Why does a property-based test search for a counterexample rather than checking specific examples, and what kind of bug is it more likely to find than a hand-written test suite?</li>
          <li>Explain why <code>heart</code> (or an external process manager) is necessary even though every supervisor tree in this project is, itself, a fault-tolerance mechanism.</li>
          <li>State, in your own words, what this course's central comparison to the Perl course's "a line you cannot parse is still evidence" rule actually is, and why both are correct for what each system is protecting.</li>
        </ol>
        <details>
          <summary>Answers to C1</summary>
          <ol className="qs">
            <li>Pattern matching: it binds an unbound variable to a value, or asserts (raising an exception if false) that an already-bound variable equals the value on the right. "Assignment" implies reassignment is possible, which it is not — a bound variable stays bound to that value for the rest of its scope.</li>
            <li>A tail call reuses the current stack frame instead of pushing a new one, because nothing remains to be done with its result except return it. This makes unbounded recursion — the only looping construct Erlang has — run in constant stack space, which is what makes "loop by recursion" a practical default rather than a recipe for stack overflow on any sufficiently long-running process.</li>
            <li>A link is bidirectional and, by default, propagates a crash to both sides; a monitor is one-directional and only ever notifies, never kills. Links: every supervisor-to-child relationship in this project. Monitors: the registry's cleanup-on-death watcher in Milestone 7, which observes nodes it does not own or supervise.</li>
            <li><code>trap_exit</code> converts what would be a fatal propagated exit signal into an ordinary <code>{'{'}'EXIT', Pid, Reason{'}'}</code> message delivered to the trapping process's own mailbox — the link (and the guarantee that a linked process's death is always reported) is preserved; only the default "and then you die too" behaviour is replaced with "and then you get to decide."</li>
            <li><code>error</code> signals a genuine bug or invalid operation; <code>throw</code> signals a value meant for non-local control flow that the thrower expects someone to catch; <code>exit</code> is a deliberate request that a process terminate, which is also what an unhandled <code>error</code> becomes once it propagates past the top of a process.</li>
            <li>Because catching a failure defensively and attempting to continue means continuing in a state nobody designed for or tested; letting the process crash and restart into the known-good state <code>init/1</code> establishes is usually safer. The boundary is genuine edges — user input, a network response, anywhere "fail with a specific, recoverable reason" is itself the correct behaviour rather than a defensive reflex.</li>
            <li>It checks, at compile time, that every callback the behaviour requires is actually exported by the module declaring it, and warns if one is missing. A Go interface is satisfied implicitly, by having the right method set, checked only where it is used; an Erlang behaviour is declared explicitly and checked against its own declaration regardless of whether anything yet calls it. </li>
            <li><code>simple_one_for_one</code> is a template for an unbounded, dynamically-sized population of identical children, added and removed at runtime — this project's node pool. <code>one_for_one</code> is a fixed, statically-declared list of distinct children known at startup — <code>mesh_sup</code>'s own children (metrics, node_sup, dashboard).</li>
            <li>The number of restarts tolerated within a rolling time window. Exceeding it means the supervisor concludes restarting is not fixing anything, stops trying, and terminates itself, reporting the failure one level further up the tree.</li>
            <li>Because nothing bounds how many messages can queue in it — a producer that outpaces its consumer grows the mailbox without limit, and every <code>receive</code> against that mailbox gets slower too, because a selective receive has to scan past everything already queued that does not match.</li>
            <li>Scanning a mailbox for the first message matching one of a <code>receive</code>'s clauses, leaving non-matching messages queued for a later receive. The <code>Ref</code>, unique per request, lets a process wait specifically for the reply to <em>this</em> call while other, unrelated messages sit safely unmatched in the same mailbox.</li>
            <li>ETS lets any process read or write the table directly and concurrently, with atomic per-key operations like <code>update_counter/3</code> — funnelling every access through one owning process turns that process into a serialisation point and a single point of failure for every reader, which is the exact problem ETS avoids.</li>
            <li>It stops the processes on either side from being able to see or message each other; it does not kill, corrupt, or pause any process on either side — each half keeps running, internally consistent, believing itself to be the whole system.</li>
            <li>Because a pid is a location-transparent reference the runtime itself knows how to route to, locally or across a connection, with the distribution protocol built into the BEAM. Go's channels are a purely local, in-process primitive with no distributed counterpart, so "distribute it" meant designing and implementing a wire protocol by hand.</li>
            <li>That two nodes trust each other enough to connect and exchange messages at all. It does not encrypt traffic between them, and does not by itself protect against a node on the same network that has obtained the cookie — it is a shared secret, not a full authentication and encryption scheme.</li>
            <li>Tracing generates one trace message per matched call, delivered to the tracer process — tracing every call to a function invoked thousands of times a second can produce trace volume the tracer cannot keep up with, which is a new, self-inflicted load and memory problem layered on top of whatever you were originally trying to diagnose.</li>
            <li>EUnit: fast, function-level unit tests, including ones needing a running process via its fixture shape. Common Test: heavier, suite-level tests with proper setup/teardown, suited to integration-shaped scenarios like starting a real supervision tree. PropEr: properties that should hold across a whole class of generated inputs, not specific examples.</li>
            <li>Because it generates many random inputs and searches for one that breaks the stated property, rather than checking only the inputs a person thought to write down — it is more likely to find an edge case (a boundary value, an unusual combination) that never occurred to the test's author.</li>
            <li>A supervisor tree can only supervise processes running inside its own BEAM instance; if the BEAM process itself is killed or the host crashes, nothing inside that VM can be the thing that notices, because there is no "inside" left running. Something outside the VM — <code>heart</code>, a container orchestrator, systemd — has to watch the VM process itself.</li>
            <li>Strata protects data: a malformed record is still evidence, so every parser must always return something rather than lose input. A mesh node protects overall system availability: a node that crashed and restarted cleanly is cheap and expected, while a node that survived in a corrupted, half-understood state to keep processing is the actual danger. Both are legitimate fault tolerance strategies; the difference is what each system considers the unacceptable outcome.</li>
          </ol>
        </details>
        <h3>C2 · Ten code-reading questions</h3>
        <p>Predict the output of each, then check. All ten were run to confirm the answers.</p>
        <pre><code>{"%% 1\nX = 1 == 1.0,\nY = 1 =:= 1.0,\nio:format(\"~p ~p~n\", [X, Y]).\n\n%% 2\nF = fun() ->\n    L = [N * 2 || N <- [1,2,3,4], N rem 2 =/= 0],\n    L\nend,\nio:format(\"~p~n\", [F()]).\n\n%% 3\nio:format(\"~p~n\", [length([1,2,3|[4,5]])]).\n\n%% 4\nA = try error(oops) catch _:_ -> caught end,\nio:format(\"~p~n\", [A]).\n\n%% 5\nR = (catch 1/0),\nio:format(\"~p~n\", [element(1, R)]).\n\n%% 6\nM0 = #{a => 1},\nM1 = M0#{a => 2},\nio:format(\"~p ~p~n\", [M0, M1]).\n\n%% 7\nloop(0) -> done;\nloop(N) -> loop(N - 1).\nio:format(\"~p~n\", [loop(3)]).\n\n%% 8\nPid = spawn(fun() -> receive _ -> ok end end),\nAlive1 = is_process_alive(Pid),\nexit(Pid, kill),\ntimer:sleep(10),\nAlive2 = is_process_alive(Pid),\nio:format(\"~p ~p~n\", [Alive1, Alive2]).\n\n%% 9\n{ok, S} = {ok, hello},\nResult = case S of\n    hello -> matched_atom;\n    _ -> something_else\nend,\nio:format(\"~p~n\", [Result]).\n\n%% 10\nG = fun(N) when N > 0, N < 10 -> small;\n        (N) when N >= 10 -> big;\n        (_) -> negative_or_zero\n    end,\nio:format(\"~p ~p ~p~n\", [G(5), G(50), G(-1)]).\n"}</code></pre>
        <details>
          <summary>Answers to C2</summary>
          <pre className="plain"><code>{"1.  true false\n2.  [2,6]\n3.  5\n4.  caught\n5.  'EXIT'\n6.  #{a => 1} #{a => 2}\n7.  done\n8.  true false\n9.  matched_atom\n10. small big negative_or_zero\n"}</code></pre>
          <ol className="qs">
            <li><code>==</code> compares by value across types (1 and 1.0 are numerically equal); <code>=:=</code> also requires the same type, and an integer is never the same type as a float. </li>
            <li>The filter keeps odd numbers from the input (1 and 3), and the comprehension doubles each, giving <code>[2, 6]</code> — note the output order matches the input order, not the doubled values' magnitude.</li>
            <li><code>[1,2,3|[4,5]]</code> is exactly the same list as <code>[1,2,3,4,5]</code> — the <code>|</code> syntax conses onto the front of whatever list follows it, and a list is a valid thing to cons onto just as a single element is.</li>
            <li><code>try ... catch Class:Reason -{'>'} ...</code> with a wildcard pattern catches any exception class, converting the crash into the ordinary value <code>caught</code>.</li>
            <li>A bare <code>catch Expr</code> (not <code>try</code>) converts an exception into a value shaped <code>{'{'}'EXIT', Reason{'}'}</code> rather than propagating it; <code>element(1, R)</code> extracts the tag, which is the atom <code>'EXIT'</code>.</li>
            <li>Map update syntax (<code>M0#{'{'}a := 2{'}'}</code> or, as here, <code>={'>'}</code> which both inserts and updates) produces a new map; <code>M0</code>, already bound, is completely unaffected by anything done to build <code>M1</code>.</li>
            <li>Tail-recursive countdown to the base case, returning the atom <code>done</code> — included as a reminder that a "loop" in Erlang is just an ordinary function, with an ordinary return value, nothing special about it syntactically.</li>
            <li>The process is genuinely alive before <code>exit/2</code> (it is blocked in <code>receive</code>, which is a normal, alive state, not a dead one) and genuinely dead 10ms after an <code>exit(Pid, kill)</code> — <code>kill</code> specifically is a reason that cannot be trapped even by a process with <code>trap_exit</code> set, unlike an ordinary exit reason.</li>
            <li>Matching <code>{'{'}ok, S{'}'}</code> against the literal tuple <code>{'{'}ok, hello{'}'}</code> binds <code>S</code> to the atom <code>hello</code>; the <code>case</code> then matches the first clause exactly.</li>
            <li>Three function clauses in one anonymous fun, dispatched by guard exactly like named-function clauses — the syntax (semicolons between clauses, all sharing one <code>fun ... end</code>) is the only thing that looks unfamiliar; the dispatch mechanism is identical to <code>describe/1</code> from the instalment's Section 2.5.</li>
          </ol>
        </details>
        <h3>C3 · Five debugging exercises</h3>
        <p>Each gives a symptom and a suspect. Diagnose before opening the answer.</p>
        <ol className="qs">
          <li>
            <strong>Symptom:</strong> a node's mailbox grows without bound over a long chaos run, and the whole process gets visibly slower over time, though it never crashes. 
            <pre className="bad"><code>{"handle_call(get_status, _From, State) ->\n    #{status := S} = State,\n    {reply, S, State}.\n%% no handle_cast/2 clause defined at all"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> two chaos runs with the same seed crash different sets of node ids. 
            <pre className="bad"><code>{"Ids = [Id || {Id, _} <- ets:tab2list(mesh_registry)],  % order not guaranteed\nrand:seed(exsplus, {Seed, Seed, Seed}),\n[attack(Id) || Id <- Ids]."}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> <code>node_sup</code> occasionally fails to start with <code>{'{'}error, {'{'}already_started, Pid{'}'}{'}'}</code>, only under a fast test script that starts and stops it repeatedly. 
            <pre className="bad"><code>{"stop_sup() ->\n    exit(whereis(node_sup), kill),\n    ok.   % returns immediately; caller assumes the supervisor is gone"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> the dashboard's <code>/metrics</code> endpoint occasionally hangs indefinitely for one specific client, never timing out, blocking that one connection forever. 
            <pre className="bad"><code>{"handle(Sock) ->\n    {ok, Req} = gen_tcp:recv(Sock, 0),   % no timeout argument\n    ..."}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> a supervisor configured with <code>intensity ={'>'} 3, period ={'>'} 5</code> shuts down after only <em>one</em> crash during a specific test, not three. 
            <pre className="bad"><code>{"ChildSpec = #{id => mesh_node, start => {mesh_node, start_link, []},\n              restart => permanent, shutdown => 100},\n%% test calls mesh_node:stop/1 (a deliberate, clean stop) three times,\n%% then crashes it once, expecting 3 tolerated restarts still available"}</code></pre>
          </li>
        </ol>
        <details>
          <summary>Answers to C3</summary>
          <ol className="qs">
            <li><strong>No catch-all in <code>handle_cast/2</code> (or missing entirely).</strong> A <code>gen_server</code> with no matching <code>handle_cast/2</code> clause for an incoming cast crashes on that cast — which would at least be visible — but a module that defines <em>no</em> <code>handle_cast/2</code> at all still compiles (the behaviour only warns, does not require every callback if defaults exist) and silently accumulates unhandled casts exactly like a <code>receive</code> with no matching clause, per the instalment's mailbox warning. Fix: add an explicit catch-all clause that at least logs and discards.</li>
            <li><strong><code>ets:tab2list/1</code> has no guaranteed order.</strong> The chaos schedule seeds <code>rand</code> deterministically, but iterates the ids in whatever order ETS happens to return them, which is not specified to be stable across runs or even across the same table's internal rehashing. Fix: sort the ids explicitly before building the schedule, so the sequence of "which id gets attacked Nth" is deterministic, not merely the random numbers are.</li>
            <li><strong>Killing a process does not mean it has finished terminating yet.</strong> <code>exit(Pid, kill)</code> sends an asynchronous signal and returns immediately — the target process is scheduled to die but has not necessarily been fully cleaned up (its registered name released, in particular) by the time the caller proceeds to start a new one under the same name. Fix: monitor the process and wait for its <code>'DOWN'</code> message before considering it gone, exactly the pattern <code>mesh_watcher</code> already used for the opposite direction. </li>
            <li><strong><code>gen_tcp:recv/2</code> with no timeout blocks forever</strong> if the client opens a connection and then never sends a complete request — a slow-loris-shaped client, deliberate or not. Fix: <code>gen_tcp:recv(Sock, 0, 5000)</code>, and handle the <code>{'{'}error, timeout{'}'}</code> case by closing the socket, exactly the discipline every <code>gen_server:call/2</code> already has built in by default.</li>
            <li><strong><code>restart ={'>'} permanent</code> instead of <code>transient</code>.</strong> A permanent child is restarted on <em>any</em> termination, including the clean, deliberate stops the test performed — each of those three intentional stops counted against the intensity budget exactly like a real crash would, leaving none left for the genuine crash that followed. This is precisely why Milestone 6 chose <code>transient</code> for mesh nodes: a deliberately-stopped node should not consume restart budget meant for genuine failures.</li>
          </ol>
        </details>
        <h3>C4 · Five implementation exercises</h3>
        <ol className="qs">
          <li><strong>A bounded mailbox pattern.</strong> <code>gen_server</code> mailboxes are unbounded by design; implement admission control in front of one — a wrapper that checks <code>process_info(Pid, message_queue_len)</code> before casting, and returns <code>{'{'}error, overloaded{'}'}</code> rather than casting past a configurable threshold. Measure whether this actually protects a deliberately slow-handler node from an unbounded mailbox under chaos.</li>
          <li><strong>Rolling restart.</strong> Write a function that restarts every node in <code>node_sup</code> one at a time, waiting for each replacement to report <code>alive</code> before moving to the next, with a configurable delay between each — the operational tool you would actually want before deploying a code change to a live mesh.</li>
          <li><strong>A <code>gen_statem</code> version of <code>mesh_node</code>.</strong> OTP's <code>gen_statem</code> behaviour models a process as an explicit state machine rather than a bag of callbacks over one opaque state term. Rebuild <code>mesh_node</code> with <code>alive</code> and <code>crashed</code> as explicit states, and compare: what does making the states explicit catch that the map-based <code>status</code> field could not?</li>
          <li><strong>Cluster-wide metrics.</strong> Using <code>pg</code> or <code>global</code> from Part A, aggregate <code>mesh_metrics:snapshot/0</code> across every connected distributed node into one combined view, callable from any single node.</li>
          <li><strong>A minimal <code>relup</code>.</strong> Using <code>relx</code>'s upgrade support, ship a trivial code change (a new log line in <code>mesh_node</code>) as a hot upgrade to a running release — no restart, the running system picks up the new code while its supervision tree and all live processes keep running. This is genuinely fiddly to get right; treat getting it to work at all as the win.</li>
        </ol>
        <h3>C5 · One substantial challenge</h3>
        <p>Distinct from the final challenge in Part B, and smaller, but not easy.</p>
        <p><strong>Build a mailbox-depth-aware load shedder.</strong> Give every node's <code>gen_server</code> a way to report its own mailbox depth on every message handled (<code>process_info(self(), message_queue_len)</code>, cheap enough to call routinely), publish it to <code>mesh_metrics</code>, and have <code>mesh_registry:route/2</code> refuse to route a new message to a node whose reported depth is above a threshold, returning <code>{'{'}error, node_overloaded{'}'}</code> instead of adding to an already-backed-up mailbox.</p>
        <p>Requirements: the threshold must be per-node, not global, since Milestone 8's slow-handler attack targets individual nodes, not the whole mesh; the mechanism must not itself become a bottleneck at 2,000 nodes (measure the added cost of a depth check on every routed message); and you must demonstrate, under chaos, that a genuinely overloaded node's mailbox depth stays bounded rather than growing without limit the way an unprotected one does. Hint: reporting depth on every handled message is itself extra work on the hot path — consider reporting it periodically instead, and what staleness that trades away.</p>
        <h3>C6 · You should now be able to explain</h3>
        <ul>
          <li>Why pattern matching subsumes assignment, destructuring, and shape assertion as one mechanism.</li>
          <li>Tail recursion and why it is the only loop construct this language needs.</li>
          <li>The link/monitor/trap_exit distinction, precisely, not just "processes can watch each other."</li>
          <li>"Let it crash" as an engineering strategy with a specific trade-off, not a slogan.</li>
          <li>What an OTP behaviour actually is, and what <code>gen_server</code> specifically removes from hand-written process code.</li>
          <li>Supervision strategies, restart types, and intensity limits, and which real failure mode each one answers.</li>
          <li>Why ETS is the right shared-state primitive here, and what it does not give you (ordering guarantees across separate operations, for one).</li>
          <li>What actually changes, in code, when a message-passing system becomes genuinely distributed — and what does not.</li>
          <li>Why a network partition is a state-reconciliation problem, not an availability problem, for the side effects that matter.</li>
          <li>The honest cost side of every "why this language" argument made across this course — not just what Erlang buys you, but what it is spent on.</li>
        </ul>
        <h3>C7 · You should now be able to implement</h3>
        <ul>
          <li>A <code>gen_server</code>-based process with a clean call/cast API.</li>
          <li>A <code>simple_one_for_one</code> supervisor for a dynamic pool, and a <code>one_for_one</code> root supervisor wiring several different kinds of children together in dependency order.</li>
          <li>An ETS-backed registry with automatic, monitor-driven cleanup.</li>
          <li>A seeded, reproducible chaos/fault-injection module.</li>
          <li>A minimal HTTP server on <code>gen_tcp</code>, including a streaming (SSE) response.</li>
          <li>Two real, separately-started distributed Erlang nodes that connect and message each other.</li>
          <li>A property-based test using PropEr, stating a real property rather than a specific example.</li>
          <li>A standalone <code>relx</code> release you can start, ping, and stop as a daemon.</li>
        </ul>
        <hr />
        <h2><span className="num">Part D</span>Shipping it: README, portfolio, interview</h2>
        <h3>D1 · README draft</h3>
        <pre className="plain"><code>{"# mesh\n\nA simulated network of thousands of supervised Erlang processes that crash,\nrestart, partition and recover — a laboratory for OTP supervision, and,\nin its final form, a genuinely distributed, multi-node fault-tolerant system.\n\nNo third-party dependencies beyond PropEr (dev/test only). Standard OTP.\n\n## What it does\n\n- Each mesh node is a gen_server, supervised by a simple_one_for_one tree\n  that tolerates a bounded number of crashes before giving up and\n  escalating — measured: exactly 3 restarts tolerated, the 4th within the\n  same 5-second window brings the supervisor down, on command.\n- An ETS-backed registry finds any node by id, with automatic,\n  monitor-driven cleanup on crash — no stale entries survive a restart.\n- A seeded chaos module attacks the live mesh: random crashes, slow\n  handlers, malformed messages — fully reproducible from one integer.\n- A dashboard, served over plain HTTP from inside the system it reports\n  on, with a streaming (SSE) live view — no external web framework.\n- Genuinely distributed: multiple real BEAM nodes, connected over a real\n  network, sharing message-passing code that never needed to change to\n  become distribution-aware.\n- Ships as a standalone relx release: no Erlang installation required on\n  the target machine.\n\n## Quick start\n\n    rebar3 release\n    _build/default/rel/mesh/bin/mesh daemon\n    curl http://localhost:8080/metrics\n    _build/default/rel/mesh/bin/mesh stop\n\n## Architecture\n\n    mesh_sup (one_for_one)\n      |- mesh_metrics        counters, ETS-backed\n      |- node_sup (simple_one_for_one)\n      |    `- mesh_node x N   gen_server, supervised, crashable on purpose\n      `- mesh_dashboard       HTTP + SSE, reads mesh_metrics\n\n## Testing\n\n    rebar3 do eunit, ct, proper\n\n## Known limitations\n\n- The dashboard has no auth; it is meant for a trusted network only.\n- Distribution trusts the shared cookie; there is no additional\n  authentication or encryption between nodes.\n- global-based failover (advanced phase) does not scale past a few\n  hundred nodes gracefully — this is a stated limitation of `global`\n  itself, not a bug in this project's use of it.\n\n## Licence\n\nMIT\n"}</code></pre>
        <p>Three deliberate choices, matching every README in this curriculum so far: it <strong>leads with measured numbers</strong> (the exact restart-intensity threshold, not an adjective); it <strong>states what it depends on and what it does not</strong>; and it has a <strong>known limitations</strong> section that names the real, specific boundary of <code>global</code> rather than implying the failover mechanism is production-ready as built.</p>
        <h3>D2 · GitHub project description</h3>
        <blockquote>A simulated distributed network in Erlang/OTP: supervised processes that crash and recover on purpose, a live HTTP dashboard, and real multi-node failover — a laboratory for "let it crash" as an engineering strategy, not a slogan.</blockquote>
        <p>Topics: <code>erlang</code>, <code>otp</code>, <code>gen-server</code>, <code>supervisor</code>, <code>fault-tolerance</code>, <code>distributed-systems</code>, <code>chaos-engineering</code>, <code>observability</code>, <code>property-based-testing</code>.</p>
        <h3>D3 · Performance considerations</h3>
        <ul>
          <li><strong>Processes are not the bottleneck at this scale.</strong> 2,000 supervised gen_servers, registered, in 13 milliseconds; the interesting costs live in the registry's ETS access patterns and the dashboard's per-request work, not in process count.</li>
          <li><strong>ETS's atomic counters remove a whole class of contention</strong> that a single counter-owning process would have introduced at real message volume.</li>
          <li><strong>Tracing is not free</strong>, and a wildcard match specification on a hot function can turn a diagnostic session into the incident it was meant to diagnose.</li>
          <li><strong><code>global</code> does not scale indefinitely</strong> — its own documentation says so, and the final challenge's solution inherits that limit honestly rather than hiding it.</li>
          <li><strong>Distribution has a real latency cost</strong> per message crossing a node boundary, the same shape of cost Go's Course 1 measured directly; this course did not repeat that specific benchmark, and doing so on your own two nodes is a reasonable extension.</li>
        </ul>
        <h3>D4 · Security considerations</h3>
        <ul>
          <li><strong>The distribution cookie is a shared secret, not a full authentication scheme.</strong> It authorises two nodes to trust each other; it does not encrypt traffic between them by default, and anyone who obtains it and can reach a node's distribution port can connect as a trusted peer.</li>
          <li><strong>A remote shell (<code>erl -remsh</code>) onto a live node can do anything to it</strong> — the same operational power that makes live tracing and <code>observer</code> so useful is a real attack surface if the distribution port is reachable by anyone who should not have it. Bind it to a private network or a VPN, never expose it publicly.</li>
          <li><strong>The dashboard has no authentication</strong> as built — every endpoint is open to anyone who can reach the port. Fine for a laboratory project on localhost; not fine unmodified in any shared environment.</li>
          <li><strong>An HTTP server built directly on <code>gen_tcp</code> gets none of a real framework's hardening for free</strong> — request size limits, malformed-header handling, slow-client protection beyond the one timeout this course added. Treat the hand-rolled server as a teaching tool, not a production HTTP stack.</li>
          <li><strong>Chaos injection is, structurally, a denial-of-service tool</strong> pointed at your own system on purpose. Never run <code>mesh_chaos</code> against anything you do not own and fully control.</li>
        </ul>
        <h3>D5 · What to put in your portfolio</h3>
        <p>Do not present this as "a chat simulation of network failures." Present it as what it is: <strong>a study of failure as a first-class, deliberately-exercised code path, ending in a real, multi-node distributed system with a documented, honest failure analysis.</strong> The narrative that makes it interesting is the escalation from hand-rolled to OTP-standard, twice.</p>
        <ol>
          <li>A hand-rolled process and a hand-rolled watcher, each working, each with a named, specific gap.</li>
          <li>The same two problems, solved by <code>gen_server</code> and <code>supervisor</code> — same external behaviour, the gaps closed, measured: exactly 3 restarts tolerated, the 4th one not.</li>
          <li>A registry at real scale (2,000 nodes, 13ms), with the stale-entry bug found and fixed honestly. </li>
          <li>Chaos injection absorbed silently by the supervision tree — the mesh's population recovers to full strength with no manual intervention, verified by counting live children, not by assuming.</li>
          <li>Real distribution: two separate BEAM instances, a real message crossing a real network boundary, with no code written specifically to make that possible.</li>
          <li>The final challenge's honest failure analysis, including what still is not solved.</li>
        </ol>
        <p>Keep a <code>docs/</code> folder with the restart-intensity transcript, the 2,000-node timing, and one architecture diagram. A reviewer who spends ninety seconds on your repository should come away knowing you tested failure on purpose and measured what it actually cost, not just that the happy path works. </p>
        <h3>D6 · Interview questions someone could ask, and what a good answer contains</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>Question</th>
              <th>What a strong answer includes</th>
            </tr>
            <tr>
              <td>Walk me through the supervision design.</td>
              <td>The tree shape, why <code>simple_one_for_one</code> fits a dynamic node pool where <code>one_for_one</code> fits the root, and the exact restart-intensity numbers, measured.</td>
            </tr>
            <tr>
              <td>Why not just catch every exception defensively?</td>
              <td>The "let it crash" argument, stated precisely — a caught, patched-around failure continues in an untested state; a crash-and-restart returns to a known-good one. And the honest boundary: genuine edges still need explicit error handling.</td>
            </tr>
            <tr>
              <td>Tell me about a bug you found.</td>
              <td>The registry's stale-entry leak from a missing cleanup path, or the process-dictionary id counter's hidden assumption of single-process use — how it was found, and the fix.</td>
            </tr>
            <tr>
              <td>How does this differ from how you'd do fault tolerance in Go?</td>
              <td>Structural process isolation versus disciplined <code>defer recover()</code>; an unrecovered panic takes the whole Go program down where an Erlang crash takes down exactly one process. Both real trade-offs, neither universally superior.</td>
            </tr>
            <tr>
              <td>What happens during a network partition?</td>
              <td>Both sides keep running, independently, each internally consistent; the danger is exclusively in reconciling state accumulated on both sides afterward, which this project's final challenge handles for pure ownership (via <code>global</code>) and explicitly does not solve for replicated state.</td>
            </tr>
            <tr>
              <td>How would you make this production-ready?</td>
              <td>Authentication on the dashboard and the distribution port, TLS between distributed nodes, request-size limits on the hand-rolled HTTP server, state checkpointing for real failover continuity, and replacing <code>global</code> with something proven at larger scale if the cluster ever needs to grow past a few hundred nodes.</td>
            </tr>
            <tr>
              <td>Exactly-once delivery: how, in this system?</td>
              <td>You cannot, structurally, the same as every other course in this curriculum that met the question — at-least-once plus an idempotent receiver is the honest answer, and this project does not currently implement it anywhere that would need it, which is worth saying plainly rather than implying it does.</td>
            </tr>
            <tr>
              <td>When would you not use Erlang for this?</td>
              <td>Anywhere CPU-bound numeric throughput on one core is the actual bottleneck — the BEAM is built for concurrency and soft real-time responsiveness, not for winning a tight numeric loop against a language that compiles closer to the metal. Name what Erlang wins on here specifically: isolation, supervision, and distribution built into the runtime rather than bolted on.</td>
            </tr>
            <tr>
              <td>What would you do differently?</td>
              <td>Build the deterministic chaos schedule (Part A4) from the start rather than discovering the seeded-but-not-fully-reproducible gap after the fact; design the metrics set before counters accumulated ad hoc; and decide the state-checkpointing story for failover before, not after, building the ownership-transfer mechanism.</td>
            </tr>
          </tbody>
        </table>
        <h3>D7 · Extensions worth building</h3>
        <ul>
          <li><strong>Real state replication for failover</strong>, closing the final challenge's most honest limitation — even a simple periodic checkpoint to the covering node would materially change what "takeover" means.</li>
          <li><strong>A proper web UI</strong> over the dashboard's JSON endpoints, rather than the minimal <code>EventSource</code> page from Milestone 10's exercise.</li>
          <li><strong><code>gen_statem</code> throughout</strong>, per Exercise C4.3 — genuinely worth doing for the whole node, not just as an exercise, once you have felt what explicit states catch.</li>
          <li><strong>A second, non-<code>global</code> failover mechanism</strong> at larger scale — Raft-based leader election is the standard next step, and building even a minimal version is one of the most educationally valuable extensions in this curriculum.</li>
          <li><strong>The deterministic chaos schedule from Part A4</strong>, fully wired through — replay a specific failing run byte-for-byte, the same guarantee Course 1's Go colony built for the same reason.</li>
        </ul>
        <hr />
        <h2><span className="num">Course 4 complete</span>What you built</h2>
        <p>An OTP application spanning a dozen modules, a supervision tree tested to its actual restart-intensity limit rather than assumed to work, a registry proven at 2,000 nodes with a real bug found and fixed, a seeded and reproducible chaos-injection framework, a dashboard serving a live system's own health over HTTP from inside it, a real multi-node distributed cluster, and a documented, honest failover design with its limitations stated rather than hidden. More importantly: the instinct to let something crash on purpose and trust the supervisor, rather than reaching first for a defensive catch.</p>
        <p>The central question of this curriculum was <em>what kinds of problems does this language make unusually natural to solve?</em> Erlang's answer, stated as precisely as this project allows: <strong>problems where the cost of one component failing must never become the cost of the whole system failing, where isolation is worth paying a copying and messaging overhead for, and where "this will be distributed eventually" is true often enough that the language should not treat distribution as a bolt-on afterthought.</strong> Not the fastest, not the simplest to learn in an afternoon, not the language you reach for when the whole problem is a tight numeric loop. The one where letting things break, on purpose, correctly, is how the system stays up.</p>
        <p>Courses so far have paired concurrency (Go, Erlang) against expressiveness and language design (Ruby, Racket), with Perl's text-forensics work sitting adjacent to both. Course 5 closes the curriculum with Racket, and the same comparison this course drew against Go's channels and Perl's parsing philosophy gets drawn one more time, from the opposite direction: instead of a language whose runtime <em>already</em> gives you the primitive you need (processes, supervision), Racket is a language built around the idea that if it does not give you the primitive you need, you can build it — as a real language of your own, checked, hygienic, and yours.</p>
        <footer className="end">
          <p>Instalment 20 of the five-course curriculum, and the end of Course 4. Next: Course 5, Racket, and the Language Factory. Parts 0–2 first (what we are building, installation and <code>raco</code>, the language crash course), then twelve milestones ending in real, working <code>#lang</code> implementations.</p>
        </footer>
         <Link className="button" href="/racket-course/instalment/">Next: Racket instalment</Link> 
      </div>
    </div>
  );
}
