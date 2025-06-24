document.getElementById('convertBtn').addEventListener('click', () => {
    const fileInput = document.getElementById('fileInput');
    const outputPre = document.getElementById('output');
    const downloadLink = document.getElementById('downloadLink');

    if (!fileInput.files.length) {
        alert('Please select a file.');
        return;
    }

    const file = fileInput.files[0];
    const reader = new FileReader();

    reader.onload = () => {
        const text = reader.result;
        const lines = text.split(/\r?\n/);
        const convertedLines = lines.map(line => {
            if (line.includes('S1000')) {
                return 'G1 Z-1 F100';
            }
            if (line.includes('S0') || line.includes('M5')) {
                return 'G1 Z1 F100';
            }
            return line;
        });
        const result = convertedLines.join('\n');
        outputPre.textContent = result;
        const blob = new Blob([result], { type: 'text/plain' });
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.style.display = 'inline';
    };

    reader.readAsText(file);
});
