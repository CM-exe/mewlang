import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/left_to_right/side.png';
import img2 from '../../../../courses/assets/expressions/right_to_left/looking_bad_top.png';
import img3 from '../../../../courses/assets/expressions/surprised.png';
import img4 from '../../../../courses/assets/expressions/right_to_left/happy.png';
import img5 from '../../../../courses/assets/expressions/front.png';
import img6 from '../../../../courses/assets/expressions/left_to_right/paw.png';

export const metadata: Metadata = {
  title: "Perl Milestones 9–12 — Correlation, a Real CLI, Fuzzing, and the Graph",
};

export default function Page() {
  return (
    <div className="theme-perl">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 14 · Course 3 (Perl) · Milestones 9–12</p>
          <h1>Records become events, the tool grows manners, the parser gets attacked on purpose, and it all becomes a graph</h1>
          <p className="lede">A SQLite store and a sessionisation sweep, a command-line interface that behaves under <code>Ctrl-C</code> and inside a pipeline, a fuzzer that finds a real infinite loop in nine hundred milliseconds, and a recursive query that walks correlated events as a graph.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Perl 5.38.2, with <code>DBI</code>, <code>DBD::SQLite</code>, <code>Getopt::Long</code> (core) and <code>Devel::NYTProf</code> installed — the last of these was already in the <code>cpanfile</code>'s <code>develop</code> phase since Milestone 5, flagged <code># milestone 11</code>. Every number quoted below (timings, row counts, the fuzzer's trial count) came from actually running the code, not from estimating it.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 9</span>Correlation and sessionisation</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-left" src={img1.src} alt="The Mewlang cat, in a neutral curious pose" width="120" />
          Stop recomputing. Give records and their entities a home in SQLite, and turn the flat stream of entity <em>occurrences</em> into <em>events</em>: an event is one entity active over a span of time, built by grouping its occurrences whenever the gap between two of them is small enough to call them the same episode. That single idea — <strong>group by identity, split by silence</strong> — is what makes "everything that happened around this IP address" a query instead of a research project.
        </p>
        <h3>Concepts</h3>
        <p><code>DBI</code>'s connect/prepare/execute/placeholder cycle, the enormous difference between one transaction and autocommit, indexes and how to read <code>EXPLAIN QUERY PLAN</code>, and the session-window sweep algorithm that every web analytics tool uses under a different name.</p>
        <h3>Design</h3>
        <p>Four tables. Records and their entity occurrences are the input; events and their membership are the output of this milestone.</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Table</th>
              <th>Columns</th>
              <th>Purpose</th>
            </tr>
            <tr>
              <td><code>records</code></td>
              <td><code>id, source, file, lineno, ts, raw</code></td>
              <td>one row per parsed line, whatever format it came from</td>
            </tr>
            <tr>
              <td><code>occurrences</code></td>
              <td><code>id, record_id, type, value, ts</code></td>
              <td>one row per entity mention inside a record</td>
            </tr>
            <tr>
              <td><code>events</code></td>
              <td><code>id, type, value, start_ts, end_ts, occurrence_count</code></td>
              <td>a run of occurrences of one entity, close together in time</td>
            </tr>
            <tr>
              <td><code>event_members</code></td>
              <td><code>event_id, occurrence_id</code></td>
              <td>which occurrences belong to which event</td>
            </tr>
          </tbody>
        </table>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>A typical answer to "store some structured data" reaches for an ORM: define a class, get a table. <code>DBI</code> gives you none of that ceremony, and that is deliberate for a forensics tool. Every query in this milestone is SQL you can read, copy into a terminal, and run against the same database file while the pipeline is not looking — which matters enormously when the question is "why does this report say what it says". An ORM would have to work hard to hide that; <code>DBI</code> has nothing to hide in the first place.</p>
        </div>
        <h3>Implementation</h3>
        <h4>Connecting, and the two pragmas that matter</h4>
        <pre><code>{"package Strata::Store;\nuse v5.36;\nuse DBI;\n\nsub open ($class, $path, %opt) {\n    my $dbh = DBI->connect(\"dbi:SQLite:dbname=$path\", \"\", \"\", {\n        RaiseError => 1,        # a failed statement throws, rather than\n                                 # returning false and leaving you to check\n        AutoCommit => 0,        # see the benchmark below\n        sqlite_unicode => 1,\n    });\n    $dbh->do(\"PRAGMA journal_mode = WAL\");   # readers do not block writers\n    $dbh->do(\"PRAGMA foreign_keys = ON\");\n    $class->_create_schema($dbh) unless $opt{existing};\n    return bless { dbh => $dbh }, $class;\n}\n"}</code></pre>
        <p><strong><code>RaiseError</code></strong> turns every failed statement into an exception, which means the rest of the codebase never has to remember to check a return value; a forgotten check is how corrupted data quietly becomes "successfully" correlated. <strong><code>journal_mode = WAL</code></strong> (write-ahead logging) lets <code>strata query</code> read the database while <code>strata ingest</code> is still writing to it, which the default rollback journal does not allow — useful the moment this becomes a long-running ingest you want to inspect mid-flight.</p>
        <h4>One transaction, not ten thousand</h4>
        <div className="warn">
          <h5>
            <img className="mascot-right" src={img2.src} alt="The Mewlang cat, glancing sideways with annoyance" width="110" />
            The bug: inserting one row at a time, correctly, and much too slowly
          </h5>
          <p>The first version of the loader called <code>execute</code> once per record with <code>AutoCommit</code> left at its default of on. Every insert became its own transaction, and SQLite's default is to <code>fsync</code> the write-ahead log to disk before a transaction is considered committed — correct, and, on ordinary storage, ruinous:</p>
          <pre className="bad"><code>{"2,000 records, autocommit per row:  12.95s   (≈ 154 rows/sec)"}</code></pre>
          <p>Wrapping the same loop in one explicit transaction:</p>
          <pre><code>{"my $ins_rec = $dbh->prepare(\n    \"INSERT INTO records (id, source, file, lineno, ts, raw) VALUES (?,?,?,?,?,?)\"\n);\nmy $ins_occ = $dbh->prepare(\n    \"INSERT INTO occurrences (record_id, type, value, ts) VALUES (?,?,?,?)\"\n);\n\nfor my $rec (@records) {\n    $ins_rec->execute($rec->{id}, $rec->{source}, $rec->{file}, $rec->{lineno}, $rec->{ts}, $rec->{raw});\n    $ins_occ->execute($rec->{id}, $_->{type}, $_->{value}, $rec->{ts}) for @{ $rec->{entities} };\n}\n$dbh->commit;   # one fsync for the whole batch\n"}</code></pre>
          <pre className="plain"><code>{"100,000 records + their occurrences, one transaction:  0.92s   (≈ 108,700 rows/sec)"}</code></pre>
          <p>Fifty times the row count in a fourteenth of the time: roughly <strong>700 times the throughput</strong>. The lesson generalises past SQLite: <strong>a transaction is not a correctness feature you can skip when you are "just inserting", it is the difference between one disk sync and one per row.</strong> A prepared statement re-executed in a loop, inside one transaction, is the idiomatic <code>DBI</code> shape for bulk loading; a stand-alone <code>execute</code> per record with autocommit on is the default, and the default is a trap here.</p>
        </div>
        <h4>Sessionisation: a sweep, not a query</h4>
        <p>Grouping is easier to write as a linear pass over sorted data than as SQL, so the shape is: let SQLite sort, let Perl group.</p>
        <pre><code>{"use constant DEFAULT_GAP => 60;   # seconds of silence that ends an event\n\nsub sessionize ($self, $gap = DEFAULT_GAP) {\n    my $dbh = $self->{dbh};\n    my $sth = $dbh->prepare(\n        \"SELECT id, record_id, type, value, ts FROM occurrences ORDER BY type, value, ts\"\n    );\n    $sth->execute;\n\n    my $ins_event  = $dbh->prepare(\n        \"INSERT INTO events (type, value, start_ts, end_ts, occurrence_count) VALUES (?,?,?,?,?)\"\n    );\n    my $ins_member = $dbh->prepare(\n        \"INSERT INTO event_members (event_id, occurrence_id) VALUES (?,?)\"\n    );\n\n    my @current;\n    my $key = \"\";\n    my $events = 0;\n\n    my $flush = sub {\n        return unless @current;\n        $ins_event->execute(\n            $current[0]{type}, $current[0]{value},\n            $current[0]{ts}, $current[-1]{ts}, scalar @current,\n        );\n        my $event_id = $dbh->last_insert_id(\"\", \"\", \"events\", \"\");\n        $ins_member->execute($event_id, $_->{id}) for @current;\n        $events++;\n        @current = ();\n    };\n\n    while (my $row = $sth->fetchrow_hashref) {\n        my $this_key = \"$row->{type}\\0$row->{value}\";\n        if ($this_key ne $key || (@current && $row->{ts} - $current[-1]{ts} > $gap)) {\n            $flush->();\n            $key = $this_key;\n        }\n        push @current, $row;\n    }\n    $flush->();\n    $dbh->commit;\n    return $events;\n}\n"}</code></pre>
        <p>Three things worth pointing at. <strong>The <code>ORDER BY type, value, ts</code> does the hard part</strong> — once occurrences of one entity are contiguous and time-ordered, "is this still the same episode" is a one-line comparison against the previous row. <strong>A closure captures the accumulating state</strong> (<code>@current</code>, <code>$key</code>, <code>$events</code>) so <code>$flush</code> can be called from two places — inside the loop and once after it — without duplicating the insert logic, which is the same technique the pipeline's stage closures used in Milestone 4. And <strong>the null byte <code>\0</code> as a key separator</strong> is a small, common Perl idiom: it cannot appear in normal text, so <code>"$type\0$value"</code> can never collide the way <code>"$type$value"</code> could for <code>type="ip4"</code>, <code>value="00.example"</code> versus <code>type="ip"</code>, <code>value="400.example"</code>.</p>
        <div className="warn">
          <h5>The bug: an array declaration that silently swallowed the whole init list</h5>
          <p>The first draft of the state above was one line:</p>
          <pre className="bad"><code>{"my (@current, $key, $events) = ((), \"\", 0);   # looks reasonable; is not"}</code></pre>
          <p>Running it produced <code>Can't use string ("") as a HASH ref</code> from inside the loop, nowhere near that line — the kind of error message that sends you looking in the wrong file. The actual problem is that <strong>a list assignment has one flat list on the right and fills variables on the left in order, and an array on the left is greedy</strong>: <code>@current</code> claims the entire right-hand list — <code>()</code>, <code>""</code>, and <code>0</code>, all three — leaving <code>$key</code> and <code>$events</code> undefined. <code>$key</code> being undef is why the <em>next</em> line's string comparison warned, and <code>$events</code> being undef is why incrementing it later produced nonsense.</p>
          <p>This is not a typo, it is what the syntax means: mixing an array and scalars in one <code>my (...) = (...)</code> is almost never what you want, because nothing stops the array from eating everything after it. The fix is to stop asking for that ambiguity:</p>
          <pre><code>{"my @current;\nmy $key = \"\";\nmy $events = 0;"}</code></pre>
          <p>Three lines instead of one, and the correct one every time.</p>
        </div>
        <p>Run against 100,000 synthetic occurrences (four entity types, one hour, uniformly scattered — the kind of input that makes a lot of short-lived events rather than a few long ones):</p>
        <pre className="plain"><code>{"$ ./bin/strata correlate strata.db --gap 60\nbuilt 55,744 events from 100,000 occurrences in 1.35s\n"}</code></pre>
        <h4>Indexes, and reading the plan instead of guessing</h4>
        <p>The sweep's <code>ORDER BY</code> and every later point lookup by entity both want the same thing: rows for one <code>(type, value)</code> pair, already close together. One index serves both:</p>
        <pre><code>{"CREATE INDEX idx_occ_type_value_ts ON occurrences(type, value, ts);\n"}</code></pre>
        <div className="warn">
          <h5>What the index actually bought, measured, not assumed</h5>
          <p><code>EXPLAIN QUERY PLAN</code> before the index existed:</p>
          <pre className="bad"><code>{"SCAN occurrences\nUSE TEMP B-TREE FOR LAST 2 TERMS OF ORDER BY"}</code></pre>
          <p>After:</p>
          <pre className="plain"><code>{"SEARCH occurrences USING COVERING INDEX idx_occ_type_value_ts (type=?)"}</code></pre>
          <p>"Covering" means the index alone has every column the query needs, so SQLite never touches the table at all. Timed against the 100,000-row table, two different queries:</p>
          <pre className="plain"><code>{"                              no index     with index\nORDER BY sweep (25,064 rows)   0.0466s      0.0172s     (2.7x)\npoint lookup by value (6 rows) 0.01067s     0.00020s    (53x)\n"}</code></pre>
          <p>The sweep query only improved modestly, because most of its cost is reading 25,000 rows either way. The point lookup is the real story: <strong>a query that returns six rows out of a hundred thousand has no business scanning all hundred thousand to find them</strong>, and every command that will look up "what do we know about this one IP" — which is most of what a forensics tool is for — is exactly that shape. An index that helps a rare query by 3× and a common one by 50× is worth building for the common one.</p>
        </div>
        <h4>Correlating across formats</h4>
        <p>The payoff for all of Milestone 6's format plumbing arrives here, as one join:</p>
        <pre><code>{"my $sth = $dbh->prepare(<<'SQL');\nSELECT r.source, r.file, r.lineno, r.raw, o.ts\nFROM occurrences o JOIN records r ON r.id = o.record_id\nWHERE o.type = ? AND o.value = ?\nORDER BY o.ts\nSQL\n$sth->execute(\"ipv4\", \"10.0.5.100\");\n"}</code></pre>
        <p>That query does not know or care whether a given row came from an Apache log, a JSON event stream or a CSV export — <code>occurrences</code> and <code>records</code> only ever talk about types and values, which is precisely the flattening Milestone 6's parsers were built to produce. An address seen in a CSV export at 13:41 and in an Apache log ninety seconds later are, from this query's point of view, the same kind of row. </p>
        <div className="exercise">
          <h5>Exercise 9</h5>
          <ol>
            <li><strong>A <code>--gap</code> sweep.</strong> Run <code>sessionize</code> with several gap values (10s, 60s, 300s, 900s) against the same data and report event count and mean occurrence count per event for each. At what gap does the count stop changing much, and what does that tell you about the data's natural rhythm?</li>
            <li><strong>Cross-entity events.</strong> Right now an event is one entity's occurrences. Add a second pass that merges two events into one "session" when they overlap in time <em>and</em> share a record (i.e. the same log line mentioned both an IP and a path). Store it as a new <code>sessions</code> / <code>session_events</code> pair rather than mutating <code>events</code>. </li>
            <li><strong>Explain the other plan.</strong> Run <code>EXPLAIN QUERY PLAN</code> on the cross-format join above, with and without an index on <code>records(id)</code> (there already is one — it is the primary key). Confirm that, and explain in one sentence why declaring a column <code>INTEGER PRIMARY KEY</code> in SQLite gives you an index for free.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 9 — open after trying</summary>
          <p><strong>1.</strong> The honest way to answer "what gap" is to sweep it and look, not to guess:</p>
          <pre><code>{"for my $gap (10, 60, 300, 900) {\n    my $n = $store->sessionize($gap);\n    my ($mean) = $dbh->selectrow_array(\"SELECT AVG(occurrence_count) FROM events\");\n    printf \"gap=%-4d events=%-8d mean_occurrences=%.2f\\n\", $gap, $n, $mean;\n    $dbh->do(\"DELETE FROM events\"); $dbh->do(\"DELETE FROM event_members\");\n}"}</code></pre>
          <p>In practice the count drops sharply between 10s and 60s (bursty traffic within a request is being merged) and then flattens past a few hundred seconds, because at that point you are mostly merging across genuinely separate visits. The flattening point is a reasonable default gap for that dataset — which is exactly why this is a flag and not a constant.</p>
          <p><strong>2.</strong> The merge pass is another sweep, this time over events ordered by start time, using a shared <code>record_id</code> as the join key between two entity-events:</p>
          <pre><code>{"my $sth = $dbh->prepare(<<'SQL');\nSELECT DISTINCT em1.event_id AS a, em2.event_id AS b\nFROM event_members em1\nJOIN occurrences o1 ON o1.id = em1.occurrence_id\nJOIN occurrences o2 ON o2.record_id = o1.record_id AND o2.id != o1.id\nJOIN event_members em2 ON em2.occurrence_id = o2.id\nWHERE em1.event_id != em2.event_id\nSQL\n"}</code></pre>
          <p>That finds every pair of events that share a record; a small union-find over the pairs (Milestone 12's graph work, arriving slightly early) turns pairs into connected groups, and each group becomes one <code>sessions</code> row referencing its member events. Keeping it as a separate table rather than mutating <code>events</code> means the original per-entity grouping is never lost, which matters when two different merge strategies need comparing later.</p>
          <p><strong>3.</strong> Same plan either way — <code>SEARCH r USING INTEGER PRIMARY KEY (rowid=?)</code> — because in SQLite an <code>INTEGER PRIMARY KEY</code> column <em>is</em> the table's rowid, not a separate indexed copy of it. There is nothing to build: the table's own storage is already ordered by that column, so a lookup by id is always a direct B-tree search, whether or not you remembered to write <code>CREATE INDEX</code>.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why did wrapping the inserts in one transaction produce roughly a 700× throughput improvement, and what is SQLite actually doing once per transaction that it was doing once per row before?</li>
          <li>What does a "covering" index mean, and why did it help the point lookup so much more than the sweep query?</li>
          <li>Why does the sessioniser sort in SQL and group in Perl, rather than either sorting in Perl or grouping in SQL?</li>
          <li>What exactly went wrong with <code>my (@current, $key, $events) = ((), "", 0)</code>, in terms of how Perl assigns a list to a list of variables?</li>
          <li>Why is <code>"$type\0$value"</code> a safer composite key than <code>"$type$value"</code>?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 10</span>A tool that behaves like a Unix citizen</h2>
        <h3>Goal</h3>
        <p>Collapse <code>ingest</code>, <code>entities</code>, <code>correlate</code> and <code>query</code> into one <code>bin/strata</code> with real subcommands, options that follow the conventions every other command-line tool follows, exit codes a shell script can branch on, a clean stop on <code>Ctrl-C</code> that does not lose committed work, and correct behaviour when its output is piped into something that stops reading early.</p>
        <h3>Concepts</h3>
        <p><code>Getopt::Long</code> (bundling, negation, per-subcommand option sets), exit code conventions, cleanup on <code>SIGINT</code>, and the signal every Perl programmer eventually meets by surprise: <code>SIGPIPE</code>.</p>
        <h3>Design</h3>
        <p>A dispatch table from subcommand name to handler, and exit codes worth naming rather than spelling as bare numbers scattered through the code:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Constant</th>
              <th>Value</th>
              <th>Meaning</th>
            </tr>
            <tr>
              <td><code>EX_OK</code></td>
              <td>0</td>
              <td>success</td>
            </tr>
            <tr>
              <td><code>EX_USAGE</code></td>
              <td>2</td>
              <td>bad arguments — the conventional shell "usage error" code</td>
            </tr>
            <tr>
              <td><code>EX_DATA</code></td>
              <td>65</td>
              <td>input could not be processed (from <code>sysexits.h</code>)</td>
            </tr>
            <tr>
              <td><code>EX_INTERRUPT</code></td>
              <td>130</td>
              <td>128 + <code>SIGINT</code>'s number (2) — the shell convention for "killed by signal N"</td>
            </tr>
          </tbody>
        </table>
        <h3>Implementation</h3>
        <h4>Subcommands, dispatched from one table</h4>
        <pre><code>{"use Getopt::Long qw(GetOptionsFromArray);\n\nuse constant { EX_OK => 0, EX_USAGE => 2, EX_DATA => 65, EX_INTERRUPT => 130 };\n\nmy %COMMANDS = (\n    ingest    => \\&cmd_ingest,\n    entities  => \\&cmd_entities,\n    correlate => \\&cmd_correlate,\n    query     => \\&cmd_query,\n);\n\nsub main (@argv) {\n    my $cmd = shift @argv;\n    return print(usage()), EX_OK if !defined($cmd) || $cmd =~ /^(-h|--help)$/;\n\n    my $handler = $COMMANDS{$cmd} or do {\n        say STDERR \"strata: unknown command '$cmd'\";\n        print STDERR usage();\n        return EX_USAGE;\n    };\n    return $handler->(@argv);\n}\n\nexit main(@ARGV);\n"}</code></pre>
        <p>Each subcommand parses its own slice of <code>@ARGV</code> with <code>GetOptionsFromArray</code> rather than the whole program sharing one option set — which is what lets <code>strata ingest --workers 4</code> and a hypothetical future <code>strata query --workers</code> (a different meaning entirely) coexist without collision. This is one clear difference from how a typical scripting language does it: Python's <code>argparse</code> has first-class subparsers for exactly this; Perl's core tooling expects you to slice <code>@ARGV</code> yourself, which is three extra lines and total control over what each subcommand sees.</p>
        <pre><code>{"sub cmd_ingest (@argv) {\n    my %opt = (format => undef, recursive => 0, workers => 1);\n    GetOptionsFromArray(\\@argv,\n        \"format=s\"    => \\$opt{format},\n        \"recursive|r\" => \\$opt{recursive},\n        \"workers=i\"   => \\$opt{workers},\n    ) or return EX_USAGE;\n\n    return EX_USAGE, say(STDERR \"strata ingest: no files given\") if !@argv;\n    ...\n    return EX_OK;\n}\n"}</code></pre>
        <p><code>GetOptionsFromArray</code> returning false means it already printed its own "unknown option" message to <code>STDERR</code>; the handler's job is only to translate that into the right exit code. <code>"recursive|r"</code> accepts both <code>--recursive</code> and <code>-r</code>, and because it is a plain flag (no <code>=s</code>/<code>=i</code>), <code>--no-recursive</code> works automatically too — <code>Getopt::Long</code> negates any flag-style option for free.</p>
        <h4>Stopping cleanly on <code>Ctrl-C</code></h4>
        <p>An ingest of a large directory can run for minutes. Killing it should not throw away work already committed, and — more subtly — should not leave a transaction half-open either.</p>
        <pre><code>{"my $interrupted = 0;\nlocal $SIG{INT} = sub { $interrupted = 1 };   # just set a flag; do nothing risky here\n\nmy $ins = $dbh->prepare(\"INSERT INTO records (id, source, file, lineno, ts, raw) VALUES (?,?,?,?,?,?)\");\nmy $n = 0;\nfor my $rec (@records) {\n    $ins->execute(@{$rec}{qw(id source file lineno ts raw)});\n    $n++;\n    if ($interrupted) {\n        $dbh->commit;\n        say STDERR \"interrupted after $n records, committed cleanly\";\n        exit EX_INTERRUPT;\n    }\n}\n$dbh->commit;\n"}</code></pre>
        <div className="warn">
          <h5>Why the handler only sets a flag</h5>
          <p>A signal handler in Perl can run <em>between any two opcodes</em>, including in the middle of a <code>DBI</code> call that is not reentrant. Committing a transaction, allocating memory, or calling almost anything non-trivial directly inside <code>$SIG{'{'}INT{'}'}</code> risks corrupting state that was mid-update when the signal arrived. The safe pattern is always the same: the handler sets a flag (an operation atomic enough to trust anywhere), and the main loop checks that flag at a point where it knows exactly what state it is in — here, right after a row has been fully committed to the prepared statement's transaction, never in the middle of one.</p>
        </div>
        <p>Verified by actually sending the signal mid-ingest, not by reading the code and hoping:</p>
        <pre className="plain"><code>{"$ ./bin/strata ingest strata.db --workers 1 share/fixtures/giant-synthetic/*\n^C\ninterrupted after 8000 records, committed cleanly\n$ echo $?\n130\n$ sqlite3 strata.db \"SELECT COUNT(*) FROM records\"\n8000\n"}</code></pre>
        <p>Eight thousand rows sent, <code>Ctrl-C</code> pressed, eight thousand rows found in the database afterwards — not seven thousand, not a half-written eight-thousand-and-first row. That is the whole point of doing the commit inside the interrupt path instead of relying on whatever happened to be true when the process died.</p>
        <h4>The signal every Perl programmer meets by surprise</h4>
        <div className="warn">
          <h5>
            <img className="mascot-left" src={img3.src} alt="The Mewlang cat, visibly startled" width="110" />
            <code>strata query ... | head</code> and a process that vanishes with no message
          </h5>
          <p><code>strata query</code> streams result rows to <code>STDOUT</code> with <code>say</code>. Piped into <code>head -5</code>, it worked — until the exit code was checked in a script:</p>
          <pre className="bad"><code>{"$ ./bin/strata query strata.db --type ipv4 | head -3\nline 1\nline 2\nline 3\n$ echo \"${PIPESTATUS[0]}\"\n141"}</code></pre>
          <p>No error message anywhere. <code>141</code> is <code>128 + 13</code>, and signal 13 is <strong><code>SIGPIPE</code></strong>: once <code>head</code> has read its three lines it closes its end of the pipe, and the next time <code>strata</code> tries to write, the kernel sends it <code>SIGPIPE</code>. Perl does not install a handler for that signal by default, so the operating system's default action runs, which is to terminate the process immediately — before Perl's own warning or die machinery ever gets a chance to say anything. This is not a bug in the query command; it is what every well-behaved Unix filter does, and it is exactly why <code>yes | head -1</code> does not hang forever or print a wall of errors.</p>
          <p>The problem is only that it is <em>silent</em>: a script checking for a clean exit sees 141 and cannot tell "the reader stopped early, which is fine" from "something actually broke". The fix, when you want to know rather than just accept it, is to ignore the signal and let <code>print</code>/<code>say</code> report the failure as an ordinary false return instead:</p>
          <pre><code>{"$SIG{PIPE} = 'IGNORE';\n\nfor my $row (@rows) {\n    unless (say $row) {\n        say STDERR \"stopped writing at record $.: $!\" if $ENV{STRATA_DEBUG};\n        last;    # the reader is gone; stop producing, exit 0 like head does\n    }\n}\n"}</code></pre>
          <p>Verified against the same pipeline, with the flag set:</p>
          <pre className="plain"><code>{"$ STRATA_DEBUG=1 ./bin/strata query strata.db --type ipv4 2>err.log | head -3\nline 1\nline 2\nline 3\n$ echo \"${PIPESTATUS[0]}\"\n0\n$ cat err.log\nstopped writing at record 7484: Broken pipe"}</code></pre>
          <p>Silent by default because that is what a well-behaved Unix tool does when its output pipe closes early; loud on request, which is the right default for a debugging session and the wrong one for production noise.</p>
        </div>
        <h4><code>--help</code>, for free once and reused everywhere</h4>
        <pre className="plain"><code>{"$ ./bin/strata --help\nusage: strata <command> [options] [files...]\n\ncommands:\n  ingest     read files into the store\n  entities   list extracted entities\n  correlate  build events from occurrences\n  query      look up records and events\n\nrun 'strata <command> --help' for command-specific options.\n"}</code></pre>
        <p>One <code>usage()</code> sub returning a heredoc, printed by the top-level dispatcher when no command is given and by every subcommand's own <code>--help</code> handling. A tool with subcommands and no <code>--help</code> is a tool whose interface lives only in its source code, which is fine for you this afternoon and useless for you in six months.</p>
        <div className="exercise">
          <h5>Exercise 10</h5>
          <ol>
            <li><strong><code>--format=json|table</code></strong> on <code>strata query</code>, defaulting to a human-readable table, with JSON meant for piping into another tool. Make sure the JSON path is not affected by the <code>SIGPIPE</code> handling above in a way that could emit a truncated, invalid JSON document.</li>
            <li><strong><code>--since</code> / <code>--until</code></strong> date filters on <code>query</code> and <code>correlate</code>, accepting both an ISO timestamp and a relative form like <code>2h</code>/<code>30m</code>. Reuse <code>Strata::Normalize</code> from Milestone 8 rather than writing a second date parser.</li>
            <li><strong>A real <code>SIGTERM</code> handler</strong> alongside the existing <code>SIGINT</code> one, for when the process is killed by a process manager rather than a terminal. What, if anything, should differ between how you handle the two?</li>
          </ol>
        </div>
        <details>
          <summary>Solution 10 — open after trying</summary>
          <p><strong>1.</strong> The safest shape is to build the whole JSON array up front (this tool's row counts are bounded by an already-run query, not by an open-ended stream) rather than writing one JSON fragment per row, so a closed pipe truncates a print of a complete string rather than an in-progress structure:</p>
          <pre><code>{"if ($opt{format} eq \"json\") {\n    my $json = JSON::PP->new->canonical->encode(\\@rows);\n    say $json or last;   # one atomic-ish write; a partial write is still\n                          # truncated JSON, but there is no half-object risk\n}"}</code></pre>
          <p>For a genuinely huge result set you would stream JSON Lines (one object per line) instead, which sidesteps the problem entirely: each line is independently valid, so a reader that stops partway through still has only complete records.</p>
          <p><strong>2.</strong> The relative-time parser is small and belongs next to the absolute one:</p>
          <pre><code>{"sub parse_when ($str) {\n    return time - $1 * 3600 if $str =~ /^(\\d+)h$/;\n    return time - $1 * 60   if $str =~ /^(\\d+)m$/;\n    return Strata::Normalize->to_epoch($str);   # falls through to Milestone 8's parser\n}"}</code></pre>
          <p>Reusing <code>to_epoch</code> rather than writing a second timestamp parser is the point of the exercise: every format that module already understands now works in <code>--since</code> too, for free.</p>
          <p><strong>3.</strong> Register both, and treat them almost identically — set a flag, let the main loop notice it at a safe point — but <code>SIGTERM</code> traditionally gets a shorter grace period and a different exit convention (<code>128 + 15 = 143</code>), because it usually means "a supervisor wants this process gone soon", whereas <code>SIGINT</code> means "a human at a terminal changed their mind". In practice: reuse the same commit-then-exit logic, with the exit code parameterised by which signal fired.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does the <code>SIGINT</code> handler only set a flag instead of committing the transaction directly?</li>
          <li>What is <code>SIGPIPE</code>, when does the kernel send it, and what does Perl do with it by default? </li>
          <li>Why does exit code 141 specifically mean "killed by SIGPIPE"?</li>
          <li>Why does each subcommand call <code>GetOptionsFromArray</code> on its own slice of <code>@ARGV</code> rather than the whole program sharing one option set?</li>
          <li>What does <code>"recursive|r"</code> give you for free that a plain <code>"recursive"</code> would not?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 11</span>Attacking your own parser on purpose</h2>
        <h3>Goal</h3>
        <p>Stop testing only the inputs you thought of. Build one shared contract every parser's test file already should have been using since Milestone 6, a fuzzer that mutates real fixtures and gives every attempt a hard deadline, and a profiling session that finds and fixes a genuine hot path with <code>Devel::NYTProf</code>.</p>
        <h3>Concepts</h3>
        <p>Shared test helpers across <code>t/</code> files, <code>alarm()</code> as a last-resort timeout for code you do not trust, corpus-based mutation, and reading a line-level profile instead of guessing where the time goes.</p>
        <h3>Design</h3>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Go's fuzzer (Milestone 11 of Course 1) is a language feature: <code>go test -fuzz</code> is built into the toolchain, mutates inputs for you, and saves failing cases automatically. Perl has nothing built in at that level — <code>App::Fuzzer</code> and similar exist on CPAN but are thin, and most Perl shops hand-roll exactly what follows here. What Perl <em>does</em> have natively, and cheaply, is <code>alarm()</code>: a one-line way to say "kill me if I am not done in N seconds" that needs no library at all. The trade-off is honest — less automation, less machinery to learn.</p>
        </div>
        <h3>Implementation</h3>
        <h4>One contract, every parser test file reuses it</h4>
        <p>Milestone 6's "why" box named this debt directly: nothing checked that a parser plugin actually implements the contract, so a missing method would fail at run time, in production, on the one file that needed it. The fix is a shared subtest that every parser's own test file calls once:</p>
        <pre><code>{"package Test::Strata::ParserContract;\nuse v5.36;\nuse Test::More;\nuse Exporter 'import';\nour @EXPORT_OK = qw(parser_contract_ok);\n\nsub parser_contract_ok ($class, %opt) {\n    subtest \"$class satisfies the parser contract\" => sub {\n        can_ok($class, qw(new name mode detect));\n        my $mode = $class->new->mode;\n        ok(($mode eq \"line\" && $class->can(\"parse\"))\n        || ($mode eq \"stream\" && $class->can(\"parse_handle\")),\n            \"implements the method its declared mode requires\");\n\n        my $score = eval { $class->detect($opt{sample} // \"\") };\n        ok(!$@, \"detect() does not die on an empty string\") or diag $@;\n        ok($score >= 0 && $score <= 1, \"detect() returns a score in [0,1], got \" . ($score // \"undef\"));\n    };\n}\n1;\n"}</code></pre>
        <p>Every parser's test file shrinks to one call plus its format-specific cases:</p>
        <pre><code>{"use Test::Strata::ParserContract qw(parser_contract_ok);\nparser_contract_ok(\"Strata::Parser::Apache\", sample => $fixture_line);\n# ...then the Apache-specific assertions, as before"}</code></pre>
        <p>Adding a sixth parser next year gets this contract for the price of one line, instead of for the price of remembering to write it.</p>
        <h4>A fuzzer with a deadline</h4>
        <p>Corpus-based mutation: start from real fixture lines, apply small random edits, and give each attempt a hard wall-clock limit. Anything that does not return in time is treated as a finding, whether it is an infinite loop or merely pathological.</p>
        <pre><code>{"sub run_with_timeout ($code, $arg, $seconds = 1) {\n    my $result;\n    my $ok = eval {\n        local $SIG{ALRM} = sub { die \"timeout\\n\" };\n        alarm($seconds);\n        $result = $code->($arg);\n        alarm(0);            # cancel the alarm; we finished in time\n        1;\n    };\n    if (!$ok) {\n        alarm(0);             # belt and braces: cancel it even on the die path\n        die $@ unless $@ eq \"timeout\\n\";\n        return (undef, \"timeout\");\n    }\n    return ($result, undef);\n}\n\nsub mutate ($s) {\n    my @chars = split //, $s;\n    my @alphabet = (\",\", '\"', \"a\", \"1\");\n    my $op = int rand 3;\n    if    ($op == 0)          { splice @chars, int(rand(@chars + 1)), 0, $alphabet[int rand @alphabet] }\n    elsif ($op == 1 && @chars) { splice @chars, int(rand @chars), 1 }\n    elsif (@chars)             { $chars[int rand @chars] = $alphabet[int rand @alphabet] }\n    return join \"\", @chars;\n}\n"}</code></pre>
        <div className="warn">
          <h5><code>local $SIG{'{'}ALRM{'}'}</code>, and cancelling on every exit path</h5>
          <p>Two details that are easy to get wrong and dangerous when you do. <strong><code>local</code> on <code>$SIG{'{'}ALRM{'}'}</code></strong> restores whatever handler was installed before this call when the block exits, rather than leaving your handler installed globally for the rest of the program — without it, a later, unrelated part of the codebase that also uses <code>alarm()</code> would silently call <em>your</em> fuzzing handler instead of its own. <strong><code>alarm(0)</code> on both the success path and inside the <code>if (!$ok)</code> branch</strong> matters because a pending alarm is a process-wide timer: if the protected code finishes in 0.3s but you forget to cancel a 1s alarm, it fires 0.7s later, in whatever code happens to be running by then, which is a bug that looks like it comes from somewhere else entirely.</p>
        </div>
        <p>Run against a hand-rolled quoted-field scanner (written to show what you would be signing up for by not using <code>Text::CSV</code>, which does not have this bug):</p>
        <pre><code>{"sub scan_fields ($line) {          # BUG, left in deliberately: see below\n    my @fields;\n    my $pos = 0;\n    my $len = length $line;\n    while ($pos < $len) {\n        if (substr($line, $pos, 1) eq '\"') {\n            my $end = index($line, '\"', $pos + 1);\n            if ($end == -1) {\n                next;             # meant \"consume to end of string\"; forgot to move $pos\n            }\n            push @fields, substr($line, $pos + 1, $end - $pos - 1);\n            $pos = $end + 1;\n        } else {\n            my $comma = index($line, \",\", $pos);\n            $comma = $len if $comma == -1;\n            push @fields, substr($line, $pos, $comma - $pos);\n            $pos = $comma + 1;\n        }\n    }\n    return \\@fields;\n}\n"}</code></pre>
        <pre className="plain"><code>{"$ perl t/90-fuzz.t\ntrial 5 hung the scanner on: \"qaed,,pli\nfound a hang in 2000-trial budget (seed 20260912), 1.01s elapsed\nnot ok 1 - scan_fields never hangs\n"}</code></pre>
        <p>
          <img className="mascot-right" src={img4.src} alt="The Mewlang cat, delighted" width="110" />
          Five mutations of <code>'"quoted",plain'</code> in under a second produced a string starting with an unterminated <code>"</code> and no closing quote anywhere in it — exactly the input that hits the <code>next</code> without advancing <code>$pos</code>, so the <code>while</code> condition never changes and the loop spins forever. Without the deadline, this test would simply never finish, and depending on your CI system, "the test suite hangs" and "the test suite is slow today" look identical for the first twenty minutes. <strong>The fuzzer's actual job is not finding the bug — a code reviewer could find this one by eye. Its job is finding it in one second, automatically, every time the suite runs, forever. </strong> The fix is the one-line version of the comment: <code>$pos = $len; next;</code> when no closing quote exists, which is exactly why this project uses <code>Text::CSV</code> for the real parser and keeps this one only as a cautionary exercise.
        </p>
        <h4>Profiling: finding the hot path instead of guessing at it</h4>
        <p><code>strata entities</code> on a busy log spends real time deduplicating candidate entity values before ranking them. The first version used <code>grep</code> against an accumulator array:</p>
        <pre><code>{"sub dedupe_seen (@values) {\n    my @seen;\n    my @unique;\n    for my $v (@values) {\n        push(@unique, $v), push(@seen, $v) unless grep { $_ eq $v } @seen;\n    }\n    return @unique;\n}\n"}</code></pre>
        <pre className="plain"><code>{"$ perl -d:NYTProf bin/strata entities strata.db --dump-candidates > /dev/null\n$ nytprofcsv && grep dedupe_seen -r nytprof/ | sort -t, -k1 -rn | head -1\n0.185629,20000,0.000009,push(@unique, $v), push(@seen, $v) unless grep { $_ eq $v } @seen;\n"}</code></pre>
        <p>That line alone accounted for 0.186 of the run's roughly 0.19 seconds: essentially the entire program. <code>nytprofhtml</code> gives the same finding as a browsable, colour-coded report; the CSV export above is the same numbers in a form worth quoting. The shape is the giveaway even before profiling: <code>grep</code> over an array that grows by one every iteration is <strong>O(n·u)</strong> where <em>u</em> is the number of unique values found so far — for 20,000 values collapsing to 200 unique ones, that is up to four million string comparisons for what should be twenty thousand hash lookups.</p>
        <pre><code>{"sub dedupe_seen (@values) {\n    my %seen;\n    my @unique;\n    for my $v (@values) {\n        push @unique, $v unless $seen{$v}++;\n    }\n    return @unique;\n}\n"}</code></pre>
        <pre className="plain"><code>{"grep-based dedupe (O(n·u)): 0.178s\nhash-based dedupe (O(n)):   0.004s\nspeedup: 50x\n"}</code></pre>
        <div className="note">
          <h5>A callback to Milestone 8's benchmark</h5>
          <p>The timestamp arithmetic rewrite in Milestone 8 measured a real 4× win from removing an object allocation. In the course of preparing <em>this</em> milestone, the obvious next guess — "surely caching a compiled regex with <code>qr//</code> beats re-interpolating a pattern string on every call" — was tested the same way, and <strong>made no measurable difference</strong>: Perl's regex engine already caches the compiled form of an interpolated pattern when the interpolated value has not changed since the last call, which is precisely the common case. The rule from Milestone 8 holds either way it comes out: <strong>profile before you optimise, because "obviously slow" and "measurably slow" are not the same list.</strong></p>
        </div>
        <div className="exercise">
          <h5>Exercise 11</h5>
          <ol>
            <li><strong>Fuzz a real parser.</strong> Point the mutation harness at <code>Strata::Parser::JsonLines</code> and <code>Strata::Parser::Apache</code> instead of the toy scanner, seeded from the fixtures in <code>share/fixtures/</code>. Run 10,000 trials each. If nothing hangs, that is a real (negative) result — say so, and say what it does and does not prove. </li>
            <li><strong>Extend the contract.</strong> Add an assertion to <code>Test::Strata::ParserContract</code> that <code>parse</code> (or <code>parse_handle</code>) never dies on <code>undef</code> or an empty string, using the same <code>alarm()</code> deadline technique so a contract violation cannot hang the whole test suite either.</li>
            <li><strong>Profile <code>strata correlate</code></strong> on a 500,000-occurrence synthetic database and report the top three lines by exclusive time. Is the sessioniser's sort-then-sweep still the right design at that scale, or does something else dominate first?</li>
          </ol>
        </div>
        <details>
          <summary>Solution 11 — open after trying</summary>
          <p><strong>1.</strong> Seeding from real fixtures rather than random noise matters: a mutation of a genuinely valid Apache line is far more likely to land near a real code path (a malformed status code, a truncated quote in the request line) than 200 random bytes are, which mostly just hit the "reject early" branch every parser needs anyway. Ten thousand trials with none hanging is real evidence that the specific mutation operators used here (insert/delete/replace of one byte) do not find a denial-of-service bug in these two parsers — it proves nothing about mutation operators you did not try, multi-byte UTF-8 corruption, or an adversary who read the source rather than mutating blindly. Say precisely that in the test's comment, not "fuzzing found nothing so it's safe".</p>
          <p><strong>2.</strong> The added assertion is small and reuses the existing helper:</p>
          <pre><code>{"for my $bad (undef, \"\") {\n    my (undef, $err) = run_with_timeout(sub ($v) {\n        $class->can(\"parse\") ? $class->new->parse($v // \"\", file => \"t\", lineno => 1)\n                              : 1;  # stream-mode parsers are exercised via a fixture elsewhere\n    }, $bad, 1);\n    is $err, undef, \"$class does not hang on \" . ($bad // \"undef\");\n}"}</code></pre>
          <p><strong>3.</strong> At 500,000 occurrences the sweep itself scales linearly and stays cheap, but <code>last_insert_id</code> called once per event (55,000-odd times at this scale) turns out to dominate: it is a small extra round trip to SQLite every time, and while each one is fast, 55,000 of them are not free. The fix is to let SQLite generate ids implicitly and read back a <em>batch</em> of them differently — or, more simply, to build events in memory and insert them in one <code>executemany</code>-style pass at the end, trading a little peak memory for far fewer statement round trips. The general lesson matches Milestone 9's transaction story: <strong>the cost is rarely the computation, it is usually the number of round trips to somewhere slower than memory.</strong></p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>What does the shared parser contract test actually check, and why did it belong in Milestone 6 and only arrive now?</li>
          <li>Why must <code>$SIG{'{'}ALRM{'}'}</code> be <code>local</code>ised inside the timeout helper?</li>
          <li>Name both places <code>alarm(0)</code> has to be called in <code>run_with_timeout</code>, and explain what breaks if either is missing.</li>
          <li>Why is corpus-based mutation (starting from real fixtures) generally more effective than mutating random bytes from nothing?</li>
          <li>What made the <code>grep</code>-based dedupe O(n·u), and why does a hash make it O(n)?</li>
          <li>Why did caching the timestamp regex with <code>qr//</code> fail to produce a measurable speedup, when the intuition said it should?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 12</span>The knowledge graph</h2>
        <h3>Goal</h3>
        <p>Turn correlated events into a graph — an edge between two events that share an entity — queryable by "hops", parallelise ingestion of many files at once using <code>fork</code>, and package the finished tool as something installable.</p>
        <h3>Concepts</h3>
        <p>Recursive common table expressions (<code>WITH RECURSIVE</code>), <code>fork()</code> and pipes as Perl's idiomatic answer to "run this on several cores", reaping children correctly, and final packaging.</p>
        <div className="why">
          <h5>
            <img className="mascot-left" src={img5.src} alt="The Mewlang cat, facing forward" width="110" />
            Why are we using this language here?
          </h5>
          <p>This is the sharpest language contrast in the whole course. Go's answer to "use more cores" is goroutines sharing one address space, disciplined by channels and the race detector. Perl's idiomatic answer is the opposite instinct: <code>fork()</code> gives every worker its own <em>copy</em> of the process's memory (copy-on-write, so it is cheap until a worker writes), which means <strong>a whole category of bug — the shared-mutable-state data race — is not merely disciplined, it is structurally impossible</strong>. There is no memory two Perl worker processes can race on, because after <code>fork</code> they do not share any. The price is exactly what you would expect from that trade: no in-memory sharing means every result has to be serialised and sent back over a pipe, which is slower than a goroutine writing into a channel and costs real code (<code>Storable</code>, explicit reaping). Neither answer is superior in the abstract; they optimise for different failure modes, and Course 4 (Erlang) turns out to agree with Perl's instinct here far more than with Go's.</p>
        </div>
        <h3>Implementation</h3>
        <h4>Edges: when two events share evidence</h4>
        <pre><code>{"CREATE TABLE edges (\n    event_a INTEGER NOT NULL REFERENCES events(id),\n    event_b INTEGER NOT NULL REFERENCES events(id),\n    reason  TEXT NOT NULL\n);\n\n-- Two events are linked when one of their occurrences came from the same\n-- record: the same log line that mentioned this IP also mentioned that path.\nINSERT INTO edges (event_a, event_b, reason)\nSELECT DISTINCT em1.event_id, em2.event_id, 'shared record'\nFROM event_members em1\nJOIN occurrences o1 ON o1.id = em1.occurrence_id\nJOIN occurrences o2 ON o2.record_id = o1.record_id AND o2.id != o1.id\nJOIN event_members em2 ON em2.occurrence_id = o2.id\nWHERE em1.event_id < em2.event_id;   -- one row per pair, not two\n"}</code></pre>
        <p><code>em1.event_id {'<'} em2.event_id</code> is the whole trick for storing an undirected edge once instead of twice: without it, every shared-record pair would produce both <code>(3, 9)</code> and <code>(9, 3)</code>, doubling storage and every count derived from it.</p>
        <h4>Walking the graph with a recursive query</h4>
        <pre><code>{"WITH RECURSIVE reachable(node, hops) AS (\n    SELECT ?, 0\n    UNION\n    SELECT CASE WHEN e.event_a = r.node THEN e.event_b ELSE e.event_a END, r.hops + 1\n    FROM edges e JOIN reachable r ON e.event_a = r.node OR e.event_b = r.node\n    WHERE r.hops < ?\n)\nSELECT node, MIN(hops) AS hops FROM reachable GROUP BY node ORDER BY hops, node;\n"}</code></pre>
        <p>Verified against a small hand-built graph (edges 1–2, 2–3, 3–4, 5–6, 1–7), asking for everything within two hops of node 1:</p>
        <pre className="plain"><code>{"node 1 at 0 hop(s)\nnode 2 at 1 hop(s)\nnode 7 at 1 hop(s)\nnode 3 at 2 hop(s)\n"}</code></pre>
        <p>Node 4 and the disconnected pair 5–6 correctly do not appear. <code>WITH RECURSIVE</code> has been in SQLite since 3.8.3 (2014), so this needs nothing beyond an ordinary SQLite install. The <strong>plain <code>UNION</code></strong> (not <code>UNION ALL</code>) matters: it deduplicates identical <code>(node, hops)</code> pairs as the recursion runs, which is what stops a graph with cycles — this one included, 1→2→1 is a cycle — from recursing forever. <code>GROUP BY node, MIN(hops)</code> in the outer query then collapses a node that was reached by two different paths (at possibly different hop counts) down to its shortest distance, the way node 1 itself, reachable from itself in zero hops, does not also appear again at two hops even though the raw recursion does produce that row internally.</p>
        <h4>Parallel ingestion with <code>fork</code> and pipes</h4>
        <pre><code>{"use Storable qw(freeze thaw);\n\nsub ingest_parallel ($files, $workers = 4) {\n    my @chunks;\n    push @{ $chunks[$_ % $workers] }, $files->[$_] for 0 .. $#$files;\n\n    my %reader_for;\n    for my $w (0 .. $workers - 1) {\n        pipe(my $reader, my $writer) or die \"pipe: $!\";\n        my $pid = fork // die \"fork: $!\";\n\n        if ($pid == 0) {\n            close $reader;\n            my ($records, $problems) = (0, 0);\n            for my $file (@{ $chunks[$w] // [] }) {\n                my ($r, $p) = ingest_one_file($file);   # each child: its own memory, own DB handle\n                $records += $r;\n                $problems += $p;\n            }\n            print $writer freeze({ worker => $w, records => $records, problems => $problems });\n            close $writer;\n            exit 0;\n        }\n\n        close $writer;\n        $reader_for{$pid} = $reader;\n    }\n\n    my ($total_records, $total_problems) = (0, 0);\n    for my $pid (keys %reader_for) {\n        local $/;                                  # slurp mode for this read\n        my $data = readline($reader_for{$pid});\n        waitpid($pid, 0);                          # reap; see below\n        my $result = thaw($data);\n        $total_records  += $result->{records};\n        $total_problems += $result->{problems};\n    }\n    return ($total_records, $total_problems);\n}\n"}</code></pre>
        <p>Verified with six fake files split across three workers:</p>
        <pre className="plain"><code>{"worker 0: 1000 records, 4 problems, files=a.log d.log\nworker 1: 1000 records, 4 problems, files=b.log e.log\nworker 2: 1000 records, 4 problems, files=c.log f.log\ntotal: 3000 records, 12 problems\n"}</code></pre>
        <p><code>pipe</code> creates a connected reader/writer pair <em>before</em> the fork, which is the only way it works: after <code>fork</code>, parent and child each have their own copies of both ends, and each side closes the end it does not use so that a read on an exhausted pipe correctly reports end-of-file rather than blocking forever waiting for a writer that will never write (because it is the child's own, unclosed, unused copy). <code>Storable::freeze</code>/<code>thaw</code> is Perl's standard way to send a structured value (here, a hashref) through something that only carries bytes.</p>
        <div className="warn">
          <h5>Two hazards this design sidesteps, and why</h5>
          <p><strong>Zombie processes.</strong> A child that exits before its parent calls <code>waitpid</code> becomes a zombie — gone, but still occupying a process table entry until reaped. This code reaps every child in the same loop that reads its result, so nothing is ever left unreaped; a longer-running supervisor would additionally want <code>$SIG{'{'}CHLD{'}'} = 'IGNORE'</code> or an explicit reaper loop for children whose results it does not need to wait for individually.</p>
          <p><strong>The classic pipe-buffer deadlock.</strong> A Linux pipe's kernel buffer defaults to 64 KB (<code>/proc/sys/fs/pipe-max-size</code> for the ceiling); if two processes both write more than that to each other and neither is reading, both block forever, each waiting for buffer space the other would free by reading. <strong>This design cannot hit that</strong>, structurally: communication is one-way, child writes and exits, parent only reads, so there is no cycle of mutual waiting to deadlock on. The moment you need <em>bidirectional</em> traffic — a supervisor sending a shutdown command to workers that are also streaming results back — you need either a second pipe per direction or a non-blocking read loop, and this is exactly the shape of bug that ambushes people who add "just one more message" to a fork-and-pipe design that was never built for it.</p>
        </div>
        <h4>Packaging the finished distribution</h4>
        <pre className="plain"><code>{"$ perl Makefile.PL\n$ make test\nPASS  t/00-load.t\nPASS  t/10-record.t\n...\nPASS  t/90-fuzz.t\nAll tests successful.\n$ make dist\nstrata-0.12.tar.gz\n$ cpanm --local-lib=/tmp/check strata-0.12.tar.gz && echo \"installs cleanly\"\ninstalls cleanly\n"}</code></pre>
        <p><code>make dist</code> reads <code>MANIFEST</code> (generated by <code>make manifest</code> from every file under version control) and produces exactly the tarball a real user would <code>cpanm</code> install — <strong>installing your own tarball into a scratch <code>local::lib</code> before calling a milestone "done" catches the class of bug that only "it works on my checkout" hides</strong>: a test file depending on a fixture that was never added to <code>MANIFEST</code>, a module that only compiles because something else in your working tree happened to load it first.</p>
        <h3>Repository state after Milestone 12</h3>
        <pre className="plain"><code>{"strata/\n├── Makefile.PL, cpanfile, MANIFEST\n├── bin/strata                   ingest | entities | correlate | query\n├── lib/Strata.pm\n├── lib/Strata/\n│   ├── Util.pm  Pattern.pm  Record.pm  Pipeline.pm  Source.pm\n│   ├── Extract.pm  Normalize.pm\n│   ├── Store.pm                  DBI, schema, transactions\n│   ├── Correlate.pm               sessionisation sweep\n│   ├── Graph.pm                    edges, recursive CTE queries\n│   └── Parser/\n│       ├── Registry.pm  Apache.pm  JsonLines.pm  Csv.pm  Xml.pm  Unstructured.pm\n└── t/\n    ├── lib/Test/Strata/ParserContract.pm\n    ├── 00–80  (unit and integration tests, ~10 files)\n    └── 90-fuzz.t                          deadline-bounded mutation tests\n"}</code></pre>
        <pre className="plain"><code>{"$ prove -l t/\nAll tests successful.\n$ git commit -am \"milestones 9-12: correlation, a real CLI, fuzzing, profiling, the graph\"\n"}</code></pre>
        <div className="exercise">
          <h5>Exercise 12</h5>
          <ol>
            <li><strong>A DOT export.</strong> Add <code>strata graph --format=dot {'>'} g.dot</code>, walking <code>edges</code> and printing GraphViz syntax, so <code>dot -Tpng g.dot -o g.png</code> produces a picture of a correlated incident.</li>
            <li><strong>A <code>--workers</code> flag</strong> on <code>strata ingest</code> wired to <code>ingest_parallel</code>, benchmarked at 1, 2, 4 and 8 workers against a fixed set of files. Where does the speedup stop being linear, and what is SQLite doing at that point that a purely CPU-bound parallel task would not have to contend with?</li>
            <li><strong>Two-directional handoff.</strong> Deliberately build the bidirectional pipe scenario warned about above — a parent that sends a "stop early" message to a worker that is also streaming results back — and reproduce a deadlock with large enough messages. Then fix it with a second pipe per worker (one each direction) and confirm it no longer deadlocks.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 12 — open after trying</summary>
          <p><strong>1.</strong> The exporter is a thin format layer over a query you already have:</p>
          <pre><code>{"say \"graph {\";\nmy $rows = $dbh->selectall_arrayref(\"SELECT event_a, event_b, reason FROM edges\");\nfor my $row (@$rows) {\n    say qq{  \"$row->[0]\" -- \"$row->[1]\" [label=\"$row->[2]\"];};\n}\nsay \"}\";"}</code></pre>
          <p>The only real care needed is escaping quotes inside <code>reason</code> if it is ever user-derived rather than one of the fixed strings this project generates.</p>
          <p><strong>2.</strong> Linear speedup holds until every worker is contending for the same SQLite file: <code>fork</code>-based parallelism gives each worker independent CPU and independent memory, but the database write at the end is still one file, and SQLite serialises writers even in WAL mode (WAL lets readers proceed concurrently with a writer, not multiple simultaneous writers). Past roughly the number of physical cores, and well before that if the workload is write-heavy rather than parse-heavy, you are measuring lock contention, not CPU parallelism — a purely CPU-bound task (say, only counting lines per file with no shared destination) would not hit this wall at all, which is precisely why profiling <em>this specific pipeline</em> mattered more than trusting the general reputation of <code>fork</code>.</p>
          <p><strong>3.</strong> Two same-direction pipes (parent→child and child→parent) rather than trying to reuse one: writing a large "stop" payload from the parent while the child is mid-write of its own large result, with neither side reading the other's pipe yet, reliably deadlocks once both messages exceed the 64 KB kernel buffer — you can reproduce it by having the parent print {'>'}64KB before its first read. The fix confirms the general rule from the warn box above: <strong>bidirectional traffic needs two one-way channels (or non-blocking I/O on one), never one pipe pressed into carrying both directions.</strong></p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why is a data race structurally impossible between two <code>fork</code>ed Perl worker processes, in a way it is not for two goroutines?</li>
          <li>What does <code>pipe</code> have to be called before, not after, and why does that ordering matter? </li>
          <li>What is a zombie process, and what stops one from being created here?</li>
          <li>Why can this milestone's fork-and-pipe design never deadlock on a full pipe buffer, and what changes the moment you add a second direction of traffic?</li>
          <li>Why does <code>UNION</code> rather than <code>UNION ALL</code> matter for a recursive query over a graph that contains a cycle?</li>
          <li>What does installing your own freshly built tarball into a scratch <code>local::lib</code> catch that running the test suite in your working tree does not?</li>
        </ol>
        <div className="warn">
          <h5>Common mistakes in Milestones 9–12</h5>
          <ul>
            <li><strong>Autocommit left on for a bulk load</strong>, turning one <code>fsync</code> into thousands. </li>
            <li><strong>Mixing an array and scalars in one <code>my (...) = (...)</code></strong>, letting the array silently swallow the whole list.</li>
            <li><strong>Guessing that an index helped</strong> instead of reading <code>EXPLAIN QUERY PLAN</code>. </li>
            <li><strong>Doing real work directly inside a signal handler</strong> rather than setting a flag for the main loop to notice safely.</li>
            <li><strong>Assuming a closed pipe means something is broken</strong>, rather than the reader simply stopping early, which is normal.</li>
            <li><strong>Forgetting <code>alarm(0)</code> on every exit path</strong>, leaving a timer armed to fire in unrelated code later.</li>
            <li><strong>Optimising from intuition instead of a profile</strong> — the regex-caching guess that measured as a no-op is the reminder.</li>
            <li><strong>Not closing the unused end of a pipe in both parent and child</strong>, which turns end-of-file into an indefinite block.</li>
            <li><strong>Reusing one pipe for traffic in both directions</strong> once a design that started one-way grows a second need.</li>
          </ul>
        </div>
        <footer className="end">
          <p>
            <img className="mascot-left" src={img6.src} alt="The Mewlang cat, raising a paw in celebration" width="120" />
            Instalment 14 of the five-course curriculum. Next, and last for Perl: the advanced phase, a final challenge with acceptance criteria and a withheld solution, the full knowledge check, the README and GitHub description, portfolio notes and interview questions.
          </p>
        </footer>
         <Link className="button" href="/perl-course/milestones/end/">Continue</Link> 
      </div>
    </div>
  );
}
