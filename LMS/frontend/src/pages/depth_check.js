
const fs = require('fs');

const file = 'c:/Users/Hp/Desktop/LMS/Gracified-Learning-Management-System/LMS/frontend/src/pages/ExamSubmissions.jsx';

try {
    const content = fs.readFileSync(file, 'utf8');
    let depth = 0;
    let maxDepth = 0;
    const lines = content.split('\n');
    
    lines.forEach((line, i) => {
        let open = (line.match(/<[a-zA-Z]/g) || []).length;
        let selfClose = (line.match(/\/>/g) || []).length;
        let close = (line.match(/<\//g) || []).length;
        
        depth += (open - selfClose - close);
        if (depth > maxDepth) maxDepth = depth;
        if (depth < 0) console.log(`Negative depth at line ${i+1}: ${depth}`);
    });
    
    console.log(`Final Depth: ${depth}, Max Depth: ${maxDepth}`);
} catch (e) {
    console.log(`Error: ${e.message}`);
}
