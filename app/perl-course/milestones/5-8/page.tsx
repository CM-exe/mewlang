import type { Metadata } from 'next';
import Link from 'next/link';
import img1 from '../../../../courses/assets/expressions/left_to_right/yawn.png';
import img2 from '../../../../courses/assets/expressions/right_to_left/looking_bad_top.png';
import img3 from '../../../../courses/assets/expressions/surprised.png';
import img4 from '../../../../courses/assets/expressions/left_to_right/paw.png';
import img5 from '../../../../courses/assets/expressions/right_to_left/thinking.png';
import img6 from '../../../../courses/assets/expressions/left_to_right/stretching.png';

export const metadata: Metadata = {
  title: "Perl Milestones 5–8 — Distribution, Formats, Hard Files, Entities",
};

export default function Page() {
  return (
    <div className="theme-perl">
      <div className="wrap">
        <header className="masthead">
          <p className="kicker">Instalment 13 · Course 3 (Perl) · Milestones 5–8</p>
          <h1>Five formats, six broken files, and the moment your data becomes comparable</h1>
          <p className="lede">A real distribution, parsers that sniff their own format, a reader that survives gzip and mangled bytes and three-megabyte lines, and the unglamorous normalisation without which nothing can be correlated at all.</p>
        </header>
        <div className="note">
          <h5>Verification note</h5>
          <p>Perl 5.38.2, with <code>Text::CSV</code>, <code>XML::LibXML</code> and the core modules installed. The suite is now 7 files and 46 tests, all passing. Four bugs are documented below, three of which I found by running the finished tool over the fixtures and staring at the output, which is the point of building fixtures designed to be nasty.</p>
        </div>
        <h2 className="milestone-head"><span className="num">Milestone 5</span>Making it a distribution</h2>
        <h3>Goal</h3>
        <p>
          <img className="mascot-left" src={img1.src} alt="The Mewlang cat, yawning" width="120" loading="lazy" />
          Turn a folder of scripts into something installable: a version, documentation, declared dependencies, a build file, and the two tests every Perl distribution should have before it has any others.
        </p>
        <h3>Concepts</h3>
        <p>POD, <code>Exporter</code> and selective exports, <code>cpanfile</code> versus <code>Makefile.PL</code>, <code>$VERSION</code>, compile tests, and <code>BAIL_OUT</code>.</p>
        <h3>Design</h3>
        <p>A distribution is not "the code plus some paperwork". Each new file answers one question a stranger — or you, in six months — actually asks before trusting the code enough to run it:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Question a stranger asks</th>
              <th>Answered by</th>
            </tr>
            <tr>
              <td>"What is this, and how do I call it?"</td>
              <td>POD in <code>lib/Strata.pm</code>, read by <code>perldoc</code></td>
            </tr>
            <tr>
              <td>"What do I get if I <code>use</code> this module?"</td>
              <td><code>@EXPORT_OK</code> in <code>Strata::Util</code> — nothing by accident</td>
            </tr>
            <tr>
              <td>"What has to be installed, and why?"</td>
              <td><code>cpanfile</code>, one comment per dependency</td>
            </tr>
            <tr>
              <td>"Does it even load?"</td>
              <td>a compile test, run first, that <code>BAIL_OUT</code>s if the answer is no</td>
            </tr>
          </tbody>
        </table>
        <p>That ordering is also the order to write the pieces in. A module nobody can <code>require</code> makes every other question moot, which is why the compile test — not the documentation, not the exports — is the first thing this milestone's <code>t/</code> directory should contain, even though it is described last below because it is easiest to understand once you have seen what it is protecting.</p>
        <h3>Implementation</h3>
        <h4>Documentation lives in the code</h4>
        <pre><code>{"package Strata;\nuse v5.36;\n\nour $VERSION = '0.01';\n\n=head1 NAME\n\nStrata - forensic text archaeology for heterogeneous log data\n\n=head1 SYNOPSIS\n\n    use Strata::Pipeline;\n    use Strata::Parser::Registry;\n\n    my $parser = Strata::Parser::Registry->for_file(\"access.log\");\n    my $pipe   = Strata::Pipeline->new(parser => $parser);\n    $pipe->run_file(\"access.log\");\n\n=head1 DESCRIPTION\n\nIts central policy is that B<a line you cannot parse is still evidence>:\nparsers never throw and never return undef, they return a record carrying\nthe raw text, its provenance, and a description of what went wrong.\n\n=cut\n\n1;\n"}</code></pre>
        <p><strong>POD (Plain Old Documentation) is part of the language</strong>, not a comment convention. The parser skips from <code>=head1</code> to <code>=cut</code>, and <code>perldoc lib/Strata.pm</code> renders it immediately, as does every module viewer and MetaCPAN. Two habits worth adopting: a <code>SYNOPSIS</code> that is copy-pasteable working code, and a <code>DESCRIPTION</code> that states the one design decision a reader must understand before using the module.</p>
        <h4>Exports, chosen deliberately</h4>
        <pre><code>{"package Strata::Util;\nuse Exporter 'import';\n\nour @EXPORT_OK = qw(commify top human_bytes truncate_str);\nour %EXPORT_TAGS = (all => \\@EXPORT_OK);\n"}</code></pre>
        <p><code>@EXPORT_OK</code> means "you may ask for these"; the older <code>@EXPORT</code> means "you get these whether you asked or not", which pollutes your caller's namespace and occasionally clobbers their own subs. <strong>Use <code>@EXPORT_OK</code> always</strong>, so that <code>use Strata::Util qw(commify)</code> states at the call site where <code>commify</code> came from. The <code>:all</code> tag exists for the one script that genuinely wants everything.</p>
        <h4>Dependencies, declared twice for two audiences</h4>
        <pre className="plain"><code>{"# cpanfile: for developers and deployment\nrequires 'perl', '5.036';\nrequires 'Text::CSV',   '2.00';   # RFC 4180 CSV, embedded quotes and newlines\nrequires 'XML::LibXML', '2.00';   # a real XML parser; regexes cannot do XML\nrequires 'DBD::SQLite', '1.60';\n\non 'test' => sub {\n    requires 'Test::More', '1.302';\n};\n\non 'develop' => sub {\n    requires 'Devel::NYTProf';      # milestone 11\n};"}</code></pre>
        <p><code>cpanm --installdeps .</code> reads that. The <code>Makefile.PL</code> repeats the runtime dependencies because that is what <code>cpan</code> and packaging tools read; the duplication is real and mildly annoying, and the modern answer (<code>Dist::Zilla</code> or <code>Minilla</code>) generates one from the other. For a project this size, writing both by hand is less machinery than adopting a distribution builder. </p>
        <p>Note the comments. <strong>A dependency line should say why</strong>, because the reader's real question is "can I remove this?". "Regexes cannot do XML" answers it in four words.</p>
        <h4>The two tests to write first</h4>
        <pre><code>{"my @modules = qw(\n    Strata Strata::Util Strata::Pattern Strata::Record\n    Strata::Pipeline Strata::Parser::Apache\n);\n\nuse_ok($_) or BAIL_OUT(\"$_ does not compile; nothing else can pass\") for @modules;\n"}</code></pre>
        <p>A compile test costs nothing and catches the most common Perl failure of all: a missing semicolon or a forgotten <code>1;</code> in a module you have not run today. <strong><code>BAIL_OUT</code> stops the entire test run</strong>, which is right here: if a module does not compile, three hundred subsequent failures tell you nothing new.</p>
        <p>The second is the unit test for the helpers, and it is worth showing one assertion:</p>
        <pre><code>{"is_deeply [top(10, \\%counts)], [qw(b a c d)], \"asking for more than exists is fine\";\nis_deeply [top(2, {})], [], \"an empty hash yields nothing\";\n"}</code></pre>
        <p>Both are edge cases, and both are the kind of thing that works by accident until someone refactors. Testing the boring boundaries of a four-line function is cheap insurance for code that every report depends on.</p>
        <div className="exercise">
          <h5>Exercise 5</h5>
          <p><code>Strata::Util</code>'s <code>@EXPORT_OK</code> already promises <code>human_bytes</code> and <code>truncate_str</code> — Milestone 1 wrote <code>commify</code>, Milestone 2 wrote <code>top</code>, and these two have been sitting in the export list unimplemented ever since. Write them. <code>human_bytes($n)</code> should turn a byte count into something like <code>"206.1KB"</code> (check it against Milestone 1's own fixture: 211,017 bytes should come out as <code>206.1KB</code>), climbing through KB, MB, GB and TB as the number grows. <code>truncate_str($str, $max)</code> should return the string unchanged if it already fits within <code>$max</code> characters, and otherwise cut it and append <code>"..."</code> so that the whole result — text and ellipsis together — is exactly <code>$max</code> characters, never more. Write the tests before you write the functions, the way the rest of this milestone argues you should.</p>
        </div>
        <details>
          <summary>Solution 5 — open after trying</summary>
          <pre><code>{"sub human_bytes ($bytes) {\n    my @units = (\"B\", \"KB\", \"MB\", \"GB\", \"TB\");\n    my $n = $bytes;\n    my $i = 0;\n    while (abs($n) >= 1024 && $i < $#units) {\n        $n /= 1024;\n        $i++;\n    }\n    return $i == 0 ? \"${n}B\" : sprintf(\"%.1f%s\", $n, $units[$i]);\n}\n\nsub truncate_str ($str, $max = 40) {\n    return $str if length($str) <= $max;\n    return substr($str, 0, $max - 3) . \"...\";\n}"}</code></pre>
          <p>Two details worth noticing. <strong><code>human_bytes</code> stops climbing units at <code>$#units</code></strong>, the last valid index, so a value bigger than the largest unit still prints — as an oversized number of terabytes — rather than reading off the end of <code>@units</code> and returning <code>undef</code> silently in the middle of a report line. <strong><code>truncate_str</code> subtracts 3 before cutting, not after</strong>: the whole point of a bounded field width is that the result never exceeds it, and appending <code>"..."</code> to an already-<code>$max</code>-character substring would make the truncated version <em>longer</em> than the string it replaced for inputs near the boundary, which defeats the reason to truncate at all.</p>
          <pre className="plain"><code>{"$ prove -l t/05-util.t\nt/05-util.t .. ok\nAll tests successful."}</code></pre>
        </details>
        <h4>Experiment</h4>
        <p>Remove the compile test's <code>BAIL_OUT</code> — delete just the <code>or BAIL_OUT(...)</code> part — and deliberately break one module by deleting the trailing <code>1;</code> from the end of <code>Strata::Util</code>, which makes <code>require</code> fail because a <code>.pm</code> file has to return a true value. Run the compile test both ways. Without <code>BAIL_OUT</code>, the broken module's own <code>use_ok</code> fails and the test file runs to completion regardless, reporting "1 of N failed". With <code>BAIL_OUT</code> restored, the run stops the instant the broken module is hit and never reaches anything after it. That is the right behaviour once <code>prove -l t/</code> is running dozens of files: letting three hundred unrelated assertions fail because one module never loaded would bury the single line that actually explains what went wrong.</p>
        <div className="warn">
          <h5>Common mistakes in Milestone 5</h5>
          <ul>
            <li><strong>Reaching for <code>@EXPORT</code> because it needs no <code>qw(...)</code> at the call site.</strong> It works right up until two modules you both <code>use</code> export a sub with the same name, and the caller has no way to tell which one it is running.</li>
            <li><strong>Forgetting the trailing <code>1;</code>.</strong> The module compiles, every sub in it is syntactically fine, and it still fails to <code>require</code> — a genuinely confusing error the first time you meet it, because the reported failure line is wherever the module was loaded, not wherever the missing statement should have been.</li>
            <li><strong>Letting <code>cpanfile</code> and <code>Makefile.PL</code> drift apart.</strong> Add a dependency to one and forget the other, and the failure shows up as "works on my machine" for whichever installer the other developer happens to use.</li>
            <li><strong>Skipping the compile test because "the module obviously loads".</strong> It costs four lines, and it is the one test that turns a wall of unrelated failures into a single, immediate, readable one.</li>
            <li><strong>A dependency line with no comment.</strong> Six months from now the question is "can I remove this", and <code>requires 'XML::LibXML';</code> on its own answers that worse than nothing would.</li>
          </ul>
        </div>
        <h4>Checkpoint</h4>
        <ol>
          <li>What is the difference between <code>@EXPORT</code> and <code>@EXPORT_OK</code>, and which should you use?</li>
          <li>Why does a distribution have both a <code>cpanfile</code> and a <code>Makefile.PL</code>?</li>
          <li>What does <code>BAIL_OUT</code> do and when is it appropriate?</li>
          <li>Where does <code>perldoc</code> get its text from?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 6</span>Five formats behind one interface</h2>
        <h3>Goal</h3>
        <p>JSON lines, CSV, XML and an always-succeeds fallback, all behind the same parser contract, with a registry that sniffs an unknown file and picks one.</p>
        <h3>Concepts</h3>
        <p>A dispatch table, a duck-typed parser contract, confidence scoring rather than boolean detection, and the discovery that two of these formats are not line-oriented at all.</p>
        <h3>Design</h3>
        <p>The contract every parser satisfies, which is enforced by nothing except tests and consistency:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Method</th>
              <th>Purpose</th>
            </tr>
            <tr>
              <td><code>new(%args)</code>, <code>name</code></td>
              <td>construction and identification</td>
            </tr>
            <tr>
              <td><code>mode</code></td>
              <td><code>"line"</code> or <code>"stream"</code></td>
            </tr>
            <tr>
              <td><code>detect(@lines)</code></td>
              <td>class method returning confidence 0..1</td>
            </tr>
            <tr>
              <td><code>parse($line, %ctx)</code></td>
              <td>line-mode parsers: always returns a record</td>
            </tr>
            <tr>
              <td><code>parse_handle($fh, $name, $cb)</code></td>
              <td>stream-mode parsers: calls back per record</td>
            </tr>
            <tr>
              <td><code>stats</code></td>
              <td>parsed, failed, problems by kind</td>
            </tr>
          </tbody>
        </table>
        <div className="warn">
          <h5>Two of these formats are not line-oriented, and the whole pipeline assumed they were</h5>
          <p>The line-by-line model from Milestone 4 is correct for logs and wrong for CSV and XML:</p>
          <ul>
            <li><strong>A CSV field may contain a newline</strong> if it is quoted, so <code>"Multi\nline name"</code> is one record spanning two lines. Splitting on newlines before parsing produces two broken records and there is no way to recover.</li>
            <li><strong>XML has no line structure at all.</strong> An element can span any number of lines, and a document can be pretty-printed or minified into one enormous line.</li>
          </ul>
          <p>The wrong fix is to slurp those formats, which abandons the memory guarantee. The fix taken here is a second mode: a parser may declare <code>mode "stream"</code>, receive the filehandle, and call back once per record. Fifteen lines in the pipeline, and no other code changes:</p>
          <pre><code>{"sub run_handle ($self, $fh, $name) {\n    my $parser = $self->{parser};\n\n    if ($parser->can(\"parse_handle\")) {\n        $parser->parse_handle($fh, $name, sub ($parsed) {\n            $self->{stats}{lines}++;\n            $self->_emit($parsed);\n        });\n        return $self;\n    }\n\n    while (defined(my $line = <$fh>)) {\n        $self->{stats}{lines}++;\n        $self->_emit($parser->parse($line, file => $name, lineno => $.));\n    }\n    return $self;\n}"}</code></pre>
          <p><code>$parser-{'>'}can("parse_handle")</code> is duck typing done properly: ask the object what it can do rather than what it is. Extracting <code>_emit</code> so both paths share the record-wrapping, stage-running and statistics is what keeps the two modes from drifting apart.</p>
        </div>
        <h3>Implementation notes, one per parser</h3>
        <h4>JSON lines: flatten, and never trust the line</h4>
        <pre><code>{"my $data = eval { $JSON->decode($line) };\nif (!defined $data) {\n    my $why = $@ // \"unknown\";\n    $why =~ s/\\s+at\\s+\\S+\\s+line\\s+\\d+.*//s;       # trim Perl's location noise\n    $rec{decode_error} = $why;\n    return $self->_problem(\\%rec, \"bad_json\");\n}\nif (ref $data ne \"HASH\") {\n    return $self->_problem(\\%rec, \"not_an_object\");\n}\n\n# Flatten one level so nested objects become dotted keys, which keeps\n# every record a flat set of fields whatever the service emitted.\n_flatten($data, \"\", \\%rec);\n"}</code></pre>
        <ul>
          <li><strong>Flattening <code>{'{'}"ctx":{'{'}"region":"eu"{'}'}{'}'}</code> to <code>ctx.region</code></strong> keeps every record from every format the same shape: a flat bag of named fields. Correlation across formats is only possible if the records are comparable.</li>
          <li><strong><code>JSON::PP::Boolean</code> needs explicit handling</strong> or your "false" is a blessed object that stringifies to <code>""</code> in some contexts and <code>0</code> in others. The test asserts it becomes plain <code>0</code>.</li>
          <li><strong>A JSON array is valid JSON and not a record.</strong> Rejecting it with <code>not_an_object</code> rather than crashing or inventing a field is the third outcome from Milestone 3 in a new setting.</li>
          <li>Trimming <code>" at /path/to/JSON/PP.pm line 62"</code> off the error message matters: that location is inside a library the user did not write, and leaving it in makes every error report look like a bug in your tool.</li>
        </ul>
        <h4>CSV: use the library, and resynchronise after a bad row</h4>
        <pre><code>{"    while (1) {\n        my $row = $csv->getline($fh);\n\n        unless ($row) {\n            last if $csv->eof;\n\n            # A broken row: report it with the text that caused it and\n            # resynchronise, rather than abandoning the rest of the file.\n            my ($code, $str, $pos) = $csv->error_diag;\n            my $bad = $csv->error_input // \"\";\n            $cb->({ ... problem => \"csv_error\", csv_error => \"$code: $str at char $pos\" });\n            $csv->SetDiag(0);                      # clear and keep going\n            last if eof($fh);\n            next;\n        }\n        ...\n    }\n"}</code></pre>
        <p>Splitting on commas is wrong and everyone knows it; what people forget is that <em>error recovery</em> is the other reason to use a library. <code>Text::CSV</code> tells you the error code, the character position, and the exact input that failed, and <code>SetDiag(0)</code> clears the error so parsing can continue. A hand-rolled splitter gives you none of that, and the first malformed quote ends your run.</p>
        <p>Separator sniffing scores consistency rather than counting commas:</p>
        <pre><code>{"sub sniff_separator ($class, @lines) {\n    my %score;\n    for my $sep (\",\", \";\", \"\\t\", \"|\") {\n        my %counts;\n        for my $line (@lines) {\n            my $n = () = $line =~ /\\Q$sep\\E/g;\n            $counts{$n}++;\n        }\n        my ($mode) = sort { $counts{$b} <=> $counts{$a} } keys %counts;\n        $score{$sep} = $mode ? $counts{$mode} * $mode : 0;   # consistent AND present\n    }\n    ...\n}\n"}</code></pre>
        <p>The insight is that <strong>a real separator appears the same number of times on almost every line</strong>. Semicolons scattered through prose score badly because their count varies; the actual delimiter scores highly because it does not. <code>\Q...\E</code> quotes the separator so a <code>|</code> is a literal rather than alternation.</p>
        <div className="cmp">
          <h5>Splitting on commas vs asking a real CSV parser</h5>
          <pre className="plain"><code>{"naive split (typical)                       Perl, with Text::CSV\n──────────────────────                       ─────────────────────\nmy @fields = split /,/, $line;               my $row = $csv->getline($fh);\n# \"Multi\\nline name\" already broke           # multi-line quoted fields,\n# this before split ever ran                 # embedded commas and quotes,\n# a stray quote just becomes                 # all handled; a broken row\n# one more ordinary character                # reports where and why\n"}</code></pre>
          <p><code>split /,/</code> cannot be fixed into correctness with a cleverer regex, because the problem is not the separator — it is that one CSV "line" can span several physical lines when a field is quoted, and <code>split</code> only ever sees one physical line at a time. <code>Text::CSV</code> is a real state machine that reads as many physical lines as one logical record needs, and when a row does break, it hands back the error code, the character position, and the exact text that failed. Reimplementing that by hand, one edge case at a time, is how a production log parser accumulates a decade of regex patches and still gets embedded quotes wrong.</p>
        </div>
        <h4>XML: a pull parser, because a DOM would eat the file</h4>
        <pre><code>{"# XML is not line-oriented either, and a DOM parser would load the whole\n# document into memory. XML::LibXML::Reader is a pull parser: it walks the\n# document element by element with constant memory, which is the only\n# defensible way to read an XML file of unknown size.\n\nwhile (eval { $reader->read }) {\n    next unless $reader->nodeType == XML_READER_TYPE_ELEMENT;\n\n    if (!defined $record) {\n        next if $reader->depth == 0;         # skip the root itself\n        $record = $reader->name;             # the first child names the record\n    }\n    next unless $reader->name eq $record;\n    ...\n}\n"}</code></pre>
        <p>Three decisions worth noting. <strong>The record element is inferred</strong> from the first child of the root, so <code>{'<'}alerts{'>'}{'<'}alert/{'>'}{'<'}/alerts{'>'}</code> needs no configuration. <strong>Attributes are prefixed with <code>@</code></strong> (<code>@id</code>, <code>@severity</code>) so they cannot collide with child elements of the same name, which is a real XML idiom. And <strong><code>recover ={'>'} 2</code></strong> asks libxml2 to continue after errors rather than aborting, which is the same policy as everywhere else in this project.</p>
        <h4>The fallback that always wins by losing</h4>
        <pre><code>{"sub detect ($class, @) { return 0.01 }   # always applicable, never preferred\n"}</code></pre>
        <p>A nonzero score means it is always a candidate; a tiny score means anything else beats it. That one line replaces a special case in the registry, and it is a nice demonstration of why scoring beats a boolean: "can you parse this?" has no good answer for a fallback, but "how confident are you?" does.</p>
        <h3>Sniffing, and two bugs it revealed</h3>
        <pre className="plain"><code>{"share/fixtures/access.log    => apache        apache=1.15 csv=0.00 json_lines=0.00 xml=0.00\nshare/fixtures/alerts.xml    => xml           apache=0.00 csv=0.00 json_lines=0.00 xml=1.10\nshare/fixtures/events.jsonl  => json_lines    apache=0.00 csv=0.33 json_lines=0.65 xml=0.00\nshare/fixtures/users.csv     => csv           apache=0.00 csv=0.53 json_lines=0.00 xml=0.00\nshare/fixtures/mixed.txt     => unstructured  apache=0.00 csv=0.00 json_lines=0.00 xml=0.00\n"}</code></pre>
        <p>Correct on all five. Then I ran the finished tool over the awkward fixtures, and two entries were wrong:</p>
        <pre className="bad"><code>{"share/fixtures/hard/access.log.gz  csv                 0 records     19.7KB  [gzip]\nshare/fixtures/hard/latin1.log     apache              2 records        60B"}</code></pre>
        <div className="warn">
          <h5>
            <img className="mascot-right" src={img2.src} alt="The Mewlang cat, glancing sideways with annoyance" width="110" loading="lazy" />
            Bug: sniffing looked at the compressed bytes
          </h5>
          <p>The gzipped Apache log was detected as CSV with zero records. The registry opened the file itself and scored the <em>raw bytes</em>, which for a gzip file are compressed noise that happens to contain a consistent number of commas. Meanwhile the <code>Source</code> was decompressing correctly, so the parser was reading real log lines and finding no CSV in them.</p>
          <p>The fix is a rule worth generalising: <strong>sniff the stream the parser will actually read, not the file on disk.</strong></p>
          <pre><code>{"# peek_lines opens the file, reads a few decoded lines, and closes it\n# again. Sniffing has to see the data the parser will see: peeking at the\n# raw bytes of a gzip file tells you nothing except that it is a gzip file.\nsub peek_lines ($class, $path, $n = 20) {\n    my $src = eval { $class->open($path) } or return ();\n    my @lines;\n    while (@lines < $n && defined(my $line = $src->next_line)) { push @lines, $line }\n    $src->close;\n    return @lines;\n}"}</code></pre>
          <p>It decompresses the first few lines twice, once for sniffing and once for real, which is a fair price for correctness. The alternative, a pushback buffer in front of the handle, is more efficient and considerably more code.</p>
        </div>
        <div className="warn">
          <h5>Bug: the filename hint outvoted the evidence</h5>
          <p><code>latin1.log</code> is two lines of prose with a bad byte in each. Every parser scored it zero except the fallback at 0.01, and then the <code>.log</code> extension added 0.15 to Apache, which won. The tool confidently parsed a text file as Apache and produced two failures.</p>
          <pre><code>{"# A filename extension is advice about a file whose content we have\n# already scored. It may break a tie; it must never promote a format the\n# content gave no support for, or every unreadable \".log\" becomes Apache.\nsub _apply_hint ($class, $score, $path) {\n    return unless $path =~ /(\\.[A-Za-z0-9]+)$/;\n    my $hinted = $HINT{ lc $1 } or return;\n    return unless ($score->{$hinted} // 0) > 0.05;\n    $score->{$hinted} += 0.15;\n    return;\n}"}</code></pre>
          <p>The general principle: <strong>metadata may adjust a judgement, never create one.</strong> The same mistake appears whenever a system trusts a <code>Content-Type</code> header, a file extension or a user-declared schema over the bytes actually present.</p>
        </div>
        <p>After both fixes:</p>
        <pre className="plain"><code>{"$ ./bin/strata ingest share/fixtures/*.* share/fixtures/hard/*\n  share/fixtures/access.log          apache          2,004 records    206.1KB\n  share/fixtures/alerts.xml          xml                 2 records       347B\n  share/fixtures/events.jsonl        json_lines          6 records       416B\n  share/fixtures/mixed.txt           unstructured        3 records       177B\n  share/fixtures/users.csv           csv                 5 records       266B\n  share/fixtures/hard/access.log.gz  apache          2,004 records     19.7KB  [gzip]\n  share/fixtures/hard/binary.log     unstructured        2 records        30B  [contains NUL bytes]\n  share/fixtures/hard/bom.csv        csv                 2 records        25B  [BOM (UTF-8)]\n  share/fixtures/hard/giant.log      unstructured        3 records       2.9MB\n  share/fixtures/hard/latin1.log     unstructured        2 records        60B\n  share/fixtures/hard/truncated.log  apache              2 records        85B\n\n4,035 records from 11 files\n\nproblems\n  bad_json                     2\n  blank                        1\n  missing_bytes                1\n  no_match                     8\n  not_an_object                1\n  short_row                    1\n"}</code></pre>
        <div className="exercise">
          <h5>Exercise 6</h5>
          <ol>
            <li><strong>A syslog parser</strong> for <code>Sep 12 13:44:09 api-3 kernel: [88231.4] Out of memory</code>, including the RFC 5424 variant with a priority prefix (<code>{'<'}34{'>'}1 2026-09-12T13:44:09Z ...</code>). Its <code>detect</code> must not claim ordinary prose.</li>
            <li><strong>Mixed-format files.</strong> Some real logs contain two formats interleaved, because two programs write to one file. Add a <code>Strata::Parser::Multi</code> that holds several parsers and, per line, uses the one whose <code>detect</code> on that single line scores highest, recording which. Measure what it costs.</li>
            <li><strong>Detection confusion matrix.</strong> Write a test that runs every parser's <code>detect</code> against every fixture and asserts the winner. Then add a fixture that is genuinely ambiguous (a CSV of JSON strings) and decide what the right answer is.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 6 — open after trying</summary>
          <p><strong>1.</strong> The detection is the interesting half. Syslog's classic format is just a date followed by a hostname and a tag, which prose can accidentally resemble, so require the structure:</p>
          <pre><code>{"sub detect ($class, @lines) {\n    my $hits = grep {\n        /^<\\d{1,3}>\\d?\\s/                                     # RFC 5424 priority\n        || /^\\w{3}\\s+\\d{1,2}\\s\\d{2}:\\d{2}:\\d{2}\\s+\\S+\\s+\\S+/  # classic: date host tag\n    } @lines;\n    return @lines ? $hits / @lines : 0;\n}"}</code></pre>
          <p>Note that both variants belong in one parser rather than two: they are the same log, and which one you get depends on the daemon's configuration, not on the file.</p>
          <p><strong>2.</strong> <code>Multi</code> is straightforward and the cost is not:</p>
          <pre><code>{"sub parse ($self, $line, %ctx) {\n    my ($best, $score) = (\"unstructured\", 0);\n    for my $name (keys %{ $self->{parsers} }) {\n        my $s = ref($self->{parsers}{$name})->detect($line);\n        ($best, $score) = ($name, $s) if $s > $score;\n    }\n    $self->{used}{$best}++;\n    return $self->{parsers}{$best}->parse($line, %ctx);\n}"}</code></pre>
          <p>Running every parser's <code>detect</code> on every line multiplies the per-line regex work by the number of formats, and in my measurements that roughly halved throughput. The standard mitigation is <strong>stickiness</strong>: remember the format that matched the previous line and try it first, falling back to the full scan only when it fails. Real logs are strongly clustered, so this recovers most of the cost.</p>
          <p><strong>3.</strong> A CSV whose fields contain JSON is genuinely ambiguous, and the right answer is CSV: the outer structure wins, because parsing it as JSON lines fails on every line while parsing it as CSV succeeds and leaves the JSON as a field value that a later stage can decode. That suggests a general rule for the confusion matrix: <strong>when two formats both score well, prefer the one that is the outer container</strong>, and provide a stage that parses field values rather than making the file parser guess.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why can CSV and XML not use the line-by-line pipeline?</li>
          <li>How does the pipeline support both modes without the stages knowing?</li>
          <li>Why does <code>detect</code> return a score rather than true or false?</li>
          <li>What does the CSV separator sniffer actually measure?</li>
          <li>Why must the filename extension never create a judgement on its own?</li>
          <li>Why sniff through the Source rather than the file?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 7</span>Files that fight back</h2>
        <h3>Goal</h3>
        <p>One module that turns a path into a stream of text and absorbs everything the real world does to files: gzip, byte-order marks, the wrong encoding, embedded NULs, truncation, and a single line three megabytes long.</p>
        <h3>Concepts</h3>
        <p>Magic-byte detection, PerlIO layers, <code>Encode</code> fallbacks, and bounding the damage a hostile file can do.</p>
        <h3>Design</h3>
        <p>Every one of these problems has been solved ad hoc, in the middle of a loop, in a thousand scripts. Putting them in one place with a name means the rest of the program can assume it is reading text. The fixtures were written first, deliberately:</p>
        <table className="grid">
          <tbody>
            <tr>
              <th>Fixture</th>
              <th>What breaks without the Source</th>
            </tr>
            <tr>
              <td><code>access.log.gz</code></td>
              <td>binary noise, or a special case at every call site</td>
            </tr>
            <tr>
              <td><code>bom.csv</code></td>
              <td>the first column is named <code>\x{'{'}feff{'}'}id</code> and never matches</td>
            </tr>
            <tr>
              <td><code>latin1.log</code></td>
              <td>a decode error, or silently corrupted text</td>
            </tr>
            <tr>
              <td><code>truncated.log</code></td>
              <td>a half line silently dropped, or an infinite loop</td>
            </tr>
            <tr>
              <td><code>binary.log</code></td>
              <td>NULs and control characters through your pipeline and terminal</td>
            </tr>
            <tr>
              <td><code>giant.log</code></td>
              <td>3 MB in one scalar; at scale, memory exhaustion</td>
            </tr>
          </tbody>
        </table>
        <h3>Implementation</h3>
        <pre><code>{"    open my $raw, \"<:raw\", $path or die \"Strata::Source: $path: $!\\n\";\n    my $head = \"\";\n    read $raw, $head, PEEK_BYTES;\n    seek $raw, 0, 0;\n\n    $self->{compressed} = substr($head, 0, 2) eq \"\\x1f\\x8b\";\n    $self->{binary} = !$self->{compressed} && index($head, \"\\0\") >= 0;\n    ($self->{encoding}, $self->{bom_bytes}) = $class->_sniff_encoding($head);\n"}</code></pre>
        <p><strong>Detect by content, not by name.</strong> <code>\x1f\x8b</code> is gzip's magic number whatever the file is called, and plenty of gzipped logs are named <code>.log</code>. A NUL byte in the first 4 KB means this is not text; that heuristic is what <code>grep</code> and <code>git</code> use and it is right far more often than it is wrong.</p>
        <pre><code>{"sub _sniff_encoding ($class, $head) {\n    return (\"UTF-8\",    3) if substr($head, 0, 3) eq \"\\xef\\xbb\\xbf\";\n    return (\"UTF-16LE\", 2) if substr($head, 0, 2) eq \"\\xff\\xfe\";\n    return (\"UTF-16BE\", 2) if substr($head, 0, 2) eq \"\\xfe\\xff\";\n    return (\"UTF-8\",    0);\n}\n"}</code></pre>
        <p>And then the byte count is used to skip it:</p>
        <pre><code>{"        # Skip the byte-order mark so it does not appear in the first field\n        # of the first record, which is a bug you can stare at for an hour.\n        seek $fh, $self->{bom_bytes}, 0 if $self->{bom_bytes};\n"}</code></pre>
        <p>The BOM bug is worth dwelling on because it is so common and so invisible: your CSV's first header becomes <code>\x{'{'}feff{'}'}id</code> instead of <code>id</code>, every lookup of <code>id</code> returns undef, and the file looks perfect in every editor you open it in. Excel writes these by default.</p>
        <div className="warn">
          <h5>
            <img className="mascot-left" src={img3.src} alt="The Mewlang cat, visibly startled" width="110" loading="lazy" />
            The finding I did not expect: Perl's default replacement is not U+FFFD
          </h5>
          <p>My test asserted that an invalid byte becomes the replacement character. It failed, and the actual decoded characters were:</p>
          <pre className="bad"><code>{"U+005C U+0078 U+0045 U+0039     which is the four-character text  \\xE9"}</code></pre>
          <p>PerlIO's <code>:encoding</code> layer, by default, substitutes a <em>literal escape sequence</em> for bytes it cannot decode. Your data now contains a backslash, an x, and two hex digits, which will flow into your regexes, your database and your reports, and which no one will recognise as a decoding failure.</p>
          <p>The fix is one line, and it is not well known:</p>
          <pre><code>{"    unless ($self->{binary}) {\n        local $PerlIO::encoding::fallback = Encode::FB_DEFAULT;\n        binmode $fh, \":encoding($self->{encoding})\";\n    }"}</code></pre>
          <p>Verified both ways:</p>
          <pre className="plain"><code>{"fallback=default -> U+005C U+0078 U+0045 U+0039      (\"\\xE9\" as text)\nfallback=0x0     -> U+FFFD U+0020 U+006E U+006F      (the replacement character)"}</code></pre>
          <p>With the fallback set, bad bytes become U+FFFD, which is greppable, countable, and universally understood to mean "something was lost here". Counting them is then trivial and more reliable than counting warnings, which the fallback suppresses:</p>
          <pre><code>{"    if (index($line, \"\\x{fffd}\") >= 0) {\n        my $n = () = $line =~ /\\x{fffd}/g;\n        $self->{decode_warnings} += $n;\n        push @{ $self->{notes} }, \"invalid bytes replaced\" if $self->{decode_warnings} == $n;\n    }"}</code></pre>
        </div>
        <div className="cmp">
          <h5>A wrapper class vs a stack of filehandle layers</h5>
          <pre className="plain"><code>{"typical (wrapper object)                    Perl (PerlIO layers)\n─────────────────────────                    ─────────────────────\nfh = gzip.open(path, \"rb\")                   open my $fh, \"<:raw\", $path;\ntext = io.TextIOWrapper(fh,                  # detect gzip, then:\n        encoding=\"utf-8\",                    binmode $fh, \":encoding($enc)\";\n        errors=\"replace\")\nfor line in text: ...                        while (<$fh>) { ... }\n"}</code></pre>
          <p>Both end up with a handle that yields decoded text regardless of what is compressing or encoding it underneath, but they get there differently. The typical approach composes by <em>wrapping one object in another</em>, and every wrapper adds a method-call layer of indirection to every read. Perl's version composes by <em>stacking string labels onto one handle</em> — <code>:raw</code>, then separately <code>:encoding(UTF-8)</code> — pushed and popped like a real stack, while <code>{'<'}$fh{'>'}</code> stays the same one operator throughout. The honest cost is that the stack is global mutable state attached to the handle itself: two pieces of code that both call <code>binmode</code> on the same handle can step on each other in a way two independently-scoped wrapper objects cannot, which is exactly why <code>Strata::Source</code> keeps every layering decision in one place instead of letting callers add their own.</p>
        </div>
        <h4>Bounding the damage</h4>
        <pre><code>{"use constant {\n    PEEK_BYTES     => 4096,\n    MAX_LINE_BYTES => 1_048_576,      # a \"line\" longer than 1 MB is not a line\n};\n\n    if (length($line) > $self->{max_line_bytes}) {\n        $self->{long_lines}++;\n        push @{ $self->{notes} }, \"over-long line truncated\" if $self->{long_lines} == 1;\n        $line = substr($line, 0, $self->{max_line_bytes}) . \"\\n\";\n    }\n"}</code></pre>
        <p>A file with no newlines at all is a single "line" the size of the file, and <code>{'<'}$fh{'>'}</code> will happily read all of it into one scalar. That is how a streaming tool runs out of memory on a file it never loaded. <strong>Any reader of untrusted input needs a line-length bound</strong>, exactly as a network protocol needs a maximum frame size, and the test proves that reading continues correctly after a truncation rather than losing the rest of the file.</p>
        <h3>The tests, which are the point of the milestone</h3>
        <pre><code>{"subtest \"invalid bytes are replaced, counted, and never fatal\" => sub {\n    my $src = Strata::Source->open(\"$H/latin1.log\");\n    my @lines;\n    push @lines, $_ while defined($_ = $src->next_line);\n\n    is scalar @lines, 2, \"both lines were read\";\n    like $lines[0], qr/caf\\x{fffd} not found/, \"the bad byte became U+FFFD\";\n    is $src->stats->{decode_warnings}, 2, \"and was counted\";\n    like join(\",\", $src->notes), qr/invalid bytes replaced/, \"the file is flagged\";\n};\n\nsubtest \"one enormous line cannot exhaust memory\" => sub {\n    my $src = Strata::Source->open(\"$H/giant.log\", max_line_bytes => 64 * 1024);\n    my @lines;\n    push @lines, $_ while defined($_ = $src->next_line);\n\n    is scalar @lines, 3, \"three lines\";\n    is length($lines[1]), 64 * 1024 + 1, \"the giant was truncated to the limit\";\n    is $src->stats->{long_lines}, 1, \"and counted\";\n    is $lines[2], \"after the giant\\n\", \"reading continued correctly afterwards\";\n};\n"}</code></pre>
        <pre className="plain"><code>{"$ prove -l t/50-source.t\nt/50-source.t .. ok\nAll tests successful.\n"}</code></pre>
        <p>Six subtests, each one a category of file that has ruined somebody's afternoon. <strong>Writing the hostile fixtures before the module is the technique</strong>: it converts "be robust" from an aspiration into a checklist, and every new disaster you meet in production becomes one more fixture and one more passing test. </p>
        <div className="exercise">
          <h5>Exercise 7</h5>
          <ol>
            <li><strong>More compression.</strong> Add bzip2, xz and zstd by magic bytes, falling back to an external process (<code>open my $fh, "-|", "zstd", "-dc", $path</code>) when no Perl module is available. Handle the case where the external tool is missing, and note what changes about error reporting when your reader is a child process.</li>
            <li><strong>Encoding detection worth the name.</strong> BOMs cover a minority of real files. Implement a heuristic: try UTF-8 strictly; if it fails, count how many bytes fall in the Windows-1252 punctuation range and guess accordingly. Report the guess and the confidence in <code>notes</code>, and make it overridable.</li>
            <li><strong>Resumption.</strong> Add <code>tell</code>/<code>seek</code> support so an interrupted ingest can restart at the last committed byte offset. Explain why this is easy for a plain file and hard for a gzip stream, and what real tools do about it.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 7 — open after trying</summary>
          <p><strong>1.</strong> The magic bytes are <code>BZh</code>, <code>\xfd7zXZ</code> and <code>\x28\xb5\x2f\xfd</code>. The interesting part is the external-process fallback:</p>
          <pre><code>{"    open my $fh, \"-|\", $tool, \"-dc\", \"--\", $path\n        or die \"Strata::Source: cannot run $tool: $!\\n\";\n"}</code></pre>
          <p>Three things change. The child's error output goes to your stderr unless you redirect it. The exit status arrives at <code>close</code>, not at <code>open</code>, so a tool that dies halfway through looks like a clean end of file unless you check <code>close</code> and <code>$?</code>. And the list form of <code>open</code> (arguments as separate strings, with <code>--</code>) is essential: the string form goes through the shell, so a file called <code>; rm -rf ~</code> would be executed. <strong>Never build a shell command from a filename.</strong></p>
          <p><strong>2.</strong> Strict UTF-8 first is the right order, because valid UTF-8 is unlikely to occur by accident:</p>
          <pre><code>{"my $ok = eval { Encode::decode(\"UTF-8\", $head, Encode::FB_CROAK); 1 };\nif (!$ok) {\n    my $suspicious = () = $head =~ /[\\x80-\\x9f]/g;   # cp1252 punctuation range\n    $encoding = $suspicious ? \"cp1252\" : \"latin1\";\n    push @notes, \"encoding guessed: $encoding\";\n}"}</code></pre>
          <p>The <code>\x80-\x9f</code> range is unassigned in Latin-1 and holds curly quotes and dashes in Windows-1252, so its presence is strong evidence. Say "guessed" in the notes: a guess recorded as a guess is useful, and a guess recorded as a fact is a future bug report.</p>
          <p><strong>3.</strong> For a plain file, remember <code>tell</code> after each committed record and <code>seek</code> back on restart. For gzip you cannot: the decompressor's state depends on everything before the current point, so a byte offset into the compressed file is meaningless without replaying it. Real systems solve this three ways: record the offset in the <em>decompressed</em> stream and re-read (correct, and costs a full decompression); use a format with sync points (bgzip, or multi-member gzip, which is why <code>MultiStream ={'>'} 1</code> is in our constructor); or checkpoint the decompressor state itself, which is what <code>zran</code> does for random access into gzip. <strong>Compression and random access are in tension, and the resolution is always a format decision rather than a code one.</strong></p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why detect gzip by magic bytes rather than by extension?</li>
          <li>What exactly does a BOM do to a CSV file's first column?</li>
          <li>What does Perl's <code>:encoding</code> layer insert for undecodable bytes by default, and how do you change it?</li>
          <li>Why count U+FFFD rather than warnings?</li>
          <li>How can a streaming reader still exhaust memory?</li>
          <li>Why is a NUL byte a reasonable test for "not text"?</li>
        </ol>
        <h2 className="milestone-head"><span className="num">Milestone 8</span>Entities and the common time axis</h2>
        <h3>Goal</h3>
        <p>Pull the things worth correlating out of records (addresses, emails, hosts, paths, identifiers), canonicalise them, and convert every timestamp dialect into one comparable number.</p>
        <h3>Concepts</h3>
        <p>Match, validate, normalise as three distinct steps; context as the only defence against false positives; calendar arithmetic; and the syslog year problem.</p>
        <h3>Design</h3>
        <p><strong>A regex finds candidates. It does not find entities.</strong> Every extractor here is three parts: </p>
        <pre><code>{"    ipv4 => {\n        pattern   => $PATTERN{ipv4},\n        validate  => sub ($v) { 4 == grep { $_ <= 255 && !/^0\\d/ } split /\\./, $v },\n        normalise => sub ($v) { join \".\", map { 0 + $_ } split /\\./, $v },\n        # A dotted quad preceded by \"version\" or \"v\" is a version number.\n        # No regex can tell 1.2.3.4 from an address on its own; only the\n        # surrounding text can, and even then only sometimes.\n        reject_after => qr/(?:version|ver|v)\\s*$/i,\n    },\n"}</code></pre>
        <p>The pattern matches <code>999.1.1.1</code>; the validator rejects it. The pattern matches <code>010.000.000.001</code>; the validator rejects it, because leading zeros mean octal in some resolvers and are a classic filter-evasion trick. Normalisation is what makes correlation possible at all: the same address written differently in two files must become the same string.</p>
        <div className="warn">
          <h5>Two false positives I only found by running it</h5>
          <p><strong>Version numbers are indistinguishable from addresses.</strong> My test asserted that scanning a line containing <code>version 1.2.3.4</code> would yield one address, and it yielded two. There is no regex that separates them, because they are the same string. Only context helps, hence <code>reject_after</code>, and even that fails on <code>upgraded to 1.2.3.4 from 10.0.0.1</code>. The real defence is the next point.</p>
          <p><strong><code>HTTP/1.1</code> is not a path.</strong> Scanning a raw Apache line for paths produced <code>/api/export</code> and <code>/1.1</code>, the second from the protocol version. The fix is a context rule with a rationale:</p>
          <pre><code>{"        # A slash glued to the end of a word is part of that word:\n        # \"HTTP/1.1\" is a protocol, not a path to a file called 1.1.\n        reject_after => qr/\\w$/,"}</code></pre>
          <p>Both bugs point the same way, which is why <code>from_record</code> is built as it is:</p>
          <pre><code>{"# from_record looks in the fields a parser produced first, and only falls\n# back to scanning the raw line for types the fields did not supply. A\n# parsed field is evidence; a regex over the whole line is a guess."}</code></pre>
          <p><strong>Prefer structure to scanning, always.</strong> The Apache parser already knows the client address and the request path; asking it is exact, and scanning the same line is an inference that will sometimes be wrong. Scanning is for the text nobody parsed, which is exactly where you need it and exactly where it is least reliable.</p>
        </div>
        <h3>Implementation</h3>
        <h4>Timestamps: the module that decides whether correlation works</h4>
        <p>Records from five sources are only comparable if their timestamps are. That means every dialect becomes one integer, and the integer has to be right.</p>
        <pre><code>{"    # 12/Sep/2026:13:44:10 +0000\n    if ($raw =~ m{^(\\d{2})/(\\w{3})/(\\d{4}):(\\d{2}):(\\d{2}):(\\d{2})(?:\\s([+-])(\\d{2})(\\d{2}))?}) {\n        my $mon = $MONTH{$2} or return $class->_strptime_fallback($raw, %opt);\n        my $offset = defined $7 ? ($8 * 3600 + $9 * 60) * ($7 eq \"-\" ? -1 : 1) : 0;\n        return _epoch_utc($3, $mon, $1, $4, $5, $6) - $offset;\n    }\n"}</code></pre>
        <p>The test that matters asserts that different spellings of the same instant produce the same number:</p>
        <pre><code>{"    my %cases = (\n        \"12/Sep/2026:13:44:10 +0000\" => 1789220650,\n        \"12/Sep/2026:14:44:10 +0100\" => 1789220650,   # same instant, other zone\n        \"2026-09-12T13:44:10Z\"       => 1789220650,\n        \"2026-09-12 13:44:10\"        => 1789220650,\n        \"2026-09-12T15:44:10+02:00\"  => 1789220650,\n        \"2026-09-12T13:44:10.123Z\"   => 1789220650,\n    );\n"}</code></pre>
        <p>All six pass. That table <em>is</em> the specification of the module, and it is the kind of test that pays for itself the first time someone adds a format.</p>
        <h4>The syslog year problem</h4>
        <pre><code>{"    # Sep 12 13:44:10  -- syslog, with no year at all.\n    if ($raw =~ m{^(\\w{3})\\s+(\\d{1,2})\\s+(\\d{2}):(\\d{2}):(\\d{2})$}) {\n        my $year = $opt{year} // (localtime)[5] + 1900;\n        my $epoch = _epoch_utc($year, $mon, $2, $3, $4, $5);\n\n        # If assuming this year puts the event more than a day in the\n        # future, the log almost certainly rolled over from December.\n        if (defined $opt{reference} && $epoch > $opt{reference} + 86_400) {\n            $epoch = _epoch_utc($year - 1, $mon, $2, $3, $4, $5);\n        }\n        return $epoch;\n    }\n"}</code></pre>
        <p>Syslog's classic format omits the year, so a December line read in January lands twelve months in the future, and your incident timeline puts the cause after the effect. The heuristic (a timestamp more than a day ahead of a known reference belongs to last year) is what every log tool does, it is right almost always, and it is wrong for clock-skewed hosts. <strong>Write the heuristic down where it is applied, and give the caller a way to override it.</strong></p>
        <h3>A benchmark that went the wrong way first</h3>
        <p>My first version of the fast path pattern-matched the timestamp and then called <code>Time::Piece-{'>'}strptime</code> to do the arithmetic. The comment in the code claimed it was "about ten times faster". Measured:</p>
        <pre className="bad"><code>{"hand-written fast path: 1.30s (77,208/sec)\nTime::Piece strptime:   0.98s (102,042/sec)\nratio: 0.8x"}</code></pre>
        <p>It was <em>slower</em> than the library it was meant to beat, because it did the same work plus a regex. The comment was an assumption I had written down as a fact, which is the most expensive kind of comment.</p>
        <p>The fix was to remove the object entirely and compute the epoch arithmetically, using the standard branch-free calendar algorithm:</p>
        <pre><code>{"# days_from_civil: the standard branch-free calendar algorithm (Howard\n# Hinnant's). Converting a date to a day number with arithmetic avoids\n# constructing an object per line, which is what actually costs.\nsub _days_from_civil ($y, $m, $d) {\n    $y -= $m <= 2;\n    my $era = int(($y >= 0 ? $y : $y - 399) / 400);\n    my $yoe = $y - $era * 400;                                  # [0, 399]\n    my $doy = int((153 * ($m + ($m > 2 ? -3 : 9)) + 2) / 5) + $d - 1;\n    my $doe = $yoe * 365 + int($yoe / 4) - int($yoe / 100) + $doy;\n    return $era * 146_097 + $doe - 719_468;\n}\n"}</code></pre>
        <pre className="plain"><code>{"arithmetic fast path: 0.47s (425,794/sec)\nTime::Piece strptime: 1.90s (105,445/sec)\nspeedup: 4.0x"}</code></pre>
        <p>
          <img className="mascot-left" src={img4.src} alt="The Mewlang cat, raising a paw in celebration" width="110" loading="lazy" />
          Four times faster, and every correctness test still passes, which is the only reason the rewrite was safe to attempt. Three lessons, in order of importance: <strong>a comment claiming a speedup is a claim, and claims get measured</strong>; the cost was object construction rather than parsing, which the benchmark told me and intuition did not; and a table of correctness tests written before the optimisation is what turns a risky rewrite into a routine one.
        </p>
        <h3>Running it</h3>
        <pre className="plain"><code>{"$ ./bin/strata entities share/fixtures/access.log share/fixtures/mixed.txt\n\nipv4 (4 distinct)\n  10.14.22.9                                    1,022\n  10.14.22.31                                     344\n  192.168.4.7                                     324\n  172.16.0.99                                     312\n\npath (6 distinct)\n  /api/export                                     343\n  /api/search                                     336\n  /static/app.js                                  323\n  /papers                                         320\n  /login                                          318\n\nactivity by hour\n  2026-09-12T13:00:00Z      1,418\n  2026-09-12T14:00:00Z        585\n"}</code></pre>
        <p>Entities ranked across two files of different formats, and a histogram over a time axis that did not exist until this milestone. That last block is the foundation of Milestone 9: once every record has a comparable instant, "what else happened within ninety seconds of this" becomes a query rather than a research project. </p>
        <div className="exercise">
          <h5>
            <img className="mascot-right" src={img5.src} alt="The Mewlang cat, thinking with a paw to its chin" width="110" loading="lazy" />
            Exercise 8
          </h5>
          <ol>
            <li><strong>More entity types</strong>: URLs (with scheme, host and path as separate entities), IPv6 (with proper canonicalisation, which is harder than it looks), credit-card-shaped numbers with a Luhn check, and semantic versions. For each, write down the false positive you are most worried about and a test for it.</li>
            <li><strong>Redaction.</strong> Add a stage that replaces extracted emails and card numbers in <code>raw</code> with stable pseudonyms (the same input always giving the same token) so that records can be shared. Use a keyed hash, and explain why an unkeyed hash of an email address is not anonymisation.</li>
            <li><strong>Time zones per source.</strong> Some logs are in local time with no offset. Add a per-file <code>tz</code> option, use it when no offset is present, and write a test with a log recorded across a daylight-saving transition. Decide what to do about the hour that occurs twice.</li>
          </ol>
        </div>
        <details>
          <summary>Solution 8 — open after trying</summary>
          <p><strong>1.</strong> The worry list is the exercise. For URLs it is trailing punctuation: <code>see http://example.com/api.</code> ends with a full stop that is not part of the URL, so strip trailing <code>.,;:)]{'}'}</code> and document it. For IPv6 it is that <code>::</code> can be expanded in only one place and the canonical form (RFC 5952) requires lowercase hex, no leading zeros, and the longest run of zero groups compressed; getting this wrong means the same address appears as two entities. For card numbers it is that a Luhn-valid sixteen-digit string is also a valid order number, so a match should be reported as a <em>possible</em> card, never as a certainty.</p>
          <p><strong>2.</strong> An unkeyed hash of an email address is not anonymisation because the input space is small enough to enumerate: an attacker with your redacted file hashes their own address list and matches. Use a keyed hash with a secret the recipient does not have:</p>
          <pre><code>{"use Digest::SHA qw(hmac_sha256_hex);\nsub pseudonym ($value, $key) { \"tok_\" . substr(hmac_sha256_hex($value, $key), 0, 16) }"}</code></pre>
          <p>Stable (the same input gives the same token, so correlation still works), unlinkable without the key, and per-dataset if you rotate the key. Note what it still leaks: frequency. If one token appears 90% of the time, its identity may be inferable from context regardless of the hash.</p>
          <p><strong>3.</strong> The ambiguous hour is genuinely unresolvable from the data: 01:30 occurs twice on the night the clocks go back, and a local-time log with no offset cannot say which. The defensible options are to pick the first occurrence and flag the record, or to mark the timestamp as ambiguous and let correlation treat it as a range. <strong>What you must not do is pick one silently</strong>, because an hour of duplicated timestamps in an incident timeline is exactly the kind of thing that sends an investigation down a wrong path. This is also the strongest possible argument for logging in UTC with an explicit offset, which is worth saying in your tool's documentation.</p>
        </details>
        <h4>Checkpoint</h4>
        <ol>
          <li>Why is match, validate, normalise kept as three separate steps rather than one clever regex?</li>
          <li>What does <code>reject_after</code> defend against, and why can it never be a complete defence on its own?</li>
          <li>Why does <code>from_record</code> prefer a parser's own fields over scanning the raw line?</li>
          <li>What does the table of instant-to-epoch test cases actually specify, and why is that more valuable than a single passing test?</li>
          <li>What is the syslog year problem, and what heuristic does this milestone use to resolve it?</li>
          <li>The hand-written timestamp fast path was originally slower than <code>Time::Piece</code>. What was it actually spending its time on, and what fixed it?</li>
        </ol>
        <h4>Common mistakes in Milestones 5–8</h4>
        <div className="warn">
          <ul>
            <li><strong>Trusting a filename extension</strong> over the file's content.</li>
            <li><strong>Sniffing the compressed bytes</strong> rather than the decompressed stream.</li>
            <li><strong>Splitting CSV on commas</strong>, and losing error recovery as well as correctness.</li>
            <li><strong>Parsing XML with regexes</strong>, or with a DOM parser on a file of unknown size.</li>
            <li><strong>Assuming <code>:encoding</code> gives you U+FFFD</strong> for bad bytes.</li>
            <li><strong>Reading lines with no length bound.</strong></li>
            <li><strong>Treating a regex match as an entity</strong> without validation, normalisation, or context. </li>
            <li><strong>Scanning raw text when a parsed field is available.</strong></li>
            <li><strong>Assuming an optimisation is one</strong>, and writing the assumption in a comment.</li>
          </ul>
        </div>
        <div className="why">
          <h5>Why are we using this language here?</h5>
          <p>Milestone 7 is Perl at its best in a way that is hard to see unless you have written the equivalent elsewhere. PerlIO layers mean compression, encoding and buffering compose as a stack on a handle rather than as wrapper objects, so <code>binmode $fh, ":encoding(UTF-8)"</code> after opening a gzip stream is the whole of "decompress then decode". The fixtures, the magic-byte checks and the line bound are about a hundred lines total.</p>
          <p>Milestone 6 is more mixed. The dispatch table and duck-typed contract are pleasant, and <code>$parser-{'>'}can("parse_handle")</code> is exactly the right amount of ceremony. But nothing checks that a parser actually implements the contract, so a plugin missing <code>stats</code> fails at run time, in production, on the one file that used it. Go's interfaces or Ruby's contract tests both handle this better; the Perl answer is a test module that every parser's test file uses, which is Milestone 11. </p>
          <p>Milestone 8 is the honest low point for the language, and the high point for the discipline. Perl gives you nothing for entity extraction that another language would not; the value is entirely in the three-step match-validate-normalise structure, the context rules, and the tests that caught two false positives. The 4× timestamp speedup came from writing arithmetic instead of using a library, which is a technique available everywhere.</p>
        </div>
        <h3>Repository state after Milestone 8</h3>
        <pre className="plain"><code>{"strata/\n├── Makefile.PL, cpanfile        declared dependencies, installable\n├── bin/strata                   ingest | entities\n├── lib/Strata.pm                POD, $VERSION\n├── lib/Strata/\n│   ├── Util.pm                  commify, top, human_bytes, truncate_str\n│   ├── Pattern.pm               named composable qr// building blocks\n│   ├── Record.pm                fields, provenance, problems, entities\n│   ├── Pipeline.pm              line and stream modes, stages, stats\n│   ├── Source.pm                gzip, BOMs, encodings, NULs, giant lines\n│   ├── Extract.pm               match -> validate -> normalise, with context\n│   ├── Normalize.pm             every timestamp dialect -> one integer\n│   └── Parser/\n│       ├── Registry.pm          dispatch table and confidence scoring\n│       ├── Apache.pm  JsonLines.pm  Csv.pm  Xml.pm  Unstructured.pm\n└── t/                           7 files, 46 tests\n    └── share/fixtures/hard/     six files designed to break the reader\n"}</code></pre>
        <pre className="plain"><code>{"$ prove -l t/\nAll tests successful.  Files=7, Tests=46\n$ git commit -am \"milestones 5-8: distribution, formats, hardened reading, entities\"\n"}</code></pre>
        <footer className="end">
          <p>
            <img className="mascot-left" src={img6.src} alt="The Mewlang cat, stretching contentedly" width="120" loading="lazy" />
            Instalment 13 of the five-course curriculum. Next: Perl Milestones 9–12, where records go into SQLite and become correlated events, the CLI grows real option handling and Unix manners, the parser gets fuzzed and profiled, and the whole thing becomes a queryable knowledge graph.
          </p>
        </footer>
         <Link className="button" href="/perl-course/milestones/9-12/">Continue</Link> 
      </div>
    </div>
  );
}
