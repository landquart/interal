# Flexor research, phase 07

Offline preparation only; no Flexor adapter, inference imitation or membership writes.

```sh
/usr/bin/python3 associativvordes/flexor_research/prepare.py --out /tmp/flexor-plan
/usr/bin/python3 -m unittest discover -s associativvordes/flexor_research -v
```

The pinned phase-06 case archive is bounded (1406 cases). Selection requires actual external-path provenance. The 40 screening cases are unannotated hypotheses; neither their family nor their difficulty category is gold. Missing inputs or unattested terms fail explicitly. PLAN and READINESS replay byte-for-byte. READINESS deliberately records no Flexor measurements.

Optional **HanTa**, a different system, smoke probe:

```sh
python3 associativvordes/flexor_research/hanta_probe.py --wheel /path/to/hanta-1.2.0-py3-none-any.whl --plan /tmp/flexor-plan/PLAN.json --out /tmp/HANTA-SMOKE.json
```

Requires Python 3 and NumPy. The official 1.2.0 wheel must match SHA-256 `aad4fdd1eff50522f2b4c2d5c87752beb5bd266c53161bffdda9dc7ca269a476`; no implicit install/download. Wheel location: `https://pypi.org/pypi/HanTa/1.2.0/json`. Only the verified official artifact is deserialized. Child processes use separate EN/DE models with a 60-second limit. No raw corpora or weights are copied into the repository. Native POS/morpheme labels and original casing are retained. Timings/RSS vary across machines and repetitions; they are not deterministic outputs or quality metrics. This is not the retrained HanTa baseline of the Flexor paper.

Reports and recorded artifacts: `audit/associative-external-preparation/FLEXOR-*.md`, `07-FLEXOR-RESEARCH.md`, `flexor-validation/`.
