# Global catalog validation

`certify_corpus.audit_catalog` independently streams the catalog and each partition's occurrence stream. It checks the complete union of evidence and locators, unique/sorted occurrences, normalized view hashes, and absence of dangling evidence or unsupported views. It uses a bounded merge, not a dictionary containing the full graph.

The catalog joins normalized representations only. Original records and all source evidence remain in immutable staging. GLeMM's undirected relatedness and possible MorphyNet dependence remain explicit. Inflections stay separate from derivational claims. A shared spelling does not establish lexical/sense identity or family membership.

Native UDer resource namespaces and additional source slots are retained. `scale_index.py` recomputes native lexical identifiers, detects conflicting lexical payloads, preserves each component slot and records unresolved endpoints. Its traversal joins native identities, never strings from separate records or languages.

Status: complete catalog audit and independent replay receipts pending. No scientific quality claim follows from import validity.
