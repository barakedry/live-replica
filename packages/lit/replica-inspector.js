import {LitElement, html, css} from 'lit';
import {LiveReplicaController} from './controller.js';

const styles = css`

:host {
    font-size: 13px;
}

input {
    font-family: Consolas, Menlo, Monaco, 'Lucida Console', 'Liberation Mono', 'DejaVu Sans Mono', 'Bitstream Vera Sans Mono', 'Courier New', monospace, serif;
    font-size: 12px;
}

ul li {
    padding: 0;
    margin: 0;    
}

ul, ul * {
    box-sizing: border-box;
    vertical-align: middle;
}

ul {
    list-style: none;
    vertical-align: middle;
    padding-left: 16px;

    moz-user-select: none;
    -webkit-user-select: none;
    -ms-user-select: none;
}

li {
    margin: 1px;
    margin-top: 2px;
    vertical-align: middle;
    font-weight: bold;
}

button {
    outline: blue;
    border: none;
    padding: 0;
    margin: 0;
    background-color: transparent;
}

button:focus{
    outline: 0;
}

button.delete,
button.add,
button.duplicate,
button.expandCollapse {
    background-repeat: no-repeat;
    width: 16px;
    height: 16px;
    font-size: 10px;
}

button.delete,
button.duplicate {
    visibility: hidden;
}

button.add {



}

li:hover > button,
li:hover > span > button.duplicate,
ul:hover > li > button.add {
    visibility: visible;
    opacity: 1;
}


ul:hover {
    transition: background 0.55s linear 0.75s;
    background-color: rgba(0,0,0,0.03);
}


label {
    margin: 0;
    padding: 0;
    padding-left: 2px;
    text-align: right;
    overflow: hidden;
    font-weight: bold;
    color: #800080;
}

button.delete {
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAABCJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjE8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDx0aWZmOkNvbXByZXNzaW9uPjU8L3RpZmY6Q29tcHJlc3Npb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjcyPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj43MjwvdGlmZjpZUmVzb2x1dGlvbj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjE2PC9leGlmOlBpeGVsWERpbWVuc2lvbj4KICAgICAgICAgPGV4aWY6Q29sb3JTcGFjZT4xPC9leGlmOkNvbG9yU3BhY2U+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj4xNjwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgICAgIDxkYzpzdWJqZWN0PgogICAgICAgICAgICA8cmRmOkJhZy8+CiAgICAgICAgIDwvZGM6c3ViamVjdD4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIwMTQ6MDg6MTUgMjI6MDg6NDA8L3htcDpNb2RpZnlEYXRlPgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPlBpeGVsbWF0b3IgMy4yPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoYh+BDAAAA/0lEQVQ4Ea1Tqw7CQBCcAgZIAwI0giBxiGqC5Sfq+Ro8X0LQFThkg0CDgDSAIsfuvfpIew2Pmrvbndmb250CP35ekX8ewO/0saJ4AIGZzHvY0xo9rlgPL0iynFyBZIx5E9jAwygLsnuB0wsI/SN2JmYLaPKWyDZmQLlVQFCRhSkiwSy728Oh8uZcBTqQkvsNU35Og3PyzVWyi2Q+E1b3CbIAhYIyXE1McloSxN3WL2/Hwsl7TjRQT8gocJJcSaVAzXnJQHuDi8U5xbE9iOrwJXnJ+c8YeZ7sMJqvu4MsQxkpNJa2TWRnscPYJCVyVUhZ2bqQg3omKeXTnyllfrl7A8CaUAi7BDdNAAAAAElFTkSuQmCC);
}

button.add {
    cursor: pointer;
    visibility: hidden;
    height: 18px;
    color: rgb(68, 68, 68);
    padding: 1px 10px 1px 22px;
    width: auto;
    margin-left: 19px;
    font-size: 11px;
    font-weight: bold;
    vertical-align: middle;
    line-height: 10px;
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAABCJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjE8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDx0aWZmOkNvbXByZXNzaW9uPjU8L3RpZmY6Q29tcHJlc3Npb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjcyPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj43MjwvdGlmZjpZUmVzb2x1dGlvbj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjE2PC9leGlmOlBpeGVsWERpbWVuc2lvbj4KICAgICAgICAgPGV4aWY6Q29sb3JTcGFjZT4xPC9leGlmOkNvbG9yU3BhY2U+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj4xNjwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgICAgIDxkYzpzdWJqZWN0PgogICAgICAgICAgICA8cmRmOkJhZy8+CiAgICAgICAgIDwvZGM6c3ViamVjdD4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIwMTQ6MDg6MTUgMjI6MDg6MTA8L3htcDpNb2RpZnlEYXRlPgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPlBpeGVsbWF0b3IgMy4yPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgoqgMGxAAAA8klEQVQ4EaVTKxICMQx9hbUMR+AEOAQKAViGO+A5zXrugAcEagWOE3CEHSxMaRrSpsvAbJeapkle8vIp8OcxH/g9Bhhi6/RTGEy83eLi7go1Sqxx15g0wBFz9LFzwJF2CrLFDU9ssMBJdDEAgQscnCHqxCu9LR5YShB2ZtrXZmY7sx5qzo2YxKTGmMrpeQ+q+RvtNDu/yJf7BA5ADcs/HlN4nHTbPYS2jqd1oZw3Rhho/yyZGdCcDVaEDBmcLJm1LkTn3Qg9qIKhveAxXAJtGI2m7eExluQeB9xxkWITaT1pw34xIZvawpSB0M/8TALrfL8ADMFGq64HOtYAAAAASUVORK5CYII=);
}

button.add:hover {
    border-radius: 3px;
    background-color: rgba(0, 0, 0, 0.08);
}

[expanded] > ul:hover  > li > .add {
    visibility: visible;
}

button.duplicate {
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAABCJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjE8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDx0aWZmOkNvbXByZXNzaW9uPjU8L3RpZmY6Q29tcHJlc3Npb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjcyPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj43MjwvdGlmZjpZUmVzb2x1dGlvbj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjE2PC9leGlmOlBpeGVsWERpbWVuc2lvbj4KICAgICAgICAgPGV4aWY6Q29sb3JTcGFjZT4xPC9leGlmOkNvbG9yU3BhY2U+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj4xNjwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgICAgIDxkYzpzdWJqZWN0PgogICAgICAgICAgICA8cmRmOkJhZy8+CiAgICAgICAgIDwvZGM6c3ViamVjdD4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIwMTQ6MDg6MTUgMjI6MDg6NTY8L3htcDpNb2RpZnlEYXRlPgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPlBpeGVsbWF0b3IgMy4yPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgrv6qAEAAABBElEQVQ4EWNgGGjAiMsBLkELrjMwMmqgyP/7G8DI/v/07hXJz2DiTDAGBg3UvHtNHAMMS0nwMgANlBMT4H/gFjFPFqYetwEwFVCakZGR4d9/hh8vX34p//eL0RYmzQJjYHPysVOPGNRVRRiEBbkYwgO0GbbvvTOL4f9/huu334C0LYPpBdMuwQv/I4O47HX/12+99h9Ev3rzBVnqP0gtTDNOL4CczMrKzODnrs5w+dpLmHoMGu4FdBmokxlgTnayVUJXAubjNMDTWZUBhEHANWQRmMZG4PQCNsXYxHC6AF0xiiv+/78BkyfagD1r47GmWip6AegsoDNR0z7MnUhOhglRjQYAhqlrkfq/jTwAAAAASUVORK5CYII=);
    margin-left: 20px;
}

button.duplicate:hover {

}

button.expandCollapse,
.collapsed > button.expandCollapse {
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAABCJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjE8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDx0aWZmOkNvbXByZXNzaW9uPjU8L3RpZmY6Q29tcHJlc3Npb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjcyPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj43MjwvdGlmZjpZUmVzb2x1dGlvbj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjE2PC9leGlmOlBpeGVsWERpbWVuc2lvbj4KICAgICAgICAgPGV4aWY6Q29sb3JTcGFjZT4xPC9leGlmOkNvbG9yU3BhY2U+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj4xNjwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgICAgIDxkYzpzdWJqZWN0PgogICAgICAgICAgICA8cmRmOkJhZy8+CiAgICAgICAgIDwvZGM6c3ViamVjdD4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIwMTQ6MDg6MTUgMjI6MDg6NjI8L3htcDpNb2RpZnlEYXRlPgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPlBpeGVsbWF0b3IgMy4yPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgquNgPlAAAAs0lEQVQ4EWNgGJ7Az89PnFifMWFTyMHBkRkWFnYgPDxcH5s8shhWA0AKGBkZ7YHUOaBBM0JDQ0WRNSGzcRoAVcQENCgdiG8DDSo0NjZmRdYMYhMyAKweaAA/EPcpKytfDgkJ8UQ2hCgDUDQwMTEi81mQObjY/////wiUa7x79+6Us2fP/kZWR8iAf0DFc4AG1Kxevfo1skYYG6cBQE0Hgf7OX7ly5UWYYqJpUhIS0YYOXoUAuOIpy79fu1UAAAAASUVORK5CYII=);
}

[expanded] > button.expandCollapse {
    background-image: url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAAlwSFlzAAALEwAACxMBAJqcGAAABCJpVFh0WE1MOmNvbS5hZG9iZS54bXAAAAAAADx4OnhtcG1ldGEgeG1sbnM6eD0iYWRvYmU6bnM6bWV0YS8iIHg6eG1wdGs9IlhNUCBDb3JlIDUuNC4wIj4KICAgPHJkZjpSREYgeG1sbnM6cmRmPSJodHRwOi8vd3d3LnczLm9yZy8xOTk5LzAyLzIyLXJkZi1zeW50YXgtbnMjIj4KICAgICAgPHJkZjpEZXNjcmlwdGlvbiByZGY6YWJvdXQ9IiIKICAgICAgICAgICAgeG1sbnM6dGlmZj0iaHR0cDovL25zLmFkb2JlLmNvbS90aWZmLzEuMC8iCiAgICAgICAgICAgIHhtbG5zOmV4aWY9Imh0dHA6Ly9ucy5hZG9iZS5jb20vZXhpZi8xLjAvIgogICAgICAgICAgICB4bWxuczpkYz0iaHR0cDovL3B1cmwub3JnL2RjL2VsZW1lbnRzLzEuMS8iCiAgICAgICAgICAgIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyI+CiAgICAgICAgIDx0aWZmOlJlc29sdXRpb25Vbml0PjE8L3RpZmY6UmVzb2x1dGlvblVuaXQ+CiAgICAgICAgIDx0aWZmOkNvbXByZXNzaW9uPjU8L3RpZmY6Q29tcHJlc3Npb24+CiAgICAgICAgIDx0aWZmOlhSZXNvbHV0aW9uPjcyPC90aWZmOlhSZXNvbHV0aW9uPgogICAgICAgICA8dGlmZjpPcmllbnRhdGlvbj4xPC90aWZmOk9yaWVudGF0aW9uPgogICAgICAgICA8dGlmZjpZUmVzb2x1dGlvbj43MjwvdGlmZjpZUmVzb2x1dGlvbj4KICAgICAgICAgPGV4aWY6UGl4ZWxYRGltZW5zaW9uPjE2PC9leGlmOlBpeGVsWERpbWVuc2lvbj4KICAgICAgICAgPGV4aWY6Q29sb3JTcGFjZT4xPC9leGlmOkNvbG9yU3BhY2U+CiAgICAgICAgIDxleGlmOlBpeGVsWURpbWVuc2lvbj4xNjwvZXhpZjpQaXhlbFlEaW1lbnNpb24+CiAgICAgICAgIDxkYzpzdWJqZWN0PgogICAgICAgICAgICA8cmRmOkJhZy8+CiAgICAgICAgIDwvZGM6c3ViamVjdD4KICAgICAgICAgPHhtcDpNb2RpZnlEYXRlPjIwMTQ6MDg6MTUgMjI6MDg6NDY8L3htcDpNb2RpZnlEYXRlPgogICAgICAgICA8eG1wOkNyZWF0b3JUb29sPlBpeGVsbWF0b3IgMy4yPC94bXA6Q3JlYXRvclRvb2w+CiAgICAgIDwvcmRmOkRlc2NyaXB0aW9uPgogICA8L3JkZjpSREY+CjwveDp4bXBtZXRhPgqNDgGLAAAAwElEQVQ4EWNgGAUUhwAjsgl+fn7iHBwcmchi6OwfP35M37Rp00uYOIoBIMGwsLADjIyM9jAFyPT///8Prlq1ygFZjAmZA2IDNecDqX/o4iAxqByKFIYBK1euvAi0aTaKKiAHJAaSQxfHMACkAKi4Fog/whSD2CAxGB+ZZkbmwNjXrl37pq2t/RPoZHeoWNXq1av3wuSRaawuACm4e/fuFKCtN0EYxEbWhMxmQeYgs8+ePftbUVGxECQGYiPLDTM2ALbCTJh2U9L+AAAAAElFTkSuQmCC);
}

li ul {
    display: none;
}

li[expanded] > ul {
    display: block;
}

li[expanded] > .keyValuePair > .summary {
    display: none;
} 

.number button.expandCollapse,
.string button.expandCollapse,
.null button.expandCollapse,
.function button.expandCollapse,
.boolean button.expandCollapse {
    visibility: hidden;
}

[data-type=string] {
    color: darkgreen;
}

[data-type=number], [data-type=boolean] {
    color: blue;
}

.textValue[data-type=array],
.textValue[data-type=object] {
    color: #888;
    font-style: italic;
}

input {
    display: none;
    padding: 0;
    border-width: 1px;
}

[editing] input {
    display: inline;
    moz-user-select: text;
    -webkit-user-select: text;
    -ms-user-select: text;
}

[editing] .textValue:not([data-type=boolean]) {
    display: none;
}


[data-type=boolean] input {
    display: inline;
}

label,
button,
span {
    display: inline-block;
    vertical-align: middle;
    /*margin-top: 2px;*/
}

span,
.textValue {
    font-weight: normal;
}

.textValue {
    display: inline-block;
}

[data-type=number] .textValue,  input[data-type='number'],
[data-type=string] .textValue,  input[data-type='text'] {
    min-width: 40px;
    min-height: 12px;
    cursor: text;
}

[data-type=number] .textValue:hover ,
[data-type=string] .textValue:hover {
    outline: 1px solid rgba(0,0,0, 0.5);
    background-color: rgba(255,255,255, 0.8);
}

span.textValue {
    display: inline-block;
    margin-left: 4px;
}

.textValue[data-type=string]::before {
    content: '"'
}

.textValue[data-type=string]::after {
    content: '"'
}

.end {
    display: inline-block;
    padding-left: 34px;
    font-weight: bold;
}

#objecteditor-types-menu {
    margin: 0;
    padding: 0px;
    list-style: none;
    display: none;
    position: absolute;
    background: white;
    border: 1px solid #ccc;
    width: 60px;
}

#objecteditor-types-menu li {
    margin: 0;
    padding: 5px;
    cursor: default;
}

#objecteditor-types-menu li:hover {
    background: #eee;
}

.summary {
    color: grey;
    font-style: italic;
    cursor: pointer;
}

.summary:hover {
    text-decoration: underline;
    color: black;
}

#typesMenu {
    padding: 0;
    position: absolute;
    border: 1px solid #ccc;   
    list-style: none;
}

#typesMenu li {
    margin: 0;
    padding: 3px 8px;
}

#typesMenu li:hover {
    background-color: #eee;
}

`;


const inputTypeForValueType = {
    string: 'text',
    number: 'number',
    boolean: 'checkbox'
}

function getValueFromInputByType(input, type) {
    return {
        string: (i) => i.value,
        boolean: (i) => i.checked,
        number: (i) => Number(i.value)
    }[type](input);
}

function expandCollapse({currentTarget}) {
    const propertyElement = currentTarget.parentElement;
    if (propertyElement.hasAttribute('expanded')) {
        propertyElement.removeAttribute('expanded');
    } else {
        propertyElement.setAttribute('expanded','');
    }
}

const defaultValueByType = {
    object: {},
    array: [],
    string: '',
    number: 0,
    boolean: false
}

class ReplicaInspector extends LitElement {

    static get properties() {
        return {
            replica: Object
        }
    }

    static get styles() {
        return styles;
    }
    constructor() {
        super();
        this.liveReplica = new LiveReplicaController(this);
        this.addEventListener('click', async ({path}) => {
            if (!this.addingTo) { return; }

            for (let i = 0; i  < path; i++) {
                if (path[i].id === 'typesMenu') {
                    return;
                }
            }

            await this.updateComplete;

            setTimeout(() => this.closeMenu(), 0);
        }, true);
    }

    update(updatedProperties) {
        super.update(updatedProperties);
        if (updatedProperties.has('replica') && this.replica) {
            this.unwatch?.();
            this.unwatch = this.liveReplica.watch(this.replica);
        }
    }

    addProperty(type, isArray) {
        const {addingTo, isAddingToArray} = this;

        if (!addingTo) { return; }

        let key;
        if (isAddingToArray) {
            addingTo.push(defaultValueByType[type]);
        } else {
            key = prompt('Key Name?');
            if (!key) { return; }
            addingTo[key] = defaultValueByType[type];

        }

        this.requestUpdate();
    }

    closeMenu() {
        delete this.addingTo;
        delete this.isAddingToArray;
        this.requestUpdate();
    }

    openTypesMenu({currentTarget}, obj, isArray) {
        this.menuTop = currentTarget.offsetTop + currentTarget.clientHeight;
        this.menuLeft = currentTarget.offsetLeft;
        this.addingTo = obj;
        this.isAddingToArray = isArray;
        this.requestUpdate();
    }

    renderObject(obj) {

        if (obj === null) {
            return;
        }

        const keys = Object.keys(obj);
        const isArray = Array.isArray(obj);

        return html`
            <ul data-type=${isArray ? 'array' : 'object'}>            
                ${keys.map(key => this.renderProperty(obj, key))}
                <li><button class="add" @click="${(e) => this.openTypesMenu(e, obj, isArray)}">Add ${isArray ? 'Value' : 'Property'}</button></li>
            </ul>
        `;
    }

    stopEditing({currentTarget}) {
        const editingLabel = currentTarget.parentElement;

        if (editingLabel.hasAttribute('editing')) {
            editingLabel.removeAttribute('editing');
        }

    }

    startEditing({currentTarget}) {
        const editingLabel =currentTarget.parentElement;

        if (!editingLabel.hasAttribute('editing')) {
            editingLabel.setAttribute('editing', '');
            editingLabel.querySelector('input').select();
        }
    }

    setValue(input, parent, key, type) {
        parent[key] = getValueFromInputByType(input, type);
        this.requestUpdate();
    }

    renderPrimitive(value, type, parent, key) {

        const inputType = inputTypeForValueType[type] || 'text';

        return html`
            <label>
                <input type=${inputType} value=${value} @blur="${this.stopEditing}" ?checked=${value} @input=${({currentTarget}) => this.setValue(currentTarget, parent, key, type) }>
                <span class="textValue" data-type=${type} @click=${this.startEditing}>${value}</span>
            </label>            
        `;
    }

    renderValueByType(value, type, parent, key) {

        if (value === null) {
            return 'null';
        }

        if (type === 'object') {
            const maxChar = 50;
            let stringified = JSON.stringify(value).substr(0, maxChar);
            if (stringified.length === maxChar) {
                stringified = stringified + '... ' + (Array.isArray(value) ? ']' : '}');
            }
            return html`<span class='summary'>${stringified}</span>`
        }

        return this.renderPrimitive(value, type, parent, key);
    }

    deleteProperty(parent, key) {
        delete parent[key];
        this.requestUpdate();
    }

    async duplicateProperty(parent, value) {

        if (Array.isArray(parent)) {
            parent.push(JSON.parse(JSON.stringify(value)));
        } else {
            const key = prompt('Key Name?');
            if (!key) { return; }

            if (parent.hasOwnProperty(key)) {
                alert(`${key} Already exists`);
                return;
            }
            const copy = JSON.parse(JSON.stringify(value));
            parent[key] = copy;
        }


        await (new Promise(a => setTimeout(a, 0)));
        this.requestUpdate()
    }

    renderProperty(parent, key) {
        const value = parent[key];
        const type = typeof value;
        const dataType = (type === 'object' && Array.isArray(value)) || type;
        const textValue = JSON.stringify(value);
        return html`
            <li class="${type}" data-type="${dataType}">
                <button class='delete' title='Delete' @click="${() => this.deleteProperty(parent, key)}"></button>
                <button class="expandCollapse" @click=${expandCollapse}></button>                                
                <span class="keyValuePair" @click=${expandCollapse}>
                    <label class="key">${key}:</label>
                    ${this.renderValueByType(value, type, parent, key)}                    
                </span>                                
                <button class="duplicate" @click=${() => this.duplicateProperty(parent, value)}></button>
                ${type === 'object' ? this.renderObject(value) : ''}
            </li>`;
    }

    renderTypesMenu() {
        return html`
            <ul id="typesMenu" style="top: ${this.menuTop}px; left:${this.menuLeft}px" >
                <li @click=${() => this.addProperty('object')} >Object</li>
                <li @click=${() => this.addProperty('array')} >Array</li>
                <li @click=${() => this.addProperty('string')} >String</li>
                <li @click=${() => this.addProperty('number')} >Number</li>
                <li @click=${() => this.addProperty('boolean')} >Boolean</li>
            </ul>
        `;
    }

    render() {
        const {replica} = this;
        if (typeof replica !== 'object') {
            return html`<label>replica property not an object</label>`;
        }

        return html`
            ${this.renderObject(replica)}
            ${this.addingTo ? this.renderTypesMenu() : ``}
        `;
    }
}

customElements.define('replica-inspector', ReplicaInspector);