document.addEventListener('DOMContentLoaded', function() {
    // Initialize editor
    const editor = document.getElementById('editor');
    const wordCount = document.getElementById('word-count');
    const charCount = document.getElementById('char-count');
    
    // Notification function for user feedback
    function showNotification(message, type = 'success') {
        try {
            const notification = document.createElement('div');
            notification.className = 'notification';
            notification.setAttribute('role', 'status');
            notification.setAttribute('aria-live', 'polite');
            notification.textContent = message;
            
            // Set color based on type
            if (type === 'error') {
                notification.style.backgroundColor = '#f44336';
            } else if (type === 'warning') {
                notification.style.backgroundColor = '#ff9800';
            } else {
                notification.style.backgroundColor = '#4CAF50';
            }
            
            document.body.appendChild(notification);
            
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 3000);
        } catch (error) {
            console.error('Error showing notification:', error);
        }
    }
    
    // Check for autosaved content
    const autosavedContent = localStorage.getItem('autosavedContent');
    if (autosavedContent) {
        editor.innerHTML = autosavedContent;
    } else {
        editor.innerHTML = '<p>Start typing your document here...</p>';
    }
    
    editor.focus();
    updateCounts();
    
    // Initialize undo/redo stacks
    const undoStack = [];
    const redoStack = [];
    let lastContent = editor.innerHTML;
    let spellCheckEnabled = false;
    let autosaveTimer = null;
    let stateTimer = null;
    
    // Save current state for undo
    function saveState() {
        if (editor.innerHTML !== lastContent) {
            undoStack.push(lastContent);
            lastContent = editor.innerHTML;
            redoStack.length = 0; // Clear redo stack when new changes are made
            
            // Limit stack size to prevent memory issues
            if (undoStack.length > 50) {
                undoStack.shift();
            }
        }
    }
    
    // Save state periodically using requestAnimationFrame for better performance
    function scheduleStateSave() {
        if (stateTimer) {
            cancelAnimationFrame(stateTimer);
        }
        
        stateTimer = requestAnimationFrame(function() {
            saveState();
            // Schedule next check
            setTimeout(scheduleStateSave, 1000);
        });
    }
    scheduleStateSave();
    
    // Autosave content every 5 seconds - using debounce pattern for better performance
    function autosave() {
        if (autosaveTimer) {
            clearTimeout(autosaveTimer);
        }
        
        autosaveTimer = setTimeout(function() {
            try {
                localStorage.setItem('autosavedContent', editor.innerHTML);
                
                // Show autosave indicator
                const statusBar = document.querySelector('.status-bar');
                const autosaveIndicator = document.getElementById('autosave-indicator') || document.createElement('div');
                
                if (!document.getElementById('autosave-indicator')) {
                    autosaveIndicator.id = 'autosave-indicator';
                    statusBar.appendChild(autosaveIndicator);
                }
                
                autosaveIndicator.textContent = 'Autosaved at ' + new Date().toLocaleTimeString();
                autosaveIndicator.style.color = '#4CAF50';
                
                // Fade out the indicator after 2 seconds
                setTimeout(function() {
                    autosaveIndicator.style.color = '#999';
                }, 2000);
            } catch (e) {
                console.error('Error autosaving content:', e);
            }
        }, 5000);
    }
    
    // Trigger autosave on input
    editor.addEventListener('input', autosave);
    // Initial autosave
    autosave();
    
    editor.addEventListener('keyup', function(e) {
        // Save state on specific keys that likely change content
        if (e.key === ' ' || e.key === 'Enter' || e.key === 'Delete' || e.key === 'Backspace') {
            saveState();
        }
    });
    
    // Also save state when formatting is applied
    editor.addEventListener('mouseup', saveState);
    
    // Spell check functionality
    const spellCheckButton = document.getElementById('spell-check');
    
    // Dictionary API mock - in production, this would be replaced with a real API call
    function getSuggestions(word) {
        // Sample dictionary with common words
        const dictionary = {
            'teh': ['the', 'tech', 'ten'],
            'thier': ['their', 'there', 'they'],
            'recieve': ['receive', 'relieve', 'reprieve'],
            'seperate': ['separate', 'desperate', 'temperate'],
            'definately': ['definitely', 'defiantly', 'infinitely'],
            'accomodate': ['accommodate', 'accelerate', 'accumulate'],
            'occured': ['occurred', 'secured', 'obscured'],
            'untill': ['until', 'instill', 'entail']
        };
        
        // Return suggestions if available, or default suggestions
        return dictionary[word.toLowerCase()] || 
               ['suggestion1', 'suggestion2', 'suggestion3'];
    }
    
    spellCheckButton.addEventListener('click', function() {
        try {
            spellCheckEnabled = !spellCheckEnabled;
            editor.setAttribute('spellcheck', spellCheckEnabled);
            this.classList.toggle('active');
            
            // Update aria attributes for accessibility
            this.setAttribute('aria-pressed', spellCheckEnabled);
            editor.setAttribute('aria-live', 'polite');
            
            // Force spell check to run by recreating the editor content
            const content = editor.innerHTML;
            editor.innerHTML = content;
            
            // Announce state change for screen readers
            const announcement = document.createElement('div');
            announcement.className = 'sr-only';
            announcement.setAttribute('aria-live', 'assertive');
            announcement.textContent = 'Spell check ' + (spellCheckEnabled ? 'enabled' : 'disabled');
            document.body.appendChild(announcement);
            
            // Remove announcement after it's been read
            setTimeout(() => {
                if (document.body.contains(announcement)) {
                    document.body.removeChild(announcement);
                }
            }, 1000);
        } catch (e) {
            console.error('Error toggling spell check:', e);
        }
    });
    
    // Custom context menu for spell check suggestions
    editor.addEventListener('contextmenu', function(e) {
        // Check if right-clicking on a word with spell check enabled
        if (spellCheckEnabled && window.getSelection().toString().trim().length > 0) {
            e.preventDefault();
            
            try {
                // Get the selected word
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                
                // Create a temporary span to mark the word
                const range = selection.getRangeAt(0);
                const span = document.createElement('span');
                span.className = 'misspelled';
                
                try {
                    range.surroundContents(span);
                } catch (rangeError) {
                    // Handle case where selection crosses node boundaries
                    console.warn('Selection crosses node boundaries, using alternative approach');
                    
                    // Alternative approach: delete selection and insert span
                    range.deleteContents();
                    span.textContent = selectedText;
                    range.insertNode(span);
                }
                
                // Create custom context menu
                const contextMenu = document.createElement('div');
                contextMenu.className = 'spell-check-menu';
                contextMenu.setAttribute('role', 'menu');
                contextMenu.setAttribute('aria-label', 'Spelling suggestions');
                contextMenu.style.position = 'absolute';
                contextMenu.style.left = e.pageX + 'px';
                contextMenu.style.top = e.pageY + 'px';
                contextMenu.style.background = '#fff';
                contextMenu.style.border = '1px solid #ddd';
                contextMenu.style.borderRadius = '4px';
                contextMenu.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
                contextMenu.style.padding = '5px 0';
                contextMenu.style.zIndex = '1000';
                
                // Get suggestions for the selected word
                const suggestions = getSuggestions(selectedText);
                
                // Add a header
                const header = document.createElement('div');
                header.textContent = 'Suggestions:';
                header.setAttribute('role', 'presentation');
                header.style.padding = '5px 10px';
                header.style.fontWeight = 'bold';
                header.style.borderBottom = '1px solid #ddd';
                contextMenu.appendChild(header);
                
                // No suggestions case
                if (suggestions.length === 0) {
                    const noSuggestions = document.createElement('div');
                    noSuggestions.textContent = 'No suggestions available';
                    noSuggestions.style.padding = '5px 10px';
                    noSuggestions.style.fontStyle = 'italic';
                    noSuggestions.style.color = '#999';
                    contextMenu.appendChild(noSuggestions);
                }
                
                suggestions.forEach(function(suggestion) {
                    const item = document.createElement('div');
                    item.textContent = suggestion;
                    item.setAttribute('role', 'menuitem');
                    item.setAttribute('tabindex', '0');
                    item.style.padding = '5px 10px';
                    item.style.cursor = 'pointer';
                    
                    item.addEventListener('mouseover', function() {
                        this.style.backgroundColor = '#f0f0f0';
                    });
                    
                    item.addEventListener('mouseout', function() {
                        this.style.backgroundColor = 'transparent';
                    });
                    
                    // Support keyboard navigation
                    item.addEventListener('keydown', function(e) {
                        if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            this.click();
                        } else if (e.key === 'ArrowDown') {
                            e.preventDefault();
                            const nextItem = this.nextElementSibling;
                            if (nextItem && nextItem.getAttribute('role') === 'menuitem') {
                                nextItem.focus();
                            }
                        } else if (e.key === 'ArrowUp') {
                            e.preventDefault();
                            const prevItem = this.previousElementSibling;
                            if (prevItem && prevItem.getAttribute('role') === 'menuitem') {
                                prevItem.focus();
                            }
                        }
                    });
                    
                    item.addEventListener('click', function() {
                        // Replace the misspelled word with the suggestion
                        span.textContent = suggestion;
                        span.className = ''; // Remove the misspelled class
                        
                        // Remove the context menu
                        if (document.body.contains(contextMenu)) {
                            document.body.removeChild(contextMenu);
                        }
                        
                        // Save state after correction
                        saveState();
                    });
                    
                    contextMenu.appendChild(item);
                });
                
                // Add an "Ignore" option
                const ignoreItem = document.createElement('div');
                ignoreItem.textContent = 'Ignore';
                ignoreItem.setAttribute('role', 'menuitem');
                ignoreItem.setAttribute('tabindex', '0');
                ignoreItem.style.padding = '5px 10px';
                ignoreItem.style.cursor = 'pointer';
                ignoreItem.style.borderTop = '1px solid #ddd';
                
                ignoreItem.addEventListener('mouseover', function() {
                    this.style.backgroundColor = '#f0f0f0';
                });
                
                ignoreItem.addEventListener('mouseout', function() {
                    this.style.backgroundColor = 'transparent';
                });
                
                // Support keyboard navigation
                ignoreItem.addEventListener('keydown', function(e) {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        this.click();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        const prevItem = this.previousElementSibling;
                        if (prevItem && prevItem.getAttribute('role') === 'menuitem') {
                            prevItem.focus();
                        }
                    }
                });
                
                ignoreItem.addEventListener('click', function() {
                    // Remove the misspelled class
                    span.className = '';
                    
                    // Remove the context menu
                    if (document.body.contains(contextMenu)) {
                        document.body.removeChild(contextMenu);
                    }
                });
                
                contextMenu.appendChild(ignoreItem);
                
                // Add the context menu to the document
                document.body.appendChild(contextMenu);
                
                // Focus the first suggestion for keyboard accessibility
                if (contextMenu.querySelector('[role="menuitem"]')) {
                    setTimeout(() => {
                        contextMenu.querySelector('[role="menuitem"]').focus();
                    }, 10);
                }
                
                // Close the context menu when clicking outside
                document.addEventListener('click', function closeMenu(e) {
                    if (!contextMenu.contains(e.target)) {
                        if (document.body.contains(contextMenu)) {
                            document.body.removeChild(contextMenu);
                        }
                        document.removeEventListener('click', closeMenu);
                    }
                });
                
                // Also close on scroll
                window.addEventListener('scroll', function closeMenuOnScroll() {
                    if (document.body.contains(contextMenu)) {
                        document.body.removeChild(contextMenu);
                    }
                    window.removeEventListener('scroll', closeMenuOnScroll);
                });
                
                // Close on Escape key
                document.addEventListener('keydown', function closeMenuOnEscape(e) {
                    if (e.key === 'Escape') {
                        if (document.body.contains(contextMenu)) {
                            document.body.removeChild(contextMenu);
                        }
                        document.removeEventListener('keydown', closeMenuOnEscape);
                    }
                });
                
                // Remove the temporary span
                const parent = span.parentNode;
                while (span.firstChild) {
                    parent.insertBefore(span.firstChild, span);
                }
                parent.removeChild(span);
            } catch (error) {
                console.error('Error in spell check context menu:', error);
            }
        }
    });
    
    // Select all content when editor is first clicked
    let initialClick = true;
    editor.addEventListener('click', function() {
        if (initialClick) {
            selectAllContent();
            initialClick = false;
        }
    });
    
    // Update word and character counts
    editor.addEventListener('input', updateCounts);
    
    function updateCounts() {
        const text = editor.innerText || '';
        const words = text.trim() === '' ? 0 : text.trim().split(/\s+/).length;
        const chars = text.length;
        
        wordCount.textContent = `Words: ${words}`;
        charCount.textContent = `Characters: ${chars}`;
    }
    
    function selectAllContent() {
        const range = document.createRange();
        range.selectNodeContents(editor);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
    }
    
    // Text formatting functions
    function execFormatCommand(command, value = null) {
        document.execCommand(command, false, value);
        editor.focus();
    }
    
    // Font family
    document.getElementById('font-family').addEventListener('change', function() {
        execFormatCommand('fontName', this.value);
    });
    
    // Font size
    document.getElementById('font-size').addEventListener('change', function() {
        execFormatCommand('fontSize', this.value);
    });
    
    // Bold
    document.getElementById('bold').addEventListener('click', function() {
        execFormatCommand('bold');
        this.classList.toggle('active');
        this.setAttribute('aria-pressed', this.classList.contains('active'));
    });
    
    // Italic
    document.getElementById('italic').addEventListener('click', function() {
        execFormatCommand('italic');
        this.classList.toggle('active');
        this.setAttribute('aria-pressed', this.classList.contains('active'));
    });
    
    // Underline
    document.getElementById('underline').addEventListener('click', function() {
        execFormatCommand('underline');
        this.classList.toggle('active');
        this.setAttribute('aria-pressed', this.classList.contains('active'));
    });
    
    // Strikethrough
    document.getElementById('strikethrough').addEventListener('click', function() {
        execFormatCommand('strikeThrough');
        this.classList.toggle('active');
        this.setAttribute('aria-pressed', this.classList.contains('active'));
    });
    
    // Text alignment
    document.getElementById('align-left').addEventListener('click', function() {
        execFormatCommand('justifyLeft');
    });
    
    document.getElementById('align-center').addEventListener('click', function() {
        execFormatCommand('justifyCenter');
    });
    
    document.getElementById('align-right').addEventListener('click', function() {
        execFormatCommand('justifyRight');
    });
    
    document.getElementById('align-justify').addEventListener('click', function() {
        execFormatCommand('justifyFull');
    });
    
    // Lists
    document.getElementById('ordered-list').addEventListener('click', function() {
        execFormatCommand('insertOrderedList');
    });
    
    document.getElementById('unordered-list').addEventListener('click', function() {
        execFormatCommand('insertUnorderedList');
    });
    
    // Indentation
    document.getElementById('indent').addEventListener('click', function() {
        execFormatCommand('indent');
    });
    
    document.getElementById('outdent').addEventListener('click', function() {
        execFormatCommand('outdent');
    });
    
    // Colors
    document.getElementById('font-color').addEventListener('input', function() {
        execFormatCommand('foreColor', this.value);
    });
    
    document.getElementById('highlight-color').addEventListener('input', function() {
        execFormatCommand('hiliteColor', this.value);
    });
    
    // Link handling
    const linkModal = document.getElementById('link-modal');
    const linkUrl = document.getElementById('link-url');
    const linkText = document.getElementById('link-text');
    
    document.getElementById('insert-link').addEventListener('click', function() {
        const selection = window.getSelection();
        if (selection.toString()) {
            linkText.value = selection.toString();
        } else {
            linkText.value = '';
        }
        linkUrl.value = 'https://';
        linkModal.style.display = 'block';
    });
    
    document.getElementById('insert-link-btn').addEventListener('click', function() {
        if (linkUrl.value) {
            const url = linkUrl.value.trim();
            const text = linkText.value.trim() || url;
            
            // Create the link
            const link = document.createElement('a');
            link.href = url;
            link.textContent = text;
            link.target = '_blank'; // Open in new tab
            
            // Insert the link at cursor position or replace selection
            const selection = window.getSelection();
            if (selection.rangeCount) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                range.insertNode(link);
                
                // Move cursor to end of link
                range.setStartAfter(link);
                range.setEndAfter(link);
                selection.removeAllRanges();
                selection.addRange(range);
            }
            
            linkModal.style.display = 'none';
            editor.focus();
            updateCounts();
        }
    });
    
    // Image insertion
    document.getElementById('insert-image').addEventListener('click', function() {
        const imageUrl = prompt('Enter image URL:');
        if (imageUrl) {
            execFormatCommand('insertImage', imageUrl);
        }
    });
    
    // Table handling
    const tableModal = document.getElementById('table-modal');
    
    document.getElementById('insert-table').addEventListener('click', function() {
        tableModal.style.display = 'block';
    });
    
    document.getElementById('insert-table-btn').addEventListener('click', function() {
        const rows = parseInt(document.getElementById('table-rows').value);
        const cols = parseInt(document.getElementById('table-cols').value);
        const includeHeader = document.getElementById('table-header').checked;
        
        if (rows > 0 && cols > 0) {
            try {
                insertTable(rows, cols, includeHeader);
                tableModal.style.display = 'none';
                editor.focus();
                showNotification(`Table with ${rows} rows and ${cols} columns inserted`);
            } catch (error) {
                console.error('Error inserting table:', error);
                showNotification('Error inserting table', 'error');
            }
        }
    });
    
    function insertTable(rows, cols, includeHeader) {
        // Create table element using DOM API instead of HTML string
        const table = document.createElement('table');
        
        // Create header if checked
        if (includeHeader) {
            const thead = document.createElement('thead');
            const headerRow = document.createElement('tr');
            
            for (let i = 0; i < cols; i++) {
                const th = document.createElement('th');
                th.textContent = `Header ${i+1}`;
                headerRow.appendChild(th);
            }
            
            thead.appendChild(headerRow);
            table.appendChild(thead);
            
            // Create body (subtract 1 from rows if header is included)
            const tbody = document.createElement('tbody');
            for (let i = 0; i < rows - 1; i++) {
                const row = document.createElement('tr');
                for (let j = 0; j < cols; j++) {
                    const cell = document.createElement('td');
                    cell.textContent = 'Cell';
                    row.appendChild(cell);
                }
                tbody.appendChild(row);
            }
            table.appendChild(tbody);
        } else {
            // No header, just create body with all rows
            const tbody = document.createElement('tbody');
            for (let i = 0; i < rows; i++) {
                const row = document.createElement('tr');
                for (let j = 0; j < cols; j++) {
                    const cell = document.createElement('td');
                    cell.textContent = 'Cell';
                    row.appendChild(cell);
                }
                tbody.appendChild(row);
            }
            table.appendChild(tbody);
        }
        
        // Get current selection
        const selection = window.getSelection();
        if (selection.rangeCount) {
            // Get the range at the current cursor position
            const range = selection.getRangeAt(0);
            
            // Delete any selected content
            range.deleteContents();
            
            // Insert the table at cursor position
            range.insertNode(table);
            
            // Move cursor after the table
            range.setStartAfter(table);
            range.setEndAfter(table);
            selection.removeAllRanges();
            selection.addRange(range);
        } else {
            // If no selection, just append to the editor
            editor.appendChild(table);
        }
        
        editor.focus();
    }
    
    // Close modals when clicking on X or outside
    const closeButtons = document.querySelectorAll('.close');
    closeButtons.forEach(function(button) {
        button.addEventListener('click', function() {
            linkModal.style.display = 'none';
            tableModal.style.display = 'none';
            editor.focus();
        });
    });
    
    window.addEventListener('click', function(event) {
        if (event.target === linkModal) {
            linkModal.style.display = 'none';
            editor.focus();
        }
        if (event.target === tableModal) {
            tableModal.style.display = 'none';
            editor.focus();
        }
    });
    
    // Add keyboard support for modals
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            if (linkModal.style.display === 'block') {
                linkModal.style.display = 'none';
                editor.focus();
            }
            if (tableModal.style.display === 'block') {
                tableModal.style.display = 'none';
                editor.focus();
            }
        }
    });
    
    // Trap focus in modals for accessibility
    function trapFocus(modal) {
        const focusableElements = modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];
        
        modal.addEventListener('keydown', function(e) {
            if (e.key === 'Tab') {
                if (e.shiftKey && document.activeElement === firstElement) {
                    e.preventDefault();
                    lastElement.focus();
                } else if (!e.shiftKey && document.activeElement === lastElement) {
                    e.preventDefault();
                    firstElement.focus();
                }
            }
        });
        
        firstElement.focus();
    }
    
    document.getElementById('insert-link').addEventListener('click', function() {
        setTimeout(() => trapFocus(linkModal), 100);
    });
    
    document.getElementById('insert-table').addEventListener('click', function() {
        setTimeout(() => trapFocus(tableModal), 100);
    });
    
    // File operations
    const fileInput = document.getElementById('file-input');
    
    // New document
    document.getElementById('new-doc').addEventListener('click', function() {
        if (confirm('Create a new document? Any unsaved changes will be lost.')) {
            try {
                editor.innerHTML = '<p>Start typing your document here...</p>';
                localStorage.removeItem('autosavedContent'); // Clear autosaved content
                selectAllContent();
                updateCounts();
                showNotification('New document created');
            } catch (error) {
                console.error('Error creating new document:', error);
                showNotification('Error creating new document', 'error');
            }
        }
    });
    
    // Open document
    document.getElementById('open-doc').addEventListener('click', function() {
        fileInput.click();
    });
    
    fileInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            
            reader.onload = function(e) {
                try {
                    // Try to parse as HTML
                    editor.innerHTML = e.target.result;
                } catch (error) {
                    // If parsing fails, insert as plain text
                    editor.innerText = e.target.result;
                }
                updateCounts();
            };
            
            if (file.type === 'text/html') {
                reader.readAsText(file);
            } else {
                alert('Please select an HTML file.');
            }
        }
    });
    
    // Save document
    document.getElementById('save-doc').addEventListener('click', function() {
        try {
            const content = editor.innerHTML;
            const blob = new Blob([content], {type: 'text/html'});
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'document.html';
            a.click();
            
            // Update autosave with the saved content
            localStorage.setItem('autosavedContent', content);
            
            // Show save indicator in status bar
            const statusBar = document.querySelector('.status-bar');
            const saveIndicator = document.getElementById('autosave-indicator') || document.createElement('div');
            
            if (!document.getElementById('autosave-indicator')) {
                saveIndicator.id = 'autosave-indicator';
                statusBar.appendChild(saveIndicator);
            }
            
            saveIndicator.textContent = 'Document saved at ' + new Date().toLocaleTimeString();
            saveIndicator.style.color = '#4CAF50';
            
            // Show notification
            showNotification('Document saved successfully');
            
            setTimeout(function() {
                URL.revokeObjectURL(url);
                
                // Fade out the indicator after 2 seconds
                setTimeout(function() {
                    saveIndicator.style.color = '#999';
                }, 2000);
            }, 100);
        } catch (error) {
            console.error('Error saving document:', error);
            showNotification('Error saving document', 'error');
        }
    });
    
    // Print document
    document.getElementById('print-doc').addEventListener('click', function() {
        // Create a new window for printing
        const printWindow = window.open('', '_blank');
        
        // Create a complete HTML document with our editor content and styles
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Print Document</title>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333;
                        padding: 20px;
                        max-width: 8.5in;
                        margin: 0 auto;
                    }
                    table {
                        border-collapse: collapse;
                        width: 100%;
                        margin: 10px 0;
                    }
                    table, th, td {
                        border: 1px solid #ddd;
                    }
                    th, td {
                        padding: 8px;
                        text-align: left;
                    }
                    th {
                        background-color: #f2f2f2;
                    }
                    @media print {
                        body {
                            padding: 0;
                        }
                        @page {
                            margin: 1cm;
                        }
                    }
                </style>
            </head>
            <body>
                ${editor.innerHTML}
            </body>
            </html>
        `);
        
        // Wait for content to load then print
        printWindow.document.close();
        printWindow.addEventListener('load', function() {
            printWindow.focus();
            printWindow.print();
            // Close the window after printing (or if print is cancelled)
            printWindow.addEventListener('afterprint', function() {
                printWindow.close();
            });
        });
    });
    
    // Handle keyboard shortcuts
    editor.addEventListener('keydown', function(e) {
        // Ctrl+B: Bold
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            execFormatCommand('bold');
        }
        // Ctrl+I: Italic
        else if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            execFormatCommand('italic');
        }
        // Ctrl+U: Underline
        else if (e.ctrlKey && e.key === 'u') {
            e.preventDefault();
            execFormatCommand('underline');
        }
        // Ctrl+S: Save
        else if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            document.getElementById('save-doc').click();
        }
        // Ctrl+P: Print
        else if (e.ctrlKey && e.key === 'p') {
            e.preventDefault();
            document.getElementById('print-doc').click();
        }
        // Ctrl+Z: Undo
        else if (e.ctrlKey && e.key === 'z') {
            e.preventDefault();
            undo();
        }
        // Ctrl+Y: Redo
        else if (e.ctrlKey && e.key === 'y') {
            e.preventDefault();
            redo();
        }
    });
    
    // Undo function
    function undo() {
        if (undoStack.length > 0) {
            // Save current state to redo stack
            redoStack.push(editor.innerHTML);
            
            // Restore previous state
            const previousState = undoStack.pop();
            editor.innerHTML = previousState;
            lastContent = previousState;
            
            updateCounts();
        }
    }
    
    // Redo function
    function redo() {
        if (redoStack.length > 0) {
            // Save current state to undo stack
            undoStack.push(editor.innerHTML);
            
            // Restore next state
            const nextState = redoStack.pop();
            editor.innerHTML = nextState;
            lastContent = nextState;
            
            updateCounts();
        }
    }
    
    // Add undo/redo buttons to toolbar
    const firstToolbarSection = document.querySelector('.toolbar-section');
    
    const undoButton = document.createElement('button');
    undoButton.id = 'undo';
    undoButton.title = 'Undo (Ctrl+Z)';
    undoButton.setAttribute('aria-label', 'Undo');
    undoButton.innerHTML = '<i class="fas fa-undo" aria-hidden="true"></i>';
    undoButton.addEventListener('click', undo);
    
    const redoButton = document.createElement('button');
    redoButton.id = 'redo';
    redoButton.title = 'Redo (Ctrl+Y)';
    redoButton.setAttribute('aria-label', 'Redo');
    redoButton.innerHTML = '<i class="fas fa-redo" aria-hidden="true"></i>';
    redoButton.addEventListener('click', redo);
    
    firstToolbarSection.prepend(redoButton);
    firstToolbarSection.prepend(undoButton);
});