# Resource and license audit

All 35 original files were independently checksum/size verified, including the inner Russian MorphyNet ZIP member. The UDer container came from official LINDAT and matched its pinned archive hash; GLeMM came from the verified private offline cache; MorphyNet came from its pinned official GitHub revision. No unverified mirror or synthetic replacement was used.

The registry is heterogeneous: 12 files CC-BY-4.0, 15 CC-BY-SA-3.0, 1 OSL-1.1, 3 CC-BY-NC-SA-3.0, 1 CC-BY-SA-4.0, 1 CC-BY-NC-SA-4.0, 1 Apache-2.0 and 1 CC-BY-NC-4.0. These are per-artifact declarations, not a single blanket license for the combined corpus. Original resource README/license texts remain unchanged. NC/share-alike/OSL obligations must be evaluated for the intended redistribution/use; a verified private research cache does not authorize commercial/public redistribution.

No raw corpus or full catalog is committed. `corpus_cache.py` retains original attribution metadata, rejects unknown/duplicate/archive-escape entries and restores only against the trusted checkout's lock. The GLeMM/MorphyNet relationship is treated conservatively; two copies of related upstream material are not independent scientific support.

Coverage refers to the six controlled language codes en/de/fr/es/it/ru in the existing lock. Missing external resources such as unavailable CELEX are not fabricated. Native script is preserved; Russian transliteration is not merged with Cyrillic.

Final per-language/source counts and disk/memory measurements will be linked from `certification01/` after full certification.
