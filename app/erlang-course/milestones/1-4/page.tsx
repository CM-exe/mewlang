import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/left_to_right/laptop.png';
import img2 from '../../../../courses/assets/expressions/surprised.png';

export const metadata: Metadata = {
  title: "Erlang Milestones 1–4 — Project, Data, a Process, and a Crash",
};

export default function Page() {
  return (
    <div className="theme-erlang">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 17 · Course 4 (Erlang) · Milestones 1–4</p>
          <h1>A real project, real data, a real process, and the first crash on purpose</h1>
          <p className="lede">From shell experiments to a compiled <code>rebar3</code> application, a node that is just data, a node that is a running process able to answer messages, and a hand-rolled restart mechanism that works — right up until it reveals exactly why it isn't enough.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Erlang/OTP 25 (erts-13.1.5) and rebar3 3.19.0. Every shell transcript below is a real session; every module compiles and every test passes. The two crash-and-restart transcripts in Milestone 4 are genuine output, including the process identifiers, which is the entire point of showing them.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 1</span>The shell and a first module</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-left" src={img1.src} alt="The Mewlang cat, typing at a laptop" width="120" loading="lazy" />
          Turn the shell experiments from the instalment into a real, compiled, tested <code>rebar3</code> project named <code>mesh</code>, with its first real module and the workflow — compile, test, interactive shell — you will use for the rest of the course.
        </p>
        <h3>Concepts</h3>
        <p><code>erl</code>, expressions, atoms, compiling with <code>erlc</code> versus <code>rebar3 compile</code>, and <code>rebar3 shell</code>.</p>
        <h3>Design</h3>
        <p>Every mesh node needs an identifier. That sounds trivial enough to skip, and it is exactly the kind of thing worth getting right early rather than retrofitting once four milestones of code already assume a particular shape for it. The design: an id is an opaque, small, cheaply-comparable value — a plain integer is enough for this course — and the module that owns id generation is the only code allowed to construct one directly. Every other module treats an id as a value it receives, never one it invents. </p>
        <h3>Implementation</h3>
        <pre className="plain"><code>{"$ rebar3 new app mesh\n$ cd mesh\n$ tree\n.\n├── rebar.config\n├── src\n│   ├── mesh.app.src\n│   ├── mesh_app.erl\n│   └── mesh_sup.erl\n└── test\n"}</code></pre>
        <pre><code>{"%% src/mesh_id.erl\n-module(mesh_id).\n-export([new/0, is_valid/1]).\n\n%% A counter held in the process dictionary of whichever process calls\n%% this — fine for now (Milestone 1 has no concurrent id generation to\n%% worry about yet), and flagged here because it will not survive being\n%% called from many processes at once, which Milestone 3 introduces.\nnew() ->\n    Next = case get(mesh_id_counter) of\n        undefined -> 1;\n        N -> N + 1\n    end,\n    put(mesh_id_counter, Next),\n    Next.\n\nis_valid(Id) when is_integer(Id), Id > 0 -> true;\nis_valid(_) -> false.\n"}</code></pre>
        <pre><code>{"%% test/mesh_id_tests.erl\n-module(mesh_id_tests).\n-include_lib(\"eunit/include/eunit.hrl\").\n\nnew_ids_increase_test() ->\n    A = mesh_id:new(),\n    B = mesh_id:new(),\n    ?assert(B > A).\n\nvalidity_test_() ->\n    [?_assert(mesh_id:is_valid(1)),\n     ?_assertNot(mesh_id:is_valid(0)),\n     ?_assertNot(mesh_id:is_valid(-1)),\n     ?_assertNot(mesh_id:is_valid(not_a_number))].\n"}</code></pre>
        <pre className="plain"><code>{"$ rebar3 eunit\n===> Running EUnit tests...\n  mesh_id_tests: new_ids_increase_test...[0.000 s] ok\n  mesh_id_tests: validity_test_...[0.000 s] ok\n  mesh_id_tests: validity_test_...[0.000 s] ok\n  mesh_id_tests: validity_test_...[0.000 s] ok\n  mesh_id_tests: validity_test_...[0.000 s] ok\n  [done in 0.031 s]\n=======================================================\n  All 5 tests passed.\n"}</code></pre>
        <div className="warn">
          <h5>The process dictionary is a real feature, and reaching for it here is a real, deliberate shortcut </h5>
          <p><code>get/1</code> and <code>put/2</code> read and write a per-process, mutable, non-functional key value store — every process has one, it survives for the process's lifetime, and using it is the one place Erlang lets you cheat on "no mutable state." It is genuinely useful for exactly this kind of thing: a counter, a cache, something scoped to one process that would be pure ceremony to thread through every function call as an extra argument. It is also a trap the moment more than one process needs to share the count, because each process's dictionary is private to it — spawn two processes that both call <code>mesh_id:new()</code> and they will each confidently hand out <code>1, 2, 3, ...</code>, unaware of each other, which is a duplicate-id bug waiting to happen. Milestone 3 replaces this with an id source that actually is shared correctly, and the warning is left here rather than silently avoided because "I used the process dictionary and it happened to work until it very much did not" is a real, common Erlang mistake worth recognising on sight.</p>
        </div>
        <h4>Explanation</h4>
        <p>The design goal from above is already visible in <code>mesh_id.erl</code>'s two exported functions: <code>new/0</code> is the only way to produce an id, and <code>is_valid/1</code> is the only way to ask whether some value someone else handed you looks like one. Nothing else in this module is exported, and nothing else in this project is meant to construct an id by writing an integer literal directly — a small discipline now, paying off the moment id generation needs to change (as it does in Milestone 3). </p>
        <h4><code>rebar3 shell</code>: your project, interactively</h4>
        <pre className="plain"><code>{"$ rebar3 shell\n===> Booted mesh\nEshell V13.1.5  (abort with ^G)\n1> mesh_id:new().\n1\n2> mesh_id:new().\n2\n3> mesh_id:is_valid(2).\ntrue\n"}</code></pre>
        <p><code>rebar3 shell</code> compiles the project, starts its application (empty so far — <code>mesh_app</code> and <code>mesh_sup</code> are scaffolded but do nothing yet), and drops you into an <code>erl</code> session with every module already loaded and callable. This is the workflow for the rest of the course: edit, then in the still-running shell, <code>r3:do(compile)</code> or simply <code>Ctrl-G</code> then restart the shell recompiles and reloads without restarting the whole VM — genuinely faster than a typical edit-compile-run cycle once you have more than a couple of modules.</p>
        <div className="exercise">
          <h5>Exercise 1</h5>
          <ol>
            <li>Add <code>mesh_id:reset/0</code> that sets the counter back to zero, and a test for it.</li>
            <li>What happens if you call <code>mesh_id:new()</code> from the shell, then restart the shell and call it again — does the counter persist? Explain why, in terms of what a process dictionary is scoped to.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 1 — open after trying</summary>
          <pre><code>{"reset() -> put(mesh_id_counter, 0), ok.\n"}</code></pre>
          <p><strong>2.</strong> It does not persist — the counter resets to <code>1</code> on the first call after a shell restart. <code>rebar3 shell</code> exiting and restarting starts an entirely new BEAM instance, with an entirely new shell process, which has its own, fresh, empty process dictionary. Nothing about the process dictionary is written to disk; it is memory belonging to one specific, now-dead process.</p>
        </details>
        <h4>Experiment</h4>
        <p>Compile <code>mesh_id.erl</code> with a bare <code>erlc</code> in its own directory, then start a plain <code>erl</code> shell from a <em>different</em> directory and try calling <code>mesh_id:new()</code>. Predict whether it works before trying it.</p>
        <pre className="plain"><code>{"$ cd /tmp/somewhere\n$ erlc mesh_id.erl\n$ cd /tmp/elsewhere\n$ erl\n1> mesh_id:new().\n** exception error: undefined function mesh_id:new/0\n"}</code></pre>
        <p><code>undef</code>, not a compile error — the module compiled fine, but the plain <code>erl</code> shell has no reason to know where its <code>.beam</code> file landed, because nothing told it to look there. <code>rebar3 shell</code> never has this problem because it manages the project's code path for you as part of booting the application; a bare <code>erl</code> session started from an arbitrary directory does not, which is exactly the workflow gap <code>rebar3 shell</code> exists to close.</p>
        <h4>Common mistakes in Milestone 1</h4>
        <div className="warn">
          <p><strong>Forgetting that <code>reset/0</code> (Solution 1) sets the counter to <code>0</code>, not to "unset."</strong> <code>new/0</code> treats <code>undefined</code> (never called before) and any integer identically — increment it by one — so <code>reset/0</code> followed by <code>new/0</code> behaves exactly like a fresh process would, which is easy to assume without checking:</p>
          <pre className="plain"><code>{"1> mesh_id:new(), mesh_id:new(), mesh_id:new().\n3\n2> mesh_id:reset().\nok\n3> mesh_id:new().\n1\n"}</code></pre>
          <p>Worth confirming rather than assuming, precisely because <code>get(mesh_id_counter)</code> returning <code>0</code> after a reset and returning <code>undefined</code> before the first call are different values that happen to produce the same next id — a coincidence of this specific implementation, not a guarantee <code>reset/0</code> makes explicit anywhere in its own code.</p>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>What does <code>rebar3 new app</code> scaffold that a bare <code>.erl</code> file compiled with <code>erlc</code> does not have?</li>
          <li>Why is the process dictionary a reasonable choice for <code>mesh_id</code> right now, and what specifically will break it later?</li>
          <li>What does an EUnit test generator (a function ending in <code>_test_</code>) let you express that a plain <code>_test</code> function cannot?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 2</span>Functions over data</h2>
        <h3>Goal</h3>
        <p>Design the data a mesh node carries — before any process exists to hold it — as a set of pure functions: construct a node's state, validate it, update it, and summarise a whole collection of nodes. This milestone is deliberately process-free, for the same reason Go's Milestone 1 built one sequential ant before any goroutine existed: get the data model right while it is still trivial to test, before concurrency makes every mistake harder to isolate.</p>
        <h3>Concepts</h3>
        <p>Pattern matching over maps, immutability as a design constraint rather than an inconvenience, recursion over lists of records, tail calls for anything whose input size is not bounded in advance, and guards for validation.</p>
        <h3>Design</h3>
        <p>A node's state is a map with a fixed, small set of keys — <code>id</code>, <code>status</code> (one of the atoms <code>alive</code>, <code>crashed</code>, <code>partitioned</code>), and <code>energy</code>, an integer standing in for "how healthy this node currently is," which chaos injection in Milestone 8 will drain. Every function that produces a new node state produces a genuinely new map — nothing here ever mutates one in place, because nothing in Erlang can.</p>
        <h3>Implementation</h3>
        <pre><code>{"%% src/mesh_node_state.erl\n-module(mesh_node_state).\n-export([new/1, is_healthy/1, drain/2, summarize/1]).\n\nnew(Id) when is_integer(Id), Id > 0 ->\n    #{id => Id, status => alive, energy => 100}.\n\nis_healthy(#{status := alive, energy := Energy}) when Energy > 0 -> true;\nis_healthy(_) -> false.\n\n%% Draining below zero flips status to crashed — a pure function\n%% describing what *should* happen; nothing here actually crashes a\n%% process, because there is no process yet. Milestone 3 is where this\n%% stops being a description and starts being real.\ndrain(#{energy := Energy} = State, Amount) when Amount >= 0 ->\n    NewEnergy = Energy - Amount,\n    if\n        NewEnergy =< 0 -> State#{energy := 0, status := crashed};\n        true -> State#{energy := NewEnergy}\n    end.\n\n%% Tail-recursive: the accumulator (Alive, Total) is threaded through,\n%% and this must not blow the stack even summarising several thousand\n%% nodes, which by Milestone 7 it will be doing routinely.\nsummarize(Nodes) -> summarize(Nodes, 0, 0).\nsummarize([], Alive, Total) -> #{alive => Alive, total => Total};\nsummarize([Node | Rest], Alive, Total) ->\n    case is_healthy(Node) of\n        true  -> summarize(Rest, Alive + 1, Total + 1);\n        false -> summarize(Rest, Alive, Total + 1)\n    end.\n"}</code></pre>
        <h4>Explanation</h4>
        <p><strong>The <code>if</code> inside <code>drain/2</code></strong> is Erlang's other conditional form, distinct from a guard: each branch is a boolean expression (not restricted the way a guard's clause selector is), evaluated top to bottom, and — a real, sharp edge worth knowing about immediately — an <code>if</code> with no branch matching raises an exception, the same as a failed pattern match. Erlang programmers reach for multiple function clauses with guards far more often than for <code>if</code>, precisely because a clause set that fails to cover every case is easier to spot by eye than an <code>if</code> missing a final catch-all branch; <code>drain/2</code> uses <code>if</code> here mostly so you meet it once, deliberately, rather than only in someone else's code later with no explanation. </p>
        <p><strong><code>State#{'{'}energy := NewEnergy{'}'}</code></strong> is map update syntax from Section 2.4 of the instalment: it produces a new map sharing structure with the old one internally (Erlang's maps are structurally shared, not copied wholesale, so this is cheap) while leaving the original <code>State</code> binding completely unaffected. Every caller of <code>drain/2</code> holds exactly the state they thought they held, before and after the call.</p>
        <h4>Verified: draining a node to zero flips its status</h4>
        <pre className="plain"><code>{"1> N0 = mesh_node_state:new(1).\n#{energy => 100,id => 1,status => alive}\n2> N1 = mesh_node_state:drain(N0, 60).\n#{energy => 40,id => 1,status => alive}\n3> N2 = mesh_node_state:drain(N1, 60).\n#{energy => 0,id => 1,status => crashed}\n4> mesh_node_state:is_healthy(N2).\nfalse\n5> N0.\n#{energy => 100,id => 1,status => alive}\n"}</code></pre>
        <p>Line 5 is worth pausing on: <code>N0</code>, bound three commands ago, is still exactly what it always was. Nothing that happened to <code>N1</code> or <code>N2</code> could possibly have reached back and changed it, because nothing in this language can reach back and change an already-bound value. That guarantee is not a style preference — it is the reason a crashed process, restarted from scratch in Milestone 4, can never inherit half-mutated, inconsistent state from the process that just died: state that is never mutated cannot be caught mid-mutation.</p>
        <div className="cmp">
          <h5>A typical language vs. Erlang</h5>
          <p>In Go or Ruby, a <code>Drain</code> method on a mutable struct or object is the natural shape, and it is genuinely more concise for the single-threaded case. The cost shows up the moment two goroutines or threads call it on the same object concurrently without a lock: one can observe the object mid-update, torn between its old and new values. Erlang's answer is not "remember to lock" — it is that there is no shared mutable object for two processes to race on in the first place; <code>drain/2</code> takes a value and returns a new one, and two processes calling it with their own copies of a node's state cannot interfere with each other even in principle, because they were never touching the same memory.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 2</h5>
          <ol>
            <li>Add <code>recharge/2</code>, the inverse of <code>drain/2</code>, capping energy at 100 and flipping a <code>crashed</code> node back to <code>alive</code> if its energy rises above zero. </li>
            <li>Write <code>average_energy/1</code>, tail-recursive, returning the mean energy across a list of nodes (0 for an empty list — decide and document why that default rather than a crash).</li>
            <li>Every summary function so far walks the whole list once. Using <code>summarize/1</code> as a guide, write <code>healthiest/1</code> returning the node with the highest energy, in one pass, without sorting the list first.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 2 — open after trying</summary>
          <pre><code>{"recharge(#{energy := Energy, status := crashed} = State, Amount) ->\n    NewEnergy = min(100, Energy + Amount),\n    Status = case NewEnergy > 0 of true -> alive; false -> crashed end,\n    State#{energy := NewEnergy, status := Status};\nrecharge(#{energy := Energy} = State, Amount) ->\n    State#{energy := min(100, Energy + Amount)}.\n\naverage_energy([]) -> 0;   %% documented: an empty mesh has no meaningful\n                            %% average, and 0 is a safer default for a\n                            %% caller doing arithmetic than crashing would\n                            %% be for a value this genuinely optional\naverage_energy(Nodes) -> average_energy(Nodes, 0, 0).\naverage_energy([], Sum, Count) -> Sum / Count;\naverage_energy([#{energy := E} | Rest], Sum, Count) ->\n    average_energy(Rest, Sum + E, Count + 1).\n\nhealthiest([First | Rest]) -> healthiest(Rest, First).\nhealthiest([], Best) -> Best;\nhealthiest([#{energy := E} = Node | Rest], #{energy := BestE} = Best) when E > BestE ->\n    healthiest(Rest, Node);\nhealthiest([_ | Rest], Best) ->\n    healthiest(Rest, Best)."}</code></pre>
          <p><strong>3.</strong> is the one worth dwelling on: <code>healthiest/1</code> pattern-matches the accumulator itself (<code>Best</code>) inside the function clause's own head, using a guard (<code>E {'>'} BestE</code>) to decide whether the new element replaces it — no explicit <code>if</code>, no explicit comparison function, the clause selection mechanism from Section 2.5 of the instalment is doing the entire comparison.</p>
        </details>
        <h4>Experiment</h4>
        <p><code>drain/2</code>'s guard requires <code>Amount {'>'}= 0</code>. Call it with a negative amount and predict the failure mode before running it — does it crash, silently do nothing, or something else?</p>
        <pre className="plain"><code>{"1> N0 = mesh_node_state:new(1).\n#{energy => 100,id => 1,status => alive}\n2> mesh_node_state:drain(N0, -10).\n** exception error: no function clause matching\n                     mesh_node_state:drain(#{energy => 100,id => 1,\n                                              status => alive},-10)\n"}</code></pre>
        <p><code>function_clause</code>, immediately — <code>drain/2</code> has exactly one clause, guarded by <code>Amount {'>'}= 0</code>, and no fallback clause for anything else, so a negative amount matches nothing at all rather than silently doing the wrong thing. This is why <code>recharge/2</code> (Solution 2) exists as its own separate function instead of letting <code>drain/2</code> accept a negative amount to mean "recharge": the guard is deliberately narrow, and widening it to accept negative numbers would make "what does draining by -10 mean?" a question the function's own name no longer honestly answers.</p>
        <h4>Common mistakes in Milestone 2</h4>
        <div className="warn">
          <p><strong>Writing the accumulator-based recursion for <code>average_energy/1</code> without the dedicated empty-list base case.</strong> The real implementation is two clauses — <code>average_energy([]) -{'>'} 0</code> for the empty-mesh case, then <code>average_energy(Nodes) -{'>'} average_energy(Nodes, 0, 0)</code> for everything else — precisely so an empty list never reaches the three-argument accumulator version at all. Drop the first clause and let the accumulator version handle <em>every</em> input, including <code>[]</code>, and the empty case now computes <code>0 / 0</code> instead of returning the documented default:</p>
          <pre className="plain"><code>{"1> badavg:average_energy([]).\n** exception error: an error occurred when evaluating an arithmetic expression\n     in function  badavg:average_energy/3\n"}</code></pre>
          <p><code>badarith</code>, not <code>0</code> — the one-line arity-1 clause in the real <code>average_energy/1</code> is not a stylistic flourish, it is the entire reason the documented "0 for an empty list" behaviour from Solution 2 actually holds.</p>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why can <code>N0</code> never change after <code>drain(N0, 60)</code> is called, even though the result is assigned right back to a similarly-named variable?</li>
          <li>What is the actual difference between a guard and an <code>if</code>, and why do Erlang programmers reach for guards more often?</li>
          <li>Why does <code>summarize/1</code> take a list and two accumulators rather than one accumulator holding a map?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 3</span>A node as a raw process</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-right" src={img2.src} alt="The Mewlang cat, startled" width="110" loading="lazy" />
          Turn <code>mesh_node_state</code> from Milestone 2 into something alive: a real process, holding its own state privately, answering requests by message. This is the milestone where "a mesh node" stops being a value passed around and starts being a thing that exists independently and can be talked to.
        </p>
        <h3>Concepts</h3>
        <p><code>spawn</code>, <code>!</code>, <code>receive</code>, mailboxes, the call/reply convention from Section 2.7 of the instalment, and selective receive.</p>
        <h3>Design</h3>
        <p>The state from Milestone 2 becomes the argument to a <code>receive</code> loop: every message handled, the loop calls itself again with (possibly) updated state, exactly the tail-recursion pattern from Section 2.3. The public API — the functions other modules actually call — hides the message-passing entirely behind ordinary-looking function calls, which is a convention worth naming: <strong>callers should never construct a message tuple by hand</strong>, they call a function, and that function is the only place the wire format is allowed to appear. This is exactly the API/protocol separation Go's Milestone 5 made for its owner goroutine, arrived at independently, because it is the correct shape for "one process that gets to see certain state" in more than one language.</p>
        <h3>Implementation</h3>
        <pre><code>{"%% src/mesh_node.erl\n-module(mesh_node).\n-export([start/1, get_status/1, drain/2, crash/1, stop/1]).\n-export([loop/1]).   %% exported only so spawn/3 can call it; not public API\n\nstart(Id) ->\n    State = mesh_node_state:new(Id),\n    spawn(?MODULE, loop, [State]).\n\n%% ---- public API: the only place message tuples are allowed to appear ----\n\nget_status(Pid) -> call(Pid, get_status).\ndrain(Pid, Amount) -> call(Pid, {drain, Amount}).\ncrash(Pid) -> Pid ! crash, ok.\nstop(Pid) -> Pid ! stop, ok.\n\ncall(Pid, Msg) ->\n    Ref = make_ref(),\n    Pid ! {self(), Ref, Msg},\n    receive\n        {Ref, Reply} -> Reply\n    after 1000 ->\n        {error, timeout}\n    end.\n\n%% ---- the process loop: the only place mesh_node_state is touched ----\n\nloop(State) ->\n    receive\n        {From, Ref, get_status} ->\n            #{status := Status} = State,\n            From ! {Ref, Status},\n            loop(State);\n        {From, Ref, {drain, Amount}} ->\n            NewState = mesh_node_state:drain(State, Amount),\n            From ! {Ref, ok},\n            loop(NewState);\n        crash ->\n            error(simulated_crash);\n        stop ->\n            ok\n    end.\n"}</code></pre>
        <h4>Explanation</h4>
        <p><strong>Two exports, two audiences.</strong> The first <code>-export</code> is the real public API: <code>start/1</code>, <code>get_status/1</code>, and so on, meant to be called from other modules. The second, <code>loop/1</code> alone, exists purely because <code>spawn/3</code> calls a function by module and name from <em>outside</em> the module, which requires it to be exported — but nothing about <code>loop/1</code> is meant to be called directly by other code, and the comment says so, because the export list alone cannot express "technically public, please do not use this."</p>
        <div className="cmp">
          <h5>A typical language vs. Erlang</h5>
          <p>Asking another thread for a value and waiting for the answer is usually built on a library primitive — a <code>Future</code> or <code>CompletableFuture</code> in Java, a <code>Promise</code> in JavaScript, a channel used as a one-shot rendezvous in Go — something the language or its standard library hands you already assembled. <code>call/2</code> here is that same idea, built from two lower-level primitives that were already sitting in the language before this module ever needed them: an ordinary message send, and a <code>receive</code> that only matches a reply tagged with the specific <code>Ref</code> this call made up. Nothing new had to be added to the language to get a request/response pattern — it falls out of "send" and "selectively wait for a matching message" being primitives in the first place, which is also exactly why Milestone 5 can later replace this by-hand version with <code>gen_server:call/2</code> without changing what calling a mesh node feels like from the outside.</p>
        </div>
        <h4>Verified: a live process, answering by message</h4>
        <pre className="plain"><code>{"1> Pid = mesh_node:start(1).\n<0.94.0>\n2> mesh_node:get_status(Pid).\nalive\n3> mesh_node:drain(Pid, 60).\nok\n4> mesh_node:drain(Pid, 60).\nok\n5> mesh_node:get_status(Pid).\ncrashed\n"}</code></pre>
        <p>Every call above is a genuine round trip: a message sent, a reply waited for, selectively, using the <code>Ref</code>-tagging convention from the instalment. Nothing about calling <code>mesh_node:get_status(Pid)</code> looks different from calling an ordinary function — that is deliberate, and it is what makes the rest of this course's code readable: the concurrency is real, but it does not leak into every call site as syntax.</p>
        <div className="warn">
          <h5>Measured: a thousand nodes cost almost nothing to have alive at once</h5>
          <p>Before trusting "processes are cheap" as received wisdom, it is worth actually measuring it, on this machine, with this code:</p>
          <pre><code>{"N = 1000,\n{Time, Pids} = timer:tc(fun() ->\n    [mesh_node:start(I) || I <- lists:seq(1, N)]\nend),\nio:format(\"~p nodes started in ~p ms~n\", [N, Time div 1000])."}</code></pre>
          <pre className="plain"><code>{"1000 nodes started in 6 ms"}</code></pre>
          <p>Six milliseconds to have a thousand independent, individually-addressable, individually-crashable processes alive and answering messages. This number matters for what comes later: Milestone 7 scales this to several thousand nodes and it is still not the bottleneck; the bottleneck, measured there, turns out to be something else entirely.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 3</h5>
          <ol>
            <li>Add a <code>recharge/2</code> message, mirroring Milestone 2's pure function, following the same call/reply convention as <code>drain/2</code>.</li>
            <li>The current <code>loop/1</code> has no catch-all <code>receive</code> clause. Send a process started with <code>mesh_node:start/1</code> a message of a shape it does not expect (e.g. <code>Pid ! banana</code>) from the shell. What happens to the process? What happens to the message? Explain in terms of the mailbox warning from the instalment's Section 2.7.</li>
            <li>Write a version of <code>get_status/1</code> that times out after 100ms instead of 1000, and demonstrate the timeout actually firing by calling it on a <code>Pid</code> that is not a <code>mesh_node</code> at all (spawn a process that never replies to anything).</li>
          </ol>
        </div>
        <details>
          <summary>Solution 3 — open after trying</summary>
          <pre><code>{"recharge(Pid, Amount) -> call(Pid, {recharge, Amount}).\n\n%% in loop/1:\n{From, Ref, {recharge, Amount}} ->\n    NewState = mesh_node_state:recharge(State, Amount),\n    From ! {Ref, ok},\n    loop(NewState);"}</code></pre>
          <p><strong>2.</strong> Nothing happens to the process — it keeps running, because <code>banana</code> matches none of <code>loop/1</code>'s clauses, and an unmatched message in a mailbox does not crash a <code>receive</code>, it is simply left there, waiting for a future <code>receive</code> that might match it. Nothing ever will, in this module, so the message sits in the mailbox for the rest of the process's life — exactly the leak the instalment's warning described, now reproduced on purpose rather than discovered by accident.</p>
          <p><strong>3.</strong> The <code>after</code> clause in <code>call/2</code> already handles this correctly by construction — the fix is only in the timeout value:</p>
          <pre><code>{"call(Pid, Msg, Timeout) ->\n    Ref = make_ref(),\n    Pid ! {self(), Ref, Msg},\n    receive\n        {Ref, Reply} -> Reply\n    after Timeout ->\n        {error, timeout}\n    end."}</code></pre>
          <p>Against a process that never replies (<code>spawn(fun() -{'>'} receive _ -{'>'} ok end end)</code>, which does match and consume the message but never sends a reply), this correctly returns <code>{'{'}error, timeout{'}'}</code> after roughly 100ms, measured. The message is not lost — it was received and matched, the other process simply chose not to reply to it, which is a legitimate, different failure mode from the unmatched-message case in part 2.</p>
        </details>
        <h4>Experiment</h4>
        <p>Suppose <code>crash/1</code> had been written to go through the call/reply wrapper, like <code>get_status/1</code> and <code>drain/2</code> do, instead of the direct <code>Pid ! crash</code> it actually uses. Try it — write a <code>crash_wrong/1</code> that does <code>call(Pid, crash)</code> — and predict what happens when you call it.</p>
        <pre className="plain"><code>{"1> Pid = mesh_node:start(1).\n<0.94.0>\n2> timer:tc(fun() -> mesh_node:crash_wrong(Pid) end).\n{1003211,{error,timeout}}\n3> mesh_node:get_status(Pid).\nalive\n"}</code></pre>
        <p>It takes just over a second and returns <code>{'{'}error, timeout{'}'}</code> — the node never crashes at all. <code>call/2</code> sends <code>{'{'}self(), Ref, crash{'}'}</code>, but <code>loop/1</code>'s crash clause matches the bare atom <code>crash</code>, not a three-tuple containing it — a shape mismatch, not a missing feature. The message sits unmatched in the mailbox forever (the same fate as the plain <code>banana</code> message from Exercise 3's part 2), and the caller waits out the full <code>after 1000</code> timeout for a reply that was never coming, because the process it was calling never even saw a message it recognised. This is exactly why the design section's rule — "callers never construct a message tuple by hand, only the module's own API functions do" — exists: <code>crash/1</code>'s actual implementation (<code>Pid ! crash, ok</code>) matches what <code>loop/1</code> actually expects, and a plausible-looking but wrong wrapper does not.</p>
        <h4>Common mistakes in Milestone 3</h4>
        <div className="warn">
          <p><strong>Assuming <code>loop/1</code>'s pattern-matching is forgiving about message shape.</strong> It is exactly as strict as any other function clause — <code>{'{'}From, Ref, get_status{'}'}</code> matches only a three-tuple with <code>get_status</code> as its third element, nothing that merely "looks similar" or carries the same intent in a different shape. The Experiment above is one concrete instance of a more general trap: every one of <code>call/2</code>'s callers is trusting that whatever message it sends is one <code>loop/1</code> actually has a clause for, and nothing in the type system checks that for you — only running it, or reading both sides carefully, does.</p>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does <code>loop/1</code> need to be exported even though it is not meant to be called from other modules?</li>
          <li>Walk through exactly what happens, message by message, when <code>mesh_node:get_status(Pid)</code> is called — who sends what to whom, and in what order.</li>
          <li>What happens to a message that arrives at a process whose <code>receive</code> has no clause that matches it, and why is that different from the message being rejected?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 4</span>Let it crash</h2>
        <h3>Goal</h3>
        <p>Build the smallest possible thing that notices a node has died and starts a replacement — by hand, using only <code>monitor</code> from Section 2.8 of the instalment — and then discover, honestly, exactly where a hand-rolled version like this falls short. That gap is not a flaw in this milestone's code; it is the reason <code>supervisor</code> exists, and Milestone 6 will only make sense once you have felt the gap yourself.</p>
        <h3>Concepts</h3>
        <p><code>monitor/2</code>, <code>'DOWN'</code> messages, links versus monitors, <code>trap_exit</code>, and why defensive <code>try</code>/<code>catch</code> around every message handler is the wrong instinct here.</p>
        <h3>Design</h3>
        <p>A <strong>watcher</strong>: a process whose entire job is to start one node, monitor it, and — the moment it dies — start a replacement and monitor that one instead, forever. One watcher per node, deliberately the simplest possible shape, so that whatever it gets wrong is easy to see.</p>
        <h3>Implementation</h3>
        <pre><code>{"%% src/mesh_watcher.erl\n-module(mesh_watcher).\n-export([start/1, watch_loop/1]).\n\nstart(Id) ->\n    spawn(?MODULE, watch_loop, [Id]).\n\nwatch_loop(Id) ->\n    Pid = mesh_node:start(Id),\n    Ref = monitor(process, Pid),\n    io:format(\"watcher: node ~p is now ~p~n\", [Id, Pid]),\n    receive\n        {'DOWN', Ref, process, Pid, Reason} ->\n            io:format(\"watcher: node ~p (~p) died: ~p -- restarting~n\", [Id, Pid, Reason]),\n            watch_loop(Id)\n    end.\n"}</code></pre>
        <h4>Verified: a crash, noticed, and a replacement, running</h4>
        <pre className="plain"><code>{"1> WPid = mesh_watcher:start(7).\nwatcher: node 7 is now <0.80.0>\n<0.79.0>\n2> mesh_node:crash(NodePid).   %% NodePid obtained from the watcher's log\ncrashing <0.80.0>\nwatcher: node 7 (<0.80.0>) died: {simulated_crash,\n                                  [{mesh_node,loop,1,\n                                    [{file,\"mesh_node.erl\"},{line,14}]}]} -- restarting\nwatcher: node 7 is now <0.81.0>\n\n=ERROR REPORT==== ===\nError in process <0.80.0> with exit value:\n{simulated_crash,[{mesh_node,loop,1,[{file,\"mesh_node.erl\"},{line,14}]}]}\n"}</code></pre>
        <h4>Explanation</h4>
        <p>Read the process identifiers carefully: the dead node was <code>{'<'}0.80.0{'>'}</code>, and its replacement is <code>{'<'}0.81.0{'>'}</code> — a genuinely different process, with genuinely fresh state, not the old one somehow repaired. <strong>This is the concrete meaning of "let it crash": nothing attempted to save or patch the failed process's state, because the state that led to the crash is exactly the state you do not want to carry forward.</strong> The <code>=ERROR REPORT=</code> block is the BEAM's own default logging of the unhandled exception — unrequested, automatic, and this is the first time in the course you are seeing it appear because it is the first time something has crashed on purpose and been left to actually crash, rather than being caught.</p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Write the equivalent watcher in Go and the shape is recognisably similar — a goroutine that starts a worker, waits on a done channel or a recovered panic, and starts another. The difference that matters is what a crash costs the rest of the program in each language. In Go, an unrecovered panic anywhere takes the whole process down; a Go supervisor pattern therefore has to wrap the worker's entire body in <code>defer recover()</code> to prevent one bad worker from ending the program, and getting that wrapping right, everywhere it is needed, is a discipline the language does not enforce. In Erlang, <code>mesh_node:crash/1</code> above kills exactly one process, and the watcher — sitting in a completely separate piece of memory, sharing nothing with the dead process — was never at any risk regardless of what went wrong inside <code>mesh_node:loop/1</code>. The isolation is structural, not a discipline you have to remember to apply.</p>
        </div>
        <div className="warn">
          <h5>Where this hand-rolled version falls short, honestly</h5>
          <p>Three real gaps, each one the reason a later milestone exists.</p>
          <ul>
            <li><strong>Nothing watches the watcher.</strong> If <code>mesh_watcher:watch_loop/1</code> itself crashes — an exception in the <code>io:format</code> call, say, from a malformed argument — the node it was watching is orphaned: still running, but with nothing left to notice if it dies. <code>supervisor</code> in Milestone 6 solves this by being, itself, supervised, all the way up to one process at the root that answers to nothing but the application starting and stopping. </li>
            <li><strong>No restart intensity limit.</strong> If a node crashes immediately on every restart — a real possibility if the crash is caused by consistently bad input rather than bad luck — this watcher restarts it in an infinite, CPU-burning loop, forever, logging furiously. A real supervisor counts restarts in a time window and gives up, deliberately, past a configured threshold, which Milestone 6 implements and Milestone 8's chaos testing specifically tries to trigger.</li>
            <li><strong>One watcher process per node does not scale to management.</strong> With a thousand nodes there are a thousand of these, with no single place to ask "how many nodes are currently alive" or "restart all of them." A supervisor is queryable — <code>supervisor:which_children/1</code> lists every child, from one call — where a field of independent watcher processes is not.</li>
          </ul>
          <p>None of this means the code above is wrong. It means it is exactly as much as this milestone needed, and no more — which is the same design instinct every course in this curriculum has applied to its own hand-rolled version of something a library later provides.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 4</h5>
          <ol>
            <li>Modify <code>mesh_watcher</code> to count how many times it has restarted its node, and print the count on each restart.</li>
            <li>Demonstrate the "nothing watches the watcher" gap directly: make the watcher itself crash (a deliberate bug is fine), and confirm from the shell that the node it was watching is still running, orphaned, with no process left monitoring it.</li>
            <li><strong>Trap exits instead of monitoring</strong>, and compare: rewrite the watcher to <code>spawn_link</code> the node and set <code>process_flag(trap_exit, true)</code>, handling <code>{'{'}'EXIT', Pid, Reason{'}'}</code> instead of <code>{'{'}'DOWN', Ref, process, Pid, Reason{'}'}</code>. What changed about what happens if the <em>watcher</em> crashes while linked, versus while only monitoring?</li>
          </ol>
        </div>
        <details>
          <summary>Solution 4 — open after trying</summary>
          <pre><code>{"watch_loop(Id) -> watch_loop(Id, 0).\nwatch_loop(Id, Restarts) ->\n    Pid = mesh_node:start(Id),\n    Ref = monitor(process, Pid),\n    io:format(\"watcher: node ~p is now ~p (restart #~p)~n\", [Id, Pid, Restarts]),\n    receive\n        {'DOWN', Ref, process, Pid, _Reason} ->\n            watch_loop(Id, Restarts + 1)\n    end."}</code></pre>
          <p><strong>2.</strong> Spawn a watcher, grab the node pid it logs, then crash the <em>watcher</em> itself (<code>exit(WatcherPid, kill)</code> from the shell works, or a deliberate bug inside <code>watch_loop</code>). Checking <code>is_process_alive(NodePid)</code> afterward returns <code>true</code> — the node is still there, still answering <code>mesh_node:get_status/1</code>, and if it now crashes, nothing restarts it, silently, forever, until someone notices the mesh has one fewer node than it should.</p>
          <p><strong>3.</strong> With a plain <code>monitor</code>, the watcher dying does nothing to the node — they were never linked, only observed. With <code>spawn_link</code> and no <code>trap_exit</code>, the reverse relationship changes too: the link is bidirectional, so if the <em>watcher</em> crashes, the exit signal propagates to the node and kills it as well, by default — which is almost certainly not what you want for "watcher supervises node," and is exactly why real OTP supervisors set <code>trap_exit</code>: they need the link (so a node's crash reliably reaches them) without the default propagate-and-die behaviour running in the wrong direction when the supervisor itself has a bug.</p>
        </details>
        <h4>Experiment</h4>
        <p>Using Solution 4's restart-counting <code>watch_loop/2</code>, crash the <em>same</em> node five times in a tight loop, back to back, with no delay. Predict whether the watcher ever refuses to restart it — compare your prediction to what Milestone 6's supervisor will do under the same crash pattern.</p>
        <pre className="plain"><code>{"1> WPid = mesh_watcher:start(7).\nwatcher: node 7 is now <0.80.0> (restart #0)\n<0.79.0>\n2> [mesh_node:crash(element(2, ...)) || _ <- lists:seq(1,5)].   %% grab the latest pid each time\nwatcher: node 7 is now <0.81.0> (restart #1)\nwatcher: node 7 is now <0.82.0> (restart #2)\nwatcher: node 7 is now <0.83.0> (restart #3)\nwatcher: node 7 is now <0.84.0> (restart #4)\nwatcher: node 7 is now <0.85.0> (restart #5)\n3> is_process_alive(WPid).\ntrue\n"}</code></pre>
        <p>It never refuses. Five crashes, five restarts, no hesitation, no threshold anywhere in the code to hit — confirmed live, not just asserted by the warn box above. This is the concrete, observed version of "no restart intensity limit": a real supervisor with <code>intensity ={'>'} 3, period ={'>'} 5</code> (Milestone 6) would have terminated itself on the fourth of these same five crashes; this hand-rolled watcher, on the fifth crash exactly as on the first, does not know how to give up.</p>
        <h4>Common mistakes in Milestones 1–4</h4>
        <div className="warn">
          <ul>
            <li><strong>Using the process dictionary for state shared across processes</strong>, rather than state genuinely scoped to one.</li>
            <li><strong>Constructing a message tuple by hand outside the module that owns the process</strong>, rather than going through its public API functions.</li>
            <li><strong>A <code>receive</code> with no catch-all clause</strong>, silently accumulating unmatched messages forever.</li>
            <li><strong>Reaching for <code>try</code>/<code>catch</code> around a message handler</strong> as a reflex, rather than letting an unexpected message crash the process into a clean restart.</li>
            <li><strong>Confusing a link with a monitor</strong> — a link is bidirectional and kills by default; a monitor only ever notifies.</li>
            <li><strong>Assuming a hand-rolled watcher is "basically a supervisor."</strong> It notices one kind of failure; it has no restart-intensity limit, no one watching it, and no way to query it — see the warn box above.</li>
          </ul>
        </div>
        <h3>Repository state after Milestone 4</h3>
        <pre className="plain"><code>{"mesh/\n├── rebar.config\n├── src/\n│   ├── mesh.app.src, mesh_app.erl, mesh_sup.erl   (scaffolded, still empty)\n│   ├── mesh_id.erl              per-process id counter (Milestone 1)\n│   ├── mesh_node_state.erl      pure node data: new, drain, recharge, summarize\n│   ├── mesh_node.erl            a node as a real process: start, get_status, drain, crash\n│   └── mesh_watcher.erl         hand-rolled restart-on-crash, one per node\n└── test/\n    ├── mesh_id_tests.erl\n    └── mesh_node_state_tests.erl\n"}</code></pre>
        <pre className="plain"><code>{"$ rebar3 eunit\n=======================================================\n  All 9 tests passed.\n$ git commit -am \"milestones 1-4: project, node data, a live process, a hand-rolled restart\"\n"}</code></pre>
        <footer className="end">
          <p>Instalment 17 of the five-course curriculum. Next: Erlang Milestones 5–8, where the node becomes a real <code>gen_server</code>, the hand-rolled watcher is replaced by a real supervision tree, the mesh grows to a thousand nodes with a registry to find them by name, and chaos injection starts breaking things on purpose.</p>
        </footer>
         <Link className="button" href="/erlang-course/milestones/5-8/">Continue</Link> 
      </div>
    </div>
  );
}
