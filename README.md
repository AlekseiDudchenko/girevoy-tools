# Инструменты гиревика

Калькуляторы и графики для гиревиков, тренеров и организаторов: `tools.vsegiri.com`
на английском (`/en/`) и немецком (`/de/`). Старые адреса без языка
ведут на английскую версию.
Соседний проект — [Гиревой архив](https://vsegiri.com) ([репозиторий](https://github.com/AlekseiDudchenko/girevoy-archive)).
Замысел — [`docs/vision-tools.md`](https://github.com/AlekseiDudchenko/girevoy-archive/blob/develop/docs/vision-tools.md) в архиве.

```sh
npm run check    # сборка в dist/ и тесты
npm run preview  # сборка и сервер на http://localhost:8081/en/
```

Зависимостей нет, нужен Node 22. Правила работы — `CLAUDE.md`.

Международный календарь: `/en/calendar/`, `/de/calendar/`.
Проверенные вручную события из официальных источников, фильтры и ICS.
Обновление и модерация: [`docs/calendar-sources.md`](docs/calendar-sources.md).
`npm run calendar:review` создаёт отчёт, автоматически данные не публикует.

Workout builder: `/en/workout/`, `/de/workout/`. Plans and execution, browser-local
autosave, JSON/TXT export, JSON import and portable snapshot links. Format and
behavior: [`docs/workout.md`](docs/workout.md).
