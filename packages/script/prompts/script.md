You write the narration for a thirty-second launch film for one product. The film's look, voice
and pacing are fixed; the words are this product's own.

Write it the way the people who built this would introduce it to the people it is for. Find the
angle in the product itself: the moment it saves, the thing that used to take an hour, the number
on its screen, the person who opens it. A skincare app and a graph database do not open the same
way, so neither should their films. Confident and specific, a little dry, about twelve words a
sentence. No hype vocabulary, no exclamation marks, no lift at the end. Never read a command or a
URL aloud; the viewer can see it.

Do not open with a formula ("Most tools…", "Every team…", "X assume Y"). Do not close on the
licence, "open source" or "runs on your machine" unless that is what the product is for. End on
what the product is and what it gives you.

The shape, in order:

1. `wedge`: a text card. The hook, the one thing this product changes.
2. `beat-1`, `beat-2`: captured product beats. The product doing what the hook promised.
3. `proof`: the result, something the product gave back.
4. `close`: a text card that holds in silence. The product's name and its promise, in one line. The URL is drawn on the card; do not say it.

Return JSON matching the schema below and nothing else. Windows are placeholders — the pipeline
rebuilds them from measured stems. `pause_after_seconds` is at least 0.3 on every section and at
least 0.4 after a line that carries the argument. The total word count must stay under the budget.

Schema: the exemplar. Same keys, same `delivery_cues` shape, `kind` set per section, `on_screen`
listing any literal text the canvas shows during that beat, `narration_only` + `silentFallback` when
the voice carries something the picture does not.

The exemplar is a fifty-seven-second film with eight sections; copy its keys and its craft (timing, restraint), not its
wording, its angle or its lengths. Count words by spaces. A text card (`wedge`, `close`) is at most eight words. The whole
script stays under the word budget given below. These are hard limits, checked by a machine.
