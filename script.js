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
        const newline = text.includes('\r\n') ? '\r\n' : '\n';
        const lines = text.split(/\r?\n/);
        const convertedLines = lines.map(line => {
            const trimmed = line.trim();
            if (/\bM3\b/i.test(trimmed) || /\bS1000\b/i.test(trimmed)) {
                return 'G1 Z-1 F100';
            }
            if (/\bM5\b/i.test(trimmed) || /\bS0\b/i.test(trimmed)) {
                return 'G1 Z1 F100';
            }
            return line;
        });
        const result = convertedLines.join(newline);
        outputPre.textContent = result;
        const blob = new Blob([result], { type: 'text/plain' });
        downloadLink.href = URL.createObjectURL(blob);
        downloadLink.style.display = 'inline';
    };

    reader.readAsText(file);
});
