// This script is injected into the iframe to handle element interactions
(function() {
    let hoveredElement = null;
    let selectedElement = null;
    let elementIndex = 0;

    // Index all elements in the document
    function indexElements() {
        elementIndex = 0;
        const allElements = document.body.querySelectorAll('*');
        
        allElements.forEach((element) => {
            // Skip script and style elements
            if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return;
            
            elementIndex++;
            element.setAttribute('data-editor-index', elementIndex);
        });

        // Notify parent of element count
        window.parent.postMessage({
            type: 'elementCount',
            count: elementIndex
        }, '*');
    }

    // Get element details
    function getElementDetails(element) {
        const rect = element.getBoundingClientRect();
        const index = element.getAttribute('data-editor-index');
        
        // Get scroll offsets
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;
        
        // Get the outer HTML of the element (limited to prevent huge payloads)
        let outerHTML = element.outerHTML;
        if (outerHTML.length > 1000) {
            // For large elements, just get the opening tag and some content
            const openTag = outerHTML.match(/^<[^>]+>/)?.[0] || '';
            const textContent = element.textContent.trim().substring(0, 200);
            outerHTML = `${openTag}...${textContent}...`;
        }
        
        return {
            index: parseInt(index),
            tagName: element.tagName.toLowerCase(),
            id: element.id,
            className: element.className,
            content: element.textContent.trim().substring(0, 100),
            outerHTML: outerHTML,
            innerHTML: element.innerHTML.substring(0, 500), // First 500 chars of inner HTML
            rect: {
                top: rect.top,
                left: rect.left,
                width: rect.width,
                height: rect.height
            },
            scroll: {
                x: scrollX,
                y: scrollY
            }
        };
    }

    // Handle mouse over
    function handleMouseOver(e) {
        e.stopPropagation();
        
        const element = e.target;
        if (element === hoveredElement || element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return;
        
        hoveredElement = element;
        
        const details = getElementDetails(element);
        window.parent.postMessage({
            type: 'elementHover',
            ...details
        }, '*');
    }

    // Handle mouse out
    function handleMouseOut(e) {
        e.stopPropagation();
        
        if (e.target === hoveredElement) {
            hoveredElement = null;
            window.parent.postMessage({
                type: 'elementOut'
            }, '*');
        }
    }

    // Handle click
    function handleClick(e) {
        e.preventDefault();
        e.stopPropagation();
        
        const element = e.target;
        if (element.tagName === 'SCRIPT' || element.tagName === 'STYLE') return;
        
        selectedElement = element;
        
        const details = getElementDetails(element);
        window.parent.postMessage({
            type: 'elementClick',
            ...details
        }, '*');
    }

    // Attach event listeners to all elements
    function attachListeners() {
        document.body.addEventListener('mouseover', handleMouseOver, true);
        document.body.addEventListener('mouseout', handleMouseOut, true);
        document.body.addEventListener('click', handleClick, true);
        
        // Listen for scroll events to update overlay position
        window.addEventListener('scroll', function() {
            if (hoveredElement) {
                const details = getElementDetails(hoveredElement);
                window.parent.postMessage({
                    type: 'elementHover',
                    ...details
                }, '*');
            }
        }, true);
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            indexElements();
            attachListeners();
        });
    } else {
        indexElements();
        attachListeners();
    }

    // Re-index on mutations
    const observer = new MutationObserver(function(mutations) {
        indexElements();
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
})();