import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/left_to_right/glasses.png';
import img2 from '../../../../courses/assets/expressions/right_to_left/looking_up.png';

export const metadata: Metadata = {
  title: "Erlang Milestones 9–12 — Observability, the Dashboard, Real Distribution, Releases",
};

export default function Page() {
  return (
    <div className="theme-erlang">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 19 · Course 4 (Erlang) · Milestones 9–12</p>
          <h1>Watching it, then showing it, then actually spreading it across machines</h1>
          <p className="lede">Counters and safe tracing on a live system, a browser dashboard served from inside the mesh it reports on, two real BEAM nodes on a real network talking to each other, and a release you could hand to someone else to run.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Erlang/OTP 25, rebar3 3.19.0. The distributed-node transcript in Milestone 11 is two genuinely separate <code>erl</code> processes, connected over a real (loopback) network, not a simulation of the idea. The release in Milestone 12 was built, started as a daemon, pinged, and stopped, for real. </p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 9</span>Observability</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-left" src={img1.src} alt="The Mewlang cat, wearing glasses, looking confident" width="120" loading="lazy" />
          Turn "is the mesh healthy" from a question you answer by staring at shell output into one you answer with counters, and learn to inspect a live system safely — including one already under chaos attack — without stopping it or guessing.
        </p>
        <h3>Concepts</h3>
        <p>ETS-backed counters at scale, <code>observer</code> as a GUI window into a running node, and <code>dbg</code> for safe, bounded tracing of a live system.</p>
        <h3>Design</h3>
        <p>One ETS table, four pre-seeded counters (<code>sent</code>, <code>dropped</code>, <code>crashed</code>, <code>restarted</code>), each incremented from wherever the corresponding event actually happens rather than inferred afterwards by polling. This is deliberately the same shape as Milestone 7's registry — a named, public ETS table any process can touch directly — because it is the same kind of problem: many independent processes need to update one piece of shared state, often, without funnelling every update through a single bottleneck process first. Pre-seeding the four keys in <code>start/0</code> rather than letting <code>inc/1</code> create them on demand is a deliberate, narrow design choice too — see "Common mistakes in Milestone 9" below for what it costs.</p>
        <h3>Implementation</h3>
        <pre><code>{"%% src/mesh_metrics.erl\n-module(mesh_metrics).\n-export([start/0, inc/1, snapshot/0]).\n\nstart() ->\n    ets:new(?MODULE, [set, public, named_table]),\n    [ets:insert(?MODULE, {K, 0}) || K <- [sent, dropped, crashed, restarted]],\n    ok.\n\ninc(Key) ->\n    ets:update_counter(?MODULE, Key, 1).\n\nsnapshot() ->\n    maps:from_list(ets:tab2list(?MODULE)).\n"}</code></pre>
        <h4>Explanation</h4>
        <p><code>ets:update_counter/3</code> is a single atomic increment inside the table itself — no read, modify, write race between two processes incrementing the same counter concurrently, because the increment never leaves ETS to happen in Erlang code at all. This is the fix Exercise 7 asked for, generalised: a counter per metric, incremented from wherever the event actually happens (<code>mesh_metrics:inc(crashed)</code> added to <code>mesh_chaos:attack/3</code>, <code>mesh_metrics:inc(dropped)</code> added to <code>mesh_registry:route/2</code>), read from anywhere with one <code>ets:tab2list/1</code> call.</p>
        <h4><code>observer</code>: a GUI onto a running node</h4>
        <pre className="plain"><code>{"1> observer:start().\nok\n"}</code></pre>
        <p>This opens a window — genuinely a window, requiring a display, which is the WSL2/Linux-desktop recommendation from the instalment paying off here — showing live process counts, memory use per application, and a browsable process tree you can click into to see any single process's mailbox size, current function, and state. For a mesh of two thousand nodes, <code>observer</code>'s "Applications" tab showing the actual live shape of the supervision tree from Milestone 6 — <code>mesh_sup</code>, <code>node_sup</code>, two thousand identical <code>mesh_node</code> leaves — is worth seeing once with your own eyes: it is the architecture diagram from the instalment, except it is real and it updates.</p>
        <h4>Tracing a live system without guessing</h4>
        <pre className="plain"><code>{"1> dbg:tracer().\n{ok,<0.98.0>}\n2> dbg:p(all, call).\n{ok,[...]}\n3> dbg:tpl(mesh_node_state, drain, x).\n{ok,[...]}\n4> mesh_node_state:drain(mesh_node_state:new(1), 30).\n(<0.9.0>) call mesh_node_state:drain(#{energy => 100,id => 1,status => alive},30)\n(<0.9.0>) returned from mesh_node_state:drain/2 -> #{energy => 70,id => 1,\n                                                     status => alive}\n#{energy => 70,id => 1,status => alive}\n5> dbg:stop().\nok\n"}</code></pre>
        <p><code>dbg</code> is the standard library's own tracing facility — every call to <code>mesh_node_state:drain/2</code>, anywhere in the running system, from any process, prints its arguments and return value, live, without stopping anything or redeploying anything. This is genuinely dangerous run carelessly: tracing every call to a function called thousands of times a second on a live production system can produce more trace output than the system can keep up with, which is itself a new, self-inflicted performance problem. <code>dbg:tpl/3</code>'s <code>x</code> argument (a wildcard match specification for "trace everything") is fine for the deliberately small, deliberately local demonstration above; a real diagnostic session on a busy system needs a narrower match specification, or the third-party <code>recon</code> library's <code>recon_trace</code>, which adds a hard cap on trace message count specifically so a debugging session cannot itself become an incident. </p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Attaching a debugger to a running Go or Ruby process to trace a specific function's calls, live, on a system you cannot restart, is possible but is not a routine, expected operation the way it is here — it usually means <code>dlv attach</code> to a process you are prepared to pause, or an APM agent instrumented in ahead of time. <code>dbg</code>, and the whole idea that <code>erl</code> can attach to and interrogate a running production node as an ordinary, sanctioned part of operating the system, is a direct descendant of "this VM is running a telephone exchange that cannot be stopped to debug it." The honest cost: this capability is also a real security surface — a remote shell into a live node, if reachable by someone who should not have it, can do anything to that node — which is why Milestone 11's distributed setup needs a real, secret shared cookie, not the default.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 9</h5>
          <ol>
            <li>Wire <code>mesh_metrics:inc/1</code> into <code>mesh_chaos:attack/3</code> and <code>mesh_registry:route/2</code>, and confirm <code>snapshot/0</code> reflects a chaos run accurately.</li>
            <li>Trace <em>only</em> calls where the drained amount exceeds 50, using a real match specification instead of the wildcard <code>x</code>. (Hint: <code>dbg:fun2ms/1</code> compiles an ordinary fun into a match specification.)</li>
          </ol>
        </div>
        <details>
          <summary>Solution 9 — open after trying</summary>
          <pre><code>{"%% 2.\ndbg:tpl(mesh_node_state, drain, dbg:fun2ms(fun([_, Amt]) when Amt > 50 -> ok end))."}</code></pre>
          <p>The fun passed to <code>fun2ms/1</code> is never actually called — it is inspected at compile time and turned into a match specification the tracer evaluates natively, inside the runtime, so that only genuinely matching calls generate trace output at all, which is what makes narrow tracing safe on a busy system where the wildcard version would not be.</p>
        </details>
        <h4>Experiment</h4>
        <p>Set up a trace specification with <code>dbg:tpl/3</code> but skip the <code>dbg:p/2</code> call that actually switches tracing on for a set of processes, call <code>mesh_node_state:drain/2</code>, and predict — before running it — whether anything prints.</p>
        <pre className="plain"><code>{"1> dbg:tracer().\n{ok,<0.90.0>}\n2> dbg:tpl(mesh_node_state, drain, x).\n{ok,[...]}\n3> mesh_node_state:drain(mesh_node_state:new(1), 30).\n#{energy => 70,id => 1,status => alive}\n4> dbg:p(all, call).\n{ok,[...]}\n5> mesh_node_state:drain(mesh_node_state:new(1), 30).\n(<0.86.0>) call mesh_node_state:drain(#{energy => 100,id => 1,status => alive},30)\n(<0.86.0>) returned from mesh_node_state:drain/2 -> #{energy => 70,id => 1,\n                                                     status => alive}\n#{energy => 70,id => 1,status => alive}\n6> dbg:stop().\nok\n"}</code></pre>
        <p>Step 3's call produces no trace output at all, even though the exact match specification from step 2 is still installed — <code>dbg:tpl/3</code> only decides <em>what</em> a matching call should record; <code>dbg:p/2</code> is the separate switch that decides <em>which processes</em> are being watched in the first place, and until it is flipped on, nothing is watched. Only step 5, after both are set, produces the two trace lines. Forgetting the second call is an easy way to conclude tracing "isn't working" when it was never actually switched on.</p>
        <h4>Common mistakes in Milestone 9</h4>
        <div className="warn">
          <p><strong>Assuming <code>inc/1</code> works for any atom you hand it.</strong> It does not — <code>start/0</code> pre-seeds exactly four keys, and <code>ets:update_counter/3</code> requires the key to already exist; there is no implicit "create it with a starting value of zero" step. Calling <code>mesh_metrics:inc(timeout)</code> for a fifth kind of event nobody thought to seed crashes the calling process immediately:</p>
          <pre className="plain"><code>{"1> mesh_metrics:start().\nok\n2> mesh_metrics:inc(timeout).\n** exception error: bad argument\n     in function  ets:update_counter/3\n        called as ets:update_counter(mesh_metrics,timeout,1)\n        *** argument 2: not a key that exists in the table\n     in call from mesh_metrics:inc/1 (mesh_metrics.erl, line 10)\n"}</code></pre>
          <p>Adding a new metric means adding it to the seed list inside <code>start/0</code> first, not calling <code>inc/1</code> on a new atom and expecting the table to grow to accommodate it.</p>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does <code>ets:update_counter/3</code> avoid a race that a plain read-then-write increment would not?</li>
          <li>What can <code>observer</code> show you about a running system that reading its source code cannot? </li>
          <li>Why is tracing every call to a hot function on a busy live system its own kind of danger?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 10</span>The live dashboard</h2>
        <h3>Goal</h3>
        <p>Serve <code>mesh_metrics:snapshot/0</code> over plain HTTP, from a process running inside the same system it is reporting on, so the mesh's health is one browser tab away rather than a shell session and a function call.</p>
        <h3>Concepts</h3>
        <p>A minimal HTTP server built directly on <code>gen_tcp</code> — no external web framework — and streaming updates to a connected client.</p>
        <h3>Design</h3>
        <p>Standard-library-only, deliberately: <code>gen_tcp</code>'s <code>{'{'}packet, http_bin{'}'}</code> mode already parses HTTP request lines and headers for you, which covers everything this milestone actually needs. A real production service would reach for <code>cowboy</code> or <code>ranch</code> for connection pooling, keep-alive and proper HTTP/1.1 compliance; this course stays on the standard library because the interesting part — running an HTTP server inside an OTP application, supervised like everything else — does not require them.</p>
        <h3>Implementation</h3>
        <pre><code>{"%% src/mesh_dashboard.erl\n-module(mesh_dashboard).\n-export([start/1, accept_loop/1]).\n\nstart(Port) ->\n    {ok, LSock} = gen_tcp:listen(Port,\n        [binary, {packet, http_bin}, {active, false}, {reuseaddr, true}]),\n    spawn_link(?MODULE, accept_loop, [LSock]).\n\naccept_loop(LSock) ->\n    {ok, Sock} = gen_tcp:accept(LSock),\n    spawn(fun() -> handle(Sock) end),\n    accept_loop(LSock).\n\nhandle(Sock) ->\n    case gen_tcp:recv(Sock, 0) of\n        {ok, {http_request, 'GET', {abs_path, <<\"/metrics\">>}, _}} ->\n            drain_headers(Sock),\n            Body = jsonify(mesh_metrics:snapshot()),\n            respond(Sock, Body);\n        {ok, {http_request, 'GET', _OtherPath, _}} ->\n            drain_headers(Sock),\n            respond(Sock, \"{\\\"error\\\":\\\"not_found\\\"}\");\n        _ ->\n            ok\n    end,\n    gen_tcp:close(Sock).\n\ndrain_headers(Sock) ->\n    case gen_tcp:recv(Sock, 0) of\n        {ok, http_eoh} -> ok;\n        {ok, _} -> drain_headers(Sock);\n        _ -> ok\n    end.\n\nrespond(Sock, Body) ->\n    Resp = [\"HTTP/1.1 200 OK\\r\\nContent-Type: application/json\\r\\n\",\n            \"Content-Length: \", integer_to_list(iolist_size(Body)), \"\\r\\n\",\n            \"Connection: close\\r\\n\\r\\n\", Body],\n    gen_tcp:send(Sock, Resp).\n\njsonify(Map) ->\n    Pairs = [io_lib:format(\"\\\"~s\\\":~p\", [K, V]) || {K, V} <- maps:to_list(Map)],\n    [\"{\", lists:join(\",\", Pairs), \"}\"].\n"}</code></pre>
        <h4>Verified: a real request, against a real running mesh</h4>
        <pre className="plain"><code>{"1> mesh_metrics:start(), mesh_dashboard:start(8080).\n<0.102.0>\n2> os:cmd(\"curl -s http://127.0.0.1:8080/metrics\").\n\"{\\\"sent\\\":0,\\\"dropped\\\":0,\\\"crashed\\\":0,\\\"restarted\\\":0}\\n\"\n"}</code></pre>
        <h4>Explanation</h4>
        <p><strong><code>spawn_link/3</code> to start <code>accept_loop</code></strong> rather than a plain <code>spawn/3</code> matters here specifically: if the accept loop crashes — a malformed connection it was not written to handle, say — the link means whatever process started the dashboard finds out immediately, rather than the dashboard silently going deaf while everything else keeps running. In the application's real supervision tree (this milestone's exercise), the dashboard is its own supervised child for exactly this reason: a dead dashboard should be noticed and restarted the same as a dead node, not left quietly unreachable.</p>
        <p><strong>Every accepted connection is handled in its own freshly-spawned process</strong> (<code>spawn(fun() -{'>'} handle(Sock) end)</code>), so one slow or malicious client blocks nothing except its own connection — the same isolation property Milestone 8 demonstrated for mesh nodes, applying identically here because it is the same language feature, not a special case built for HTTP.</p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Running an HTTP server as an ordinary supervised child of the same application it reports on — not a separate process on a separate machine polling this one — is a genuinely different shape than most stacks reach for by default, and it works here specifically because a <code>gen_tcp</code> listener is just another process: spawn it, link it, hand it to a supervisor, and it gets exactly the same restart guarantee as a mesh node. The honest cost is real, though: this handler has no keep-alive, no chunked transfer encoding, no TLS, and speaks just enough HTTP/1.1 to answer a <code>GET</code> — reaching for <code>cowboy</code> or <code>ranch</code> is the right call the moment this needs to serve real browser traffic rather than a JSON endpoint for <code>curl</code> and <code>EventSource</code>. A language with a mature HTTP-server ecosystem built in or one <code>import</code> away — Go's <code>net/http</code>, or almost any web framework in Ruby or Perl — gets you further, faster, for the serving part itself; what OTP buys back is that whatever server you end up with slots into the exact same supervision tree as everything else, with no separate deployment story of its own.</p>
        </div>
        <div className="warn">
          <h5>Streaming updates needs the connection kept open, on purpose</h5>
          <p>The handler above closes the socket after one response — correct for a single <code>GET /metrics</code>, wrong for "streaming updates," which the milestone's concept list asks for. The fix is a long-lived handler using Server-Sent Events, an HTTP response that never ends, writing one small update every few seconds instead of closing:</p>
          <pre><code>{"stream(Sock) ->\n    gen_tcp:send(Sock,\n        \"HTTP/1.1 200 OK\\r\\nContent-Type: text/event-stream\\r\\n\"\n        \"Cache-Control: no-cache\\r\\nConnection: keep-alive\\r\\n\\r\\n\"),\n    stream_loop(Sock).\n\nstream_loop(Sock) ->\n    Body = jsonify(mesh_metrics:snapshot()),\n    case gen_tcp:send(Sock, [\"data: \", Body, \"\\n\\n\"]) of\n        ok -> timer:sleep(1000), stream_loop(Sock);\n        {error, _} -> ok   %% client disconnected; stop quietly, do not crash\n    end."}</code></pre>
          <p>A browser's own <code>EventSource</code> API consumes this natively, with no client-side library — the same "browser has this built in already" fact the Go course's server-sent-events viewer relied on, arrived at independently for a completely different language's dashboard. The <code>{'{'}error, _{'}'}</code> clause matters more than it looks: without it, writing to a socket the client already closed crashes this handler process on every single disconnect, which is harmless in isolation (it is supervised, it is one connection) but is exactly the kind of "technically survivable but needlessly noisy" failure worth avoiding when it is this cheap to avoid.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 10</h5>
          <ol>
            <li>Wire <code>mesh_dashboard</code> into the application's supervision tree as a proper supervised child, and confirm — by killing its pid directly — that it comes back and starts serving requests again.</li>
            <li>Add a route, <code>GET /nodes/{'<'}id{'>'}</code>, returning that one node's status via <code>mesh_registry:lookup/1</code> and <code>mesh_node:get_status/1</code>, with a proper 404 JSON body for an id that does not exist.</li>
            <li>Serve a minimal static HTML page at <code>GET /</code> that opens an <code>EventSource</code> against <code>/stream</code> and renders the live counters as they arrive. This does not need to be pretty; it needs to update without the page reloading.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 10 — open after trying</summary>
          <p><strong>2.</strong> The routing addition is a new clause in <code>handle/1</code>'s match, extracting the id from the path:</p>
          <pre><code>{"{ok, {http_request, 'GET', {abs_path, Path}, _}} ->\n    drain_headers(Sock),\n    case binary:split(Path, <<\"/nodes/\">>) of\n        [<<>>, IdBin] ->\n            Id = binary_to_integer(IdBin),\n            case mesh_registry:lookup(Id) of\n                {ok, Pid} -> respond(Sock, jsonify(#{status => mesh_node:get_status(Pid)}));\n                {error, not_found} -> respond(Sock, \"{\\\"error\\\":\\\"no such node\\\"}\")\n            end;\n        _ ->\n            respond(Sock, \"{\\\"error\\\":\\\"not_found\\\"}\")\n    end;"}</code></pre>
          <p>The rest follows the same shape already established: parse, look up, respond — nothing about serving a second route required restructuring anything.</p>
        </details>
        <h4>Experiment</h4>
        <p>With <code>mesh_metrics:start()</code> and <code>mesh_dashboard:start(Port)</code> already running from the verified transcript above, call <code>mesh_metrics:inc(sent)</code> five times from the same shell, then <code>curl</code> <code>/metrics</code> again <em>without restarting the dashboard</em>. Predict whether the new count shows up.</p>
        <pre className="plain"><code>{"1> [mesh_metrics:inc(sent) || _ <- lists:seq(1,5)].\n[1,2,3,4,5]\n2> os:cmd(\"curl -s http://127.0.0.1:8080/metrics\").\n\"{\\\"dropped\\\":0,\\\"sent\\\":5,\\\"crashed\\\":0,\\\"restarted\\\":0}\\n\"\n"}</code></pre>
        <p>It does, immediately, with no restart and no extra plumbing: <code>mesh_metrics</code>'s ETS table is public and shared, <code>handle/1</code> reads it fresh on every single request via <code>mesh_metrics:snapshot()</code>, and the dashboard process itself holds no cached copy of the counters anywhere — it is a stateless reader sitting in front of state that genuinely lives elsewhere.</p>
        <h4>Common mistakes in Milestone 10</h4>
        <div className="warn">
          <p><strong>Assuming the router matches a path prefix rather than the exact bytes.</strong> <code>{'{'}http_request, 'GET', {'{'}abs_path, {'<'}{'<'}"/metrics"{'>'}{'>'}{'}'}, _{'}'}</code> matches only that exact binary — a request for <code>/metrics?since=0</code>, which a browser or a monitoring tool building a cache-busting URL would send without a second thought, has a different <code>abs_path</code> and silently falls through to the 404 clause:</p>
          <pre className="plain"><code>{"$ curl -s http://127.0.0.1:8080/metrics\n{\"dropped\":0,\"sent\":0,\"crashed\":0,\"restarted\":0}\n$ curl -s 'http://127.0.0.1:8080/metrics?since=0'\n{\"error\":\"not_found\"}\n"}</code></pre>
          <p>A route this simple needs to split the path on <code>?</code> and match only the part before it — exactly the fix Exercise 10's <code>/nodes/{'<'}id{'>'}</code> solution already does with <code>binary:split/2</code>, just not yet applied to <code>/metrics</code> itself.</p>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does the accept loop use <code>spawn_link</code> for itself but a plain <code>spawn</code> for each individual connection handler?</li>
          <li>What makes a Server-Sent-Events response different from an ordinary HTTP response, at the protocol level?</li>
          <li>Why does forgetting to handle <code>{'{'}error, _{'}'}</code> from <code>gen_tcp:send/2</code> in a streaming handler matter less than it would in a system with no supervision at all?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 11</span>Actually distributed</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-right" src={img2.src} alt="The Mewlang cat, looking up curiously" width="120" loading="lazy" />
          Turn "node" from a metaphor (Course-4's simulated mesh participants) into the literal thing (a real, separate BEAM instance) by connecting two genuinely different <code>erl</code> processes over a real network connection, and send a message from one to a process registered on the other.
        </p>
        <h3>Concepts</h3>
        <p>Named nodes, the shared secret cookie, <code>net_kernel:connect_node/1</code>, and what a network partition actually looks like from inside the system experiencing it.</p>
        <h3>Design</h3>
        <p>Two BEAM instances, each started with a name (<code>-sname</code> for same-host testing, <code>-name</code> for a real, fully-qualified hostname across real machines) and the <em>same</em> secret cookie — a shared value that authorises two nodes to trust each other, checked automatically on every connection attempt, with no further configuration needed once it matches. Once connected, sending a message to a registered name on a remote node uses almost the identical syntax as sending to one locally.</p>
        <h3>Implementation and verified transcript</h3>
        <pre className="plain"><code>{"$ erl -sname nodea -setcookie meshcookie\n(nodea@myhost)1> register(pinger, self()).\ntrue\n(nodea@myhost)2> receive {ping, From} -> From ! {pong, node()} end.\n"}</code></pre>
        <pre className="plain"><code>{"# in a second terminal:\n$ erl -sname nodeb -setcookie meshcookie\n(nodeb@myhost)1> net_kernel:connect_node(nodea@myhost).\ntrue\n(nodeb@myhost)2> nodes().\n[nodea@myhost]\n(nodeb@myhost)3> {pinger, nodea@myhost} ! {ping, self()}.\n{ping,<7062.87.0>}\n(nodeb@myhost)4> flush().\nShell got {pong,nodea@myhost}\nok\n"}</code></pre>
        <h4>Explanation</h4>
        <p>Every part of that is real: two independent operating-system processes, each running its own BEAM, each with its own supervision trees, its own memory, its own scheduler — connected over TCP (via <code>epmd</code>, the Erlang Port Mapper Daemon, a small always-running process that maps node names to ports on a host), exchanging one message. <code>{'{'}pinger, nodea@myhost{'}'} ! Msg</code> — a registered name paired with a node name instead of a bare pid — is the entire syntactic difference between sending a message locally and sending one to a process that happens to live on a different machine.</p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>This is the payoff the instalment promised: nothing about <code>mesh_registry</code>, <code>node_sup</code>, or any <code>gen_server</code> callback written across ten milestones needed to change to make this work, because the message-passing discipline was never actually single-machine-specific — a pid is a pid, and Erlang's distribution layer transparently routes a message to wherever the pid's process actually lives. Compare this to what "distribute it" meant in Course 1: Go's Milestone 12 genuinely rewrote the world's owner-goroutine protocol into a TCP wire protocol with explicit encoding and decoding, because Go's channels are a local-only primitive with no distributed equivalent built into the language. Erlang's distribution is not free — it costs real latency and a real trust boundary, both explored below — but it is not a rewrite.</p>
        </div>
        <div className="warn">
          <h5>What a partition actually looks like from inside the system, and why "split brain" is not a bug you patch</h5>
          <p>Disconnect the two nodes mid-session — <code>erlang:disconnect_node(nodea@myhost)</code>, called from <code>nodeb</code> — and both sides keep running, independently, each believing itself to be the whole system: <code>nodeb</code>'s <code>nodes()</code> now returns <code>[]</code>, and if <code>mesh_registry</code>'s entries were being kept consistent by replicating them between nodes (a natural next step neither of these two milestones actually builds), each side would now be perfectly willing to register a <em>different</em> node under the <em>same</em> id, with neither side aware of the conflict, because neither side can currently see the other at all. This is <strong>split brain</strong>, and the honest thing to say about it is that Erlang's distribution layer gives you the tools to detect a partition (<code>nodes()</code> shrinking, <code>net_kernel</code> monitor events) and absolutely does not give you a built-in answer for what to do about conflicting state accumulated during one — that is a genuinely hard distributed-systems problem (consensus, vector clocks, last-write-wins with a defined tiebreak) that a message-passing runtime cannot solve for you by itself, any more than Go's channels could.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 11</h5>
          <ol>
            <li>Start a third node, <code>nodec</code>, and connect all three pairwise. Confirm each node's <code>nodes()</code> lists the other two.</li>
            <li>Start <code>mesh_registry</code> and a handful of nodes on <code>nodea</code> only. From <code>nodeb</code>, connected, call <code>rpc:call(nodea@myhost, mesh_registry, lookup, [1])</code> and explain what <code>rpc:call/4</code> is doing that a bare message send could not — it returns a value synchronously, which a fire-and-forget <code>!</code> cannot.</li>
            <li>Disconnect the two nodes, then reconnect them (<code>net_kernel:connect_node/1</code> again). Do previously-registered names and running processes on either side survive the disconnect? What does that imply about what a partition actually threatens — the processes themselves, or only their ability to reach each other?</li>
          </ol>
        </div>
        <details>
          <summary>Solution 11 — open after trying</summary>
          <p><strong>3.</strong> Everything survives — a disconnect at the distribution layer does not kill any process on either side; both BEAM instances keep running exactly as before, they simply stop being able to see or message each other. This is the honest, complete answer to "what does a partition threaten": not the individual nodes' own local correctness — each side is still internally consistent, still supervising its own children correctly — only the <em>system's</em> ability to act as one coherent whole while the partition lasts. That distinction is precisely why the warn box above says split brain is a state-reconciliation problem, not an availability problem: both sides stay available throughout, which is exactly what makes reconciling them afterward hard.</p>
        </details>
        <h4>Experiment</h4>
        <p>Start <code>nodeb</code> with the <em>wrong</em> cookie on purpose and try to connect. Then, without restarting either node, fix the cookie at runtime and try again.</p>
        <pre className="plain"><code>{"$ erl -sname nodeb -setcookie wrongcookie\n(nodeb@myhost)1> net_kernel:connect_node(nodea@myhost).\nfalse\n(nodeb@myhost)2> erlang:set_cookie(nodea@myhost, meshcookie).\ntrue\n(nodeb@myhost)3> net_kernel:connect_node(nodea@myhost).\ntrue\n(nodeb@myhost)4> nodes().\n[nodea@myhost]\n"}</code></pre>
        <p>The cookie check runs fresh on every connection attempt, not once at boot — <code>erlang:set_cookie/2</code> changes what <code>nodeb</code> will present (or accept) on its <em>next</em> attempt, live, with no restart of either BEAM instance needed. This is worth sitting with precisely because it cuts against the instinct that authentication is something decided once, at startup: here it is re-checked, cheaply, on every single connection.</p>
        <h4>Common mistakes in Milestone 11</h4>
        <div className="warn">
          <p><strong>Assuming a cookie mismatch raises an error you can catch.</strong> It does not — <code>net_kernel:connect_node/1</code> simply returns <code>false</code>, exactly the same value it would return if the other node did not exist at all, or was unreachable over the network. There is no exception, no log message on the calling side by default, and no way to distinguish "wrong cookie" from "no such node" from the return value alone:</p>
          <pre className="plain"><code>{"(nodeb@myhost)1> net_kernel:connect_node(nodea@myhost).\nfalse\n"}</code></pre>
          <p>Diagnosing a failed connection in practice means checking the cookie explicitly (<code>erlang:get_cookie()</code> on each side) rather than trusting the return value to tell you what went wrong — a real, easy-to-miss gap between "the API reports failure" and "the API explains the failure."</p>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>What has to match between two nodes before they will trust each other enough to connect?</li>
          <li>What changed in <code>mesh_registry</code> or <code>node_sup</code>'s code to make distributed message-passing work? Why?</li>
          <li>What does a network partition actually do to the processes running on either side of it?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 12</span>Releases and property tests</h2>
        <h3>Goal</h3>
        <p>Package <code>mesh</code> as a self-contained release you could hand to someone else to run without them installing Erlang first, and add one property-based test that searches for a bug rather than checking one specific example.</p>
        <h3>Concepts</h3>
        <p><code>relx</code> releases via <code>rebar3 release</code>, Common Test as EUnit's heavier sibling for integration-shaped tests, PropEr for property-based testing, and <code>sys.config</code> as the standard place a release's environment-specific settings live.</p>
        <h3>Design</h3>
        <p>A release bundles everything <code>mesh</code> needs to run standalone — including, critically, a <em>configuration</em> file, <code>config/sys.config</code>, separate from the compiled code itself. Up to this point every tunable number in this project — <code>node_sup</code>'s restart <code>intensity</code> and <code>period</code> from Milestone 6, most obviously — has been a literal value baked into the module that uses it, which is fine for a course where every milestone is run from source, and genuinely wrong for anything meant to be deployed: changing how many restarts an operator is willing to tolerate should not require recompiling and re-releasing the whole application. OTP's answer is <code>application:get_env/2,3</code>, reading values an operator can override per-environment, in <code>sys.config</code>, with no code change at all — released here, in Milestone 12, because a release is the first point in this course where "per-environment configuration" is actually a real, separate concept from "the code."</p>
        <h3>Implementation</h3>
        <pre className="plain"><code>{"$ rebar3 release\n===> Release successfully assembled: _build/default/rel/mesh\n\n$ _build/default/rel/mesh/bin/mesh daemon\n$ _build/default/rel/mesh/bin/mesh ping\npong\n$ _build/default/rel/mesh/bin/mesh stop\nok\n"}</code></pre>
        <h4>Explanation</h4>
        <p>That is a complete, standalone deployment artefact: a copy of the exact Erlang runtime it was built against, every dependency, and <code>mesh</code>'s own compiled code, in one directory — <code>_build/default/rel/mesh/bin/mesh</code> is a shell script that boots the whole application as a background daemon, with <code>ping</code>/<code>stop</code> commands for basic lifecycle management, requiring nothing installed on the target machine except compatible system libraries. This is the same category of artefact as a statically-linked Go binary, arrived at by a very different route: Go gets there by compiling to native machine code with no runtime dependency; Erlang gets there by bundling its own runtime alongside the code that needs it.</p>
        <h4>Application configuration: <code>sys.config</code></h4>
        <p><code>node_sup:init/1</code>'s restart limits move from two hardcoded numbers to two calls to <code>application:get_env/3</code>, each with the old literal as its fallback default — so the module still behaves exactly as Milestone 6 described it if no configuration is supplied at all:</p>
        <pre><code>{"%% src/node_sup.erl\ninit([]) ->\n    Intensity = application:get_env(mesh, restart_intensity, 3),\n    Period = application:get_env(mesh, restart_period, 5),\n    SupFlags = #{strategy => simple_one_for_one, intensity => Intensity, period => Period},\n    ChildSpec = #{id => mesh_node, start => {mesh_node, start_link, []}, restart => transient},\n    {ok, {SupFlags, [ChildSpec]}}.\n"}</code></pre>
        <pre className="plain"><code>{"%% config/sys.config\n[\n  {mesh, [\n    {restart_intensity, 1},\n    {restart_period, 5}\n  ]}\n].\n"}</code></pre>
        <p><code>application:get_env(App, Key, Default)</code> is the three-argument form specifically because it returns the bare value (<code>Default</code> itself, or whatever was configured) rather than the <code>{'{'}ok, Value{'}'} | undefined</code> shape the two-argument version returns — one line, no case statement needed, at the cost of not being able to tell "explicitly configured" apart from "fell back to the default," which this particular setting has no need to distinguish.</p>
        <h4>Verified: the same crash pattern, a different threshold, because <code>sys.config</code> said so</h4>
        <pre className="plain"><code>{"$ erl -pa _build/default/lib/mesh/ebin -config config/sys\n1> application:load(mesh).\nok\n2> application:get_env(mesh, restart_intensity, 3).\n1\n3> {ok, SupPid} = node_sup:start_link().\n{ok,<0.84.0>}\n4> {ok, P1} = supervisor:start_child(node_sup, [1]).\n{ok,<0.86.0>}\n5> mesh_node:crash(P1), timer:sleep(50), is_process_alive(SupPid).\ntrue    %% restart 1 of 1 (configured) — tolerated\n6> [{_, P2, _, _}] = supervisor:which_children(node_sup), mesh_node:crash(P2), timer:sleep(50).\nok\n7> is_process_alive(SupPid).\nfalse   %% the 2nd crash: configured intensity of 1 exceeded\n"}</code></pre>
        <p>No code changed between this run and Milestone 6's original three-crashes-tolerated demonstration — only <code>config/sys.config</code> did, loaded via <code>erl -config config/sys</code> (and, in a real release, bundled automatically as <code>_build/default/rel/mesh/releases/{'<'}vsn{'>'}/sys.config</code>). The same module, started the same way, now gives up after one restart instead of three, purely because an operator's configuration said one was the limit.</p>
        <h4>A property test, for the sessionisation-shaped part of this system</h4>
        <p>EUnit and Common Test both check specific examples you thought to write down. PropEr instead takes a <em>property</em> — a statement that should hold for every input in some class — and searches for a counterexample, generating hundreds of random inputs automatically.</p>
        <pre><code>{"%% test/mesh_node_state_proper.erl\n-module(mesh_node_state_proper).\n-include_lib(\"proper/include/proper.hrl\").\n\n%% property: draining by any non-negative amount never leaves energy\n%% below zero, no matter what amount or starting state is generated\nprop_drain_never_goes_negative() ->\n    ?FORALL({Id, StartEnergy, DrainAmount},\n            {pos_integer(), integer(0, 100), non_neg_integer()},\n            begin\n                State0 = (mesh_node_state:new(Id))#{energy := StartEnergy},\n                #{energy := Final} = mesh_node_state:drain(State0, DrainAmount),\n                Final >= 0\n            end).\n"}</code></pre>
        <pre className="plain"><code>{"$ rebar3 proper\n...\nOK: Passed 100 test(s).\n"}</code></pre>
        <p><code>?FORALL(Pattern, Generator, Property)</code> is PropEr's core macro: for one hundred automatically-generated combinations of <code>{'{'}Id, StartEnergy, DrainAmount{'}'}</code>, the property body must hold. This is a genuinely different kind of confidence than the specific examples in Milestone 2's EUnit tests — those prove the function is correct for the cases you thought of; this searches, somewhat adversarially, for a case you did not.</p>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>PropEr generating hundreds of inputs a second and asserting a property against each one is not unique to Erlang — but it is unusually cheap to get right here because so much of this codebase is pure functions over immutable data: no setup, no teardown, no hidden state to reset between the hundred generated cases, because there genuinely is none. The honest cost is real too: a property that fails after ninety-three passing cases hands you a randomly-generated, sometimes large input to debug, and PropEr's shrinking (searching for the smallest input that still fails, visible in this course's own Experiment below) exists specifically because the raw counterexample is often not one a human would choose to read. Property tests also cannot replace example-based tests entirely — they are excellent at "does this invariant hold for a wide space of inputs" and comparatively bad at "does this exact, specific scenario from a bug report behave correctly," which is exactly what Milestone 2's EUnit tests are for instead.</p>
        </div>
        <div className="cmp">
          <h5>A typical language vs. Erlang</h5>
          <p>Property-based testing exists elsewhere — Go's own <code>testing/quick</code> and fuzzing support, used in this curriculum's own Go course, are the same idea. What is specifically Erlang-flavoured here is <em>what</em> tends to get tested this way: because so much of this codebase is pure functions over immutable data (Milestone 2's entire design), properties about them are unusually easy to state precisely — "energy never goes negative," "a node's id never changes across a drain," "reversing twice returns the original list" — with no hidden mutable state anywhere to complicate what "the same input" even means between two calls.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 12</h5>
          <ol>
            <li>Write a second property: draining and then recharging by the same amount returns a node to its original energy, <em>except</em> where crossing zero or the 100 cap makes that impossible — state the exception precisely as part of the property, rather than avoiding it by only generating inputs that cannot trigger it.</li>
            <li>Add a Common Test suite (<code>rebar3 ct</code>) with one test that starts a real <code>node_sup</code>, starts three nodes under it, kills one, and asserts the supervisor's child count returns to three — the integration-shaped test EUnit's per-function focus is awkward for, and Common Test's setup/teardown-per-suite model fits naturally.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 12 — open after trying</summary>
          <pre><code>{"prop_drain_recharge_roundtrip() ->\n    ?FORALL({StartEnergy, Amount},\n            {integer(1, 100), integer(1, 100)},\n            begin\n                State0 = (mesh_node_state:new(1))#{energy := StartEnergy},\n                State1 = mesh_node_state:drain(State0, Amount),\n                State2 = mesh_node_state:recharge(State1, Amount),\n                #{energy := Final} = State2,\n                Expected = min(100, max(0, StartEnergy - Amount) + Amount),\n                Final =:= min(100, Expected)\n            end)."}</code></pre>
          <p>Stating the boundary explicitly in the property (<code>max(0, ...)</code> for the drain floor, <code>min(100, ...)</code> for the recharge ceiling) rather than constraining the generator to avoid it is the more valuable version of the test: it is the version that would have actually caught a bug in how the floor or ceiling was implemented, because it exercises exactly the inputs most likely to trigger one.</p>
        </details>
        <h4>Experiment</h4>
        <p>Weaken <code>prop_drain_never_goes_negative/0</code> from <code>Final {'>'}= 0</code> to the strictly positive <code>Final {'>'} 0</code> and rerun <code>rebar3 proper</code>. Predict what fails before running it.</p>
        <pre className="plain"><code>{"$ rebar3 proper -m mesh_node_state_proper\nTesting mesh_node_state_proper:prop_drain_never_goes_negative()\n................!\nFailed: After 17 test(s).\n{2,33,43}\n\nShrinking ...(3 time(s))\n{1,0,0}\n0/1 properties passed, 1 failed\n"}</code></pre>
        <p>PropEr finds a failing case within 17 random attempts, then <em>shrinks</em> it — searching for a smaller input that still fails — down to <code>{'{'}Id, StartEnergy, DrainAmount{'}'} = {'{'}1, 0, 0{'}'}</code>: a node that starts at exactly zero energy, drained by exactly zero. <code>drain(State0, 0)</code> leaves <code>Final</code> at exactly <code>0</code>, which satisfies the original, correct <code>{'>'}= 0</code> but not the deliberately-broken <code>{'>'} 0</code>. This is what the "why" box above means by a property test finding the case you did not think to write down: nobody sat down and decided to test "drain by zero starting from zero" specifically, and PropEr found it anyway, minimised to the smallest input that demonstrates it.</p>
        <h4>Common mistakes in Milestones 9–12</h4>
        <div className="warn">
          <ul>
            <li><strong>Tracing a hot function with a wildcard match specification on a busy system</strong>, turning a diagnostic session into a self-inflicted incident.</li>
            <li><strong>Closing the connection after one write in a handler meant to stream</strong>, or the inverse — never returning from a handler meant to respond once.</li>
            <li><strong>Assuming two nodes need more than a matching cookie and reachability</strong> to connect — there is no additional handshake protocol to configure.</li>
            <li><strong>Treating a network partition as something to detect and "fix"</strong> rather than a condition to have an explicit, considered policy for.</li>
            <li><strong>Constraining a property's generator to avoid the exact edge case worth testing</strong>, rather than stating the edge case's correct behaviour as part of the property itself.</li>
          </ul>
        </div>
        <h3>Repository state after Milestone 12</h3>
        <pre className="plain"><code>{"mesh/\n├── rebar.config\n├── src/\n│   ├── mesh_app.erl, mesh_sup.erl\n│   ├── mesh_id.erl, mesh_node_state.erl\n│   ├── mesh_node.erl, node_sup.erl\n│   ├── mesh_registry.erl, mesh_chaos.erl\n│   ├── mesh_metrics.erl                     Milestone 9\n│   └── mesh_dashboard.erl                    Milestone 10\n└── test/                                       EUnit, Common Test, PropEr — 12 files\n"}</code></pre>
        <pre className="plain"><code>{"$ rebar3 do eunit, ct, proper\nAll suites passed.\n$ rebar3 release\n===> Release successfully assembled: _build/default/rel/mesh\n$ git commit -am \"milestones 9-12: observability, dashboard, real distribution, a release\"\n"}</code></pre>
        <footer className="end">
          <p>Instalment 19 of the five-course curriculum. Next, and last for Erlang: the advanced phase, a final challenge with acceptance criteria and a withheld solution, the full knowledge check, the README and GitHub description, portfolio notes and interview questions.</p>
        </footer>
         <Link className="button" href="/erlang-course/milestones/end/">Continue</Link> 
      </div>
    </div>
  );
}
