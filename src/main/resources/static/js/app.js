// GraphMan - Main Application JavaScript

document.addEventListener('DOMContentLoaded', function() {
    // Configure marked.js with custom renderer for code blocks
    const renderer = new marked.Renderer();

    // Custom code block renderer with syntax highlighting
    renderer.code = function(codeOrToken, language, escaped) {
        let code = codeOrToken;
        let lang = language;

        // Handle marked v11+ token object format
        if (typeof codeOrToken === 'object' && codeOrToken !== null) {
            code = codeOrToken.text || codeOrToken.raw || '';
            lang = codeOrToken.lang || '';
        }

        // Ensure code is a string
        code = String(code || '');
        lang = String(lang || '').toLowerCase();

        let highlighted;
        const validLang = lang && hljs.getLanguage(lang);

        try {
            if (validLang) {
                highlighted = hljs.highlight(code, { language: lang }).value;
            } else {
                highlighted = hljs.highlightAuto(code).value;
            }
        } catch (e) {
            console.warn('Highlight error:', e);
            highlighted = code.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }

        const langLabel = lang || 'code';
        // Add "Use Query" button for GraphQL code blocks
        const useQueryBtn = lang === 'graphql'
            ? `<button class="btn-use-query" onclick="useQueryInEditor(this)" title="Use in editor">
                    <i class="bi bi-box-arrow-in-right"></i> Use
               </button>`
            : '';
        return `<div class="code-block-wrapper" data-lang="${lang}">
            <div class="code-block-header">
                <span class="code-lang">${langLabel}</span>
                <div class="code-block-actions">
                    ${useQueryBtn}
                    <button class="btn-copy-code" onclick="copyCodeBlock(this)" title="Copy code">
                        <i class="bi bi-clipboard"></i>
                    </button>
                </div>
            </div>
            <pre><code class="hljs language-${lang}">${highlighted}</code></pre>
        </div>`;
    };

    // Custom inline code renderer
    renderer.codespan = function(codeOrToken) {
        let code = codeOrToken;

        // Handle marked v11+ token object format
        if (typeof codeOrToken === 'object' && codeOrToken !== null) {
            code = codeOrToken.text || codeOrToken.raw || '';
        }

        // Ensure code is a string and escape HTML
        code = String(code || '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        return `<code class="inline-code">${code}</code>`;
    };

    // Apply custom renderer
    marked.use({ renderer: renderer });

    // Additional marked options
    marked.setOptions({
        breaks: true,
        gfm: true
    });

    console.log('Marked.js configured with custom renderer');

    // GraphQL Beautifier function
    function beautifyGraphQL(query) {
        if (!query || !query.trim()) return query;

        let result = '';
        let indent = 0;
        let inString = false;
        let stringChar = '';
        const indentStr = '  ';

        // Remove existing whitespace normalization
        query = query.replace(/\s+/g, ' ').trim();

        for (let i = 0; i < query.length; i++) {
            const char = query[i];
            const prevChar = i > 0 ? query[i - 1] : '';
            const nextChar = i < query.length - 1 ? query[i + 1] : '';

            // Handle strings
            if ((char === '"' || char === "'") && prevChar !== '\\') {
                if (!inString) {
                    inString = true;
                    stringChar = char;
                } else if (char === stringChar) {
                    inString = false;
                }
                result += char;
                continue;
            }

            if (inString) {
                result += char;
                continue;
            }

            // Handle braces
            if (char === '{') {
                result += ' {\n';
                indent++;
                result += indentStr.repeat(indent);
            } else if (char === '}') {
                indent--;
                result = result.trimEnd() + '\n' + indentStr.repeat(indent) + '}';
            } else if (char === '(') {
                result += '(';
            } else if (char === ')') {
                result += ')';
            } else if (char === ',') {
                result += ',\n' + indentStr.repeat(indent);
            } else if (char === ':') {
                result += ': ';
            } else if (char === ' ') {
                // Skip extra spaces, add one if needed
                if (result.length > 0 && !result.endsWith(' ') && !result.endsWith('\n') &&
                    !result.endsWith('(') && !result.endsWith(':') && nextChar !== ')' && nextChar !== '{') {
                    result += ' ';
                }
            } else {
                result += char;
            }
        }

        // Clean up extra whitespace
        result = result
            .replace(/\n\s*\n/g, '\n')
            .replace(/{\s+}/g, '{ }')
            .replace(/\(\s+/g, '(')
            .replace(/\s+\)/g, ')')
            .replace(/:\s+/g, ': ')
            .trim();

        return result;
    }

    // Extract field names from GraphQL query for schema highlighting
    function extractFieldsFromQuery(query) {
        const fields = new Set();
        if (!query) return fields;

        // Simple regex to extract field names (words followed by { or : or just standalone)
        const fieldPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*(?:[({:]|\s|$)/g;
        let match;
        while ((match = fieldPattern.exec(query)) !== null) {
            const field = match[1];
            // Exclude GraphQL keywords
            if (!['query', 'mutation', 'subscription', 'fragment', 'on', 'true', 'false', 'null'].includes(field.toLowerCase())) {
                fields.add(field);
            }
        }
        return fields;
    }

    // Initialize CodeMirror for query editor
    const queryEditor = CodeMirror.fromTextArea(document.getElementById('queryEditor'), {
        mode: 'javascript',
        theme: 'dracula',
        lineNumbers: true,
        tabSize: 2,
        autoCloseBrackets: true,
        matchBrackets: true,
        placeholder: 'Enter your GraphQL query here...'
    });
    queryEditor.setValue('{\n  \n}');
    // Store reference for global access (used by useQueryInEditor)
    window.graphManQueryEditor = queryEditor;

    // Track query changes to update schema highlighting
    let schemaData = null;
    let schemaTypesMap = {}; // Map of type name -> type object for drill-down
    let expandedTypes = new Set(); // Track which nested types are expanded
    let currentSearchTerm = ''; // Current search filter for schema
    let docsHistory = []; // Breadcrumb history for docs navigation

    queryEditor.on('change', debounce(function() {
        if (schemaData) {
            updateSchemaHighlighting();
        }
    }, 300));

    function debounce(func, wait) {
        let timeout;
        return function(...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), wait);
        };
    }

    // Initialize CodeMirror for response viewer
    const responseViewer = CodeMirror.fromTextArea(document.getElementById('responseViewer'), {
        mode: 'javascript',
        theme: 'dracula',
        lineNumbers: true,
        readOnly: true
    });

    // State
    let currentRequestId = null;
    let chatHistory = [];
    let globalSettings = loadGlobalSettings();

    // Global Settings Management
    function loadGlobalSettings() {
        try {
            const saved = localStorage.getItem('graphman_global_settings');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (e) {
            console.error('Failed to load global settings:', e);
        }
        return {
            url: '',
            headers: {},
            auth: {
                type: 'NONE',
                bearerToken: '',
                basicUsername: '',
                basicPassword: '',
                apiKeyHeader: '',
                apiKeyValue: ''
            }
        };
    }

    function saveGlobalSettings() {
        try {
            localStorage.setItem('graphman_global_settings', JSON.stringify(globalSettings));
        } catch (e) {
            console.error('Failed to save global settings:', e);
        }
    }

    function clearGlobalSettings() {
        globalSettings = {
            url: '',
            headers: {},
            auth: {
                type: 'NONE',
                bearerToken: '',
                basicUsername: '',
                basicPassword: '',
                apiKeyHeader: '',
                apiKeyValue: ''
            }
        };
        saveGlobalSettings();
    }

    // DOM Elements
    const urlInput = document.getElementById('urlInput');
    const btnExecute = document.getElementById('btnExecute');
    const btnSave = document.getElementById('btnSave');
    const btnNewRequest = document.getElementById('btnNewRequest');
    const btnRefreshSchema = document.getElementById('btnRefreshSchema');
    const btnAddHeader = document.getElementById('btnAddHeader');
    const authType = document.getElementById('authType');
    const responseTime = document.getElementById('responseTime');
    const schemaTree = document.getElementById('schemaTree');
    const savedRequestsList = document.getElementById('savedRequestsList');
    const saveModal = new bootstrap.Modal(document.getElementById('saveModal'));
    const saveRequestName = document.getElementById('saveRequestName');
    const btnConfirmSave = document.getElementById('btnConfirmSave');
    const chatInput = document.getElementById('chatInput');
    const btnSendChat = document.getElementById('btnSendChat');
    const chatMessages = document.getElementById('chatMessages');
    const variablesInput = document.getElementById('variablesInput');

    // Settings modal elements
    const settingsModal = new bootstrap.Modal(document.getElementById('settingsModal'));
    const btnSettings = document.getElementById('btnSettings');
    const btnSaveSettings = document.getElementById('btnSaveSettings');
    const btnClearSettings = document.getElementById('btnClearSettings');
    const btnAddGlobalHeader = document.getElementById('btnAddGlobalHeader');
    const globalAuthType = document.getElementById('globalAuthType');

    // Build request object from UI, merging with global settings
    function buildRequest() {
        // Start with global headers
        const headers = { ...globalSettings.headers };

        // Override with request-specific headers
        document.querySelectorAll('#headersContainer .header-row').forEach(row => {
            const key = row.querySelector('.header-key').value.trim();
            const value = row.querySelector('.header-value').value.trim();
            if (key) {
                headers[key] = value;
            }
        });

        // Determine auth - use request auth if set, otherwise use global
        const requestAuthType = authType.value;
        let auth;
        if (requestAuthType !== 'NONE') {
            auth = {
                type: requestAuthType,
                bearerToken: document.getElementById('bearerToken').value,
                basicUsername: document.getElementById('basicUsername').value,
                basicPassword: document.getElementById('basicPassword').value,
                apiKeyHeader: document.getElementById('apiKeyHeader').value,
                apiKeyValue: document.getElementById('apiKeyValue').value
            };
        } else if (globalSettings.auth && globalSettings.auth.type !== 'NONE') {
            // Use global auth
            auth = { ...globalSettings.auth };
        } else {
            auth = { type: 'NONE' };
        }

        // Use request URL if set, otherwise use global
        const url = urlInput.value.trim() || globalSettings.url;

        return {
            url: url,
            headers: headers,
            auth: auth,
            query: queryEditor.getValue(),
            variables: variablesInput.value
        };
    }

    // Execute GraphQL query
    async function executeQuery() {
        const request = buildRequest();

        if (!request.url) {
            alert('Please enter a GraphQL endpoint URL');
            return;
        }

        btnExecute.disabled = true;
        btnExecute.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';
        responseTime.textContent = '';

        const startTime = performance.now();

        try {
            const response = await fetch('/api/graphql/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            const data = await response.json();
            const duration = Math.round(performance.now() - startTime);

            responseViewer.setValue(JSON.stringify(data, null, 2));
            responseTime.textContent = `${duration}ms`;
            responseTime.className = data.errors ? 'badge bg-danger' : 'badge bg-success';
        } catch (error) {
            responseViewer.setValue(JSON.stringify({ error: error.message }, null, 2));
            responseTime.textContent = 'Error';
            responseTime.className = 'badge bg-danger';
        } finally {
            btnExecute.disabled = false;
            btnExecute.innerHTML = '<i class="bi bi-play-fill"></i> Execute';
        }
    }

    // Fetch and render schema
    async function refreshSchema() {
        const request = buildRequest();

        if (!request.url) {
            schemaTree.innerHTML = '<p class="text-muted small">Enter URL first</p>';
            return;
        }

        btnRefreshSchema.disabled = true;
        schemaTree.innerHTML = '<div class="text-center"><span class="spinner-border spinner-border-sm"></span> Loading...</div>';

        try {
            const response = await fetch('/api/graphql/introspect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            const schema = await response.json();
            schemaData = schema; // Store for highlighting updates

            // Build types map for drill-down lookups
            schemaTypesMap = {};
            if (schema.types) {
                schema.types.forEach(type => {
                    schemaTypesMap[type.name] = type;
                });
            }
            expandedTypes.clear(); // Reset expanded state on schema refresh

            renderSchema(schema);
        } catch (error) {
            schemaTree.innerHTML = `<p class="text-danger small">Error: ${error.message}</p>`;
        } finally {
            btnRefreshSchema.disabled = false;
        }
    }

    // Update schema highlighting based on current query
    function updateSchemaHighlighting() {
        if (!schemaData) return;
        renderSchema(schemaData, currentSearchTerm);
    }

    // Check if a type or its fields match the search term
    function typeMatchesSearch(type, searchTerm) {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();

        // Check type name
        if (type.name.toLowerCase().includes(term)) return true;

        // Check field names and descriptions
        if (type.fields) {
            for (const field of type.fields) {
                if (field.name.toLowerCase().includes(term)) return true;
                if (field.description && field.description.toLowerCase().includes(term)) return true;
            }
        }

        // Check enum values
        if (type.enumValues) {
            for (const ev of type.enumValues) {
                if (ev.name.toLowerCase().includes(term)) return true;
            }
        }

        // Check input fields
        if (type.inputFields) {
            for (const field of type.inputFields) {
                if (field.name.toLowerCase().includes(term)) return true;
            }
        }

        return false;
    }

    // Render schema tree
    function renderSchema(schema, searchTerm = '') {
        if (!schema.types || schema.types.length === 0) {
            schemaTree.innerHTML = '<p class="text-muted small">No schema available</p>';
            return;
        }

        // Get fields used in current query for highlighting
        const usedFields = extractFieldsFromQuery(queryEditor.getValue());

        // Group types by kind
        const queryType = schema.types.find(t => t.name === schema.queryTypeName);
        const mutationType = schema.types.find(t => t.name === schema.mutationTypeName);
        let otherTypes = schema.types.filter(t =>
            t.name !== schema.queryTypeName &&
            t.name !== schema.mutationTypeName &&
            !t.name.startsWith('__')
        );

        // Filter by search term
        if (searchTerm) {
            otherTypes = otherTypes.filter(t => typeMatchesSearch(t, searchTerm));
        }

        let html = '';

        // Render Query type first (always show if matches or no search)
        if (queryType && (!searchTerm || typeMatchesSearch(queryType, searchTerm))) {
            html += renderType(queryType, 'Query', 'success', false, usedFields, searchTerm);
        }

        // Render Mutation type
        if (mutationType && (!searchTerm || typeMatchesSearch(mutationType, searchTerm))) {
            html += renderType(mutationType, 'Mutation', 'warning', false, usedFields, searchTerm);
        }

        // Render other types (collapsed by default, unless searching)
        otherTypes.forEach(type => {
            html += renderType(type, type.name, 'secondary', !searchTerm, usedFields, searchTerm);
        });

        if (!html) {
            html = '<p class="text-muted small">No matching types found</p>';
        }

        schemaTree.innerHTML = html;
        attachSchemaEventHandlers();
    }

    // Attach event handlers for schema tree interactions
    function attachSchemaEventHandlers() {
        // Add click handlers for collapsible types (top-level type headers)
        schemaTree.querySelectorAll('.schema-type-header').forEach(header => {
            header.addEventListener('click', function(e) {
                // If clicking on type name, show docs instead of collapsing
                if (e.target.classList.contains('schema-type-name')) {
                    e.stopPropagation();
                    const typeName = e.target.textContent;
                    docsHistory = []; // Reset history when starting from schema
                    showTypeDocumentation(typeName);
                    return;
                }
                this.classList.toggle('collapsed');
                const fields = this.nextElementSibling;
                fields.style.display = fields.style.display === 'none' ? 'block' : 'none';
            });
        });

        // Add click handlers for expand toggles ONLY (chevron icon)
        schemaTree.querySelectorAll('.field-expand-toggle').forEach(toggle => {
            toggle.addEventListener('click', function(e) {
                e.stopPropagation();
                const fieldId = this.dataset.fieldId;
                if (expandedTypes.has(fieldId)) {
                    expandedTypes.delete(fieldId);
                } else {
                    expandedTypes.add(fieldId);
                }
                // Re-render schema to reflect expanded state
                renderSchema(schemaData, currentSearchTerm);
            });
        });

        // Add click handlers for expandable type names - show docs, don't expand
        schemaTree.querySelectorAll('.expandable-type').forEach(typeLink => {
            typeLink.addEventListener('click', function(e) {
                e.stopPropagation();
                const typeName = this.dataset.typeName;
                if (typeName) {
                    docsHistory = []; // Reset history when starting from schema
                    showTypeDocumentation(typeName);
                }
            });
        });

        // Add click handlers for field names to show documentation
        schemaTree.querySelectorAll('.schema-field-name').forEach(fieldNameEl => {
            fieldNameEl.addEventListener('click', function(e) {
                e.stopPropagation();
                const field = this.closest('.schema-field');
                if (!field) return;
                const fieldName = field.dataset.fieldName;
                const typeName = field.closest('.schema-type')?.dataset.typeName;
                if (fieldName) {
                    docsHistory = []; // Reset history when starting from schema
                    showFieldDocumentation(typeName, fieldName);
                }
            });
        });
    }

    // Extract the base type name from a GraphQL type string (e.g., "[Product!]!" -> "Product")
    function extractBaseTypeName(typeName) {
        if (!typeName) return null;
        // Remove NonNull (!) and List ([]) wrappers
        return typeName.replace(/[\[\]!]/g, '').trim();
    }

    // Check if a type is expandable (has fields we can drill into)
    function isExpandableType(typeName) {
        const baseName = extractBaseTypeName(typeName);
        if (!baseName) return false;
        const type = schemaTypesMap[baseName];
        if (!type) return false;
        // Expandable if it has fields, inputFields, or is a union/interface
        return (type.fields && type.fields.length > 0) ||
               (type.inputFields && type.inputFields.length > 0) ||
               type.kind === 'UNION' ||
               type.kind === 'INTERFACE';
    }

    // Check if a field matches search term
    function fieldMatchesSearch(field, searchTerm) {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        if (field.name.toLowerCase().includes(term)) return true;
        if (field.description && field.description.toLowerCase().includes(term)) return true;
        return false;
    }

    function renderType(type, displayName, badgeColor, collapsed = false, usedFields = new Set(), searchTerm = '') {
        // Check if type name matches search
        const typeNameMatch = searchTerm && type.name.toLowerCase().includes(searchTerm.toLowerCase());
        const term = searchTerm ? searchTerm.toLowerCase() : '';

        let html = `<div class="schema-type" data-type-name="${type.name}">`;
        html += `<div class="schema-type-header ${collapsed ? 'collapsed' : ''}">`;
        html += `<i class="bi bi-chevron-down"></i>`;
        html += `<span class="schema-type-name">${displayName}</span>`;
        html += `<span class="badge bg-${badgeColor} schema-type-kind">${type.kind}</span>`;
        html += `</div>`;
        html += `<div class="schema-fields" style="display: ${collapsed ? 'none' : 'block'}">`;

        if (type.fields && type.fields.length > 0) {
            // Filter fields when searching (unless type name matches, then show all)
            const fieldsToShow = searchTerm && !typeNameMatch
                ? type.fields.filter(f => fieldMatchesSearch(f, searchTerm))
                : type.fields;
            fieldsToShow.forEach(field => {
                html += renderField(field, usedFields, 0, ''); // Don't pass searchTerm to avoid highlighting
            });
        } else if (type.enumValues && type.enumValues.length > 0) {
            const enumsToShow = searchTerm && !typeNameMatch
                ? type.enumValues.filter(ev => ev.name.toLowerCase().includes(term))
                : type.enumValues;
            enumsToShow.forEach(ev => {
                const isUsed = usedFields.has(ev.name);
                html += `<div class="schema-field ${isUsed ? 'field-used' : ''}" data-field-name="${ev.name}" title="${ev.description || ''}">`;
                html += `<span class="schema-field-name">${ev.name}</span>`;
                html += `</div>`;
            });
        } else if (type.inputFields && type.inputFields.length > 0) {
            const inputFieldsToShow = searchTerm && !typeNameMatch
                ? type.inputFields.filter(f => fieldMatchesSearch(f, searchTerm))
                : type.inputFields;
            inputFieldsToShow.forEach(field => {
                html += renderInputField(field, usedFields, 0, '');
            });
        }

        html += `</div></div>`;
        return html;
    }

    // Render a field with drill-down support
    function renderField(field, usedFields, depth, searchTerm = '') {
        const isUsed = usedFields.has(field.name);
        const nameMatch = searchTerm && field.name.toLowerCase().includes(searchTerm.toLowerCase());
        const argsStr = field.args && field.args.length > 0
            ? field.args.map(a => `${a.name}: ${a.typeName}${a.nonNull ? '!' : ''}`).join(', ')
            : '';
        const baseTypeName = extractBaseTypeName(field.typeName);
        const canExpand = isExpandableType(field.typeName);
        const fieldId = `field-${depth}-${field.name}-${baseTypeName}`;
        const isExpanded = expandedTypes.has(fieldId);

        let html = `<div class="schema-field-container" data-field-id="${fieldId}">`;
        html += `<div class="schema-field ${isUsed ? 'field-used' : ''} ${nameMatch ? 'search-match' : ''}" data-field-name="${field.name}" data-args="${argsStr}" data-description="${(field.description || '').replace(/"/g, '&quot;')}" title="${field.description || ''}" style="padding-left: ${depth * 12}px">`;

        if (canExpand) {
            html += `<span class="field-expand-toggle" data-field-id="${fieldId}" data-type-name="${baseTypeName}">`;
            html += `<i class="bi bi-chevron-${isExpanded ? 'down' : 'right'} expand-icon"></i>`;
            html += `</span>`;
        } else {
            html += `<span class="field-expand-placeholder"></span>`;
        }

        html += `<span class="schema-field-name">${field.name}</span>`;
        if (argsStr) {
            html += `<span class="schema-field-args">(${argsStr})</span>`;
        }
        html += `<span class="schema-field-type">: `;
        if (canExpand) {
            html += `<span class="expandable-type" data-field-id="${fieldId}" data-type-name="${baseTypeName}">${field.typeName}${field.nonNull ? '!' : ''}</span>`;
        } else {
            html += `${field.typeName}${field.nonNull ? '!' : ''}`;
        }
        html += `</span>`;
        html += `</div>`;

        // Render expanded nested fields
        if (isExpanded && canExpand) {
            const nestedType = schemaTypesMap[baseTypeName];
            if (nestedType) {
                html += `<div class="nested-fields">`;
                if (nestedType.fields && nestedType.fields.length > 0) {
                    nestedType.fields.forEach(nestedField => {
                        html += renderField(nestedField, usedFields, depth + 1, searchTerm);
                    });
                } else if (nestedType.inputFields && nestedType.inputFields.length > 0) {
                    nestedType.inputFields.forEach(nestedField => {
                        html += renderInputField(nestedField, usedFields, depth + 1, searchTerm);
                    });
                } else if (nestedType.possibleTypes && nestedType.possibleTypes.length > 0) {
                    // Union or Interface - show possible types
                    html += `<div class="schema-field" style="padding-left: ${(depth + 1) * 12}px; font-style: italic; color: #6c757d;">`;
                    html += `Possible types: ${nestedType.possibleTypes.map(t => t.name).join(', ')}`;
                    html += `</div>`;
                }
                html += `</div>`;
            }
        }

        html += `</div>`;
        return html;
    }

    // Render an input field with drill-down support
    function renderInputField(field, usedFields, depth, searchTerm = '') {
        const isUsed = usedFields.has(field.name);
        const nameMatch = searchTerm && field.name.toLowerCase().includes(searchTerm.toLowerCase());
        const baseTypeName = extractBaseTypeName(field.typeName);
        const canExpand = isExpandableType(field.typeName);
        const fieldId = `input-${depth}-${field.name}-${baseTypeName}`;
        const isExpanded = expandedTypes.has(fieldId);

        let html = `<div class="schema-field-container" data-field-id="${fieldId}">`;
        html += `<div class="schema-field ${isUsed ? 'field-used' : ''} ${nameMatch ? 'search-match' : ''}" data-field-name="${field.name}" data-description="${(field.description || '').replace(/"/g, '&quot;')}" title="${field.description || ''}" style="padding-left: ${depth * 12}px">`;

        if (canExpand) {
            html += `<span class="field-expand-toggle" data-field-id="${fieldId}" data-type-name="${baseTypeName}">`;
            html += `<i class="bi bi-chevron-${isExpanded ? 'down' : 'right'} expand-icon"></i>`;
            html += `</span>`;
        } else {
            html += `<span class="field-expand-placeholder"></span>`;
        }

        html += `<span class="schema-field-name">${field.name}</span>`;
        html += `<span class="schema-field-type">: `;
        if (canExpand) {
            html += `<span class="expandable-type" data-field-id="${fieldId}" data-type-name="${baseTypeName}">${field.typeName}${field.nonNull ? '!' : ''}</span>`;
        } else {
            html += `${field.typeName}${field.nonNull ? '!' : ''}`;
        }
        html += `</span>`;
        html += `</div>`;

        // Render expanded nested fields
        if (isExpanded && canExpand) {
            const nestedType = schemaTypesMap[baseTypeName];
            if (nestedType && nestedType.inputFields && nestedType.inputFields.length > 0) {
                html += `<div class="nested-fields">`;
                nestedType.inputFields.forEach(nestedField => {
                    html += renderInputField(nestedField, usedFields, depth + 1, searchTerm);
                });
                html += `</div>`;
            }
        }

        html += `</div>`;
        return html;
    }

    // Make a type name clickable if it exists in schema
    function makeTypeClickable(typeName) {
        const baseType = extractBaseTypeName(typeName);
        if (baseType && schemaTypesMap[baseType]) {
            // Preserve the original formatting (brackets, exclamation marks)
            const prefix = typeName.match(/^\[*/)?.[0] || '';
            const suffix = typeName.match(/[\]!]*$/)?.[0] || '';
            return `${prefix}<a href="#" class="docs-type-link" data-type="${baseType}">${baseType}</a>${suffix}`;
        }
        return typeName;
    }

    // Render breadcrumb navigation
    function renderBreadcrumbs() {
        if (docsHistory.length === 0) return '';

        let html = '<nav class="docs-breadcrumbs">';
        docsHistory.forEach((item, index) => {
            if (index > 0) {
                html += '<span class="breadcrumb-separator">›</span>';
            }
            if (index < docsHistory.length - 1) {
                // Clickable breadcrumb (not the current item)
                html += `<a href="#" class="breadcrumb-link" data-index="${index}">${item.label}</a>`;
            } else {
                // Current item (not clickable)
                html += `<span class="breadcrumb-current">${item.label}</span>`;
            }
        });
        html += '</nav>';
        return html;
    }

    // Navigate to a breadcrumb
    function navigateToBreadcrumb(index) {
        if (index < 0 || index >= docsHistory.length) return;

        const item = docsHistory[index];
        // Trim history to this point
        docsHistory = docsHistory.slice(0, index);

        // Re-show the documentation (this will add it back to history)
        if (item.type === 'type') {
            showTypeDocumentation(item.name);
        } else if (item.type === 'field') {
            showFieldDocumentation(item.parentType, item.name);
        }
    }

    // Show documentation for a type
    function showTypeDocumentation(typeName) {
        const type = schemaTypesMap[typeName];
        if (!type) return;

        // Add to history if not already the last item
        const lastItem = docsHistory[docsHistory.length - 1];
        if (!lastItem || lastItem.name !== typeName || lastItem.type !== 'type') {
            docsHistory.push({ type: 'type', name: typeName, label: typeName });
        }

        const docsPanel = document.getElementById('schemaDocsPanel');
        let html = `<div class="docs-content">`;
        html += renderBreadcrumbs();
        html += `<h6 class="docs-title">${type.name}</h6>`;
        html += `<span class="badge bg-secondary mb-2">${type.kind}</span>`;

        if (type.description) {
            html += `<p class="docs-description">${type.description}</p>`;
        } else {
            html += `<p class="text-muted small">No description available</p>`;
        }

        // Show fields summary
        if (type.fields && type.fields.length > 0) {
            html += `<h6 class="mt-3">Fields (${type.fields.length})</h6>`;
            html += `<ul class="docs-fields-list">`;
            type.fields.forEach(f => {
                const clickableType = makeTypeClickable(f.typeName + (f.nonNull ? '!' : ''));
                html += `<li><code>${f.name}</code>: ${clickableType}`;
                if (f.description) {
                    html += `<br><small class="text-muted">${f.description}</small>`;
                }
                html += `</li>`;
            });
            html += `</ul>`;
        }

        // Show enum values
        if (type.enumValues && type.enumValues.length > 0) {
            html += `<h6 class="mt-3">Values (${type.enumValues.length})</h6>`;
            html += `<ul class="docs-fields-list">`;
            type.enumValues.forEach(ev => {
                html += `<li><code>${ev.name}</code>`;
                if (ev.description) {
                    html += `<br><small class="text-muted">${ev.description}</small>`;
                }
                html += `</li>`;
            });
            html += `</ul>`;
        }

        // Show input fields
        if (type.inputFields && type.inputFields.length > 0) {
            html += `<h6 class="mt-3">Input Fields (${type.inputFields.length})</h6>`;
            html += `<ul class="docs-fields-list">`;
            type.inputFields.forEach(f => {
                const clickableType = makeTypeClickable(f.typeName + (f.nonNull ? '!' : ''));
                html += `<li><code>${f.name}</code>: ${clickableType}`;
                if (f.description) {
                    html += `<br><small class="text-muted">${f.description}</small>`;
                }
                html += `</li>`;
            });
            html += `</ul>`;
        }

        html += `</div>`;
        docsPanel.innerHTML = html;
        attachDocsEventHandlers();

        // Switch to docs tab
        const docsTab = document.querySelector('a[href="#docsTab"]');
        if (docsTab) {
            bootstrap.Tab.getOrCreateInstance(docsTab).show();
        }
    }

    // Show documentation for a specific field
    function showFieldDocumentation(typeName, fieldName) {
        const type = schemaTypesMap[typeName] || schemaTypesMap[schemaData?.queryTypeName] || schemaTypesMap[schemaData?.mutationTypeName];
        if (!type) return;

        const field = type.fields?.find(f => f.name === fieldName) ||
                      type.inputFields?.find(f => f.name === fieldName);
        if (!field) return;

        // Add to history if not already the last item
        const lastItem = docsHistory[docsHistory.length - 1];
        const displayLabel = `${type.name}.${field.name}`;
        if (!lastItem || lastItem.name !== fieldName || lastItem.type !== 'field' || lastItem.parentType !== type.name) {
            docsHistory.push({ type: 'field', name: fieldName, parentType: type.name, label: displayLabel });
        }

        const docsPanel = document.getElementById('schemaDocsPanel');
        const clickableType = makeTypeClickable(field.typeName + (field.nonNull ? '!' : ''));

        let html = `<div class="docs-content">`;
        html += renderBreadcrumbs();
        html += `<h6 class="docs-title">${field.name}</h6>`;
        html += `<p class="docs-type">${clickableType}</p>`;

        if (field.description) {
            html += `<p class="docs-description">${field.description}</p>`;
        } else {
            html += `<p class="text-muted small">No description available</p>`;
        }

        // Show arguments if any
        if (field.args && field.args.length > 0) {
            html += `<h6 class="mt-3">Arguments (${field.args.length})</h6>`;
            html += `<ul class="docs-args-list">`;
            field.args.forEach(arg => {
                const clickableArgType = makeTypeClickable(arg.typeName + (arg.nonNull ? '!' : ''));
                html += `<li><code>${arg.name}</code>: ${clickableArgType}`;
                if (arg.description) {
                    html += `<br><small class="text-muted">${arg.description}</small>`;
                }
                html += `</li>`;
            });
            html += `</ul>`;
        }

        html += `</div>`;
        docsPanel.innerHTML = html;
        attachDocsEventHandlers();

        // Switch to docs tab
        const docsTab = document.querySelector('a[href="#docsTab"]');
        if (docsTab) {
            bootstrap.Tab.getOrCreateInstance(docsTab).show();
        }
    }

    // Attach click handlers for type links in docs
    function attachDocsEventHandlers() {
        document.querySelectorAll('.docs-type-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const typeName = this.dataset.type;
                if (typeName) {
                    showTypeDocumentation(typeName);
                }
            });
        });

        // Add breadcrumb click handlers
        document.querySelectorAll('.breadcrumb-link').forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const index = parseInt(this.dataset.index);
                navigateToBreadcrumb(index);
            });
        });
    }

    // Save request
    async function saveRequest() {
        const name = saveRequestName.value.trim();
        if (!name) {
            alert('Please enter a request name');
            return;
        }

        const request = buildRequest();
        const savedRequest = {
            id: currentRequestId || crypto.randomUUID(),
            name: name,
            ...request
        };

        try {
            const response = await fetch('/api/requests', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(savedRequest)
            });

            if (response.ok) {
                const saved = await response.json();
                currentRequestId = saved.id;
                saveModal.hide();
                saveRequestName.value = '';
                loadSavedRequests();
            }
        } catch (error) {
            alert('Failed to save request: ' + error.message);
        }
    }

    // Load saved requests
    async function loadSavedRequests() {
        console.log('loadSavedRequests called');
        try {
            const response = await fetch('/api/requests');
            const requests = await response.json();
            console.log('Fetched requests:', requests);

            savedRequestsList.innerHTML = requests.map(req => `
                <div class="list-group-item list-group-item-action d-flex justify-content-between align-items-center saved-request-item ${req.id === currentRequestId ? 'active' : ''}"
                     data-id="${req.id}">
                    <span class="text-truncate">${req.name}</span>
                    <button class="btn btn-sm btn-outline-danger btn-delete-request" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>
            `).join('');

            // Add click handlers
            console.log('Adding click handlers to', savedRequestsList.querySelectorAll('.saved-request-item').length, 'items');
            savedRequestsList.querySelectorAll('.saved-request-item').forEach(item => {
                console.log('Adding handler for item:', item.dataset.id);
                item.addEventListener('click', function(e) {
                    console.log('Click detected on item:', this.dataset.id);
                    if (!e.target.closest('.btn-delete-request')) {
                        loadRequest(this.dataset.id);
                    }
                });

                const deleteBtn = item.querySelector('.btn-delete-request');
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        deleteRequest(item.dataset.id);
                    });
                }
            });
        } catch (error) {
            console.error('Failed to load saved requests:', error);
        }
    }

    // Load a specific request
    async function loadRequest(id) {
        console.log('Loading request:', id);
        try {
            const response = await fetch(`/api/requests/${id}`);
            console.log('Response status:', response.status);
            const request = await response.json();
            console.log('Loaded request:', request);

            currentRequestId = request.id;
            urlInput.value = request.url || '';
            queryEditor.setValue(request.query || '{\n  \n}');
            variablesInput.value = request.variables || '';

            // Load headers
            const headersContainer = document.getElementById('headersContainer');
            headersContainer.innerHTML = '';
            if (request.headers) {
                Object.entries(request.headers).forEach(([key, value]) => {
                    addHeaderRow(key, value);
                });
            }
            if (headersContainer.children.length === 0) {
                addHeaderRow();
            }

            // Load auth
            if (request.auth) {
                authType.value = request.auth.type || 'NONE';
                document.getElementById('bearerToken').value = request.auth.bearerToken || '';
                document.getElementById('basicUsername').value = request.auth.basicUsername || '';
                document.getElementById('basicPassword').value = request.auth.basicPassword || '';
                document.getElementById('apiKeyHeader').value = request.auth.apiKeyHeader || '';
                document.getElementById('apiKeyValue').value = request.auth.apiKeyValue || '';
                updateAuthFields();
            }

            // Update active state
            savedRequestsList.querySelectorAll('.saved-request-item').forEach(item => {
                item.classList.toggle('active', item.dataset.id === id);
            });
        } catch (error) {
            console.error('Failed to load request:', error);
        }
    }

    // Delete a request
    async function deleteRequest(id) {
        if (!confirm('Delete this request?')) return;

        try {
            await fetch(`/api/requests/${id}`, { method: 'DELETE' });
            if (currentRequestId === id) {
                currentRequestId = null;
                newRequest();
            }
            loadSavedRequests();
        } catch (error) {
            alert('Failed to delete request: ' + error.message);
        }
    }

    // New request
    function newRequest() {
        currentRequestId = null;
        urlInput.value = '';
        queryEditor.setValue('{\n  \n}');
        variablesInput.value = '';
        responseViewer.setValue('');
        responseTime.textContent = '';

        document.getElementById('headersContainer').innerHTML = '';
        addHeaderRow();

        authType.value = 'NONE';
        document.getElementById('bearerToken').value = '';
        document.getElementById('basicUsername').value = '';
        document.getElementById('basicPassword').value = '';
        document.getElementById('apiKeyHeader').value = '';
        document.getElementById('apiKeyValue').value = '';
        updateAuthFields();

        savedRequestsList.querySelectorAll('.saved-request-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    // Add header row
    function addHeaderRow(key = '', value = '') {
        const container = document.getElementById('headersContainer');
        const row = document.createElement('div');
        row.className = 'header-row input-group input-group-sm mb-1';
        row.innerHTML = `
            <input type="text" class="form-control header-key" placeholder="Header name" value="${key}">
            <input type="text" class="form-control header-value" placeholder="Header value" value="${value}">
            <button class="btn btn-outline-danger btn-remove-header"><i class="bi bi-x"></i></button>
        `;
        row.querySelector('.btn-remove-header').addEventListener('click', function() {
            row.remove();
        });
        container.appendChild(row);
    }

    // Update auth fields visibility
    function updateAuthFields() {
        const type = authType.value;
        document.getElementById('authBearerFields').style.display = type === 'BEARER_TOKEN' ? 'block' : 'none';
        document.getElementById('authBasicFields').style.display = type === 'BASIC_AUTH' ? 'block' : 'none';
        document.getElementById('authApiKeyFields').style.display = type === 'API_KEY' ? 'block' : 'none';
    }

    // Render markdown content with syntax highlighting
    function renderMarkdown(text, isStreaming = false) {
        try {
            let processedText = text;

            // During streaming, handle incomplete code blocks gracefully
            if (isStreaming) {
                // Check if we have an unclosed code fence
                const fenceMatches = processedText.match(/```/g) || [];
                if (fenceMatches.length % 2 !== 0) {
                    // Add a temporary closing fence for rendering
                    processedText += '\n```';
                }
            }

            // Use marked with our custom renderer
            const html = marked.parse(processedText);

            return html;
        } catch (e) {
            console.error('Markdown parse error:', e);
            console.error('Input text:', text.substring(0, 500));
            return text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }
    }

    // Post-process chat message to beautify GraphQL code blocks
    function postProcessChatMessage(element) {
        // Find all GraphQL code blocks and beautify them
        element.querySelectorAll('code.language-graphql, code.hljs.language-graphql').forEach(codeEl => {
            const code = codeEl.textContent;
            const beautified = beautifyGraphQL(code);
            if (beautified !== code) {
                // Re-highlight the beautified code
                const highlighted = hljs.highlight(beautified, { language: 'graphql' }).value;
                codeEl.innerHTML = highlighted;
            }
        });
    }

    // Chat with Shopify AI
    async function sendChatMessage() {
        const message = chatInput.value.trim();
        if (!message) return;

        chatInput.value = '';
        chatInput.disabled = true;
        btnSendChat.disabled = true;

        // Add user message
        const userDiv = document.createElement('div');
        userDiv.className = 'chat-message user';
        userDiv.textContent = message;
        chatMessages.appendChild(userDiv);

        // Add assistant message placeholder
        const assistantDiv = document.createElement('div');
        assistantDiv.className = 'chat-message assistant streaming';
        assistantDiv.innerHTML = '<span class="typing-indicator">Thinking...</span>';
        chatMessages.appendChild(assistantDiv);

        chatMessages.scrollTop = chatMessages.scrollHeight;

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    prompt: message,
                    prompt_history: chatHistory
                })
            });

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let fullResponse = '';
            let updateTimeout = null;
            let buffer = ''; // Buffer for incomplete SSE lines

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                // Append decoded chunk to buffer
                buffer += decoder.decode(value, { stream: true });

                // Process complete SSE events (separated by \n\n)
                const events = buffer.split('\n\n');

                // Keep the last part in buffer (might be incomplete)
                buffer = events.pop() || '';

                for (const event of events) {
                    // Each event may have multiple lines (event:, data:, etc.)
                    const lines = event.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data:')) {
                            // Remove 'data:' prefix (don't trim - preserves whitespace tokens)
                            let data = line.substring(5);
                            // Server sends JSON-encoded strings to preserve newlines
                            try {
                                const parsed = JSON.parse(data);
                                if (typeof parsed === 'string') {
                                    data = parsed;
                                }
                            } catch (e) {
                                // Not JSON, use as-is
                            }
                            if (data) {
                                fullResponse += data;
                            }
                        }
                    }
                }

                // Throttle markdown rendering for performance
                if (updateTimeout) clearTimeout(updateTimeout);
                updateTimeout = setTimeout(() => {
                    assistantDiv.innerHTML = renderMarkdown(fullResponse, true); // streaming mode
                    chatMessages.scrollTop = chatMessages.scrollHeight;
                }, 50);
            }

            // Process any remaining buffer content
            if (buffer) {
                const lines = buffer.split('\n');
                for (const line of lines) {
                    if (line.startsWith('data:')) {
                        let data = line.substring(5);
                        // Try to parse as JSON string
                        try {
                            const parsed = JSON.parse(data);
                            if (typeof parsed === 'string') {
                                data = parsed;
                            }
                        } catch (e) {
                            // Not JSON, use as-is
                        }
                        if (data) {
                            fullResponse += data;
                        }
                    }
                }
            }

            // Final render (not streaming mode - no temporary fixes)
            assistantDiv.innerHTML = renderMarkdown(fullResponse, false);
            // Beautify GraphQL code blocks in the final message
            postProcessChatMessage(assistantDiv);
            assistantDiv.classList.remove('streaming');
            chatHistory.push(message);
            chatHistory.push(fullResponse);
            chatMessages.scrollTop = chatMessages.scrollHeight;
        } catch (error) {
            assistantDiv.innerHTML = '<span class="text-danger">Error: ' + error.message + '</span>';
            assistantDiv.classList.remove('streaming');
        } finally {
            chatInput.disabled = false;
            btnSendChat.disabled = false;
            chatInput.focus();
        }
    }

    // Settings Modal Functions
    function openSettingsModal() {
        // Populate modal with current global settings
        document.getElementById('globalUrl').value = globalSettings.url || '';

        // Clear and populate global headers
        const container = document.getElementById('globalHeadersContainer');
        container.innerHTML = '';
        if (globalSettings.headers && Object.keys(globalSettings.headers).length > 0) {
            Object.entries(globalSettings.headers).forEach(([key, value]) => {
                addGlobalHeaderRow(key, value);
            });
        } else {
            addGlobalHeaderRow();
        }

        // Populate auth
        const gAuthType = document.getElementById('globalAuthType');
        gAuthType.value = globalSettings.auth?.type || 'NONE';
        document.getElementById('globalBearerToken').value = globalSettings.auth?.bearerToken || '';
        document.getElementById('globalBasicUsername').value = globalSettings.auth?.basicUsername || '';
        document.getElementById('globalBasicPassword').value = globalSettings.auth?.basicPassword || '';
        document.getElementById('globalApiKeyHeader').value = globalSettings.auth?.apiKeyHeader || '';
        document.getElementById('globalApiKeyValue').value = globalSettings.auth?.apiKeyValue || '';
        updateGlobalAuthFields();

        settingsModal.show();
    }

    function addGlobalHeaderRow(key = '', value = '') {
        const container = document.getElementById('globalHeadersContainer');
        const row = document.createElement('div');
        row.className = 'global-header-row input-group input-group-sm mb-1';
        row.innerHTML = `
            <input type="text" class="form-control global-header-key" placeholder="Header name" value="${key}">
            <input type="text" class="form-control global-header-value" placeholder="Header value" value="${value}">
            <button class="btn btn-outline-danger btn-remove-global-header"><i class="bi bi-x"></i></button>
        `;
        row.querySelector('.btn-remove-global-header').addEventListener('click', function() {
            row.remove();
        });
        container.appendChild(row);
    }

    function updateGlobalAuthFields() {
        const type = document.getElementById('globalAuthType').value;
        document.getElementById('globalAuthBearerFields').style.display = type === 'BEARER_TOKEN' ? 'block' : 'none';
        document.getElementById('globalAuthBasicFields').style.display = type === 'BASIC_AUTH' ? 'block' : 'none';
        document.getElementById('globalAuthApiKeyFields').style.display = type === 'API_KEY' ? 'block' : 'none';
    }

    function saveSettingsFromModal() {
        // Get URL
        globalSettings.url = document.getElementById('globalUrl').value.trim();

        // Get headers
        globalSettings.headers = {};
        document.querySelectorAll('.global-header-row').forEach(row => {
            const key = row.querySelector('.global-header-key').value.trim();
            const value = row.querySelector('.global-header-value').value.trim();
            if (key) {
                globalSettings.headers[key] = value;
            }
        });

        // Get auth
        globalSettings.auth = {
            type: document.getElementById('globalAuthType').value,
            bearerToken: document.getElementById('globalBearerToken').value,
            basicUsername: document.getElementById('globalBasicUsername').value,
            basicPassword: document.getElementById('globalBasicPassword').value,
            apiKeyHeader: document.getElementById('globalApiKeyHeader').value,
            apiKeyValue: document.getElementById('globalApiKeyValue').value
        };

        saveGlobalSettings();

        // Apply to current request if checkbox is checked
        if (document.getElementById('applyToCurrentRequest').checked) {
            applyGlobalSettingsToCurrentRequest();
        }

        settingsModal.hide();
    }

    function applyGlobalSettingsToCurrentRequest() {
        // Apply URL if current is empty
        if (!urlInput.value.trim() && globalSettings.url) {
            urlInput.value = globalSettings.url;
        }

        // Apply auth if current is NONE
        if (authType.value === 'NONE' && globalSettings.auth?.type !== 'NONE') {
            authType.value = globalSettings.auth.type;
            document.getElementById('bearerToken').value = globalSettings.auth.bearerToken || '';
            document.getElementById('basicUsername').value = globalSettings.auth.basicUsername || '';
            document.getElementById('basicPassword').value = globalSettings.auth.basicPassword || '';
            document.getElementById('apiKeyHeader').value = globalSettings.auth.apiKeyHeader || '';
            document.getElementById('apiKeyValue').value = globalSettings.auth.apiKeyValue || '';
            updateAuthFields();
        }

        updateGlobalSettingsIndicator();
    }

    function updateGlobalSettingsIndicator() {
        const indicator = document.getElementById('globalSettingsIndicator');
        const summary = document.getElementById('globalSettingsSummary');
        const parts = [];

        // Check what global settings are active
        const hasGlobalUrl = globalSettings.url && !urlInput.value.trim();
        const hasGlobalAuth = globalSettings.auth?.type !== 'NONE' && authType.value === 'NONE';
        const hasGlobalHeaders = globalSettings.headers && Object.keys(globalSettings.headers).length > 0;

        if (hasGlobalUrl) {
            const shortUrl = globalSettings.url.length > 40
                ? globalSettings.url.substring(0, 40) + '...'
                : globalSettings.url;
            parts.push(`URL: ${shortUrl}`);
        }
        if (hasGlobalAuth) {
            parts.push(`Auth: ${globalSettings.auth.type}`);
        }
        if (hasGlobalHeaders) {
            parts.push(`${Object.keys(globalSettings.headers).length} header(s)`);
        }

        if (parts.length > 0) {
            summary.textContent = ' — ' + parts.join(', ');
            indicator.style.display = 'block';
        } else if (globalSettings.url || (globalSettings.auth?.type !== 'NONE') || hasGlobalHeaders) {
            // Show indicator that global settings exist but aren't being used for current request
            summary.textContent = ' (configured but overridden)';
            indicator.style.display = 'block';
        } else {
            indicator.style.display = 'none';
        }
    }

    // Event Listeners
    btnExecute.addEventListener('click', executeQuery);
    btnRefreshSchema.addEventListener('click', refreshSchema);
    btnSave.addEventListener('click', () => saveModal.show());
    btnConfirmSave.addEventListener('click', saveRequest);
    btnNewRequest.addEventListener('click', newRequest);
    btnAddHeader.addEventListener('click', () => addHeaderRow());
    btnSendChat.addEventListener('click', sendChatMessage);

    // Settings event listeners
    btnSettings.addEventListener('click', openSettingsModal);
    btnSaveSettings.addEventListener('click', saveSettingsFromModal);
    btnClearSettings.addEventListener('click', function() {
        if (confirm('Clear all global settings?')) {
            clearGlobalSettings();
            openSettingsModal(); // Refresh the modal
        }
    });
    btnAddGlobalHeader.addEventListener('click', () => addGlobalHeaderRow());
    globalAuthType.addEventListener('change', updateGlobalAuthFields);

    // Update indicator when URL or auth changes
    urlInput.addEventListener('input', updateGlobalSettingsIndicator);
    authType.addEventListener('change', function() {
        updateAuthFields();
        updateGlobalSettingsIndicator();
    });

    // Schema search
    const schemaSearch = document.getElementById('schemaSearch');
    schemaSearch.addEventListener('input', debounce(function() {
        currentSearchTerm = this.value.trim();
        if (schemaData) {
            renderSchema(schemaData, currentSearchTerm);
        }
    }, 200));

    // Beautify button
    document.getElementById('btnBeautify').addEventListener('click', function() {
        const query = queryEditor.getValue();
        const beautified = beautifyGraphQL(query);
        queryEditor.setValue(beautified);
    });

    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendChatMessage();
        }
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        // Ctrl/Cmd + Enter to execute
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            executeQuery();
        }
        // Ctrl/Cmd + S to save
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveModal.show();
        }
    });

    // GraphQL Autocomplete
    function graphqlHint(cm) {
        const cursor = cm.getCursor();
        const token = cm.getTokenAt(cursor);
        const line = cm.getLine(cursor.line);

        // Get word being typed
        let start = token.start;
        let end = cursor.ch;
        let word = token.string.trim();

        // If we're at whitespace or special char, adjust
        if (!word || /^[\s{}\(\):,]$/.test(word)) {
            word = '';
            start = end;
        }

        const hints = [];

        if (!schemaData || !schemaTypesMap) {
            return null;
        }

        // Analyze context to determine what to suggest
        const textBefore = line.substring(0, cursor.ch);
        const fullText = cm.getValue().substring(0, cm.indexFromPos(cursor));

        // Find the current type context by tracing the field path
        let currentType = findCurrentTypeContext(fullText);

        // Add field suggestions from current type
        if (currentType && currentType.fields) {
            currentType.fields.forEach(field => {
                if (field.name.toLowerCase().startsWith(word.toLowerCase())) {
                    let displayText = field.name;
                    let insertText = field.name;

                    // Show args info in display
                    if (field.args && field.args.length > 0) {
                        const argsList = field.args.map(a => `${a.name}: ${a.typeName}${a.nonNull ? '!' : ''}`).join(', ');
                        displayText += `(${field.args.length} args)`;
                    }

                    hints.push({
                        text: insertText,
                        displayText: displayText + ' → ' + field.typeName,
                        className: 'graphql-hint-field',
                        render: function(element, self, data) {
                            element.innerHTML = `<span class="hint-field-name">${field.name}</span><span class="hint-field-type">${field.typeName}</span>`;
                        }
                    });
                }
            });
        }

        // Add GraphQL keywords at root level
        const keywords = ['query', 'mutation', 'subscription', 'fragment', 'on'];
        keywords.forEach(kw => {
            if (kw.startsWith(word.toLowerCase()) && word.length > 0) {
                hints.push({
                    text: kw,
                    displayText: kw,
                    className: 'graphql-hint-keyword'
                });
            }
        });

        // Add type names when appropriate (after 'on' keyword or for fragments)
        if (/\bon\s*$/.test(textBefore)) {
            Object.keys(schemaTypesMap).forEach(typeName => {
                if (!typeName.startsWith('__') && typeName.toLowerCase().startsWith(word.toLowerCase())) {
                    hints.push({
                        text: typeName,
                        displayText: typeName,
                        className: 'graphql-hint-type'
                    });
                }
            });
        }

        // Check if we're inside arguments (after a field name and open paren)
        const argContext = findArgumentContext(fullText, textBefore);
        if (argContext) {
            argContext.args.forEach(arg => {
                if (arg.name.toLowerCase().startsWith(word.toLowerCase())) {
                    hints.push({
                        text: arg.name + ': ',
                        displayText: arg.name + ': ' + arg.typeName + (arg.nonNull ? '!' : ''),
                        className: 'graphql-hint-arg'
                    });
                }
            });
        }

        if (hints.length === 0) {
            return null;
        }

        return {
            list: hints,
            from: CodeMirror.Pos(cursor.line, start),
            to: CodeMirror.Pos(cursor.line, end)
        };
    }

    // Find the current type context by parsing the query structure
    function findCurrentTypeContext(fullText) {
        if (!schemaData || !schemaTypesMap) return null;

        // Remove strings to avoid confusion
        const cleanText = fullText.replace(/"[^"]*"/g, '""');

        // Track brace depth and field path
        let depth = 0;
        const fieldStack = []; // Stack of { fieldName, typeName }

        // Start with Query type at root
        let rootTypeName = schemaData.queryTypeName;

        // Check if this is a mutation
        if (/^\s*mutation\b/.test(cleanText)) {
            rootTypeName = schemaData.mutationTypeName;
        }

        // Tokenize and trace path
        const tokens = cleanText.match(/(\w+)\s*(?:\([^)]*\))?\s*{|}|\w+/g) || [];

        let currentTypeName = rootTypeName;

        for (const token of tokens) {
            if (token === '}') {
                depth--;
                if (fieldStack.length > 0) {
                    fieldStack.pop();
                    currentTypeName = fieldStack.length > 0
                        ? fieldStack[fieldStack.length - 1].typeName
                        : rootTypeName;
                }
            } else if (token.endsWith('{')) {
                // Field with opening brace
                const fieldName = token.replace(/\s*{$/, '').replace(/\s*\([^)]*\)\s*$/, '');
                const currentType = schemaTypesMap[currentTypeName];

                if (currentType && currentType.fields) {
                    const field = currentType.fields.find(f => f.name === fieldName);
                    if (field) {
                        const returnTypeName = extractBaseTypeName(field.typeName);
                        fieldStack.push({ fieldName, typeName: returnTypeName });
                        currentTypeName = returnTypeName;
                    }
                }
                depth++;
            }
        }

        return schemaTypesMap[currentTypeName];
    }

    // Find if we're inside function arguments
    function findArgumentContext(fullText, textBefore) {
        // Check if we're inside parentheses for a field
        const openParens = (textBefore.match(/\(/g) || []).length;
        const closeParens = (textBefore.match(/\)/g) || []).length;

        if (openParens <= closeParens) return null;

        // Find the field name before the open paren
        const match = fullText.match(/(\w+)\s*\([^)]*$/);
        if (!match) return null;

        const fieldName = match[1];

        // Find this field in the current context
        const currentType = findCurrentTypeContext(fullText.replace(/\([^)]*$/, ''));
        if (!currentType || !currentType.fields) return null;

        const field = currentType.fields.find(f => f.name === fieldName);
        if (!field || !field.args || field.args.length === 0) return null;

        return { fieldName, args: field.args };
    }

    // Register the hint function
    CodeMirror.registerHelper('hint', 'graphql', graphqlHint);

    // Enable autocomplete on input
    queryEditor.on('inputRead', function(cm, change) {
        if (change.origin !== '+input') return;
        const char = change.text[0];

        // Trigger autocomplete on letters or after certain characters
        if (/[a-zA-Z_]/.test(char) || char === '{' || char === '(') {
            cm.showHint({
                hint: graphqlHint,
                completeSingle: false
            });
        }
    });

    // Also trigger on Ctrl+Space
    queryEditor.setOption('extraKeys', {
        'Ctrl-Space': function(cm) {
            cm.showHint({ hint: graphqlHint });
        }
    });

    // Cmd+click (or Ctrl+click) on word in query to open docs
    queryEditor.on('mousedown', function(cm, e) {
        if (e.metaKey || e.ctrlKey) {
            e.preventDefault();
            const pos = cm.coordsChar({ left: e.clientX, top: e.clientY });
            const token = cm.getTokenAt(pos);
            const word = token.string.trim();

            if (word && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(word)) {
                // Try to find this as a field or type
                lookupDocumentation(word);
            }
        }
    });

    // Look up documentation for a word (field or type name)
    function lookupDocumentation(word) {
        if (!schemaData || !schemaTypesMap) return;

        // Reset history when starting a new lookup from query editor
        docsHistory = [];

        // First check if it's a type name
        if (schemaTypesMap[word]) {
            showTypeDocumentation(word);
            return;
        }

        // Search for it as a field in Query type
        const queryType = schemaTypesMap[schemaData.queryTypeName];
        if (queryType && queryType.fields) {
            const field = queryType.fields.find(f => f.name === word);
            if (field) {
                showFieldDocumentation(schemaData.queryTypeName, word);
                return;
            }
        }

        // Search for it as a field in Mutation type
        const mutationType = schemaTypesMap[schemaData.mutationTypeName];
        if (mutationType && mutationType.fields) {
            const field = mutationType.fields.find(f => f.name === word);
            if (field) {
                showFieldDocumentation(schemaData.mutationTypeName, word);
                return;
            }
        }

        // Search all types for this field
        for (const [typeName, type] of Object.entries(schemaTypesMap)) {
            if (type.fields) {
                const field = type.fields.find(f => f.name === word);
                if (field) {
                    showFieldDocumentation(typeName, word);
                    return;
                }
            }
        }

        console.log('No documentation found for:', word);
    }

    // Initialize
    addHeaderRow();
    updateAuthFields();
    loadSavedRequests(); // Load and attach click handlers to saved requests
    updateGlobalSettingsIndicator(); // Show global settings indicator if configured
});

// Copy code block to clipboard (global function for onclick)
function copyCodeBlock(button) {
    const codeBlock = button.closest('.code-block-wrapper').querySelector('code');
    const text = codeBlock.textContent;

    navigator.clipboard.writeText(text).then(() => {
        const icon = button.querySelector('i');
        icon.className = 'bi bi-check';
        button.classList.add('copied');
        setTimeout(() => {
            icon.className = 'bi bi-clipboard';
            button.classList.remove('copied');
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy:', err);
    });
}

// Use GraphQL query in editor (global function for onclick)
function useQueryInEditor(button) {
    const codeBlock = button.closest('.code-block-wrapper').querySelector('code');
    const query = codeBlock.textContent;

    // Use the globally stored CodeMirror instance
    if (window.graphManQueryEditor) {
        window.graphManQueryEditor.setValue(query);
    }

    // Visual feedback
    const originalText = button.innerHTML;
    button.innerHTML = '<i class="bi bi-check"></i> Added';
    button.classList.add('copied');
    setTimeout(() => {
        button.innerHTML = originalText;
        button.classList.remove('copied');
    }, 2000);
}
