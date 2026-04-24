
const fs = require('fs');

const file = 'c:/Users/Hp/Desktop/LMS/Gracified-Learning-Management-System/LMS/frontend/src/pages/ClassroomDetail.jsx';

try {
    const content = fs.readFileSync(file, 'utf8');
    let braces = 0;
    let parens = 0;
    let brackets = 0;
    
    for (let i = 0; i < content.length; i++) {
        if (content[i] === '{') braces++;
        if (content[i] === '}') braces--;
        if (content[i] === '(') parens++;
        if (content[i] === ')') parens--;
        if (content[i] === '[') brackets++;
        if (content[i] === ']') brackets--;
    }
    
    console.log(`${file}: Braces=${braces}, Parens=${parens}, Brackets=${brackets}`);
} catch (e) {
    console.log(`Error reading ${file}: ${e.message}`);
}
