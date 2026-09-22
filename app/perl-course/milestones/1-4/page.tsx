import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/left_to_right/laptop.png';
import img2 from '../../../../courses/assets/expressions/surprised.png';
import img3 from '../../../../courses/assets/expressions/right_to_left/blink.png';
import img4 from '../../../../courses/assets/expressions/left_to_right/looking_bad.png';
import img5 from '../../../../courses/assets/expressions/right_to_left/thinking.png';
import img6 from '../../../../courses/assets/expressions/left_to_right/walking.png';

export const metadata: Metadata = {
  title: "Perl Milestones 1–4 — Filter, Report, Parser, Model",
};

export default function Page() {
  return (
    <div className="theme-perl">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 12 · Course 3 (Perl) · Milestones 1–4</p>
          <h1>From a one-liner to something that survives the data</h1>
          <p className="lede">A filter, then a report, then a parser that treats broken input as evidence rather than an error, then a data model that lets everything downstream forget which format anything came from.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Perl 5.38.2. Every program was run against a 2,004-line fixture containing four deliberately broken lines, and against a 200,400-line copy for timings. All tests pass. The throughput numbers at the end of Milestone 4 include one that is genuinely uncomfortable, which is why it is there.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 1</span>A filter that counts what it reads</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-left" src={img1.src} alt="The Mewlang cat, typing on a laptop" width="120" />
          The smallest useful program: read files or standard input, count what you find, report it, and exit with a status that means something. No modules, no objects, no parsing.
        </p>
        <h3>Concepts</h3>
        <p><code>while ({'<'}{'>'})</code>, <code>$ARGV</code> and <code>$.</code>, exit codes as an interface, <code>warn</code> versus <code>print</code>, heredocs, and why a Unix filter is the right default shape.</p>
        <h3>Design</h3>
        <p>Before writing anything, decide what kind of program this is. A Perl data tool is almost always a <strong>filter</strong>: it reads a stream, writes a stream, says nothing else on standard output, and reports its verdict in the exit code. Getting that shape right at the start means the tool composes with everything else on the machine, and getting it wrong means people wrap your program in a shell script to make it behave.</p>
        <p>Three rules, which the whole course follows:</p>
        <ul>
          <li><strong>Results to <code>stdout</code>, diagnostics to <code>stderr</code>.</strong> Otherwise <code>strata ... | sort</code> mixes error messages into the data.</li>
          <li><strong>Exit codes follow <code>grep</code>:</strong> 0 nothing found, 1 something found, 2 could not run. People already know this convention.</li>
          <li><strong>No arguments means read standard input.</strong> One line of Perl gets you this.</li>
        </ul>
        <h3>Implementation</h3>
        <pre><code>{"#!/usr/bin/env perl\nuse v5.36;\n\n# strata-scan: the smallest useful thing. Count lines, bytes and matches\n# across files or standard input, and say something true about the result.\n\nmy $pattern = qr/\\b(?:ERROR|FATAL)\\b/;\nmy $quiet   = 0;\nmy @files;\n\n# Option handling by hand for now; Getopt::Long arrives in milestone 10.\nwhile (@ARGV) {\n    my $arg = shift @ARGV;\n    if    ($arg eq \"--pattern\") { $pattern = qr/@{[ shift @ARGV ]}/ }\n    elsif ($arg eq \"--quiet\")   { $quiet = 1 }\n    elsif ($arg eq \"--help\")    { print usage(); exit 0 }\n    elsif ($arg =~ /^--/)       { die \"strata-scan: unknown option $arg\\n\" . usage() }\n    else                        { push @files, $arg }\n}\n@ARGV = @files;\n\nmy ($lines, $bytes, $matched, $empty, $longest) = (0, 0, 0, 0, 0);\nmy %per_file;\n\nwhile (my $line = <>) {\n    $lines++;\n    $bytes += length $line;\n    chomp $line;\n\n    $empty++ if $line =~ /^\\s*$/;\n    $longest = length $line if length $line > $longest;\n\n    if ($line =~ $pattern) {\n        $matched++;\n        $per_file{$ARGV}++;\n    }\n}\n\nif ($lines == 0) {\n    warn \"strata-scan: no input\\n\";\n    exit 2;\n}\n\nunless ($quiet) {\n    printf \"%d lines, %s bytes, %d matched, %d blank, longest %d chars\\n\",\n        $lines, commify($bytes), $matched, $empty, $longest;\n\n    for my $file (sort { $per_file{$b} <=> $per_file{$a} || $a cmp $b } keys %per_file) {\n        printf \"  %-40s %6d\\n\", $file, $per_file{$file};\n    }\n}\n\nexit($matched > 0 ? 1 : 0);\n\nsub commify ($n) { 1 while $n =~ s/^(\\d+)(\\d{3})/$1,$2/; return $n }\n\nsub usage {\n    return <<~\"USAGE\";\n        usage: strata-scan [--pattern REGEX] [--quiet] [FILE...]\n               reads standard input when no files are named\n               exit 0: no matches   1: matches found   2: no input\n        USAGE\n}\n"}</code></pre>
        <h4>Explanation</h4>
        <ul>
          <li><strong><code>@ARGV = @files;</code></strong> is the trick that makes hand-rolled options work with <code>{'<'}{'>'}</code>. The diamond operator reads whatever is left in <code>@ARGV</code>, so we pull the options out first and put the filenames back. <code>Getopt::Long</code> does exactly this for you, which is why it composes with <code>{'<'}{'>'}</code> too.</li>
          <li><strong><code>qr/@{'{'}[ shift @ARGV ]{'}'}/</code></strong> compiles a user-supplied string into a pattern. <code>@{'{'}[ ... ]{'}'}</code> is the "baby cart" idiom: it evaluates an expression inside a string or pattern, because interpolation only understands variables. It is ugly; <code>my $p = shift @ARGV; $pattern = qr/$p/;</code> is clearer and you should prefer it. It is here because you <em>will</em> meet it.</li>
          <li><strong><code>$ARGV</code> is the file currently being read</strong> by <code>{'<'}{'>'}</code>. Note the output below: when reading standard input it is <code>-</code>, which is the Unix convention for "the stream", and which you get for free.</li>
          <li><strong><code>{'<'}{'<'}~"USAGE"</code></strong> is an indented heredoc (Perl 5.26+). The tilde strips the leading indentation, so the usage text lines up with the code rather than being jammed against the left margin.</li>
          <li><strong><code>warn</code> writes to stderr</strong> and does not exit; <code>die</code> writes to stderr and exits with a failure status. Neither pollutes stdout.</li>
        </ul>
        <h3>Running it</h3>
        <pre className="plain"><code>{"$ ./bin/strata-scan share/fixtures/access.log\n2004 lines, 211,017 bytes, 0 matched, 1 blank, longest 128 chars\n$ echo $?\n0\n\n$ ./bin/strata-scan --pattern '\" 5\\d\\d ' share/fixtures/access.log\n2004 lines, 211,017 bytes, 398 matched, 1 blank, longest 128 chars\n  share/fixtures/access.log                   398\n$ echo $?\n1\n\n$ head -50 share/fixtures/access.log | ./bin/strata-scan --pattern 'Googlebot'\n50 lines, 5,298 bytes, 19 matched, 0 blank, longest 127 chars\n  -                                            19\n\n$ ./bin/strata-scan < /dev/null\nstrata-scan: no input\n$ echo $?\n2\n"}</code></pre>
        <p>The same binary, three invocation styles, no code paths for any of them. That is <code>{'<'}{'>'}</code> earning its place.</p>
        <div className="cmp">
          <h5>Manual parsing vs the Unix-oriented default</h5>
          <pre className="plain"><code>{"Python                                    Perl\n──────                                    ────\nimport sys, re, fileinput                 use v5.36;\npattern = re.compile(r'\\bERROR\\b')\ncount = 0                                 while (<>) {\nfor line in fileinput.input():                $n++ if /\\bERROR\\b/;\n    if pattern.search(line):              }\n        count += 1\n        name = fileinput.filename()\nprint(count)                              say $n;\nsys.exit(1 if count else 0)"}</code></pre>
          <p>Python's <code>fileinput</code> exists precisely because this shape is useful, and it is an import plus a function call plus a compiled pattern object. In Perl the same thing is the default syntax. That is the whole ergonomic argument, and over a large tool it is the difference between the plumbing being visible and being invisible.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 1</h5>
          <p>Extend <code>strata-scan</code> with <code>--histogram FIELD</code>, which splits each line on whitespace and prints a count of the values in that column, sorted by frequency, with a bar made of <code>#</code> characters scaled to the terminal width (assume 80 if you cannot detect it). It must still stream.</p>
          <p>Then add <code>--sample N</code>, which prints N randomly chosen matching lines using <em>reservoir sampling</em>, so that it works on a stream of unknown length without storing more than N lines.</p>
          <p>Hint for the second part: keep the first N; for item <em>i</em> after that, replace a random one of the N with probability N/i. Look up why that gives a uniform sample before implementing it.</p>
        </div>
        <details>
          <summary>Solution 1 — open after trying</summary>
          <pre><code>{"my (@reservoir, $seen);\n\nsub reservoir_add ($line, $n) {\n    $seen++;\n    if (@reservoir < $n) {\n        push @reservoir, $line;\n    } else {\n        my $j = int rand $seen;          # 0 .. seen-1\n        $reservoir[$j] = $line if $j < $n;\n    }\n}\n\n# histogram\nmy %hist;\n# ... inside the loop:\nif (defined $field) {\n    my @cols = split ' ', $line;\n    $hist{ $cols[$field] // \"(missing)\" }++;\n}\n\n# ... after the loop:\nmy $width = ($ENV{COLUMNS} || 80) - 30;\nmy ($max) = sort { $b <=> $a } values %hist;\nfor my $key (sort { $hist{$b} <=> $hist{$a} || $a cmp $b } keys %hist) {\n    my $bar = \"#\" x int($width * $hist{$key} / $max);\n    printf \"  %-18s %7d %s\\n\", substr($key, 0, 18), $hist{$key}, $bar;\n}\n"}</code></pre>
          <p>Three things worth extracting.</p>
          <ul>
            <li><strong>Reservoir sampling is the streaming answer to "give me a representative subset".</strong> It uses O(N) memory for a stream of any length, and the proof that it is uniform is short enough to reconstruct: the <em>i</em>-th item enters with probability N/i, and each earlier item survives each subsequent step with exactly the right probability. You will use this again in Milestone 7, where sampling a 200 GB file is the only way to look at it.</li>
            <li><strong>Scaling the bar to the maximum, not the total</strong>, is what makes a histogram readable when one value dominates. Getting this backwards produces a chart where everything after the first row is invisible.</li>
            <li><strong><code>$cols[$field] // "(missing)"</code></strong> because short lines exist. In this course, every access to data that came from a file needs an answer for "what if it is not there", and the answer is never "crash".</li>
          </ul>
        </details>
        <h4>Common mistakes in Milestone 1</h4>
        <div className="warn">
          <ul>
            <li><strong>Printing diagnostics to stdout.</strong> Your tool stops being pipeable.</li>
            <li><strong>Forgetting to restore <code>@ARGV</code></strong> after hand-parsing options, so <code>{'<'}{'>'}</code> reads nothing (or tries to open <code>--quiet</code> as a file).</li>
            <li><strong>Using <code>exit 1</code> for "could not run".</strong> Reserve 1 for "ran and found something"; use 2 or higher for usage and I/O errors.</li>
            <li><strong>Counting bytes after <code>chomp</code></strong>, which silently undercounts by one per line.</li>
            <li><strong>Assuming <code>$.</code> resets between files.</strong> It does not, unless you <code>close ARGV if eof;</code> at the end of the loop.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>What does <code>{'<'}{'>'}</code> read from, and how does it decide?</li>
          <li>Why does the program reassign <code>@ARGV</code> before the loop?</li>
          <li>What are <code>$ARGV</code> and <code>$.</code>, and what is <code>$ARGV</code> when reading a pipe? </li>
          <li>What do the three exit codes mean and who consumes them?</li>
          <li>Why is <code>warn</code> preferable to <code>print</code> for the "no input" message?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 2</span>Reports: one pass, several questions</h2>
        <h3>Goal</h3>
        <p>Turn the counting filter into something that answers real questions about a log: who is talking most, what is failing, when the spikes were, and what could not be parsed. Still one file, still one pass, still constant memory in the size of the input.</p>
        <h3>Concepts</h3>
        <p>Hashes as accumulators, multi-key sorting, list slices, <code>printf</code> report formatting, and the discipline of computing everything in a single traversal.</p>
        <h3>Design</h3>
        <p>The instinct from other languages is to read the file into a list and then run four separate passes over it. Do not. <strong>Every question you can answer with a counter should be answered during the single pass you were already making</strong>, because that is what keeps memory proportional to the number of distinct <em>keys</em> rather than to the size of the input. A log with 200 million lines and 4,000 client addresses needs 4,000 hash entries, not 200 million.</p>
        <p>So the shape is: declare one hash per question, update them all in the loop, and do the sorting and formatting afterwards.</p>
        <h3>Implementation</h3>
        <pre><code>{"my %stat = (total => 0, parsed => 0, failed => 0);\nmy (%hits, %bytes, %errors, %by_minute, %by_class, %by_path, @first_failures);\n\nwhile (my $line = <>) {\n    $stat{total}++;\n\n    unless ($line =~ $APACHE) {\n        $stat{failed}++;\n        push @first_failures, \"$ARGV:$.\" if @first_failures < 3;\n        next;\n    }\n    $stat{parsed}++;\n\n    my %f = %+;                                   # copy before the next match\n    my $bytes = $f{bytes} eq \"-\" ? 0 : $f{bytes};\n\n    $hits{ $f{ip} }++;\n    $bytes{ $f{ip} } += $bytes;\n    $errors{ $f{ip} }++ if $f{status} >= 400;\n    $by_class{ substr($f{status}, 0, 1) . \"xx\" }++;\n    $by_minute{$1}++ if $f{ts} =~ m{^(\\d+/\\w+/\\d+:\\d+:\\d+)};\n    $by_path{$1}++   if $f{request} =~ m{^[A-Z]+ \\s+ ([^?\\s]+)}x;\n}\n"}</code></pre>
        <p>Then a reusable <code>top</code> helper, because "the five biggest" appears four times:</p>
        <pre><code>{"# top(n, \\%hash) returns the n keys with the largest values, ties broken\n# alphabetically so the report is reproducible.\nsub top ($n, $href) {\n    my @keys = sort { $href->{$b} <=> $href->{$a} || $a cmp $b } keys %$href;\n    return grep { defined } @keys[0 .. $n - 1];\n}\n"}</code></pre>
        <ul>
          <li><strong>The tiebreaker is not decoration.</strong> Without <code>|| $a cmp $b</code>, two keys with equal counts come out in hash order, which Perl randomises per process. Your report would differ between runs, which makes it useless for diffing and maddening to test.</li>
          <li><strong><code>@keys[0 .. $n - 1]</code> is a list slice</strong>, and indexing past the end yields <code>undef</code> rather than an error, which is why <code>grep {'{'} defined {'}'}</code> follows. Convenient and a little sloppy; the alternative is <code>@keys[0 .. ($n {'>'} @keys ? $#keys : $n - 1)]</code>, which nobody writes.</li>
          <li><strong>Passing <code>\%hits</code> and dereferencing with <code>$href-{'>'}{'{'}$b{'}'}</code></strong> is the reference rule from Part 2 in daily use: you cannot pass a hash to a sub without flattening it, so you pass a reference.</li>
        </ul>
        <h3>Running it</h3>
        <pre className="plain"><code>{"$ ./bin/strata-report share/fixtures/access.log\n\ntop talkers\n  10.14.22.9         1020 hits     23,671,329 bytes   38.9% errors\n  10.14.22.31         344 hits      7,822,046 bytes   41.0% errors\n  192.168.4.7         324 hits      7,559,417 bytes   37.7% errors\n  172.16.0.99         312 hits      7,061,075 bytes   36.9% errors\n\nstatus classes\n  2xx       1028   51.4%\n  3xx        197    9.8%\n  4xx        377   18.9%\n  5xx        398   19.9%\n\nbusiest minutes\n  12/Sep/2026:13:56             35\n  12/Sep/2026:13:36             34\n  12/Sep/2026:13:41             34\n\nmost requested paths\n  /                            361\n  /api/export                  342\n  /api/search                  336\n\n2,004 lines, 2,000 parsed, 4 unparsed (0.20%)\n  first failures: share/fixtures/access.log:2001, ...:2002, ...:2003\n"}</code></pre>
        <p>Four questions answered in one pass over the file, with the unparsed lines counted and located rather than silently skipped. That last line is the most important one in the output, and Milestone 3 is about taking it seriously.</p>
        <div className="warn">
          <h5>
            <img className="mascot-right" src={img2.src} alt="The Mewlang cat, visibly startled" width="110" />
            The report quietly lies, and the failure count is how you find out
          </h5>
          <p>Line 2001 of the fixture is this:</p>
          <pre className="bad"><code>{"10.14.22.9 - - [12/Sep/2026:13:44:10 +0000] \"GET /api/export HTTP/1.1\" 200"}</code></pre>
          <p>A perfectly ordinary request that happens to have no byte count, which some configurations and some proxies produce. Our pattern requires <code>(?{'<'}bytes{'>'}\d+|-)</code>, so the line does not match, and it is counted as garbage alongside <code>this is not a log line at all</code>.</p>
          <p>At 0.2% nobody notices. But imagine the same regex meeting a server that omits byte counts on all 304 responses: you would silently discard every cache hit in the file and report confidently on the rest. <strong>The failure rate is the only signal that your parser and your data disagree</strong>, which is why it is printed on every run and why the exit code depends on it. Milestone 3's parser distinguishes "I could not read this at all" from "I read this but something was odd", and that distinction is the difference between a tool you can trust and one that produces plausible numbers.</p>
        </div>
        <div className="exercise">
          <h5>Exercise 2</h5>
          <ol>
            <li><strong>Percentiles.</strong> Add response-size percentiles (p50, p90, p99) per client. The naive approach stores every value; think about what that costs on a 200 million line log, then implement it anyway for now and write down the memory you would need.</li>
            <li><strong>Rate of change.</strong> Report the minute with the largest <em>increase</em> in requests over the previous minute, not just the busiest. This needs the minutes in chronological order, which hash keys are not.</li>
            <li><strong>A second dimension.</strong> Report the top three paths <em>per status class</em>, which means a hash of hashes and therefore your first real nested structure.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 2 — open after trying</summary>
          <p><strong>1. Percentiles.</strong> The honest version first:</p>
          <pre><code>{"push @{ $sizes{ $f{ip} } }, $bytes;          # O(n) memory, exact\n\nsub percentile ($values, $p) {\n    my @sorted = sort { $a <=> $b } @$values;\n    return $sorted[ int($p / 100 * $#sorted) ];\n}\n"}</code></pre>
          <p>For 200 million lines at roughly 24 bytes per stored number plus Perl's scalar overhead (around 60 bytes each in an array), that is well over 10 GB. Unacceptable, and the fix is the same one every metrics system uses: <strong>bucket the values</strong>.</p>
          <pre><code>{"# Log-scale buckets: cheap, bounded, accurate to a factor of two.\n$size_buckets{ $f{ip} }[ $bytes ? int(log($bytes) / log(2)) : 0 ]++;\n"}</code></pre>
          <p>Sixty-four counters per client instead of a million values, and the p99 you read off it is accurate to within a factor of two. That is the same trade as the Go course's histogram, and the same conclusion: for alerting and comparison it is plenty; for a contractual SLA it is not.</p>
          <p><strong>2. Rate of change</strong> needs sorted keys, and the keys are strings like <code>12/Sep/2026:13:56</code> which do <em>not</em> sort chronologically (September sorts before October alphabetically only by luck, and 2026 before 2027 only because the day comes first). This is your first encounter with the problem Milestone 8 solves properly: <strong>you cannot order timestamps until you have normalised them</strong>. The stopgap is to key by epoch seconds:</p>
          <pre><code>{"use Time::Piece;\nmy $t = Time::Piece->strptime($f{ts}, \"%d/%b/%Y:%H:%M:%S %z\");\n$by_minute{ $t->epoch - $t->epoch % 60 }++;\n"}</code></pre>
          <p>Numeric keys sort correctly, and converting back for display is a formatting concern. Note that <code>strptime</code> is roughly ten times slower than a regex, which is why Milestone 8 discusses when to parse a timestamp and when to leave it as a string.</p>
          <p><strong>3. Two dimensions</strong> is one character of syntax and a new habit:</p>
          <pre><code>{"$by_class_path{ substr($f{status},0,1) . \"xx\" }{ $path }++;   # autovivified\n\nfor my $class (sort keys %by_class_path) {\n    my $paths = $by_class_path{$class};\n    say \"  $class\";\n    printf \"    %-24s %6d\\n\", $_, $paths->{$_} for top(3, $paths);\n}\n"}</code></pre>
          <p>Autovivification means the inner hash appears when first used. Note that <code>top</code> already takes a hash reference, so it works unchanged on the inner hash: writing helpers that take references rather than hashes is what makes them composable in Perl.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why compute every statistic in one pass rather than several?</li>
          <li>What is memory proportional to in this program, and what is it not proportional to?</li>
          <li>Why does <code>top</code> need a tiebreaker?</li>
          <li>Why must <code>%+</code> be copied into <code>%f</code> immediately?</li>
          <li>What did the failure count reveal about the fixture, and why does that matter more than the 0.2%?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 3</span>A parser that treats broken input as evidence </h2>
        <h3>Goal</h3>
        <p>Extract the regex into a reusable pattern library and a real parser module. Handle both common and combined log formats with one pattern. Distinguish three outcomes: parsed cleanly, parsed with problems, and not parsed at all. Count every problem by kind, and never lose a line.</p>
        <h3>Concepts</h3>
        <p><code>qr//</code> as composable values, regex composition by interpolation, optional groups, a parser as an object with statistics, strict versus lenient modes, and format detection scoring.</p>
        <h3>Design</h3>
        <p>Two design decisions carry the whole project.</p>
        <p><strong>1. A pattern library, not scattered regexes.</strong> The same notions (an IPv4 address, a timestamp, a quoted string) appear in every format we will parse. Defining them once as named <code>qr//</code> values means they can be composed, tested, and fixed in one place.</p>
        <p><strong>2. <code>parse</code> always returns a record.</strong> Never <code>undef</code>, never an exception. A line that cannot be understood comes back with a <code>problem</code> field and its raw text intact. This sounds like a small API choice and it is the difference between a forensic tool and a reporting script: <strong>the lines you cannot parse are frequently the interesting ones.</strong> A truncated line marks where the disk filled; garbage in a log marks where something wrote to the wrong file descriptor; an unparsable request line is often an attack.</p>
        <p>Three outcomes, not two:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Outcome</th>
              <th>Looks like</th>
              <th>Caller should</th>
            </tr>
            <tr>
              <td>clean</td>
              <td>fields, no <code>problems</code></td>
              <td>use it</td>
            </tr>
            <tr>
              <td>usable with problems</td>
              <td>fields, plus <code>problems ={'>'} ["missing_bytes"]</code></td>
              <td>use it, and know the caveat</td>
            </tr>
            <tr>
              <td>unparsed</td>
              <td><code>problem ={'>'} "no_match"</code>, <code>raw</code>, provenance</td>
              <td>investigate it</td>
            </tr>
          </tbody>
        </table>
        <h3>Implementation</h3>
        <h4>lib/Strata/Pattern.pm</h4>
        <pre><code>{"package Strata::Pattern;\nuse v5.36;\nuse Exporter 'import';\n\nour @EXPORT_OK = qw(pattern compose %PATTERN);\n\n# A library of named, reusable pieces. Each is compiled once with qr// and\n# can be interpolated into a larger pattern, which is how you build a big\n# regex you can still read a year later.\nour %PATTERN = (\n    ipv4      => qr/(?:\\d{1,3}\\.){3}\\d{1,3}/,\n    ipv6      => qr/(?:[0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}/,\n    host      => qr/[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\\.[A-Za-z0-9-]+)+/,\n    email     => qr/[A-Za-z0-9._%+-]+ @ [A-Za-z0-9.-]+ \\. [A-Za-z]{2,}/x,\n    uuid      => qr/[0-9a-fA-F]{8}-(?:[0-9a-fA-F]{4}-){3}[0-9a-fA-F]{12}/,\n    unix_path => qr{/(?:[\\w.\\-~%]+/?)*},\n    quoted    => qr/\"[^\"]*\"/,\n\n    # 12/Sep/2026:13:44:10 +0000\n    ts_apache => qr{\\d{2}/\\w{3}/\\d{4}:\\d{2}:\\d{2}:\\d{2}\\s[+-]\\d{4}},\n    # 2026-09-12T13:44:10.123Z  or  2026-09-12 13:44:10\n    ts_iso    => qr/\\d{4}-\\d{2}-\\d{2}[T ]\\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?(?:Z|[+-]\\d{2}:?\\d{2})?/,\n    # Sep 12 13:44:10   (syslog, no year: the format that ruins your day)\n    ts_syslog => qr/\\w{3}\\s+\\d{1,2}\\s+\\d{2}:\\d{2}:\\d{2}/,\n\n    level     => qr/\\b(?:TRACE|DEBUG|INFO|NOTICE|WARN(?:ING)?|ERROR|FATAL|CRIT(?:ICAL)?)\\b/,\n);\n\nsub pattern ($name) {\n    return $PATTERN{$name} // die \"Strata::Pattern: no pattern named '$name'\\n\";\n}\n\n# compose(\"ip\", \"ts_apache\") returns an alternation of named patterns,\n# useful for \"find any of these anywhere\" scanning.\nsub compose (@names) {\n    my @parts = map { pattern($_) } @names;\n    my $alt = join \"|\", map { \"(?:$_)\" } @parts;\n    return qr/$alt/;\n}\n\n1;\n"}</code></pre>
        <p><strong>Interpolating a <code>qr//</code> into another pattern is the feature that makes this work.</strong> A compiled pattern stringifies to something like <code>(?^u:\d{'{'}1,3{'}'}\.)</code>, carrying its own flags, so pasting it into a larger pattern preserves whether it was <code>/x</code> or <code>/i</code>. That is why <code>$PATTERN{'{'}email{'}'}</code> can be written with <code>/x</code> for readability and still work when composed into a pattern that is not.</p>
        <p>Note the comment on <code>ts_syslog</code>. Syslog timestamps have <em>no year</em>, which means correlating a syslog file with anything else requires guessing the year from the file's modification time and handling the December-to-January rollover. Writing that down in the pattern library, where someone will read it, is worth more than the pattern itself. Milestone 8 has to solve it.</p>
        <h4>lib/Strata/Parser/Apache.pm — one pattern, two formats</h4>
        <pre><code>{"my $ACCESS = qr{\n    ^ (?<client>\\S+) \\s+                       # client address (or hostname)\n      (?<ident>\\S+)  \\s+                       # RFC 1413 identity, almost always -\n      (?<user>\\S+)   \\s+                       # HTTP auth user, or -\n      \\[ (?<ts>[^\\]]+) \\] \\s+                  # [12/Sep/2026:13:44:10 +0000]\n      \" (?<request>[^\"]*) \" \\s+                # \"GET /path HTTP/1.1\"\n      (?<status>\\d{3}) \\s*                     # 200\n      (?<bytes>\\d+|-)?                         # response size, sometimes absent\n      (?: \\s+ \" (?<referer>[^\"]*) \"\n          \\s+ \" (?<agent>[^\"]*) \" )?           # the combined-format tail\n      \\s* $\n}x;\n"}</code></pre>
        <p>Compare that with Milestone 2's one-liner version. Same job, and this one can be read, annotated, and modified by someone who has never seen an Apache log. Four specific improvements:</p>
        <ul>
          <li><strong><code>(?{'<'}bytes{'>'}\d+|-)?</code> is optional</strong>, which fixes the silent data loss the report revealed. A missing byte count is now a <em>problem on a usable record</em> rather than a discarded line.</li>
          <li><strong>The combined tail is one optional group</strong>, so both log formats parse with one pattern and the record records which it was. Two patterns tried in sequence would work and would double the cost on every line.</li>
          <li><strong><code>[^"]*</code> rather than <code>.*?</code> for quoted fields.</strong> Faster (no backtracking) and clearer about intent.</li>
          <li><strong>Every capture is named</strong>, so adding a field in the middle changes nothing downstream. </li>
        </ul>
        <h4>The parser object</h4>
        <pre><code>{"sub parse ($self, $line, %ctx) {\n    chomp $line;\n\n    my %rec = (\n        source => $self->{name},\n        file   => $ctx{file} // \"-\",\n        lineno => $ctx{lineno} // 0,\n        raw    => $line,\n    );\n\n    if ($line !~ /\\S/) {\n        return $self->_problem(\\%rec, \"blank\");\n    }\n    unless ($line =~ $ACCESS) {\n        return $self->_problem(\\%rec, \"no_match\");\n    }\n\n    my %f = %+;                      # copy now: the next match resets %+\n\n    $rec{client} = $f{client};\n    $rec{user}   = ($f{user} // \"-\") eq \"-\" ? undef : $f{user};\n    $rec{ts_raw} = $f{ts};\n    $rec{status} = 0 + $f{status};\n    $rec{bytes}  = (!defined $f{bytes} || $f{bytes} eq \"-\") ? 0 : 0 + $f{bytes};\n    $rec{format} = defined $f{agent} ? \"combined\" : \"common\";\n\n    if (!defined $f{bytes}) {\n        push @{ $rec{problems} }, \"missing_bytes\";\n        $self->{problems}{missing_bytes}++;\n        return $self->_problem(\\%rec, \"missing_bytes\") if $self->{strict};\n    }\n\n    if ($f{request} =~ $REQUEST) {\n        my %r = %+;\n        @rec{qw(method path proto)} = @r{qw(method path proto)};\n        ($rec{path_base}, $rec{query}) = split /\\?/, $r{path}, 2;\n    } else {\n        push @{ $rec{problems} }, \"bad_request_line\";\n        $rec{request_raw} = $f{request};\n        return $self->_problem(\\%rec, \"bad_request_line\") if $self->{strict};\n    }\n\n    $self->{parsed}++;\n    return \\%rec;\n}\n"}</code></pre>
        <ul>
          <li><strong><code>0 + $f{'{'}status{'}'}</code> forces a number.</strong> Perl would convert on demand, but storing <code>"200"</code> and storing <code>200</code> differ when the value is later used as a hash key, serialised to JSON, or written to SQLite. <strong>Normalise types at the boundary</strong>, exactly once.</li>
          <li><strong>Normalising <code>-</code> here</strong> means nothing downstream ever learns that Apache writes a dash for "nothing". Every parser in this project will absorb its format's conventions so the Record does not leak them.</li>
          <li><strong><code>strict</code> mode changes policy, not parsing.</strong> The same line is imperfect either way; the flag decides whether imperfect is acceptable. That belongs to the caller, because a security audit and a traffic report want different answers.</li>
          <li><strong>The parser accumulates statistics</strong> (<code>parsed</code>, <code>failed</code>, <code>problems</code> by kind), so a caller can ask "how well did this go?" without instrumenting the loop itself.</li>
        </ul>
        <h4>Format detection, cheaply</h4>
        <pre><code>{"# A cheap confidence score, used later to sniff an unknown file's format.\n# Deliberately not a full parse: it runs on a handful of sample lines.\nsub detect ($class, @lines) {\n    my $hits = grep { /^\\S+ \\s+ \\S+ \\s+ \\S+ \\s+ \\[[^\\]]+\\] \\s+ \"[^\"]*\" \\s+ \\d{3}/x } @lines;\n    return @lines ? $hits / @lines : 0;\n}\n"}</code></pre>
        <p>A score between 0 and 1 rather than a boolean, because Milestone 6 will ask every parser and pick the most confident. Using a looser pattern than the real one is deliberate: detection should recognise the family, and parsing should handle the details.</p>
        <h3>The tests, which are the real deliverable</h3>
        <pre><code>{"subtest \"unparsable input is kept, not thrown away\" => sub {\n    for my $case (\n        [\"this is not a log line at all\", \"no_match\"],\n        ['10.14.22.9 - - [12/Sep/2026:13:44:11 +0000] \"GET /trunc', \"no_match\"],\n        [\"\", \"blank\"],\n        [\"   \", \"blank\"],\n    ) {\n        my ($line, $expected) = @$case;\n        my $r = $p->parse($line, file => \"access.log\", lineno => 99);\n        is $r->{problem}, $expected, \"'\" . substr($line, 0, 24) . \"' => $expected\";\n        is $r->{raw}, $line, \"  raw text is preserved\";\n        is $r->{file}, \"access.log\", \"  provenance is preserved\";\n    }\n};\n\nsubtest \"imperfect but usable\" => sub {\n    my $line = '10.14.22.9 - - [12/Sep/2026:13:44:10 +0000] \"GET /api/export HTTP/1.1\" 200';\n    my $r = $p->parse($line);\n\n    is $r->{status}, 200, \"we still got the status\";\n    is $r->{bytes},  0,   \"missing bytes defaults to 0\";\n    is_deeply $r->{problems}, [\"missing_bytes\"], \"the problem is recorded\";\n    ok !$r->{problem}, \"but the record is still usable\";\n\n    my $strict = Strata::Parser::Apache->new(strict => 1);\n    is $strict->parse($line)->{problem}, \"missing_bytes\", \"strict mode rejects it\";\n};\n"}</code></pre>
        <pre className="plain"><code>{"$ prove -l t/20-parser-apache.t\nt/20-parser-apache.t .. ok\nAll tests successful.\n"}</code></pre>
        <p>Points of technique worth copying. <strong><code>subtest</code> groups related assertions</strong> and names them, so a failure says which behaviour broke rather than which line number. <strong>A loop over a list of <code>[input, expected]</code> pairs</strong> is Perl's table-driven test, and adding a newly discovered broken line is one line. <strong><code>is_deeply</code> compares nested structures</strong>, which is how you assert on an arrayref without writing four assertions.</p>
        <p>Most importantly: <strong>the interesting tests are the failure cases.</strong> Six of the assertions concern lines that do not parse, because the whole point of the parser is what it does when the data is wrong.</p>
        <div className="exercise">
          <h5>
            <img className="mascot-right" src={img3.src} alt="The Mewlang cat, giving a playful wink" width="110" />
            Exercise 3
          </h5>
          <ol>
            <li><strong>An nginx error-log parser.</strong> It looks like <code>2026/09/12 13:44:09 [error] 8823#0: *4412 upstream timed out, client: 10.14.22.9, server: api, request: "GET /api/export HTTP/1.1"</code>. Write <code>Strata::Parser::NginxError</code> with the same contract: always returns a record, records problems, counts by kind, and has a <code>detect</code>. Note that the trailing key-value pairs are a variable set, so parse them generically rather than naming each one.</li>
            <li><strong>Fuzz your parser.</strong> Take 200 good lines, and for each produce a mutant: truncate at a random point, delete a random character, insert a stray quote, or double a field. Assert that <code>parse</code> never dies, never hangs, and always returns a hashref with a <code>raw</code> field. Fix whatever this finds.</li>
            <li><strong>Catastrophic backtracking.</strong> Construct a line that makes a naive version of the pattern (using <code>"(.*)"</code> for the request field) take more than a second, and show that the <code>[^"]*</code> version does not. Then explain why.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 3 — open after trying</summary>
          <p><strong>1.</strong> The generic key-value tail is the interesting part:</p>
          <pre><code>{"my $NGINX_ERROR = qr{\n    ^ (?<ts>\\d{4}/\\d{2}/\\d{2} \\s \\d{2}:\\d{2}:\\d{2}) \\s+\n      \\[ (?<level>\\w+) \\] \\s+\n      (?<pid>\\d+)\\#(?<tid>\\d+): \\s*\n      (?: \\*(?<connection>\\d+) \\s+ )?\n      (?<message>.+?)\n      (?: , \\s+ (?<tail>\\w+: \\s .*) )? $\n}x;\n\n# then, for the tail:\nif (defined $f{tail}) {\n    while ($f{tail} =~ /(\\w+): \\s+ ( \"[^\"]*\" | [^,]+ )/gx) {\n        my ($k, $v) = ($1, $2);\n        $v =~ s/^\"|\"$//g;\n        $rec{\"ctx_$k\"} = $v;\n    }\n}\n"}</code></pre>
          <p>Two lessons. <strong>Prefix generically-extracted keys</strong> (<code>ctx_</code>) so they cannot collide with fields you control; otherwise a log line containing <code>status: hacked</code> overwrites your parsed status. And the alternation <code>( "[^"]*" | [^,]+ )</code> handles values that are quoted and may contain commas, which the naive <code>[^,]+</code> gets wrong on exactly the lines you care about.</p>
          <p><strong>2. Fuzzing.</strong></p>
          <pre><code>{"my @mutators = (\n    sub ($l) { substr($l, 0, int rand length $l) },              # truncate\n    sub ($l) { my $i = int rand length $l; substr($l, $i, 1) = \"\"; $l },\n    sub ($l) { my $i = int rand length $l; substr($l, $i, 0) = '\"'; $l },\n    sub ($l) { $l . $l },\n    sub ($l) { my $i = int rand length $l; substr($l, $i, 1) = \"\\x{263A}\"; $l },\n);\n\nfor my $line (@good_lines) {\n    for my $mutate (@mutators) {\n        my $mutant = $mutate->($line);\n        my $rec = eval { $p->parse($mutant) };\n        ok defined $rec, \"survived: \" . substr($mutant, 0, 30);\n        ok exists $rec->{raw}, \"kept the raw text\";\n    }\n}\n"}</code></pre>
          <p>Wrapping in <code>eval</code> and asserting it was not needed is the point: the test passes only if no mutant made the parser die. Include a Unicode mutation, because encoding surprises are the most common real-world corruption and Milestone 7 is about them.</p>
          <p><strong>3. Catastrophic backtracking.</strong> A pattern with a quantified group that can match the same text several ways, followed by something that fails, forces the engine to try every combination. With <code>"(.*)" \s+ (\d{'{'}3{'}'})</code> against a line containing many quotes and no valid status, the engine tries every possible split. The measurable version:</p>
          <pre className="plain"><code>{"my $evil = '10.0.0.1 - - [x] \"' . ('a\" \"' x 20) . 'GET / HTTP/1.1\" xxx';"}</code></pre>
          <p><code>[^"]*</code> cannot backtrack across a quote, so there is exactly one way to match each field and the engine fails immediately. <strong>The general rule: make each part of a pattern match exactly one thing, and the regex engine never has to guess.</strong> Perl 5.10+ also offers possessive quantifiers (<code>.*+</code>) and atomic groups (<code>(?{'>'}...)</code>), which forbid backtracking explicitly; use them when a negated class is not available.</p>
        </details>
        <h4>Common mistakes in Milestone 3</h4>
        <div className="warn">
          <ul>
            <li><strong>Returning <code>undef</code> for unparsable lines.</strong> You have just discarded the evidence.</li>
            <li><strong>Throwing an exception per bad line.</strong> One malformed line in a million should not need a <code>try</code> block in the caller's hot loop.</li>
            <li><strong>Not copying <code>%+</code></strong> before the second match. The request-line match resets it.</li>
            <li><strong>Forgetting <code>chomp</code></strong> in the parser, so <code>$</code> in the pattern has to cope with a newline (it does, once, which makes the bug intermittent and confusing).</li>
            <li><strong>Making <code>detect</code> as strict as <code>parse</code></strong>. Detection should recognise a family, loosely and cheaply.</li>
            <li><strong>Letting a generically-extracted key overwrite a parsed field.</strong> Prefix them.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does <code>parse</code> never return <code>undef</code>?</li>
          <li>What are the three outcomes and how does a caller tell them apart?</li>
          <li>How does one pattern handle both common and combined logs, and why not two patterns?</li>
          <li>Why does the parser store <code>0 + $f{'{'}status{'}'}</code> rather than the string?</li>
          <li>What does interpolating a <code>qr//</code> into another pattern preserve?</li>
          <li>Why is <code>detect</code> deliberately looser than <code>parse</code>?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 4</span>A Record and a Pipeline</h2>
        <h3>Goal</h3>
        <p>Stop passing bare hashes around. A <code>Record</code> carries fields, provenance, problems and extracted entities, and knows how to render itself. A <code>Pipeline</code> reads a source, parses it, wraps the result, and passes it through a list of stages. Nothing downstream ever learns which format a record came from.</p>
        <h3>Concepts</h3>
        <p><code>bless</code> and accessor methods, closures as pipeline stages, code references in data structures, in-memory filehandles for testing, and the cost of abstraction measured rather than assumed.</p>
        <h3>Design</h3>
        <p>The pipeline is the project's spine, so its contract should be as small as possible:</p>
        <pre className="plain"><code>{"  source (filehandle)\n      │  one line\n      ▼\n  parser->parse(line, file => ..., lineno => ...)   returns a plain hash\n      ▼\n  Strata::Record->from_parsed(...)                  wraps it\n      ▼\n  stage 1 -> stage 2 -> stage 3                     each: ($rec, $pipe) -> $rec or undef\n      ▼\n  counted, and forgotten                            nothing accumulates records"}</code></pre>
        <p>Three consequences of that shape, all deliberate:</p>
        <ul>
          <li><strong>A stage returning <code>undef</code> drops the record</strong>, which is how filtering works without a separate mechanism.</li>
          <li><strong>The pipeline never stores records.</strong> Anything that needs to accumulate (counts, samples, a database) does it in a stage's own closure, so memory is that stage's responsibility and is visible in its code.</li>
          <li><strong>Opening files is not the pipeline's job.</strong> <code>run_handle</code> takes an already-open handle, so gzip, encodings and standard input are somebody else's problem, which is exactly what Milestone 7 needs.</li>
        </ul>
        <h3>Implementation</h3>
        <h4>lib/Strata/Record.pm</h4>
        <pre><code>{"# Build a Record from the plain hash a parser returns. Keeping this in one\n# place means parsers stay simple and the Record owns the shape.\nsub from_parsed ($class, $parsed) {\n    my %copy = %$parsed;\n    my %meta;\n    $meta{$_} = delete $copy{$_} for qw(source file lineno raw problems);\n\n    return $class->new(\n        %meta,\n        fields   => \\%copy,\n        problems => $meta{problems} // [],\n    );\n}\n\nsub problems ($self) { @{ $self->{problems} } }\nsub ok       ($self) { !@{ $self->{problems} } }\nsub where    ($self) { $self->{file} . \":\" . $self->{lineno} }\n\nsub field ($self, $name, @set) {\n    $self->{fields}{$name} = $set[0] if @set;\n    return $self->{fields}{$name};\n}\n"}</code></pre>
        <ul>
          <li><strong><code>delete</code> in a loop splits one hash into two.</strong> <code>$meta{'{'}$_{'}'} = delete $copy{'{'}$_{'}'} for qw(...)</code> moves the metadata keys out, leaving only the parsed fields behind. Compact, and it means a parser that adds a new field needs no change here.</li>
          <li><strong><code>sub field ($self, $name, @set)</code></strong> is a getter and setter in one: pass a value and it sets, omit it and it gets. Using a slurpy <code>@set</code> rather than a defaulted scalar is what lets you set a field to <code>undef</code> deliberately, which matters because "known to be absent" and "not looked at" are different.</li>
          <li><code>where</code> exists because <code>"$rec-{'>'}{'{'}file{'}'}:$rec-{'>'}{'{'}lineno{'}'}"</code> would otherwise appear in thirty places, and a record that cannot say where it came from is useless in a forensic tool. </li>
        </ul>
        <h4>lib/Strata/Pipeline.pm</h4>
        <pre><code>{"sub run_handle ($self, $fh, $name) {\n    while (defined(my $line = <$fh>)) {\n        $self->{stats}{lines}++;\n        my $parsed = $self->{parser}->parse($line, file => $name, lineno => $.);\n        my $record = Strata::Record->from_parsed($parsed);\n\n        $self->{stats}{problems}++ if !$record->ok;\n        $self->{problems_by_kind}{$_}++ for $record->problems;\n\n        my $kept = $record;\n        for my $stage (@{ $self->{stages} }) {\n            $kept = $stage->{code}->($kept, $self) or last;\n        }\n\n        if ($kept) { $self->{stats}{records}++ }\n        else       { $self->{stats}{dropped}++ }\n    }\n    return $self;\n}\n"}</code></pre>
        <p><strong><code>while (defined(my $line = {'<'}$fh{'>'}))</code></strong>, not <code>while (my $line = {'<'}$fh{'>'})</code>. A line containing just <code>"0"</code> with no newline is false in Perl, so the plain form stops early on a file whose last line is a bare zero. Perl special-cases <code>while ({'<'}$fh{'>'})</code> to add the <code>defined</code> for you, but <em>only</em> for that exact shape; the moment you write anything else, you need it yourself. This is a genuine bug that appears once every few years and takes an afternoon.</p>
        <p><code>$stage-{'>'}{'{'}code{'}'}-{'>'}($kept, $self) or last</code> — call the code reference, and stop the chain when it returns false. Perl's <code>or</code> has very low precedence, which is exactly what makes this read as "do this, or else stop".</p>
        <h4>Stages are closures</h4>
        <pre><code>{"# counter(\"status\") returns a stage and a hashref it fills in.\nsub counter ($field) {\n    my %counts;\n    my $stage = sub ($rec, $) {\n        my $value = $rec->field($field);\n        $counts{ defined $value ? $value : \"(undef)\" }++;\n        return $rec;\n    };\n    return ($stage, \\%counts);\n}\n\nsub drop_problems () {\n    return sub ($rec, $) { return $rec->ok ? $rec : undef };\n}\n\nsub sample ($n, $out) {\n    my $seen = 0;\n    return sub ($rec, $) {\n        push @$out, $rec if $seen++ < $n;\n        return $rec;\n    };\n}\n"}</code></pre>
        <p><strong>Returning both the stage and the hash it fills is the key move.</strong> <code>%counts</code> is a lexical variable captured by the closure; the caller gets a reference to it and can read the results after the run, but nobody can reach it except through the stage. That is encapsulation without a class, and it is the most Perl-ish thing in this milestone.</p>
        <p><code>sub ($rec, $)</code> — a signature with an unnamed second parameter. It accepts the pipeline argument and says plainly that this stage ignores it, which is better than accepting a parameter you never mention. </p>
        <h4>Testing with in-memory filehandles</h4>
        <pre><code>{"sub fh_for (@lines) {\n    my $text = join \"\\n\", @lines, \"\";\n    open my $fh, \"<\", \\$text or die $!;   # an in-memory filehandle\n    return $fh;\n}\n"}</code></pre>
        <p><strong><code>open $fh, "{'<'}", \$string</code> opens a scalar as a file.</strong> No temporary files, no fixtures on disk for the small cases, no cleanup, and the tests run in milliseconds. Every language should have this and most make you reach for a library. Use real fixture files for the realistic cases and in-memory handles for the focused ones.</p>
        <pre className="plain"><code>{"$ prove -l t/\nt/20-parser-apache.t .. ok\nt/30-pipeline.t ....... ok\nAll tests successful.\nFiles=2, Tests=9\n"}</code></pre>
        <h3>Putting it together</h3>
        <pre className="plain"><code>{"$ ./bin/strata ingest share/fixtures/access.log\n  share/fixtures/access.log                    2004 lines\n\n2,004 lines, 2,004 records, 4 with problems, 2004 lines/sec\n\nproblems\n  blank                     1\n  missing_bytes             1\n  no_match                  2\n\nfirst offenders\n  share/fixtures/access.log:2001  10.14.22.9 - - [12/Sep/2026:13:44:10 +0000] \"G\n  share/fixtures/access.log:2002  this is not a log line at all\n  share/fixtures/access.log:2003  10.14.22.9 - - [12/Sep/2026:13:44:11 +0000] \"G\n\ntop clients\n  10.14.22.9          1021\n  10.14.22.31          344\n  192.168.4.7          324\n  172.16.0.99          312\n  (undef)                3\n\nstatus codes\n  (undef)       3\n  200       1029\n  ...\n"}</code></pre>
        <p>Compare with Milestone 2: <strong>the same file now yields 2,004 records instead of 2,000</strong>, because the missing-bytes line is parsed rather than discarded, and the three genuinely unparsable lines are present as records with problems rather than absent. Client <code>10.14.22.9</code> gained the request it was previously denied.</p>
        <p>The <code>(undef)</code> rows are the new behaviour being honest: those are the unparsable records flowing through counters that expect fields. In a real report you would put <code>drop_problems()</code> before the counters, or have the counter skip records that are not <code>ok</code>. Seeing them is better than not seeing them, and choosing where to drop them is now a one-line decision in the pipeline rather than a property of the parser.</p>
        <h3>What the abstraction costs</h3>
        <p>Three programs, the same 200,400-line file, same machine:</p>
        <pre className="plain"><code>{"./bin/strata-scan                 0.37s   544,525 lines/sec    (count and match only)\n./bin/strata-report               1.72s   116,322 lines/sec    (regex + six hashes)\n./bin/strata ingest               5.47s    36,668 lines/sec    (Record objects + stages)\n"}</code></pre>
        <p>And memory, peak resident set on a 21 MB file:</p>
        <pre className="plain"><code>{"strata ingest (streaming)                     9,036 KB\nbare read loop                                4,992 KB\nslurping the file into an array              43,292 KB\n"}</code></pre>
        <p>
          <img className="mascot-left" src={img4.src} alt="The Mewlang cat, unimpressed" width="110" />
          Two findings, and the second one is uncomfortable.
        </p>
        <p><strong>Streaming works.</strong> The pipeline uses 9 MB regardless of file size, while slurping a 21 MB file into an array costs 43 MB, about twice the file, because every line becomes a Perl scalar with its own overhead. On a 21 GB file that is 43 GB and the difference between a tool and an outage.</p>
        <p><strong>The object pipeline is three times slower than the flat script, and fifteen times slower than counting.</strong> That is the price of one blessed hash and two closure calls per line, and it is real: 36,000 lines a second means a 200 GB log takes hours.</p>
        <p>Is it worth it? For now, yes, and I want to be precise about why rather than waving at "clean code". The pipeline buys pluggable formats (Milestone 6), reusable stages, provenance that survives, and a testable seam. A flat script buys none of those and would have to be rewritten to gain any of them. <strong>But the number is now on the table, it is the reason Milestone 11 exists, and the honest answer at that point may be that the hot loop gets specialised while the architecture stays.</strong> This is exactly the trade the Go course made in reverse: there, the profile said channel overhead dominated and we removed it; here, the profile will say object creation dominates, and we will decide what to do with that evidence rather than guessing now.</p>
        <div className="exercise">
          <h5>
            <img className="mascot-right" src={img5.src} alt="The Mewlang cat, thinking with a paw to its chin" width="110" />
            Exercise 4
          </h5>
          <ol>
            <li><strong>Find the cost.</strong> Profile <code>bin/strata</code> with <code>Devel::NYTProf</code> (<code>perl -d:NYTProf bin/strata ingest big.log</code> then <code>nytprofhtml</code>) and report what actually dominates. Predict first, then check: is it <code>bless</code>, the regex, the closures, or something you did not consider?</li>
            <li><strong>Make a lightweight record.</strong> Implement a variant where a record is a plain hashref with a documented shape and the methods become functions. Measure the difference. Then decide, with the number in hand, which you would ship and write down why.</li>
            <li><strong>A stage that needs two records.</strong> Write a <code>pair_with_previous</code> stage that attaches the previous record from the same client to each record (as <code>prev</code>), so a later stage can compute inter-request intervals. Bound its memory: it must not keep more than one record per client, and must forget clients not seen for N records.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 4 — open after trying</summary>
          <p><strong>1.</strong> The likely answer is not <code>bless</code> (which is cheap) but the sheer number of hash allocations: <code>parse</code> builds <code>%rec</code> and <code>%f</code>, <code>from_parsed</code> builds <code>%copy</code> and <code>%meta</code> plus the object, so each line allocates five hashes where the flat script allocates one. Perl hashes are not cheap. The regex is usually second, and the closure calls are a distant third.</p>
          <p>The lesson to internalise: <strong>in Perl, the cost of "clean" is usually allocation, not indirection.</strong> That points at a specific fix (build fewer intermediate structures) rather than a vague one (use fewer objects).</p>
          <p><strong>2.</strong> A plain hashref with functions instead of methods typically recovers much of the gap, because you skip the object and one hash copy. Having measured it, the design conversation becomes concrete. My own answer would be: keep the Record class as the public interface, and have <code>from_parsed</code> bless the parser's hash <em>in place</em> rather than copying it:</p>
          <pre><code>{"sub from_parsed ($class, $parsed) {\n    my %meta;\n    $meta{$_} = delete $parsed->{$_} for qw(source file lineno raw problems);\n    $meta{fields} = $parsed;              # reuse, do not copy\n    $meta{problems} //= [];\n    $meta{entities} = {};\n    return bless \\%meta, $class;\n}\n"}</code></pre>
          <p>One hash instead of three, the same API, no caller changes. <strong>That is the shape of most good Perl optimisation: stop copying, keep the interface.</strong> The cost is that the parser must not reuse the hash it returned, which is now a documented contract rather than an assumption.</p>
          <p><strong>3.</strong> The bounded memory requirement is the whole exercise:</p>
          <pre><code>{"sub pair_with_previous ($forget_after = 10_000) {\n    my (%last, %last_seen, $n);\n\n    return sub ($rec, $) {\n        my $client = $rec->field(\"client\") // return $rec;\n        $n++;\n\n        $rec->field(prev => $last{$client}) if exists $last{$client};\n        $last{$client} = $rec;\n        $last_seen{$client} = $n;\n\n        # Periodically forget clients we have not seen recently, so a log\n        # with a million distinct clients cannot exhaust memory.\n        if ($n % $forget_after == 0) {\n            for my $c (keys %last_seen) {\n                next if $n - $last_seen{$c} < $forget_after;\n                delete $last{$c};\n                delete $last_seen{$c};\n            }\n        }\n        return $rec;\n    };\n}\n"}</code></pre>
          <p>Three points. <strong>Any stage that remembers anything keyed by data needs an eviction policy</strong>, because the key space is controlled by the input and therefore by whoever generated it. <strong>Periodic sweeps beat per-record checks</strong>: doing the cleanup every 10,000 records amortises it to nothing. And <strong>holding a reference to the previous record keeps that entire record alive</strong>, including its raw line, so a long-lived map of "previous per client" can be much bigger than it looks; storing only the fields you need (the timestamp) would be the frugal version.</p>
        </details>
        <h4>Common mistakes in Milestone 4</h4>
        <div className="warn">
          <ul>
            <li><strong><code>while (my $line = {'<'}$fh{'>'})</code> without <code>defined</code>.</strong> Stops on a final line of <code>"0"</code>.</li>
            <li><strong>Accumulating records in the pipeline</strong> "just for now". The memory profile is the feature; do not give it away.</li>
            <li><strong>Opening files inside the pipeline</strong>, which makes gzip, stdin and encodings impossible to add later without touching it.</li>
            <li><strong>A stage that returns nothing</strong> by accident (a trailing <code>print</code>, whose return value is 1, is fine; a trailing <code>my $x = ...;</code> is not). A stage must return the record.</li>
            <li><strong>Forgetting that <code>$.</code> is the line number of the last handle read</strong>, which is right here because there is one handle, and will need care when you nest readers.</li>
            <li><strong>Assuming an abstraction is free.</strong> Measure it, then decide.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why does the pipeline take an open filehandle rather than a filename?</li>
          <li>How does a stage drop a record, and where does the count go?</li>
          <li>Why does <code>counter</code> return both a stage and a hash reference?</li>
          <li>What does <code>open $fh, "{'<'}", \$string</code> do and why is it useful in tests?</li>
          <li>Why must the read loop say <code>defined</code>?</li>
          <li>The object pipeline runs at a third the speed of the flat script. What did that buy, and what will you do about it?</li>
        </ol>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Milestone 3 is Perl's strongest showing so far. The pattern library composes compiled regexes as values; one pattern with an optional group handles two log formats; named captures mean the parser reads like the data; and the whole thing is eighty lines including statistics and detection. In Python this is <code>re.compile</code>, a dict of patterns, <code>match.groupdict()</code>, and noticeably more scaffolding; in Go it is a struct, a <code>regexp.MustCompile</code>, and manual index juggling because Go's regexp has no named-capture convenience worth the name.</p>
          <p>Milestone 4 is where Perl's age shows. <code>bless</code> gives you a class with no encapsulation, no attribute declarations and no type checking, so <code>Strata::Record</code> is thirty lines of hand-written accessors that Moo would generate and that Go or Ruby would give you outright. The three-times slowdown from wrapping each line in an object is also worse than it would be in a language with cheaper objects.</p>
          <p>The right conclusion is not "Perl is bad at objects" but something more useful: <strong>Perl rewards you for keeping data flat and transformations dense, and charges you for elaborate structure.</strong> That is precisely the opposite of Ruby's incentives, and it is why the same architecture drawn on a whiteboard produces different code in each. Designing with the grain of the language, rather than importing an architecture wholesale, is most of what "knowing a language" means.</p>
        </div>
        <h3>Repository state after Milestone 4</h3>
        <pre className="plain"><code>{"strata/\n├── bin/\n│   ├── strata            ingest subcommand, wires a pipeline together\n│   ├── strata-scan       milestone 1: the filter\n│   └── strata-report     milestone 2: one-pass reporting\n├── lib/Strata/\n│   ├── Pattern.pm        named, composable qr// building blocks\n│   ├── Record.pm         fields + provenance + problems + entities\n│   ├── Pipeline.pm       source -> parser -> stages, with stats\n│   └── Parser/\n│       └── Apache.pm     common and combined, lenient and strict\n├── t/\n│   ├── 20-parser-apache.t   good, imperfect, broken, statistics, detection\n│   └── 30-pipeline.t        stages, dropping, provenance\n└── share/fixtures/\n    └── access.log        2,004 lines, four of them deliberately wrong\n"}</code></pre>
        <pre className="plain"><code>{"$ prove -l t/\nAll tests successful.  Files=2, Tests=9\n$ git commit -am \"milestone 4: a record model and a streaming pipeline\"\n"}</code></pre>
        <footer className="end">
          <p>
            <img className="mascot-left" src={img6.src} alt="The Mewlang cat, walking forward" width="120" />
            Instalment 12 of the five-course curriculum. Next: Perl Milestones 5–8, where the code becomes a distributable module with a cpanfile, CSV, JSON and XML parsers arrive behind a sniffing dispatch table, the reader learns to survive gzip, mixed encodings and truncation, and entity extraction turns records into things you can correlate.
          </p>
        </footer>
         <Link className="button" href="/perl-course/milestones/5-8/">Continue</Link> 
      </div>
    </div>
  );
}
