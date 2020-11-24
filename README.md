# API Blueprint Language Server

Пакет позволяет более удобно работать с API Blueprint в редакторе VS Code.

## Структура пакета

```
├── client // Language Client
    └── extension.js // Language Client entry point
├── package.json // The extension manifest.
└── server // Language Server
    └── server.js // Language Server entry point
```

## Запуск для разработки

* в корневой директории выполнить команду `npm install`;
* открыть VS Code;
* переключиться в Debug viewlet;
* запустить `Client + Server`.

## Сборка пакета

* в корневой директории выполнить команду `npx vsce package`;
* полученный пакет передать для установки заинтересованным лицам.
