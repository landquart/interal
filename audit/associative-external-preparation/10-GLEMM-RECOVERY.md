# GLeMM: повторная проверка и автономное восстановление

Дата: 2026-10-19. Запрос пользователя — закончить работу с GLeMM. **Полный повторный импорт пока BLOCKED получением исходных файлов.** Завершён и проверен механизм восстановления; отсутствие полного корпуса не скрывается за успешными unit tests.

## Что реализовано

- `associativvordes/importers/glemm_cache.py`: детерминированная упаковка оригинальных файлов с точным lock, upstream LICENSE/README/attribution; восстановление против доверенного локального lock; приём upstream ZIP с выбором только закреплённых файлов. Ни archive metadata, ни одинаковое написание слова не создают доверия или membership.
- Повреждённый кеш, подменённый lock, неоднозначные/дублированные файлы, неправильные size/SHA и небезопасные entries отклоняются до публикации `RAW/GLeMM`. Существующий повреждённый target не перезаписывается. Кеш остаётся вне Git.
- `associativvordes/importers/fetch_glemm_git.py`: официальный Git transport, exact commit, выбор только требуемых blobs, затем исходные SHA-256/size. Ошибки сохраняются в machine-readable receipt. Никаких переходов на mutable branch, новые версии, неофициальные зеркала или отключения TLS.
- `.github/workflows/verify-glemm-git.yml`: read-only проверка, аудит шести partitions и архив с attribution публикуются только после полного успеха. В текущем запуске ни одной успешной публикации такого архива нет.

## Фактические результаты

| Проверка | Статус | Подтверждение |
|---|---|---|
| Importer/cache/Git unit tests на реальных attributed excerpts | PASS: 23 | `glemm10/IMPORTER-TESTS.txt` |
| Независимые readiness regressions | PASS | `glemm10/READINESS.txt` |
| Full Tests CI на `c0bb65fafcc9159880e283e3fd9e07c64cd6fb5f` | PASS | [39303195155](https://github.com/landquart/interal/actions/runs/39303195155) |
| Associative Verification на том же commit | PASS | [39303194958](https://github.com/landquart/interal/actions/runs/39303194958) |
| GLeMM HTTP из GitHub runner | BLOCKED: все шесть partitions | [39301452970](https://github.com/landquart/interal/actions/runs/39301452970); и Python, и стандартный curl получают empty reply |
| Официальный Git из GitHub runner | BLOCKED до получения commit | [39303182543](https://github.com/landquart/interal/actions/runs/39303182543), `glemm10/GIT-ACQUISITION.json` |
| Полный независимый аудит GLeMM в этом повторном запуске | BLOCKED | Нет полного набора 12 файлов; прежние counts не объявлены новыми результатами |

Смена curl на его стандартную идентификацию не устранила отказ CI. Локально официальный HTTP endpoint отвечает 200 и начинает передавать байты, но передача медленная/зависает; запрос Range не дал 206. Проверялись официальный raw, API raw, API directory ZIP, Git transport и веб-интерфейс. Веб-интерфейс/скачивание через облачный браузер не завершились. Свидетельств CAPTCHA/бот-блока не наблюдалось; причина сети неизвестна, не утверждается, что сайт недоступен всем пользователям. Бесконечный подбор адресов и сетевых настроек не выполняется.

## Версия и ожидаемая область

GLeMM **2.0**, commit `395020177a96a81177582fb59664509ff015f934`. Доверенный lock — `data/morphology-evidence/sources/locks/glemm.json`; 12 файлов, **32 292 210 исходных байтов**. Исходный ресурс заявляет CC-BY-4.0; upstream LICENSE и авторская ссылка на работу Hathout et al. сохраняются. Зависимость от MorphyNet/Kaikki/GLAWI остаётся возможной зависимостью данных; никаких новых независимых голосов не создаётся. Обязанности исходных ресурсов не отменяются упаковкой кеша.

Ниже counts опубликованных manifests этапа 03 — **ожидания для повторной проверки, не свежие измерения**:

| Язык | pairs | defs | Всего |
|---|---:|---:|---:|
| DE | 136 248 | 42 438 | 178 686 |
| EN | 779 170 | 271 496 | 1 050 666 |
| ES | 70 531 | 19 548 | 90 079 |
| FR | 271 343 | 86 526 | 357 869 |
| IT | 121 400 | 9 569 | 130 969 |
| RU | 732 633 | 261 713 | 994 346 |
| Всего | 2 111 325 | 691 290 | 2 802 615 |

## Один вход для завершения

Нужен ZIP официального каталога `GLeMM_2.0/output` **того же commit**, либо двенадцать оригинальных `.tsv.bz2` с указанными в lock SHA/size. Полный Git project archive со всеми старыми версиями не требуется. API archive endpoint поддерживает exact `sha` и `path`; никакие mutable latest не нужны.

После получения официального ZIP (внешние пути, новый RAW):

```sh
/usr/bin/python3 associativvordes/importers/glemm_cache.py import-upstream \
  --archive /external/upstream-GLeMM-output.zip --raw-root /external/raw
/usr/bin/python3 associativvordes/importers/glemm_cache.py pack \
  --raw-root /external/raw --archive /external/GLeMM-2.0-39502017.zip
for lang in deu eng esp fra ita rus; do
  /usr/bin/python3 associativvordes/importers/validate_sources.py \
    --partition "glemm-$lang-v1.0.2" --raw-root /external/raw \
    --output-root /external/builds --receipts "/external/receipts-release01/$lang"
done
```

Требуется сохранить полный проверенный кеш долговременно вне репозитория, затем независимо повторить сборку в другом output root и сверить hashes. После восстановления всех источников нужен отдельный full-corpus gate/global catalog. Наличие cache helper не означает, что такой кеш уже создан или сохранён.

Формулы, подтверждённые семьи, lexical heads, ручные решения и production не изменены; merge не выполнялся. Полные GLeMM свежие bytes/outputs и окончательная научная оценка не сертифицированы.

Последняя одиночная локальная проба: 202 965 / 315 630 bytes за 300.002071 s, curl exit 28; полного проверенного файла нет (`glemm10/LOCAL-ACQUISITION.json`). Стандартный `ubuntu-24.04-arm` также вернул Empty reply from server: [run 39304007341](https://github.com/landquart/interal/actions/runs/39304007341), `glemm10/ARM-CI.json`. Автономный кеш с полным корпусом не создан. Для завершения нужен официальный upstream ZIP либо доступ к тем же 12 исходным файлам.

Официальный ZIP каталога закреплённой версии: https://src.koda.cnrs.fr/api/v4/projects/nabil.hathout.1%2Fglemm/repository/archive.zip?sha=395020177a96a81177582fb59664509ff015f934&path=GLeMM_2.0%2Foutput . HEAD endpoint вернул HTTP 200/application/zip; это проверка адреса, не скачанных байтов.
