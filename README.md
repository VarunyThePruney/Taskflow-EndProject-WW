# Taskflow: Task Management Application

Project 9, Team No. 2

Taskflow is a task management application built with vanilla JavaScript. It supports complete CRUD operations, drag-and-drop task prioritization, data persistence with localStorage, and filtering by status, priority and category. No frameworks or libraries are used: the project shows DOM manipulation, event handling and browser storage APIs directly.

## Features

### CRUD operations

- **Create:** add a task with the full form (press `N` or click New task), or type a title in the quick-add bar and press Enter.
- **Read:** view tasks in a List view or a Board view with one column per status.
- **Update:** edit any field of a task, tick a task to complete it, or click its status to move it to the next status.
- **Delete:** remove a task instantly, with an Undo option instead of a confirmation popup.

Each task has a title, details, due date, priority (low, medium, high), status (to do, in progress, done) and project (category).

### Drag-and-drop prioritization

- Drag a task onto another task to change its position in the list. This order is saved and used as the task priority order.
- In Board view, drag a task into another column to change its status.
- Up and down buttons do the same job for keyboard and touch-screen users.

### Data persistence

- All tasks, projects and settings are saved to localStorage after every change, so they remain after the browser is closed.
- Stored data is checked when it is loaded, and any invalid field is replaced with a safe default.
- If the app is open in more than one tab, the tabs stay in sync.

### Filtering and sorting

- Filter by status, priority and category (project). Filters can be combined.
- Search by title, details or project.
- Sort by due date, date added, priority or manual (drag-and-drop) order.

### Other

- Friendly due-date labels (Today, Tomorrow, In 3 days, 2 days late), with overdue tasks highlighted.
- Responsive layout for desktop, tablet and phone.
- Keyboard shortcuts and screen-reader labels.

## Technologies used

| Technology              | Used for                                                                                                             |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------- |
| JavaScript (ES6+)       | Arrow functions, destructuring, spread syntax, template literals and array methods (`filter`, `map`, `find`, `sort`) |
| DOM API                 | `querySelector`, `createElement`, `addEventListener` to build and update the interface                               |
| HTML5 Drag and Drop API | `dragstart`, `dragover`, `drop` and `dragend` events for reordering tasks                                            |
| localStorage API        | Saving and loading tasks and settings as JSON                                                                        |
| HTML5 and CSS3          | Page structure, dialogs, layout, theme and responsive design                                                         |
| JavaScript Date object  | Due dates, relative date labels and overdue detection                                                                |

## Project structure

```
taskflow/
|-- index.html   Page structure: sidebar, header, task list and dialogs
|-- styles.css   Styling, layout and responsive rules
|-- app.js       Application logic: state, events, storage and rendering
|-- README.md    This file
```

## Setup and how to run

No installation, build step or server is needed.

1. Download or clone the project folder.
2. Open `index.html` in a modern browser (Chrome, Edge, Firefox or Safari).
3. The app opens with a few sample tasks. Start adding, editing and organizing your own.

An internet connection is only used to load the fonts. Without it, the app still works and uses the system font.

To reset the app, clear the site data for the page in your browser (in Chrome: DevTools, Application, Local Storage, then delete the `taskflow-` keys).

## User guide

| Action          | How                                                                                      |
| --------------- | ---------------------------------------------------------------------------------------- |
| Add a task      | Press `N`, click New task, or type in the quick-add bar and press Enter                  |
| Edit a task     | Click the pencil icon on the task                                                        |
| Complete a task | Click the circle next to the task title                                                  |
| Change status   | Click the status label, or drag the task to another column in Board view                 |
| Delete a task   | Click the bin icon, then Undo within a few seconds if needed                             |
| Reorder tasks   | Drag a task onto another task, or use the up and down buttons in Manual order            |
| Filter tasks    | Use the status buttons, the coloured flow bar, the priority dropdown or the project list |
| Search          | Press `/` and type                                                                       |
| Switch view     | Click List or Board, or press `V`                                                        |
| Add a project   | Click the + next to Projects in the sidebar                                              |

## How it works

Every interaction follows the same flow:

1. The user performs an action (click, key press or drag).
2. An event handler updates the `tasks` array.
3. `save()` writes the data to localStorage as JSON.
4. `render()` rebuilds the interface from the array.

Because the interface is always rebuilt from the data, the screen always matches what is saved.

Data is stored under these localStorage keys:

| Key                    | Contents                      |
| ---------------------- | ----------------------------- |
| `taskflow-tasks-v2`    | All tasks, in manual order    |
| `taskflow-projects-v1` | Projects and their colours    |
| `taskflow-sort`        | Selected sort order           |
| `taskflow-view`        | Selected view (List or Board) |

## Future improvements

- Due-date reminders
- Export and import of tasks as JSON
- Cloud sync across devices
- Recurring tasks
