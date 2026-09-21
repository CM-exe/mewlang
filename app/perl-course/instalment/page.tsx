import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: "Perl Parts 0–2 — The Text Archaeologist, Setup, and the Language",
};

export default function Page() {
  return (
    <div className="theme-perl">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 11 · Course 3 (Perl) · Parts 0–2</p>
          <h1>The language that assumes your data is a mess</h1>
          <p className="lede">Go was about concurrency and Ruby about expressiveness. Perl is about the hour you spend
                with ten gigabytes of logs that nobody documented, half of which are truncated, and a question you need
                answered by lunchtime.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Every example below was run on Perl 5.38.2 and the outputs are copied from those runs. The modules used
                in the project (<code>Text::CSV</code>, <code>DBI</code>, <code>DBD::SQLite</code>,
                <code>XML::LibXML</code>, <code>Try::Tiny</code>) are installed in my sandbox, so the later milestones
                will be verified too.</p>
        </div>
        <h2><span className="num">Course 3 · Part 0</span>What are we building?</h2>
        <h3>The final result</h3>
        <p>A command-line tool called <code>strata</code> that you point at a directory of unexplained files and
            interrogate.</p>
        <pre className="plain"><code>{"$ strata ingest ./incident-2026-09-12/ --recursive\n  apache/access.log        412,884 lines   apache_combined     3.2s\n  apache/error.log          18,221 lines   apache_error        0.4s\n  app/service.log          904,110 lines   json_lines          8.1s\n  exports/users.csv          9,412 rows    csv                 0.3s\n  config/nginx.conf            420 lines   nginx_config        0.0s\n  unknown/dump.txt          33,900 lines   unstructured        1.1s\n  corrupt/partial.log        2,004 lines   apache_combined     0.1s  (91 malformed, kept)\n\n  1,381,051 records, 214,882 entities, 46,203 events in 13.2s (104k lines/sec)\n\n$ strata entities --type ip --top 5\n  10.14.22.9        88,214 occurrences   6 files   first 13:02:11  last 14:47:52\n  10.14.22.31       41,002 occurrences   4 files   ...\n\n$ strata timeline --entity ip:10.14.22.9 --around '13:44:10' --window 90s\n  13:43:58  apache/access.log:88214   GET /api/export  200  1.2MB\n  13:44:02  app/service.log:551203    export.start  user=4412 rows=900000\n  13:44:09  apache/error.log:9902     upstream timed out\n  13:44:10  app/service.log:551288    ERROR OOM killed worker pid=8823\n  13:44:11  apache/access.log:88240   GET /api/export  502\n\n$ strata graph --entity user:4412 --depth 2 --format dot | dot -Tsvg > incident.svg\n"}</code></pre>
        <p>Underneath: a streaming ingestion pipeline with pluggable format detectors, an entity extractor, a normaliser
            that turns eleven timestamp formats into one, a correlation engine that groups records into events, and a
            SQLite-backed store you can query, all of it able to survive files that are truncated, mis-encoded, or
            simply lying about their format.</p>
        <h3>Why this project is interesting</h3>
        <p>Most data-processing tutorials use clean data, which is the one thing you will never be given. Real forensic
            work looks like this: eight formats, three of them undocumented, timestamps in four time zones, a log
            rotated mid-write so one line is half of two lines, an "XML" file that is actually XML fragments
            concatenated without a root element, and a CSV whose quoting breaks on row 40,000 because someone's surname
            contains a comma <em>and</em> a quotation mark.</p>
        <p>The interesting engineering is not parsing any one format. It is building something that <strong>keeps
                going</strong>: that treats malformed input as expected rather than exceptional, that tells you exactly
            what it could not parse and why, and that never loads more than one line into memory so the same tool works
            on a 2 KB file and a 200 GB one.</p>
        <h3>Why Perl in particular</h3>
        <ul>
          <li><strong>Regular expressions are syntax, not a library.</strong> <code>if ($line =~ /^(\S+) (\S+)/)</code> versus Python's
                <code>m = re.match(r'^(\S+) (\S+)', line); if m: m.group(1)</code>. One of those disappears into the
                code and one of them is visible machinery. Over ten thousand lines of parsing that difference compounds.
            </li>
          <li><strong>Line-oriented streaming is the default.</strong> <code>while ({'<'}{'>'}) {'{'} ... {'}'}</code> reads
                standard input or every file named on the command line, one line at a time, with no imports and no
                ceremony. Your program is a filter before you have decided to write one.</li>
          <li><strong>Context makes text code short.</strong> <code>my @all = $text =~ /(\w+)@([\w.]+)/g;</code>
                collects every capture from every match into a list, in one expression.</li>
          <li><strong>The one-liner is a first-class tool.</strong> <code>perl -lane 'print $F[6] if $F[8] == 500' access.log</code> is a complete program you type into a
                terminal while exploring, and the language you explore in is the language you write the tool in.</li>
          <li><strong>CPAN has parsed your format already.</strong> Every log shape, every date dialect, every
                encoding disaster has a module written by someone who hit it in 2003 and is still maintained.</li>
          <li><strong>It starts in milliseconds and is everywhere.</strong> Perl is on every Unix box you will ever be
                handed, which matters when the machine with the logs on it is not your laptop.</li>
        </ul>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>For the middle of this project (streaming, regex-heavy, line-oriented transformation with Unix plumbing),
                Perl is still the best tool in existence, and the reason is not nostalgia: no other language has put
                regular expressions, context, and the input loop into the syntax itself.</p>
          <p>Where it is not the answer, and we will say so at the time:</p>
          <ul>
            <li><strong>Structured analysis.</strong> Once the data is clean and rectangular, Python with pandas or
                    Polars is better. Grouping, joining and statistics are libraries there and hand-written loops here.
                </li>
            <li><strong>Raw throughput.</strong> Go or Rust would be several times faster on the same regexes and
                    would parallelise more easily. We will measure this rather than assert it.</li>
            <li><strong>Long-lived services.</strong> Perl is a fine language for programs that start, work and
                    exit. For something that runs for six months, the ecosystem's tooling for observability and
                    deployment is thinner than Go's.</li>
            <li><strong>Team maintenance.</strong> Perl earns its reputation for write-only code when written badly,
                    and badly is easy. A large part of this course is the discipline that prevents it:
                    <code>use v5.36</code>, named captures, <code>/x</code>, real data structures, and tests.</li>
          </ul>
          <p>The honest summary: Perl is the best language I know for the first two hours with unknown data, and you
                should be prepared to hand the result to something else afterwards. Knowing <em>when</em> to hand over
                is part of what this course teaches.</p>
        </div>
        <h3>Architecture we are building toward</h3>
        <pre className="plain"><code>{"   files (any shape, any size, some broken)\n        │\n        ▼\n  ┌───────────────┐   one line at a time, constant memory\n  │  Source       │   handles gzip, encodings, truncation\n  └───────┬───────┘\n          ▼\n  ┌───────────────┐   sniffs the format, or is told\n  │  Detector     │   apache | nginx | json_lines | csv | xml | conf | code | unknown\n  └───────┬───────┘\n          ▼\n  ┌───────────────┐   a plugin per format, each returning a Record\n  │  Parsers      │   malformed lines become Records with a `problem` field,\n  └───────┬───────┘   never exceptions and never silent drops\n          ▼\n  ┌───────────────┐   ips, emails, paths, ids, versions, timestamps...\n  │  Extractors   │   each is a named regex plus a normaliser\n  └───────┬───────┘\n          ▼\n  ┌───────────────┐   one canonical timestamp, one canonical host,\n  │  Normaliser   │   one canonical path, whatever the source said\n  └───────┬───────┘\n          ▼\n  ┌───────────────┐   records near in time and sharing an entity\n  │  Correlator   │   become events; events referencing each other\n  └───────┬───────┘   become a graph\n          ▼\n  ┌───────────────┐\n  │  Store        │   SQLite: records, entities, occurrences, events, edges\n  └───────┬───────┘\n          ▼\n   query · timeline · graph · report        (and stdout, for piping)\n"}</code></pre>
        <h3>The twelve milestones</h3>
        <table className="grid">
          <tbody>
            <tr>
              <th>#</th>
              <th>Milestone</th>
              <th>What it teaches</th>
            </tr>
            <tr>
              <td>1</td>
              <td>A filter that counts what it reads</td>
              <td>scalars, <code>while ({'<'}{'>'})</code>, <code>$_</code>, strict and warnings, exit codes</td>
            </tr>
            <tr>
              <td>2</td>
              <td>Summaries: top talkers, error rates</td>
              <td>hashes, sorting, context, output formatting</td>
            </tr>
            <tr>
              <td>3</td>
              <td>An Apache/nginx parser</td>
              <td>regexes, named captures, <code>/x</code>, <code>qr//</code>, failure counting</td>
            </tr>
            <tr>
              <td>4</td>
              <td>A Record model and a pipeline</td>
              <td>references, nested data, subs, <code>Data::Dumper</code></td>
            </tr>
            <tr>
              <td>5</td>
              <td>Splitting into modules</td>
              <td>packages, <code>lib/</code>, <code>cpanm</code>, cpanfile, <code>Test::More</code>,
                    <code>prove</code></td>
            </tr>
            <tr>
              <td>6</td>
              <td>Pluggable formats: CSV, JSON, XML</td>
              <td>dispatch tables, CPAN modules, format sniffing</td>
            </tr>
            <tr>
              <td>7</td>
              <td>Streaming 10 GB safely</td>
              <td>encodings, gzip, truncation, memory discipline, malformed-input policy</td>
            </tr>
            <tr>
              <td>8</td>
              <td>Entity extraction and normalisation</td>
              <td>IPs, timestamps, paths, ids; canonical forms; time zones</td>
            </tr>
            <tr>
              <td>9</td>
              <td>Correlation and sessionisation</td>
              <td>time windows, joins, SQLite via <code>DBI</code>, indexes</td>
            </tr>
            <tr>
              <td>10</td>
              <td>A proper command-line tool</td>
              <td><code>Getopt::Long</code>, exit codes, signals, pipes, <code>--help</code></td>
            </tr>
            <tr>
              <td>11</td>
              <td>Testing, fuzzing and profiling</td>
              <td><code>Test::More</code>, corrupt-input tests, <code>Devel::NYTProf</code>, optimisation</td>
            </tr>
            <tr>
              <td>12</td>
              <td>The knowledge graph</td>
              <td>graph storage and queries, <code>fork</code> for parallelism, packaging</td>
            </tr>
          </tbody>
        </table>
        <h3>What you will know afterwards</h3>
        <p>How to build a streaming pipeline that survives input designed to break it; how to write regexes that a
            colleague can read a year later; why Perl's context rule exists and how to stop it surprising you; how to
            correlate events across sources with nothing but a time window and a shared identifier; and when to stop and
            hand the cleaned data to something else.</p>
        <hr />
        <h2><span className="num">Course 3 · Part 1</span>Install and first program</h2>
        <h3>What Perl is</h3>
        <p>Perl is a dynamically typed, garbage-collected interpreted language from 1987, designed explicitly for report
            processing and system glue. It is not "Perl 6": that language was renamed Raku in 2019 and is a different
            thing. Perl 5 is alive, gets an annual release, and version 5.36 (2022) and 5.38 (2023) modernised it
            substantially, with subroutine signatures and a real class syntax.</p>
        <p>Two facts shape everything about the language. First, <strong>values have no fixed type but variables have a
                fixed <em>shape</em></strong>, marked by a sigil: <code>$</code> for a single value, <code>@</code> for
            a list, <code>%</code> for a key-value table. Second, <strong>every expression is evaluated in a
                context</strong>, either "give me one value" or "give me a list", and many operations do different
            things depending on which. Nothing else in mainstream programming works this way, and both are covered
            properly in Part 2.</p>
        <h3>Installing</h3>
        <p>Unlike Ruby, using the system Perl is <em>usually fine</em>: it is well-maintained, present everywhere, and
            most distributions keep it current enough. Perl's compatibility record is unusually good, so a script from
            2010 generally still runs. You want 5.36 or newer to get signatures and the modern feature bundle; I
            verified everything on 5.38.2.</p>
        <h5>Linux</h5>
        <pre className="plain"><code>{"perl -v                                 # almost certainly already there\nsudo apt install perl cpanminus         # Debian/Ubuntu: adds the cpanm installer\nsudo dnf install perl perl-App-cpanminus # Fedora\n\n# many CPAN modules exist as distribution packages, which is the easiest path:\nsudo apt install libtext-csv-perl libdbd-sqlite3-perl libxml-libxml-perl libtry-tiny-perl\n"}</code></pre>
        <h5>macOS</h5>
        <pre className="plain"><code>{"perl -v                    # Apple ships one, often a version or two behind\nbrew install perl          # newer, installed under /opt/homebrew\n"}</code></pre>
        <h5>Windows</h5>
        <pre className="plain"><code>{":: Strawberry Perl bundles a C compiler, so modules with XS code build\nwinget install StrawberryPerl.StrawberryPerl\n"}</code></pre>
        <p>Strawberry Perl is genuinely good. That said, this course leans on Unix habits (pipes, <code>STDIN</code>,
            signals, file permissions) more than any other in the curriculum, and WSL2 will save you real friction.</p>
        <h5>When you need your own Perl</h5>
        <p>If you need a version the system does not have, or you are installing modules on a machine where you have no
            root, use a version manager:</p>
        <pre className="plain"><code>{"curl -L https://install.perlbrew.pl | bash     # perlbrew\nperlbrew install perl-5.38.2\nperlbrew switch perl-5.38.2\n\n# or plenv, if you liked rbenv\n"}</code></pre>
        <h3>CPAN, cpanm, and not using sudo</h3>
        <p>CPAN is Perl's module archive, and at around 220,000 modules it is one of the oldest and deepest package
            ecosystems in existence. The modern client is <code>cpanm</code>:</p>
        <pre className="plain"><code>{"cpanm Text::CSV                  # install one module\ncpanm --installdeps .            # install everything a cpanfile lists\ncpanm --local-lib=~/perl5 DBI    # install into your home directory, no root\n\n# then tell perl where to find them (add to ~/.bashrc):\neval \"$(perl -I ~/perl5/lib/perl5 -Mlocal::lib)\"\n"}</code></pre>
        <p><strong>Never use <code>sudo cpanm</code>.</strong> It mixes modules you installed with modules your
            operating system manages, and the resulting breakage is tedious. Use <code>local::lib</code>, perlbrew, or
            your distribution's packages.</p>
        <p>For a project, declare dependencies in a <code>cpanfile</code>:</p>
        <pre className="plain"><code>{"# cpanfile\nrequires 'perl', '5.036';\nrequires 'Text::CSV', '2.00';\nrequires 'DBI';\nrequires 'DBD::SQLite';\nrequires 'Try::Tiny';\n\non 'test' => sub {\n    requires 'Test::More', '1.302';\n};\n"}</code></pre>
        <p>Then <code>cpanm --installdeps .</code> installs them. If you want a lockfile and a bundled dependency tree
            (Bundler's role), that is <strong>Carton</strong>: <code>carton install</code> writes
            <code>cpanfile.snapshot</code> and <code>carton exec</code> runs with exactly those versions.</p>
        <h3>Documentation: the best thing about Perl</h3>
        <pre className="plain"><code>{"perldoc -f split          # one built-in function, with examples\nperldoc perlre            # the regex reference\nperldoc perlretut         # the regex tutorial\nperldoc perlrequick       # the regex quick start\nperldoc perlvar           # what $_, @ARGV, $! and the rest mean\nperldoc perldsc           # data structures cookbook: the one to read twice\nperldoc perlop            # operators and precedence\nperldoc -q \"how do I sort\"  # search the FAQ\nperldoc Text::CSV         # any installed module's own documentation\nperldoc -l Text::CSV      # where that module actually lives on disk\n"}</code></pre>
        <p>Perl's documentation ships with the interpreter, is written by people who use the language, and is complete.
            <code>perldoc perlretut</code> alone is a better regex tutorial than most books. Get into the habit of
            reading it in a terminal rather than searching the web, because the web has thirty years of outdated Perl
            advice on it and <code>perldoc</code> has none.</p>
        <h3>Project layout</h3>
        <pre className="plain"><code>{"strata/\n├── cpanfile              dependencies\n├── bin/\n│   └── strata            the command-line program (no .pl extension)\n├── lib/\n│   └── Strata/\n│       ├── Record.pm     Strata::Record\n│       ├── Source.pm     Strata::Source\n│       └── Parser/\n│           ├── Apache.pm Strata::Parser::Apache\n│           └── CSV.pm\n├── t/\n│   ├── 00-load.t         does everything compile?\n│   ├── 10-record.t\n│   └── 20-parser-apache.t\n└── share/\n    └── fixtures/         sample logs, including deliberately broken ones\n"}</code></pre>
        <p>Three conventions, all enforced by tooling rather than taste:</p>
        <ul>
          <li><strong>Module names map to paths.</strong> <code>Strata::Parser::Apache</code> must live at
                <code>lib/Strata/Parser/Apache.pm</code>. <code>use lib 'lib'</code> or <code>perl -Ilib</code> puts
                <code>lib/</code> on the search path (<code>@INC</code>).</li>
          <li><strong>Tests live in <code>t/</code> and end in <code>.t</code></strong>, and are run by
                <code>prove</code>. Numbering them controls order.</li>
          <li><strong>Every module ends with <code>1;</code></strong>. A module must return a true value or
                <code>use</code> fails, and a bare <code>1;</code> is the conventional way. Forgetting it is every Perl
                programmer's first confusing error.</li>
        </ul>
        <h3>Hello, archaeology</h3>
        <pre><code>{"#!/usr/bin/env perl\nuse v5.36;\n\nmy $name = shift @ARGV // \"world\";\nsay \"hello, $name\";\nsay \"perl $^V, script $0, pid $$\";\n"}</code></pre>
        <pre className="plain"><code>{"$ perl hello.pl\nhello, world\nperl v5.38.2, script hello.pl, pid 18244\n\n$ perl hello.pl strata\nhello, strata\n"}</code></pre>
        <h4>Every line, explained</h4>
        <p><code>#!/usr/bin/env perl</code> — the shebang, so <code>./hello.pl</code> works once the file is executable.
            <code>/usr/bin/env perl</code> finds whichever Perl is first on your <code>PATH</code>, which is what you
            want with perlbrew.</p>
        <p><code>use v5.36;</code> — <strong>the single most important line in modern Perl.</strong> It enables a whole
            feature bundle at once:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>What it turns on</th>
              <th>Why it matters</th>
            </tr>
            <tr>
              <td><code>use strict</code></td>
              <td>Undeclared variables are a compile error, not a new global</td>
            </tr>
            <tr>
              <td><code>use warnings</code></td>
              <td>Undefined values, dubious conversions and typos in comparisons get reported</td>
            </tr>
            <tr>
              <td><code>say</code></td>
              <td><code>print</code> with a newline</td>
            </tr>
            <tr>
              <td>subroutine signatures</td>
              <td><code>sub f ($x, $y = 1) {'{'} ... {'}'}</code> instead of unpacking <code>@_</code> by hand</td>
            </tr>
            <tr>
              <td><code>isa</code>, postfix deref, and more</td>
              <td>modern conveniences without per-feature imports</td>
            </tr>
            <tr>
              <td>disables indirect object syntax</td>
              <td>removes a genuinely confusing old parsing rule</td>
            </tr>
          </tbody>
        </table>
        <p>Old Perl tutorials start with <code>use strict; use warnings;</code> as two separate lines.
            <code>use v5.36;</code> includes both and more, and it also <em>declares your minimum Perl version</em>, so
            running on something older fails immediately with a clear message rather than mysteriously.</p>
        <p><code>my $name = shift @ARGV // "world";</code> — <code>my</code> declares a lexical variable, scoped to the
            enclosing block. <code>@ARGV</code> holds the command-line arguments (unlike C, it does not include the
            program name, which is in <code>$0</code>). <code>shift</code> removes and returns the first element.
            <code>//</code> is the defined-or operator: use the left side unless it is <code>undef</code>. It differs
            from <code>||</code> in that <code>0</code> and <code>""</code> are kept, which matters constantly when
            parsing data where zero is a real value.</p>
        <p><code>say "hello, $name"</code> — double-quoted strings interpolate variables, including array and hash
            elements. Single quotes do not interpolate anything.</p>
        <p><code>$^V</code>, <code>$0</code>, <code>$$</code> — Perl's punctuation variables: the version, the program
            name, the process id. There are dozens; <code>perldoc perlvar</code> lists them all, and Part 2 covers the
            six you actually need.</p>
        <h3>One-liners, which are not a gimmick</h3>
        <p>Before writing a script, Perl programmers interrogate data from the shell. This is a real part of the
            language's culture and the fastest way to build intuition:</p>
        <pre className="plain"><code>{"# print lines matching a pattern (grep, but with Perl regexes)\nperl -ne 'print if /ERROR/' access.log\n\n# -l adds newline handling, -a splits each line into @F on whitespace\nperl -lane 'print $F[0] if $F[8] == 500' access.log\n\n# count by field: the Perl idiom you will use a thousand times\nperl -lane '$c{$F[0]}++; END { print \"$c{$_}\\t$_\" for sort { $c{$b} <=> $c{$a} } keys %c }' access.log\n\n# in-place edit with a backup\nperl -i.bak -pe 's/\\bDEBUG\\b/TRACE/g' service.log\n\n# -F sets the split pattern: CSV-ish, badly, but instantly\nperl -F, -lane 'print $F[2] if $F[4] > 100' export.csv\n"}</code></pre>
        <table className="grid">
          <tbody>
            <tr>
              <th>Flag</th>
              <th>Meaning</th>
            </tr>
            <tr>
              <td><code>-e</code></td>
              <td>the program is on the command line</td>
            </tr>
            <tr>
              <td><code>-n</code></td>
              <td>wrap it in <code>while ({'<'}{'>'}) {'{'} ... {'}'}</code></td>
            </tr>
            <tr>
              <td><code>-p</code></td>
              <td>same, and print <code>$_</code> at the end of each iteration</td>
            </tr>
            <tr>
              <td><code>-l</code></td>
              <td>strip the newline on input, add one on output</td>
            </tr>
            <tr>
              <td><code>-a</code></td>
              <td>autosplit each line into <code>@F</code></td>
            </tr>
            <tr>
              <td><code>-F</code></td>
              <td>the pattern to autosplit on</td>
            </tr>
            <tr>
              <td><code>-i</code></td>
              <td>edit files in place</td>
            </tr>
          </tbody>
        </table>
        <p>That third one-liner is a complete top-talkers report, and it is the seed of Milestone 2. <strong>Perl's
                design makes the exploratory version and the production version the same language</strong>, which is
            exactly what you want when the exploration turns out to be the tool.</p>
        <h3>Testing, from the first day</h3>
        <pre><code>{"use v5.36;\nuse lib \"lib\";\nuse Test::More tests => 4;\nuse Strata::Record;\n\nmy $r = Strata::Record->new(source => \"apache\", fields => { ip => \"10.0.0.1\" });\nisa_ok $r, \"Strata::Record\";\nis $r->source, \"apache\", \"source is kept\";\nis $r->field(\"ip\"), \"10.0.0.1\", \"fields are readable\";\nlike $r->to_line, qr/ip=10\\.0\\.0\\.1/, \"to_line renders fields\";\n"}</code></pre>
        <pre className="plain"><code>{"$ perl -Ilib t/10-record.t\n1..4\nok 1 - An object of class 'Strata::Record' isa 'Strata::Record'\nok 2 - source is kept\nok 3 - fields are readable\nok 4 - to_line renders fields\n\n$ prove -l t/\nt/10-record.t .. ok\nAll tests successful.\nFiles=1, Tests=4,  0 wallclock secs\nResult: PASS\n"}</code></pre>
        <p>That output format is <strong>TAP</strong>, the Test Anything Protocol, which Perl invented in 1987 and which
            now has implementations in most languages. A test file is an ordinary program that prints <code>ok</code>
            and <code>not ok</code> lines; <code>prove</code> runs many of them and summarises. <code>prove -l</code>
            adds <code>lib/</code> to the path, <code>prove -lv</code> shows every assertion, and
            <code>prove -lj4</code> runs four files in parallel.</p>
        <div className="exercise">
          <h5>Exercise 1</h5>
          <p>Write <code>bin/logstat</code>, a program that reads log lines from files named on the command line (or
                from standard input when none are named) and prints: the total line count, how many lines contain
                <code>ERROR</code>, and the percentage. It must exit 0 when there are no errors and 1 when there are, so
                it can be used in a shell conditional.</p>
          <p>Then prove it works in a pipeline: <code>cat *.log | ./bin/logstat</code> and
                <code>./bin/logstat a.log b.log</code> should both work without changing the code.</p>
          <p>Hints: <code>while ({'<'}{'>'})</code> handles both cases for free; <code>$.</code> is the current line
                number; <code>exit</code> sets the status; <code>printf</code> formats the percentage.</p>
        </div>
        <details>
          <summary>Solution 1 — open after trying</summary>
          <pre><code>{"#!/usr/bin/env perl\nuse v5.36;\n\nmy ($lines, $errors) = (0, 0);\n\nwhile (my $line = <>) {\n    $lines++;\n    $errors++ if $line =~ /\\bERROR\\b/;\n}\n\nif ($lines == 0) {\n    warn \"logstat: no input\\n\";\n    exit 2;\n}\n\nprintf \"%d lines, %d errors (%.2f%%)\\n\", $lines, $errors, 100 * $errors / $lines;\nexit($errors > 0 ? 1 : 0);\n"}</code></pre>
          <pre className="plain"><code>{"$ printf 'ERROR disk full\\nINFO started\\nERROR timeout\\nWARN slow\\n' | ./bin/logstat\n4 lines, 2 errors (50.00%)\n$ echo $?\n1\n"}</code></pre>
          <p>Four things worth extracting.</p>
          <ul>
            <li><strong><code>while (my $line = {'<'}{'>'})</code> is the entire input story.</strong> No arguments
                    means standard input; arguments mean read each of those files in turn. Your program is a Unix filter
                    with no extra work, which is why <code>cat x | prog</code> and <code>prog x</code> both work.</li>
            <li><strong><code>\b</code> word boundaries matter.</strong> Without them, a line containing
                    <code>NOERROR</code> or <code>ERRORS_TOTAL=0</code> counts as an error. Ninety per cent of wrong log
                    analysis is a missing word boundary.</li>
            <li><strong>Three exit codes, deliberately:</strong> 0 nothing found, 1 something found, 2 could not
                    run. That is the <code>grep</code> convention, and following it means your tool composes with shell
                    scripts people already know.</li>
            <li><strong><code>warn</code> writes to standard error</strong>, <code>print</code> and <code>say</code>
                    to standard output. Keeping diagnostics off stdout is what lets someone pipe your output into
                    another program.</li>
          </ul>
          <p>One subtlety: <code>while ({'<'}{'>'})</code> without assigning to a variable puts the line in
                <code>$_</code>, which is idiomatic and slightly risky, because anything you call inside the loop might
                also use <code>$_</code>. Assigning to a named variable, as here, is the safer habit in anything longer
                than a one-liner.</p>
        </details>
        <div className="warn">
          <h5>Common first-day errors</h5>
          <ul>
            <li><code>Can't locate Strata/Record.pm in @INC</code> — <code>lib/</code> is not on the search path.
                    Use <code>perl -Ilib</code>, <code>use lib 'lib';</code>, or <code>prove -l</code>.</li>
            <li><code>Strata/Record.pm did not return a true value</code> — you forgot the <code>1;</code> at the
                    end of the module.</li>
            <li><code>Global symbol "$count" requires explicit package name</code> — <code>use strict</code> is
                    doing its job: you forgot <code>my</code>.</li>
            <li><code>Use of uninitialized value in ...</code> — a warning, not an error, and almost always a real
                    bug: you used a value that was never set, usually a capture group from a match that failed.</li>
            <li><code>Can't call method "new" on an undefined value</code> — you forgot to <code>use</code> the
                    module that defines the class.</li>
            <li><code>syntax error at ... near "{'}'}"</code> — a missing semicolon on the previous line. Perl's error
                    points at where parsing failed, not where you went wrong.</li>
            <li>Using <code>==</code> to compare strings. <code>==</code> is numeric; <code>eq</code> is for
                    strings. <code>"abc" == "def"</code> is <em>true</em>, because both convert to 0.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>What does <code>use v5.36;</code> switch on, and why is it better than
                <code>use strict; use warnings;</code>?</li>
          <li>Why must a module end with <code>1;</code>?</li>
          <li>What is the difference between <code>//</code> and <code>||</code>, and when does it matter?</li>
          <li>What does <code>while ({'<'}{'>'})</code> read from?</li>
          <li>Why should you never run <code>sudo cpanm</code>?</li>
          <li>Which three <code>perldoc</code> pages would you open first for a regex question?</li>
        </ol>
        <hr />
        <h2><span className="num">Course 3 · Part 2</span>Language crash course</h2>
        <p>Only what the project needs, which is most of Perl's text machinery and none of its formats or tie magic.
            Every output below is from a real run. Keep a terminal open and type them.</p>
        <h3>2.1 Sigils and context, the rule with no equivalent elsewhere</h3>
        <pre><code>{"use v5.36;\n\nmy $count   = 42;\nmy @steps   = (\"fetch\", \"filter\", \"save\");\nmy %options = (topic => \"AI\", limit => 10);\n\nsay \"scalar: $count\";\nsay \"array has \", scalar(@steps), \" elements, last index $#steps\";\nsay \"element: $steps[0], slice: @steps[0,1]\";\nsay \"hash value: $options{topic}, keys: \", join(\",\", sort keys %options);\n\nmy $n = @steps;              # array in scalar context: its length\nmy ($first) = @steps;        # list context: its first element\nsay \"scalar context gives $n, list context gives $first\";\n"}</code></pre>
        <pre className="plain"><code>{"scalar: 42\narray has 3 elements, last index 2\nelement: fetch, slice: fetch filter\nhash value: AI, keys: limit,topic\nscalar context gives 3, list context gives fetch\n"}</code></pre>
        <p>Two rules explain that output, and together they are the thing that makes Perl feel alien for a week and
            obvious afterwards.</p>
        <p><strong>The sigil describes what you are asking for, not what the variable is.</strong> <code>@steps</code>
            is the whole array; <code>$steps[0]</code> is <em>one scalar</em> from it, so it takes <code>$</code>;
            <code>@steps[0,1]</code> is <em>several</em>, so it takes <code>@</code>. Likewise <code>%options</code> is
            the hash and <code>$options{'{'}topic{'}'}</code> is one value from it. The rule is consistent, and it is the
            opposite of what people assume ("<code>@</code> means array"), which is why <code>$steps[0]</code> looks
            wrong to newcomers.</p>
        <p><strong>Every expression is evaluated in scalar or list context, and many behave differently in
                each.</strong> <code>my $n = @steps</code> asks for one value from an array, so you get its length;
            <code>my ($first) = @steps</code> has a list on the left, so the array is unpacked and the first element
            assigned. Those two lines differ only in parentheses and mean completely different things.</p>
        <pre><code>{"my @words = split /,/, \"a,b,c\";\nmy $words = split /,/, \"a,b,c\";     # scalar context: count\nsay \"list: @words / scalar: $words\";\nsay \"reverse in list: \", join(\"\", reverse @words);\nsay \"reverse in scalar: \", scalar reverse \"hello\";\n"}</code></pre>
        <pre className="plain"><code>{"list: a b c / scalar: 3\nreverse in list: cba\nreverse in scalar: olleh\n"}</code></pre>
        <p><code>reverse</code> reverses a list in list context and a string in scalar context. This is not a special
            case; it is the design. When a Perl function surprises you, the first question is always "what context is
            this in?", and <code>perldoc -f reverse</code> will tell you what it does in each.</p>
        <div className="cmp">
          <h5>Typical language vs Perl</h5>
          <p>In Python, <code>len(xs)</code> is a function call and there is no way for an expression to know whether
                its caller wants one value or many. Perl passes that information down, which makes code shorter
                (<code>my ($x) = f()</code> versus <code>x = f()[0]</code>) and makes a category of bug possible that
                exists nowhere else (<code>my $x = f()</code> quietly giving you a count instead of a value). The
                mitigation is the same as the diagnosis: when a value is wrong in a confusing way, print
                <code>scalar(@thing)</code> and check which context you are in.</p>
        </div>
        <h3>2.2 Arrays</h3>
        <pre><code>{"my @nums = (5, 3, 9, 1);\npush @nums, 7;\nmy $popped = pop @nums;\nsay \"after push/pop: @nums (popped $popped)\";\nsay \"sorted numerically: \", join(\",\", sort { $a <=> $b } @nums);\nsay \"sorted as strings:  \", join(\",\", sort @nums);\nsay \"grep > 3: \", join(\",\", grep { $_ > 3 } @nums);\nsay \"map doubled: \", join(\",\", map { $_ * 2 } @nums);\nmy @spliced = splice(@nums, 1, 2);\nsay \"spliced out @spliced leaving @nums\";\n"}</code></pre>
        <pre className="plain"><code>{"after push/pop: 5 3 9 1 (popped 7)\nsorted numerically: 1,3,5,9\nsorted as strings:  1,3,5,9\ngrep > 3: 5,9\nmap doubled: 10,6,18,2\nspliced out 3 9 leaving 5 1\n"}</code></pre>
        <ul>
          <li><strong><code>sort</code> compares as strings by default.</strong> The two sorts agree here by luck; try
                <code>(5, 30, 9)</code> and the default gives <code>30, 5, 9</code>. Always write the comparator:
                <code>{'{'} $a {'<'}={'>'} $b {'}'}</code> numeric, <code>{'{'} $a cmp $b {'}'}</code> string. <code>$a</code> and
                <code>$b</code> are package globals the sort block sees, which is why they need no <code>my</code>.</li>
          <li><code>grep</code> and <code>map</code> set <code>$_</code> to each element. <code>grep</code> keeps the
                elements whose block is true; <code>map</code> returns whatever the block returns, and a block returning
                two values makes the result longer than the input, which is occasionally exactly what you want.</li>
          <li><code>splice</code> removes and optionally replaces a range in place. It is the general-purpose array
                surgery tool.</li>
          <li>An array interpolated into a string (<code>"@nums"</code>) joins with spaces. A hash does not
                interpolate at all.</li>
        </ul>
        <h3>2.3 Hashes, and the counting idiom</h3>
        <pre><code>{"my %count;\n$count{$_}++ for qw(fetch filter fetch save fetch);\n\nfor my $k (sort { $count{$b} <=> $count{$a} || $a cmp $b } keys %count) {\n    say \"  $k: $count{$k}\";\n}\n\nsay \"exists: \", (exists $count{fetch} ? \"yes\" : \"no\");\ndelete $count{fetch};\nsay \"after delete: \", join(\",\", sort keys %count);\nmy @wanted = @count{qw(filter save)};      # hash slice\nsay \"slice: @wanted\";\n"}</code></pre>
        <pre className="plain"><code>{"  fetch: 3\n  filter: 1\n  save: 1\nexists: yes\nafter delete: filter,save\nslice: 1 1\n"}</code></pre>
        <p><strong><code>$count{'{'}$_{'}'}++ for @things</code> is the most-used line in Perl</strong>, and it is worth
            unpacking completely. <code>%count</code> starts empty. <code>$count{'{'}$_{'}'}</code> on a missing key is
            <code>undef</code>, and <code>++</code> on <code>undef</code> treats it as 0 and makes it 1, with no warning
            because incrementing undef is explicitly allowed. The <code>for</code> at the end is a statement modifier: a
            postfix loop, readable precisely because it is short.</p>
        <p>The sort block chains two comparisons with <code>||</code>: compare counts descending
            (<code>$count{'{'}$b{'}'} {'<'}={'>'} $count{'{'}$a{'}'}</code>), and when they are equal (<code>{'<'}={'>'}</code> returns 0,
            which is false) fall through to comparing keys alphabetically. That is the standard multi-key sort and it
            appears in every report you will ever write.</p>
        <ul>
          <li><strong><code>exists</code> versus truth versus defined</strong> are three different questions: is the
                key there, is the value true, is the value not <code>undef</code>. A key with value 0 exists, is
                defined, and is false.</li>
          <li><strong>Hash order is not insertion order and not stable between runs</strong>, deliberately, as a
                defence against algorithmic complexity attacks. Always <code>sort keys %h</code> when printing.</li>
          <li><code>@count{'{'}qw(filter save){'}'}</code> is a hash slice: several values at once, so the sigil is
                <code>@</code>.</li>
        </ul>
        <h3>2.4 References and real data structures</h3>
        <p>Arrays and hashes can only hold scalars, so nesting requires references: scalars that point at something.</p>
        <pre><code>{"my @list = (1, 2, 3);\nmy %opts = (a => 1);\nmy $aref = \\@list;              # reference to an existing array\nmy $href = \\%opts;\nmy $anon = [ { name => \"fetch\", options => { from => \"arxiv\" } } ];   # anonymous\n\nsay \"deref whole: @$aref / @{$aref}\";\nsay \"element: $aref->[0] and $$aref[0]\";\nsay \"nested: $anon->[0]{name} -> $anon->[0]{options}{from}\";\nsay \"ref types: \", join(\",\", map { ref } ($aref, $href, $anon, sub {}, \\\"x\"));\npush @$aref, 4;\nsay \"the original array sees it: @list\";\n\nmy %index;\npush @{ $index{ai} }, \"paper1\";      # autovivification\npush @{ $index{ai} }, \"paper2\";\nsay \"autovivified: \", join(\",\", @{ $index{ai} });\n"}</code></pre>
        <pre className="plain"><code>{"deref whole: 1 2 3 / 1 2 3\nelement: 1 and 1\nnested: fetch -> arxiv\nref types: ARRAY,HASH,ARRAY,CODE,SCALAR\nthe original array sees it: 1 2 3 4\nautovivified: paper1,paper2\n"}</code></pre>
        <p>Four rules cover almost everything:</p>
        <ol>
          <li><strong><code>\</code> takes a reference</strong>; <code>[ ... ]</code> and <code>{'{'} ... {'}'}</code> create
                anonymous arrays and hashes directly. Use the anonymous forms in data structures.</li>
          <li><strong><code>-{'>'}</code> both dereferences and indexes.</strong> <code>$aref-{'>'}[0]</code>,
                <code>$href-{'>'}{'{'}key{'}'}</code>. The older <code>$$aref[0]</code> means the same thing and is harder to
                read.</li>
          <li><strong>The arrow is optional between subscripts.</strong> <code>$anon-{'>'}[0]{'{'}name{'}'}{'{'}x{'}'}</code> is the
                same as <code>$anon-{'>'}[0]-{'>'}{'{'}name{'}'}-{'>'}{'{'}x{'}'}</code>. Write the first arrow, omit the rest; everyone
                does.</li>
          <li><strong>To use a reference as a whole aggregate, put the right sigil in front:</strong> <code>@$aref</code>, <code>%$href</code>, <code>@{'{'} $index{'{'}ai{'}'} {'}'}</code>. The braces are for
                disambiguation and are never wrong.</li>
        </ol>
        <p><strong>Autovivification</strong> is the fifth line's real subject:
            <code>push @{'{'} $index{'{'}ai{'}'} {'}'}, "paper1"</code> works even though <code>$index{'{'}ai{'}'}</code> did not exist. Perl
            saw it being used as an array reference and created one. This is enormously convenient for building nested
            indexes (<code>push @{'{'} $by_ip{'{'}$ip{'}'}{'{'}$day{'}'} {'}'}, $record;</code> just works) and it is a trap when you read a
            structure you thought was there: merely <em>checking</em> <code>if ($index{'{'}missing{'}'}{'{'}deep{'}'})</code> creates
            <code>$index{'{'}missing{'}'}</code> as an empty hash. Use <code>exists</code> for tests, and remember it when a
            data structure grows keys nobody added.</p>
        <p><code>Data::Dumper</code> is how you see what you have built:</p>
        <pre><code>{"use Data::Dumper;\n$Data::Dumper::Indent = 1; $Data::Dumper::Sortkeys = 1;\nprint Dumper($anon);\n"}</code></pre>
        <pre className="plain"><code>{"$VAR1 = [\n  {\n    'name' => 'fetch',\n    'options' => {\n      'from' => 'arxiv'\n    }\n  }\n];\n"}</code></pre>
        <p>Setting <code>Sortkeys</code> makes output deterministic, which matters if you ever compare dumps.
            <code>perldoc perldsc</code> is the data-structures cookbook and is worth an hour early on.</p>
        <h3>2.5 Subroutines</h3>
        <pre><code>{"sub summarize ($text, $max_words = 5, %opts) {\n    my @words = split ' ', $text;\n    my $out = join \" \", @words[0 .. ($max_words - 1 < $#words ? $max_words - 1 : $#words)];\n    return $opts{upper} ? uc $out : $out;\n}\n\nsay summarize(\"the quick brown fox jumps over the lazy dog\");\nsay summarize(\"the quick brown fox jumps\", 3, upper => 1);\n\nsub minmax (@values) {\n    my @sorted = sort { $a <=> $b } @values;\n    return wantarray ? ($sorted[0], $sorted[-1]) : $sorted[-1];\n}\n\nmy ($min, $max) = minmax(4, 9, 1);\nmy $just_max    = minmax(4, 9, 1);\nsay \"list context: $min..$max / scalar context: $just_max\";\n"}</code></pre>
        <pre className="plain"><code>{"the quick brown fox jumps\nTHE QUICK BROWN\nlist context: 1..9 / scalar context: 9\n"}</code></pre>
        <ul>
          <li><strong>Signatures are the modern way</strong> and are enabled by <code>use v5.36</code>. Older code
                unpacks the argument array by hand: <code>my ($text, $max) = @_;</code>. You will read a lot of that, so
                know what <code>@_</code> is: all arguments, flattened into one list.</li>
          <li><strong>Flattening is the thing to understand.</strong> Perl has no argument tuples:
                <code>f(@a, @b)</code> passes one combined list and the callee cannot tell where one ended. To pass two
                arrays separately, pass references: <code>f(\@a, \@b)</code>. This is the single most common source of
                "my function got the wrong arguments".</li>
          <li><strong><code>wantarray</code> asks what context the caller used</strong>, so one sub can return a pair
                or a single value. Use it sparingly; it is clever, and clever is expensive to read.</li>
          <li><code>split ' '</code> with a literal single-space string is a special case meaning "split on runs of
                whitespace, ignoring leading whitespace", which is almost always what you want for text.</li>
        </ul>
        <h3>2.6 my, our, and local</h3>
        <pre><code>{"our $depth = 0;\nsub show { say \"  depth is $depth\" }\n\nsub descend {\n    local $depth = $depth + 1;     # dynamic scope: visible to callees\n    show();\n}\n\ndescend();\nshow();\n"}</code></pre>
        <pre className="plain"><code>{"  depth is 1\n  depth is 0\n"}</code></pre>
        <table className="grid">
          <tbody>
            <tr>
              <th>Keyword</th>
              <th>Creates</th>
              <th>Visible to</th>
            </tr>
            <tr>
              <td><code>my</code></td>
              <td>a lexical variable</td>
              <td>the enclosing block and any closure made inside it. Use this by default.</td>
            </tr>
            <tr>
              <td><code>our</code></td>
              <td>an alias to a package global</td>
              <td>everything, by full name too. For package-level constants and configuration.</td>
            </tr>
            <tr>
              <td><code>local</code></td>
              <td>a temporary value for an existing global</td>
              <td>the rest of this block <em>and everything it calls</em>, restored on exit.</td>
            </tr>
          </tbody>
        </table>
        <p><code>local</code> is <strong>dynamic scoping</strong>, which almost no modern language has, and it is not a
            way to make local variables (that is <code>my</code>). Its real use is temporarily changing Perl's special
            variables safely:</p>
        <pre><code>{"{\n    local $/ = undef;           # slurp mode: read the whole file at once\n    my $whole = <$fh>;\n}                               # $/ restored automatically, even on die\n\n{\n    local @ARGV = (\"sample.log\");   # make <> read this file\n    while (<>) { ... }\n}\n"}</code></pre>
        <p>That pattern appears throughout this project, and it is the right tool because it cannot leak: the old value
            comes back when the block exits by any route, including an exception.</p>
        <h3>2.7 Regular expressions, part one: matching and capturing</h3>
        <p>This is why you are here.</p>
        <pre><code>{"my $line = '192.168.1.42 - alice [10/Oct/2026:13:55:36 +0000] \"GET /papers?id=7 HTTP/1.1\" 200 2326';\n\nif ($line =~ /^(\\S+) \\S+ (\\S+) \\[([^\\]]+)\\] \"(\\w+) (\\S+)[^\"]*\" (\\d{3}) (\\d+)$/) {\n    say \"ip=$1 user=$2 when=$3 method=$4 path=$5 status=$6 bytes=$7\";\n}\n"}</code></pre>
        <pre className="plain"><code>{"ip=192.168.1.42 user=alice when=10/Oct/2026:13:55:36 +0000 method=GET path=/papers?id=7 status=200 bytes=2326\n"}</code></pre>
        <p>It works, and you should never ship it. Seven numbered captures means every future edit renumbers everything
            after it, and nobody reading this in a year can tell what <code>$5</code> was. The maintainable version uses
            named captures and <code>/x</code>:</p>
        <pre><code>{"my $apache = qr{\n    ^(?<ip>\\S+) \\s+ \\S+ \\s+ (?<user>\\S+) \\s+      # client, identd, user\n    \\[(?<ts>[^\\]]+)\\] \\s+                          # [timestamp]\n    \"(?<method>[A-Z]+) \\s (?<path>\\S+) [^\"]*\" \\s+  # \"GET /path HTTP/1.1\"\n    (?<status>\\d{3}) \\s+ (?<bytes>\\d+)             # status and size\n}x;\n\nif ($line =~ $apache) {\n    say \"named: $+{ip} asked for $+{path} and got $+{status}\";\n    say \"capture names: \", join(\",\", sort keys %+);\n}\n"}</code></pre>
        <pre className="plain"><code>{"named: 192.168.1.42 asked for /papers?id=7 and got 200\ncapture names: bytes,ip,method,path,status,ts,user\n"}</code></pre>
        <p>Four features doing the work:</p>
        <ul>
          <li><strong><code>/x</code></strong> makes whitespace and <code># comments</code> inside the pattern
                insignificant, so a regex can be laid out and annotated like code. With <code>/x</code> you must write
                real spaces as <code>\s</code> or <code>[ ]</code>, which is the small price. <strong>Any regex longer
                    than about forty characters should use <code>/x</code>.</strong></li>
          <li><strong><code>(?{'<'}name{'>'}...)</code></strong> names a capture, available afterwards in
                <code>%+</code>. Renumbering stops being a problem, and the parsing code reads like the data.</li>
          <li><strong><code>qr{'{'}...{'}'}</code></strong> compiles a pattern once into a value you can store, pass around,
                interpolate into a bigger pattern, and reuse in a loop. In a parser that runs a million times, compiling
                once matters; in readability terms it matters more, because it lets you build a library of named
                patterns.</li>
          <li><strong><code>{'{'}...{'}'}</code> as the delimiter</strong> instead of <code>/.../</code> avoids escaping every
                slash in a path pattern. Perl lets you use almost any delimiter for <code>m</code>, <code>s</code>,
                <code>qr</code> and <code>tr</code>, and choosing one that does not appear in the pattern is basic
                hygiene.</li>
        </ul>
        <h3>2.8 Regular expressions, part two: global matching and substitution</h3>
        <pre><code>{"my $text = \"contact alice\\@example.com or bob\\@test.org today\";\n\nmy @emails = $text =~ /([\\w.]+@[\\w.]+)/g;      # list context + /g: every match\nsay \"all emails: @emails\";\n\nwhile ($text =~ /(\\w+)@([\\w.]+)/g) {           # scalar context + /g: iterate\n    say \"  user=$1 host=$2 at offset $-[0]\";\n}\n\n(my $masked = $text) =~ s/([\\w.]+)@([\\w.]+)/[redacted]\\@$2/g;\nsay \"masked: $masked\";\n\nmy $prices = \"cost: 10, 20, 30\";\n(my $doubled = $prices) =~ s/(\\d+)/$1 * 2/ge;   # /e evaluates the replacement\nsay \"doubled: $doubled\";\n"}</code></pre>
        <pre className="plain"><code>{"all emails: alice@example.com bob@test.org\n  user=alice host=example.com at offset 8\n  user=bob host=test.org at offset 29\nmasked: contact [redacted]@example.com or [redacted]@test.org today\ndoubled: cost: 20, 40, 60\n"}</code></pre>
        <ul>
          <li><strong><code>/g</code> in list context returns every capture from every match.</strong> One line to
                harvest every email in a document. If the pattern has no captures, you get the whole matches instead.
            </li>
          <li><strong><code>/g</code> in scalar context is an iterator</strong>, resuming from where it stopped (the
                position is stored with the string, readable as <code>pos $text</code>). That is the <code>while</code>
                loop above, and it is how you walk a large string without copying it.</li>
          <li><strong><code>(my $copy = $original) =~ s/.../.../</code></strong> is the copy-then-modify idiom.
                Substitution modifies in place, so without the copy you destroy your input. Perl 5.14 added the
                <code>/r</code> flag for the same thing more clearly: <code>my $copy = $original =~ s/a/b/gr;</code>.
            </li>
          <li><strong><code>/e</code> treats the replacement as Perl code to evaluate.</strong> <code>s/(\d+)/$1 * 2/ge</code> doubles every number in a string. This is a small superpower for data
                cleanup: normalising units, decoding escapes, reformatting dates, all inline.</li>
          <li><code>$-[0]</code> and <code>@+</code> hold the start and end offsets of the match, which you need when
                reporting exactly where in a file something went wrong.</li>
        </ul>
        <h3>2.9 Greedy, lazy, and the mistakes everyone makes</h3>
        <pre><code>{"my $html = '<b>bold</b> and <i>italic</i>';\nmy ($greedy) = $html =~ /<(.+)>/;\nmy ($lazy)   = $html =~ /<(.+?)>/;\nsay \"greedy: $greedy\";\nsay \"lazy:   $lazy\";\nsay \"count of tags: \", scalar(() = $html =~ /<[^>]+>/g);\n"}</code></pre>
        <pre className="plain"><code>{"greedy: b>bold</b> and <i>italic</i\nlazy:   b\ncount of tags: 4\n"}</code></pre>
        <p><code>.+</code> is greedy: it takes as much as it can and gives back only as needed, so it ran to the last
            <code>{'>'}</code> in the string. <code>.+?</code> is lazy and stops at the first. The third and best option
            is usually neither: <strong><code>[^{'>'}]+</code> says what you mean</strong> (characters that are not the
            terminator), is faster because it cannot backtrack, and does not depend on remembering which flavour of
            <code>.</code> you wanted.</p>
        <p><code>scalar(() = $html =~ /.../g)</code> is the countof idiom: assign the match list to an empty list in
            scalar context, which yields the number of elements. Ugly, universal, worth recognising.</p>
        <div className="warn">
          <h5>Regex mistakes that cost the most time</h5>
          <ul>
            <li><strong>Forgetting <code>\b</code>.</strong> <code>/ERROR/</code> matches <code>NOERROR</code> and
                    <code>ERRORS=0</code>.</li>
            <li><strong>Unanchored patterns on structured data.</strong> <code>/(\d{'{'}3{'}'})/</code> against a log line
                    finds the first three digits anywhere, which may be part of the date. Anchor with <code>^</code>,
                    <code>$</code>, or surrounding context.</li>
            <li><strong>Using <code>.</code> where a negated class belongs.</strong> <code>"([^"]*)"</code> beats
                    <code>"(.*?)"</code> for a quoted field: clearer and it cannot backtrack catastrophically.</li>
            <li><strong>Catastrophic backtracking.</strong> Nested quantifiers like <code>(\s*\w+)*$</code> on a
                    long non-matching line can take exponential time and hang your program. If a parser mysteriously
                    stalls on one file, suspect this first.</li>
            <li><strong>Parsing nested structures with regexes.</strong> HTML and XML are not regular. Use
                    <code>XML::LibXML</code>; we will in Milestone 6.</li>
            <li><strong>Not checking whether the match succeeded</strong> before using <code>$1</code>. On failure
                    the capture variables keep their <em>previous</em> values, so a failed match silently reuses the
                    last line's data. Always <code>if ($line =~ ...) {'{'} ... {'}'}</code>.</li>
          </ul>
        </div>
        <h3>2.10 Files and streams</h3>
        <pre><code>{"open my $fh, \"<\", \"sample.log\" or die \"cannot open sample.log: $!\";\nmy $errors = 0;\nwhile (my $line = <$fh>) {\n    chomp $line;\n    $errors++ if $line =~ /^ERROR\\b/;\n}\nclose $fh;\nsay \"errors: $errors\";\n\nopen my $out, \">\", \"summary.txt\" or die \"cannot write: $!\";\nsay {$out} \"errors=$errors\";\nclose $out;\n"}</code></pre>
        <pre className="plain"><code>{"errors: 2\nwrote: errors=2\n"}</code></pre>
        <ul>
          <li><strong>Three-argument <code>open</code> with a lexical filehandle</strong> is the only correct form.
                The mode is separate from the filename, so a file called <code>{'>'}evil</code> cannot become a
                redirection. Two-argument <code>open</code> with the mode inside the string is a genuine security hole,
                and you will see it in old code.</li>
          <li><strong><code>or die "...: $!"</code></strong> — <code>$!</code> is the system error message ("No such
                file or directory"). An error message without <code>$!</code> tells you something failed but not why.
            </li>
          <li><strong><code>while (my $line = {'<'}$fh{'>'})</code> reads one line at a time</strong>, so memory is
                constant whether the file is 2 KB or 200 GB. This is the whole reason the project can claim to
                stream, and it is the default rather than something you opt into.</li>
          <li><strong><code>chomp</code> removes the trailing newline</strong> (strictly, the current value of
                <code>$/</code>). Forgetting it means your "ip" ends with a newline and every comparison fails
                mysteriously.</li>
          <li><code>say {'{'}$out{'}'} "..."</code> — the braces disambiguate a filehandle expression. With a simple handle,
                <code>say $out "..."</code> also works, with no comma, which looks wrong forever.</li>
        </ul>
        <p>Encoding deserves a line now and a milestone later. A file is bytes; treating it as text requires knowing the
            encoding:</p>
        <pre><code>{"open my $fh, \"<:encoding(UTF-8)\", $path or die \"$path: $!\";\n# and for data that claims to be UTF-8 and is not, in milestone 7:\nopen my $fh, \"<:raw\", $path or die \"$path: $!\";   # bytes, decode manually\n"}</code></pre>
        <h3>2.11 Errors</h3>
        <pre><code>{"my $result = eval {\n    die \"something broke\\n\";\n    1;\n};\nsay \"eval returned \", (defined $result ? $result : \"undef\"), \" and \\$\\@ is: $@\";\n"}</code></pre>
        <pre className="plain"><code>{"eval returned undef and $@ is: something broke\n"}</code></pre>
        <p>Perl's exception mechanism is <code>die</code> to throw and <code>eval {'{'} {'}'}</code> to catch. The block returns
            <code>undef</code> on failure and the error lands in <code>$@</code>. Two conventions: <strong>end your
                message with <code>\n</code></strong> or Perl appends " at script.pl line 12", which is useful for bugs
            and noise for expected failures; and <strong>put <code>1;</code> as the last statement</strong> of the eval
            block so success is unambiguous.</p>
        <p><code>$@</code> is a global, and it is easy to clobber between the <code>eval</code> and the check (a
            destructor running, a cleanup call). The community solution is <code>Try::Tiny</code>:</p>
        <pre><code>{"use Try::Tiny;\n\ntry {\n    die { code => 503, message => \"service unavailable\" };\n} catch {\n    my $err = $_;\n    say \"Try::Tiny caught a \", ref($err), \" with code $err->{code}\";\n};\n"}</code></pre>
        <pre className="plain"><code>{"Try::Tiny caught a HASH with code 503\n"}</code></pre>
        <p>Note that <code>die</code> can throw <em>any</em> reference, not just a string, which is how Perl does
            structured exceptions: a hash reference with a code and a message, or an object from a class like
            <code>Throwable</code>. For this project, structured errors matter because "line 40,112 of users.csv had
            unbalanced quotes" needs to be data, not prose.</p>
        <h3>2.12 Packages and modules</h3>
        <pre><code>{"package Strata::Record;\nuse v5.36;\n\nsub new ($class, %args) {\n    my $self = {\n        source => $args{source} // \"unknown\",\n        fields => $args{fields} // {},\n    };\n    return bless $self, $class;\n}\n\nsub source ($self) { return $self->{source} }\nsub field  ($self, $name) { return $self->{fields}{$name} }\n\nsub to_line ($self) {\n    my $f = $self->{fields};\n    return join \" \", map { \"$_=$f->{$_}\" } sort keys %$f;\n}\n\n1;   # a module must return a true value\n"}</code></pre>
        <pre className="plain"><code>{"apache: ip=10.0.0.1 status=200\nref: Strata::Record isa: yes\n"}</code></pre>
        <p><strong>Perl's object system is three rules.</strong> A class is a package. An object is a reference that has
            been <code>bless</code>ed into that package. A method call <code>$obj-{'>'}method(@args)</code> calls the
            package's sub with the object as the first argument. That is all <code>bless</code> does: it writes the
            package name onto the reference so method lookup knows where to go.</p>
        <p>It is minimal to the point of being spartan: no attribute declarations, no encapsulation (anyone can reach
            into <code>$self-{'>'}{'{'}fields{'}'}</code>), no type checking. In production Perl most people use
            <strong>Moo</strong> or <strong>Moose</strong>, which add attributes, types, roles and defaults on top. And
            since 5.38 there is a real class syntax, still marked experimental:</p>
        <pre><code>{"use v5.38;\nuse experimental 'class';\n\nclass Strata::Entity {\n    field $type :param;\n    field $value :param;\n    field $count = 1;\n\n    method type  { $type }\n    method seen  { $count++; $self }\n    method to_string { \"$type($value) x$count\" }\n}\n\nmy $e = Strata::Entity->new(type => \"ip\", value => \"10.0.0.1\");\n$e->seen->seen;\nsay $e->to_string;\n"}</code></pre>
        <pre className="plain"><code>{"ip(10.0.0.1) x3\n"}</code></pre>
        <p>Genuinely pleasant, genuinely encapsulated (those fields are not reachable from outside), and genuinely
            experimental: the syntax may still change and it will warn unless you ask for it. This project uses plain
            <code>bless</code>, because it is what you will meet in existing code and because understanding it explains
            how Moo, Moose and the new <code>class</code> all work underneath.</p>
        <div className="exercise">
          <h5>Exercise 2.A</h5>
          <p>Write a sub <code>parse_apache_line($line)</code> that returns a hash reference of named fields for a
                combined-format Apache line, or <code>undef</code> if the line does not match. Requirements: use
                <code>qr//</code> with <code>/x</code> and named captures; handle the <code>-</code> that appears for a
                missing user or a zero byte count by normalising it to <code>undef</code> and <code>0</code>
                respectively; and split the request field into method, path and protocol.</p>
          <p>Then write a second sub <code>summarise(@lines)</code> returning a hash reference with total lines,
                parsed lines, failed lines, and a count by status code. Test it with three good lines and two
                deliberately broken ones.</p>
        </div>
        <details>
          <summary>Solution 2.A — open after trying</summary>
          <pre><code>{"use v5.36;\n\nmy $APACHE = qr{\n    ^ (?<ip>\\S+) \\s+ (?<identd>\\S+) \\s+ (?<user>\\S+) \\s+\n    \\[ (?<ts>[^\\]]+) \\] \\s+\n    \" (?<request>[^\"]*) \" \\s+\n    (?<status>\\d{3}) \\s+ (?<bytes>\\d+|-)\n    (?: \\s+ \" (?<referer>[^\"]*) \" \\s+ \" (?<agent>[^\"]*) \" )?   # combined format\n    \\s* $\n}x;\n\nsub parse_apache_line ($line) {\n    return undef unless $line =~ $APACHE;\n\n    my %f = %+;                       # copy: %+ is reset by the next match\n\n    # \"-\" is Apache's way of saying \"nothing here\".\n    $f{user}  = undef if $f{user} eq \"-\";\n    $f{bytes} = 0     if $f{bytes} eq \"-\";\n\n    if ($f{request} =~ m{^(?<method>[A-Z]+) \\s+ (?<path>\\S+) (?: \\s+ (?<proto>\\S+))?$}x) {\n        @f{qw(method path proto)} = @+{qw(method path proto)};\n    } else {\n        $f{problem} = \"unparsable request line\";\n    }\n\n    return \\%f;\n}\n\nsub summarise (@lines) {\n    my %out = (total => 0, parsed => 0, failed => 0, by_status => {});\n\n    for my $line (@lines) {\n        $out{total}++;\n        my $rec = parse_apache_line($line);\n        if ($rec) {\n            $out{parsed}++;\n            $out{by_status}{ $rec->{status} }++;\n        } else {\n            $out{failed}++;\n        }\n    }\n    return \\%out;\n}\n"}</code></pre>
          <p>Five things worth taking from this.</p>
          <ul>
            <li><strong><code>my %f = %+;</code> copies the capture hash immediately.</strong> <code>%+</code> is
                    global and is reset by the <em>next</em> successful match anywhere, including the one two lines
                    later that splits the request. Copying first is not optional; forgetting it produces a bug that
                    appears only when you add a second regex.</li>
            <li><strong>The optional group makes one pattern handle two formats.</strong> Common and combined log
                    formats differ only by the trailing referer and user-agent, so <code>(?: ... )?</code> parses both,
                    and the fields are simply absent for the shorter one.</li>
            <li><strong>Normalising <code>-</code> at the boundary</strong> means the rest of the program never
                    thinks about Apache's conventions. Every parser in this project will do this: the Record that comes
                    out should not betray which format it came from.</li>
            <li><strong>A failed sub-parse becomes a <code>problem</code> field, not a discarded line.</strong> This
                    is the project's central policy in miniature: keep the record, mark what is wrong with it, and let
                    the caller decide. A line you throw away is a line you cannot investigate.</li>
            <li><strong><code>@f{'{'}qw(method path proto){'}'} = @+{'{'}qw(method path proto){'}'}</code></strong> is a hash slice
                    on both sides: three assignments in one statement. This is where Perl's sigil rules start paying you
                    back.</li>
          </ul>
        </details>
        <h3>2.13 Sorting, formatting, and the report idioms</h3>
        <pre><code>{"my %bytes_by_ip = (\"10.0.0.1\" => 4_112_883, \"10.0.0.2\" => 55_201, \"10.0.0.9\" => 913_004);\n\nfor my $ip (sort { $bytes_by_ip{$b} <=> $bytes_by_ip{$a} } keys %bytes_by_ip) {\n    printf \"  %-15s %10s\\n\", $ip, commify($bytes_by_ip{$ip});\n}\n\nsub commify ($n) {\n    1 while $n =~ s/^(\\d+)(\\d{3})/$1,$2/;\n    return $n;\n}\n"}</code></pre>
        <pre className="plain"><code>{"  10.0.0.1          4,112,883\n  10.0.0.9            913,004\n  10.0.0.2             55,201\n"}</code></pre>
        <p><code>printf</code> with <code>%-15s</code> (left-aligned, 15 wide) and <code>%10s</code> (right-aligned) is
            how every Perl report is formatted. <code>commify</code> is a classic: <code>1 while s/.../.../</code>
            repeats a substitution until it stops matching, which is a loop written as an expression. Numeric literals
            can contain underscores for readability.</p>
        <p>When sorting by an expensive computed key, use the <strong>Schwartzian transform</strong>, which computes
            each key once:</p>
        <pre><code>{"my @sorted = map  { $_->[1] }\n             sort { $a->[0] <=> $b->[0] }\n             map  { [ expensive_key($_), $_ ] } @records;\n"}</code></pre>
        <p>Read it bottom-up: decorate each record with its key, sort by the key, undecorate. It is the standard idiom
            precisely because a naive <code>sort {'{'} expensive($a) {'<'}={'>'} expensive($b) {'}'}</code> calls the expensive
            function O(n log n) times instead of n.</p>
        <div className="exercise">
          <h5>Exercise 2.B — the capstone of Part 2</h5>
          <p>Write a single program, <code>bin/toptalkers</code>, that reads Apache logs from files or standard input
                and prints a report. Requirements:</p>
          <ul>
            <li>Top 5 client IPs by request count, with their byte totals and error rates.</li>
            <li>A count by status class (2xx, 3xx, 4xx, 5xx).</li>
            <li>The five slowest-growing minutes by request volume (bucket timestamps to the minute).</li>
            <li>A trailing line reporting how many lines could not be parsed, with the first three offending line
                    numbers.</li>
            <li>It must never load the whole file into memory, must work in a pipeline, and must exit 0 unless more
                    than 1% of lines failed to parse, in which case exit 1.</li>
          </ul>
          <p>Test it on a file with a few thousand lines, including some you have deliberately truncated mid-line.</p>
        </div>
        <details>
          <summary>Solution 2.B — open after trying</summary>
          <pre><code>{"#!/usr/bin/env perl\nuse v5.36;\n\nmy $APACHE = qr{\n    ^ (?<ip>\\S+) \\s+ \\S+ \\s+ (?<user>\\S+) \\s+\n    \\[ (?<ts>[^\\]]+) \\] \\s+ \" (?<request>[^\"]*) \" \\s+\n    (?<status>\\d{3}) \\s+ (?<bytes>\\d+|-)\n}x;\n\nmy (%hits, %bytes, %errors, %by_minute, %status_class);\nmy ($total, $failed, @first_failures) = (0, 0);\n\nwhile (my $line = <>) {\n    $total++;\n\n    unless ($line =~ $APACHE) {\n        $failed++;\n        push @first_failures, \"$ARGV:$.\" if @first_failures < 3;\n        next;\n    }\n\n    my %f = %+;\n    my $bytes = $f{bytes} eq \"-\" ? 0 : $f{bytes};\n\n    $hits{ $f{ip} }++;\n    $bytes{ $f{ip} } += $bytes;\n    $errors{ $f{ip} }++ if $f{status} >= 400;\n    $status_class{ substr($f{status}, 0, 1) . \"xx\" }++;\n\n    # 10/Oct/2026:13:55:36 +0000  ->  10/Oct/2026:13:55\n    $by_minute{$1}++ if $f{ts} =~ /^(\\d+\\/\\w+\\/\\d+:\\d+:\\d+)/;\n}\n\nsay \"top talkers\";\nmy @top = (sort { $hits{$b} <=> $hits{$a} || $a cmp $b } keys %hits)[0 .. 4];\nfor my $ip (grep { defined } @top) {\n    printf \"  %-15s %8d hits  %12s bytes  %5.1f%% errors\\n\",\n        $ip, $hits{$ip}, commify($bytes{$ip}),\n        100 * ($errors{$ip} // 0) / $hits{$ip};\n}\n\nsay \"\\nstatus classes\";\nprintf \"  %s %8d\\n\", $_, $status_class{$_} for sort keys %status_class;\n\nsay \"\\nbusiest minutes\";\nmy @busy = (sort { $by_minute{$b} <=> $by_minute{$a} } keys %by_minute)[0 .. 4];\nprintf \"  %-22s %8d\\n\", $_, $by_minute{$_} for grep { defined } @busy;\n\nmy $rate = $total ? 100 * $failed / $total : 0;\nprintf \"\\n%d lines, %d unparsed (%.2f%%)%s\\n\", $total, $failed, $rate,\n    @first_failures ? \" first at: \" . join(\", \", @first_failures) : \"\";\n\nexit($rate > 1 ? 1 : 0);\n\nsub commify ($n) { 1 while $n =~ s/^(\\d+)(\\d{3})/$1,$2/; return $n }\n"}</code></pre>
          <p>Six details that are the actual lesson.</p>
          <ul>
            <li><strong>Five hashes, one pass.</strong> Everything is accumulated in a single traversal, so memory
                    is proportional to the number of <em>distinct</em> IPs and minutes, not to the file. That is the
                    shape of every streaming aggregation you will write.</li>
            <li><strong><code>$ARGV</code> and <code>$.</code> give you free provenance.</strong> Inside
                    <code>{'<'}{'>'}</code>, <code>$ARGV</code> is the file currently being read and <code>$.</code> is
                    the line number, so "where did this come from" costs nothing. (One caveat worth knowing:
                    <code>$.</code> does not reset between files unless you <code>close ARGV</code> at
                    <code>eof</code>.)</li>
            <li><strong>Unparsed lines are counted and located, never silently dropped.</strong> Keeping the first
                    three line numbers rather than all of them bounds the memory a pathological file can cost you.</li>
            <li><strong><code>(sort ...)[0 .. 4]</code> takes a slice of a list</strong> without an intermediate
                    array, and <code>grep {'{'} defined {'}'}</code> handles the case where fewer than five exist. Slicing past
                    the end gives <code>undef</code>, not an error, which is convenient and requires the guard.</li>
            <li><strong><code>($errors{'{'}$ip{'}'} // 0)</code></strong> because an IP with no errors has no key, and
                    arithmetic on <code>undef</code> warns. Defined-or is the right operator: a genuine zero must
                    survive.</li>
            <li><strong>The exit code encodes a judgement</strong> (more than 1% unparsed means something is wrong),
                    which makes the tool usable in a cron job that alerts when a log format changes underneath you. That
                    is a real failure mode and this is how you catch it.</li>
          </ul>
          <p>If you built something close to this, Milestones 1 through 3 will feel like tidying rather than learning,
                which is the intention.</p>
        </details>
        <div className="warn">
          <h5>Common mistakes in Part 2</h5>
          <ul>
            <li><strong>Using <code>==</code> on strings</strong> or <code>eq</code> on numbers.
                    <code>"10" == "10.0"</code> is true; <code>"10" eq "10.0"</code> is false. Both are sometimes what
                    you want.</li>
            <li><strong>Forgetting <code>chomp</code></strong>, then wondering why <code>$fields[-1]</code> never
                    matches anything.</li>
            <li><strong>Using <code>$1</code> without checking the match succeeded.</strong> It holds the previous
                    match's value.</li>
            <li><strong>Not copying <code>%+</code> before the next match.</strong> Same class of bug, more
                    surprising.</li>
            <li><strong>Sorting without a comparator</strong> and getting string order on numbers.</li>
            <li><strong>Passing two arrays to a sub</strong> and receiving one flattened list. Pass references.</li>
            <li><strong>Accidental autovivification</strong> when testing nested keys. Use <code>exists</code>.</li>
            <li><strong>Two-argument <code>open</code></strong>, ever.</li>
            <li><strong>Slurping a file</strong> (<code>my @lines = {'<'}$fh{'>'}</code>) out of habit. It works until
                    the file is 40 GB.</li>
          </ul>
        </div>
        <h4>Part 2 checkpoint</h4>
        <ol>
          <li>Why is it <code>$steps[0]</code> and not <code>@steps[0]</code>?</li>
          <li>Give two expressions that behave differently in scalar and list context, and say what each does.</li>
          <li>What does <code>$count{'{'}$_{'}'}++ for @items</code> do, step by step?</li>
          <li>Why does nesting data require references, and what is autovivification?</li>
          <li>When would you use <code>local</code> rather than <code>my</code>?</li>
          <li>What do <code>/x</code>, <code>qr//</code> and <code>(?{'<'}name{'>'}...)</code> each buy you?</li>
          <li>What is the difference between <code>/g</code> in list context and in scalar context?</li>
          <li>Why must you copy <code>%+</code> immediately?</li>
          <li>Why is three-argument <code>open</code> the only acceptable form?</li>
          <li>What does <code>bless</code> actually do?</li>
        </ol>
        <div className="why">
          <h5>Why are we using this language here? (Part 2 summary)</h5>
          <p>Look back at the capstone solution. The regex is a first-class value with named fields laid out over five
                commented lines; the input loop handles files and pipes with no imports; five aggregations happen in one
                pass with hashes that spring into existence as needed; provenance comes free in <code>$ARGV</code> and
                <code>$.</code>; and the whole thing is sixty lines and streams a file of any size. The equivalent
                Python is perhaps twice as long and has <code>re.compile</code>, <code>fileinput</code>,
                <code>defaultdict</code> and <code>argparse</code> visible in it. That difference is Perl's argument,
                and for this kind of work it is a strong one.</p>
          <p>The costs are equally visible. Context means <code>my $x = f()</code> and <code>my ($x) = f()</code> are
                different programs. Capture variables are global and get clobbered. <code>local</code> is a scoping rule
                most programmers have never met. Sigils change with what you are asking for rather than what the
                variable is. None of these is hard once learned, and all of them are sharp edges that a language
                designed in 2010 would not have.</p>
          <p>The discipline that makes Perl maintainable is not subtle, and it is all in this part:
                <code>use v5.36</code>, named captures, <code>/x</code> on anything long, real data structures instead
                of clever parallel arrays, and tests from day one.</p>
        </div>
        <h3>What is next</h3>
        <p>Milestone 1 turns the one-liner instinct into a program: a filter with proper option handling, exit codes and
            tests. Milestone 2 adds the aggregation you just wrote by hand. Milestone 3 is where the parser becomes
            serious, with a pattern library, failure accounting, and the first fixtures of deliberately broken input.
        </p>
        <p>Before then: run the one-liners from Part 1 against a log file on your own machine, and read
            <code>perldoc perlretut</code>. It is the best forty minutes available to you at this point.</p>
        <footer className="end">
          <p>Instalment 11 of the five-course curriculum. Next: Perl Milestones 1–4, where the filter becomes a tool,
                hashes become reports, regexes become a parser, and records become a data model.</p>
        </footer>
        <a className="button" href="/perl-course/milestones/1-4/">Continue</a>
      </div>
    </div>
  );
}
