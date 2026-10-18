# Закрепление источников

Дата проверки: 2026-10-18. Использованы официальные ресурсы: [UDer](https://ufal.mff.cuni.cz/universal-derivations), [GLeMM](https://src.koda.cnrs.fr/nabil.hathout.1/glemm), [MorphyNet](https://github.com/kbatsuren/MorphyNet).

UDer: доступный релиз 1.1, [официальный handle](http://hdl.handle.net/11234/1-3247). Архив 68 432 626 байт; опубликованный MD5 bf05839a5324cce1f1665667247c9eb7 проверен. Точный URL контейнера, SHA-256 и пути TAR members закреплены в source-lock.json. Старые HTTPS endpoints возвращали 503; данные получены через официальный DSpace bitstream. CELEX содержит только инструкции без лицензируемого корпуса.

GLeMM: доступная 2.0, commit `395020177a96a81177582fb59664509ff015f934`, GLeMM_2.0/output/{lang}/{pairs,defs}.tsv.bz2, CC-BY-4.0. Возможные обязанности исходных MorphyNet/Wiktionary и зависимость свидетельств сохраняются; лицензия верхнего проекта не делает все записи независимыми.

MorphyNet: commit `378144f64df58c78db5245af19d16a511ccecf3a`, derivational/inflectional v1, CC-BY-SA-3.0. Испанская инфлекция в двух частях, русская в ZIP. Незакреплённые main/latest при сборке не используются.

Все 25 git blob hashes файлов MorphyNet/GLeMM сверены с официальными деревьями: [UPSTREAM-FILE-CHECKS.json](../../data/morphology-evidence/sources/UPSTREAM-FILE-CHECKS.json). Оригинальные license/README и metadata observations сохранены рядом с [source-lock.json](../../data/morphology-evidence/sources/source-lock.json). Контрольные суммы извлечённых UDer members вычислены после проверки официального контейнера; это локальные SHA-256, а не выдуманные опубликованные upstream hashes.

35 файлов занимают 260 992 004 байта в закреплённом входном представлении (compressed bz2/ZIP включены как есть, полный TAR контейнер повторно в сумму не входит). Ниже размеры именно этих файлов; распакованные размеры/число строк в SOURCE-COUNTS.json.

| Artifact | Байты | Строки данных | Лицензия | SHA-256 |
|---|---:|---:|---|---|
| GLeMM:deu:defs.tsv.bz2 | 1636674 | 42438 | CC-BY-4.0 | `c22cb69cfdf677d78e25d806079f0768b65382e5d34ce9cce26e41811fc92f54` |
| GLeMM:deu:pairs.tsv.bz2 | 1067083 | 136248 | CC-BY-4.0 | `2463ba12123fabb48542327ea241ca4bdb26a5acb1d6c864cac4e828eb7d8d40` |
| GLeMM:eng:defs.tsv.bz2 | 7094764 | 271496 | CC-BY-4.0 | `8dc73d48dfe8f687c3686230371d0e3218719852f9e3f924cbe9bb6f8ba6a09e` |
| GLeMM:eng:pairs.tsv.bz2 | 5578736 | 779170 | CC-BY-4.0 | `67073ab267768413b9e407080743d4e4e2aa36fed932600fc18fcd80f35b15db` |
| GLeMM:esp:defs.tsv.bz2 | 666727 | 19548 | CC-BY-4.0 | `388e44640608d0b7ca31bf08f6f1ec30fa5517864182e75efabdeabfc5d18266` |
| GLeMM:esp:pairs.tsv.bz2 | 537465 | 70531 | CC-BY-4.0 | `033a3e8679e49d0788f39c10e7e1bc641250290a6fbae8877df0653f10b81754` |
| GLeMM:fra:defs.tsv.bz2 | 2653817 | 86526 | CC-BY-4.0 | `d18c771f78332d03c8e2717a7a140ed541462f57de3d1262e616e7c69d00a6b4` |
| GLeMM:fra:pairs.tsv.bz2 | 1960093 | 271343 | CC-BY-4.0 | `d88e7d532994f6b03f09e6dc2913c7a2ae92b91749e476c54b75074a69dfc8b2` |
| GLeMM:ita:defs.tsv.bz2 | 315630 | 9569 | CC-BY-4.0 | `be2fac7b7be3147ce004be6cf5f8a26524983c6744e669f293b36f6007e85491` |
| GLeMM:ita:pairs.tsv.bz2 | 903092 | 121400 | CC-BY-4.0 | `d536c3d310f95d367ac7446f5e7fb6a16c9e49c5d14f95bbc4094cdc8abf38cc` |
| GLeMM:rus:defs.tsv.bz2 | 5082025 | 261713 | CC-BY-4.0 | `45faa636451ec9021e96e3c281aafdb24eb0e03cf4d7051fbe69dc9b04da58e4` |
| GLeMM:rus:pairs.tsv.bz2 | 4796104 | 732633 | CC-BY-4.0 | `ceb1e57f137c808ba677dbe70115b36570a15109e8ba8e19b2b6e7a034f69f92` |
| MorphyNet:deu.derivational.v1 | 1057628 | 29381 | CC-BY-SA-3.0 | `21a5fb2432e14fd995cc3ce1b44fef0f975c25c2e8368232df006395cf97033c` |
| MorphyNet:deu.inflectional.v1 | 23258436 | 490331 | CC-BY-SA-3.0 | `a5715136406aa37e2b8aa7e1ad4e5f228bc4d9885fd0abe4f29950c4aa020c86` |
| MorphyNet:eng.derivational.v1 | 8169109 | 225131 | CC-BY-SA-3.0 | `5920edacc1888b14464fc5cd96beea0a721221d56d1dc0e49de22f4c7c537c50` |
| MorphyNet:eng.inflectional.v1 | 21455254 | 649593 | CC-BY-SA-3.0 | `6295cd9a0e72e260298d8d80dc1e512e5d37ea44617dd2df6fbeef02f50bcc3f` |
| MorphyNet:fra.derivational.v1 | 2683375 | 72952 | CC-BY-SA-3.0 | `eaf40688e3175f21d05ee89fe3669d6f3b224e6a99b43260e24e0e1744563447` |
| MorphyNet:fra.inflectional.v1 | 22293532 | 453228 | CC-BY-SA-3.0 | `191f644875cd64cb0de7d5bf020dc1e4fa6fb7d4fb820c9c06bb8a24810b99b8` |
| MorphyNet:ita.derivational.v1 | 2209996 | 58848 | CC-BY-SA-3.0 | `b0988c57afdaef185bf6d9e557f994d9c960b634eb6cf9f5040c1de02f66ed99` |
| MorphyNet:ita.inflectional.v1 | 36471316 | 712021 | CC-BY-SA-3.0 | `06fda3d9db2d0884e4aa2bccf6e1efcb1578cc2bb42bd3a90afe64bde5441b74` |
| MorphyNet:rus.derivational.v1 | 5389104 | 93039 | CC-BY-SA-3.0 | `ad3c778df01ee168cb5fbebc25ef9d02195ce2337feb29e8b70405af4a6419a0` |
| MorphyNet:rus.inflectional.v1 | 10279691 | 1321024 | CC-BY-SA-3.0 | `80b2c608f220a25049d632340377a5c06282c4de1db39e35277591951445f9d9` |
| MorphyNet:spa.derivational.v1 | 1097625 | 30777 | CC-BY-SA-3.0 | `1f1d98ec6ffa7ba1ef55dcae1db3d98931f749db5390c810887c71f80a20d519` |
| MorphyNet:spa.inflectional.v1.part1 | 45309915 | 750000 | CC-BY-SA-3.0 | `135afd6bfad6c1e2774349cde2eba052a35c5d697e89ae92a526521ede83a057` |
| MorphyNet:spa.inflectional.v1.part2 | 29299778 | 539324 | CC-BY-SA-3.0 | `accad9db6e5f9b8a4691fc3aefc6af06ef30fbfc6a1b8d42950c8a08ce211f6a` |
| UDer:de-DErivBase | 3438963 | 280775 | CC-BY-SA-3.0 | `b541cc6a120dcc0741cbb3ca638a778753d682c61a77d129f07caea0507871f6` |
| UDer:en-CatVar | 940651 | 82675 | OSL-1.1 | `48a2a1c4a6e5123a811ff6d968ff4308703b566a19bfd3714cb4191143a1e344` |
| UDer:en-WordNet | 163431 | 13813 | CC-BY-NC-SA-3.0 | `5f8d01d65bb2bdde94a60a05d52e245bdaf4ba5a28d63923296430d99d42c5be` |
| UDer:es-DeriNetES | 1958525 | 151173 | CC-BY-NC-SA-3.0 | `cf68c43f6c52f490c4a517d394a7197ff99e429f34e5a6edb58f890da45ab7d4` |
| UDer:fr-Demonette | 290806 | 22060 | CC-BY-NC-SA-3.0 | `1271bef98f1d1fc37546471d6d950d78e3e77cf612d56073b9f265c1e0f47cee` |
| UDer:it-DerIvaTario | 182012 | 8267 | CC-BY-SA-4.0 | `055badea929d67c76e8011d7b3e0444db325a865d87443fd0c376413e39e2d1c` |
| UDer:ru-DeriNetRU | 3839157 | 337632 | CC-BY-NC-SA-4.0 | `5c769d95a2e49caa7f50f75fdacb1db1f1d2a23aa06a9d3de0364b03ca92ac55` |
| UDer:ru-DerivBaseRU | 8807305 | 270473 | Apache-2.0 | `960c5f5ca0af8410223722ec9a34007d59c7ab3caf34c2cfbdbc3efadbbb7bed` |
| UDer:ru-EtymWordNetRU | 43588 | 4005 | CC-BY-SA-3.0 | `c3f5bd75ed34a9f92150aca1c164b60ee626c23b74df4296129231af62f4418b` |
| UDer:ru-GoldenCompoundAnalyses | 60597 | 4931 | CC-BY-NC-4.0 | `004965acd2a4b7f2405a30af9ec6d4be2140dfae6b5e0f3673b67f1f2ca24782` |

UDer лицензируется по подресурсам, а не одной лицензией коллекции. Обнаруженное расхождение: для ru-DerivBaseRU в опубликованной таблице указано 136449 relations; фактический архив содержит 270473 узла, 136449 корней и 134024 ребра. Отчёт использует фактические строки/связи, не табличную оценку. Для прочих языковых особенностей и нормализации см. [SOURCE-COMPATIBILITY.md](SOURCE-COMPATIBILITY.md).
