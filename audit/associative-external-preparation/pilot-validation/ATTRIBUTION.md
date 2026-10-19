# Attribution and transformations

Real source observations and resource-specific licenses are pinned in `data/morphology-evidence/sources/source-lock.json` and the stage-03 `SOURCE-MANIFEST.md`/license receipts. Full corpora are not included here.

- Universal Derivations 1.1: https://ufal.mff.cuni.cz/universal-derivations . Each constituent resource retains its own attribution and license; no blanket license is inferred for UDer. Dataset names, original hashes and source links resolve through the existing source lock and graph manifests.
- MorphyNet, K. Batsuren et al.: https://github.com/kbatsuren/MorphyNet , revision `378144f64df58c78db5245af19d16a511ccecf3a`, CC BY-SA 3.0. Morphological observations are mapped by stages 03/04 into source-native graph references; phase 06 samples questions and makes no linguistic certification. Preserve the original attribution/license when redistributing derived observations.
- GLeMM, Nabil Hathout et al.: https://src.koda.cnrs.fr/nabil.hathout.1/glemm , release 2.0, revision `395020177a96a81177582fb59664509ff015f934`, CC BY 4.0. Pattern pairs and possible MorphyNet dependency remain marked; no direction is invented from column order.

Project registry objects are finite read-only extracts with exact commit/object/file proofs. Cases, source paths and blank annotation tasks are transformed research artifacts. Human gold is absent; TEST-ONLY judgments in executable tests are not supplied as a real annotated corpus. See the experiment reports for limitations and selection caps.
