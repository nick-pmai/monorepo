document.addEventListener('DOMContentLoaded', function() {
    const button = document.getElementById('testButton');
    const output = document.getElementById('output');
    let clickCount = 0;
    
    button.addEventListener('click', function() {
        clickCount++;
        output.textContent = `Button clicked ${clickCount} time${clickCount !== 1 ? 's' : ''}! JavaScript is working correctly.`;
        output.style.backgroundColor = '#d4edda';
        output.style.color = '#155724';
        output.style.border = '1px solid #c3e6cb';
    });
    
    // Change title color on load to show JS is working
    document.getElementById('title').style.color = '#007bff';
});