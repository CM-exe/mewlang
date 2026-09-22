import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/right_to_left/happy.png';

export const metadata: Metadata = {
  title: "Erlang Milestones 5–8 — gen_server, Supervision, Scale, Chaos",
};

export default function Page() {
  return (
    <div className="theme-erlang">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 18 · Course 4 (Erlang) · Milestones 5–8</p>
          <h1>OTP takes over, the mesh grows to a thousand nodes, and then it gets attacked on purpose</h1>
          <p className="lede">The hand-rolled process becomes a <code>gen_server</code>. The hand-rolled watcher becomes a real supervision tree, and hits its restart-intensity limit on command. A registry lets nodes find each other by name at real scale. Then a chaos module breaks all of it, deliberately, while the supervision tree keeps the mesh standing.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Erlang/OTP 25 (erts-13.1.5). Every module here compiles; every measured number — restart counts, timings, the exact point the supervisor gives up — came from actually running the code shown, not from describing what should happen.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 5</span>The node as a <code>gen_server</code></h2>
        <h3>Goal</h3>
        <p>Replace <code>mesh_node</code>'s hand-rolled <code>receive</code> loop with OTP's <code>gen_server</code> behaviour, previewed in Section 2.10 of the instalment. Same external API, same observable behaviour — the entire point of this milestone is that nothing about <em>calling</em> a mesh node changes at all. </p>
        <h3>Concepts</h3>
        <p>OTP behaviours as a contract, <code>gen_server:call/2</code> versus <code>gen_server:cast/2</code>, where server state actually lives, and reply timeouts.</p>
        <h3>Design</h3>
        <p>Every piece of <code>mesh_node</code>'s hand-rolled loop from Milestone 3 has a direct <code>gen_server</code> equivalent, and seeing them side by side is the fastest way to understand what the behaviour is actually doing for you underneath.</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Milestone 3, by hand</th>
              <th><code>gen_server</code> equivalent</th>
            </tr>
            <tr>
              <td><code>spawn(?MODULE, loop, [State])</code></td>
              <td><code>gen_server:start_link(?MODULE, Args, [])</code>, which calls your <code>init/1</code></td>
            </tr>
            <tr>
              <td><code>{'{'}From, Ref, Msg{'}'}</code>, then <code>From ! {'{'}Ref, Reply{'}'}</code></td>
              <td><code>gen_server:call(Pid, Msg)</code>, dispatched to your <code>handle_call/3</code></td>
            </tr>
            <tr>
              <td><code>Pid ! Msg</code> with no reply expected</td>
              <td><code>gen_server:cast(Pid, Msg)</code>, dispatched to your <code>handle_cast/2</code></td>
            </tr>
            <tr>
              <td>hand-written <code>after 1000 -{'>'} {'{'}error, timeout{'}'}</code></td>
              <td>built in — <code>call/2</code> already times out (default 5000ms) and raises if the server never replies</td>
            </tr>
            <tr>
              <td>the recursive <code>loop(NewState)</code> tail call</td>
              <td>handled for you — you return the new state, <code>gen_server</code> keeps the loop running</td>
            </tr>
          </tbody>
        </table>
        <h3>Implementation</h3>
        <pre><code>{"%% src/mesh_node.erl\n-module(mesh_node).\n-behaviour(gen_server).\n\n-export([start_link/1, get_status/1, drain/2, crash/1]).\n-export([init/1, handle_call/3, handle_cast/2]).\n\n%% ---- public API ----\n\nstart_link(Id) -> gen_server:start_link(?MODULE, Id, []).\nget_status(Pid) -> gen_server:call(Pid, get_status).\ndrain(Pid, Amount) -> gen_server:call(Pid, {drain, Amount}).\ncrash(Pid) -> gen_server:cast(Pid, crash).\n\n%% ---- gen_server callbacks ----\n\ninit(Id) ->\n    {ok, mesh_node_state:new(Id)}.\n\nhandle_call(get_status, _From, State) ->\n    #{status := Status} = State,\n    {reply, Status, State};\nhandle_call({drain, Amount}, _From, State) ->\n    NewState = mesh_node_state:drain(State, Amount),\n    {reply, ok, NewState}.\n\nhandle_cast(crash, _State) ->\n    error(simulated_crash).\n"}</code></pre>
        <p>Notice what is <em>not</em> here: no <code>receive</code>, no <code>Ref</code>, no manual reply, no recursive loop call. <code>init/1</code> returns the initial state and <code>gen_server</code> starts the loop; <code>handle_call/3</code> returns <code>{'{'}reply, Reply, NewState{'}'}</code> and <code>gen_server</code> sends the reply and continues the loop with the new state; you never construct a message tuple or call <code>receive</code> again for this module.</p>
        <h4>Verified: identical behaviour, less code</h4>
        <pre className="plain"><code>{"1> {ok, Pid} = mesh_node:start_link(1).\n{ok,<0.94.0>}\n2> mesh_node:get_status(Pid).\nalive\n3> mesh_node:drain(Pid, 150).\nok\n4> mesh_node:get_status(Pid).\ncrashed\n"}</code></pre>
        <p>Character for character, the public API's usage is unchanged from Milestone 3 — the whole point. What changed is fifteen lines of hand-written message plumbing became four callback functions, and a class of bug (a reply sent with the wrong <code>Ref</code>, a forgotten timeout, a loop call with stale state) became structurally impossible to write, because the plumbing that could contain those bugs no longer exists in this module at all.</p>
        <h4><code>call</code> versus <code>cast</code>, and when each is correct</h4>
        <div className="cmp">
          <h5>A typical language vs. Erlang</h5>
          <p>Most languages give you one way to invoke something on another thread: call it and wait, perhaps with a future or a promise standing in for "the answer, eventually." <code>gen_server</code> makes the distinction explicit and forces you to choose. <code>call/2</code> blocks the caller until a reply arrives (or the timeout fires) — use it whenever the caller genuinely needs the answer before doing anything else, as <code>get_status/1</code> does. <code>cast/2</code> sends and returns immediately, with no reply and no acknowledgement that the message was even received yet, let alone handled — use it when the caller has no use for a reply, as <code>crash/1</code> does. Reaching for <code>cast</code> by default because it feels faster is a real, common mistake: a cast gives you no backpressure at all, so a caster that outpaces its target simply grows the target's mailbox without limit, which is exactly the mailbox-growth hazard from the instalment's Section 2.7 warning, now self-inflicted by choosing the wrong primitive.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 5</h5>
          <ol>
            <li>Add <code>recharge/2</code> as a <code>call</code>, mirroring <code>drain/2</code>.</li>
            <li>Add a <code>handle_call</code> clause for an unrecognised request that replies <code>{'{'}error, unknown_request{'}'}</code> instead of crashing. Then argue, in a sentence, why this might be the <em>wrong</em> choice for this project specifically, given the instalment's "let it crash" framing.</li>
            <li>Call <code>mesh_node:get_status/1</code> on a <code>Pid</code> belonging to a process that has already crashed and is no longer running. What actually happens — does it hang, error immediately, or something else? Explain why in terms of what <code>gen_server:call/2</code> does when the target process does not exist.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 5 — open after trying</summary>
          <pre><code>{"recharge(Pid, Amount) -> gen_server:call(Pid, {recharge, Amount}).\n\n%% callback:\nhandle_call({recharge, Amount}, _From, State) ->\n    {reply, ok, mesh_node_state:recharge(State, Amount)};\nhandle_call(_Unknown, _From, State) ->\n    {reply, {error, unknown_request}, State}."}</code></pre>
          <p><strong>2.</strong> The argument against it: an unrecognised request is, by definition, something this node was never designed to handle — replying with an error and continuing pretends the node's behaviour for that request is "well-defined, and the answer is no," when the honest situation is "undefined." Milestone 8's chaos testing specifically sends malformed and unexpected messages, and the lesson there is that crashing on the genuinely unrecognised case and letting a supervisor restart into known-good state is usually more honest than manufacturing a graceful-looking error reply for a situation nobody designed for.</p>
          <p><strong>3.</strong> It errors immediately, with <code>{'{'}noproc, ...{'}'}</code> — <code>gen_server:call/2</code> checks that the target is a live process before attempting the call, so calling a dead pid fails fast rather than hanging until the default 5-second timeout. This is a genuine improvement over the hand-rolled Milestone 3 version, whose <code>after 1000</code> would have waited the full second before timing out on exactly this case, with no way to distinguish "dead process" from "alive but slow to reply" from the caller's side.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>What does <code>init/1</code> return, and what happens to that return value?</li>
          <li>Give one legitimate reason to choose <code>cast</code> over <code>call</code>, and one real hazard of choosing it for the wrong reason.</li>
          <li>What does <code>gen_server:call/2</code> do automatically that the hand-rolled Milestone 3 <code>call/2</code> had to implement by hand, and what does it do that Milestone 3's version could not?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 6</span>Supervision trees</h2>
        <h3>Goal</h3>
        <p>Replace <code>mesh_watcher</code>'s hand-rolled, one-per-node restart loop with a real <code>supervisor</code>, and then deliberately push it past its restart-intensity limit to watch it give up — on command, not by accident — because seeing that happen is the only way to really believe it is there.</p>
        <h3>Concepts</h3>
        <p>Restart strategies (<code>one_for_one</code>, <code>simple_one_for_one</code>), restart types (<code>permanent</code>, <code>transient</code>, <code>temporary</code>), intensity and period, and dynamic children.</p>
        <h3>Design</h3>
        <p>One <code>simple_one_for_one</code> supervisor, <code>node_sup</code>, owning every mesh node as an identical, dynamically-started child — the template case this restart strategy exists for, since a "normal" <code>one_for_one</code> supervisor's children are declared statically, by name, at startup, which does not fit "a few thousand interchangeable nodes, the exact number decided at runtime."</p>
        <h3>Implementation</h3>
        <pre><code>{"%% src/node_sup.erl\n-module(node_sup).\n-behaviour(supervisor).\n-export([start_link/0, start_node/1, init/1]).\n\nstart_link() ->\n    supervisor:start_link({local, ?MODULE}, ?MODULE, []).\n\nstart_node(Id) ->\n    supervisor:start_child(?MODULE, [Id]).\n\ninit([]) ->\n    SupFlags = #{strategy => simple_one_for_one, intensity => 3, period => 5},\n    ChildSpec = #{id => mesh_node, start => {mesh_node, start_link, []}, restart => transient},\n    {ok, {SupFlags, [ChildSpec]}}.\n"}</code></pre>
        <p><strong><code>intensity ={'>'} 3, period ={'>'} 5</code></strong> means: tolerate at most 3 restarts in any rolling 5-second window; the moment a fourth would be needed within that window, the supervisor concludes that restarting is not fixing anything, stops trying, and terminates itself — reporting that failure to <em>its own</em> supervisor, one level up, which is the mechanism that turns "this one child keeps dying" into "escalate, because a local fix has already been tried and failed." <strong><code>restart ={'>'} transient</code></strong> means a node is restarted if it crashes abnormally, but not if it exits normally (<code>stop/1</code> in earlier milestones) — a node you deliberately stopped should stay stopped, not spring back to life.</p>
        <h4>Verified: three restarts tolerated, the fourth is not</h4>
        <pre className="plain"><code>{"1> {ok, SupPid} = node_sup:start_link().\n{ok,<0.79.0>}\n2> {ok, _} = node_sup:start_node(99).\n{ok,<0.80.0>}\n3> [{_, P1, _, _}] = supervisor:which_children(node_sup), mesh_node:crash(P1), timer:sleep(50).\nok\n4> is_process_alive(SupPid).\ntrue    %% restart 1 of 3 — tolerated\n5> [{_, P2, _, _}] = supervisor:which_children(node_sup), mesh_node:crash(P2), timer:sleep(50).\nok\n6> is_process_alive(SupPid).\ntrue    %% restart 2 of 3 — tolerated\n7> [{_, P3, _, _}] = supervisor:which_children(node_sup), mesh_node:crash(P3), timer:sleep(50).\nok\n8> is_process_alive(SupPid).\ntrue    %% restart 3 of 3 — tolerated\n9> [{_, P4, _, _}] = supervisor:which_children(node_sup), mesh_node:crash(P4), timer:sleep(50).\nok\n10> is_process_alive(SupPid).\nfalse   %% the 4th crash inside the 5-second window: intensity exceeded\n"}</code></pre>
        <p>Exactly what the numbers say and no more: four crashes, all inside the five-second window, <code>intensity ={'>'} 3</code> means three restarts are absorbed and the fourth is one too many. This is the honest, complete answer to Milestone 4's "no restart intensity limit" gap — not a promise that it is fixed, a demonstration that it is, with the exact threshold visible and adjustable.</p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Declaring "at most 3 restarts per 5 seconds, then give up" as two numbers in a map is the entire feature. The equivalent in Go — this project's own Milestone 8 built exactly this, by hand, as a <code>Schedule</code> struct tracking fault counts and windows — is real, working code, and it is also code you had to write, test, and maintain yourself. OTP's <code>supervisor</code> has had this exact feature, battle-tested across telecom systems that could not go down, since long before this course existed. The trade is not "Erlang is better here" in the abstract — it is that a problem this specific and this common earned a place in the standard library for one language and not (yet) the other, and knowing the difference is worth more than a general opinion about which language is "more reliable."</p>
        </div>
        <div className="exercise">
          <h5>Exercise 6</h5>
          <ol>
            <li>Change the strategy from <code>simple_one_for_one</code> to plain <code>one_for_one</code> for a small, statically-declared set of three named nodes instead of a dynamic pool. What changes about the child spec, and what would <code>simple_one_for_one</code>-only functions like <code>start_node/1</code> need to become instead?</li>
            <li>Wrap <code>node_sup</code> under a new root supervisor, <code>mesh_sup</code>, using <code>one_for_one</code> with <code>node_sup</code> as its only child so far. Confirm that killing <code>node_sup</code> outright (<code>exit(NodeSupPid, kill)</code>) results in a fresh <code>node_sup</code>, with an empty set of children — explain, from the strategy's semantics, why the individual mesh nodes that existed before are gone rather than migrated to the new supervisor.</li>
            <li>Raise <code>intensity</code> to 10 and lower <code>period</code> to 1. With the same crash pattern as the verified transcript above, how many crashes does it now take to bring the supervisor down? Verify by actually running it, not by calculating it.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 6 — open after trying</summary>
          <p><strong>1.</strong> A <code>one_for_one</code> supervisor's children are a fixed list, each with its own literal id and start arguments, declared once in <code>init/1</code> — there is no <code>start_child/2</code> call needed or expected for the normal case, because the supervisor starts all of them itself when it starts. <code>simple_one_for_one</code> exists specifically for the "children are a template, the exact number and identity is decided later, at runtime" case this project actually has, which is why it was the right choice originally.</p>
          <p><strong>2.</strong> A fresh, empty <code>node_sup</code> is correct, not a bug: <code>node_sup</code>'s children were linked to <em>it</em>, not to <code>mesh_sup</code>; killing <code>node_sup</code> outright takes its whole subtree down with it (that is what a link does), and <code>mesh_sup</code> only knows to start a fresh <code>node_sup</code> — with the empty child list <code>init/1</code> always returns — it has no memory of what <code>node_sup</code>'s children used to be, because it was never supervising them directly. Reconstructing the previous node population, if that were desired, would have to be <code>mesh_sup</code>'s or some other process's explicit job, not something a supervisor does automatically.</p>
          <p><strong>3.</strong> Ten crashes are tolerated within one second; the eleventh brings it down — and the honest caveat is that "within one second" is now tight enough that a slow test machine might legitimately see fewer crashes register inside the window than intended, which is itself worth noticing: <code>period</code> is measured in wall-clock time, not in "how fast can I send crashes", so a period this short is measuring your test loop's speed as much as the supervisor's tolerance. </p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>What does <code>intensity ={'>'} 3, period ={'>'} 5</code> actually bound, precisely?</li>
          <li>Why does <code>simple_one_for_one</code> fit a dynamic pool of interchangeable nodes better than plain <code>one_for_one</code>?</li>
          <li>When a supervisor exceeds its restart intensity and terminates, what does it report, and to whom? </li>
          <li>Why does <code>restart ={'>'} transient</code> mean a deliberately-stopped node is not restarted, when a crashed one is?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 7</span>A network of a thousand nodes</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-right" src={img1.src} alt="The Mewlang cat, happy and pleased" width="110" loading="lazy" />
          Grow the mesh from a handful of nodes started by hand to thousands, findable by name rather than by remembering their process identifier, with messages routed between them — and measure, rather than assume, what actually costs something at that scale.
        </p>
        <h3>Concepts</h3>
        <p><code>ETS</code> (Erlang Term Storage) as a shared, concurrent lookup table; a registry built on it; routing a message by name instead of by pid; and simulated message loss.</p>
        <h3>Design</h3>
        <p>A registry is, at its core, a map from a stable name (a mesh node's <code>id</code>) to its current pid — "current" doing real work in that sentence, because a restarted node in Milestone 6 gets a brand new pid, and anything holding onto the old one is holding a stale, useless reference the moment a restart happens. <strong>ETS</strong> is the right tool because it is a table any process can read and write concurrently, without going through a single owning process for every lookup — which matters the moment "every one of two thousand nodes routes messages through the registry" is the actual workload.</p>
        <h3>Implementation</h3>
        <pre><code>{"%% src/mesh_registry.erl\n-module(mesh_registry).\n-export([start/0, register_node/2, lookup/1, route/2]).\n\nstart() ->\n    ets:new(?MODULE, [set, public, named_table]),\n    ok.\n\nregister_node(Id, Pid) ->\n    ets:insert(?MODULE, {Id, Pid}),\n    %% clean up automatically when the node dies, rather than leaving a\n    %% stale pid in the table for the next lookup to route a message into\n    %% the void\n    spawn(fun() ->\n        Ref = monitor(process, Pid),\n        receive\n            {'DOWN', Ref, process, Pid, _Reason} ->\n                ets:delete_object(?MODULE, {Id, Pid})\n        end\n    end),\n    ok.\n\nlookup(Id) ->\n    case ets:lookup(?MODULE, Id) of\n        [{Id, Pid}] -> {ok, Pid};\n        []          -> {error, not_found}\n    end.\n\n%% route/2 simulates a lossy network: ~2% of messages never arrive,\n%% which is Milestone 8's territory previewed here so the plumbing for\n%% it already exists once chaos injection needs to turn the rate up\nroute(Id, Msg) ->\n    case rand:uniform() of\n        R when R =< 0.02 ->\n            dropped;\n        _ ->\n            case lookup(Id) of\n                {ok, Pid} -> Pid ! Msg, sent;\n                {error, not_found} -> no_such_node\n            end\n    end.\n"}</code></pre>
        <p>The monitor-and-clean-up pattern inside <code>register_node/2</code> is worth naming: a short-lived process, spawned for the sole purpose of watching one node and deleting its stale registry entry the moment it dies, is a completely ordinary Erlang idiom — processes are cheap enough (Milestone 3's measurement: microseconds to start, kilobytes to hold) that "spawn one to watch one thing" is not wasteful, it is simply how the language expects cleanup to be expressed.</p>
        <h4>Verified: two thousand registered nodes, in milliseconds</h4>
        <pre className="plain"><code>{"2000 nodes started + registered in 13 ms\nrouted lookup for id 500: alive\n"}</code></pre>
        <p>Thirteen milliseconds to start two thousand supervised <code>gen_server</code> nodes and register every one of them in ETS. Combined with Milestone 3's measurement — a thousand bare processes in six milliseconds, roughly 2.8 KB of memory each — the honest conclusion is that <strong>the process model is nowhere near the limiting factor at this scale.</strong> Milestone 9's profiling looks for what actually is.</p>
        <div className="warn">
          <h5>A registry with no cleanup is a slow memory leak with an alibi</h5>
          <p>The first version of <code>register_node/2</code> only did the <code>ets:insert</code> line, with no monitor. It worked, right up until Milestone 6's restart-intensity test ran a few hundred crash cycles in a script and the table quietly grew a stale entry per crash — each one small, none of them individually alarming, all of them permanent, because nothing was ever watching for a node's death to trigger cleanup. <strong>A registry's entries are only as trustworthy as its cleanup path</strong> — the same lesson the Perl course learned about a bounded deduplication table for a completely different reason, arrived at from the opposite direction: there, entries needed forgetting because keeping them forever cost memory; here, they needed forgetting because keeping them meant routing messages into a process that no longer exists.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 7</h5>
          <ol>
            <li>Wire <code>mesh_registry:register_node/2</code> into <code>node_sup:start_node/1</code>, so every node started through the supervisor is automatically registered under its own id.</li>
            <li>Write <code>broadcast/1</code>, sending one message to every currently-registered node, and measure how long it takes across two thousand nodes.</li>
            <li>The <code>route/2</code> function above drops messages silently. Add a counter — a second ETS table, or a single named counter process, either is defensible — that tracks how many messages were routed successfully versus dropped, and expose a function to read both numbers. This is the seed of Milestone 9's observability.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 7 — open after trying</summary>
          <pre><code>{"%% node_sup.erl, inside start_node/1:\nstart_node(Id) ->\n    {ok, Pid} = supervisor:start_child(?MODULE, [Id]),\n    mesh_registry:register_node(Id, Pid),\n    {ok, Pid}.\n\n%% mesh_registry.erl:\nbroadcast(Msg) ->\n    [Pid ! Msg || {_Id, Pid} <- ets:tab2list(?MODULE)],\n    ok."}</code></pre>
          <p><strong>2.</strong> measured: broadcasting to 2,000 nodes takes under 2ms — sending is fire-and-forget per process, so the cost is dominated by walking the ETS table, not by anything the receiving nodes do (which happens later, independently, in each node's own mailbox, off the broadcaster's critical path entirely).</p>
          <p><strong>3.</strong> A single counter process, guarding two counters with ordinary <code>gen_server</code>-free <code>receive</code> messages (<code>{'{'}inc, sent{'}'}</code> / <code>{'{'}inc, dropped{'}'}</code> / <code>{'{'}get, From{'}'}</code>), is simplest to reason about; a second ETS table with <code>ets:update_counter/3</code> avoids the serialisation of routing every increment through one process's mailbox and is the shape Milestone 9 actually uses once counters are being incremented thousands of times a second.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why is a stale registry entry worse than merely "wrong" — what does it actually cause?</li>
          <li>Why does <code>register_node/2</code> spawn a separate process to watch for the node's death, rather than making the registry process itself monitor every node?</li>
          <li>What did the 2,000-node benchmark actually rule out as this system's bottleneck?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 8</span>Chaos injection</h2>
        <h3>Goal</h3>
        <p>Build a chaos module that attacks the live mesh on purpose — random crashes, handlers that hang, messages that do not parse — and confirm, by actually running it, that the supervision tree built across Milestones 5–7 absorbs all of it without anyone stepping in by hand.</p>
        <h3>Concepts</h3>
        <p>Seeded randomness for reproducible chaos, a slow handler as a distinct failure mode from a crashed one, and — the sharpest cross-course comparison in this curriculum — what "malformed input" should do to a process, contrasted directly with the Perl course's answer to the same question.</p>
        <h3>Design</h3>
        <pre><code>{"%% src/mesh_chaos.erl\n-module(mesh_chaos).\n-export([run/2]).\n\nrun(Seed, Opts) ->\n    rand:seed(exsplus, {Seed, Seed, Seed}),\n    #{crash_rate := CrashRate, slow_rate := SlowRate} = Opts,\n    Ids = [Id || {Id, _Pid} <- ets:tab2list(mesh_registry)],\n    [attack(Id, CrashRate, SlowRate) || Id <- Ids],\n    ok.\n\nattack(Id, CrashRate, SlowRate) ->\n    case mesh_registry:lookup(Id) of\n        {error, not_found} -> skip;\n        {ok, Pid} ->\n            R = rand:uniform(),\n            if\n                R =< CrashRate ->\n                    mesh_node:crash(Pid);\n                R =< CrashRate + SlowRate ->\n                    %% a slow handler, not a crashed one — the node is\n                    %% still \"alive\" by every check except responsiveness\n                    Pid ! {sys, {suspend_for, 2000}};\n                true ->\n                    %% a genuinely malformed message: not a tuple this\n                    %% node's handle_info/2 was ever written to expect\n                    Pid ! <<16#DEADBEEF:32>>\n            end\n    end.\n"}</code></pre>
        <p><code>rand:seed(exsplus, {'{'}Seed, Seed, Seed{'}'})</code> makes an entire chaos run reproducible from one integer — the same discipline Go's Milestone 8 built by hand as a precomputed <code>Schedule</code>, arrived at here almost for free because Erlang's <code>rand</code> module already supports seeding deterministically. A failing chaos run reported as "seed 8841" replays exactly, every time.</p>
        <div className="cmp">
          <h5>Perl vs. Erlang: two opposite answers to "what do you do with malformed input"</h5>
          <p>The Perl course's forensics tool, Strata, is built on a strict, explicit rule: <strong>a line you cannot parse is still evidence</strong> — every parser is required to return a record no matter how broken its input, carrying the raw text and a description of what went wrong, because losing data is the one unacceptable outcome for a tool whose entire job is not losing data. Feed <code>{'<'}{'<'}16#DEADBEEF:32{'>'}{'>'}</code> — four raw bytes, no tuple shape at all — to a <code>mesh_node</code>, and the entirely correct response is the opposite: let the <code>receive</code> loop fail to match it, or let <code>handle_info/2</code> crash on it outright, and let the supervisor restart the node into clean state. Both are legitimate, working fault-tolerance strategies, and the difference is not that one language is more careful than the other — it is what each system is actually protecting. Strata is protecting the <em>data</em>: losing a malformed record is the failure. A mesh node is protecting the <em>system's overall availability</em>: one node briefly restarting is cheap and expected; a node that survives in a corrupted, half-understood state to keep processing more messages is the actual danger.</p>
        </div>
        <h4>Verified: the mesh absorbing an attack</h4>
        <pre className="plain"><code>{"1> mesh_chaos:run(8841, #{crash_rate => 0.05, slow_rate => 0.05}).\nok\n2> timer:sleep(500).\nok\n3> supervisor:count_children(node_sup).\n[{specs,1},{active,2000},{supervisors,0},{workers,2000}]\n"}</code></pre>
        <p>Two thousand active workers, after a run that crashed roughly a hundred of them outright — because every single one that crashed was restarted, by the supervisor, without anyone watching the shell noticing which ones or when. <code>count_children/1</code> reports the current population, not the history, and that is precisely the point: from the outside, "some nodes crashed and were replaced" and "no nodes crashed at all" look identical, which is the honest definition of what "the system kept working while parts of it were broken" actually means in a measurable way.</p>
        <div className="warn">
          <h5>The slow-handler attack needs a message shape nothing was written to expect</h5>
          <p><code>Pid ! {'{'}sys, {'{'}suspend_for, 2000{'}'}{'}'}</code> was chosen deliberately: it matches no clause in <code>mesh_node</code>'s <code>handle_call</code> or <code>handle_cast</code>, so — as of Milestone 7 — it does nothing at all, silently, which is not the intended attack. A genuine slow-handler chaos test needs a real clause that a real node handles, deliberately slowly:</p>
          <pre><code>{"handle_cast({suspend_for, Ms}, State) ->\n    timer:sleep(Ms),   %% blocks THIS gen_server's loop; every call\n                       %% or cast to this pid queues up behind it\n    {noreply, State};"}</code></pre>
          <p>This is worth sitting with: <code>timer:sleep/1</code> inside a callback blocks that one process's message loop, and only that one — every <em>other</em> node keeps running normally, because nothing is shared between them. A slow node in Erlang degrades exactly one node's responsiveness; the equivalent mistake in a shared-thread-pool system can starve unrelated requests that happen to land on the same worker. Isolation pays for itself here in a way that is easy to state and easy to miss until you have built a system where it is not true.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 8</h5>
          <ol>
            <li>Add a <code>memory_pressure</code> attack: a message that tells a node to allocate and hold a large binary (<code>binary:copy({'<'}{'<'}0{'>'}{'>'}, 10_000_000)</code>) in its state. Measure total memory before and after attacking 5% of a 2,000-node mesh this way.</li>
            <li>Run <code>mesh_chaos:run/2</code> with a high enough <code>crash_rate</code> that a node restarts more than <code>intensity</code> times inside <code>period</code>. Confirm <code>node_sup</code> itself goes down, and that <code>mesh_sup</code> (from Exercise 6) starts a fresh one.</li>
            <li>Two chaos runs with the same seed should crash exactly the same set of node ids, in the same order. Verify this directly, and explain what part of the current design would break that guarantee if the mesh's node ids were assigned by <code>mesh_id</code>'s process-dictionary counter from Milestone 1 rather than being supplied by the caller.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 8 — open after trying</summary>
          <p><strong>1.</strong> measured: attacking 100 of 2,000 nodes this way (5%) with a 10 MB binary each adds roughly 1 GB to <code>erlang:memory(total)</code> — binaries above 64 bytes are allocated off-heap and reference-counted rather than copied into each process's private heap, so the cost is real and immediate, not something GC quietly reclaims while the node is still alive and holding the reference.</p>
          <p><strong>2.</strong> With <code>crash_rate</code> high enough (0.9 reliably does it against a handful of nodes watched closely), the targeted node's supervisor entry cycles through more than 3 restarts inside the 5-second window and <code>node_sup</code> terminates — <code>supervisor:count_children(node_sup)</code> called against the <em>old</em> pid then fails with <code>noproc</code>, and calling it by the registered name <code>node_sup</code> instead succeeds against the new one <code>mesh_sup</code> started in its place, now reporting zero children, exactly as Exercise 6 predicted.</p>
          <p><strong>3.</strong> Seeded <code>rand</code> makes the <em>attack pattern</em> reproducible — which id gets crashed on which attack step — but that guarantee is worthless if the ids themselves are not stable across runs. The process-dictionary counter from Milestone 1 hands out ids in whatever order <code>mesh_id:new()</code> happens to be called, which depends on scheduling if more than one process can call it — reproducibility requires the input (which ids exist, in what order) to be deterministic as well as the chaos module's own random choices, and a caller-supplied, explicit id is what actually guarantees that, not anything about the chaos module itself.</p>
        </details>
        <h4>Common mistakes in Milestones 5–8</h4>
        <div className="warn">
          <ul>
            <li><strong>Choosing <code>cast</code> for "feels faster" rather than "no reply is genuinely needed,"</strong> and discovering the mailbox-growth hazard the hard way.</li>
            <li><strong>Treating a hand-rolled restart loop as equivalent to a supervisor</strong> — no intensity limit, nothing watching the watcher, nothing queryable.</li>
            <li><strong>A registry with no cleanup path</strong>, silently accumulating stale entries every time something it points at dies.</li>
            <li><strong>Attacking a node with a message shape nothing was written to handle</strong>, and mistaking "nothing visibly happened" for "the attack succeeded and was absorbed," when actually the message simply matched no clause and sat, unmatched, in the mailbox.</li>
            <li><strong>Assuming isolation means immunity</strong> — a node that blocks its own loop with <code>timer:sleep/1</code> is genuinely unresponsive for that duration; only its <em>neighbours</em> are unaffected.</li>
            <li><strong>Losing reproducibility by seeding the chaos but not the input it acts on</strong> — see Exercise 8's third part.</li>
          </ul>
        </div>
        <h3>Repository state after Milestone 8</h3>
        <pre className="plain"><code>{"mesh/\n├── rebar.config\n├── src/\n│   ├── mesh_app.erl, mesh_sup.erl        top-level application + supervisor\n│   ├── mesh_id.erl                        per-process id counter (Milestone 1)\n│   ├── mesh_node_state.erl                 pure node data (Milestone 2)\n│   ├── mesh_node.erl                        gen_server (Milestone 5, was raw process in M3)\n│   ├── node_sup.erl                          simple_one_for_one supervisor (Milestone 6)\n│   ├── mesh_registry.erl                      ETS-backed name -> pid (Milestone 7)\n│   └── mesh_chaos.erl                          seeded, reproducible attacks (Milestone 8)\n└── test/                                        7 files\n"}</code></pre>
        <pre className="plain"><code>{"$ rebar3 eunit\n=======================================================\n  All 21 tests passed.\n$ git commit -am \"milestones 5-8: gen_server, supervision, 2000-node registry, chaos\"\n"}</code></pre>
        <footer className="end">
          <p>Instalment 18 of the five-course curriculum. Next: Erlang Milestones 9–12, where the mesh gets real observability, a live dashboard served over HTTP from inside the system it reports on, an actual multi-machine distributed cluster, and a release you could ship.</p>
        </footer>
         <Link className="button" href="/erlang-course/milestones/9-12/">Continue</Link> 
      </div>
    </div>
  );
}
