# Glitch Lab — audio sourcing

## The short version

For **glitch, static, CRT and tape sounds specifically, synthesise rather than
source.** `GlitchLab.jsx` ships a Web Audio engine that does this. Three
reasons it wins for this particular category:

1. **Sample playback cannot follow your envelopes.** The events already carry
   keyframed curves. A synth reads the same curve, so the audio and the picture
   fail together. A `.wav` can only be triggered.
2. **Repetition is the tell.** Fire `DROPOUT` twenty times with one sample and
   the illusion dies. Every voice here randomises playback rate, filter
   frequency and timing — verified that two shots produce different automation.
3. **Some of it is more accurate synthesised.** CRT whine is **15.734 kHz** —
   the NTSC horizontal scan rate. An oscillator hits it exactly, for zero bytes
   and zero licensing.

The whole engine is about 4 KB of code and 39 scheduled voices across 8 events.
A comparable sample pack is several megabytes and needs a licence audit.

---

## If you do want recorded material

Layering one real recording under a synth voice is often the best of both —
transient realism from the sample, infinite variation from the synth.

| source                     | licence         | commercial | attribution  | notes                                    |
| -------------------------- | --------------- | ---------- | ------------ | ---------------------------------------- |
| **Freesound** (CC0 filter) | CC0 1.0         | yes        | none         | Best option. Use the licence filter.     |
| **Freesound** (CC-BY)      | CC-BY 4.0       | yes        | **required** | Site auto-generates an attribution list. |
| **Pixabay**                | Content License | yes        | none         | Post-Jan-2019 uploads are _not_ CC0.     |
| **BBC Sound Effects**      | RemArc          | **no**     | —            | Research/education/personal only.        |

### Freesound

Filter to **Free Cultural Works** on the search page — that restricts results
to CC0 and CC-BY. CC0 needs no attribution; CC-BY requires credit even in
non-commercial use. CC-BY-NC exists on the site and is unusable in a product.

Useful search terms for this aesthetic:
`vhs tracking` · `tape dropout` · `crt degauss` · `television static`
`tv turn on` · `film projector` · `relay click` · `magnetic tape hiss`

### Pixabay

Free commercial use, no attribution. Two catches worth knowing:

- Content uploaded **after 9 January 2019** falls under the Pixabay Content
  License, not CC0. Only pre-2019 uploads are CC0.
- The Content License **prohibits redistributing the raw files on a standalone
  basis**. For a design system that matters: you may ship a sound _inside_ your
  product, but you may not publish it as a downloadable asset in your package.
- Pixabay offers **no indemnification**. If you need legal cover, that means a
  paid library instead.

### BBC Sound Effects — read before using

33,000+ archive recordings, and almost everyone recommends them without
checking the terms. The **RemArc Licence permits research, educational and
personal use only.** Commercial use requires separately licensing each sound.
For anything shipped in a product, this library is out.

---

## Practice regardless of source

- **Never autoplay.** Audio starts only from a user gesture — browsers require
  it and it is hostile otherwise. The lab gates everything behind ENABLE.
- **Limit the master bus.** Glitch audio has extreme crest factors; a noise
  burst stacked on a thunk will square off without a compressor.
- **Keep an ambient bed separate and optional.** The 15.734 kHz whine is
  inaudible to many adults and unpleasant to some — it needs its own level.
- **Record provenance at download time.** Page URL, contributor, licence and
  date. Retroactive licence changes have happened; a demand letter is too late
  to start looking.
- **`exponentialRampToValueAtTime` must never target 0.** It produces silent
  NaN in Chrome. Ramp to `0.0001` instead — asserted in the test above.

## Voice design

Each voice is written from the same physical story as its shader:

| event          | what is actually making the sound                            |
| -------------- | ------------------------------------------------------------ |
| `dropout`      | oxide flaw: broadband crack, then AGC over-correction hiss   |
| `signal`       | 60 Hz field buzz detuning downward, snow swelling behind     |
| `corrupt`      | stepped square blips on a quantised grid — never a glissando |
| `crash`        | low thump, rising shriek, sustained tearing                  |
| `degauss`      | resonant coil thunk, 150→38 Hz. Smooth, no noise at all      |
| `scrub`        | tape wow sweeping past playback speed                        |
| `interference` | mains hum beating against its own second harmonic            |
| `boot`         | relay click → HV whine spinning up to scan rate → degauss    |

Change `MAINS` from 60 to 50 outside the Americas. It is a one-line constant
and it is the difference between a sound that feels local and one that does not.
