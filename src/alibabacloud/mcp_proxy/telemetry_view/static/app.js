(function() {
'use strict';

// === Client Logos (SVG data URIs) ===
const CLIENT_LOGOS = {
    'claude-code': '<svg viewBox="0 0 24 24" fill="none"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15l-4-4 1.41-1.41L11 14.17l6.59-6.59L19 9l-8 8z" fill="#D97706"/></svg>',
    'vscode': '<svg viewBox="0 0 24 24"><path d="M17.583 2.247l-5.375 4.94L6.792 3.06 2 5.12v13.76l4.792 2.06 5.416-4.127 5.375 4.94L22 19.693V4.307l-4.417-2.06zM6.792 15.5V8.5l4.208 3.5-4.208 3.5zm10.791 1.307L13.5 12l4.083-4.807v9.614z" fill="#007ACC"/></svg>',
    'copilot-cli': '<svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 100 20 10 10 0 000-20zm0 3a3 3 0 110 6 3 3 0 010-6zm-5 11.5a7.5 7.5 0 0110 0" fill="none" stroke="#6e40c9" stroke-width="2"/></svg>',
    'codex': '<svg viewBox="0 0 24 24"><path d="M22.282 9.821a5.985 5.985 0 00-.516-4.91 6.046 6.046 0 00-6.51-2.9A6.065 6.065 0 0012 1.002a6.06 6.06 0 00-4.489 2.01 6.04 6.04 0 00-4.005 2.921 6.063 6.063 0 00.735 7.098 5.98 5.98 0 00.516 4.911 6.04 6.04 0 006.51 2.9A6.06 6.06 0 0012 22.998a6.06 6.06 0 004.489-2.01 6.04 6.04 0 004.005-2.92 6.06 6.06 0 00-.735-7.098" fill="#10a37f"/></svg>',
    'qoderwork': '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="none" stroke="#6366f1" stroke-width="2"/><path d="M8 12h8M12 8v8" stroke="#6366f1" stroke-width="2" stroke-linecap="round"/></svg>',
};

// === State ===
let currentPage = 1;
let currentFilters = { client: '', q: '', start_time: '', end_time: '' };
let eventSource = null;

// === Theme ===
function initTheme() {
    const saved = localStorage.getItem('telemetry-theme') || 'light';
    document.documentElement.setAttribute('data-theme', saved === 'dark' ? 'dark' : '');
    document.getElementById('theme-toggle').addEventListener('click', toggleTheme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? '' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('telemetry-theme', next || 'light');
}

// === Router ===
function route() {
    const hash = window.location.hash || '#/';
    const app = document.getElementById('app');

    if (hash.startsWith('#/trace/')) {
        const parts = hash.slice(8).split('/');
        const client = decodeURIComponent(parts[0]);
        const sessionId = parts.slice(1).join('/');
        renderTraceDetail(app, client, sessionId);
    } else {
        renderSessionList(app);
    }
}

// === Session List ===
async function renderSessionList(container) {
    container.innerHTML = '<div class="loading">Loading sessions...</div>';

    const params = new URLSearchParams({
        page: currentPage,
        page_size: 20,
        ...Object.fromEntries(Object.entries(currentFilters).filter(([_, v]) => v))
    });

    try {
        const resp = await fetch('/api/sessions?' + params);
        const data = await resp.json();
        container.innerHTML = buildSessionListHTML(data);
        bindSessionListEvents(container);
    } catch (err) {
        container.innerHTML = '<div class="loading">Error loading sessions: ' + err.message + '</div>';
    }
}

function buildSessionListHTML(data) {
    let html = `
        <div class="filter-bar">
            <select id="filter-client">
                <option value="">All Clients</option>
                <option value="claude-code">Claude Code</option>
                <option value="vscode">VS Code</option>
                <option value="copilot-cli">Copilot CLI</option>
                <option value="codex">Codex</option>
                <option value="qoderwork">Qoderwork</option>
            </select>
            <input type="text" id="filter-search" placeholder="Search prompts, tools..." value="${escapeHtml(currentFilters.q)}">
            <input type="datetime-local" id="filter-start" title="Start time">
            <input type="datetime-local" id="filter-end" title="End time">
        </div>
        <div class="session-list">
    `;

    if (data.sessions.length === 0) {
        html += '<div class="loading">No sessions found</div>';
    }

    for (const session of data.sessions) {
        const logo = CLIENT_LOGOS[session.client] || CLIENT_LOGOS['qoderwork'];
        const startLocal = formatTime(session.start_time);
        const lastLocal = formatTime(session.last_activity);
        const errorBadge = session.has_errors ? '<span class="error-badge">errors</span>' : '';

        html += `
            <div class="session-card" data-client="${escapeHtml(session.client)}" data-session="${escapeHtml(session.session_id)}">
                <div class="client-logo">${logo}</div>
                <div class="card-body">
                    <div class="card-title">
                        ${escapeHtml(session.client)}
                        <span style="color:var(--text-tertiary);font-weight:400;font-size:12px">${escapeHtml(session.session_id.slice(0, 8))}...</span>
                        ${errorBadge}
                    </div>
                    <div class="card-subtitle">Started: ${startLocal} &nbsp;|&nbsp; Last: ${lastLocal} &nbsp;|&nbsp; ${session.span_count} spans, ${session.turn_count} turns</div>
                    <div class="card-preview">${escapeHtml(session.first_prompt_preview)}</div>
                </div>
            </div>
        `;
    }

    html += '</div>';
    html += buildPaginationHTML(data.total, data.page, data.page_size);
    return html;
}

function buildPaginationHTML(total, page, pageSize) {
    const totalPages = Math.ceil(total / pageSize);
    if (totalPages <= 1) return '';

    let html = '<div class="pagination">';
    html += `<button ${page <= 1 ? 'disabled' : ''} data-page="${page - 1}">&lt; Prev</button>`;

    for (let i = 1; i <= Math.min(totalPages, 7); i++) {
        html += `<button class="${i === page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    html += `<button ${page >= totalPages ? 'disabled' : ''} data-page="${page + 1}">Next &gt;</button>`;
    html += '</div>';
    return html;
}

function bindSessionListEvents(container) {
    container.querySelectorAll('.session-card').forEach(card => {
        card.addEventListener('click', () => {
            const client = card.dataset.client;
            const session = card.dataset.session;
            window.location.hash = '#/trace/' + encodeURIComponent(client) + '/' + session;
        });
    });

    const clientSelect = container.querySelector('#filter-client');
    const searchInput = container.querySelector('#filter-search');
    const startInput = container.querySelector('#filter-start');
    const endInput = container.querySelector('#filter-end');

    if (clientSelect) {
        clientSelect.value = currentFilters.client;
        clientSelect.addEventListener('change', () => {
            currentFilters.client = clientSelect.value;
            currentPage = 1;
            renderSessionList(container);
        });
    }

    let searchTimeout;
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                currentFilters.q = searchInput.value;
                currentPage = 1;
                renderSessionList(container);
            }, 300);
        });
    }

    if (startInput) {
        startInput.addEventListener('change', () => {
            currentFilters.start_time = startInput.value ? new Date(startInput.value).toISOString() : '';
            currentPage = 1;
            renderSessionList(container);
        });
    }

    if (endInput) {
        endInput.addEventListener('change', () => {
            currentFilters.end_time = endInput.value ? new Date(endInput.value).toISOString() : '';
            currentPage = 1;
            renderSessionList(container);
        });
    }

    container.querySelectorAll('.pagination button').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page && !btn.disabled) {
                currentPage = page;
                renderSessionList(container);
            }
        });
    });
}

// === Trace Detail ===
async function renderTraceDetail(container, client, sessionId) {
    container.innerHTML = '<div class="loading">Loading trace...</div>';

    try {
        const resp = await fetch(`/api/sessions/${encodeURIComponent(client)}/${encodeURIComponent(sessionId)}`);
        if (!resp.ok) {
            container.innerHTML = '<div class="loading">Session not found</div>';
            return;
        }
        const data = await resp.json();
        container.innerHTML = buildTraceDetailHTML(data);
        bindTraceDetailEvents(container, data);
    } catch (err) {
        container.innerHTML = '<div class="loading">Error: ' + err.message + '</div>';
    }
}

function buildTraceDetailHTML(data) {
    const logo = CLIENT_LOGOS[data.client] || CLIENT_LOGOS['qoderwork'];
    const flatSpans = flattenTree(data.spans);
    const timeRange = getTimeRange(flatSpans);

    let html = `
        <div class="trace-header">
            <button class="back-btn" onclick="window.location.hash='#/'">&larr; Back</button>
            <span style="display:inline-flex;align-items:center;gap:8px">
                <span style="width:24px;height:24px">${logo}</span>
                <strong>${escapeHtml(data.client)}</strong>
                <span style="color:var(--text-secondary);font-size:13px">${escapeHtml(data.session_id)}</span>
            </span>
        </div>
        <div class="trace-layout">
            <div class="trace-tree" id="trace-tree">
                ${buildTreeHTML(data.spans, 0)}
            </div>
            <div class="trace-timeline" id="trace-timeline">
                <div class="timeline-scale">${buildTimeScale(timeRange)}</div>
                ${buildTimelineHTML(flatSpans, timeRange)}
            </div>
        </div>
        <div class="detail-panel" id="detail-panel" style="display:none">
            <div class="detail-panel-header">
                <span id="detail-title">Span Detail</span>
            </div>
            <div class="detail-panel-body" id="detail-body"></div>
        </div>
    `;
    return html;
}

function buildTreeHTML(spans, depth) {
    let html = '';
    for (const span of spans) {
        const hasChildren = span.children && span.children.length > 0;
        const indent = depth * 20;
        const icon = getSpanIcon(span);
        const label = getSpanLabel(span);
        const duration = span.duration_ms != null ? formatDuration(span.duration_ms) : '';
        const statusClass = span.status === 'failure' ? 'failure' : (span.status === 'success' ? 'success' : '');

        html += `
            <div class="span-item" data-span-id="${escapeHtml(span.span_id)}" style="padding-left:${12 + indent}px">
                <span class="expand-btn">${hasChildren ? '&#9660;' : '&nbsp;'}</span>
                <span class="span-icon" style="color:${getSpanColor(span)}">${icon}</span>
                <span class="span-label">${escapeHtml(label)}</span>
                ${statusClass ? `<span class="span-status-badge ${statusClass}">${span.status}</span>` : ''}
                ${duration ? `<span class="span-duration">${duration}</span>` : ''}
            </div>
        `;
        if (hasChildren) {
            html += `<div class="span-children" data-parent="${escapeHtml(span.span_id)}">`;
            html += buildTreeHTML(span.children, depth + 1);
            html += '</div>';
        }
    }
    return html;
}

function buildTimelineHTML(flatSpans, timeRange) {
    if (!timeRange.duration) return '';
    let html = '';
    for (const span of flatSpans) {
        const start = parseTimestamp(span.start_timestamp);
        const end = parseTimestamp(span.end_timestamp);
        const left = ((start - timeRange.start) / timeRange.duration) * 100;
        const width = Math.max(((end - start) / timeRange.duration) * 100, 0.5);
        const eventClass = span.status === 'failure' ? 'status-failure' : 'event-' + span.event;

        html += `
            <div class="timeline-row">
                <div class="timeline-bar ${eventClass}" data-span-id="${escapeHtml(span.span_id)}"
                     style="left:${left}%;width:${width}%"
                     title="${escapeHtml(getSpanLabel(span))} (${formatDuration(span.duration_ms)})"></div>
            </div>
        `;
    }
    return html;
}

function buildTimeScale(timeRange) {
    if (!timeRange.duration) return '';
    const totalSec = timeRange.duration / 1000;
    const marks = 5;
    let scale = '';
    for (let i = 0; i <= marks; i++) {
        const sec = (totalSec * i / marks).toFixed(1);
        scale += sec + 's' + (i < marks ? '  |  ' : '');
    }
    return scale;
}

function bindTraceDetailEvents(container, data) {
    const flatSpans = flattenTree(data.spans);
    const spanMap = {};
    for (const s of flatSpans) spanMap[s.span_id] = s;

    container.querySelectorAll('.span-item, .timeline-bar').forEach(el => {
        el.addEventListener('click', (e) => {
            const spanId = el.dataset.spanId;
            if (!spanId || !spanMap[spanId]) return;

            container.querySelectorAll('.span-item.selected').forEach(s => s.classList.remove('selected'));
            const treeItem = container.querySelector(`.span-item[data-span-id="${spanId}"]`);
            if (treeItem) treeItem.classList.add('selected');

            showSpanDetail(container, spanMap[spanId]);
        });
    });

    container.querySelectorAll('.span-item .expand-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const item = btn.closest('.span-item');
            const spanId = item.dataset.spanId;
            const children = container.querySelector(`.span-children[data-parent="${spanId}"]`);
            if (children) {
                const hidden = children.style.display === 'none';
                children.style.display = hidden ? '' : 'none';
                btn.innerHTML = hidden ? '&#9660;' : '&#9654;';
            }
        });
    });
}

function showSpanDetail(container, span) {
    const panel = container.querySelector('#detail-panel');
    const title = container.querySelector('#detail-title');
    const body = container.querySelector('#detail-body');
    panel.style.display = '';

    title.textContent = getSpanLabel(span);
    let html = `
        <div class="detail-section">
            <div class="detail-section-title">Info</div>
            <table style="font-size:13px;width:100%">
                <tr><td style="color:var(--text-secondary);width:120px">Event</td><td>${escapeHtml(span.event)}</td></tr>
                <tr><td style="color:var(--text-secondary)">Span ID</td><td style="font-family:var(--font-mono);font-size:12px">${escapeHtml(span.span_id)}</td></tr>
                <tr><td style="color:var(--text-secondary)">Start</td><td>${formatTime(span.start_timestamp)}</td></tr>
                <tr><td style="color:var(--text-secondary)">End</td><td>${formatTime(span.end_timestamp)}</td></tr>
                ${span.duration_ms != null ? `<tr><td style="color:var(--text-secondary)">Duration</td><td>${formatDuration(span.duration_ms)}</td></tr>` : ''}
                ${span.status ? `<tr><td style="color:var(--text-secondary)">Status</td><td><span class="span-status-badge ${span.status}">${span.status}</span></td></tr>` : ''}
                ${span.error_message ? `<tr><td style="color:var(--text-secondary)">Error</td><td style="color:var(--span-error)">${escapeHtml(span.error_message)}</td></tr>` : ''}
                ${span.request_id ? `<tr><td style="color:var(--text-secondary)">Request ID</td><td style="font-family:var(--font-mono);font-size:12px">${escapeHtml(span.request_id)}</td></tr>` : ''}
                ${span.tool_name ? `<tr><td style="color:var(--text-secondary)">Tool</td><td>${escapeHtml(span.tool_name)}</td></tr>` : ''}
                ${span.skill_name ? `<tr><td style="color:var(--text-secondary)">Skill</td><td>${escapeHtml(span.skill_name)}</td></tr>` : ''}
                ${span.stop_reason ? `<tr><td style="color:var(--text-secondary)">Stop Reason</td><td>${escapeHtml(span.stop_reason)}</td></tr>` : ''}
            </table>
        </div>
    `;

    if (span.prompt) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Prompt</div>
                <div class="detail-json">${escapeHtml(span.prompt)}</div>
            </div>
        `;
    }

    if (span.tool_input) {
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Input</div>
                <div class="detail-json">${escapeHtml(JSON.stringify(span.tool_input, null, 2))}</div>
            </div>
        `;
    }

    if (span.tool_response != null) {
        const truncatedWarning = span.truncated ? '<div class="truncated-warning">Response truncated (>64KB)</div>' : '';
        const responseText = typeof span.tool_response === 'string'
            ? span.tool_response
            : JSON.stringify(span.tool_response, null, 2);
        html += `
            <div class="detail-section">
                <div class="detail-section-title">Response</div>
                ${truncatedWarning}
                <div class="detail-json">${escapeHtml(responseText)}</div>
            </div>
        `;
    }

    body.innerHTML = html;
}

// === Helpers ===
function flattenTree(spans) {
    const result = [];
    function walk(nodes) {
        for (const node of nodes) {
            result.push(node);
            if (node.children) walk(node.children);
        }
    }
    walk(spans);
    return result;
}

function getTimeRange(spans) {
    if (!spans.length) return { start: 0, end: 0, duration: 0 };
    let min = Infinity, max = -Infinity;
    for (const s of spans) {
        const start = parseTimestamp(s.start_timestamp);
        const end = parseTimestamp(s.end_timestamp);
        if (start < min) min = start;
        if (end > max) max = end;
    }
    return { start: min, end: max, duration: max - min };
}

function parseTimestamp(ts) {
    return ts ? new Date(ts).getTime() : 0;
}

function formatTime(ts) {
    if (!ts) return '-';
    const d = new Date(ts);
    return d.toLocaleString();
}

function formatDuration(ms) {
    if (ms == null) return '';
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    return (ms / 60000).toFixed(1) + 'min';
}

function getSpanLabel(span) {
    if (span.event === 'prompt') return span.prompt ? span.prompt.slice(0, 60) : 'prompt';
    if (span.event === 'tool') return span.tool_name || 'tool';
    if (span.event === 'skill_invocation') return span.skill_name || 'skill';
    if (span.event === 'turn_end') return 'turn_end (' + (span.stop_reason || '') + ')';
    return span.event || 'unknown';
}

function getSpanColor(span) {
    if (span.status === 'failure' || span.stop_reason === 'StopFailure') return 'var(--span-error)';
    if (span.event === 'prompt') return 'var(--span-prompt)';
    if (span.event === 'tool') return 'var(--span-tool)';
    if (span.event === 'skill_invocation') return 'var(--span-skill)';
    if (span.event === 'turn_end') return 'var(--span-turn-end)';
    return 'var(--text-secondary)';
}

function getSpanIcon(span) {
    if (span.event === 'prompt') return '&#128172;';
    if (span.event === 'tool') return '&#128295;';
    if (span.event === 'skill_invocation') return '&#9889;';
    if (span.event === 'turn_end') return '&#127937;';
    return '&#9679;';
}

function escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// === SSE ===
function connectSSE() {
    if (eventSource) eventSource.close();
    eventSource = new EventSource('/api/events');

    eventSource.addEventListener('session_updated', (e) => {
        const data = JSON.parse(e.data);
        if (!window.location.hash || window.location.hash === '#/') {
            renderSessionList(document.getElementById('app'));
        }
    });

    eventSource.addEventListener('new_spans', (e) => {
        const data = JSON.parse(e.data);
        const hash = window.location.hash || '';
        if (hash.includes(data.session_id)) {
            renderTraceDetail(document.getElementById('app'), data.client, data.session_id);
        }
    });

    eventSource.onerror = () => {
        setTimeout(() => connectSSE(), 5000);
    };
}

// === Init ===
function init() {
    initTheme();
    route();
    connectSSE();
    window.addEventListener('hashchange', route);
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

})();
