# Real source excerpts

Each TSV is an excerpt of an actual pinned source artifact, not generated linguistic data. `source-lock.json` records parent artifact SHA-256, revision, source URL, language, license and physical-line extraction. Blank separators and source headers are retained. These inputs are never accepted Interal families.

* UDer 1.1: Lukáš Kyjánek, Zdeněk Žabokrtský, Jonáš Vidra, Magda Ševčíková (2021), http://hdl.handle.net/11234/1-3247. Subresource authors, licenses and citations are retained under `data/morphology-evidence/sources/UDer/`.
* MorphyNet: Khuyagbaatar Batsuren, Gábor Bella, Fausto Giunchiglia (2021), https://aclanthology.org/2021.sigmorphon-1.5/; https://github.com/kbatsuren/MorphyNet. CC BY-SA 3.0.
* GLeMM: Nabil Hathout, Basilio Calderone, Fiammetta Namer, Franck Sajous (2026), https://doi.org/10.48550/arXiv.2604.12442; https://src.koda.cnrs.fr/nabil.hathout.1/glemm. CC BY 4.0. Possible upstream MorphyNet/Wiktionary dependence remains explicit.

Changes: excerpting and filenames only; original TSV line bytes retained. Synthetic adversarial inputs live in test code and are distinguished from these corpus excerpts.
