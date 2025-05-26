/** 
 * Function to sanitize text and force LTR orientations
 * @returns {string}
*/
function sanitizeText(text) {
    if (!text) return ''; // Handle null/undefined cases

    // Strip Unicode bidirectional control characters
    const cleanedText = text.replace(/[\u200E\u200F\u202D\u202E\u2066-\u2069]/g, '');

    // Ensure the result isn't empty or just whitespace
    return cleanedText.trim() === '' ? null : cleanedText;
}

function sanitizeUsername(text) {
    // Reject usernames that contain anything other than letters, numbers, or periods
    if (!/^[a-zA-Z0-9.]+$/.test(text)) {
        return null; // Return null to indicate invalid input
    }

    // Escape basic HTML characters for safety (may or may not be redundant at this point)
    const cleansedHTML = text.replace(/[<>"&]/g, match => ({
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        '&': '&amp;'
    }[match]));

    return sanitizeText(cleansedHTML);
}


module.exports = { sanitizeText, sanitizeUsername };