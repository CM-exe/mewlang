import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: "Perl: Advanced Phase, Final Challenge, Knowledge Check",
};

export default function Page() {
  return (
    <div className="theme-perl">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 15 · Course 3 (Perl) · Advanced phase and finish</p>
          <h1>What an experienced Perl programmer reaches for next, and whether you can now explain any of it</h1>
          <p className="lede">Five advanced topics with working code, one substantial final challenge about tailing logs that rotate under you, a knowledge check of forty-one questions, and everything you need to put Strata on GitHub and defend it in an interview.</p>
        </header>
        <h2><span className="num">Part A</span>The advanced phase</h2>
        <p>The tool works: it ingests five formats, survives hostile files, extracts and normalises entities, correlates them into events in SQLite, behaves under a pipe and under <code>Ctrl-C</code>, fuzzes and profiles itself, and walks its own correlations as a graph. These five topics are what you would reach for next if Strata were something you had to operate rather than something you had to finish.</p>
        <h3>A1 · A plugin architecture for parsers</h3>
        <p><code>Strata::Parser::Registry</code> has known every parser by name since Milestone 6. A real deployment wants to drop a new format handler into a directory without editing a core file at all. Perl's answer needs no dependency beyond the standard library:</p>
        <pre><code>{"package Strata::Parser::Loader;\nuse v5.36;\nuse File::Find;\n\n# Auto-discover every Strata::Parser::* module under lib/, without a static\n# list anywhere. A third party ships a new .pm file; nothing else changes.\nsub discover ($class, $lib_dir = \"lib\") {\n    my @found;\n    find({\n        wanted => sub {\n            return unless /\\.pm$/ && m{Strata/Parser/};\n            (my $mod = $File::Find::name) =~ s{^\\Q$lib_dir\\E/}{};\n            $mod =~ s{/}{::}g;\n            $mod =~ s{\\.pm$}{};\n            push @found, $mod;\n        },\n        no_chdir => 1,\n    }, \"$lib_dir/Strata/Parser\");\n\n    for my $mod (@found) {\n        (my $path = \"$mod.pm\") =~ s{::}{/}g;\n        require $path;\n    }\n    return sort @found;\n}\n"}</code></pre>
        <p>Verified against a two-file throwaway package tree: <code>discover</code> found and loaded both modules by name, in the order <code>sort</code> put them in, with no registry to keep in sync by hand. The trade-off is honest: a static list in <code>Registry.pm</code> is one file you can read top to bottom to know every format Strata understands; auto-discovery means reading the filesystem to answer the same question. For a tool meant to grow third-party parsers, that trade is usually worth it. <strong>What to measure:</strong> startup time as the parser directory grows — <code>File::Find</code> walking hundreds of files on every invocation is a real cost a static list does not pay, and the standard mitigation is a cached manifest invalidated by directory mtime.</p>
        <h3>A2 · Advanced parsing: when a regex stops being enough</h3>
        <p>Every parser so far matches one line at a time because every format so far <em>is</em> line-oriented, or was made to look that way (Milestone 6's pull-parser for XML). Nested configuration — the kind you would find describing which log sources feed Strata itself — is not: a regex has no memory of "how deep am I", which is precisely what nesting requires.</p>
        <pre><code>{"sub tokenize ($text) {\n    my @tok;\n    while ($text =~ /\\G\\s*(\\{|\\}|=|\"[^\"]*\"|[\\w.]+)/gc) {\n        push @tok, $1;\n    }\n    return @tok;\n}\n\nsub parse_block ($tokens, $pos) {\n    my %node;\n    while ($$pos < @$tokens && $tokens->[$$pos] ne '}') {\n        my $key = $tokens->[$$pos++];\n        if ($tokens->[$$pos] eq '{') {\n            $$pos++;\n            $node{$key} = parse_block($tokens, $pos);\n            die \"expected '}'\\n\" unless ($tokens->[$$pos] // '') eq '}';\n            $$pos++;\n        } elsif ($tokens->[$$pos] eq '=') {\n            $$pos++;\n            (my $val = $tokens->[$$pos++]) =~ s/^\"(.*)\"$/$1/;\n            $node{$key} = $val;\n        } else {\n            die \"expected '{' or '=' after '$key'\\n\";\n        }\n    }\n    return \\%node;\n}\n"}</code></pre>
        <p><strong><code>\G</code> anchors the next match to where the previous one left off</strong> rather than to the start of the string, and <code>/gc</code> (global, keep the position on failure) is what makes repeated <code>/\G.../gc</code> matches walk a string left to right without ever re-scanning what came before. This is Perl's built-in tokenizer loop, and most hand-rolled Perl lexers use exactly this idiom. <code>parse_block</code> is then ordinary recursive descent: a block is a sequence of <code>key = value</code> or <code>key {'{'} ...nested block... {'}'}</code> entries, and the recursion handles arbitrary nesting depth for free, which no single regex — however elaborate — can do, because a regular expression fundamentally cannot count in a way that carries across an unbounded nesting depth.</p>
        <p>Verified on a three-level config with a nested block:</p>
        <pre className="plain"><code>{"host: web-3, max_conn: 100"}</code></pre>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>This is a genuine boundary of "text processing is Perl's strength". Regexes carried every format through Milestone 6; nesting needed an actual parser, which is ordinary code in any language once you know the recursive-descent shape. Racket, later in this curriculum, treats exactly this problem — turning text into a structure, structurally, with the grammar as a first-class thing rather than an ad hoc loop — as central enough to build a whole language-construction toolkit around it. Worth remembering this thirty-line parser when you get there.</p>
        </div>
        <h3>A3 · Property-based testing for the normaliser</h3>
        <p>Milestone 8's timestamp tests check specific strings against specific epochs — necessary, and not sufficient, because it only tests the inputs someone thought to write down. A property test instead asserts something that must be true for <em>any</em> input in a category, and lets the computer generate the inputs:</p>
        <pre><code>{"use Time::Piece;\n\nsrand(9001);\nmy $failures = 0;\nfor (1 .. 2000) {\n    my $epoch = 1_600_000_000 + int(rand(200_000_000));       # any epoch in ~2020-2026\n    my $iso   = gmtime($epoch)->datetime . \"Z\";\n    my $back  = Time::Piece->strptime($iso, \"%Y-%m-%dT%H:%M:%SZ\")->epoch;\n    if ($back != $epoch) {\n        say \"MISMATCH: epoch=$epoch iso=$iso back=$back\";\n        $failures++;\n    }\n}\nsay \"$failures failures out of 2000 random epochs\";\n"}</code></pre>
        <pre className="plain"><code>{"0 failures out of 2000 random epochs"}</code></pre>
        <p>The property here is a round trip: <em>format then parse should return what you started with</em>, for every epoch, not just the six hand-picked ones from Milestone 8. Perl has no built-in property-testing framework as batteries-included as Haskell's QuickCheck or Erlang's PropEr; <code>Test::LectroTest</code> exists on CPAN and is worth knowing about, but the technique above — a seeded random loop with an assertion inside it — captures the essential idea in eight lines and needs nothing installed. Seeding with <code>srand(9001)</code> is what makes a failing run reproducible: rerun with the same seed and you get the exact same 2,000 epochs, in the exact same order, which is the property-testing equivalent of Milestone 8's deterministic chaos schedule.</p>
        <h3>A4 · Structured logs for a forensic audit trail</h3>
        <p>A tool whose job is reconstructing what happened should be able to say what <em>it</em> did, precisely, after the fact. A minimal leveled logger, dependency-free:</p>
        <pre><code>{"package Strata::Log;\nuse v5.36;\nuse POSIX qw(strftime);\n\nmy %LEVEL = (debug => 0, info => 1, warn => 2, error => 3);\nmy $threshold = $LEVEL{ $ENV{STRATA_LOG_LEVEL} // \"info\" } // 1;\n\nsub log ($level, $msg, %fields) {\n    return if $LEVEL{$level} < $threshold;\n    my $ts = strftime(\"%Y-%m-%dT%H:%M:%SZ\", gmtime);\n    my $kv = join \" \", map { qq{$_=\"$fields{$_}\"} } sort keys %fields;\n    say STDERR \"$ts level=$level msg=\\\"$msg\\\" $kv\";\n}\n\nsub info  ($msg, %f) { log(\"info\",  $msg, %f) }\nsub warn  ($msg, %f) { log(\"warn\",  $msg, %f) }\nsub error ($msg, %f) { log(\"error\", $msg, %f) }\n1;\n"}</code></pre>
        <pre className="plain"><code>{"2026-09-12T13:44:10Z level=info msg=\"ingest complete\" files=\"11\" records=\"4035\"\n2026-09-12T13:44:11Z level=warn msg=\"unterminated quote, falling back\" file=\"users.csv\" lineno=\"42\"\n"}</code></pre>
        <p>Key-value fields rather than an interpolated sentence, for the same reason Go's advanced phase gave for <code>log/slog</code>: a log aggregator can filter on <code>file="users.csv"</code> without a regular expression. <code>STDERR</code>, not <code>STDOUT</code> — Milestone 10 already made <code>STDOUT</code> the data channel a script might pipe into <code>jq</code> or <code>head</code>; mixing log lines into it would corrupt exactly the output that milestone worked to make well-behaved.</p>
        <h3>A5 · Shipping it</h3>
        <pre className="plain"><code>{"FROM perl:5.38-slim AS build\nWORKDIR /src\nCOPY cpanfile .\nRUN cpanm --notest --local-lib=/deps --installdeps .\nCOPY . .\n\nFROM perl:5.38-slim\nCOPY --from=build /deps /deps\nCOPY --from=build /src /app\nENV PERL5LIB=/deps/lib/perl5\nWORKDIR /app\nRUN useradd -r -s /usr/sbin/nologin strata\nUSER strata\nENTRYPOINT [\"perl\", \"bin/strata\"]\n"}</code></pre>
        <p>A two-stage build so the compiler and build-time dependencies <code>DBD::SQLite</code> and <code>XML::LibXML</code> needed to compile their C extensions never ship in the final image, and a non-root user, because there is no reason a tool that only reads log files and writes a SQLite database needs to run as root.</p>
        <pre className="plain"><code>{"# /etc/systemd/system/strata-ingest.timer\n[Timer]\nOnCalendar=*-*-* *:00/15\nPersistent=true\n\n[Install]\nWantedBy=timers.target"}</code></pre>
        <p>A <code>systemd</code> timer rather than a naive cron entry gets you two things cron does not for free: <code>Persistent=true</code> catches up a missed run after the machine was off, and <code>journalctl -u strata-ingest</code> gives you the structured logs from A4 alongside systemd's own record of exit status and duration, in one place.</p>
        <hr />
        <h2><span className="num">Part B</span>The final challenge</h2>
        <p>Everything up to here had a solution a few paragraphs later. This one does not, and it is deliberately at the edge of what you can now do. Spend real time on it before opening the last section.</p>
        <h3>Tailing logs that rotate, truncate, and disappear out from under you</h3>
        <p>Every milestone so far ingests files that already exist and stop changing while Strata reads them. Real logs do not hold still: they grow, get rotated (renamed aside, a fresh empty file created at the old path) or copy-truncated (truncated to zero length in place, same file, same inode, same path) by the logging system while your tool is running, sometimes every hour. <strong>Build <code>strata watch DIR...</code>: a live-ingesting mode that follows files as they change, survives both kinds of rotation with no duplicate and no lost record, and can be stopped and restarted without reprocessing anything it already saw.</strong></p>
        <h4>Requirements</h4>
        <ol>
          <li><code>strata watch DIR [DIR...]</code> watches every regular file already in the given directories and picks up new files that appear in them later.</li>
          <li>Bytes appended to a file are ingested incrementally — read from where you left off, not by re-reading the file from the start.</li>
          <li>Handle <strong>rotate-by-rename</strong> (the file at a watched path becomes a different file, identified by a change of device+inode) by starting the new file at its own beginning.</li>
          <li>Handle <strong>copytruncate</strong> (the same file, same inode, truncated to a smaller size than you had already read) by resuming from the new end of file rather than either re-reading old bytes or crashing on a negative-length read.</li>
          <li>Every few seconds, run correlation on only the newly ingested occurrences and print any event that was created or extended since the last pass — a live feed, not only a final report.</li>
          <li><code>Ctrl-C</code> stops cleanly (reusing Milestone 10's signal discipline) and remembers exactly how far into each watched file it got, in the store itself, so a restart neither reprocesses nor skips. </li>
          <li>Idle files must not burn CPU. Fifty quiet files and one active one should look, in a CPU profile, overwhelmingly like "waiting", not like "checking".</li>
        </ol>
        <h4>Constraints</h4>
        <ul>
          <li>No new heavy dependency. <code>Linux::Inotify2</code> is an acceptable optional enhancement if you get the polling version working first; it must not be required.</li>
          <li>Per-file position bookkeeping lives in a <code>watch_state</code> table in the same SQLite database as everything else — not a side file that can drift out of sync with what was actually committed.</li>
          <li>Bounded memory regardless of how long <code>watch</code> has been running or how many rotations a file has been through.</li>
        </ul>
        <h4>Acceptance criteria</h4>
        <ol>
          <li><strong>Rename-rotation.</strong> Append 100 lines, <code>mv</code> the file aside, create a fresh file at the same path, append 50 more. All 150 lines ingested, none duplicated.</li>
          <li><strong>Copytruncate.</strong> Append 100 lines, truncate the file to zero length in place (same inode), append 50 more. All 150 lines ingested, none duplicated — this is a different code path from (1) and must be tested separately.</li>
          <li><strong>Restart.</strong> Watch, ingest some lines, <code>Ctrl-C</code>, restart against the same directories. No re-ingestion of already-seen bytes; lines appended while stopped are picked up on restart.</li>
          <li><strong>Idle cost.</strong> 50 idle files plus one file appended to once a second for 60 seconds: the watcher's own CPU time over that minute stays low, measured with <code>/usr/bin/time -v</code> or equivalent, and does not scale with how long the run has lasted.</li>
          <li><strong>Live feed.</strong> An event appears in the live output within one polling interval of the occurrence that completed it — not only when the process is later stopped.</li>
        </ol>
        <h4>Hints, in increasing order of how much they give away</h4>
        <ul>
          <li>The hard part is not reading new bytes. It is knowing when "the file currently at this path" is no longer the file you were reading a moment ago.</li>
          <li>One <code>stat()</code> call gives you a fact that changes under rename-rotation but not under copytruncate, and a different fact that changes under both. You need both facts, not just one.</li>
          <li>What you persist per watched file needs to be exactly enough to detect both kinds of change on your very next poll, including the first poll after a restart.</li>
          <li>A rename-rotation loses you the last few bytes written to the old file in the instant between your last read and the rename, if you are not also watching for that specific transition. Decide, and say in your write-up, whether you are willing to accept that small window or whether you close it (and how) — <code>tail --follow=name</code> versus <code>tail --follow=descriptor</code> made different, documented choices about exactly this.</li>
          <li>For the CPU constraint: a modest fixed poll interval (hundreds of milliseconds, not microseconds) already satisfies the requirement at the stated scale of fifty files. Say in your write-up at roughly what file count this approach stops being fine, and what you would reach for instead.</li>
        </ul>
        <p>Attempt it before reading on. Even a partial implementation with an honest account of what you didn't solve is worth more than the section below.</p>
        <details>
          <summary>Solution — only look after trying</summary>
          <h4>The detection rule</h4>
          <p>Three fields from one <code>stat()</code> call, compared against what you saw last time:</p>
          <table className="grid">
            <tbody>
              <tr>
                <th>Observation</th>
                <th>Meaning</th>
                <th>Action</th>
              </tr>
              <tr>
                <td>device or inode changed</td>
                <td>rename-rotation: a different file now lives at this path</td>
                <td>start the new file from offset 0</td>
              </tr>
              <tr>
                <td>same device and inode, size {'<'} last known offset</td>
                <td>copytruncate: the same file was truncated shorter than what you'd read</td>
                <td>resume from the new end of file, offset 0 is also defensible</td>
              </tr>
              <tr>
                <td>same device and inode, size {'>'} last known offset</td>
                <td>ordinary growth</td>
                <td>read from the old offset to the new size</td>
              </tr>
            </tbody>
          </table>
          <pre><code>{"sub poll_file ($self, $path) {\n    my @st = stat($path) or return $self->_forget($path);   # file gone\n    my ($dev, $ino, $size) = @st[0, 1, 7];\n    my $prev = $self->{state}{$path};\n\n    if (!$prev || $prev->{dev} != $dev || $prev->{ino} != $ino) {\n        $self->{state}{$path} = { dev => $dev, ino => $ino, offset => 0 };\n        $self->_save_state($path);\n        return $self->_read_from($path, 0);\n    }\n\n    if ($size < $prev->{offset}) {\n        $prev->{offset} = 0;\n        $self->_save_state($path);\n        return $self->_read_from($path, 0);\n    }\n\n    return () if $size == $prev->{offset};\n    return $self->_read_from($path, $prev->{offset});\n}\n"}</code></pre>
          <p>Verified with a real sequence of operations — create, append, rename-and-recreate, append, copytruncate (in-place truncate via a reopened filehandle, same inode), append again — against exactly this detection logic: every transition was classified correctly (<code>new</code>, <code>appended</code>, <code>rotated</code>, <code>appended</code>, <code>truncated</code>, <code>appended</code>), with the copytruncate case in particular only working because the check compares against the <em>previously read offset</em>, not against zero — a naive "did the size shrink" check without that comparison cannot tell a copytruncate from a file that simply hasn't grown yet.</p>
          <h4>Persistence, so a restart knows what it already owes nothing</h4>
          <pre><code>{"CREATE TABLE watch_state (\n    path      TEXT PRIMARY KEY,\n    dev       INTEGER NOT NULL,\n    ino       INTEGER NOT NULL,\n    offset    INTEGER NOT NULL,\n    updated_at INTEGER NOT NULL\n);\n"}</code></pre>
          <p>One row per path, upserted after every successful ingest of a chunk — and only after, never before, so that a crash mid-read leaves the recorded offset at the last point genuinely committed rather than claiming credit for bytes not yet safely in the database. On startup, <code>watch</code> loads this table before its first poll, so "restart" is not a special case in the code at all: it is simply the first poll of a process whose <code>%state</code> happens to have been pre-populated from SQLite instead of built up from scratch.</p>
          <h4>The live feed, without re-running the whole sweep</h4>
          <p>Milestone 9's <code>sessionize</code> re-sorts and re-groups every occurrence on every call, which is wrong here — correct, but wasteful, and wasteful in a loop that runs every few seconds forever. <code>watch</code> instead sessionises only <em>affected</em> keys:</p>
          <pre><code>{"my %touched;                                  # (type, value) pairs seen this poll\nfor my $occ (@new_occurrences) {\n    $touched{\"$occ->{type}\\0$occ->{value}\"} = 1;\n}\n\nfor my $key (keys %touched) {\n    my ($type, $value) = split \"\\0\", $key;\n    $self->{store}->resessionize_one($type, $value);   # re-sweep just this entity's occurrences\n}\n"}</code></pre>
          <p>Re-sweeping one entity's occurrences (typically a handful to a few hundred rows, indexed by exactly the <code>idx_occ_type_value_ts</code> covering index Milestone 9 built) rather than the whole table is what keeps each poll's cost proportional to what actually changed, not to how much history the database has accumulated.</p>
          <h4>The instant-of-rotation gap, and the honest choice</h4>
          <p>Between the last poll and the rename, a writer can still append a few bytes to the file <em>at its old inode</em> that your next poll — which now looks at the new inode under that path — will never see by path alone. This implementation accepts that gap: it is bounded by the poll interval, it is the same choice <code>tail --follow=name</code> (the GNU default for a watched filename) makes, and closing it requires keeping the old file descriptor open past the rename and giving it one final read, which is what <code>tail --follow=descriptor</code> does instead, at the cost of tracking <em>two</em> live handles per watched path during the transition. Document the choice; do not leave it implicit.</p>
          <h4>What is still wrong with this, and you should say so in your README</h4>
          <ul>
            <li><strong>Polling, not events.</strong> Fifty files at a few-hundred-millisecond interval is genuinely fine; five thousand files is not — every poll is now five thousand <code>stat</code> calls whether or not anything changed. <code>Linux::Inotify2</code> turns this into "wake up only when something changed", at the cost of a dependency and of Linux-only portability.</li>
            <li><strong>The rotation gap above</strong> is real, bounded, and undocumented in most tools that have it, which is worse than documenting it here.</li>
            <li><strong>One process, one SQLite writer.</strong> This does not parallelise across files the way Milestone 12's batch ingest does, because a live tail needs to notice new bytes promptly on every watched file, and splitting that across <code>fork</code>ed workers means either sharding <em>which files</em> each worker owns (straightforward) or fighting over one SQLite writer from several processes at once (not straightforward, and not attempted here).</li>
            <li><strong>No back-pressure if ingestion falls behind the write rate.</strong> A sufficiently fast writer can grow the gap between "bytes on disk" and "bytes ingested" without bound; a production version would track that lag as a metric and alert on it rather than discover it only when disk space runs out.</li>
          </ul>
          <p>If you can explain the difference between the rename-rotation and copytruncate cases, and why a naive "did the file shrink" check handles neither of them correctly without device+inode tracking, you understand the actual hard part of "tail -f", which is a component inside more infrastructure than you might expect: log shippers, metrics agents and container runtimes all solve a version of this exact problem.</p>
        </details>
        <hr />
        <h2><span className="num">Part C</span>Knowledge check</h2>
        <h3>C1 · Twenty conceptual questions</h3>
        <ol className="qs">
          <li>State Perl's context rule precisely: what decides whether an expression is evaluated in list or scalar context, and name three operations that behave differently depending on which.</li>
          <li>Why does <code>my $n = @array</code> give you a count while <code>my ($n) = @array</code> gives you the first element?</li>
          <li>What does <code>wantarray</code> return in each of the three calling contexts, and why is "void" a context distinct from "scalar"?</li>
          <li>Explain autovivification. Why does <code>if ($h{'{'}a{'}'}{'{'}b{'}'}{'{'}c{'}'})</code> create <code>$h{'{'}a{'}'}</code> and <code>$h{'{'}a{'}'}{'{'}b{'}'}</code> even though the condition is false?</li>
          <li>Why are hash keys always strings, and what follows for a hash keyed by something that looks numeric, like an IP octet or a port number?</li>
          <li>What is the difference between <code>my</code> and <code>local</code>? Give a case where <code>local</code> is the only correct choice.</li>
          <li>Why did <code>for (my $i = 1; $i {'<'}= 3; $i++) {'{'} push @subs, sub {'{'} $i {'}'} {'}'}</code> capture one shared <code>$i</code> across all three closures, while <code>for my $i (1..3) {'{'} push @subs, sub {'{'} $i {'}'} {'}'}</code> does not?</li>
          <li>Explain <code>foreach</code>'s aliasing behaviour: why does <code>$_ = uc $_</code> inside <code>for (@list) {'{'} ... {'}'}</code> modify <code>@list</code> itself?</li>
          <li>What does <code>local $/</code> do, and why does setting it to <code>undef</code> enable "slurp mode"?</li>
          <li>Why is Perl's <code>sort</code> guaranteed stable since 5.8, and what would break in the sessioniser's sweep if it were not?</li>
          <li>What is a reference, in terms of what it actually stores, and how does it differ from a C pointer?</li>
          <li>Explain why <code>Text::CSV</code> or <code>XML::LibXML</code> cannot be replaced by a "good enough" regex, using a specific example from Milestone 6.</li>
          <li>What does <code>PerlIO::encoding::fallback</code> control, and what does Perl's <code>:encoding</code> layer do to an undecodable byte if you never set it?</li>
          <li>Why must <code>alarm(0)</code> be called on every exit path of a timeout-protected block, success and failure alike?</li>
          <li>Explain the difference between <code>eq</code>/<code>==</code> and when using the wrong one produces a bug that only shows up on some inputs.</li>
          <li>Why does wrapping ten thousand <code>INSERT</code>s in one transaction, rather than autocommitting each one, produce a two-orders-of-magnitude speedup in SQLite specifically?</li>
          <li>What makes a SQLite index "covering", and why does that matter more for a point lookup than for a full scan?</li>
          <li>After <code>fork()</code>, what exactly do the parent and child share, and what is copied? Why does that make a data race between them structurally impossible?</li>
          <li>Why does closing the unused end of a pipe, in both the parent and the child, matter for correctly detecting end-of-file?</li>
          <li>What does <code>WITH RECURSIVE</code>'s plain <code>UNION</code> (rather than <code>UNION ALL</code>) prevent when the underlying graph contains a cycle?</li>
        </ol>
        <details>
          <summary>Answers to C1</summary>
          <ol className="qs">
            <li>Context is determined entirely by the syntactic position an expression appears in — assignment to an array or a list of variables imposes list context, assignment to a scalar imposes scalar context, a boolean test imposes scalar context — never by the expression's own contents. Three context-sensitive operations: assigning an array to a scalar (count), <code>reverse</code> (list: reverses elements; scalar: reverses a concatenated string), and a subroutine call, whose <code>wantarray</code> can act on it explicitly.</li>
            <li>Assigning an array to a bare scalar imposes scalar context on the array, which for an array means "how many elements". Assigning to a parenthesised list of one variable, <code>($n)</code>, imposes list context, so <code>@array</code> supplies its elements in order and <code>$n</code> receives the first one, discarding the rest.</li>
            <li>True in list context, false (but defined) in scalar context, <code>undef</code> in void context — called for its side effects with the return value discarded entirely, as in a bare <code>ctx();</code> statement. Void is distinct from scalar because some functions legitimately do less work when nothing will read the result at all.</li>
            <li>Perl builds a hash's nested structure lazily, on first access, so that <code>$h{'{'}a{'}'}{'{'}b{'}'}{'{'}c{'}'}</code> can be written at all without every level already existing. Merely <em>looking up</em> <code>$h{'{'}a{'}'}{'{'}b{'}'}{'{'}c{'}'}</code> — even inside a boolean test that never assigns anything — still has to dereference <code>$h{'{'}a{'}'}</code> as a hash reference to get anywhere, and Perl autovivifies it on that dereference rather than requiring it to pre-exist. The condition being false afterwards changes nothing about the levels that were already created to evaluate it.</li>
            <li>Hash keys are stored and compared as strings unconditionally, so <code>$h{'{'}7{'}'}</code> and <code>$h{'{'}"7"{'}'}</code> are the same entry, but <code>$h{'{'}"007"{'}'}</code>, <code>$h{'{'}"07"{'}'}</code> and <code>$h{'{'}7{'}'}</code> are three distinct entries despite being numerically equal — a real risk for entity deduplication keyed on something that looks numeric but may carry leading zeros or varying formatting.</li>
            <li><code>my</code> creates a new lexical variable scoped to its enclosing block, resolved at compile time. <code>local</code> saves and temporarily replaces the value of an existing (usually global or package) variable for the dynamic extent of the current block, restoring the old value on exit — used throughout this project for exactly one purpose: temporarily replacing <code>$SIG{'{'}ALRM{'}'}</code> or <code>$SIG{'{'}INT{'}'}</code> so the replacement is guaranteed to be undone when the protected block ends, however it exits.</li>
            <li>A C-style <code>for</code> loop has exactly one <code>$i</code>, declared once before the loop body runs at all; every closure created inside the loop captures that same variable, so all three see whatever value it holds after the loop finishes (4, from the last increment past the exit condition). <code>for my $i (1..3)</code> is Perl's <code>foreach</code> form, which creates a fresh lexical <code>$i</code> for each iteration, so each closure captures a genuinely distinct variable — the same distinction Go's <code>for</code> loop semantics changed to match, in Go 1.22. </li>
            <li><code>foreach</code> does not copy each list element into <code>$_</code>; it aliases <code>$_</code> directly to the element itself for the duration of that iteration. Assigning to <code>$_</code> is therefore assigning to the original array slot, which is occasionally exactly what you want (an explicit in-place transform) and occasionally a bug from forgetting the aliasing exists at all.</li>
            <li><code>$/</code> is the input record separator that <code>{'<'}$fh{'>'}</code> reads up to. Setting it to <code>undef</code> removes any separator to stop at, so the next diamond read returns the entire remaining content of the filehandle as one scalar — "slurp mode" — which is exactly what a format like XML, with no meaningful line structure, needs instead of line-by-line reading.</li>
            <li>Stability means two elements that compare equal keep their original relative order after sorting, which Perl has guaranteed since 5.8 regardless of the underlying algorithm. The sessioniser relies on it implicitly: occurrences with identical <code>(type, value, ts)</code> keep whatever order <code>SELECT ... ORDER BY</code> produced, rather than being shuffled between runs, which matters for reproducible output when comparing two runs of the same ingest.</li>
            <li>A reference is a scalar value that holds the address and type of another value — an array, a hash, a scalar, a code value, or an object — and, unlike a C pointer, always knows what kind of thing it refers to and participates in reference counting, so Perl frees the referent automatically once nothing references it any more. There is no pointer arithmetic, and dereferencing a reference of the wrong kind (treating an array reference as a hash reference) is a checked runtime error, not undefined behaviour.</li>
            <li>CSV's quoting rules mean a field can legally contain a comma, a newline, or an escaped quote — <code>"Multi\nline name"</code> is one field spanning two physical lines, which a regex split on commas or newlines has no way to know without effectively re-implementing a CSV parser's state machine. XML has no fixed structure to match against at all: an element can span any number of lines or be minified onto one, so "match a tag with a regex" only ever works until a document is formatted differently than the regex assumed.</li>
            <li>It controls what Perl substitutes for a byte sequence that cannot be decoded under the active encoding. Left at its default, PerlIO's <code>:encoding</code> layer inserts a literal backslash-x escape sequence as ordinary text characters — not a recognisable error marker — so a decoding failure becomes indistinguishable from real data unless <code>FB_DEFAULT</code> is overridden with something like <code>Encode::FB_DEFAULT</code> tuned to produce U+FFFD instead.</li>
            <li>An armed alarm is a process-wide timer that fires in whatever code happens to be running when its deadline arrives, regardless of whether that code has anything to do with what set the alarm. If the protected block finishes early but the alarm is left pending, it fires later, in unrelated code, producing a <code>die</code> that looks like it came from nowhere; cancelling on both the success path and every failure path is what guarantees the timer never outlives the operation it was meant to bound.</li>
            <li><code>eq</code> compares two values as strings; <code>==</code> converts both to numbers first and compares those. <code>"07" == "7"</code> is true (both convert to the number 7) while <code>"07" eq "7"</code> is false (different strings) — a bug that hides for exactly as long as every value in a dataset happens not to have a leading zero, a decimal point, or trailing whitespace that changes its numeric conversion.</li>
            <li>SQLite's default durability guarantee is that a transaction is not considered committed until its write-ahead log entry is flushed to physical storage, which is an expensive operation relative to an in-memory write. Autocommit mode makes every single statement its own transaction, paying that flush cost once per row; wrapping many inserts in one explicit transaction pays it once for the whole batch, which is why the measured difference was roughly two orders of magnitude rather than a modest constant factor.</li>
            <li>A covering index contains every column a query needs, so SQLite can answer the query by reading the index alone and never touching the underlying table rows at all. A full scan already has to visit most of the table regardless, so an index mainly reorders that work; a point lookup that would otherwise scan the entire table to find a handful of matching rows benefits enormously, because the index turns "check every row" into "walk directly to the matching branch of a B-tree". </li>
            <li><code>fork()</code> gives the child a complete, independent copy of the parent's address space at the moment of the call — copy-on-write, so physically cheap until either side writes to a shared page, at which point the kernel actually duplicates just that page. After that instant neither process can observe or modify the other's memory at all; there is no shared mutable state for two forked processes to race on, because "shared" stops being true the moment either one writes.</li>
            <li>A pipe's read end reports end-of-file only once every writer-side file descriptor referring to it has been closed. If a process forks and neither parent nor child closes the copy of the end it does not use, that unused copy keeps the pipe's write end alive from the kernel's point of view even after the "real" writer has finished, so a read that should see EOF instead blocks forever waiting for a close that will never come from a descriptor nobody is using.</li>
            <li><code>UNION</code> deduplicates identical rows as the recursion accumulates them, which is what stops a cycle in the underlying graph from being retraced indefinitely — each <code>(node, hops)</code> pair the recursion could produce is only ever added once, so the recursion has a finite number of distinct rows left to produce and necessarily terminates. <code>UNION ALL</code> keeps every duplicate, and a true graph cycle under <code>UNION ALL</code> recurses forever.</li>
          </ol>
        </details>
        <h3>C2 · Ten code-reading questions</h3>
        <p>Predict the output of each, then check. All ten were run to confirm the answers.</p>
        <pre><code>{"// 1\nmy @a = (1,2,3);\nmy $n = @a;\nmy ($first) = @a;\nsay \"$n $first\";\n\n// 2\nmy %h;\n$h{a}{b}{c} = 1;\nsay exists $h{a} ? \"yes\" : \"no\";\nsay ref $h{a};\n\n// 3\nmy $s = \"9\"; $s++;\nmy $t = \"Az\"; $t++;\nsay \"$s $t\";\n\n// 4\nmy @list = (3,1,2);\nsay \"@{[ sort @list ]}\";\nmy @nums = (10, 9, 2);\nsay \"@{[ sort @nums ]}\";\n\n// 5\nsub ctx { return wantarray ? \"list\" : defined(wantarray) ? \"scalar\" : \"void\" }\nctx();\nmy $x = ctx();\nmy @y = ctx();\nsay \"$x @y\";\n\n// 6\nmy @subs;\nfor my $i (1..3) { push @subs, sub { $i } }\nsay join \",\", map { $_->() } @subs;\n\n// 7\nmy @subs2;\nfor (my $i = 1; $i <= 3; $i++) { push @subs2, sub { $i } }\nsay join \",\", map { $_->() } @subs2;\n\n// 8\nmy @names = (\"alice\", \"bob\");\nfor (@names) { $_ = ucfirst $_ }\nsay \"@names\";\n\n// 9\nmy @prices = (19.995, 4.999);\nprintf \"%d %.2f\\n\", $_, $_ for @prices;\n\n// 10\nmy @arr = (1,2,3,4);\nmy $count = () = @arr;\nsay $count;\n"}</code></pre>
        <details>
          <summary>Answers to C2</summary>
          <pre className="plain"><code>{"1.  3 1\n2.  yes\n    HASH\n3.  10 Ba\n4.  1 2 3\n    10 2 9\n5.  scalar list\n6.  1,2,3\n7.  4,4,4\n8.  Alice Bob\n9.  19 20.00\n    4 5.00\n10. 4\n"}</code></pre>
          <ol className="qs">
            <li>Scalar-context assignment of an array gives its count (3); list-context assignment to <code>($first)</code> gives its first element.</li>
            <li>Assigning to <code>$h{'{'}a{'}'}{'{'}b{'}'}{'{'}c{'}'}</code> autovivifies <code>$h{'{'}a{'}'}</code> as a hash reference along the way, so it exists and is a <code>HASH</code> ref, even though the code never explicitly created it.</li>
            <li>Magic string increment: <code>"9"</code> becomes numeric-looking and increments to <code>"10"</code>; <code>"Az"</code> increments alphabetically with carry, becoming <code>"Ba"</code>, exactly like an odometer.</li>
            <li>Perl's default <code>sort</code> compares elements as strings unless told otherwise: numeric 3,1,2 sort correctly as strings to 1,2,3, but 10,9,2 sort as strings to "10","2","9" because <code>"1" lt "2"</code>. A numeric sort needs an explicit <code>sort {'{'} $a {'<'}={'>'} $b {'}'} @nums</code>.</li>
            <li>The bare <code>ctx();</code> statement runs in void context and its return value is discarded entirely — never printed. <code>$x</code> is assigned in scalar context, <code>@y</code> in list context.</li>
            <li><code>for my $i (1..3)</code> gives each closure its own fresh lexical, so the three closures return their own captured value, in order.</li>
            <li>The C-style <code>for</code> loop has one <code>$i</code> shared by every iteration and every closure; by the time any of the three closures run, the loop has finished and <code>$i</code> holds 4 (the value that failed the <code>{'<'}= 3</code> test), so all three print the same number. </li>
            <li><code>foreach</code> aliases <code>$_</code> to the actual array element, not a copy, so assigning to <code>$_</code> mutates <code>@names</code> in place — a common source of "why did my input array change" bugs.</li>
            <li><code>%d</code> truncates toward zero rather than rounding, so 19.995 prints as 19 and 4.999 as 4; <code>%.2f</code> rounds correctly to two decimal places.</li>
            <li><code>() = @arr</code> assigns the array to an empty list in list context and, wrapped in <code>$count = ( ... )</code>, that assignment expression evaluates in scalar context to the number of elements assigned — a genuine, if slightly cryptic, idiom for "count without naming a throwaway array", sometimes called the goatse operator for its shape.</li>
          </ol>
        </details>
        <h3>C3 · Five debugging exercises</h3>
        <p>Each gives a symptom and a suspect. Diagnose before opening the answer.</p>
        <ol className="qs">
          <li>
            <strong>Symptom:</strong> a report script that builds closures per row for lazy formatting prints the same value in every row instead of each row's own value. 
            <pre className="bad"><code>{"my @formatters;\nfor (my $i = 0; $i < @rows; $i++) {\n    push @formatters, sub { format_row($rows[$i]) };\n}"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> a "does this record have a location?" check that should just read data is somehow creating thousands of empty hash entries, visible as memory growth and a much slower <code>keys %index</code> loop later in the same run. 
            <pre className="bad"><code>{"for my $rec (@records) {\n    next unless $rec->{fields}{geo}{country};\n    $index{ $rec->{fields}{geo}{country} }++;\n}"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> a "top talkers" report that groups by client IP shows the same address listed three separate times with different counts, instead of once with the combined count. 
            <pre className="bad"><code>{"my %by_ip;\n$by_ip{ $rec->field(\"ip_octet_str\") }++ for @records;   # values like \"007\", \"07\", \"7\""}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> a normalising pass that's supposed to build a cleaned-up copy of a list instead corrupts the original list it was only meant to read. 
            <pre className="bad"><code>{"my @hosts = extract_hosts(@records);\nfor (@hosts) { $_ = lc $_ }\npush @clean_hosts, @hosts;   # caller finds @hosts itself is now lowercased too"}</code></pre>
          </li>
          <li>
            <strong>Symptom:</strong> a nightly summary occasionally dies with <code>Died within alarm handler</code> or hangs entirely, only ever under heavy load, never in development. 
            <pre className="bad"><code>{"sub with_deadline ($code, $seconds) {\n    $SIG{ALRM} = sub { die \"timeout\\n\" };   # note: not local\n    alarm($seconds);\n    my $r = $code->();\n    alarm(0);\n    return $r;\n}"}</code></pre>
          </li>
        </ol>
        <details>
          <summary>Answers to C3</summary>
          <ol className="qs">
            <li><strong>A C-style loop with one shared <code>$i</code>.</strong> Every closure captures the same variable, and by the time any formatter actually runs, the loop has finished and <code>$i</code> holds its final, past-the-end value — so every row formats using whatever row that index pointed at last. Fix: <code>for my $i (0 .. $#rows)</code>, which gives each closure its own lexical, or capture the row itself rather than its index (<code>my $row = $rows[$i]; push @formatters, sub {'{'} format_row($row) {'}'}</code>).</li>
            <li><strong>Autovivification through a chained read.</strong> <code>$rec-{'>'}{'{'}fields{'}'}{'{'}geo{'}'}{'{'}country{'}'}</code> dereferences <code>{'{'}fields{'}'}</code> and then <code>{'{'}geo{'}'}</code> as hash references to reach <code>country</code>, and if a record has no <code>geo</code> key at all, that dereference creates an empty <code>{'{'}geo{'}'}</code> hashref on the spot, purely from being read. Across thousands of records with no location data, that is thousands of empty hashes silently added to memory, and <code>exists $rec-{'>'}{'{'}fields{'}'}{'{'}geo{'}'}</code> checked first (without a chained autovivifying read past it) avoids creating anything, or use <code>Data::Diver</code>'s non-autovivifying accessor. </li>
            <li><strong>Hash keys are strings.</strong> <code>"007"</code>, <code>"07"</code> and <code>"7"</code> are three different keys despite being numerically equal, so the counter silently fragments across however many textual spellings the source data happened to use for the same value. Fix: normalise to a canonical numeric or zero-padded form (exactly what <code>Strata::Extract</code>'s <code>normalise</code> step exists to do) before ever using a value as a hash key.</li>
            <li><strong><code>foreach</code> aliases, it does not copy.</strong> <code>for (@hosts) {'{'} $_ = lc $_ {'}'}</code> mutates <code>@hosts</code> in place because <code>$_</code> <em>is</em> each element, not a stand-in for it — so any list built from <code>@hosts</code> before this loop, and <code>@hosts</code> itself afterward, are all lowercased whether or not that was intended. Fix: build a new list explicitly, <code>my @clean = map {'{'} lc $_ {'}'} @hosts;</code>, which never touches the original.</li>
            <li><strong>A non-<code>local</code>ised signal handler, and a race under concurrent calls.</strong> Setting <code>$SIG{'{'}ALRM{'}'}</code> directly (not <code>local</code>) leaves it installed globally once this sub returns; under load, with several deadline-protected operations plausibly overlapping (or an earlier call's <code>alarm</code> not yet cancelled when a new one starts), a stray alarm can fire inside code that never expected it, or the handler from a finished call can still be armed when a completely different timeout fires. Fix: <code>local $SIG{'{'}ALRM{'}'} = sub {'{'} die "timeout\n" {'}'};</code> inside an <code>eval</code>, exactly as Milestone 11's fuzz harness does, so the handler is guaranteed to be restored to whatever it was before, on every exit path.</li>
          </ol>
        </details>
        <h3>C4 · Five implementation exercises</h3>
        <ol className="qs">
          <li><strong>A syslog parser</strong> (Milestone 6's own forward reference): both the classic <code>Mon DD HH:MM:SS host tag: msg</code> form and the RFC 5424 <code>{'<'}PRI{'>'}1 timestamp ...</code> form, in one parser, with a <code>detect</code> that does not falsely claim ordinary prose. Wire it into the Registry and add fixtures.</li>
          <li><strong>Parallel <code>correlate</code>.</strong> Milestone 12 parallelised ingestion; sessionisation still runs single-threaded. Shard by entity <code>(type, value)</code> hash across <code>fork</code>ed workers (each sessionises a disjoint slice of entities, so there is no shared state to coordinate), and benchmark against the single-process version at 500,000 occurrences.</li>
          <li><strong>A redaction stage</strong> using the keyed-hash pseudonymisation sketched in Milestone 8's exercises: replace extracted emails and card-shaped numbers in <code>raw</code> with stable tokens before a record is ever written to <code>records.raw</code>, so the database itself never holds the original sensitive text.</li>
          <li><strong>An idle-safe <code>strata watch</code> health check</strong>: a <code>--report-every 60s</code> flag that logs (via Milestone A4's logger) a one-line summary — files watched, bytes ingested, events created, current lag if measurable — on a fixed interval regardless of whether anything changed, so an operator watching logs can distinguish "quietly healthy" from "silently stuck".</li>
          <li><strong>A <code>strata verify</code> subcommand</strong> that re-reads every file referenced in <code>records</code>, re-parses each recorded line by <code>(file, lineno)</code>, and reports any record whose stored <code>raw</code> no longer matches what is currently on disk at that position — detecting logs that were edited or replaced after ingestion, which is exactly the kind of tampering a forensic tool should be able to notice about its own evidence.</li>
        </ol>
        <h3>C5 · One substantial challenge</h3>
        <p>Distinct from the final challenge in Part B, and smaller, but not easy.</p>
        <p><strong>Build a differential fuzzer.</strong> For any two of the five format parsers, generate inputs that are ambiguous between formats on purpose (a CSV row whose first field looks like a JSON object; a line that is simultaneously a plausible Apache log line and plausible unstructured prose) and assert a specific property: that <code>Strata::Parser::Registry</code>'s <code>detect</code> scores never produce a tie between two non-fallback parsers on the same input, or, where a genuine tie is unavoidable, that the registry's tie-breaking rule is deterministic and documented rather than dependent on hash key iteration order.</p>
        <p>Requirements: at least 5,000 generated inputs per format pair; any discovered tie or nondeterminism must be saved as a permanent fixture and regression test, the same way Milestone 11's fuzzer turned its one found hang into <code>t/90-fuzz.t</code>; and the generator must be seeded and the seed logged, so a found problem is reproducible on demand. Hint: the interesting bugs are rarely in one parser's <code>detect</code> being wrong in isolation — they are in the <em>comparison</em> between two parsers' scores being close enough that which one wins depends on something that was never meant to be load-bearing, like hash iteration order in the registry's own scoring loop.</p>
        <h3>C6 · You should now be able to explain</h3>
        <ul>
          <li>Perl's context rule, precisely, and at least four operations whose behaviour depends on it.</li>
          <li>Autovivification: what triggers it, why a read can trigger it, and how to avoid it when you only meant to check.</li>
          <li><code>foreach</code>'s aliasing of <code>$_</code>, and the difference between a C-style <code>for</code> loop's one shared variable and <code>for my $x (...)</code>'s fresh one per iteration.</li>
          <li>Why hash keys are always strings, and what that implies for any value used as one.</li>
          <li>The full <code>DBI</code> connect/prepare/execute/placeholder cycle, and why placeholders are not optional the moment any value comes from outside the program.</li>
          <li>Why one transaction beats autocommit-per-row, in terms of what SQLite actually does once per commit. </li>
          <li>How to read <code>EXPLAIN QUERY PLAN</code>, and what "covering index" means.</li>
          <li>The complete rotation/truncation detection logic from the final challenge, and why device+inode and size/offset together are both necessary.</li>
          <li>Why <code>fork()</code> makes data races between two Perl worker processes structurally impossible, and what it costs you in exchange.</li>
          <li>The zombie-process and pipe-buffer-deadlock hazards of <code>fork</code>-and-pipe designs, and what specifically avoids each.</li>
          <li>Why <code>alarm()</code> plus <code>local $SIG{'{'}ALRM{'}'}</code> is Perl's idiomatic last-resort timeout, and the two places a timeout helper must cancel it.</li>
          <li>The difference between testing specific examples and property-based testing, with a concrete property from this project.</li>
          <li>Recursive descent parsing well enough to say why a regex cannot handle arbitrary nesting on its own. </li>
          <li>Why <code>SIGPIPE</code>'s default action is silent termination, and when you would override it.</li>
        </ul>
        <h3>C7 · You should now be able to implement</h3>
        <ul>
          <li>A streaming text pipeline that survives gzip, encoding errors, truncation and adversarial line lengths without unbounded memory growth.</li>
          <li>A pluggable format-detection system using confidence scores rather than a boolean, with a never-refuses fallback.</li>
          <li>An entity extraction pipeline that separates matching, validation and normalisation into distinct steps, driven by context rules rather than the pattern alone.</li>
          <li>A SQLite-backed correlation engine: schema, transactional bulk load, a sort-then-sweep grouping algorithm, and the indexes that make its queries fast.</li>
          <li>A command-line tool with real subcommands, <code>Getopt::Long</code> option parsing, sysexits-style exit codes, and graceful behaviour under both <code>SIGINT</code> and a closed output pipe.</li>
          <li>A deadline-bounded fuzzer using <code>alarm()</code>, and a shared contract test reused across a family of plugin-like modules.</li>
          <li>A profiling session with <code>Devel::NYTProf</code> that finds and fixes a genuine algorithmic hot path, with before-and-after numbers.</li>
          <li>A <code>fork</code>-and-pipe worker pool with correct reaping and no shared mutable state.</li>
          <li>A recursive graph query over SQLite using <code>WITH RECURSIVE</code>.</li>
          <li>A rotation-safe file tailer using device/inode/offset tracking, persisted so it survives a restart. </li>
        </ul>
        <hr />
        <h2><span className="num">Part D</span>Shipping it: README, portfolio, interview</h2>
        <h3>D1 · README draft</h3>
        <pre className="plain"><code>{"# strata\n\nA text-forensics tool: ingest ugly, heterogeneous log data (Apache/nginx,\nCSV, JSON lines, XML, arbitrary unstructured text — even gzipped, mis-encoded\nor truncated), extract and normalise entities, correlate them into events,\nand query the result as a graph. Built to survive input designed to break it.\n\n## What it does\n\n- Five pluggable formats behind one interface, chosen by confidence-scored\n  content sniffing, never by trusting a file extension alone.\n- Streams input of any size in bounded memory: gzip, BOMs, bad encodings,\n  truncated files and multi-megabyte \"lines\" are all handled explicitly.\n- Extracts and normalises entities (IPs, hosts, paths, timestamps) with a\n  match -> validate -> normalise pipeline, not bare regex matching.\n- Correlates occurrences into events in SQLite (one transaction per batch:\n  ~700x the throughput of naive autocommit-per-row inserts) and links\n  related events into a graph, queryable with recursive SQL.\n- A real command-line tool: subcommands, --help, sysexits-style exit codes,\n  clean shutdown on Ctrl-C, correct behaviour piped into `head`.\n- A deadline-bounded fuzzer (found a real infinite loop in under a second)\n  and a profiling session with a measured 50x fix, both checked into the\n  test suite as permanent regressions.\n- `strata watch`: follows growing log files live, correct across both\n  rename-rotation and copytruncate, resumable after a restart.\n\nNo third-party dependencies beyond DBI, DBD::SQLite, Text::CSV and\nXML::LibXML — no framework, no ORM.\n\n## Quick start\n\n    cpanm --installdeps .\n    ./bin/strata ingest strata.db share/fixtures/*.*\n    ./bin/strata correlate strata.db --gap 60\n    ./bin/strata query strata.db --type ipv4 --value 10.0.5.100\n    ./bin/strata watch strata.db /var/log/myapp\n\n## Commands\n\n    ingest DB FILES...     parse and store records + entity occurrences\n    entities DB FILES...   list extracted entities, ranked\n    correlate DB           build events from occurrences (sessionisation)\n    query DB [filters]     look up records and events\n    graph DB --from ID     walk correlated events as a graph, N hops\n    watch DB DIRS...       live-ingest and live-correlate growing logs\n\n## Architecture\n\n    lib/Strata/\n    ├── Source.pm, Extract.pm, Normalize.pm    survive and clean the input\n    ├── Parser/                                 five formats, one contract\n    ├── Store.pm, Correlate.pm, Graph.pm        SQLite: events and edges\n    └── Log.pm                                  structured logs, audit trail\n\n## Testing\n\n    prove -l t/                    everything, including the fuzzer\n    perl -d:NYTProf bin/strata ...  profile a real invocation\n\nThe fuzz suite (`t/90-fuzz.t`) is deadline-bounded: every case gets one\nsecond via `alarm()`, so a hang is reported as a test failure, never as a\nCI run that quietly never finishes.\n\n## Known limitations\n\n- `watch` polls; past a few hundred files, an inotify-based backend would\n  be needed instead (sketched, not implemented).\n- Correlation runs in one process; ingestion parallelises with `fork`,\n  sessionisation currently does not.\n- No consensus or distribution: one SQLite file, one machine.\n\n## Licence\n\nMIT\n"}</code></pre>
        <p>Three deliberate choices, matching Course 1's README: it <strong>leads with what was measured</strong> (the 700× transaction number, the 50× profiling fix, the sub-second fuzzer find) rather than adjectives; it <strong>names the fuzzer and profiler as permanent parts of the test suite</strong>, not one-off exercises; and it has a <strong>known limitations section</strong>, because a forensics tool that overstates its own reliability is a bad one.</p>
        <h3>D2 · GitHub project description</h3>
        <blockquote>A text-forensics and log-correlation tool in Perl: five formats behind one confidence-scored interface, entity extraction and correlation in SQLite, a fuzzed and profiled parser, and a rotation-safe live tail. Built as a laboratory for Perl's text-processing and Unix-glue strengths.</blockquote>
        <p>Topics: <code>perl</code>, <code>log-analysis</code>, <code>text-processing</code>, <code>sqlite</code>, <code>dbi</code>, <code>cli</code>, <code>fuzzing</code>, <code>forensics</code>, <code>data-correlation</code>, <code>parsing</code>, <code>regex</code>.</p>
        <h3>D3 · Performance considerations</h3>
        <ul>
          <li><strong>Transactions dominate every other consideration for bulk writes.</strong> The single biggest number in this whole project — roughly 700× — came from wrapping inserts in one transaction, not from anything algorithmic.</li>
          <li><strong>An index earns its keep on the query shape that runs most often</strong>, not the one that looks most important. The point lookup, not the full sweep, is what a covering index actually paid for here.</li>
          <li><strong>Measure before optimising the obvious target.</strong> The <code>qr//</code>-caching guess that measured as a no-op, next to the <code>grep</code>-versus-hash dedupe that measured as 50×, is the whole argument for profiling over intuition in one pair of numbers.</li>
          <li><strong>A process-per-file design (<code>fork</code>) parallelises CPU-bound parsing cleanly but does not parallelise a single SQLite writer</strong> — past the point of write contention, more workers stop helping and start costing.</li>
          <li><strong>Bound everything an adversarial or merely malformed file could make unbounded</strong>: line length, decompressed size, and — new in the final challenge — how far a live tail can fall behind before that lag itself needs to be visible.</li>
        </ul>
        <h3>D4 · Security considerations</h3>
        <ul>
          <li><strong>Every SQL statement in this project uses placeholders.</strong> Never interpolate a value — especially one taken from an ingested log line — directly into a SQL string; that is exactly how a forensics tool ingesting attacker-controlled log data becomes attacker-controlled itself.</li>
          <li><strong>Never build a shell command from a filename</strong>, per Milestone 7's exercise: the list form of <code>open</code>/<code>system</code> (arguments as separate strings, no shell interpolation) is mandatory the moment a filename can come from outside the program, because a file literally named <code>; rm -rf ~</code> is a real, if rare, adversarial input.</li>
          <li><strong>Decompression bombs.</strong> Milestone 7 bounds line length and peeks a fixed number of bytes, but nothing here bounds total <em>decompressed</em> volume from a gzip file — a small file on disk can still expand to gigabytes while being read. A production deployment should cap total bytes read per file, not merely per line.</li>
          <li><strong>Sensitive data in <code>raw</code>.</strong> Ingested log lines can contain emails, card-shaped numbers, or credentials, stored verbatim in <code>records.raw</code> unless the redaction stage from exercise C4.3 runs first. Decide deliberately whether raw text belongs in the store at all for a given deployment.</li>
          <li><strong>The store has no access control of its own.</strong> Anyone who can read <code>strata.db</code> can read everything correlated into it; file permissions on the SQLite file are the actual security boundary, and there is no row-level protection layered on top.</li>
          <li><strong><code>strata watch</code> follows any file it is pointed at</strong>, including one that changes ownership or gets replaced by a symlink to something outside the intended log directory. Validate watched paths resolve inside an expected root before trusting what they report.</li>
        </ul>
        <h3>D5 · What to put in your portfolio</h3>
        <p>Do not present this as "a log parser". Present it as what it is: <strong>a forensics pipeline built to survive hostile input at every stage, with every claim about performance and robustness backed by a number you actually measured.</strong> The narrative that makes it interesting is the sequence of real bugs found by testing for them on purpose, not the feature list.</p>
        <ol>
          <li>A parser that trusted well-formed input, broken by six deliberately hostile fixtures — gzip, BOM, bad encoding, truncation, binary bytes, a giant line — each with the specific fix.</li>
          <li>Two false positives in entity extraction (a version number mistaken for an IP, a protocol version mistaken for a path) that only a match-validate-normalise pipeline with context rules catches.</li>
          <li>A ~700× transaction speedup and a ~53× index speedup, both measured, both explained in terms of what SQLite is actually doing differently.</li>
          <li>A fuzzer that found a genuine infinite loop in under a second, turned immediately into a permanent regression test rather than a one-off finding.</li>
          <li>A profiling session where the "obvious" optimisation (cache the regex) measured as a no-op and the unglamorous one (a hash instead of <code>grep</code>) measured as 50×.</li>
          <li>The rotation-safe live tail, and the honest accounting of what it still does not solve (inotify, the rename-instant gap, multi-writer SQLite).</li>
        </ol>
        <p>Keep a <code>docs/</code> folder with the NYTProf HTML report, the <code>EXPLAIN QUERY PLAN</code> output, and one architecture diagram. A reviewer who spends ninety seconds on the repository should come away knowing you test for failure on purpose, not just that the happy path works.</p>
        <h3>D6 · Interview questions someone could ask, and what a good answer contains</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>Question</th>
              <th>What a strong answer includes</th>
            </tr>
            <tr>
              <td>Walk me through the entity extraction design.</td>
              <td>Match, validate, normalise as three distinct steps; two real false positives (version numbers, protocol versions) that a bare regex could not have avoided; context rules as the actual defence. </td>
            </tr>
            <tr>
              <td>Why SQLite and not Postgres or a message queue?</td>
              <td>One file, no server to operate, WAL mode for concurrent readers, and — the honest limit — no multi-writer story past one machine, stated as a known limitation rather than discovered by the interviewer.</td>
            </tr>
            <tr>
              <td>Tell me about a performance bug you found.</td>
              <td>The <code>grep</code>-based dedupe at O(n·u), found by profiling rather than guessing, fixed to O(n) with a hash, with the 50× number and the line-level NYTProf evidence that pointed at it.</td>
            </tr>
            <tr>
              <td>And one where your intuition was wrong?</td>
              <td>The <code>qr//</code> regex-caching guess that measured as a no-op, because Perl's engine already caches an interpolated pattern when the interpolated value hasn't changed — the point being that "obviously slow" and "measurably slow" are different lists, and only profiling tells them apart. </td>
            </tr>
            <tr>
              <td>How does fault tolerance work here?</td>
              <td><code>SIGINT</code> sets a flag rather than acting inside the handler; the main loop commits at a safe point and reports exactly how far it got, verified by actually sending the signal mid-run and checking row counts afterward, not by reading the code and assuming.</td>
            </tr>
            <tr>
              <td>How did you test for concurrency bugs, given Perl doesn't have goroutines or a race detector?</td>
              <td>There is nothing to race on: <code>fork</code> gives each worker an independent address space, so the testing burden shifts entirely to the IPC boundary — correct pipe-end closing, correct reaping, and the deliberate one-way-only design that avoids the classic buffer deadlock.</td>
            </tr>
            <tr>
              <td>What was the hardest bug to find?</td>
              <td>The <code>my (@current, $key, $events) = ((), "", 0)</code> list-assignment slurp: the error surfaced two lines away from the actual cause, and the fix required understanding exactly how Perl fills a mixed list of variables from one flat right-hand list.</td>
            </tr>
            <tr>
              <td>How would you make this production-ready?</td>
              <td>An inotify-based watch backend past a few hundred files, decompressed-size bounds alongside the existing line-length bounds, a redaction stage before <code>raw</code> is ever persisted, and file-permission-based access control on the SQLite file stated explicitly rather than assumed. </td>
            </tr>
            <tr>
              <td>When would you not use Perl for this?</td>
              <td>Go or Rust if the ingest needed true multi-core parsing sharing one in-memory index rather than a SQLite file; a JVM language if this needed to run as a long-lived service inside infrastructure that already standardised on one. Name what Perl won on here: CPAN's depth for exactly these formats, and how little code the streaming and text-handling primitives needed.</td>
            </tr>
            <tr>
              <td>What would you do differently?</td>
              <td>Build the parser contract test in Milestone 6, when the gap was first named, rather than deferring it to Milestone 11; design the <code>watch_state</code> schema before writing the polling loop rather than after; and decide the rename-rotation gap's trade-off explicitly at design time instead of discovering it while writing the final challenge's write-up.</td>
            </tr>
          </tbody>
        </table>
        <h3>D7 · Extensions worth building</h3>
        <ul>
          <li><strong>An inotify backend for <code>watch</code></strong>, falling back to polling automatically when <code>Linux::Inotify2</code> is unavailable or the platform is not Linux.</li>
          <li><strong>A web UI</strong> over <code>query</code> and <code>graph</code> — this project deliberately stayed command-line-only; a small <code>Mojolicious</code> app rendering the graph queries as an actual graph would be a natural, contained extension.</li>
          <li><strong>Streaming JSON Lines output</strong> for every command, so <code>strata</code> composes with <code>jq</code> the way a well-behaved Unix tool should, beyond the one flag sketched in Exercise 10. </li>
          <li><strong>A second storage backend</strong> (Postgres, via the same <code>DBI</code> interface with different SQL for the recursive query and the pragmas) to see how much of <code>Strata::Store</code> is genuinely portable and how much quietly assumed SQLite.</li>
          <li><strong>The differential fuzzer from C5</strong>, which is the most educationally valuable of these by a distance.</li>
        </ul>
        <hr />
        <h2><span className="num">Course 3 complete</span>What you built</h2>
        <p>A dependency-light Perl distribution across roughly a dozen modules, five parsers behind one contract, a SQLite-backed correlation and graph engine with measured order-of-magnitude performance differences, a command-line tool that behaves correctly under a signal and inside a pipeline, a fuzzer that found a real bug in under a second, and a live log tailer that survives both ways a log file can change out from under you. More importantly: a habit of writing the hostile fixture before trusting the code that has to survive it, and of measuring a claimed speedup before writing it down.</p>
        <p>The central question of this curriculum was <em>what kinds of problems does this language make unusually natural to solve?</em> Perl's answer, stated as precisely as this project allows: <strong>problems where the input is real-world messy, the shape of "correct" is "did not corrupt or lose the awkward 10% of records", and the win comes from CPAN's decades of exactly-this-format modules plus a handful of small, sharp built-in idioms — context, autovivification, <code>foreach</code> aliasing, <code>alarm()</code>, <code>fork</code> — that read as strange in isolation and as exactly right once you have needed them once.</strong> Not the fastest, not the most structured, not the friendliest first error message. The one where a text file nobody designed on purpose stops being a mystery in an afternoon.</p>
        <p>Courses 4 and 5 continue the same comparison — Erlang's processes and supervision trees against Go's goroutines and Perl's <code>fork</code>, and Racket's macros against the recursive-descent parser built in this instalment's advanced phase — but are not written yet. The <Link href="/overview/">syllabus overview</Link> describes what they will cover.</p>
        <footer className="end">
          <p>Instalment 15 of the five-course curriculum, and the end of Course 3. Courses 4 (Erlang) and 5 (Racket) are next in the curriculum but not yet written.</p>
        </footer>
         <Link className="button" href="/">Back to Mewlang</Link> 
      </div>
    </div>
  );
}
