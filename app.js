'use strict';
const TASKS_KEY = 'taskflow-tasks-v2';
const PROJECTS_KEY = 'taskflow-projects-v1';
const SORT_KEY = 'taskflow-sort';
const VIEW_KEY = 'taskflow-view';

const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['todo', 'in-progress', 'completed'];
const STATUS_LABELS = { todo: 'To do', 'in-progress': 'In progress', completed: 'Done' };
const NEXT_STATUS = { todo: 'in-progress', 'in-progress': 'completed', completed: 'todo' };
const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High' };
const DUE_TITLES = { today: 'Due today', overdue: 'Overdue', week: 'Next 7 days' };
const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten'];
const FALLBACK_COLOR = '#8a92ab';

const DEFAULT_PROJECTS = [
  { name: 'Website Redesign', color: '#6c76df' },
  { name: 'Mobile App', color: '#d58b69' },
  { name: 'Marketing', color: '#4f9c7f' },
  { name: 'Personal', color: '#a276bd' }
];

//DOM and general helper functions
const $ = (selector, parent = document) => parent.querySelector(selector);
const $$ = (selector, parent = document) => [...parent.querySelectorAll(selector)];
const clone = (value) => JSON.parse(JSON.stringify(value));
const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const SVG_NS = 'http://www.w3.org/2000/svg';
// An icon from the sprite in index.html 
function icon(name, size = 16) {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('aria-hidden', 'true');
  const use = document.createElementNS(SVG_NS, 'use');
  use.setAttribute('href', `#i-${name}`);
  svg.append(use);
  return svg;
}

/*
 * Small wrapper around document.createElement.
 * el('button', { className: 'x', textContent: 'Hi', dataset: { id: 1 }, vars: { '--c': 'red' }, attrs: { 'aria-label': 'Hi' } }, child1, child2)
 * Everything is set through DOM properties, so user text is never parsed as HTML.
 */
const el = (tag, props = {}, ...children) => {
  const { className, dataset, vars, attrs, ...rest } = props;
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (dataset) Object.assign(node.dataset, dataset);
  if (vars) Object.entries(vars).forEach(([name, value]) => node.style.setProperty(name, value));
  if (attrs) Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, value));
  Object.assign(node, rest);
  node.append(...children.filter(Boolean));
  return node;
};

// Project colours come from storage, so only accept real hex colours before they reach CSS
const safeColor = (value) => (typeof value === 'string' && /^#[0-9a-f]{3,8}$/i.test(value) ? value : FALLBACK_COLOR);

// Date helpers 
//date to ISO
const toISODate = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

const dateFromToday = (offsetDays = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date;
};

const today = () => toISODate(dateFromToday());

const parseDate = (value) => new Date(`${value}T12:00:00`);
const daysFromToday = (value) => Math.round((parseDate(value) - parseDate(today())) / 86400000);

//user friendly date labels
function dateLabel(value) {
  if (!value) return 'No date';
  const daysAway = daysFromToday(value);
  if (daysAway === 0) return 'Today';
  if (daysAway === 1) return 'Tomorrow';
  if (daysAway === -1) return 'Yesterday';
  if (daysAway < 0) return `${-daysAway} days late`;
  if (daysAway >= 2 && daysAway <= 6) return `In ${daysAway} days`;
  const due = parseDate(value);
  const sameYear = due.getFullYear() === new Date().getFullYear();
  return due.toLocaleDateString(undefined, { month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) });
}

//  Default data 
function makeDefaultTasks() {
  const due = (offset) => toISODate(dateFromToday(offset));
  return [
    { id: 't1', title: 'Finalize homepage wireframes', description: 'Review the latest designs and share with the team for feedback.', project: 'Website Redesign', dueDate: due(0), priority: 'high', status: 'in-progress', createdAt: 1 },
    { id: 't2', title: 'Prepare Q3 marketing strategy', description: 'Outline the campaign themes, channels, and budget.', project: 'Marketing', dueDate: due(1), priority: 'medium', status: 'todo', createdAt: 2 },
    { id: 't3', title: 'Review mobile app user flows', description: 'Check onboarding and the new account settings screens.', project: 'Mobile App', dueDate: due(3), priority: 'medium', status: 'todo', createdAt: 3 },
    { id: 't4', title: 'Update portfolio case study', description: 'Add the final metrics and a few notes about what we learned.', project: 'Personal', dueDate: due(7), priority: 'low', status: 'completed', createdAt: 4 },
    { id: 't5', title: 'Fix onboarding animation jank', description: 'The welcome carousel drops frames on older phones.', project: 'Mobile App', dueDate: due(-1), priority: 'high', status: 'in-progress', createdAt: 5 },
    { id: 't6', title: 'Draft launch announcement', description: 'One page for the blog, plus a short version for social.', project: 'Marketing', dueDate: due(2), priority: 'high', status: 'todo', createdAt: 6 },
    { id: 't7', title: 'Book a dentist appointment', description: '', project: 'Personal', dueDate: '', priority: 'low', status: 'todo', createdAt: 7 }
  ];
}

//  Persistence (localStorage) 
function load(key, fallback) {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

// Never trust stored data: search every field and drop anything that is not a usable object.
function sanitizeTasks(raw) {
  if (!Array.isArray(raw)) return null;
  return raw
    .filter((item) => item && typeof item === 'object' && item.id != null)
    .map(({ id, title, description, project, dueDate, priority, status, createdAt }) => ({
      id: String(id),
      title: String(title ?? '').trim() || 'Untitled task',
      description: String(description ?? ''),
      project: String(project ?? ''),
      dueDate: /^\d{4}-\d{2}-\d{2}$/.test(dueDate) ? dueDate : '',
      priority: PRIORITIES.includes(priority) ? priority : 'medium',
      status: STATUSES.includes(status) ? status : 'todo',
      createdAt: Number(createdAt) || 0
    }));
}

function sanitizeProjects(raw) {
  if (!Array.isArray(raw)) return null;
  const clean = raw
    .filter((item) => item && typeof item.name === 'string' && item.name.trim())
    .map(({ name, color }) => ({ name: name.trim(), color: safeColor(color) }));
  return clean.length ? clean : null;
}

// saves current tasks and projects to local storage
function save() {
  try {
    localStorage.setItem(TASKS_KEY, JSON.stringify(tasks));
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  } catch {
    toast('Could not save. Browser storage may be full.');
  }
}
// reads or writes current settings like sorting
function readSetting(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}

function writeSetting(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable: ignore */ }
}
// checks if saved sorting option exists in html
function savedSort() {
  const saved = readSetting(SORT_KEY);
  return $$('#sortSelect option').some(({ value }) => value === saved) ? saved : 'due-asc';
}

function setSort(value) {
  $('#sortSelect').value = value;
  writeSetting(SORT_KEY, value);
}

// Loads all data on start 
let tasks = sanitizeTasks(load(TASKS_KEY, null)) || makeDefaultTasks();
let projects = sanitizeProjects(load(PROJECTS_KEY, null)) || clone(DEFAULT_PROJECTS);

//current user selections
let statusFilter = 'all';
let projectFilter = 'all';   // projects act as categories
let dueFilter = 'all';       // smart views: all | today | overdue | week
let priorityFilter = 'all';
let search = '';
let view = readSetting(VIEW_KEY) === 'board' ? 'board' : 'list';
let editingId = null;
let toastTimer;
let toastHandler = null;
let dragId = null;
let lastFocused = null;
let flashId = null;

//small helpers
const projectColor = (name) => projects.find((project) => project.name === name)?.color || FALLBACK_COLOR;
const closeSidebar = () => { $('#sidebar').classList.remove('open'); $('#scrim').classList.remove('show'); };
const newId = () => `task-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const isOpen = (task) => task.status !== 'completed';
const sortValue = () => $('#sortSelect').value;

//finds due date filters per task deadline
function matchesDue(task, filter = dueFilter) {
  if (filter === 'all') return true;
  if (!isOpen(task) || !task.dueDate) return false;
  const days = daysFromToday(task.dueDate);
  if (filter === 'today') return days === 0;
  if (filter === 'overdue') return days < 0;
  if (filter === 'week') return days >= 1 && days <= 7;
  return true;
}

// Rendering 
//creates a project row 
function projectRow({ key, name, color, count }) {
  const main = el('button', { className: 'project-main', type: 'button', attrs: { 'aria-pressed': String(projectFilter === key) } },
    el('i', { className: 'dot' }),
    el('span', { textContent: name }),
    el('span', { className: 'project-count', textContent: count })
  );
  const remove = el('button', {
    className: 'project-delete', type: 'button', title: 'Delete project',
    attrs: { 'aria-label': `Delete ${name}` }
  }, icon('close', 14));
  return el('div', { className: `project${projectFilter === key ? ' active' : ''}`, dataset: { project: key }, vars: { '--c': color } }, main, key === 'all' ? null : remove);
}

//updates project dropdown
function renderProjectOptions() {
  const select = $('#projectSelect');
  const current = select.value;
  select.replaceChildren(...projects.map(({ name }) => el('option', { value: name, textContent: name })));
  if (current && projects.some(({ name }) => name === current)) select.value = current;
}
//renders sidebar projects
function renderProjects() {
  const open = (name) => tasks.filter((task) => isOpen(task) && task.project === name).length;
  $('#projectList').replaceChildren(projectRow({ key: 'all', name: 'All projects', color: '#9cac92', count: tasks.filter(isOpen).length }), ...projects.map(({ name, color }) => projectRow({ key: name, name, color, count: open(name) })));
  renderProjectOptions();
}

//number of tasks in each smart view
function renderViews() {
  const counts = {
    all: tasks.length,
    today: tasks.filter((task) => matchesDue(task, 'today')).length,
    overdue: tasks.filter((task) => matchesDue(task, 'overdue')).length,
    week: tasks.filter((task) => matchesDue(task, 'week')).length
  };
  $$('#smartViews .side-item').forEach((button) => {
    const key = button.dataset.view;
    const active = key === 'all' ? dueFilter === 'all' && projectFilter === 'all' : dueFilter === key;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
    const badge = $('.side-count', button);
    badge.textContent = counts[key];
    badge.classList.toggle('alert', key === 'overdue' && counts.overdue > 0);
  });
}

// Filter (status + project/category + due view + priority + text), then sort.
function visibleTasks() {
  const sort = sortValue();
  const query = search.trim().toLowerCase();
  const filtered = tasks.filter((task) =>
    (statusFilter === 'all' || task.status === statusFilter) &&
    (projectFilter === 'all' || task.project === projectFilter) &&
    (priorityFilter === 'all' || task.priority === priorityFilter) &&
    matchesDue(task) &&
    `${task.title} ${task.description} ${task.project}`.toLowerCase().includes(query)
  );
  if (sort === 'manual') return filtered;   // keep the array order = the user's drag-and-drop order

  //default option
  const byDue = (a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999');
  const sorters = {
    'due-asc': byDue,
    'due-desc': (a, b) => byDue(b, a),
    'created-desc': (a, b) => b.createdAt - a.createdAt,
    priority: (a, b) => PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  };
  return filtered.sort(sorters[sort] || byDue); 
}

//Action button (deleting editing tasks)
const actionButton = (action, label, iconName, extraClass = '') => el('button', {
  className: `task-action${extraClass}`, type: 'button', title: label,
  dataset: { action }, attrs: { 'aria-label': `${label}` }
}, icon(iconName, 16));

//creating a task
function createTask(task) {
  const { id, title, description, project, dueDate, priority, status } = task;
  const done = status === 'completed';
  const days = dueDate ? daysFromToday(dueDate) : null;
  const overdue = !done && days !== null && days < 0;
  const dueToday = !done && days === 0;
  const manual = sortValue() === 'manual';
  const fullDate = dueDate
    ? parseDate(dueDate).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
    : '';
  const priorityName = `${PRIORITY_LABELS[priority]} priority`;

  //create an html element
  return el('article', { className: `task${done ? ' is-done' : ''}${id === flashId ? ' just-added' : ''}`, dataset: { id }, draggable: true },
    el('button', {
      className: `check ${status}`, type: 'button',
      dataset: { action: 'complete' }, attrs: { 'aria-label': `${done ? 'Mark incomplete' : 'Mark complete'}: ${title}` }
    }, done && icon('check', 13)),
    el('div', { className: 'task-body' },
      el('h3', { className: 'task-title', textContent: title }),
      description && el('p', { className: 'task-desc', textContent: description })
    ),
    el('div', { className: 'task-meta' },
      el('span', { className: 'chip project-chip', vars: { '--c': projectColor(project) } },
        el('i', { className: 'dot' }),
        el('span', { textContent: project || 'No project' })
      ),
      el('span', { className: `priority ${priority}`, title: priorityName, attrs: { role: 'img', 'aria-label': priorityName } },
        el('span', { className: 'bars' }, el('i'), el('i'), el('i')),
        el('span', { textContent: PRIORITY_LABELS[priority] })
      ),
      el('button', {
        className: `status ${status}`, type: 'button', title: 'Change status',
        textContent: STATUS_LABELS[status], dataset: { action: 'cycle-status' }
      }),
      el('span', { className: `date${overdue ? ' overdue' : ''}${dueToday ? ' today' : ''}`, title: fullDate },
        icon('calendar', 14),
        el('span', { textContent: dateLabel(dueDate) })
      )
    ),
    el('div', { className: 'task-menu' },
      manual && actionButton('move-up', 'Move up', 'up'),
      manual && actionButton('move-down', 'Move down', 'down'),
      actionButton('cycle-status', `Move to ${STATUS_LABELS[NEXT_STATUS[status]]}`, 'forward', ' only-board'),
      actionButton('edit', 'Edit task', 'edit'),
      actionButton('delete', 'Delete task', 'trash', ' delete')
    )
  );
}

//Columns for board view
function createColumn(status, items) {
  return el('section', { className: `board-col ${status}`, attrs: { 'aria-label': STATUS_LABELS[status] } },
    el('header', { className: 'board-col-head' },
      el('h3', { textContent: STATUS_LABELS[status] }),
      el('span', { className: 'board-count', textContent: items.length })
    ),
    el('div', { className: 'board-col-body', dataset: { status } },
      ...(items.length ? items.map(createTask) : [el('p', { className: 'board-empty', textContent: 'Drop a task here' })])
    )
  );
}

//Updates the main task area 
function renderTasks() {
  const shown = visibleTasks();
  const finished = tasks.filter(({ status }) => status === 'completed').length;
  const filtering = Boolean(search.trim()) || projectFilter !== 'all' || statusFilter !== 'all' || priorityFilter !== 'all' || dueFilter !== 'all';

  let title = 'All projects';
  if (projectFilter !== 'all' && dueFilter !== 'all') title = `${projectFilter}: ${DUE_TITLES[dueFilter].toLowerCase()}`;
  else if (projectFilter !== 'all') title = projectFilter;
  else if (dueFilter !== 'all') title = DUE_TITLES[dueFilter];

  $('#listTitle').textContent = title;
  $('#listCount').textContent = `${shown.length} task${shown.length === 1 ? '' : 's'}`;
  $('#dragHint').classList.toggle('hidden', sortValue() !== 'manual');

  //curernt view selected
  const list = $('#taskList');
  list.className = `task-list ${view === 'board' ? 'board' : 'view-list'}`;
  //show tasks
  if (!shown.length) list.replaceChildren();
  else if (view === 'board') {
    const columns = statusFilter === 'all' ? STATUSES : [statusFilter];
    list.replaceChildren(...columns.map((status) => createColumn(status, shown.filter((task) => task.status === status))));
  } else list.replaceChildren(...shown.map(createTask));

  $('#emptyState').classList.toggle('hidden', shown.length > 0);
  $('#emptyTitle').textContent = filtering ? 'No tasks match.' : 'Nothing planned yet.';
  $('#emptyCopy').textContent = filtering ? 'Clear the filters, or add a new task.' : 'Type a task in the bar above, or press N.';
  $('#clearFilters').classList.toggle('hidden', !filtering);
  $('#clearCompleted').classList.toggle('hidden', finished === 0);

  $$('.view-btn').forEach((button) => {
    const active = button.dataset.viewMode === view;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
}

// hero:
// greeting
function greeting() {
  const hour = new Date().getHours();
  if (hour < 5) return 'Still up?';
  if (hour < 12) return 'Good morning.';
  if (hour < 18) return 'Good afternoon.';
  return 'Good evening.';
}
//status
function statusSentence() {
  if (!tasks.length) return 'Nothing planned yet.';
  const open = tasks.filter(isOpen);
  if (!open.length) return 'Everything is done. Nice work.';
  const urgent = open.filter((task) => task.dueDate && daysFromToday(task.dueDate) <= 0).length;
  const word = (n) => NUMBER_WORDS[n] ?? String(n);
  if (urgent) return `${word(urgent)} ${urgent === 1 ? 'task needs' : 'tasks need'} you today.`;
  return `${word(open.length)} ${open.length === 1 ? 'task' : 'tasks'} ahead, none due today.`;
}
//next task fetch
function nextTask() {
  return tasks.filter(isOpen).sort((a, b) =>
    (a.dueDate || '9999').localeCompare(b.dueDate || '9999') || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
  )[0];
}
//updates greening and status, progress bar and % done in html
function renderHero(counts) {
  const total = tasks.length;
  $('#heroHello').textContent = greeting();
  $('#heroStatus').textContent = statusSentence();

  const flow = $('#flow');
  flow.classList.toggle('is-empty', total === 0);
  flow.dataset.filter = statusFilter;
  $$('.flow-seg', flow).forEach((segment) => {
    const count = counts[segment.dataset.filter];
    segment.style.setProperty('--n', count);
    segment.classList.toggle('has-tasks', count > 0);
    segment.classList.toggle('active', statusFilter === segment.dataset.filter);
    segment.setAttribute('aria-pressed', String(statusFilter === segment.dataset.filter));
    segment.setAttribute('aria-label', `${STATUS_LABELS[segment.dataset.filter]}: ${count}`);
  });

  const percent = total ? Math.round((counts.completed / total) * 100) : 0;
  $('#flowSummary').textContent = total ? `${percent}% done` : '';

  const next = nextTask();
  const button = $('#nextUp');
  button.classList.toggle('hidden', !next);
  if (next) {
    button.dataset.id = next.id;
    const when = !next.dueDate ? '' : daysFromToday(next.dueDate) < 0 ? ', overdue' : `, due ${dateLabel(next.dueDate).toLowerCase()}`;
    button.replaceChildren('Next up: ', el('strong', { textContent: next.title }), when);
  }
}

//main render function: for every update render is called.
function render() {
  renderProjects();
  renderViews();
  const counts = {
    todo: tasks.filter(({ status }) => status === 'todo').length,
    'in-progress': tasks.filter(({ status }) => status === 'in-progress').length,
    completed: tasks.filter(({ status }) => status === 'completed').length
  };
  $('#totalTodo').textContent = counts.todo;
  $('#progressStat').textContent = counts['in-progress'];
  $('#doneStat').textContent = counts.completed;
  $('#filterAllCount').textContent = tasks.length;
  $('#filterTodoCount').textContent = counts.todo;
  $('#filterProgressCount').textContent = counts['in-progress'];
  $('#filterDoneCount').textContent = counts.completed;
  renderHero(counts);
  renderTasks();
}

// Re-rendering replaces the DOM, so put keyboard focus back where the user was.
function focusAction(id, action) {
  const card = $$('.task').find((item) => item.dataset.id === id);
  if (card) $$('[data-action]', card).find((button) => button.dataset.action === action && getComputedStyle(button).display !== 'none')?.focus();
}

function focusProject(key) {
  $$('.project').find((row) => row.dataset.project === key)?.querySelector('.project-main')?.focus();
}

// A new or edited task flashes briefly so it's easy to spot, and scrolls into view if needed
function highlightTask(id) {
  flashId = id;
  render();
  const card = $$('.task').find((item) => item.dataset.id === id);
  card?.scrollIntoView({ block: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
  setTimeout(() => { if (flashId === id) flashId = null; }, 1800);
}

// Toast section:
function hideToast() {
  $('#toast').classList.remove('show');
  toastHandler = null;
}
//toast popup
function toast(message, action) {
  $('#toastMessage').textContent = message;
  const button = $('#toastAction');
  button.classList.toggle('hidden', !action);
  button.textContent = action?.label || '';
  toastHandler = action?.onClick || null;
  $('#toast').classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hideToast, action ? 6000 : 2400);
}

// on undo click, runs this if a handler exists for that undo
$('#toastAction').addEventListener('click', () => {
  const handler = toastHandler;
  hideToast();
  handler?.();
});

// Undo for destructive actions
function withUndo(message, mutate) {
  const snapshot = { tasks: clone(tasks), projects: clone(projects) };
  mutate();
  save();
  render();
  toast(message, {
    label: 'Undo',
    onClick: () => {
      tasks = snapshot.tasks;
      projects = snapshot.projects;
      save();
      render();
      toast('Restored');
    }
  });
}

//confetti animation with random sizes, pos, and colors
function burst(x, y) {
  if (reducedMotion()) return;
  const styles = getComputedStyle(document.documentElement);
  const colors = ['--todo', '--doing', '--done'].map((name) => styles.getPropertyValue(name).trim());
  for (let i = 0; i < 18; i += 1) {
    const size = 6 + Math.random() * 6;
    const piece = el('i', { className: 'confetti', attrs: { 'aria-hidden': 'true' } });
    Object.assign(piece.style, {
      left: `${x - size / 2}px`, top: `${y - size / 2}px`, width: `${size}px`, height: `${size * (Math.random() > 0.5 ? 1 : 0.45)}px`,
      background: colors[i % colors.length], borderRadius: Math.random() > 0.5 ? '50%' : '2px'
    });
    document.body.append(piece);
    const angle = Math.random() * Math.PI * 2;
    const distance = 50 + Math.random() * 70;
    piece.animate([
      { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
      { transform: `translate(${Math.cos(angle) * distance}px, ${Math.sin(angle) * distance + 30}px) rotate(${Math.random() * 540}deg) scale(.5)`, opacity: 0 }
    ], { duration: 650 + Math.random() * 350, easing: 'cubic-bezier(.15, .7, .3, 1)' }).onfinish = () => piece.remove();
  }
}

// Modals 

//finds modal with id 
function openModal(id) {
  lastFocused = document.activeElement;
  $(`#${id}`).classList.remove('hidden');
}

//closes the modal when prompted
function close(id) {
  const modal = $(`#${id}`);
  const wasOpen = !modal.classList.contains('hidden');
  modal.classList.add('hidden');
  if (id === 'taskBackdrop') editingId = null;
  if (wasOpen && lastFocused?.isConnected) lastFocused.focus();
}

//creating and editing tasks
function openTask(task = null) {
  closeSidebar();
  editingId = task?.id || null;
  renderProjectOptions();
  const form = $('#taskForm');
  form.reset();
  if (!task && projectFilter !== 'all') form.elements.project.value = projectFilter;
  if (!task && dueFilter === 'today') form.elements.dueDate.value = today();
  $('#taskModalTitle').textContent = task ? 'Edit task' : 'Create a task';
  $('#saveTaskButton').textContent = task ? 'Save changes' : 'Create task';
  if (task) {
    const { title, description = '', dueDate = '', priority = 'medium', project, status = 'todo' } = task;
    Object.entries({ title, description, dueDate, priority, project, status })
      .forEach(([name, value]) => { form.elements[name].value = value; });
  }
  openModal('taskBackdrop');
  form.elements.title.focus();
}

// updating the status of task popup
function updateStatus(task, status, action, origin) {
  task.status = status;
  save();
  render();
  toast(`Moved to ${STATUS_LABELS[status]}`);
  if (status === 'completed' && origin) burst(origin.x, origin.y);
  if (action) focusAction(task.id, action);
}

//  Drag and drop 
// The order of the tasks array is the manual priority order, and save() persists it
// Dropping on a card puts the dragged task in that card's slot (and, on the board, in its column)
// Dropping on an empty part of a column just moves it to that status
function reorderTask(fromId, toId) {
  const from = tasks.findIndex(({ id }) => id === fromId);
  const to = tasks.findIndex(({ id }) => id === toId);
  if (from < 0 || to < 0 || from === to) return false;
  const [moved] = tasks.splice(from, 1);   // take the task out...
  const target = tasks.find(({ id }) => id === toId);
  const changedColumn = view === 'board' && target.status !== moved.status;
  if (changedColumn) moved.status = target.status;
  tasks.splice(tasks.indexOf(target) + (from < to ? 1 : 0), 0, moved);   // ...and put it into the target's slot
  if (!changedColumn) setSort('manual');
  save();
  render();
  toast(changedColumn ? `Moved to ${STATUS_LABELS[moved.status]}` : 'Order updated');
  return changedColumn ? moved.status : true;
}
//moving a task to another status column (removes task and adds to end of new array)
function moveToStatus(id, status) {
  const index = tasks.findIndex((task) => task.id === id);
  if (index < 0 || tasks[index].status === status) return false;
  const [moved] = tasks.splice(index, 1);
  moved.status = status;
  tasks.push(moved);
  save();
  render();
  toast(`Moved to ${STATUS_LABELS[status]}`);
  return true;
}

// with up and down arrays
function moveTask(id, step, action) {
  const task = tasks.find((item) => item.id === id);
  const shown = visibleTasks().filter((item) => view !== 'board' || item.status === task.status);
  const neighbor = shown[shown.findIndex((item) => item.id === id) + step];
  if (neighbor && reorderTask(id, neighbor.id)) focusAction(id, action);
}

const clearDropMarks = () => $$('.dragging, .drop-target, .drop-over').forEach((node) => node.classList.remove('dragging', 'drop-target', 'drop-over'));
const taskList = $('#taskList');

//drag and drop event listeners, when picked up
taskList.addEventListener('dragstart', (event) => {
  const card = event.target.closest?.('.task');
  if (!card) return;
  dragId = card.dataset.id;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', dragId);
  requestAnimationFrame(() => card.classList.add('dragging'));
});

//when dragged over is over another element, checks if its over another task card or at en empty area
taskList.addEventListener('dragover', (event) => {
  if (!dragId) return;
  const card = event.target.closest?.('.task');
  const column = event.target.closest?.('.board-col-body');
  $$('.drop-target, .drop-over').forEach((other) => { if (other !== card && other !== column) other.classList.remove('drop-target', 'drop-over'); });
  if (card && card.dataset.id !== dragId) {
    event.preventDefault();                     // without this the browser refuses the drop
    event.dataTransfer.dropEffect = 'move';
    card.classList.add('drop-target');
  } else if (column && !card) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    column.classList.add('drop-over');
  }
});
//when an task leaves a valid drop area, simply removes the visuals that it can be dropped there
taskList.addEventListener('dragleave', (event) => {
  const zone = event.target.closest?.('.task, .board-col-body');
  if (zone && !zone.contains(event.relatedTarget)) zone.classList.remove('drop-target', 'drop-over');
});
//when dropped, if its over another card, do reorder, else do moveToStatus if dropped to a board col
taskList.addEventListener('drop', (event) => {
  event.preventDefault();
  const card = event.target.closest?.('.task');
  const column = event.target.closest?.('.board-col-body');
  const fromId = dragId;
  dragId = null;                                // reset first: render() removes the dragged node, so 'dragend' may never reach us
  let result = false;
  if (fromId && card && card.dataset.id !== fromId) result = reorderTask(fromId, card.dataset.id);
  else if (fromId && column) result = moveToStatus(fromId, column.dataset.status) && column.dataset.status;
  if (!result) clearDropMarks();
  else if (result === 'completed') burst(event.clientX, event.clientY);
});
//resets id and visuals
taskList.addEventListener('dragend', () => { dragId = null; clearDropMarks(); });

// Forms 
// On submission of a task form
$('#taskForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const data = new FormData(event.currentTarget);
  const fields = {
    title: String(data.get('title')).trim(),
    description: String(data.get('description') || '').trim(),
    dueDate: String(data.get('dueDate') || ''),
    priority: PRIORITIES.includes(data.get('priority')) ? String(data.get('priority')) : 'medium',
    project: String(data.get('project') || projects[0]?.name || ''),
    status: STATUSES.includes(data.get('status')) ? String(data.get('status')) : 'todo'
  };
  if (!fields.title) return toast('Please enter a task name');

  //checks if user is editing or adding a task
  const existing = editingId && tasks.find(({ id }) => id === editingId);
  let id;
  if (existing) { Object.assign(existing, fields); id = existing.id; }
  else { id = newId(); tasks.unshift({ id, ...fields, createdAt: Date.now() }); }

  save(); close('taskBackdrop'); highlightTask(id);
  toast(existing ? 'Changes saved' : 'Task created');
});
// on submission of a project form
$('#projectForm').addEventListener('submit', (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(form);
  const name = String(data.get('name')).trim();
  if (!name) return toast('Please enter a project name');
  if (projects.some((project) => project.name.toLowerCase() === name.toLowerCase())) return toast('Project already exists');
  projects.push({ name, color: safeColor(String(data.get('color'))) });
  save(); render(); form.reset(); close('projectBackdrop'); toast('Project created');
});

// Quick add task, recv all default values and current project 
const quickInput = $('#quickInput');
quickInput.addEventListener('input', () => $('#quickAdd').classList.toggle('has-text', quickInput.value.trim() !== ''));

$('#quickAdd').addEventListener('submit', (event) => {
  event.preventDefault();
  const title = quickInput.value.trim();
  if (!title) return;
  const id = newId();
  tasks.unshift({
    id, title, description: '',
    dueDate: dueFilter === 'today' ? today() : '',
    priority: 'medium',
    project: projectFilter !== 'all' ? projectFilter : projects[0]?.name || '',
    status: 'todo',
    createdAt: Date.now()
  });
  if (statusFilter === 'completed' || statusFilter === 'in-progress') { statusFilter = 'all'; setActiveStatusButton('all'); }
  quickInput.value = '';
  $('#quickAdd').classList.remove('has-text');
  save(); highlightTask(id); toast('Task created');
});

// Quick due-date buttons in the task form
$$('.quick-dates .chip-button').forEach((button) => button.addEventListener('click', () => {
  const { offset } = button.dataset;
  $('#dueInput').value = offset === '' ? '' : toISODate(dateFromToday(Number(offset)));
}));

// Click handling for each task click
taskList.addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  const task = tasks.find(({ id }) => id === button?.closest('.task')?.dataset.id);
  if (!task) return;
  const { action } = button.dataset;
  const rect = button.getBoundingClientRect();
  const origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };

  if (action === 'complete') updateStatus(task, task.status === 'completed' ? 'todo' : 'completed', action, origin);
  else if (action === 'cycle-status') updateStatus(task, NEXT_STATUS[task.status], action, origin);
  else if (action === 'edit') openTask(task);
  else if (action === 'move-up') moveTask(task.id, -1, action);
  else if (action === 'move-down') moveTask(task.id, 1, action);
  else if (action === 'delete') withUndo('Task deleted', () => { tasks = tasks.filter(({ id }) => id !== task.id); });
});

function deleteProject(name) {
  // Move tasks to "Personal" when possible, otherwise to the first remaining project.
  const fallback = projects.find((project) => project.name === 'Personal' && project.name !== name)
    || projects.find((project) => project.name !== name);
  if (!fallback) return toast('Keep at least one project');
  withUndo(`Project deleted. Its tasks moved to ${fallback.name}.`, () => {
    tasks.forEach((task) => { if (task.project === name) task.project = fallback.name; });
    projects = projects.filter((project) => project.name !== name);
    if (projectFilter === name) projectFilter = 'all';
  });
}
// Click handling for each project click
$('#projectList').addEventListener('click', (event) => {
  const row = event.target.closest('.project');
  if (!row) return;
  const { project: key } = row.dataset;
  if (event.target.closest('.project-delete')) return deleteProject(key);
  projectFilter = projectFilter === key ? 'all' : key;
  closeSidebar();
  render();
  focusProject(key);
});

// on next up click
$('#nextUp').addEventListener('click', (event) => {
  const task = tasks.find(({ id }) => id === event.currentTarget.dataset.id);
  if (task) openTask(task);
});

// Filters, sorting, search, view 
//Current active status filder
function setActiveStatusButton(filter) {
  $$('.filter-btn').forEach((button) => button.classList.toggle('active', button.dataset.filter === filter));
}
//updates status filter and renders
function setStatusFilter(filter) {
  statusFilter = filter;
  setActiveStatusButton(filter);
  render();
}
// click listeners for each status button connected to flow bar
$$('.filter-btn').forEach((button) => button.addEventListener('click', () => setStatusFilter(button.dataset.filter)));
//for flow bar
$$('.flow-seg').forEach((segment) => segment.addEventListener('click', () => {
  setStatusFilter(statusFilter === segment.dataset.filter ? 'all' : segment.dataset.filter);
  segment.focus();
}));

// swtiching views:
function setView(mode) {
  view = mode;
  writeSetting(VIEW_KEY, mode);
  render();
}
//connects button to setView()
$$('.view-btn').forEach((button) => button.addEventListener('click', () => setView(button.dataset.viewMode)));
// Buttons for priority, sorting, and searching filters
$('#priorityFilter').addEventListener('change', ({ target }) => { priorityFilter = target.value; render(); });
$('#sortSelect').addEventListener('change', ({ target }) => { setSort(target.value); render(); });
$('#searchInput').addEventListener('input', ({ target }) => { search = target.value; render(); });

function clearFilters() {
  projectFilter = 'all'; statusFilter = 'all'; dueFilter = 'all'; priorityFilter = 'all'; search = '';
  $('#searchInput').value = '';
  $('#priorityFilter').value = 'all';
  setActiveStatusButton('all');
}
$('#clearFilters').addEventListener('click', () => { clearFilters(); render(); });

// Buttons 
// connects remaining html buttons to js
['#newTask', '#introNewTask', '#emptyNewTask'].forEach((selector) => $(selector).addEventListener('click', () => openTask()));
$('#addProject').addEventListener('click', () => { closeSidebar(); openModal('projectBackdrop'); $('#projectForm').elements.name.focus(); });
$('#settingsButton').addEventListener('click', () => { closeSidebar(); openModal('settingsBackdrop'); });
//side bar buttons
const mobileMenu = $('#mobileMenu');
if (mobileMenu) mobileMenu.addEventListener('click', () => { $('#sidebar').classList.add('open'); $('#scrim').classList.add('show'); });
const scrim = $('#scrim');
if (scrim) scrim.addEventListener('click', closeSidebar);
//closing modal buttons:
$$('[data-close]').forEach((button) => button.addEventListener('click', () => close(button.dataset.close)));

// Close a modal only when the click both started and ended on the backdrop
$$('.modal-backdrop').forEach((backdrop) => {
  let pressedOnBackdrop = false;
  backdrop.addEventListener('mousedown', (event) => { pressedOnBackdrop = event.target === backdrop; });
  backdrop.addEventListener('click', (event) => { if (pressedOnBackdrop && event.target === backdrop) close(backdrop.id); });
});

//  Keyboard shortcuts
document.addEventListener('keydown', (event) => {
  const key = (event.key || '').toLowerCase();           
  const typing = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);
  const openModalEl = $$('.modal-backdrop').find((modal) => !modal.classList.contains('hidden'));

  if (key === 'escape') { closeSidebar(); return $$('.modal-backdrop').forEach(({ id }) => close(id)); }

  if (key === 'tab' && openModalEl) {                    // keep Tab inside the open modal
    const focusable = $$('button, input, select, textarea', openModalEl).filter((node) => !node.disabled);
    const [first] = focusable;
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    return;
  }
  if ((event.metaKey || event.ctrlKey) && key === 'k') { event.preventDefault(); $('#searchInput').focus(); return; }

  const plain = !typing && !openModalEl && !event.ctrlKey && !event.metaKey && !event.altKey;
  if (!plain) return;
  if (key === 'n') { event.preventDefault(); openTask(); }
  else if (key === '/') { event.preventDefault(); $('#searchInput').focus(); }
  else if (key === 'v') setView(view === 'board' ? 'list' : 'board');
});

// Footer actions 
$('#clearCompleted').addEventListener('click', () => {
  const count = tasks.filter(({ status }) => status === 'completed').length;
  if (!count) return;
  withUndo(`Cleared ${count} completed task${count === 1 ? '' : 's'}`, () => { tasks = tasks.filter(({ status }) => status !== 'completed'); });
});

$('#resetDataButton').addEventListener('click', () => {
  if (!confirm('Clear every task in this workspace? This cannot be undone.')) return;
  tasks = [];
  clearFilters();
  save(); render(); close('settingsBackdrop'); toast('All tasks cleared');
});

$('#loadSampleButton').addEventListener('click', () => {
  if (!confirm('Load the sample tasks? This will replace the current task list.')) return;
  tasks = makeDefaultTasks();
  const existingNames = new Set(projects.map(({ name }) => name.toLowerCase()));
  projects.push(...clone(DEFAULT_PROJECTS).filter(({ name }) => !existingNames.has(name.toLowerCase())));
  clearFilters();
  setSort('due-asc');
  save(); render(); close('settingsBackdrop'); toast('Sample tasks loaded');
});

// Keep several open tabs in sync 
window.addEventListener('storage', ({ key }) => {
  if (key !== null && key !== TASKS_KEY && key !== PROJECTS_KEY) return;
  tasks = sanitizeTasks(load(TASKS_KEY, null)) || tasks;
  projects = sanitizeProjects(load(PROJECTS_KEY, null)) || projects;
  if (projectFilter !== 'all' && !projects.some(({ name }) => name === projectFilter)) projectFilter = 'all';
  render();
});

// Start 
$('#dateLabel').textContent = new Intl.DateTimeFormat(undefined, { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date());
$('#sortSelect').value = savedSort();
render();